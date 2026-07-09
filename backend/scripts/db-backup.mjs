import "dotenv/config";
import { createHash, randomUUID } from "crypto";
import { createReadStream, existsSync, mkdirSync, statSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import mysql from "mysql2/promise";

const backupDir = process.env.BACKUP_DIR || "backups";
const mysqldumpBin = process.env.MYSQLDUMP_BIN || "mysqldump";
const db = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: process.env.DB_PORT || "3306",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  name: process.env.DB_NAME || "growth_group_internal_crm",
};

if (!existsSync(backupDir)) {
  mkdirSync(backupDir, { recursive: true });
}

const id = randomUUID();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const filePath = join(backupDir, `${db.name}-${stamp}.sql`);

const connection = await mysql.createConnection({
  host: db.host,
  port: Number(db.port),
  user: db.user,
  password: db.password,
  database: db.name,
});

await connection.execute(
  "INSERT INTO backup_run (id, status, file_path, storage_provider) VALUES (?, 'started', ?, 'local')",
  [id, filePath],
);

try {
  await new Promise((resolve, reject) => {
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

  const checksum = await sha256(filePath);
  const sizeBytes = statSync(filePath).size;

  await connection.execute(
    `UPDATE backup_run
     SET status = 'completed',
         size_bytes = ?,
         checksum_sha256 = ?,
         completed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [sizeBytes, checksum, id],
  );

  console.log(`Backup completed: ${filePath}`);
  console.log(`SHA256: ${checksum}`);
} catch (error) {
  await connection.execute(
    `UPDATE backup_run
     SET status = 'failed',
         error_message = ?,
         completed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [error instanceof Error ? error.message : String(error), id],
  );
  throw error;
} finally {
  await connection.end();
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
