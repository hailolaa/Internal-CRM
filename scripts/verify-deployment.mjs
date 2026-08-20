import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(rootDir, args.manifest || "release/current-release.json");
const environment = String(args.environment || "");
const backendBaseUrl = trimTrailingSlash(String(args.backendUrl || process.env.RELEASE_BACKEND_URL || ""));
const frontendBaseUrl = trimTrailingSlash(String(args.frontendUrl || process.env.RELEASE_FRONTEND_URL || ""));
const authenticatedApiUrl = String(args.authenticatedApiUrl || process.env.RELEASE_AUTHENTICATED_API_HEALTH_URL || "");
const authToken = String(args.authToken || process.env.RELEASE_SMOKE_AUTH_TOKEN || "");
const outputPath = path.resolve(rootDir, args.output || "release/deployment-verification.json");
const timeoutMs = Number(args.timeoutMs || 15000);
const signingKey = process.env[args.signingKeyEnv || "RELEASE_MANIFEST_SIGNING_KEY"] || "";
const requireSignature = args.requireSignature === true;
const checks = [];

if (!environment || !["staging", "production"].includes(environment)) {
  fail("External dependency missing: --environment must be staging or production.");
}

if (!backendBaseUrl) {
  fail("External dependency missing: RELEASE_BACKEND_URL or --backend-url is required for post-deploy verification.");
}

if (!frontendBaseUrl) {
  fail("External dependency missing: RELEASE_FRONTEND_URL or --frontend-url is required for post-deploy verification.");
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
verifyManifestSignature(manifest);
if (manifest.environment !== environment) {
  record("manifest_environment", false, `Manifest environment ${manifest.environment || "missing"} does not match ${environment}.`);
} else {
  record("manifest_environment", true, `Manifest environment is ${environment}.`);
}

const live = await fetchJson(`${backendBaseUrl}/health/live`, "backend_live");
const ready = await fetchJson(`${backendBaseUrl}/health/ready`, "backend_ready");
const version = await fetchJson(`${backendBaseUrl}/health/version`, "backend_version");
await fetchText(frontendBaseUrl, "frontend_availability");
await checkAuthenticatedApi();
compareVersion(version?.data?.release || {});

const passed = checks.every((check) => check.status === "pass" || check.status === "skipped");
const report = {
  schemaVersion: 1,
  releaseId: manifest.releaseId || null,
  environment,
  verifiedAt: new Date().toISOString(),
  backendUrl: backendBaseUrl,
  frontendUrl: frontendBaseUrl,
  authenticatedApiUrl: authenticatedApiUrl || null,
  deployedRevision: extractReleaseRevision(version?.data?.release || {}),
  status: passed ? "pass" : "fail",
  checks,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);

if (!passed) {
  console.error(`Deployment verification failed: ${path.relative(rootDir, outputPath)}`);
  for (const check of checks.filter((item) => item.status === "fail")) {
    console.error(`- ${check.name}: ${check.message}`);
  }
  process.exit(1);
}

console.log(`Deployment verification passed: ${manifest.releaseId}`);
console.log(`Report: ${path.relative(rootDir, outputPath)}`);

function parseArgs(items) {
  const parsed = {};
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const next = items[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function verifyManifestSignature(candidate) {
  if (requireSignature && !candidate.signature?.value) {
    fail("Release manifest signature is required for deployment verification.");
  }

  if (!candidate.signature?.value) {
    record("manifest_signature", false, "Release manifest is unsigned.");
    return;
  }

  if (!signingKey) fail("RELEASE_MANIFEST_SIGNING_KEY is required to verify the release manifest signature.");

  const { signature, ...body } = candidate;
  const expected = crypto.createHmac("sha256", signingKey).update(stableStringify(body)).digest("hex");
  if (!constantTimeEquals(signature.value, expected)) fail("Release manifest signature is invalid.");
  record("manifest_signature", true, "Release manifest signature verified.");
}

async function fetchJson(url, name) {
  const response = await fetchWithTimeout(url);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    record(name, false, `${url} returned non-JSON response.`);
    return null;
  }

  if (!response.ok) {
    record(name, false, `${url} returned ${response.status}.`);
    return body;
  }

  if (body?.data?.ok === false) {
    record(name, false, `${url} returned ok=false.`);
    return body;
  }

  record(name, true, `${url} returned ${response.status}.`);
  return body;
}

async function fetchText(url, name) {
  const response = await fetchWithTimeout(url);
  await response.text();
  if (!response.ok) {
    record(name, false, `${url} returned ${response.status}.`);
    return;
  }
  record(name, true, `${url} returned ${response.status}.`);
}

async function checkAuthenticatedApi() {
  if (!authenticatedApiUrl) {
    record("authenticated_api_health", "skipped", "No authenticated API health URL configured.");
    return;
  }

  if (!authToken) {
    record("authenticated_api_health", false, "Authenticated API health URL is configured but RELEASE_SMOKE_AUTH_TOKEN is missing.");
    return;
  }

  const response = await fetchWithTimeout(authenticatedApiUrl, {
    headers: { authorization: `Bearer ${authToken}` },
  });
  await response.text();
  record(
    "authenticated_api_health",
    response.ok,
    response.ok
      ? `${authenticatedApiUrl} returned ${response.status}.`
      : `${authenticatedApiUrl} returned ${response.status}.`,
  );
}

function compareVersion(release) {
  compare("release_id", manifest.releaseId, release.releaseId);
  compare("release_environment", manifest.environment, release.environment);
  compare("mission_control_revision", manifest.repository?.revision, extractReleaseRevision(release));

  if (manifest.pairedRevisions?.clinicOsFrontend) {
    compare("clinic_os_frontend_revision", manifest.pairedRevisions.clinicOsFrontend, release.pairedRevisions?.clinicOsFrontend);
  }

  if (manifest.pairedRevisions?.clinicOsBackend) {
    compare("clinic_os_backend_revision", manifest.pairedRevisions.clinicOsBackend, release.pairedRevisions?.clinicOsBackend);
  }

  compare("database_schema_checksum", manifest.database?.baseSchema?.sha256, release.database?.baseSchemaSha256);
  compare("database_migration_count", manifest.database?.migrations?.length, release.database?.migrationCount);
}

function compare(name, expected, actual) {
  if (expected === undefined || expected === null || expected === "") {
    record(name, "skipped", "No expected value recorded in manifest.");
    return;
  }

  if (String(expected) !== String(actual || "")) {
    record(name, false, `Expected ${expected}, got ${actual || "missing"}.`);
    return;
  }

  record(name, true, `Matched ${expected}.`);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    record("http_request", false, `${url} failed: ${error instanceof Error ? error.message : String(error)}`);
    return new Response("", { status: 599 });
  } finally {
    clearTimeout(timeout);
  }
}

function extractReleaseRevision(release) {
  return release.missionControl?.revision || release.repository?.revision || release.revision || null;
}

function record(name, passed, message) {
  checks.push({
    name,
    status: passed === "skipped" ? "skipped" : passed ? "pass" : "fail",
    message,
  });
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function constantTimeEquals(a, b) {
  const aBuffer = Buffer.from(String(a));
  const bBuffer = Buffer.from(String(b));
  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
