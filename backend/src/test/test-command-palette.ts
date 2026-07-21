import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { v4 as uuidv4 } from "uuid";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { generateToken, hashPassword } from "../utils/helpers.js";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
}

async function createClinicAndAdmin(prefix: string) {
  const clinicId = uuidv4();
  const userId = uuidv4();
  const email = uniqueEmail(`${prefix}_admin`);

  await pool.execute(
    `INSERT INTO clinic
      (id, name, email, timezone, subscription_plan, subscription_status, max_users)
     VALUES (?, ?, ?, 'Europe/London', 'professional', 'active', 20)`,
    [clinicId, `${prefix} Workspace`, email],
  );
  await pool.execute(
    `INSERT INTO user
      (id, clinic_id, email, password_hash, first_name, last_name, role,
       email_verified_at, status, is_active)
     VALUES (?, ?, ?, ?, ?, 'Admin', 'SUPER_ADMIN', CURRENT_TIMESTAMP, 'active', 1)`,
    [userId, clinicId, email, await hashPassword("password123"), prefix],
  );
  await pool.execute(
    `INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
     VALUES (?, ?, 'SUPER_ADMIN', 'active', 1)`,
    [userId, clinicId],
  );

  return {
    clinicId,
    userId,
    token: generateToken({ userId, clinicId, role: "SUPER_ADMIN", email }),
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

  const primaryContactId = uuidv4();
  const secondaryContactId = uuidv4();
  const primaryProposalId = uuidv4();
  const secondaryProposalId = uuidv4();

  try {
    await pool.execute(
      `INSERT IGNORE INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
       VALUES (?, ?, 'SUPER_ADMIN', 'active', 0)`,
      [primary.userId, secondary.clinicId],
    );

    await pool.execute(
      `INSERT INTO contact
        (id, clinic_id, account_name, first_name, last_name, email, status, lead_status, source)
       VALUES (?, ?, 'Palette Primary Account', 'Palette', 'Primary', ?, 'lead', 'new', 'meta_ads'),
              (?, ?, 'Palette Secondary Account', 'Palette', 'Secondary', ?, 'contact', 'converted', 'google_ads')`,
      [
        primaryContactId,
        primary.clinicId,
        uniqueEmail("palette_primary"),
        secondaryContactId,
        secondary.clinicId,
        uniqueEmail("palette_secondary"),
      ],
    );
    await pool.execute(
      `INSERT INTO proposal
        (id, clinic_id, contact_id, proposal_name, package_name, status, value, currency, created_by)
       VALUES (?, ?, ?, 'Palette Primary Proposal', 'Growth Engine', 'draft', 1995, 'GBP', ?),
              (?, ?, ?, 'Palette Secondary Proposal', 'Market Leader', 'draft', 3495, 'GBP', ?)`,
      [
        primaryProposalId,
        primary.clinicId,
        primaryContactId,
        primary.userId,
        secondaryProposalId,
        secondary.clinicId,
        secondaryContactId,
        secondary.userId,
      ],
    );

    const actionPalette = await fetchJson(baseUrl, "/api/command-palette?limit=10", primary.token);
    assert.equal(actionPalette.response.status, 200);
    assert.equal(actionPalette.body.data.actions.some((action: any) => action.id === "create_lead" && action.enabled && action.route === "/app/crm/contacts/new?mode=lead"), true);
    assert.equal(actionPalette.body.data.actions.some((action: any) => action.id === "create_contact" && action.enabled && action.route === "/app/crm/contacts/new?mode=contact"), true);
    assert.equal(actionPalette.body.data.actions.some((action: any) => action.id === "create_client_account" && action.enabled && action.route === "/app/ops/client-accounts/new"), true);
    assert.equal(actionPalette.body.data.actions.some((action: any) => action.id === "create_task" && action.route === "/app/crm/tasks/new"), true);
    assert.equal(actionPalette.body.data.actions.some((action: any) => action.id === "search_contacts" && action.route === "/app/crm/contacts"), true);
    assert.equal(actionPalette.body.data.actions.some((action: any) => action.id === "open_reports" && action.route === "/app"), true);
    assert.equal(actionPalette.body.data.commonActions.length > 0, true);

    const palette = await fetchJson(baseUrl, "/api/command-palette?query=Palette&limit=10", primary.token);
    assert.equal(palette.response.status, 200);
    const data = palette.body.data;
    assert.equal(data.records.some((record: any) => record.id === primaryContactId && record.type === "lead"), true);
    assert.equal(data.records.some((record: any) => record.id === primaryProposalId && record.type === "proposal"), true);
    assert.equal(data.records.some((record: any) => record.type === "client_account" && record.metadata.clinicId === primary.clinicId), true);
    assert.equal(data.records.some((record: any) => record.id === primaryContactId && record.route === `/app/crm/contacts/detail?id=${primaryContactId}`), true);
    assert.equal(data.records.some((record: any) => record.id === primaryProposalId && record.route.includes(`/app/crm/contacts/detail?id=${primaryContactId}`)), true);
    assert.equal(data.records.some((record: any) => record.id === secondaryContactId), false);
    assert.equal(data.records.some((record: any) => record.id === secondaryProposalId), false);
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
    await pool.execute("DELETE FROM proposal WHERE id IN (?, ?)", [primaryProposalId, secondaryProposalId]);
    await pool.execute("DELETE FROM contact WHERE id IN (?, ?)", [primaryContactId, secondaryContactId]);
    await pool.execute(
      `DELETE FROM clinic_membership WHERE user_id = ? AND clinic_id = ? AND is_primary = 0`,
      [primary.userId, secondary.clinicId],
    );
    await pool.execute("DELETE FROM audit_log WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM tokens WHERE user_id IN (?, ?)", [primary.userId, secondary.userId]);
    await pool.execute("DELETE FROM clinic_membership WHERE user_id IN (?, ?)", [primary.userId, secondary.userId]);
    await pool.execute("DELETE FROM user WHERE id IN (?, ?)", [primary.userId, secondary.userId]);
    await pool.execute("DELETE FROM clinic WHERE id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
    server.closeAllConnections();
    await pool.end();
  }

  console.log("[command-palette] integration test completed successfully");
});
