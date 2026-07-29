# Observability And Alerting

This system now has the backend hooks needed for production monitoring: structured logs, request correlation, API error alerts, provider failure alerts, background job failure alerts and uptime checks.

The remaining external step is connecting the monitoring account and alert destination. Until that is connected, critical events are still written to the application logs as `observability_alert` records.

## What Is Covered

- Every API request carries a request ID and logs the request path, status, duration, user and workspace context where available.
- Unhandled or server-side API errors create an alert payload with service, environment, request ID, trace ID, user, workspace, route and error details.
- Email provider failures create an alert before the request fails, including the provider name, response status and safe delivery context.
- Failed background jobs create an alert with the job key, run ID and duration, so the failed run can be matched back to the job logs.
- A scheduled uptime workflow can check the production URL every five minutes and route failures to the same alert destination.

## Required External Setup

The monitoring account needs one inbound webhook or alert ingestion endpoint. That can be Slack, Better Stack, Datadog, Sentry, Grafana, Opsgenie or any other tool the team chooses.

Set these values in the backend environment:

```bash
OBSERVABILITY_SERVICE_NAME=mission-control-backend
OBSERVABILITY_ALERT_WEBHOOK_URL=
OBSERVABILITY_ALERT_WEBHOOK_TOKEN=
OBSERVABILITY_ALERT_TIMEOUT_MS=5000
```

Set these values as repository or environment secrets for the uptime workflow:

```bash
UPTIME_CHECK_URL=
OBSERVABILITY_ALERT_WEBHOOK_URL=
OBSERVABILITY_ALERT_WEBHOOK_TOKEN=
```

The alert destination should route urgent production failures to the agreed team channel and keep searchable history. The log collector should ingest backend stdout or the platform log stream and index `requestId`, `traceId`, `clinicId`, `userId`, `alertType`, `provider` and `jobKey`.

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

Run the uptime workflow manually after the production URL and alert webhook secrets are set. For a negative test, temporarily point the check at a known failing health URL in a safe environment and confirm an `uptime_failure` alert is received.

## Reviewer Notes

This work is ready for code review, but the full acceptance proof depends on the external monitoring account. The reviewer needs to add the webhook URL/token, confirm the log drain or platform log ingestion, then run the three proof checks above.
