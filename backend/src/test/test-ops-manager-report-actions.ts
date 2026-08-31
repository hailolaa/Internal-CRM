import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { v4 as uuidv4 } from "uuid";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
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

async function requestJson(baseUrl: string, path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body: any = await response.json();
  return { response, body };
}

async function insertMonthlyReport(clinicId: string, userId: string, overrides: Record<string, unknown> = {}) {
  const reportId = uuidv4();
  const data = {
    generatedAt: "2026-08-31T10:00:00.000Z",
    sections: {
      risks: [
        "Attribution tracking is incomplete, so campaign source coverage needs review before spend scales.",
        "Client response SLA is slipping on missed-call recovery for priority treatment enquiries.",
      ],
      recommendations: ["Assign an owner to repair the booking follow-up workflow before scaling paid search."],
    },
    ...overrides,
  };

  await pool.execute(
    `INSERT INTO report
      (id, clinic_id, name, type, description, filters, data, workflow_status, created_by)
     VALUES (?, ?, ?, 'monthly_performance', 'Monthly report used for Ops Manager action planning', CAST(? AS JSON), CAST(? AS JSON), 'approved', ?)`,
    [reportId, clinicId, "August 2026 performance report", JSON.stringify({ month: "2026-08" }), JSON.stringify(data), userId],
  );

  return reportId;
}

async function closeServer(server: ReturnType<typeof app.listen>) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

test("Ops Manager queues reviewed report actions with evidence, idempotency and tenant isolation", async () => {
  await testConnection();

  const primary = await createTestClinicAndAdmin("OpsManagerPrimary");
  const secondary = await createTestClinicAndAdmin("OpsManagerSecondary");
  const writer = await createUserWithPermissions(primary.clinicId, "OpsManagerWriter", ["reports:write", "ai_actions:review"]);
  const denied = await createUserWithPermissions(primary.clinicId, "OpsManagerDenied", []);
  const reportId = await insertMonthlyReport(primary.clinicId, primary.userId);
  const emptyReportId = await insertMonthlyReport(primary.clinicId, primary.userId, { sections: { risks: [], recommendations: [] } });

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to start Ops Manager test server");
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    const queued = await requestJson(baseUrl, `/api/reports/${reportId}/growth-actions`, writer.token, { method: "POST" });
    assert.equal(queued.response.status, 201);
    assert.equal(queued.body.data.reportId, reportId);
    assert.equal(queued.body.data.queuedCount, 3);
    assert.equal(queued.body.data.existingCount, 0);
    assert.deepEqual(
      queued.body.data.actions.map((action: any) => action.exceptionType),
      ["tracking_exception", "client_risk", "delivery_exception"],
    );
    assert.equal(
      queued.body.data.actions.every((action: any) => action.sourceEvidence.reportId === reportId && action.status === "pending"),
      true,
    );

    const [approvalRows]: any = await pool.execute(
      `SELECT action_type as actionType, source_type as sourceType, source_record_id as sourceRecordId,
              proposed_payload as proposedPayload
       FROM ai_action_approval
       WHERE clinic_id = ?
       ORDER BY created_at ASC`,
      [primary.clinicId],
    );
    assert.equal(approvalRows.length, 3);
    assert.equal(approvalRows.every((row: any) => row.sourceType === "monthly_report"), true);
    assert.equal(approvalRows.every((row: any) => row.sourceRecordId === reportId), true);
    assert.equal(approvalRows.every((row: any) => row.actionType === "create_growth_task"), true);
    const payloads = approvalRows.map((row: any) =>
      typeof row.proposedPayload === "string" ? JSON.parse(row.proposedPayload) : row.proposedPayload,
    );
    const payload = payloads.find((candidate: any) => /Attribution tracking/.test(candidate.sourceEvidence.excerpt));
    assert.equal(Boolean(payload), true);
    assert.equal(payload.dataContract, "ops_manager_report_action_v1");
    assert.equal(payload.clickUp.requiresHumanApproval, true);
    assert.equal(payload.sourceEvidence.reportMonth, "2026-08");
    assert.match(payload.sourceEvidence.excerpt, /Attribution tracking/);

    const duplicate = await requestJson(baseUrl, `/api/reports/${reportId}/growth-actions`, writer.token, { method: "POST" });
    assert.equal(duplicate.response.status, 201);
    assert.equal(duplicate.body.data.queuedCount, 0);
    assert.equal(duplicate.body.data.existingCount, 3);
    assert.equal(duplicate.body.data.actions.every((action: any) => action.duplicate === true), true);

    const [dedupeRows]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM ai_action_approval WHERE clinic_id = ? AND source_record_id = ?",
      [primary.clinicId, reportId],
    );
    assert.equal(Number(dedupeRows[0].count), 3);

    const deniedResponse = await requestJson(baseUrl, `/api/reports/${reportId}/growth-actions`, denied.token, { method: "POST" });
    assert.equal(deniedResponse.response.status, 403);

    const crossTenant = await requestJson(baseUrl, `/api/reports/${reportId}/growth-actions`, secondary.token, { method: "POST" });
    assert.equal(crossTenant.response.status, 404);

    const empty = await requestJson(baseUrl, `/api/reports/${emptyReportId}/growth-actions`, writer.token, { method: "POST" });
    assert.equal(empty.response.status, 400);

    const [auditRows]: any = await pool.execute(
      `SELECT action, entity_type as entityType, entity_id as entityId
       FROM audit_log
       WHERE clinic_id = ? AND entity_id = ?
       ORDER BY created_at ASC`,
      [primary.clinicId, reportId],
    );
    assert.equal(auditRows.some((row: any) => row.action === "OPS_MANAGER_REPORT_ACTIONS_QUEUED" && row.entityType === "report"), true);
  } finally {
    await closeServer(server);
    await pool.execute("DELETE FROM audit_log WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM ai_action_approval_event WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM ai_action_approval WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM report WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM user WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM role WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM clinic WHERE id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.end();
  }
});
