import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { v4 as uuidv4 } from "uuid";
import pool, { testConnection } from "../config/database.js";
import proposalsRoutes from "../modules/proposals/proposals.routes.js";
import errorHandler from "../middleware/errorHandler.js";
import { generateToken, hashPassword } from "../utils/helpers.js";

type TestUser = { id: string; roleId: string; token: string };

async function createUser(clinicId: string, roleName: string, permissions: string[]): Promise<TestUser> {
  const id = uuidv4();
  const roleId = uuidv4();
  const email = `${id}@proposal.test`;
  await pool.execute(
    "INSERT INTO role (id, clinic_id, name, display_name, is_system) VALUES (?, ?, ?, ?, 0)",
    [roleId, clinicId, roleName, roleName],
  );
  if (permissions.length) {
    await pool.execute(
      `INSERT INTO role_permission (role_id, permission_id)
       SELECT ?, id FROM permission WHERE key_name IN (${permissions.map(() => "?").join(", ")})`,
      [roleId, ...permissions],
    );
  }
  await pool.execute(
    `INSERT INTO user
       (id, clinic_id, email, password_hash, first_name, last_name, role, email_verified_at, status, is_active)
     VALUES (?, ?, ?, ?, 'Proposal', 'Tester', ?, CURRENT_TIMESTAMP, 'active', 1)`,
    [id, clinicId, email, await hashPassword("password123"), roleName],
  );
  await pool.execute(
    "INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary) VALUES (?, ?, ?, 'active', 1)",
    [id, clinicId, roleName],
  );
  return { id, roleId, token: generateToken({ userId: id, clinicId, role: roleName, email }) };
}

async function request(baseUrl: string, path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  return { response, body: await response.json() as any };
}

async function closeServer(server: Server) {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("proposal API enforces permissions, persists statuses, and isolates tenants", async () => {
  await testConnection();
  await pool.execute(
    `INSERT IGNORE INTO permission (id, key_name, description) VALUES
       ('perm-proposals-read', 'proposals:read', 'Read internal proposals'),
       ('perm-proposals-write', 'proposals:write', 'Create and update internal proposals')`,
  );
  const primaryClinicId = uuidv4();
  const otherClinicId = uuidv4();
  const contactId = uuidv4();
  const users: TestUser[] = [];

  await pool.execute(
    `INSERT INTO clinic (id, name, email, timezone, subscription_plan, subscription_status, max_users)
     VALUES (?, 'Proposal Test', ?, 'Europe/London', 'professional', 'active', 10),
            (?, 'Other Proposal Test', ?, 'Europe/London', 'professional', 'active', 10)`,
    [primaryClinicId, `${primaryClinicId}@test.local`, otherClinicId, `${otherClinicId}@test.local`],
  );

  const writer = await createUser(primaryClinicId, `PROPOSAL_WRITER_${Date.now()}`, ["proposals:read", "proposals:write"]);
  const contactsOnly = await createUser(primaryClinicId, `CONTACT_WRITER_${Date.now()}`, ["contacts:read", "contacts:write"]);
  const otherWriter = await createUser(otherClinicId, `OTHER_PROPOSAL_WRITER_${Date.now()}`, ["proposals:read", "proposals:write"]);
  users.push(writer, contactsOnly, otherWriter);

  await pool.execute(
    `INSERT INTO contact (id, clinic_id, first_name, last_name, email, status, lead_status, source)
     VALUES (?, ?, 'Week', 'Two', ?, 'lead', 'qualified', 'referral')`,
    [contactId, primaryClinicId, `${contactId}@test.local`],
  );

  const expressModule = await import("express") as any;
  const app = expressModule.default();
  app.use(expressModule.default.json());
  app.use("/api/proposals", proposalsRoutes);
  app.use(errorHandler);
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start proposal test server");
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    const forbidden = await request(baseUrl, "/api/proposals", contactsOnly.token);
    assert.equal(forbidden.response.status, 403, "contact permissions must not grant proposal access");

    const created = await request(baseUrl, "/api/proposals", writer.token, {
      method: "POST",
      body: JSON.stringify({
        contactId,
        proposalName: "Week 2 API proposal",
        status: "ready",
        valueCents: 125000,
        currency: "GBP",
      }),
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.data.status, "ready");
    assert.equal(created.body.data.valueCents, 125000);
    assert.ok(created.body.data.readyAt);
    const updated = await request(baseUrl, `/api/proposals/${created.body.data.id}`, writer.token, {
      method: "PATCH",
      body: JSON.stringify({ status: "follow_up_due", followUpAt: "2026-07-24T09:00:00.000Z" }),
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.data.status, "follow_up_due");
    assert.equal(updated.body.data.contactId, contactId);

    const accepted = await request(baseUrl, `/api/proposals/${created.body.data.id}/status`, writer.token, {
      method: "POST",
      body: JSON.stringify({
        status: "accepted",
        reason: "Email acceptance",
        acceptedByName: "Week Two Owner",
        acceptedByEmail: "owner@example.com",
        acceptedAt: "2026-07-25T10:00:00.000Z",
        paymentTerms: "Monthly in advance, setup due before kickoff.",
      }),
    });
    assert.equal(accepted.response.status, 200);
    assert.equal(accepted.body.data.status, "accepted");
    assert.equal(accepted.body.data.acceptanceRecord.acceptedByName, "Week Two Owner");
    assert.equal(accepted.body.data.acceptanceRecord.acceptedByEmail, "owner@example.com");
    assert.equal(accepted.body.data.acceptanceRecord.packageName, null);
    assert.equal(accepted.body.data.acceptanceRecord.monthlyFeeCents, null);
    assert.equal(accepted.body.data.acceptanceRecord.paymentTerms, "Monthly in advance, setup due before kickoff.");

    const crossTenant = await request(baseUrl, `/api/proposals/${created.body.data.id}`, otherWriter.token);
    assert.equal(crossTenant.response.status, 404);

    const archived = await request(baseUrl, `/api/proposals/${created.body.data.id}`, writer.token, { method: "DELETE" });
    assert.equal(archived.response.status, 200);
    const missing = await request(baseUrl, `/api/proposals/${created.body.data.id}`, writer.token);
    assert.equal(missing.response.status, 404);
  } finally {
    try {
      await closeServer(server);
      await pool.execute("DELETE FROM audit_log WHERE clinic_id IN (?, ?)", [primaryClinicId, otherClinicId]);
      await pool.execute("DELETE FROM activity WHERE clinic_id IN (?, ?)", [primaryClinicId, otherClinicId]);
      await pool.execute(
        "DELETE FROM task WHERE clinic_id IN (?, ?) AND (template_key LIKE 'proposal_follow_up:%' OR category = 'proposal_follow_up')",
        [primaryClinicId, otherClinicId],
      );
      await pool.execute("DELETE FROM proposal_acceptance_record WHERE clinic_id IN (?, ?)", [primaryClinicId, otherClinicId]);
      await pool.execute("DELETE FROM proposal WHERE clinic_id IN (?, ?)", [primaryClinicId, otherClinicId]);
      await pool.execute("DELETE FROM contact WHERE id = ?", [contactId]);
      for (const user of users) {
        await pool.execute("DELETE FROM clinic_membership WHERE user_id = ?", [user.id]);
        await pool.execute("DELETE FROM user WHERE id = ?", [user.id]);
        await pool.execute("DELETE FROM role_permission WHERE role_id = ?", [user.roleId]);
        await pool.execute("DELETE FROM role WHERE id = ?", [user.roleId]);
      }
      await pool.execute("DELETE FROM clinic WHERE id IN (?, ?)", [primaryClinicId, otherClinicId]);
    } finally {
      await pool.end();
    }
  }
});
