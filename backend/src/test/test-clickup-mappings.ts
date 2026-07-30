import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { v4 as uuidv4 } from "uuid";
import pool from "../config/database.js";
import { clickUpService } from "../modules/clickup/clickup.service.js";
import { hashPassword } from "../utils/helpers.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(currentDir, "../../scripts/migrations/20260730_add_clickup_oauth_and_mappings.sql");

function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function runClickUpMigration() {
  const sql = await readFile(migrationPath, "utf8");
  for (const statement of sql.split(/;\s*\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    await pool.query(statement);
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
