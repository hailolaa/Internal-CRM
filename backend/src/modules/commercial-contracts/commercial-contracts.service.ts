import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import type {
  CommercialContract,
  CommercialContractAlert,
  CommercialContractChangeType,
  CommercialContractStatus,
  CommercialContractVersion,
} from "./commercial-contracts.types.js";

const STATUSES: CommercialContractStatus[] = ["draft", "sent", "active", "notice_given", "renewal_pending", "renewed", "ended", "cancelled"];
const ALLOWED_TRANSITIONS: Record<CommercialContractStatus, CommercialContractStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["active", "cancelled"],
  active: ["notice_given", "renewal_pending", "ended", "cancelled"],
  notice_given: ["ended", "cancelled", "active"],
  renewal_pending: ["renewed", "ended", "cancelled"],
  renewed: ["active", "ended", "cancelled"],
  ended: [],
  cancelled: [],
};

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeKey(value: unknown, field: string) {
  const cleaned = cleanString(value);
  if (!cleaned) throw ApiError.badRequest(`${field} is required.`);
  const key = cleaned.toLowerCase().replace(/[^a-z0-9._:-]+/g, "_").replace(/^_+|_+$/g, "");
  if (!key) throw ApiError.badRequest(`${field} is invalid.`);
  return key.slice(0, 160);
}

function pickStatus(value: unknown): CommercialContractStatus {
  const cleaned = cleanString(value);
  if (!cleaned || !STATUSES.includes(cleaned as CommercialContractStatus)) throw ApiError.badRequest("Unsupported contract status.");
  return cleaned as CommercialContractStatus;
}

function dateOnly(value: unknown, field: string, required = false) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const cleaned = cleanString(value);
  if (!cleaned) {
    if (required) throw ApiError.badRequest(`${field} is required.`);
    return null;
  }
  const parsed = new Date(`${cleaned.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw ApiError.badRequest(`${field} must be a valid date.`);
  return parsed.toISOString().slice(0, 10);
}

function dateFromDb(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
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

function toContract(row: any): CommercialContract {
  return {
    id: row.id,
    clinicId: row.clinicId,
    clientAccountProfileId: row.clientAccountProfileId || null,
    contractKey: row.contractKey,
    status: row.status,
    currentVersion: Number(row.currentVersion || 1),
    startDate: dateFromDb(row.startDate),
    endDate: dateFromDb(row.endDate),
    renewalDate: dateFromDb(row.renewalDate),
    noticePeriodDays: Number(row.noticePeriodDays || 30),
    terms: parseJsonObject(row.terms),
  };
}

function toVersion(row: any): CommercialContractVersion {
  return {
    id: row.id,
    clinicId: row.clinicId,
    contractId: row.contractId,
    version: Number(row.version || 1),
    changeType: row.changeType,
    status: row.status,
    effectiveDate: dateFromDb(row.effectiveDate),
    summary: row.summary,
    terms: parseJsonObject(row.terms),
  };
}

function toAlert(row: any): CommercialContractAlert {
  return {
    id: row.id,
    clinicId: row.clinicId,
    contractId: row.contractId,
    alertType: row.alertType,
    status: row.status,
    dueDate: dateFromDb(row.dueDate),
    message: row.message,
  };
}

export class CommercialContractsService {
  async listContracts(clinicId: string, query: { status?: string; clientAccountProfileId?: string } = {}): Promise<CommercialContract[]> {
    const where = ["clinic_id = ?"];
    const params: any[] = [clinicId];
    const status = cleanString(query.status);
    const clientAccountProfileId = cleanString(query.clientAccountProfileId);

    if (status) {
      where.push("status = ?");
      params.push(pickStatus(status));
    }
    if (clientAccountProfileId) {
      where.push("client_account_profile_id = ?");
      params.push(clientAccountProfileId);
    }

    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, client_account_profile_id as clientAccountProfileId,
              contract_key as contractKey, status, current_version as currentVersion,
              start_date as startDate, end_date as endDate, renewal_date as renewalDate,
              notice_period_days as noticePeriodDays, terms
       FROM commercial_contract
       WHERE ${where.join(" AND ")}
       ORDER BY renewal_date IS NULL ASC, renewal_date ASC, updated_at DESC`,
      params,
    );
    return rows.map(toContract);
  }

  async listAlerts(clinicId: string, query: { status?: "open" | "resolved"; contractId?: string } = {}): Promise<CommercialContractAlert[]> {
    const where = ["clinic_id = ?"];
    const params: any[] = [clinicId];
    const status = cleanString(query.status);
    const contractId = cleanString(query.contractId);

    if (status) {
      if (!["open", "resolved"].includes(status)) throw ApiError.badRequest("Unsupported contract alert status.");
      where.push("status = ?");
      params.push(status);
    }
    if (contractId) {
      where.push("contract_id = ?");
      params.push(contractId);
    }

    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, contract_id as contractId, alert_type as alertType,
              status, due_date as dueDate, message
       FROM commercial_contract_alert
       WHERE ${where.join(" AND ")}
       ORDER BY due_date IS NULL ASC, due_date ASC, created_at DESC`,
      params,
    );
    return rows.map(toAlert);
  }

  async createContract(input: {
    clinicId: string;
    contractKey: string;
    clientAccountProfileId?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    renewalDate?: string | null;
    noticePeriodDays?: number | null;
    terms: Record<string, unknown>;
    createdBy: string;
  }): Promise<CommercialContract> {
    await this.ensureClinicExists(input.clinicId);
    const contractKey = normalizeKey(input.contractKey, "contractKey");
    const createdBy = cleanString(input.createdBy);
    if (!createdBy) throw ApiError.badRequest("createdBy is required.");
    const noticePeriodDays = Math.max(0, Math.floor(Number(input.noticePeriodDays ?? 30)));
    const id = uuidv4();
    const versionId = uuidv4();
    const terms = JSON.stringify(input.terms || {});

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `INSERT INTO commercial_contract
          (id, clinic_id, client_account_profile_id, contract_key, status, current_version,
           start_date, end_date, renewal_date, notice_period_days, terms, created_by)
         VALUES (?, ?, ?, ?, 'draft', 1, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.clinicId,
          cleanString(input.clientAccountProfileId),
          contractKey,
          dateOnly(input.startDate, "startDate"),
          dateOnly(input.endDate, "endDate"),
          dateOnly(input.renewalDate, "renewalDate"),
          noticePeriodDays,
          terms,
          createdBy,
        ],
      );
      await connection.execute(
        `INSERT INTO commercial_contract_version
          (id, clinic_id, contract_id, version, change_type, status, effective_date, summary, terms, created_by)
         VALUES (?, ?, ?, 1, 'initial', 'approved', ?, 'Initial contract terms', ?, ?)`,
        [versionId, input.clinicId, id, dateOnly(input.startDate, "startDate"), terms, createdBy],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return this.getContract(input.clinicId, id);
  }

  async transitionContract(clinicId: string, contractId: string, status: CommercialContractStatus): Promise<CommercialContract> {
    const nextStatus = pickStatus(status);
    const contract = await this.getContract(clinicId, contractId);
    if (!ALLOWED_TRANSITIONS[contract.status].includes(nextStatus)) {
      throw ApiError.badRequest(`Contract cannot move from ${contract.status} to ${nextStatus}.`);
    }
    await pool.execute(
      `UPDATE commercial_contract SET status = ? WHERE id = ? AND clinic_id = ?`,
      [nextStatus, contractId, clinicId],
    );
    if (nextStatus === "active") await this.resolveAlerts(clinicId, contractId);
    return this.getContract(clinicId, contractId);
  }

  async createChangeOrder(input: {
    clinicId: string;
    contractId: string;
    summary: string;
    effectiveDate?: string | null;
    terms: Record<string, unknown>;
    createdBy: string;
  }): Promise<CommercialContractVersion> {
    const contract = await this.getContract(input.clinicId, input.contractId);
    if (["ended", "cancelled"].includes(contract.status)) throw ApiError.badRequest("Closed contracts cannot receive change orders.");
    const summary = cleanString(input.summary);
    const createdBy = cleanString(input.createdBy);
    if (!summary) throw ApiError.badRequest("summary is required.");
    if (!createdBy) throw ApiError.badRequest("createdBy is required.");
    return this.createVersion(input.clinicId, input.contractId, "change_order", summary, input.terms, createdBy, input.effectiveDate || null);
  }

  async createNoticeAlerts(input: { clinicId: string; untilDate: string }): Promise<CommercialContractAlert[]> {
    const untilDate = dateOnly(input.untilDate, "untilDate", true)!;
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, renewal_date as renewalDate, notice_period_days as noticePeriodDays
       FROM commercial_contract
       WHERE clinic_id = ?
         AND status = 'active'
         AND renewal_date IS NOT NULL
         AND DATE_SUB(renewal_date, INTERVAL notice_period_days DAY) <= ?`,
      [input.clinicId, untilDate],
    );
    const alerts: CommercialContractAlert[] = [];
    for (const row of rows) {
      const dueDate = await this.noticeDueDate(row.renewalDate, Number(row.noticePeriodDays || 0));
      alerts.push(await this.upsertAlert(input.clinicId, row.id, "notice_due", dueDate, "Contract notice window is open."));
    }
    return alerts;
  }

  async generateRenewals(input: { clinicId: string; untilDate: string; createdBy: string }): Promise<CommercialContractVersion[]> {
    const untilDate = dateOnly(input.untilDate, "untilDate", true)!;
    const createdBy = cleanString(input.createdBy);
    if (!createdBy) throw ApiError.badRequest("createdBy is required.");
    const [rows]: any = await pool.execute(
      `SELECT id, terms
       FROM commercial_contract
       WHERE clinic_id = ?
         AND status = 'active'
         AND renewal_date IS NOT NULL
         AND renewal_date <= ?`,
      [input.clinicId, untilDate],
    );
    const versions: CommercialContractVersion[] = [];
    for (const row of rows) {
      const version = await this.createVersion(input.clinicId, row.id, "renewal", "Auto-generated renewal record", parseJsonObject(row.terms), createdBy, untilDate);
      await pool.execute(
        `UPDATE commercial_contract SET status = 'renewal_pending' WHERE id = ? AND clinic_id = ?`,
        [row.id, input.clinicId],
      );
      await this.upsertAlert(input.clinicId, row.id, "renewal_due", untilDate, "Contract renewal is due.");
      versions.push(version);
    }
    return versions;
  }

  private async createVersion(
    clinicId: string,
    contractId: string,
    changeType: CommercialContractChangeType,
    summary: string,
    terms: Record<string, unknown>,
    createdBy: string,
    effectiveDate?: string | null,
  ) {
    const contract = await this.getContract(clinicId, contractId);
    const nextVersion = contract.currentVersion + 1;
    const id = uuidv4();
    const termsJson = JSON.stringify(terms || {});
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `UPDATE commercial_contract_version
         SET status = 'superseded'
         WHERE contract_id = ? AND clinic_id = ? AND status = 'approved'`,
        [contractId, clinicId],
      );
      await connection.execute(
        `INSERT INTO commercial_contract_version
          (id, clinic_id, contract_id, version, change_type, status, effective_date, summary, terms, created_by)
         VALUES (?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?)`,
        [id, clinicId, contractId, nextVersion, changeType, dateOnly(effectiveDate, "effectiveDate"), summary.slice(0, 500), termsJson, createdBy],
      );
      await connection.execute(
        `UPDATE commercial_contract
         SET current_version = ?, terms = ?
         WHERE id = ? AND clinic_id = ?`,
        [nextVersion, termsJson, contractId, clinicId],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return this.getVersion(clinicId, contractId, nextVersion);
  }

  private async upsertAlert(clinicId: string, contractId: string, alertType: CommercialContractAlert["alertType"], dueDate: string, message: string): Promise<CommercialContractAlert> {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO commercial_contract_alert
        (id, clinic_id, contract_id, alert_type, status, due_date, message)
       VALUES (?, ?, ?, ?, 'open', ?, ?)
       ON DUPLICATE KEY UPDATE
         due_date = VALUES(due_date),
         message = VALUES(message)`,
      [id, clinicId, contractId, alertType, dueDate, message],
    );
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, contract_id as contractId, alert_type as alertType,
              status, due_date as dueDate, message
       FROM commercial_contract_alert
       WHERE clinic_id = ? AND contract_id = ? AND alert_type = ? AND status = 'open'
       LIMIT 1`,
      [clinicId, contractId, alertType],
    );
    return toAlert(rows[0]);
  }

  private async resolveAlerts(clinicId: string, contractId: string) {
    await pool.execute(
      `UPDATE commercial_contract_alert
       SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ? AND contract_id = ? AND status = 'open'`,
      [clinicId, contractId],
    );
  }

  private async noticeDueDate(renewalDate: unknown, noticePeriodDays: number) {
    const renewal = dateOnly(renewalDate, "renewalDate", true)!;
    const [rows]: any = await pool.execute(
      `SELECT DATE_SUB(?, INTERVAL ? DAY) as dueDate`,
      [renewal, noticePeriodDays],
    );
    return dateFromDb(rows[0].dueDate)!;
  }

  async getContract(clinicId: string, contractId: string): Promise<CommercialContract> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, client_account_profile_id as clientAccountProfileId,
              contract_key as contractKey, status, current_version as currentVersion,
              start_date as startDate, end_date as endDate, renewal_date as renewalDate,
              notice_period_days as noticePeriodDays, terms
       FROM commercial_contract
       WHERE clinic_id = ? AND id = ?
       LIMIT 1`,
      [clinicId, contractId],
    );
    if (!rows[0]) throw ApiError.notFound("Commercial contract was not found.");
    return toContract(rows[0]);
  }

  private async getVersion(clinicId: string, contractId: string, version: number): Promise<CommercialContractVersion> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, contract_id as contractId, version,
              change_type as changeType, status, effective_date as effectiveDate,
              summary, terms
       FROM commercial_contract_version
       WHERE clinic_id = ? AND contract_id = ? AND version = ?
       LIMIT 1`,
      [clinicId, contractId, version],
    );
    if (!rows[0]) throw ApiError.notFound("Commercial contract version was not found.");
    return toVersion(rows[0]);
  }

  private async ensureClinicExists(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id FROM clinic WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Clinic was not found.");
  }
}

export const commercialContractsService = new CommercialContractsService();
