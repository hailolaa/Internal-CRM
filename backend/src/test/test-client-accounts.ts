import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";
import { hashPassword } from "../utils/helpers.js";
import clientAccountsRoutes from "../modules/client-accounts/client-accounts.routes.js";
import errorHandler from "../middleware/errorHandler.js";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
}

async function createClinicAndAdmin(prefix: string) {
  const result = await authService.registerClinic({
    clinicName: `${prefix} Clinic`,
    adminEmail: uniqueEmail(`${prefix}_admin`),
    adminPassword: "password123",
    firstName: prefix,
    lastName: "Admin",
    phone: "555-0100",
  });

  return {
    clinicId: result.user.clinicId,
    userId: result.user.id,
    token: result.tokens.token,
  };
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

function parseDbJsonArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (Buffer.isBuffer(value)) return JSON.parse(value.toString("utf8"));
  if (typeof value === "string") return JSON.parse(value);
  return value;
}

function parseDbJsonObject(value: unknown) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return JSON.parse(value.toString("utf8"));
  if (typeof value === "string") return JSON.parse(value);
  return value as Record<string, any>;
}

test("client account profile API is permission protected, updateable, audited, and separate from legacy contact data", async () => {
  await testConnection();

  const admin = await createClinicAndAdmin("ClientAccountProfile");
  const limitedUser = await createInternalViewerUser(admin.clinicId, "ClientAccountProfile");
  const expressModule = await import("express") as any;
  const express = expressModule.default;
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/client-accounts", clientAccountsRoutes);
  testApp.use(errorHandler);

  const server = testApp.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start client account test server");
  }

  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    const forbidden = await fetchJson(baseUrl, "/api/client-accounts/profile", limitedUser.token);
    assert.equal(forbidden.response.status, 403);

    const initial = await fetchJson(baseUrl, "/api/client-accounts/profile", admin.token);
    assert.equal(initial.response.status, 200);
    assert.equal(initial.body.status, "success");
    assert.equal(initial.body.data.clinicId, admin.clinicId);
    assert.equal(initial.body.data.accountManager, null);
    assert.deepEqual(initial.body.data.activeServices, []);
    assert.equal(Object.prototype.hasOwnProperty.call(initial.body.data, "contactId"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(initial.body.data, "patient"), false);

    const initialList = await fetchJson(baseUrl, "/api/client-accounts", admin.token);
    assert.equal(initialList.response.status, 200);
    const accountSummary = initialList.body.data.find(
      (account: any) => account.clinicId === admin.clinicId,
    );
    assert.ok(accountSummary, "Client account list should include the current clinic");
    assert.equal(accountSummary.activeServiceCount, 0);
    assert.equal(accountSummary.pendingTaskCount, 0);
    assert.equal(accountSummary.overdueTaskCount, 0);
    assert.equal(accountSummary.missedTaskCount, 0);
    assert.equal(accountSummary.actionPlanId, null);
    assert.equal(accountSummary.actionPlanMonth, null);
    assert.equal(accountSummary.actionPlanStatus, null);
    assert.equal(accountSummary.actionPlanTotalItems, 0);
    assert.equal(accountSummary.actionPlanCompletedItems, 0);
    assert.equal(accountSummary.actionPlanOpenItems, 0);
    assert.equal(accountSummary.actionPlanHighPriorityOpenItems, 0);
    assert.equal(accountSummary.actionPlanProgressPercent, 0);
    assert.equal(accountSummary.actionPlanLastUpdatedAt, null);

    const updatePayload = {
      accountManagerId: admin.userId,
      activeServices: ["ppc", "seo", "strategy"],
      onboardingStatus: "in_progress",
      healthStatus: "healthy",
      churnRisk: "low",
      renewalDate: "2026-12-31",
      contractStatus: "active",
      keyNotes: "Quarterly review scheduled",
    };

    const updated = await fetchJson(baseUrl, "/api/client-accounts/profile", admin.token, {
      method: "PATCH",
      body: JSON.stringify(updatePayload),
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.status, "success");
    assert.equal(updated.body.data.accountManager.id, admin.userId);
    assert.deepEqual(updated.body.data.activeServices, ["ppc", "seo", "strategy"]);
    assert.equal(updated.body.data.onboardingStatus, "in_progress");
    assert.equal(updated.body.data.healthStatus, "healthy");
    assert.equal(updated.body.data.churnRisk, "low");
    assert.equal(updated.body.data.renewalDate, "2026-12-31");
    assert.equal(updated.body.data.contractStatus, "active");
    assert.equal(updated.body.data.keyNotes, "Quarterly review scheduled");

    const [profileRows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, active_services as activeServices
       FROM client_account_profile
       WHERE clinic_id = ?
       LIMIT 1`,
      [admin.clinicId],
    );
    assert.equal(profileRows.length, 1);
    assert.equal(profileRows[0].clinicId, admin.clinicId);
    assert.deepEqual(parseDbJsonArray(profileRows[0].activeServices), ["ppc", "seo", "strategy"]);

    const [auditRows]: any = await pool.execute(
      `SELECT action, entity_type as entityType, entity_id as entityId, changes
       FROM audit_log
       WHERE clinic_id = ?
         AND user_id = ?
         AND action = 'CLIENT_ACCOUNT_PROFILE_UPDATED'
       ORDER BY created_at DESC
       LIMIT 1`,
      [admin.clinicId, admin.userId],
    );
    assert.equal(auditRows.length, 1);
    assert.equal(auditRows[0].entityType, "client_account_profile");
    assert.equal(auditRows[0].entityId, profileRows[0].id);
    const auditChanges = parseDbJsonObject(auditRows[0].changes);
    assert.ok(auditChanges);
    assert.equal(auditChanges.healthStatus.after, "healthy");
    assert.equal(auditChanges.contractStatus.after, "active");

    console.log("[client-accounts] profile API integration test passed");

    // Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
    //  SERVICE-LEVEL CRUD TESTS
    // Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

    // Ã¢â€â‚¬Ã¢â€â‚¬ Create service Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const createServiceRes = await fetchJson(baseUrl, "/api/client-accounts/services", admin.token, {
      method: "POST",
      body: JSON.stringify({
        serviceType: "ppc",
        name: "Google Ads Management",
        status: "active",
        startDate: "2026-01-15",
        renewalDate: "2026-07-15",
        ownerId: admin.userId,
        recurringValue: "2500.00",
        currency: "USD",
        contractStatus: "active",
        notes: "Monthly PPC management",
      }),
    });
    assert.equal(createServiceRes.response.status, 201);
    assert.equal(createServiceRes.body.status, "success");
    const createdService = createServiceRes.body.data;
    assert.ok(createdService.id, "Created service should have an id");
    assert.equal(createdService.serviceType, "ppc");
    assert.equal(createdService.name, "Google Ads Management");
    assert.equal(createdService.status, "active");
    assert.equal(createdService.startDate, "2026-01-15");
    assert.equal(createdService.renewalDate, "2026-07-15");
    assert.equal(createdService.owner.id, admin.userId);
    assert.equal(createdService.recurringValue, 2500);
    assert.equal(createdService.contractStatus, "active");
    assert.equal(createdService.notes, "Monthly PPC management");
    assert.ok(createdService.clientAccountProfileId, "Service should be linked to profile");
    console.log("[client-accounts] create service passed");

    // Ã¢â€â‚¬Ã¢â€â‚¬ List services Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const listRes = await fetchJson(baseUrl, "/api/client-accounts/services", admin.token);
    assert.equal(listRes.response.status, 200);
    assert.ok(
      listRes.body.data.some((s: any) => s.id === createdService.id),
      "Created service should appear in service list",
    );
    console.log("[client-accounts] list services passed");

    // Ã¢â€â‚¬Ã¢â€â‚¬ Update service Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const updateServiceRes = await fetchJson(
      baseUrl,
      `/api/client-accounts/services/${createdService.id}`,
      admin.token,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: "Google Ads Premium Management",
          recurringValue: "3500.00",
          renewalDate: "2027-01-15",
        }),
      },
    );
    assert.equal(updateServiceRes.response.status, 200);
    assert.equal(updateServiceRes.body.data.name, "Google Ads Premium Management");
    assert.equal(updateServiceRes.body.data.recurringValue, 3500);
    assert.equal(updateServiceRes.body.data.renewalDate, "2027-01-15");
    assert.equal(updateServiceRes.body.data.serviceType, "ppc", "Unchanged fields should persist");
    console.log("[client-accounts] update service passed");

    // Ã¢â€â‚¬Ã¢â€â‚¬ Create a second service for filtering tests Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const secondServiceRes = await fetchJson(baseUrl, "/api/client-accounts/services", admin.token, {
      method: "POST",
      body: JSON.stringify({
        serviceType: "seo",
        name: "SEO Campaign",
        status: "active",
        contractStatus: "trial",
      }),
    });
    assert.equal(secondServiceRes.response.status, 201);

    // Ã¢â€â‚¬Ã¢â€â‚¬ Contract status filter Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const filterActive = await fetchJson(
      baseUrl,
      "/api/client-accounts/services?contractStatus=active",
      admin.token,
    );
    assert.ok(
      filterActive.body.data.some((s: any) => s.id === createdService.id),
      "Active contract filter should include PPC service",
    );
    assert.ok(
      !filterActive.body.data.some((s: any) => s.id === secondServiceRes.body.data.id),
      "Active contract filter should exclude trial SEO service",
    );
    console.log("[client-accounts] contract status filter passed");

    const renewalFilter = await fetchJson(
      baseUrl,
      "/api/client-accounts/services?renewalFrom=2027-01-01&renewalTo=2027-01-31",
      admin.token,
    );
    assert.ok(
      renewalFilter.body.data.some((s: any) => s.id === createdService.id),
      "Renewal date filter should include the January 2027 service",
    );
    assert.ok(
      !renewalFilter.body.data.some((s: any) => s.id === secondServiceRes.body.data.id),
      "Renewal date filter should exclude services outside the date range",
    );
    console.log("[client-accounts] renewal date filter passed");

    // Ã¢â€â‚¬Ã¢â€â‚¬ Archive service Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const archiveRes = await fetchJson(
      baseUrl,
      `/api/client-accounts/services/${createdService.id}/archive`,
      admin.token,
      { method: "POST" },
    );
    assert.equal(archiveRes.response.status, 200);

    // Ã¢â€â‚¬Ã¢â€â‚¬ Archived hidden from active list Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const afterArchiveList = await fetchJson(baseUrl, "/api/client-accounts/services", admin.token);
    assert.ok(
      !afterArchiveList.body.data.some((s: any) => s.id === createdService.id),
      "Archived service should NOT appear in default service list",
    );
    console.log("[client-accounts] archived service hidden from active list passed");

    // Ã¢â€â‚¬Ã¢â€â‚¬ Archived visible with includeArchived=true Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const withArchivedList = await fetchJson(
      baseUrl,
      "/api/client-accounts/services?includeArchived=true",
      admin.token,
    );
    const archivedService = withArchivedList.body.data.find((s: any) => s.id === createdService.id);
    assert.ok(archivedService, "Archived service should appear when includeArchived=true");
    assert.equal(archivedService.status, "archived");
    assert.ok(archivedService.archivedAt, "archivedAt should be set");
    console.log("[client-accounts] archived service visible with includeArchived passed");

    // Ã¢â€â‚¬Ã¢â€â‚¬ Archived service cannot be updated Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const updateArchivedRes = await fetchJson(
      baseUrl,
      `/api/client-accounts/services/${createdService.id}`,
      admin.token,
      {
        method: "PATCH",
        body: JSON.stringify({ name: "Should fail" }),
      },
    );
    assert.equal(updateArchivedRes.response.status, 400);
    console.log("[client-accounts] archived service update blocked passed");

    // Ã¢â€â‚¬Ã¢â€â‚¬ Service audit events Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const [serviceAuditRows]: any = await pool.execute(
      `SELECT action FROM audit_log
       WHERE clinic_id = ? AND entity_type = 'client_account_service' AND entity_id = ?
       ORDER BY created_at ASC`,
      [admin.clinicId, createdService.id],
    );
    const serviceActions = serviceAuditRows.map((r: any) => r.action);
    assert.ok(serviceActions.includes("CLIENT_ACCOUNT_SERVICE_CREATED"), "Audit should include CLIENT_ACCOUNT_SERVICE_CREATED");
    assert.ok(serviceActions.includes("CLIENT_ACCOUNT_SERVICE_UPDATED"), "Audit should include CLIENT_ACCOUNT_SERVICE_UPDATED");
    assert.ok(serviceActions.includes("CLIENT_ACCOUNT_SERVICE_ARCHIVED"), "Audit should include CLIENT_ACCOUNT_SERVICE_ARCHIVED");
    console.log("[client-accounts] service audit logging passed");

    // Ã¢â€â‚¬Ã¢â€â‚¬ Read-only internal viewer cannot access services Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const viewerServices = await fetchJson(baseUrl, "/api/client-accounts/services", limitedUser.token);
    assert.equal(viewerServices.response.status, 403);
    console.log("[client-accounts] read-only internal viewer blocked from services passed");

    console.log("[client-accounts] service CRUD integration test passed");
  } finally {
    // Clean up service records before profile/contact cleanup
    await pool.execute(`DELETE FROM audit_log WHERE clinic_id = ? AND entity_type = 'client_account_service'`, [admin.clinicId]);
    await pool.execute(`DELETE FROM client_account_service WHERE clinic_id = ?`, [admin.clinicId]);

    await pool.execute(
      `UPDATE contact
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND email LIKE ?
         AND deleted_at IS NULL`,
      [admin.clinicId, "ClientAccountProfile_viewer_%@test.com"],
    );

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});
