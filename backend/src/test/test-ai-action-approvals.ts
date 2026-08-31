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

  await pool.execute(
    "INSERT INTO role (id, clinic_id, name, description) VALUES (?, ?, ?, ?)",
    [roleId, clinicId, roleName, prefix],
  );
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

async function closeServer(server: ReturnType<typeof app.listen>) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

test("AI action approvals queue, review and commit post-call actions safely", async () => {
  await testConnection();

  const primary = await createTestClinicAndAdmin("AiActionApprovalPrimary");
  const secondary = await createTestClinicAndAdmin("AiActionApprovalSecondary");
  const writer = await createUserWithPermissions(primary.clinicId, "AiActionWriter", ["settings:write"]);
  const reviewer = await createUserWithPermissions(primary.clinicId, "AiActionReviewer", ["ai_actions:review"]);
  const denied = await createUserWithPermissions(primary.clinicId, "AiActionDenied", []);

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to start AI action approval test server");
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  const idempotencyKey = `post-call:${uuidv4()}`;
  const proposedPayload = {
    target: { type: "contact", id: "contact-001" },
    changes: { nextAction: "Call back after treatment-priority review" },
  };

  try {
    const queued = await requestJson(baseUrl, "/api/ai/action-approvals", writer.token, {
      method: "POST",
      body: JSON.stringify({
        sourceType: "post_call",
        sourceRecordId: "call-001",
        actionType: "create_follow_up_task",
        title: "Create follow-up task from call",
        summary: "AI suggested a follow-up task after the discovery call.",
        proposedPayload,
        idempotencyKey,
      }),
    });
    assert.equal(queued.response.status, 201);
    assert.equal(queued.body.data.status, "pending");
    assert.equal(queued.body.data.sourceType, "post_call");

    const duplicate = await requestJson(baseUrl, "/api/ai/action-approvals", writer.token, {
      method: "POST",
      body: JSON.stringify({
        sourceType: "post_call",
        sourceRecordId: "call-001",
        actionType: "create_follow_up_task",
        title: "Create follow-up task from call",
        summary: "AI suggested a follow-up task after the discovery call.",
        proposedPayload: { changes: proposedPayload.changes, target: proposedPayload.target },
        idempotencyKey,
      }),
    });
    assert.equal(duplicate.response.status, 200);
    assert.equal(duplicate.body.data.id, queued.body.data.id);
    assert.equal(duplicate.body.data.duplicate, true);

    const duplicateConflict = await requestJson(baseUrl, "/api/ai/action-approvals", writer.token, {
      method: "POST",
      body: JSON.stringify({
        sourceType: "post_call",
        actionType: "create_follow_up_task",
        title: "Different content",
        proposedPayload: { unsafe: true },
        idempotencyKey,
      }),
    });
    assert.equal(duplicateConflict.response.status, 409);

    const deniedList = await requestJson(baseUrl, "/api/ai/action-approvals", denied.token);
    assert.equal(deniedList.response.status, 403);

    const secondaryFetch = await requestJson(baseUrl, `/api/ai/action-approvals/${queued.body.data.id}`, secondary.token);
    assert.equal(secondaryFetch.response.status, 404);

    const editedPayload = {
      target: { type: "contact", id: "contact-001" },
      changes: { nextAction: "Call back today with implant-package options" },
    };
    const edited = await requestJson(baseUrl, `/api/ai/action-approvals/${queued.body.data.id}`, reviewer.token, {
      method: "PATCH",
      body: JSON.stringify({
        title: "Create reviewed follow-up task",
        reviewNote: "Human reviewer tightened the action wording.",
        reviewedPayload: editedPayload,
      }),
    });
    assert.equal(edited.response.status, 200);
    assert.equal(edited.body.data.title, "Create reviewed follow-up task");

    const approved = await requestJson(baseUrl, `/api/ai/action-approvals/${queued.body.data.id}/approve`, reviewer.token, {
      method: "POST",
      body: JSON.stringify({ reviewNote: "Approved for commit." }),
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.body.data.status, "approved");

    const rejectedAfterApproval = await requestJson(baseUrl, `/api/ai/action-approvals/${queued.body.data.id}/reject`, reviewer.token, {
      method: "POST",
      body: JSON.stringify({ rejectionReason: "Too late." }),
    });
    assert.equal(rejectedAfterApproval.response.status, 409);

    const committed = await requestJson(baseUrl, `/api/ai/action-approvals/${queued.body.data.id}/commit`, reviewer.token, { method: "POST" });
    assert.equal(committed.response.status, 200);
    assert.equal(committed.body.data.status, "committed");
    assert.equal(typeof committed.body.data.committedPayloadHash, "string");

    const committedAgain = await requestJson(baseUrl, `/api/ai/action-approvals/${queued.body.data.id}/commit`, reviewer.token, { method: "POST" });
    assert.equal(committedAgain.response.status, 200);
    assert.equal(committedAgain.body.data.status, "committed");
    assert.equal(committedAgain.body.data.committedPayloadHash, committed.body.data.committedPayloadHash);

    const editCommitted = await requestJson(baseUrl, `/api/ai/action-approvals/${queued.body.data.id}`, reviewer.token, {
      method: "PATCH",
      body: JSON.stringify({ title: "Should not edit" }),
    });
    assert.equal(editCommitted.response.status, 409);

    const rejection = await requestJson(baseUrl, "/api/ai/action-approvals", writer.token, {
      method: "POST",
      body: JSON.stringify({
        sourceType: "post_call",
        sourceRecordId: "call-002",
        actionType: "send_sms",
        title: "Send unapproved SMS",
        proposedPayload: { body: "Unreviewed message" },
        idempotencyKey: `post-call:${uuidv4()}`,
      }),
    });
    const rejected = await requestJson(baseUrl, `/api/ai/action-approvals/${rejection.body.data.id}/reject`, reviewer.token, {
      method: "POST",
      body: JSON.stringify({ rejectionReason: "Message copy is not approved." }),
    });
    assert.equal(rejected.response.status, 200);
    assert.equal(rejected.body.data.status, "rejected");

    const detail = await requestJson(baseUrl, `/api/ai/action-approvals/${queued.body.data.id}`, reviewer.token);
    assert.equal(detail.response.status, 200);
    const eventTypes = detail.body.data.events.map((event: any) => event.eventType);
    assert.equal(eventTypes.length, 4);
    for (const eventType of ["queued", "edited", "approved", "committed"]) {
      assert.equal(eventTypes.includes(eventType), true);
    }

    const [auditRows]: any = await pool.execute(
      `SELECT action, entity_id as entityId
       FROM audit_log
       WHERE clinic_id = ? AND entity_type = 'ai_action_approval'
       ORDER BY created_at ASC`,
      [primary.clinicId],
    );
    assert.equal(auditRows.some((row: any) => row.action === "AI_ACTION_APPROVAL_QUEUED"), true);
    assert.equal(auditRows.some((row: any) => row.action === "AI_ACTION_APPROVAL_EDITED"), true);
    assert.equal(auditRows.some((row: any) => row.action === "AI_ACTION_APPROVAL_APPROVED"), true);
    assert.equal(auditRows.some((row: any) => row.action === "AI_ACTION_APPROVAL_COMMITTED"), true);

    const listCommitted = await requestJson(baseUrl, "/api/ai/action-approvals?status=committed", reviewer.token);
    assert.equal(listCommitted.response.status, 200);
    assert.equal(listCommitted.body.data.some((record: any) => record.id === queued.body.data.id), true);
  } finally {
    await closeServer(server);
    await pool.execute("DELETE FROM audit_log WHERE clinic_id IN (?, ?) AND entity_type = 'ai_action_approval'", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM ai_action_approval WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM user WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM role WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM clinic WHERE id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.end();
  }
});
