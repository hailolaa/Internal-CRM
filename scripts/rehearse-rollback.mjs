import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const args = parseArgs(process.argv.slice(2));
const mode = String(args.mode || "planned");
const manifestPath = path.resolve(rootDir, args.manifest || "release/current-release.json");
const previousManifestPath = args.previousManifest
  ? path.resolve(rootDir, String(args.previousManifest))
  : null;
const outputPath = path.resolve(rootDir, args.output || "release/rollback-rehearsal.md");
const postRollbackHealthUrl = String(args.postRollbackHealthUrl || process.env.ROLLBACK_HEALTH_URL || "");
const timeoutMs = Number(args.timeoutMs || 15000);

if (!["planned", "rehearsed", "actual"].includes(mode)) {
  fail("--mode must be planned, rehearsed or actual");
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const previousManifest = previousManifestPath
  ? JSON.parse(await fs.readFile(previousManifestPath, "utf8"))
  : null;

const issues = [];
const warnings = [];
const checks = [];

check("Manifest is readable", Boolean(manifest.releaseId), "Release ID is missing.");
check("Mission Control revision is present", Boolean(manifest.repository?.revision), "Mission Control revision is missing.");
check("Base schema checksum is present", Boolean(manifest.database?.baseSchema?.sha256), "Base schema checksum is missing.");
check("Migration order is present", Array.isArray(manifest.database?.migrations), "Migration list is missing.");

if (args.requirePrevious === true && !manifest.rollback?.previousMissionControlRevision) {
  issues.push("Previous Mission Control revision is required.");
}

if ((args.requirePreviousManifest === true || mode !== "planned") && !previousManifest) {
  issues.push("Previous release manifest is required for rehearsed or actual rollback.");
}

if (args.requireBackup === true && !manifest.rollback?.databaseBackup) {
  issues.push("Database backup reference is required.");
}

if (previousManifest) {
  check(
    "Previous release manifest is readable",
    Boolean(previousManifest.releaseId && previousManifest.repository?.revision),
    "Previous release manifest is missing release ID or revision.",
  );
  compareMigrationCompatibility();
}

if (mode !== "planned") {
  if (!postRollbackHealthUrl) {
    issues.push("Post-rollback health URL is required before recording a rehearsed or actual rollback.");
  } else {
    await verifyPostRollbackHealth();
  }
}

const title = {
  planned: "Planned Rollback Review",
  rehearsed: "Rehearsed Rollback",
  actual: "Actual Rollback",
}[mode];

const result = issues.length ? "Blocked" : mode === "planned" ? "Planning checks passed" : "Rollback verification passed";
const rehearsal = `# ${title}

## Release

- Release ID: ${manifest.releaseId || "Missing"}
- Environment: ${manifest.environment || "Missing"}
- Mission Control revision: ${manifest.repository?.revision || "Missing"}
- Previous Mission Control revision: ${manifest.rollback?.previousMissionControlRevision || "Not provided"}
- Previous release manifest: ${previousManifestPath ? path.relative(rootDir, previousManifestPath) : "Not provided"}
- Database backup: ${manifest.rollback?.databaseBackup || "Not provided"}
- Mode: ${mode}

## Checks

${checks.map((item) => `- ${item.name}: ${item.status}${item.detail ? ` (${item.detail})` : ""}`).join("\n")}

## Migration Compatibility

${warnings.length ? warnings.map((warning) => `- Warning: ${warning}`).join("\n") : "- No migration compatibility warnings were detected from the supplied manifests."}

## Rollback Plan

1. Stop new writes or pause user access if the release is actively corrupting data.
2. Redeploy the previous known-good Mission Control revision.
3. Restore the database backup only when fix-forward is unsafe or migration/data changes cannot be safely corrected.
4. Run backend readiness, frontend login and the agreed smoke path.
5. Record the rollback result in the release record.

## Result

${result}
${issues.length ? `\n${issues.map((issue) => `- ${issue}`).join("\n")}` : ""}
`;

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, rehearsal);

if (issues.length) {
  console.error(`Rollback ${mode} blocked: ${issues.length} issue(s)`);
  console.error(issues.map((issue) => `- ${issue}`).join("\n"));
  process.exit(1);
}

console.log(`Rollback ${mode} checks passed: ${path.relative(rootDir, outputPath)}`);

function parseArgs(items) {
  const parsed = {};
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const next = items[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function check(name, passed, failMessage) {
  checks.push({ name, status: passed ? "Pass" : "Fail", detail: passed ? "" : failMessage });
  if (!passed) issues.push(failMessage);
}

function compareMigrationCompatibility() {
  const currentMigrations = manifest.database?.migrations || [];
  const previousMigrations = previousManifest.database?.migrations || [];
  const previousByPath = new Map(previousMigrations.map((entry) => [entry.path, entry.sha256]));
  const added = currentMigrations.filter((entry) => !previousByPath.has(entry.path));
  const changed = currentMigrations.filter((entry) => previousByPath.has(entry.path) && previousByPath.get(entry.path) !== entry.sha256);

  if (changed.length) {
    issues.push(`Previous/current migration checksum mismatch: ${changed.map((entry) => entry.path).join(", ")}`);
  }

  if (added.length) {
    warnings.push(
      `${added.length} migration(s) exist after the previous release. Database rollback may require restore or a controlled fix-forward plan.`,
    );
    if (mode === "actual" && !manifest.rollback?.databaseBackup) {
      issues.push("Actual rollback across new migrations requires a database backup/restore reference or a signed fix-forward decision.");
    }
  }

  if (previousManifest.database?.baseSchema?.sha256 && manifest.database?.baseSchema?.sha256) {
    if (previousManifest.database.baseSchema.sha256 !== manifest.database.baseSchema.sha256) {
      warnings.push("Base schema checksum differs from the previous release.");
    }
  }
}

async function verifyPostRollbackHealth() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(postRollbackHealthUrl, { signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      issues.push(`Post-rollback health check failed with ${response.status}: ${text.slice(0, 200)}`);
      checks.push({ name: "Post-rollback health check", status: "Fail", detail: `HTTP ${response.status}` });
      return;
    }
    checks.push({ name: "Post-rollback health check", status: "Pass", detail: postRollbackHealthUrl });
  } catch (error) {
    issues.push(`Post-rollback health check failed: ${error instanceof Error ? error.message : String(error)}`);
    checks.push({ name: "Post-rollback health check", status: "Fail", detail: postRollbackHealthUrl });
  } finally {
    clearTimeout(timeout);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
