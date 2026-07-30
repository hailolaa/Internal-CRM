import "dotenv/config";
import { createDecipheriv, createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";

const sourcePath = process.argv[2];

if (!sourcePath) {
  console.error("Usage: npm run db:restore -- path/to/backup.sql[.enc]");
  process.exit(1);
}

if (!existsSync(sourcePath)) {
  console.error(`Backup file not found: ${sourcePath}`);
  process.exit(1);
}

const mysqlBin = process.env.MYSQL_BIN || "mysql";
const backupEncryptionKey = process.env.BACKUP_ENCRYPTION_KEY || "";
const db = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: process.env.DB_PORT || "3306",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  name: process.env.DB_NAME || "growth_group_internal_crm",
};

let restorePath = sourcePath;
let tempDir = "";

try {
  if (sourcePath.endsWith(".enc")) {
    if (backupEncryptionKey.trim().length < 32) {
      throw new Error("BACKUP_ENCRYPTION_KEY is required to restore encrypted backups.");
    }
    tempDir = mkdtempSync(join(tmpdir(), "mission-control-restore-"));
    restorePath = join(tempDir, basename(sourcePath).replace(/\.enc$/, ""));
    await decryptBackup(sourcePath, restorePath);
  }

  await run(mysqlBin, [
    `--host=${db.host}`,
    `--port=${db.port}`,
    `--user=${db.user}`,
    "-e",
    `CREATE DATABASE IF NOT EXISTS \`${db.name}\`;`,
  ]);

  await run(mysqlBin, [
    `--host=${db.host}`,
    `--port=${db.port}`,
    `--user=${db.user}`,
    db.name,
  ], restorePath);

  console.log(`Restore completed into database: ${db.name}`);
} finally {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
}

async function decryptBackup(inputPath, outputPath) {
  const tagPath = `${inputPath}.tag`;
  if (!existsSync(tagPath)) throw new Error(`Encrypted backup tag file not found: ${tagPath}`);

  const header = await readHeader(inputPath);
  const [prefix, ivValue] = header.split(":");
  if (prefix !== "MCB1" || !ivValue) throw new Error("Encrypted backup header is invalid.");

  const decipher = createDecipheriv(
    "aes-256-gcm",
    createHash("sha256").update(backupEncryptionKey).digest(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(readFileSync(tagPath, "utf8").trim(), "base64url"));

  await new Promise((resolve, reject) => {
    const input = createReadStream(inputPath, { start: Buffer.byteLength(header) + 1 });
    const output = createWriteStream(outputPath);
    input.pipe(decipher).pipe(output);
    input.on("error", reject);
    decipher.on("error", reject);
    output.on("error", reject);
    output.on("finish", resolve);
  });
}

async function readHeader(path) {
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

function run(command, args, stdinFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, MYSQL_PWD: db.password },
      stdio: stdinFile ? ["pipe", "inherit", "inherit"] : ["ignore", "inherit", "inherit"],
      shell: process.platform === "win32",
    });

    if (stdinFile) {
      createReadStream(stdinFile).pipe(child.stdin);
    }

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}
