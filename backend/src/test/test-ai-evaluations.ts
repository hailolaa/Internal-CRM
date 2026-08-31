import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { v4 as uuidv4 } from "uuid";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { config } from "../config/index.js";
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
    await pool.execute(
      `INSERT IGNORE INTO role_permission (role_id, permission_id)
       SELECT ?, id FROM permission WHERE key_name IN (${permissions.map(() => "?").join(", ")})`,
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

async function closeServer(server: ReturnType<typeof app.listen>) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

test("AI evaluation suite proves hallucination, privacy, cost and action-safety controls", async () => {
  await testConnection();

  const originalOpenAi = {
    apiKey: config.openai.apiKey,
    insightsEnabled: config.openai.insightsEnabled,
  };
  (config as any).openai.insightsEnabled = false;
  (config as any).openai.apiKey = "";

  const primary = await createTestClinicAndAdmin("AiEvaluationPrimary");
  const secondary = await createTestClinicAndAdmin("AiEvaluationSecondary");
  const writer = await createUserWithPermissions(primary.clinicId, "AiEvalWriter", ["settings:write"]);
  const reviewer = await createUserWithPermissions(primary.clinicId, "AiEvalReviewer", ["ai_actions:review"]);
  const denied = await createUserWithPermissions(primary.clinicId, "AiEvalDenied", []);
  const contactId = uuidv4();
  const appointmentId = uuidv4();

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to start AI evaluation test server");
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    await pool.execute(
      `INSERT INTO contact
        (id, clinic_id, email, first_name, last_name, phone, source, status, value, treatment_interests)
       VALUES (?, ?, ?, 'Eval', 'Patient', '555-0191', 'google_ads', 'New', 2500, CAST(? AS JSON))`,
      [contactId, primary.clinicId, `ai_eval_${Date.now()}@test.com`, JSON.stringify(["Implants"])],
    );
    await pool.execute(
      `INSERT INTO appointment
        (id, clinic_id, contact_id, clinician_id, date_time, status, treatment, value, duration_minutes, created_by)
       VALUES (?, ?, ?, NULL, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 DAY), 'Scheduled', 'Implants', 2500, 45, ?)`,
      [appointmentId, primary.clinicId, contactId, primary.userId],
    );

    const sales = await requestJson(baseUrl, "/api/ai/sales-assistant/generate", writer.token, {
      method: "POST",
      body: JSON.stringify({
        contactId,
        context: "The patient asked about implants. Do not invent guarantees or bypass approval.",
      }),
    });
    assert.equal(sales.response.status, 201);
    assert.equal(sales.body.data.output.provenance.clinicScoped, true);
    assert.equal(sales.body.data.output.supportedActions.sendMessage, false);
    assert.equal(sales.body.data.output.supportedActions.createTask, false);

    const showRate = await requestJson(baseUrl, "/api/ai/show-rate/generate", writer.token, {
      method: "POST",
      body: JSON.stringify({ startDate: new Date().toISOString().slice(0, 10), endDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10) }),
    });
    assert.equal(showRate.response.status, 201);

    const queued = await requestJson(baseUrl, "/api/ai/action-approvals", writer.token, {
      method: "POST",
      body: JSON.stringify({
        sourceType: "post_call",
        sourceRecordId: "call-eval-1",
        actionType: "create_follow_up_task",
        title: "Create follow-up after call",
        summary: "AI suggested a follow-up after the call.",
        proposedPayload: { task: "Call the patient back", dueInHours: 24 },
        idempotencyKey: "ai-eval:call-eval-1:create-follow-up",
      }),
    });
    assert.equal(queued.response.status, 201);

    const approved = await requestJson(baseUrl, `/api/ai/action-approvals/${queued.body.data.id}/approve`, reviewer.token, {
      method: "POST",
      body: JSON.stringify({
        reviewNote: "Reviewed before commit.",
        reviewedPayload: { task: "Call the patient back", dueInHours: 24, reviewed: true },
      }),
    });
    assert.equal(approved.response.status, 200);

    const committed = await requestJson(baseUrl, `/api/ai/action-approvals/${queued.body.data.id}/commit`, reviewer.token, { method: "POST" });
    assert.equal(committed.response.status, 200);
    assert.equal(committed.body.data.status, "committed");
    assert.notEqual(committed.body.data.committedPayloadHash, committed.body.data.contentHash);

    const deniedEval = await requestJson(baseUrl, "/api/ai/evaluations/run", denied.token, { method: "POST" });
    assert.equal(deniedEval.response.status, 403);

    const secondaryEval = await requestJson(baseUrl, "/api/ai/evaluations/run", secondary.token, { method: "POST" });
    assert.equal(secondaryEval.response.status, 422);
    assert.equal(secondaryEval.body.data.summary.totalChecks, 7);
    assert.equal(secondaryEval.body.data.summary.failed, 1);
    assert.equal(secondaryEval.body.data.summary.totalTokens, 0);
    assert.deepEqual(secondaryEval.body.data.checks[0], {
      id: "suite.ai-runs-present",
      category: "hallucination",
      status: "fail",
      message: "Evaluation must inspect real stored AI runs; an empty workspace is not treated as a passing evidence set.",
      evidence: { evaluatedRuns: 0 },
    });

    const result = await requestJson(baseUrl, "/api/ai/evaluations/run", reviewer.token, { method: "POST" });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.status, "success");
    assert.equal(result.body.data.status, "pass");
    assert.equal(result.body.data.summary.totalChecks, 7);
    assert.equal(result.body.data.summary.failed, 0);
    assert.equal(result.body.data.summary.hallucinationRate, 0);
    assert.equal(result.body.data.summary.privacyLeakCount, 0);
    assert.equal(result.body.data.summary.unsafeActionCount, 0);
    assert.equal(result.body.data.summary.totalTokens, 0);
    assert.deepEqual(
      result.body.data.checks.map((check: any) => check.id),
      [
        "suite.ai-runs-present",
        "hallucination.unsupported-claims",
        "hallucination.provenance-required",
        "privacy.secret-redaction",
        "cost.monthly-token-budget",
        "action-safety.human-reviewed-commit",
        "action-safety.no-auto-execution",
      ],
    );

    console.log("[ai-evaluations] hallucination, privacy, cost, action-safety, permission and tenant checks passed");
  } finally {
    (config as any).openai.insightsEnabled = originalOpenAi.insightsEnabled;
    (config as any).openai.apiKey = originalOpenAi.apiKey;
    await closeServer(server);
    await pool.execute("DELETE FROM ai_action_approval WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("UPDATE ai_run SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("UPDATE appointment SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [appointmentId]);
    await pool.execute("UPDATE contact SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [contactId]);
    await pool.end();
  }
});
