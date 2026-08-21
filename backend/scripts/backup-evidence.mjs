import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import {
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import fs from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { execFileSync, spawn } from "node:child_process";

export const restoreStates = Object.freeze({
  planned: "PLANNED",
  rehearsable: "REHEARSABLE",
  rehearsed: "REHEARSED",
  verified: "VERIFIED",
});

export function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function sha256(path) {
  const hash = createHash("sha256");
  await new Promise((resolvePromise, reject) => {
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", resolvePromise);
  });
  return hash.digest("hex");
}

export async function assertFileChecksum(path, expectedChecksum) {
  if (!expectedChecksum) return { state: restoreStates.planned, reason: "No checksum was recorded for this artifact." };
  const actualChecksum = await sha256(path);
  if (actualChecksum !== expectedChecksum) {
    throw new Error(`Backup checksum mismatch for ${basename(path)}`);
  }
  return { state: restoreStates.verified, checksumSha256: actualChecksum };
}

export async function encryptFile(inputPath, outputPath, encryptionKey) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(encryptionKey).digest(), iv);

  await new Promise((resolvePromise, reject) => {
    const input = createReadStream(inputPath);
    const output = createWriteStream(outputPath);
    output.write(Buffer.from(`MCB1:${iv.toString("base64url")}:`));
    input.pipe(cipher).pipe(output);
    input.on("error", reject);
    cipher.on("error", reject);
    output.on("error", reject);
    output.on("finish", resolvePromise);
  });

  const tag = cipher.getAuthTag().toString("base64url");
  writeFileSync(`${outputPath}.tag`, `${tag}\n`);
  return outputPath;
}

export async function decryptFile(inputPath, outputPath, encryptionKey) {
  const tagPath = `${inputPath}.tag`;
  if (!existsSync(tagPath)) throw new Error(`Encrypted backup tag file not found: ${tagPath}`);

  const header = await readEncryptedHeader(inputPath);
  const [prefix, ivValue] = header.split(":");
  if (prefix !== "MCB1" || !ivValue) throw new Error("Encrypted backup header is invalid.");

  const decipher = createDecipheriv(
    "aes-256-gcm",
    createHash("sha256").update(encryptionKey).digest(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(readFileSync(tagPath, "utf8").trim(), "base64url"));

  await new Promise((resolvePromise, reject) => {
    const input = createReadStream(inputPath, { start: Buffer.byteLength(header) + 1 });
    const output = createWriteStream(outputPath);
    input.pipe(decipher).pipe(output);
    input.on("error", reject);
    decipher.on("error", reject);
    output.on("error", reject);
    output.on("finish", resolvePromise);
  });
}

export function copyToOffsite(paths, destination) {
  mkdirSync(destination, { recursive: true });
  return paths.map((path) => {
    const target = join(destination, basename(path));
    copyFileSync(path, target);
    return target;
  });
}

export async function assertCopiedChecksum(source, target) {
  const [left, right] = await Promise.all([sha256(source), sha256(target)]);
  if (left !== right) throw new Error(`Off-site copy checksum mismatch for ${basename(source)}`);
}

export function pruneOldArtifacts(directory, days) {
  if (!Number.isFinite(days) || days <= 0 || !existsSync(directory)) return [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const pruned = [];
  for (const entry of readdirSync(directory)) {
    if (!/\.(sql|enc|json|tag|tar)$/.test(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).mtimeMs < cutoff) {
      rmSync(path, { force: true });
      pruned.push(path);
    }
  }
  return pruned;
}

export async function collectBackupEvidence({
  rootDir = process.cwd(),
  schemaPath = process.env.BACKUP_SCHEMA_PATH || "db.sql",
  migrationDir = process.env.BACKUP_MIGRATION_DIR || "scripts/migrations",
  env = process.env,
} = {}) {
  const packageJson = await optionalJson(resolve(rootDir, "package.json"));
  const migrations = await migrationEntries(resolve(rootDir, migrationDir), migrationDir);
  const migrationChecksumSha256 = migrations.length ? checksumEntries(migrations) : null;
  return {
    sourceEnvironment: env.BACKUP_SOURCE_ENVIRONMENT || env.NODE_ENV || "development",
    release: {
      version: env.RELEASE_VERSION || packageJson?.version || null,
      revision: env.BACKUP_RELEASE_REVISION || env.GITHUB_SHA || gitRevision(rootDir),
    },
    schema: {
      path: schemaPath,
      checksumSha256: await optionalFileChecksum(resolve(rootDir, schemaPath)),
    },
    migrations: {
      directory: migrationDir,
      count: migrations.length,
      checksumSha256: migrationChecksumSha256,
    },
  };
}

export function buildBackupManifest({
  id,
  serviceName,
  databaseName,
  startedAt,
  completedAt,
  storageProvider,
  artifactPath,
  offsitePath,
  tagPath,
  offsiteTagPath,
  offsiteManifestPath = null,
  sizeBytes,
  checksumSha256,
  plaintextChecksumSha256,
  encryptionKey,
  encryptionKeyId,
  retentionDays,
  fileArtifacts = [],
  evidence,
}) {
  const encrypted = Boolean(encryptionKey);
  return {
    schemaVersion: 1,
    id,
    service: serviceName,
    database: databaseName,
    sourceEnvironment: evidence?.sourceEnvironment || process.env.NODE_ENV || "development",
    backupTimestamp: startedAt.toISOString(),
    createdAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    storageProvider,
    artifactPath,
    offsitePath,
    tagPath,
    offsiteTagPath,
    sizeBytes,
    checksumSha256,
    plaintextChecksumSha256,
    encrypted,
    encryption: encrypted
      ? {
          algorithm: "aes-256-gcm",
          keySource: "BACKUP_ENCRYPTION_KEY",
          keyId: encryptionKeyId || null,
        }
      : null,
    offsite: {
      configured: Boolean(offsitePath),
      provider: storageProvider,
      artifactPath: offsitePath || null,
      tagPath: offsiteTagPath || null,
      manifestPath: offsiteManifestPath || null,
    },
    release: evidence?.release || { version: null, revision: null },
    schema: evidence?.schema || null,
    migrations: evidence?.migrations || null,
    restoreReadiness: {
      state: restoreStates.rehearsable,
      reason: "Backup artifact and manifest are sufficient for an isolated restore rehearsal.",
    },
    retentionDays,
    fileArtifacts,
  };
}

export function validateBackupManifest(manifest) {
  if (!manifest || typeof manifest !== "object") throw new Error("Backup manifest is missing or invalid.");
  if (!manifest.id) throw new Error("Backup manifest is missing backup ID.");
  if (!manifest.artifactPath && !manifest.offsitePath) throw new Error("Backup manifest is missing artifact path.");
  if (!manifest.checksumSha256) throw new Error("Backup manifest is missing checksum.");
  if (manifest.encrypted && !manifest.encryption?.keySource) {
    throw new Error("Encrypted backup manifest is missing encryption key source.");
  }
  if (manifest.encrypted && !manifest.tagPath && !manifest.offsiteTagPath) {
    throw new Error("Encrypted backup manifest is missing authentication tag path.");
  }
  return manifest;
}

export function readBackupManifest(manifestPath) {
  if (!manifestPath || !existsSync(manifestPath)) {
    throw new Error("Restore rehearsal requires a readable backup manifest.");
  }
  try {
    return validateBackupManifest(JSON.parse(readFileSync(manifestPath, "utf8")));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Backup manifest JSON is corrupt.");
    throw error;
  }
}

export function resolveBackupArtifact(manifest) {
  const backupPath = firstExisting(manifest.offsitePath, manifest.artifactPath);
  if (!backupPath) throw new Error("Backup artifact referenced by the manifest is not available.");
  return backupPath;
}

export function compareMigrationEvidence(backupMigrations, currentMigrations) {
  if (!backupMigrations?.count || !backupMigrations?.checksumSha256 || !currentMigrations?.count) {
    return {
      state: restoreStates.planned,
      compatible: null,
      reason: "Migration metadata is incomplete; compatibility must be confirmed by the production owner.",
    };
  }
  const compatible =
    backupMigrations.count === currentMigrations.count &&
    backupMigrations.checksumSha256 === currentMigrations.checksumSha256;
  return {
    state: compatible ? restoreStates.verified : restoreStates.rehearsed,
    compatible,
    backupMigrationCount: backupMigrations.count,
    currentMigrationCount: currentMigrations.count,
    backupMigrationChecksumSha256: backupMigrations.checksumSha256,
    currentMigrationChecksumSha256: currentMigrations.checksumSha256,
    reason: compatible
      ? "Backup migration metadata matches the current codebase."
      : "Backup migration metadata differs from the current codebase; operator review is required before staging restore.",
  };
}

export async function runOptionalHttpCheck({ name, url, timeoutMs = 15000 }) {
  if (!url) return { name, state: restoreStates.planned, configured: false };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    return {
      name,
      state: response.ok ? restoreStates.verified : restoreStates.rehearsed,
      configured: true,
      ok: response.ok,
      status: response.status,
      sample: safeText(text),
    };
  } catch (error) {
    return {
      name,
      state: restoreStates.rehearsed,
      configured: true,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runOptionalCommandCheck({ name, command, timeoutMs = 120000, env = process.env }) {
  if (!command) return { name, state: restoreStates.planned, configured: false };
  const startedAt = Date.now();
  try {
    await runShellCommand(command, timeoutMs, env);
    return { name, state: restoreStates.verified, configured: true, ok: true, durationMs: Date.now() - startedAt };
  } catch (error) {
    return {
      name,
      state: restoreStates.rehearsed,
      configured: true,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function buildRestoreRehearsalReport({
  status,
  serviceName,
  manifest,
  manifestPath,
  backupPath,
  restoreDatabase,
  startedAt,
  completedAt,
  durationMs,
  rtoMinutes,
  rpoMinutes,
  tableCount = 0,
  checksumResult = null,
  migrationCompatibility = null,
  applicationStartup = null,
  health = null,
  version = null,
  smoke = null,
  failureReason = null,
  cleanup = null,
}) {
  const backupAgeMinutes = manifest?.createdAt
    ? Math.round((completedAt.getTime() - Date.parse(manifest.createdAt)) / 60000)
    : null;
  const optionalChecks = [applicationStartup, health, version, smoke].filter(Boolean);
  const allConfiguredOptionalChecksPassed = optionalChecks
    .filter((check) => check.configured)
    .every((check) => check.ok !== false && check.state === restoreStates.verified);
  const hasConfiguredOptionalChecks = optionalChecks.some((check) => check.configured);
  const state = status === "completed"
    ? hasConfiguredOptionalChecks && allConfiguredOptionalChecksPassed
      ? restoreStates.verified
      : restoreStates.rehearsed
    : restoreStates.rehearsable;

  return {
    schemaVersion: 1,
    status,
    state,
    service: serviceName,
    backup: {
      id: manifest?.id || null,
      checksumSha256: manifest?.checksumSha256 || null,
      sourceEnvironment: manifest?.sourceEnvironment || null,
      timestamp: manifest?.createdAt || manifest?.backupTimestamp || null,
      path: backupPath || null,
      manifestPath: manifestPath || null,
    },
    restore: {
      target: restoreDatabase,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs,
      rtoMinutes,
      rpoMinutes,
      rtoMet: durationMs <= rtoMinutes * 60 * 1000,
      rpoMet: backupAgeMinutes === null ? null : backupAgeMinutes <= rpoMinutes,
      backupAgeMinutes,
    },
    release: manifest?.release || null,
    schema: manifest?.schema || null,
    migrations: {
      backup: manifest?.migrations || null,
      compatibility: migrationCompatibility,
    },
    checksum: checksumResult,
    reconciliation: {
      state: tableCount > 0 ? restoreStates.rehearsed : restoreStates.planned,
      tableCount,
      rowCheck: "Table-count reconciliation only; row-level validation requires an approved staging rehearsal.",
    },
    checks: {
      applicationStartup: applicationStartup || { name: "application startup", state: restoreStates.planned, configured: false },
      health: health || { name: "health", state: restoreStates.planned, configured: false },
      version: version || { name: "version", state: restoreStates.planned, configured: false },
      smoke: smoke || { name: "smoke", state: restoreStates.planned, configured: false },
    },
    failureReason,
    cleanup,
  };
}

export async function writeReportIfConfigured(report, outputPath) {
  if (!outputPath) return null;
  await fs.mkdir(dirname(resolve(outputPath)), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return outputPath;
}

export function buildAlertPayload({ serviceName, type, title, error, context = {}, severity = "critical" }) {
  return {
    service: serviceName,
    environment: process.env.NODE_ENV || "development",
    alertType: type,
    severity,
    title,
    message: error instanceof Error ? error.message : String(error),
    context: sanitizeContext(context),
    release: {
      revision: process.env.BACKUP_RELEASE_REVISION || process.env.GITHUB_SHA || null,
      version: process.env.RELEASE_VERSION || null,
    },
    timestamp: new Date().toISOString(),
  };
}

export function firstExisting(...paths) {
  return paths.find((path) => typeof path === "string" && path && existsSync(path)) || "";
}

async function readEncryptedHeader(path) {
  const chunks = [];
  let total = 0;
  for await (const chunk of createReadStream(path, { start: 0, end: 200 })) {
    chunks.push(chunk);
    total += chunk.length;
    const text = Buffer.concat(chunks, total).toString("utf8");
    const separator = text.indexOf(":");
    const secondSeparator = text.indexOf(":", separator + 1);
    if (separator > 0 && secondSeparator > separator) {
      return text.slice(0, secondSeparator);
    }
  }
  throw new Error("Encrypted backup header is missing.");
}

async function migrationEntries(directory, displayDirectory) {
  try {
    const filenames = (await fs.readdir(directory))
      .filter((filename) => /^\d{8}_[a-z0-9_]+\.sql$/.test(filename))
      .sort();
    const entries = [];
    for (const filename of filenames) {
      const filePath = join(directory, filename);
      entries.push({
        path: `${displayDirectory.replace(/\\/g, "/")}/${filename}`,
        sha256: await sha256(filePath),
      });
    }
    return entries;
  } catch {
    return [];
  }
}

function checksumEntries(entries) {
  const hash = createHash("sha256");
  for (const entry of entries) {
    hash.update(entry.path);
    hash.update("\0");
    hash.update(entry.sha256);
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function optionalFileChecksum(filePath) {
  try {
    return await sha256(filePath);
  } catch {
    return null;
  }
}

async function optionalJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function gitRevision(rootDir) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: rootDir,
      encoding: "utf8",
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() || null;
  } catch {
    return null;
  }
}

function runShellCommand(command, timeoutMs, env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, [], {
      env: { ...process.env, ...env },
      shell: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolvePromise(undefined);
      else reject(new Error(`${command} exited with code ${code}${stderr ? `: ${safeText(stderr)}` : ""}`));
    });
  });
}

function sanitizeContext(value) {
  if (Array.isArray(value)) return value.map(sanitizeContext);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (/password|secret|token|key|credential/i.test(key)) {
      output[key] = "[redacted]";
    } else {
      output[key] = sanitizeContext(item);
    }
  }
  return output;
}

function safeText(value) {
  return String(value || "")
    .replace(/[A-Za-z0-9+/=_-]{32,}/g, "[redacted]")
    .slice(0, 500);
}
