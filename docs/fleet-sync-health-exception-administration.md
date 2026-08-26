# Fleet Sync Health and Exception Administration

Mission Control treats client sync health as a first-class operational view over configured client data sources. The view is evidence based: a source is only healthy when there is processing evidence, no open exception, and the freshness SLA is met.

## Health States

- `healthy`: events are processing normally and the freshness SLA is met.
- `delayed`: the source has an open or acknowledged freshness alert.
- `retrying`: events are queued for another safe processing attempt.
- `dead_letter`: one or more ingestion events exhausted retries and require controlled replay.
- `reconciliation_needed`: an open or acknowledged reconciliation issue exists.
- `paused`: the source is paused or inactive.
- `unknown`: the source is configured but has no event, checkpoint or successful ingestion evidence yet.
- `blocked`: tenant onboarding or provider access is blocked.

Roadmap sources remain explicitly labelled as roadmap/provider state and are not counted as live healthy data.

## Exception Types

- `dead_letter`: generated from `fleet_ingestion_event` rows in `dead_letter`.
- `freshness`: generated from `analytics_freshness_alert` rows in `open` or `acknowledged`.
- `reconciliation`: generated from `analytics_reconciliation_issue` rows in `open` or `acknowledged`.
- `source_status`: generated from source configuration states such as blocked onboarding, paused/inactive sources, roadmap sources or sources with no sync evidence.

Exception details shown to users are redacted for common secrets, auth headers and email addresses.

## Administration Actions

- Dead-letter exceptions can be replayed.
- Freshness and reconciliation exceptions can be acknowledged, resolved or dismissed.
- Source-status exceptions are diagnostic only; the required action is provider/source configuration review.

Every replay, acknowledgement, resolution and dismissal is recorded in `fleet_sync_exception_action_log` with:

- clinic and source
- exception type and ID
- action
- previous and next status
- reason
- correlation ID when available
- actor user ID
- timestamp

Resolved or dismissed exceptions are closed and no longer appear in the open action queue. Acknowledged exceptions remain visible until resolved or dismissed.

## Tenant Boundary

Sync-health reads are scoped to the current clinic unless the authenticated user has all-client management access. Administration actions validate the exception's clinic before applying a replay or lifecycle change.

## Related Data Contracts

CG-160 client operating register data is separate from fleet sync health. Sync health can reference client/workspace identity, but it does not mutate operating-register records or provider source data.
