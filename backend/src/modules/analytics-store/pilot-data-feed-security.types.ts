export type PilotSecurityStatus = "passed" | "failed" | "needs_review";
export type PilotCheckStatus = "passed" | "failed";
export type PilotErasureStatus = "passed" | "failed" | "not_run";

export interface PilotSecurityReview {
  id: string;
  clinicId: string;
  sourceId: string | null;
  reviewStatus: PilotSecurityStatus;
  tenantIsolationStatus: PilotCheckStatus;
  erasureStatus: PilotErasureStatus;
  reconciliationStatus: PilotCheckStatus;
  freshnessStatus: PilotCheckStatus;
  reviewedBy: string;
  evidence: Record<string, unknown>;
  reviewedAt: string;
}

export interface PilotErasureResult {
  clinicId: string;
  sourceId: string;
  deleted: Record<string, number>;
  remainingTraces: Record<string, number>;
}
