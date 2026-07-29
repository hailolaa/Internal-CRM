# Background Jobs And Queue Handling

## Status

Accepted.

## Context

Mission Control needs scheduled work for SLA checks, recurring tasks, communication sequences and reporting rollups. The MVP does not require a separate distributed queue service yet, but scheduled work still needs visibility, repeatability and failure tracking.

## Decision

Scheduled work runs through an in-process background job scheduler with persisted job state and run history.

The scheduler is environment controlled. It is disabled unless explicitly enabled by configuration, and production can enable polling with `BACKGROUND_JOBS_ENABLED` and `BACKGROUND_JOBS_POLL_INTERVAL_MS`.

Each job definition owns:

- Stable job key
- Display name
- Description
- Schedule text
- Category
- Next-run calculation
- Handler function

The scheduler prevents the same job key from running concurrently in the same process.

## Consequences

The system has a simple operational model for MVP scheduled tasks without introducing a new infrastructure dependency.

The trade-off is that multi-instance deployments need care. If more than one backend instance runs scheduled jobs, a future database-level lock or external queue should be added before enabling the scheduler on every instance.

Long-running or high-volume provider sends should move to a durable queue when volume requires stronger retry isolation.

## Implementation Notes

- `backend/src/modules/background-jobs/background-jobs.scheduler.ts` owns scheduler start, stop, polling and run execution.
- `background_job_state` stores scheduler state and next run time.
- `background_job_run` stores run history, status, duration, error and result payload.
- Current job definitions include SLA breach checks, daily SLA/report rollups, recurring task generation and sequence execution.
- Manual job execution remains available through the background-jobs API for controlled operational runs.
