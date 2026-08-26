import { createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import type { PoolConnection } from "mysql2/promise";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import { insertAuditEvent } from "../../utils/audit.js";
import type {
  ClientOperatingRegisterFreshnessStatus,
  ClientOperatingRegisterImportDTO,
  ClientOperatingRegisterImportResponse,
  ClientOperatingRegisterIssue,
  ClientOperatingRegisterParsedRecord,
  ClientOperatingRegisterRecordKind,
  ClientOperatingRegisterRecordResponse,
  ClientOperatingRegisterSourceTask,
} from "./client-operating-register.types.js";

const DEFAULT_REGISTER_LIST_ID = "901220280295";
const CONFIRMATION_REQUIRED = "confirmation required";

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function normalizeMatchKey(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 255);
}

function isoFromClickUpDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  const date = Number.isFinite(numeric) && numeric > 1000000000 ? new Date(numeric) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sqlDateTime(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 19).replace("T", " ") : null;
}

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (Buffer.isBuffer(value)) return JSON.parse(value.toString("utf8"));
  if (typeof value === "string") return JSON.parse(value);
  return [];
}

function parseMarkdownFields(text: string) {
  const fields = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(/^\*\*([^:*]+):\*\*\s*(.+)$/) || line.match(/^([^:*]+):\s*(.+)$/);
    if (!match) continue;
    const fieldName = match[1];
    const fieldValue = match[2];
    if (!fieldName || !fieldValue) continue;
    fields.set(fieldName.trim().toLowerCase(), fieldValue.trim());
  }
  return fields;
}

function hasConfirmationRequired(value: string | null | undefined) {
  return Boolean(value && value.toLowerCase().includes(CONFIRMATION_REQUIRED));
}

function optionalConfirmed(value: string | null | undefined) {
  if (!value || hasConfirmationRequired(value)) return null;
  return value;
}

function splitList(value: string | null | undefined) {
  if (!value || hasConfirmationRequired(value)) return [];
  return value
    .split(/[;\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function taskStatus(value: ClientOperatingRegisterSourceTask["status"]) {
  if (!value) return null;
  if (typeof value === "string") return cleanString(value);
  return cleanString(value.status);
}

function classifyRecordKind(taskName: string): ClientOperatingRegisterRecordKind | null {
  const lower = taskName.toLowerCase();
  if (lower.startsWith("client record")) return "client";
  if (lower.startsWith("prospect record") || lower.startsWith("prospect control")) return "prospect";
  if (lower.startsWith("internal record")) return "internal";
  if (lower.startsWith("excluded record")) return "excluded";
  return null;
}

function stripRecordPrefix(taskName: string) {
  return taskName
    .replace(/^(client|prospect|internal|excluded)\s+record\s+(?:-|\u2013|\u2014)\s*/i, "")
    .replace(/^prospect\s+control\s+(?:-|\u2013|\u2014)\s*/i, "")
    .replace(/^(client|prospect|internal|excluded)\s+record\s+[—-]\s*/i, "")
    .replace(/^prospect\s+control\s+[—-]\s*/i, "")
    .trim();
}

function mapHealth(value: string | null) {
  const lower = String(value || "").toLowerCase();
  if (lower.includes("red") || lower.includes("critical")) return "critical";
  if (lower.includes("amber") || lower.includes("risk")) return "at_risk";
  if (lower.includes("green") || lower.includes("healthy")) return "healthy";
  return "attention_needed";
}

function mapClientStatus(record: ClientOperatingRegisterParsedRecord) {
  const lifecycle = String(record.lifecycleStatus || "").toLowerCase();
  if (record.recordKind === "excluded") return "inactive";
  if (record.recordKind === "internal") return "inactive";
  if (record.recordKind === "prospect" || lifecycle.includes("prospect") || lifecycle.includes("future")) return "prospect";
  if (lifecycle.includes("cancel") || lifecycle.includes("no delivery")) return "churned";
  if (lifecycle.includes("paused")) return "paused";
  if (lifecycle.includes("onboard")) return "onboarding";
  if (lifecycle.includes("active")) return "active";
  return "prospect";
}

function mapContractStatus(record: ClientOperatingRegisterParsedRecord) {
  const lifecycle = String(record.lifecycleStatus || "").toLowerCase();
  if (record.recordKind === "excluded") return "cancelled";
  if (lifecycle.includes("cancel") || lifecycle.includes("did not proceed")) return "cancelled";
  if (lifecycle.includes("paused")) return "paused";
  if (lifecycle.includes("trial")) return "trial";
  if (lifecycle.includes("active")) return "active";
  return "pending";
}

function freshnessFor(record: ClientOperatingRegisterParsedRecord): ClientOperatingRegisterFreshnessStatus {
  if (record.missingFields.length > 0) return "confirmation_required";
  if (record.recordKind === "excluded") return "verified";
  return "imported";
}

function parseRecord(task: ClientOperatingRegisterSourceTask): {
  record: ClientOperatingRegisterParsedRecord | null;
  issues: ClientOperatingRegisterIssue[];
  skipped: boolean;
} {
  const issues: ClientOperatingRegisterIssue[] = [];
  const sourceRecordId = cleanString(task.id);
  const name = cleanString(task.name);
  if (!sourceRecordId || !name) {
    issues.push({
      sourceRecordId,
      issueType: "missing_identity",
      severity: "error",
      message: "Register row is missing a source task ID or name.",
    });
    return { record: null, issues, skipped: false };
  }

  const recordKind = classifyRecordKind(name);
  if (!recordKind) return { record: null, issues: [], skipped: true };

  const canonicalName = stripRecordPrefix(name);
  if (!canonicalName) {
    issues.push({
      sourceRecordId,
      issueType: "missing_identity",
      severity: "error",
      fieldName: "canonicalName",
      message: "Register row is missing a canonical client/account name.",
    });
    return { record: null, issues, skipped: false };
  }

  const text = cleanString(task.markdown_description) || cleanString(task.text_content) || "";
  const fields = parseMarkdownFields(text);
  const commercialSummary = {
    feeVat: fields.get("fee + vat") || null,
    adSpend: fields.get("ad spend") || null,
    startNoticeEndRemainingPayments: fields.get("start / notice / end / remaining payments") || null,
    leadOutcomeStatus: fields.get("lead-outcome status") || null,
  };
  const operatingControls = {
    ragHealth: fields.get("rag health") || null,
    primaryContactPreferredChannel: fields.get("primary contact / preferred channel") || null,
    deliveryOwnersReviewer: fields.get("delivery owners / reviewer") || null,
    lastContact: fields.get("last contact") || null,
    nextContact: fields.get("next contact") || null,
    lastReport: fields.get("last report") || null,
    nextReport: fields.get("next report") || null,
    lastReview: fields.get("last review") || null,
    nextReview: fields.get("next review") || null,
  };
  const providerRefs = {
    websiteHostingDomainEmailTelephone: fields.get("website, hosting, domain, email and telephone services") || null,
    googleAdsMetaGa4GscGbpCrmCallIds: fields.get("google ads, meta, ga4, gsc, gbp, crm/call ids") || null,
  };
  const missingFields = [
    ...Object.entries(commercialSummary),
    ...Object.entries(operatingControls),
    ...Object.entries(providerRefs),
  ]
    .filter(([, value]) => hasConfirmationRequired(value))
    .map(([key]) => key);
  const evidenceSummary = fields.get("evidence/source") || null;
  const verifiedAt = /11 august 2026/i.test(text) ? "2026-08-11T00:00:00.000Z" : null;
  const record: ClientOperatingRegisterParsedRecord = {
    sourceRecordId,
    sourceRecordUrl: cleanString(task.url),
    sourceStatus: taskStatus(task.status),
    sourceUpdatedAt: isoFromClickUpDate(task.date_updated),
    recordKind,
    canonicalName,
    canonicalMatchKey: normalizeMatchKey(canonicalName),
    legalName: optionalConfirmed(fields.get("legal entity") || fields.get("legal name")),
    tradingName: optionalConfirmed(fields.get("trading name")),
    businessBrand: optionalConfirmed(fields.get("business/brand")),
    lifecycleStatus: fields.get("lifecycle status") || null,
    packageName: optionalConfirmed(fields.get("package")),
    servicesIncluded: splitList(fields.get("services included")),
    commercialSummary,
    operatingControls,
    providerRefs,
    vaultRefs: splitList(fields.get("vault references") || fields.get("vault-reference only")),
    missingFields,
    riskSummary: fields.get("risks / approvals / promised work") || null,
    nextAction: fields.get("next action/deadline") || null,
    evidenceSummary,
    invoiceTruthSource: Object.values(commercialSummary).some((value) => hasConfirmationRequired(value))
      ? "confirmation_required"
      : recordKind === "excluded"
        ? "none"
        : "accounting",
    dataState: missingFields.length > 0 ? "partial" : "manual",
    freshnessStatus: "confirmation_required",
    verifiedBy: evidenceSummary ? "Max/Michael register evidence" : null,
    verifiedAt,
    sourcePayload: {
      id: task.id,
      name: task.name,
      text_content: task.text_content,
      markdown_description: task.markdown_description,
      url: task.url,
      status: task.status,
      date_updated: task.date_updated,
      archived: task.archived,
      custom_fields: task.custom_fields || [],
    },
    payloadHash: "",
  };
  record.freshnessStatus = freshnessFor(record);
  record.payloadHash = sha256(record.sourcePayload);
  if (record.missingFields.length > 0) {
    issues.push({
      sourceRecordId,
      issueType: "confirmation_required",
      severity: "warning",
      fieldName: "missingFields",
      message: `Register row has confirmation-required fields: ${record.missingFields.join(", ")}.`,
    });
  }
  return { record, issues, skipped: false };
}

function mapRecordRow(row: any): ClientOperatingRegisterRecordResponse {
  return {
    id: row.id,
    clinicId: row.clinicId,
    clientAccountProfileId: row.clientAccountProfileId,
    sourceSystem: row.sourceSystem,
    sourceListId: row.sourceListId,
    sourceRecordId: row.sourceRecordId,
    sourceRecordUrl: row.sourceRecordUrl,
    sourceStatus: row.sourceStatus,
    recordKind: row.recordKind,
    canonicalName: row.canonicalName,
    canonicalMatchKey: row.canonicalMatchKey,
    businessBrand: row.businessBrand,
    lifecycleStatus: row.lifecycleStatus,
    packageName: row.packageName,
    servicesIncluded: parseJsonArray(row.servicesIncluded),
    invoiceTruthSource: row.invoiceTruthSource,
    dataState: row.dataState,
    freshnessStatus: row.freshnessStatus,
    missingFields: parseJsonArray(row.missingFields),
    riskSummary: row.riskSummary,
    nextAction: row.nextAction,
    evidenceSummary: row.evidenceSummary,
    sourceUpdatedAt: row.sourceUpdatedAt ? new Date(row.sourceUpdatedAt).toISOString() : null,
    lastSeenAt: new Date(row.lastSeenAt).toISOString(),
    missingFromSourceAt: row.missingFromSourceAt ? new Date(row.missingFromSourceAt).toISOString() : null,
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export class ClientOperatingRegisterService {
  parseSourceRecords(records: ClientOperatingRegisterSourceTask[]) {
    const parsed: ClientOperatingRegisterParsedRecord[] = [];
    const issues: ClientOperatingRegisterIssue[] = [];
    let skipped = 0;
    const seenSourceIds = new Set<string>();
    const seenMatchKeys = new Set<string>();

    for (const source of records) {
      const result = parseRecord(source);
      issues.push(...result.issues);
      if (result.skipped) {
        skipped += 1;
        continue;
      }
      if (!result.record) continue;
      if (seenSourceIds.has(result.record.sourceRecordId)) {
        issues.push({
          sourceRecordId: result.record.sourceRecordId,
          issueType: "duplicate_input",
          severity: "error",
          message: "Duplicate source task ID in the same import payload.",
        });
        continue;
      }
      if (seenMatchKeys.has(result.record.canonicalMatchKey)) {
        issues.push({
          sourceRecordId: result.record.sourceRecordId,
          issueType: "duplicate_input",
          severity: "error",
          fieldName: "canonicalMatchKey",
          message: "Duplicate canonical client/account match key in the same import payload.",
          sourceValue: result.record.canonicalName,
        });
        continue;
      }
      seenSourceIds.add(result.record.sourceRecordId);
      seenMatchKeys.add(result.record.canonicalMatchKey);
      parsed.push(result.record);
    }

    return { parsed, issues, skipped };
  }

  async listRecords(clinicId: string): Promise<ClientOperatingRegisterRecordResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, client_account_profile_id as clientAccountProfileId,
              source_system as sourceSystem, source_list_id as sourceListId,
              source_record_id as sourceRecordId, source_record_url as sourceRecordUrl,
              source_status as sourceStatus, record_kind as recordKind, canonical_name as canonicalName,
              canonical_match_key as canonicalMatchKey, business_brand as businessBrand,
              lifecycle_status as lifecycleStatus, package_name as packageName,
              services_included as servicesIncluded, invoice_truth_source as invoiceTruthSource,
              data_state as dataState, freshness_status as freshnessStatus, missing_fields as missingFields,
              risk_summary as riskSummary, next_action as nextAction, evidence_summary as evidenceSummary,
              source_updated_at as sourceUpdatedAt, last_seen_at as lastSeenAt,
              missing_from_source_at as missingFromSourceAt, updated_at as updatedAt
       FROM client_operating_register_record
       WHERE clinic_id = ?
       ORDER BY record_kind, canonical_name`,
      [clinicId],
    );
    return rows.map(mapRecordRow);
  }

  async importRecords(
    clinicId: string,
    userId: string,
    input: ClientOperatingRegisterImportDTO,
  ): Promise<ClientOperatingRegisterImportResponse> {
    const sourceSystem = input.sourceSystem || "clickup";
    const sourceListId = cleanString(input.sourceListId) || DEFAULT_REGISTER_LIST_ID;
    const mode = input.dryRun === false ? "apply" : "dry_run";
    const { parsed, issues, skipped } = this.parseSourceRecords(input.records || []);
    const runId = uuidv4();
    const counts = {
      input: input.records?.length || 0,
      parsed: parsed.length,
      skipped,
      created: 0,
      updated: 0,
      unchanged: 0,
      profilesCreated: 0,
      profilesLinked: 0,
      markedMissing: 0,
      issues: issues.length,
      errors: issues.filter((issue) => issue.severity === "error").length,
    };
    const sourceHash = sha256({ sourceSystem, sourceListId, sourceVersion: input.sourceVersion || null, parsed });

    if (counts.errors > 0 && mode === "apply") {
      throw ApiError.badRequest("Client operating register import has blocking validation errors");
    }

    if (mode === "dry_run") {
      return {
        runId,
        mode,
        status: issues.length > 0 ? "completed_with_issues" : "completed",
        counts,
        issues,
      };
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `INSERT INTO client_operating_register_import_run
          (id, clinic_id, source_system, source_list_id, source_version, source_hash, mode, status, counts, started_by)
         VALUES (?, ?, ?, ?, ?, ?, 'apply', 'running', ?, ?)`,
        [runId, clinicId, sourceSystem, sourceListId, cleanString(input.sourceVersion), sourceHash, JSON.stringify(counts), userId],
      );

      for (const record of parsed) {
        const result = await this.applyRecord(connection, clinicId, userId, runId, sourceSystem, sourceListId, record);
        counts.created += result.created ? 1 : 0;
        counts.updated += result.updated ? 1 : 0;
        counts.unchanged += result.unchanged ? 1 : 0;
        counts.profilesCreated += result.profileCreated ? 1 : 0;
        counts.profilesLinked += result.profileLinked ? 1 : 0;
        if (result.issue) issues.push(result.issue);
      }

      if (input.markMissingSource) {
        const presentIds = parsed.map((record) => record.sourceRecordId);
        counts.markedMissing = await this.markMissingSourceRecords(
          connection,
          clinicId,
          userId,
          runId,
          sourceSystem,
          sourceListId,
          presentIds,
          issues,
        );
      }

      counts.issues = issues.length;
      counts.errors = issues.filter((issue) => issue.severity === "error").length;
      await this.insertIssues(connection, runId, clinicId, issues);
      await connection.execute(
        `UPDATE client_operating_register_import_run
         SET status = ?, counts = ?, finished_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [issues.length > 0 ? "completed_with_issues" : "completed", JSON.stringify(counts), runId],
      );
      await insertAuditEvent(connection, {
        clinicId,
        userId,
        entityType: "client_operating_register_import_run",
        entityId: runId,
        action: "import_apply",
        changes: { sourceSystem, sourceListId, counts },
      });
      await connection.commit();
      return {
        runId,
        mode,
        status: issues.length > 0 ? "completed_with_issues" : "completed",
        counts,
        issues,
      };
    } catch (error: any) {
      await connection.rollback();
      await connection.execute(
        `INSERT INTO client_operating_register_import_run
          (id, clinic_id, source_system, source_list_id, source_version, source_hash, mode, status, counts, started_by, finished_at, error_message)
         VALUES (?, ?, ?, ?, ?, ?, 'apply', 'failed', ?, ?, CURRENT_TIMESTAMP, ?)
         ON DUPLICATE KEY UPDATE status = 'failed', error_message = VALUES(error_message), finished_at = CURRENT_TIMESTAMP`,
        [
          runId,
          clinicId,
          sourceSystem,
          sourceListId,
          cleanString(input.sourceVersion),
          sourceHash,
          JSON.stringify(counts),
          userId,
          String(error?.message || error).slice(0, 1000),
        ],
      );
      throw error;
    } finally {
      connection.release();
    }
  }

  private async applyRecord(
    connection: PoolConnection,
    clinicId: string,
    userId: string,
    runId: string,
    sourceSystem: string,
    sourceListId: string | null,
    record: ClientOperatingRegisterParsedRecord,
  ) {
    const [existingBySource]: any = await connection.execute(
      `SELECT id, client_account_profile_id as clientAccountProfileId, payload_hash as payloadHash,
              missing_from_source_at as missingFromSourceAt,
              canonical_match_key as canonicalMatchKey, canonical_name as canonicalName
       FROM client_operating_register_record
       WHERE clinic_id = ? AND source_system = ? AND source_record_id = ?
       LIMIT 1`,
      [clinicId, sourceSystem, record.sourceRecordId],
    );
    const [existingByMatch]: any = await connection.execute(
      `SELECT id, source_record_id as sourceRecordId, client_account_profile_id as clientAccountProfileId,
              missing_from_source_at as missingFromSourceAt, payload_hash as payloadHash
       FROM client_operating_register_record
       WHERE clinic_id = ? AND canonical_match_key = ?
       LIMIT 1`,
      [clinicId, record.canonicalMatchKey],
    );
    const sourceRow = existingBySource[0];
    const matchRow = existingByMatch[0];
    if (matchRow && sourceRow && matchRow.id !== sourceRow.id) {
      return {
        created: false,
        updated: false,
        unchanged: false,
        profileCreated: false,
        profileLinked: false,
        issue: {
          sourceRecordId: record.sourceRecordId,
          issueType: "conflict",
          severity: "error",
          fieldName: "canonicalMatchKey",
          message: "Source task maps to a canonical name already owned by another register row.",
          sourceValue: record.canonicalName,
          existingValue: matchRow.sourceRecordId,
        } satisfies ClientOperatingRegisterIssue,
      };
    }

    const existing = sourceRow || matchRow || null;
    const profileResult = await this.resolveOrCreateProfile(connection, clinicId, userId, record, existing?.clientAccountProfileId || null);
    const recordId = existing?.id || uuidv4();
    const values = [
      recordId,
      clinicId,
      profileResult.profileId,
      sourceSystem,
      sourceListId,
      record.sourceRecordId,
      record.sourceRecordUrl,
      record.sourceStatus,
      sqlDateTime(record.sourceUpdatedAt),
      record.recordKind,
      record.canonicalName,
      record.canonicalMatchKey,
      record.legalName,
      record.tradingName,
      record.businessBrand,
      record.lifecycleStatus,
      record.packageName,
      JSON.stringify(record.servicesIncluded),
      JSON.stringify(record.commercialSummary),
      JSON.stringify(record.operatingControls),
      JSON.stringify(record.providerRefs),
      JSON.stringify(record.vaultRefs),
      JSON.stringify(record.missingFields),
      record.riskSummary,
      record.nextAction,
      record.evidenceSummary,
      record.invoiceTruthSource,
      record.dataState,
      record.freshnessStatus,
      record.verifiedBy,
      sqlDateTime(record.verifiedAt),
      JSON.stringify(record.sourcePayload),
      record.payloadHash,
      userId,
      userId,
    ];

    if (existing) {
      await connection.execute(
        `UPDATE client_operating_register_record
         SET client_account_profile_id = ?, source_list_id = ?, source_record_url = ?,
             source_status = ?, source_updated_at = ?, record_kind = ?, canonical_name = ?,
             canonical_match_key = ?, legal_name = ?, trading_name = ?, business_brand = ?,
             lifecycle_status = ?, package_name = ?, services_included = ?,
             commercial_summary = ?, operating_controls = ?,
             provider_refs = ?, vault_refs = ?,
             missing_fields = ?, risk_summary = ?, next_action = ?,
             evidence_summary = ?, invoice_truth_source = ?, data_state = ?,
             freshness_status = ?, verified_by = ?, verified_at = ?,
             source_payload = ?, payload_hash = ?, last_seen_at = CURRENT_TIMESTAMP,
             missing_from_source_at = NULL, updated_by = ?
         WHERE id = ?`,
        [
          profileResult.profileId,
          sourceListId,
          record.sourceRecordUrl,
          record.sourceStatus,
          sqlDateTime(record.sourceUpdatedAt),
          record.recordKind,
          record.canonicalName,
          record.canonicalMatchKey,
          record.legalName,
          record.tradingName,
          record.businessBrand,
          record.lifecycleStatus,
          record.packageName,
          JSON.stringify(record.servicesIncluded),
          JSON.stringify(record.commercialSummary),
          JSON.stringify(record.operatingControls),
          JSON.stringify(record.providerRefs),
          JSON.stringify(record.vaultRefs),
          JSON.stringify(record.missingFields),
          record.riskSummary,
          record.nextAction,
          record.evidenceSummary,
          record.invoiceTruthSource,
          record.dataState,
          record.freshnessStatus,
          record.verifiedBy,
          sqlDateTime(record.verifiedAt),
          JSON.stringify(record.sourcePayload),
          record.payloadHash,
          userId,
          recordId,
        ],
      );
    } else {
      await connection.execute(
        `INSERT INTO client_operating_register_record
          (id, clinic_id, client_account_profile_id, source_system, source_list_id,
           source_record_id, source_record_url, source_status, source_updated_at,
           record_kind, canonical_name, canonical_match_key, legal_name, trading_name,
           business_brand, lifecycle_status, package_name, services_included,
           commercial_summary, operating_controls, provider_refs, vault_refs,
           missing_fields, risk_summary, next_action, evidence_summary,
           invoice_truth_source, data_state, freshness_status, verified_by, verified_at,
           source_payload, payload_hash, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values,
      );
    }

    await this.updateProfileFromRegister(connection, userId, record, profileResult.profileId);
    if (!existing) {
      await this.insertHistory(connection, clinicId, recordId, runId, "created", "payload_hash", null, record.payloadHash, userId);
    } else if (existing.payloadHash !== record.payloadHash) {
      await this.insertHistory(
        connection,
        clinicId,
        recordId,
        runId,
        existing.missingFromSourceAt ? "restored_from_source" : "updated",
        "payload_hash",
        existing.payloadHash || null,
        record.payloadHash,
        userId,
      );
    }
    if (profileResult.profileLinked) {
      await this.insertHistory(connection, clinicId, recordId, runId, "linked_profile", "client_account_profile_id", null, profileResult.profileId, userId);
    }

    return {
      created: !existing,
      updated: Boolean(existing && existing.payloadHash !== record.payloadHash),
      unchanged: Boolean(existing && existing.payloadHash === record.payloadHash),
      profileCreated: profileResult.profileCreated,
      profileLinked: profileResult.profileLinked,
      issue: null,
    };
  }

  private async resolveOrCreateProfile(
    connection: PoolConnection,
    clinicId: string,
    userId: string,
    record: ClientOperatingRegisterParsedRecord,
    existingProfileId: string | null,
  ) {
    if (existingProfileId) {
      return { profileId: existingProfileId, profileCreated: false, profileLinked: false };
    }

    const [clinicRows]: any = await connection.execute(
      `SELECT cap.id as profileId
       FROM client_account_profile cap
       INNER JOIN clinic c ON c.id = cap.clinic_id AND c.deleted_at IS NULL
       WHERE LOWER(c.name) = LOWER(?)
       LIMIT 2`,
      [record.canonicalName],
    );
    if (clinicRows.length === 1) {
      return { profileId: clinicRows[0].profileId, profileCreated: false, profileLinked: true };
    }
    if (clinicRows.length > 1) {
      throw ApiError.badRequest(`Multiple existing client accounts match ${record.canonicalName}`);
    }

    const clientClinicId = uuidv4();
    const profileId = uuidv4();
    await connection.execute(
      `INSERT INTO clinic
        (id, name, email, subscription_plan, subscription_status, data_state, data_state_label, max_users)
       VALUES (?, ?, ?, 'professional', 'active', ?, ?, 5)`,
      [
        clientClinicId,
        record.canonicalName,
        `${record.canonicalMatchKey || clientClinicId}@client-operating-register.local`,
        "live",
        `Imported from client operating register (${record.dataState})`,
      ],
    );
    await connection.execute(
      `INSERT INTO client_account_profile
        (id, clinic_id, active_services, client_status, health_status, current_package,
         churn_risk, contract_status, key_notes, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        profileId,
        clientClinicId,
        JSON.stringify(record.servicesIncluded),
        mapClientStatus(record),
        mapHealth(record.operatingControls.ragHealth || record.riskSummary),
        record.packageName,
        record.recordKind === "excluded" ? "low" : "medium",
        mapContractStatus(record),
        this.profileNotes(record),
        userId,
        userId,
      ],
    );
    return { profileId, profileCreated: true, profileLinked: true };
  }

  private profileNotes(record: ClientOperatingRegisterParsedRecord) {
    return [
      "Imported from the ClickUp Client Operating Register.",
      record.lifecycleStatus ? `Lifecycle: ${record.lifecycleStatus}` : null,
      record.nextAction ? `Next action: ${record.nextAction}` : null,
      record.riskSummary ? `Risk: ${record.riskSummary}` : null,
      "Invoice/payment truth remains with accounting; register commercial values are provenance only unless separately verified.",
    ].filter(Boolean).join("\n");
  }

  private async updateProfileFromRegister(
    connection: PoolConnection,
    userId: string,
    record: ClientOperatingRegisterParsedRecord,
    profileId: string,
  ) {
    await connection.execute(
      `UPDATE client_account_profile
       SET active_services = ?,
           client_status = ?,
           health_status = ?,
           current_package = COALESCE(?, current_package),
           contract_status = ?,
           key_notes = ?,
           updated_by = ?
       WHERE id = ?`,
      [
        JSON.stringify(record.servicesIncluded),
        mapClientStatus(record),
        mapHealth(record.operatingControls.ragHealth || record.riskSummary),
        record.packageName,
        mapContractStatus(record),
        this.profileNotes(record),
        userId,
        profileId,
      ],
    );
  }

  private async markMissingSourceRecords(
    connection: PoolConnection,
    clinicId: string,
    userId: string,
    runId: string,
    sourceSystem: string,
    sourceListId: string | null,
    presentSourceIds: string[],
    issues: ClientOperatingRegisterIssue[],
  ) {
    const params = [clinicId, sourceSystem, sourceListId];
    const exclusion = presentSourceIds.length ? `AND source_record_id NOT IN (${presentSourceIds.map(() => "?").join(",")})` : "";
    const [rows]: any = await connection.execute(
      `SELECT id, source_record_id as sourceRecordId, canonical_name as canonicalName
       FROM client_operating_register_record
       WHERE clinic_id = ? AND source_system = ? AND source_list_id <=> ?
         AND missing_from_source_at IS NULL
         ${exclusion}`,
      [...params, ...presentSourceIds],
    );
    for (const row of rows) {
      await connection.execute(
        `UPDATE client_operating_register_record
         SET freshness_status = 'missing_from_source', missing_from_source_at = CURRENT_TIMESTAMP, updated_by = ?
         WHERE id = ?`,
        [userId, row.id],
      );
      await this.insertHistory(connection, clinicId, row.id, runId, "marked_missing", "missing_from_source_at", null, "CURRENT_TIMESTAMP", userId);
      issues.push({
        sourceRecordId: row.sourceRecordId,
        recordId: row.id,
        issueType: "source_missing",
        severity: "warning",
        message: `${row.canonicalName} was present in a prior register import but is missing from this source payload. Existing data was preserved.`,
      });
    }
    return rows.length;
  }

  private async insertIssues(
    connection: PoolConnection,
    runId: string,
    clinicId: string,
    issues: ClientOperatingRegisterIssue[],
  ) {
    for (const issue of issues) {
      await connection.execute(
        `INSERT INTO client_operating_register_import_issue
          (id, run_id, clinic_id, source_record_id, client_operating_register_record_id,
           issue_type, severity, field_name, message, source_value, existing_value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          runId,
          clinicId,
          issue.sourceRecordId,
          issue.recordId || null,
          issue.issueType,
          issue.severity,
          issue.fieldName || null,
          issue.message,
          issue.sourceValue || null,
          issue.existingValue || null,
        ],
      );
    }
  }

  private async insertHistory(
    connection: PoolConnection,
    clinicId: string,
    recordId: string,
    runId: string,
    changeType: string,
    fieldName: string | null,
    previousValue: string | null,
    newValue: string | null,
    userId: string,
  ) {
    await connection.execute(
      `INSERT INTO client_operating_register_audit_history
        (id, clinic_id, client_operating_register_record_id, run_id, change_type,
         field_name, previous_value, new_value, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), clinicId, recordId, runId, changeType, fieldName, previousValue, newValue, userId],
    );
  }
}

export const clientOperatingRegisterService = new ClientOperatingRegisterService();
