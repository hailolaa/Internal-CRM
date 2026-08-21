import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import { existsSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertFileChecksum,
  buildAlertPayload,
  buildBackupManifest,
  buildRestoreRehearsalReport,
  collectBackupEvidence,
  compareMigrationEvidence,
  decryptFile,
  encryptFile,
  pruneOldArtifacts,
  readBackupManifest,
  restoreStates,
  sha256,
} from "./backup-evidence.mjs";

test("backup helpers encrypt and decrypt without storing plaintext in the encrypted artifact", async () => {
  const workspace = await tempWorkspace();
  const inputPath = path.join(workspace, "backup.sql");
  const encryptedPath = `${inputPath}.enc`;
  const outputPath = path.join(workspace, "restore.sql");
  const key = "test-backup-key-with-more-than-32-characters";
  await fs.writeFile(inputPath, "CREATE TABLE safe_restore_check (id int);\n");

  await encryptFile(inputPath, encryptedPath, key);
  await decryptFile(encryptedPath, outputPath, key);

  assert.equal(await fs.readFile(outputPath, "utf8"), "CREATE TABLE safe_restore_check (id int);\n");
  assert.match(await fs.readFile(encryptedPath, "utf8"), /^MCB1:/);
  assert.notEqual(await fs.readFile(encryptedPath, "utf8"), await fs.readFile(inputPath, "utf8"));
  assert.equal(existsSync(`${encryptedPath}.tag`), true);
});

test("backup helpers detect checksum mismatches", async () => {
  const workspace = await tempWorkspace();
  const artifactPath = path.join(workspace, "backup.sql");
  await fs.writeFile(artifactPath, "SELECT 1;\n");
  const checksum = await sha256(artifactPath);

  assert.equal((await assertFileChecksum(artifactPath, checksum)).state, restoreStates.verified);

  await fs.writeFile(artifactPath, "SELECT 2;\n");
  await assert.rejects(
    () => assertFileChecksum(artifactPath, checksum),
    /Backup checksum mismatch/,
  );
});

test("backup manifest includes release, migration, encryption and off-site evidence without secrets", async () => {
  const startedAt = new Date("2026-08-21T01:00:00.000Z");
  const completedAt = new Date("2026-08-21T01:00:03.000Z");
  const manifest = buildBackupManifest({
    id: "backup-1",
    serviceName: "mission-control-backend",
    databaseName: "mission_control",
    startedAt,
    completedAt,
    storageProvider: "encrypted-offsite-filesystem",
    artifactPath: "backup.sql.enc",
    offsitePath: "offsite/backup.sql.enc",
    tagPath: "backup.sql.enc.tag",
    offsiteTagPath: "offsite/backup.sql.enc.tag",
    offsiteManifestPath: "offsite/backup.sql.enc.manifest.json",
    sizeBytes: 120,
    checksumSha256: "a".repeat(64),
    plaintextChecksumSha256: "b".repeat(64),
    encryptionKey: "super-secret-backup-key-with-more-than-32-characters",
    encryptionKeyId: "vault://backup-key/current",
    retentionDays: 30,
    evidence: {
      sourceEnvironment: "staging",
      release: { version: "1.0.0", revision: "abc123" },
      schema: { path: "db.sql", checksumSha256: "c".repeat(64) },
      migrations: { directory: "scripts/migrations", count: 2, checksumSha256: "d".repeat(64) },
    },
  });

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.encryption.keyId, "vault://backup-key/current");
  assert.equal(manifest.migrations.count, 2);
  assert.equal(manifest.restoreReadiness.state, "REHEARSABLE");
  assert.equal(manifest.offsite.manifestPath, "offsite/backup.sql.enc.manifest.json");
  assert.equal(JSON.stringify(manifest).includes("super-secret-backup-key"), false);
});

test("backup manifest reader rejects missing and corrupt manifests", async () => {
  const workspace = await tempWorkspace();
  assert.throws(
    () => readBackupManifest(path.join(workspace, "missing.manifest.json")),
    /readable backup manifest/,
  );

  const corruptPath = path.join(workspace, "corrupt.manifest.json");
  await fs.writeFile(corruptPath, "{nope");
  assert.throws(() => readBackupManifest(corruptPath), /Backup manifest JSON is corrupt/);
});

test("retention pruning removes old backup artifacts only", async () => {
  const workspace = await tempWorkspace();
  const oldArtifact = path.join(workspace, "old.sql.enc");
  const newArtifact = path.join(workspace, "new.sql.enc");
  const note = path.join(workspace, "keep.txt");
  writeFileSync(oldArtifact, "old");
  writeFileSync(newArtifact, "new");
  writeFileSync(note, "keep");
  const oldTime = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  utimesSync(oldArtifact, oldTime, oldTime);

  const pruned = pruneOldArtifacts(workspace, 1);

  assert.deepEqual(pruned.map((item) => path.basename(item)), ["old.sql.enc"]);
  assert.equal(existsSync(oldArtifact), false);
  assert.equal(existsSync(newArtifact), true);
  assert.equal(existsSync(note), true);
});

test("restore rehearsal report records failure and cleanup state without customer data", () => {
  const startedAt = new Date("2026-08-21T01:00:00.000Z");
  const completedAt = new Date("2026-08-21T01:00:02.000Z");
  const report = buildRestoreRehearsalReport({
    status: "failed",
    serviceName: "mission-control-backend",
    manifest: { id: "backup-1", checksumSha256: "a".repeat(64), sourceEnvironment: "production" },
    manifestPath: "backup.manifest.json",
    backupPath: "backup.sql.enc",
    restoreDatabase: "restore_db",
    startedAt,
    completedAt,
    durationMs: 2000,
    rtoMinutes: 60,
    rpoMinutes: 1440,
    failureReason: "Restore rehearsal completed but no tables were found.",
    cleanup: { state: restoreStates.verified, attempted: true, kept: false },
  });

  assert.equal(report.status, "failed");
  assert.equal(report.state, restoreStates.rehearsable);
  assert.equal(report.failureReason, "Restore rehearsal completed but no tables were found.");
  assert.equal(JSON.stringify(report).includes("patient"), false);
});

test("backup alert payload redacts secret-looking context and carries release metadata", () => {
  const previousRevision = process.env.BACKUP_RELEASE_REVISION;
  process.env.BACKUP_RELEASE_REVISION = "abc123";
  try {
    const payload = buildAlertPayload({
      serviceName: "mission-control-backend",
      type: "backup_failure",
      title: "Backup failed",
      error: new Error("boom"),
      context: {
        database: "mission_control",
        backupEncryptionKey: "should-not-leak",
        nested: { webhookToken: "also-secret" },
      },
    });

    assert.equal(payload.context.backupEncryptionKey, "[redacted]");
    assert.equal(payload.context.nested.webhookToken, "[redacted]");
    assert.equal(payload.release.revision, "abc123");
  } finally {
    if (previousRevision === undefined) delete process.env.BACKUP_RELEASE_REVISION;
    else process.env.BACKUP_RELEASE_REVISION = previousRevision;
  }
});

test("migration compatibility separates verified matches from operator review", () => {
  assert.equal(
    compareMigrationEvidence({ count: 2, checksumSha256: "a" }, { count: 2, checksumSha256: "a" }).state,
    restoreStates.verified,
  );
  const changed = compareMigrationEvidence({ count: 2, checksumSha256: "a" }, { count: 3, checksumSha256: "b" });
  assert.equal(changed.state, restoreStates.rehearsed);
  assert.equal(changed.compatible, false);
});

test("backup evidence can be collected from a repository-like workspace", async () => {
  const workspace = await tempWorkspace();
  await fs.mkdir(path.join(workspace, "scripts/migrations"), { recursive: true });
  await fs.writeFile(path.join(workspace, "package.json"), JSON.stringify({ version: "2.3.4" }));
  await fs.writeFile(path.join(workspace, "db.sql"), "CREATE TABLE one (id int);\n");
  await fs.writeFile(path.join(workspace, "scripts/migrations/20260821_one.sql"), "ALTER TABLE one ADD name text;\n");

  const evidence = await collectBackupEvidence({ rootDir: workspace, env: { NODE_ENV: "test" } });

  assert.equal(evidence.release.version, "2.3.4");
  assert.equal(evidence.schema.path, "db.sql");
  assert.equal(evidence.migrations.count, 1);
  assert.match(evidence.migrations.checksumSha256, /^[a-f0-9]{64}$/);
});

async function tempWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), "backup-hardening-"));
}
