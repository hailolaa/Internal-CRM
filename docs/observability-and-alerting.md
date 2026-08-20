# Observability And Alerting

This system now has the repo-side hooks needed for production monitoring: structured logs, request correlation, sanitized API error alerts, frontend runtime and API failure telemetry, background job failure alerts and uptime checks.

The remaining external step is connecting the monitoring account and alert destination. Until that is connected, critical events are still written to the application logs as `observability_alert` records.

Status: ENGINEERING-PREPARED. PRODUCTION CONFIG REQUIRED before live alert routing is operational.

## What Is Covered

- Every API request carries a request ID and logs the request path, status, duration, user and workspace context where available.
- Server-side API errors create an alert payload with service, environment, release, request ID, trace ID, user, workspace, route and scrubbed error details.
- Frontend runtime errors, unhandled promise rejections and API failures can emit provider-neutral telemetry when `NEXT_PUBLIC_OBSERVABILITY_CLIENT_ENDPOINT` is configured.
- Email provider failures create an alert before the request fails, including the provider name, response status and safe delivery context.
- Failed background jobs create an alert with the job key, run ID and duration, so the failed run can be matched back to the job logs.
- Alert delivery has duplicate suppression, a per-minute rate limit and bounded retry/backoff.
- A scheduled uptime workflow can check the production URL plus optional critical-path URLs every five minutes and route failures to the same alert destination.

All event payloads use a shared contract: `timestamp`, `service`, `environment`, `release`, `event_type`, `severity`, `requestId`/`traceId`, route or job/provider context, `retry_count`, `status` and scrubbed error/context fields.

## Required External Setup

The monitoring account needs one inbound webhook or alert ingestion endpoint. That can be Slack, Better Stack, Datadog, Sentry, Grafana, Opsgenie or any other tool the team chooses.

Set these values in the backend environment:

```bash
OBSERVABILITY_SERVICE_NAME=mission-control-backend
OBSERVABILITY_ALERT_WEBHOOK_URL=
OBSERVABILITY_ALERT_WEBHOOK_TOKEN=
OBSERVABILITY_ALERT_TIMEOUT_MS=5000
OBSERVABILITY_ALERT_MAX_ATTEMPTS=3
OBSERVABILITY_ALERT_RETRY_BASE_DELAY_MS=250
OBSERVABILITY_ALERT_DEDUPE_WINDOW_MS=300000
OBSERVABILITY_ALERT_RATE_LIMIT_PER_MINUTE=60
NEXT_PUBLIC_OBSERVABILITY_CLIENT_ENDPOINT=
NEXT_PUBLIC_OBSERVABILITY_SERVICE_NAME=mission-control-frontend
```

Set these values as repository or environment secrets for the uptime workflow:

```bash
UPTIME_CHECK_URL=
UPTIME_CRITICAL_PATH_URLS=
OBSERVABILITY_ALERT_WEBHOOK_URL=
OBSERVABILITY_ALERT_WEBHOOK_TOKEN=
```

The alert destination should route urgent production failures to the agreed team channel and keep searchable history. The log collector should ingest backend stdout or the platform log stream and index `requestId`, `traceId`, `clinicId`, `userId`, `event_type`, `provider`, `jobKey`, release ID and revision.

Do not put patient/contact payloads, OAuth secrets, payment data, raw request bodies or provider raw payloads into alert routes. The application scrubber redacts known sensitive keys, but production monitoring should still prefer allowlisted fields.

## Proof Checks

These checks are intentionally controlled by a feature flag so they cannot be triggered in production by accident.

Set the backend test controls:

```bash
OBSERVABILITY_TEST_ENABLED=true
OBSERVABILITY_TEST_TOKEN=<strong-shared-test-token>
```

API error proof:

```bash
curl -X POST "$API_BASE_URL/api/health/observability/test-error" \
  -H "x-observability-test-token: <strong-shared-test-token>"
```

Expected result: the request returns a server error and an `api_error` alert appears with request and trace context.

Provider failure proof:

Use a non-production email provider key or a provider test failure mode, then send a test email through the normal email path.

Expected result: the email request fails cleanly and a `provider_failure` alert appears with `provider=brevo`, status code and request context.

Background job proof:

```bash
curl -X POST "$API_BASE_URL/api/background-jobs/observability-failure-probe/run" \
  -H "Authorization: Bearer <admin-token>"
```

Expected result: the job fails by design and a `background_job_failure` alert appears with `jobKey=observability-failure-probe` and a run ID.

Uptime proof:

Run the uptime workflow manually after the production URL, critical-path URLs and alert webhook secrets are set. For a negative test, temporarily point the check at a known failing health URL in a safe environment and confirm an `uptime_failure` alert is received.

## Reviewer Notes

This work is ready for code review, but the full production proof depends on the external monitoring account. The reviewer needs to add the webhook URL/token, confirm the log drain or platform log ingestion, define on-call routing/escalation, then run the proof checks above in staging before enabling production alert routing.
