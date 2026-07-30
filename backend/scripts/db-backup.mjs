import "dotenv/config";
import { createCipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import {
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";
import mysql from "mysql2/promise";

const serviceName = process.env.BACKUP_SERVICE_NAME || "mission-control-backend";
const backupDir = process.env.BACKUP_DIR || "backups";
const offsiteDir = process.env.BACKUP_OFFSITE_DIR || "";
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 14);
const keepPlaintext = process.env.BACKUP_KEEP_PLAINTEXT === "true";
const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY || "";
const mysqldumpBin = process.env.MYSQLDUMP_BIN || "mysqldump";
const tarBin = process.env.TAR_BIN || "tar";
const fileDirs = parseCsv(process.env.BACKUP_FILE_DIRS || "");
const alertWebhookUrl = process.env.OBSERVABILITY_ALERT_WEBHOOK_URL || "";
const alertWebhookToken = process.env.OBSERVABILITY_ALERT_WEBHOOK_TOKEN || "";
const db = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: process.env.DB_PORT || "3306",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  name: process.env.DB_NAME || "growth_group_internal_crm",
};

mkdirSync(backupDir, { recursive: true });
if (offsiteDir) mkdirSync(offsiteDir, { recursive: true });
if ((process.env.NODE_ENV === "production" || offsiteDir) && encryptionKey.trim().length < 32) {
  throw new Error("BACKUP_ENCRYPTION_KEY must be set to at least 32 characters for encrypted backups.");
}

const id = randomUUID();
const startedAt = new Date();
const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
const sqlPath = join(backupDir, `${db.name}-${stamp}.sql`);
const encryptedPath = `${sqlPath}.enc`;
const manifestPath = `${encryptedPath}.manifest.json`;
const storageProvider = offsiteDir ? "encrypted-offsite-filesystem" : encryptionKey ? "encrypted-local" : "local";

const connection = await mysql.createConnection({
  host: db.host,
  port: Number(db.port),
  user: db.user,
  password: db.password,
  database: db.name,
});

await connection.execute(
  "INSERT INTO backup_run (id, status, file_path, storage_provider) VALUES (?, 'started', ?, ?)",
  [id, encryptedPath, storageProvider],
);

try {
  await runDump(sqlPath);

  const plaintextChecksum = await sha256(sqlPath);
  const outputPath = encryptionKey ? await encryptFile(sqlPath, encryptedPath) : sqlPath;
  const outputChecksum = await sha256(outputPath);
  const sizeBytes = statSync(outputPath).size;
  const tagPath = encryptionKey ? `${outputPath}.tag` : null;
  const offsiteCopies = offsiteDir ? copyToOffsite([outputPath, ...(tagPath ? [tagPath] : [])], offsiteDir) : [];
  const offsite = offsiteCopies[0] || null;
  const offsiteTag = offsiteCopies[1] || null;
  const manifest = {
    id,
    service: serviceName,
    database: db.name,
    createdAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    storageProvider,
    artifactPath: outputPath,
    offsitePath: offsite,
    tagPath,
    offsiteTagPath: offsiteTag,
    sizeBytes,
    checksumSha256: outputChecksum,
    plaintextChecksumSha256: plaintextChecksum,
    encrypted: Boolean(encryptionKey),
    encryption: encryptionKey ? { algorithm: "aes-256-gcm", keySource: "BACKUP_ENCRYPTION_KEY" } : null,
    retentionDays,
  };

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const offsiteManifest = offsiteDir ? copyToOffsite([manifestPath], offsiteDir)[0] : null;
  if (offsite) await assertCopiedChecksum(outputPath, offsite);
  if (tagPath && offsiteTag) await assertCopiedChecksum(tagPath, offsiteTag);
  if (offsiteManifest) await assertCopiedChecksum(manifestPath, offsiteManifest);

  const fileArtifacts = [];
  for (const dir of fileDirs) {
    if (!existsSync(dir)) continue;
    const archivePath = join(backupDir, `${db.name}-files-${basename(dir)}-${stamp}.tar`);
    await runArchive(archivePath, dir);
    const archiveChecksum = await sha256(archivePath);
    const archiveOutputPath = encryptionKey ? await encryptFile(archivePath, `${archivePath}.enc`) : archivePath;
    const archiveOutputChecksum = await sha256(archiveOutputPath);
    const archiveTagPath = encryptionKey ? `${archiveOutputPath}.tag` : null;
    const archiveOffsiteCopies = offsiteDir
      ? copyToOffsite([archiveOutputPath, ...(archiveTagPath ? [archiveTagPath] : [])], offsiteDir)
      : [];
    if (archiveOffsiteCopies[0]) await assertCopiedChecksum(archiveOutputPath, archiveOffsiteCopies[0]);
    if (archiveTagPath && archiveOffsiteCopies[1]) await assertCopiedChecksum(archiveTagPath, archiveOffsiteCopies[1]);
    if (encryptionKey && !keepPlaintext) unlinkSync(archivePath);
    fileArtifacts.push({
      sourceDirectory: dir,
      artifactPath: archiveOutputPath,
      offsitePath: archiveOffsiteCopies[0] || null,
      tagPath: archiveTagPath,
      offsiteTagPath: archiveOffsiteCopies[1] || null,
      sizeBytes: statSync(archiveOutputPath).size,
      checksumSha256: archiveOutputChecksum,
      plaintextChecksumSha256: archiveChecksum,
      encrypted: Boolean(encryptionKey),
    });
  }

  const finalManifest = { ...manifest, fileArtifacts };
  writeFileSync(manifestPath, `${JSON.stringify(finalManifest, null, 2)}\n`);
  if (offsiteManifest) copyFileSync(manifestPath, offsiteManifest);

  await connection.execute(
    `UPDATE backup_run
     SET status = 'completed',
         size_bytes = ?,
         checksum_sha256 = ?,
         completed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [sizeBytes, outputChecksum, id],
  );

  if (encryptionKey && !keepPlaintext) unlinkSync(sqlPath);
  pruneOldArtifacts(backupDir, retentionDays);

  console.log(JSON.stringify({ status: "completed", id, artifactPath: outputPath, manifestPath, offsitePath: offsite }, null, 2));
} catch (error) {
  await connection.execute(
    `UPDATE backup_run
     SET status = 'failed',
         error_message = ?,
         completed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [error instanceof Error ? error.message : String(error), id],
  );
  await sendAlert("backup_failure", error, { id, database: db.name, backupDir, offsiteConfigured: Boolean(offsiteDir) });
  throw error;
} finally {
  await connection.end();
}

function runDump(filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      `--host=${db.host}`,
      `--port=${db.port}`,
      `--user=${db.user}`,
      "--single-transaction",
      "--routines",
      "--triggers",
      "--events",
      "--result-file",
      filePath,
      db.name,
    ];

    const child = spawn(mysqldumpBin, args, {
      env: { ...process.env, MYSQL_PWD: db.password },
      stdio: ["ignore", "inherit", "inherit"],
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`mysqldump exited with code ${code}`));
    });
  });
}

function runArchive(filePath, sourceDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(tarBin, ["-cf", filePath, sourceDir], {
      stdio: ["ignore", "inherit", "inherit"],
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`tar exited with code ${code}`));
    });
  });
}

async function encryptFile(inputPath, outputPath) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(encryptionKey).digest(), iv);

  await new Promise((resolve, reject) => {
    const input = createReadStream(inputPath);
    const output = createWriteStream(outputPath);
    output.write(Buffer.from(`MCB1:${iv.toString("base64url")}:`));
    input.pipe(cipher).pipe(output);
    input.on("error", reject);
    cipher.on("error", reject);
    output.on("error", reject);
    output.on("finish", resolve);
  });

  const tag = cipher.getAuthTag().toString("base64url");
  writeFileSync(`${outputPath}.tag`, `${tag}\n`);
  return outputPath;
}

function copyToOffsite(paths, destination) {
  mkdirSync(destination, { recursive: true });
  return paths.map((path) => {
    const target = join(destination, basename(path));
    copyFileSync(path, target);
    return target;
  });
}

async function assertCopiedChecksum(source, target) {
  const [left, right] = await Promise.all([sha256(source), sha256(target)]);
  if (left !== right) throw new Error(`Off-site copy checksum mismatch for ${basename(source)}`);
}

function pruneOldArtifacts(directory, days) {
  if (!Number.isFinite(days) || days <= 0) return;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  for (const entry of readdirSync(directory)) {
    if (!/\.(sql|enc|json|tag)$/.test(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).mtimeMs < cutoff) rmSync(path, { force: true });
  }
}

async function sha256(path) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", resolve);
  });
  return hash.digest("hex");
}

function parseCsv(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function sendAlert(type, error, context) {
  const payload = {
    service: serviceName,
    environment: process.env.NODE_ENV || "development",
    alertType: type,
    severity: "critical",
    title: `${serviceName} backup failed`,
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
