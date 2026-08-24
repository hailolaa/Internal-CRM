import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { v4 as uuidv4 } from "uuid";
import pool from "../config/database.js";
import { config } from "../config/index.js";
import app from "../app.js";
import { clickUpService } from "../modules/clickup/clickup.service.js";
import { tasksService } from "../modules/tasks/tasks.service.js";
import { generateToken, hashPassword } from "../utils/helpers.js";
import { encryptProviderCredential } from "../utils/provider-credentials.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const routesPath = resolve(currentDir, "../modules/clickup/clickup.routes.js");
const migrationPaths = [
  resolve(currentDir, "../../scripts/migrations/20260730_add_clickup_oauth_and_mappings.sql"),
  resolve(currentDir, "../../scripts/migrations/20260805_add_clickup_category_priority_mappings.sql"),
  resolve(currentDir, "../../scripts/migrations/20260820_add_clickup_lifecycle_sync.sql"),
];

function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function runClickUpMigration() {
  for (const migrationPath of migrationPaths) {
    const sql = await readFile(migrationPath, "utf8");
    for (const statement of sql.split(/;\s*\r?\n/).map((item) => item.trim()).filter(Boolean)) {
      await pool.query(statement);
    }
  }
}

async function createWorkspace(prefix: string) {
  const clinicId = uuidv4();
  const userId = uuidv4();
  const passwordHash = await hashPassword("password123");

  await pool.execute(
    `INSERT INTO clinic
      (id, name, email, phone, address, city, state, postal_code, country, timezone,
       subscription_plan, subscription_status, max_users)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'professional', 'active', 20)`,
    [
      clinicId,
      `${prefix} Workspace`,
      `${unique(prefix)}@example.com`,
      "020 7946 0000",
      "18 Harley Street",
      "London",
      "England",
      "W1G 9QH",
      "UK",
      "Europe/London",
    ],
  );

  await pool.execute(
    `INSERT INTO user
      (id, clinic_id, email, password_hash, first_name, last_name, role,
       email_verified_at, status, is_active)
     VALUES (?, ?, ?, ?, ?, 'Admin', 'SUPER_ADMIN', CURRENT_TIMESTAMP, 'active', 1)`,
    [userId, clinicId, `${unique(`${prefix}-admin`)}@example.com`, passwordHash, prefix],
  );

  await pool.execute(
    `INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
     VALUES (?, ?, 'SUPER_ADMIN', 'active', 1)`,
    [userId, clinicId],
  );

  return { clinicId, userId };
}

async function createUserWithPermissions(clinicId: string, prefix: string, permissions: string[]) {
  const userId = uuidv4();
  const roleId = uuidv4();
  const roleName = `${prefix}_${Date.now()}`;
  const email = `${unique(prefix)}@clickup.test`;

  await pool.execute(
    `INSERT INTO role (id, clinic_id, name, display_name, is_system)
     VALUES (?, ?, ?, ?, 0)`,
    [roleId, clinicId, roleName, prefix],
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
     VALUES (?, ?, ?, ?, ?, 'Tester', ?, CURRENT_TIMESTAMP, 'active', 1)`,
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

async function closeServer(server: Server) {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function createClientAccount(prefix: string, dataState = "live", dataStateLabel: string | null = null) {
  const clientClinicId = uuidv4();
  const profileId = uuidv4();

  await pool.execute(
    `INSERT INTO clinic
      (id, name, email, phone, address, city, state, postal_code, country, timezone,
       subscription_plan, subscription_status, data_state, data_state_label, is_demo, max_users)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'professional', 'active', ?, ?, ?, 20)`,
    [
      clientClinicId,
      `${prefix} Client`,
      `${unique(prefix)}@client.test`,
      "020 7946 0000",
      "18 Harley Street",
      "London",
      "England",
      "W1G 9QH",
      "UK",
      "Europe/London",
      dataState,
      dataStateLabel,
      dataState === "demo" ? 1 : 0,
    ],
  );

  await pool.execute(
    `INSERT INTO client_account_profile (id, clinic_id, active_services)
     VALUES (?, ?, ?)`,
    [profileId, clientClinicId, JSON.stringify([])],
  );

  return { clientClinicId, profileId };
}

async function createClickUpLifecycleFixture(prefix: string, dataState = "live", dataStateLabel: string | null = null) {
  const workspace = await createWorkspace(prefix);
  const client = await createClientAccount(`${prefix}-client`, dataState, dataStateLabel);
  const connectionId = uuidv4();
  const taskId = uuidv4();
  const mappingId = uuidv4();
  const clientMappingId = uuidv4();
  const externalSuffix = unique(prefix);
  const clickupWorkspaceId = `${externalSuffix}-workspace`;
  const clickupListId = `${externalSuffix}-list`;
  const clickupTaskId = `${externalSuffix}-task`;

  const mutableConfig = config as typeof config & {
    credentials: { encryptionKey: string };
  };
  mutableConfig.credentials.encryptionKey = "clickup-test-encryption-key-32-chars-minimum";

  await pool.execute(
    `INSERT INTO clickup_connection
      (id, clinic_id, workspace_id, workspace_name, status, encrypted_access_token,
       scopes, connected_at, connected_by, last_checked_at)
     VALUES (?, ?, ?, 'Lifecycle workspace', 'connected', ?, JSON_ARRAY('personal_api_token'), CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)`,
    [connectionId, workspace.clinicId, clickupWorkspaceId, encryptProviderCredential("pk_clickup_lifecycle"), workspace.userId],
  );

  await pool.execute(
    `INSERT INTO clickup_client_mapping
      (id, clinic_id, client_account_profile_id, connection_id, workspace_id,
       space_id, folder_id, list_id, mapping_status, mapping_source, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, 'space-1', 'folder-1', ?, 'active', 'api_lookup', ?, ?)`,
    [clientMappingId, workspace.clinicId, client.profileId, connectionId, clickupWorkspaceId, clickupListId, workspace.userId, workspace.userId],
  );

  await pool.execute(
    `INSERT INTO task
      (id, clinic_id, is_internal, title, description, priority, status, board_key,
       client_account_profile_id, due_date, assigned_to, created_by)
     VALUES (?, ?, 1, 'Lifecycle synced task', 'Sync target', 'medium', 'pending', 'delivery', ?, CURRENT_DATE, NULL, ?)`,
    [taskId, workspace.clinicId, client.profileId, workspace.userId],
  );

  await pool.execute(
    `INSERT INTO clickup_task_mapping
      (id, clinic_id, client_account_profile_id, internal_task_id, connection_id,
       workspace_id, clickup_task_id, clickup_list_id, clickup_url, sync_direction,
       mapping_status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'mission_control_to_clickup', 'active', ?, ?)`,
    [
      mappingId,
      workspace.clinicId,
      client.profileId,
      taskId,
      connectionId,
      clickupWorkspaceId,
      clickupTaskId,
      clickupListId,
      `https://app.clickup.com/t/${clickupTaskId}`,
      workspace.userId,
      workspace.userId,
    ],
  );

  return {
    ...workspace,
    client,
    connectionId,
    taskId,
    mappingId,
    clickupWorkspaceId,
    clickupListId,
    clickupTaskId,
  };
}

function signedClickUpPayload(payload: Record<string, unknown>, secret: string) {
  const raw = JSON.stringify(payload);
  return {
    raw,
    signature: createHmac("sha256", secret).update(raw, "utf8").digest("hex"),
  };
}

async function postClickUpWebhook(port: number, payload: Record<string, unknown>, secret: string, signatureOverride?: string) {
  const signed = signedClickUpPayload(payload, secret);
  const response = await fetch(`http://127.0.0.1:${port}/api/clickup/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Signature": signatureOverride || signed.signature,
    },
    body: signed.raw,
  });
  const body: any = await response.json().catch(() => ({}));
  return {
    response,
    body,
  };
}

test.before(async () => {
  await runClickUpMigration();
});

test.after(async () => {
  await pool.end();
});

test("ClickUp task creation route requires internal task write permission", async () => {
  const routesSource = await readFile(routesPath, "utf8");
  assert.match(
    routesSource,
    /["']\/tasks\/create["'][\s\S]*?authorizePermission\(["']internal_tasks:write["']\)/,
  );
  assert.doesNotMatch(
    routesSource,
    /["']\/tasks\/create["'][\s\S]*?authorizeAnyPermission\(["']internal_tasks:write["'],\s*["']client_accounts:write["']\)/,
  );
});

test("ClickUp operations dashboard route requires internal task read permission", async () => {
  const routesSource = await readFile(routesPath, "utf8");
  assert.match(
    routesSource,
    /["']\/operations-dashboard["'][\s\S]*?authorizePermission\(["']internal_tasks:read["']\)/,
  );
});

test("ClickUp task creation route rejects users with only client-account write permission", async () => {
  const workspace = await createWorkspace("clickup-route-permission");
  const clientOnlyUser = await createUserWithPermissions(
    workspace.clinicId,
    "clickup_client_only",
    ["client_accounts:write"],
  );
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start ClickUp route permission test server");
  }

  try {
    const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}/api/clickup/tasks/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clientOnlyUser.token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        internalTaskId: uuidv4(),
        categoryKey: "development",
        title: "Should not create",
        priority: "medium",
      }),
    });
    const body = await response.json() as { message?: string };

    assert.equal(response.status, 403);
    assert.equal(body.message, "You do not have permission to perform this action");
  } finally {
    await closeServer(server);
  }
});

test("ClickUp operations dashboard summarizes live task queues without exposing credentials", async () => {
  const workspace = await createWorkspace("clickup-operations-dashboard");
  const originalFetch = globalThis.fetch;
  const originalConfig = {
    encryptionKey: config.credentials.encryptionKey,
  };
  const mutableConfig = config as unknown as {
    credentials: { encryptionKey: string };
  };
  mutableConfig.credentials.encryptionKey = "clickup-test-encryption-key-32-chars-minimum";

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(12, 0, 0, 0);
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 5);
  nextWeek.setHours(12, 0, 0, 0);

  await pool.execute(
    `INSERT INTO clickup_connection
      (id, clinic_id, workspace_id, workspace_name, status, encrypted_access_token, scopes, connected_by, connected_at)
     VALUES (?, ?, 'cu-workspace-ops', 'Operations Workspace', 'connected', ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      uuidv4(),
      workspace.clinicId,
      encryptProviderCredential("pk_test_operations_dashboard_token"),
      JSON.stringify(["personal_api_token"]),
      workspace.userId,
    ],
  );

  const seenUrls: string[] = [];
  const seenAuthorizationHeaders: string[] = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    seenUrls.push(url);
    const headers = init?.headers instanceof Headers
      ? init.headers
      : new Headers(init?.headers || {});
    seenAuthorizationHeaders.push(String(headers.get("Authorization")));

    if (url.includes("/team/cu-workspace-ops/task") && url.includes("page=0")) {
      return new Response(JSON.stringify({
        tasks: [
          {
            id: "cu-overdue-blocked",
            custom_id: "CG-999",
            name: "Blocked PPC task awaiting Max decision",
            due_date: String(yesterday.getTime()),
            date_updated: String(now.getTime()),
            status: { status: "blocked", type: "open" },
            priority: { id: "1", priority: "urgent" },
            assignees: [],
            tags: [{ name: "blocked" }],
            list: { name: "PPC Tasks" },
            folder: { name: "PPC" },
            space: { name: "Client Alpha" },
            url: "https://app.clickup.com/t/cu-overdue-blocked",
          },
          {
            id: "cu-today-dev",
            name: "Mission Control dashboard QA",
            due_date: String(today.getTime()),
            status: { status: "to do", type: "open" },
            priority: { id: "2", priority: "high" },
            assignees: [{ id: "105", username: "Haile", email: "haile@example.com" }],
            list: { name: "Development Tasks" },
            folder: { name: "Development" },
            space: { name: "Mission Control" },
            url: "https://app.clickup.com/t/cu-today-dev",
          },
          {
            id: "cu-week-seo",
            name: "SEO issue review",
            due_date: String(nextWeek.getTime()),
            status: { status: "to do", type: "open" },
            priority: { id: "3", priority: "normal" },
            assignees: [{ id: "106", username: "SEO", email: null }],
            list: { name: "SEO Tasks" },
            folder: { name: "SEO" },
            space: { name: "Dental Client" },
            url: "https://app.clickup.com/t/cu-week-seo",
          },
          {
            id: "cu-no-deadline",
            name: "Account control missing deadline",
            status: { status: "to do", type: "open" },
            priority: null,
            assignees: [],
            list: { name: "00 - Account Control & Client Management" },
            folder: { name: "Account Control" },
            space: { name: "Client Beta" },
            url: "https://app.clickup.com/t/cu-no-deadline",
          },
        ],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ err: `Unexpected ClickUp request ${url}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const dashboard = await clickUpService.getOperationsDashboard(workspace.clinicId);
    const serialized = JSON.stringify(dashboard);

    assert.equal(seenUrls.length, 1);
    assert.equal(seenAuthorizationHeaders[0], "pk_test_operations_dashboard_token");
    assert.equal(dashboard.workspaceName, "Operations Workspace");
    assert.equal(dashboard.source.live, true);
    assert.equal(dashboard.source.includeClosed, false);
    assert.equal(dashboard.counts.totalOpen, 4);
    assert.equal(dashboard.counts.overdue, 1);
    assert.equal(dashboard.counts.dueToday, 1);
    assert.equal(dashboard.counts.dueThisWeek, 2);
    assert.equal(dashboard.counts.highPriority, 2);
    assert.equal(dashboard.counts.blocked, 1);
    assert.equal(dashboard.counts.awaitingMaxDecision, 1);
    assert.equal(dashboard.counts.noOwner, 2);
    assert.equal(dashboard.counts.noDeadline, 1);
    assert.equal(dashboard.queues.overdue[0]?.id, "cu-overdue-blocked");
    assert.equal(dashboard.queues.awaitingMaxDecision[0]?.customId, "CG-999");
    assert.equal(dashboard.queues.noDeadline[0]?.url, "https://app.clickup.com/t/cu-no-deadline");
    assert.equal(dashboard.workloadByAssignee.some((row) => row.assignee === "Unassigned" && row.totalOpen === 2), true);
    assert.equal(dashboard.workstreamCounts.some((row) => row.label === "PPC" && row.overdue === 1), true);
    assert.equal(serialized.includes("pk_test_operations_dashboard_token"), false);
    assert.equal(serialized.includes("cu-workspace-ops"), false);
    assert.equal(Object.hasOwn(dashboard as any, "workspaceId"), false);
  } finally {
    globalThis.fetch = originalFetch;
    mutableConfig.credentials.encryptionKey = originalConfig.encryptionKey;
  }
});

test("ClickUp client mapping is stable by client profile and rejects reused delivery structures", async () => {
  const workspace = await createWorkspace("clickup-client-map");
  const clientA = await createClientAccount("clickup-alpha");
  const clientB = await createClientAccount("clickup-beta");
  const access = { canManageAllClientAccounts: true };

  const mapping = await clickUpService.saveClientMapping(
    workspace.clinicId,
    workspace.userId,
    clientA.profileId,
    {
      workspaceId: "cu-workspace-1",
      spaceId: "space-a",
      folderId: "folder-a",
      listId: "list-a",
      deliveryRootTaskId: "task-root-a",
      deliveryUrl: "https://app.clickup.com/123/v/l/folder-a",
    },
    access,
  );

  assert.equal(mapping?.clientAccountProfileId, clientA.profileId);
  assert.equal(mapping?.workspaceId, "cu-workspace-1");
  assert.equal(mapping?.deterministic, true);

  await assert.rejects(
    () => clickUpService.saveClientMapping(
      workspace.clinicId,
      workspace.userId,
      clientB.profileId,
      {
        workspaceId: "cu-workspace-1",
        spaceId: "space-a",
        folderId: "folder-a",
        listId: "list-a",
        deliveryRootTaskId: "task-root-a",
      },
      access,
    ),
    /already mapped to another client account/,
  );
});

test("ClickUp task mapping rejects cross-client task reuse and wrong internal task ownership", async () => {
  const workspace = await createWorkspace("clickup-task-map");
  const clientA = await createClientAccount("clickup-task-alpha");
  const clientB = await createClientAccount("clickup-task-beta");
  const taskId = uuidv4();
  const access = { canManageAllClientAccounts: true };

  await pool.execute(
    `INSERT INTO task
      (id, clinic_id, is_internal, title, priority, status, board_key, client_account_profile_id, created_by)
     VALUES (?, ?, 1, 'Prepare ClickUp mapping proof', 'medium', 'pending', 'delivery', ?, ?)`,
    [taskId, workspace.clinicId, clientA.profileId, workspace.userId],
  );

  const mapping = await clickUpService.saveTaskMapping(
    workspace.clinicId,
    workspace.userId,
    {
      clientAccountProfileId: clientA.profileId,
      internalTaskId: taskId,
      workspaceId: "cu-workspace-2",
      clickupTaskId: "cu-task-1",
      clickupListId: "cu-list-1",
      clickupUrl: "https://app.clickup.com/t/cu-task-1",
    },
    access,
  );

  assert.equal(mapping.clientAccountProfileId, clientA.profileId);
  assert.equal(mapping.internalTaskId, taskId);

  await assert.rejects(
    () => clickUpService.saveTaskMapping(
      workspace.clinicId,
      workspace.userId,
      {
        clientAccountProfileId: clientB.profileId,
        workspaceId: "cu-workspace-2",
        clickupTaskId: "cu-task-1",
      },
      access,
    ),
    /already mapped to another client account/,
  );

  await assert.rejects(
    () => clickUpService.saveTaskMapping(
      workspace.clinicId,
      workspace.userId,
      {
        clientAccountProfileId: clientB.profileId,
        internalTaskId: taskId,
        workspaceId: "cu-workspace-2",
        clickupTaskId: "cu-task-2",
      },
      access,
    ),
    /Internal task is not available to this client account/,
  );
});

test("ClickUp revoke clears stored tokens and keeps a sanitized connection response", async () => {
  const workspace = await createWorkspace("clickup-revoke");
  const connectionId = uuidv4();

  await pool.execute(
    `INSERT INTO clickup_connection
      (id, clinic_id, workspace_id, workspace_name, status, encrypted_access_token,
       encrypted_refresh_token, connected_by, connected_at)
     VALUES (?, ?, 'cu-workspace-revoke', 'Approved Workspace', 'connected',
       'enc:cred:v1:test:test:test', 'enc:cred:v1:test:test:refresh', ?, CURRENT_TIMESTAMP)`,
    [connectionId, workspace.clinicId, workspace.userId],
  );

  const revoked = await clickUpService.revoke(workspace.clinicId, workspace.userId);

  assert.equal(revoked.id, connectionId);
  assert.equal(revoked.status, "revoked");
  assert.equal(revoked.tokenStored, false);
  assert.equal(revoked.refreshTokenStored, false);
});

test("ClickUp configured API token connection validates team ID and stores encrypted token", async () => {
  const workspace = await createWorkspace("clickup-api-token");
  const originalFetch = globalThis.fetch;
  const originalConfig = {
    apiToken: config.clickup.apiToken,
    teamId: config.clickup.teamId,
    encryptionKey: config.credentials.encryptionKey,
  };
  const mutableConfig = config as unknown as {
    clickup: { apiToken: string; teamId: string };
    credentials: { encryptionKey: string };
  };
  const seenAuthorizationHeaders: string[] = [];

  mutableConfig.clickup.apiToken = "pk_test_clickup_personal_token";
  mutableConfig.clickup.teamId = "cu-team-approved";
  mutableConfig.credentials.encryptionKey = "clickup-test-encryption-key-32-chars-minimum";

  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    assert.equal(String(input), `${config.clickup.apiBaseUrl.replace(/\/+$/, "")}/team`);
    seenAuthorizationHeaders.push(String(init?.headers && (init.headers as Record<string, string>).Authorization));
    return new Response(JSON.stringify({
      teams: [
        { id: "cu-team-approved", name: "Approved ClickUp Workspace" },
      ],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const connection = await clickUpService.connectConfiguredApiToken(workspace.clinicId, workspace.userId);

    assert.equal(seenAuthorizationHeaders[0], "pk_test_clickup_personal_token");
    assert.equal(connection.workspaceId, "cu-team-approved");
    assert.equal(connection.workspaceName, "Approved ClickUp Workspace");
    assert.equal(connection.status, "connected");
    assert.equal(connection.tokenStored, true);
    assert.equal(connection.refreshTokenStored, false);
    assert.deepEqual(connection.scopes, ["personal_api_token"]);
    assert.equal((connection as any).apiToken, undefined);
    assert.equal((connection as any).accessToken, undefined);
    assert.equal((connection as any).encryptedAccessToken, undefined);
    assert.ok(!JSON.stringify(connection).includes("pk_test_clickup_personal_token"));

    const [rows]: any = await pool.execute(
      `SELECT encrypted_access_token as encryptedAccessToken
       FROM clickup_connection
       WHERE id = ?
       LIMIT 1`,
      [connection.id],
    );
    assert.notEqual(rows[0].encryptedAccessToken, "pk_test_clickup_personal_token");
    assert.ok(String(rows[0].encryptedAccessToken).startsWith("enc:cred:"));
  } finally {
    globalThis.fetch = originalFetch;
    mutableConfig.clickup.apiToken = originalConfig.apiToken;
    mutableConfig.clickup.teamId = originalConfig.teamId;
    mutableConfig.credentials.encryptionKey = originalConfig.encryptionKey;
  }
});

test("ClickUp OAuth connection refreshes expired tokens before provider requests", async () => {
  const workspace = await createWorkspace("clickup-oauth-refresh");
  const originalFetch = globalThis.fetch;
  const originalConfig = {
    clientId: config.clickup.clientId,
    clientSecret: config.clickup.clientSecret,
    encryptionKey: config.credentials.encryptionKey,
  };
  const mutableConfig = config as unknown as {
    clickup: { clientId: string; clientSecret: string };
    credentials: { encryptionKey: string };
  };
  mutableConfig.clickup.clientId = "clickup-oauth-client";
  mutableConfig.clickup.clientSecret = "clickup-oauth-secret";
  mutableConfig.credentials.encryptionKey = "clickup-test-encryption-key-32-chars-minimum";

  const connectionId = uuidv4();
  await pool.execute(
    `INSERT INTO clickup_connection
      (id, clinic_id, workspace_id, workspace_name, status, encrypted_access_token,
       encrypted_refresh_token, token_expires_at, scopes, connected_by, connected_at)
     VALUES (?, ?, 'cu-workspace-refresh', 'Refresh Workspace', 'connected', ?, ?,
       '2000-01-01 00:00:00', JSON_ARRAY('task:read'), ?, CURRENT_TIMESTAMP)`,
    [
      connectionId,
      workspace.clinicId,
      encryptProviderCredential("expired-access-token"),
      encryptProviderCredential("refresh-token-one"),
      workspace.userId,
    ],
  );

  const seenAuthorizationHeaders: string[] = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/oauth/token")) {
      const body = JSON.parse(String(init?.body || "{}"));
      assert.equal(body.client_id, "clickup-oauth-client");
      assert.equal(body.client_secret, "clickup-oauth-secret");
      assert.equal(body.grant_type, "refresh_token");
      assert.equal(body.refresh_token, "refresh-token-one");
      return new Response(JSON.stringify({
        access_token: "refreshed-access-token",
        refresh_token: "refresh-token-two",
        expires_in: 3600,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/team/cu-workspace-refresh/space?archived=false")) {
      const headers = init?.headers instanceof Headers
        ? init.headers
        : new Headers(init?.headers || {});
      seenAuthorizationHeaders.push(String(headers.get("Authorization")));
      return new Response(JSON.stringify({ spaces: [{ id: "space-1", name: "Delivery" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ err: "unexpected" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  try {
    const spaces = await clickUpService.listRemoteSpaces(workspace.clinicId, "cu-workspace-refresh");
    assert.deepEqual(spaces, [{ id: "space-1", name: "Delivery" }]);
    assert.deepEqual(seenAuthorizationHeaders, ["Bearer refreshed-access-token"]);

    const [rows]: any = await pool.execute(
      `SELECT encrypted_access_token as encryptedAccessToken,
              encrypted_refresh_token as encryptedRefreshToken,
              token_expires_at as tokenExpiresAt,
              last_error as lastError
       FROM clickup_connection
       WHERE id = ?
       LIMIT 1`,
      [connectionId],
    );
    assert.notEqual(rows[0].encryptedAccessToken, "refreshed-access-token");
    assert.notEqual(rows[0].encryptedRefreshToken, "refresh-token-two");
    assert.ok(rows[0].encryptedAccessToken.startsWith("enc:cred:"));
    assert.ok(rows[0].encryptedRefreshToken.startsWith("enc:cred:"));
    assert.ok(rows[0].tokenExpiresAt);
    assert.equal(rows[0].lastError, null);
  } finally {
    globalThis.fetch = originalFetch;
    mutableConfig.clickup.clientId = originalConfig.clientId;
    mutableConfig.clickup.clientSecret = originalConfig.clientSecret;
    mutableConfig.credentials.encryptionKey = originalConfig.encryptionKey;
  }
});

test("ClickUp member lookup falls back to workspace payload when the direct members endpoint fails", async () => {
  const workspace = await createWorkspace("clickup-member-fallback");
  const originalFetch = globalThis.fetch;
  const originalConfig = {
    apiToken: config.clickup.apiToken,
    teamId: config.clickup.teamId,
    encryptionKey: config.credentials.encryptionKey,
  };
  const mutableConfig = config as unknown as {
    clickup: { apiToken: string; teamId: string };
    credentials: { encryptionKey: string };
  };

  mutableConfig.clickup.apiToken = "pk_test_clickup_member_token";
  mutableConfig.clickup.teamId = "cu-team-member-fallback";
  mutableConfig.credentials.encryptionKey = "clickup-test-encryption-key-32-chars-minimum";

  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/team")) {
      return new Response(JSON.stringify({
        teams: [
          {
            id: "cu-team-member-fallback",
            name: "Member Fallback Workspace",
            members: [
              { user: { id: "101", username: "alex", email: "alex@example.com" } },
              { user: { id: "102", username: "sam", email: "sam@example.com" } },
            ],
          },
        ],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/team/cu-team-member-fallback/user")) {
      return new Response(JSON.stringify({ err: "Members endpoint unavailable" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unexpected ClickUp request", url, method: init?.method || "GET" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await clickUpService.connectConfiguredApiToken(workspace.clinicId, workspace.userId);
    const members = await clickUpService.listRemoteMembers(workspace.clinicId, "cu-team-member-fallback");

    assert.deepEqual(members, [
      { id: "101", username: "alex", email: "alex@example.com" },
      { id: "102", username: "sam", email: "sam@example.com" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    mutableConfig.clickup.apiToken = originalConfig.apiToken;
    mutableConfig.clickup.teamId = originalConfig.teamId;
    mutableConfig.credentials.encryptionKey = originalConfig.encryptionKey;
  }
});

test("ClickUp task creation requires category and priority mappings before sending to ClickUp", async () => {
  const workspace = await createWorkspace("clickup-task-create-config");
  const client = await createClientAccount("clickup-create-config");
  const taskId = uuidv4();

  await pool.execute(
    `INSERT INTO task
      (id, clinic_id, is_internal, title, description, priority, status, board_key, client_account_profile_id, created_by)
     VALUES (?, ?, 1, 'Prepare delivery handoff', 'Create the first delivery task.', 'medium', 'pending', 'delivery', ?, ?)`,
    [taskId, workspace.clinicId, client.profileId, workspace.userId],
  );

  await assert.rejects(
    () => clickUpService.createClickUpTask(
      workspace.clinicId,
      workspace.userId,
      {
        internalTaskId: taskId,
        categoryKey: "development",
        title: "Prepare delivery handoff",
        priority: "medium",
      },
      [],
      { canManageAllClientAccounts: true },
    ),
    /ClickUp mapping is missing for development/,
  );
});

test("ClickUp task creation blocks duplicate Mission Control task sends before provider call", async () => {
  const workspace = await createWorkspace("clickup-task-duplicate");
  const client = await createClientAccount("clickup-duplicate");
  const taskId = uuidv4();

  await pool.execute(
    `INSERT INTO clickup_connection
      (id, clinic_id, workspace_id, workspace_name, status, encrypted_access_token, scopes, connected_by, connected_at)
     VALUES (?, ?, 'cu-workspace-duplicate', 'Duplicate Workspace', 'connected', ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      uuidv4(),
      workspace.clinicId,
      "pk_test_duplicate_token",
      JSON.stringify(["personal_api_token"]),
      workspace.userId,
    ],
  );
  await pool.execute(
    `INSERT INTO task
      (id, clinic_id, is_internal, title, description, priority, status, board_key, client_account_profile_id, created_by)
     VALUES (?, ?, 1, 'Duplicate-safe ClickUp task', 'Only one ClickUp task should be created.', 'high', 'pending', 'delivery', ?, ?)`,
    [taskId, workspace.clinicId, client.profileId, workspace.userId],
  );
  await clickUpService.saveTaskMapping(
    workspace.clinicId,
    workspace.userId,
    {
      clientAccountProfileId: client.profileId,
      internalTaskId: taskId,
      workspaceId: "cu-workspace-duplicate",
      clickupTaskId: "cu-existing-task",
      clickupListId: "cu-list",
      clickupUrl: "https://app.clickup.com/t/cu-existing-task",
      mappingStatus: "active",
      syncDirection: "mission_control_to_clickup",
    },
    { canManageAllClientAccounts: true },
  );

  let providerCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    providerCalled = true;
    return new Response(JSON.stringify({ id: "should-not-create" }), { status: 200 });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => clickUpService.createClickUpTask(
        workspace.clinicId,
        workspace.userId,
        {
          internalTaskId: taskId,
          categoryKey: "development",
          title: "Duplicate-safe ClickUp task",
          priority: "high",
        },
        [],
        { canManageAllClientAccounts: true },
      ),
      /already has a ClickUp task link/,
    );
    assert.equal(providerCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ClickUp task creation blocks needs-review recovered mappings before provider call", async () => {
  const workspace = await createWorkspace("clickup-task-needs-review");
  const client = await createClientAccount("clickup-needs-review");
  const taskId = uuidv4();

  await pool.execute(
    `INSERT INTO task
      (id, clinic_id, is_internal, title, description, priority, status, board_key, client_account_profile_id, created_by)
     VALUES (?, ?, 1, 'Needs-review ClickUp task', 'Remote creation was recovered but still needs review.', 'high', 'pending', 'delivery', ?, ?)`,
    [taskId, workspace.clinicId, client.profileId, workspace.userId],
  );
  await pool.execute(
    `INSERT INTO clickup_task_mapping
      (id, clinic_id, client_account_profile_id, internal_task_id, workspace_id, clickup_task_id,
       clickup_list_id, clickup_url, sync_direction, mapping_status, created_by, updated_by)
     VALUES (?, ?, ?, ?, 'cu-workspace-needs-review', 'cu-created-needs-review',
       'cu-list', 'https://app.clickup.com/t/cu-created-needs-review', 'mission_control_to_clickup', 'needs_review', ?, ?)`,
    [uuidv4(), workspace.clinicId, client.profileId, taskId, workspace.userId, workspace.userId],
  );

  let providerCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    providerCalled = true;
    return new Response(JSON.stringify({ id: "should-not-create" }), { status: 200 });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => clickUpService.createClickUpTask(
        workspace.clinicId,
        workspace.userId,
        {
          internalTaskId: taskId,
          categoryKey: "development",
          title: "Needs-review ClickUp task",
          priority: "high",
        },
        [],
        { canManageAllClientAccounts: true },
      ),
      /pending ClickUp creation that needs review/,
    );
    assert.equal(providerCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ClickUp task creation saves local mapping before attachment upload failures so retries cannot duplicate remote tasks", async () => {
  const workspace = await createWorkspace("clickup-task-attachment-failure");
  const client = await createClientAccount("clickup-attachment-failure");
  const taskId = uuidv4();
  const originalFetch = globalThis.fetch;
  const originalConfig = {
    encryptionKey: config.credentials.encryptionKey,
  };
  const mutableConfig = config as unknown as {
    credentials: { encryptionKey: string };
  };

  mutableConfig.credentials.encryptionKey = "clickup-test-encryption-key-32-chars-minimum";

  const connectionId = uuidv4();
  await pool.execute(
    `INSERT INTO clickup_connection
      (id, clinic_id, workspace_id, workspace_name, status, encrypted_access_token, scopes, connected_by, connected_at)
     VALUES (?, ?, 'cu-workspace-attachment-failure', 'Attachment Failure Workspace', 'connected', ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      connectionId,
      workspace.clinicId,
      encryptProviderCredential("pk_test_attachment_failure_token"),
      JSON.stringify(["personal_api_token"]),
      workspace.userId,
    ],
  );
  await pool.execute(
    `INSERT INTO task
      (id, clinic_id, is_internal, title, description, priority, status, board_key, client_account_profile_id, created_by)
     VALUES (?, ?, 1, 'Retry-safe ClickUp task', 'Attachment failure should not create duplicates.', 'high', 'pending', 'delivery', ?, ?)`,
    [taskId, workspace.clinicId, client.profileId, workspace.userId],
  );
  await clickUpService.saveCategoryMapping(
    workspace.clinicId,
    workspace.userId,
    client.profileId,
    {
      connectionId,
      workspaceId: "cu-workspace-attachment-failure",
      spaceId: "cu-space",
      categoryKey: "development",
      folderId: "cu-folder",
      listId: "cu-list",
      defaultAssigneeIds: ["101"],
      mappingStatus: "active",
      mappingSource: "api_lookup",
    },
    { canManageAllClientAccounts: true },
  );
  await clickUpService.savePriorityMapping(
    workspace.clinicId,
    workspace.userId,
    { missionControlPriority: "high", clickupPriority: 2 },
  );

  let createdRemoteTaskCount = 0;
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/list/cu-list/task") && init?.method === "POST") {
      createdRemoteTaskCount += 1;
      return new Response(JSON.stringify({
        id: "cu-created-before-attachment-failure",
        url: "https://app.clickup.com/t/cu-created-before-attachment-failure",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.endsWith("/task/cu-created-before-attachment-failure/attachment") && init?.method === "POST") {
      return new Response(JSON.stringify({ err: "attachment upload failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ err: `Unexpected ClickUp request ${url}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await clickUpService.createClickUpTask(
      workspace.clinicId,
      workspace.userId,
      {
        internalTaskId: taskId,
        categoryKey: "development",
        title: "Retry-safe ClickUp task",
        description: "Send this once.",
        priority: "high",
        assigneeIds: ["101"],
      },
      [{
        originalname: "handoff.txt",
        mimetype: "text/plain",
        buffer: Buffer.from("handoff"),
      } as Express.Multer.File],
      { canManageAllClientAccounts: true },
    );

    assert.equal(result.mapping.clickupTaskId, "cu-created-before-attachment-failure");
    assert.deepEqual(result.attachmentErrors, ["handoff.txt"]);

    const mapping = await clickUpService.listTaskMappings(
      workspace.clinicId,
      client.profileId,
      { canManageAllClientAccounts: true },
    );
    assert.equal(mapping.length, 1);
    assert.equal(mapping[0].internalTaskId, taskId);
    assert.equal(mapping[0].clickupTaskId, "cu-created-before-attachment-failure");
    assert.equal(mapping[0].mappingStatus, "active");

    await assert.rejects(
      () => clickUpService.createClickUpTask(
        workspace.clinicId,
        workspace.userId,
        {
          internalTaskId: taskId,
          categoryKey: "development",
          title: "Retry-safe ClickUp task",
          priority: "high",
          assigneeIds: ["101"],
        },
        [],
        { canManageAllClientAccounts: true },
      ),
      /already has a ClickUp task link/,
    );
    assert.equal(createdRemoteTaskCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
    mutableConfig.credentials.encryptionKey = originalConfig.encryptionKey;
  }
});

test("ClickUp failed mapping replay preserves the review record when prerequisites are missing", async () => {
  const fixture = await createClickUpLifecycleFixture("clickup-replay-missing-category");

  await pool.execute(
    `UPDATE clickup_task_mapping
     SET clickup_task_id = ?,
         mapping_status = 'needs_review'
     WHERE id = ?`,
    [`pending:${fixture.taskId}`, fixture.mappingId],
  );

  await assert.rejects(
    () => clickUpService.replayTaskMapping(
      fixture.clinicId,
      fixture.mappingId,
      fixture.userId,
      { canManageAllClientAccounts: true },
    ),
    /category mapping for this list no longer exists/,
  );

  const [mappingRows]: any = await pool.execute(
    `SELECT mapping_status as mappingStatus, clickup_task_id as clickupTaskId
     FROM clickup_task_mapping
     WHERE id = ?`,
    [fixture.mappingId],
  );
  assert.equal(mappingRows[0].mappingStatus, "needs_review");
  assert.equal(mappingRows[0].clickupTaskId, `pending:${fixture.taskId}`);
});

test("ClickUp failed mapping replay searches paged provider results before recreating a task", async () => {
  const fixture = await createClickUpLifecycleFixture("clickup-replay-paged-search");
  const originalFetch = globalThis.fetch;
  const requestedPages: string[] = [];
  let createCalls = 0;

  await clickUpService.saveCategoryMapping(
    fixture.clinicId,
    fixture.userId,
    fixture.client.profileId,
    {
      connectionId: fixture.connectionId,
      workspaceId: fixture.clickupWorkspaceId,
      spaceId: "space-1",
      folderId: "folder-1",
      listId: fixture.clickupListId,
      categoryKey: "development",
      defaultAssigneeIds: ["105"],
      mappingStatus: "active",
      mappingSource: "api_lookup",
    },
    { canManageAllClientAccounts: true },
  );

  await pool.execute(
    `UPDATE clickup_task_mapping
     SET clickup_task_id = ?,
         mapping_status = 'needs_review'
     WHERE id = ?`,
    [`pending:${fixture.taskId}`, fixture.mappingId],
  );
  const [preReplayRows]: any = await pool.execute(
    "SELECT id FROM clickup_task_mapping WHERE id = ? AND clinic_id = ?",
    [fixture.mappingId, fixture.clinicId],
  );
  assert.equal(preReplayRows.length, 1);

  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes(`/list/${fixture.clickupListId}/task`) && init?.method === "GET") {
      requestedPages.push(url);
      const parsed = new URL(url);
      const page = parsed.searchParams.get("page");
      if (page === "0") {
        return new Response(JSON.stringify({
          tasks: Array.from({ length: 100 }, (_, index) => ({
            id: `page-0-task-${index}`,
            description: `Other synced task ${index}`,
          })),
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        tasks: [{
          id: "page-1-existing-task",
          url: "https://app.clickup.com/t/page-1-existing-task",
          description: `Recovered task\n\n[Mission Control Task ID: ${fixture.taskId}]`,
        }],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes(`/list/${fixture.clickupListId}/task`) && init?.method === "POST") {
      createCalls += 1;
      return new Response(JSON.stringify({ id: "should-not-create" }), { status: 200 });
    }
    return new Response(JSON.stringify({ err: `Unexpected ClickUp request ${url}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const replayed = await clickUpService.replayTaskMapping(
      fixture.clinicId,
      fixture.mappingId,
      fixture.userId,
      { canManageAllClientAccounts: true },
    );

    assert.equal(replayed.mapping.clickupTaskId, "page-1-existing-task");
    assert.equal(replayed.mapping.mappingStatus, "active");
    assert.equal(createCalls, 0);
    assert.equal(requestedPages.some((url) => url.includes("page=0")), true);
    assert.equal(requestedPages.some((url) => url.includes("page=1")), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ClickUp webhook applies mapped lifecycle events exactly once and rejects stale updates", async () => {
  const fixture = await createClickUpLifecycleFixture("clickup-webhook-status");
  const secret = "clickup-webhook-secret-32-character-value";
  const mutableConfig = config as typeof config & { clickup: { webhookSecret: string } };
  const originalSecret = config.clickup.webhookSecret;
  mutableConfig.clickup.webhookSecret = secret;
  const server = app.listen(0);

  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    const webhookId = unique("wh-status");
    const newerDate = Date.now();
    const completePayload = {
      webhook_id: webhookId,
      event: "taskStatusUpdated",
      task_id: fixture.clickupTaskId,
      history_items: [{
        id: `${webhookId}-complete`,
        date: newerDate,
        after: { status: "complete", type: "closed" },
      }],
    };

    const first = await postClickUpWebhook(port, completePayload, secret);
    assert.equal(first.response.status, 202);
    assert.equal(first.body.data.duplicate, false);
    assert.equal(first.body.data.processingStatus, "processed");

    const duplicate = await postClickUpWebhook(port, completePayload, secret);
    assert.equal(duplicate.response.status, 202);
    assert.equal(duplicate.body.data.duplicate, true);

    const stalePayload = {
      webhook_id: webhookId,
      event: "taskStatusUpdated",
      task_id: fixture.clickupTaskId,
      history_items: [{
        id: `${webhookId}-stale`,
        date: newerDate - 60_000,
        after: { status: "open", type: "open" },
      }],
    };
    const stale = await postClickUpWebhook(port, stalePayload, secret);
    assert.equal(stale.response.status, 202);
    assert.equal(stale.body.data.processingStatus, "stale");

    const [taskRows]: any = await pool.execute(
      "SELECT status FROM task WHERE id = ?",
      [fixture.taskId],
    );
    assert.equal(taskRows[0].status, "completed");

    const [eventRows]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM clickup_webhook_event WHERE provider_event_key = ?",
      [`${webhookId}:${webhookId}-complete`],
    );
    assert.equal(Number(eventRows[0].count), 1);
  } finally {
    mutableConfig.clickup.webhookSecret = originalSecret;
    await closeServer(server);
  }
});

test("ClickUp webhook blocks invalid signatures and quarantines unmapped events", async () => {
  const secret = "clickup-webhook-secret-32-character-value";
  const mutableConfig = config as typeof config & { clickup: { webhookSecret: string } };
  const originalSecret = config.clickup.webhookSecret;
  mutableConfig.clickup.webhookSecret = secret;
  const server = app.listen(0);

  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    const webhookId = unique("wh-invalid");
    const payload = {
      webhook_id: webhookId,
      event: "taskStatusUpdated",
      task_id: "unknown-task",
      history_items: [{ id: `${webhookId}-history`, date: Date.now(), after: { status: "complete" } }],
    };

    const invalid = await postClickUpWebhook(port, payload, secret, "0".repeat(64));
    assert.equal(invalid.response.status, 401);

    const accepted = await postClickUpWebhook(port, payload, secret);
    assert.equal(accepted.response.status, 202);
    assert.equal(accepted.body.data.processingStatus, "quarantined");
    const [rows]: any = await pool.execute(
      `SELECT processing_status as processingStatus, error_class as errorClass
       FROM clickup_webhook_event
       WHERE provider_event_key = ?`,
      [`${webhookId}:${webhookId}-history`],
    );
    assert.equal(rows[0].processingStatus, "quarantined");
    assert.equal(rows[0].errorClass, "unmapped_client");
  } finally {
    mutableConfig.clickup.webhookSecret = originalSecret;
    await closeServer(server);
  }
});

test("ClickUp webhook updates due date, assignee and provider-created tasks without leaking raw payloads", async () => {
  const fixture = await createClickUpLifecycleFixture("clickup-webhook-fields");
  const secret = "clickup-webhook-secret-32-character-value";
  const mutableConfig = config as typeof config & { clickup: { webhookSecret: string } };
  const originalSecret = config.clickup.webhookSecret;
  mutableConfig.clickup.webhookSecret = secret;
  const server = app.listen(0);

  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    const webhookId = unique("wh-fields");
    const dueDate = new Date("2026-08-28T12:00:00Z").getTime();
    const duePayload = {
      webhook_id: webhookId,
      event: "taskDueDateUpdated",
      task_id: fixture.clickupTaskId,
      history_items: [{ id: `${webhookId}-due`, date: Date.now(), after: dueDate }],
    };
    const assigneePayload = {
      webhook_id: webhookId,
      event: "taskAssigneeUpdated",
      task_id: fixture.clickupTaskId,
      history_items: [{ id: `${webhookId}-assignee`, date: Date.now() + 1, after: [{ id: "105" }, { id: "106", email: "hidden@example.com" }] }],
    };
    const createdPayload = {
      webhook_id: webhookId,
      event: "taskCreated",
      task_id: `${webhookId}-provider-created-task`,
      list_id: fixture.clickupListId,
      history_items: [{ id: `${webhookId}-created`, date: Date.now() + 2 }],
    };

    assert.equal((await postClickUpWebhook(port, duePayload, secret)).body.data.processingStatus, "processed");
    assert.equal((await postClickUpWebhook(port, assigneePayload, secret)).body.data.processingStatus, "processed");
    assert.equal((await postClickUpWebhook(port, createdPayload, secret)).body.data.processingStatus, "processed");

    const [taskRows]: any = await pool.execute(
      "SELECT DATE_FORMAT(due_date, '%Y-%m-%d') as dueDate, assigned_to as assignedTo FROM task WHERE id = ?",
      [fixture.taskId],
    );
    assert.equal(taskRows[0].dueDate, "2026-08-28");
    assert.equal(taskRows[0].assignedTo, "ClickUp assignee 105, ClickUp assignee 106");

    const [mappingRows]: any = await pool.execute(
      `SELECT mapping_status as mappingStatus, internal_task_id as internalTaskId
       FROM clickup_task_mapping
       WHERE clickup_task_id = ?`,
      [`${webhookId}-provider-created-task`],
    );
    assert.equal(mappingRows[0].mappingStatus, "needs_review");
    assert.equal(mappingRows[0].internalTaskId, null);

    const [payloadRows]: any = await pool.execute(
      `SELECT payload_summary as payloadSummary
       FROM clickup_webhook_event
       WHERE provider_event_key = ?`,
      [`${webhookId}:${webhookId}-assignee`],
    );
    assert.doesNotMatch(JSON.stringify(payloadRows[0].payloadSummary), /hidden@example\.com/);
  } finally {
    mutableConfig.clickup.webhookSecret = originalSecret;
    await closeServer(server);
  }
});

test("Mission Control internal task edits sync governed fields back to ClickUp", async () => {
  const fixture = await createClickUpLifecycleFixture("clickup-outbound-sync");
  const originalFetch = globalThis.fetch;
  const providerRequests: Array<{ url: string; init: RequestInit | undefined; body: any }> = [];

  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    providerRequests.push({
      url: String(input),
      init,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return new Response(JSON.stringify({ id: fixture.clickupTaskId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await tasksService.updateInternalTask(
      fixture.clinicId,
      fixture.userId,
      fixture.taskId,
      {
        status: "completed",
        dueDate: "2026-08-30",
        assignedTo: "ClickUp assignee 105, ClickUp assignee 106",
      },
      { canManageAllClientAccounts: true },
    );

    const providerRequest = providerRequests[0];
    assert.ok(providerRequest, "expected outbound ClickUp request");
    assert.match(providerRequest.url, new RegExp(`/task/${fixture.clickupTaskId}$`));
    assert.equal(providerRequest.init?.method, "PUT");
    assert.equal(providerRequest.body.status, "complete");
    assert.equal(new Date(providerRequest.body.due_date).toISOString().slice(0, 10), "2026-08-30");
    assert.deepEqual(providerRequest.body.assignees, { add: [105, 106] });

    const [auditRows]: any = await pool.execute(
      `SELECT action, changes
       FROM audit_log
       WHERE clinic_id = ?
         AND entity_id = ?
         AND action = 'CLICKUP_OUTBOUND_TASK_SYNCED'
       ORDER BY created_at DESC
       LIMIT 1`,
      [fixture.clinicId, fixture.taskId],
    );
    assert.equal(auditRows[0].action, "CLICKUP_OUTBOUND_TASK_SYNCED");
    assert.match(JSON.stringify(auditRows[0].changes), /syncLagSeconds/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Mission Control outbound sync holds unmapped assignees for review", async () => {
  const fixture = await createClickUpLifecycleFixture("clickup-outbound-review");
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;

  globalThis.fetch = (async () => {
    providerCalls += 1;
    return new Response(JSON.stringify({ id: fixture.clickupTaskId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await tasksService.updateInternalTask(
      fixture.clinicId,
      fixture.userId,
      fixture.taskId,
      { assignedTo: "Haile Michael" },
      { canManageAllClientAccounts: true },
    );

    assert.equal(providerCalls, 0);
    const [mappingRows]: any = await pool.execute(
      `SELECT mapping_status as mappingStatus
       FROM clickup_task_mapping
       WHERE id = ?`,
      [fixture.mappingId],
    );
    assert.equal(mappingRows[0].mappingStatus, "needs_review");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ClickUp delete archive and moved lifecycle events are non destructive and mark review where needed", async () => {
  const archiveFixture = await createClickUpLifecycleFixture("clickup-webhook-archive");
  const moveFixture = await createClickUpLifecycleFixture("clickup-webhook-move");
  const secret = "clickup-webhook-secret-32-character-value";
  const mutableConfig = config as typeof config & { clickup: { webhookSecret: string } };
  const originalSecret = config.clickup.webhookSecret;
  mutableConfig.clickup.webhookSecret = secret;
  const server = app.listen(0);

  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    const archiveWebhookId = unique("wh-archive");
    const moveWebhookId = unique("wh-move");
    assert.equal((await postClickUpWebhook(port, {
      webhook_id: archiveWebhookId,
      event: "taskArchived",
      task_id: archiveFixture.clickupTaskId,
      history_items: [{ id: `${archiveWebhookId}-history`, date: Date.now() }],
    }, secret)).body.data.processingStatus, "processed");

    assert.equal((await postClickUpWebhook(port, {
      webhook_id: moveWebhookId,
      event: "taskMoved",
      task_id: moveFixture.clickupTaskId,
      list_id: "other-client-list",
      history_items: [{ id: `${moveWebhookId}-history`, date: Date.now(), after: { list_id: "other-client-list" } }],
    }, secret)).body.data.processingStatus, "processed");

    const [archivedRows]: any = await pool.execute(
      "SELECT deleted_at as deletedAt, archived_at as archivedAt FROM task WHERE id = ?",
      [archiveFixture.taskId],
    );
    assert.equal(archivedRows[0].deletedAt, null);
    assert.ok(archivedRows[0].archivedAt, "provider archive should soft-archive the internal task");

    const [moveRows]: any = await pool.execute(
      `SELECT mapping_status as mappingStatus
       FROM clickup_task_mapping
       WHERE id = ?`,
      [moveFixture.mappingId],
    );
    assert.equal(moveRows[0].mappingStatus, "needs_review");
  } finally {
    mutableConfig.clickup.webhookSecret = originalSecret;
    await closeServer(server);
  }
});

test("ClickUp reconciliation classifies 429, 5xx and permanent 4xx provider failures", async () => {
  const fixture429 = await createClickUpLifecycleFixture("clickup-reconcile-429");
  const fixture500 = await createClickUpLifecycleFixture("clickup-reconcile-500");
  const fixture404 = await createClickUpLifecycleFixture("clickup-reconcile-404");
  const originalFetch = globalThis.fetch;

  try {
    let call = 0;
    globalThis.fetch = (async () => {
      call += 1;
      if (call === 1) {
        return new Response(JSON.stringify({ err: "rate limited" }), {
          status: 429,
          headers: { "Retry-After": "2" },
        });
      }
      if (call === 2) {
        return new Response(JSON.stringify({ err: "provider unavailable" }), { status: 503 });
      }
      return new Response(JSON.stringify({ err: "not found" }), { status: 404 });
    }) as typeof fetch;

    const result429 = await clickUpService.runIncrementalReconciliation(1, fixture429.clinicId);
    const result500 = await clickUpService.runIncrementalReconciliation(1, fixture500.clinicId);
    const result404 = await clickUpService.runIncrementalReconciliation(1, fixture404.clinicId);
    assert.equal(result429.failed, 1);
    assert.equal(result500.failed, 1);
    assert.equal(result404.needsReview, 1);

    const [checkpointRows]: any = await pool.execute(
      `SELECT sync_status as syncStatus, last_error as lastError
       FROM clickup_sync_checkpoint
       WHERE clinic_id IN (?, ?, ?)
       ORDER BY created_at ASC`,
      [fixture429.clinicId, fixture500.clinicId, fixture404.clinicId],
    );
    assert.equal(checkpointRows.some((row: any) => row.syncStatus === "retrying" && /rate limited/.test(row.lastError)), true);
    assert.equal(checkpointRows.some((row: any) => row.syncStatus === "retrying" && /provider unavailable/.test(row.lastError)), true);
    assert.equal(checkpointRows.some((row: any) => row.syncStatus === "reconciliation_needed" && /not found/.test(row.lastError)), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ClickUp reconciliation exposes client data-state labels on health and exception rows", async () => {
  const providerFixture = await createClickUpLifecycleFixture(
    "clickup-reconcile-provider-state",
    "provider-dependent",
    "Provider connection required before this feed is complete",
  );

  await pool.execute(
    `UPDATE clickup_task_mapping
     SET mapping_status = 'needs_review'
     WHERE id = ?`,
    [providerFixture.mappingId],
  );

  const webhookId = unique("wh-provider-state");
  await pool.execute(
    `INSERT INTO clickup_webhook_event
      (id, clinic_id, connection_id, client_account_profile_id, task_mapping_id,
       workspace_id, webhook_id, provider_event_key, provider_event_type,
       clickup_task_id, payload_hash, payload_summary, processing_status, retry_count, error_class, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'taskUpdated', ?, ?, ?, 'dead_letter', 5, 'provider_retry_exhausted', 'Retries exhausted')`,
    [
      uuidv4(),
      providerFixture.clinicId,
      providerFixture.connectionId,
      providerFixture.client.profileId,
      providerFixture.mappingId,
      providerFixture.clickupWorkspaceId,
      webhookId,
      `${webhookId}:history`,
      providerFixture.clickupTaskId,
      "0".repeat(64),
      JSON.stringify({ taskId: providerFixture.clickupTaskId, event: "taskUpdated" }),
    ],
  );

  const response = await clickUpService.getReconciliationStatus(providerFixture.clinicId);
  const providerHealth = response.syncHealth.find((row) => row.clientAccountProfileId === providerFixture.client.profileId);
  const providerMapping = response.failedTaskMappings.find((row) => row.clientAccountProfileId === providerFixture.client.profileId);
  const providerEvent = response.deadLetterEvents.find((row) => row.clientAccountProfileId === providerFixture.client.profileId);

  assert.equal(providerHealth?.clientDataState, "provider-dependent");
  assert.equal(providerHealth?.clientDataStateLabel, "Provider connection required before this feed is complete");
  assert.equal(providerMapping?.clientDataState, "provider-dependent");
  assert.equal(providerMapping?.clientDataStateLabel, "Provider connection required before this feed is complete");
  assert.equal(providerEvent?.clientDataState, "provider-dependent");
  assert.equal(providerEvent?.clientDataStateLabel, "Provider connection required before this feed is complete");
});

test("ClickUp dead-letter replay reprocesses the original event with idempotency intact", async () => {
  const fixture = await createClickUpLifecycleFixture("clickup-dead-letter");
  const secret = "clickup-webhook-secret-32-character-value";
  const mutableConfig = config as typeof config & { clickup: { webhookSecret: string } };
  const originalSecret = config.clickup.webhookSecret;
  mutableConfig.clickup.webhookSecret = secret;
  const server = app.listen(0);

  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    const webhookId = unique("wh-dead");
    const payload = {
      webhook_id: webhookId,
      event: "taskStatusUpdated",
      task_id: fixture.clickupTaskId,
      history_items: [{ id: `${webhookId}-history`, date: Date.now(), after: { status: "open" } }],
    };
    const receipt = await postClickUpWebhook(port, payload, secret);
    const eventId = receipt.body.data.eventId;
    await pool.execute(
      `UPDATE clickup_webhook_event
       SET processing_status = 'dead_letter',
           error_class = 'processing_error',
           error_message = 'forced test dead letter'
       WHERE id = ?`,
      [eventId],
    );

    const replayed = await clickUpService.replayDeadLetterEvent(fixture.clinicId, eventId);
    assert.equal(replayed.processingStatus, "processed");

    const [eventRows]: any = await pool.execute(
      `SELECT COUNT(*) as count
       FROM clickup_webhook_event
       WHERE provider_event_key = ?`,
      [`${webhookId}:${webhookId}-history`],
    );
    assert.equal(Number(eventRows[0].count), 1);
  } finally {
    mutableConfig.clickup.webhookSecret = originalSecret;
    await closeServer(server);
  }
});
