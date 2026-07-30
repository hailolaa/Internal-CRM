import assert from "node:assert/strict";
import test from "node:test";
import {
  mysqlCliSslArgs,
  mysqlConnectionOptions,
  readBackupDbConfig,
} from "./backup-db-options.mjs";

test("backup database options enable verified TLS consistently", () => {
  const db = readBackupDbConfig({
    DB_HOST: "db.example.com",
    DB_PORT: "3307",
    DB_USER: "backup",
    DB_PASSWORD: "secret",
    DB_NAME: "mission_control",
    DB_SSL: "true",
    DB_SSL_REJECT_UNAUTHORIZED: "true",
  });

  assert.deepEqual(mysqlConnectionOptions(db), {
    host: "db.example.com",
    port: 3307,
    user: "backup",
    password: "secret",
    database: "mission_control",
    ssl: { rejectUnauthorized: true },
  });
  assert.deepEqual(mysqlCliSslArgs(db), ["--ssl-mode=VERIFY_IDENTITY"]);
});

test("backup database options support encrypted transport without CA verification", () => {
  const db = readBackupDbConfig({
    DB_SSL: "true",
    DB_SSL_REJECT_UNAUTHORIZED: "false",
  });

  assert.deepEqual(mysqlConnectionOptions(db, ""), {
    host: "127.0.0.1",
    port: 3306,
    user: "root",
    password: "",
    ssl: { rejectUnauthorized: false },
  });
  assert.deepEqual(mysqlCliSslArgs(db), ["--ssl-mode=REQUIRED"]);
});

test("backup database options do not force TLS when DB_SSL is disabled", () => {
  const db = readBackupDbConfig({ DB_SSL: "false" });

  assert.equal("ssl" in mysqlConnectionOptions(db), false);
  assert.deepEqual(mysqlCliSslArgs(db), []);
});
