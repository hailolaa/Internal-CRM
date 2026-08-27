import assert from "node:assert/strict";
import test from "node:test";
import { getJobFreshness } from "../modules/background-jobs/background-jobs.service.js";
import type { BackgroundJobDefinition, BackgroundJobStateRow } from "../modules/background-jobs/background-jobs.types.js";

const job: BackgroundJobDefinition = {
  id: "test-job",
  name: "Test",
  description: "Test",
  schedule: "Every 5 minutes",
  category: "Test",
  getNextRunAt: (from) => new Date(from.getTime() + 5 * 60_000),
  handler: async () => ({}),
};

function state(patch: Partial<BackgroundJobStateRow> = {}): BackgroundJobStateRow {
  return {
    jobKey: job.id,
    status: "active",
    lastRunAt: new Date("2026-08-27T12:00:00Z"),
    nextRunAt: new Date("2026-08-27T12:05:00Z"),
    lastStatus: "completed",
    lastDurationMs: 100,
    lastErrorMessage: null,
    successCount: 1,
    failureCount: 0,
    ...patch,
  };
}

test("background job freshness distinguishes fresh, stale, failed, paused and never-run jobs", () => {
  assert.equal(getJobFreshness(job, state(), new Date("2026-08-27T12:09:59Z")).state, "fresh");
  assert.equal(getJobFreshness(job, state(), new Date("2026-08-27T12:10:01Z")).state, "stale");
  assert.equal(getJobFreshness(job, state({ status: "error", lastStatus: "failed" }), new Date()).state, "failing");
  assert.equal(getJobFreshness(job, state({ status: "paused" }), new Date()).state, "paused");
  assert.equal(getJobFreshness(job, state({ lastRunAt: null, successCount: 0 }), new Date()).state, "never_run");
});
