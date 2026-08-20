import assert from "node:assert/strict";
import test from "node:test";
import { config } from "../config/index.js";
import {
  notifyObservabilityAlert,
  resetObservabilityAlertStateForTests,
} from "../utils/observability.js";
import { redactSensitiveValue, redactTelemetryPath } from "../utils/redaction.js";

const mutableObservability = config.observability as typeof config.observability & {
  alertWebhookUrl: string;
  alertWebhookToken: string;
  alertMaxAttempts: number;
  alertRetryBaseDelayMs: number;
  alertDedupeWindowMs: number;
  alertRateLimitPerMinute: number;
};

const originalObservability = { ...config.observability };
const originalFetch = globalThis.fetch;

test.afterEach(() => {
  Object.assign(mutableObservability, originalObservability);
  resetObservabilityAlertStateForTests();
  globalThis.fetch = originalFetch;
});

test("observability redacts secrets and personal payloads", () => {
  const sanitized = redactSensitiveValue({
    password: "secret",
    authorization: "Bearer sk_live_secret",
    email: "patient@example.com",
    nested: {
      phone: "+44 7700 900123",
      safe: "status changed",
    },
  });

  const serialized = JSON.stringify(sanitized);
  assert.equal(serialized.includes("secret"), false);
  assert.equal(serialized.includes("patient@example.com"), false);
  assert.equal(serialized.includes("+44 7700"), false);
  assert.equal(serialized.includes("status changed"), true);
});

test("observability sanitizes sensitive query parameters", () => {
  const path = redactTelemetryPath(
    "/api/contacts?email=patient@example.com&page=1&token=abc123",
  );
  assert.equal(path, "/api/contacts?email=%5Bredacted%5D&page=1&token=%5Bredacted%5D");
});

test("observability sends shared event contract with redaction and release context", async () => {
  mutableObservability.alertWebhookUrl = "https://alerts.example.test/ingest";
  mutableObservability.alertWebhookToken = "alert-token";
  mutableObservability.alertMaxAttempts = 1;

  const calls: Array<{ url: string; init: RequestInit; body: any }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      init: init || {},
      body: JSON.parse(String(init?.body || "{}")),
    });
    return new Response("ok", { status: 200 });
  }) as typeof fetch;

  const result = await notifyObservabilityAlert({
    type: "api_error",
    severity: "critical",
    title: "API failed",
    message: "Patient patient@example.com failed",
    requestId: "req-1",
    clinicId: "clinic-1",
    path: "/api/proposals?token=secret",
    method: "POST",
    error: new Error("Bearer sk_live_secret"),
    context: {
      requestBody: { password: "secret", name: "Patient Name" },
    },
  });

  assert.deepEqual(result, { delivered: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.body.event_type, "api_error");
  assert.equal(calls[0]!.body.alertType, "api_error");
  assert.match(calls[0]!.body.release.source, /^(environment|manifest)$/);
  assert.equal(calls[0]!.body.requestId, "req-1");
  assert.equal(JSON.stringify(calls[0]!.body).includes("patient@example.com"), false);
  assert.equal(JSON.stringify(calls[0]!.body).includes("sk_live_secret"), false);
  assert.equal(JSON.stringify(calls[0]!.body).includes("Patient Name"), false);
  assert.equal(JSON.stringify(calls[0]!.body.context).includes("\"name\":\"[redacted]\""), true);
});

test("observability suppresses duplicate alerts during the dedupe window", async () => {
  mutableObservability.alertWebhookUrl = "https://alerts.example.test/ingest";
  mutableObservability.alertMaxAttempts = 1;
  mutableObservability.alertDedupeWindowMs = 60_000;

  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("ok", { status: 200 });
  }) as typeof fetch;

  await notifyObservabilityAlert({
    type: "background_job_failure",
    severity: "critical",
    title: "Job failed",
    message: "Same failure",
    jobKey: "job-1",
  });
  const second = await notifyObservabilityAlert({
    type: "background_job_failure",
    severity: "critical",
    title: "Job failed",
    message: "Same failure",
    jobKey: "job-1",
  });

  assert.equal(calls, 1);
  assert.equal(second.reason, "duplicate_suppressed");
});

test("observability retries bounded webhook failures", async () => {
  mutableObservability.alertWebhookUrl = "https://alerts.example.test/ingest";
  mutableObservability.alertMaxAttempts = 2;
  mutableObservability.alertRetryBaseDelayMs = 1;

  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("temporary", { status: calls === 1 ? 503 : 200 });
  }) as typeof fetch;

  const result = await notifyObservabilityAlert({
    type: "provider_failure",
    severity: "error",
    title: "Provider failed",
    message: "Provider timeout",
    provider: "brevo",
  });

  assert.deepEqual(result, { delivered: true });
  assert.equal(calls, 2);
});
