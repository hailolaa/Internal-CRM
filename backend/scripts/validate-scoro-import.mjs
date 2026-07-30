import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultTemplateDir = resolve(scriptDir, "../../docs/import-templates/scoro");
const templateDir = process.argv[2] ? resolve(process.argv[2]) : defaultTemplateDir;

const templates = {
  "scoro-leads-template.csv": [
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
  ],
  "scoro-clients-template.csv": [
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
  ],
  "scoro-contacts-template.csv": [
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
  ],
  "scoro-tasks-followups-template.csv": [
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
  ],
};
const booleanHeaders = new Set([
  "can_email",
  "can_call",
  "can_whatsapp_message",
  "do_not_contact",
  "unsubscribed",
]);

let failures = 0;

for (const [filename, requiredHeaders] of Object.entries(templates)) {
  const filePath = resolve(templateDir, filename);
  if (!existsSync(filePath)) {
    console.error(`Missing template: ${filename}`);
    failures += 1;
    continue;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line.trim());
  const [headerLine = ""] = lines;
  const headers = parseCsvLine(headerLine);
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    console.error(`${filename} missing headers: ${missingHeaders.join(", ")}`);
    failures += 1;
    continue;
  }

  const recordIds = new Set();
  let fileHasErrors = false;
  for (const [rowOffset, line] of lines.slice(1).entries()) {
    const rowNumber = rowOffset + 2;
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));

    if (values.length !== headers.length) {
      console.error(`${filename}:${rowNumber} has ${values.length} columns; expected ${headers.length}`);
      fileHasErrors = true;
    }
    for (const requiredValue of ["scoro_record_id", "scoro_exported_at"]) {
      if (!row[requiredValue]) {
        console.error(`${filename}:${rowNumber} missing ${requiredValue}`);
        fileHasErrors = true;
      }
    }
    if (recordIds.has(row.scoro_record_id)) {
      console.error(`${filename}:${rowNumber} duplicates scoro_record_id ${row.scoro_record_id}`);
      fileHasErrors = true;
    }
    recordIds.add(row.scoro_record_id);
    for (const header of booleanHeaders) {
      if (row[header] && !["true", "false"].includes(row[header].toLowerCase())) {
        console.error(`${filename}:${rowNumber} has invalid ${header}; use true or false`);
        fileHasErrors = true;
      }
    }
  }

  if (fileHasErrors) {
    failures += 1;
    continue;
  }

  console.log(`${filename}: ok (${headers.length} headers, ${lines.length - 1} data rows)`);
}

if (failures > 0) {
  console.error(`Scoro import template validation failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log("Scoro import templates are ready for staging rehearsal.");

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}
