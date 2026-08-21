import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildScoroApplyPlan,
  buildScoroCleanupPlan,
  normalizeScoroDomain,
  normalizeScoroEmail,
  normalizeScoroPhone,
  runScoroImportDryRun,
} from "../modules/scoro-import/scoro-import.service.js";

const ownerMap = {
  "sales@clinicgrower.com": "user-sales",
  "delivery@clinicgrower.com": "user-delivery",
};

test("Scoro dry-run maps documented templates into deterministic source identities", () => {
  const dir = writeScoroFixtureSet();
  const result = runScoroImportDryRun({ clinicId: "clinic-a", inputDirectory: dir, ownerEmailToUserId: ownerMap });

  assert.equal(result.sourceSystem, "scoro");
  assert.equal(result.records.length, 4);
  assert.equal(result.reconciliation.sourceRows, 4);
  assert.equal(result.reconciliation.quarantinedRows, 0);
  const leadRecord = result.records.find((record) => record.entity === "lead");
  assert.equal(leadRecord?.identity?.identityKey, "scoro:lead:scoro-lead-001");
  assert.equal(leadRecord?.identity?.normalizedEmail, "alex@exampledental.co.uk");
  assert.equal(leadRecord?.identity?.normalizedPhone, "447700900111");
  assert.equal(leadRecord?.identity?.normalizedDomain, "exampledental.co.uk");
  assert.equal(result.records.find((record) => record.entity === "task_followup")?.relatedSourceIdentity, "scoro:lead:scoro-lead-001");
});

test("Scoro dry-run detects duplicate email, phone and Scoro source IDs without using names as identity", () => {
  const dir = writeScoroFixtureSet({
    leads: [
      validLead("scoro-lead-001"),
      validLead("scoro-lead-002", { email: "ALEX@exampledental.co.uk", phone: "+44 7700 900111", account_name: "Same Name Only" }),
      validLead("scoro-lead-002", { email: "second@exampledental.co.uk", phone: "+447700900222" }),
    ],
  });
  const result = runScoroImportDryRun({
    clinicId: "clinic-a",
    inputDirectory: dir,
    ownerEmailToUserId: ownerMap,
    existingTargets: [
      { clinicId: "clinic-a", targetType: "contact", targetId: "contact-name-only", accountName: "Same Name Only" },
    ],
  });

  const duplicateEmailRow = result.records.find((record) => record.sourceRecordId === "scoro-lead-001");
  const duplicateIdRows = result.records.filter((record) => record.sourceRecordId === "scoro-lead-002");
  const nameOnlyRow = result.records.find((record) => record.rawRow.account_name === "Same Name Only");

  assert.equal(duplicateEmailRow?.warnings.includes("source_duplicate_email"), true);
  assert.equal(duplicateEmailRow?.warnings.includes("source_duplicate_phone"), true);
  assert.equal(duplicateIdRows.every((record) => record.quarantineReasons.includes("duplicate_scoro_id")), true);
  assert.equal(nameOnlyRow?.warnings.includes("name_similarity_only"), true);
  assert.notEqual(nameOnlyRow?.mappedTargetId, "contact-name-only");
});

test("Scoro dry-run quarantines invalid fields, unsupported owners and ambiguous strong matches", () => {
  const dir = writeScoroFixtureSet({
    leads: [
      validLead("", { scoro_exported_at: "not-a-date" }),
      validLead("scoro-lead-invalid-enum", { lead_status: "surprise", owner_email: "unknown@example.com" }),
      validLead("scoro-lead-ambiguous"),
    ],
    clients: [
      validClient("scoro-client-invalid-money", { monthly_price: "not-money" }),
    ],
  });
  const result = runScoroImportDryRun({
    clinicId: "clinic-a",
    inputDirectory: dir,
    ownerEmailToUserId: ownerMap,
    existingTargets: [
      { clinicId: "clinic-a", targetType: "contact", targetId: "contact-a", email: "alex@exampledental.co.uk" },
      { clinicId: "clinic-a", targetType: "contact", targetId: "contact-b", email: "alex@exampledental.co.uk" },
    ],
  });

  assert.equal(result.records.some((record) => record.quarantineReasons.includes("missing_source_id")), true);
  assert.equal(result.records.some((record) => record.quarantineReasons.includes("invalid_date")), true);
  assert.equal(result.records.some((record) => record.quarantineReasons.includes("invalid_enum")), true);
  assert.equal(result.records.some((record) => record.quarantineReasons.includes("invalid_money")), true);
  assert.equal(result.records.some((record) => record.quarantineReasons.includes("unsupported_owner_mapping")), true);
  assert.equal(result.records.some((record) => record.quarantineReasons.includes("ambiguous_strong_match")), true);
});

test("Scoro dry-run validates related record mapping and cross-tenant source relationships", () => {
  const dir = writeScoroFixtureSet({
    tasks: [
      validTask("scoro-task-valid", { related_scoro_id: "scoro-lead-001" }),
      validTask("scoro-task-missing", { related_scoro_id: "scoro-lead-missing" }),
      validTask("scoro-task-cross-tenant", { related_scoro_id: "scoro-lead-external" }),
    ],
  });
  const result = runScoroImportDryRun({
    clinicId: "clinic-a",
    inputDirectory: dir,
    ownerEmailToUserId: ownerMap,
    existingSourceRecords: [
      {
        clinicId: "clinic-b",
        sourceEntity: "lead",
        sourceRecordId: "scoro-lead-external",
        targetType: "contact",
        targetId: "contact-external",
      },
    ],
  });

  assert.equal(result.records.find((record) => record.sourceRecordId === "scoro-task-valid")?.relatedSourceIdentity, "scoro:lead:scoro-lead-001");
  assert.equal(result.records.find((record) => record.sourceRecordId === "scoro-task-missing")?.quarantineReasons.includes("unresolved_related_scoro_id"), true);
  assert.equal(result.records.find((record) => record.sourceRecordId === "scoro-task-cross-tenant")?.quarantineReasons.includes("cross_tenant_relationship"), true);
});

test("Scoro apply planning is deterministic and supports rerun and cleanup reporting", () => {
  const dir = writeScoroFixtureSet();
  const dryRun = runScoroImportDryRun({ clinicId: "clinic-a", inputDirectory: dir, ownerEmailToUserId: ownerMap });
  const firstPlan = buildScoroApplyPlan(dryRun);
  const rerunPlan = buildScoroApplyPlan(dryRun, firstPlan.readyRecords.map((record) => record.identity?.identityKey || ""));
  const cleanup = buildScoroCleanupPlan("batch-1", [
    {
      identityKey: "scoro:lead:scoro-lead-001",
      sourceEntity: "lead",
      sourceRecordId: "scoro-lead-001",
      targetType: "contact",
      targetId: "contact-1",
    },
    {
      identityKey: "scoro:task_followup:scoro-task-001",
      sourceEntity: "task_followup",
      sourceRecordId: "scoro-task-001",
      targetType: null,
      targetId: null,
    },
  ]);

  assert.equal(firstPlan.readyRecords.length, 4);
  assert.equal(rerunPlan.readyRecords.length, 0);
  assert.equal(rerunPlan.skippedDuplicateRecords.length, 4);
  assert.equal(rerunPlan.reconciliation.skippedDuplicates, 4);
  assert.equal(cleanup.removableTargets.length, 1);
  assert.equal(cleanup.orphanedImportRecords.length, 1);
});

test("Scoro normalizers are stable for secondary matching", () => {
  assert.equal(normalizeScoroEmail("  OWNER@ExampleDental.co.uk "), "owner@exampledental.co.uk");
  assert.equal(normalizeScoroPhone("+44 (0)7700 900111"), "4407700900111");
  assert.equal(normalizeScoroDomain("https://www.exampledental.co.uk/path"), "exampledental.co.uk");
});

function writeScoroFixtureSet(overrides: Partial<Record<"leads" | "clients" | "contacts" | "tasks", Array<Record<string, string>>>> = {}) {
  const dir = mkdtempSync(resolve(tmpdir(), "scoro-import-foundation-"));
  writeCsv(resolve(dir, "scoro-leads-template.csv"), leadHeaders, overrides.leads || [validLead("scoro-lead-001")]);
  writeCsv(resolve(dir, "scoro-clients-template.csv"), clientHeaders, overrides.clients || [validClient("scoro-client-001")]);
  writeCsv(resolve(dir, "scoro-contacts-template.csv"), contactHeaders, overrides.contacts || [validContact("scoro-contact-001")]);
  writeCsv(resolve(dir, "scoro-tasks-followups-template.csv"), taskHeaders, overrides.tasks || [validTask("scoro-task-001")]);
  return dir;
}

function writeCsv(path: string, headers: string[], rows: Array<Record<string, string>>) {
  const body = rows.map((row) => headers.map((header) => csvValue(row[header] || "")).join(",")).join("\n");
  writeFileSync(path, `${headers.join(",")}\n${body}\n`);
}

function csvValue(value: string) {
  return value.includes(",") || value.includes("\"") ? `"${value.replace(/"/g, "\"\"")}"` : value;
}

const leadHeaders = [
  "scoro_record_id",
  "scoro_url",
  "scoro_exported_at",
  "account_name",
  "contact_first_name",
  "contact_last_name",
  "email",
  "phone",
  "website",
  "location",
  "first_source",
  "latest_source",
  "converting_source",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "landing_page",
  "referrer",
  "form_submitted",
  "cta_clicked",
  "lead_status",
  "pipeline_stage",
  "package_interest",
  "recommended_package",
  "owner_email",
  "last_contact_at",
  "follow_up_due_at",
  "contact_attempts",
  "can_email",
  "can_call",
  "can_whatsapp_message",
  "do_not_contact",
  "permission_source",
  "notes",
];

const clientHeaders = [
  "scoro_record_id",
  "scoro_url",
  "scoro_exported_at",
  "account_name",
  "website",
  "city",
  "country",
  "client_type",
  "current_package",
  "recommended_next_package",
  "monthly_price",
  "setup_fee",
  "currency",
  "client_status",
  "contract_status",
  "payment_status",
  "invoice_status",
  "contract_start_date",
  "renewal_notice_date",
  "client_owner_email",
  "main_drive_folder_url",
  "notes",
];

const contactHeaders = [
  "scoro_record_id",
  "scoro_url",
  "scoro_exported_at",
  "account_name",
  "first_name",
  "last_name",
  "role",
  "email",
  "phone",
  "can_email",
  "can_call",
  "can_whatsapp_message",
  "unsubscribed",
  "do_not_contact",
  "permission_source",
  "opt_in_at",
  "opt_out_at",
  "notes",
];

const taskHeaders = [
  "scoro_record_id",
  "scoro_url",
  "scoro_exported_at",
  "related_type",
  "related_scoro_id",
  "related_account_name",
  "related_email",
  "title",
  "description",
  "owner_email",
  "due_date",
  "priority",
  "status",
  "category",
  "follow_up_type",
  "notes",
];

function validLead(id: string, override: Record<string, string> = {}) {
  return {
    scoro_record_id: id,
    scoro_url: "https://scoro.example.com/leads/001",
    scoro_exported_at: "2026-07-29T09:00:00Z",
    account_name: "Example Dental Studio",
    contact_first_name: "Alex",
    contact_last_name: "Rivers",
    email: "alex@exampledental.co.uk",
    phone: "+447700900111",
    website: "https://exampledental.co.uk",
    location: "Manchester",
    first_source: "scoro_import",
    latest_source: "scoro_import",
    converting_source: "website",
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "growth-score",
    landing_page: "https://clinicgrower.com/growth-score",
    referrer: "https://google.com",
    form_submitted: "Clinic Growth Score",
    cta_clicked: "Get Free Growth Score",
    lead_status: "new",
    pipeline_stage: "Discovery booked",
    package_interest: "Clinic Growth Score",
    recommended_package: "Growth Diagnostic",
    owner_email: "sales@clinicgrower.com",
    last_contact_at: "2026-07-27T10:30:00Z",
    follow_up_due_at: "2026-07-30T09:30:00Z",
    contact_attempts: "1",
    can_email: "true",
    can_call: "true",
    can_whatsapp_message: "true",
    do_not_contact: "false",
    permission_source: "website_form",
    notes: "Imported from Scoro lead export",
    ...override,
  };
}

function validClient(id: string, override: Record<string, string> = {}) {
  return {
    scoro_record_id: id,
    scoro_url: "https://scoro.example.com/clients/001",
    scoro_exported_at: "2026-07-29T09:00:00Z",
    account_name: "Example Dental Studio",
    website: "https://exampledental.co.uk",
    city: "Manchester",
    country: "UK",
    client_type: "Single Location",
    current_package: "Performance OS",
    recommended_next_package: "Growth Engine",
    monthly_price: "995",
    setup_fee: "0",
    currency: "GBP",
    client_status: "active",
    contract_status: "signed",
    payment_status: "active",
    invoice_status: "current",
    contract_start_date: "2026-06-01",
    renewal_notice_date: "2026-11-01",
    client_owner_email: "delivery@clinicgrower.com",
    main_drive_folder_url: "https://drive.google.com/drive/folders/exampleFolderId",
    notes: "Imported from Scoro client export",
    ...override,
  };
}

function validContact(id: string, override: Record<string, string> = {}) {
  return {
    scoro_record_id: id,
    scoro_url: "https://scoro.example.com/contacts/001",
    scoro_exported_at: "2026-07-29T09:00:00Z",
    account_name: "Example Dental Studio",
    first_name: "Alex",
    last_name: "Rivers",
    role: "Owner",
    email: "alex@exampledental.co.uk",
    phone: "+447700900111",
    can_email: "true",
    can_call: "true",
    can_whatsapp_message: "true",
    unsubscribed: "false",
    do_not_contact: "false",
    permission_source: "scoro_import",
    opt_in_at: "2026-07-10T09:00:00Z",
    opt_out_at: "",
    notes: "Primary commercial contact",
    ...override,
  };
}

function validTask(id: string, override: Record<string, string> = {}) {
  return {
    scoro_record_id: id,
    scoro_url: "https://scoro.example.com/tasks/001",
    scoro_exported_at: "2026-07-29T09:00:00Z",
    related_type: "lead",
    related_scoro_id: "scoro-lead-001",
    related_account_name: "Example Dental Studio",
    related_email: "alex@exampledental.co.uk",
    title: "Follow up on Growth Score request",
    description: "Call after audit request",
    owner_email: "sales@clinicgrower.com",
    due_date: "2026-07-30",
    priority: "high",
    status: "open",
    category: "follow_up",
    follow_up_type: "call",
    notes: "Imported from Scoro task export",
    ...override,
  };
}
