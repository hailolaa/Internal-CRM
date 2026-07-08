import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { v4 as uuidv4 } from "uuid";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";

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

test("command palette returns real permission-aware actions, tenant-scoped search, and clinic switch targets", async () => {
  await testConnection();
  console.log("[command-palette] database connection OK");

  const primary = await createClinicAndAdmin("CommandPalettePrimary");
  const secondary = await createClinicAndAdmin("CommandPaletteSecondary");

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start command palette test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  let primaryContactId = "";
  let secondaryContactId = "";
  const primaryReportId = uuidv4();
  const secondaryReportId = uuidv4();

  try {
    await pool.execute(
      `INSERT IGNORE INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
       VALUES (?, ?, 'SUPER_ADMIN', 'active', 0)`,
      [primary.userId, secondary.clinicId],
    );

    const primaryLead = await fetchJson(baseUrl, "/api/contacts", primary.token, {
      method: "POST",
      body: JSON.stringify({
        firstName: "Palette",
        lastName: "Primary",
        email: uniqueEmail("palette_primary"),
        status: "New",
        source: "meta_ads",
      }),
    });
    assert.equal(primaryLead.response.status, 201);
    primaryContactId = primaryLead.body.data.contact.id;

    const secondaryLead = await fetchJson(baseUrl, "/api/contacts", secondary.token, {
      method: "POST",
      body: JSON.stringify({
        firstName: "Palette",
        lastName: "Secondary",
        email: uniqueEmail("palette_secondary"),
        status: "New",
        source: "google_ads",
      }),
    });
    assert.equal(secondaryLead.response.status, 201);
    secondaryContactId = secondaryLead.body.data.contact.id;

    await pool.execute(
      `INSERT INTO report (id, clinic_id, name, type, description, created_by)
       VALUES (?, ?, ?, 'performance', ?, ?)`,
      [primaryReportId, primary.clinicId, "Palette Primary Revenue", "Primary command palette report", primary.userId],
    );
    await pool.execute(
      `INSERT INTO report (id, clinic_id, name, type, description, created_by)
       VALUES (?, ?, ?, 'performance', ?, ?)`,
      [secondaryReportId, secondary.clinicId, "Palette Secondary Revenue", "Secondary command palette report", secondary.userId],
    );

    const actionPalette = await fetchJson(baseUrl, "/api/command-palette?limit=10", primary.token);
    assert.equal(actionPalette.response.status, 200);
    assert.equal(actionPalette.body.data.actions.some((action: any) => action.id === "create_lead" && action.enabled && action.route === "/app/crm/contacts/new"), true);
    assert.equal(actionPalette.body.data.actions.some((action: any) => action.id === "log_call" && action.route === "/app/comms/calls?log=1"), true);
    assert.equal(actionPalette.body.data.actions.some((action: any) => action.id === "create_booking" && action.route === "/app/crm/calendar/new"), true);
    assert.equal(actionPalette.body.data.actions.some((action: any) => action.id === "create_task" && action.route === "/app/crm/tasks/new"), true);
    assert.equal(actionPalette.body.data.actions.some((action: any) => action.id === "search_contacts" && action.route === "/app/crm/contacts"), true);
    assert.equal(actionPalette.body.data.actions.some((action: any) => action.id === "open_reports" && action.route === "/app/reports/overview"), true);
    assert.equal(actionPalette.body.data.actions.some((action: any) => action.id === "create_booking" && action.api?.path === "/api/appointments"), true);
    assert.equal(actionPalette.body.data.actions.some((action: any) => action.id === "open_reports" && action.api?.path === "/api/reports/dashboard/summary"), true);
    assert.equal(actionPalette.body.data.commonActions.length > 0, true);

    const palette = await fetchJson(baseUrl, "/api/command-palette?query=Palette&limit=10", primary.token);
    assert.equal(palette.response.status, 200);
    const data = palette.body.data;
    assert.equal(data.records.some((record: any) => record.id === primaryContactId && record.type === "contact"), true);
    assert.equal(data.records.some((record: any) => record.id === primaryReportId && record.type === "report"), true);
    assert.equal(data.records.some((record: any) => record.id === primaryContactId && record.route === `/app/crm/contacts/detail?id=${primaryContactId}`), true);
    assert.equal(data.records.some((record: any) => record.id === primaryReportId && record.route === "/app/reports/overview"), true);
    assert.equal(data.records.some((record: any) => record.id === secondaryContactId), false);
    assert.equal(data.records.some((record: any) => record.id === secondaryReportId), false);
    assert.equal(data.clinics.some((clinic: any) => clinic.id === secondary.clinicId && clinic.api.path === "/api/auth/switch-clinic"), true);
    console.log("[command-palette] primary action/search payload passed");

    const switchTarget = data.clinics.find((clinic: any) => clinic.id === secondary.clinicId);
    const switched = await fetchJson(baseUrl, switchTarget.api.path, primary.token, {
      method: "POST",
      body: JSON.stringify(switchTarget.api.body),
    });
    assert.equal(switched.response.status, 200);
    const switchedToken = switched.body.data.tokens.token;
    assert.ok(switchedToken);

    const secondaryPalette = await fetchJson(baseUrl, "/api/command-palette?query=Palette&limit=10", switchedToken);
    assert.equal(secondaryPalette.response.status, 200);
    assert.equal(secondaryPalette.body.data.clinics.some((clinic: any) => clinic.id === secondary.clinicId && clinic.isCurrent), true);
    assert.equal(secondaryPalette.body.data.records.some((record: any) => record.id === secondaryContactId), true);
    assert.equal(secondaryPalette.body.data.records.some((record: any) => record.id === primaryContactId), false);
    console.log("[command-palette] clinic switch tenant refresh passed");

    const recent = await fetchJson(baseUrl, "/api/command-palette?limit=5", primary.token);
    assert.equal(recent.response.status, 200);
    assert.equal(Array.isArray(recent.body.data.recentRecords), true);
    assert.equal(Array.isArray(recent.body.data.commonActions), true);
    console.log("[command-palette] recent/common sections passed");
  } finally {
    await pool.execute(`UPDATE report SET deleted_at = CURRENT_TIMESTAMP WHERE id IN (?, ?)`, [primaryReportId, secondaryReportId]);
    if (primaryContactId) {
      await pool.execute(`UPDATE contact SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ?`, [primary.clinicId, primaryContactId]);
    }
    if (secondaryContactId) {
      await pool.execute(`UPDATE contact SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ?`, [secondary.clinicId, secondaryContactId]);
    }
    await pool.execute(
      `DELETE FROM clinic_membership WHERE user_id = ? AND clinic_id = ? AND is_primary = 0`,
      [primary.userId, secondary.clinicId],
    );
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
    server.closeAllConnections();
    await pool.end();
  }

  console.log("[command-palette] integration test completed successfully");
});
