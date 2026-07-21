import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";
import { hashPassword } from "../utils/helpers.js";
import strategyLogsRoutes from "../modules/strategy-logs/strategy-logs.routes.js";
import errorHandler from "../middleware/errorHandler.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
}

async function createClinicAndAdmin(prefix: string) {
  return createTestClinicAndAdmin(prefix);
}

async function createInternalViewerUser(clinicId: string, prefix: string) {
  const { v4: uuidv4 } = await import("uuid");
  const email = uniqueEmail(`${prefix}_viewer`);
  const password = "password123";
  const userId = uuidv4();
  const passwordHash = await hashPassword(password);

  await pool.execute(
    "INSERT INTO user (id, clinic_id, email, password_hash, first_name, last_name, role, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, 'READ_ONLY', CURRENT_TIMESTAMP)",
    [userId, clinicId, email, passwordHash, prefix, "Viewer"],
  );

  await pool.execute(
    "INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary) VALUES (?, ?, 'READ_ONLY', 'active', 1)",
    [userId, clinicId],
  );

  const result = await authService.login({ email, password });

  return {
    userId: result.user.id,
    token: result.tokens.token,
  };
}
async function fetchJson(baseUrl: string, path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const body: any = await response.json();
  return { response, body };
}

async function ensureProfileRow(clinicId: string, userId: string): Promise<string> {
  const [existing]: any = await pool.execute(
    `SELECT id FROM client_account_profile WHERE clinic_id = ? LIMIT 1`,
    [clinicId],
  );
  if (existing.length > 0) return existing[0].id;

  const { v4: uuidv4 } = await import("uuid");
  const id = uuidv4();
  await pool.execute(
    `INSERT INTO client_account_profile (id, clinic_id, active_services, created_by, updated_by) VALUES (?, ?, ?, ?, ?)`,
    [id, clinicId, JSON.stringify([]), userId, userId],
  );
  return id;
}

test("strategy logs API is permission protected, filterable, archived, audited, and tenant isolated", async () => {
  await testConnection();
  console.log("[strategy-logs] database connection OK");

  const admin = await createClinicAndAdmin("StrategyLogs");
  const limitedUser = await createInternalViewerUser(admin.clinicId, "StrategyLogs");
  const profileId = await ensureProfileRow(admin.clinicId, admin.userId);

  const expressModule = (await import("express")) as any;
  const express = expressModule.default;
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/strategy-logs", strategyLogsRoutes);
  testApp.use(errorHandler);

  const server = testApp.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start strategy logs test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  let logId = "";

  try {
    const forbidden = await fetchJson(baseUrl, "/api/strategy-logs", limitedUser.token);
    assert.equal(forbidden.response.status, 403);
    console.log("[strategy-logs] read-only internal viewer blocked from strategy logs API passed");

    const createResponse = await fetchJson(baseUrl, "/api/strategy-logs", admin.token, {
      method: "POST",
      body: JSON.stringify({
        clientAccountProfileId: profileId,
        logMonth: "2026-06",
        logType: "strategy",
        meetingNotes: "Quarterly kickoff meeting",
        seoPlan: "Target 50 new keywords",
        ppcPlan: "Increase budget 20%",
        landingPagePlan: "A/B test hero section",
        kpiNotes: "Focus on conversion rate",
        decisions: "Approved SEO roadmap",
        nextActions: "Draft content calendar",
        ownerId: admin.userId,
      }),
    });
    assert.equal(createResponse.response.status, 201);
    logId = createResponse.body.data.id;
    assert.ok(logId, "API create should return an id");
    console.log("[strategy-logs] create passed");

    const filters = new URLSearchParams({
      clientAccountProfileId: profileId,
      logMonth: "2026-06",
      ownerId: admin.userId,
      logType: "strategy",
    });
    const listResponse = await fetchJson(baseUrl, `/api/strategy-logs?${filters.toString()}`, admin.token);
    assert.equal(listResponse.response.status, 200);
    const created = listResponse.body.data.find((log: any) => log.id === logId);
    assert.ok(created, "Created log should appear when filtered by client/month/owner/type");
    assert.equal(created.logMonth, "2026-06");
    assert.equal(created.logType, "strategy");
    assert.equal(created.meetingNotes, "Quarterly kickoff meeting");
    assert.equal(created.seoPlan, "Target 50 new keywords");
    assert.equal(created.ppcPlan, "Increase budget 20%");
    assert.equal(created.landingPagePlan, "A/B test hero section");
    assert.equal(created.kpiNotes, "Focus on conversion rate");
    assert.equal(created.decisions, "Approved SEO roadmap");
    assert.equal(created.nextActions, "Draft content calendar");
    assert.equal(created.ownerId, admin.userId);
    assert.equal(created.clientAccountProfileId, profileId);
    console.log("[strategy-logs] filtered list + field verification passed");

    const updateResponse = await fetchJson(baseUrl, `/api/strategy-logs/${logId}`, admin.token, {
      method: "PATCH",
      body: JSON.stringify({
        meetingNotes: "Updated notes after review",
        ppcPlan: "Decrease budget 10%",
        logType: "meeting",
      }),
    });
    assert.equal(updateResponse.response.status, 200);

    const afterUpdateResponse = await fetchJson(baseUrl, "/api/strategy-logs?logType=meeting", admin.token);
    assert.equal(afterUpdateResponse.response.status, 200);
    const updated = afterUpdateResponse.body.data.find((log: any) => log.id === logId);
    assert.ok(updated, "Updated log should still appear in list");
    assert.equal(updated.meetingNotes, "Updated notes after review");
    assert.equal(updated.ppcPlan, "Decrease budget 10%");
    assert.equal(updated.logType, "meeting");
    assert.equal(updated.seoPlan, "Target 50 new keywords", "Unchanged fields should persist");
    console.log("[strategy-logs] update passed");

    const archiveResponse = await fetchJson(baseUrl, `/api/strategy-logs/${logId}/archive`, admin.token, {
      method: "POST",
    });
    assert.equal(archiveResponse.response.status, 200);

    const afterArchiveResponse = await fetchJson(baseUrl, "/api/strategy-logs", admin.token);
    assert.equal(afterArchiveResponse.response.status, 200);
    assert.ok(
      !afterArchiveResponse.body.data.some((log: any) => log.id === logId),
      "Archived log should not appear in default list",
    );

    const withArchivedResponse = await fetchJson(baseUrl, "/api/strategy-logs?includeArchived=true", admin.token);
    assert.equal(withArchivedResponse.response.status, 200);
    const archivedLog = withArchivedResponse.body.data.find((log: any) => log.id === logId);
    assert.ok(archivedLog, "Archived log should appear when includeArchived=true");
    assert.ok(archivedLog.archivedAt, "archivedAt should be set");
    console.log("[strategy-logs] archive + hidden from active list passed");

    const [auditRows]: any = await pool.execute(
      `SELECT action FROM audit_log
       WHERE clinic_id = ? AND entity_type = 'strategy_log' AND entity_id = ?
       ORDER BY created_at ASC`,
      [admin.clinicId, logId],
    );
    const actions = auditRows.map((row: any) => row.action);
    assert.ok(actions.includes("STRATEGY_LOG_CREATED"), "Audit should include STRATEGY_LOG_CREATED");
    assert.ok(actions.includes("STRATEGY_LOG_UPDATED"), "Audit should include STRATEGY_LOG_UPDATED");
    assert.ok(actions.includes("STRATEGY_LOG_ARCHIVED"), "Audit should include STRATEGY_LOG_ARCHIVED");
    console.log("[strategy-logs] audit logging passed");

    const other = await createClinicAndAdmin("StrategyLogsOther");
    const otherResponse = await fetchJson(baseUrl, "/api/strategy-logs?includeArchived=true", other.token);
    assert.equal(otherResponse.response.status, 200);
    assert.ok(
      !otherResponse.body.data.some((log: any) => log.id === logId),
      "Other clinic should not see this clinic's strategy logs",
    );
    console.log("[strategy-logs] tenant isolation passed");
  } finally {
    await pool.execute(`DELETE FROM audit_log WHERE clinic_id = ? AND entity_type = 'strategy_log'`, [admin.clinicId]);
    await pool.execute(`DELETE FROM strategy_log WHERE clinic_id = ?`, [admin.clinicId]);
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }

  console.log("[strategy-logs] integration test completed successfully");
});
