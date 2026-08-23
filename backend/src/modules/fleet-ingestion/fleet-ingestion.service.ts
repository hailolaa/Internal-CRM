import { createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import type {
  ConfigureFleetSourceInput,
  FleetDataState,
  FleetEndpointKind,
  FleetIdentityConfidence,
  FleetIdentityMapping,
  FleetIdentityStatus,
  FleetIngestionReceipt,
  FleetIngestionSource,
  FleetOnboardingStatus,
  FleetRecordStatus,
  FleetTenantRegistry,
  IngestFleetEventInput,
  RegisterFleetTenantInput,
  ResolveFleetIdentityInput,
} from "./fleet-ingestion.types.js";

const DATA_STATES: FleetDataState[] = ["live", "demo", "preview", "partial", "provider_dependent", "roadmap"];
const RECORD_STATUSES: FleetRecordStatus[] = ["active", "paused", "inactive"];
const ONBOARDING_STATUSES: FleetOnboardingStatus[] = ["pending", "configured", "active", "blocked"];
const ENDPOINT_KINDS: FleetEndpointKind[] = ["webhook", "api_pull", "manual_import", "system"];
const IDENTITY_CONFIDENCE: FleetIdentityConfidence[] = ["known", "provisional", "needs_review"];
const IDENTITY_STATUSES: FleetIdentityStatus[] = ["active", "needs_review", "archived"];

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

export class FleetIngestionService {
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
