export interface BackgroundJobsResponse {
  schedulerEnabled: boolean;
  jobs: Array<{
    id: string;
    name: string;
    description: string;
    schedule: string;
    category: string;
    status: "active" | "paused" | "error";
    lastRun: string | null;
    nextRun: string | null;
    lastDuration: string;
    successRate: string;
    lastStatus: "started" | "completed" | "failed" | null;
    lastError: string | null;
  }>;
  backupRuns: Array<{
    id: string;
    status: string;
    filePath: string | null;
    storageProvider: string;
    sizeBytes: number | null;
    startedAt: string;
    completedAt: string | null;
    errorMessage: string | null;
  }>;
  jobRuns: Array<{
    id: string;
    jobKey: string;
    status: "started" | "completed" | "failed";
    triggeredBy: "schedule" | "manual";
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    errorMessage: string | null;
    metadata: unknown;
  }>;
}
