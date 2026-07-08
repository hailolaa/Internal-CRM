import { randomUUID } from "crypto";
import { config } from "../../config/index.js";
import logger from "../../utils/logger.js";
import {
  backgroundJobDefinitions,
  findBackgroundJobDefinition,
} from "./background-jobs.definitions.js";
import {
  completeBackgroundJobRun,
  createBackgroundJobRun,
  listDueBackgroundJobStates,
  syncBackgroundJobDefinitions,
  updateBackgroundJobAfterRun,
} from "./background-jobs.persistence.js";
import type { BackgroundJobDefinition, BackgroundJobTrigger } from "./background-jobs.types.js";

export class BackgroundJobsScheduler {
  private timer: NodeJS.Timeout | null = null;
  private readonly runningJobKeys = new Set<string>();

  async start() {
    await syncBackgroundJobDefinitions(backgroundJobDefinitions);

    if (!config.backgroundJobs.enabled) {
      logger.info("Background jobs scheduler disabled", {
        enabled: config.backgroundJobs.enabled,
      });
      return;
    }

    await this.tick();
    this.timer = setInterval(() => {
      this.tick().catch((error: any) => {
        logger.error("Background jobs scheduler tick failed", {
          message: error.message,
          stack: error.stack,
        });
      });
    }, config.backgroundJobs.pollIntervalMs);

    logger.info("Background jobs scheduler started", {
      pollIntervalMs: config.backgroundJobs.pollIntervalMs,
    });
  }

  stop() {
    if (!this.timer) return;

    clearInterval(this.timer);
    this.timer = null;
    logger.info("Background jobs scheduler stopped");
  }

  async runNow(jobKey: string, triggeredBy: BackgroundJobTrigger = "manual") {
    const definition = findBackgroundJobDefinition(jobKey);
    if (!definition) return null;

    await this.runJob(definition, triggeredBy);
    return definition;
  }

  private async tick() {
    const dueJobs = await listDueBackgroundJobStates(new Date());

    for (const jobState of dueJobs) {
      const definition = findBackgroundJobDefinition(jobState.jobKey);
      if (!definition) continue;

      await this.runJob(definition, "schedule");
    }
  }

  private async runJob(definition: BackgroundJobDefinition, triggeredBy: BackgroundJobTrigger) {
    if (this.runningJobKeys.has(definition.id)) return;

    this.runningJobKeys.add(definition.id);
    const runId = randomUUID();
    const startedAt = Date.now();

    await createBackgroundJobRun(runId, definition.id, triggeredBy);
    logger.info("Background job started", {
      jobKey: definition.id,
      triggeredBy,
    });

    try {
      const result = await definition.handler();
      const durationMs = Date.now() - startedAt;

      await completeBackgroundJobRun(runId, "completed", durationMs, null, result);
      await updateBackgroundJobAfterRun(
        definition.id,
        "completed",
        durationMs,
        null,
        definition.getNextRunAt(new Date()),
      );
      logger.info("Background job completed", {
        jobKey: definition.id,
        durationMs,
        result,
      });
    } catch (error: any) {
      const durationMs = Date.now() - startedAt;
      const message = error?.message || "Background job failed";

      await completeBackgroundJobRun(runId, "failed", durationMs, message, {});
      await updateBackgroundJobAfterRun(
        definition.id,
        "failed",
        durationMs,
        message,
        definition.getNextRunAt(new Date()),
      );
      logger.error("Background job failed", {
        jobKey: definition.id,
        durationMs,
        message,
        stack: error?.stack,
      });
    } finally {
      this.runningJobKeys.delete(definition.id);
    }
  }
}

export const backgroundJobsScheduler = new BackgroundJobsScheduler();
