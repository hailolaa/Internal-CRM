import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { v4 as uuidv4 } from "uuid";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { backgroundJobDefinitions } from "../modules/background-jobs/background-jobs.definitions.js";
import { generateToken, hashPassword } from "../utils/helpers.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

async function createUserWithPermissions(clinicId: string, prefix: string, permissions: string[]) {
  const roleId = uuidv4();
  const userId = uuidv4();
  const roleName = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const email = `${roleName.toLowerCase()}@test.com`;

  await pool.execute("INSERT INTO role (id, clinic_id, name, description) VALUES (?, ?, ?, ?)", [
    roleId,
    clinicId,
    roleName,
    prefix,
  ]);
  if (permissions.length > 0) {
    const placeholders = permissions.map(() => "?").join(", ");
    await pool.execute(
      `INSERT IGNORE INTO role_permission (role_id, permission_id)
       SELECT ?, id FROM permission WHERE key_name IN (${placeholders})`,
      [roleId, ...permissions],
    );
  }
  await pool.execute(
    `INSERT INTO user
      (id, clinic_id, email, password_hash, first_name, last_name, role, email_verified_at, status, is_active)
     VALUES (?, ?, ?, ?, ?, 'Reviewer', ?, CURRENT_TIMESTAMP, 'active', 1)`,
    [userId, clinicId, email, await hashPassword("password123"), prefix, roleName],
  );
  await pool.execute(
    "INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary) VALUES (?, ?, ?, 'active', 1)",
    [userId, clinicId, roleName],
  );

  return { userId, roleId, token: generateToken({ userId, clinicId, role: roleName, email }) };
}

async function requestJson(baseUrl: string, path: string, token: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload: any = await response.json();
  return { response, body: payload };
}

async function seedBriefingData(clinicId: string, userId: string, briefDate: string) {
  const profileId = uuidv4();
  const contactId = uuidv4();
  const pipelineId = uuidv4();
  const stageId = uuidv4();
  const dealId = uuidv4();
  const proposalId = uuidv4();
  const appointmentId = uuidv4();

  await pool.execute(
    `INSERT INTO client_account_profile
      (id, clinic_id, account_manager_id, active_services, onboarding_status, health_status, client_status,
       current_package, churn_risk, contract_status, key_notes, payment_status, invoice_status, payment_notes, created_by, updated_by)
     VALUES (?, ?, ?, CAST(? AS JSON), 'in_progress', 'critical', 'active',
       'Clinic Growth', 'critical', 'active', 'Board-level retention risk.', 'overdue', 'overdue', 'Invoice is overdue.', ?, ?)`,
    [profileId, clinicId, userId, JSON.stringify(["ppc", "seo"]), userId, userId],
  );

  await pool.execute(
    `INSERT INTO contact
      (id, clinic_id, first_name, last_name, email, phone, status, lead_status, source, value,
       sla_target_minutes, sla_deadline_at, first_response_at, sla_breached_at)
     VALUES (?, ?, 'Ada', 'Lead', 'ada.lead@example.com', '07700999111', 'lead', 'new', 'website', 12000,
       15, DATE_SUB(NOW(), INTERVAL 30 MINUTE), NULL, NOW())`,
    [contactId, clinicId],
  );

  await pool.execute(
    "INSERT INTO pipeline (id, clinic_id, name, description, stages) VALUES (?, ?, 'Executive Brief Test Pipeline', 'Test pipeline', CAST(? AS JSON))",
    [pipelineId, clinicId, JSON.stringify(["New", "Proposal"])],
  );
  await pool.execute(
    "INSERT INTO pipeline_stage (id, clinic_id, pipeline_id, name, position, created_by) VALUES (?, ?, ?, 'New', 1, ?)",
    [stageId, clinicId, pipelineId, userId],
  );
  await pool.execute(
    `INSERT INTO deal
      (id, clinic_id, contact_id, pipeline_id, pipeline_stage_id, title, value, stage, status, source, created_by)
     VALUES (?, ?, ?, ?, ?, 'Undated implant campaign opportunity', 25000, 'New', 'open', 'website', ?)`,
    [dealId, clinicId, contactId, pipelineId, stageId, userId],
  );
  await pool.execute(
    `INSERT INTO proposal
      (id, clinic_id, contact_id, deal_id, client_account_profile_id, proposal_name, template_key, status, value, owner_id, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, 'Blocked V19 proposal', 'clinicgrower_v5', 'ready', 1995, ?, ?, ?)`,
    [proposalId, clinicId, contactId, dealId, profileId, userId, userId, userId],
  );
  await pool.execute(
    `INSERT INTO appointment
      (id, clinic_id, contact_id, date_time, status, appointment_type, treatment, value, created_by)
     VALUES (?, ?, ?, ?, 'Scheduled', 'consult', 'Implants', 1500, ?)`,
    [appointmentId, clinicId, contactId, `${briefDate} 10:00:00`, userId],
  );

  const taskRows: Array<[string, string, string, string]> = [
    ["Buyer confirmation overdue", "buyer_commitment", "high", "Signed brief still needs client confirmation."],
    ["QA evidence overdue", "delivery_qa", "high", "Delivery QA evidence needs final review."],
    ["Release blocked by verification", "release_blocker", "high", "Production verification is blocked."],
    ["Max decision on budget", "max_decision", "high", "Needs Max decision before proceeding."],
  ];
  for (const [title, category, priority, description] of taskRows) {
    await pool.execute(
      `INSERT INTO task
        (id, clinic_id, is_internal, title, description, priority, status, category, due_date,
         assigned_to, assigned_user_id, created_by, needs_qa, approval_status)
       VALUES (?, ?, 1, ?, ?, ?, 'pending', ?, ?, 'Haile Michael', ?, ?, 1, 'pending')`,
      [uuidv4(), clinicId, title, description, priority, category, briefDate, userId, userId] as any[],
    );
  }

  return { profileId, contactId, pipelineId, stageId, dealId, proposalId, appointmentId };
}

async function closeServer(server: ReturnType<typeof app.listen>) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

test("Daily executive briefing is source-backed, idempotent, permissioned and tenant-scoped", async () => {
  await testConnection();

  const briefDate = "2026-08-27";
  const primary = await createTestClinicAndAdmin("ExecutiveBriefPrimary");
  const secondary = await createTestClinicAndAdmin("ExecutiveBriefSecondary");
  const reporter = await createUserWithPermissions(primary.clinicId, "ExecutiveBriefReporter", ["reports:read"]);
  const denied = await createUserWithPermissions(primary.clinicId, "ExecutiveBriefDenied", []);
  await seedBriefingData(primary.clinicId, primary.userId, briefDate);

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to start Executive Briefing test server");
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    assert.ok(
      backgroundJobDefinitions.some((job) => job.id === "daily-executive-briefing" && job.schedule === "Daily 07:15"),
      "Daily briefing background job should be registered",
    );

    const generated = await requestJson(baseUrl, "/api/ai/executive-briefing/daily", reporter.token, { briefDate });
    assert.equal(generated.response.status, 201);
    assert.equal(generated.body.data.dataContract, "daily_executive_brief_v1");
    assert.equal(generated.body.data.briefDate, briefDate);
    assert.equal(generated.body.data.delivery.channel, "in_app");
    assert.equal(generated.body.data.actionPolicy.consequentialActionsRequireHumanApproval, true);

    const sections = new Map(generated.body.data.sections.map((section: any) => [section.key, section]));
    for (const key of [
      "active_clients",
      "cash_aged_debt",
      "new_leads_sla_followups",
      "todays_meetings",
      "overdue_buyer_commitments",
      "proposal_blockers",
      "undated_opportunities",
      "at_risk_clients",
      "campaign_data_health_incidents",
      "overdue_delivery_qa",
      "staff_blockers_workload",
      "releases_blockers",
      "max_decisions",
    ]) {
      assert.ok(sections.has(key), `${key} section should exist`);
    }

    assert.equal((sections.get("active_clients") as any).count, 1);
    assert.equal((sections.get("cash_aged_debt") as any).count, 1);
    assert.equal((sections.get("new_leads_sla_followups") as any).count, 1);
    assert.equal((sections.get("todays_meetings") as any).count, 1);
    assert.equal((sections.get("proposal_blockers") as any).count, 1);
    assert.equal((sections.get("undated_opportunities") as any).count, 1);
    assert.equal((sections.get("max_decisions") as any).count, 1);
    assert.equal(generated.body.data.highestValueActions.length, 3);
    assert.equal(
      generated.body.data.highestValueActions.every((action: any) => action.requiresHumanApproval === true),
      true,
    );

    const duplicate = await requestJson(baseUrl, "/api/ai/executive-briefing/daily", reporter.token, { briefDate });
    assert.equal(duplicate.response.status, 200);
    assert.equal(duplicate.body.data.id, generated.body.data.id);
    assert.equal(duplicate.body.data.duplicate, true);

    const [runRows]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM ai_run WHERE clinic_id = ? AND agent_key = 'daily_executive_briefing'",
      [primary.clinicId],
    );
    assert.equal(Number(runRows[0].count), 1);

    const deniedResponse = await requestJson(baseUrl, "/api/ai/executive-briefing/daily", denied.token, { briefDate });
    assert.equal(deniedResponse.response.status, 403);

    const secondaryResponse = await requestJson(baseUrl, "/api/ai/executive-briefing/daily", secondary.token, { briefDate });
    assert.equal(secondaryResponse.response.status, 201);
    const secondarySections = new Map(secondaryResponse.body.data.sections.map((section: any) => [section.key, section]));
    assert.equal((secondarySections.get("active_clients") as any).status, "data_gap");
    assert.equal((secondarySections.get("cash_aged_debt") as any).count, 0);
    assert.equal(JSON.stringify(secondaryResponse.body.data).includes("Blocked V19 proposal"), false);
  } finally {
    await closeServer(server);
    await pool.execute("DELETE FROM audit_log WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM ai_run WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM proposal WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM task WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM appointment WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM deal WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM pipeline_stage WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM pipeline WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM contact WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM client_account_profile WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM clinic_membership WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM role_permission WHERE role_id IN (?, ?)", [reporter.roleId, denied.roleId]);
    await pool.execute("DELETE FROM user WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM role WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM clinic WHERE id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.end();
  }
});
