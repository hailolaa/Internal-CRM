export type FleetDataState = "live" | "demo" | "preview" | "partial" | "provider_dependent" | "roadmap";
export type FleetRecordStatus = "active" | "paused" | "inactive";
export type FleetOnboardingStatus = "pending" | "configured" | "active" | "blocked";
export type FleetEndpointKind = "webhook" | "api_pull" | "manual_import" | "system";
export type FleetIdentityConfidence = "known" | "provisional" | "needs_review";
export type FleetIdentityStatus = "active" | "needs_review" | "archived";
export type FleetIngestionStatus =
  | "queued"
  | "processing"
  | "processed"
  | "duplicate"
  | "quarantined"
  | "retrying"
  | "dead_letter"
  | "failed"
  | "ignored";
export type FleetCheckpointStatus = "healthy" | "delayed" | "retrying" | "dead_letter" | "paused" | "reconciliation_needed";

export interface FleetTenantRegistry {
  id: string;
  clinicId: string;
  tenantKey: string;
  displayName: string;
  dataState: FleetDataState;
  status: FleetRecordStatus;
  onboardingStatus: FleetOnboardingStatus;
  registeredAt: string;
  lastSeenAt: string | null;
}

export interface FleetIngestionSource {
  id: string;
  clinicId: string;
  tenantRegistryId: string;
  sourceSystem: string;
  sourceKey: string;
  sourceLabel: string;
  status: FleetRecordStatus;
  dataState: FleetDataState;
  endpointKind: FleetEndpointKind;
  checkpoint: string | null;
  lastIngestedAt: string | null;
}

export interface FleetIdentityMapping {
  id: string;
  clinicId: string;
  sourceSystem: string;
  sourceEntity: string;
  sourceRecordId: string;
  identityKey: string;
  targetType: string | null;
  targetId: string | null;
  confidence: FleetIdentityConfidence;
  status: FleetIdentityStatus;
  payloadHash: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface RegisterFleetTenantInput {
  clinicId: string;
  tenantKey?: string | null;
  displayName?: string | null;
  dataState?: FleetDataState;
  status?: FleetRecordStatus;
  onboardingStatus?: FleetOnboardingStatus;
  metadata?: Record<string, unknown> | null;
}

export interface ConfigureFleetSourceInput extends RegisterFleetTenantInput {
  sourceSystem: string;
  sourceKey: string;
  sourceLabel?: string | null;
  endpointKind?: FleetEndpointKind;
  checkpoint?: string | null;
}

export interface ResolveFleetIdentityInput {
  clinicId: string;
  sourceSystem: string;
  sourceEntity: string;
  sourceRecordId: string;
  targetType?: string | null;
  targetId?: string | null;
  confidence?: FleetIdentityConfidence;
  status?: FleetIdentityStatus;
  payload?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface IngestFleetEventInput {
  clinicId: string;
  sourceSystem: string;
  sourceKey: string;
  sourceEntity: string;
  sourceRecordId?: string | null;
  providerEventId?: string | null;
  payload: Record<string, unknown>;
  payloadSummary?: Record<string, unknown> | null;
}

export interface FleetIngestionReceipt {
  id: string;
  clinicId: string;
  sourceId: string;
  sourceSystem: string;
  sourceKey: string;
  sourceEntity: string;
  sourceRecordId: string | null;
  providerEventId: string | null;
  idempotencyKey: string;
  payloadHash: string;
  processingStatus: FleetIngestionStatus;
  duplicateOf: string | null;
}

export interface FleetQueuedEvent extends FleetIngestionReceipt {
  retryCount: number;
  payloadSummary: Record<string, unknown> | null;
}

export interface FleetQueueProcessResult {
  attempted: number;
  processed: number;
  retrying: number;
  deadLetter: number;
}

export interface FleetEventFailureInput {
  retryable?: boolean;
  errorClass?: string | null;
  errorMessage?: string | null;
  retryAfterMs?: number | null;
}

export interface FleetIngestionCheckpoint {
  id: string;
  clinicId: string;
  sourceId: string;
  sourceSystem: string;
  sourceKey: string;
  syncStatus: FleetCheckpointStatus;
  checkpoint: string | null;
  lastEventAt: string | null;
  lastProcessedEventAt: string | null;
  lastError: string | null;
  retryingCount: number;
  deadLetterCount: number;
}
