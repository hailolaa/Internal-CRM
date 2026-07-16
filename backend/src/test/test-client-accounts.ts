import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { v4 as uuidv4 } from "uuid";
import pool, { testConnection } from "../config/database.js";
import { config } from "../config/index.js";
import { authService } from "../modules/auth/auth.service.js";
import { generateToken, hashPassword } from "../utils/helpers.js";
import clientAccountsRoutes from "../modules/client-accounts/client-accounts.routes.js";
import { clientAccountsService } from "../modules/client-accounts/client-accounts.service.js";
import tasksRoutes from "../modules/tasks/tasks.routes.js";
import errorHandler from "../middleware/errorHandler.js";
import { validate } from "../middleware/validate.js";
import { createClientAccountValidator } from "../modules/client-accounts/client-accounts.validators.js";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
}

async function createClinicAndAdmin(prefix: string) {
  const clinicId = uuidv4();
  const userId = uuidv4();
  const email = uniqueEmail(`${prefix}_admin`);
  const passwordHash = await hashPassword("password123");

  await pool.execute(
    `INSERT INTO clinic
      (id, name, email, phone, address, city, state, postal_code, country, timezone,
       subscription_plan, subscription_status, max_users)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'professional', 'active', 20)`,
    [
      clinicId,
      `${prefix} Workspace`,
      email,
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
      (id, clinic_id, email, password_hash, first_name, last_name, phone, role,
       email_verified_at, status, is_active)
     VALUES (?, ?, ?, ?, ?, 'Admin', '555-0100', 'SUPER_ADMIN',
       CURRENT_TIMESTAMP, 'active', 1)`,
    [userId, clinicId, email, passwordHash, prefix],
  );

  await pool.execute(
    `INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
     VALUES (?, ?, 'SUPER_ADMIN', 'active', 1)`,
    [userId, clinicId],
  );

  return {
    clinicId,
    userId,
    token: generateToken({
      userId,
      clinicId,
      role: "SUPER_ADMIN",
      email,
    }),
  };
}

async function createInternalViewerUser(clinicId: string, prefix: string) {
  const email = uniqueEmail(`${prefix}_viewer`);
  const password = "password123";
  const userId = uuidv4();
  const roleId = uuidv4();
  const roleName = `NOCLIENT_${Math.floor(Math.random() * 100000)}`;
  const passwordHash = await hashPassword(password);

  await pool.execute(
    "INSERT INTO role (id, clinic_id, name, display_name, is_system) VALUES (?, ?, ?, ?, 0)",
    [roleId, clinicId, roleName, "No Client Account Access"],
  );

  await pool.execute(
    "INSERT INTO user (id, clinic_id, email, password_hash, first_name, last_name, role, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
    [userId, clinicId, email, passwordHash, prefix, "Viewer", roleName],
  );

  await pool.execute(
    "INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary) VALUES (?, ?, ?, 'active', 1)",
    [userId, clinicId, roleName],
  );

  const result = await authService.login({ email, password });

  return {
    userId: result.user.id,
    token: result.tokens.token,
    roleId,
    roleName,
  };
}

async function createClientAccountWriterUser(clinicId: string, prefix: string) {
  const email = uniqueEmail(`${prefix}_writer`);
  const password = "password123";
  const userId = uuidv4();
  const roleId = uuidv4();
  const roleName = `${prefix.toUpperCase()}_CLIENT_ACCOUNT_WRITER_${Math.floor(Math.random() * 100000)}`;
  const passwordHash = await hashPassword(password);

  await pool.execute(
    "INSERT INTO role (id, clinic_id, name, display_name, is_system) VALUES (?, ?, ?, ?, 0)",
    [roleId, clinicId, roleName, "Client Account Writer"],
  );
  await pool.execute(
    `INSERT INTO role_permission (role_id, permission_id)
     SELECT ?, id FROM permission WHERE key_name IN ('client_accounts:read', 'client_accounts:write')`,
    [roleId],
  );
  await pool.execute(
    "INSERT INTO user (id, clinic_id, email, password_hash, first_name, last_name, role, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
    [userId, clinicId, email, passwordHash, prefix, "Writer", roleName],
  );
  await pool.execute(
    "INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary) VALUES (?, ?, ?, 'active', 1)",
    [userId, clinicId, roleName],
  );

  const result = await authService.login({ email, password });

  return {
    userId: result.user.id,
    token: result.tokens.token,
    roleId,
    roleName,
  };
}

async function createInternalTaskWriterUser(clinicId: string, prefix: string) {
  const email = uniqueEmail(`${prefix}_task_writer`);
  const password = "password123";
  const userId = uuidv4();
  const roleId = uuidv4();
  const roleName = `TASKS_${Math.floor(Math.random() * 100000)}`;
  const passwordHash = await hashPassword(password);

  await pool.execute(
    "INSERT INTO role (id, clinic_id, name, display_name, is_system) VALUES (?, ?, ?, ?, 0)",
    [roleId, clinicId, roleName, "Internal Task Writer"],
  );
  await pool.execute(
    `INSERT INTO role_permission (role_id, permission_id)
     SELECT ?, id FROM permission WHERE key_name IN ('internal_tasks:read', 'internal_tasks:write')`,
    [roleId],
  );
  await pool.execute(
    "INSERT INTO user (id, clinic_id, email, password_hash, first_name, last_name, role, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
    [userId, clinicId, email, passwordHash, prefix, "TaskWriter", roleName],
  );
  await pool.execute(
    "INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary) VALUES (?, ?, ?, 'active', 1)",
    [userId, clinicId, roleName],
  );

  const result = await authService.login({ email, password });

  return {
    userId: result.user.id,
    token: result.tokens.token,
    roleId,
    roleName,
  };
}

async function createTestContact(clinicId: string, prefix: string, accountName?: string | null) {
  const contactId = uuidv4();
  await pool.execute(
    `INSERT INTO contact
      (id, clinic_id, account_name, first_name, last_name, email, phone, status, lead_status, source)
     VALUES (?, ?, ?, ?, 'Contact', ?, '07700 900111', 'lead', 'new', 'referral')`,
    [contactId, clinicId, accountName || null, prefix, uniqueEmail(`${prefix}_contact`)],
  );
  return contactId;
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

test("client account validation accepts seeded user identifiers", async () => {
  const expressModule = await import("express") as any;
  const express = expressModule.default;
  const testApp = express();
  testApp.use(express.json());
  testApp.post("/", createClientAccountValidator, validate, (_req: any, res: any) => res.status(204).end());
  testApp.use(errorHandler);

  const server = testApp.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start client account validator test server");
  }

  try {
    const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
    const accepted = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Seeded Manager Account", accountManagerId: "user-001" }),
    });
    assert.equal(accepted.status, 204);

    const rejected = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Invalid Manager Account", accountManagerId: "../../user-001" }),
    });
    assert.equal(rejected.status, 400);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("client account Drive links require validated Google access and tenant availability", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("ClientDrivePrimary");
  const secondary = await createClinicAndAdmin("ClientDriveSecondary");
  const primaryWriter = await createClientAccountWriterUser(primary.clinicId, "ClientDrivePrimary");

  const expressModule = await import("express") as any;
  const express = expressModule.default;
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/client-accounts", clientAccountsRoutes);
  testApp.use(errorHandler);

  const server = testApp.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start client account Drive test server");
  }

  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
  const originalFetch = globalThis.fetch;
  const originalGoogleDrive = { ...config.googleDrive };
  const originalGoogleOAuth = { ...config.oauth.google };
  const driveResponses = new Map<string, { status: number; body: Record<string, unknown> }>();
  const driveRequests: string[] = [];

  (config as any).oauth.google.clientId = "drive-client-id";
  (config as any).oauth.google.clientSecret = "drive-client-secret";
  (config as any).googleDrive.validationEnabled = true;
  (config as any).googleDrive.refreshToken = "refreshable-drive-token";
  (config as any).googleDrive.serviceAccountEmail = "";
  (config as any).googleDrive.serviceAccountPrivateKey = "";
  (clientAccountsService as any).googleDriveTokenCache = null;

  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith(baseUrl)) {
      return originalFetch(input, init);
    }
    if (url === "https://oauth2.googleapis.com/token") {
      return new Response(JSON.stringify({ access_token: "fresh-drive-token", expires_in: 3600 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.startsWith("https://www.googleapis.com/drive/v3/files?")) {
      driveRequests.push(url);
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body || "{}"));
        return new Response(JSON.stringify({
          id: "created-folder-123",
          name: body.name,
          webViewLink: "https://drive.google.com/drive/folders/created-folder-123",
          parents: body.parents,
          modifiedTime: "2026-07-16T12:00:00.000Z",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        files: [{
          id: "existing-folder-123",
          name: "Existing Client Folder",
          mimeType: "application/vnd.google-apps.folder",
          webViewLink: "https://drive.google.com/drive/folders/existing-folder-123",
          parents: ["root"],
          modifiedTime: "2026-07-15T12:00:00.000Z",
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.startsWith("https://www.googleapis.com/drive/v3/files/")) {
      driveRequests.push(url);
      const encodedId = url.split("/files/")[1]?.split("?")[0] || "";
      const itemId = decodeURIComponent(encodedId);
      const mock = driveResponses.get(itemId) || {
        status: 404,
        body: { error: { message: "File not found" } },
      };
      return new Response(JSON.stringify(mock.body), {
        status: mock.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  const setDriveItem = (id: string, status: number, body: Record<string, unknown>) => {
    driveResponses.set(id, { status, body });
  };

  try {
    const inaccessible = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/drive-folder`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ folderUrl: "https://drive.google.com/drive/folders/inaccessible-folder" }),
      },
    );
    assert.equal(inaccessible.response.status, 400);
    assert.match(inaccessible.body.message, /File not found|inaccessible/i);

    setDriveItem("wrong-type-file", 200, {
      id: "wrong-type-file",
      name: "Plan.txt",
      mimeType: "text/plain",
      trashed: false,
    });
    const wrongType = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/drive-folder`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ folderUrl: "https://drive.google.com/file/d/wrong-type-file/view" }),
      },
    );
    assert.equal(wrongType.response.status, 400);
    assert.match(wrongType.body.message, /folder or ZIP/i);

    setDriveItem("trashed-folder", 200, {
      id: "trashed-folder",
      name: "Old Client Folder",
      mimeType: "application/vnd.google-apps.folder",
      trashed: true,
    });
    const trashed = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/drive-folder`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ folderUrl: "https://drive.google.com/drive/folders/trashed-folder" }),
      },
    );
    assert.equal(trashed.response.status, 400);
    assert.match(trashed.body.message, /trash/i);

    setDriveItem("valid-folder", 200, {
      id: "valid-folder",
      name: "Client Delivery Folder",
      mimeType: "application/vnd.google-apps.folder",
      trashed: false,
    });
    const savedFolder = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/drive-folder`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ folderUrl: "https://drive.google.com/drive/folders/valid-folder" }),
      },
    );
    assert.equal(savedFolder.response.status, 200);
    assert.equal(savedFolder.body.data.googleDriveFolderId, "valid-folder");
    assert.equal(savedFolder.body.data.googleDriveFolderName, "Client Delivery Folder");
    assert.equal(savedFolder.body.data.googleDriveFolderAccessStatus, "accessible");

    const folderBrowser = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/drive/folders?parentId=root`,
      primary.token,
    );
    assert.equal(folderBrowser.response.status, 200);
    assert.equal(folderBrowser.body.data.currentFolder.name, "My Drive");
    assert.equal(folderBrowser.body.data.folders[0].name, "Existing Client Folder");

    const createdFolder = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/drive/folders`,
      primary.token,
      {
        method: "POST",
        body: JSON.stringify({ name: "New Client Delivery", parentId: "root" }),
      },
    );
    assert.equal(createdFolder.response.status, 201);
    assert.equal(createdFolder.body.data.id, "created-folder-123");
    assert.equal(createdFolder.body.data.name, "New Client Delivery");

    setDriveItem("valid-zip", 200, {
      id: "valid-zip",
      name: "Creative Assets.zip",
      mimeType: "application/zip",
      trashed: false,
    });
    const savedZip = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/drive-folder`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ folderUrl: "https://drive.google.com/file/d/valid-zip/view" }),
      },
    );
    assert.equal(savedZip.response.status, 200);
    assert.equal(savedZip.body.data.googleDriveFolderId, "valid-zip");
    assert.equal(savedZip.body.data.googleDriveFolderName, "Creative Assets.zip");
    assert.equal(savedZip.body.data.googleDriveFolderUrl, "https://drive.google.com/file/d/valid-zip/view");

    const requestsBeforeCrossWorkspace = driveRequests.length;
    const crossWorkspace = await fetchJson(
      baseUrl,
      `/api/client-accounts/${secondary.clinicId}/drive-folder`,
      primaryWriter.token,
      {
        method: "PATCH",
        body: JSON.stringify({ folderUrl: "https://drive.google.com/drive/folders/valid-folder" }),
      },
    );
    assert.equal(crossWorkspace.response.status, 403);
    assert.equal(driveRequests.length, requestsBeforeCrossWorkspace, "Cross-workspace rejection should happen before Google Drive validation");

    const removed = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/drive-folder`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ folderUrl: null, folderId: null }),
      },
    );
    assert.equal(removed.response.status, 200);
    assert.equal(removed.body.data.googleDriveFolderId, null);
    assert.equal(removed.body.data.googleDriveFolderUrl, null);

    console.log("[client-accounts] Drive folder validation and tenant guard passed");
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign((config as any).googleDrive, originalGoogleDrive);
    Object.assign((config as any).oauth.google, originalGoogleOAuth);
    (clientAccountsService as any).googleDriveTokenCache = null;
    await pool.execute("DELETE FROM role_permission WHERE role_id = ?", [primaryWriter.roleId]);
    await pool.execute("DELETE FROM role WHERE id = ?", [primaryWriter.roleId]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("client account contacts and tasks use stable workspace-scoped relations", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("ClientRelationsPrimary");
  const clientA = await createClinicAndAdmin("ClientRelationsA");
  const clientB = await createClinicAndAdmin("ClientRelationsB");
  const clientWriter = await createClientAccountWriterUser(primary.clinicId, "ClientRelations");
  const taskWriter = await createInternalTaskWriterUser(primary.clinicId, "ClientRelations");
  const contactId = await createTestContact(primary.clinicId, "StableLinked", "Duplicate Client");
  const secondContactId = await createTestContact(primary.clinicId, "StableUnlinked", "Duplicate Client");

  await pool.execute("UPDATE clinic SET name = 'Duplicate Client' WHERE id IN (?, ?)", [clientA.clinicId, clientB.clinicId]);

  const expressModule = await import("express") as any;
  const express = expressModule.default;
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/client-accounts", clientAccountsRoutes);
  testApp.use("/api/tasks", tasksRoutes);
  testApp.use(errorHandler);

  const server = testApp.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start client account relation test server");
  }

  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    const crossWorkspaceLink = await fetchJson(
      baseUrl,
      `/api/client-accounts/${clientA.clinicId}/contacts/${contactId}/link`,
      clientWriter.token,
      { method: "POST" },
    );
    assert.equal(crossWorkspaceLink.response.status, 403);

    const linked = await fetchJson(
      baseUrl,
      `/api/client-accounts/${clientA.clinicId}/contacts/${contactId}/link`,
      primary.token,
      { method: "POST" },
    );
    assert.equal(linked.response.status, 200);
    assert.equal(linked.body.data.contacts.length, 1);
    assert.equal(linked.body.data.contacts[0].id, contactId);
    assert.ok(linked.body.data.contacts[0].relationId);
    const clientAProfileId = linked.body.data.account.id;
    assert.ok(clientAProfileId);

    const duplicateLink = await fetchJson(
      baseUrl,
      `/api/client-accounts/${clientA.clinicId}/contacts/${contactId}/link`,
      primary.token,
      { method: "POST" },
    );
    assert.equal(duplicateLink.response.status, 200);
    assert.equal(duplicateLink.body.data.contacts.length, 1);
    assert.equal(duplicateLink.body.data.contacts[0].relationId, linked.body.data.contacts[0].relationId);

    await pool.execute("UPDATE clinic SET name = 'Renamed Client A' WHERE id = ?", [clientA.clinicId]);

    const afterRename = await fetchJson(
      baseUrl,
      `/api/client-accounts/${clientA.clinicId}/linked-records`,
      primary.token,
    );
    assert.equal(afterRename.response.status, 200);
    assert.equal(afterRename.body.data.account.clinicName, "Renamed Client A");
    assert.equal(afterRename.body.data.contacts.some((contact: any) => contact.id === contactId), true);
    assert.equal(afterRename.body.data.contacts.some((contact: any) => contact.id === secondContactId), false);

    const duplicateNameAccount = await fetchJson(
      baseUrl,
      `/api/client-accounts/${clientB.clinicId}/linked-records`,
      primary.token,
    );
    assert.equal(duplicateNameAccount.response.status, 200);
    assert.equal(duplicateNameAccount.body.data.contacts.some((contact: any) => contact.id === contactId), false);

    const contactBacklinks = await fetchJson(
      baseUrl,
      `/api/client-accounts/contacts/${contactId}/links`,
      primary.token,
    );
    assert.equal(contactBacklinks.response.status, 200);
    assert.equal(contactBacklinks.body.data.length, 1);
    assert.equal(contactBacklinks.body.data[0].clientClinicId, clientA.clinicId);
    assert.equal(contactBacklinks.body.data[0].clientAccountProfileId, clientAProfileId);
    assert.ok(contactBacklinks.body.data[0].relationId);

    const rejectedTask = await fetchJson(baseUrl, "/api/tasks/internal", taskWriter.token, {
      method: "POST",
      body: JSON.stringify({
        title: "Foreign profile should fail",
        boardKey: "delivery",
        clientAccountProfileId: clientAProfileId,
      }),
    });
    assert.equal(rejectedTask.response.status, 403);

    const createdTask = await fetchJson(baseUrl, "/api/tasks/internal", primary.token, {
      method: "POST",
      body: JSON.stringify({
        title: "Build tracking plan",
        boardKey: "delivery",
        priority: "high",
        clientAccountProfileId: clientAProfileId,
        contactId,
      }),
    });
    assert.equal(createdTask.response.status, 201);

    const withTask = await fetchJson(
      baseUrl,
      `/api/client-accounts/${clientA.clinicId}/linked-records`,
      primary.token,
    );
    assert.equal(withTask.response.status, 200);
    assert.equal(withTask.body.data.openTasks.some((task: any) => task.id === createdTask.body.data.id), true);

    const unlinked = await fetchJson(
      baseUrl,
      `/api/client-accounts/${clientA.clinicId}/contacts/${contactId}/unlink`,
      primary.token,
      { method: "POST" },
    );
    assert.equal(unlinked.response.status, 200);
    assert.equal(unlinked.body.data.contacts.some((contact: any) => contact.id === contactId), false);

    const linksAfterUnlink = await fetchJson(
      baseUrl,
      `/api/client-accounts/contacts/${contactId}/links`,
      primary.token,
    );
    assert.equal(linksAfterUnlink.response.status, 200);
    assert.equal(linksAfterUnlink.body.data.length, 0);

    console.log("[client-accounts] stable relation link/unlink, rename, duplicate name, backlink and task scope checks passed");
  } finally {
    await pool.execute("DELETE FROM task WHERE clinic_id = ? AND contact_id = ?", [primary.clinicId, contactId]);
    await pool.execute("DELETE FROM client_account_contact WHERE clinic_id = ? AND contact_id IN (?, ?)", [primary.clinicId, contactId, secondContactId]);
    await pool.execute("UPDATE contact SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id IN (?, ?)", [primary.clinicId, contactId, secondContactId]);
    await pool.execute("DELETE FROM role_permission WHERE role_id IN (?, ?)", [clientWriter.roleId, taskWriter.roleId]);
    await pool.execute("DELETE FROM role WHERE id IN (?, ?)", [clientWriter.roleId, taskWriter.roleId]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

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
    await pool.execute("DELETE FROM role_permission WHERE role_id = ?", [limitedUser.roleId]);
    await pool.execute("DELETE FROM role WHERE id = ?", [limitedUser.roleId]);

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
