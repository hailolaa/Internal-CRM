import { v4 as uuidv4 } from "uuid";
import pool from "../config/database.js";
import logger from "./logger.js";

export interface AuditPayload {
  clinicId?: string | null | undefined;
  userId?: string | null | undefined;
  action: string;
  entityType?: string | null | undefined;
  entityId?: string | null | undefined;
  changes?: Record<string, unknown> | null | undefined;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}

export async function logAuditEvent(payload: AuditPayload) {
  try {
    await pool.execute(
      `INSERT INTO audit_log
        (id, clinic_id, user_id, action, entity_type, entity_id, changes, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        payload.clinicId || null,
        payload.userId || null,
        payload.action,
        payload.entityType || null,
        payload.entityId || null,
        payload.changes ? JSON.stringify(payload.changes) : null,
        payload.ipAddress || null,
        payload.userAgent || null,
      ],
    );
  } catch (error) {
    logger.warn("Audit log insert failed", {
      action: payload.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
