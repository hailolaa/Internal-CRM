import crypto from "node:crypto";
import fs from "node:fs/promises";
import process from "node:process";
import mysql from "mysql2/promise";
import "dotenv/config";

const migrationsDirectory = new URL("./migrations/", import.meta.url);
const required = ["DB_HOST", "DB_USER", "DB_NAME"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing database configuration: ${missing.join(", ")}`);

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
  multipleStatements: true,
});

try {
  await connection.query(`CREATE TABLE IF NOT EXISTS schema_migration (
    filename VARCHAR(255) NOT NULL PRIMARY KEY,
    checksum CHAR(64) NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  const filenames = (await fs.readdir(migrationsDirectory))
    .filter((filename) => /^\d{8}_[a-z0-9_]+\.sql$/.test(filename))
    .sort();

  for (const filename of filenames) {
    const sql = await fs.readFile(new URL(filename, migrationsDirectory), "utf8");
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");
    const [rows] = await connection.execute(
      "SELECT checksum FROM schema_migration WHERE filename = ?",
      [filename],
    );
    const existing = rows[0];
    if (existing) {
      if (existing.checksum !== checksum) throw new Error(`Applied migration changed: ${filename}`);
      console.log(`skip ${filename}`);
      continue;
    }

    console.log(`apply ${filename}`);
    await connection.beginTransaction();
    try {
      await connection.query(sql);
      await connection.execute(
        "INSERT INTO schema_migration (filename, checksum) VALUES (?, ?)",
        [filename, checksum],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
} finally {
  await connection.end();
}
