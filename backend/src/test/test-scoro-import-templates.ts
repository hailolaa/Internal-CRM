import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const templateDir = resolve(testDir, "../../../docs/import-templates/scoro");

const requiredTemplates: Record<string, string[]> = {
  "scoro-leads-template.csv": [
    "scoro_record_id",
    "account_name",
    "email",
    "phone",
    "website",
    "first_source",
    "latest_source",
    "converting_source",
    "package_interest",
    "follow_up_due_at",
  ],
  "scoro-clients-template.csv": [
    "scoro_record_id",
    "account_name",
    "website",
    "current_package",
    "monthly_price",
    "client_status",
    "payment_status",
    "invoice_status",
    "client_owner_email",
  ],
  "scoro-contacts-template.csv": [
    "scoro_record_id",
    "account_name",
    "first_name",
    "last_name",
    "email",
    "phone",
    "can_email",
    "can_call",
    "can_whatsapp_message",
    "do_not_contact",
  ],
  "scoro-tasks-followups-template.csv": [
    "scoro_record_id",
    "related_type",
    "related_scoro_id",
    "title",
    "owner_email",
    "due_date",
    "priority",
    "status",
    "follow_up_type",
  ],
};

test("Scoro import template pack contains required operational headers", () => {
  for (const [filename, requiredHeaders] of Object.entries(requiredTemplates)) {
    const filePath = resolve(templateDir, filename);
    assert.equal(existsSync(filePath), true, `${filename} should exist`);

    const [headerLine = ""] = readFileSync(filePath, "utf8").split(/\r?\n/, 1);
    const headers = headerLine.split(",").map((header) => header.trim());

    for (const requiredHeader of requiredHeaders) {
      assert.equal(
        headers.includes(requiredHeader),
        true,
        `${filename} should include ${requiredHeader}`,
      );
    }
  }
});

test("Scoro import validator checks completed row data", () => {
  const validResult = spawnSync(
    process.execPath,
    [resolve(testDir, "../../scripts/validate-scoro-import.mjs"), templateDir],
    { encoding: "utf8" },
  );
  assert.equal(validResult.status, 0, validResult.stderr);

  const invalidTemplateDir = mkdtempSync(resolve(tmpdir(), "scoro-import-"));
  cpSync(templateDir, invalidTemplateDir, { recursive: true });
  const leadsPath = resolve(invalidTemplateDir, "scoro-leads-template.csv");
  const [headers, sampleRow] = readFileSync(leadsPath, "utf8").trim().split(/\r?\n/);
  assert.ok(headers);
  assert.ok(sampleRow);
  const invalidRow = sampleRow.replace(",true,true,true,false,", ",yes,true,true,false,");
  writeFileSync(leadsPath, `${headers}\n${invalidRow}\n${invalidRow}\n`);

  const invalidResult = spawnSync(
    process.execPath,
    [resolve(testDir, "../../scripts/validate-scoro-import.mjs"), invalidTemplateDir],
    { encoding: "utf8" },
  );
  assert.notEqual(invalidResult.status, 0);
  assert.match(invalidResult.stderr, /invalid can_email/);
  assert.match(invalidResult.stderr, /duplicates scoro_record_id/);
});
