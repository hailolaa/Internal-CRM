import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";
import { hashPassword } from "../utils/helpers.js";
import sopsRoutes from "../modules/sops/sops.routes.js";
import { sopsService } from "../modules/sops/sops.service.js";
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
  const role = `NO_SOP_ACCESS_${Math.floor(Math.random() * 100000)}`;
  const passwordHash = await hashPassword(password);

  await pool.execute(
    "INSERT INTO user (id, clinic_id, email, password_hash, first_name, last_name, role, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
    [userId, clinicId, email, passwordHash, prefix, "Viewer", role],
  );

  await pool.execute(
    "INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary) VALUES (?, ?, ?, 'active', 1)",
    [userId, clinicId, role],
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

test("SOP API supports internal KB CRUD, prompt categories, visibility, search, delete, audit, and tenant isolation", async () => {
  await testConnection();
  console.log("[sops] database connection OK");

  const admin = await createClinicAndAdmin("SopsTest");
  const limitedUser = await createInternalViewerUser(admin.clinicId, "SopsTest");

  const expressModule = (await import("express")) as any;
  const express = expressModule.default;
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/sops", sopsRoutes);
  testApp.use(errorHandler);

  const server = testApp.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start SOP test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  let sopId = "";

  try {
    const forbidden = await fetchJson(baseUrl, "/api/sops", limitedUser.token);
    assert.equal(forbidden.response.status, 403);
    console.log("[sops] read-only internal viewer blocked from SOP API passed");

    const createResponse = await fetchJson(baseUrl, "/api/sops", admin.token, {
      method: "POST",
      body: JSON.stringify({
        title: "GBP Review Response Prompt",
        category: "AI Prompts",
        content: "Prompt: Write a warm, HIPAA-safe GBP review response for this clinic.",
        owner: "Strategy Team",
        status: "draft",
      }),
    });
    assert.equal(createResponse.response.status, 201);
    sopId = createResponse.body.data.id;
    assert.ok(sopId, "API create should return an id");
    console.log("[sops] create prompt-library SOP passed");

    const adminDraftList = await fetchJson(baseUrl, "/api/sops?status=draft", admin.token);
    assert.equal(adminDraftList.response.status, 200);
    const created = adminDraftList.body.data.find((sop: any) => sop.id === sopId);
    assert.ok(created, "Draft SOP should appear for an internal writer");
    assert.equal(created.title, "GBP Review Response Prompt");
    assert.equal(created.category, "AI Prompts");
    assert.equal(created.content, "Prompt: Write a warm, HIPAA-safe GBP review response for this clinic.");
    assert.equal(created.owner, "Strategy Team");
    assert.equal(created.status, "draft");
    console.log("[sops] admin draft visibility + prompt storage passed");

    const publishedOnlyBefore = await sopsService.listSops(admin.clinicId, {}, false);
    assert.ok(
      !publishedOnlyBefore.some((sop) => sop.id === sopId),
      "Read-only SOP visibility should hide draft records",
    );
    console.log("[sops] draft hidden from published-only visibility passed");

    const publishResponse = await fetchJson(baseUrl, `/api/sops/${sopId}`, admin.token, {
      method: "PATCH",
      body: JSON.stringify({ status: "published" }),
    });
    assert.equal(publishResponse.response.status, 200);

    const publishedOnlyAfter = await sopsService.listSops(admin.clinicId, {}, false);
    assert.ok(
      publishedOnlyAfter.some((sop) => sop.id === sopId),
      "Read-only SOP visibility should include published records",
    );
    console.log("[sops] published visibility rule passed");

    const searchResponse = await fetchJson(baseUrl, "/api/sops?search=HIPAA-safe", admin.token);
    assert.equal(searchResponse.response.status, 200);
    assert.ok(searchResponse.body.data.some((sop: any) => sop.id === sopId), "Search should match prompt content");

    const categoryResponse = await fetchJson(baseUrl, "/api/sops?category=AI%20Prompts", admin.token);
    assert.equal(categoryResponse.response.status, 200);
    assert.ok(categoryResponse.body.data.some((sop: any) => sop.id === sopId), "Category filter should match prompt records");

    const statusResponse = await fetchJson(baseUrl, "/api/sops?status=published", admin.token);
    assert.equal(statusResponse.response.status, 200);
    assert.ok(statusResponse.body.data.some((sop: any) => sop.id === sopId), "Status filter should match published SOP");
    console.log("[sops] search/category/status filters passed");

    const updateResponse = await fetchJson(baseUrl, `/api/sops/${sopId}`, admin.token, {
      method: "PATCH",
      body: JSON.stringify({
        title: "Updated GBP Review Response Prompt",
        category: "AI Prompts",
        content: "Prompt: Draft a concise, compliant GBP review response with the clinic voice.",
        owner: "Delivery Team",
      }),
    });
    assert.equal(updateResponse.response.status, 200);

    const afterUpdate = await fetchJson(baseUrl, "/api/sops?search=compliant", admin.token);
    assert.equal(afterUpdate.response.status, 200);
    const updated = afterUpdate.body.data.find((sop: any) => sop.id === sopId);
    assert.ok(updated, "Updated SOP should still be searchable");
    assert.equal(updated.title, "Updated GBP Review Response Prompt");
    assert.equal(updated.owner, "Delivery Team");
    console.log("[sops] update passed");

    const archiveResponse = await fetchJson(baseUrl, `/api/sops/${sopId}`, admin.token, {
      method: "PATCH",
      body: JSON.stringify({ status: "archived" }),
    });
    assert.equal(archiveResponse.response.status, 200);

    const archivedList = await fetchJson(baseUrl, "/api/sops?status=archived", admin.token);
    assert.equal(archivedList.response.status, 200);
    assert.ok(archivedList.body.data.some((sop: any) => sop.id === sopId), "Archived status should be queryable");
    console.log("[sops] archive status passed");

    const deleteResponse = await fetchJson(baseUrl, `/api/sops/${sopId}`, admin.token, { method: "DELETE" });
    assert.equal(deleteResponse.response.status, 200);

    const afterDelete = await fetchJson(baseUrl, "/api/sops?status=archived", admin.token);
    assert.equal(afterDelete.response.status, 200);
    assert.ok(
      !afterDelete.body.data.some((sop: any) => sop.id === sopId),
      "Deleted SOP should not appear in list",
    );
    console.log("[sops] soft delete passed");

    const deleteAgainResponse = await fetchJson(baseUrl, `/api/sops/${sopId}`, admin.token, { method: "DELETE" });
    assert.equal(deleteAgainResponse.response.status, 404);
    console.log("[sops] delete idempotency check passed");

    const [auditRows]: any = await pool.execute(
      `SELECT action FROM audit_log
       WHERE clinic_id = ? AND entity_type = 'sop' AND entity_id = ?
       ORDER BY created_at ASC`,
      [admin.clinicId, sopId],
    );
    const actions = auditRows.map((row: any) => row.action);
    assert.ok(actions.includes("SOP_CREATED"), "Audit should include SOP_CREATED");
    assert.ok(actions.includes("SOP_UPDATED"), "Audit should include SOP_UPDATED");
    assert.ok(actions.includes("SOP_DELETED"), "Audit should include SOP_DELETED");
    console.log("[sops] audit logging passed");

    const other = await createClinicAndAdmin("SopsOther");
    const otherResponse = await fetchJson(baseUrl, "/api/sops?status=archived", other.token);
    assert.equal(otherResponse.response.status, 200);
    assert.ok(
      !otherResponse.body.data.some((sop: any) => sop.id === sopId),
      "Other clinic should not see this clinic's SOPs",
    );
    console.log("[sops] tenant isolation passed");
  } finally {
    await pool.execute(`DELETE FROM audit_log WHERE clinic_id = ? AND entity_type = 'sop'`, [admin.clinicId]);
    await pool.execute(`DELETE FROM sop WHERE clinic_id = ?`, [admin.clinicId]);
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }

  console.log("[sops] integration test completed successfully");
});
