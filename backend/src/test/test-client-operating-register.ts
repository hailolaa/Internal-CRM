import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { v4 as uuidv4 } from "uuid";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";
import { generateToken, hashPassword } from "../utils/helpers.js";

function unique(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

async function closeServer(server: Server) {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function createWorkspace(prefix: string) {
  const clinicId = uuidv4();
  const userId = uuidv4();
  const email = `${unique(prefix)}@register.test`;
  await pool.execute(
    `INSERT INTO clinic (id, name, email, timezone, subscription_plan, subscription_status, max_users)
     VALUES (?, ?, ?, 'Europe/London', 'professional', 'active', 20)`,
    [clinicId, `${prefix} Workspace`, email],
  );
  await pool.execute(
    `INSERT INTO user
      (id, clinic_id, email, password_hash, first_name, last_name, role, email_verified_at, status, is_active)
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
    email,
    token: generateToken({ userId, clinicId, role: "SUPER_ADMIN", email }),
  };
}

async function createPermissionedUser(clinicId: string, prefix: string, permissions: string[]) {
  const userId = uuidv4();
  const roleId = uuidv4();
  const roleName = unique(`${prefix}_role`);
  const email = `${unique(prefix)}@register.test`;
  await pool.execute(
    `INSERT INTO role (id, clinic_id, name, display_name, is_system)
     VALUES (?, ?, ?, ?, 0)`,
    [roleId, clinicId, roleName, roleName],
  );
  if (permissions.length > 0) {
    await pool.execute(
      `INSERT INTO role_permission (role_id, permission_id)
       SELECT ?, id FROM permission WHERE key_name IN (${permissions.map(() => "?").join(", ")})`,
      [roleId, ...permissions],
    );
  }
  await pool.execute(
    `INSERT INTO user
      (id, clinic_id, email, password_hash, first_name, last_name, role, email_verified_at, status, is_active)
     VALUES (?, ?, ?, ?, ?, 'User', ?, CURRENT_TIMESTAMP, 'active', 1)`,
    [userId, clinicId, email, await hashPassword("password123"), prefix, roleName],
  );
  await pool.execute(
    `INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
     VALUES (?, ?, ?, 'active', 1)`,
    [userId, clinicId, roleName],
  );
  const login = await authService.login({ email, password: "password123" });
  return {
    userId,
    roleId,
    token: login.tokens.token,
  };
}

async function ensurePermissions() {
  await pool.execute(
    `INSERT IGNORE INTO permission (id, key_name, description)
     VALUES
       ('perm-client-accounts-read', 'client_accounts:read', 'Read client accounts'),
       ('perm-client-accounts-write', 'client_accounts:write', 'Write client accounts'),
       ('perm-mission-control-api-read', 'mission_control_api:read', 'Read Mission Control API v1 endpoints')`,
  );
}

function registerTask(id: string, name: string, overrides: Record<string, string | null> = {}) {
  const fields: Record<string, string | null> = {
    "Business/Brand": "ClinicGrower",
    "Lifecycle Status": "Active fully onboarded/live",
    Package: "Clinic Growth",
    "Services Included": "SEO, Google Ads, CRM follow-up",
    "Fee + VAT": "Confirmation required",
    "Ad Spend": "Confirmation required",
    "Start / Notice / End / Remaining Payments": "Confirmation required",
    "Lead-outcome status": "Confirmation required",
    "RAG Health": "AMBER",
    "Primary contact / preferred channel": "Michael / email",
    "Delivery owners / reviewer": "Delivery / Michael",
    "Website, hosting, domain, email and telephone services": "Confirmation required",
    "Google Ads, Meta, GA4, GSC, GBP, CRM/call IDs": "Confirmation required",
    "Risks / approvals / promised work": "Contract and pricing must be verified against accounting.",
    "Next action/deadline": "Michael to confirm contract and commercial values.",
    "Evidence/source": "Client Operating Register reconciled 11 August 2026",
    ...overrides,
  };
  return {
    id,
    name,
    status: { status: "ready" },
    date_updated: 1786420800000,
    url: `https://app.clickup.com/t/${id}`,
    markdown_description: Object.entries(fields)
      .filter(([, value]) => value !== null)
      .map(([key, value]) => `**${key}:** ${value}`)
      .join("\n"),
  };
}

async function fetchJson(baseUrl: string, path: string, token?: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const body: any = await response.json().catch(() => ({}));
  return { response, body };
}

function expectStatus(label: string, result: Awaited<ReturnType<typeof fetchJson>>, status: number) {
  assert.equal(result.response.status, status, `${label}: ${JSON.stringify(result.body)}`);
}

test.before(async () => {
  await testConnection();
  await ensurePermissions();
});

test.after(async () => {
  await pool.end();
});

test("client operating register imports, reconciles, gates access and exposes provenance", async () => {
  const workspace = await createWorkspace("cor");
  const otherWorkspace = await createWorkspace("cor_other");
  const writer = await createPermissionedUser(
    workspace.clinicId,
    "cor_writer",
    ["client_accounts:read", "client_accounts:write", "mission_control_api:read"],
  );
  const reader = await createPermissionedUser(workspace.clinicId, "cor_reader", ["client_accounts:read"]);
  const denied = await createPermissionedUser(workspace.clinicId, "cor_denied", []);
  const otherReader = await createPermissionedUser(otherWorkspace.clinicId, "cor_other_reader", ["client_accounts:read"]);
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to start test server");
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  const bristolName = `Bristol Dent ${unique("cor")}`;
  const excludedName = `Bee B Brows ${unique("cor")}`;
  const bristolSourceId = unique("869egj8wr");
  const excludedSourceId = unique("869egjbee");
  const bristol = registerTask(bristolSourceId, `CLIENT RECORD - ${bristolName}`);
  const excluded = registerTask(excludedSourceId, `EXCLUDED RECORD - ${excludedName}`, {
    "Lifecycle Status": "Did not proceed / no delivery",
    Package: null,
    "Services Included": "None",
    "Fee + VAT": "0",
    "Ad Spend": "0",
    "Start / Notice / End / Remaining Payments": "N/A",
    "Lead-outcome status": "Excluded from active register",
    "RAG Health": "GREEN",
    "Website, hosting, domain, email and telephone services": "None",
    "Google Ads, Meta, GA4, GSC, GBP, CRM/call IDs": "None",
    "Risks / approvals / promised work": "False-active-client risk resolved by explicit exclusion.",
  });
  const control = registerTask("control-001", "CONTROL - Live pricing source access");

  try {
    const deniedList = await fetchJson(baseUrl, "/api/client-operating-register", denied.token);
    expectStatus("denied list", deniedList, 403);

    const deniedImport = await fetchJson(baseUrl, "/api/client-operating-register/import", reader.token, {
      method: "POST",
      body: JSON.stringify({ records: [bristol], dryRun: false }),
    });
    expectStatus("reader cannot import", deniedImport, 403);

    const dryRun = await fetchJson(baseUrl, "/api/client-operating-register/import", writer.token, {
      method: "POST",
      body: JSON.stringify({ sourceListId: "901220280295", records: [bristol, control] }),
    });
    expectStatus("dry run", dryRun, 200);
    assert.equal(dryRun.body.data.mode, "dry_run");
    assert.equal(dryRun.body.data.counts.input, 2);
    assert.equal(dryRun.body.data.counts.parsed, 1);
    assert.equal(dryRun.body.data.counts.skipped, 1);
    assert.ok(dryRun.body.data.issues.some((issue: any) => issue.issueType === "confirmation_required"));

    const duplicateDryRun = await fetchJson(baseUrl, "/api/client-operating-register/import", writer.token, {
      method: "POST",
      body: JSON.stringify({ records: [bristol, bristol] }),
    });
    expectStatus("duplicate dry run", duplicateDryRun, 200);
    assert.equal(duplicateDryRun.body.data.counts.errors, 1);
    assert.ok(duplicateDryRun.body.data.issues.some((issue: any) => issue.issueType === "duplicate_input"));

    const duplicateApply = await fetchJson(baseUrl, "/api/client-operating-register/import", writer.token, {
      method: "POST",
      body: JSON.stringify({ records: [bristol, bristol], dryRun: false }),
    });
    expectStatus("duplicate apply", duplicateApply, 400);
    const [duplicateApplyRows]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM client_operating_register_record WHERE clinic_id = ? AND source_record_id = ?",
      [workspace.clinicId, bristolSourceId],
    );
    assert.equal(duplicateApplyRows[0].count, 0);

    const malformedDryRun = await fetchJson(baseUrl, "/api/client-operating-register/import", writer.token, {
      method: "POST",
      body: JSON.stringify({ records: [{ id: "", name: "" }] }),
    });
    expectStatus("malformed dry run", malformedDryRun, 200);
    assert.equal(malformedDryRun.body.data.counts.errors, 1);
    assert.ok(malformedDryRun.body.data.issues.some((issue: any) => issue.issueType === "missing_identity"));

    const firstApply = await fetchJson(baseUrl, "/api/client-operating-register/import", writer.token, {
      method: "POST",
      body: JSON.stringify({ sourceListId: "901220280295", sourceVersion: "2026-08-11", dryRun: false, records: [bristol, excluded] }),
    });
    expectStatus("first apply", firstApply, 201);
    assert.equal(firstApply.body.data.counts.created, 2);
    assert.equal(firstApply.body.data.counts.profilesCreated, 2);

    const rerun = await fetchJson(baseUrl, "/api/client-operating-register/import", writer.token, {
      method: "POST",
      body: JSON.stringify({ sourceListId: "901220280295", sourceVersion: "2026-08-11", dryRun: false, records: [bristol, excluded] }),
    });
    expectStatus("idempotent rerun", rerun, 201);
    assert.equal(rerun.body.data.counts.created, 0);
    assert.equal(rerun.body.data.counts.unchanged, 2);

    const [rowCount]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM client_operating_register_record WHERE clinic_id = ?",
      [workspace.clinicId],
    );
    assert.equal(rowCount[0].count, 2);

    const changedBristol = registerTask(bristolSourceId, `CLIENT RECORD - ${bristolName}`, {
      Package: "Market Leader",
      "Fee + VAT": "Confirmation required",
      "Lifecycle Status": "Active fully onboarded/live",
    });
    const changedApply = await fetchJson(baseUrl, "/api/client-operating-register/import", writer.token, {
      method: "POST",
      body: JSON.stringify({
        sourceListId: "901220280295",
        sourceVersion: "2026-08-12",
        dryRun: false,
        markMissingSource: true,
        records: [changedBristol],
      }),
    });
    expectStatus("changed apply", changedApply, 201);
    assert.equal(changedApply.body.data.counts.updated, 1);
    assert.equal(changedApply.body.data.counts.markedMissing, 1);
    assert.ok(changedApply.body.data.issues.some((issue: any) => issue.issueType === "source_missing"));

    const list = await fetchJson(baseUrl, "/api/client-operating-register", reader.token);
    expectStatus("list", list, 200);
    assert.equal(list.body.data.length, 2);
    const bristolRecord = list.body.data.find((row: any) => row.sourceRecordId === bristolSourceId);
    const excludedRecord = list.body.data.find((row: any) => row.sourceRecordId === excludedSourceId);
    assert.equal(bristolRecord.packageName, "Market Leader");
    assert.equal(bristolRecord.freshnessStatus, "confirmation_required");
    assert.equal(bristolRecord.invoiceTruthSource, "confirmation_required");
    assert.equal(excludedRecord.recordKind, "excluded");
    assert.equal(excludedRecord.freshnessStatus, "missing_from_source");

    const otherList = await fetchJson(baseUrl, "/api/client-operating-register", otherReader.token);
    expectStatus("other tenant list", otherList, 200);
    assert.equal(otherList.body.data.length, 0);

    const apiSearch = await fetchJson(
      baseUrl,
      `/api/v1/search?types=client_account&query=${encodeURIComponent(bristolName)}&limit=5`,
      writer.token,
    );
    expectStatus("mission control api search", apiSearch, 200);
    const apiRecord = apiSearch.body.data.results.find((row: any) => row.title === bristolName);
    assert.ok(apiRecord);
    assert.equal(apiRecord.metadata.operatingRegister.sourceRecordId, bristolSourceId);
    assert.equal(apiRecord.metadata.operatingRegister.sourceListId, "901220280295");
    assert.equal(apiRecord.metadata.operatingRegister.invoiceTruthSource, "confirmation_required");
  } finally {
    await closeServer(server);
  }
});
