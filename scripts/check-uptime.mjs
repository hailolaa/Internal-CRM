import process from "node:process";

const primaryUrl = process.env.UPTIME_CHECK_URL || "";
const criticalPathUrls = (process.env.UPTIME_CRITICAL_PATH_URLS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const serviceName = process.env.UPTIME_SERVICE_NAME || "mission-control";
const environment = process.env.UPTIME_ENVIRONMENT || process.env.NODE_ENV || "production";
const expectedStatus = Number(process.env.UPTIME_EXPECTED_STATUS || "200");
const timeoutMs = Number(process.env.UPTIME_TIMEOUT_MS || "10000");
const alertWebhookUrl = process.env.OBSERVABILITY_ALERT_WEBHOOK_URL || "";
const alertWebhookToken = process.env.OBSERVABILITY_ALERT_WEBHOOK_TOKEN || "";
const maxAttempts = Math.max(1, Number(process.env.OBSERVABILITY_ALERT_MAX_ATTEMPTS || "3"));
const retryBaseDelayMs = Number(process.env.OBSERVABILITY_ALERT_RETRY_BASE_DELAY_MS || "250");

if (!primaryUrl) {
  fail("UPTIME_CHECK_URL is required");
}

const checks = [primaryUrl, ...criticalPathUrls];
const failures = [];

for (const url of checks) {
  const result = await checkUrl(url);
  if (result.ok) {
    console.log(`Uptime check passed: ${safeUrl(url)} ${result.statusCode} ${result.durationMs}ms`);
    continue;
  }
  failures.push(result);
  const alert = buildAlert(result);
  console.error(JSON.stringify(alert, null, 2));
  if (alertWebhookUrl) await deliverAlert(alert);
}

if (failures.length > 0) process.exit(1);
process.exit(0);

async function checkUrl(url) {
  const startedAt = Date.now();
  let response;
  let error;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: { "x-correlation-id": `uptime-${Date.now()}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (caught) {
    error = caught;
  }

  const durationMs = Date.now() - startedAt;
  return {
    ok: Boolean(response && response.status === expectedStatus),
    url,
    statusCode: response?.status || null,
    durationMs,
    error,
  };
}

function buildAlert(result) {
  return {
    timestamp: new Date().toISOString(),
    service: serviceName,
    environment,
    release: {
      releaseId: process.env.RELEASE_ID || process.env.RELEASE_VERSION || null,
      revision: process.env.RELEASE_COMMIT_SHA || process.env.GITHUB_SHA || null,
      source: process.env.RELEASE_ID || process.env.RELEASE_COMMIT_SHA ? "environment" : "not_configured",
    },
    event_type: "uptime_failure",
    alertType: "uptime_failure",
    severity: "critical",
    title: `${serviceName} uptime check failed`,
    message: result.error instanceof Error
      ? redactString(result.error.message)
      : `Expected HTTP ${expectedStatus}, received ${result.statusCode || "no response"}`,
    statusCode: result.statusCode,
    url: safeUrl(result.url),
    durationMs: result.durationMs,
    retry_count: 0,
    status: "open",
  };
}

async function deliverAlert(alert) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(alertWebhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(alertWebhookToken ? { authorization: `Bearer ${alertWebhookToken}` } : {}),
        },
        body: JSON.stringify({ ...alert, retry_count: attempt - 1 }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return;
      if (attempt < maxAttempts) {
        await sleep(retryDelayMs(attempt, response.headers.get("retry-after")));
        continue;
      }
      console.error(`Alert delivery failed with ${response.status}`);
    } catch (deliveryError) {
      if (attempt < maxAttempts) {
        await sleep(retryDelayMs(attempt, null));
        continue;
      }
      console.error(deliveryError instanceof Error ? deliveryError.message : String(deliveryError));
    }
  }
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    if (url.search) url.search = "?[redacted]";
    return url.toString();
  } catch {
    return redactString(String(value));
  }
}

function redactString(value) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(?:sk|pk|rk|whsec|xox[baprs]|gh[pousr])_[A-Za-z0-9_=-]{8,}\b/g, "[redacted]");
}

function retryDelayMs(attempt, retryAfter) {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10_000);
  return Math.min(retryBaseDelayMs * 2 ** Math.max(0, attempt - 1), 10_000);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
