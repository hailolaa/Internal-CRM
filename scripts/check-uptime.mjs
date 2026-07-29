import process from "node:process";

const url = process.env.UPTIME_CHECK_URL || "";
const serviceName = process.env.UPTIME_SERVICE_NAME || "mission-control";
const environment = process.env.UPTIME_ENVIRONMENT || process.env.NODE_ENV || "production";
const expectedStatus = Number(process.env.UPTIME_EXPECTED_STATUS || "200");
const timeoutMs = Number(process.env.UPTIME_TIMEOUT_MS || "10000");
const alertWebhookUrl = process.env.OBSERVABILITY_ALERT_WEBHOOK_URL || "";
const alertWebhookToken = process.env.OBSERVABILITY_ALERT_WEBHOOK_TOKEN || "";

if (!url) {
  fail("UPTIME_CHECK_URL is required");
}

const startedAt = Date.now();
let response;
let error;

try {
  response = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(timeoutMs),
  });
} catch (caught) {
  error = caught;
}

const durationMs = Date.now() - startedAt;
const ok = Boolean(response && response.status === expectedStatus);

if (ok) {
  console.log(`Uptime check passed: ${url} ${response.status} ${durationMs}ms`);
  process.exit(0);
}

const alert = {
  service: serviceName,
  environment,
  alertType: "uptime_failure",
  severity: "critical",
  title: `${serviceName} uptime check failed`,
  message: error instanceof Error
    ? error.message
    : `Expected HTTP ${expectedStatus}, received ${response?.status || "no response"}`,
  statusCode: response?.status || null,
  url,
  durationMs,
  timestamp: new Date().toISOString(),
};

console.error(JSON.stringify(alert, null, 2));

if (alertWebhookUrl) {
  try {
    await fetch(alertWebhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(alertWebhookToken ? { authorization: `Bearer ${alertWebhookToken}` } : {}),
      },
      body: JSON.stringify(alert),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (deliveryError) {
    console.error(
      deliveryError instanceof Error
        ? deliveryError.message
        : String(deliveryError),
    );
  }
}

process.exit(1);

function fail(message) {
  console.error(message);
  process.exit(1);
}
