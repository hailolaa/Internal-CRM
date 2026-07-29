import { config } from "../config/index.js";
import logger from "./logger.js";

export type ObservabilityAlertSeverity = "info" | "warning" | "error" | "critical";
export type ObservabilityAlertType =
  | "api_error"
  | "provider_failure"
  | "background_job_failure"
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

function serializeError(error: unknown) {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    message: String(error),
  };
}

function buildAlert(input: ObservabilityAlertInput) {
  const traceId = input.traceId || input.requestId || null;

  return {
    service: config.observability.serviceName,
    environment: config.nodeEnv,
    alertType: input.type,
    severity: input.severity,
    title: input.title,
    message: input.message,
    traceId,
    requestId: input.requestId || null,
    clinicId: input.clinicId || null,
    userId: input.userId || null,
    provider: input.provider || null,
    jobKey: input.jobKey || null,
    statusCode: input.statusCode || null,
    path: input.path || null,
    method: input.method || null,
    durationMs: input.durationMs || null,
    context: input.context || {},
    error: serializeError(input.error),
    timestamp: new Date().toISOString(),
  };
}

export async function notifyObservabilityAlert(input: ObservabilityAlertInput) {
  const alert = buildAlert(input);

  logger.error("observability_alert", alert);

  if (!config.observability.alertWebhookUrl) {
    return { delivered: false, reason: "alert_webhook_not_configured" };
  }

  try {
    const response = await fetch(config.observability.alertWebhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(config.observability.alertWebhookToken
          ? { authorization: `Bearer ${config.observability.alertWebhookToken}` }
          : {}),
      },
      body: JSON.stringify(alert),
      signal: AbortSignal.timeout(config.observability.alertTimeoutMs),
    });

    if (!response.ok) {
      logger.error("observability_alert_delivery_failed", {
        traceId: alert.traceId,
        alertType: alert.alertType,
        statusCode: response.status,
      });
      return { delivered: false, reason: `webhook_status_${response.status}` };
    }

    return { delivered: true };
  } catch (error) {
    logger.error("observability_alert_delivery_failed", {
      traceId: alert.traceId,
      alertType: alert.alertType,
      error: error instanceof Error ? error.message : String(error),
    });
    return { delivered: false, reason: "webhook_request_failed" };
  }
}
