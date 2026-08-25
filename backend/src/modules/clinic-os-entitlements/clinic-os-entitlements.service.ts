import { createHash, createHmac } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import type { ClinicOsAccessTier, ClinicOsEntitlementVersion, ClinicOsSettingsPush } from "./clinic-os-entitlements.types.js";

const PUSH_SLA_MINUTES = 15;
const ACCESS_TIERS: ClinicOsAccessTier[] = ["free_audit", "paid_diagnostic", "clinic_os"];

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeKey(value: unknown, field: string) {
  const cleaned = cleanString(value);
  if (!cleaned) throw ApiError.badRequest(`${field} is required.`);
  const normalized = cleaned.toLowerCase().replace(/[^a-z0-9._:-]+/g, "_").replace(/^_+|_+$/g, "");
  if (!normalized) throw ApiError.badRequest(`${field} is invalid.`);
  return normalized.slice(0, 160);
}

function pickAccessTier(value: unknown): ClinicOsAccessTier {
  const cleaned = cleanString(value) || "free_audit";
  if (!ACCESS_TIERS.includes(cleaned as ClinicOsAccessTier)) throw ApiError.badRequest(`Unsupported access tier: ${cleaned}.`);
  return cleaned as ClinicOsAccessTier;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function signPayload(payload: unknown, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  return {
    timestamp: String(timestamp),
    signature: `sha256=${createHmac("sha256", secret).update(`${timestamp}.${stableStringify(payload)}`).digest("hex")}`,
  };
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function iso(value: unknown) {
  return value ? new Date(value as string | number | Date).toISOString() : null;
}

function toVersion(row: any): ClinicOsEntitlementVersion {
  return {
    id: row.id,
    clinicId: row.clinicId,
    tenantKey: row.tenantKey,
    version: Number(row.version),
    status: row.status,
    accessTier: row.accessTier,
    growthScoreEnabled: Boolean(row.growthScoreEnabled),
    paidDiagnosticConfirmed: Boolean(row.paidDiagnosticConfirmed),
    sufficientDataConfirmed: Boolean(row.sufficientDataConfirmed),
    settings: parseJsonObject(row.settings),
    payloadHash: row.payloadHash,
    changedBy: row.changedBy,
    rollbackOfVersionId: row.rollbackOfVersionId || null,
    publishedAt: iso(row.publishedAt)!,
  };
}

function toPush(row: any): ClinicOsSettingsPush {
  return {
    id: row.id,
    clinicId: row.clinicId,
    entitlementVersionId: row.entitlementVersionId,
    tenantKey: row.tenantKey,
    status: row.status,
    payloadHash: row.payloadHash,
    slaDueAt: iso(row.slaDueAt)!,
    attemptCount: Number(row.attemptCount || 0),
    lastError: row.lastError || null,
  };
}

export class ClinicOsEntitlementsService {
  async publishSettings(input: {
    clinicId: string;
    tenantKey: string;
    accessTier: ClinicOsAccessTier;
    growthScoreRequested?: boolean;
    paidDiagnosticConfirmed?: boolean;
    sufficientDataConfirmed?: boolean;
    settings?: Record<string, unknown> | null;
    changedBy: string;
  }): Promise<{ version: ClinicOsEntitlementVersion; push: ClinicOsSettingsPush }> {
    await this.ensureClinicExists(input.clinicId);
    const tenantKey = normalizeKey(input.tenantKey, "tenantKey");
    const changedBy = cleanString(input.changedBy);
    if (!changedBy) throw ApiError.badRequest("changedBy is required.");
    const accessTier = pickAccessTier(input.accessTier);
    const paidDiagnosticConfirmed = Boolean(input.paidDiagnosticConfirmed);
    const sufficientDataConfirmed = Boolean(input.sufficientDataConfirmed);
    const growthScoreEnabled = Boolean(input.growthScoreRequested)
      && accessTier !== "free_audit"
      && paidDiagnosticConfirmed
      && sufficientDataConfirmed;
    const settings = this.normalizeSettings(input.settings || {}, {
      accessTier,
      growthScoreEnabled,
      paidDiagnosticConfirmed,
      sufficientDataConfirmed,
    });
    const nextVersion = await this.nextVersion(input.clinicId, tenantKey);
    const payloadHash = sha256(stableStringify({
      clinicId: input.clinicId,
      tenantKey,
      version: nextVersion,
      accessTier,
      growthScoreEnabled,
      paidDiagnosticConfirmed,
      sufficientDataConfirmed,
      settings,
    }));
    const versionId = uuidv4();
    const pushId = uuidv4();

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `UPDATE clinic_os_entitlement_version
         SET status = 'superseded'
         WHERE clinic_id = ? AND tenant_key = ? AND status = 'published'`,
        [input.clinicId, tenantKey],
      );
      await connection.execute(
        `UPDATE clinic_os_settings_push_outbox
         SET status = 'superseded'
         WHERE clinic_id = ? AND tenant_key = ? AND status IN ('pending','failed')`,
        [input.clinicId, tenantKey],
      );
      await connection.execute(
        `INSERT INTO clinic_os_entitlement_version
          (id, clinic_id, tenant_key, version, status, access_tier, growth_score_enabled,
           paid_diagnostic_confirmed, sufficient_data_confirmed, settings, payload_hash, changed_by)
         VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?)`,
        [
          versionId,
          input.clinicId,
          tenantKey,
          nextVersion,
          accessTier,
          growthScoreEnabled ? 1 : 0,
          paidDiagnosticConfirmed ? 1 : 0,
          sufficientDataConfirmed ? 1 : 0,
          JSON.stringify(settings),
          payloadHash,
          changedBy,
        ],
      );
      await connection.execute(
        `INSERT INTO clinic_os_settings_push_outbox
          (id, clinic_id, entitlement_version_id, tenant_key, status, payload_hash, sla_due_at)
         VALUES (?, ?, ?, ?, 'pending', ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE))`,
        [pushId, input.clinicId, versionId, tenantKey, payloadHash, PUSH_SLA_MINUTES],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return { version: await this.getVersionById(input.clinicId, versionId), push: await this.getPushByVersion(input.clinicId, versionId) };
  }

  async rollbackToVersion(input: { clinicId: string; tenantKey: string; version: number; changedBy: string }) {
    const tenantKey = normalizeKey(input.tenantKey, "tenantKey");
    const target = await this.getVersion(input.clinicId, tenantKey, input.version);
    const result = await this.publishSettings({
      clinicId: input.clinicId,
      tenantKey,
      accessTier: target.accessTier,
      growthScoreRequested: target.growthScoreEnabled,
      paidDiagnosticConfirmed: target.paidDiagnosticConfirmed,
      sufficientDataConfirmed: target.sufficientDataConfirmed,
      settings: target.settings,
      changedBy: input.changedBy,
    });
    await pool.execute(
      `UPDATE clinic_os_entitlement_version
       SET rollback_of_version_id = ?
       WHERE id = ? AND clinic_id = ?`,
      [target.id, result.version.id, input.clinicId],
    );
    return { version: await this.getVersionById(input.clinicId, result.version.id), push: result.push };
  }

  async listPendingPushes(limit = 50): Promise<ClinicOsSettingsPush[]> {
    const boundedLimit = Math.max(1, Math.min(Number(limit || 50), 200));
    const [rows]: any = await pool.query(
      `SELECT id, clinic_id as clinicId, entitlement_version_id as entitlementVersionId, tenant_key as tenantKey,
              status, payload_hash as payloadHash, sla_due_at as slaDueAt, attempt_count as attemptCount, last_error as lastError
       FROM clinic_os_settings_push_outbox
       WHERE status IN ('pending','failed')
       ORDER BY sla_due_at ASC, created_at ASC
       LIMIT ${boundedLimit}`,
    );
    return rows.map(toPush);
  }

  async markPushSent(clinicId: string, pushId: string): Promise<ClinicOsSettingsPush> {
    await pool.execute(
      `UPDATE clinic_os_settings_push_outbox
       SET status = 'sent', attempt_count = attempt_count + 1, last_error = NULL
       WHERE id = ? AND clinic_id = ? AND status IN ('pending','failed')`,
      [pushId, clinicId],
    );
    return this.getPushById(clinicId, pushId);
  }

  async markPushFailed(clinicId: string, pushId: string, errorMessage: string): Promise<ClinicOsSettingsPush> {
    await pool.execute(
      `UPDATE clinic_os_settings_push_outbox
       SET status = 'failed', attempt_count = attempt_count + 1, last_error = ?
       WHERE id = ? AND clinic_id = ? AND status IN ('pending','sent','failed')`,
      [(cleanString(errorMessage) || "Clinic OS settings push failed.").slice(0, 1000), pushId, clinicId],
    );
    return this.getPushById(clinicId, pushId);
  }

  async acknowledgePush(clinicId: string, pushId: string, payloadHash: string): Promise<ClinicOsSettingsPush> {
    const push = await this.getPushById(clinicId, pushId);
    if (push.payloadHash !== payloadHash) throw ApiError.badRequest("Clinic OS settings push acknowledgement payload hash does not match.");
    await pool.execute(
      `UPDATE clinic_os_settings_push_outbox
       SET status = 'acknowledged', last_error = NULL
       WHERE id = ? AND clinic_id = ? AND status IN ('pending','sent','failed')`,
      [pushId, clinicId],
    );
    return this.getPushById(clinicId, pushId);
  }

  async deliverPush(
    clinicId: string,
    pushId: string,
    fetcher: typeof fetch = fetch,
  ): Promise<ClinicOsSettingsPush> {
    const endpointUrl = config.clinicOsSettingsPush.endpointUrl.trim();
    const signingSecret = config.clinicOsSettingsPush.signingSecret.trim();
    if (!endpointUrl || !signingSecret) {
      return this.markPushFailed(clinicId, pushId, "Clinic OS settings push endpoint or signing secret is not configured.");
    }

    const push = await this.getPushById(clinicId, pushId);
    const version = await this.getVersionById(clinicId, push.entitlementVersionId);
    const payload = {
      id: push.id,
      clinicId: version.clinicId,
      tenantKey: version.tenantKey,
      entitlementVersionId: version.id,
      version: version.version,
      accessTier: version.accessTier,
      growthScoreEnabled: version.growthScoreEnabled,
      paidDiagnosticConfirmed: version.paidDiagnosticConfirmed,
      sufficientDataConfirmed: version.sufficientDataConfirmed,
      settings: version.settings,
      payloadHash: version.payloadHash,
    };
    const signed = signPayload(payload, signingSecret);

    try {
      const response = await fetcher(endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Mission-Control-Timestamp": signed.timestamp,
          "X-Mission-Control-Signature": signed.signature,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        return this.markPushFailed(clinicId, pushId, `Clinic OS settings push failed with status ${response.status}.`);
      }
      await this.markPushSent(clinicId, pushId);
      return this.acknowledgePush(clinicId, pushId, push.payloadHash);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Clinic OS settings push request failed.";
      return this.markPushFailed(clinicId, pushId, message);
    }
  }

  private normalizeSettings(
    settings: Record<string, unknown>,
    enforced: { accessTier: ClinicOsAccessTier; growthScoreEnabled: boolean; paidDiagnosticConfirmed: boolean; sufficientDataConfirmed: boolean },
  ) {
    const normalized = { ...settings };
    normalized.accessTier = enforced.accessTier;
    normalized.freeAuditMode = enforced.accessTier === "free_audit" ? "outside_in_no_login" : "disabled";
    normalized.growthScoreEnabled = enforced.growthScoreEnabled;
    normalized.paidDiagnosticConfirmed = enforced.paidDiagnosticConfirmed;
    normalized.sufficientDataConfirmed = enforced.sufficientDataConfirmed;
    return normalized;
  }

  private async nextVersion(clinicId: string, tenantKey: string) {
    const [rows]: any = await pool.execute(
      `SELECT COALESCE(MAX(version), 0) + 1 as nextVersion
       FROM clinic_os_entitlement_version
       WHERE clinic_id = ? AND tenant_key = ?`,
      [clinicId, tenantKey],
    );
    return Number(rows[0]?.nextVersion || 1);
  }

  private async getVersion(clinicId: string, tenantKey: string, version: number): Promise<ClinicOsEntitlementVersion> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, tenant_key as tenantKey, version, status,
              access_tier as accessTier, growth_score_enabled as growthScoreEnabled,
              paid_diagnostic_confirmed as paidDiagnosticConfirmed,
              sufficient_data_confirmed as sufficientDataConfirmed,
              settings, payload_hash as payloadHash, changed_by as changedBy,
              rollback_of_version_id as rollbackOfVersionId, published_at as publishedAt
       FROM clinic_os_entitlement_version
       WHERE clinic_id = ? AND tenant_key = ? AND version = ?
       LIMIT 1`,
      [clinicId, tenantKey, version],
    );
    if (!rows[0]) throw ApiError.notFound("Clinic OS entitlement version was not found.");
    return toVersion(rows[0]);
  }

  private async getVersionById(clinicId: string, versionId: string): Promise<ClinicOsEntitlementVersion> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, tenant_key as tenantKey, version, status,
              access_tier as accessTier, growth_score_enabled as growthScoreEnabled,
              paid_diagnostic_confirmed as paidDiagnosticConfirmed,
              sufficient_data_confirmed as sufficientDataConfirmed,
              settings, payload_hash as payloadHash, changed_by as changedBy,
              rollback_of_version_id as rollbackOfVersionId, published_at as publishedAt
       FROM clinic_os_entitlement_version
       WHERE clinic_id = ? AND id = ?
       LIMIT 1`,
      [clinicId, versionId],
    );
    if (!rows[0]) throw ApiError.notFound("Clinic OS entitlement version was not found.");
    return toVersion(rows[0]);
  }

  private async getPushByVersion(clinicId: string, versionId: string): Promise<ClinicOsSettingsPush> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, entitlement_version_id as entitlementVersionId,
              tenant_key as tenantKey, status, payload_hash as payloadHash, sla_due_at as slaDueAt,
              attempt_count as attemptCount, last_error as lastError
       FROM clinic_os_settings_push_outbox
       WHERE clinic_id = ? AND entitlement_version_id = ?
       LIMIT 1`,
      [clinicId, versionId],
    );
    if (!rows[0]) throw ApiError.notFound("Clinic OS settings push was not found.");
    return toPush(rows[0]);
  }

  private async getPushById(clinicId: string, pushId: string): Promise<ClinicOsSettingsPush> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, entitlement_version_id as entitlementVersionId,
              tenant_key as tenantKey, status, payload_hash as payloadHash, sla_due_at as slaDueAt,
              attempt_count as attemptCount, last_error as lastError
       FROM clinic_os_settings_push_outbox
       WHERE clinic_id = ? AND id = ?
       LIMIT 1`,
      [clinicId, pushId],
    );
    if (!rows[0]) throw ApiError.notFound("Clinic OS settings push was not found.");
    return toPush(rows[0]);
  }

  private async ensureClinicExists(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id FROM clinic WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Clinic was not found.");
  }
}

export const clinicOsEntitlementsService = new ClinicOsEntitlementsService();
