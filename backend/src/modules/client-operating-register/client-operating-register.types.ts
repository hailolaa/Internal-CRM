export type ClientOperatingRegisterSourceSystem = "clickup" | "csv" | "json";
export type ClientOperatingRegisterRecordKind = "client" | "prospect" | "internal" | "excluded";
export type ClientOperatingRegisterDataState =
  | "live"
  | "manual"
  | "partial"
  | "provider_dependent"
  | "preview"
  | "roadmap"
  | "demo"
  | "unknown";
export type ClientOperatingRegisterFreshnessStatus =
  | "verified"
  | "confirmation_required"
  | "stale"
  | "missing_from_source"
  | "imported";
export type ClientOperatingRegisterImportMode = "dry_run" | "apply";
export type ClientOperatingRegisterIssueType =
  | "duplicate_input"
  | "missing_identity"
  | "malformed_record"
  | "conflict"
  | "cross_tenant"
  | "source_missing"
  | "validation"
  | "confirmation_required";
export type ClientOperatingRegisterIssueSeverity = "info" | "warning" | "error";

export interface ClientOperatingRegisterSourceTask {
  id?: string | null;
  name?: string | null;
  text_content?: string | null;
  markdown_description?: string | null;
  url?: string | null;
  status?: string | { status?: string | null } | null;
  date_updated?: string | number | null;
  custom_fields?: unknown[] | null;
  archived?: boolean | null;
}

export interface ClientOperatingRegisterImportDTO {
  sourceSystem?: ClientOperatingRegisterSourceSystem;
  sourceListId?: string | null;
  sourceVersion?: string | null;
  dryRun?: boolean;
  markMissingSource?: boolean;
  records: ClientOperatingRegisterSourceTask[];
}

export interface ClientOperatingRegisterIssue {
  sourceRecordId: string | null;
  recordId?: string | null;
  issueType: ClientOperatingRegisterIssueType;
  severity: ClientOperatingRegisterIssueSeverity;
  fieldName?: string | null;
  message: string;
  sourceValue?: string | null;
  existingValue?: string | null;
}

export interface ClientOperatingRegisterParsedRecord {
  sourceRecordId: string;
  sourceRecordUrl: string | null;
  sourceStatus: string | null;
  sourceUpdatedAt: string | null;
  recordKind: ClientOperatingRegisterRecordKind;
  canonicalName: string;
  canonicalMatchKey: string;
  legalName: string | null;
  tradingName: string | null;
  businessBrand: string | null;
  lifecycleStatus: string | null;
  packageName: string | null;
  servicesIncluded: string[];
  commercialSummary: Record<string, string | null>;
  operatingControls: Record<string, string | null>;
  providerRefs: Record<string, string | null>;
  vaultRefs: string[];
  missingFields: string[];
  riskSummary: string | null;
  nextAction: string | null;
  evidenceSummary: string | null;
  invoiceTruthSource: "accounting" | "confirmation_required" | "none" | "unknown";
  dataState: ClientOperatingRegisterDataState;
  freshnessStatus: ClientOperatingRegisterFreshnessStatus;
  verifiedBy: string | null;
  verifiedAt: string | null;
  sourcePayload: Record<string, unknown>;
  payloadHash: string;
}

export interface ClientOperatingRegisterRecordResponse {
  id: string;
  clinicId: string;
  clientAccountProfileId: string | null;
  sourceSystem: string;
  sourceListId: string | null;
  sourceRecordId: string;
  sourceRecordUrl: string | null;
  sourceStatus: string | null;
  recordKind: ClientOperatingRegisterRecordKind;
  canonicalName: string;
  canonicalMatchKey: string;
  businessBrand: string | null;
  lifecycleStatus: string | null;
  packageName: string | null;
  servicesIncluded: string[];
  invoiceTruthSource: string;
  dataState: ClientOperatingRegisterDataState;
  freshnessStatus: ClientOperatingRegisterFreshnessStatus;
  missingFields: string[];
  riskSummary: string | null;
  nextAction: string | null;
  evidenceSummary: string | null;
  sourceUpdatedAt: string | null;
  lastSeenAt: string;
  missingFromSourceAt: string | null;
  updatedAt: string;
}

export interface ClientOperatingRegisterImportResponse {
  runId: string;
  mode: ClientOperatingRegisterImportMode;
  status: "completed" | "completed_with_issues" | "failed";
  counts: {
    input: number;
    parsed: number;
    skipped: number;
    created: number;
    updated: number;
    unchanged: number;
    profilesCreated: number;
    profilesLinked: number;
    markedMissing: number;
    issues: number;
    errors: number;
  };
  issues: ClientOperatingRegisterIssue[];
}
