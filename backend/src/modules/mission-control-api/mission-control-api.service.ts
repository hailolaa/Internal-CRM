import pool, { getDatabaseHealth } from "../../config/database.js";
import { config } from "../../config/index.js";
import { userCanManageAllClientAccounts } from "../../middleware/authorize.js";
import { getReleaseInfo } from "../../utils/releaseInfo.js";
import { ApiError } from "../../utils/ApiError.js";
import type {
  MissionControlProvenance,
  MissionControlRecordType,
  MissionControlSearchQuery,
  MissionControlSearchResponse,
  MissionControlSearchResult,
  MissionControlUserContext,
} from "./mission-control-api.types.js";

const supportedTypes: MissionControlRecordType[] = [
  "contact",
  "client_account",
  "proposal",
  "task",
  "opportunity",
  "communication",
  "finance",
  "marketing",
  "management",
];

const tools = [
  {
    name: "search",
    title: "Search Mission Control",
    description:
      "Search tenant-scoped Mission Control client, sales, delivery, communications, finance, marketing and management records.",
    supportedRecordTypes: supportedTypes,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Optional search text.", maxLength: 120 },
        types: {
          type: "array",
          description: "Optional record type filter.",
          items: { type: "string", enum: supportedTypes },
        },
        limit: { type: "integer", minimum: 1, maximum: 25, default: 10 },
        cursor: { type: "string", description: "Optional cursor returned by a previous search page." },
      },
    },
    readOnlyHint: true,
    destructiveHint: false,
  },
  {
    name: "fetch",
    title: "Fetch Mission Control record",
    description: "Fetch one tenant-scoped Mission Control record by type and stable ID.",
    supportedRecordTypes: supportedTypes,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["type", "id"],
      properties: {
        type: { type: "string", enum: supportedTypes },
        id: { type: "string", minLength: 1, maxLength: 128 },
      },
    },
    readOnlyHint: true,
    destructiveHint: false,
  },
];

function iso(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function cleanQuery(value?: string) {
  return String(value || "").trim().slice(0, 120);
}

function cleanLimit(value?: number) {
  const parsed = Number(value || 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(Math.max(Math.floor(parsed), 1), 25);
}

function cleanOffset(cursor?: string | null) {
  if (!cursor) return 0;
  const parsed = Number.parseInt(cursor, 10);
  if (!Number.isFinite(parsed) || parsed < 0) throw ApiError.badRequest("Invalid cursor");
  return parsed;
}

function cleanTypes(types?: MissionControlRecordType[]) {
  if (!types || types.length === 0) return supportedTypes;
  const unknown = types.filter((type) => !supportedTypes.includes(type));
  if (unknown.length > 0) throw ApiError.badRequest(`Unsupported search type: ${unknown.join(", ")}`);
  return Array.from(new Set(types));
}

function like(query: string) {
  return `%${query.replace(/[%_]/g, "\\$&")}%`;
}

function normalizeDataState(value: unknown): MissionControlProvenance["dataState"] {
  const normal = String(value || "live").trim().toLowerCase().replace(/-/g, "_");
  if (normal === "live_read_only") return "live";
  if (
    normal === "live" ||
    normal === "cached" ||
    normal === "manual" ||
    normal === "estimated" ||
    normal === "calculated" ||
    normal === "demo" ||
    normal === "preview" ||
    normal === "partial" ||
    normal === "provider_dependent" ||
    normal === "roadmap" ||
    normal === "unknown" ||
    normal === "not_applicable"
  ) {
    return normal;
  }
  return "unknown";
}

function provenance(input: {
  id?: string;
  url?: string;
  updatedAt?: unknown;
  dataState?: MissionControlProvenance["dataState"];
  source?: MissionControlProvenance["source"];
} = {}): MissionControlProvenance {
  const output: MissionControlProvenance = {
    source: input.source || "mission_control_database",
    lastSourceUpdate: iso(input.updatedAt),
    lastSyncAt: null,
    dataState: input.dataState || "live",
  };
  if (input.id) output.recordId = input.id;
  if (input.url) output.recordUrl = input.url;
  return output;
}

function result(row: {
  id: string;
  type: MissionControlRecordType;
  title: string;
  summary?: string | null;
  url: string;
  updatedAt?: unknown;
  dataState?: MissionControlProvenance["dataState"];
  metadata?: Record<string, unknown>;
}): MissionControlSearchResult {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    summary: row.summary || "",
    url: row.url,
    sourceId: row.id,
    provenance: provenance({
      id: row.id,
      url: row.url,
      updatedAt: row.updatedAt,
      ...(row.dataState ? { dataState: row.dataState } : {}),
    }),
    metadata: row.metadata || {},
  };
}

export class MissionControlApiService {
  async getHealth() {
    const database = await getDatabaseHealth();
    return {
      ok: database.ok,
      service: "mission-control-api",
      apiVersion: "v1",
      environment: config.nodeEnv,
      database,
      capabilities: ["health", "version", "capabilities", "search", "fetch", "mcp_search", "mcp_fetch"],
      provenance: provenance({ source: "runtime_config", dataState: "not_applicable" }),
    };
  }

  getVersion() {
    return {
      service: "mission-control-api",
      apiVersion: "v1",
      release: getReleaseInfo(),
      provenance: provenance({ source: "runtime_config", dataState: "not_applicable" }),
    };
  }

  getCapabilities() {
    return {
      apiVersion: "v1",
      endpoints: [
        { method: "GET", path: "/api/openapi.json", scope: "public_documentation" },
        { method: "GET", path: "/api/v1/health", scope: "mission_control_api:read" },
        { method: "GET", path: "/api/v1/version", scope: "mission_control_api:read" },
        { method: "GET", path: "/api/v1/capabilities", scope: "mission_control_api:read" },
        { method: "GET", path: "/api/v1/search", scope: "mission_control_api:read" },
        { method: "GET", path: "/api/v1/records/:type/:id", scope: "mission_control_api:read" },
        { method: "POST", path: "/mcp", scope: "mission_control_mcp:read" },
      ],
      recordTypes: supportedTypes,
      tools,
      writePolicy: {
        currentPhase: "read_only",
        externalActionsEnabled: false,
        controlledWritesEnabled: false,
      },
      provenance: provenance({ source: "runtime_config", dataState: "not_applicable" }),
    };
  }

  async search(user: MissionControlUserContext, query: MissionControlSearchQuery): Promise<MissionControlSearchResponse> {
    const q = cleanQuery(query.query);
    const limit = cleanLimit(query.limit);
    const offset = cleanOffset(query.cursor);
    const types = cleanTypes(query.types);
    const perTypeLimit = Math.min(limit + offset + 1, 50);
    const results: MissionControlSearchResult[] = [];

    for (const type of types) {
      results.push(...await this.searchType(user, type, q, perTypeLimit));
    }

    const page = results
      .sort((a, b) => String(b.provenance.lastSourceUpdate || "").localeCompare(String(a.provenance.lastSourceUpdate || "")))
      .slice(offset, offset + limit);

    return {
      results: page,
      page: {
        limit,
        cursor: offset > 0 ? String(offset) : null,
        nextCursor: results.length > offset + limit ? String(offset + limit) : null,
        returned: page.length,
      },
      provenance: provenance(),
    };
  }

  async fetchRecord(user: MissionControlUserContext, type: MissionControlRecordType, id: string) {
    cleanTypes([type]);
    const records = await this.searchType(user, type, "", 1, id);
    const record = records[0];
    if (!record) throw ApiError.notFound("Record not found");
    return record;
  }

  private async searchType(
    user: MissionControlUserContext,
    type: MissionControlRecordType,
    q: string,
    limit: number,
    id?: string,
  ): Promise<MissionControlSearchResult[]> {
    switch (type) {
      case "contact":
        return this.searchContacts(user, q, limit, id);
      case "client_account":
        return this.searchClientAccounts(user, q, limit, id);
      case "proposal":
        return this.searchProposals(user, q, limit, id);
      case "task":
        return this.searchTasks(user, q, limit, id);
      case "opportunity":
        return this.searchOpportunities(user, q, limit, id);
      case "communication":
        return this.searchCommunications(user, q, limit, id);
      case "finance":
        return this.searchFinance(user, q, limit, id);
      case "marketing":
        return this.searchMarketing(user, q, limit, id);
      case "management":
        return this.searchManagement(user, q, limit, id);
      default:
        throw ApiError.badRequest(`Unsupported search type: ${type}`);
    }
  }

  private async searchContacts(user: MissionControlUserContext, q: string, limit: number, id?: string) {
    const params = id
      ? [user.clinicId, id]
      : q
        ? [user.clinicId, like(q), like(q), like(q), like(q), like(q)]
        : [user.clinicId];
    const [rows]: any = await pool.execute(
      `SELECT id, first_name as firstName, last_name as lastName, account_name as accountName,
              email, phone, status, lead_status as leadStatus, source, updated_at as updatedAt
       FROM contact
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         ${id ? "AND id = ?" : ""}
         ${!id && q ? "AND (first_name LIKE ? OR last_name LIKE ? OR account_name LIKE ? OR email LIKE ? OR phone LIKE ?)" : ""}
       ORDER BY updated_at DESC, created_at DESC
       LIMIT ${limit}`,
      params,
    );
    return rows.map((row: any) => result({
      id: row.id,
      type: "contact",
      title: [row.firstName, row.lastName].filter(Boolean).join(" ") || row.accountName || row.email || "Contact",
      summary: [row.accountName, row.leadStatus, row.source].filter(Boolean).join(" | "),
      url: `/app/crm/contacts/detail?id=${row.id}`,
      updatedAt: row.updatedAt,
      metadata: { status: row.status, leadStatus: row.leadStatus, source: row.source },
    }));
  }

  private async searchClientAccounts(user: MissionControlUserContext, q: string, limit: number, id?: string) {
    const canManageAllClientAccounts = await userCanManageAllClientAccounts(user.userId, user.clinicId);
    const scopeFilter = canManageAllClientAccounts ? "" : "AND cap.clinic_id = ?";
    const params = id
      ? [id, ...(canManageAllClientAccounts ? [] : [user.clinicId])]
      : q
        ? [like(q), like(q), ...(canManageAllClientAccounts ? [] : [user.clinicId])]
        : [...(canManageAllClientAccounts ? [] : [user.clinicId])];
    const [rows]: any = await pool.execute(
      `SELECT cap.id, cap.clinic_id as clientClinicId, c.name, cap.client_status as clientStatus,
              cap.health_status as healthStatus, cap.current_package as currentPackage,
              c.data_state as dataState, cap.updated_at as updatedAt
       FROM client_account_profile cap
       INNER JOIN clinic c ON c.id = cap.clinic_id AND c.deleted_at IS NULL
       WHERE ${id ? "cap.id = ?" : q ? "(c.name LIKE ? OR cap.current_package LIKE ?)" : "1 = 1"}
         ${scopeFilter}
       ORDER BY cap.updated_at DESC
       LIMIT ${limit}`,
      params,
    );
    return rows.map((row: any) => result({
      id: row.id,
      type: "client_account",
      title: row.name || "Client account",
      summary: [row.clientStatus, row.healthStatus, row.currentPackage].filter(Boolean).join(" | "),
      url: `/app/ops/client-accounts/detail?id=${row.id}`,
      updatedAt: row.updatedAt,
      dataState: normalizeDataState(row.dataState),
      metadata: { clientClinicId: row.clientClinicId, clientStatus: row.clientStatus, healthStatus: row.healthStatus },
    }));
  }

  private async searchProposals(user: MissionControlUserContext, q: string, limit: number, id?: string) {
    const params = id ? [user.clinicId, id] : q ? [user.clinicId, like(q), like(q)] : [user.clinicId];
    const [rows]: any = await pool.execute(
      `SELECT id, proposal_name as proposalName, package_name as packageName, status, value, currency, updated_at as updatedAt
       FROM proposal
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         ${id ? "AND id = ?" : ""}
         ${!id && q ? "AND (proposal_name LIKE ? OR package_name LIKE ?)" : ""}
       ORDER BY updated_at DESC
       LIMIT ${limit}`,
      params,
    );
    return rows.map((row: any) => result({
      id: row.id,
      type: "proposal",
      title: row.proposalName,
      summary: [row.status, row.packageName, row.currency && row.value ? `${row.currency} ${row.value}` : null].filter(Boolean).join(" | "),
      url: `/app/crm/proposals/edit?id=${row.id}`,
      updatedAt: row.updatedAt,
      metadata: { status: row.status, packageName: row.packageName, value: row.value, currency: row.currency },
    }));
  }

  private async searchTasks(user: MissionControlUserContext, q: string, limit: number, id?: string) {
    const params = id ? [user.clinicId, id] : q ? [user.clinicId, like(q), like(q)] : [user.clinicId];
    const [rows]: any = await pool.execute(
      `SELECT id, title, status, priority, due_date as dueDate, board_key as boardKey, updated_at as updatedAt
       FROM task
       WHERE clinic_id = ?
         AND is_internal = 1
         AND deleted_at IS NULL
         AND archived_at IS NULL
         ${id ? "AND id = ?" : ""}
         ${!id && q ? "AND (title LIKE ? OR description LIKE ?)" : ""}
       ORDER BY updated_at DESC
       LIMIT ${limit}`,
      params,
    );
    return rows.map((row: any) => result({
      id: row.id,
      type: "task",
      title: row.title,
      summary: [row.status, row.priority, row.boardKey].filter(Boolean).join(" | "),
      url: `/app/crm/tasks?id=${row.id}`,
      updatedAt: row.updatedAt,
      metadata: { status: row.status, priority: row.priority, dueDate: iso(row.dueDate), boardKey: row.boardKey },
    }));
  }

  private async searchOpportunities(user: MissionControlUserContext, q: string, limit: number, id?: string) {
    const params = id ? [user.clinicId, id] : q ? [user.clinicId, like(q), like(q)] : [user.clinicId];
    const [rows]: any = await pool.execute(
      `SELECT id, title, stage, status, value, source, updated_at as updatedAt
       FROM deal
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         ${id ? "AND id = ?" : ""}
         ${!id && q ? "AND (title LIKE ? OR stage LIKE ?)" : ""}
       ORDER BY updated_at DESC
       LIMIT ${limit}`,
      params,
    );
    return rows.map((row: any) => result({
      id: row.id,
      type: "opportunity",
      title: row.title,
      summary: [row.stage, row.status, row.source].filter(Boolean).join(" | "),
      url: `/app/crm/pipeline?dealId=${row.id}`,
      updatedAt: row.updatedAt,
      metadata: { stage: row.stage, status: row.status, value: row.value, source: row.source },
    }));
  }

  private async searchCommunications(user: MissionControlUserContext, q: string, limit: number, id?: string) {
    const emailParams = id
      ? [user.clinicId, id]
      : q
        ? [user.clinicId, like(q), like(q), like(q), like(q)]
        : [user.clinicId];
    const [emailRows]: any = await pool.execute(
      `SELECT e.id, e.subject, e.direction, e.status, e.updated_at as updatedAt,
              c.id as contactId, c.first_name as firstName, c.last_name as lastName, c.account_name as accountName
       FROM email e
       INNER JOIN contact c ON c.id = e.contact_id AND c.deleted_at IS NULL
       WHERE e.clinic_id = ?
         AND e.deleted_at IS NULL
         ${id ? "AND e.id = ?" : ""}
         ${!id && q ? "AND (e.subject LIKE ? OR e.status LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)" : ""}
       ORDER BY e.updated_at DESC
       LIMIT ${limit}`,
      emailParams,
    );
    const emailResults = emailRows.map((row: any) => result({
      id: row.id,
      type: "communication",
      title: row.subject || "Email communication",
      summary: ["email", row.direction, row.status, [row.firstName, row.lastName].filter(Boolean).join(" ") || row.accountName].filter(Boolean).join(" | "),
      url: `/app/crm/contacts/detail?id=${row.contactId}`,
      updatedAt: row.updatedAt,
      metadata: { channel: "email", direction: row.direction, status: row.status, contactId: row.contactId },
    }));
    if (id && emailResults.length > 0) return emailResults;

    const smsParams = id
      ? [user.clinicId, id]
      : q
        ? [user.clinicId, like(q), like(q), like(q), like(q)]
        : [user.clinicId];
    const [smsRows]: any = await pool.execute(
      `SELECT s.id, s.direction, s.status, s.call_followup as callFollowup, s.updated_at as updatedAt,
              c.id as contactId, c.first_name as firstName, c.last_name as lastName, c.account_name as accountName
       FROM sms s
       INNER JOIN contact c ON c.id = s.contact_id AND c.deleted_at IS NULL
       WHERE s.clinic_id = ?
         AND s.deleted_at IS NULL
         ${id ? "AND s.id = ?" : ""}
         ${!id && q ? "AND (s.status LIKE ? OR s.direction LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)" : ""}
       ORDER BY s.updated_at DESC
       LIMIT ${limit}`,
      smsParams,
    );
    return [
      ...emailResults,
      ...smsRows.map((row: any) => result({
        id: row.id,
        type: "communication",
        title: row.callFollowup ? "Call follow-up SMS" : "SMS communication",
        summary: ["sms", row.direction, row.status, [row.firstName, row.lastName].filter(Boolean).join(" ") || row.accountName].filter(Boolean).join(" | "),
        url: `/app/crm/contacts/detail?id=${row.contactId}`,
        updatedAt: row.updatedAt,
        metadata: { channel: "sms", direction: row.direction, status: row.status, contactId: row.contactId, callFollowup: Boolean(row.callFollowup) },
      })),
    ];
  }

  private async searchFinance(user: MissionControlUserContext, q: string, limit: number, id?: string) {
    const params = id ? [user.clinicId, id] : q ? [user.clinicId, like(q), like(q), like(q)] : [user.clinicId];
    const [rows]: any = await pool.execute(
      `SELECT id, contact_id as contactId, contact_name as contactName, treatment, deposit_amount as depositAmount,
              payment_status as paymentStatus, status, updated_at as updatedAt
       FROM deposit_record
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         ${id ? "AND id = ?" : ""}
         ${!id && q ? "AND (contact_name LIKE ? OR treatment LIKE ? OR payment_status LIKE ?)" : ""}
       ORDER BY updated_at DESC
       LIMIT ${limit}`,
      params,
    );
    return rows.map((row: any) => result({
      id: row.id,
      type: "finance",
      title: row.contactName ? `Deposit record - ${row.contactName}` : "Deposit record",
      summary: [row.treatment, row.paymentStatus, row.status].filter(Boolean).join(" | "),
      url: row.contactId ? `/app/crm/contacts/detail?id=${row.contactId}` : "/app/reports",
      updatedAt: row.updatedAt,
      dataState: "manual",
      metadata: { contactId: row.contactId, treatment: row.treatment, paymentStatus: row.paymentStatus, status: row.status, depositAmount: row.depositAmount },
    }));
  }

  private async searchMarketing(user: MissionControlUserContext, q: string, limit: number, id?: string) {
    const params = id ? [user.clinicId, id] : q ? [user.clinicId, like(q), like(q), like(q), like(q)] : [user.clinicId];
    const [rows]: any = await pool.execute(
      `SELECT id, name, type, status, channel, budget, updated_at as updatedAt
       FROM campaign
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         ${id ? "AND id = ?" : ""}
         ${!id && q ? "AND (name LIKE ? OR type LIKE ? OR status LIKE ? OR channel LIKE ?)" : ""}
       ORDER BY updated_at DESC
       LIMIT ${limit}`,
      params,
    );
    return rows.map((row: any) => result({
      id: row.id,
      type: "marketing",
      title: row.name || "Campaign",
      summary: [row.type, row.status, row.channel].filter(Boolean).join(" | "),
      url: `/app/marketing/campaigns?id=${row.id}`,
      updatedAt: row.updatedAt,
      metadata: { type: row.type, status: row.status, channel: row.channel, budget: row.budget },
    }));
  }

  private async searchManagement(user: MissionControlUserContext, q: string, limit: number, id?: string) {
    const params = id ? [user.clinicId, id] : q ? [user.clinicId, like(q), like(q), like(q)] : [user.clinicId];
    const [rows]: any = await pool.execute(
      `SELECT id, client_account_profile_id as clientAccountProfileId, log_month as logMonth, log_type as logType,
              meeting_notes as meetingNotes, decisions, next_actions as nextActions, updated_at as updatedAt
       FROM strategy_log
       WHERE clinic_id = ?
         AND archived_at IS NULL
         ${id ? "AND id = ?" : ""}
         ${!id && q ? "AND (log_type LIKE ? OR meeting_notes LIKE ? OR decisions LIKE ?)" : ""}
       ORDER BY updated_at DESC
       LIMIT ${limit}`,
      params,
    );
    return rows.map((row: any) => result({
      id: row.id,
      type: "management",
      title: row.logType || "Strategy log",
      summary: [row.logMonth, row.nextActions ? "Next actions recorded" : null].filter(Boolean).join(" | "),
      url: row.clientAccountProfileId ? `/app/ops/client-accounts/detail?id=${row.clientAccountProfileId}` : "/app/ops/client-accounts",
      updatedAt: row.updatedAt,
      dataState: "manual",
      metadata: { clientAccountProfileId: row.clientAccountProfileId, logMonth: row.logMonth, logType: row.logType },
    }));
  }
}

export const missionControlApiService = new MissionControlApiService();
