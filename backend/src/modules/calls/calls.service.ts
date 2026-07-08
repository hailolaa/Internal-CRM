import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import { buildTimelineMetadata, logTimelineActivity } from "../../utils/activity.js";
import { logAuditEvent } from "../../utils/audit.js";
import { openAICallIntelligenceService } from "../../services/openai-call-intelligence.service.js";
import { openAICallTranscriptionService } from "../../services/openai-call-transcription.service.js";
import { slaService } from "../sla/sla.service.js";
import { phoneSqlExpression } from "../contacts/contacts.queries.js";
import {
  getCallDirection,
  getContactNumber,
  getTrackingNumber,
  isMissedCall,
  normalizePhoneForLookup,
  normalizeTwilioCallPayload,
  normalizeTwilioRecordingPayload,
  parseTwilioDuration,
  toMysqlDateTime,
} from "./calls.twilio.js";
import type {
  CreateCallDTO,
  CreateRecordingDeletionRequestDTO,
  TwilioWebhookResult,
  UpdateCallDTO,
  UpdateRecordingDeletionRequestDTO,
} from "./calls.types.js";
import { defaultCallOutcomeOptions } from "./calls.constants.js";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function toMysqlDateTimeValue(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function toMysqlDateOnlyValue(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function formatDateOnlyValue(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatRecordingDeletionRequest(row: any) {
  if (!row.recordingDeletionRequestId) return null;
  return {
    id: row.recordingDeletionRequestId,
    callId: row.recordingDeletionCallId,
    status: row.recordingDeletionStatus,
    reason: row.recordingDeletionReason || null,
    requestedAt: new Date(row.recordingDeletionRequestedAt).toISOString(),
    resolvedAt: row.recordingDeletionResolvedAt ? new Date(row.recordingDeletionResolvedAt).toISOString() : null,
  };
}

interface CallDateFilters {
  startDate?: string | null;
  endDate?: string | null;
}

interface CallListFilters extends CallDateFilters {
  missedOnly?: boolean;
}

function buildCallDateFilter(filters: CallDateFilters = {}, alias = "cl") {
  const clauses: string[] = [];
  const values: any[] = [];

  if (filters.startDate) {
    clauses.push(`${alias}.created_at >= ?`);
    values.push(`${filters.startDate} 00:00:00`);
  }

  if (filters.endDate) {
    clauses.push(`${alias}.created_at < DATE_ADD(?, INTERVAL 1 DAY)`);
    values.push(filters.endDate);
  }

  return {
    clause: clauses.length ? ` AND ${clauses.join(" AND ")}` : "",
    values,
  };
}

function humanizeCallBreakdownLabel(categoryType: string, value: string) {
  const raw = value || "unknown";
  if (raw === "unknown") return "Unknown";
  if (categoryType === "outcome") {
    return defaultCallOutcomeOptions.find((option) => option.value === raw)?.label || raw;
  }
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export class CallsService {
  getOutcomeOptions() {
    return defaultCallOutcomeOptions;
  }

  async createCall(clinicId: string, userId: string, data: CreateCallDTO) {
    await this.assertContactBelongsToClinic(clinicId, data.contactId);

    const callId = uuidv4();
    const direction = data.direction || "inbound";
    const duration = Number(data.duration || 0);
    const commercialOutcome = data.commercialOutcome || null;
    const disposition = getDispositionForCommercialOutcome(commercialOutcome);
    const missedCall = direction === "inbound" && (duration === 0 || commercialOutcome === "missed_no_answer");
    const callStatus = duration > 0 ? "completed" : missedCall ? "no-answer" : "completed";
    const createdAt = toMysqlDateTimeValue(data.createdAt) || toMysqlDateTimeValue(new Date());

    await pool.execute(
      `INSERT INTO \` call \`
        (id, clinic_id, contact_id, user_id, direction, duration, call_status,
         missed_call, started_at, ended_at, outcome, disposition, source,
         treatment_mentioned, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        callId,
        clinicId,
        data.contactId,
        userId,
        direction,
        duration,
        callStatus,
        missedCall ? 1 : 0,
        createdAt,
        createdAt,
        commercialOutcome,
        disposition,
        data.source || "manual_call",
        data.treatmentMentioned || null,
        data.notes || null,
        createdAt,
      ],
    );

    await logTimelineActivity({
      clinicId,
      contactId: data.contactId,
      userId,
      type: "Call",
      metadata: buildTimelineMetadata({
        action: "call.manual_created",
        source: "call",
        recordId: callId,
        changes: {
          commercialOutcome,
          direction,
          duration,
          treatmentMentioned: data.treatmentMentioned || null,
        },
      }),
    });

    await logAuditEvent({
      clinicId,
      userId,
      action: "CALL_CREATED",
      entityType: "call",
      entityId: callId,
      changes: {
        contactId: data.contactId,
        commercialOutcome,
        direction,
        duration,
        source: data.source || "manual_call",
      },
    });

    return this.getCall(clinicId, callId);
  }

  // List existing call records with frontend-friendly display fields
  async listCalls(clinicId: string, filters: CallListFilters = {}) {
    const missedClause =
      filters.missedOnly === true ? " AND cl.missed_call = 1" : filters.missedOnly === false ? " AND cl.missed_call = 0" : "";
    const dateFilter = buildCallDateFilter(filters);

    const [rows]: any = await pool.execute(
      `SELECT cl.id, cl.contact_id as contactId,
              CONCAT(c.first_name, ' ', c.last_name) as contactName,
              c.phone,
              cl.direction,
              cl.duration,
              cl.recording_url as recordingUrl,
              cl.recording_duration as recordingDuration,
              cl.recording_status as recordingStatus,
              cl.recording_source as recordingSource,
              cl.consent_captured as consentCaptured,
              cl.consent_method as consentMethod,
              cl.consent_timestamp as consentTimestamp,
              cl.retention_deadline as retentionDeadline,
              cl.call_status as callStatus,
              cl.outcome as commercialOutcome,
              cl.disposition,
              cl.source,
              cl.missed_call as missedCall,
              cl.transcript,
              cl.ai_summary as aiSummary,
              cl.sentiment,
              cl.booking_intent as bookingIntent,
              cl.treatment_mentioned as treatmentMentioned,
              cl.quality_score as qualityScore,
              cl.summary_generated_at as summaryGeneratedAt,
              cl.notes,
              CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as assignedTo,
              rdr.id as recordingDeletionRequestId,
              rdr.call_id as recordingDeletionCallId,
              rdr.status as recordingDeletionStatus,
              rdr.reason as recordingDeletionReason,
              rdr.requested_at as recordingDeletionRequestedAt,
              rdr.resolved_at as recordingDeletionResolvedAt,
              cl.created_at as createdAt
       FROM \` call \` cl
       JOIN contact c ON c.id = cl.contact_id
       LEFT JOIN user u ON u.id = cl.user_id
       LEFT JOIN call_recording_deletion_request rdr
         ON rdr.id = (
           SELECT latest.id
           FROM call_recording_deletion_request latest
           WHERE latest.call_id = cl.id
             AND latest.clinic_id = cl.clinic_id
             AND latest.deleted_at IS NULL
           ORDER BY latest.requested_at DESC, latest.created_at DESC
           LIMIT 1
         )
       WHERE cl.clinic_id = ? AND cl.deleted_at IS NULL${missedClause}${dateFilter.clause}
       ORDER BY cl.created_at DESC
       LIMIT 200`,
      [clinicId, ...dateFilter.values],
    );

    return rows.map((row: any) => ({
      id: row.id,
      contactId: row.contactId,
      contactName: row.contactName,
      contactAvatar: initials(row.contactName),
      phone: row.phone || "",
      direction: row.direction || "inbound",
      outcome: getCallOutcome(row.callStatus, Number(row.duration || 0), !!row.missedCall),
      commercialOutcome: row.commercialOutcome,
      disposition: getCallDisposition(row.disposition, row.commercialOutcome, row.notes),
      duration: Number(row.duration || 0),
      notes: row.notes || "",
      transcript: row.transcript || "",
      aiSummary: row.aiSummary || "",
      sentiment: row.sentiment || "unknown",
      bookingIntent: row.bookingIntent || "none",
      treatmentMentioned: row.treatmentMentioned || "",
      qualityScore: row.qualityScore === null || row.qualityScore === undefined ? null : Number(row.qualityScore),
      summaryGeneratedAt: row.summaryGeneratedAt ? new Date(row.summaryGeneratedAt).toISOString() : null,
      assignedTo: row.assignedTo.trim() || "Clinic user",
      recordingUrl: row.recordingUrl,
      recordingDuration: row.recordingDuration === null || row.recordingDuration === undefined ? null : Number(row.recordingDuration),
      recordingStatus: row.recordingStatus || null,
      recordingSource: row.recordingSource || null,
      consentCaptured: Boolean(row.consentCaptured),
      consentMethod: row.consentMethod || null,
      consentTimestamp: row.consentTimestamp ? new Date(row.consentTimestamp).toISOString() : null,
      retentionDeadline: formatDateOnlyValue(row.retentionDeadline),
      recordingDeletionRequest: formatRecordingDeletionRequest(row),
      treatment: "Consultation",
      source: row.source || "Call log",
      createdAt: new Date(row.createdAt).toISOString(),
      timestamp: new Date(row.createdAt).toISOString(),
    }));

  }

  // Create or queue a missed-call SMS follow-up linked to the call and contact.
  async createMissedCallFollowUp(
    clinicId: string,
    userId: string,
    callId: string,
    templateId?: string,
    sendNow = false,
  ) {
    // Verify call exists and belongs to clinic
    const [callRows]: any = await pool.execute(
      `SELECT id, contact_id as contactId, missed_call as missedCall
       FROM ` + "` call `" + `
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [callId, clinicId],
    );

    const callRow = callRows[0];
    if (!callRow) throw ApiError.notFound("Call not found");
    if (!callRow.missedCall) {
      throw ApiError.badRequest("Missed-call follow-up can only be created for missed calls");
    }

    const contactId = callRow.contactId;

    // Prevent accidental duplicate follow-ups for same call
    const [existingSms]: any = await pool.execute(
      `SELECT id, status
       FROM sms
       WHERE call_id = ? AND call_followup = 1 AND deleted_at IS NULL
       LIMIT 1`,
      [callId],
    );
    if (existingSms[0] && existingSms[0].status !== "failed") {
      throw ApiError.conflict("A missed-call follow-up has already been queued or sent for this call");
    }

    // Load contact info for rendering
    const [contactRows]: any = await pool.execute(
      `SELECT first_name as firstName, last_name as lastName, phone, email
       FROM contact
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [contactId, clinicId],
    );
    const contact = contactRows[0] || { firstName: null, lastName: null, phone: null, email: null };

    // Optional: load clinic name
    const [clinicRows]: any = await pool.execute(`SELECT name FROM clinic WHERE id = ? LIMIT 1`, [clinicId]);
    const clinicName = clinicRows[0]?.name || null;

    // Render message using provided template if any
    let renderedSubject: string | null = null;
    let renderedBody = "";
    if (templateId) {
      const vars = {
        patient_name: `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
        clinic_name: clinicName,
        appointment_date: null,
        treatment: null,
      } as any;

      const rendered = await (await import("../message-templates/message-templates.service.js")).messageTemplatesService.renderTemplate(clinicId, templateId, vars);
      renderedSubject = rendered.subject || null;
      renderedBody = rendered.body || "";
    } else {
      // Default generic missed-call follow-up
      renderedBody = `Hi ${contact.firstName || ""}. Sorry we missed your call - we'll call you back shortly or reply here to request a booking.`;
    }

    if (!renderedBody || !String(renderedBody).trim()) {
      throw ApiError.badRequest("Rendered message body is empty");
    }

    const smsId = uuidv4();
    const status = sendNow ? "sent" : "queued";
    const providerMessageId = sendNow ? "log-provider" : null;
    const providerResponse = sendNow ? JSON.stringify({ provider: "log" }) : null;

    await pool.execute(
      `INSERT INTO sms (id, clinic_id, contact_id, user_id, message, direction, status, call_id, call_followup, provider_message_id, provider_response)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [smsId, clinicId, contactId, userId || null, renderedBody, "outbound", status, callId, providerMessageId, providerResponse],
    );

    // Log timeline activity linking to the call and contact
    await logTimelineActivity({
      clinicId,
      contactId,
      userId,
      type: "SMS",
      metadata: buildTimelineMetadata({
        action: "missed_call.followup",
        source: "call",
        recordId: smsId,
        changes: { callId, templateId: templateId || null, status },
      }),
    });

    await logAuditEvent({ clinicId, userId, action: "MISSED_CALL_FOLLOWUP_CREATED", entityType: "sms", entityId: smsId, changes: { callId, templateId: templateId || null, status } });

    return {
      id: smsId,
      clinicId,
      contactId,
      callId,
      status,
      providerMessageId,
    };
  }

  async getCall(clinicId: string, callId: string) {
    const calls = await this.listCalls(clinicId);
    const call = calls.find((item: any) => item.id === callId);

    if (!call) {
      throw ApiError.notFound("Call not found");
    }

    return call;
  }

  async getRecordingDeletionRequest(clinicId: string, requestId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id as recordingDeletionRequestId,
              call_id as recordingDeletionCallId,
              status as recordingDeletionStatus,
              reason as recordingDeletionReason,
              requested_at as recordingDeletionRequestedAt,
              resolved_at as recordingDeletionResolvedAt
       FROM call_recording_deletion_request
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [requestId, clinicId],
    );
    const request = formatRecordingDeletionRequest(rows[0]);
    if (!request) throw ApiError.notFound("Recording deletion request not found");
    return request;
  }

  async exportCallsCsv(clinicId: string) {
    const calls = await this.listCalls(clinicId);
    const headers = [
      "id",
      "contactName",
      "phone",
      "direction",
      "outcome",
      "commercialOutcome",
      "duration",
      "missedCall",
      "recordingUrl",
      "notes",
      "createdAt",
    ];
    const rows = calls.map((call: any) => [
      call.id,
      call.contactName,
      call.phone,
      call.direction,
      call.outcome,
      call.commercialOutcome,
      call.duration,
      call.outcome === "no_answer" ? "true" : "false",
      call.recordingUrl,
      call.notes,
      call.createdAt,
    ]);
    return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
  }

  async updateCall(
    clinicId: string,
    userId: string,
    callId: string,
    data: UpdateCallDTO,
  ) {
    const existing = await this.getCallRow(clinicId, callId);
    const fields: string[] = [];
    const values: any[] = [];

    if (data.contactId !== undefined) {
      if (data.contactId) {
        await this.assertContactBelongsToClinic(clinicId, data.contactId);
      }
      fields.push("contact_id = ?");
      values.push(data.contactId);
    }
    if (data.assignedUserId !== undefined) {
      fields.push("user_id = ?");
      values.push(data.assignedUserId || null);
    }
    if (data.commercialOutcome !== undefined) {
      fields.push("outcome = ?");
      values.push(data.commercialOutcome || null);
      fields.push("disposition = ?");
      values.push(getDispositionForCommercialOutcome(data.commercialOutcome || null));
      fields.push("outcome_updated_by = ?");
      values.push(userId);
      fields.push("outcome_updated_at = CURRENT_TIMESTAMP");
    }
    if (data.notes !== undefined) {
      fields.push("notes = ?");
      values.push(data.notes || null);
    }
    if (data.transcript !== undefined) {
      fields.push("transcript = ?");
      values.push(data.transcript || null);
    }
    if (data.aiSummary !== undefined) {
      fields.push("ai_summary = ?");
      values.push(data.aiSummary || null);
      fields.push(data.aiSummary ? "summary_generated_at = CURRENT_TIMESTAMP" : "summary_generated_at = NULL");
    }
    if (data.sentiment !== undefined) {
      fields.push("sentiment = ?");
      values.push(data.sentiment || null);
    }
    if (data.bookingIntent !== undefined) {
      fields.push("booking_intent = ?");
      values.push(data.bookingIntent || null);
    }
    if (data.treatmentMentioned !== undefined) {
      fields.push("treatment_mentioned = ?");
      values.push(data.treatmentMentioned || null);
    }
    if (data.qualityScore !== undefined) {
      fields.push("quality_score = ?");
      values.push(data.qualityScore === null ? null : Number(data.qualityScore));
    }
    if (data.source !== undefined) {
      fields.push("source = ?");
      values.push(data.source || null);
    }
    if (data.missedRecoveryStatus !== undefined) {
      fields.push("missed_recovery_status = ?");
      values.push(data.missedRecoveryStatus || null);
      if (data.missedRecoveryStatus) {
        fields.push("missed_recovery_at = CURRENT_TIMESTAMP");
      }
    }
    if (data.consentCaptured !== undefined) {
      fields.push("consent_captured = ?");
      values.push(data.consentCaptured === true ? 1 : 0);
    }
    if (data.consentMethod !== undefined) {
      fields.push("consent_method = ?");
      values.push(data.consentMethod || null);
    }
    if (data.consentTimestamp !== undefined) {
      fields.push("consent_timestamp = ?");
      values.push(toMysqlDateTimeValue(data.consentTimestamp));
    }
    if (data.retentionDeadline !== undefined) {
      fields.push("retention_deadline = ?");
      values.push(toMysqlDateOnlyValue(data.retentionDeadline));
    }

    if (fields.length === 0) return this.getCall(clinicId, callId);

    values.push(callId, clinicId);
    await pool.execute(
      `UPDATE \` call \`
       SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "CALL_UPDATED",
      entityType: "call",
      entityId: callId,
      changes: { ...data },
    });

    await logTimelineActivity({
      clinicId,
      contactId: data.contactId || existing.contactId,
      userId,
      type: "Call",
      metadata: buildTimelineMetadata({
        action: "call.updated",
        source: "call",
        recordId: callId,
        changes: {
          commercialOutcome: data.commercialOutcome,
          notesChanged: data.notes !== undefined,
        },
      }),
    });

    return this.getCall(clinicId, callId);
  }

  async createRecordingDeletionRequest(
    clinicId: string,
    userId: string,
    callId: string,
    data: CreateRecordingDeletionRequestDTO = {},
  ) {
    const call = await this.getCall(clinicId, callId);
    if (!call.recordingUrl) {
      throw ApiError.badRequest("Call does not have a recording to delete.");
    }

    const [existingRows]: any = await pool.execute(
      `SELECT id
       FROM call_recording_deletion_request
       WHERE clinic_id = ?
         AND call_id = ?
         AND status IN ('requested', 'approved')
         AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId, callId],
    );
    if (existingRows[0]) {
      throw ApiError.conflict("A recording deletion request is already active for this call.");
    }

    const id = uuidv4();
    await pool.execute(
      `INSERT INTO call_recording_deletion_request
        (id, clinic_id, call_id, status, reason, requested_by)
       VALUES (?, ?, ?, 'requested', ?, ?)`,
      [id, clinicId, callId, data.reason || null, userId],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "CALL_RECORDING_DELETION_REQUESTED",
      entityType: "call_recording_deletion_request",
      entityId: id,
      changes: { callId, reason: data.reason || null },
    });

    return this.getRecordingDeletionRequest(clinicId, id);
  }

  async updateRecordingDeletionRequest(
    clinicId: string,
    userId: string,
    requestId: string,
    data: UpdateRecordingDeletionRequestDTO,
  ) {
    const fields = ["status = ?", "updated_at = CURRENT_TIMESTAMP"];
    const values: any[] = [data.status];

    if (data.reason !== undefined) {
      fields.push("reason = ?");
      values.push(data.reason || null);
    }
    if (["completed", "rejected", "cancelled"].includes(data.status)) {
      fields.push("resolved_by = ?");
      values.push(userId);
      fields.push("resolved_at = CURRENT_TIMESTAMP");
    } else {
      fields.push("resolved_by = NULL");
      fields.push("resolved_at = NULL");
    }

    values.push(requestId, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE call_recording_deletion_request
       SET ${fields.join(", ")}
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Recording deletion request not found");

    await logAuditEvent({
      clinicId,
      userId,
      action: "CALL_RECORDING_DELETION_REQUEST_UPDATED",
      entityType: "call_recording_deletion_request",
      entityId: requestId,
      changes: { ...data },
    });

    return this.getRecordingDeletionRequest(clinicId, requestId);
  }

  async generateCallIntelligence(clinicId: string, userId: string, callId: string) {
    const call = await this.getCall(clinicId, callId);
    const generation = await openAICallIntelligenceService.generate({
      contactName: call.contactName,
      direction: call.direction,
      duration: call.duration,
      notes: call.notes,
      outcome: call.commercialOutcome || call.outcome || null,
      source: call.source,
      transcript: call.transcript,
    });

    const updatedCall = await this.updateCall(clinicId, userId, callId, {
      aiSummary: generation.fields.aiSummary,
      bookingIntent: generation.fields.bookingIntent,
      qualityScore: generation.fields.qualityScore,
      sentiment: generation.fields.sentiment,
      treatmentMentioned: generation.fields.treatmentMentioned,
    });

    await logAuditEvent({
      clinicId,
      userId,
      action: "CALL_INTELLIGENCE_GENERATED",
      entityType: "call",
      entityId: callId,
      changes: {
        fallbackReason: generation.fallbackReason,
        model: generation.model,
        provider: generation.provider,
        responseId: generation.responseId,
      },
    });

    return updatedCall;
  }

  async transcribeCallRecording(
    clinicId: string,
    userId: string,
    callId: string,
    options: { generateIntelligence?: boolean } = {},
  ) {
    const call = await this.getCall(clinicId, callId);

    if (!call.recordingUrl) {
      throw ApiError.badRequest("Call does not have a recording to transcribe");
    }

    const transcription = await openAICallTranscriptionService.transcribe({
      contactName: call.contactName,
      direction: call.direction,
      duration: call.duration,
      notes: call.notes,
      outcome: call.commercialOutcome || call.outcome || null,
      recordingUrl: call.recordingUrl,
    });

    let updatedCall = await this.updateCall(clinicId, userId, callId, {
      transcript: transcription.transcript,
    });

    await logAuditEvent({
      clinicId,
      userId,
      action: "CALL_TRANSCRIPT_GENERATED",
      entityType: "call",
      entityId: callId,
      changes: {
        fallbackReason: transcription.fallbackReason,
        model: transcription.model,
        provider: transcription.provider,
      },
    });

    if (options.generateIntelligence !== false) {
      updatedCall = await this.generateCallIntelligence(clinicId, userId, callId);
    }

    return updatedCall;
  }

  async getCallSummary(clinicId: string, filters: CallDateFilters = {}) {
    const dateFilter = buildCallDateFilter(filters);
    const [rows]: any = await pool.execute(
      `SELECT COUNT(*) as totalCalls,
              SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inboundCalls,
              SUM(CASE WHEN missed_call = 1 THEN 1 ELSE 0 END) as missedCalls,
              SUM(CASE WHEN duration > 0 OR call_status = 'completed' THEN 1 ELSE 0 END) as connectedCalls,
              SUM(CASE WHEN outcome = 'booked_consult' THEN 1 ELSE 0 END) as bookedConsults
       FROM \` call \` cl
       WHERE cl.clinic_id = ? AND cl.deleted_at IS NULL${dateFilter.clause}`,
      [clinicId, ...dateFilter.values],
    );
    const row = rows[0] || {};
    const connectedCalls = Number(row.connectedCalls || 0);
    const bookedConsults = Number(row.bookedConsults || 0);

    return {
      totalCalls: Number(row.totalCalls || 0),
      inboundCalls: Number(row.inboundCalls || 0),
      missedCalls: Number(row.missedCalls || 0),
      connectedCalls,
      bookedConsults,
      callToBookingRate: connectedCalls > 0 ? Math.round((bookedConsults / connectedCalls) * 100) : 0,
    };
  }

  async getStaffCallMetrics(clinicId: string, filters: CallDateFilters = {}) {
    const dateFilter = buildCallDateFilter(filters);
    const [rows]: any = await pool.execute(
      `SELECT cl.user_id as userId,
              CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as userName,
              COUNT(*) as totalCalls,
              SUM(CASE WHEN cl.duration > 0 OR cl.call_status = 'completed' THEN 1 ELSE 0 END) as connectedCalls,
              SUM(CASE WHEN cl.outcome = 'booked_consult' THEN 1 ELSE 0 END) as bookedConsults,
              SUM(CASE WHEN cl.missed_call = 1 THEN 1 ELSE 0 END) as missedCalls,
              AVG(NULLIF(cl.duration, 0)) as averageDurationSeconds,
              SUM(CASE WHEN cl.quality_score IS NOT NULL THEN 1 ELSE 0 END) as scoredCalls,
              AVG(cl.quality_score) as averageQualityScore,
              SUM(CASE
                    WHEN cl.quality_score IS NOT NULL AND cl.quality_score < 70 THEN 1
                    WHEN cl.sentiment = 'negative' THEN 1
                    WHEN cl.booking_intent = 'none' AND cl.outcome <> 'booked_consult' THEN 1
                    ELSE 0
                  END) as coachingFlags
       FROM \` call \` cl
       LEFT JOIN user u ON u.id = cl.user_id
       WHERE cl.clinic_id = ? AND cl.deleted_at IS NULL${dateFilter.clause}
       GROUP BY cl.user_id, u.first_name, u.last_name
       ORDER BY totalCalls DESC`,
      [clinicId, ...dateFilter.values],
    );

    return rows.map((row: any) => {
      const connectedCalls = Number(row.connectedCalls || 0);
      const bookedConsults = Number(row.bookedConsults || 0);

      return {
        userId: row.userId,
        userName: row.userName?.trim() || "Unassigned",
        totalCalls: Number(row.totalCalls || 0),
        connectedCalls,
        bookedConsults,
        missedCalls: Number(row.missedCalls || 0),
        averageDurationSeconds: row.averageDurationSeconds === null || row.averageDurationSeconds === undefined ? null : Math.round(Number(row.averageDurationSeconds)),
        scoredCalls: Number(row.scoredCalls || 0),
        averageQualityScore: row.averageQualityScore === null || row.averageQualityScore === undefined ? null : Math.round(Number(row.averageQualityScore)),
        coachingFlags: Number(row.coachingFlags || 0),
        bookingRate: connectedCalls > 0 ? Math.round((bookedConsults / connectedCalls) * 100) : 0,
      };
    });
  }

  async getCallAnalyticsBreakdowns(clinicId: string, filters: CallDateFilters = {}) {
    const dateFilter = buildCallDateFilter(filters);
    const [rows]: any = await pool.execute(
      `SELECT 'sentiment' as categoryType,
              COALESCE(NULLIF(cl.sentiment, ''), 'unknown') as categoryKey,
              COALESCE(NULLIF(cl.sentiment, ''), 'Unknown') as label,
              COUNT(*) as calls,
              SUM(CASE WHEN cl.quality_score IS NOT NULL THEN 1 ELSE 0 END) as scoredCalls,
              AVG(cl.quality_score) as averageQualityScore,
              SUM(CASE
                    WHEN cl.quality_score IS NOT NULL AND cl.quality_score < 70 THEN 1
                    WHEN cl.sentiment = 'negative' THEN 1
                    WHEN cl.booking_intent = 'none' AND cl.outcome <> 'booked_consult' THEN 1
                    ELSE 0
                  END) as coachingFlags
       FROM \` call \` cl
       WHERE cl.clinic_id = ? AND cl.deleted_at IS NULL${dateFilter.clause}
       GROUP BY categoryKey
       UNION ALL
       SELECT 'booking_intent' as categoryType,
              COALESCE(NULLIF(cl.booking_intent, ''), 'unknown') as categoryKey,
              COALESCE(NULLIF(cl.booking_intent, ''), 'Unknown') as label,
              COUNT(*) as calls,
              SUM(CASE WHEN cl.quality_score IS NOT NULL THEN 1 ELSE 0 END) as scoredCalls,
              AVG(cl.quality_score) as averageQualityScore,
              SUM(CASE
                    WHEN cl.quality_score IS NOT NULL AND cl.quality_score < 70 THEN 1
                    WHEN cl.sentiment = 'negative' THEN 1
                    WHEN cl.booking_intent = 'none' AND cl.outcome <> 'booked_consult' THEN 1
                    ELSE 0
                  END) as coachingFlags
       FROM \` call \` cl
       WHERE cl.clinic_id = ? AND cl.deleted_at IS NULL${dateFilter.clause}
       GROUP BY categoryKey
       UNION ALL
       SELECT 'treatment' as categoryType,
              COALESCE(NULLIF(cl.treatment_mentioned, ''), 'unknown') as categoryKey,
              COALESCE(NULLIF(cl.treatment_mentioned, ''), 'Unknown') as label,
              COUNT(*) as calls,
              SUM(CASE WHEN cl.quality_score IS NOT NULL THEN 1 ELSE 0 END) as scoredCalls,
              AVG(cl.quality_score) as averageQualityScore,
              SUM(CASE
                    WHEN cl.quality_score IS NOT NULL AND cl.quality_score < 70 THEN 1
                    WHEN cl.sentiment = 'negative' THEN 1
                    WHEN cl.booking_intent = 'none' AND cl.outcome <> 'booked_consult' THEN 1
                    ELSE 0
                  END) as coachingFlags
       FROM \` call \` cl
       WHERE cl.clinic_id = ? AND cl.deleted_at IS NULL${dateFilter.clause}
       GROUP BY categoryKey
       UNION ALL
       SELECT 'outcome' as categoryType,
              COALESCE(NULLIF(cl.outcome, ''), 'unknown') as categoryKey,
              COALESCE(NULLIF(cl.outcome, ''), 'Unknown') as label,
              COUNT(*) as calls,
              SUM(CASE WHEN cl.quality_score IS NOT NULL THEN 1 ELSE 0 END) as scoredCalls,
              AVG(cl.quality_score) as averageQualityScore,
              SUM(CASE
                    WHEN cl.quality_score IS NOT NULL AND cl.quality_score < 70 THEN 1
                    WHEN cl.sentiment = 'negative' THEN 1
                    WHEN cl.booking_intent = 'none' AND cl.outcome <> 'booked_consult' THEN 1
                    ELSE 0
                  END) as coachingFlags
       FROM \` call \` cl
       WHERE cl.clinic_id = ? AND cl.deleted_at IS NULL${dateFilter.clause}
       GROUP BY categoryKey
       ORDER BY calls DESC, categoryType ASC
       LIMIT 40`,
      [
        clinicId,
        ...dateFilter.values,
        clinicId,
        ...dateFilter.values,
        clinicId,
        ...dateFilter.values,
        clinicId,
        ...dateFilter.values,
      ],
    );

    return rows.map((row: any) => ({
      categoryType: row.categoryType,
      categoryKey: row.categoryKey,
      label: humanizeCallBreakdownLabel(row.categoryType, row.label),
      calls: Number(row.calls || 0),
      scoredCalls: Number(row.scoredCalls || 0),
      averageQualityScore: row.averageQualityScore === null || row.averageQualityScore === undefined ? null : Math.round(Number(row.averageQualityScore)),
      coachingFlags: Number(row.coachingFlags || 0),
    }));
  }

  // Twilio status callbacks are idempotent by CallSid
  async handleTwilioCallWebhook(payload: Record<string, unknown>): Promise<TwilioWebhookResult> {
    const callPayload = normalizeTwilioCallPayload(payload);

    if (!callPayload.CallSid) {
      throw ApiError.badRequest("CallSid is required");
    }

    const trackingNumber = getTrackingNumber(callPayload);
    const clinicId = await this.findClinicIdByTrackingNumber(trackingNumber);
    if (!clinicId) {
      throw ApiError.badRequest("Twilio tracking number is not linked to a clinic");
    }

    const direction = getCallDirection(callPayload.Direction);
    const contactNumber = getContactNumber(callPayload);
    const contactId = await this.findOrCreateWebhookContact(clinicId, contactNumber);
    const duration = parseTwilioDuration(callPayload.CallDuration, callPayload.Duration);
    const missedCall = isMissedCall(callPayload.CallStatus, duration, direction);
    const existing = await this.findCallByTwilioSid(callPayload.CallSid);
    const callId = existing?.id || uuidv4();

    if (existing) {
      await pool.execute(
        `UPDATE \` call \`
         SET contact_id = ?,
             direction = ?,
             duration = ?,
             twilio_account_sid = ?,
             from_number = ?,
             to_number = ?,
             call_status = ?,
             answered_by = ?,
             started_at = COALESCE(?, started_at),
             ended_at = COALESCE(?, ended_at),
             missed_call = ?,
             tracking_number = ?,
             webhook_payload = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          contactId,
          direction,
          duration,
          callPayload.AccountSid || null,
          callPayload.From || null,
          callPayload.To || null,
          callPayload.CallStatus || null,
          callPayload.AnsweredBy || null,
          toMysqlDateTime(callPayload.StartTime),
          toMysqlDateTime(callPayload.EndTime),
          missedCall ? 1 : 0,
          trackingNumber,
          JSON.stringify(payload),
          callId,
        ],
      );
    } else {
      await pool.execute(
        `INSERT INTO \` call \`
          (id, clinic_id, contact_id, direction, duration, notes,
           twilio_call_sid, twilio_account_sid, from_number, to_number,
           call_status, answered_by, started_at, ended_at, missed_call,
           tracking_number, webhook_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          callId,
          clinicId,
          contactId,
          direction,
          duration,
          buildTwilioCallNote(callPayload.From, callPayload.To, callPayload.CallStatus),
          callPayload.CallSid,
          callPayload.AccountSid || null,
          callPayload.From || null,
          callPayload.To || null,
          callPayload.CallStatus || null,
          callPayload.AnsweredBy || null,
          toMysqlDateTime(callPayload.StartTime),
          toMysqlDateTime(callPayload.EndTime),
          missedCall ? 1 : 0,
          trackingNumber,
          JSON.stringify(payload),
        ],
      );

      await logTimelineActivity({
        clinicId,
        contactId,
        type: "Call",
        metadata: buildTimelineMetadata({
          action: "call.twilio_created",
          source: "call",
          recordId: callId,
          changes: {
            missedCall,
            twilioCallSid: callPayload.CallSid,
          },
        }),
      });
    }

    return {
      callId,
      clinicId,
      created: !existing,
      matched: true,
    };
  }

  async handleTwilioRecordingWebhook(payload: Record<string, unknown>): Promise<TwilioWebhookResult> {
    const recordingPayload = normalizeTwilioRecordingPayload(payload);

    if (!recordingPayload.CallSid || !recordingPayload.RecordingSid) {
      throw ApiError.badRequest("CallSid and RecordingSid are required");
    }

    const existing = await this.findCallByTwilioSid(recordingPayload.CallSid);
    if (!existing) {
      return {
        callId: null,
        clinicId: null,
        created: false,
        matched: false,
      };
    }

    await pool.execute(
      `UPDATE \` call \`
       SET recording_url = COALESCE(?, recording_url),
           recording_sid = ?,
           recording_status = ?,
           recording_duration = ?,
           recording_source = 'twilio',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        recordingPayload.RecordingUrl || null,
        recordingPayload.RecordingSid,
        recordingPayload.RecordingStatus || null,
        parseTwilioDuration(recordingPayload.RecordingDuration),
        existing.id,
      ],
    );

    return {
      callId: existing.id,
      clinicId: existing.clinicId,
      created: false,
      matched: true,
    };
  }

  private async findCallByTwilioSid(callSid: string) {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId
       FROM \` call \`
       WHERE twilio_call_sid = ? AND deleted_at IS NULL
       LIMIT 1`,
      [callSid],
    );

    return rows[0] || null;
  }

  private async getCallRow(clinicId: string, callId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id, contact_id as contactId
       FROM \` call \`
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [callId, clinicId],
    );

    if (!rows[0]) {
      throw ApiError.notFound("Call not found");
    }

    return rows[0];
  }

  private async assertContactBelongsToClinic(clinicId: string, contactId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM contact
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [contactId, clinicId],
    );

    if (!rows[0]) {
      throw ApiError.badRequest("Contact does not belong to this clinic");
    }
  }

  private async findClinicIdByTrackingNumber(rawNumber: string | null) {
    const normalizedNumber = normalizePhoneForLookup(rawNumber);
    if (!normalizedNumber) return null;

    const [trackingRows]: any = await pool.execute(
      `SELECT clinic_id as clinicId
       FROM call_tracking_number
       WHERE normalized_number = ? AND is_active = 1
       LIMIT 1`,
      [normalizedNumber],
    );
    if (trackingRows[0]?.clinicId) return trackingRows[0].clinicId;

    const [clinicRows]: any = await pool.execute(
      `SELECT id
       FROM clinic
       WHERE ${phoneSqlExpression("phone")} = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [normalizedNumber],
    );
    if (clinicRows[0]?.id) return clinicRows[0].id;

    const [integrationRows]: any = await pool.execute(
      `SELECT clinic_id as clinicId, config
       FROM integration
       WHERE type = 'twilio'
         AND is_active = 1
         AND deleted_at IS NULL`,
    );

    for (const row of integrationRows) {
      const config = parseJson(row.config, {});
      const configuredNumbers = [
        config.phone_number,
        config.tracking_number,
        config.twilio_number,
      ];

      if (configuredNumbers.some((number) => normalizePhoneForLookup(String(number || "")) === normalizedNumber)) {
        return row.clinicId;
      }
    }

    return null;
  }

  private async findOrCreateWebhookContact(clinicId: string, rawPhone: string | null) {
    const normalizedPhone = normalizePhoneForLookup(rawPhone);

    if (normalizedPhone) {
      const [rows]: any = await pool.execute(
        `SELECT id
         FROM contact
         WHERE clinic_id = ?
           AND deleted_at IS NULL
           AND ${phoneSqlExpression("phone")} = ?
         ORDER BY updated_at DESC
         LIMIT 1`,
        [clinicId, normalizedPhone],
      );

      if (rows[0]?.id) return rows[0].id;
    }

    const contactId = uuidv4();
    await pool.execute(
      `INSERT INTO contact
        (id, clinic_id, first_name, last_name, phone, tags, status, source, notes)
       VALUES (?, ?, 'Unknown', 'Caller', ?, ?, 'lead', 'twilio_call', ?)`,
      [
        contactId,
        clinicId,
        normalizedPhone,
        JSON.stringify(["twilio", "call"]),
        rawPhone ? `Created from Twilio call webhook for ${rawPhone}` : "Created from Twilio call webhook",
      ],
    );
    await slaService.initialiseContactSla(clinicId, contactId);

    return contactId;
  }
}

export const callsService = new CallsService();

function csvCell(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function getCallOutcome(status: string | null, duration: number, missedCall: boolean) {
  const normalizedStatus = status?.toLowerCase();

  if (missedCall) return "no_answer";
  if (normalizedStatus === "busy") return "busy";
  if (normalizedStatus === "canceled" || normalizedStatus === "cancelled") return "cancelled";
  if (duration > 0 || normalizedStatus === "completed") return "connected";
  return "no_answer";
}

function getCallDisposition(disposition: string | null, commercialOutcome: string | null, notes: string | null) {
  if (disposition) return disposition;
  if (commercialOutcome) return getDispositionForCommercialOutcome(commercialOutcome);
  return notes?.toLowerCase().includes("appointment") ? "booked" : "none";
}

function getDispositionForCommercialOutcome(commercialOutcome: string | null) {
  switch (commercialOutcome) {
    case "booked_consult":
      return "booked";
    case "asked_for_prices":
      return "info_given";
    case "follow_up_required":
    case "missed_no_answer":
      return "follow_up_needed";
    case "lost":
    case "not_suitable":
      return "not_interested";
    default:
      return "none";
  }
}

function buildTwilioCallNote(from: string | undefined, to: string | undefined, status: string | undefined) {
  return `Twilio ${status || "call"} from ${from || "unknown"} to ${to || "unknown"}`;
}

function parseJson(value: unknown, fallback: Record<string, unknown>) {
  if (!value) return fallback;
  if (typeof value === "object") return value as Record<string, unknown>;

  try {
    return JSON.parse(String(value)) as Record<string, unknown>;
  } catch {
    return fallback;
  }
}
