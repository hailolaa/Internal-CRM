import { createHash, createHmac, timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import type {
  ClinicOsAlphaSyncReceipt,
  ConfigureFleetSourceInput,
  FleetCheckpointStatus,
  FleetDataState,
  FleetEndpointKind,
  FleetEventFailureInput,
  FleetIdentityConfidence,
  FleetIdentityMapping,
  FleetIdentityStatus,
  FleetIngestionCheckpoint,
  FleetIngestionReceipt,
  FleetIngestionSource,
  FleetOnboardingStatus,
  FleetQueueProcessResult,
  FleetQueuedEvent,
  FleetRecordStatus,
  FleetSyncAdministrationResponse,
  FleetSyncException,
  FleetSyncHealthRow,
  FleetSyncSlaStatus,
  FleetTenantRegistry,
  IngestFleetEventInput,
  RegisterFleetTenantInput,
  ResolveFleetIdentityInput,
} from "./fleet-ingestion.types.js";

const FLEET_EVENT_MAX_RETRIES = 5;
const FLEET_EVENT_BASE_BACKOFF_MS = 60_000;
const FLEET_EVENT_MAX_BACKOFF_MS = 15 * 60_000;

const DATA_STATES: FleetDataState[] = ["live", "demo", "preview", "partial", "provider_dependent", "roadmap"];
const RECORD_STATUSES: FleetRecordStatus[] = ["active", "paused", "inactive"];
const ONBOARDING_STATUSES: FleetOnboardingStatus[] = ["pending", "configured", "active", "blocked"];
const ENDPOINT_KINDS: FleetEndpointKind[] = ["webhook", "api_pull", "manual_import", "system"];
const IDENTITY_CONFIDENCE: FleetIdentityConfidence[] = ["known", "provisional", "needs_review"];
const IDENTITY_STATUSES: FleetIdentityStatus[] = ["active", "needs_review", "archived"];
const SAFE_EXCEPTION_ACTIONS = ["acknowledge", "resolve", "dismiss"] as const;
const CLINIC_OS_ALPHA_SYNC_CONTRACT_VERSION = "clinic_os.alpha_sync.v1";
const CLINIC_OS_ALPHA_SYNC_SOURCE_SYSTEM = "clinic_os";
const CLINIC_OS_ALPHA_SYNC_SOURCE_KEY = "alpha_sync";
const CLINIC_OS_ALPHA_SYNC_ENTITIES = ["lead", "appointment", "consultation", "integration_status", "clinic_summary"] as const;
const ALPHA_SYNC_ALERT_STATES = ["stale", "failed", "blocked"] as const;

type SyncExceptionAdminAction = typeof SAFE_EXCEPTION_ACTIONS[number];
type ClinicOsAlphaSyncEntity = typeof CLINIC_OS_ALPHA_SYNC_ENTITIES[number];

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 160);
}

function requireKey(value: unknown, field: string) {
  const cleaned = cleanString(value);
  if (!cleaned) throw ApiError.badRequest(`${field} is required.`);
  const normalized = normalizeKey(cleaned);
  if (!normalized) throw ApiError.badRequest(`${field} is invalid.`);
  return normalized;
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const cleaned = cleanString(value);
  if (!cleaned) return fallback;
  if (allowed.includes(cleaned as T)) return cleaned as T;
  throw ApiError.badRequest(`Unsupported value: ${cleaned}.`);
}

function iso(value: unknown) {
  return value ? new Date(value as string | number | Date).toISOString() : null;
}

function jsonValue(value: Record<string, unknown> | null | undefined) {
  return value ? JSON.stringify(value) : null;
}

function cleanReason(value: unknown, fallback: string) {
  const reason = cleanString(value) || fallback;
  return reason.slice(0, 1000);
}

function redactDiagnostic(value: unknown) {
  const text = String(value || "");
  if (!text) return null;
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b(?:token|secret|password|authorization|api[_-]?key)\b\s*[:=]\s*["']?[^"',\s]+/gi, "$1=[redacted]")
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, "[redacted-auth]")
    .replace(/\bsk_(?:live|test)_[A-Za-z0-9_]+\b/g, "[redacted-secret]")
    .slice(0, 1000);
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

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && nodeTimingSafeEqual(leftBuffer, rightBuffer);
}

function expectedClinicOsSignature(rawBody: Buffer, timestamp: string, secret: string) {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody.toString("utf8")}`).digest("hex")}`;
}

function parseUnixTimestamp(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return new Date(numeric > 9_999_999_999 ? numeric : numeric * 1000);
}

function assertPlainObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw ApiError.badRequest(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertString(value: unknown, field: string, max = 255) {
  const cleaned = cleanString(value);
  if (!cleaned) throw ApiError.badRequest(`${field} is required.`);
  return cleaned.slice(0, max);
}

function assertIsoDate(value: unknown, field: string) {
  const cleaned = assertString(value, field, 80);
  const date = new Date(cleaned);
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest(`${field} must be a valid ISO date.`);
  return date.toISOString();
}

function alphaDataState(value: unknown): FleetDataState {
  return pickEnum(value, DATA_STATES, "provider_dependent");
}

function alphaEntity(value: unknown): ClinicOsAlphaSyncEntity {
  const cleaned = assertString(value, "event.entity", 80);
  if (!CLINIC_OS_ALPHA_SYNC_ENTITIES.includes(cleaned as ClinicOsAlphaSyncEntity)) {
    throw ApiError.badRequest(`Unsupported Clinic OS alpha sync entity: ${cleaned}.`);
  }
  return cleaned as ClinicOsAlphaSyncEntity;
}

function normalizeAlphaSummary(value: unknown) {
  const summary = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const safe: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(summary)) {
    if (raw === null || typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
      safe[key] = typeof raw === "string" ? redactDiagnostic(raw) : raw;
    }
  }
  return safe;
}

function alphaRecordState(entity: string, summary: Record<string, unknown>) {
  const value = entity === "lead" ? summary.responseState : summary.dataFreshness;
  return typeof value === "string" ? value : null;
}

function validateAlphaPayloadHash(payload: Record<string, unknown>) {
  const expectedHash = assertString(payload.payloadHash, "payloadHash", 64);
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) throw ApiError.badRequest("payloadHash is invalid.");
  const { payloadHash: _payloadHash, ...withoutHash } = payload;
  const actualHash = sha256(stableStringify(withoutHash));
  if (actualHash !== expectedHash) throw ApiError.badRequest("Clinic OS alpha sync payload hash does not match the signed payload.");
  return expectedHash;
}

function toTenant(row: any): FleetTenantRegistry {
  return {
    id: row.id,
    clinicId: row.clinicId,
    tenantKey: row.tenantKey,
    displayName: row.displayName,
    dataState: row.dataState,
    status: row.status,
    onboardingStatus: row.onboardingStatus,
    registeredAt: iso(row.registeredAt)!,
    lastSeenAt: iso(row.lastSeenAt),
  };
}

function toSource(row: any): FleetIngestionSource {
  return {
    id: row.id,
    clinicId: row.clinicId,
    tenantRegistryId: row.tenantRegistryId,
    sourceSystem: row.sourceSystem,
    sourceKey: row.sourceKey,
    sourceLabel: row.sourceLabel,
    status: row.status,
    dataState: row.dataState,
    endpointKind: row.endpointKind,
    checkpoint: row.checkpoint || null,
    lastIngestedAt: iso(row.lastIngestedAt),
  };
}

function toIdentity(row: any): FleetIdentityMapping {
  return {
    id: row.id,
    clinicId: row.clinicId,
    sourceSystem: row.sourceSystem,
    sourceEntity: row.sourceEntity,
    sourceRecordId: row.sourceRecordId,
    identityKey: row.identityKey,
    targetType: row.targetType || null,
    targetId: row.targetId || null,
    confidence: row.confidence,
    status: row.status,
    payloadHash: row.payloadHash || null,
    firstSeenAt: iso(row.firstSeenAt)!,
    lastSeenAt: iso(row.lastSeenAt)!,
  };
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toQueuedEvent(row: any): FleetQueuedEvent {
  return {
    id: row.id,
    clinicId: row.clinicId,
    sourceId: row.sourceId,
    sourceSystem: row.sourceSystem,
    sourceKey: row.sourceKey,
    sourceEntity: row.sourceEntity,
    sourceRecordId: row.sourceRecordId || null,
    providerEventId: row.providerEventId || null,
    idempotencyKey: row.idempotencyKey,
    payloadHash: row.payloadHash,
    processingStatus: row.processingStatus,
    duplicateOf: null,
    retryCount: Number(row.retryCount || 0),
    payloadSummary: parseJsonObject(row.payloadSummary),
  };
}

function toCheckpoint(row: any): FleetIngestionCheckpoint {
  return {
    id: row.id,
    clinicId: row.clinicId,
    sourceId: row.sourceId,
    sourceSystem: row.sourceSystem,
    sourceKey: row.sourceKey,
    syncStatus: row.syncStatus,
    checkpoint: row.checkpoint || null,
    lastEventAt: iso(row.lastEventAt),
    lastProcessedEventAt: iso(row.lastProcessedEventAt),
    lastError: row.lastError || null,
    retryingCount: Number(row.retryingCount || 0),
    deadLetterCount: Number(row.deadLetterCount || 0),
  };
}

function toSyncStatus(row: any): FleetCheckpointStatus {
  if (row.tenantOnboardingStatus === "blocked") return "blocked";
  if (row.sourceStatus !== "active") return "paused";
  if (Number(row.deadLetterCount || 0) > 0) return "dead_letter";
  if (Number(row.retryingCount || 0) > 0) return "retrying";
  if (Number(row.openReconciliationIssues || 0) > 0) return "reconciliation_needed";
  if (Number(row.openFreshnessAlerts || 0) > 0) return "delayed";
  if (!row.lastEventAt && !row.lastProcessedEventAt && !row.lastIngestedAt) return "unknown";
  return row.syncStatus || "healthy";
}

function toSlaStatus(row: any, syncStatus: FleetCheckpointStatus): FleetSyncSlaStatus {
  if (row.sourceDataState === "roadmap" || row.sourceStatus !== "active" || syncStatus === "blocked") return "not_applicable";
  if (syncStatus === "unknown") return "at_risk";
  if (syncStatus === "dead_letter" || syncStatus === "delayed" || Number(row.openFreshnessAlerts || 0) > 0) return "breached";
  if (syncStatus === "retrying" || syncStatus === "reconciliation_needed" || Number(row.openReconciliationIssues || 0) > 0) return "at_risk";
  return "met";
}

function toSyncHealthRow(row: any): FleetSyncHealthRow {
  const syncStatus = toSyncStatus(row);
  const slaStatus = toSlaStatus(row, syncStatus);
  const threshold = row.slaTargetMinutes === null || row.slaTargetMinutes === undefined
    ? null
    : Number(row.slaTargetMinutes);
  const observedLag = row.observedLagMinutes === null || row.observedLagMinutes === undefined
    ? null
    : Number(row.observedLagMinutes);

  return {
    clinicId: row.clinicId,
    clinicName: row.clinicName,
    tenantId: row.tenantId,
    tenantKey: row.tenantKey,
    tenantName: row.tenantName,
    tenantDataState: row.tenantDataState,
    tenantStatus: row.tenantStatus,
    tenantOnboardingStatus: row.tenantOnboardingStatus,
    sourceId: row.sourceId,
    sourceSystem: row.sourceSystem,
    sourceKey: row.sourceKey,
    sourceLabel: row.sourceLabel,
    sourceDataState: row.sourceDataState,
    sourceStatus: row.sourceStatus,
    endpointKind: row.endpointKind,
    syncStatus,
    checkpoint: row.checkpoint || null,
    lastIngestedAt: iso(row.lastIngestedAt),
    lastEventAt: iso(row.lastEventAt),
    lastProcessedEventAt: iso(row.lastProcessedEventAt),
    latestSuccessfulSyncAt: iso(row.latestSuccessfulSyncAt || row.lastProcessedEventAt),
    latestFailedSyncAt: iso(row.latestFailedSyncAt),
    lastError: redactDiagnostic(row.lastError),
    retryingCount: Number(row.retryingCount || 0),
    deadLetterCount: Number(row.deadLetterCount || 0),
    openFreshnessAlerts: Number(row.openFreshnessAlerts || 0),
    openReconciliationIssues: Number(row.openReconciliationIssues || 0),
    slaStatus,
    slaTargetMinutes: threshold,
    observedLagMinutes: observedLag,
  };
}

function toSyncException(row: any): FleetSyncException {
  return {
    id: row.id,
    clinicId: row.clinicId,
    clinicName: row.clinicName,
    sourceId: row.sourceId || null,
    sourceSystem: row.sourceSystem || null,
    sourceKey: row.sourceKey || null,
    sourceLabel: row.sourceLabel || null,
    dataState: row.dataState || null,
    type: row.type,
    severity: row.severity,
    status: row.status,
    title: row.title,
    detail: row.detail,
    detectedAt: iso(row.detectedAt),
    action: row.action,
    availableActions: row.availableActions ? String(row.availableActions).split(",").filter(Boolean) as FleetSyncException["availableActions"] : [row.action],
    correlationId: row.correlationId || null,
  };
}

export class FleetIngestionService {
  verifyClinicOsAlphaSyncSignature(args: {
    rawBody: Buffer | undefined;
    signature: string | undefined;
    timestamp: string | undefined;
  }) {
    const secret = config.clinicGrowerEvents.signingSecret;
    if (!secret) throw ApiError.serviceUnavailable("ClinicGrower event signing secret is not configured");
    if (!args.rawBody || !Buffer.isBuffer(args.rawBody)) {
      throw ApiError.badRequest("Raw Clinic OS sync body is required for signature validation");
    }
    if (!args.signature) throw ApiError.unauthorized("Missing Clinic OS sync signature");
    if (!args.timestamp) throw ApiError.unauthorized("Missing Clinic OS sync timestamp");

    const timestampDate = parseUnixTimestamp(args.timestamp);
    if (!timestampDate) throw ApiError.unauthorized("Invalid Clinic OS sync timestamp");
    const ageMs = Math.abs(Date.now() - timestampDate.getTime());
    if (ageMs > config.clinicGrowerEvents.timestampToleranceSeconds * 1000) {
      throw ApiError.unauthorized("Clinic OS sync timestamp is outside the allowed replay window");
    }

    const expected = expectedClinicOsSignature(args.rawBody, args.timestamp, secret);
    if (!timingSafeEqual(args.signature, expected)) {
      throw ApiError.unauthorized("Invalid Clinic OS sync signature");
    }
  }

  async ingestClinicOsAlphaSync(input: {
    payload: unknown;
    rawBody: Buffer | undefined;
    signature: string | undefined;
    timestamp: string | undefined;
  }): Promise<ClinicOsAlphaSyncReceipt> {
    this.verifyClinicOsAlphaSyncSignature(input);
    const payload = assertPlainObject(input.payload, "payload");
    if (payload.contractVersion !== CLINIC_OS_ALPHA_SYNC_CONTRACT_VERSION) {
      throw ApiError.badRequest("Unsupported Clinic OS alpha sync contract version.");
    }
    if (payload.sourceSystem !== CLINIC_OS_ALPHA_SYNC_SOURCE_SYSTEM) {
      throw ApiError.badRequest("Unsupported Clinic OS alpha sync source system.");
    }

    const payloadHash = validateAlphaPayloadHash(payload);
    assertIsoDate(payload.generatedAt, "generatedAt");
    const clinic = assertPlainObject(payload.clinic, "clinic");
    const clinicId = assertString(clinic.clinicId, "clinic.clinicId", 100);
    const tenantKey = assertString(clinic.tenantKey, "clinic.tenantKey", 160);
    const displayName = assertString(clinic.displayName, "clinic.displayName", 255);
    const dataState = alphaDataState(clinic.dataState);
    if (!Array.isArray(payload.events)) throw ApiError.badRequest("events must be an array.");
    if (payload.events.length === 0) throw ApiError.badRequest("Clinic OS alpha sync requires at least one event.");

    const source = await this.configureSource({
      clinicId,
      tenantKey,
      displayName,
      dataState,
      sourceSystem: CLINIC_OS_ALPHA_SYNC_SOURCE_SYSTEM,
      sourceKey: CLINIC_OS_ALPHA_SYNC_SOURCE_KEY,
      sourceLabel: "Clinic OS alpha sync",
      endpointKind: "webhook",
      checkpoint: assertString(payload.generatedAt, "generatedAt", 80),
      metadata: {
        contractVersion: CLINIC_OS_ALPHA_SYNC_CONTRACT_VERSION,
        payloadHash,
      },
    });

    let acceptedEvents = 0;
    let duplicateEvents = 0;
    let freshnessAlerts = 0;
    for (const rawEvent of payload.events) {
      const event = assertPlainObject(rawEvent, "event");
      const entity = alphaEntity(event.entity);
      const sourceRecordId = assertString(event.sourceId, "event.sourceId", 160);
      const providerEventId = assertString(event.idempotencyKey, "event.idempotencyKey", 500);
      const eventPayloadHash = assertString(event.payloadHash, "event.payloadHash", 64);
      assertIsoDate(event.occurredAt, "event.occurredAt");
      const summary = normalizeAlphaSummary(event.summary);

      await this.resolveIdentity({
        clinicId,
        sourceSystem: CLINIC_OS_ALPHA_SYNC_SOURCE_SYSTEM,
        sourceEntity: entity,
        sourceRecordId,
        confidence: "provisional",
        payload: { payloadHash: eventPayloadHash, summary },
        metadata: {
          contractVersion: CLINIC_OS_ALPHA_SYNC_CONTRACT_VERSION,
          payloadHash,
        },
      });

      const receipt = await this.ingestEvent({
        clinicId,
        sourceSystem: CLINIC_OS_ALPHA_SYNC_SOURCE_SYSTEM,
        sourceKey: CLINIC_OS_ALPHA_SYNC_SOURCE_KEY,
        sourceEntity: entity,
        sourceRecordId,
        providerEventId,
        payload: {
          contractVersion: CLINIC_OS_ALPHA_SYNC_CONTRACT_VERSION,
          payloadHash: eventPayloadHash,
          generatedAt: payload.generatedAt,
          summary,
        },
        payloadSummary: {
          ...summary,
          entity,
          sourceId: sourceRecordId,
          upstreamPayloadHash: payloadHash,
        },
      });

      if (receipt.processingStatus === "duplicate") {
        duplicateEvents += 1;
        continue;
      }
      acceptedEvents += 1;
      await this.markEventProcessed(clinicId, receipt.id, { checkpoint: assertString(payload.generatedAt, "generatedAt", 80) });

      const state = alphaRecordState(entity, summary);
      if (state && ALPHA_SYNC_ALERT_STATES.includes(state as typeof ALPHA_SYNC_ALERT_STATES[number])) {
        await this.recordAlphaFreshnessAlert(clinicId, source.id, {
          entity,
          sourceRecordId,
          state,
          alertKey: `clinic_os_alpha_sync:${providerEventId}:freshness`,
          targetMinutes: Number((payload.summary as any)?.sla?.targetMinutes || 15),
        });
        freshnessAlerts += 1;
      }
    }

    return {
      accepted: true,
      contractVersion: CLINIC_OS_ALPHA_SYNC_CONTRACT_VERSION,
      clinicId,
      tenantKey,
      sourceSystem: CLINIC_OS_ALPHA_SYNC_SOURCE_SYSTEM,
      sourceKey: CLINIC_OS_ALPHA_SYNC_SOURCE_KEY,
      payloadHash,
      receivedEvents: payload.events.length,
      acceptedEvents,
      duplicateEvents,
      freshnessAlerts,
    };
  }

  async registerTenant(input: RegisterFleetTenantInput): Promise<FleetTenantRegistry> {
    await this.ensureClinicExists(input.clinicId);
    const tenantKey = normalizeKey(cleanString(input.tenantKey) || input.clinicId);
    const displayName = cleanString(input.displayName) || await this.getClinicName(input.clinicId);
    const dataState = pickEnum(input.dataState, DATA_STATES, "provider_dependent");
    const status = pickEnum(input.status, RECORD_STATUSES, "active");
    const onboardingStatus = pickEnum(input.onboardingStatus, ONBOARDING_STATUSES, status === "active" ? "active" : "pending");
    const id = uuidv4();

    const [keyRows]: any = await pool.execute(
      `SELECT clinic_id as clinicId FROM fleet_tenant_registry WHERE tenant_key = ? AND clinic_id <> ? LIMIT 1`,
      [tenantKey, input.clinicId],
    );
    if (keyRows[0]) throw ApiError.badRequest("Fleet tenant key is already assigned to another clinic.");

    await pool.execute(
      `INSERT INTO fleet_tenant_registry
        (id, clinic_id, tenant_key, display_name, data_state, status, onboarding_status, last_seen_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
       ON DUPLICATE KEY UPDATE
         tenant_key = VALUES(tenant_key),
         display_name = VALUES(display_name),
         data_state = VALUES(data_state),
         status = VALUES(status),
         onboarding_status = VALUES(onboarding_status),
         last_seen_at = CURRENT_TIMESTAMP,
         metadata = VALUES(metadata)`,
      [id, input.clinicId, tenantKey, displayName, dataState, status, onboardingStatus, jsonValue(input.metadata)],
    );

    return this.getTenantByClinic(input.clinicId);
  }

  async configureSource(input: ConfigureFleetSourceInput): Promise<FleetIngestionSource> {
    const tenantInput: RegisterFleetTenantInput = {
      clinicId: input.clinicId,
      onboardingStatus: input.onboardingStatus || "configured",
    };
    if (input.tenantKey !== undefined) tenantInput.tenantKey = input.tenantKey;
    if (input.displayName !== undefined) tenantInput.displayName = input.displayName;
    if (input.dataState !== undefined) tenantInput.dataState = input.dataState;
    if (input.status !== undefined) tenantInput.status = input.status;
    if (input.metadata !== undefined) tenantInput.metadata = input.metadata;
    const tenant = await this.registerTenant(tenantInput);
    const sourceSystem = requireKey(input.sourceSystem, "sourceSystem");
    const sourceKey = requireKey(input.sourceKey, "sourceKey");
    const sourceLabel = cleanString(input.sourceLabel) || sourceKey;
    const status = pickEnum(input.status, RECORD_STATUSES, "active");
    const dataState = pickEnum(input.dataState, DATA_STATES, tenant.dataState);
    const endpointKind = pickEnum(input.endpointKind, ENDPOINT_KINDS, "webhook");
    const id = uuidv4();

    await pool.execute(
      `INSERT INTO fleet_ingestion_source
        (id, clinic_id, tenant_registry_id, source_system, source_key, source_label,
         status, data_state, endpoint_kind, checkpoint, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         tenant_registry_id = VALUES(tenant_registry_id),
         source_label = VALUES(source_label),
         status = VALUES(status),
         data_state = VALUES(data_state),
         endpoint_kind = VALUES(endpoint_kind),
         checkpoint = VALUES(checkpoint),
         metadata = VALUES(metadata)`,
      [
        id,
        input.clinicId,
        tenant.id,
        sourceSystem,
        sourceKey,
        sourceLabel,
        status,
        dataState,
        endpointKind,
        cleanString(input.checkpoint),
        jsonValue(input.metadata),
      ],
    );

    return this.getSource(input.clinicId, sourceSystem, sourceKey);
  }

  async listSources(clinicId: string): Promise<FleetIngestionSource[]> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, tenant_registry_id as tenantRegistryId,
              source_system as sourceSystem, source_key as sourceKey, source_label as sourceLabel,
              status, data_state as dataState, endpoint_kind as endpointKind,
              checkpoint, last_ingested_at as lastIngestedAt
       FROM fleet_ingestion_source
       WHERE clinic_id = ?
       ORDER BY source_system, source_label`,
      [clinicId],
    );
    return rows.map(toSource);
  }

  async resolveIdentity(input: ResolveFleetIdentityInput): Promise<FleetIdentityMapping> {
    await this.ensureTenantExists(input.clinicId);
    const sourceSystem = requireKey(input.sourceSystem, "sourceSystem");
    const sourceEntity = requireKey(input.sourceEntity, "sourceEntity");
    const sourceRecordId = requireKey(input.sourceRecordId, "sourceRecordId");
    const targetType = cleanString(input.targetType);
    const targetId = cleanString(input.targetId);
    const confidence = pickEnum(input.confidence, IDENTITY_CONFIDENCE, targetId ? "known" : "provisional");
    const status = pickEnum(input.status, IDENTITY_STATUSES, confidence === "needs_review" ? "needs_review" : "active");
    const payloadHash = input.payload ? sha256(stableStringify(input.payload)) : null;
    const identityKey = `${sourceSystem}:${sourceEntity}:${sourceRecordId}`;
    const id = uuidv4();

    await pool.execute(
      `INSERT INTO fleet_identity_mapping
        (id, clinic_id, source_system, source_entity, source_record_id, identity_key,
         target_type, target_id, confidence, status, payload_hash, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         identity_key = VALUES(identity_key),
         target_type = VALUES(target_type),
         target_id = VALUES(target_id),
         confidence = VALUES(confidence),
         status = VALUES(status),
         payload_hash = VALUES(payload_hash),
         metadata = VALUES(metadata),
         last_seen_at = CURRENT_TIMESTAMP`,
      [
        id,
        input.clinicId,
        sourceSystem,
        sourceEntity,
        sourceRecordId,
        identityKey,
        targetType,
        targetId,
        confidence,
        status,
        payloadHash,
        jsonValue(input.metadata),
      ],
    );

    return this.getIdentity(input.clinicId, sourceSystem, sourceEntity, sourceRecordId);
  }

  async ingestEvent(input: IngestFleetEventInput): Promise<FleetIngestionReceipt> {
    const sourceSystem = requireKey(input.sourceSystem, "sourceSystem");
    const sourceKey = requireKey(input.sourceKey, "sourceKey");
    const sourceEntity = requireKey(input.sourceEntity, "sourceEntity");
    const sourceRecordId = cleanString(input.sourceRecordId);
    const providerEventId = cleanString(input.providerEventId);
    const payloadHash = sha256(stableStringify(input.payload || {}));
    const source = await this.getSource(input.clinicId, sourceSystem, sourceKey);

    if (source.status !== "active") {
      throw ApiError.badRequest(`Ingestion source ${sourceSystem}/${sourceKey} is not active.`);
    }
    if (source.dataState === "roadmap") {
      throw ApiError.badRequest(`Ingestion source ${sourceSystem}/${sourceKey} is roadmap-only.`);
    }

    const idempotencyKey = providerEventId
      ? `${sourceSystem}:${sourceKey}:event:${providerEventId}`
      : `${sourceSystem}:${sourceKey}:${sourceEntity}:${sourceRecordId || "unknown"}:${payloadHash}`;

    const [existing]: any = await pool.execute(
      `SELECT id, processing_status as processingStatus
       FROM fleet_ingestion_event
       WHERE clinic_id = ? AND idempotency_key = ?
       LIMIT 1`,
      [input.clinicId, idempotencyKey],
    );
    if (existing[0]) {
      return {
        id: existing[0].id,
        clinicId: input.clinicId,
        sourceId: source.id,
        sourceSystem,
        sourceKey,
        sourceEntity,
        sourceRecordId,
        providerEventId,
        idempotencyKey,
        payloadHash,
        processingStatus: "duplicate",
        duplicateOf: existing[0].id,
      };
    }

    const id = uuidv4();
    await pool.execute(
      `INSERT INTO fleet_ingestion_event
        (id, clinic_id, source_id, source_system, source_key, source_entity, source_record_id,
         provider_event_id, idempotency_key, payload_hash, payload_summary, processing_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued')`,
      [
        id,
        input.clinicId,
        source.id,
        sourceSystem,
        sourceKey,
        sourceEntity,
        sourceRecordId,
        providerEventId,
        idempotencyKey,
        payloadHash,
        jsonValue(input.payloadSummary),
      ],
    );

    await pool.execute(
      `UPDATE fleet_ingestion_source
       SET last_ingested_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [source.id],
    );
    await this.refreshCheckpoint(input.clinicId, source.id, { lastEvent: true });

    return {
      id,
      clinicId: input.clinicId,
      sourceId: source.id,
      sourceSystem,
      sourceKey,
      sourceEntity,
      sourceRecordId,
      providerEventId,
      idempotencyKey,
      payloadHash,
      processingStatus: "queued",
      duplicateOf: null,
    };
  }

  async processQueuedEvents(
    options: { clinicId?: string | null; limit?: number } = {},
    handler: (event: FleetQueuedEvent) => Promise<{ checkpoint?: string | null; status?: "processed" | "ignored" | "quarantined" } | void>,
  ): Promise<FleetQueueProcessResult> {
    const limit = Math.max(1, Math.min(Number(options.limit || 50), 200));
    const values: any[] = [];
    let where = "processing_status IN ('queued','retrying') AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP)";
    if (options.clinicId) {
      where += " AND clinic_id = ?";
      values.push(options.clinicId);
    }
    const [rows]: any = await pool.query(
      `SELECT id, clinic_id as clinicId, source_id as sourceId,
              source_system as sourceSystem, source_key as sourceKey, source_entity as sourceEntity,
              source_record_id as sourceRecordId, provider_event_id as providerEventId,
              idempotency_key as idempotencyKey, payload_hash as payloadHash,
              payload_summary as payloadSummary, processing_status as processingStatus,
              retry_count as retryCount
       FROM fleet_ingestion_event
       WHERE ${where}
       ORDER BY received_at ASC
       LIMIT ${limit}`,
      values,
    );

    const result: FleetQueueProcessResult = { attempted: rows.length, processed: 0, retrying: 0, deadLetter: 0 };
    for (const row of rows) {
      const event = toQueuedEvent(row);
      const claimed = await this.claimEvent(event.clinicId, event.id);
      if (!claimed) continue;
      try {
        const handlerResult = await handler(event);
        const processedOptions: { checkpoint?: string | null; status?: "processed" | "ignored" | "quarantined" } = {
          status: handlerResult?.status || "processed",
        };
        if (handlerResult && "checkpoint" in handlerResult) processedOptions.checkpoint = handlerResult.checkpoint;
        await this.markEventProcessed(event.clinicId, event.id, processedOptions);
        result.processed += 1;
      } catch (error) {
        const failure = await this.markEventFailed(event.clinicId, event.id, {
          retryable: true,
          errorClass: error instanceof Error ? error.name : "processing_error",
          errorMessage: error instanceof Error ? error.message : "Fleet ingestion event processing failed.",
        });
        if (failure === "retrying") result.retrying += 1;
        if (failure === "dead_letter") result.deadLetter += 1;
      }
    }
    return result;
  }

  async markEventProcessed(
    clinicId: string,
    eventId: string,
    options: { checkpoint?: string | null; status?: "processed" | "ignored" | "quarantined" } = {},
  ): Promise<FleetQueuedEvent> {
    const event = await this.getEventForUpdate(clinicId, eventId);
    const status = options.status || "processed";
    await pool.execute(
      `UPDATE fleet_ingestion_event
       SET processing_status = ?,
           processed_at = CURRENT_TIMESTAMP,
           next_retry_at = NULL,
           error_class = NULL,
           error_message = NULL,
           last_attempt_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ?`,
      [status, eventId, clinicId],
    );
    if (options.checkpoint !== undefined) {
      await pool.execute(
        `UPDATE fleet_ingestion_source SET checkpoint = ? WHERE id = ? AND clinic_id = ?`,
        [cleanString(options.checkpoint), event.sourceId, clinicId],
      );
    }
    const checkpointOptions: { checkpoint?: string | null; lastProcessed: boolean } = { lastProcessed: true };
    if ("checkpoint" in options) checkpointOptions.checkpoint = options.checkpoint;
    await this.refreshCheckpoint(clinicId, event.sourceId, checkpointOptions);
    return { ...event, processingStatus: status };
  }

  async markEventFailed(clinicId: string, eventId: string, failure: FleetEventFailureInput = {}) {
    const event = await this.getEventForUpdate(clinicId, eventId);
    const nextRetryCount = event.retryCount + 1;
    const retryable = failure.retryable !== false && nextRetryCount <= FLEET_EVENT_MAX_RETRIES;
    const retryAfterMs = Number(failure.retryAfterMs || 0);
    const backoffMs = retryAfterMs > 0
      ? Math.min(retryAfterMs, FLEET_EVENT_MAX_BACKOFF_MS)
      : Math.min(FLEET_EVENT_BASE_BACKOFF_MS * (2 ** Math.max(nextRetryCount - 1, 0)), FLEET_EVENT_MAX_BACKOFF_MS);
    const processingStatus = retryable ? "retrying" : "dead_letter";
    const nextRetryAt = retryable ? new Date(Date.now() + backoffMs) : null;
    const errorClass = cleanString(failure.errorClass) || (retryable ? "processing_retryable" : "processing_failed");
    const errorMessage = cleanString(failure.errorMessage) || "Fleet ingestion event processing failed.";

    await pool.execute(
      `UPDATE fleet_ingestion_event
       SET processing_status = ?,
           retry_count = ?,
           next_retry_at = ?,
           error_class = ?,
           error_message = ?,
           last_attempt_at = CURRENT_TIMESTAMP,
           processed_at = NULL
       WHERE id = ? AND clinic_id = ?`,
      [processingStatus, nextRetryCount, nextRetryAt, errorClass, errorMessage.slice(0, 1000), eventId, clinicId],
    );
    await this.refreshCheckpoint(clinicId, event.sourceId, {
      status: processingStatus === "retrying" ? "retrying" : "dead_letter",
      lastError: errorMessage,
    });
    return processingStatus;
  }

  async replayDeadLetterEvent(clinicId: string, eventId: string): Promise<FleetQueuedEvent> {
    const event = await this.getEventForUpdate(clinicId, eventId);
    if (event.processingStatus !== "dead_letter") {
      throw ApiError.badRequest("Only dead-letter fleet ingestion events can be replayed.");
    }
    await pool.execute(
      `UPDATE fleet_ingestion_event
       SET processing_status = 'queued',
           retry_count = 0,
           next_retry_at = NULL,
           error_class = NULL,
           error_message = NULL,
           processed_at = NULL
       WHERE id = ? AND clinic_id = ?`,
      [eventId, clinicId],
    );
    await this.refreshCheckpoint(clinicId, event.sourceId);
    return { ...event, processingStatus: "queued", retryCount: 0 };
  }

  async listDeadLetterEvents(clinicId: string): Promise<FleetQueuedEvent[]> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, source_id as sourceId,
              source_system as sourceSystem, source_key as sourceKey, source_entity as sourceEntity,
              source_record_id as sourceRecordId, provider_event_id as providerEventId,
              idempotency_key as idempotencyKey, payload_hash as payloadHash,
              payload_summary as payloadSummary, processing_status as processingStatus,
              retry_count as retryCount
       FROM fleet_ingestion_event
       WHERE clinic_id = ? AND processing_status = 'dead_letter'
       ORDER BY updated_at DESC`,
      [clinicId],
    );
    return rows.map(toQueuedEvent);
  }

  async getCheckpoint(clinicId: string, sourceId: string): Promise<FleetIngestionCheckpoint> {
    await this.refreshCheckpoint(clinicId, sourceId);
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, source_id as sourceId, source_system as sourceSystem,
              source_key as sourceKey, sync_status as syncStatus, checkpoint,
              last_event_at as lastEventAt, last_processed_event_at as lastProcessedEventAt,
              last_error as lastError, retrying_count as retryingCount, dead_letter_count as deadLetterCount
       FROM fleet_ingestion_checkpoint
       WHERE clinic_id = ? AND source_id = ?
       LIMIT 1`,
      [clinicId, sourceId],
    );
    if (!rows[0]) throw ApiError.notFound("Fleet ingestion checkpoint was not found.");
    return toCheckpoint(rows[0]);
  }

  async getSyncAdministration(scopeClinicId: string, includeAllClients = false): Promise<FleetSyncAdministrationResponse> {
    const params = includeAllClients ? [] : [scopeClinicId];
    const where = includeAllClients ? "" : "WHERE t.clinic_id = ?";
    const [healthRows]: any = await pool.execute(
      `SELECT
         t.clinic_id as clinicId,
         COALESCE(c.name, t.display_name) as clinicName,
         t.id as tenantId,
         t.tenant_key as tenantKey,
         t.display_name as tenantName,
         t.data_state as tenantDataState,
         t.status as tenantStatus,
         t.onboarding_status as tenantOnboardingStatus,
         s.id as sourceId,
         s.source_system as sourceSystem,
         s.source_key as sourceKey,
         s.source_label as sourceLabel,
         s.data_state as sourceDataState,
         s.status as sourceStatus,
         s.endpoint_kind as endpointKind,
         cp.sync_status as syncStatus,
         COALESCE(cp.checkpoint, s.checkpoint) as checkpoint,
         s.last_ingested_at as lastIngestedAt,
         cp.last_event_at as lastEventAt,
         cp.last_processed_event_at as lastProcessedEventAt,
         cp.last_error as lastError,
         success.latest_successful_sync_at as latestSuccessfulSyncAt,
         failed.latest_failed_sync_at as latestFailedSyncAt,
         COALESCE(cp.retrying_count, retrying.retrying_count, 0) as retryingCount,
         COALESCE(cp.dead_letter_count, dead.dead_letter_count, 0) as deadLetterCount,
         COALESCE(fresh.open_freshness_alerts, 0) as openFreshnessAlerts,
         COALESCE(recon.open_reconciliation_issues, 0) as openReconciliationIssues,
         fresh.sla_target_minutes as slaTargetMinutes,
         fresh.observed_lag_minutes as observedLagMinutes
       FROM fleet_tenant_registry t
       INNER JOIN clinic c ON c.id = t.clinic_id AND c.deleted_at IS NULL
       INNER JOIN fleet_ingestion_source s ON s.tenant_registry_id = t.id
       LEFT JOIN fleet_ingestion_checkpoint cp ON cp.clinic_id = s.clinic_id AND cp.source_id = s.id
       LEFT JOIN (
         SELECT clinic_id, source_id, COUNT(*) as retrying_count
         FROM fleet_ingestion_event
         WHERE processing_status IN ('queued','processing','retrying')
         GROUP BY clinic_id, source_id
       ) retrying ON retrying.clinic_id = s.clinic_id AND retrying.source_id = s.id
       LEFT JOIN (
         SELECT clinic_id, source_id, COUNT(*) as dead_letter_count
         FROM fleet_ingestion_event
         WHERE processing_status = 'dead_letter'
         GROUP BY clinic_id, source_id
       ) dead ON dead.clinic_id = s.clinic_id AND dead.source_id = s.id
       LEFT JOIN (
         SELECT clinic_id, source_id, COUNT(*) as open_freshness_alerts,
                MIN(threshold_minutes) as sla_target_minutes,
                MAX(observed_lag_minutes) as observed_lag_minutes
         FROM analytics_freshness_alert
         WHERE status IN ('open','acknowledged')
         GROUP BY clinic_id, source_id
       ) fresh ON fresh.clinic_id = s.clinic_id AND fresh.source_id = s.id
       LEFT JOIN (
         SELECT clinic_id, source_id, COUNT(*) as open_reconciliation_issues
         FROM analytics_reconciliation_issue
         WHERE status IN ('open','acknowledged')
         GROUP BY clinic_id, source_id
       ) recon ON recon.clinic_id = s.clinic_id AND recon.source_id = s.id
       LEFT JOIN (
         SELECT clinic_id, source_id, MAX(processed_at) as latest_successful_sync_at
         FROM fleet_ingestion_event
         WHERE processing_status = 'processed'
         GROUP BY clinic_id, source_id
       ) success ON success.clinic_id = s.clinic_id AND success.source_id = s.id
       LEFT JOIN (
         SELECT clinic_id, source_id, MAX(COALESCE(last_attempt_at, updated_at)) as latest_failed_sync_at
         FROM fleet_ingestion_event
         WHERE processing_status IN ('failed','retrying','dead_letter','quarantined')
         GROUP BY clinic_id, source_id
       ) failed ON failed.clinic_id = s.clinic_id AND failed.source_id = s.id
       ${where}
       ORDER BY c.name, s.source_system, s.source_label`,
      params,
    );
    const health: FleetSyncHealthRow[] = healthRows.map(toSyncHealthRow);
    const exceptions = await this.listSyncExceptions(scopeClinicId, includeAllClients);
    const clientIds = new Set(health.map((row) => row.clinicId));
    const summary = {
      clients: clientIds.size,
      sources: health.length,
      healthy: health.filter((row) => row.syncStatus === "healthy" && row.slaStatus === "met").length,
      atRisk: health.filter((row) => row.slaStatus === "at_risk").length,
      breached: health.filter((row) => row.slaStatus === "breached").length,
      exceptions: exceptions.length,
    };

    return {
      generatedAt: new Date().toISOString(),
      scope: includeAllClients ? "all_clients" : "current_clinic",
      health,
      exceptions,
      summary,
    };
  }

  async listSyncExceptions(scopeClinicId: string, includeAllClients = false): Promise<FleetSyncException[]> {
    const params = includeAllClients ? [] : [scopeClinicId];
    const clinicFilter = includeAllClients ? "" : "AND e.clinic_id = ?";
    const [deadLetterRows]: any = await pool.execute(
      `SELECT
         e.id,
         e.clinic_id as clinicId,
         COALESCE(c.name, e.clinic_id) as clinicName,
         e.source_id as sourceId,
         e.source_system as sourceSystem,
         e.source_key as sourceKey,
         COALESCE(s.source_label, e.source_key) as sourceLabel,
         s.data_state as dataState,
         'dead_letter' as type,
         'critical' as severity,
         e.processing_status as status,
         'Dead-letter ingestion event' as title,
         COALESCE(e.error_message, 'Retries are exhausted and this event needs controlled replay.') as detail,
         e.updated_at as detectedAt,
         'replay' as action,
         'replay' as availableActions,
         e.idempotency_key as correlationId
       FROM fleet_ingestion_event e
       INNER JOIN clinic c ON c.id = e.clinic_id AND c.deleted_at IS NULL
       LEFT JOIN fleet_ingestion_source s ON s.id = e.source_id AND s.clinic_id = e.clinic_id
       WHERE e.processing_status = 'dead_letter' ${clinicFilter}
       ORDER BY e.updated_at DESC
       LIMIT 200`,
      params,
    );

    const freshnessFilter = includeAllClients ? "" : "AND f.clinic_id = ?";
    const [freshnessRows]: any = await pool.execute(
      `SELECT
         f.id,
         f.clinic_id as clinicId,
         COALESCE(c.name, f.clinic_id) as clinicName,
         f.source_id as sourceId,
         s.source_system as sourceSystem,
         s.source_key as sourceKey,
         s.source_label as sourceLabel,
         s.data_state as dataState,
         'freshness' as type,
         'warning' as severity,
         f.status,
         'Freshness SLA breached' as title,
         f.message as detail,
         f.opened_at as detectedAt,
         'resolve' as action,
         'acknowledge,resolve,dismiss' as availableActions,
         f.alert_key as correlationId
       FROM analytics_freshness_alert f
       INNER JOIN clinic c ON c.id = f.clinic_id AND c.deleted_at IS NULL
       LEFT JOIN fleet_ingestion_source s ON s.id = f.source_id AND s.clinic_id = f.clinic_id
       WHERE f.status IN ('open','acknowledged') ${freshnessFilter}
       ORDER BY f.updated_at DESC
       LIMIT 200`,
      params,
    );

    const reconciliationFilter = includeAllClients ? "" : "AND r.clinic_id = ?";
    const [reconciliationRows]: any = await pool.execute(
      `SELECT
         r.id,
         r.clinic_id as clinicId,
         COALESCE(c.name, r.clinic_id) as clinicName,
         r.source_id as sourceId,
         s.source_system as sourceSystem,
         s.source_key as sourceKey,
         s.source_label as sourceLabel,
         s.data_state as dataState,
         'reconciliation' as type,
         r.severity,
         r.status,
         CONCAT('Reconciliation: ', REPLACE(r.issue_type, '_', ' ')) as title,
         r.entity_key as detail,
         r.detected_at as detectedAt,
         'resolve' as action,
         'acknowledge,resolve,dismiss' as availableActions,
         r.entity_key as correlationId
       FROM analytics_reconciliation_issue r
       INNER JOIN clinic c ON c.id = r.clinic_id AND c.deleted_at IS NULL
       LEFT JOIN fleet_ingestion_source s ON s.id = r.source_id AND s.clinic_id = r.clinic_id
       WHERE r.status IN ('open','acknowledged') ${reconciliationFilter}
       ORDER BY r.detected_at DESC
       LIMIT 200`,
      params,
    );

    const sourceStatusFilter = includeAllClients ? "" : "AND s.clinic_id = ?";
    const [sourceStatusRows]: any = await pool.execute(
      `SELECT
         s.id,
         s.clinic_id as clinicId,
         COALESCE(c.name, s.clinic_id) as clinicName,
         s.id as sourceId,
         s.source_system as sourceSystem,
         s.source_key as sourceKey,
         s.source_label as sourceLabel,
         s.data_state as dataState,
         'source_status' as type,
         CASE
           WHEN t.onboarding_status = 'blocked' THEN 'critical'
           WHEN s.data_state = 'roadmap' OR s.status <> 'active' THEN 'info'
           ELSE 'warning'
         END as severity,
         CASE
           WHEN t.onboarding_status = 'blocked' THEN 'blocked'
           WHEN s.status <> 'active' THEN s.status
           WHEN s.data_state = 'roadmap' THEN 'roadmap'
           ELSE 'unknown'
         END as status,
         CASE
           WHEN t.onboarding_status = 'blocked' THEN 'Source onboarding is blocked'
           WHEN s.status <> 'active' THEN 'Source is not actively syncing'
           WHEN s.data_state = 'roadmap' THEN 'Source is roadmap'
           ELSE 'No sync evidence received'
         END as title,
         CASE
           WHEN t.onboarding_status = 'blocked' THEN 'This client source is configured as blocked and needs administrator review.'
           WHEN s.status <> 'active' THEN 'This source is paused or inactive, so SLA tracking is not active.'
           WHEN s.data_state = 'roadmap' THEN 'This source is planned but should not be presented as live data.'
           ELSE 'No source event, checkpoint or successful ingestion timestamp is recorded yet.'
         END as detail,
         COALESCE(s.updated_at, t.updated_at) as detectedAt,
         CASE
           WHEN t.onboarding_status = 'blocked' THEN 'review_provider'
           ELSE 'configure_source'
         END as action,
         CASE
           WHEN t.onboarding_status = 'blocked' THEN 'review_provider'
           ELSE 'configure_source'
         END as availableActions,
         s.source_key as correlationId
       FROM fleet_ingestion_source s
       INNER JOIN fleet_tenant_registry t ON t.id = s.tenant_registry_id
       INNER JOIN clinic c ON c.id = s.clinic_id AND c.deleted_at IS NULL
       LEFT JOIN fleet_ingestion_checkpoint cp ON cp.clinic_id = s.clinic_id AND cp.source_id = s.id
       WHERE (
           t.onboarding_status = 'blocked'
           OR s.status <> 'active'
           OR s.data_state = 'roadmap'
           OR (s.status = 'active' AND s.data_state <> 'roadmap' AND cp.id IS NULL AND s.last_ingested_at IS NULL)
         )
         ${sourceStatusFilter}
       ORDER BY s.updated_at DESC
       LIMIT 200`,
      params,
    );

    return [...deadLetterRows, ...freshnessRows, ...reconciliationRows, ...sourceStatusRows]
      .map(toSyncException)
      .map((exception) => ({
        ...exception,
        detail: redactDiagnostic(exception.detail) || "Review required.",
      }));
  }

  async administerSyncException(
    clinicId: string,
    userId: string | null,
    exceptionType: string,
    exceptionId: string,
    action: SyncExceptionAdminAction,
    reason?: string | null,
  ): Promise<{ id: string; type: string; status: "acknowledged" | "resolved" | "dismissed" }> {
    if (!SAFE_EXCEPTION_ACTIONS.includes(action)) throw ApiError.badRequest("Unsupported sync exception action.");
    const table = exceptionType === "freshness"
      ? "analytics_freshness_alert"
      : exceptionType === "reconciliation"
        ? "analytics_reconciliation_issue"
        : null;
    if (!table) throw ApiError.badRequest("Only freshness and reconciliation exceptions can be administered.");

    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, source_id as sourceId, status
       FROM ${table}
       WHERE id = ? AND clinic_id = ?
       LIMIT 1`,
      [exceptionId, clinicId],
    );
    const row = rows[0];
    if (!row) throw ApiError.notFound("Sync exception was not found.");
    if (row.status === "resolved" || row.status === "dismissed") {
      throw ApiError.badRequest("Sync exception is already closed.");
    }
    if (action === "acknowledge" && row.status !== "open") {
      throw ApiError.badRequest("Only open sync exceptions can be acknowledged.");
    }
    const nextStatus: "acknowledged" | "resolved" | "dismissed" = action === "acknowledge" ? "acknowledged" : action === "resolve" ? "resolved" : "dismissed";
    const resolvedAtClause = nextStatus === "resolved" ? ", resolved_at = CURRENT_TIMESTAMP" : "";
    await pool.execute(
      `UPDATE ${table}
       SET status = ?${resolvedAtClause}
       WHERE id = ? AND clinic_id = ?`,
      [nextStatus, exceptionId, clinicId],
    );
    await this.logSyncExceptionAction({
      clinicId,
      sourceId: row.sourceId || null,
      exceptionType,
      exceptionId,
      action: nextStatus,
      previousStatus: row.status,
      nextStatus,
      reason: cleanReason(reason, `${nextStatus} from sync health administration.`),
      actorUserId: userId,
    });
    return { id: exceptionId, type: exceptionType, status: nextStatus };
  }

  async replayDeadLetterEventForScope(scopeClinicId: string, eventId: string, includeAllClients = false, userId?: string | null, reason?: string | null): Promise<FleetQueuedEvent> {
    const [rows]: any = await pool.execute(
      `SELECT clinic_id as clinicId, source_id as sourceId, processing_status as previousStatus
       FROM fleet_ingestion_event
       WHERE id = ? AND processing_status = 'dead_letter'
       LIMIT 1`,
      [eventId],
    );
    const eventClinicId = rows[0]?.clinicId;
    if (!eventClinicId) throw ApiError.notFound("Dead-letter fleet ingestion event was not found.");
    if (!includeAllClients && eventClinicId !== scopeClinicId) throw ApiError.notFound("Dead-letter fleet ingestion event was not found.");
    const replayed = await this.replayDeadLetterEvent(eventClinicId, eventId);
    if (userId) {
      await this.logSyncExceptionAction({
        clinicId: eventClinicId,
        sourceId: rows[0]?.sourceId || null,
        exceptionType: "dead_letter",
        exceptionId: eventId,
        action: "replayed",
        previousStatus: rows[0]?.previousStatus || "dead_letter",
        nextStatus: replayed.processingStatus,
        reason: cleanReason(reason, "Replayed from sync health administration."),
        actorUserId: userId,
        correlationId: replayed.idempotencyKey,
      });
    }
    return replayed;
  }

  async resolveSyncExceptionForScope(
    scopeClinicId: string,
    exceptionType: string,
    exceptionId: string,
    includeAllClients = false,
    userId: string | null = null,
    action: SyncExceptionAdminAction = "resolve",
    reason?: string | null,
  ): Promise<{ id: string; type: string; status: "acknowledged" | "resolved" | "dismissed" }> {
    const table = exceptionType === "freshness"
      ? "analytics_freshness_alert"
      : exceptionType === "reconciliation"
        ? "analytics_reconciliation_issue"
        : null;
    if (!table) throw ApiError.badRequest("Only freshness and reconciliation exceptions can be administered.");

    const [rows]: any = await pool.execute(
      `SELECT clinic_id as clinicId FROM ${table} WHERE id = ? AND status IN ('open', 'acknowledged') LIMIT 1`,
      [exceptionId],
    );
    const exceptionClinicId = rows[0]?.clinicId;
    if (!exceptionClinicId) throw ApiError.notFound("Sync exception was not found.");
    if (!includeAllClients && exceptionClinicId !== scopeClinicId) throw ApiError.notFound("Sync exception was not found.");
    return this.administerSyncException(exceptionClinicId, userId, exceptionType, exceptionId, action, reason);
  }

  private async logSyncExceptionAction(input: {
    clinicId: string;
    sourceId?: string | null;
    exceptionType: string;
    exceptionId: string;
    action: "acknowledged" | "resolved" | "dismissed" | "replayed" | "reopened";
    previousStatus?: string | null;
    nextStatus?: string | null;
    reason?: string | null;
    actorUserId?: string | null;
    correlationId?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    await pool.execute(
      `INSERT INTO fleet_sync_exception_action_log
        (id, clinic_id, source_id, exception_type, exception_id, action,
         previous_status, next_status, reason, correlation_id, metadata, actor_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        input.clinicId,
        input.sourceId || null,
        input.exceptionType,
        input.exceptionId,
        input.action,
        input.previousStatus || null,
        input.nextStatus || null,
        input.reason || null,
        input.correlationId || null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.actorUserId || null,
      ],
    );
  }

  private async ensureClinicExists(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id FROM clinic WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Clinic was not found.");
  }

  private async ensureTenantExists(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id FROM fleet_tenant_registry WHERE clinic_id = ? LIMIT 1`,
      [clinicId],
    );
    if (!rows[0]) {
      await this.registerTenant({ clinicId });
    }
  }

  private async getClinicName(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT name FROM clinic WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Clinic was not found.");
    return rows[0].name || clinicId;
  }

  private async getTenantByClinic(clinicId: string): Promise<FleetTenantRegistry> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, tenant_key as tenantKey, display_name as displayName,
              data_state as dataState, status, onboarding_status as onboardingStatus,
              registered_at as registeredAt, last_seen_at as lastSeenAt
       FROM fleet_tenant_registry
       WHERE clinic_id = ?
       LIMIT 1`,
      [clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Fleet tenant was not found.");
    return toTenant(rows[0]);
  }

  private async getSource(clinicId: string, sourceSystem: string, sourceKey: string): Promise<FleetIngestionSource> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, tenant_registry_id as tenantRegistryId,
              source_system as sourceSystem, source_key as sourceKey, source_label as sourceLabel,
              status, data_state as dataState, endpoint_kind as endpointKind,
              checkpoint, last_ingested_at as lastIngestedAt
       FROM fleet_ingestion_source
       WHERE clinic_id = ? AND source_system = ? AND source_key = ?
       LIMIT 1`,
      [clinicId, sourceSystem, sourceKey],
    );
    if (!rows[0]) throw ApiError.badRequest(`Ingestion source ${sourceSystem}/${sourceKey} is not configured.`);
    return toSource(rows[0]);
  }

  private async claimEvent(clinicId: string, eventId: string) {
    const [result]: any = await pool.execute(
      `UPDATE fleet_ingestion_event
       SET processing_status = 'processing', last_attempt_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?
         AND processing_status IN ('queued','retrying')
         AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP)`,
      [eventId, clinicId],
    );
    return Number(result.affectedRows || 0) === 1;
  }

  private async getEventForUpdate(clinicId: string, eventId: string): Promise<FleetQueuedEvent> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, source_id as sourceId,
              source_system as sourceSystem, source_key as sourceKey, source_entity as sourceEntity,
              source_record_id as sourceRecordId, provider_event_id as providerEventId,
              idempotency_key as idempotencyKey, payload_hash as payloadHash,
              payload_summary as payloadSummary, processing_status as processingStatus,
              retry_count as retryCount
       FROM fleet_ingestion_event
       WHERE id = ? AND clinic_id = ?
       LIMIT 1`,
      [eventId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Fleet ingestion event was not found.");
    return toQueuedEvent(rows[0]);
  }

  private async refreshCheckpoint(
    clinicId: string,
    sourceId: string,
    options: { status?: FleetCheckpointStatus; checkpoint?: string | null; lastEvent?: boolean; lastProcessed?: boolean; lastError?: string | null } = {},
  ) {
    const source = await this.getSourceById(clinicId, sourceId);
    const [countRows]: any = await pool.execute(
      `SELECT
          SUM(processing_status IN ('queued','processing','retrying')) as retryingCount,
          SUM(processing_status = 'dead_letter') as deadLetterCount
       FROM fleet_ingestion_event
       WHERE clinic_id = ? AND source_id = ?`,
      [clinicId, sourceId],
    );
    const retryingCount = Number(countRows[0]?.retryingCount || 0);
    const deadLetterCount = Number(countRows[0]?.deadLetterCount || 0);
    const syncStatus: FleetCheckpointStatus = options.status
      || (source.status !== "active" ? "paused" : deadLetterCount > 0 ? "dead_letter" : retryingCount > 0 ? "retrying" : "healthy");
    const checkpoint = options.checkpoint === undefined ? source.checkpoint : cleanString(options.checkpoint);
    const id = uuidv4();

    await pool.execute(
      `INSERT INTO fleet_ingestion_checkpoint
        (id, clinic_id, source_id, source_system, source_key, sync_status, checkpoint,
         last_event_at, last_processed_event_at, last_error, retrying_count, dead_letter_count)
       VALUES (?, ?, ?, ?, ?, ?, ?,
               ${options.lastEvent ? "CURRENT_TIMESTAMP" : "NULL"},
               ${options.lastProcessed ? "CURRENT_TIMESTAMP" : "NULL"},
               ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         sync_status = VALUES(sync_status),
         checkpoint = COALESCE(VALUES(checkpoint), checkpoint),
         last_event_at = COALESCE(VALUES(last_event_at), last_event_at),
         last_processed_event_at = COALESCE(VALUES(last_processed_event_at), last_processed_event_at),
         last_error = VALUES(last_error),
         retrying_count = VALUES(retrying_count),
         dead_letter_count = VALUES(dead_letter_count)`,
      [
        id,
        clinicId,
        sourceId,
        source.sourceSystem,
        source.sourceKey,
        syncStatus,
        checkpoint,
        cleanString(options.lastError),
        retryingCount,
        deadLetterCount,
      ],
    );
  }

  private async recordAlphaFreshnessAlert(
    clinicId: string,
    sourceId: string,
    input: { entity: string; sourceRecordId: string; state: string; alertKey: string; targetMinutes: number },
  ) {
    const targetMinutes = Math.max(1, Math.min(Number(input.targetMinutes || 15), 1440));
    const message = `Clinic OS alpha sync reported ${input.entity} ${input.sourceRecordId} as ${input.state}.`;
    await pool.execute(
      `INSERT INTO analytics_freshness_alert
        (id, clinic_id, source_id, alert_key, status, threshold_minutes, observed_lag_minutes, message)
       VALUES (?, ?, ?, ?, 'open', ?, NULL, ?)
       ON DUPLICATE KEY UPDATE
         status = 'open',
         threshold_minutes = VALUES(threshold_minutes),
         message = VALUES(message),
         resolved_at = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [uuidv4(), clinicId, sourceId, input.alertKey, targetMinutes, message],
    );
  }

  private async getSourceById(clinicId: string, sourceId: string): Promise<FleetIngestionSource> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, tenant_registry_id as tenantRegistryId,
              source_system as sourceSystem, source_key as sourceKey, source_label as sourceLabel,
              status, data_state as dataState, endpoint_kind as endpointKind,
              checkpoint, last_ingested_at as lastIngestedAt
       FROM fleet_ingestion_source
       WHERE clinic_id = ? AND id = ?
       LIMIT 1`,
      [clinicId, sourceId],
    );
    if (!rows[0]) throw ApiError.notFound("Fleet ingestion source was not found.");
    return toSource(rows[0]);
  }

  private async getIdentity(
    clinicId: string,
    sourceSystem: string,
    sourceEntity: string,
    sourceRecordId: string,
  ): Promise<FleetIdentityMapping> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, source_system as sourceSystem, source_entity as sourceEntity,
              source_record_id as sourceRecordId, identity_key as identityKey, target_type as targetType,
              target_id as targetId, confidence, status, payload_hash as payloadHash,
              first_seen_at as firstSeenAt, last_seen_at as lastSeenAt
       FROM fleet_identity_mapping
       WHERE clinic_id = ? AND source_system = ? AND source_entity = ? AND source_record_id = ?
       LIMIT 1`,
      [clinicId, sourceSystem, sourceEntity, sourceRecordId],
    );
    if (!rows[0]) throw ApiError.notFound("Fleet identity mapping was not found.");
    return toIdentity(rows[0]);
  }
}

export const fleetIngestionService = new FleetIngestionService();
