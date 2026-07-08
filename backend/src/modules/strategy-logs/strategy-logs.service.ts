import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import {
  CreateStrategyLogDTO,
  StrategyLogListQuery,
  StrategyLogResponse,
  UpdateStrategyLogDTO,
} from "./strategy-logs.types.js";

function toMonthStartDate(value: unknown): string | null {
  if (!value) return null;
  const str = String(value);
  if (/^\d{4}-\d{2}$/.test(str)) {
    return `${str}-01`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return `${str.slice(0, 7)}-01`;
  }
  return null;
}

function formatMonth(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 7);
  }
  const dateStr = String(value);
  return dateStr.slice(0, 7);
}

function mapStrategyLog(row: any): StrategyLogResponse {
  return {
    id: row.id,
    clinicId: row.clinicId,
    clientAccountProfileId: row.clientAccountProfileId,
    logMonth: formatMonth(row.logMonth) || "",
    logType: row.logType,
    meetingNotes: row.meetingNotes || null,
    seoPlan: row.seoPlan || null,
    ppcPlan: row.ppcPlan || null,
    landingPagePlan: row.landingPagePlan || null,
    kpiNotes: row.kpiNotes || null,
    decisions: row.decisions || null,
    nextActions: row.nextActions || null,
    ownerId: row.ownerId || null,
    ownerName: row.ownerFirstName ? `${row.ownerFirstName} ${row.ownerLastName || ""}`.trim() : null,
    ownerEmail: row.ownerEmail || null,
    archivedAt: row.archivedAt ? new Date(row.archivedAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export class StrategyLogsService {
  async listLogs(clinicId: string, query: StrategyLogListQuery): Promise<StrategyLogResponse[]> {
    const conditions = ["sl.clinic_id = ?", "sl.archived_at IS NULL"];
    const values: any[] = [clinicId];

    if (String(query.includeArchived) === "true") {
      conditions.pop(); // Remove "sl.archived_at IS NULL"
    }

    if (query.clientAccountProfileId) {
      conditions.push("sl.client_account_profile_id = ?");
      values.push(query.clientAccountProfileId);
    }

    if (query.logMonth) {
      const monthStartDate = toMonthStartDate(query.logMonth);
      if (monthStartDate) {
        conditions.push("sl.log_month = ?");
        values.push(monthStartDate);
      }
    }

    if (query.ownerId) {
      conditions.push("sl.owner_id = ?");
      values.push(query.ownerId);
    }

    if (query.logType) {
      conditions.push("sl.log_type = ?");
      values.push(query.logType);
    }

    const [rows]: any = await pool.execute(
      `SELECT sl.id, sl.clinic_id as clinicId, sl.client_account_profile_id as clientAccountProfileId,
              sl.log_month as logMonth, sl.log_type as logType, sl.meeting_notes as meetingNotes,
              sl.seo_plan as seoPlan, sl.ppc_plan as ppcPlan, sl.landing_page_plan as landingPagePlan,
              sl.kpi_notes as kpiNotes, sl.decisions as decisions, sl.next_actions as nextActions,
              sl.owner_id as ownerId, sl.archived_at as archivedAt, sl.created_at as createdAt, sl.updated_at as updatedAt,
              u.first_name as ownerFirstName, u.last_name as ownerLastName, u.email as ownerEmail
       FROM strategy_log sl
       LEFT JOIN user u ON u.id = sl.owner_id AND u.deleted_at IS NULL
       WHERE ${conditions.join(" AND ")}
       ORDER BY sl.log_month DESC, sl.created_at DESC`,
      values,
    );

    return rows.map(mapStrategyLog);
  }

  async createLog(clinicId: string, userId: string, data: CreateStrategyLogDTO): Promise<string> {
    const [profileRows]: any = await pool.execute(
      `SELECT id FROM client_account_profile WHERE id = ? AND clinic_id = ? LIMIT 1`,
      [data.clientAccountProfileId, clinicId],
    );
    if (profileRows.length === 0) {
      throw ApiError.badRequest("Client account profile must belong to this clinic");
    }

    if (data.ownerId) {
      const [userRows]: any = await pool.execute(
        `SELECT id FROM user WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL AND status = 'active' AND is_active = 1 LIMIT 1`,
        [data.ownerId, clinicId],
      );
      if (userRows.length === 0) {
        throw ApiError.badRequest("Owner must be an active user in this clinic");
      }
    }

    const id = uuidv4();
    const monthStartDate = toMonthStartDate(data.logMonth);
    if (!monthStartDate) {
      throw ApiError.badRequest("Invalid logMonth format");
    }

    await pool.execute(
      `INSERT INTO strategy_log
        (id, clinic_id, client_account_profile_id, log_month, log_type, meeting_notes, seo_plan, ppc_plan,
         landing_page_plan, kpi_notes, decisions, next_actions, owner_id, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        data.clientAccountProfileId,
        monthStartDate,
        data.logType || "strategy",
        data.meetingNotes || null,
        data.seoPlan || null,
        data.ppcPlan || null,
        data.landingPagePlan || null,
        data.kpiNotes || null,
        data.decisions || null,
        data.nextActions || null,
        data.ownerId || null,
        userId,
        userId,
      ],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "STRATEGY_LOG_CREATED",
      entityType: "strategy_log",
      entityId: id,
      changes: { ...data, logMonth: monthStartDate },
    });

    return id;
  }

  async updateLog(clinicId: string, userId: string, logId: string, data: UpdateStrategyLogDTO): Promise<void> {
    const [existingRows]: any = await pool.execute(
      `SELECT id FROM strategy_log WHERE id = ? AND clinic_id = ? AND archived_at IS NULL LIMIT 1`,
      [logId, clinicId],
    );
    if (existingRows.length === 0) {
      throw ApiError.notFound("Strategy log not found");
    }

    if (data.ownerId) {
      const [userRows]: any = await pool.execute(
        `SELECT id FROM user WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL AND status = 'active' AND is_active = 1 LIMIT 1`,
        [data.ownerId, clinicId],
      );
      if (userRows.length === 0) {
        throw ApiError.badRequest("Owner must be an active user in this clinic");
      }
    }

    const fields: string[] = [];
    const values: any[] = [];
    const mapping: Record<string, string> = {
      logType: "log_type",
      meetingNotes: "meeting_notes",
      seoPlan: "seo_plan",
      ppcPlan: "ppc_plan",
      landingPagePlan: "landing_page_plan",
      kpiNotes: "kpi_notes",
      decisions: "decisions",
      nextActions: "next_actions",
      ownerId: "owner_id",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (mapping[key]) {
        fields.push(`${mapping[key]} = ?`);
        values.push(value ?? null);
      }
    });

    if (data.logMonth) {
      const monthStartDate = toMonthStartDate(data.logMonth);
      if (!monthStartDate) {
        throw ApiError.badRequest("Invalid logMonth format");
      }
      fields.push("log_month = ?");
      values.push(monthStartDate);
    }

    if (fields.length === 0) return;

    fields.push("updated_by = ?");
    values.push(userId);

    values.push(logId, clinicId);

    await pool.execute(
      `UPDATE strategy_log SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND archived_at IS NULL`,
      values,
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "STRATEGY_LOG_UPDATED",
      entityType: "strategy_log",
      entityId: logId,
      changes: { ...data },
    });
  }

  async archiveLog(clinicId: string, userId: string, logId: string): Promise<void> {
    const [result]: any = await pool.execute(
      `UPDATE strategy_log SET archived_at = CURRENT_TIMESTAMP, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND archived_at IS NULL`,
      [userId, logId, clinicId],
    );

    if (result.affectedRows === 0) {
      throw ApiError.notFound("Strategy log not found");
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "STRATEGY_LOG_ARCHIVED",
      entityType: "strategy_log",
      entityId: logId,
    });
  }
}

export const strategyLogsService = new StrategyLogsService();
