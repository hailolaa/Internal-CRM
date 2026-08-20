"use client";

import { publicEnv } from "@/lib/env";

type ClientSeverity = "info" | "warning" | "error" | "critical";
type ClientEventType = "frontend_error" | "frontend_api_failure";

const REDACTED = "[redacted]";
const SENSITIVE_KEY_PATTERN =
  /(^|_|-)(password|passcode|token|access.?token|refresh.?token|authorization|cookie|api.?key|secret|client.?secret|oauth|stripe|card|payment|cvv|cvc|email|phone|name|first.?name|last.?name|patient|contact|body)(_|-|$)/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const TOKEN_PATTERN = /\b(?:sk|pk|rk|whsec|xox[baprs]|gh[pousr])_[A-Za-z0-9_=-]{8,}\b/g;

const dedupeState = new Map<string, number>();
let rateWindowStartedAt = 0;
let rateWindowCount = 0;

function sanitizeString(value: string) {
  return value
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(TOKEN_PATTERN, REDACTED)
    .replace(EMAIL_PATTERN, REDACTED)
    .replace(PHONE_PATTERN, REDACTED);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function redactClientTelemetry(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return {
      name: sanitizeString(value.name),
      message: sanitizeString(value.message),
      stack: value.stack ? sanitizeString(value.stack) : undefined,
    };
  }
  if (depth >= 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactClientTelemetry(item, depth + 1));
  if (!isPlainObject(value)) return sanitizeString(String(value));

  const safe: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    safe[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? REDACTED
      : redactClientTelemetry(nested, depth + 1);
  }
  return safe;
}

export function createClientCorrelationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function currentRoute() {
  if (typeof window === "undefined") return null;
  return `${window.location.pathname}${window.location.search ? "?[redacted]" : ""}`;
}

export function buildClientObservabilityEvent(input: {
  eventType: ClientEventType;
  severity?: ClientSeverity;
  message: string;
  error?: unknown;
  requestId?: string | null;
  correlationId?: string | null;
  route?: string | null;
  component?: string | null;
  statusCode?: number | null;
  context?: Record<string, unknown>;
}) {
  return {
    timestamp: new Date().toISOString(),
    service: publicEnv.observabilityServiceName,
    environment: publicEnv.releaseEnvironment,
    release: {
      releaseId: publicEnv.releaseId || null,
      revision: publicEnv.releaseCommitSha || null,
      source: publicEnv.releaseId || publicEnv.releaseCommitSha ? "environment" : "not_configured",
    },
    event_type: input.eventType,
    severity: input.severity || "error",
    message: redactClientTelemetry(input.message),
    request_id: input.requestId || null,
    correlation_id: input.correlationId || input.requestId || null,
    route: input.route || currentRoute(),
    component: input.component || null,
    statusCode: input.statusCode || null,
    status: "open",
    context: redactClientTelemetry(input.context || {}),
    error: redactClientTelemetry(input.error),
  };
}

function shouldSuppress(event: ReturnType<typeof buildClientObservabilityEvent>) {
  const now = Date.now();
  const dedupeWindowMs = 60_000;
  const rateLimitPerMinute = 30;

  for (const [key, expiresAt] of dedupeState.entries()) {
    if (expiresAt <= now) dedupeState.delete(key);
  }
  if (rateWindowStartedAt + 60_000 <= now) {
    rateWindowStartedAt = now;
    rateWindowCount = 0;
  }
  rateWindowCount += 1;
  if (rateWindowCount > rateLimitPerMinute) return true;

  const fingerprint = JSON.stringify({
    event_type: event.event_type,
    message: event.message,
    route: event.route,
    component: event.component,
    statusCode: event.statusCode,
  });
  if (dedupeState.has(fingerprint)) return true;
  dedupeState.set(fingerprint, now + dedupeWindowMs);
  return false;
}

export function sendClientObservabilityEvent(event: ReturnType<typeof buildClientObservabilityEvent>) {
  if (!publicEnv.observabilityClientEndpoint || shouldSuppress(event)) return;
  const body = JSON.stringify(event);
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const queued = navigator.sendBeacon(
      publicEnv.observabilityClientEndpoint,
      new Blob([body], { type: "application/json" }),
    );
    if (queued) return;
  }
  void fetch(publicEnv.observabilityClientEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
    credentials: "omit",
  }).catch(() => undefined);
}

export function captureFrontendError(input: Parameters<typeof buildClientObservabilityEvent>[0]) {
  sendClientObservabilityEvent(buildClientObservabilityEvent(input));
}

export function recordApiFailure(input: {
  path: string;
  method?: string | null;
  statusCode?: number | null;
  requestId?: string | null;
  correlationId?: string | null;
  message: string;
  error?: unknown;
}) {
  captureFrontendError({
    eventType: "frontend_api_failure",
    severity: input.statusCode && input.statusCode >= 500 ? "error" : "warning",
    message: input.message,
    requestId: input.requestId,
    correlationId: input.correlationId,
    route: input.path,
    statusCode: input.statusCode,
    error: input.error,
    context: {
      method: input.method || "GET",
    },
  });
}

export function installClientObservabilityHandlers() {
  if (typeof window === "undefined") return () => undefined;

  const onError = (event: ErrorEvent) => {
    captureFrontendError({
      eventType: "frontend_error",
      severity: "error",
      message: event.message || "Unhandled frontend error",
      error: event.error || event.message,
      route: currentRoute(),
      context: {
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      },
    });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    captureFrontendError({
      eventType: "frontend_error",
      severity: "error",
      message: "Unhandled frontend promise rejection",
      error: event.reason,
      route: currentRoute(),
    });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}

export function resetClientObservabilityForTests() {
  dedupeState.clear();
  rateWindowStartedAt = 0;
  rateWindowCount = 0;
}
