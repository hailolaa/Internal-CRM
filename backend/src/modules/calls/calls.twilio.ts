import { cleanString, normalizePhone } from "../contacts/contacts.normalizers.js";
import type { TwilioCallWebhookPayload, TwilioRecordingWebhookPayload } from "./calls.types.js";

const missedStatuses = new Set(["busy", "failed", "no-answer", "canceled", "cancelled"]);

export function normalizeTwilioCallPayload(payload: Record<string, unknown>): TwilioCallWebhookPayload {
  return {
    AccountSid: cleanString(payload.AccountSid) || undefined,
    AnsweredBy: cleanString(payload.AnsweredBy) || undefined,
    CallDuration: cleanString(payload.CallDuration) || undefined,
    CallSid: cleanString(payload.CallSid) || undefined,
    CallStatus: cleanString(payload.CallStatus) || undefined,
    Direction: cleanString(payload.Direction) || undefined,
    Duration: cleanString(payload.Duration) || undefined,
    EndTime: cleanString(payload.EndTime) || undefined,
    From: cleanString(payload.From) || undefined,
    StartTime: cleanString(payload.StartTime) || undefined,
    To: cleanString(payload.To) || undefined,
  };
}

export function normalizeTwilioRecordingPayload(payload: Record<string, unknown>): TwilioRecordingWebhookPayload {
  return {
    AccountSid: cleanString(payload.AccountSid) || undefined,
    CallSid: cleanString(payload.CallSid) || undefined,
    RecordingDuration: cleanString(payload.RecordingDuration) || undefined,
    RecordingSid: cleanString(payload.RecordingSid) || undefined,
    RecordingStatus: cleanString(payload.RecordingStatus) || undefined,
    RecordingUrl: cleanString(payload.RecordingUrl) || undefined,
  };
}

export function getCallDirection(direction: string | undefined) {
  return direction?.toLowerCase().startsWith("outbound") ? "outbound" : "inbound";
}

export function getTrackingNumber(payload: TwilioCallWebhookPayload) {
  return getCallDirection(payload.Direction) === "inbound" ? payload.To || null : payload.From || null;
}

export function getContactNumber(payload: TwilioCallWebhookPayload) {
  return getCallDirection(payload.Direction) === "inbound" ? payload.From || null : payload.To || null;
}

export function isMissedCall(status: string | undefined, durationSeconds: number, direction: string) {
  if (direction !== "inbound") return false;

  const normalizedStatus = status?.toLowerCase() || "";
  return missedStatuses.has(normalizedStatus) || durationSeconds === 0;
}

export function parseTwilioDuration(...values: Array<string | undefined>) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

export function toMysqlDateTime(value: string | undefined) {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

export function normalizePhoneForLookup(value: string | null | undefined) {
  return normalizePhone(value) || null;
}
