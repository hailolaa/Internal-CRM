import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import type { PoolConnection } from "mysql2/promise";
import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import logger from "../../utils/logger.js";
import { buildTimelineMetadata, insertTimelineActivity } from "../../utils/activity.js";
import { logAuditEvent } from "../../utils/audit.js";
import { slaService } from "../sla/sla.service.js";
import { normalizePhone } from "../contacts/contacts.normalizers.js";
import { phoneSqlExpression } from "../contacts/contacts.queries.js";
import {
  CLINICGROWER_SOURCE_SYSTEM,
  MISSED_CALL_RECOVERY_EVENT_TYPE,
  MISSED_CALL_RECOVERY_EVENT_VERSION,
  MISSED_CALL_RECOVERY_FALLBACK_QUEUE,
  type ClinicGrowerClientMappingPayload,
  type ClinicGrowerClientMappingRecord,
  type ClinicGrowerMissedCallEventPayload,
  type ClinicGrowerMissedCallIntakeResult,
  type MissedCallEventProcessingStatus,
  type MissedCallRecoveryListResponse,
  type MissedCallRecoveryRecord,
  type MissedCallRecoveryState,
  type MissedCallSlaStatus,
  type MissedCallState,
} from "./missed-call-recovery.types.js";

const validStates: MissedCallRecoveryState[] = ["attempted", "contacted", "booked", "closed_no_response"];
const terminalStates = new Set<MissedCallRecoveryState>(["booked", "closed_no_response"]);
const allowedTransitions: Record<MissedCallRecoveryState, MissedCallRecoveryState[]> = {
  attempted: ["attempted", "contacted", "booked", "closed_no_response"],
  contacted: ["contacted", "booked", "closed_no_response"],
  booked: ["booked"],
  closed_no_response: ["closed_no_response"],
};

function cleanString(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function normalizeSourceSystem(value: unknown) {
  return cleanString(value, 60)?.toLowerCase() || "";
}

function parseDate(value: unknown, field: string) {
  const cleaned = cleanString(value, 80);
  if (!cleaned) throw ApiError.badRequest(`${field} is required`);
  const date = new Date(cleaned);
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest(`${field} must be a valid ISO timestamp`);
  return date;
}

function toMysqlDateTime(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function toDateOnly(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function toIsoString(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function fullName(firstName?: string | null, lastName?: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function splitName(value: unknown) {
  const name = cleanString(value, 160);
  if (!name) return { firstName: null, lastName: null };
  const [firstName, ...rest] = name.split(/\s+/);
  return { firstName, lastName: rest.join(" ") || null };
}

function normalizeMissedCallState(value: unknown, voicemailState: unknown): MissedCallState | null {
  const raw = cleanString(value, 80)?.toLowerCase().replace(/[\s-]+/g, "_") || "";
  const voicemail = cleanString(voicemailState, 80)?.toLowerCase() || "";
  if (raw === "no_answer" || raw === "noanswer" || raw === "missed") return "no_answer";
  if (raw === "busy") return "busy";
  if (raw === "failed") return "failed";
  if (raw === "canceled" || raw === "cancelled") return "canceled";
  if (raw === "voicemail" || (voicemail && voicemail !== "none" && voicemail !== "not_present")) return "voicemail";
  return null;
}

function parseTimestampHeader(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    return new Date(numeric > 9_999_999_999 ? numeric : numeric * 1000);
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function timingSafeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

function expectedSignature(rawBody: Buffer, timestamp: string, secret: string) {
  return `sha256=${crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody.toString("utf8")}`).digest("hex")}`;
}

function safePayloadSummary(payload: NormalizedEventPayload) {
  return {
    eventType: payload.eventType,
    eventVersion: payload.eventVersion,
    clinicId: payload.clinicId,
    callId: payload.callId,
    providerCallSid: payload.providerCallSid,
    missedCallState: payload.missedCallState,
    voicemailState: payload.voicemailState,
    occurredAt: payload.occurredAt.toISOString(),
    recoverySlaTargetAt: payload.recoverySlaTargetAt.toISOString(),
    source: payload.source,
    acknowledgementStatus: payload.acknowledgementStatus,
    recoveryEligible: payload.recoveryEligible,
  };
}

function isDuplicateKeyError(error: unknown) {
  const code = (error as any)?.code;
  return code === "ER_DUP_ENTRY";
}

interface NormalizedEventPayload {
  eventId: string;
  eventType: typeof MISSED_CALL_RECOVERY_EVENT_TYPE;
  eventVersion: number;
  sourceSystem: typeof CLINICGROWER_SOURCE_SYSTEM;
  clinicId: string;
  tenantId: string | null;
  callId: string;
  providerCallSid: string;
  missedCallState: MissedCallState;
  voicemailState: string | null;
  callerNumber: string | null;
  callerNumberNormalized: string | null;
  trackingNumber: string | null;
  trackingNumberNormalized: string | null;
  source: string | null;
  occurredAt: Date;
  recoverySlaTargetAt: Date;
  idempotencyKey: string;
  recoveryEligible: boolean;
  contactIdentity: ClinicGrowerMissedCallEventPayload["contactIdentity"];
  acknowledgementStatus: string | null;
  acknowledgementSmsId: string | null;
  environment: string | null;
}

interface MappingResolution {
  status: "active" | "missing" | "inactive" | "rejected";
  reason: string;
  retryable: boolean;
  mapping?: {
    id: string;
    clinicId: string;
    clientAccountProfileId: string;
    clientClinicId: string;
    clientName: string;
    defaultOwnerUserId: string | null;
    accountManagerId: string | null;
    fallbackQueueLabel: string;
    ownerUserId: string | null;
    ownerLabel: string;
  };
}

interface ExistingEventRow {
  id: string;
  processingStatus: MissedCallEventProcessingStatus;
  recoveryId: string | null;
}

export class MissedCallRecoveryService {
  verifyClinicGrowerSignature(args: {
    rawBody: Buffer | undefined;
    signature: string | undefined;
    timestamp: string | undefined;
  }) {
    const secret = config.clinicGrowerEvents.signingSecret;
    if (!secret) {
      throw ApiError.serviceUnavailable("ClinicGrower event signing secret is not configured");
    }
    if (!args.rawBody || !Buffer.isBuffer(args.rawBody)) {
      throw ApiError.badRequest("Raw event body is required for signature validation");
    }
    if (!args.signature) throw ApiError.unauthorized("Missing ClinicGrower event signature");
    if (!args.timestamp) throw ApiError.unauthorized("Missing ClinicGrower event timestamp");

    const timestampDate = parseTimestampHeader(args.timestamp);
    if (!timestampDate) throw ApiError.unauthorized("Invalid ClinicGrower event timestamp");

    const ageMs = Math.abs(Date.now() - timestampDate.getTime());
    if (ageMs > config.clinicGrowerEvents.timestampToleranceSeconds * 1000) {
      throw ApiError.unauthorized("ClinicGrower event timestamp is outside the allowed replay window");
    }

    const expected = expectedSignature(args.rawBody, args.timestamp, secret);
    if (!timingSafeEqual(args.signature, expected)) {
      throw ApiError.unauthorized("Invalid ClinicGrower event signature");
    }
  }

  normalizePayload(body: unknown): NormalizedEventPayload {
    const payload = (body || {}) as Partial<ClinicGrowerMissedCallEventPayload>;
    const eventId = cleanString(payload.eventId, 120);
    const eventType = cleanString(payload.eventType, 100);
    const eventVersion = Number(payload.eventVersion);
    const sourceSystem = normalizeSourceSystem(payload.sourceSystem);
    const clinicId = cleanString(payload.clinicId, 100);
    const callId = cleanString(payload.callId, 120);
    const providerCallSid = cleanString(payload.providerCallSid, 120);
    const idempotencyKey = cleanString(payload.idempotencyKey, 160);
    const voicemailState = cleanString(payload.voicemailState, 80);
    const missedCallState = normalizeMissedCallState(payload.missedCallState, voicemailState);

    if (!eventId) throw ApiError.badRequest("eventId is required");
    if (eventType !== MISSED_CALL_RECOVERY_EVENT_TYPE) throw ApiError.badRequest("Unsupported ClinicGrower event type");
    if (eventVersion !== MISSED_CALL_RECOVERY_EVENT_VERSION) throw ApiError.badRequest("Unsupported ClinicGrower event version");
    if (sourceSystem !== CLINICGROWER_SOURCE_SYSTEM) throw ApiError.badRequest("Unsupported ClinicGrower source system");
    if (!clinicId) throw ApiError.badRequest("clinicId is required");
    if (!callId) throw ApiError.badRequest("callId is required");
    if (!providerCallSid) throw ApiError.badRequest("providerCallSid is required");
    if (!idempotencyKey) throw ApiError.badRequest("idempotencyKey is required");
    if (!missedCallState) throw ApiError.badRequest("missedCallState is not recovery eligible");

    const occurredAt = parseDate(payload.occurredAt, "occurredAt");
    const recoverySlaTargetAt = parseDate(payload.recoverySlaTargetAt, "recoverySlaTargetAt");
    if (recoverySlaTargetAt.getTime() < occurredAt.getTime()) {
      throw ApiError.badRequest("recoverySlaTargetAt must be after occurredAt");
    }
    if (recoverySlaTargetAt.getTime() - occurredAt.getTime() > 15 * 60 * 1000) {
      throw ApiError.badRequest("recoverySlaTargetAt must be within the 15-minute missed-call recovery SLA");
    }

    return {
      eventId,
      eventType: MISSED_CALL_RECOVERY_EVENT_TYPE,
      eventVersion,
      sourceSystem: CLINICGROWER_SOURCE_SYSTEM,
      clinicId,
      tenantId: cleanString(payload.tenantId, 100),
      callId,
      providerCallSid,
      missedCallState,
      voicemailState,
      callerNumber: cleanString(payload.callerNumber, 40),
      callerNumberNormalized: normalizePhone(payload.callerNumber),
      trackingNumber: cleanString(payload.trackingNumber, 40),
      trackingNumberNormalized: normalizePhone(payload.trackingNumber),
      source: cleanString(payload.source, 120),
      occurredAt,
      recoverySlaTargetAt,
      idempotencyKey,
      recoveryEligible: payload.recoveryEligible === true,
      contactIdentity: payload.contactIdentity || null,
      acknowledgementStatus: cleanString(payload.acknowledgementStatus, 80),
      acknowledgementSmsId: cleanString(payload.acknowledgementSmsId, 160),
      environment: cleanString(payload.environment || payload.sourceEnvironment || payload.tenantType, 80)?.toLowerCase() || null,
    };
  }

  async ingestClinicGrowerEvent(payload: NormalizedEventPayload): Promise<ClinicGrowerMissedCallIntakeResult> {
    const connection = await pool.getConnection();
    let createdContactId: string | null = null;

    try {
      await connection.beginTransaction();
      const existing = await this.findExistingEventForUpdate(connection, payload);

      if (existing && existing.processingStatus === "accepted" && existing.recoveryId) {
        const existingRecovery = await this.getRecoveryByIdForUpdate(connection, existing.recoveryId);
        await connection.commit();
        return {
          status: "duplicate",
          retryable: false,
          message: "Event was already processed",
          eventId: payload.eventId,
          recoveryId: existingRecovery?.id || existing.recoveryId,
          taskId: existingRecovery?.taskId || null,
          contactId: existingRecovery?.contactId || null,
        };
      }

      const mapping = await this.resolveMapping(connection, payload);
      if (!payload.recoveryEligible) {
        await this.upsertEvent(connection, existing, payload, "rejected", "Recovery eligibility was false", mapping.mapping?.id || null, null);
        await connection.commit();
        return this.noWorkResult(payload, "rejected", false, "Event was not recovery eligible");
      }

      if (mapping.status !== "active" || !mapping.mapping) {
        const eventStatus: MissedCallEventProcessingStatus =
          mapping.status === "missing" ? "mapping_required" : mapping.status === "inactive" ? "inactive_mapping" : "rejected";
        await this.upsertEvent(connection, existing, payload, eventStatus, mapping.reason, mapping.mapping?.id || null, null);
        await connection.commit();
        return this.noWorkResult(payload, eventStatus, mapping.retryable, mapping.reason);
      }

      const linkedContact = await this.findOrCreateContact(connection, mapping.mapping, payload);
      if (linkedContact.created) createdContactId = linkedContact.contactId;

      const recoveryId = uuidv4();
      const taskId = uuidv4();
      await this.createRecoveryTask(connection, taskId, recoveryId, mapping.mapping, linkedContact, payload);
      await this.createRecoveryRecord(connection, recoveryId, taskId, mapping.mapping, linkedContact.contactId, payload);
      await this.upsertEvent(connection, existing, payload, "accepted", "Recovery work created", mapping.mapping.id, recoveryId);
      await this.insertRecoveryCreatedTimeline(connection, recoveryId, taskId, mapping.mapping, linkedContact.contactId, payload);

      await connection.commit();
      if (createdContactId) {
        await this.initialiseContactSla(mapping.mapping.clinicId, createdContactId);
      }

      logger.info("ClinicGrower missed-call recovery accepted", {
        sourceEventId: payload.eventId,
        clinicGrowerClinicId: payload.clinicId,
        recoveryId,
        taskId,
      });

      return {
        status: "accepted",
        retryable: false,
        message: "Recovery work created",
        eventId: payload.eventId,
        recoveryId,
        taskId,
        contactId: linkedContact.contactId,
      };
    } catch (error) {
      await connection.rollback();
      if (isDuplicateKeyError(error)) {
        return this.getDuplicateResult(payload);
      }
      logger.warn("ClinicGrower missed-call recovery intake failed", {
        sourceEventId: payload.eventId,
        clinicGrowerClinicId: payload.clinicId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      connection.release();
    }
  }

  async listRecoveries(clinicId: string): Promise<MissedCallRecoveryListResponse> {
    const [rows]: any = await pool.execute(this.recoverySelectSql("r.clinic_id = ?"), [clinicId]);
    const records = rows.map((row: any) => this.mapRecovery(row));
    return {
      records,
      summary: {
        total: records.length,
        attempted: records.filter((record: MissedCallRecoveryRecord) => record.state === "attempted").length,
        contacted: records.filter((record: MissedCallRecoveryRecord) => record.state === "contacted").length,
        booked: records.filter((record: MissedCallRecoveryRecord) => record.state === "booked").length,
        closedNoResponse: records.filter((record: MissedCallRecoveryRecord) => record.state === "closed_no_response").length,
        dueSoon: records.filter((record: MissedCallRecoveryRecord) => record.slaStatus === "due_soon").length,
        overdue: records.filter((record: MissedCallRecoveryRecord) => record.slaStatus === "overdue").length,
        voicemail: records.filter((record: MissedCallRecoveryRecord) => record.missedCallState === "voicemail" || Boolean(record.voicemailState)).length,
      },
    };
  }

  async updateRecoveryState(
    clinicId: string,
    userId: string,
    recoveryId: string,
    nextState: MissedCallRecoveryState,
  ): Promise<MissedCallRecoveryRecord> {
    if (!validStates.includes(nextState)) throw ApiError.badRequest("Invalid recovery state");
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const [rows]: any = await connection.execute(
        `SELECT id, recovery_state as recoveryState, contact_id as contactId, task_id as taskId,
                recovery_sla_target_at as recoverySlaTargetAt
         FROM missed_call_recovery
         WHERE id = ? AND clinic_id = ?
         FOR UPDATE`,
        [recoveryId, clinicId],
      );
      const current = rows[0];
      if (!current) throw ApiError.notFound("Missed-call recovery item not found");

      const currentState = current.recoveryState as MissedCallRecoveryState;
      if (!allowedTransitions[currentState]?.includes(nextState)) {
        throw ApiError.badRequest(`Cannot move missed-call recovery from ${currentState} to ${nextState}`);
      }

      if (currentState !== nextState) {
        const now = new Date();
        const fields = ["recovery_state = ?", "updated_at = CURRENT_TIMESTAMP"];
        const values: any[] = [nextState];
        if (nextState === "contacted") fields.push("contacted_at = COALESCE(contacted_at, CURRENT_TIMESTAMP)");
        if (nextState === "booked") fields.push("booked_at = COALESCE(booked_at, CURRENT_TIMESTAMP)");
        if (nextState === "closed_no_response") fields.push("closed_no_response_at = COALESCE(closed_no_response_at, CURRENT_TIMESTAMP)");
        if (terminalStates.has(nextState)) {
          fields.push("completed_within_sla = ?");
          values.push(now.getTime() <= new Date(current.recoverySlaTargetAt).getTime() ? 1 : 0);
        }
        values.push(recoveryId, clinicId);

        await connection.execute(
          `UPDATE missed_call_recovery
           SET ${fields.join(", ")}
           WHERE id = ? AND clinic_id = ?`,
          values,
        );

        if (current.taskId) {
          await connection.execute(
            `UPDATE task
             SET status = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND clinic_id = ? AND is_internal = 1`,
            [
              terminalStates.has(nextState) ? "completed" : "pending",
              terminalStates.has(nextState) ? now : null,
              current.taskId,
              clinicId,
            ],
          );
        }

        await insertTimelineActivity(connection, {
          clinicId,
          contactId: current.contactId,
          userId,
          type: "StatusChange",
          metadata: buildTimelineMetadata({
            action: "missed_call_recovery.state_changed",
            source: "call",
            recordId: recoveryId,
            status: nextState,
            previousStatus: currentState,
          }),
        });
      }

      await connection.commit();
      await logAuditEvent({
        clinicId,
        userId,
        action: "MISSED_CALL_RECOVERY_STATE_UPDATED",
        entityType: "missed_call_recovery",
        entityId: recoveryId,
        changes: { state: nextState, previousState: currentState },
      });
      return this.getRecovery(clinicId, recoveryId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async listMappings(clinicId: string): Promise<ClinicGrowerClientMappingRecord[]> {
    const [rows]: any = await pool.execute(
      `SELECT ${this.mappingSelectColumns()}
       FROM clinicgrower_client_mapping m
       JOIN client_account_profile cap ON cap.id = m.client_account_profile_id
       JOIN clinic client ON client.id = cap.clinic_id AND client.deleted_at IS NULL
       LEFT JOIN user owner ON owner.id = m.default_owner_user_id
       WHERE m.clinic_id = ?
       ORDER BY m.is_active DESC, client.name ASC`,
      [clinicId],
    );
    return rows.map((row: any) => this.mapMapping(row));
  }

  async createMapping(
    clinicId: string,
    userId: string,
    payload: ClinicGrowerClientMappingPayload,
  ): Promise<ClinicGrowerClientMappingRecord> {
    const mappingPayload = this.normalizeMappingPayload(payload);
    await this.assertClientAccountAvailable(clinicId, mappingPayload.clientAccountProfileId);
    if (mappingPayload.defaultOwnerUserId) {
      await this.assertActiveWorkspaceUser(clinicId, mappingPayload.defaultOwnerUserId);
    }

    const id = uuidv4();
    await pool.execute(
      `INSERT INTO clinicgrower_client_mapping
        (id, clinic_id, client_account_profile_id, clinicgrower_clinic_id, clinicgrower_clinic_name,
         default_owner_user_id, fallback_queue_label, is_active, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        mappingPayload.clientAccountProfileId,
        mappingPayload.clinicGrowerClinicId,
        mappingPayload.clinicGrowerClinicName,
        mappingPayload.defaultOwnerUserId,
        mappingPayload.fallbackQueueLabel,
        mappingPayload.isActive ? 1 : 0,
        userId,
        userId,
      ],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "CLINICGROWER_CLIENT_MAPPING_CREATED",
      entityType: "clinicgrower_client_mapping",
      entityId: id,
      changes: {
        clientAccountProfileId: mappingPayload.clientAccountProfileId,
        clinicGrowerClinicId: mappingPayload.clinicGrowerClinicId,
        isActive: mappingPayload.isActive,
      },
    });

    return this.getMapping(clinicId, id);
  }

  async updateMapping(
    clinicId: string,
    userId: string,
    mappingId: string,
    payload: Partial<ClinicGrowerClientMappingPayload>,
  ): Promise<ClinicGrowerClientMappingRecord> {
    const fields: string[] = [];
    const values: any[] = [];

    if (payload.clientAccountProfileId !== undefined) {
      const clientAccountProfileId = cleanString(payload.clientAccountProfileId, 36);
      if (!clientAccountProfileId) throw ApiError.badRequest("clientAccountProfileId is required");
      await this.assertClientAccountAvailable(clinicId, clientAccountProfileId);
      fields.push("client_account_profile_id = ?");
      values.push(clientAccountProfileId);
    }
    if (payload.clinicGrowerClinicId !== undefined) {
      const clinicGrowerClinicId = cleanString(payload.clinicGrowerClinicId, 100);
      if (!clinicGrowerClinicId) throw ApiError.badRequest("clinicGrowerClinicId is required");
      fields.push("clinicgrower_clinic_id = ?");
      values.push(clinicGrowerClinicId);
    }
    if (payload.clinicGrowerClinicName !== undefined) {
      fields.push("clinicgrower_clinic_name = ?");
      values.push(cleanString(payload.clinicGrowerClinicName, 255));
    }
    if (payload.defaultOwnerUserId !== undefined) {
      const ownerId = cleanString(payload.defaultOwnerUserId, 36);
      if (ownerId) await this.assertActiveWorkspaceUser(clinicId, ownerId);
      fields.push("default_owner_user_id = ?");
      values.push(ownerId);
    }
    if (payload.fallbackQueueLabel !== undefined) {
      fields.push("fallback_queue_label = ?");
      values.push(cleanString(payload.fallbackQueueLabel, 120) || MISSED_CALL_RECOVERY_FALLBACK_QUEUE);
    }
    if (payload.isActive !== undefined) {
      fields.push("is_active = ?");
      values.push(payload.isActive ? 1 : 0);
    }

    if (fields.length === 0) return this.getMapping(clinicId, mappingId);
    fields.push("updated_by = ?", "updated_at = CURRENT_TIMESTAMP");
    values.push(userId, mappingId, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE clinicgrower_client_mapping
       SET ${fields.join(", ")}
       WHERE id = ? AND clinic_id = ?`,
      values,
    );
    if (result.affectedRows === 0) throw ApiError.notFound("ClinicGrower client mapping not found");

    await logAuditEvent({
      clinicId,
      userId,
      action: "CLINICGROWER_CLIENT_MAPPING_UPDATED",
      entityType: "clinicgrower_client_mapping",
      entityId: mappingId,
      changes: { ...payload },
    });

    return this.getMapping(clinicId, mappingId);
  }

  private async findExistingEventForUpdate(
    connection: PoolConnection,
    payload: NormalizedEventPayload,
  ): Promise<ExistingEventRow | null> {
    const [rows]: any = await connection.execute(
      `SELECT id,
              processing_status as processingStatus,
              recovery_id as recoveryId
       FROM clinicgrower_missed_call_event
       WHERE source_system = ?
         AND (source_event_id = ? OR source_idempotency_key = ?)
       LIMIT 1
       FOR UPDATE`,
      [payload.sourceSystem, payload.eventId, payload.idempotencyKey],
    );
    return rows[0] || null;
  }

  private async upsertEvent(
    connection: PoolConnection,
    existing: ExistingEventRow | null,
    payload: NormalizedEventPayload,
    status: MissedCallEventProcessingStatus,
    reason: string,
    mappingId: string | null,
    recoveryId: string | null,
  ) {
    const values = [
      payload.sourceSystem,
      payload.eventId,
      payload.eventType,
      payload.eventVersion,
      payload.idempotencyKey,
      payload.clinicId,
      payload.tenantId,
      payload.callId,
      payload.providerCallSid,
      payload.callerNumber,
      payload.callerNumberNormalized,
      payload.trackingNumber,
      payload.trackingNumberNormalized,
      payload.missedCallState,
      payload.voicemailState,
      toMysqlDateTime(payload.occurredAt),
      toMysqlDateTime(payload.recoverySlaTargetAt),
      status,
      reason.slice(0, 500),
      mappingId,
      recoveryId,
      JSON.stringify(safePayloadSummary(payload)),
      new Date(),
    ];

    if (existing) {
      await connection.execute(
        `UPDATE clinicgrower_missed_call_event
         SET source_event_type = ?,
             source_event_version = ?,
             clinicgrower_clinic_id = ?,
             clinicgrower_tenant_id = ?,
             clinicgrower_call_id = ?,
             provider_call_sid = ?,
             caller_number = ?,
             caller_number_normalized = ?,
             tracking_number = ?,
             tracking_number_normalized = ?,
             missed_call_state = ?,
             voicemail_state = ?,
             occurred_at = ?,
             recovery_sla_target_at = ?,
             processing_status = ?,
             processing_reason = ?,
             mapping_id = ?,
             recovery_id = ?,
             payload_summary = ?,
             processed_at = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          payload.eventType,
          payload.eventVersion,
          payload.clinicId,
          payload.tenantId,
          payload.callId,
          payload.providerCallSid,
          payload.callerNumber,
          payload.callerNumberNormalized,
          payload.trackingNumber,
          payload.trackingNumberNormalized,
          payload.missedCallState,
          payload.voicemailState,
          toMysqlDateTime(payload.occurredAt),
          toMysqlDateTime(payload.recoverySlaTargetAt),
          status,
          reason.slice(0, 500),
          mappingId,
          recoveryId,
          JSON.stringify(safePayloadSummary(payload)),
          new Date(),
          existing.id,
        ],
      );
      return existing.id;
    }

    const eventRowId = uuidv4();
    await connection.execute(
      `INSERT INTO clinicgrower_missed_call_event
        (id, source_system, source_event_id, source_event_type, source_event_version,
         source_idempotency_key, clinicgrower_clinic_id, clinicgrower_tenant_id,
         clinicgrower_call_id, provider_call_sid, caller_number, caller_number_normalized,
         tracking_number, tracking_number_normalized, missed_call_state, voicemail_state,
         occurred_at, recovery_sla_target_at, processing_status, processing_reason,
         mapping_id, recovery_id, payload_summary, processed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [eventRowId, ...values],
    );
    return eventRowId;
  }

  private async resolveMapping(connection: PoolConnection, payload: NormalizedEventPayload): Promise<MappingResolution> {
    if (payload.environment && ["demo", "test", "testing", "sandbox"].includes(payload.environment)) {
      return { status: "rejected", reason: "Demo or test ClinicGrower event rejected", retryable: false };
    }

    const [rows]: any = await connection.execute(
      `SELECT m.id,
              m.clinic_id as clinicId,
              m.client_account_profile_id as clientAccountProfileId,
              m.is_active as isActive,
              m.default_owner_user_id as defaultOwnerUserId,
              m.fallback_queue_label as fallbackQueueLabel,
              workspace.data_state as workspaceDataState,
              workspace.is_demo as workspaceIsDemo,
              cap.account_manager_id as accountManagerId,
              cap.client_status as clientStatus,
              client.id as clientClinicId,
              client.name as clientName,
              client.data_state as clientDataState,
              client.is_demo as clientIsDemo,
              CONCAT(COALESCE(default_owner.first_name, ''), ' ', COALESCE(default_owner.last_name, '')) as defaultOwnerName,
              default_membership.status as defaultOwnerMembershipStatus,
              CONCAT(COALESCE(manager.first_name, ''), ' ', COALESCE(manager.last_name, '')) as managerName,
              manager_membership.status as managerMembershipStatus
       FROM clinicgrower_client_mapping m
       JOIN clinic workspace ON workspace.id = m.clinic_id AND workspace.deleted_at IS NULL
       JOIN client_account_profile cap ON cap.id = m.client_account_profile_id
       JOIN clinic client ON client.id = cap.clinic_id AND client.deleted_at IS NULL
       LEFT JOIN user default_owner ON default_owner.id = m.default_owner_user_id AND default_owner.deleted_at IS NULL AND default_owner.status = 'active' AND default_owner.is_active = 1
       LEFT JOIN clinic_membership default_membership
         ON default_membership.user_id = default_owner.id
        AND default_membership.clinic_id = m.clinic_id
        AND default_membership.status = 'active'
       LEFT JOIN user manager ON manager.id = cap.account_manager_id AND manager.deleted_at IS NULL AND manager.status = 'active' AND manager.is_active = 1
       LEFT JOIN clinic_membership manager_membership
         ON manager_membership.user_id = manager.id
        AND manager_membership.clinic_id = m.clinic_id
        AND manager_membership.status = 'active'
       WHERE m.source_system = ?
         AND m.clinicgrower_clinic_id = ?
       LIMIT 1
       FOR UPDATE`,
      [payload.sourceSystem, payload.clinicId],
    );

    const row = rows[0];
    if (!row) {
      return { status: "missing", reason: "ClinicGrower clinic is not mapped to a Mission Control client account", retryable: true };
    }

    if (!row.isActive || row.clientStatus === "inactive" || row.clientStatus === "churned") {
      return { status: "inactive", reason: "ClinicGrower client mapping is inactive", retryable: false };
    }

    if (
      row.workspaceIsDemo ||
      row.clientIsDemo ||
      row.workspaceDataState === "demo" ||
      row.clientDataState === "demo" ||
      row.workspaceDataState === "roadmap" ||
      row.clientDataState === "roadmap"
    ) {
      return { status: "rejected", reason: "Demo, roadmap or test workspace cannot create production recovery work", retryable: false };
    }

    const defaultOwnerActive = row.defaultOwnerUserId && row.defaultOwnerMembershipStatus === "active";
    const managerActive = row.accountManagerId && row.managerMembershipStatus === "active";
    const ownerUserId = defaultOwnerActive ? row.defaultOwnerUserId : managerActive ? row.accountManagerId : null;
    const ownerLabel = defaultOwnerActive
      ? String(row.defaultOwnerName || "").trim()
      : managerActive
        ? String(row.managerName || "").trim()
        : row.fallbackQueueLabel || MISSED_CALL_RECOVERY_FALLBACK_QUEUE;

    return {
      status: "active",
      reason: "Mapped active client",
      retryable: false,
      mapping: {
        id: row.id,
        clinicId: row.clinicId,
        clientAccountProfileId: row.clientAccountProfileId,
        clientClinicId: row.clientClinicId,
        clientName: row.clientName,
        defaultOwnerUserId: row.defaultOwnerUserId || null,
        accountManagerId: row.accountManagerId || null,
        fallbackQueueLabel: row.fallbackQueueLabel || MISSED_CALL_RECOVERY_FALLBACK_QUEUE,
        ownerUserId,
        ownerLabel: ownerLabel || MISSED_CALL_RECOVERY_FALLBACK_QUEUE,
      },
    };
  }

  private async findOrCreateContact(
    connection: PoolConnection,
    mapping: NonNullable<MappingResolution["mapping"]>,
    payload: NormalizedEventPayload,
  ): Promise<{ contactId: string; contactName: string; created: boolean }> {
    if (payload.callerNumberNormalized) {
      const [rows]: any = await connection.execute(
        `SELECT id,
                first_name as firstName,
                last_name as lastName,
                account_name as accountName,
                phone
         FROM contact
         WHERE clinic_id = ?
           AND deleted_at IS NULL
           AND ${phoneSqlExpression("phone")} = ?
         ORDER BY updated_at DESC
         LIMIT 1`,
        [mapping.clinicId, payload.callerNumberNormalized],
      );

      if (rows[0]?.id) {
        await this.ensureClientContactLink(connection, mapping, rows[0].id);
        return {
          contactId: rows[0].id,
          contactName: fullName(rows[0].firstName, rows[0].lastName) || rows[0].phone || "Unknown caller",
          created: false,
        };
      }
    }

    const suppliedName = payload.contactIdentity?.patientName || payload.contactIdentity?.name;
    const split = {
      firstName: cleanString(payload.contactIdentity?.firstName, 100) || splitName(suppliedName).firstName || "Unknown",
      lastName: cleanString(payload.contactIdentity?.lastName, 100) || splitName(suppliedName).lastName || "Caller",
    };
    const contactId = uuidv4();
    await connection.execute(
      `INSERT INTO contact
        (id, clinic_id, account_name, first_name, last_name, email, phone,
         communication_permissions, phone_permission, sms_permission, tags,
         status, lead_status, source, permission_source, notes, last_contact_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, 'lead', 'new', 'clinicgrower_missed_call', 'ClinicGrower missed-call recovery', ?, ?)`,
      [
        contactId,
        mapping.clinicId,
        mapping.clientName,
        split.firstName,
        split.lastName,
        cleanString(payload.contactIdentity?.email, 255),
        payload.callerNumberNormalized || payload.callerNumber,
        JSON.stringify({ phone: true, email: false, sms: false, whatsapp: false }),
        JSON.stringify(["clinicgrower", "missed-call-recovery"]),
        "Created from a ClinicGrower missed-call recovery event.",
        toMysqlDateTime(payload.occurredAt),
      ],
    );
    await this.ensureClientContactLink(connection, mapping, contactId);
    return {
      contactId,
      contactName: fullName(split.firstName, split.lastName) || payload.callerNumberNormalized || "Unknown caller",
      created: true,
    };
  }

  private async ensureClientContactLink(
    connection: PoolConnection,
    mapping: NonNullable<MappingResolution["mapping"]>,
    contactId: string,
  ) {
    await connection.execute(
      `INSERT IGNORE INTO client_account_contact
        (id, clinic_id, client_account_profile_id, contact_id, created_by)
       VALUES (?, ?, ?, ?, NULL)`,
      [uuidv4(), mapping.clinicId, mapping.clientAccountProfileId, contactId],
    );
  }

  private async createRecoveryTask(
    connection: PoolConnection,
    taskId: string,
    recoveryId: string,
    mapping: NonNullable<MappingResolution["mapping"]>,
    contact: { contactId: string; contactName: string },
    payload: NormalizedEventPayload,
  ) {
    const isOverdue = Date.now() > payload.recoverySlaTargetAt.getTime();
    await connection.execute(
      `INSERT INTO task
        (id, clinic_id, is_internal, title, description, priority, status, category, board_key, service_type,
         client_account_profile_id, contact_id, contact_name, due_label, due_date, assigned_to, assigned_user_id,
         proof_reference, template_key, missed_task, escalation_flag)
       VALUES (?, ?, 1, ?, ?, 'high', 'pending', 'Missed Call Recovery', 'operations', 'other',
         ?, ?, ?, '15-minute callback SLA', ?, ?, ?, ?, 'clinicgrower_missed_call_recovery', 1, ?)`,
      [
        taskId,
        mapping.clinicId,
        `Missed call recovery: ${contact.contactName}`,
        [
          "ClinicGrower flagged an eligible missed inbound call.",
          "Call back before the SLA target and update the recovery state in Mission Control.",
          `Recovery ID: ${recoveryId}`,
        ].join("\n"),
        mapping.clientAccountProfileId,
        contact.contactId,
        contact.contactName,
        toDateOnly(payload.recoverySlaTargetAt),
        mapping.ownerLabel,
        mapping.ownerUserId,
        payload.providerCallSid,
        isOverdue ? 1 : 0,
      ],
    );
  }

  private async createRecoveryRecord(
    connection: PoolConnection,
    recoveryId: string,
    taskId: string,
    mapping: NonNullable<MappingResolution["mapping"]>,
    contactId: string,
    payload: NormalizedEventPayload,
  ) {
    await connection.execute(
      `INSERT INTO missed_call_recovery
        (id, clinic_id, client_account_profile_id, mapping_id, contact_id, task_id,
         source_system, source_event_id, source_idempotency_key, clinicgrower_clinic_id,
         clinicgrower_call_id, provider_call_sid, missed_call_state, voicemail_state,
         caller_number, caller_number_normalized, tracking_number, source, owner_user_id,
         owner_label, recovery_state, occurred_at, recovery_sla_target_at, attempted_at,
         acknowledgement_status, acknowledgement_sms_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'attempted', ?, ?, ?, ?, ?)`,
      [
        recoveryId,
        mapping.clinicId,
        mapping.clientAccountProfileId,
        mapping.id,
        contactId,
        taskId,
        payload.sourceSystem,
        payload.eventId,
        payload.idempotencyKey,
        payload.clinicId,
        payload.callId,
        payload.providerCallSid,
        payload.missedCallState,
        payload.voicemailState,
        payload.callerNumber,
        payload.callerNumberNormalized,
        payload.trackingNumber,
        payload.source,
        mapping.ownerUserId,
        mapping.ownerLabel,
        toMysqlDateTime(payload.occurredAt),
        toMysqlDateTime(payload.recoverySlaTargetAt),
        toMysqlDateTime(payload.occurredAt),
        payload.acknowledgementStatus,
        payload.acknowledgementSmsId,
      ],
    );
  }

  private async insertRecoveryCreatedTimeline(
    connection: PoolConnection,
    recoveryId: string,
    taskId: string,
    mapping: NonNullable<MappingResolution["mapping"]>,
    contactId: string,
    payload: NormalizedEventPayload,
  ) {
    await insertTimelineActivity(connection, {
      clinicId: mapping.clinicId,
      contactId,
      type: "Call",
      metadata: buildTimelineMetadata({
        action: "missed_call_recovery.created",
        source: "call",
        recordId: recoveryId,
        status: "attempted",
        changes: {
          taskId,
          clientAccountProfileId: mapping.clientAccountProfileId,
          clinicGrowerCallId: payload.callId,
          providerCallSid: payload.providerCallSid,
          missedCallState: payload.missedCallState,
          voicemailState: payload.voicemailState,
          recoverySlaTargetAt: payload.recoverySlaTargetAt.toISOString(),
        },
      }),
      timestamp: payload.occurredAt,
    });
    await insertTimelineActivity(connection, {
      clinicId: mapping.clinicId,
      contactId,
      type: "StatusChange",
      metadata: buildTimelineMetadata({
        action: "missed_call_recovery.state_changed",
        source: "call",
        recordId: recoveryId,
        status: "attempted",
        previousStatus: null,
      }),
      timestamp: payload.occurredAt,
    });
  }

  private async getDuplicateResult(payload: NormalizedEventPayload): Promise<ClinicGrowerMissedCallIntakeResult> {
    const [rows]: any = await pool.execute(
      `SELECT e.processing_status as processingStatus,
              e.processing_reason as processingReason,
              r.id as recoveryId,
              r.task_id as taskId,
              r.contact_id as contactId
       FROM clinicgrower_missed_call_event e
       LEFT JOIN missed_call_recovery r ON r.id = e.recovery_id
       WHERE e.source_system = ?
         AND (e.source_event_id = ? OR e.source_idempotency_key = ?)
       LIMIT 1`,
      [payload.sourceSystem, payload.eventId, payload.idempotencyKey],
    );
    const row = rows[0] || {};
    return {
      status: "duplicate",
      retryable: false,
      message: row.processingReason || "Event was already received",
      eventId: payload.eventId,
      recoveryId: row.recoveryId || null,
      taskId: row.taskId || null,
      contactId: row.contactId || null,
    };
  }

  private noWorkResult(
    payload: NormalizedEventPayload,
    status: MissedCallEventProcessingStatus,
    retryable: boolean,
    message: string,
  ): ClinicGrowerMissedCallIntakeResult {
    return {
      status,
      retryable,
      message,
      eventId: payload.eventId,
      recoveryId: null,
      taskId: null,
      contactId: null,
    };
  }

  private async getRecoveryByIdForUpdate(connection: PoolConnection, recoveryId: string) {
    const [rows]: any = await connection.execute(
      "SELECT id, task_id as taskId, contact_id as contactId FROM missed_call_recovery WHERE id = ? LIMIT 1 FOR UPDATE",
      [recoveryId],
    );
    return rows[0] || null;
  }

  private recoverySelectSql(where: string) {
    return `SELECT r.id,
                   r.clinic_id as clinicId,
                   r.client_account_profile_id as clientAccountProfileId,
                   client.id as clientClinicId,
                   client.name as clientName,
                   r.contact_id as contactId,
                   COALESCE(NULLIF(TRIM(CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, ''))), ''), c.phone, c.email, 'Unknown caller') as contactName,
                   c.phone as contactPhone,
                   r.task_id as taskId,
                   r.owner_user_id as ownerUserId,
                   r.owner_label as ownerLabel,
                   r.recovery_state as state,
                   r.occurred_at as occurredAt,
                   r.recovery_sla_target_at as recoverySlaTargetAt,
                   r.attempted_at as attemptedAt,
                   r.contacted_at as contactedAt,
                   r.booked_at as bookedAt,
                   r.closed_no_response_at as closedNoResponseAt,
                   r.completed_within_sla as completedWithinSla,
                   r.missed_call_state as missedCallState,
                   r.voicemail_state as voicemailState,
                   r.source,
                   r.tracking_number as trackingNumber,
                   r.provider_call_sid as providerCallSid,
                   r.clinicgrower_call_id as clinicGrowerCallId,
                   r.acknowledgement_status as acknowledgementStatus,
                   r.created_at as createdAt,
                   r.updated_at as updatedAt
            FROM missed_call_recovery r
            JOIN contact c ON c.id = r.contact_id AND c.deleted_at IS NULL
            JOIN client_account_profile cap ON cap.id = r.client_account_profile_id
            JOIN clinic client ON client.id = cap.clinic_id AND client.deleted_at IS NULL
            WHERE ${where}
            ORDER BY FIELD(r.recovery_state, 'attempted', 'contacted', 'booked', 'closed_no_response'),
                     r.recovery_sla_target_at ASC,
                     r.created_at DESC`;
  }

  private async getRecovery(clinicId: string, recoveryId: string): Promise<MissedCallRecoveryRecord> {
    const [rows]: any = await pool.execute(this.recoverySelectSql("r.clinic_id = ? AND r.id = ?"), [clinicId, recoveryId]);
    if (!rows[0]) throw ApiError.notFound("Missed-call recovery item not found");
    return this.mapRecovery(rows[0]);
  }

  private mapRecovery(row: any): MissedCallRecoveryRecord {
    const state = row.state as MissedCallRecoveryState;
    return {
      id: row.id,
      clinicId: row.clinicId,
      clientAccountProfileId: row.clientAccountProfileId,
      clientClinicId: row.clientClinicId || null,
      clientName: row.clientName || "Client account",
      contactId: row.contactId,
      contactName: row.contactName || "Unknown caller",
      contactPhone: row.contactPhone || null,
      taskId: row.taskId || null,
      ownerUserId: row.ownerUserId || null,
      ownerLabel: row.ownerLabel || MISSED_CALL_RECOVERY_FALLBACK_QUEUE,
      state,
      slaStatus: this.calculateSlaStatus(row.recoverySlaTargetAt, state, row.completedWithinSla),
      occurredAt: toIsoString(row.occurredAt)!,
      recoverySlaTargetAt: toIsoString(row.recoverySlaTargetAt)!,
      attemptedAt: toIsoString(row.attemptedAt),
      contactedAt: toIsoString(row.contactedAt),
      bookedAt: toIsoString(row.bookedAt),
      closedNoResponseAt: toIsoString(row.closedNoResponseAt),
      completedWithinSla: row.completedWithinSla === null || row.completedWithinSla === undefined ? null : Boolean(row.completedWithinSla),
      missedCallState: row.missedCallState,
      voicemailState: row.voicemailState || null,
      source: row.source || null,
      trackingNumber: row.trackingNumber || null,
      providerCallSid: row.providerCallSid,
      clinicGrowerCallId: row.clinicGrowerCallId,
      acknowledgementStatus: row.acknowledgementStatus || null,
      createdAt: toIsoString(row.createdAt)!,
      updatedAt: toIsoString(row.updatedAt)!,
    };
  }

  private calculateSlaStatus(
    value: unknown,
    state: MissedCallRecoveryState,
    completedWithinSla: unknown,
  ): MissedCallSlaStatus {
    if (terminalStates.has(state)) {
      return completedWithinSla ? "completed_within_sla" : "completed_after_sla";
    }
    const target = new Date(String(value));
    if (Number.isNaN(target.getTime())) return "due";
    const remainingMs = target.getTime() - Date.now();
    if (remainingMs < 0) return "overdue";
    if (remainingMs <= 5 * 60 * 1000) return "due_soon";
    return "due";
  }

  private async initialiseContactSla(clinicId: string, contactId: string) {
    try {
      await slaService.initialiseContactSla(clinicId, contactId);
    } catch (error) {
      logger.warn("Missed-call recovery contact SLA initialisation failed", {
        contactId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private normalizeMappingPayload(payload: ClinicGrowerClientMappingPayload): Required<ClinicGrowerClientMappingPayload> {
    const clientAccountProfileId = cleanString(payload.clientAccountProfileId, 36);
    const clinicGrowerClinicId = cleanString(payload.clinicGrowerClinicId, 100);
    if (!clientAccountProfileId) throw ApiError.badRequest("clientAccountProfileId is required");
    if (!clinicGrowerClinicId) throw ApiError.badRequest("clinicGrowerClinicId is required");
    return {
      clientAccountProfileId,
      clinicGrowerClinicId,
      clinicGrowerClinicName: cleanString(payload.clinicGrowerClinicName, 255),
      defaultOwnerUserId: cleanString(payload.defaultOwnerUserId, 36),
      fallbackQueueLabel: cleanString(payload.fallbackQueueLabel, 120) || MISSED_CALL_RECOVERY_FALLBACK_QUEUE,
      isActive: payload.isActive !== false,
    };
  }

  private async assertClientAccountAvailable(clinicId: string, clientAccountProfileId: string) {
    const [rows]: any = await pool.execute(
      `SELECT cap.id
       FROM client_account_profile cap
       JOIN clinic client ON client.id = cap.clinic_id AND client.deleted_at IS NULL
       WHERE cap.id = ?
         AND client.data_state <> 'demo'
       LIMIT 1`,
      [clientAccountProfileId],
    );
    if (!rows[0]) throw ApiError.badRequest("Client account profile is not available for ClinicGrower mapping");
  }

  private async assertActiveWorkspaceUser(clinicId: string, userId: string) {
    const [rows]: any = await pool.execute(
      `SELECT u.id
       FROM user u
       JOIN clinic_membership cm
         ON cm.user_id = u.id
        AND cm.clinic_id = ?
        AND cm.status = 'active'
       WHERE u.id = ?
         AND u.deleted_at IS NULL
         AND u.status = 'active'
         AND u.is_active = 1
       LIMIT 1`,
      [clinicId, userId],
    );
    if (!rows[0]) throw ApiError.badRequest("Default owner must be an active user in this workspace");
  }

  private async getMapping(clinicId: string, mappingId: string) {
    const [rows]: any = await pool.execute(
      `SELECT ${this.mappingSelectColumns()}
       FROM clinicgrower_client_mapping m
       JOIN client_account_profile cap ON cap.id = m.client_account_profile_id
       JOIN clinic client ON client.id = cap.clinic_id AND client.deleted_at IS NULL
       LEFT JOIN user owner ON owner.id = m.default_owner_user_id
       WHERE m.clinic_id = ? AND m.id = ?
       LIMIT 1`,
      [clinicId, mappingId],
    );
    if (!rows[0]) throw ApiError.notFound("ClinicGrower client mapping not found");
    return this.mapMapping(rows[0]);
  }

  private mappingSelectColumns() {
    return `m.id,
            m.clinic_id as clinicId,
            m.client_account_profile_id as clientAccountProfileId,
            client.id as clientClinicId,
            client.name as clientName,
            m.clinicgrower_clinic_id as clinicGrowerClinicId,
            m.clinicgrower_clinic_name as clinicGrowerClinicName,
            m.source_system as sourceSystem,
            m.default_owner_user_id as defaultOwnerUserId,
            NULLIF(TRIM(CONCAT(COALESCE(owner.first_name, ''), ' ', COALESCE(owner.last_name, ''))), '') as ownerName,
            m.fallback_queue_label as fallbackQueueLabel,
            m.is_active as isActive,
            m.created_at as createdAt,
            m.updated_at as updatedAt`;
  }

  private mapMapping(row: any): ClinicGrowerClientMappingRecord {
    return {
      id: row.id,
      clinicId: row.clinicId,
      clientAccountProfileId: row.clientAccountProfileId,
      clientClinicId: row.clientClinicId || null,
      clientName: row.clientName || "Client account",
      clinicGrowerClinicId: row.clinicGrowerClinicId,
      clinicGrowerClinicName: row.clinicGrowerClinicName || null,
      sourceSystem: row.sourceSystem || CLINICGROWER_SOURCE_SYSTEM,
      defaultOwnerUserId: row.defaultOwnerUserId || null,
      ownerName: row.ownerName || null,
      fallbackQueueLabel: row.fallbackQueueLabel || MISSED_CALL_RECOVERY_FALLBACK_QUEUE,
      isActive: Boolean(row.isActive),
      createdAt: toIsoString(row.createdAt)!,
      updatedAt: toIsoString(row.updatedAt)!,
    };
  }
}

export const missedCallRecoveryService = new MissedCallRecoveryService();
