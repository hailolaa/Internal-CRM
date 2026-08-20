import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(rootDir, args.manifest || "release/current-release.json");
const signingKey = process.env[args.signingKeyEnv || "RELEASE_MANIFEST_SIGNING_KEY"] || "";
const requireSignature = args.requireSignature === true;

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
verifyManifestShape(manifest);

if (requireSignature && !manifest.signature?.value) {
  fail("Release manifest signature is required");
}

if (manifest.signature?.value) {
  if (!signingKey) fail("RELEASE_MANIFEST_SIGNING_KEY is required to verify the release manifest signature");
  const { signature, ...body } = manifest;
  const expected = crypto.createHmac("sha256", signingKey).update(stableStringify(body)).digest("hex");
  if (!constantTimeEquals(signature.value, expected)) fail("Release manifest signature is invalid");
}

await verifyFile(manifest.database.baseSchema);
for (const migration of manifest.database.migrations || []) {
  await verifyFile(migration);
}

for (const artifact of Object.values(manifest.artifacts || {})) {
  if (artifact) await verifyFile(artifact);
}

console.log(`Release manifest verified: ${manifest.releaseId}`);
console.log(`Environment: ${manifest.environment}`);
console.log(`Mission Control revision: ${manifest.repository?.revision || "unknown"}`);

function verifyManifestShape(candidate) {
  if (candidate.schemaVersion !== 1) fail("Manifest schemaVersion must be 1");
  if (!candidate.releaseId) fail("Manifest releaseId is required");
  if (!["staging", "production"].includes(candidate.environment)) fail("Manifest environment must be staging or production");
  if (!candidate.repository?.revision) fail("Manifest repository revision is required");
  if (!candidate.database?.baseSchema?.path || !candidate.database?.baseSchema?.sha256) {
    fail("Manifest database baseSchema entry is required");
  }
  if (!Array.isArray(candidate.database?.migrations)) fail("Manifest database migrations must be an array");

  const paths = candidate.database.migrations.map((migration) => migration.path);
  const sorted = [...paths].sort();
  if (paths.some((value, index) => value !== sorted[index])) fail("Manifest migrations must be sorted in filename order");
  if (new Set(paths).size !== paths.length) fail("Manifest contains duplicate migration entries");

  for (const migration of candidate.database.migrations) {
    if (!migration.path || !migration.sha256) fail("Manifest contains an invalid migration entry");
  }
}

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

async function verifyFile(entry) {
  if (!entry?.path || !entry?.sha256) fail("Manifest contains an invalid file entry");
  const absolutePath = path.resolve(rootDir, entry.path);
  const actual = await sha256File(absolutePath);
  if (actual !== entry.sha256) fail(`Checksum mismatch: ${entry.path}`);
}

async function sha256File(filePath) {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
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
