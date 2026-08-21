import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const createManifestScript = path.join(rootDir, "scripts", "create-release-manifest.mjs");
const verifyDeploymentScript = path.join(rootDir, "scripts", "verify-deployment.mjs");
const verifyManifestScript = path.join(rootDir, "scripts", "verify-release-manifest.mjs");
const rollbackScript = path.join(rootDir, "scripts", "rehearse-rollback.mjs");
let importCounter = 0;

test("create-release-manifest records pending deployment verification in the signed manifest", async () => {
  const workspace = await tempWorkspace();
  const key = "release-test-key";
  const outputPath = path.join(workspace, "release/current-release.json");

  await runOk(createManifestScript, [
    "--environment",
    "staging",
    "--mission-control-revision",
    "abc123abc123",
    "--previous-mission-control-revision",
    "previous123",
    "--clinic-os-frontend-revision",
    "front123",
    "--clinic-os-backend-revision",
    "back123",
    "--output",
    outputPath,
    "--require-signature",
  ], { RELEASE_MANIFEST_SIGNING_KEY: key });

  const manifest = JSON.parse(await fs.readFile(outputPath, "utf8"));
  assert.equal(manifest.deploymentVerification.state, "pending_external_deployment");
  assert.equal(manifest.deploymentVerification.reportPath, "release/deployment-verification.json");
  assert.equal(manifest.deploymentVerification.deployedRevision, null);
  assert.equal(manifest.signature.algorithm, "hmac-sha256");
  assert.equal(JSON.stringify(manifest).includes(key), false);
});

test("create-release-manifest can optionally require backup evidence", async () => {
  const workspace = await tempWorkspace();
  const key = "release-test-key";
  const outputPath = path.join(workspace, "release/current-release.json");

  const blocked = await runFail(createManifestScript, [
    "--environment",
    "production",
    "--mission-control-revision",
    "abc123abc123",
    "--previous-mission-control-revision",
    "previous123",
    "--output",
    outputPath,
    "--require-signature",
    "--require-database-backup",
    "true",
  ], { RELEASE_MANIFEST_SIGNING_KEY: key });
  assert.match(blocked.stderr, /Database backup reference is required/i);

  await runOk(createManifestScript, [
    "--environment",
    "production",
    "--mission-control-revision",
    "abc123abc123",
    "--previous-mission-control-revision",
    "previous123",
    "--database-backup",
    "backup-20260821",
    "--database-backup-checksum",
    "a".repeat(64),
    "--database-backup-timestamp",
    "2026-08-21T01:00:00.000Z",
    "--restore-readiness",
    "REHEARSABLE",
    "--output",
    outputPath,
    "--require-signature",
    "--require-database-backup",
    "true",
  ], { RELEASE_MANIFEST_SIGNING_KEY: key });

  const manifest = JSON.parse(await fs.readFile(outputPath, "utf8"));
  assert.equal(manifest.rollback.databaseBackup, "backup-20260821");
  assert.deepEqual(manifest.rollback.backupEvidence, {
    reference: "backup-20260821",
    checksumSha256: "a".repeat(64),
    createdAt: "2026-08-21T01:00:00.000Z",
    restoreReadiness: "REHEARSABLE",
    required: true,
  });
});

test("verify-deployment passes when deployed version matches the signed manifest", async () => {
  const workspace = await tempWorkspace();
  const key = "release-test-key";
  const manifest = signedManifest({ key });
  const manifestPath = await writeJson(workspace, "release/current-release.json", manifest);
  const outputPath = path.join(workspace, "release/deployment-verification.json");
  const backend = await startBackendServer({ release: releaseFromManifest(manifest) });
  const frontend = await startFrontendServer();

  try {
    await runOk(verifyDeploymentScript, [
      "--manifest",
      manifestPath,
      "--environment",
      "staging",
      "--backend-url",
      backend.url,
      "--frontend-url",
      frontend.url,
      "--output",
      outputPath,
      "--require-signature",
    ], { RELEASE_MANIFEST_SIGNING_KEY: key });

    const report = JSON.parse(await fs.readFile(outputPath, "utf8"));
    assert.equal(report.status, "pass");
    assert.equal(report.deployedRevision, manifest.repository.revision);
    assert.equal(
      report.checks.find((check) => check.name === "authenticated_api_health")?.status,
      "skipped",
    );
  } finally {
    await Promise.all([backend.close(), frontend.close()]);
  }
});

test("verify-deployment fails when the deployed revision differs from the manifest", async () => {
  const workspace = await tempWorkspace();
  const key = "release-test-key";
  const manifest = signedManifest({ key });
  const manifestPath = await writeJson(workspace, "release/current-release.json", manifest);
  const backend = await startBackendServer({
    release: { ...releaseFromManifest(manifest), missionControl: { revision: "wrong-revision" } },
  });
  const frontend = await startFrontendServer();

  try {
    const result = await runFail(verifyDeploymentScript, [
      "--manifest",
      manifestPath,
      "--environment",
      "staging",
      "--backend-url",
      backend.url,
      "--frontend-url",
      frontend.url,
      "--require-signature",
    ], { RELEASE_MANIFEST_SIGNING_KEY: key });
    assert.match(result.stderr, /mission_control_revision/i);
  } finally {
    await Promise.all([backend.close(), frontend.close()]);
  }
});

test("verify-deployment fails when the deployed environment differs from the manifest", async () => {
  const workspace = await tempWorkspace();
  const key = "release-test-key";
  const manifest = signedManifest({ key });
  const manifestPath = await writeJson(workspace, "release/current-release.json", manifest);
  const backend = await startBackendServer({
    release: { ...releaseFromManifest(manifest), environment: "production" },
  });
  const frontend = await startFrontendServer();

  try {
    const result = await runFail(verifyDeploymentScript, [
      "--manifest",
      manifestPath,
      "--environment",
      "staging",
      "--backend-url",
      backend.url,
      "--frontend-url",
      frontend.url,
      "--require-signature",
    ], { RELEASE_MANIFEST_SIGNING_KEY: key });
    assert.match(result.stderr, /release_environment/i);
  } finally {
    await Promise.all([backend.close(), frontend.close()]);
  }
});

test("verify-deployment fails when backend health is not ready", async () => {
  const workspace = await tempWorkspace();
  const key = "release-test-key";
  const manifest = signedManifest({ key });
  const manifestPath = await writeJson(workspace, "release/current-release.json", manifest);
  const backend = await startBackendServer({ release: releaseFromManifest(manifest), readyStatus: 503 });
  const frontend = await startFrontendServer();

  try {
    const result = await runFail(verifyDeploymentScript, [
      "--manifest",
      manifestPath,
      "--environment",
      "staging",
      "--backend-url",
      backend.url,
      "--frontend-url",
      frontend.url,
      "--require-signature",
    ], { RELEASE_MANIFEST_SIGNING_KEY: key });
    assert.match(result.stderr, /backend_ready/i);
  } finally {
    await Promise.all([backend.close(), frontend.close()]);
  }
});

test("verify-deployment fails when migration state differs from the manifest", async () => {
  const workspace = await tempWorkspace();
  const key = "release-test-key";
  const manifest = signedManifest({ key });
  const manifestPath = await writeJson(workspace, "release/current-release.json", manifest);
  const release = releaseFromManifest(manifest);
  const backend = await startBackendServer({
    release: { ...release, database: { ...release.database, migrationCount: 99 } },
  });
  const frontend = await startFrontendServer();

  try {
    const result = await runFail(verifyDeploymentScript, [
      "--manifest",
      manifestPath,
      "--environment",
      "staging",
      "--backend-url",
      backend.url,
      "--frontend-url",
      frontend.url,
      "--require-signature",
    ], { RELEASE_MANIFEST_SIGNING_KEY: key });
    assert.match(result.stderr, /database_migration_count/i);
  } finally {
    await Promise.all([backend.close(), frontend.close()]);
  }
});

test("verify-deployment fails when frontend availability smoke check fails", async () => {
  const workspace = await tempWorkspace();
  const key = "release-test-key";
  const manifest = signedManifest({ key });
  const manifestPath = await writeJson(workspace, "release/current-release.json", manifest);
  const backend = await startBackendServer({ release: releaseFromManifest(manifest) });
  const frontend = await startFrontendServer({ status: 503 });

  try {
    const result = await runFail(verifyDeploymentScript, [
      "--manifest",
      manifestPath,
      "--environment",
      "staging",
      "--backend-url",
      backend.url,
      "--frontend-url",
      frontend.url,
      "--require-signature",
    ], { RELEASE_MANIFEST_SIGNING_KEY: key });
    assert.match(result.stderr, /frontend_availability/i);
  } finally {
    await Promise.all([backend.close(), frontend.close()]);
  }
});

test("verify-deployment fails clearly when deployment URLs are not configured", async () => {
  const workspace = await tempWorkspace();
  const key = "release-test-key";
  const manifestPath = await writeJson(workspace, "release/current-release.json", signedManifest({ key }));

  const result = await runFail(verifyDeploymentScript, [
    "--manifest",
    manifestPath,
    "--environment",
    "staging",
    "--require-signature",
  ], { RELEASE_MANIFEST_SIGNING_KEY: key, RELEASE_BACKEND_URL: "", RELEASE_FRONTEND_URL: "" });

  assert.match(result.stderr, /External dependency missing: RELEASE_BACKEND_URL/i);
});

test("verify-deployment rejects an invalid manifest signature", async () => {
  const workspace = await tempWorkspace();
  const manifestPath = await writeJson(
    workspace,
    "release/current-release.json",
    signedManifest({ key: "wrong-key" }),
  );
  const backend = await startBackendServer({ release: releaseFromManifest(signedManifest({ key: "wrong-key" })) });
  const frontend = await startFrontendServer();

  try {
    const result = await runFail(verifyDeploymentScript, [
      "--manifest",
      manifestPath,
      "--environment",
      "staging",
      "--backend-url",
      backend.url,
      "--frontend-url",
      frontend.url,
      "--require-signature",
    ], { RELEASE_MANIFEST_SIGNING_KEY: "right-key" });
    assert.match(result.stderr, /signature is invalid/i);
  } finally {
    await Promise.all([backend.close(), frontend.close()]);
  }
});

test("verify-release-manifest fails when migrations are not in filename order", async () => {
  const workspace = await tempWorkspace();
  await fs.mkdir(path.join(workspace, "backend/scripts/migrations"), { recursive: true });
  await fs.writeFile(path.join(workspace, "backend/db.sql"), "SELECT 1;\n");
  await fs.writeFile(path.join(workspace, "backend/scripts/migrations/20260820_b.sql"), "SELECT 2;\n");
  await fs.writeFile(path.join(workspace, "backend/scripts/migrations/20260820_a.sql"), "SELECT 3;\n");

  const manifestPath = await writeJson(workspace, "release/current-release.json", {
    schemaVersion: 1,
    releaseId: "staging-test",
    environment: "staging",
    repository: { revision: "abc123" },
    database: {
      baseSchema: await fileEntry(workspace, "backend/db.sql"),
      migrations: [
        await fileEntry(workspace, "backend/scripts/migrations/20260820_b.sql"),
        await fileEntry(workspace, "backend/scripts/migrations/20260820_a.sql"),
      ],
    },
    artifacts: {},
    signature: null,
  });

  const result = await runFail(verifyManifestScript, ["--manifest", manifestPath], {}, workspace);
  assert.match(result.stderr, /sorted in filename order/i);
});

test("rehearse-rollback planned mode records migration warnings without claiming actual rollback", async () => {
  const workspace = await tempWorkspace();
  const previous = signedManifest({ releaseId: "previous", revision: "previous-revision" });
  const current = signedManifest({
    releaseId: "current",
    revision: "current-revision",
    migrations: [
      { path: "backend/scripts/migrations/20260820_a.sql", sha256: "a" },
      { path: "backend/scripts/migrations/20260820_b.sql", sha256: "b" },
    ],
  });
  const currentPath = await writeJson(workspace, "release/current-release.json", current);
  const previousPath = await writeJson(workspace, "release/previous-release.json", previous);
  const outputPath = path.join(workspace, "release/rollback.md");

  await runOk(rollbackScript, [
    "--manifest",
    currentPath,
    "--previous-manifest",
    previousPath,
    "--output",
    outputPath,
    "--mode",
    "planned",
    "--require-previous",
  ]);

  const output = await fs.readFile(outputPath, "utf8");
  assert.match(output, /Planned Rollback Review/);
  assert.match(output, /Warning:/);
  assert.doesNotMatch(output, /Actual Rollback/);
});

test("rehearse-rollback blocks rehearsed mode without a post-rollback health check", async () => {
  const workspace = await tempWorkspace();
  const currentPath = await writeJson(workspace, "release/current-release.json", signedManifest({ releaseId: "current" }));
  const previousPath = await writeJson(workspace, "release/previous-release.json", signedManifest({ releaseId: "previous" }));

  const result = await runFail(rollbackScript, [
    "--manifest",
    currentPath,
    "--previous-manifest",
    previousPath,
    "--mode",
    "rehearsed",
  ]);

  assert.match(result.stderr, /Post-rollback health URL is required/i);
});

test("rehearse-rollback rehearsed mode passes with previous manifest and health check", async () => {
  const workspace = await tempWorkspace();
  const currentPath = await writeJson(workspace, "release/current-release.json", signedManifest({ releaseId: "current" }));
  const previousPath = await writeJson(workspace, "release/previous-release.json", signedManifest({ releaseId: "previous" }));
  const outputPath = path.join(workspace, "release/rehearsed.md");
  const health = await startFrontendServer();

  try {
    await runOk(rollbackScript, [
      "--manifest",
      currentPath,
      "--previous-manifest",
      previousPath,
      "--output",
      outputPath,
      "--mode",
      "rehearsed",
      "--post-rollback-health-url",
      health.url,
    ]);
    assert.match(await fs.readFile(outputPath, "utf8"), /Rehearsed Rollback/);
  } finally {
    await health.close();
  }
});

function signedManifest({
  key = "release-test-key",
  releaseId = "staging-test-release",
  revision = "abc123abc123",
  environment = "staging",
  migrations = [{ path: "backend/scripts/migrations/20260820_a.sql", sha256: "a" }],
} = {}) {
  const body = {
    schemaVersion: 1,
    releaseId,
    environment,
    repository: { name: "mission-control", revision, branch: "main", dirty: false },
    pairedRevisions: { clinicOsFrontend: "front123", clinicOsBackend: "back123" },
    database: {
      baseSchema: { path: "backend/db.sql", sha256: "schema123" },
      migrationDirectory: "backend/scripts/migrations",
      migrations,
    },
    artifacts: {},
    deploymentVerification: {
      state: "pending_external_deployment",
      deployedRevision: null,
      verifiedAt: null,
      reportPath: "release/deployment-verification.json",
      requiredChecks: ["backend_live", "backend_ready", "backend_version", "frontend_availability", "manifest_match"],
    },
    rollback: {
      previousReleaseId: "previous-release",
      previousMissionControlRevision: "previous-revision",
      databaseBackup: "backup-reference",
      rehearseBeforeProduction: true,
    },
  };
  return {
    ...body,
    signature: {
      algorithm: "hmac-sha256",
      keyId: "release-manifest-key",
      value: crypto.createHmac("sha256", key).update(stableStringify(body)).digest("hex"),
    },
  };
}

function releaseFromManifest(manifest) {
  return {
    releaseId: manifest.releaseId,
    environment: manifest.environment,
    missionControl: { revision: manifest.repository.revision, branch: "main" },
    pairedRevisions: manifest.pairedRevisions,
    database: {
      baseSchemaSha256: manifest.database.baseSchema.sha256,
      migrationCount: manifest.database.migrations.length,
    },
    signature: { present: Boolean(manifest.signature?.value) },
    deploymentVerification: manifest.deploymentVerification,
  };
}

async function tempWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), "release-verification-"));
}

async function writeJson(workspace, relativePath, value) {
  const target = path.join(workspace, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
}

async function fileEntry(workspace, relativePath) {
  const filePath = path.join(workspace, relativePath);
  const buffer = await fs.readFile(filePath);
  return {
    path: relativePath.replace(/\\/g, "/"),
    sizeBytes: buffer.length,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
}

async function startBackendServer({ release, liveStatus = 200, readyStatus = 200 }) {
  const server = http.createServer((req, res) => {
    if (req.url === "/health/live") {
      return json(res, { status: liveStatus === 200 ? "success" : "error", data: { ok: liveStatus === 200 } }, liveStatus);
    }
    if (req.url === "/health/ready") {
      return json(
        res,
        { status: readyStatus === 200 ? "success" : "error", data: { ok: readyStatus === 200, database: { ok: readyStatus === 200 } } },
        readyStatus,
      );
    }
    if (req.url === "/health/version") {
      return json(res, { status: "success", data: { release } });
    }
    res.writeHead(404).end();
  });
  await listen(server);
  return serverHandle(server);
}

async function startFrontendServer({ status = 200 } = {}) {
  const server = http.createServer((req, res) => {
    res.writeHead(status, { "content-type": "text/html" });
    res.end("<!doctype html><title>Mission Control</title>");
  });
  await listen(server);
  return serverHandle(server);
}

function json(res, body, status = 200) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

function serverHandle(server) {
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function runOk(script, args, env = {}, cwd = rootDir) {
  const result = await runScript(script, args, env, cwd);
  if (result.code !== 0) {
    assert.fail(`Command failed with ${result.code}: ${result.stderr}`);
  }
  return result;
}

async function runFail(script, args, env = {}, cwd = rootDir) {
  const result = await runScript(script, args, env, cwd);
  if (result.code === 0) assert.fail("Command was expected to fail");
  return result;
}

async function runScript(script, args, env, cwd) {
  const oldArgv = process.argv;
  const oldCwd = process.cwd();
  const oldExit = process.exit;
  const oldLog = console.log;
  const oldError = console.error;
  const previousEnv = new Map(Object.keys(env).map((key) => [key, process.env[key]]));
  let stdout = "";
  let stderr = "";
  let code = 0;

  class ExitError extends Error {
    constructor(exitCode) {
      super(`process.exit(${exitCode})`);
      this.exitCode = exitCode;
    }
  }

  try {
    process.chdir(cwd);
    process.argv = [process.execPath, script, ...args];
    for (const [key, value] of Object.entries(env)) {
      process.env[key] = value;
    }
    process.exit = ((exitCode = 0) => {
      throw new ExitError(Number(exitCode));
    });
    console.log = (...items) => {
      stdout += `${items.join(" ")}\n`;
    };
    console.error = (...items) => {
      stderr += `${items.join(" ")}\n`;
    };

    await import(`${pathToFileURL(script).href}?testRun=${importCounter++}`);
  } catch (error) {
    if (error instanceof ExitError) {
      code = error.exitCode;
    } else {
      throw error;
    }
  } finally {
    process.argv = oldArgv;
    process.chdir(oldCwd);
    process.exit = oldExit;
    console.log = oldLog;
    console.error = oldError;
    for (const [key, value] of previousEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  return { stdout, stderr, code };
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}
