import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import app from "../app.js";
import { config } from "../config/index.js";
import pool, { testConnection } from "../config/database.js";
import { generateToken, hashPassword, hashToken } from "../utils/helpers.js";

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

async function createMissionControlIntegrationToken(input: {
  clinicId: string;
  userId: string;
  email: string;
  role: string;
  scopes: string[];
  issuer?: string;
  audience?: string;
  expiresIn?: string;
  revoked?: boolean;
}) {
  const tokenId = uuidv4();
  const rowId = uuidv4();
  const issuer = input.issuer || config.missionControlIntegration.issuer;
  const audience = input.audience || config.missionControlIntegration.audience;
  const token = jwt.sign(
    {
      userId: input.userId,
      clinicId: input.clinicId,
      role: input.role,
      email: input.email,
      token_use: "mission_control_integration",
      scopes: input.scopes,
    },
    config.jwt.secret,
    {
      jwtid: tokenId,
      subject: "chatgpt-mission-control",
      issuer,
      audience,
      expiresIn: (input.expiresIn || "15m") as any,
    },
  );

  await pool.execute(
    `INSERT INTO mission_control_integration_token
      (id, clinic_id, user_id, name, subject, token_id_hash, issuer, audience, scopes, expires_at, revoked_at, created_by)
     VALUES (?, ?, ?, 'ChatGPT Mission Control acceptance token', 'chatgpt-mission-control', ?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE), ${input.revoked ? "CURRENT_TIMESTAMP" : "NULL"}, ?)`,
    [rowId, input.clinicId, input.userId, hashToken(tokenId), issuer, audience, JSON.stringify(input.scopes), input.userId],
  );

  return { id: rowId, token };
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
  const oldContactId = uuidv4();
  const overflowContactIds = Array.from({ length: 30 }, () => uuidv4());
  const otherContactId = uuidv4();
  const clientAccountId = uuidv4();
  const proposalId = uuidv4();
  const taskId = uuidv4();
  const dealId = uuidv4();
  const pipelineId = uuidv4();
  const pipelineStageId = uuidv4();
  const emailId = uuidv4();
  const smsId = uuidv4();
  const depositId = uuidv4();
  const campaignId = uuidv4();
  const strategyLogId = uuidv4();
  const server = app.listen(0);
  const integrationTokens: string[] = [];
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start Mission Control API test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    const openApi = await fetchJson(baseUrl, "/api/openapi.json");
    expectStatus("openapi", openApi, 200);
    assert.equal(openApi.body.openapi, "3.1.0");
    assert.ok(openApi.body.paths["/api/v1/search"]);
    assert.ok(openApi.body.paths["/api/v1/records/{type}/{id}"]);
    assert.ok(openApi.body.paths["/mcp"]);
    assert.equal(openApi.body.components.securitySchemes.bearerAuth.type, "http");
    assert.deepEqual(openApi.body.components.schemas.RecordType.enum, [
      "contact",
      "client_account",
      "proposal",
      "task",
      "opportunity",
      "communication",
      "finance",
      "marketing",
      "management",
    ]);
    assert.ok(openApi.body.components.schemas.ApiErrorEnvelope);
    assert.ok(openApi.body.components.schemas.JsonRpcError);
    assert.ok(openApi.body.paths["/api/v1/search"].get.responses["400"].content["application/json"].schema.$ref);

    await pool.execute(
      `INSERT INTO contact
        (id, clinic_id, account_name, first_name, last_name, email, status, lead_status, source)
       VALUES (?, ?, 'MCP Clinic', 'Mcp', 'Patient', ?, 'lead', 'qualified', 'website'),
              (?, ?, 'Other Tenant', 'Other', 'Patient', ?, 'lead', 'new', 'website')`,
      [contactId, workspace.clinicId, `${unique("mcp")}@lead.test`, otherContactId, otherWorkspace.clinicId, `${unique("other")}@lead.test`],
    );
    await pool.execute(
      `INSERT INTO contact
        (id, clinic_id, account_name, first_name, last_name, email, status, lead_status, source, created_at, updated_at)
       VALUES (?, ?, 'Older Direct Fetch Clinic', 'Older', 'Patient', ?, 'lead', 'qualified', 'website', '2020-01-01 00:00:00', '2020-01-01 00:00:00')`,
      [oldContactId, workspace.clinicId, `${unique("older")}@lead.test`],
    );
    for (let index = 0; index < overflowContactIds.length; index += 1) {
      const overflowContactId = overflowContactIds[index];
      if (!overflowContactId) throw new Error("Missing overflow contact ID");
      await pool.execute(
        `INSERT INTO contact
          (id, clinic_id, account_name, first_name, last_name, email, status, lead_status, source)
         VALUES (?, ?, ?, 'Recent', ?, ?, 'lead', 'new', 'website')`,
        [
          overflowContactId,
          workspace.clinicId,
          `Recent API Contact ${index}`,
          `Contact ${index}`,
          `${unique(`recent_${index}`)}@lead.test`,
        ],
      );
    }
    await pool.execute(
      `INSERT INTO client_account_profile
        (id, clinic_id, client_status, health_status, current_package, created_by)
       VALUES (?, ?, 'active', 'healthy', 'MCP Clinic Growth', ?)`,
      [clientAccountId, workspace.clinicId, workspace.userId],
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
    await pool.execute(
      `INSERT INTO email (id, clinic_id, contact_id, user_id, subject, body, direction, status)
       VALUES (?, ?, ?, ?, 'MCP Clinic email follow-up', 'Sensitive body should not be surfaced in search metadata.', 'outbound', 'sent')`,
      [emailId, workspace.clinicId, contactId, workspace.userId],
    );
    await pool.execute(
      `INSERT INTO sms (id, clinic_id, contact_id, user_id, message, direction, status, call_followup)
       VALUES (?, ?, ?, ?, 'MCP Clinic SMS follow-up', 'outbound', 'sent', 1)`,
      [smsId, workspace.clinicId, contactId, workspace.userId],
    );
    await pool.execute(
      `INSERT INTO deposit_record
        (id, clinic_id, contact_id, contact_name, treatment, deposit_amount, deposit_paid, status, payment_status, created_by)
       VALUES (?, ?, ?, 'MCP Clinic Patient', 'Implants', 50.00, 1, 'paid', 'paid', ?)`,
      [depositId, workspace.clinicId, contactId, workspace.userId],
    );
    await pool.execute(
      `INSERT INTO campaign (id, clinic_id, name, type, status, budget, channel)
       VALUES (?, ?, 'MCP Clinic Campaign', 'search', 'active', 1000.00, 'Google Ads')`,
      [campaignId, workspace.clinicId],
    );
    await pool.execute(
      `INSERT INTO strategy_log
        (id, clinic_id, client_account_profile_id, log_month, log_type, meeting_notes, decisions, next_actions, created_by)
       VALUES (?, ?, ?, CURRENT_DATE, 'strategy', 'MCP Clinic strategy notes', 'Continue tracked growth plan', 'Review next month', ?)`,
      [strategyLogId, workspace.clinicId, clientAccountId, workspace.userId],
    );

    const unauthenticated = await fetchJson(baseUrl, "/api/v1/capabilities");
    expectStatus("unauthenticated capabilities", unauthenticated, 401);
    assert.equal(unauthenticated.body.success, false);
    assert.equal(unauthenticated.body.data, null);
    assert.equal(unauthenticated.body.error.code, "unauthorized");

    const invalidToken = await fetchJson(baseUrl, "/api/v1/capabilities", "not-a-real-token");
    expectStatus("invalid token capabilities", invalidToken, 401);
    assert.equal(invalidToken.body.success, false);
    assert.equal(invalidToken.body.error.code, "unauthorized");

    const expiredIntegrationToken = await createMissionControlIntegrationToken({
      clinicId: workspace.clinicId,
      userId: reader.userId,
      email: `${unique("expired_integration")}@api.test`,
      role: "SUPER_ADMIN",
      scopes: ["mission_control_api:read"],
      expiresIn: "-1s",
    });
    integrationTokens.push(expiredIntegrationToken.id);
    const expiredIntegration = await fetchJson(baseUrl, "/api/v1/capabilities", expiredIntegrationToken.token);
    expectStatus("expired integration token", expiredIntegration, 401);
    assert.equal(expiredIntegration.body.error.code, "unauthorized");

    const wrongIssuerToken = await createMissionControlIntegrationToken({
      clinicId: workspace.clinicId,
      userId: reader.userId,
      email: `${unique("wrong_issuer")}@api.test`,
      role: "SUPER_ADMIN",
      scopes: ["mission_control_api:read"],
      issuer: "unexpected-issuer",
    });
    integrationTokens.push(wrongIssuerToken.id);
    const wrongIssuer = await fetchJson(baseUrl, "/api/v1/capabilities", wrongIssuerToken.token);
    expectStatus("wrong integration issuer", wrongIssuer, 401);
    assert.equal(wrongIssuer.body.error.code, "unauthorized");

    const wrongAudienceToken = await createMissionControlIntegrationToken({
      clinicId: workspace.clinicId,
      userId: reader.userId,
      email: `${unique("wrong_audience")}@api.test`,
      role: "SUPER_ADMIN",
      scopes: ["mission_control_api:read"],
      audience: "unexpected-audience",
    });
    integrationTokens.push(wrongAudienceToken.id);
    const wrongAudience = await fetchJson(baseUrl, "/api/v1/capabilities", wrongAudienceToken.token);
    expectStatus("wrong integration audience", wrongAudience, 401);
    assert.equal(wrongAudience.body.error.code, "unauthorized");

    const revokedIntegrationToken = await createMissionControlIntegrationToken({
      clinicId: workspace.clinicId,
      userId: reader.userId,
      email: `${unique("revoked_integration")}@api.test`,
      role: "SUPER_ADMIN",
      scopes: ["mission_control_api:read"],
      revoked: true,
    });
    integrationTokens.push(revokedIntegrationToken.id);
    const revokedIntegration = await fetchJson(baseUrl, "/api/v1/capabilities", revokedIntegrationToken.token);
    expectStatus("revoked integration token", revokedIntegration, 401);
    assert.equal(revokedIntegration.body.error.code, "unauthorized");

    const forbidden = await fetchJson(baseUrl, "/api/v1/capabilities", denied.token);
    expectStatus("forbidden capabilities", forbidden, 403);
    assert.equal(forbidden.body.success, false);
    assert.equal(forbidden.body.error.code, "forbidden");

    const health = await fetchJson(baseUrl, "/api/v1/health", reader.token);
    expectStatus("reader health", health, 200);
    assert.equal(health.body.success, true);
    assert.equal(health.body.data.service, "mission-control-api");

    const version = await fetchJson(baseUrl, "/api/v1/version", reader.token);
    expectStatus("reader version", version, 200);
    assert.equal(version.body.success, true);
    assert.equal(version.body.data.apiVersion, "v1");

    const capabilities = await fetchJson(baseUrl, "/api/v1/capabilities", reader.token);
    expectStatus("reader capabilities", capabilities, 200);
    assert.equal(capabilities.body.success, true);
    assert.equal(capabilities.body.error, null);
    assert.ok(capabilities.body.request_id);
    assert.ok(capabilities.body.generated_at);
    assert.equal(capabilities.body.data.writePolicy.currentPhase, "read_only");
    assert.equal(capabilities.body.data.writePolicy.externalActionsEnabled, false);
    assert.equal(capabilities.body.data.searchPolicy.maxLimit, 25);
    assert.equal(capabilities.body.data.searchPolicy.cursorPagination, true);
    assert.equal(capabilities.body.data.recordTypes.includes("communication"), true);
    assert.equal(capabilities.body.data.recordTypes.includes("finance"), true);
    assert.equal(capabilities.body.data.recordTypes.includes("marketing"), true);
    assert.equal(capabilities.body.data.recordTypes.includes("management"), true);
    assert.equal(capabilities.body.data.tools.some((tool: any) => tool.name === "search" && tool.readOnlyHint), true);

    const apiIntegrationToken = await createMissionControlIntegrationToken({
      clinicId: workspace.clinicId,
      userId: reader.userId,
      email: `${unique("api_integration")}@api.test`,
      role: "SUPER_ADMIN",
      scopes: ["mission_control_api:read"],
    });
    integrationTokens.push(apiIntegrationToken.id);
    const integrationCapabilities = await fetchJson(baseUrl, "/api/v1/capabilities", apiIntegrationToken.token);
    expectStatus("valid Mission Control REST integration token", integrationCapabilities, 200);
    assert.equal(integrationCapabilities.body.data.writePolicy.currentPhase, "read_only");

    const search = await fetchJson(
      baseUrl,
      "/api/v1/search?query=MCP%20Clinic&types=contact,client_account,proposal,task,opportunity,communication,finance,marketing,management&limit=20",
      reader.token,
    );
    expectStatus("reader search", search, 200);
    assert.equal(search.body.data.results.some((item: any) => item.id === contactId && item.type === "contact"), true);
    assert.equal(search.body.data.results.some((item: any) => item.id === clientAccountId && item.type === "client_account"), true);
    assert.equal(search.body.data.results.some((item: any) => item.id === proposalId && item.type === "proposal"), true);
    assert.equal(search.body.data.results.some((item: any) => item.id === taskId && item.type === "task"), true);
    assert.equal(search.body.data.results.some((item: any) => item.id === dealId && item.type === "opportunity"), true);
    assert.equal(search.body.data.results.some((item: any) => item.id === emailId && item.type === "communication"), true);
    assert.equal(search.body.data.results.some((item: any) => item.id === depositId && item.type === "finance"), true);
    assert.equal(search.body.data.results.some((item: any) => item.id === campaignId && item.type === "marketing"), true);
    assert.equal(search.body.data.results.some((item: any) => item.id === strategyLogId && item.type === "management"), true);
    assert.equal(search.body.data.results.some((item: any) => item.id === otherContactId), false);
    assert.equal(search.body.data.results.every((item: any) => item.provenance?.source === "mission_control_database"), true);
    assert.equal(JSON.stringify(search.body).includes("Sensitive body should not be surfaced"), false);

    const emptySearch = await fetchJson(baseUrl, "/api/v1/search?query=NoMatchingMissionControlRecord", reader.token);
    expectStatus("empty search", emptySearch, 200);
    assert.equal(emptySearch.body.data.page.returned, 0);

    const missingQuerySearch = await fetchJson(baseUrl, "/api/v1/search?types=contact&limit=1", reader.token);
    expectStatus("missing query search", missingQuerySearch, 200);
    assert.equal(missingQuerySearch.body.data.page.returned, 1);

    const pagedSearch = await fetchJson(baseUrl, "/api/v1/search?types=contact&limit=2", reader.token);
    expectStatus("paged search", pagedSearch, 200);
    assert.equal(pagedSearch.body.data.page.returned, 2);
    assert.equal(pagedSearch.body.data.page.nextCursor, "2");

    const repeatedCursorSearch = await fetchJson(baseUrl, "/api/v1/search?types=contact&limit=2&cursor=2", reader.token);
    expectStatus("repeated cursor search", repeatedCursorSearch, 200);
    assert.equal(repeatedCursorSearch.body.data.page.cursor, "2");
    assert.equal(repeatedCursorSearch.body.data.page.returned, 2);

    const excessiveRestLimit = await fetchJson(baseUrl, "/api/v1/search?types=contact&limit=500", reader.token);
    expectStatus("excessive REST search limit", excessiveRestLimit, 200);
    assert.equal(excessiveRestLimit.body.data.page.limit, 25);

    const invalidCursor = await fetchJson(baseUrl, "/api/v1/search?types=contact&cursor=not-a-number", reader.token);
    expectStatus("invalid cursor", invalidCursor, 400);
    assert.equal(invalidCursor.body.success, false);
    assert.equal(invalidCursor.body.error.code, "bad_request");

    const directOldContact = await fetchJson(baseUrl, `/api/v1/records/contact/${oldContactId}`, reader.token);
    expectStatus("direct old contact fetch", directOldContact, 200);
    assert.equal(directOldContact.body.data.id, oldContactId);

    const crossTenantFetch = await fetchJson(baseUrl, `/api/v1/records/contact/${otherContactId}`, reader.token);
    expectStatus("cross tenant fetch", crossTenantFetch, 404);
    assert.equal(crossTenantFetch.body.success, false);
    assert.equal(crossTenantFetch.body.error.code, "not_found");

    const missingFetch = await fetchJson(baseUrl, `/api/v1/records/contact/${uuidv4()}`, reader.token);
    expectStatus("missing fetch", missingFetch, 404);
    assert.equal(missingFetch.body.success, false);
    assert.equal(missingFetch.body.error.code, "not_found");

    const clientAccountFetch = await fetchJson(baseUrl, `/api/v1/records/client_account/${clientAccountId}`, reader.token);
    expectStatus("client account fetch", clientAccountFetch, 200);
    assert.equal(clientAccountFetch.body.data.id, clientAccountId);

    const communicationFetch = await fetchJson(baseUrl, `/api/v1/records/communication/${smsId}`, reader.token);
    expectStatus("communication fetch", communicationFetch, 200);
    assert.equal(communicationFetch.body.data.metadata.channel, "sms");

    const invalidFetchType = await fetchJson(baseUrl, `/api/v1/records/secret_keys/${contactId}`, reader.token);
    expectStatus("invalid fetch type", invalidFetchType, 400);
    assert.equal(invalidFetchType.body.success, false);
    assert.equal(invalidFetchType.body.error.code, "bad_request");

    const wrongRecordType = await fetchJson(baseUrl, `/api/v1/records/proposal/${contactId}`, reader.token);
    expectStatus("wrong record type fetch", wrongRecordType, 404);
    assert.equal(wrongRecordType.body.success, false);
    assert.equal(wrongRecordType.body.error.code, "not_found");

    const invalidType = await fetchJson(baseUrl, "/api/v1/search?types=secret_keys", reader.token);
    expectStatus("invalid search type", invalidType, 400);
    assert.equal(invalidType.body.success, false);
    assert.equal(invalidType.body.error.code, "bad_request");

    const mcpTools = await fetchJson(baseUrl, "/mcp", reader.token, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: "tools", method: "tools/list" }),
    });
    expectStatus("mcp tools/list", mcpTools, 200);
    assert.equal(mcpTools.body.id, "tools");
    assert.ok(mcpTools.body.result.request_id);
    assert.ok(mcpTools.body.result.generated_at);
    assert.equal(mcpTools.body.result.tools.some((tool: any) => tool.name === "fetch"), true);
    assert.equal(mcpTools.body.result.tools.every((tool: any) => tool.readOnlyHint === true), true);
    assert.equal(mcpTools.body.result.tools.every((tool: any) => tool.destructiveHint === false), true);
    const searchTool = mcpTools.body.result.tools.find((tool: any) => tool.name === "search");
    const fetchTool = mcpTools.body.result.tools.find((tool: any) => tool.name === "fetch");
    assert.equal(searchTool.inputSchema.properties.limit.maximum, 25);
    assert.equal(searchTool.supportedRecordTypes.includes("management"), true);
    assert.deepEqual(fetchTool.inputSchema.required, ["type", "id"]);

    const mcpIntegrationToken = await createMissionControlIntegrationToken({
      clinicId: workspace.clinicId,
      userId: reader.userId,
      email: `${unique("mcp_integration")}@api.test`,
      role: "SUPER_ADMIN",
      scopes: ["mission_control_mcp:read"],
    });
    integrationTokens.push(mcpIntegrationToken.id);
    const mcpIntegrationTools = await fetchJson(baseUrl, "/mcp", mcpIntegrationToken.token, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: "integration-tools", method: "tools/list" }),
    });
    expectStatus("valid Mission Control MCP integration token", mcpIntegrationTools, 200);
    assert.equal(mcpIntegrationTools.body.result.tools.every((tool: any) => tool.readOnlyHint === true), true);

    const missingMcpScope = await fetchJson(baseUrl, "/mcp", apiIntegrationToken.token, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: "missing-scope", method: "tools/list" }),
    });
    expectStatus("Mission Control integration token missing MCP scope", missingMcpScope, 403);
    assert.equal(missingMcpScope.body.status, "error");
    assert.match(missingMcpScope.body.message, /scope|permission/i);

    const mcpForbidden = await fetchJson(baseUrl, "/mcp", denied.token, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: "denied-tools", method: "tools/list" }),
    });
    expectStatus("mcp denied tools/list", mcpForbidden, 403);

    const mcpInvalidToken = await fetchJson(baseUrl, "/mcp", "not-a-real-token", {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: "invalid-token", method: "tools/list" }),
    });
    expectStatus("mcp invalid token", mcpInvalidToken, 401);

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
    assert.equal(unsupportedMcpWrite.body.error.code, -32601);
    assert.equal(unsupportedMcpWrite.body.error.message, "Unsupported MCP tool");

    const malformedMcp = await fetchJson(baseUrl, "/mcp", reader.token, {
      method: "POST",
      body: JSON.stringify({ id: "bad-jsonrpc", method: "tools/list" }),
    });
    expectStatus("mcp malformed request", malformedMcp, 400);
    assert.equal(malformedMcp.body.error.code, -32600);

    const malformedArguments = await fetchJson(baseUrl, "/mcp", reader.token, {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "bad-args",
        method: "tools/call",
        params: { name: "search", arguments: "not-an-object" },
      }),
    });
    expectStatus("mcp malformed arguments", malformedArguments, 400);
    assert.equal(malformedArguments.body.error.code, -32602);

    const excessiveLimit = await fetchJson(baseUrl, "/mcp", reader.token, {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "limit",
        method: "tools/call",
        params: { name: "search", arguments: { query: "MCP Clinic", limit: 500 } },
      }),
    });
    expectStatus("mcp excessive search limit", excessiveLimit, 400);
    assert.equal(excessiveLimit.body.error.code, -32602);

    const mcpInvalidCursor = await fetchJson(baseUrl, "/mcp", reader.token, {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "bad-cursor",
        method: "tools/call",
        params: { name: "search", arguments: { query: "MCP Clinic", cursor: "not-a-number" } },
      }),
    });
    expectStatus("mcp invalid cursor", mcpInvalidCursor, 400);
    assert.equal(mcpInvalidCursor.body.error.code, -32602);

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
    assert.equal(mcpSearch.body.id, "search");
    assert.ok(mcpSearch.body.result.request_id);
    assert.ok(mcpSearch.body.result.generated_at);
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
    assert.equal(mcpFetch.body.id, "fetch");
    assert.equal(mcpFetch.body.result.content[0].json.id, contactId);

    const [auditRows]: any = await pool.execute(
      `SELECT action, entity_type as entityType, entity_id as entityId, changes
       FROM audit_log
       WHERE clinic_id = ?
         AND action IN ('MISSION_CONTROL_API_FETCH', 'MISSION_CONTROL_MCP_TOOL_CALL')
       ORDER BY created_at DESC`,
      [workspace.clinicId],
    );
    assert.equal(auditRows.some((row: any) => row.action === "MISSION_CONTROL_API_FETCH" && row.entityType === "contact" && row.entityId === oldContactId), true);
    assert.equal(auditRows.some((row: any) => row.action === "MISSION_CONTROL_MCP_TOOL_CALL" && JSON.stringify(row.changes).includes('"result":"success"')), true);

    const mcpMissingFetchId = await fetchJson(baseUrl, "/mcp", reader.token, {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "missing-id",
        method: "tools/call",
        params: { name: "fetch", arguments: { type: "contact" } },
      }),
    });
    expectStatus("mcp missing fetch id", mcpMissingFetchId, 400);
    assert.equal(mcpMissingFetchId.body.error.code, -32602);

    const mcpCrossTenantFetch = await fetchJson(baseUrl, "/mcp", reader.token, {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "fetch-other",
        method: "tools/call",
        params: { name: "fetch", arguments: { type: "contact", id: otherContactId } },
      }),
    });
    expectStatus("mcp cross-tenant fetch", mcpCrossTenantFetch, 404);
    assert.equal(mcpCrossTenantFetch.body.error.code, -32004);

    let rateLimited = false;
    for (let index = 0; index < 150; index += 1) {
      const response = await fetchJson(baseUrl, "/api/v1/version", reader.token);
      if (response.response.status === 429) {
        rateLimited = true;
        assert.equal(response.body.success, false);
        assert.equal(response.body.error.code, "rate_limit_exceeded");
        break;
      }
    }
    assert.equal(rateLimited, true, "Expected dedicated /api/v1 rate limit to trigger");
  } finally {
    await pool.execute("DELETE FROM strategy_log WHERE id = ?", [strategyLogId]);
    if (integrationTokens.length > 0) {
      await pool.execute(
        `DELETE FROM mission_control_integration_token WHERE id IN (${integrationTokens.map(() => "?").join(", ")})`,
        integrationTokens,
      );
    }
    await pool.execute("DELETE FROM campaign WHERE id = ?", [campaignId]);
    await pool.execute("DELETE FROM deposit_record WHERE id = ?", [depositId]);
    await pool.execute("DELETE FROM sms WHERE id = ?", [smsId]);
    await pool.execute("DELETE FROM email WHERE id = ?", [emailId]);
    await pool.execute("DELETE FROM deal WHERE id = ?", [dealId]);
    await pool.execute("DELETE FROM pipeline_stage WHERE id = ?", [pipelineStageId]);
    await pool.execute("DELETE FROM pipeline WHERE id = ?", [pipelineId]);
    await pool.execute("DELETE FROM task WHERE id = ?", [taskId]);
    await pool.execute("DELETE FROM proposal WHERE id = ?", [proposalId]);
    await pool.execute("DELETE FROM client_account_profile WHERE id = ?", [clientAccountId]);
    await pool.execute(
      `DELETE FROM contact WHERE id IN (${[contactId, oldContactId, otherContactId, ...overflowContactIds].map(() => "?").join(", ")})`,
      [contactId, oldContactId, otherContactId, ...overflowContactIds],
    );
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
