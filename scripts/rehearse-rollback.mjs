import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(rootDir, args.manifest || "release/current-release.json");
const outputPath = path.resolve(rootDir, args.output || "release/rollback-rehearsal.md");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

const issues = [];
if (!manifest.releaseId) issues.push("Release ID is missing.");
if (!manifest.repository?.revision) issues.push("Mission Control revision is missing.");
if (!manifest.database?.baseSchema?.sha256) issues.push("Base schema checksum is missing.");
if (!Array.isArray(manifest.database?.migrations)) issues.push("Migration list is missing.");
if (args.requirePrevious === true && !manifest.rollback?.previousMissionControlRevision) {
  issues.push("Previous Mission Control revision is required for this rehearsal.");
}
if (args.requireBackup === true && !manifest.rollback?.databaseBackup) {
  issues.push("Database backup reference is required for this rehearsal.");
}

const rehearsal = `# Rollback Rehearsal

## Release

- Release ID: ${manifest.releaseId || "Missing"}
- Environment: ${manifest.environment || "Missing"}
- Mission Control revision: ${manifest.repository?.revision || "Missing"}
- Previous Mission Control revision: ${manifest.rollback?.previousMissionControlRevision || "Not provided"}
- Database backup: ${manifest.rollback?.databaseBackup || "Not provided"}

## Rehearsal Checks

- Manifest is readable: ${manifest.releaseId ? "Pass" : "Fail"}
- Base schema checksum present: ${manifest.database?.baseSchema?.sha256 ? "Pass" : "Fail"}
- Migration order present: ${Array.isArray(manifest.database?.migrations) ? "Pass" : "Fail"}
- Previous revision present: ${manifest.rollback?.previousMissionControlRevision ? "Pass" : "Not provided"}
- Backup reference present: ${manifest.rollback?.databaseBackup ? "Pass" : "Not provided"}

## Rollback Plan

1. Stop new writes or pause user access if the release is actively corrupting data.
2. Redeploy the previous known-good Mission Control revision.
3. Restore the database backup only if fix-forward is unsafe or the release changed data/schema irreversibly.
4. Run backend readiness, frontend login and the agreed smoke path.
5. Record the rollback result in the release record.

## Result

${issues.length ? `Blocked:\n\n${issues.map((issue) => `- ${issue}`).join("\n")}` : "Rollback rehearsal passed."}
`;

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, rehearsal);

if (issues.length) {
  console.error(`Rollback rehearsal blocked: ${issues.length} issue(s)`);
  console.error(issues.map((issue) => `- ${issue}`).join("\n"));
  process.exit(1);
}

console.log(`Rollback rehearsal passed: ${path.relative(rootDir, outputPath)}`);

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
