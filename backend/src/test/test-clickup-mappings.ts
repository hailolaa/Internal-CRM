import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { v4 as uuidv4 } from "uuid";
import pool from "../config/database.js";
import { config } from "../config/index.js";
import { clickUpService } from "../modules/clickup/clickup.service.js";
import { hashPassword } from "../utils/helpers.js";
import { encryptProviderCredential } from "../utils/provider-credentials.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const routesPath = resolve(currentDir, "../modules/clickup/clickup.routes.js");
const migrationPaths = [
  resolve(currentDir, "../../scripts/migrations/20260730_add_clickup_oauth_and_mappings.sql"),
  resolve(currentDir, "../../scripts/migrations/20260805_add_clickup_category_priority_mappings.sql"),
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

async function createClientAccount(prefix: string) {
  const clientClinicId = uuidv4();
  const profileId = uuidv4();

  await pool.execute(
    `INSERT INTO clinic
      (id, name, email, phone, address, city, state, postal_code, country, timezone,
       subscription_plan, subscription_status, max_users)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'professional', 'active', 20)`,
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
    ],
  );

  await pool.execute(
    `INSERT INTO client_account_profile (id, clinic_id, active_services)
     VALUES (?, ?, ?)`,
    [profileId, clientClinicId, JSON.stringify([])],
  );

  return { clientClinicId, profileId };
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
    await assert.rejects(
      () => clickUpService.createClickUpTask(
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
      ),
      /attachment upload failed/,
    );

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
