import "dotenv/config";
import { createReadStream, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";
import {
  mysqlCliSslArgs,
  readBackupDbConfig,
} from "./backup-db-options.mjs";
import { decryptFile } from "./backup-evidence.mjs";

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
const db = readBackupDbConfig();

let restorePath = sourcePath;
let tempDir = "";

try {
  if (sourcePath.endsWith(".enc")) {
    if (backupEncryptionKey.trim().length < 32) {
      throw new Error("BACKUP_ENCRYPTION_KEY is required to restore encrypted backups.");
    }
    tempDir = mkdtempSync(join(tmpdir(), "mission-control-restore-"));
    restorePath = join(tempDir, basename(sourcePath).replace(/\.enc$/, ""));
    await decryptFile(sourcePath, restorePath, backupEncryptionKey);
  }

  await run(mysqlBin, [
    `--host=${db.host}`,
    `--port=${db.port}`,
    `--user=${db.user}`,
    ...mysqlCliSslArgs(db),
    "-e",
    `CREATE DATABASE IF NOT EXISTS \`${db.name}\`;`,
  ]);

  await run(mysqlBin, [
    `--host=${db.host}`,
    `--port=${db.port}`,
    `--user=${db.user}`,
    ...mysqlCliSslArgs(db),
    db.name,
  ], restorePath);

  console.log(`Restore completed into database: ${db.name}`);
} finally {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
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
