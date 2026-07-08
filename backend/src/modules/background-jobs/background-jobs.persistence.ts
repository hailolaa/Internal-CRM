import pool from "../../config/database.js";
import type {
  BackgroundJobDefinition,
  BackgroundJobRunRow,
  BackgroundJobRunStatus,
  BackgroundJobStateRow,
  BackgroundJobStatus,
  BackgroundJobTrigger,
} from "./background-jobs.types.js";

export async function syncBackgroundJobDefinitions(definitions: BackgroundJobDefinition[]) {
  const now = new Date();

  for (const definition of definitions) {
    await pool.execute(
      `INSERT INTO background_job_state (job_key, status, next_run_at)
       VALUES (?, 'active', ?)
       ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
      [definition.id, definition.getNextRunAt(now)],
    );
  }
}

export async function listBackgroundJobStates(): Promise<BackgroundJobStateRow[]> {
  const [rows]: any = await pool.execute(
    `SELECT job_key as jobKey, status, last_run_at as lastRunAt, next_run_at as nextRunAt,
            last_status as lastStatus, last_duration_ms as lastDurationMs,
            last_error_message as lastErrorMessage, success_count as successCount,
            failure_count as failureCount
     FROM background_job_state`,
  );

  return rows.map((row: any) => ({
    jobKey: row.jobKey,
    status: row.status,
    lastRunAt: row.lastRunAt,
    nextRunAt: row.nextRunAt,
    lastStatus: row.lastStatus,
    lastDurationMs: row.lastDurationMs === null ? null : Number(row.lastDurationMs),
    lastErrorMessage: row.lastErrorMessage,
    successCount: Number(row.successCount || 0),
    failureCount: Number(row.failureCount || 0),
  }));
}

export async function listDueBackgroundJobStates(now: Date): Promise<BackgroundJobStateRow[]> {
  const [rows]: any = await pool.execute(
    `SELECT job_key as jobKey, status, last_run_at as lastRunAt, next_run_at as nextRunAt,
            last_status as lastStatus, last_duration_ms as lastDurationMs,
            last_error_message as lastErrorMessage, success_count as successCount,
            failure_count as failureCount
     FROM background_job_state
     WHERE status = 'active' AND next_run_at IS NOT NULL AND next_run_at <= ?
     ORDER BY next_run_at ASC`,
    [now],
  );

  return rows.map((row: any) => ({
    jobKey: row.jobKey,
    status: row.status,
    lastRunAt: row.lastRunAt,
    nextRunAt: row.nextRunAt,
    lastStatus: row.lastStatus,
    lastDurationMs: row.lastDurationMs === null ? null : Number(row.lastDurationMs),
    lastErrorMessage: row.lastErrorMessage,
    successCount: Number(row.successCount || 0),
    failureCount: Number(row.failureCount || 0),
  }));
}

export async function updateBackgroundJobStatus(
  jobKey: string,
  status: BackgroundJobStatus,
  nextRunAt: Date | null,
) {
  await pool.execute(
    `UPDATE background_job_state
     SET status = ?, next_run_at = ?, last_error_message = CASE WHEN ? = 'active' THEN NULL ELSE last_error_message END
     WHERE job_key = ?`,
    [status, nextRunAt, status, jobKey],
  );
}

export async function createBackgroundJobRun(
  id: string,
  jobKey: string,
  triggeredBy: BackgroundJobTrigger,
) {
  await pool.execute(
    `INSERT INTO background_job_run (id, job_key, status, triggered_by)
     VALUES (?, ?, 'started', ?)`,
    [id, jobKey, triggeredBy],
  );
}

export async function completeBackgroundJobRun(
  id: string,
  status: Exclude<BackgroundJobRunStatus, "started">,
  durationMs: number,
  errorMessage: string | null,
  metadata: Record<string, unknown>,
) {
  await pool.execute(
    `UPDATE background_job_run
     SET status = ?, duration_ms = ?, error_message = ?, metadata = ?, completed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, durationMs, errorMessage, JSON.stringify(metadata), id],
  );
}

export async function updateBackgroundJobAfterRun(
  jobKey: string,
  status: Exclude<BackgroundJobRunStatus, "started">,
  durationMs: number,
  errorMessage: string | null,
  nextRunAt: Date,
) {
  await pool.execute(
    `UPDATE background_job_state
     SET status = ?,
         last_run_at = CURRENT_TIMESTAMP,
         next_run_at = ?,
         last_status = ?,
         last_duration_ms = ?,
         last_error_message = ?,
         success_count = success_count + CASE WHEN ? = 'completed' THEN 1 ELSE 0 END,
         failure_count = failure_count + CASE WHEN ? = 'failed' THEN 1 ELSE 0 END
     WHERE job_key = ?`,
    [
      status === "completed" ? "active" : "error",
      nextRunAt,
      status,
      durationMs,
      errorMessage,
      status,
      status,
      jobKey,
    ],
  );
}

export async function listBackgroundJobRuns(): Promise<BackgroundJobRunRow[]> {
  const [rows]: any = await pool.execute(
    `SELECT id, job_key as jobKey, status, triggered_by as triggeredBy,
            started_at as startedAt, completed_at as completedAt,
            duration_ms as durationMs, error_message as errorMessage, metadata
     FROM background_job_run
     ORDER BY started_at DESC
     LIMIT 20`,
  );

  return rows.map((row: any) => ({
    id: row.id,
    jobKey: row.jobKey,
    status: row.status,
    triggeredBy: row.triggeredBy,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    durationMs: row.durationMs === null ? null : Number(row.durationMs),
    errorMessage: row.errorMessage,
    metadata: parseJson(row.metadata, {}),
  }));
}

export async function listBackupRuns() {
  const [rows]: any = await pool.execute(
    `SELECT id, status, file_path as filePath, storage_provider as storageProvider,
            size_bytes as sizeBytes, started_at as startedAt, completed_at as completedAt,
            error_message as errorMessage
     FROM backup_run
     ORDER BY started_at DESC
     LIMIT 20`,
  );

  return rows.map((row: any) => ({
    id: row.id,
    status: row.status,
    filePath: row.filePath,
    storageProvider: row.storageProvider,
    sizeBytes: row.sizeBytes ? Number(row.sizeBytes) : null,
    startedAt: new Date(row.startedAt).toISOString(),
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    errorMessage: row.errorMessage,
  }));
}

function parseJson(value: unknown, fallback: unknown) {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}
