import "dotenv/config";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import mysql from "mysql2/promise";
import {
  mysqlConnectionOptions,
  readBackupDbConfig,
} from "./backup-db-options.mjs";

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
const db = readBackupDbConfig({
  ...process.env,
  DB_USER: process.env.RESTORE_REHEARSAL_DB_USER || process.env.DB_USER,
  DB_PASSWORD: process.env.RESTORE_REHEARSAL_DB_PASSWORD || process.env.DB_PASSWORD,
});

const manifestPath = backupArg || latestManifest(backupDir);
if (!manifestPath || !existsSync(manifestPath)) {
  throw new Error("Restore rehearsal requires a backup manifest path or an existing manifest in BACKUP_DIR.");
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const backupPath = firstExisting(manifest.offsitePath, manifest.artifactPath);
if (!backupPath) throw new Error("Backup artifact referenced by the manifest is not available.");

const started = Date.now();
let tableCount = 0;

try {
  await runRestore(backupPath, restoreDbName);
  tableCount = await countTables(restoreDbName);
  if (tableCount <= 0) throw new Error("Restore rehearsal completed but no tables were found.");

  const durationMs = Date.now() - started;
  const backupAgeMinutes = Math.round((Date.now() - Date.parse(manifest.createdAt || manifest.completedAt)) / 60000);
  const evidence = {
    status: "completed",
    service: serviceName,
    restoreDatabase: restoreDbName,
    backupId: manifest.id || null,
    backupPath,
    manifestPath,
    tableCount,
    durationMs,
    rtoMinutes,
    rpoMinutes,
    rtoMet: durationMs <= rtoMinutes * 60 * 1000,
    rpoMet: backupAgeMinutes <= rpoMinutes,
    backupAgeMinutes,
    completedAt: new Date().toISOString(),
  };
  console.log(JSON.stringify(evidence, null, 2));
} catch (error) {
  await sendAlert("restore_rehearsal_failure", error, { restoreDbName, manifestPath, backupPath });
  throw error;
} finally {
  if (!keepDatabase) await dropDatabase(restoreDbName).catch(() => undefined);
}

function latestManifest(directory) {
  if (!existsSync(directory)) return "";
  return readdirSync(directory)
    .filter((entry) => entry.endsWith(".manifest.json"))
    .map((entry) => join(directory, entry))
    .sort()
    .pop() || "";
}

function firstExisting(...paths) {
  return paths.find((path) => typeof path === "string" && path && existsSync(path)) || "";
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
  const payload = {
    service: serviceName,
    environment: process.env.NODE_ENV || "development",
    alertType: type,
    severity: "critical",
    title: `${serviceName} restore rehearsal failed`,
    message: error instanceof Error ? error.message : String(error),
    context,
    timestamp: new Date().toISOString(),
  };
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
