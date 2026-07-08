import pool from "../../config/database.js";
import { AuditLogListResponse, AuditLogQuery } from "./audit-log.types.js";

function parseChanges(value: unknown) {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, unknown>;

  try {
    return JSON.parse(String(value)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export class AuditLogService {
  async listAuditLog(
    clinicId: string,
    query: AuditLogQuery,
  ): Promise<AuditLogListResponse> {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 25)));
    const offset = (page - 1) * pageSize;
    const conditions = ["a.clinic_id = ?", "a.deleted_at IS NULL"];
    const values: any[] = [clinicId];

    if (query.action) {
      conditions.push("a.action = ?");
      values.push(query.action);
    }

    if (query.entityType) {
      conditions.push("a.entity_type = ?");
      values.push(query.entityType);
    }

    if (query.userId) {
      conditions.push("a.user_id = ?");
      values.push(query.userId);
    }

    if (query.dateFrom) {
      conditions.push("a.created_at >= ?");
      values.push(new Date(query.dateFrom));
    }

    if (query.dateTo) {
      conditions.push("a.created_at <= ?");
      values.push(new Date(query.dateTo));
    }

    if (query.search) {
      conditions.push(
        `(a.action LIKE ? OR a.entity_type LIKE ? OR a.entity_id LIKE ? OR u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)`,
      );
      const search = `%${query.search}%`;
      values.push(search, search, search, search, search, search);
    }

    const whereClause = conditions.join(" AND ");
    const [countRows]: any = await pool.execute(
      `SELECT COUNT(*) as total
       FROM audit_log a
       LEFT JOIN user u ON u.id = a.user_id
       WHERE ${whereClause}`,
      values,
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows]: any = await pool.execute(
      `SELECT
          a.id,
          a.clinic_id as clinicId,
          a.user_id as userId,
          a.action,
          a.entity_type as entityType,
          a.entity_id as entityId,
          a.changes,
          a.ip_address as ipAddress,
          a.user_agent as userAgent,
          a.created_at as createdAt,
          u.first_name as firstName,
          u.last_name as lastName,
          u.email as userEmail,
          u.role as userRole
       FROM audit_log a
       LEFT JOIN user u ON u.id = a.user_id
       WHERE ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      values,
    );

    return {
      entries: rows.map((row: any) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        entityName: row.entityId || row.entityType || row.action,
        userId: row.userId,
        userName:
          [row.firstName, row.lastName].filter(Boolean).join(" ") ||
          row.userEmail ||
          "System",
        userRole: row.userRole || null,
        clinicId: row.clinicId,
        changes: parseChanges(row.changes),
        ipAddress: row.ipAddress || null,
        userAgent: row.userAgent || null,
        createdAt: new Date(row.createdAt).toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }
}

export const auditLogService = new AuditLogService();
