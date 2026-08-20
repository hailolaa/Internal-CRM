import { v4 as uuidv4 } from "uuid";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import type { PoolConnection } from "mysql2/promise";
import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { insertAuditEvent } from "../../utils/audit.js";
import { decryptProviderCredential, encryptProviderCredential } from "../../utils/provider-credentials.js";
import { generateResetToken, hashToken } from "../../utils/helpers.js";
import type {
  ClickUpAccessContext,
  ClickUpAuditContext,
  ClickUpCategoryKey,
  ClickUpCategoryMappingResponse,
  ClickUpClientMappingResponse,
  ClickUpConnectionResponse,
  ClickUpOperationsDashboardResponse,
  ClickUpOperationsTaskRecord,
  ClickUpOperationsWorkloadRow,
  ClickUpOperationsWorkstreamRow,
  CompleteClickUpOAuthDTO,
  CreateClickUpTaskDTO,
  SaveClickUpCategoryMappingDTO,
  SaveClickUpClientMappingDTO,
  SaveClickUpPriorityMappingDTO,
  SaveClickUpTaskMappingDTO,
  ClickUpPriorityMappingResponse,
  ClickUpTaskMappingResponse,
  StartClickUpOAuthResponse,
  CreateClickUpTaskResult,
  FailedTaskMapping,
  ClickUpReconciliationResponse,
  ClickUpSyncHealthRecord,
  ClickUpWebhookEventRecord,
  ClickUpWebhookProcessingStatus,
  ClickUpWebhookReceipt,
} from "./clickup.types.js";

const OAUTH_STATE_TTL_MINUTES = 20;
const CATEGORY_KEYS: ClickUpCategoryKey[] = ["development", "seo", "gmb_local_seo", "ppc", "managerial", "reporting", "account_control"];
const OPERATIONS_DASHBOARD_PAGE_LIMIT = 5;
const OPERATIONS_DASHBOARD_TASKS_PER_PAGE = 100;
const OPERATIONS_DASHBOARD_QUEUE_LIMIT = 12;
const CLICKUP_WEBHOOK_EVENT_VERSION = "v1";
const CLICKUP_EVENT_MAX_RETRIES = 5;
const CLICKUP_RECONCILIATION_LIMIT = 50;
const CLICKUP_LIFECYCLE_EVENTS = new Set([
  "taskCreated",
  "taskUpdated",
  "taskStatusUpdated",
  "taskAssigneeUpdated",
  "taskDueDateUpdated",
  "taskPriorityUpdated",
  "taskCompleted",
  "taskDeleted",
  "taskArchived",
  "taskUnarchived",
  "taskMoved",
]);

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);

  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toIsoString(value: unknown) {
  if (!value) return null;
  return new Date(String(value)).toISOString();
}

function toIsoStringFromMilliseconds(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dueWindowFlags(dueAt: string | null, now: Date) {
  if (!dueAt) {
    return { isOverdue: false, isDueToday: false, isDueThisWeek: false };
  }

  const dueDate = new Date(dueAt);
  if (Number.isNaN(dueDate.getTime())) {
    return { isOverdue: false, isDueToday: false, isDueThisWeek: false };
  }

  const today = startOfLocalDay(now);
  const dueDay = startOfLocalDay(dueDate);
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);
  return {
    isOverdue: diffDays < 0,
    isDueToday: diffDays === 0,
    isDueThisWeek: diffDays >= 0 && diffDays <= 7,
  };
}

function compactText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(compactText).filter(Boolean).join(" ");
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(compactText).filter(Boolean).join(" ");
  }
  return "";
}

function clickUpTaskSearchText(task: any) {
  return [
    task?.name,
    task?.text_content,
    task?.description,
    task?.markdown_description,
    task?.status?.status,
    task?.priority?.priority,
    ...(Array.isArray(task?.tags) ? task.tags.map((tag: any) => tag?.name) : []),
    ...(Array.isArray(task?.custom_fields)
      ? task.custom_fields.flatMap((field: any) => [field?.name, field?.type_config?.label, compactText(field?.value)])
      : []),
  ]
    .map(compactText)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function classifyClickUpWorkstream(task: any) {
  const text = [
    task?.list?.name,
    task?.folder?.name,
    task?.space?.name,
    task?.name,
  ].map(compactText).join(" ").toLowerCase();

  if (/\b(ppc|paid search|paid media|google ads)\b/.test(text)) return "PPC";
  if (/\b(gmb|local seo|seo|organic)\b/.test(text)) return "SEO / GMB";
  if (/\b(website|landing page|development|dev|frontend|backend|mission control|internal crm|clinic os|clinicgrower os|cg os)\b/.test(text)) {
    return "Website / Development / OS";
  }
  if (/\b(report|reporting|analytics|dashboard)\b/.test(text)) return "Reporting";
  if (/\b(managerial|management|account control|client management)\b/.test(text)) return "Managerial / Account Control";
  return "Uncategorised";
}

function mapClickUpOperationsTask(task: any, now: Date): ClickUpOperationsTaskRecord {
  const dueAt = toIsoStringFromMilliseconds(task?.due_date);
  const { isOverdue, isDueToday, isDueThisWeek } = dueWindowFlags(dueAt, now);
  const assignees = Array.isArray(task?.assignees)
    ? task.assignees.map((assignee: any) => ({
        id: String(assignee?.id || ""),
        username: String(assignee?.username || assignee?.email || assignee?.id || "Unknown"),
        email: assignee?.email ? String(assignee.email) : null,
      })).filter((assignee: any) => assignee.id || assignee.username)
    : [];
  const tags = Array.isArray(task?.tags)
    ? task.tags.map((tag: any) => String(tag?.name || "")).filter(Boolean)
    : [];
  const searchText = clickUpTaskSearchText(task);
  const priorityLabel = cleanString(task?.priority?.priority) || cleanString(task?.priority?.id);
  const priorityId = Number(task?.priority?.id || task?.priority?.orderindex || 0);
  const status = cleanString(task?.status?.status) || "Open";
  const statusType = cleanString(task?.status?.type);

  return {
    id: String(task?.id || ""),
    customId: cleanString(task?.custom_id),
    title: cleanString(task?.name) || "Untitled ClickUp task",
    url: cleanString(task?.url) || (task?.id ? `https://app.clickup.com/t/${encodeURIComponent(String(task.id))}` : null),
    status,
    statusType,
    priority: priorityLabel,
    dueAt,
    updatedAt: toIsoStringFromMilliseconds(task?.date_updated),
    listName: cleanString(task?.list?.name),
    folderName: cleanString(task?.folder?.name),
    spaceName: cleanString(task?.space?.name),
    workstream: classifyClickUpWorkstream(task),
    assignees,
    tags,
    isOverdue,
    isDueToday,
    isDueThisWeek,
    isHighPriority:
      /\b(urgent|high)\b/.test(String(priorityLabel || "").toLowerCase()) ||
      priorityId === 1 ||
      priorityId === 2,
    isBlocked: /\b(blocked|blocker|blocked by|waiting on|dependency)\b/.test(searchText),
    isAwaitingMaxDecision: /\b(awaiting max|max decision|max approval|max to decide|needs max)\b/.test(searchText),
    hasNoOwner: assignees.length === 0,
    hasNoDeadline: !dueAt,
  };
}

function openClickUpOperationsTasks(tasks: ClickUpOperationsTaskRecord[]) {
  return tasks.filter((task) => {
    const statusText = `${task.status} ${task.statusType || ""}`.toLowerCase();
    return !/\b(closed|complete|completed|done)\b/.test(statusText);
  });
}

function sortClickUpOperationsTasks(a: ClickUpOperationsTaskRecord, b: ClickUpOperationsTaskRecord) {
  const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (aDue !== bDue) return aDue - bDue;
  if (a.isHighPriority !== b.isHighPriority) return a.isHighPriority ? -1 : 1;
  return a.title.localeCompare(b.title);
}

function summarizeClickUpWorkload(tasks: ClickUpOperationsTaskRecord[]): ClickUpOperationsWorkloadRow[] {
  const rows = new Map<string, ClickUpOperationsWorkloadRow>();
  tasks.forEach((task) => {
    const assignees = task.assignees.length
      ? task.assignees
      : [{ id: "unassigned", username: "Unassigned", email: null }];
    assignees.forEach((assignee) => {
      const id = assignee.id || assignee.username.toLowerCase();
      const row = rows.get(id) || {
        id,
        assignee: assignee.username,
        totalOpen: 0,
        overdue: 0,
        dueToday: 0,
        dueThisWeek: 0,
        highPriority: 0,
        blocked: 0,
      };
      row.totalOpen += 1;
      if (task.isOverdue) row.overdue += 1;
      if (task.isDueToday) row.dueToday += 1;
      if (task.isDueThisWeek) row.dueThisWeek += 1;
      if (task.isHighPriority) row.highPriority += 1;
      if (task.isBlocked) row.blocked += 1;
      rows.set(id, row);
    });
  });

  return Array.from(rows.values())
    .sort((a, b) =>
      b.overdue - a.overdue ||
      b.blocked - a.blocked ||
      b.highPriority - a.highPriority ||
      b.totalOpen - a.totalOpen ||
      a.assignee.localeCompare(b.assignee),
    )
    .slice(0, 12);
}

function summarizeClickUpWorkstreams(tasks: ClickUpOperationsTaskRecord[]): ClickUpOperationsWorkstreamRow[] {
  const rows = new Map<string, ClickUpOperationsWorkstreamRow>();
  tasks.forEach((task) => {
    const id = task.workstream.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "uncategorised";
    const row = rows.get(id) || {
      id,
      label: task.workstream,
      totalOpen: 0,
      overdue: 0,
      dueThisWeek: 0,
      highPriority: 0,
      blocked: 0,
    };
    row.totalOpen += 1;
    if (task.isOverdue) row.overdue += 1;
    if (task.isDueThisWeek) row.dueThisWeek += 1;
    if (task.isHighPriority) row.highPriority += 1;
    if (task.isBlocked) row.blocked += 1;
    rows.set(id, row);
  });

  return Array.from(rows.values())
    .sort((a, b) =>
      b.overdue - a.overdue ||
      b.highPriority - a.highPriority ||
      b.totalOpen - a.totalOpen ||
      a.label.localeCompare(b.label),
    );
}

function encodeState(payload: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeState(rawState: string) {
  try {
    const parsed = JSON.parse(Buffer.from(rawState, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function nullableExternalKey(value: string | null | undefined) {
  return value ? value.trim() : "";
}

function mapConnection(row: any): ClickUpConnectionResponse {
  return {
    id: row.id,
    workspaceId: row.workspaceId || null,
    workspaceName: row.workspaceName || null,
    status: row.status,
    scopes: parseJsonArray(row.scopes),
    connectedBy: row.connectedBy || null,
    connectedAt: toIsoString(row.connectedAt),
    revokedAt: toIsoString(row.revokedAt),
    lastCheckedAt: toIsoString(row.lastCheckedAt),
    lastError: row.lastError || null,
    tokenStored: Boolean(row.encryptedAccessToken),
    refreshTokenStored: Boolean(row.encryptedRefreshToken),
    tokenExpiresAt: toIsoString(row.tokenExpiresAt),
    updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
  };
}

function mapClientMapping(row: any): ClickUpClientMappingResponse {
  return {
    id: row.id,
    clientAccountProfileId: row.clientAccountProfileId,
    clientClinicId: row.clientClinicId,
    clientName: row.clientName,
    connectionId: row.connectionId || null,
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName || null,
    spaceId: row.spaceId || null,
    folderId: row.folderId || null,
    listId: row.listId || null,
    deliveryRootTaskId: row.deliveryRootTaskId || null,
    deliveryUrl: row.deliveryUrl || null,
    mappingStatus: row.mappingStatus,
    mappingSource: row.mappingSource,
    deterministic: true,
    updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
  };
}

function mapTaskMapping(row: any): ClickUpTaskMappingResponse {
  return {
    id: row.id,
    clientAccountProfileId: row.clientAccountProfileId,
    internalTaskId: row.internalTaskId || null,
    connectionId: row.connectionId || null,
    workspaceId: row.workspaceId,
    clickupTaskId: row.clickupTaskId,
    clickupListId: row.clickupListId || null,
    clickupUrl: row.clickupUrl || null,
    syncDirection: row.syncDirection,
    mappingStatus: row.mappingStatus,
    updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
  };
}

function mapCategoryMapping(row: any): ClickUpCategoryMappingResponse {
  return {
    id: row.id,
    clientAccountProfileId: row.clientAccountProfileId,
    connectionId: row.connectionId || null,
    workspaceId: row.workspaceId,
    spaceId: row.spaceId,
    categoryKey: row.categoryKey,
    folderId: row.folderId || null,
    listId: row.listId,
    defaultAssigneeIds: parseJsonArray(row.defaultAssigneeIds),
    mappingStatus: row.mappingStatus,
    mappingSource: row.mappingSource,
    updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
  };
}

function mapPriorityMapping(row: any): ClickUpPriorityMappingResponse {
  return {
    id: row.id,
    missionControlPriority: row.missionControlPriority,
    clickupPriority: Number(row.clickupPriority) as 1 | 2 | 3 | 4,
    updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
  };
}

function mapSyncHealth(row: any): ClickUpSyncHealthRecord {
  return {
    id: row.id,
    clientAccountProfileId: row.clientAccountProfileId,
    clientClinicId: row.clientClinicId || null,
    clientName: row.clientName || "Mapped client",
    workspaceId: row.workspaceId,
    clickupListId: row.clickupListId || null,
    syncStatus: row.syncStatus,
    lastEventAt: toIsoString(row.lastEventAt),
    lastProcessedEventAt: toIsoString(row.lastProcessedEventAt),
    lastReconciledAt: toIsoString(row.lastReconciledAt),
    lastError: row.lastError || null,
    retryingCount: Number(row.retryingCount || 0),
    deadLetterCount: Number(row.deadLetterCount || 0),
    updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
  };
}

function mapWebhookEvent(row: any): ClickUpWebhookEventRecord {
  return {
    id: row.id,
    providerEventKey: row.providerEventKey,
    providerEventType: row.providerEventType,
    clickupTaskId: row.clickupTaskId || null,
    clientAccountProfileId: row.clientAccountProfileId || null,
    clientName: row.clientName || null,
    processingStatus: row.processingStatus,
    retryCount: Number(row.retryCount || 0),
    nextRetryAt: toIsoString(row.nextRetryAt),
    errorClass: row.errorClass || null,
    errorMessage: row.errorMessage || null,
    receivedAt: toIsoString(row.receivedAt) || new Date().toISOString(),
    processedAt: toIsoString(row.processedAt),
  };
}

function uniqueStrings(values: unknown[] | undefined) {
  return [...new Set((values || []).map(String).map((value) => value.trim()).filter(Boolean))];
}

function extractClickUpMembers(payload: any) {
  const candidates = [
    payload?.members,
    payload?.users,
    payload?.team?.members,
    payload?.team?.users,
    payload?.data?.members,
    payload?.data?.users,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function toMysqlDateTime(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function parseClickUpDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    const date = new Date(numeric);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function firstHistoryItem(payload: any) {
  return Array.isArray(payload?.history_items) && payload.history_items.length > 0 ? payload.history_items[0] : null;
}

function firstDefined(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function normalizeClickUpId(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return cleanString(record.id) || cleanString(record.task_id) || cleanString(record.list_id);
  }
  return cleanString(String(value));
}

function extractTaskId(payload: any) {
  return normalizeClickUpId(firstDefined(payload?.task_id, payload?.taskId, payload?.task?.id, firstHistoryItem(payload)?.task_id));
}

function extractListId(payload: any) {
  const history = firstHistoryItem(payload);
  return normalizeClickUpId(firstDefined(
    payload?.list_id,
    payload?.listId,
    payload?.list?.id,
    payload?.task?.list?.id,
    history?.list_id,
    history?.parent_id,
    history?.after?.list_id,
    history?.after?.list?.id,
    history?.after?.id,
  ));
}

function extractWebhookId(payload: any) {
  return cleanString(payload?.webhook_id) || cleanString(payload?.webhookId) || "unknown-webhook";
}

function payloadHash(rawBody: Buffer | string | null | undefined, payload: any) {
  const raw = rawBody
    ? Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), "utf8")
    : Buffer.from(JSON.stringify(payload || {}), "utf8");
  return createHash("sha256").update(raw).digest("hex");
}

function stablePayloadString(rawBody: Buffer | string | null | undefined, payload: any) {
  if (rawBody) return Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);
  return JSON.stringify(payload || {});
}

function safeTimingEqual(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function extractProviderEventKey(payload: any, hash: string) {
  const webhookId = extractWebhookId(payload);
  const history = firstHistoryItem(payload);
  const historyId = cleanString(history?.id);
  if (historyId) return `${webhookId}:${historyId}`;

  const event = cleanString(payload?.event) || "unknown";
  const taskId = extractTaskId(payload) || "unknown-task";
  const eventDate = cleanString(history?.date) || cleanString(payload?.date) || cleanString(payload?.date_updated) || hash.slice(0, 32);
  return `${webhookId}:${event}:${taskId}:${eventDate}`;
}

function extractEventOccurredAt(payload: any) {
  const history = firstHistoryItem(payload);
  return parseClickUpDate(firstDefined(history?.date, payload?.date, payload?.date_updated, payload?.task?.date_updated));
}

function statusValue(value: unknown) {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return cleanString(record.status) || cleanString(record.name) || cleanString(record.value) || cleanString(record.type);
  }
  return cleanString(String(value));
}

function statusTypeValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return cleanString((value as Record<string, unknown>).type);
}

function extractStatusAfter(payload: any) {
  const history = firstHistoryItem(payload);
  return statusValue(firstDefined(payload?.task?.status, history?.after?.status, history?.after));
}

function extractStatusTypeAfter(payload: any) {
  const history = firstHistoryItem(payload);
  return statusTypeValue(firstDefined(payload?.task?.status, history?.after?.status, history?.after));
}

function extractDueAfter(payload: any) {
  const history = firstHistoryItem(payload);
  return parseClickUpDate(firstDefined(payload?.task?.due_date, history?.after?.due_date, history?.after));
}

function extractPriorityAfter(payload: any) {
  const history = firstHistoryItem(payload);
  const value = firstDefined(payload?.task?.priority, history?.after?.priority, history?.after);
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return cleanString(record.priority) || cleanString(record.name) || cleanString(record.id);
  }
  return cleanString(String(value));
}

function extractAssigneeIdsFromValue(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return uniqueStrings(value.map((item) => normalizeClickUpId(item)));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return uniqueStrings([
      record.id,
      record.user_id,
      record.userid,
      ...(Array.isArray(record.assignees) ? record.assignees.map((item) => normalizeClickUpId(item)) : []),
    ]);
  }
  return uniqueStrings([value]);
}

function extractAssigneeIdsAfter(payload: any) {
  const history = firstHistoryItem(payload);
  return uniqueStrings([
    ...extractAssigneeIdsFromValue(payload?.task?.assignees),
    ...extractAssigneeIdsFromValue(history?.after?.assignees),
    ...extractAssigneeIdsFromValue(history?.after),
  ]);
}

function mapProviderPriority(value: string | null): "low" | "medium" | "high" | null {
  const text = String(value || "").toLowerCase();
  if (!text) return null;
  if (/\b(urgent|high|1|2)\b/.test(text)) return "high";
  if (/\b(low|4)\b/.test(text)) return "low";
  return "medium";
}

function isCompletedStatus(status: string | null, eventType: string) {
  if (eventType === "taskCompleted") return true;
  return /\b(closed|complete|completed|done)\b/i.test(status || "");
}

function sanitizeWebhookPayload(payload: any, hash: string) {
  const history = firstHistoryItem(payload);
  const eventType = cleanString(payload?.event) || "unknown";
  const statusAfter = extractStatusAfter(payload);
  const dueAfter = extractDueAfter(payload);
  const assigneeIds = extractAssigneeIdsAfter(payload);
  const priorityAfter = extractPriorityAfter(payload);
  const listId = extractListId(payload);

  return {
    schema: CLICKUP_WEBHOOK_EVENT_VERSION,
    event: eventType,
    webhookId: extractWebhookId(payload),
    historyItemId: cleanString(history?.id),
    historyType: history?.type === undefined ? null : String(history.type),
    taskId: extractTaskId(payload),
    listId,
    statusAfter,
    statusTypeAfter: extractStatusTypeAfter(payload),
    dueAfter: dueAfter ? dueAfter.toISOString() : null,
    priorityAfter,
    assigneeIds,
    payloadHash: hash,
  };
}

function parseSummary(value: unknown) {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function classifyClickUpProviderFailure(error: any) {
  const details = error?.details || {};
  const providerStatus = Number(details.providerStatus || error?.providerStatus || 0);
  const retryAfterMs = Number(details.retryAfterMs || error?.retryAfterMs || 0);
  if (providerStatus === 429) {
    return { errorClass: "rate_limited", retryable: true, retryAfterMs };
  }
  if (providerStatus >= 500 || error?.code === "ECONNRESET" || error?.name === "AbortError") {
    return { errorClass: "provider_transient", retryable: true, retryAfterMs: 0 };
  }
  if (providerStatus >= 400) {
    return { errorClass: "provider_permanent", retryable: false, retryAfterMs: 0 };
  }
  return { errorClass: "processing_error", retryable: false, retryAfterMs: 0 };
}

export class ClickUpService {
  async getStatus(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              workspace_id as workspaceId,
              workspace_name as workspaceName,
              status,
              scopes,
              connected_by as connectedBy,
              connected_at as connectedAt,
              revoked_at as revokedAt,
              last_checked_at as lastCheckedAt,
              last_error as lastError,
              encrypted_access_token as encryptedAccessToken,
              encrypted_refresh_token as encryptedRefreshToken,
              token_expires_at as tokenExpiresAt,
              updated_at as updatedAt
       FROM clickup_connection
       WHERE clinic_id = ?
       ORDER BY FIELD(status, 'connected', 'pending', 'error', 'revoked'), updated_at DESC
       LIMIT 10`,
      [clinicId],
    );

    const [mappingRows]: any = await pool.execute(
      `SELECT
          (SELECT COUNT(*) FROM clickup_client_mapping WHERE clinic_id = ? AND mapping_status = 'active') as clientMappingCount,
          (SELECT COUNT(*) FROM clickup_task_mapping WHERE clinic_id = ? AND mapping_status = 'active') as taskMappingCount`,
      [clinicId, clinicId],
    );

    return {
      oauthConfigured: Boolean(config.clickup.clientId && config.clickup.clientSecret),
      apiTokenConfigured: Boolean(config.clickup.apiToken && config.clickup.teamId),
      webhookConfigured: Boolean(config.clickup.webhookSecret),
      connections: rows.map(mapConnection),
      clientMappingCount: Number(mappingRows[0]?.clientMappingCount || 0),
      taskMappingCount: Number(mappingRows[0]?.taskMappingCount || 0),
    };
  }

  async connectConfiguredApiToken(clinicId: string, userId: string, auditContext: ClickUpAuditContext = {}) {
    if (!config.clickup.apiToken || !config.clickup.teamId) {
      throw ApiError.serviceUnavailable("ClickUp API token connection requires CLICKUP_API_TOKEN and CLICKUP_TEAM_ID.");
    }

    const workspaces = await this.fetchAuthorizedWorkspaces(config.clickup.apiToken, "personal_token");
    const selectedWorkspace = this.selectWorkspace(workspaces, config.clickup.teamId);
    const connectionId = uuidv4();

    await pool.execute(
      `INSERT INTO clickup_connection
        (id, clinic_id, workspace_id, workspace_name, status, encrypted_access_token,
         encrypted_refresh_token, token_expires_at, scopes, oauth_state_hash,
         connected_at, connected_by, revoked_by, revoked_at, last_checked_at, last_error)
       VALUES (?, ?, ?, ?, 'connected', ?, NULL, NULL, ?, NULL, CURRENT_TIMESTAMP, ?, NULL, NULL, CURRENT_TIMESTAMP, NULL)
       ON DUPLICATE KEY UPDATE
         workspace_name = VALUES(workspace_name),
         status = 'connected',
         encrypted_access_token = VALUES(encrypted_access_token),
         encrypted_refresh_token = NULL,
         token_expires_at = NULL,
         scopes = VALUES(scopes),
         oauth_state_hash = NULL,
         connected_at = CURRENT_TIMESTAMP,
         connected_by = VALUES(connected_by),
         revoked_by = NULL,
         revoked_at = NULL,
         last_checked_at = CURRENT_TIMESTAMP,
         last_error = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [
        connectionId,
        clinicId,
        selectedWorkspace.id,
        selectedWorkspace.name,
        encryptProviderCredential(config.clickup.apiToken),
        JSON.stringify(["personal_api_token"]),
        userId,
      ],
    );

    const [rows]: any = await pool.execute(
      `SELECT id
       FROM clickup_connection
       WHERE clinic_id = ?
         AND workspace_id = ?
         AND status = 'connected'
       ORDER BY updated_at DESC
       LIMIT 1`,
      [clinicId, selectedWorkspace.id],
    );
    const savedConnectionId = rows[0]?.id || connectionId;

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: "CLICKUP_API_TOKEN_CONNECTED",
      entityType: "clickup_connection",
      entityId: savedConnectionId,
      changes: {
        workspaceId: selectedWorkspace.id,
        workspaceName: selectedWorkspace.name,
        authMode: "personal_api_token",
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getConnectionById(savedConnectionId);
  }

  async startOAuth(clinicId: string, userId: string, auditContext: ClickUpAuditContext = {}): Promise<StartClickUpOAuthResponse> {
    if (!config.clickup.clientId || !config.clickup.clientSecret) {
      throw ApiError.serviceUnavailable("ClickUp OAuth requires CLICKUP_CLIENT_ID and CLICKUP_CLIENT_SECRET.");
    }

    const nonce = generateResetToken();
    const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MINUTES * 60 * 1000);
    const state = encodeState({
      clinicId,
      userId,
      nonce,
      exp: expiresAt.toISOString(),
    });
    const stateHash = hashToken(state);
    const connectionId = uuidv4();

    await pool.execute(
      `INSERT INTO clickup_connection
        (id, clinic_id, status, oauth_state_hash, oauth_started_at, connected_by)
       VALUES (?, ?, 'pending', ?, CURRENT_TIMESTAMP, ?)`,
      [connectionId, clinicId, stateHash, userId],
    );

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: "CLICKUP_OAUTH_STARTED",
      entityType: "clickup_connection",
      entityId: connectionId,
      changes: { stateExpiresAt: expiresAt.toISOString() },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    const redirectUri = this.oauthRedirectUri();
    const url = new URL(config.clickup.appAuthUrl);
    url.searchParams.set("client_id", config.clickup.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);

    return {
      authorizeUrl: url.toString(),
      stateExpiresAt: expiresAt.toISOString(),
    };
  }

  async completeOAuth(data: CompleteClickUpOAuthDTO, auditContext: ClickUpAuditContext = {}) {
    if (!config.clickup.clientId || !config.clickup.clientSecret) {
      throw ApiError.serviceUnavailable("ClickUp OAuth requires CLICKUP_CLIENT_ID and CLICKUP_CLIENT_SECRET.");
    }

    const statePayload = decodeState(data.state);
    const clinicId = cleanString(statePayload?.clinicId);
    const userId = cleanString(statePayload?.userId);
    const expiresAt = cleanString(statePayload?.exp);
    if (!clinicId || !userId || !expiresAt || Date.parse(expiresAt) < Date.now()) {
      throw ApiError.badRequest("ClickUp OAuth state is invalid or expired.");
    }

    const stateHash = hashToken(data.state);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [pendingRows]: any = await connection.execute(
        `SELECT id
         FROM clickup_connection
         WHERE clinic_id = ?
           AND oauth_state_hash = ?
           AND status = 'pending'
         ORDER BY oauth_started_at DESC
         LIMIT 1
         FOR UPDATE`,
        [clinicId, stateHash],
      );
      const pending = pendingRows[0];
      if (!pending) {
        throw ApiError.badRequest("ClickUp OAuth state could not be matched.");
      }

      const token = await this.exchangeCodeForToken(data.code);
      const workspaces = await this.fetchAuthorizedWorkspaces(token.accessToken, "oauth");
      const selectedWorkspace = this.selectWorkspace(workspaces, data.workspaceId || null);

      await connection.execute(
        `UPDATE clickup_connection
         SET workspace_id = ?,
             workspace_name = ?,
             status = 'connected',
             encrypted_access_token = ?,
             encrypted_refresh_token = ?,
             token_expires_at = ?,
             scopes = ?,
             oauth_state_hash = NULL,
             connected_at = CURRENT_TIMESTAMP,
             connected_by = ?,
             revoked_by = NULL,
             revoked_at = NULL,
             last_checked_at = CURRENT_TIMESTAMP,
             last_error = NULL
         WHERE id = ?`,
        [
          selectedWorkspace.id,
          selectedWorkspace.name,
          encryptProviderCredential(token.accessToken),
          token.refreshToken ? encryptProviderCredential(token.refreshToken) : null,
          token.expiresAt,
          JSON.stringify(token.scopes),
          userId,
          pending.id,
        ],
      );

      await insertAuditEvent(connection, {
        clinicId,
        userId,
        action: "CLICKUP_CONNECTED",
        entityType: "clickup_connection",
        entityId: pending.id,
        changes: {
          workspaceId: selectedWorkspace.id,
          workspaceName: selectedWorkspace.name,
          scopes: token.scopes,
        },
        ipAddress: auditContext.ipAddress || null,
        userAgent: auditContext.userAgent || null,
      });

      await connection.commit();
      return this.getConnectionById(pending.id);
    } catch (error) {
      await connection.rollback();
      if (error instanceof ApiError) throw error;
      throw ApiError.serviceUnavailable(error instanceof Error ? error.message : "ClickUp OAuth failed.");
    } finally {
      connection.release();
    }
  }

  async revoke(clinicId: string, userId: string, auditContext: ClickUpAuditContext = {}) {
    const [rows]: any = await pool.execute(
      `SELECT id, workspace_id as workspaceId, workspace_name as workspaceName
       FROM clickup_connection
       WHERE clinic_id = ?
         AND status IN ('pending', 'connected', 'error')
       ORDER BY updated_at DESC
       LIMIT 1`,
      [clinicId],
    );
    const connection = rows[0];
    if (!connection) throw ApiError.notFound("ClickUp connection not found.");

    await pool.execute(
      `UPDATE clickup_connection
       SET status = 'revoked',
           encrypted_access_token = NULL,
           encrypted_refresh_token = NULL,
           token_expires_at = NULL,
           oauth_state_hash = NULL,
           revoked_by = ?,
           revoked_at = CURRENT_TIMESTAMP,
           last_error = NULL
       WHERE id = ?
         AND clinic_id = ?`,
      [userId, connection.id, clinicId],
    );

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: "CLICKUP_REVOKED",
      entityType: "clickup_connection",
      entityId: connection.id,
      changes: {
        workspaceId: connection.workspaceId,
        workspaceName: connection.workspaceName,
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getConnectionById(connection.id);
  }

  async getClientMapping(
    clinicId: string,
    clientAccountProfileId: string,
    access: ClickUpAccessContext,
  ) {
    await this.ensureClientAccountProfileAvailable(clinicId, clientAccountProfileId, access);
    const [rows]: any = await pool.execute(
      this.clientMappingSelectSql("m.client_account_profile_id = ?"),
      [clinicId, clientAccountProfileId],
    );
    return rows[0] ? mapClientMapping(rows[0]) : null;
  }

  async saveClientMapping(
    clinicId: string,
    userId: string,
    clientAccountProfileId: string,
    data: SaveClickUpClientMappingDTO,
    access: ClickUpAccessContext,
    auditContext: ClickUpAuditContext = {},
  ) {
    this.ensureDeterministicClientStructure(data);
    const clientAccount = await this.ensureClientAccountProfileAvailable(clinicId, clientAccountProfileId, access);
    await this.ensureConnectionAvailable(clinicId, data.connectionId || null, data.workspaceId);
    await this.ensureExternalClientStructureUnused(clinicId, clientAccountProfileId, data);

    const existing = await this.getClientMapping(clinicId, clientAccountProfileId, access);
    const mappingId = existing?.id || uuidv4();
    const mappingStatus = data.mappingStatus || "active";
    const mappingSource = data.mappingSource || "manual";

    await pool.execute(
      `INSERT INTO clickup_client_mapping
        (id, clinic_id, client_account_profile_id, connection_id, workspace_id, space_id, folder_id, list_id,
         delivery_root_task_id, delivery_url, mapping_status, mapping_source, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         connection_id = VALUES(connection_id),
         workspace_id = VALUES(workspace_id),
         space_id = VALUES(space_id),
         folder_id = VALUES(folder_id),
         list_id = VALUES(list_id),
         delivery_root_task_id = VALUES(delivery_root_task_id),
         delivery_url = VALUES(delivery_url),
         mapping_status = VALUES(mapping_status),
         mapping_source = VALUES(mapping_source),
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      [
        mappingId,
        clinicId,
        clientAccountProfileId,
        data.connectionId || null,
        data.workspaceId,
        data.spaceId || null,
        data.folderId || null,
        data.listId || null,
        data.deliveryRootTaskId || null,
        data.deliveryUrl || null,
        mappingStatus,
        mappingSource,
        userId,
        userId,
      ],
    );

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: existing ? "CLICKUP_CLIENT_MAPPING_UPDATED" : "CLICKUP_CLIENT_MAPPING_CREATED",
      entityType: "clickup_client_mapping",
      entityId: mappingId,
      changes: {
        clientAccountProfileId,
        clientClinicId: clientAccount.clientClinicId,
        workspaceId: data.workspaceId,
        spaceId: data.spaceId || null,
        folderId: data.folderId || null,
        listId: data.listId || null,
        deliveryRootTaskId: data.deliveryRootTaskId || null,
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getClientMapping(clinicId, clientAccountProfileId, access);
  }

  async deleteClientMapping(
    clinicId: string,
    userId: string,
    clientAccountProfileId: string,
    access: ClickUpAccessContext,
    auditContext: ClickUpAuditContext = {},
  ) {
    await this.ensureClientAccountProfileAvailable(clinicId, clientAccountProfileId, access);
    const existing = await this.getClientMapping(clinicId, clientAccountProfileId, access);
    if (!existing) throw ApiError.notFound("ClickUp client mapping not found.");

    await pool.execute(
      `DELETE FROM clickup_client_mapping
       WHERE clinic_id = ?
         AND client_account_profile_id = ?`,
      [clinicId, clientAccountProfileId],
    );

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: "CLICKUP_CLIENT_MAPPING_REMOVED",
      entityType: "clickup_client_mapping",
      entityId: existing.id,
      changes: { clientAccountProfileId, workspaceId: existing.workspaceId },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return { removed: true };
  }

  async saveTaskMapping(
    clinicId: string,
    userId: string,
    data: SaveClickUpTaskMappingDTO,
    access: ClickUpAccessContext,
    auditContext: ClickUpAuditContext = {},
  ) {
    await this.ensureClientAccountProfileAvailable(clinicId, data.clientAccountProfileId, access);
    await this.ensureConnectionAvailable(clinicId, data.connectionId || null, data.workspaceId);
    if (data.internalTaskId) {
      await this.ensureTaskBelongsToClient(clinicId, data.clientAccountProfileId, data.internalTaskId);
    }
    await this.ensureClickUpTaskUnused(clinicId, data.clientAccountProfileId, data.workspaceId, data.clickupTaskId);

    const [existingRows]: any = await pool.execute(
      `SELECT id
       FROM clickup_task_mapping
       WHERE clinic_id = ?
         AND workspace_id = ?
         AND clickup_task_id = ?
       LIMIT 1`,
      [clinicId, data.workspaceId, data.clickupTaskId],
    );
    const mappingId = existingRows[0]?.id || uuidv4();

    await pool.execute(
      `INSERT INTO clickup_task_mapping
        (id, clinic_id, client_account_profile_id, internal_task_id, connection_id, workspace_id,
         clickup_task_id, clickup_list_id, clickup_url, sync_direction, mapping_status, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         client_account_profile_id = VALUES(client_account_profile_id),
         internal_task_id = VALUES(internal_task_id),
         connection_id = VALUES(connection_id),
         clickup_list_id = VALUES(clickup_list_id),
         clickup_url = VALUES(clickup_url),
         sync_direction = VALUES(sync_direction),
         mapping_status = VALUES(mapping_status),
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      [
        mappingId,
        clinicId,
        data.clientAccountProfileId,
        data.internalTaskId || null,
        data.connectionId || null,
        data.workspaceId,
        data.clickupTaskId,
        data.clickupListId || null,
        data.clickupUrl || null,
        data.syncDirection || "manual",
        data.mappingStatus || "active",
        userId,
        userId,
      ],
    );

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: "CLICKUP_TASK_MAPPING_SAVED",
      entityType: "clickup_task_mapping",
      entityId: mappingId,
      changes: {
        clientAccountProfileId: data.clientAccountProfileId,
        internalTaskId: data.internalTaskId || null,
        workspaceId: data.workspaceId,
        clickupTaskId: data.clickupTaskId,
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getTaskMappingById(mappingId);
  }

  async listTaskMappings(
    clinicId: string,
    clientAccountProfileId: string,
    access: ClickUpAccessContext,
  ) {
    await this.ensureClientAccountProfileAvailable(clinicId, clientAccountProfileId, access);
    const [rows]: any = await pool.execute(
      `SELECT id,
              client_account_profile_id as clientAccountProfileId,
              internal_task_id as internalTaskId,
              connection_id as connectionId,
              workspace_id as workspaceId,
              clickup_task_id as clickupTaskId,
              clickup_list_id as clickupListId,
              clickup_url as clickupUrl,
              sync_direction as syncDirection,
              mapping_status as mappingStatus,
              updated_at as updatedAt
       FROM clickup_task_mapping
       WHERE clinic_id = ?
         AND client_account_profile_id = ?
       ORDER BY updated_at DESC
       LIMIT 200`,
      [clinicId, clientAccountProfileId],
    );
    return rows.map(mapTaskMapping);
  }

  async listRemoteWorkspaces(clinicId: string) {
    const connection = await this.getActiveConnection(clinicId);
    return this.fetchAuthorizedWorkspaces(connection.accessToken, connection.authMode);
  }

  async listRemoteSpaces(clinicId: string, workspaceId?: string | null) {
    const connection = await this.getActiveConnection(clinicId, workspaceId || null);
    const payload = await this.clickUpRequest(connection, `/team/${encodeURIComponent(connection.workspaceId)}/space?archived=false`);
    return Array.isArray(payload.spaces)
      ? payload.spaces.map((space: any) => ({ id: String(space.id), name: String(space.name || space.id) }))
      : [];
  }

  async listRemoteFolders(clinicId: string, spaceId: string, workspaceId?: string | null) {
    const connection = await this.getActiveConnection(clinicId, workspaceId || null);
    const payload = await this.clickUpRequest(connection, `/space/${encodeURIComponent(spaceId)}/folder?archived=false`);
    return Array.isArray(payload.folders)
      ? payload.folders.map((folder: any) => ({ id: String(folder.id), name: String(folder.name || folder.id), hidden: Boolean(folder.hidden) }))
      : [];
  }

  async listRemoteLists(clinicId: string, data: { spaceId?: string | null; folderId?: string | null; workspaceId?: string | null }) {
    const connection = await this.getActiveConnection(clinicId, data.workspaceId || null);
    const path = data.folderId
      ? `/folder/${encodeURIComponent(data.folderId)}/list?archived=false`
      : `/space/${encodeURIComponent(String(data.spaceId || ""))}/list?archived=false`;
    if (!data.folderId && !data.spaceId) throw ApiError.badRequest("A ClickUp folder or space is required to load lists.");
    const payload = await this.clickUpRequest(connection, path);
    return Array.isArray(payload.lists)
      ? payload.lists.map((list: any) => ({
          id: String(list.id),
          name: String(list.name || list.id),
          folderId: list.folder?.id ? String(list.folder.id) : data.folderId || null,
          spaceId: list.space?.id ? String(list.space.id) : data.spaceId || null,
        }))
      : [];
  }

  async listRemoteMembers(clinicId: string, workspaceId?: string | null) {
    const connection = await this.getActiveConnection(clinicId, workspaceId || null);
    let payload: any = null;
    try {
      payload = await this.clickUpRequest(connection, `/team/${encodeURIComponent(connection.workspaceId)}/user`);
    } catch (err: any) {
      // Try workspace list fallback (includes members when requested)
      try {
        const workspaces = await this.fetchAuthorizedWorkspaces(connection.accessToken, connection.authMode, true);
        const workspace = workspaces.find((item: any) => item.id === connection.workspaceId);
        if (workspace) payload = { members: workspace.members || [] };
      } catch (err2: any) {
        // As a last resort try reading the team object directly and extracting members
        try {
          const teamPayload = await this.clickUpRequest(connection, `/team/${encodeURIComponent(connection.workspaceId)}`);
          if (teamPayload) payload = { members: extractClickUpMembers(teamPayload) };
        } catch (err3: any) {
          payload = null;
          // record last error on the connection for observability, but do not throw to callers
          try {
            await pool.execute(
              `UPDATE clickup_connection SET last_error = ?, last_checked_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [String(err3?.message || err2?.message || err?.message || "ClickUp member lookup failed"), connection.id],
            );
          } catch {
            // ignore DB write failures
          }
        }
      }
    }

    return extractClickUpMembers(payload).map((record: any) => {
      const member = record?.user || record || {};
      return {
        id: String(member.id || ""),
        username: String(member.username || member.email || member.id || ""),
        email: member.email ? String(member.email) : null,
      };
    });
  }

  async getOperationsDashboard(clinicId: string): Promise<ClickUpOperationsDashboardResponse> {
    const connection = await this.getActiveConnection(clinicId);
    const tasks: any[] = [];
    let pagesFetched = 0;

    for (let page = 0; page < OPERATIONS_DASHBOARD_PAGE_LIMIT; page += 1) {
      const query = new URLSearchParams({
        include_closed: "false",
        subtasks: "true",
        order_by: "due_date",
        reverse: "false",
        page: String(page),
      });
      const payload = await this.clickUpRequest(
        connection,
        `/team/${encodeURIComponent(connection.workspaceId)}/task?${query.toString()}`,
      );
      const pageTasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
      pagesFetched += 1;
      tasks.push(...pageTasks);
      if (pageTasks.length < OPERATIONS_DASHBOARD_TASKS_PER_PAGE) break;
    }

    const now = new Date();
    const mappedTasks = openClickUpOperationsTasks(
      tasks
        .map((task) => mapClickUpOperationsTask(task, now))
        .filter((task) => Boolean(task.id)),
    ).sort(sortClickUpOperationsTasks);

    const queue = (predicate: (task: ClickUpOperationsTaskRecord) => boolean) =>
      mappedTasks.filter(predicate).slice(0, OPERATIONS_DASHBOARD_QUEUE_LIMIT);

    return {
      generatedAt: now.toISOString(),
      workspaceName: connection.workspaceName,
      source: {
        provider: "clickup",
        live: true,
        includeClosed: false,
        taskLimit: OPERATIONS_DASHBOARD_PAGE_LIMIT * OPERATIONS_DASHBOARD_TASKS_PER_PAGE,
        pagesFetched,
      },
      counts: {
        totalOpen: mappedTasks.length,
        overdue: mappedTasks.filter((task) => task.isOverdue).length,
        dueToday: mappedTasks.filter((task) => task.isDueToday).length,
        dueThisWeek: mappedTasks.filter((task) => task.isDueThisWeek).length,
        highPriority: mappedTasks.filter((task) => task.isHighPriority).length,
        blocked: mappedTasks.filter((task) => task.isBlocked).length,
        awaitingMaxDecision: mappedTasks.filter((task) => task.isAwaitingMaxDecision).length,
        noOwner: mappedTasks.filter((task) => task.hasNoOwner).length,
        noDeadline: mappedTasks.filter((task) => task.hasNoDeadline).length,
      },
      queues: {
        overdue: queue((task) => task.isOverdue),
        dueToday: queue((task) => task.isDueToday),
        dueThisWeek: queue((task) => task.isDueThisWeek),
        highPriority: queue((task) => task.isHighPriority),
        blocked: queue((task) => task.isBlocked),
        awaitingMaxDecision: queue((task) => task.isAwaitingMaxDecision),
        noOwner: queue((task) => task.hasNoOwner),
        noDeadline: queue((task) => task.hasNoDeadline),
      },
      workloadByAssignee: summarizeClickUpWorkload(mappedTasks),
      workstreamCounts: summarizeClickUpWorkstreams(mappedTasks),
    };
  }

  async listCategoryMappings(
    clinicId: string,
    clientAccountProfileId: string,
    access: ClickUpAccessContext,
  ): Promise<ClickUpCategoryMappingResponse[]> {
    await this.ensureClientAccountProfileAvailable(clinicId, clientAccountProfileId, access);
    const [rows]: any = await pool.execute(
      `SELECT id,
              client_account_profile_id as clientAccountProfileId,
              connection_id as connectionId,
              workspace_id as workspaceId,
              space_id as spaceId,
              category_key as categoryKey,
              folder_id as folderId,
              list_id as listId,
              default_assignee_ids as defaultAssigneeIds,
              mapping_status as mappingStatus,
              mapping_source as mappingSource,
              updated_at as updatedAt
       FROM clickup_category_mapping
       WHERE clinic_id = ?
         AND client_account_profile_id = ?
       ORDER BY FIELD(category_key, 'development', 'seo', 'gmb_local_seo', 'ppc', 'managerial', 'reporting', 'account_control')`,
      [clinicId, clientAccountProfileId],
    );
    return rows.map(mapCategoryMapping);
  }

  async saveCategoryMapping(
    clinicId: string,
    userId: string,
    clientAccountProfileId: string,
    data: SaveClickUpCategoryMappingDTO,
    access: ClickUpAccessContext,
    auditContext: ClickUpAuditContext = {},
  ) {
    if (!CATEGORY_KEYS.includes(data.categoryKey)) throw ApiError.badRequest("Work category is not supported.");
    await this.ensureClientAccountProfileAvailable(clinicId, clientAccountProfileId, access);
    await this.ensureConnectionAvailable(clinicId, data.connectionId || null, data.workspaceId);
    const existing = (await this.listCategoryMappings(clinicId, clientAccountProfileId, access))
      .find((mapping) => mapping.categoryKey === data.categoryKey);
    const mappingId = existing?.id || uuidv4();

    await pool.execute(
      `INSERT INTO clickup_category_mapping
        (id, clinic_id, client_account_profile_id, connection_id, workspace_id, space_id,
         category_key, folder_id, list_id, default_assignee_ids, mapping_status, mapping_source, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         connection_id = VALUES(connection_id),
         workspace_id = VALUES(workspace_id),
         space_id = VALUES(space_id),
         folder_id = VALUES(folder_id),
         list_id = VALUES(list_id),
         default_assignee_ids = VALUES(default_assignee_ids),
         mapping_status = VALUES(mapping_status),
         mapping_source = VALUES(mapping_source),
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      [
        mappingId,
        clinicId,
        clientAccountProfileId,
        data.connectionId || null,
        data.workspaceId,
        data.spaceId,
        data.categoryKey,
        data.folderId || null,
        data.listId,
        JSON.stringify(uniqueStrings(data.defaultAssigneeIds)),
        data.mappingStatus || "active",
        data.mappingSource || "manual",
        userId,
        userId,
      ],
    );

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: existing ? "CLICKUP_CATEGORY_MAPPING_UPDATED" : "CLICKUP_CATEGORY_MAPPING_CREATED",
      entityType: "clickup_category_mapping",
      entityId: mappingId,
      changes: {
        clientAccountProfileId,
        categoryKey: data.categoryKey,
        workspaceId: data.workspaceId,
        spaceId: data.spaceId,
        folderId: data.folderId || null,
        listId: data.listId,
        assigneeCount: uniqueStrings(data.defaultAssigneeIds).length,
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return (await this.listCategoryMappings(clinicId, clientAccountProfileId, access))
      .find((mapping) => mapping.categoryKey === data.categoryKey)!;
  }

  async listPriorityMappings(clinicId: string): Promise<ClickUpPriorityMappingResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT id,
              mission_control_priority as missionControlPriority,
              clickup_priority as clickupPriority,
              updated_at as updatedAt
       FROM clickup_priority_mapping
       WHERE clinic_id = ?
       ORDER BY FIELD(mission_control_priority, 'low', 'medium', 'high', 'urgent')`,
      [clinicId],
    );
    return rows.map(mapPriorityMapping);
  }

  async savePriorityMapping(
    clinicId: string,
    userId: string,
    data: SaveClickUpPriorityMappingDTO,
    auditContext: ClickUpAuditContext = {},
  ) {
    const mappingId = uuidv4();
    await pool.execute(
      `INSERT INTO clickup_priority_mapping
        (id, clinic_id, mission_control_priority, clickup_priority, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         clickup_priority = VALUES(clickup_priority),
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      [mappingId, clinicId, data.missionControlPriority, data.clickupPriority, userId, userId],
    );

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: "CLICKUP_PRIORITY_MAPPING_SAVED",
      entityType: "clickup_priority_mapping",
      entityId: data.missionControlPriority,
      changes: { missionControlPriority: data.missionControlPriority, clickupPriority: data.clickupPriority },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return (await this.listPriorityMappings(clinicId))
      .find((mapping) => mapping.missionControlPriority === data.missionControlPriority)!;
  }

  async createClickUpTask(
    clinicId: string,
    userId: string,
    data: CreateClickUpTaskDTO,
    files: Express.Multer.File[] = [],
    access: ClickUpAccessContext,
    auditContext: ClickUpAuditContext = {},
  ) {
    const task = await this.getInternalTaskForClickUp(clinicId, data.internalTaskId);
    if (!task.clientAccountProfileId) {
      throw ApiError.badRequest("This task must be linked to a client account before it can be sent to ClickUp.");
    }
    await this.ensureClientAccountProfileAvailable(clinicId, task.clientAccountProfileId, access);

    const existing = await this.getTaskMappingByInternalTask(clinicId, data.internalTaskId);
    if (existing?.mappingStatus === "active") {
      throw ApiError.conflict("This Mission Control task already has a ClickUp task link.");
    }
    if (existing?.mappingStatus === "needs_review") {
      throw ApiError.conflict("This Mission Control task already has a pending ClickUp creation that needs review before it can be retried.");
    }

    const categoryMapping = await this.getActiveCategoryMapping(clinicId, task.clientAccountProfileId, data.categoryKey);
    const connection = await this.getActiveConnection(clinicId, categoryMapping.workspaceId);
    const priorityMapping = await this.getClickUpPriority(clinicId, data.priority);
    const assigneeIds = uniqueStrings(data.assigneeIds?.length ? data.assigneeIds : categoryMapping.defaultAssigneeIds);
    if (assigneeIds.length === 0) {
      throw ApiError.badRequest("This ClickUp category does not have assignees configured. Add assignees in settings before creating the task.");
    }

    const pendingMappingId = uuidv4();
    const pendingClickupTaskId = this.pendingClickUpTaskId(data.internalTaskId);
    const mapping = await this.saveTaskMapping(
      clinicId,
      userId,
      {
        clientAccountProfileId: task.clientAccountProfileId,
        internalTaskId: data.internalTaskId,
        connectionId: connection.id,
        workspaceId: categoryMapping.workspaceId,
        clickupTaskId: pendingClickupTaskId,
        clickupListId: categoryMapping.listId,
        clickupUrl: null,
        syncDirection: "mission_control_to_clickup",
        mappingStatus: "needs_review",
      },
      access,
      auditContext,
    );

    const description = this.composeClickUpDescription(data.description || task.description || "", data.links || [], data.internalTaskId);
    const dueDate = data.dueDate || task.dueDate || null;
    const payload: Record<string, unknown> = {
      name: data.title.trim(),
      description,
      priority: priorityMapping,
      assignees: assigneeIds.map((id) => Number.isFinite(Number(id)) ? Number(id) : id),
    };
    if (dueDate) payload.due_date = new Date(`${dueDate}T12:00:00.000Z`).getTime();

    const createdTask = await this.clickUpRequest(
      connection,
      `/list/${encodeURIComponent(categoryMapping.listId)}/task`,
      { method: "POST", body: JSON.stringify(payload) },
    );
    const clickupTaskId = String(createdTask.id || "");
    if (!clickupTaskId) throw ApiError.serviceUnavailable("ClickUp did not return a task ID.");
    const clickupUrl = cleanString(createdTask.url) || `https://app.clickup.com/t/${clickupTaskId}`;

    await this.recoverTaskMappingAfterCreation(clinicId, data.internalTaskId, clickupTaskId, clickupUrl);

    const attachmentErrors: string[] = [];
    for (const file of files.slice(0, 5)) {
      try {
        await this.uploadClickUpAttachment(connection, clickupTaskId, file);
      } catch (err) {
        attachmentErrors.push(file.originalname);
      }
    }

    const updatedMapping = await this.saveTaskMapping(
      clinicId,
      userId,
      {
        clientAccountProfileId: task.clientAccountProfileId,
        internalTaskId: data.internalTaskId,
        connectionId: connection.id,
        workspaceId: categoryMapping.workspaceId,
        clickupTaskId,
        clickupListId: categoryMapping.listId,
        clickupUrl,
        syncDirection: "mission_control_to_clickup",
        mappingStatus: "active",
      },
      access,
      auditContext,
    );

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: "CLICKUP_TASK_CREATED",
      entityType: "task",
      entityId: data.internalTaskId,
      changes: {
        clickupTaskId,
        clickupUrl,
        categoryKey: data.categoryKey,
        listId: categoryMapping.listId,
        attachmentCount: files.length,
        attachmentErrors,
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return { mapping: updatedMapping, attachmentErrors };
  }

  async receiveWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
    rawBody?: Buffer | string | null,
  ): Promise<ClickUpWebhookReceipt> {
    if (!config.clickup.webhookSecret) {
      throw ApiError.serviceUnavailable("ClickUp webhook secret is not configured.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw ApiError.badRequest("ClickUp webhook payload must be a JSON object.");
    }

    const payload = body as Record<string, unknown>;
    const signature = this.headerValue(headers, "x-signature");
    this.verifyWebhookSignature(signature, stablePayloadString(rawBody, payload));

    const hash = payloadHash(rawBody, payload);
    const summary = sanitizeWebhookPayload(payload, hash);
    const providerEventType = cleanString(payload.event) || "unknown";
    const providerEventKey = extractProviderEventKey(payload, hash);
    const eventOccurredAt = extractEventOccurredAt(payload);
    const resolved = await this.resolveWebhookMapping(summary);
    const timestampStatus = this.validateWebhookTimestamp(eventOccurredAt);
    const unsupported = !CLICKUP_LIFECYCLE_EVENTS.has(providerEventType);
    const processingStatus: ClickUpWebhookProcessingStatus = unsupported
      ? "ignored"
      : timestampStatus || resolved.initialStatus || "queued";
    const eventId = uuidv4();
    const eventValues: any[] = [
      eventId,
      resolved.clinicId,
      resolved.connectionId,
      resolved.clientAccountProfileId,
      resolved.taskMappingId,
      resolved.workspaceId,
      String(summary.webhookId || "unknown-webhook"),
      providerEventKey,
      providerEventType,
      CLICKUP_WEBHOOK_EVENT_VERSION,
      summary.taskId || null,
      summary.listId || null,
      toMysqlDateTime(eventOccurredAt),
      toMysqlDateTime(eventOccurredAt),
      hash,
      JSON.stringify(summary),
      processingStatus,
      unsupported ? "unsupported_event" : resolved.errorClass || null,
      unsupported ? "ClickUp event type is not part of the approved lifecycle sync." : resolved.errorMessage || null,
      ["ignored", "quarantined", "stale"].includes(processingStatus) ? new Date() : null,
    ];

    try {
      await pool.execute(
        `INSERT INTO clickup_webhook_event
          (id, clinic_id, connection_id, client_account_profile_id, task_mapping_id,
           workspace_id, webhook_id, provider_event_key, provider_event_type,
           provider_event_version, clickup_task_id, clickup_list_id, event_occurred_at,
           provider_updated_at, payload_hash, payload_summary, processing_status,
           error_class, error_message, processed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        eventValues,
      );
    } catch (error: any) {
      if (error?.code === "ER_DUP_ENTRY") {
        const existing = await this.getWebhookEventByKey(providerEventKey);
        return {
          accepted: true,
          duplicate: true,
          eventId: existing.id,
          processingStatus: existing.processingStatus,
        };
      }
      throw error;
    }

    if (processingStatus === "queued") {
      await this.processQueuedWebhookEvents({ eventId, limit: 1 });
    } else if (resolved.clinicId && resolved.clientAccountProfileId) {
      await this.upsertSyncCheckpoint({
        clinicId: resolved.clinicId,
        connectionId: resolved.connectionId,
        clientAccountProfileId: resolved.clientAccountProfileId,
        workspaceId: resolved.workspaceId || "",
        clickupListId: resolved.clickupListId || summary.listId || "",
        syncStatus: processingStatus === "ignored" ? "healthy" : "reconciliation_needed",
        lastEventAt: eventOccurredAt,
        lastError: resolved.errorMessage || (unsupported ? "Unsupported ClickUp event ignored." : null),
      });
    }

    const saved = await this.getWebhookEventById(eventId);
    return {
      accepted: true,
      duplicate: false,
      eventId,
      processingStatus: saved.processingStatus,
    };
  }

  async processQueuedWebhookEvents(options: { eventId?: string; limit?: number } = {}) {
    const values: any[] = [];
    let where = "processing_status IN ('queued','retrying') AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP)";
    if (options.eventId) {
      where = "id = ? AND processing_status IN ('queued','retrying')";
      values.push(options.eventId);
    }
    const queryLimit = Math.max(1, Math.min(options.limit || 25, 100));

    const [rows]: any = await pool.execute(
      `SELECT id
       FROM clickup_webhook_event
       WHERE ${where}
       ORDER BY COALESCE(event_occurred_at, received_at) ASC
       LIMIT ${queryLimit}`,
      values,
    );

    let processed = 0;
    let retried = 0;
    let deadLetter = 0;
    let quarantined = 0;

    for (const row of rows) {
      try {
        const result = await this.processWebhookEvent(String(row.id));
        if (result === "processed" || result === "stale" || result === "ignored") processed += 1;
        if (result === "retrying") retried += 1;
        if (result === "dead_letter") deadLetter += 1;
        if (result === "quarantined") quarantined += 1;
      } catch {
        deadLetter += 1;
      }
    }

    return { attempted: rows.length, processed, retried, deadLetter, quarantined };
  }

  async runIncrementalReconciliation(limit = CLICKUP_RECONCILIATION_LIMIT, clinicId?: string | null) {
    const clinicClause = clinicId ? "AND m.clinic_id = ?" : "";
    const values: any[] = clinicId ? [clinicId] : [];
    const queryLimit = Math.max(1, Math.min(limit, 100));
    const [rows]: any = await pool.execute(
      `SELECT m.id as mappingId,
              m.clinic_id as clinicId,
              m.client_account_profile_id as clientAccountProfileId,
              m.connection_id as connectionId,
              m.workspace_id as workspaceId,
              m.clickup_task_id as clickupTaskId,
              m.clickup_list_id as clickupListId,
              m.internal_task_id as internalTaskId
       FROM clickup_task_mapping m
       LEFT JOIN clickup_sync_checkpoint cp
         ON cp.clinic_id = m.clinic_id
        AND cp.client_account_profile_id = m.client_account_profile_id
        AND cp.workspace_id = m.workspace_id
        AND cp.clickup_list_id <=> m.clickup_list_id
       WHERE m.mapping_status = 'active'
         AND m.internal_task_id IS NOT NULL
         ${clinicClause}
         AND (cp.last_reconciled_at IS NULL OR cp.last_reconciled_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE))
       ORDER BY cp.last_reconciled_at IS NULL DESC, cp.last_reconciled_at ASC, m.updated_at ASC
       LIMIT ${queryLimit}`,
      values,
    );

    let checked = 0;
    let updated = 0;
    let needsReview = 0;
    let failed = 0;

    for (const row of rows) {
      checked += 1;
      try {
        const connection = await this.getActiveConnection(row.clinicId, row.workspaceId);
        const remoteTask = await this.clickUpRequest(
          connection,
          `/task/${encodeURIComponent(row.clickupTaskId)}`,
        );
        const changed = await this.applyRemoteTaskState(row, remoteTask);
        if (changed) updated += 1;
        await this.upsertSyncCheckpoint({
          clinicId: row.clinicId,
          connectionId: row.connectionId,
          clientAccountProfileId: row.clientAccountProfileId,
          workspaceId: row.workspaceId,
          clickupListId: row.clickupListId || "",
          syncStatus: "healthy",
          lastReconciledAt: new Date(),
          lastError: null,
        });
      } catch (error: any) {
        const classified = classifyClickUpProviderFailure(error);
        const status = classified.retryable ? "retrying" : "reconciliation_needed";
        if (!classified.retryable) {
          await pool.execute(
            `UPDATE clickup_task_mapping
             SET mapping_status = 'needs_review',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [row.mappingId],
          );
          needsReview += 1;
        }
        failed += 1;
        await this.upsertSyncCheckpoint({
          clinicId: row.clinicId,
          connectionId: row.connectionId,
          clientAccountProfileId: row.clientAccountProfileId,
          workspaceId: row.workspaceId,
          clickupListId: row.clickupListId || "",
          syncStatus: status,
          lastReconciledAt: new Date(),
          lastError: this.safeErrorMessage(error),
        });
      }
    }

    return { checked, updated, needsReview, failed };
  }

  async getReconciliationStatus(clinicId: string): Promise<ClickUpReconciliationResponse> {
    const [healthRows]: any = await pool.execute(
      `SELECT COALESCE(cp.id, m.id) as id,
              m.client_account_profile_id as clientAccountProfileId,
              cap.clinic_id as clientClinicId,
              c.name as clientName,
              m.workspace_id as workspaceId,
              m.list_id as clickupListId,
              CASE
                WHEN cc.status IS NULL OR cc.status <> 'connected' THEN 'disconnected'
                ELSE COALESCE(cp.sync_status, 'healthy')
              END as syncStatus,
              cp.last_event_at as lastEventAt,
              cp.last_processed_event_at as lastProcessedEventAt,
              cp.last_reconciled_at as lastReconciledAt,
              cp.last_error as lastError,
              COALESCE(cp.retrying_count, 0) as retryingCount,
              COALESCE(cp.dead_letter_count, 0) as deadLetterCount,
              COALESCE(cp.updated_at, m.updated_at) as updatedAt
       FROM clickup_client_mapping m
       JOIN client_account_profile cap
         ON cap.id = m.client_account_profile_id
       JOIN clinic c
         ON c.id = cap.clinic_id
        AND c.deleted_at IS NULL
       LEFT JOIN clickup_connection cc
         ON cc.id = m.connection_id
       LEFT JOIN clickup_sync_checkpoint cp
         ON cp.clinic_id = m.clinic_id
        AND cp.client_account_profile_id = m.client_account_profile_id
        AND cp.workspace_id = m.workspace_id
        AND cp.clickup_list_id <=> COALESCE(m.list_id, '')
       WHERE m.clinic_id = ?
         AND m.mapping_status <> 'archived'
       ORDER BY FIELD(syncStatus, 'dead_letter', 'retrying', 'reconciliation_needed', 'delayed', 'disconnected', 'healthy'),
                c.name ASC`,
      [clinicId],
    );

    return {
      syncHealth: healthRows.map(mapSyncHealth),
      failedTaskMappings: await this.listFailedTaskMappings(clinicId),
      deadLetterEvents: await this.listDeadLetterEvents(clinicId),
    };
  }

  async replayDeadLetterEvent(clinicId: string, eventId: string) {
    const event = await this.getWebhookEventById(eventId);
    if (event.clinicId !== clinicId) throw ApiError.notFound("ClickUp event not found.");
    if (event.processingStatus !== "dead_letter") {
      throw ApiError.badRequest("Only dead-letter ClickUp events can be replayed.");
    }

    await pool.execute(
      `UPDATE clickup_webhook_event
       SET processing_status = 'queued',
           next_retry_at = NULL,
           error_class = NULL,
           error_message = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [eventId],
    );

    await this.processQueuedWebhookEvents({ eventId, limit: 1 });
    return this.getWebhookEventById(eventId).then(mapWebhookEvent);
  }

  async listFailedTaskMappings(clinicId: string): Promise<FailedTaskMapping[]> {
    const [rows] = await pool.execute<any[]>(
      `SELECT m.id, m.internal_task_id, m.client_account_profile_id,
              m.clickup_list_id, m.updated_at,
              t.title as internal_task_title,
              p.clinic_id as client_clinic_id,
              c.name as client_name
       FROM clickup_task_mapping m
       LEFT JOIN task t ON m.internal_task_id = t.id
       LEFT JOIN client_account_profile p ON m.client_account_profile_id = p.id
       LEFT JOIN clinic c ON p.clinic_id = c.id
       WHERE m.clinic_id = ? AND m.mapping_status = 'needs_review'
       ORDER BY m.updated_at DESC`,
      [clinicId]
    );

    return rows.map((row) => ({
      id: row.id,
      internalTaskId: row.internal_task_id,
      internalTaskTitle: row.internal_task_title || "Unknown Task",
      clientAccountProfileId: row.client_account_profile_id,
      clientClinicId: row.client_clinic_id || clinicId,
      clientName: row.client_name || "Unknown Client",
      clickupListId: row.clickup_list_id,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    }));
  }

  async replayTaskMapping(
    clinicId: string,
    mappingId: string,
    userId: string,
    access: ClickUpAccessContext,
    auditContext: ClickUpAuditContext = {}
  ): Promise<{ mapping: ClickUpTaskMappingResponse; message: string }> {
    const [chkRows]: any = await pool.execute('SELECT id FROM clickup_task_mapping WHERE id = ? AND clinic_id = ?', [mappingId, clinicId]);
    if (!chkRows[0]) throw ApiError.notFound("Task mapping not found.");
    
    const mapping = await this.getTaskMappingById(mappingId);
    if (mapping.mappingStatus !== "needs_review") {
      throw ApiError.badRequest("Only tasks in needs_review status can be replayed.");
    }

    const connection = await this.getActiveConnection(clinicId, mapping.workspaceId);
    
    if (!mapping.clickupTaskId.startsWith("pending:")) {
      const updated = await this.saveTaskMapping(
        clinicId,
        userId,
        {
          clientAccountProfileId: mapping.clientAccountProfileId,
          internalTaskId: mapping.internalTaskId!,
          connectionId: mapping.connectionId,
          workspaceId: mapping.workspaceId,
          clickupTaskId: mapping.clickupTaskId,
          clickupListId: mapping.clickupListId,
          clickupUrl: mapping.clickupUrl,
          syncDirection: "mission_control_to_clickup",
          mappingStatus: "active",
        },
        access,
        auditContext
      );
      return { mapping: updated, message: "Task was already created in ClickUp; mapping activated." };
    }

    if (!mapping.clickupListId || !mapping.internalTaskId) {
      throw ApiError.badRequest("Mapping is missing list ID or internal task ID required for replay.");
    }

    const tasks = await this.clickUpRequest(
      connection,
      `/list/${encodeURIComponent(mapping.clickupListId)}/task?include_closed=true`,
      { method: "GET" }
    );

    const match = (tasks.tasks || []).find((t: any) => 
      t.description && t.description.includes(`[Mission Control Task ID: ${mapping.internalTaskId}]`)
    );

    if (match) {
      const clickupTaskId = String(match.id);
      const clickupUrl = cleanString(match.url) || `https://app.clickup.com/t/${clickupTaskId}`;
      const updated = await this.saveTaskMapping(
        clinicId,
        userId,
        {
          clientAccountProfileId: mapping.clientAccountProfileId,
          internalTaskId: mapping.internalTaskId,
          connectionId: mapping.connectionId,
          workspaceId: mapping.workspaceId,
          clickupTaskId,
          clickupListId: mapping.clickupListId,
          clickupUrl,
          syncDirection: "mission_control_to_clickup",
          mappingStatus: "active",
        },
        access,
        auditContext
      );
      return { mapping: updated, message: "Found existing ClickUp task and successfully linked it." };
    }
    
    await pool.execute('DELETE FROM clickup_task_mapping WHERE id = ?', [mapping.id]);
    
    const [taskRows] = await pool.execute<any[]>(
      'SELECT title, priority, description, due_date FROM task WHERE id = ?',
      [mapping.internalTaskId]
    );
    if (!taskRows.length) throw ApiError.notFound("Internal task not found.");
    const task = taskRows[0];
    
    const [catRows] = await pool.execute<any[]>(
      'SELECT category_key FROM clickup_category_mapping WHERE clinic_id = ? AND client_account_profile_id = ? AND list_id = ?',
      [clinicId, mapping.clientAccountProfileId, mapping.clickupListId]
    );
    if (!catRows.length) throw ApiError.badRequest("Cannot replay: category mapping for this list no longer exists.");
    const categoryKey = catRows[0].category_key as ClickUpCategoryKey;
    
    const dueDateStr = task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : null;
    
    const result = await this.createClickUpTask(
      clinicId,
      userId,
      {
        internalTaskId: mapping.internalTaskId,
        categoryKey,
        title: task.title,
        priority: task.priority,
        description: task.description,
        dueDate: dueDateStr || null,
      } as CreateClickUpTaskDTO,
      [], // No attachments on replay
      access,
      auditContext
    );
    
    return { mapping: result.mapping, message: "Task was successfully recreated in ClickUp. Please upload any attachments manually." };
  }

  async dismissTaskMapping(
    clinicId: string,
    mappingId: string,
    userId: string,
    auditContext: ClickUpAuditContext = {}
  ): Promise<{ success: boolean }> {
    const [chkRows]: any = await pool.execute('SELECT id FROM clickup_task_mapping WHERE id = ? AND clinic_id = ?', [mappingId, clinicId]);
    if (!chkRows[0]) throw ApiError.notFound("Task mapping not found.");
    
    const mapping = await this.getTaskMappingById(mappingId);
    if (mapping.mappingStatus !== "needs_review") {
      throw ApiError.badRequest("Only tasks in needs_review status can be dismissed.");
    }

    await pool.execute(
      `UPDATE clickup_task_mapping
       SET mapping_status = 'archived',
           updated_by = ?
       WHERE id = ?`,
      [userId, mappingId]
    );

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: "CLICKUP_TASK_MAPPING_DISMISSED",
      entityType: "clickup_task_mapping",
      entityId: mappingId,
      changes: { mappingStatus: "archived" },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return { success: true };
  }

  private headerValue(headers: Record<string, string | string[] | undefined>, name: string) {
    const exact = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
    if (Array.isArray(exact)) return exact[0] || "";
    return exact || "";
  }

  private verifyWebhookSignature(signature: string, rawPayload: string) {
    if (!signature) throw ApiError.unauthorized("ClickUp webhook signature is required.");
    const normalized = signature.replace(/^sha256=/i, "").trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(normalized)) {
      throw ApiError.unauthorized("ClickUp webhook signature is invalid.");
    }

    const expected = createHmac("sha256", config.clickup.webhookSecret)
      .update(rawPayload, "utf8")
      .digest("hex");
    if (!safeTimingEqual(normalized, expected)) {
      throw ApiError.unauthorized("ClickUp webhook signature did not match.");
    }
  }

  private validateWebhookTimestamp(eventOccurredAt: Date | null): ClickUpWebhookProcessingStatus | null {
    if (!eventOccurredAt) return "quarantined";
    const now = Date.now();
    const eventMs = eventOccurredAt.getTime();
    if (eventMs > now + config.clickup.webhookFutureToleranceSeconds * 1000) return "quarantined";
    if (eventMs < now - config.clickup.webhookMaxEventAgeSeconds * 1000) return "quarantined";
    return null;
  }

  private async resolveWebhookMapping(summary: Record<string, unknown>): Promise<{
    clinicId: string | null;
    connectionId: string | null;
    clientAccountProfileId: string | null;
    taskMappingId: string | null;
    internalTaskId: string | null;
    workspaceId: string | null;
    clickupListId: string | null;
    initialStatus?: ClickUpWebhookProcessingStatus;
    errorClass?: string | null;
    errorMessage?: string | null;
  }> {
    const taskId = cleanString(summary.taskId);
    const listId = cleanString(summary.listId);

    if (taskId) {
      const [taskRows]: any = await pool.execute(
        `SELECT m.id as taskMappingId,
                m.clinic_id as clinicId,
                m.connection_id as connectionId,
                m.client_account_profile_id as clientAccountProfileId,
                m.internal_task_id as internalTaskId,
                m.workspace_id as workspaceId,
                m.clickup_list_id as clickupListId,
                m.mapping_status as mappingStatus
         FROM clickup_task_mapping m
         WHERE m.clickup_task_id = ?
           AND m.mapping_status <> 'archived'
         LIMIT 3`,
        [taskId],
      );
      const activeRows = taskRows.filter((row: any) => row.mappingStatus === "active");
      const candidateRows = activeRows.length ? activeRows : taskRows;
      if (candidateRows.length === 1) {
        const row = candidateRows[0];
        return {
          clinicId: row.clinicId,
          connectionId: row.connectionId || null,
          clientAccountProfileId: row.clientAccountProfileId,
          taskMappingId: row.taskMappingId,
          internalTaskId: row.internalTaskId || null,
          workspaceId: row.workspaceId,
          clickupListId: row.clickupListId || listId,
          initialStatus: row.mappingStatus === "active" ? "queued" : "quarantined",
          errorClass: row.mappingStatus === "active" ? null : "inactive_task_mapping",
          errorMessage: row.mappingStatus === "active" ? null : "ClickUp task mapping is not active.",
        };
      }
      if (candidateRows.length > 1) {
        return this.unresolvedWebhookMapping("ambiguous_task_mapping", "ClickUp task resolves to multiple Mission Control mappings.");
      }
    }

    if (listId) {
      const [listRows]: any = await pool.execute(
        `SELECT m.id as clientMappingId,
                m.clinic_id as clinicId,
                m.connection_id as connectionId,
                m.client_account_profile_id as clientAccountProfileId,
                m.workspace_id as workspaceId,
                m.list_id as clickupListId,
                m.mapping_status as mappingStatus
         FROM clickup_client_mapping m
         WHERE m.list_id = ?
           AND m.mapping_status <> 'archived'
         LIMIT 3`,
        [listId],
      );
      const activeRows = listRows.filter((row: any) => row.mappingStatus === "active");
      if (activeRows.length === 1) {
        const row = activeRows[0];
        return {
          clinicId: row.clinicId,
          connectionId: row.connectionId || null,
          clientAccountProfileId: row.clientAccountProfileId,
          taskMappingId: null,
          internalTaskId: null,
          workspaceId: row.workspaceId,
          clickupListId: row.clickupListId || listId,
          initialStatus: "queued",
        };
      }
      if (activeRows.length > 1) {
        return this.unresolvedWebhookMapping("ambiguous_client_mapping", "ClickUp list resolves to multiple Mission Control clients.");
      }
      if (listRows.length > 0) {
        return this.unresolvedWebhookMapping("inactive_client_mapping", "ClickUp list mapping is not active.");
      }
    }

    return this.unresolvedWebhookMapping("unmapped_client", "ClickUp event could not be mapped to an active Mission Control client.");
  }

  private unresolvedWebhookMapping(errorClass: string, errorMessage: string) {
    return {
      clinicId: null,
      connectionId: null,
      clientAccountProfileId: null,
      taskMappingId: null,
      internalTaskId: null,
      workspaceId: null,
      clickupListId: null,
      initialStatus: "quarantined" as ClickUpWebhookProcessingStatus,
      errorClass,
      errorMessage,
    };
  }

  private async getWebhookEventByKey(providerEventKey: string) {
    const [rows]: any = await pool.execute(
      `SELECT ${this.webhookEventSelectColumns()}
       FROM clickup_webhook_event e
       LEFT JOIN client_account_profile cap
         ON cap.id = e.client_account_profile_id
       LEFT JOIN clinic c
         ON c.id = cap.clinic_id
       WHERE e.provider_event_key = ?
       LIMIT 1`,
      [providerEventKey],
    );
    if (!rows[0]) throw ApiError.notFound("ClickUp webhook event not found.");
    return rows[0];
  }

  private async getWebhookEventById(eventId: string) {
    const [rows]: any = await pool.execute(
      `SELECT ${this.webhookEventSelectColumns()}
       FROM clickup_webhook_event e
       LEFT JOIN client_account_profile cap
         ON cap.id = e.client_account_profile_id
       LEFT JOIN clinic c
         ON c.id = cap.clinic_id
       WHERE e.id = ?
       LIMIT 1`,
      [eventId],
    );
    if (!rows[0]) throw ApiError.notFound("ClickUp webhook event not found.");
    return rows[0];
  }

  private webhookEventSelectColumns() {
    return `e.id,
            e.clinic_id as clinicId,
            e.connection_id as connectionId,
            e.client_account_profile_id as clientAccountProfileId,
            e.task_mapping_id as taskMappingId,
            e.workspace_id as workspaceId,
            e.provider_event_key as providerEventKey,
            e.provider_event_type as providerEventType,
            e.clickup_task_id as clickupTaskId,
            e.clickup_list_id as clickupListId,
            e.event_occurred_at as eventOccurredAt,
            e.provider_updated_at as providerUpdatedAt,
            e.payload_summary as payloadSummary,
            e.processing_status as processingStatus,
            e.retry_count as retryCount,
            e.next_retry_at as nextRetryAt,
            e.error_class as errorClass,
            e.error_message as errorMessage,
            e.received_at as receivedAt,
            e.processed_at as processedAt,
            c.name as clientName`;
  }

  private async processWebhookEvent(eventId: string): Promise<ClickUpWebhookProcessingStatus> {
    const event = await this.getWebhookEventById(eventId);
    if (!["queued", "retrying"].includes(event.processingStatus)) return event.processingStatus;

    await pool.execute(
      `UPDATE clickup_webhook_event
       SET processing_status = 'processing',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND processing_status IN ('queued','retrying')`,
      [eventId],
    );

    try {
      const status = await this.applyWebhookEvent(event);
      await pool.execute(
        `UPDATE clickup_webhook_event
         SET processing_status = ?,
             processed_at = CURRENT_TIMESTAMP,
             next_retry_at = NULL,
             error_class = NULL,
             error_message = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, eventId],
      );
      return status;
    } catch (error: any) {
      return this.scheduleWebhookEventFailure(event, error);
    }
  }

  private async applyWebhookEvent(event: any): Promise<ClickUpWebhookProcessingStatus> {
    const summary = parseSummary(event.payloadSummary);
    const mapping = await this.getLifecycleTaskMapping(event, summary);

    if (!mapping && event.providerEventType === "taskCreated") {
      await this.createNeedsReviewMappingFromProviderTask(event, summary);
      return "processed";
    }

    if (!mapping?.internalTaskId) {
      await this.upsertSyncCheckpoint({
        clinicId: event.clinicId,
        connectionId: event.connectionId,
        clientAccountProfileId: event.clientAccountProfileId,
        workspaceId: event.workspaceId || "",
        clickupListId: event.clickupListId || cleanString(summary.listId) || "",
        syncStatus: "reconciliation_needed",
        lastEventAt: parseClickUpDate(event.eventOccurredAt),
        lastError: "ClickUp event does not have an active internal task mapping.",
      });
      return "quarantined";
    }

    const cached = await this.getTaskStateCache(mapping.id);
    const occurredAt = parseClickUpDate(event.eventOccurredAt);
    const cachedUpdatedAt = parseClickUpDate(cached?.providerUpdatedAt);
    if (occurredAt && cachedUpdatedAt && occurredAt.getTime() < cachedUpdatedAt.getTime()) {
      return "stale";
    }

    await this.applyMappedLifecycleChanges(mapping, event, summary);
    await this.upsertTaskStateCache(mapping, event, summary);
    await this.upsertSyncCheckpoint({
      clinicId: mapping.clinicId,
      connectionId: mapping.connectionId,
      clientAccountProfileId: mapping.clientAccountProfileId,
      workspaceId: mapping.workspaceId,
      clickupListId: mapping.clickupListId || cleanString(summary.listId) || "",
      syncStatus: "healthy",
      lastEventAt: occurredAt,
      lastProcessedEventAt: new Date(),
      lastError: null,
    });

    return "processed";
  }

  private async getLifecycleTaskMapping(event: any, summary: Record<string, unknown>) {
    if (event.taskMappingId) {
      const [rows]: any = await pool.execute(
        `SELECT id,
                clinic_id as clinicId,
                client_account_profile_id as clientAccountProfileId,
                internal_task_id as internalTaskId,
                connection_id as connectionId,
                workspace_id as workspaceId,
                clickup_task_id as clickupTaskId,
                clickup_list_id as clickupListId,
                mapping_status as mappingStatus
         FROM clickup_task_mapping
         WHERE id = ?
           AND mapping_status <> 'archived'
         LIMIT 1`,
        [event.taskMappingId],
      );
      return rows[0] || null;
    }

    const taskId = cleanString(summary.taskId) || event.clickupTaskId;
    if (!taskId) return null;
    const [rows]: any = await pool.execute(
      `SELECT id,
              clinic_id as clinicId,
              client_account_profile_id as clientAccountProfileId,
              internal_task_id as internalTaskId,
              connection_id as connectionId,
              workspace_id as workspaceId,
              clickup_task_id as clickupTaskId,
              clickup_list_id as clickupListId,
              mapping_status as mappingStatus
       FROM clickup_task_mapping
       WHERE clickup_task_id = ?
         AND mapping_status <> 'archived'
       LIMIT 2`,
      [taskId],
    );
    return rows.length === 1 ? rows[0] : null;
  }

  private async createNeedsReviewMappingFromProviderTask(event: any, summary: Record<string, unknown>) {
    if (!event.clinicId || !event.clientAccountProfileId || !event.workspaceId || !event.clickupTaskId) {
      await this.upsertSyncCheckpoint({
        clinicId: event.clinicId,
        connectionId: event.connectionId,
        clientAccountProfileId: event.clientAccountProfileId,
        workspaceId: event.workspaceId || "",
        clickupListId: event.clickupListId || cleanString(summary.listId) || "",
        syncStatus: "reconciliation_needed",
        lastEventAt: parseClickUpDate(event.eventOccurredAt),
        lastError: "Provider-created ClickUp task could not be mapped to a client list.",
      });
      return;
    }

    const mappingId = uuidv4();
    await pool.execute(
      `INSERT INTO clickup_task_mapping
        (id, clinic_id, client_account_profile_id, internal_task_id, connection_id,
         workspace_id, clickup_task_id, clickup_list_id, clickup_url, sync_direction,
         mapping_status, created_by, updated_by)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, 'clickup_to_mission_control', 'needs_review', NULL, NULL)
       ON DUPLICATE KEY UPDATE
         mapping_status = IF(mapping_status = 'archived', 'needs_review', mapping_status),
         updated_at = CURRENT_TIMESTAMP`,
      [
        mappingId,
        event.clinicId,
        event.clientAccountProfileId,
        event.connectionId || null,
        event.workspaceId,
        event.clickupTaskId,
        event.clickupListId || cleanString(summary.listId) || null,
        `https://app.clickup.com/t/${event.clickupTaskId}`,
      ],
    );
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM clickup_task_mapping
       WHERE clinic_id = ?
         AND workspace_id = ?
         AND clickup_task_id = ?
       LIMIT 1`,
      [event.clinicId, event.workspaceId, event.clickupTaskId],
    );
    const savedMappingId = rows[0]?.id || mappingId;
    await pool.execute(
      `UPDATE clickup_webhook_event
       SET task_mapping_id = ?
       WHERE id = ?`,
      [savedMappingId, event.id],
    );
    await this.upsertSyncCheckpoint({
      clinicId: event.clinicId,
      connectionId: event.connectionId,
      clientAccountProfileId: event.clientAccountProfileId,
      workspaceId: event.workspaceId,
      clickupListId: event.clickupListId || cleanString(summary.listId) || "",
      syncStatus: "reconciliation_needed",
      lastEventAt: parseClickUpDate(event.eventOccurredAt),
      lastProcessedEventAt: new Date(),
      lastError: "Provider-created task needs Mission Control review before linking to an internal task.",
    });
  }

  private async applyMappedLifecycleChanges(mapping: any, event: any, summary: Record<string, unknown>) {
    const eventType = event.providerEventType as string;
    const statusAfter = cleanString(summary.statusAfter);
    const dueAfter = parseClickUpDate(summary.dueAfter);
    const priorityAfter = mapProviderPriority(cleanString(summary.priorityAfter));
    const assigneeIds = Array.isArray(summary.assigneeIds) ? summary.assigneeIds.map(String).filter(Boolean) : [];
    const taskFields: string[] = [];
    const values: any[] = [];
    const changes: Record<string, unknown> = {
      providerEventType: eventType,
      providerEventKey: event.providerEventKey,
    };

    if (eventType === "taskCompleted" || eventType === "taskStatusUpdated" || (eventType === "taskUpdated" && statusAfter)) {
      const completed = isCompletedStatus(statusAfter, eventType);
      taskFields.push("status = ?", "completed_at = ?");
      values.push(completed ? "completed" : "pending", completed ? new Date() : null);
      changes.status = completed ? "completed" : "pending";
    }

    if ((eventType === "taskDueDateUpdated" || eventType === "taskUpdated") && dueAfter) {
      taskFields.push("due_date = ?");
      values.push(toMysqlDateTime(dueAfter)?.slice(0, 10) || null);
      changes.dueDate = dueAfter.toISOString().slice(0, 10);
    }

    if ((eventType === "taskAssigneeUpdated" || eventType === "taskUpdated") && assigneeIds.length > 0) {
      const assignedTo = assigneeIds.map((id) => `ClickUp assignee ${id}`).join(", ");
      taskFields.push("assigned_to = ?");
      values.push(assignedTo);
      changes.assigneeIds = assigneeIds;
    }

    if ((eventType === "taskPriorityUpdated" || eventType === "taskUpdated") && priorityAfter) {
      taskFields.push("priority = ?");
      values.push(priorityAfter);
      changes.priority = priorityAfter;
    }

    if (eventType === "taskArchived") {
      taskFields.push("archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP)");
      await pool.execute(
        `UPDATE clickup_task_mapping
         SET mapping_status = 'needs_review',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [mapping.id],
      );
      changes.mappingStatus = "needs_review";
      changes.providerArchived = true;
    }

    if (eventType === "taskDeleted") {
      await pool.execute(
        `UPDATE clickup_task_mapping
         SET mapping_status = 'needs_review',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [mapping.id],
      );
      changes.mappingStatus = "needs_review";
      changes.providerDeleted = true;
    }

    if (eventType === "taskMoved") {
      const nextListId = cleanString(summary.listId) || event.clickupListId || mapping.clickupListId;
      const sameClient = nextListId
        ? await this.listBelongsToClient(mapping.clinicId, mapping.clientAccountProfileId, mapping.workspaceId, nextListId)
        : false;
      await pool.execute(
        `UPDATE clickup_task_mapping
         SET clickup_list_id = ?,
             mapping_status = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nextListId || mapping.clickupListId, sameClient ? "active" : "needs_review", mapping.id],
      );
      changes.clickupListId = nextListId;
      changes.mappingStatus = sameClient ? "active" : "needs_review";
      changes.providerMoved = true;
    }

    if (taskFields.length > 0) {
      values.push(mapping.internalTaskId, mapping.clinicId);
      await pool.execute(
        `UPDATE task
         SET ${taskFields.join(", ")},
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND clinic_id = ?
           AND is_internal = 1
           AND deleted_at IS NULL`,
        values,
      );
    }

    await insertAuditEvent(pool, {
      clinicId: mapping.clinicId,
      userId: null,
      action: "CLICKUP_LIFECYCLE_EVENT_APPLIED",
      entityType: "task",
      entityId: mapping.internalTaskId,
      changes,
      ipAddress: null,
      userAgent: null,
    });
  }

  private async getTaskStateCache(taskMappingId: string) {
    const [rows]: any = await pool.execute(
      `SELECT provider_updated_at as providerUpdatedAt
       FROM clickup_task_state_cache
       WHERE task_mapping_id = ?
       LIMIT 1`,
      [taskMappingId],
    );
    return rows[0] || null;
  }

  private async upsertTaskStateCache(mapping: any, event: any, summary: Record<string, unknown>) {
    const eventType = String(event.providerEventType || "");
    const assigneeIds = Array.isArray(summary.assigneeIds) ? summary.assigneeIds.map(String).filter(Boolean) : [];
    await pool.execute(
      `INSERT INTO clickup_task_state_cache
        (id, clinic_id, client_account_profile_id, task_mapping_id, workspace_id,
         clickup_task_id, clickup_list_id, clickup_status, clickup_status_type,
         clickup_priority, clickup_due_at, clickup_assignee_ids, provider_deleted,
         provider_archived, provider_moved, provider_updated_at, last_event_key,
         last_event_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         clickup_list_id = VALUES(clickup_list_id),
         clickup_status = COALESCE(VALUES(clickup_status), clickup_status),
         clickup_status_type = COALESCE(VALUES(clickup_status_type), clickup_status_type),
         clickup_priority = COALESCE(VALUES(clickup_priority), clickup_priority),
         clickup_due_at = COALESCE(VALUES(clickup_due_at), clickup_due_at),
         clickup_assignee_ids = COALESCE(VALUES(clickup_assignee_ids), clickup_assignee_ids),
         provider_deleted = GREATEST(provider_deleted, VALUES(provider_deleted)),
         provider_archived = GREATEST(provider_archived, VALUES(provider_archived)),
         provider_moved = GREATEST(provider_moved, VALUES(provider_moved)),
         provider_updated_at = COALESCE(VALUES(provider_updated_at), provider_updated_at),
         last_event_key = VALUES(last_event_key),
         last_event_type = VALUES(last_event_type),
         updated_at = CURRENT_TIMESTAMP`,
      [
        uuidv4(),
        mapping.clinicId,
        mapping.clientAccountProfileId,
        mapping.id,
        mapping.workspaceId,
        mapping.clickupTaskId,
        cleanString(summary.listId) || mapping.clickupListId || null,
        cleanString(summary.statusAfter),
        cleanString(summary.statusTypeAfter),
        cleanString(summary.priorityAfter),
        toMysqlDateTime(parseClickUpDate(summary.dueAfter)),
        assigneeIds.length ? JSON.stringify(assigneeIds) : null,
        eventType === "taskDeleted" ? 1 : 0,
        eventType === "taskArchived" ? 1 : 0,
        eventType === "taskMoved" ? 1 : 0,
        toMysqlDateTime(parseClickUpDate(event.eventOccurredAt)),
        event.providerEventKey,
        eventType,
      ],
    );
  }

  private async upsertSyncCheckpoint(data: {
    clinicId: string | null;
    connectionId?: string | null;
    clientAccountProfileId: string | null;
    workspaceId: string;
    clickupListId?: string | null;
    syncStatus: string;
    lastEventAt?: Date | null;
    lastProcessedEventAt?: Date | null;
    lastReconciledAt?: Date | null;
    lastError?: string | null;
  }) {
    if (!data.clinicId || !data.clientAccountProfileId || !data.workspaceId) return;
    const listId = data.clickupListId || "";
    const [countRows]: any = await pool.execute(
      `SELECT
          SUM(processing_status IN ('queued','retrying','processing')) as retryingCount,
          SUM(processing_status = 'dead_letter') as deadLetterCount
       FROM clickup_webhook_event
       WHERE clinic_id = ?
         AND client_account_profile_id = ?
         AND workspace_id = ?
         AND COALESCE(clickup_list_id, '') = ?`,
      [data.clinicId, data.clientAccountProfileId, data.workspaceId, listId],
    );
    const deadLetterCount = Number(countRows[0]?.deadLetterCount || 0);
    const retryingCount = Number(countRows[0]?.retryingCount || 0);
    const syncStatus = deadLetterCount > 0
      ? "dead_letter"
      : retryingCount > 0 && data.syncStatus === "healthy"
        ? "retrying"
        : data.syncStatus;

    await pool.execute(
      `INSERT INTO clickup_sync_checkpoint
        (id, clinic_id, connection_id, client_account_profile_id, workspace_id,
         clickup_list_id, sync_status, last_event_at, last_processed_event_at,
         last_reconciled_at, last_error, retrying_count, dead_letter_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         connection_id = COALESCE(VALUES(connection_id), connection_id),
         sync_status = VALUES(sync_status),
         last_event_at = COALESCE(VALUES(last_event_at), last_event_at),
         last_processed_event_at = COALESCE(VALUES(last_processed_event_at), last_processed_event_at),
         last_reconciled_at = COALESCE(VALUES(last_reconciled_at), last_reconciled_at),
         last_error = VALUES(last_error),
         retrying_count = VALUES(retrying_count),
         dead_letter_count = VALUES(dead_letter_count),
         updated_at = CURRENT_TIMESTAMP`,
      [
        uuidv4(),
        data.clinicId,
        data.connectionId || null,
        data.clientAccountProfileId,
        data.workspaceId,
        listId,
        syncStatus,
        toMysqlDateTime(data.lastEventAt),
        toMysqlDateTime(data.lastProcessedEventAt),
        toMysqlDateTime(data.lastReconciledAt),
        data.lastError || null,
        retryingCount,
        deadLetterCount,
      ],
    );
  }

  private async scheduleWebhookEventFailure(event: any, error: any): Promise<ClickUpWebhookProcessingStatus> {
    const classified = classifyClickUpProviderFailure(error);
    const nextRetryCount = Number(event.retryCount || 0) + 1;
    const canRetry = classified.retryable && nextRetryCount <= CLICKUP_EVENT_MAX_RETRIES;
    const backoffMs = classified.retryAfterMs > 0
      ? classified.retryAfterMs
      : Math.min(15 * 60 * 1000, (2 ** Math.max(0, nextRetryCount - 1)) * 60 * 1000);
    const nextRetryAt = canRetry ? new Date(Date.now() + backoffMs) : null;
    const processingStatus: ClickUpWebhookProcessingStatus = canRetry ? "retrying" : "dead_letter";

    await pool.execute(
      `UPDATE clickup_webhook_event
       SET processing_status = ?,
           retry_count = ?,
           next_retry_at = ?,
           error_class = ?,
           error_message = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        processingStatus,
        nextRetryCount,
        toMysqlDateTime(nextRetryAt),
        classified.errorClass,
        this.safeErrorMessage(error),
        event.id,
      ],
    );

    await this.upsertSyncCheckpoint({
      clinicId: event.clinicId,
      connectionId: event.connectionId,
      clientAccountProfileId: event.clientAccountProfileId,
      workspaceId: event.workspaceId || "",
      clickupListId: event.clickupListId || "",
      syncStatus: processingStatus === "retrying" ? "retrying" : "dead_letter",
      lastEventAt: parseClickUpDate(event.eventOccurredAt),
      lastError: this.safeErrorMessage(error),
    });

    return processingStatus;
  }

  private safeErrorMessage(error: any) {
    const message = String(error?.message || "ClickUp sync failed.");
    return message.replace(/Bearer\s+[A-Za-z0-9._~+/-]+/g, "Bearer [redacted]").slice(0, 1000);
  }

  private async listBelongsToClient(clinicId: string, clientAccountProfileId: string, workspaceId: string, listId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM clickup_client_mapping
       WHERE clinic_id = ?
         AND client_account_profile_id = ?
         AND workspace_id = ?
         AND list_id = ?
         AND mapping_status = 'active'
       LIMIT 1`,
      [clinicId, clientAccountProfileId, workspaceId, listId],
    );
    return rows.length > 0;
  }

  private async listDeadLetterEvents(clinicId: string): Promise<ClickUpWebhookEventRecord[]> {
    const [rows]: any = await pool.execute(
      `SELECT ${this.webhookEventSelectColumns()}
       FROM clickup_webhook_event e
       LEFT JOIN client_account_profile cap
         ON cap.id = e.client_account_profile_id
       LEFT JOIN clinic c
         ON c.id = cap.clinic_id
       WHERE e.clinic_id = ?
         AND e.processing_status = 'dead_letter'
       ORDER BY e.updated_at DESC
       LIMIT 50`,
      [clinicId],
    );
    return rows.map(mapWebhookEvent);
  }

  private async applyRemoteTaskState(mapping: any, remoteTask: any) {
    const summary = {
      taskId: String(remoteTask?.id || mapping.clickupTaskId),
      listId: normalizeClickUpId(firstDefined(remoteTask?.list?.id, mapping.clickupListId)),
      statusAfter: statusValue(remoteTask?.status),
      statusTypeAfter: statusTypeValue(remoteTask?.status),
      dueAfter: parseClickUpDate(remoteTask?.due_date)?.toISOString() || null,
      priorityAfter: extractPriorityAfter({ task: remoteTask }),
      assigneeIds: extractAssigneeIdsFromValue(remoteTask?.assignees),
    };
    const fakeEvent = {
      id: `reconcile:${mapping.mappingId || mapping.id}`,
      providerEventType: "taskUpdated",
      providerEventKey: `reconcile:${mapping.clickupTaskId}:${Date.now()}`,
      eventOccurredAt: toMysqlDateTime(parseClickUpDate(remoteTask?.date_updated) || new Date()),
    };
    const lifecycleMapping = {
      id: mapping.mappingId || mapping.id,
      clinicId: mapping.clinicId,
      clientAccountProfileId: mapping.clientAccountProfileId,
      internalTaskId: mapping.internalTaskId,
      connectionId: mapping.connectionId,
      workspaceId: mapping.workspaceId,
      clickupTaskId: mapping.clickupTaskId,
      clickupListId: mapping.clickupListId,
    };
    await this.applyMappedLifecycleChanges(lifecycleMapping, fakeEvent, summary);
    await this.upsertTaskStateCache(lifecycleMapping, fakeEvent, summary);
    return true;
  }

  private async recoverTaskMappingAfterCreation(
    clinicId: string,
    internalTaskId: string,
    clickupTaskId: string,
    clickupUrl: string,
  ) {
    await pool.execute(
      `UPDATE clickup_task_mapping
       SET clickup_task_id = ?,
           clickup_url = ?
       WHERE clinic_id = ?
         AND internal_task_id = ?`,
      [clickupTaskId, clickupUrl, clinicId, internalTaskId],
    );
  }

  private pendingClickUpTaskId(internalTaskId: string) {
    return `pending:${internalTaskId}`;
  }

  private oauthRedirectUri() {
    return `${config.apiPublicUrl.replace(/\/+$/, "")}/clickup/oauth/callback`;
  }

  private async exchangeCodeForToken(code: string) {
    const response = await fetch(`${config.clickup.apiBaseUrl.replace(/\/+$/, "")}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.clickup.clientId,
        client_secret: config.clickup.clientSecret,
        code,
      }),
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw ApiError.serviceUnavailable(payload.err || payload.error || "ClickUp OAuth token exchange failed.");
    }

    const expiresInSeconds = Number(payload.expires_in || 0);
    return {
      accessToken: String(payload.access_token),
      refreshToken: cleanString(payload.refresh_token),
      expiresAt: expiresInSeconds > 0
        ? new Date(Date.now() + expiresInSeconds * 1000).toISOString().slice(0, 19).replace("T", " ")
        : null,
      scopes: Array.isArray(payload.scope)
        ? payload.scope.map(String)
        : cleanString(payload.scope)?.split(/[,\s]+/).filter(Boolean) || [],
    };
  }

  private async fetchAuthorizedWorkspaces(accessToken: string, authMode: "oauth" | "personal_token", includeMembers = false) {
    const response = await fetch(`${config.clickup.apiBaseUrl.replace(/\/+$/, "")}/team`, {
      headers: { Authorization: authMode === "oauth" ? `Bearer ${accessToken}` : accessToken },
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(payload.teams)) {
      throw ApiError.serviceUnavailable(payload.err || payload.error || "ClickUp workspace lookup failed.");
    }

    return payload.teams.map((team: any) => ({
      id: String(team.id),
      name: String(team.name || team.id),
      members: includeMembers ? extractClickUpMembers(team) : [],
    }));
  }

  private selectWorkspace(
    workspaces: Array<{ id: string; name: string }>,
    requestedWorkspaceId: string | null,
  ): { id: string; name: string } {
    if (workspaces.length === 0) {
      throw ApiError.serviceUnavailable("ClickUp OAuth did not return an authorised workspace.");
    }

    if (requestedWorkspaceId) {
      const match = workspaces.find((workspace) => workspace.id === requestedWorkspaceId);
      if (!match) throw ApiError.forbidden("Selected ClickUp workspace was not authorised by this OAuth connection.");
      return match;
    }

    if (workspaces.length > 1) {
      throw ApiError.badRequest("ClickUp returned multiple workspaces. Select the approved workspace ID before completing setup.");
    }

    return workspaces[0]!;
  }

  private async getConnectionById(connectionId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              workspace_id as workspaceId,
              workspace_name as workspaceName,
              status,
              scopes,
              connected_by as connectedBy,
              connected_at as connectedAt,
              revoked_at as revokedAt,
              last_checked_at as lastCheckedAt,
              last_error as lastError,
              encrypted_access_token as encryptedAccessToken,
              encrypted_refresh_token as encryptedRefreshToken,
              token_expires_at as tokenExpiresAt,
              updated_at as updatedAt
       FROM clickup_connection
       WHERE id = ?
       LIMIT 1`,
      [connectionId],
    );
    if (!rows[0]) throw ApiError.notFound("ClickUp connection not found.");
    return mapConnection(rows[0]);
  }

  private async getActiveConnection(clinicId: string, workspaceId?: string | null) {
    const values: any[] = [clinicId];
    const workspaceClause = workspaceId ? "AND workspace_id = ?" : "";
    if (workspaceId) values.push(workspaceId);
    const [rows]: any = await pool.execute(
      `SELECT id,
              workspace_id as workspaceId,
              workspace_name as workspaceName,
              encrypted_access_token as encryptedAccessToken,
              encrypted_refresh_token as encryptedRefreshToken,
              token_expires_at as tokenExpiresAt,
              scopes
       FROM clickup_connection
       WHERE clinic_id = ?
         AND status = 'connected'
         ${workspaceClause}
       ORDER BY updated_at DESC
       LIMIT 1`,
      values,
    );
    const row = rows[0];
    if (!row) throw ApiError.badRequest("ClickUp is not connected for this workspace. Connect it in Integrations first.");
    const scopes = parseJsonArray(row.scopes);
    const authMode = scopes.includes("personal_api_token") ? "personal_token" as const : "oauth" as const;
    let accessToken = decryptProviderCredential(row.encryptedAccessToken);
    if (!accessToken) throw ApiError.serviceUnavailable("ClickUp credentials could not be read. Reconnect ClickUp before creating tasks.");
    const tokenExpiresAt = row.tokenExpiresAt ? new Date(row.tokenExpiresAt) : null;
    if (authMode === "oauth" && tokenExpiresAt && tokenExpiresAt.getTime() <= Date.now() + 60 * 1000) {
      accessToken = await this.refreshOAuthAccessToken({
        connectionId: row.id,
        encryptedRefreshToken: row.encryptedRefreshToken,
      });
    }
    return {
      id: row.id as string,
      workspaceId: row.workspaceId as string,
      workspaceName: row.workspaceName as string | null,
      accessToken,
      authMode,
    };
  }

  private async refreshOAuthAccessToken(data: { connectionId: string; encryptedRefreshToken?: string | null }) {
    const refreshToken = decryptProviderCredential(data.encryptedRefreshToken || "");
    if (!refreshToken || !config.clickup.clientId || !config.clickup.clientSecret) {
      await pool.execute(
        `UPDATE clickup_connection
         SET status = 'error',
             last_error = 'ClickUp OAuth token expired and refresh configuration is unavailable.',
             last_checked_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [data.connectionId],
      );
      throw ApiError.serviceUnavailable("ClickUp OAuth token expired. Reconnect ClickUp.");
    }

    const response = await fetch(`${config.clickup.apiBaseUrl.replace(/\/+$/, "")}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.clickup.clientId,
        client_secret: config.clickup.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      await pool.execute(
        `UPDATE clickup_connection
         SET status = 'error',
             last_error = ?,
             last_checked_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [String(payload.err || payload.error || "ClickUp OAuth token refresh failed.").slice(0, 1000), data.connectionId],
      );
      throw ApiError.serviceUnavailable("ClickUp OAuth token refresh failed. Reconnect ClickUp.");
    }

    const expiresInSeconds = Number(payload.expires_in || 0);
    const nextRefreshToken = cleanString(payload.refresh_token) || refreshToken;
    await pool.execute(
      `UPDATE clickup_connection
       SET encrypted_access_token = ?,
           encrypted_refresh_token = ?,
           token_expires_at = ?,
           last_checked_at = CURRENT_TIMESTAMP,
           last_error = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        encryptProviderCredential(String(payload.access_token)),
        encryptProviderCredential(nextRefreshToken),
        expiresInSeconds > 0 ? toMysqlDateTime(new Date(Date.now() + expiresInSeconds * 1000)) : null,
        data.connectionId,
      ],
    );
    return String(payload.access_token);
  }

  private async clickUpRequest(
    connection: { accessToken: string; authMode: "oauth" | "personal_token" },
    path: string,
    init: RequestInit = {},
  ) {
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", connection.authMode === "oauth" ? `Bearer ${connection.accessToken}` : connection.accessToken);
    if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    let response: Response;
    try {
      response = await fetch(`${config.clickup.apiBaseUrl.replace(/\/+$/, "")}${path}`, {
        ...init,
        headers,
      });
    } catch {
      const apiError = ApiError.serviceUnavailable("ClickUp API request failed because the provider could not be reached.", {
        provider: "clickup",
        providerStatus: 0,
        retryable: true,
        retryAfterMs: 0,
      }) as ApiError & { providerStatus?: number; retryAfterMs?: number; retryable?: boolean };
      apiError.providerStatus = 0;
      apiError.retryAfterMs = 0;
      apiError.retryable = true;
      throw apiError;
    }
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.err || payload.error || payload.message || `ClickUp API request failed with status ${response.status}.`;
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : 0;
      const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 0;
      const retryable = response.status === 429 || response.status >= 500;
      const apiError = ApiError.serviceUnavailable(String(message), {
        provider: "clickup",
        providerStatus: response.status,
        retryable,
        retryAfterMs,
      }) as ApiError & { providerStatus?: number; retryAfterMs?: number; retryable?: boolean };
      apiError.providerStatus = response.status;
      apiError.retryAfterMs = retryAfterMs;
      apiError.retryable = retryable;
      throw apiError;
    }
    return payload;
  }

  private async uploadClickUpAttachment(
    connection: { accessToken: string; authMode: "oauth" | "personal_token" },
    clickupTaskId: string,
    file: Express.Multer.File,
  ) {
    const body = new FormData();
    const bytes = new Uint8Array(file.buffer.byteLength);
    bytes.set(file.buffer);
    const blob = new Blob([bytes], { type: file.mimetype || "application/octet-stream" });
    body.set("attachment", blob, file.originalname);
    await this.clickUpRequest(connection, `/task/${encodeURIComponent(clickupTaskId)}/attachment`, {
      method: "POST",
      body,
    });
  }

  private async getActiveCategoryMapping(
    clinicId: string,
    clientAccountProfileId: string,
    categoryKey: ClickUpCategoryKey,
  ) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              client_account_profile_id as clientAccountProfileId,
              connection_id as connectionId,
              workspace_id as workspaceId,
              space_id as spaceId,
              category_key as categoryKey,
              folder_id as folderId,
              list_id as listId,
              default_assignee_ids as defaultAssigneeIds,
              mapping_status as mappingStatus,
              mapping_source as mappingSource,
              updated_at as updatedAt
       FROM clickup_category_mapping
       WHERE clinic_id = ?
         AND client_account_profile_id = ?
         AND category_key = ?
         AND mapping_status = 'active'
       LIMIT 1`,
      [clinicId, clientAccountProfileId, categoryKey],
    );
    if (!rows[0]) {
      throw ApiError.badRequest(`ClickUp mapping is missing for ${categoryKey.replaceAll("_", " ")}. Configure the client/category mapping before creating the task.`);
    }
    return mapCategoryMapping(rows[0]);
  }

  private async getClickUpPriority(clinicId: string, missionControlPriority: string) {
    const [rows]: any = await pool.execute(
      `SELECT clickup_priority as clickupPriority
       FROM clickup_priority_mapping
       WHERE clinic_id = ?
         AND mission_control_priority = ?
       LIMIT 1`,
      [clinicId, missionControlPriority],
    );
    if (!rows[0]) {
      throw ApiError.badRequest(`ClickUp priority mapping is missing for ${missionControlPriority}. Configure priority mappings before creating the task.`);
    }
    return Number(rows[0].clickupPriority);
  }

  private async getTaskMappingByInternalTask(clinicId: string, internalTaskId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              client_account_profile_id as clientAccountProfileId,
              internal_task_id as internalTaskId,
              connection_id as connectionId,
              workspace_id as workspaceId,
              clickup_task_id as clickupTaskId,
              clickup_list_id as clickupListId,
              clickup_url as clickupUrl,
              sync_direction as syncDirection,
              mapping_status as mappingStatus,
              updated_at as updatedAt
       FROM clickup_task_mapping
       WHERE clinic_id = ?
         AND internal_task_id = ?
       LIMIT 1`,
      [clinicId, internalTaskId],
    );
    return rows[0] ? mapTaskMapping(rows[0]) : null;
  }

  private async getInternalTaskForClickUp(clinicId: string, taskId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              title,
              description,
              priority,
              DATE_FORMAT(due_date, '%Y-%m-%d') as dueDate,
              client_account_profile_id as clientAccountProfileId
       FROM task
       WHERE id = ?
         AND clinic_id = ?
         AND is_internal = 1
         AND deleted_at IS NULL
         AND archived_at IS NULL
       LIMIT 1`,
      [taskId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Internal task not found.");
    return rows[0] as {
      id: string;
      title: string;
      description: string | null;
      priority: string;
      dueDate: string | null;
      clientAccountProfileId: string | null;
    };
  }

  private composeClickUpDescription(description: string, links: Array<{ label?: string | null; url: string }>, internalTaskId?: string) {
    const cleanLinks = links
      .map((link) => ({ label: cleanString(link.label) || "Relevant link", url: cleanString(link.url) }))
      .filter((link): link is { label: string; url: string } => Boolean(link.url));
    
    const parts = [description];
    
    if (cleanLinks.length > 0) {
      parts.push("", "Relevant links:", ...cleanLinks.map((link) => `- ${link.label}: ${link.url}`));
    }
    
    if (internalTaskId) {
      parts.push("", `[Mission Control Task ID: ${internalTaskId}]`);
    }
    
    return parts.join("\n").trim();
  }

  private async ensureConnectionAvailable(clinicId: string, connectionId: string | null, workspaceId: string) {
    if (!connectionId) return;
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM clickup_connection
       WHERE id = ?
         AND clinic_id = ?
         AND workspace_id = ?
         AND status = 'connected'
       LIMIT 1`,
      [connectionId, clinicId, workspaceId],
    );
    if (!rows[0]) {
      throw ApiError.forbidden("ClickUp connection is not available to this workspace.");
    }
  }

  private async ensureClientAccountProfileAvailable(
    sourceClinicId: string,
    clientAccountProfileId: string,
    access: ClickUpAccessContext,
  ) {
    const [rows]: any = await pool.execute(
      `SELECT cap.id,
              cap.clinic_id as clientClinicId,
              c.name as clientName
       FROM client_account_profile cap
       JOIN clinic c
         ON c.id = cap.clinic_id
        AND c.deleted_at IS NULL
       WHERE cap.id = ?
       LIMIT 1`,
      [clientAccountProfileId],
    );
    const profile = rows[0];
    if (!profile) throw ApiError.notFound("Client account not found.");
    if (profile.clientClinicId === sourceClinicId || access.canManageAllClientAccounts) {
      return profile as { id: string; clientClinicId: string; clientName: string };
    }
    throw ApiError.forbidden("Client account is not available to this workspace.");
  }

  private async ensureExternalClientStructureUnused(
    clinicId: string,
    clientAccountProfileId: string,
    data: SaveClickUpClientMappingDTO,
  ) {
    const [rows]: any = await pool.execute(
      `SELECT id, client_account_profile_id as clientAccountProfileId
       FROM clickup_client_mapping
       WHERE clinic_id = ?
         AND workspace_id = ?
         AND COALESCE(space_id, '') = ?
         AND COALESCE(folder_id, '') = ?
         AND COALESCE(list_id, '') = ?
         AND COALESCE(delivery_root_task_id, '') = ?
         AND client_account_profile_id <> ?
         AND mapping_status <> 'archived'
       LIMIT 1`,
      [
        clinicId,
        data.workspaceId,
        nullableExternalKey(data.spaceId),
        nullableExternalKey(data.folderId),
        nullableExternalKey(data.listId),
        nullableExternalKey(data.deliveryRootTaskId),
        clientAccountProfileId,
      ],
    );

    if (rows[0]) {
      throw ApiError.conflict("That ClickUp delivery structure is already mapped to another client account.");
    }
  }

  private ensureDeterministicClientStructure(data: SaveClickUpClientMappingDTO) {
    if (data.spaceId || data.folderId || data.listId || data.deliveryRootTaskId) return;
    throw ApiError.badRequest("A ClickUp space, folder, list, or delivery task ID is required for deterministic client mapping.");
  }

  private async ensureTaskBelongsToClient(clinicId: string, clientAccountProfileId: string, taskId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM task
       WHERE id = ?
         AND clinic_id = ?
         AND client_account_profile_id = ?
         AND is_internal = 1
         AND deleted_at IS NULL
       LIMIT 1`,
      [taskId, clinicId, clientAccountProfileId],
    );
    if (!rows[0]) {
      throw ApiError.forbidden("Internal task is not available to this client account.");
    }
  }

  private async ensureClickUpTaskUnused(
    clinicId: string,
    clientAccountProfileId: string,
    workspaceId: string,
    clickupTaskId: string,
  ) {
    const [rows]: any = await pool.execute(
      `SELECT id, client_account_profile_id as clientAccountProfileId
       FROM clickup_task_mapping
       WHERE clinic_id = ?
         AND workspace_id = ?
         AND clickup_task_id = ?
         AND client_account_profile_id <> ?
         AND mapping_status <> 'archived'
       LIMIT 1`,
      [clinicId, workspaceId, clickupTaskId, clientAccountProfileId],
    );
    if (rows[0]) {
      throw ApiError.conflict("That ClickUp task is already mapped to another client account.");
    }
  }

  private async getTaskMappingById(mappingId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              client_account_profile_id as clientAccountProfileId,
              internal_task_id as internalTaskId,
              connection_id as connectionId,
              workspace_id as workspaceId,
              clickup_task_id as clickupTaskId,
              clickup_list_id as clickupListId,
              clickup_url as clickupUrl,
              sync_direction as syncDirection,
              mapping_status as mappingStatus,
              updated_at as updatedAt
       FROM clickup_task_mapping
       WHERE id = ?
       LIMIT 1`,
      [mappingId],
    );
    if (!rows[0]) throw ApiError.notFound("ClickUp task mapping not found.");
    return mapTaskMapping(rows[0]);
  }

  private clientMappingSelectSql(where: string) {
    return `SELECT m.id,
                   m.client_account_profile_id as clientAccountProfileId,
                   cap.clinic_id as clientClinicId,
                   c.name as clientName,
                   m.connection_id as connectionId,
                   m.workspace_id as workspaceId,
                   cc.workspace_name as workspaceName,
                   m.space_id as spaceId,
                   m.folder_id as folderId,
                   m.list_id as listId,
                   m.delivery_root_task_id as deliveryRootTaskId,
                   m.delivery_url as deliveryUrl,
                   m.mapping_status as mappingStatus,
                   m.mapping_source as mappingSource,
                   m.updated_at as updatedAt
            FROM clickup_client_mapping m
            JOIN client_account_profile cap
              ON cap.id = m.client_account_profile_id
            JOIN clinic c
              ON c.id = cap.clinic_id
             AND c.deleted_at IS NULL
            LEFT JOIN clickup_connection cc
              ON cc.id = m.connection_id
            WHERE m.clinic_id = ?
              AND ${where}
            LIMIT 1`;
  }
}

export const clickUpService = new ClickUpService();

