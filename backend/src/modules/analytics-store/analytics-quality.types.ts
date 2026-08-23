export type AnalyticsBackfillStatus = "queued" | "running" | "paused" | "completed" | "failed";
export type AnalyticsIssueType = "missing_fact" | "duplicate_source_event" | "stale_source" | "lineage_gap";
export type AnalyticsIssueSeverity = "info" | "warning" | "critical";

export interface AnalyticsBackfillRun {
  id: string;
  clinicId: string;
  sourceId: string | null;
  backfillKey: string;
  status: AnalyticsBackfillStatus;
  cursor: string | null;
  recordsSeen: number;
  recordsWritten: number;
  recordsQuarantined: number;
  lastError: string | null;
}

export interface AnalyticsExpectedFact {
  metricKey: string;
  grain: "event" | "daily" | "weekly" | "monthly" | "quarterly" | "annual";
  grainDate: string;
  dimensions: Record<string, string | number | boolean | null>;
}

export interface AnalyticsReconciliationIssue {
  id: string;
  clinicId: string;
  sourceId: string | null;
  issueType: AnalyticsIssueType;
  severity: AnalyticsIssueSeverity;
  status: "open" | "resolved";
  entityKey: string;
  details: Record<string, unknown> | null;
}

export interface AnalyticsFreshnessResult {
  status: "healthy" | "stale";
  sourceId: string;
  thresholdMinutes: number;
  observedLagMinutes: number | null;
  alertId: string | null;
}
