export type FleetDataState = "live" | "demo" | "preview" | "partial" | "provider_dependent" | "roadmap";
export type FleetRecordStatus = "active" | "paused" | "inactive";
export type FleetEndpointKind = "webhook" | "api_pull" | "manual_import" | "system";
export type FleetCheckpointStatus = "healthy" | "delayed" | "retrying" | "dead_letter" | "paused" | "reconciliation_needed";
export type FleetIngestionStatus = "queued" | "processing" | "processed" | "duplicate" | "quarantined" | "retrying" | "dead_letter" | "failed" | "ignored";
export type FleetSyncSlaStatus = "met" | "at_risk" | "breached" | "not_applicable";
export type FleetSyncExceptionType = "dead_letter" | "freshness" | "reconciliation" | "source_status";
export type FleetSyncExceptionSeverity = "info" | "warning" | "critical";
export type FleetSyncExceptionAction = "replay" | "resolve" | "review_provider" | "configure_source";

export interface FleetSyncHealthRow {
  clinicId: string;
  clinicName: string;
  tenantId: string;
  tenantKey: string;
  tenantName: string;
  tenantDataState: FleetDataState;
  tenantStatus: FleetRecordStatus;
  sourceId: string;
  sourceSystem: string;
  sourceKey: string;
  sourceLabel: string;
  sourceDataState: FleetDataState;
  sourceStatus: FleetRecordStatus;
  endpointKind: FleetEndpointKind;
  syncStatus: FleetCheckpointStatus;
  checkpoint: string | null;
  lastIngestedAt: string | null;
  lastEventAt: string | null;
  lastProcessedEventAt: string | null;
  lastError: string | null;
  retryingCount: number;
  deadLetterCount: number;
  openFreshnessAlerts: number;
  openReconciliationIssues: number;
  slaStatus: FleetSyncSlaStatus;
  slaTargetMinutes: number | null;
  observedLagMinutes: number | null;
}

export interface FleetSyncException {
  id: string;
  clinicId: string;
  clinicName: string;
  sourceId: string | null;
  sourceSystem: string | null;
  sourceKey: string | null;
  sourceLabel: string | null;
  dataState: FleetDataState | null;
  type: FleetSyncExceptionType;
  severity: FleetSyncExceptionSeverity;
  status: string;
  title: string;
  detail: string;
  detectedAt: string | null;
  action: FleetSyncExceptionAction;
}

export interface FleetQueuedEvent {
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
  retryCount: number;
  payloadSummary: Record<string, unknown> | null;
}

export interface FleetSyncAdministrationResponse {
  generatedAt: string;
  scope: "current_clinic" | "all_clients";
  health: FleetSyncHealthRow[];
  exceptions: FleetSyncException[];
  summary: {
    clients: number;
    sources: number;
    healthy: number;
    atRisk: number;
    breached: number;
    exceptions: number;
  };
}
