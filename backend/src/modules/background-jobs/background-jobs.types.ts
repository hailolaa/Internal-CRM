export type BackgroundJobStatus = "active" | "paused" | "error";
export type BackgroundJobRunStatus = "started" | "completed" | "failed";
export type BackgroundJobTrigger = "schedule" | "manual";

export type BackgroundJobTaskResult = Record<string, string | number | boolean | null>;

export interface BackgroundJobDefinition {
  id: string;
  name: string;
  description: string;
  schedule: string;
  category: string;
  getNextRunAt: (from: Date) => Date;
  handler: () => Promise<BackgroundJobTaskResult>;
}

export interface BackgroundJobStateRow {
  jobKey: string;
  status: BackgroundJobStatus;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  lastStatus: BackgroundJobRunStatus | null;
  lastDurationMs: number | null;
  lastErrorMessage: string | null;
  successCount: number;
  failureCount: number;
}

export interface BackgroundJobRunRow {
  id: string;
  jobKey: string;
  status: BackgroundJobRunStatus;
  triggeredBy: BackgroundJobTrigger;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  errorMessage: string | null;
  metadata: unknown;
}
