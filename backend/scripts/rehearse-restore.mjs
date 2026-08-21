import "dotenv/config";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import mysql from "mysql2/promise";
import {
  mysqlConnectionOptions,
  readBackupDbConfig,
} from "./backup-db-options.mjs";
import {
  assertFileChecksum,
  buildAlertPayload,
  buildRestoreRehearsalReport,
  collectBackupEvidence,
  compareMigrationEvidence,
  readBackupManifest,
  resolveBackupArtifact,
  restoreStates,
  runOptionalCommandCheck,
  runOptionalHttpCheck,
  writeReportIfConfigured,
} from "./backup-evidence.mjs";

const serviceName = process.env.BACKUP_SERVICE_NAME || "mission-control-backend";
const backupDir = process.env.BACKUP_DIR || "backups";
const alertWebhookUrl = process.env.OBSERVABILITY_ALERT_WEBHOOK_URL || "";
const alertWebhookToken = process.env.OBSERVABILITY_ALERT_WEBHOOK_TOKEN || "";
const rtoMinutes = Number(process.env.BACKUP_RESTORE_RTO_MINUTES || 60);
const rpoMinutes = Number(process.env.BACKUP_RESTORE_RPO_MINUTES || 1440);
const keepDatabase = process.env.RESTORE_REHEARSAL_KEEP_DB === "true";
const backupArg = process.argv[2] || process.env.RESTORE_REHEARSAL_BACKUP_PATH || "";
const restoreDbName = process.env.RESTORE_REHEARSAL_DB_NAME ||
  `${process.env.DB_NAME || "growth_group_internal_crm"}_restore_${Date.now()}`;
const reportPath = process.env.RESTORE_REHEARSAL_REPORT_PATH || "";
const checkTimeoutMs = Number(process.env.RESTORE_REHEARSAL_CHECK_TIMEOUT_MS || 15000);
const startupCommand = process.env.RESTORE_REHEARSAL_STARTUP_COMMAND || "";
const smokeCommand = process.env.RESTORE_REHEARSAL_SMOKE_COMMAND || "";
const healthUrl = process.env.RESTORE_REHEARSAL_HEALTH_URL || "";
const versionUrl = process.env.RESTORE_REHEARSAL_VERSION_URL || "";
const db = readBackupDbConfig({
  ...process.env,
  DB_USER: process.env.RESTORE_REHEARSAL_DB_USER || process.env.DB_USER,
  DB_PASSWORD: process.env.RESTORE_REHEARSAL_DB_PASSWORD || process.env.DB_PASSWORD,
});

const manifestPath = backupArg || latestManifest(backupDir);
const startedAt = new Date();
let manifest = null;
let backupPath = "";
let tableCount = 0;
let report = null;
let restoreStarted = false;

try {
  manifest = readBackupManifest(manifestPath);
  backupPath = resolveBackupArtifact(manifest);
  const checksumResult = await assertFileChecksum(backupPath, manifest.checksumSha256);

  restoreStarted = true;
  await runRestore(backupPath, restoreDbName);
  tableCount = await countTables(restoreDbName);
  if (tableCount <= 0) throw new Error("Restore rehearsal completed but no tables were found.");

  const currentEvidence = await collectBackupEvidence();
  const migrationCompatibility = compareMigrationEvidence(manifest.migrations, currentEvidence.migrations);
  const applicationStartup = await runOptionalCommandCheck({
    name: "application startup",
    command: startupCommand,
    timeoutMs: Number(process.env.RESTORE_REHEARSAL_STARTUP_TIMEOUT_MS || 120000),
    env: { ...process.env, DB_NAME: restoreDbName },
  });
  const health = await runOptionalHttpCheck({ name: "health", url: healthUrl, timeoutMs: checkTimeoutMs });
  const version = await runOptionalHttpCheck({ name: "version", url: versionUrl, timeoutMs: checkTimeoutMs });
  const smoke = await runOptionalCommandCheck({
    name: "smoke",
    command: smokeCommand,
    timeoutMs: Number(process.env.RESTORE_REHEARSAL_SMOKE_TIMEOUT_MS || 120000),
    env: { ...process.env, DB_NAME: restoreDbName },
  });

  const completedAt = new Date();
  report = buildRestoreRehearsalReport({
    status: "completed",
    serviceName,
    manifest,
    manifestPath,
    backupPath,
    restoreDatabase: restoreDbName,
    startedAt,
    completedAt,
    durationMs: completedAt.getTime() - startedAt.getTime(),
    rtoMinutes,
    rpoMinutes,
    tableCount,
    checksumResult,
    migrationCompatibility,
    applicationStartup,
    health,
    version,
    smoke,
  });
} catch (error) {
  const completedAt = new Date();
  report = buildRestoreRehearsalReport({
    status: "failed",
    serviceName,
    manifest,
    manifestPath,
    backupPath,
    restoreDatabase: restoreDbName,
    startedAt,
    completedAt,
    durationMs: completedAt.getTime() - startedAt.getTime(),
    rtoMinutes,
    rpoMinutes,
    tableCount,
    failureReason: error instanceof Error ? error.message : String(error),
  });
  await sendAlert("restore_rehearsal_failure", error, { restoreDbName, manifestPath, backupPath });
  throw error;
} finally {
  const cleanup = await cleanupDatabase(restoreDbName, restoreStarted);
  if (report) {
    report.cleanup = cleanup;
    await writeReportIfConfigured(report, reportPath);
    console.log(JSON.stringify(report, null, 2));
  }
}

function latestManifest(directory) {
  if (!existsSync(directory)) return "";
  return readdirSync(directory)
    .filter((entry) => entry.endsWith(".manifest.json"))
    .map((entry) => join(directory, entry))
    .sort()
    .pop() || "";
}

async function runRestore(backupPath, databaseName) {
  await run(process.execPath, ["scripts/db-restore.mjs", backupPath], {
    ...process.env,
    DB_NAME: databaseName,
    DB_USER: db.user,
    DB_PASSWORD: db.password,
  });
}

async function countTables(databaseName) {
  const connection = await mysql.createConnection(mysqlConnectionOptions(db, databaseName));
  try {
    const [rows] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ?",
      [databaseName],
    );
    return Number(rows[0]?.count || 0);
  } finally {
    await connection.end();
  }
}

async function cleanupDatabase(databaseName, shouldCleanup) {
  if (!shouldCleanup) {
    return { state: restoreStates.planned, attempted: false, kept: null, target: databaseName };
  }
  if (keepDatabase) {
    return { state: restoreStates.planned, attempted: false, kept: true, target: databaseName };
  }
  try {
    await dropDatabase(databaseName);
    return { state: restoreStates.verified, attempted: true, kept: false, target: databaseName };
  } catch (error) {
    return {
      state: restoreStates.rehearsed,
      attempted: true,
      kept: null,
      target: databaseName,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function dropDatabase(databaseName) {
  const connection = await mysql.createConnection(mysqlConnectionOptions(db, ""));
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${databaseName.replace(/`/g, "``")}\``);
  } finally {
    await connection.end();
  }
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...env, MYSQL_PWD: db.password },
      stdio: ["ignore", "inherit", "inherit"],
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function sendAlert(type, error, context) {
  const payload = buildAlertPayload({
    serviceName,
    type,
    title: `${serviceName} restore rehearsal failed`,
    error,
    context,
  });
  console.error(JSON.stringify(payload, null, 2));
  if (!alertWebhookUrl) return;

  await fetch(alertWebhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(alertWebhookToken ? { authorization: `Bearer ${alertWebhookToken}` } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  }).catch(() => undefined);
}
