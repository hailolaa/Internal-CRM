import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { backgroundJobsScheduler } from "./background-jobs.scheduler.js";
import {
  backgroundJobDefinitions,
  findBackgroundJobDefinition,
} from "./background-jobs.definitions.js";
import {
  listBackgroundJobRuns,
  listBackgroundJobStates,
  listBackupRuns,
  syncBackgroundJobDefinitions,
  updateBackgroundJobStatus,
} from "./background-jobs.persistence.js";
import type { BackgroundJobStateRow, BackgroundJobStatus } from "./background-jobs.types.js";

export class BackgroundJobsService {
  // Combine configured job definitions with persisted scheduler and backup history
  async listJobs() {
    await syncBackgroundJobDefinitions(backgroundJobDefinitions);

    const states = await listBackgroundJobStates();
    const statesByKey = new Map(states.map((state) => [state.jobKey, state]));
    const backupRuns = await listBackupRuns();
    const jobRuns = await listBackgroundJobRuns();

    return {
      schedulerEnabled: config.backgroundJobs.enabled,
      jobs: backgroundJobDefinitions.map((job) => this.toJobResponse(job, statesByKey.get(job.id) || null)),
      backupRuns,
      jobRuns: jobRuns.map((run) => ({
        ...run,
        startedAt: new Date(run.startedAt).toISOString(),
        completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : null,
      })),
    };
  }

  async updateStatus(jobKey: string, status: Exclude<BackgroundJobStatus, "error">) {
    const definition = findBackgroundJobDefinition(jobKey);
    if (!definition) {
      throw ApiError.notFound("Background job not found");
    }

    await syncBackgroundJobDefinitions(backgroundJobDefinitions);
    await updateBackgroundJobStatus(
      jobKey,
      status,
      status === "active" ? definition.getNextRunAt(new Date()) : null,
    );

    return this.listJobs();
  }

  async runNow(jobKey: string) {
    const definition = await backgroundJobsScheduler.runNow(jobKey, "manual");
    if (!definition) {
      throw ApiError.notFound("Background job not found");
    }

    return this.listJobs();
  }

  private toJobResponse(job: (typeof backgroundJobDefinitions)[number], state: BackgroundJobStateRow | null) {
    const freshness = getJobFreshness(job, state, new Date());
    return {
      id: job.id,
      name: job.name,
      description: job.description,
      schedule: job.schedule,
      category: job.category,
      status: state?.status || "active",
      lastRun: state?.lastRunAt ? new Date(state.lastRunAt).toISOString() : null,
      nextRun: state?.nextRunAt ? new Date(state.nextRunAt).toISOString() : null,
      lastDuration: formatDuration(state?.lastDurationMs || null),
      successRate: getSuccessRate(state),
      successCount: state?.successCount || 0,
      failureCount: state?.failureCount || 0,
      lastStatus: state?.lastStatus || null,
      lastError: state?.lastErrorMessage || null,
      freshness,
    };
  }
}

export const backgroundJobsService = new BackgroundJobsService();

function formatDuration(durationMs: number | null) {
  if (durationMs === null) return "Not run yet";
  if (durationMs < 1000) return `${durationMs}ms`;

  return `${(durationMs / 1000).toFixed(1)}s`;
}

function getSuccessRate(state: BackgroundJobStateRow | null) {
  if (!state) return "Not run";

  const totalRuns = state.successCount + state.failureCount;
  if (totalRuns === 0) return "Not run";

  return `${Math.round((state.successCount / totalRuns) * 100)}%`;
}

export function getJobFreshness(
  job: (typeof backgroundJobDefinitions)[number],
  state: BackgroundJobStateRow | null,
  now: Date,
) {
  if (state?.status === "paused") {
    return { state: "paused", isFresh: null, checkedAt: now.toISOString(), staleAfter: null };
  }
  if (!state?.lastRunAt) {
    return { state: "never_run", isFresh: false, checkedAt: now.toISOString(), staleAfter: null };
  }
  if (state.status === "error" || state.lastStatus === "failed") {
    return {
      state: "failing",
      isFresh: false,
      checkedAt: now.toISOString(),
      staleAfter: job.getNextRunAt(new Date(state.lastRunAt)).toISOString(),
    };
  }

  const lastRunAt = new Date(state.lastRunAt);
  const expectedNext = job.getNextRunAt(lastRunAt);
  const expectedIntervalMs = Math.max(expectedNext.getTime() - lastRunAt.getTime(), 60_000);
  const staleAfter = new Date(expectedNext.getTime() + Math.max(expectedIntervalMs, 120_000));
  const isFresh = now <= staleAfter;
  return {
    state: isFresh ? "fresh" : "stale",
    isFresh,
    checkedAt: now.toISOString(),
    staleAfter: staleAfter.toISOString(),
  };
}
