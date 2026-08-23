export type ClinicOsAccessTier = "free_audit" | "paid_diagnostic" | "clinic_os";
export type ClinicOsEntitlementStatus = "draft" | "published" | "superseded" | "rolled_back";
export type ClinicOsPushStatus = "pending" | "sent" | "acknowledged" | "failed" | "superseded";

export interface ClinicOsEntitlementVersion {
  id: string;
  clinicId: string;
  tenantKey: string;
  version: number;
  status: ClinicOsEntitlementStatus;
  accessTier: ClinicOsAccessTier;
  growthScoreEnabled: boolean;
  paidDiagnosticConfirmed: boolean;
  sufficientDataConfirmed: boolean;
  settings: Record<string, unknown>;
  payloadHash: string;
  changedBy: string;
  rollbackOfVersionId: string | null;
  publishedAt: string;
}

export interface ClinicOsSettingsPush {
  id: string;
  clinicId: string;
  entitlementVersionId: string;
  tenantKey: string;
  status: ClinicOsPushStatus;
  payloadHash: string;
  slaDueAt: string;
  attemptCount: number;
  lastError: string | null;
}
