import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const inputDirectory = process.argv[2] ? resolve(process.argv[2]) : resolve(process.cwd(), "../docs/import-templates/scoro");
const clinicId = process.env.SCORO_IMPORT_CLINIC_ID || "dry-run-clinic";
const ownerEmailToUserId = parseOwnerMap(process.env.SCORO_IMPORT_OWNER_MAP_JSON);
const moduleUrl = pathToFileURL(resolve(process.cwd(), "dist/modules/scoro-import/scoro-import.service.js")).href;
const { runScoroImportDryRun } = await import(moduleUrl);

const dryRun = runScoroImportDryRun({
  clinicId,
  inputDirectory,
  ownerEmailToUserId,
});

console.log(`Scoro dry-run source: ${inputDirectory}`);
console.log(`Source system: ${dryRun.sourceSystem}`);
console.log(`Clinic scope: ${dryRun.clinicId}`);
console.log(`Source rows: ${dryRun.reconciliation.sourceRows}`);
console.log(`Valid rows: ${dryRun.reconciliation.validRows}`);
console.log(`Mapped rows: ${dryRun.reconciliation.mappedRows}`);
console.log(`Duplicate candidates: ${dryRun.reconciliation.duplicateCandidates}`);
console.log(`Quarantined rows: ${dryRun.reconciliation.quarantinedRows}`);
console.log(`Unresolved relations: ${dryRun.reconciliation.unresolvedRelations}`);
console.log(`Owner mapping issues: ${dryRun.reconciliation.ownerMappingIssues}`);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(dryRun, null, 2));
}

if (dryRun.reconciliation.quarantinedRows > 0) {
  console.error("Scoro dry-run completed with quarantine items. Review the reconciliation output before any apply step.");
}

if (process.argv.includes("--fail-on-quarantine") && dryRun.reconciliation.quarantinedRows > 0) {
  process.exitCode = 2;
}

function parseOwnerMap(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}
