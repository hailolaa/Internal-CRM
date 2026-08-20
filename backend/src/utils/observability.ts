import { config } from "../config/index.js";
import logger from "./logger.js";
import { getReleaseInfo } from "./releaseInfo.js";
import {
  observabilityFingerprint,
  redactSensitiveValue,
  redactTelemetryPath,
} from "./redaction.js";

export type ObservabilityAlertSeverity = "info" | "warning" | "error" | "critical";
export type ObservabilityAlertType =
  | "api_error"
  | "provider_failure"
  | "background_job_failure"
  | "frontend_error"
  | "frontend_api_failure"
  | "uptime_failure"
  | "observability_test";

export interface ObservabilityAlertInput {
  type: ObservabilityAlertType;
  severity: ObservabilityAlertSeverity;
  title: string;
  message: string;
  requestId?: string | null;
  traceId?: string | null;
  clinicId?: string | null;
  userId?: string | null;
  provider?: string | null;
  jobKey?: string | null;
  statusCode?: number | null;
  path?: string | null;
  method?: string | null;
  durationMs?: number | null;
  error?: unknown;
  context?: Record<string, unknown>;
}

const alertState = new Map<string, { expiresAt: number; count: number }>();
let rateWindowStartedAt = 0;
let rateWindowCount = 0;

function serializeError(error: unknown) {
  if (!error) return undefined;
  if (error instanceof Error) {
    return redactSensitiveValue({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }
  return redactSensitiveValue({ message: String(error) });
}

function buildAlert(input: ObservabilityAlertInput) {
  const traceId = input.traceId || input.requestId || null;
  const release = getReleaseInfo();

  return {
    timestamp: new Date().toISOString(),
    service: config.observability.serviceName,
    environment: config.nodeEnv,
    release: {
      releaseId: release.releaseId,
      revision: release.missionControl.revision,
      source: release.source,
    },
    event_type: input.type,
    alertType: input.type,
    severity: input.severity,
    title: redactSensitiveValue(input.title),
    message: redactSensitiveValue(input.message),
    traceId,
    requestId: input.requestId || null,
    clinicId: input.clinicId || null,
    userId: input.userId || null,
    provider: input.provider || null,
    jobKey: input.jobKey || null,
    statusCode: input.statusCode || null,
    path: redactTelemetryPath(input.path),
    method: input.method || null,
    durationMs: input.durationMs || null,
    retry_count: 0,
    status: "open",
    context: redactSensitiveValue(input.context || {}),
    error: serializeError(input.error),
  };
}

function shouldSuppressAlert(alert: ReturnType<typeof buildAlert>) {
  const now = Date.now();

  for (const [key, state] of alertState.entries()) {
    if (state.expiresAt <= now) alertState.delete(key);
  }

  if (rateWindowStartedAt + 60_000 <= now) {
    rateWindowStartedAt = now;
    rateWindowCount = 0;
  }
  rateWindowCount += 1;
  if (
    config.observability.alertRateLimitPerMinute > 0 &&
    rateWindowCount > config.observability.alertRateLimitPerMinute
  ) {
    return { suppressed: true, reason: "rate_limited" };
  }

  const key = observabilityFingerprint({
    event_type: alert.event_type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    path: alert.path,
    statusCode: alert.statusCode,
    provider: alert.provider,
    jobKey: alert.jobKey,
  });
  const existing = alertState.get(key);
  if (existing && existing.expiresAt > now) {
    existing.count += 1;
    return { suppressed: true, reason: "duplicate_suppressed" };
  }
  alertState.set(key, {
    expiresAt: now + config.observability.alertDedupeWindowMs,
    count: 1,
  });
  return { suppressed: false, reason: null };
}

function retryDelayMs(attempt: number, retryAfter: string | null) {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10_000);
  }
  return Math.min(
    config.observability.alertRetryBaseDelayMs * 2 ** Math.max(0, attempt - 1),
    10_000,
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function notifyObservabilityAlert(input: ObservabilityAlertInput) {
  const alert = buildAlert(input);

  logger.error("observability_alert", alert);

  const suppression = shouldSuppressAlert(alert);
  if (suppression.suppressed) {
    logger.warn("observability_alert_suppressed", {
      traceId: alert.traceId,
      alertType: alert.alertType,
      reason: suppression.reason,
    });
    return { delivered: false, reason: suppression.reason || "suppressed" };
  }

  if (!config.observability.alertWebhookUrl) {
    return { delivered: false, reason: "alert_webhook_not_configured" };
  }

  const maxAttempts = Math.max(1, config.observability.alertMaxAttempts);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const payload = { ...alert, retry_count: attempt - 1 };
      const response = await fetch(config.observability.alertWebhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(config.observability.alertWebhookToken
            ? { authorization: `Bearer ${config.observability.alertWebhookToken}` }
            : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(config.observability.alertTimeoutMs),
      });

      if (!response.ok) {
        logger.error("observability_alert_delivery_failed", {
          traceId: alert.traceId,
          alertType: alert.alertType,
          statusCode: response.status,
          attempt,
        });
        if (attempt < maxAttempts) {
          await sleep(retryDelayMs(attempt, response.headers.get("retry-after")));
          continue;
        }
        return { delivered: false, reason: `webhook_status_${response.status}` };
      }

      return { delivered: true };
    } catch (error) {
      logger.error("observability_alert_delivery_failed", {
        traceId: alert.traceId,
        alertType: alert.alertType,
        error: error instanceof Error ? error.message : String(error),
        attempt,
      });
      if (attempt < maxAttempts) {
        await sleep(retryDelayMs(attempt, null));
        continue;
      }
      return { delivered: false, reason: "webhook_request_failed" };
    }
  }

  return { delivered: false, reason: "webhook_request_failed" };
}

export function resetObservabilityAlertStateForTests() {
  alertState.clear();
  rateWindowStartedAt = 0;
  rateWindowCount = 0;
}
