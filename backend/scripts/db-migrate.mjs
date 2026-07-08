import "dotenv/config";
import { createHash } from "crypto";
import { existsSync } from "fs";
import { readdir, readFile } from "fs/promises";
import { basename, join } from "path";
import mysql from "mysql2/promise";

const migrationsDir = process.env.MIGRATIONS_DIR || "migrations";
const args = process.argv.slice(2);
const baselineOnly = args.includes("--baseline");
const dryRun = args.includes("--dry-run");
const statusOnly = args.includes("--status");
const repairChecksum = args.includes("--repair-checksum");
const requestedMigration = args.find((arg) => !arg.startsWith("--"));

const db = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  name: process.env.DB_NAME || "clinic_grower_crm",
  ssl: process.env.DB_SSL === "true",
  sslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
};

const callTable = "\u00a0call\u00a0";

const migrationChecks = {
  "20260520_add_email_verification.sql": {
    columns: [["user", "email_verified_at"]],
  },
  "20260520_api_keys_treatment_catalog.sql": {
    tables: ["api_key", "treatment_catalog"],
  },
  "20260520_comms_calls_deposits_competitors.sql": {
    tables: ["deposit_record", "competitor"],
    columns: [["deposit_record", "appointment_id"]],
    constraints: [["deposit_record", "fk_deposit_record_appointment"]],
  },
  "20260520_quick_win_persistence.sql": {
    tables: ["manual_spend_entry", "manual_consult_entry", "form_definition", "form_submission", "communication_sequence", "ai_project", "ai_run"],
  },
  "20260520_tasks_sops_offers_compliance.sql": {
    tables: ["task", "sop", "marketing_offer", "compliance_document", "compliance_setting"],
  },
  "20260520_treatment_plans_reports_jobs.sql": {
    tables: ["treatment_plan", "treatment_plan_item"],
  },
  "20260520_webhooks_message_templates.sql": {
    tables: ["webhook_endpoint", "message_template"],
  },
  "20260526_appointment_double_booking.sql": {
    indexes: [["appointment", "idx_appointment_clinician_slot"]],
  },
  "20260526_background_jobs_scheduler.sql": {
    tables: ["background_job_state", "background_job_run"],
  },
  "20260526_call_outcomes_notes_matching.sql": {
    columns: [[callTable, "outcome"], [callTable, "disposition"], [callTable, "outcome_updated_by"]],
    indexes: [[callTable, "idx_call_outcome"], [callTable, "idx_call_recovery"]],
    constraints: [[callTable, "fk_call_outcome_updated_by"]],
  },
  "20260526_clinician_availability.sql": {
    tables: ["clinician_availability"],
  },
  "20260526_consult_appointments.sql": {
    columns: [["appointment", "appointment_type"], ["appointment", "treatment"], ["appointment", "created_by"]],
    indexes: [["appointment", "idx_appointment_clinic_range"]],
    constraints: [["appointment", "fk_appointment_created_by"]],
  },
  "20260526_consult_outcomes.sql": {
    tables: ["manual_consult_entry"],
    columns: [["manual_consult_entry", "contact_id"], ["manual_consult_entry", "deposit_status"], ["manual_consult_entry", "lost_reason"]],
    constraints: [["manual_consult_entry", "fk_mce_contact"], ["manual_consult_entry", "fk_mce_practitioner"]],
  },
  "20260526_contact_crud_activity_fields.sql": {
    columns: [["contact", "value"], ["contact", "treatment_interests"], ["contact", "last_contact_at"]],
    indexes: [["contact", "idx_contact_status"], ["contact", "idx_contact_last_contact"]],
  },
  "20260526_manual_ad_spend_roas.sql": {
    columns: [["manual_spend_entry", "channel"], ["manual_spend_entry", "start_date"], ["manual_spend_entry", "attribution_label"]],
  },
  "20260526_pipeline_opportunities.sql": {
    tables: ["pipeline_deal_movement"],
    columns: [["deal", "pipeline_stage_id"], ["deal", "treatment"], ["deal", "lost_reason"]],
    indexes: [["deal", "idx_deal_pipeline_stage"]],
    constraints: [["deal", "fk_deal_pipeline_stage"]],
  },
  "20260526_pipeline_stages.sql": {
    tables: ["pipeline_stage"],
  },
  "20260526_role_hardening.sql": {
    rows: ["SELECT 1 FROM role WHERE id = 'role-super-admin' LIMIT 1"],
  },
  "20260526_sla_speed_to_lead.sql": {
    tables: ["clinic_sla_setting", "sla_breach"],
    columns: [["contact", "sla_target_minutes"], ["contact", "first_response_at"], ["contact", "sla_breached_at"]],
    indexes: [["contact", "idx_contact_sla_queue"]],
  },
  "20260526_treatment_catalog_revenue_fields.sql": {
    columns: [["treatment_catalog", "average_value_cents"], ["treatment_catalog", "margin_percent"], ["treatment_catalog", "is_high_ticket"]],
    indexes: [["treatment_catalog", "idx_treatment_catalog_category"], ["treatment_catalog", "idx_treatment_catalog_priority"]],
  },
  "20260526_twilio_call_webhooks.sql": {
    tables: ["call_tracking_number"],
    columns: [[callTable, "twilio_call_sid"], [callTable, "tracking_number"], [callTable, "webhook_payload"]],
    indexes: [[callTable, "uq_call_twilio_call_sid"], [callTable, "idx_call_missed"]],
  },
  "20260529_add_deposit_stripe_fields.sql": {
    columns: [["deposit_record", "stripe_session_id"], ["deposit_record", "payment_status"], ["deposit_record", "provider_response"]],
    indexes: [["deposit_record", "idx_deposit_stripe_session"], ["deposit_record", "idx_deposit_clinic_payment_status"]],
  },
  "20260529_create_clinician_availability.sql": {
    tables: ["clinician_availability"],
    columns: [["clinician_availability", "created_by"]],
  },
  "20260529_missed_call_followup.sql": {
    columns: [["sms", "call_id"], ["sms", "call_followup"], ["sms", "provider_message_id"], ["sms", "provider_error"]],
    indexes: [["sms", "idx_sms_call_id"]],
  },
  "20260529_onboarding_state.sql": {
    tables: ["onboarding_state"],
  },
  "20260601_deposit_schema_rollup.sql": {
    columns: [["deposit_record", "contact_id"], ["deposit_record", "appointment_id"], ["deposit_record", "stripe_session_id"], ["deposit_record", "payment_status"]],
    indexes: [["deposit_record", "idx_deposit_record_contact"], ["deposit_record", "idx_deposit_clinic_payment_status"]],
    constraints: [["deposit_record", "fk_deposit_record_contact"], ["deposit_record", "fk_deposit_record_appointment"]],
  },
  "20260604_client_account_profiles.sql": {
    tables: ["client_account_profile"],
    rows: ["SELECT 1 FROM permission WHERE key_name = 'client_accounts:read' LIMIT 1"],
  },
  "20260604_client_account_services.sql": {
    tables: ["client_account_service"],
  },
  "20260604_internal_delivery_tasks.sql": {
    columns: [["task", "is_internal"], ["task", "workflow_month"], ["task", "archived_at"]],
    indexes: [["task", "idx_task_internal_board"], ["task", "idx_task_assigned_user"]],
    constraints: [["task", "fk_task_assigned_user"]],
  },
  "20260604_internal_task_qa.sql": {
    columns: [["task", "needs_qa"], ["task", "approval_status"], ["task", "missed_task"], ["task", "qa_updated_at"]],
    indexes: [["task", "idx_task_internal_qa"], ["task", "idx_task_reviewer_user"]],
    constraints: [["task", "fk_task_reviewer_user"]],
  },
  "20260604_sops_kb.sql": {
    indexes: [["sop", "idx_sop_search"]],
    rows: ["SELECT 1 FROM permission WHERE key_name = 'sops:read' LIMIT 1"],
  },
  "20260604_strategy_logs.sql": {
    tables: ["strategy_log"],
    rows: ["SELECT 1 FROM permission WHERE key_name = 'strategy_logs:read' LIMIT 1"],
  },
  "20260609_insight_action_task.sql": {
    columns: [["insight", "action_task_id"]],
    indexes: [["insight", "idx_insight_action_task"]],
    constraints: [["insight", "fk_insight_action_task"]],
  },
  "20260609_clinic_memberships.sql": {
    tables: ["clinic_membership"],
    columns: [["tokens", "active_clinic_id"]],
    indexes: [["tokens", "idx_tokens_active_clinic"]],
    constraints: [["tokens", "fk_tokens_active_clinic"]],
  },
  "20260609_insights.sql": {
    tables: ["insight"],
  },
  "20260609_monthly_action_plans.sql": {
    tables: ["monthly_action_plan", "monthly_action_plan_item"],
  },
  "20260609_report_shares.sql": {
    tables: ["report_share"],
  },
  "20260627_appointment_recurrence.sql": {
    columns: [["appointment", "recurrence_rule"], ["appointment", "recurrence_series_id"], ["appointment", "recurrence_position"]],
    indexes: [["appointment", "idx_appointment_recurrence_series"]],
  },
};

if (!existsSync(migrationsDir)) {
  console.error(`Migrations directory not found: ${migrationsDir}`);
  process.exit(1);
}

const connection = await mysql.createConnection({
  host: db.host,
  port: db.port,
  user: db.user,
  password: db.password,
  database: db.name,
  multipleStatements: true,
  ...(db.ssl ? { ssl: { rejectUnauthorized: db.sslRejectUnauthorized } } : {}),
});

try {
  await ensureMigrationTable(connection);

  const migrationFiles = await listMigrationFiles();
  if (migrationFiles.length === 0) {
    console.log("No migration files found.");
    process.exit(0);
  }

  if (statusOnly || repairChecksum) {
    await reportOrRepairMigrations(connection, migrationFiles, { repairChecksum });
    process.exit(0);
  }

  let appliedCount = 0;
  let skippedCount = 0;

  for (const file of migrationFiles) {
    const filePath = join(migrationsDir, file);
    const sql = await readFile(filePath, "utf8");
    const checksum = sha256(sql);
    const existing = await getAppliedMigration(connection, file);

    if (existing) {
      if (existing.checksum_sha256 !== checksum) {
        throw new Error(
          `Migration checksum changed after apply: ${file}. Applied ${existing.checksum_sha256}, current ${checksum}.`,
        );
      }

      skippedCount += 1;
      console.log(`Skipped ${file}`);
      continue;
    }

    if (await migrationAlreadySatisfied(connection, file)) {
      if (dryRun) {
        skippedCount += 1;
        console.log(`Satisfied ${file}`);
      } else {
        await recordMigration(connection, file, checksum);
        skippedCount += 1;
        console.log(`Recorded existing ${file}`);
      }
      continue;
    }

    if (baselineOnly) {
      await recordMigration(connection, file, checksum);
      appliedCount += 1;
      console.log(`Baselined ${file}`);
      continue;
    }

    if (dryRun) {
      appliedCount += 1;
      console.log(`Pending ${file}`);
      continue;
    }

      await connection.beginTransaction();
    try {
      await connection.query(sql);
      await recordMigration(connection, file, checksum);
      await connection.commit();
      appliedCount += 1;
      console.log(`Applied ${file}`);
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }

  if (dryRun) {
    console.log(`Migration dry run complete. Pending ${appliedCount}, skipped ${skippedCount}.`);
  } else if (baselineOnly) {
    console.log(`Migration baseline complete. Baselined ${appliedCount}, skipped ${skippedCount}.`);
  } else {
    console.log(`Migration complete. Applied ${appliedCount}, skipped ${skippedCount}.`);
  }
} finally {
  await connection.end();
}

async function ensureMigrationTable(connection) {
  await connection.execute(
    `CREATE TABLE IF NOT EXISTS schema_migration (
      filename VARCHAR(255) PRIMARY KEY,
      checksum_sha256 CHAR(64) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  );
}

async function listMigrationFiles() {
  if (requestedMigration) {
    const filename = basename(requestedMigration);
    const filePath = join(migrationsDir, filename);
    if (!existsSync(filePath)) {
      console.error(`Migration file not found: ${filePath}`);
      process.exit(1);
    }
    return [filename];
  }

  return (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

async function getAppliedMigration(connection, filename) {
  const [rows] = await connection.execute(
    "SELECT filename, checksum_sha256 FROM schema_migration WHERE filename = ? LIMIT 1",
    [filename],
  );
  return rows[0] || null;
}

async function recordMigration(connection, filename, checksum) {
  await connection.execute(
    "INSERT INTO schema_migration (filename, checksum_sha256) VALUES (?, ?)",
    [filename, checksum],
  );
}

async function updateMigrationChecksum(connection, filename, checksum) {
  await connection.execute(
    "UPDATE schema_migration SET checksum_sha256 = ? WHERE filename = ?",
    [checksum, filename],
  );
}

async function reportOrRepairMigrations(connection, migrationFiles, { repairChecksum }) {
  let mismatches = 0;
  let pending = 0;
  let repaired = 0;

  for (const file of migrationFiles) {
    const filePath = join(migrationsDir, file);
    const sql = await readFile(filePath, "utf8");
    const checksum = sha256(sql);
    const existing = await getAppliedMigration(connection, file);

    if (existing) {
      if (existing.checksum_sha256 === checksum) {
        console.log(`Applied ${file}`);
        continue;
      }

      mismatches += 1;
      const satisfied = await migrationAlreadySatisfied(connection, file);
      if (repairChecksum) {
        if (!satisfied) {
          throw new Error(
            `Refusing checksum repair for ${file}: current schema/data checks are not satisfied.`,
          );
        }
        await updateMigrationChecksum(connection, file, checksum);
        repaired += 1;
        console.log(`Repaired checksum ${file}`);
      } else {
        console.log(`Checksum mismatch ${file}: applied ${existing.checksum_sha256}, current ${checksum}, satisfied=${satisfied}`);
      }
      continue;
    }

    if (await migrationAlreadySatisfied(connection, file)) {
      console.log(`Satisfied ${file}`);
      continue;
    }

    pending += 1;
    console.log(`Pending ${file}`);
  }

  if (repairChecksum) {
    console.log(`Migration checksum repair complete. Repaired ${repaired}, mismatches ${mismatches}, pending ${pending}.`);
  } else {
    console.log(`Migration status complete. Mismatches ${mismatches}, pending ${pending}.`);
  }
}

async function migrationAlreadySatisfied(connection, filename) {
  const check = migrationChecks[filename];
  if (!check) return false;

  for (const table of check.tables || []) {
    if (!(await tableExists(connection, table))) return false;
  }

  for (const [table, column] of check.columns || []) {
    if (!(await columnExists(connection, table, column))) return false;
  }

  for (const [table, index] of check.indexes || []) {
    if (!(await indexExists(connection, table, index))) return false;
  }

  for (const [table, constraint] of check.constraints || []) {
    if (!(await constraintExists(connection, table, constraint))) return false;
  }

  for (const sql of check.rows || []) {
    if (!(await rowExists(connection, sql))) return false;
  }

  return true;
}

async function tableExists(connection, table) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) as count
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [table],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function columnExists(connection, table, column) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) as count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function indexExists(connection, table, index) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) as count
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?`,
    [table, index],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function constraintExists(connection, table, constraint) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) as count
     FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?`,
    [table, constraint],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function rowExists(connection, sql) {
  const [rows] = await connection.query(sql);
  return rows.length > 0;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
