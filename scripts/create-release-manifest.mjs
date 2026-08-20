import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const rootDir = process.cwd();
const args = parseArgs(process.argv.slice(2));
const environment = requiredArg("environment");
const outputPath = path.resolve(rootDir, args.output || "release/current-release.json");
const signingKey = process.env[args.signingKeyEnv || "RELEASE_MANIFEST_SIGNING_KEY"] || "";
const requireSignature = args.requireSignature === true || environment === "production";

if (!["staging", "production"].includes(environment)) {
  fail("environment must be staging or production");
}

if (requireSignature && !signingKey) {
  fail("RELEASE_MANIFEST_SIGNING_KEY is required for a signed release manifest");
}

const gitRevision = args.missionControlRevision || process.env.GITHUB_SHA || git(["rev-parse", "HEAD"]);
if (!gitRevision) {
  fail("Mission Control revision could not be resolved. Pass --mission-control-revision or run from a Git checkout.");
}
const shortRevision = gitRevision.slice(0, 12);
const releaseId =
  args.releaseId ||
  `${environment}-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}-${shortRevision}`;

const manifestBody = {
  schemaVersion: 1,
  releaseId,
  environment,
  createdAt: new Date().toISOString(),
  repository: {
    name: "mission-control",
    revision: gitRevision,
    branch: args.branch || process.env.GITHUB_REF_NAME || git(["rev-parse", "--abbrev-ref", "HEAD"]) || null,
    dirty: git(["status", "--porcelain"]).trim().length > 0,
  },
  pairedRevisions: {
    clinicOsFrontend: args.clinicOsFrontendRevision || null,
    clinicOsBackend: args.clinicOsBackendRevision || null,
  },
  database: {
    baseSchema: await fileEntry("backend/db.sql"),
    migrationDirectory: "backend/scripts/migrations",
    migrations: await migrationEntries("backend/scripts/migrations"),
    order: "Load backend/db.sql first, then run backend/scripts/migrations in filename order through npm run db:migrate.",
  },
  artifacts: {
    backendPackageLock: await optionalFileEntry("backend/package-lock.json"),
    frontendPackageLock: await optionalFileEntry("frontend/package-lock.json"),
    ciWorkflow: await optionalFileEntry(".github/workflows/mission-control-ci.yml"),
    promotionWorkflow: await optionalFileEntry(".github/workflows/release-promotion.yml"),
  },
  deploymentVerification: {
    state: "pending_external_deployment",
    deployedRevision: null,
    verifiedAt: null,
    reportPath: "release/deployment-verification.json",
    requiredChecks: [
      "backend_live",
      "backend_ready",
      "backend_version",
      "frontend_availability",
      "manifest_match",
    ],
  },
  rollback: {
    previousReleaseId: args.previousReleaseId || null,
    previousMissionControlRevision: args.previousMissionControlRevision || null,
    databaseBackup: args.databaseBackup || null,
    rehearseBeforeProduction: true,
  },
};

const signature = signingKey ? signManifest(manifestBody, signingKey) : null;
const manifest = {
  ...manifestBody,
  signature: signature
    ? {
        algorithm: "hmac-sha256",
        keyId: args.signingKeyId || "release-manifest-key",
        value: signature,
      }
    : null,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);

const manifestSha256 = await sha256File(outputPath);
const shaPath = `${outputPath}.sha256`;
await fs.writeFile(shaPath, `${manifestSha256}  ${path.basename(outputPath)}\n`);

console.log(`Release manifest written: ${path.relative(rootDir, outputPath)}`);
console.log(`Release ID: ${releaseId}`);
console.log(`Manifest SHA256: ${manifestSha256}`);
console.log(signature ? "Manifest signature: present" : "Manifest signature: not present");

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

function requiredArg(name) {
  const value = args[name];
  if (!value || value === true) fail(`--${name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)} is required`);
  return String(value);
}

function git(gitArgs) {
  try {
    return execFileSync("git", gitArgs, {
      cwd: rootDir,
      encoding: "utf8",
      shell: process.platform === "win32",
    }).trim();
  } catch {
    return "";
  }
}

async function fileEntry(relativePath) {
  const absolutePath = path.resolve(rootDir, relativePath);
  const stat = await fs.stat(absolutePath);
  return {
    path: relativePath.replace(/\\/g, "/"),
    sizeBytes: stat.size,
    sha256: await sha256File(absolutePath),
  };
}

async function optionalFileEntry(relativePath) {
  try {
    return await fileEntry(relativePath);
  } catch {
    return null;
  }
}

async function migrationEntries(relativePath) {
  const directory = path.resolve(rootDir, relativePath);
  const filenames = (await fs.readdir(directory))
    .filter((filename) => /^\d{8}_[a-z0-9_]+\.sql$/.test(filename))
    .sort();

  const entries = [];
  for (const filename of filenames) {
    entries.push(await fileEntry(path.join(relativePath, filename)));
  }
  return entries;
}

async function sha256File(filePath) {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function signManifest(manifest, key) {
  return crypto.createHmac("sha256", key).update(stableStringify(manifest)).digest("hex");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
