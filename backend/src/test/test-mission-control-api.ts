import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { v4 as uuidv4 } from "uuid";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
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
  const email = `${unique(prefix)}@api.test`;
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
  const email = `${unique(prefix)}@api.test`;

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
     VALUES (?, ?, ?, ?, ?, 'Reader', ?, CURRENT_TIMESTAMP, 'active', 1)`,
    [userId, clinicId, email, await hashPassword("password123"), prefix, roleName],
  );
  await pool.execute(
    `INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
     VALUES (?, ?, ?, 'active', 1)`,
    [userId, clinicId, roleName],
  );

  return {
    userId,
    roleId,
    token: generateToken({ userId, clinicId, role: roleName, email }),
  };
}

async function ensureApiPermissions() {
  await pool.execute(
    `INSERT IGNORE INTO permission (id, key_name, description)
     VALUES
       ('perm-mission-control-api-read', 'mission_control_api:read', 'Read Mission Control API v1 endpoints'),
       ('perm-mission-control-mcp-read', 'mission_control_mcp:read', 'Read Mission Control MCP tools')`,
  );
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
  await ensureApiPermissions();
});

test.after(async () => {
  await pool.end();
});

test("Mission Control API v1 and MCP expose a secured read-only first slice", async () => {
  const workspace = await createWorkspace("mc_api");
  const otherWorkspace = await createWorkspace("mc_api_other");
  const reader = await createPermissionedUser(
    workspace.clinicId,
    "mc_api_reader",
    ["mission_control_api:read", "mission_control_mcp:read"],
  );
  const denied = await createPermissionedUser(workspace.clinicId, "mc_api_denied", []);
  const contactId = uuidv4();
  const otherContactId = uuidv4();
  const proposalId = uuidv4();
  const taskId = uuidv4();
  const dealId = uuidv4();
  const pipelineId = uuidv4();
  const pipelineStageId = uuidv4();
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start Mission Control API test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    await pool.execute(
      `INSERT INTO contact
        (id, clinic_id, account_name, first_name, last_name, email, status, lead_status, source)
       VALUES (?, ?, 'MCP Clinic', 'Mcp', 'Patient', ?, 'lead', 'qualified', 'website'),
              (?, ?, 'Other Tenant', 'Other', 'Patient', ?, 'lead', 'new', 'website')`,
      [contactId, workspace.clinicId, `${unique("mcp")}@lead.test`, otherContactId, otherWorkspace.clinicId, `${unique("other")}@lead.test`],
    );
    await pool.execute(
      `INSERT INTO proposal (id, clinic_id, contact_id, proposal_name, package_name, status, value, currency, created_by)
       VALUES (?, ?, ?, 'MCP Clinic Proposal', 'Clinic Growth', 'draft', 1995, 'GBP', ?)`,
      [proposalId, workspace.clinicId, contactId, workspace.userId],
    );
    await pool.execute(
      `INSERT INTO task (id, clinic_id, is_internal, title, description, priority, status, board_key, contact_id, created_by)
       VALUES (?, ?, 1, 'MCP Clinic follow-up', 'Read-only task result', 'high', 'pending', 'delivery', ?, ?)`,
      [taskId, workspace.clinicId, contactId, workspace.userId],
    );
    await pool.execute(
      `INSERT INTO pipeline (id, clinic_id, name, description, stages)
       VALUES (?, ?, 'MCP API Test Pipeline', 'Mission Control API test pipeline', JSON_ARRAY('Proposal'))`,
      [pipelineId, workspace.clinicId],
    );
    await pool.execute(
      `INSERT INTO pipeline_stage (id, clinic_id, pipeline_id, name, color, position, kind, created_by)
       VALUES (?, ?, ?, 'Proposal', 'bg-blue-500', 1, 'open', ?)`,
      [pipelineStageId, workspace.clinicId, pipelineId, workspace.userId],
    );
    await pool.execute(
      `INSERT INTO deal
        (id, clinic_id, contact_id, pipeline_id, pipeline_stage_id, title, value, stage, probability, owner_id, source, status, expected_close_date)
       VALUES (?, ?, ?, ?, ?, 'MCP Clinic Opportunity', 1995, 'Proposal', 70, ?, 'website', 'open', CURRENT_DATE)`,
      [dealId, workspace.clinicId, contactId, pipelineId, pipelineStageId, workspace.userId],
    );

    const unauthenticated = await fetchJson(baseUrl, "/api/v1/capabilities");
    expectStatus("unauthenticated capabilities", unauthenticated, 401);

    const forbidden = await fetchJson(baseUrl, "/api/v1/capabilities", denied.token);
    expectStatus("forbidden capabilities", forbidden, 403);

    const capabilities = await fetchJson(baseUrl, "/api/v1/capabilities", reader.token);
    expectStatus("reader capabilities", capabilities, 200);
    assert.equal(capabilities.body.success, true);
    assert.equal(capabilities.body.error, null);
    assert.ok(capabilities.body.request_id);
    assert.ok(capabilities.body.generated_at);
    assert.equal(capabilities.body.data.writePolicy.currentPhase, "read_only");
    assert.equal(capabilities.body.data.writePolicy.externalActionsEnabled, false);
    assert.equal(capabilities.body.data.tools.some((tool: any) => tool.name === "search" && tool.readOnlyHint), true);

    const search = await fetchJson(baseUrl, "/api/v1/search?query=MCP%20Clinic&types=contact,proposal,task,opportunity&limit=10", reader.token);
    expectStatus("reader search", search, 200);
    assert.equal(search.body.data.results.some((item: any) => item.id === contactId && item.type === "contact"), true);
    assert.equal(search.body.data.results.some((item: any) => item.id === proposalId && item.type === "proposal"), true);
    assert.equal(search.body.data.results.some((item: any) => item.id === taskId && item.type === "task"), true);
    assert.equal(search.body.data.results.some((item: any) => item.id === dealId && item.type === "opportunity"), true);
    assert.equal(search.body.data.results.some((item: any) => item.id === otherContactId), false);
    assert.equal(search.body.data.results.every((item: any) => item.provenance?.source === "mission_control_database"), true);

    const invalidType = await fetchJson(baseUrl, "/api/v1/search?types=secret_keys", reader.token);
    expectStatus("invalid search type", invalidType, 400);

    const mcpTools = await fetchJson(baseUrl, "/mcp", reader.token, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: "tools", method: "tools/list" }),
    });
    expectStatus("mcp tools/list", mcpTools, 200);
    assert.equal(mcpTools.body.result.tools.some((tool: any) => tool.name === "fetch"), true);
    assert.equal(mcpTools.body.result.tools.every((tool: any) => tool.readOnlyHint === true), true);
    assert.equal(mcpTools.body.result.tools.every((tool: any) => tool.destructiveHint === false), true);

    const mcpForbidden = await fetchJson(baseUrl, "/mcp", denied.token, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: "denied-tools", method: "tools/list" }),
    });
    expectStatus("mcp denied tools/list", mcpForbidden, 403);

    const unsupportedMcpWrite = await fetchJson(baseUrl, "/mcp", reader.token, {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "write",
        method: "tools/call",
        params: { name: "create_task", arguments: { title: "Should not be created" } },
      }),
    });
    expectStatus("mcp unsupported write tool", unsupportedMcpWrite, 400);

    const mcpSearch = await fetchJson(baseUrl, "/mcp", reader.token, {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "search",
        method: "tools/call",
        params: { name: "search", arguments: { query: "MCP Clinic", types: ["contact"], limit: 5 } },
      }),
    });
    expectStatus("mcp search", mcpSearch, 200);
    assert.equal(mcpSearch.body.result.content[0].json.results[0].id, contactId);

    const mcpFetch = await fetchJson(baseUrl, "/mcp", reader.token, {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "fetch",
        method: "tools/call",
        params: { name: "fetch", arguments: { type: "contact", id: contactId } },
      }),
    });
    expectStatus("mcp fetch", mcpFetch, 200);
    assert.equal(mcpFetch.body.result.content[0].json.id, contactId);
  } finally {
    await pool.execute("DELETE FROM deal WHERE id = ?", [dealId]);
    await pool.execute("DELETE FROM pipeline_stage WHERE id = ?", [pipelineStageId]);
    await pool.execute("DELETE FROM pipeline WHERE id = ?", [pipelineId]);
    await pool.execute("DELETE FROM task WHERE id = ?", [taskId]);
    await pool.execute("DELETE FROM proposal WHERE id = ?", [proposalId]);
    await pool.execute("DELETE FROM contact WHERE id IN (?, ?)", [contactId, otherContactId]);
    await pool.execute("DELETE FROM audit_log WHERE clinic_id IN (?, ?)", [workspace.clinicId, otherWorkspace.clinicId]);
    await pool.execute("DELETE FROM tokens WHERE user_id IN (?, ?, ?, ?)", [workspace.userId, otherWorkspace.userId, reader.userId, denied.userId]);
    await pool.execute("DELETE FROM clinic_membership WHERE user_id IN (?, ?, ?, ?)", [workspace.userId, otherWorkspace.userId, reader.userId, denied.userId]);
    await pool.execute("DELETE FROM user WHERE id IN (?, ?, ?, ?)", [workspace.userId, otherWorkspace.userId, reader.userId, denied.userId]);
    await pool.execute("DELETE FROM role_permission WHERE role_id IN (?, ?)", [reader.roleId, denied.roleId]);
    await pool.execute("DELETE FROM role WHERE id IN (?, ?)", [reader.roleId, denied.roleId]);
    await pool.execute("DELETE FROM clinic WHERE id IN (?, ?)", [workspace.clinicId, otherWorkspace.clinicId]);
    await closeServer(server);
  }
});
