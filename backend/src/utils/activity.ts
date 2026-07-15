import { v4 as uuidv4 } from "uuid";
import pool from "../config/database.js";
import logger from "./logger.js";

export type ActivityType = "Call" | "Email" | "SMS" | "Appointment" | "Note" | "StatusChange";

export type TimelineSource = "contact" | "call" | "appointment" | "consult" | "sla" | "pipeline";

export interface TimelineMetadata {
  action: string;
  source: TimelineSource;
  recordId?: string;
  title?: string;
  status?: string | null;
  previousStatus?: string | null;
  value?: number | null;
  changes?: Record<string, unknown>;
}

export interface TimelineActivityPayload {
  clinicId: string;
  contactId: string;
  type: ActivityType;
  userId?: string | null | undefined;
  metadata?: Record<string, unknown> | null | undefined;
  timestamp?: string | Date | null | undefined;
}

export interface ContactActivityPayload extends TimelineActivityPayload {}

export async function logTimelineActivity(payload: TimelineActivityPayload) {
  try {
    const timestamp = payload.timestamp ? new Date(payload.timestamp) : null;
    const timestampValue = timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null;
    await pool.execute(
      `INSERT INTO activity
        (id, clinic_id, contact_id, type, user_id, metadata, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
      [
        uuidv4(),
        payload.clinicId,
        payload.contactId,
        payload.type,
        payload.userId || null,
        payload.metadata ? JSON.stringify(payload.metadata) : null,
        timestampValue,
      ],
    );
  } catch (error) {
    logger.warn("Timeline activity insert failed", {
      contactId: payload.contactId,
      type: payload.type,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function buildTimelineMetadata(metadata: TimelineMetadata): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  );
}

export async function logContactActivity(payload: ContactActivityPayload) {
  return logTimelineActivity(payload);
}
