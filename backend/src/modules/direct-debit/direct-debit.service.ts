import { createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import type {
  DirectDebitAlert,
  DirectDebitAlertType,
  DirectDebitMandate,
  DirectDebitMandateStatus,
  DirectDebitProvider,
  DirectDebitReconciliationResult,
} from "./direct-debit.types.js";

const PROVIDERS: DirectDebitProvider[] = ["gocardless", "stripe", "manual"];
const STATUSES: DirectDebitMandateStatus[] = ["setup_required", "pending_customer_authorisation", "submitted", "active", "failed", "cancelled", "expired"];
const FAILURE_STATUSES = new Set<DirectDebitMandateStatus>(["failed", "cancelled", "expired"]);
const ALLOWED_STATUS_TRANSITIONS: Record<DirectDebitMandateStatus, ReadonlySet<DirectDebitMandateStatus>> = {
  setup_required: new Set(["pending_customer_authorisation", "submitted", "active", "failed", "cancelled", "expired"]),
  pending_customer_authorisation: new Set(["submitted", "active", "failed", "cancelled", "expired"]),
  submitted: new Set(["active", "failed", "cancelled", "expired"]),
  active: new Set(["failed", "cancelled", "expired"]),
  failed: new Set(["active", "cancelled", "expired"]),
  cancelled: new Set(),
  expired: new Set(),
};

function shouldApplyStatusTransition(current: DirectDebitMandateStatus, next: DirectDebitMandateStatus) {
  return current === next || ALLOWED_STATUS_TRANSITIONS[current].has(next);
}

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function pickProvider(value: unknown): DirectDebitProvider {
  const cleaned = cleanString(value) || "gocardless";
  if (!PROVIDERS.includes(cleaned as DirectDebitProvider)) throw ApiError.badRequest(`Unsupported Direct Debit provider: ${cleaned}.`);
  return cleaned as DirectDebitProvider;
}

function pickStatus(value: unknown): DirectDebitMandateStatus {
  const cleaned = cleanString(value);
  if (!cleaned || !STATUSES.includes(cleaned as DirectDebitMandateStatus)) throw ApiError.badRequest("Unsupported Direct Debit mandate status.");
  return cleaned as DirectDebitMandateStatus;
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

function toMandate(row: any): DirectDebitMandate {
  return {
    id: row.id,
    clinicId: row.clinicId,
    clientAccountProfileId: row.clientAccountProfileId || null,
    provider: row.provider,
    providerCustomerId: row.providerCustomerId || null,
    providerMandateId: row.providerMandateId || null,
    status: row.status,
    setupReference: row.setupReference,
    setupUrl: row.setupUrl || null,
    failureReason: row.failureReason || null,
  };
}

function toAlert(row: any): DirectDebitAlert {
  return {
    id: row.id,
    clinicId: row.clinicId,
    mandateId: row.mandateId,
    alertType: row.alertType,
    status: row.status,
    message: row.message,
  };
}

function toReconciliation(row: any): DirectDebitReconciliationResult {
  return {
    id: row.id,
    clinicId: row.clinicId,
    provider: row.provider,
    checkedCount: Number(row.checkedCount || 0),
    mismatchCount: Number(row.mismatchCount || 0),
    result: row.result,
  };
}

export class DirectDebitService {
  async createMandateSetup(input: {
    clinicId: string;
    provider?: DirectDebitProvider;
    clientAccountProfileId?: string | null;
    providerCustomerId?: string | null;
    setupReference?: string | null;
    setupUrl?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<DirectDebitMandate> {
    await this.ensureClinicExists(input.clinicId);
    const provider = pickProvider(input.provider);
    const setupReference = cleanString(input.setupReference) || `${provider}:${uuidv4()}`;
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO direct_debit_mandate
        (id, clinic_id, client_account_profile_id, provider, provider_customer_id,
         status, setup_reference, setup_url, metadata)
       VALUES (?, ?, ?, ?, ?, 'pending_customer_authorisation', ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         client_account_profile_id = VALUES(client_account_profile_id),
         provider_customer_id = VALUES(provider_customer_id),
         setup_url = VALUES(setup_url),
         metadata = VALUES(metadata)`,
      [
        id,
        input.clinicId,
        cleanString(input.clientAccountProfileId),
        provider,
        cleanString(input.providerCustomerId),
        setupReference,
        cleanString(input.setupUrl),
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );
    return this.getMandateBySetupReference(input.clinicId, setupReference);
  }

  async applyProviderCallback(input: {
    clinicId: string;
    provider?: DirectDebitProvider;
    providerEventId: string;
    providerMandateId: string;
    status: DirectDebitMandateStatus;
    eventType?: string | null;
    providerCustomerId?: string | null;
    failureReason?: string | null;
    payload?: Record<string, unknown> | null;
  }): Promise<{ mandate: DirectDebitMandate; duplicate: boolean; alert: DirectDebitAlert | null }> {
    const provider = pickProvider(input.provider);
    const providerEventId = cleanString(input.providerEventId);
    const providerMandateId = cleanString(input.providerMandateId);
    if (!providerEventId) throw ApiError.badRequest("providerEventId is required.");
    if (!providerMandateId) throw ApiError.badRequest("providerMandateId is required.");
    const status = pickStatus(input.status);
    const payloadHash = sha256(stableStringify(input.payload || {}));

    const [existingEvent]: any = await pool.execute(
      `SELECT mandate_id as mandateId FROM direct_debit_mandate_event WHERE provider = ? AND provider_event_id = ? LIMIT 1`,
      [provider, providerEventId],
    );
    if (existingEvent[0]) {
      return { mandate: await this.getMandate(input.clinicId, existingEvent[0].mandateId), duplicate: true, alert: null };
    }

    let mandate = await this.findMandateByProviderId(input.clinicId, provider, providerMandateId);
    if (!mandate && input.providerCustomerId) {
      mandate = await this.findPendingMandateByCustomer(input.clinicId, provider, input.providerCustomerId);
    }
    if (!mandate) {
      mandate = await this.createMandateSetup({
        clinicId: input.clinicId,
        provider,
        providerCustomerId: cleanString(input.providerCustomerId),
        setupReference: `${provider}:mandate:${providerMandateId}`,
      });
    }
    const statusApplied = shouldApplyStatusTransition(mandate.status, status);
    const eventId = uuidv4();
    if (statusApplied) {
      await pool.execute(
        `UPDATE direct_debit_mandate
         SET provider_customer_id = COALESCE(?, provider_customer_id),
             provider_mandate_id = ?,
             status = ?,
             failure_reason = ?
         WHERE id = ? AND clinic_id = ?`,
        [cleanString(input.providerCustomerId), providerMandateId, status, cleanString(input.failureReason), mandate.id, input.clinicId],
      );
    }
    await pool.execute(
      `INSERT INTO direct_debit_mandate_event
        (id, clinic_id, mandate_id, provider, provider_event_id, event_type, event_status, payload_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        input.clinicId,
        mandate.id,
        provider,
        providerEventId,
        cleanString(input.eventType) || "mandate.status",
        status,
        payloadHash,
      ],
    );

    let alert: DirectDebitAlert | null = null;
    if (statusApplied && FAILURE_STATUSES.has(status)) {
      alert = await this.createAlert({
        clinicId: input.clinicId,
        mandateId: mandate.id,
        alertType: status === "failed" ? "payment_failed" : "mandate_failed",
        message: cleanString(input.failureReason) || `Direct Debit mandate ${providerMandateId} changed to ${status}.`,
      });
    } else if (statusApplied && status === "active") {
      await this.resolveAlerts(input.clinicId, mandate.id);
    }

    return { mandate: await this.getMandate(input.clinicId, mandate.id), duplicate: false, alert };
  }

  async reconcileMandates(input: {
    clinicId: string;
    provider?: DirectDebitProvider;
    providerStatuses: Array<{ providerMandateId: string; status: DirectDebitMandateStatus }>;
  }): Promise<DirectDebitReconciliationResult> {
    const provider = pickProvider(input.provider);
    let checkedCount = 0;
    let mismatchCount = 0;
    const mismatches: Array<Record<string, unknown>> = [];

    for (const item of input.providerStatuses) {
      const providerMandateId = cleanString(item.providerMandateId);
      if (!providerMandateId) continue;
      const expectedStatus = pickStatus(item.status);
      const mandate = await this.findMandateByProviderId(input.clinicId, provider, providerMandateId);
      checkedCount += 1;
      if (!mandate || mandate.status !== expectedStatus) {
        mismatchCount += 1;
        mismatches.push({ providerMandateId, crmStatus: mandate?.status || null, providerStatus: expectedStatus });
        if (mandate) {
          await this.createAlert({
            clinicId: input.clinicId,
            mandateId: mandate.id,
            alertType: "reconciliation_mismatch",
            message: `Direct Debit reconciliation mismatch for ${providerMandateId}: CRM ${mandate.status}, provider ${expectedStatus}.`,
          });
        }
      }
    }

    const id = uuidv4();
    await pool.execute(
      `INSERT INTO direct_debit_reconciliation_run
        (id, clinic_id, provider, checked_count, mismatch_count, result, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.clinicId,
        provider,
        checkedCount,
        mismatchCount,
        mismatchCount > 0 ? "mismatch" : "passed",
        JSON.stringify({ mismatches }),
      ],
    );
    return this.getReconciliation(input.clinicId, id);
  }

  private async createAlert(input: { clinicId: string; mandateId: string; alertType: DirectDebitAlertType; message: string }): Promise<DirectDebitAlert> {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO direct_debit_alert
        (id, clinic_id, mandate_id, alert_type, status, message)
       VALUES (?, ?, ?, ?, 'open', ?)`,
      [id, input.clinicId, input.mandateId, input.alertType, input.message.slice(0, 1000)],
    );
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, mandate_id as mandateId, alert_type as alertType, status, message
       FROM direct_debit_alert
       WHERE id = ? AND clinic_id = ?
       LIMIT 1`,
      [id, input.clinicId],
    );
    return toAlert(rows[0]);
  }

  private async resolveAlerts(clinicId: string, mandateId: string) {
    await pool.execute(
      `UPDATE direct_debit_alert
       SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ? AND mandate_id = ? AND status = 'open'`,
      [clinicId, mandateId],
    );
  }

  private async findMandateByProviderId(clinicId: string, provider: DirectDebitProvider, providerMandateId: string): Promise<DirectDebitMandate | null> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, client_account_profile_id as clientAccountProfileId,
              provider, provider_customer_id as providerCustomerId, provider_mandate_id as providerMandateId,
              status, setup_reference as setupReference, setup_url as setupUrl, failure_reason as failureReason
       FROM direct_debit_mandate
       WHERE clinic_id = ? AND provider = ? AND provider_mandate_id = ?
       LIMIT 1`,
      [clinicId, provider, providerMandateId],
    );
    return rows[0] ? toMandate(rows[0]) : null;
  }

  private async findPendingMandateByCustomer(clinicId: string, provider: DirectDebitProvider, providerCustomerId: string): Promise<DirectDebitMandate | null> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, client_account_profile_id as clientAccountProfileId,
              provider, provider_customer_id as providerCustomerId, provider_mandate_id as providerMandateId,
              status, setup_reference as setupReference, setup_url as setupUrl, failure_reason as failureReason
       FROM direct_debit_mandate
       WHERE clinic_id = ?
         AND provider = ?
         AND provider_customer_id = ?
         AND provider_mandate_id IS NULL
         AND status IN ('setup_required','pending_customer_authorisation','submitted')
       ORDER BY created_at DESC
       LIMIT 1`,
      [clinicId, provider, providerCustomerId],
    );
    return rows[0] ? toMandate(rows[0]) : null;
  }

  private async getMandateBySetupReference(clinicId: string, setupReference: string): Promise<DirectDebitMandate> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, client_account_profile_id as clientAccountProfileId,
              provider, provider_customer_id as providerCustomerId, provider_mandate_id as providerMandateId,
              status, setup_reference as setupReference, setup_url as setupUrl, failure_reason as failureReason
       FROM direct_debit_mandate
       WHERE clinic_id = ? AND setup_reference = ?
       LIMIT 1`,
      [clinicId, setupReference],
    );
    if (!rows[0]) throw ApiError.notFound("Direct Debit mandate was not found.");
    return toMandate(rows[0]);
  }

  private async getMandate(clinicId: string, mandateId: string): Promise<DirectDebitMandate> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, client_account_profile_id as clientAccountProfileId,
              provider, provider_customer_id as providerCustomerId, provider_mandate_id as providerMandateId,
              status, setup_reference as setupReference, setup_url as setupUrl, failure_reason as failureReason
       FROM direct_debit_mandate
       WHERE clinic_id = ? AND id = ?
       LIMIT 1`,
      [clinicId, mandateId],
    );
    if (!rows[0]) throw ApiError.notFound("Direct Debit mandate was not found.");
    return toMandate(rows[0]);
  }

  private async getReconciliation(clinicId: string, id: string): Promise<DirectDebitReconciliationResult> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, provider, checked_count as checkedCount,
              mismatch_count as mismatchCount, result
       FROM direct_debit_reconciliation_run
       WHERE clinic_id = ? AND id = ?
       LIMIT 1`,
      [clinicId, id],
    );
    if (!rows[0]) throw ApiError.notFound("Direct Debit reconciliation run was not found.");
    return toReconciliation(rows[0]);
  }

  private async ensureClinicExists(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id FROM clinic WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Clinic was not found.");
  }
}

export const directDebitService = new DirectDebitService();
