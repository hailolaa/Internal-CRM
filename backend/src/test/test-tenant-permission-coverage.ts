import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

type CoverageCase = {
  area: string;
  routeFiles: string[];
  testFiles: string[];
  routePattern: RegExp;
  tenantPattern: RegExp;
  permissionPattern: RegExp;
};

const cases: CoverageCase[] = [
  {
    area: "core Mission Control API and universal search",
    routeFiles: [
      "src/modules/mission-control-api/mission-control-api.routes.ts",
      "src/modules/mission-control-api/mcp.routes.ts",
    ],
    testFiles: ["src/test/test-mission-control-api.ts"],
    routePattern: /\/search|\/records\/:type\/:id|tools\/call/,
    tenantPattern: /cross.tenant|tenant.scoped|wrong integration|revoked integration/i,
    permissionPattern: /403|missing MCP scope|forbidden|permission|read-only/i,
  },
  {
    area: "contacts, lead lists and CSV exports",
    routeFiles: ["src/modules/contacts/contacts.routes.ts"],
    testFiles: ["src/test/test-tenant-isolation.ts", "src/test/test-contact-pagination.ts"],
    routePattern: /export\/csv|duplicates|timeline|actions/,
    tenantPattern: /another workspace|cross.tenant|doesNotMatch|tenant isolation/i,
    permissionPattern: /authorizePermission\("contacts:(read|write)"\)|403|permission/i,
  },
  {
    area: "reports and exported evidence",
    routeFiles: ["src/modules/reports/reports.routes.ts"],
    testFiles: [
      "src/test/test-report-exports.ts",
      "src/test/test-reports-dashboard.ts",
      "src/test/test-ops-manager-report-actions.ts",
    ],
    routePattern: /exports|dashboard|share|workflow/,
    tenantPattern: /tenant.scoped|scoped seed|tenant isolation|current user's clinic/i,
    permissionPattern: /403|authorizePermission\("reports:(read|write)"\)|permission/i,
  },
  {
    area: "files and compliance requests",
    routeFiles: ["src/modules/compliance/compliance.routes.ts", "src/modules/client-accounts/client-accounts.routes.ts"],
    testFiles: ["src/test/test-compliance-files-requests.ts", "src/test/test-client-accounts.ts"],
    routePattern: /file|documents|data-access-requests|assets|drive/i,
    tenantPattern: /tenant scoped|outsideClientRoot|crossWorkspace|another workspace/i,
    permissionPattern: /403|settings:(read|write)|client_accounts:(read|write)|permission/i,
  },
  {
    area: "calls, recordings and recovery work",
    routeFiles: ["src/modules/calls/calls.routes.ts", "src/modules/webhooks/webhooks.routes.ts"],
    testFiles: [
      "src/test/test-calls-commercial.ts",
      "src/test/test-calls-twilio.ts",
      "src/test/test-missed-call-recovery.ts",
    ],
    routePattern: /recording-deletion|generate-intelligence|transcribe|missed-call-recovery/i,
    tenantPattern: /clinic.scoped|another clinic|mapped active|unmapped|demo\/test/i,
    permissionPattern: /403|401|calls:(read|write)|signature|permission/i,
  },
  {
    area: "provider integrations and sync administration",
    routeFiles: [
      "src/modules/clickup/clickup.routes.ts",
      "src/modules/fleet-ingestion/fleet-ingestion.routes.ts",
      "src/modules/integration-inputs/integration-inputs.routes.ts",
    ],
    testFiles: [
      "src/test/test-clickup-mappings.ts",
      "src/test/test-fleet-ingestion.ts",
      "src/test/test-integration-inputs.ts",
      "src/test/test-clinic-os-alpha-sync-receiver.ts",
    ],
    routePattern: /webhook|reconciliation|sync|health|source/i,
    tenantPattern: /tenant.scoped|current_clinic|all_clients|replay|badSignature/i,
    permissionPattern: /403|401|internal_tasks:read|settings:(read|write)|permission/i,
  },
  {
    area: "operator search and command surfaces",
    routeFiles: ["src/modules/command-palette/command-palette.routes.ts"],
    testFiles: ["src/test/test-command-palette.ts"],
    routePattern: /command-palette/,
    tenantPattern: /tenant.scoped|clinic switch|account-only proposal search/i,
    permissionPattern: /permissions|proposal-only|contacts:read|403/i,
  },
];

test("CG-022 Mission Control high-risk routes have tenant-negative and permission coverage", () => {
  for (const coverage of cases) {
    const routeText = readFiles(coverage.routeFiles, coverage.area);
    const testText = readFiles(coverage.testFiles, coverage.area);

    assert.match(routeText, coverage.routePattern, `${coverage.area} route surface is not represented`);
    assert.match(testText, coverage.tenantPattern, `${coverage.area} is missing tenant-negative evidence`);
    assert.match(
      `${routeText}\n${testText}`,
      coverage.permissionPattern,
      `${coverage.area} is missing permission/denial evidence`,
    );
  }
});

function readFiles(files: string[], area: string) {
  return files
    .map((file) => {
      const absolute = path.join(process.cwd(), file);
      assert.equal(existsSync(absolute), true, `${area} evidence file is missing: ${file}`);
      return readFileSync(absolute, "utf8");
    })
    .join("\n");
}
