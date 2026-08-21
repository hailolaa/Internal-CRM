import type {
  ScoroEntity,
  ScoroQuarantineReason,
  ScoroSourceSystem,
  ScoroValidationStatus,
  ScoroWarningReason,
} from "./scoro-import.contract.js";

export interface ScoroExistingTarget {
  targetType: "contact" | "client_account" | "task";
  targetId: string;
  clinicId: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  accountName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface ScoroExistingSourceRecord {
  clinicId: string;
  sourceEntity: ScoroEntity;
  sourceRecordId: string;
  targetType: "contact" | "client_account" | "task";
  targetId: string;
}

export interface ScoroImportDryRunInput {
  clinicId: string;
  inputDirectory: string;
  ownerEmailToUserId?: Record<string, string>;
  existingTargets?: ScoroExistingTarget[];
  existingSourceRecords?: ScoroExistingSourceRecord[];
}

export interface ScoroImportIdentity {
  sourceSystem: ScoroSourceSystem;
  sourceEntity: ScoroEntity;
  sourceRecordId: string;
  identityKey: string;
  rowHash: string;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  normalizedDomain: string | null;
}

export interface ScoroCandidateMatch {
  type: "email" | "phone" | "domain" | "name";
  targetType: string;
  targetId: string;
  score: number;
}

export interface ScoroDryRunRecord {
  entity: ScoroEntity;
  filename: string;
  rowNumber: number;
  sourceRecordId: string | null;
  identity: ScoroImportIdentity | null;
  validationStatus: ScoroValidationStatus;
  quarantineReasons: ScoroQuarantineReason[];
  warnings: ScoroWarningReason[];
  ownerEmail: string | null;
  relatedSourceIdentity: string | null;
  mappedTargetType: string | null;
  mappedTargetId: string | null;
  candidateMatches: ScoroCandidateMatch[];
  rawRow: Record<string, string>;
}

export interface ScoroEntitySummary {
  entity: ScoroEntity;
  filename: string;
  sourceRows: number;
  validRows: number;
  mappedRows: number;
  quarantinedRows: number;
  duplicateCandidates: number;
}

export interface ScoroReconciliationReport {
  sourceRows: number;
  validRows: number;
  mappedRows: number;
  importedRows: number;
  skippedDuplicates: number;
  quarantinedRows: number;
  unresolvedRelations: number;
  ownerMappingIssues: number;
  statusMismatches: number;
  missingTargets: number;
  duplicateTargets: number;
  duplicateCandidates: number;
}

export interface ScoroImportDryRunResult {
  sourceSystem: ScoroSourceSystem;
  clinicId: string;
  sourceHash: string;
  entities: ScoroEntitySummary[];
  records: ScoroDryRunRecord[];
  reconciliation: ScoroReconciliationReport;
}

export interface ScoroApplyPlan {
  mode: "apply";
  sourceSystem: ScoroSourceSystem;
  clinicId: string;
  sourceHash: string;
  readyRecords: ScoroDryRunRecord[];
  skippedDuplicateRecords: ScoroDryRunRecord[];
  quarantinedRecords: ScoroDryRunRecord[];
  reconciliation: ScoroReconciliationReport;
}

export interface ScoroCleanupRecord {
  identityKey: string;
  sourceEntity: ScoroEntity;
  sourceRecordId: string;
  targetType: string | null;
  targetId: string | null;
}

export interface ScoroCleanupPlan {
  batchId: string;
  removableTargets: ScoroCleanupRecord[];
  orphanedImportRecords: ScoroCleanupRecord[];
}
