import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { v4 as uuidv4 } from "uuid";
import pool, { testConnection } from "../config/database.js";
import { config } from "../config/index.js";
import { authService } from "../modules/auth/auth.service.js";
import { generateToken, hashPassword } from "../utils/helpers.js";
import clientAccountsRoutes from "../modules/client-accounts/client-accounts.routes.js";
import { clientAccountsService } from "../modules/client-accounts/client-accounts.service.js";
import pipelineRoutes from "../modules/pipeline/pipeline.routes.js";
import { pipelineDealsService } from "../modules/pipeline/pipeline.deals.service.js";
import { defaultPipelineName } from "../modules/pipeline/pipeline.constants.js";
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

async function createDeliveryUser(clinicId: string, prefix: string) {
  const email = uniqueEmail(`${prefix}_delivery`);
  const password = "password123";
  const userId = uuidv4();
  const passwordHash = await hashPassword(password);

  await pool.execute(
    `INSERT INTO user
      (id, clinic_id, email, password_hash, first_name, last_name, role, email_verified_at)
     VALUES (?, ?, ?, ?, ?, 'Delivery', 'DELIVERY', CURRENT_TIMESTAMP)`,
    [userId, clinicId, email, passwordHash, prefix],
  );
  await pool.execute(
    `INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
     VALUES (?, ?, 'DELIVERY', 'active', 1)`,
    [userId, clinicId],
  );

  const result = await authService.login({ email, password });

  return {
    userId: result.user.id,
    token: result.tokens.token,
  };
}

async function createContactWriterUser(clinicId: string, prefix: string) {
  const email = uniqueEmail(`${prefix}_contact_writer`);
  const password = "password123";
  const userId = uuidv4();
  const roleId = uuidv4();
  const roleName = `${prefix.toUpperCase()}_CONTACT_WRITER_${Math.floor(Math.random() * 100000)}`;
  const passwordHash = await hashPassword(password);

  await pool.execute(
    "INSERT INTO role (id, clinic_id, name, display_name, is_system) VALUES (?, ?, ?, ?, 0)",
    [roleId, clinicId, roleName, "Contact Writer"],
  );
  await pool.execute(
    `INSERT INTO role_permission (role_id, permission_id)
     SELECT ?, id FROM permission WHERE key_name IN ('contacts:read', 'contacts:write')`,
    [roleId],
  );
  await pool.execute(
    "INSERT INTO user (id, clinic_id, email, password_hash, first_name, last_name, role, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
    [userId, clinicId, email, passwordHash, prefix, "ContactWriter", roleName],
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

async function createClientAccountProfile(clinicId: string, userId: string) {
  const profileId = uuidv4();
  await pool.execute(
    `INSERT INTO client_account_profile
      (id, clinic_id, active_services, created_by, updated_by)
     VALUES (?, ?, JSON_ARRAY(), ?, ?)`,
    [profileId, clinicId, userId, userId],
  );
  return profileId;
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

async function closeTestServer(server: Server) {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => (error ? reject(error) : resolve()));
  });
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
    await closeTestServer(server);
  }
});

test("client account Drive links require validated Google access and tenant availability", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("ClientDrivePrimary");
  const secondary = await createClinicAndAdmin("ClientDriveSecondary");
  const primaryWriter = await createClientAccountWriterUser(primary.clinicId, "ClientDrivePrimary");
  const primaryProfileId = await createClientAccountProfile(primary.clinicId, primary.userId);
  await createClientAccountProfile(secondary.clinicId, secondary.userId);

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
  (config as any).googleDrive.databaseOAuthEnabled = true;
  (config as any).googleDrive.validationEnabled = true;
  (config as any).googleDrive.refreshToken = "refreshable-drive-token";
  (config as any).googleDrive.serviceAccountEmail = "";
  (config as any).googleDrive.serviceAccountPrivateKey = "";
  (clientAccountsService as any).googleDriveTokenCache = null;

  const driveIntegrationId = uuidv4();
  await pool.execute(
    `INSERT INTO integration
      (id, clinic_id, name, type, config, is_active, setup_status, health_status, missing_permissions, oauth_authorize_url)
     VALUES (?, ?, 'Google Drive', 'google_drive', ?, 1, 'ready', 'healthy', JSON_ARRAY(), NULL)`,
    [
      driveIntegrationId,
      primary.clinicId,
      JSON.stringify({
        oauthConnected: true,
        connectedEmail: "drive-admin@leapdigital.online",
        connectedAt: new Date().toISOString(),
        tokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        grantedScopes: ["https://www.googleapis.com/auth/drive"],
        encryptedAccessToken: "fresh-drive-token",
        encryptedRefreshToken: "refreshable-drive-token",
      }),
    ],
  );

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
    const freshProfile = await fetchJson(
      baseUrl,
      "/api/client-accounts/profile",
      primary.token,
    );
    assert.equal(freshProfile.response.status, 200);
    assert.equal(freshProfile.body.data.missingDocumentCount, 11);
    assert.equal(freshProfile.body.data.missingAccessCount, 10);

    const freshAccountList = await fetchJson(baseUrl, "/api/client-accounts", primary.token);
    assert.equal(freshAccountList.response.status, 200);
    const freshAccountSummary = freshAccountList.body.data.find(
      (account: any) => account.clinicId === primary.clinicId,
    );
    assert.ok(freshAccountSummary);
    assert.equal(freshAccountSummary.missingDocumentCount, 11);
    assert.equal(freshAccountSummary.missingAccessCount, 10);

    const freshDocuments = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/documents`,
      primary.token,
    );
    assert.equal(freshDocuments.response.status, 200);
    assert.equal(freshDocuments.body.data.length, 11);
    assert.equal(
      freshDocuments.body.data.filter((item: any) => item.status === "missing").length,
      11,
    );

    const freshAccessItems = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/access-items`,
      primary.token,
    );
    assert.equal(freshAccessItems.response.status, 200);
    assert.equal(freshAccessItems.body.data.length, 10);
    assert.equal(
      freshAccessItems.body.data.filter((item: any) => item.isMissing).length,
      10,
    );

    const requestsBeforeInvalidLegacyFolder = driveRequests.length;
    const invalidLegacyFolderPayload = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/drive-folder`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ folderUrl: { value: "invalid" }, displayName: 42 }),
      },
    );
    assert.equal(invalidLegacyFolderPayload.response.status, 400);
    assert.equal(driveRequests.length, requestsBeforeInvalidLegacyFolder);

    for (const unsafeDriveUrl of [
      "javascript://drive.google.com/drive/folders/unsafe-folder",
      "data://drive.google.com/drive/folders/unsafe-folder",
      "https://drive.google.com.evil.example/drive/folders/unsafe-folder",
    ]) {
      const requestsBeforeUnsafeLink = driveRequests.length;
      const unsafeLink = await fetchJson(
        baseUrl,
        `/api/client-accounts/${primary.clinicId}/drive-folder`,
        primary.token,
        {
          method: "PATCH",
          body: JSON.stringify({ folderUrl: unsafeDriveUrl }),
        },
      );
      assert.equal(unsafeLink.response.status, 400);
      assert.match(unsafeLink.body.message, /Only HTTPS Google Drive and Google Docs links/i);
      assert.equal(driveRequests.length, requestsBeforeUnsafeLink);
    }

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

    const initialDocuments = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/documents`,
      primary.token,
    );
    assert.equal(initialDocuments.response.status, 200);
    assert.equal(initialDocuments.body.data.length, 11);
    assert.equal(initialDocuments.body.data.find((item: any) => item.documentType === "main_client_folder").status, "linked");
    assert.equal(initialDocuments.body.data.find((item: any) => item.documentType === "contract_admin").status, "missing");

    const requestsBeforeWriterMainFolder = driveRequests.length;
    const rejectedWriterMainFolder = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/documents/main_client_folder`,
      primaryWriter.token,
      {
        method: "PATCH",
        body: JSON.stringify({ driveUrl: "https://drive.google.com/drive/folders/valid-folder" }),
      },
    );
    assert.equal(rejectedWriterMainFolder.response.status, 403);
    assert.equal(
      driveRequests.length,
      requestsBeforeWriterMainFolder,
      "Main-folder permission rejection should happen before Google Drive validation",
    );

    const requestsBeforeInvalidMainFolder = driveRequests.length;
    const invalidMainFolderPayload = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/documents/main_client_folder`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ driveUrl: { value: "https://drive.google.com/drive/folders/valid-folder" } }),
      },
    );
    assert.equal(invalidMainFolderPayload.response.status, 400);
    assert.equal(driveRequests.length, requestsBeforeInvalidMainFolder);

    const restoredFolder = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/documents/main_client_folder`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ driveUrl: "https://drive.google.com/drive/folders/valid-folder" }),
      },
    );
    assert.equal(restoredFolder.response.status, 200);
    assert.equal(
      restoredFolder.body.data.find((item: any) => item.documentType === "main_client_folder").driveItemId,
      "valid-folder",
    );

    for (const malformedPayload of [null, [], {}, "invalid"]) {
      const malformedMainFolder = await fetchJson(
        baseUrl,
        `/api/client-accounts/${primary.clinicId}/documents/main_client_folder`,
        primary.token,
        {
          method: "PATCH",
          body: JSON.stringify(malformedPayload),
        },
      );
      assert.equal(malformedMainFolder.response.status, 400);
    }
    const documentsAfterMalformedPayloads = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/documents`,
      primary.token,
    );
    assert.equal(
      documentsAfterMalformedPayloads.body.data.find(
        (item: any) => item.documentType === "main_client_folder",
      ).driveItemId,
      "valid-folder",
    );

    const crossWorkspaceDocumentId = uuidv4();
    await pool.execute(
      `INSERT INTO client_account_document_link
        (id, clinic_id, client_account_profile_id, document_type, drive_item_id, drive_url,
         display_name, access_status, created_by, updated_by)
       VALUES (?, ?, ?, 'audit', 'cross-workspace-audit', ?, 'Cross-workspace audit',
         'accessible', ?, ?)`,
      [
        crossWorkspaceDocumentId,
        secondary.clinicId,
        primaryProfileId,
        "https://drive.google.com/file/d/cross-workspace-audit/view",
        secondary.userId,
        secondary.userId,
      ],
    );
    setDriveItem("cross-source-replacement-root", 200, {
      id: "cross-source-replacement-root",
      name: "Cross-source Replacement",
      mimeType: "application/vnd.google-apps.folder",
      trashed: false,
    });
    const blockedCrossWorkspaceRootChange = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/documents/main_client_folder`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({
          driveUrl: "https://drive.google.com/drive/folders/cross-source-replacement-root",
        }),
      },
    );
    assert.equal(blockedCrossWorkspaceRootChange.response.status, 409);
    await pool.execute("DELETE FROM client_account_document_link WHERE id = ?", [crossWorkspaceDocumentId]);

    setDriveItem("proposal-folder", 200, {
      id: "proposal-folder",
      name: "Proposal Docs",
      mimeType: "application/vnd.google-apps.folder",
      trashed: false,
      parents: ["valid-folder"],
      webViewLink: "https://drive.google.com/drive/folders/proposal-folder",
    });
    (config as any).googleDrive.databaseOAuthEnabled = false;
    const savedProposalDocument = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/documents/proposal`,
      primaryWriter.token,
      {
        method: "PATCH",
        body: JSON.stringify({
          driveUrl: "https://drive.google.com/drive/folders/proposal-folder",
          notes: "Proposal working folder",
        }),
      },
    );
    assert.equal(savedProposalDocument.response.status, 200);
    const proposalDocument = savedProposalDocument.body.data.find((item: any) => item.documentType === "proposal");
    assert.equal(proposalDocument.status, "linked");
    assert.equal(proposalDocument.displayName, "Proposal Docs");
    assert.equal(proposalDocument.notes, "Proposal working folder");
    (config as any).googleDrive.databaseOAuthEnabled = true;

    const malformedDocument = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/documents/contract_admin`,
      primaryWriter.token,
      {
        method: "PATCH",
        body: JSON.stringify([]),
      },
    );
    assert.equal(malformedDocument.response.status, 400);

    setDriveItem("client-shortcut", 200, {
      id: "client-shortcut",
      name: "Outside contract shortcut",
      mimeType: "application/vnd.google-apps.shortcut",
      trashed: false,
      parents: ["valid-folder"],
      webViewLink: "https://drive.google.com/file/d/client-shortcut/view",
      shortcutDetails: { targetId: "outside-client-root", targetMimeType: "application/pdf" },
    });
    const rejectedShortcut = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/documents/contract_admin`,
      primaryWriter.token,
      {
        method: "PATCH",
        body: JSON.stringify({ driveUrl: "https://drive.google.com/file/d/client-shortcut/view" }),
      },
    );
    assert.equal(rejectedShortcut.response.status, 400);
    assert.match(rejectedShortcut.body.message, /shortcuts cannot be linked/i);

    setDriveItem("outside-client-root", 200, {
      id: "outside-client-root",
      name: "Another Client Contract.pdf",
      mimeType: "application/pdf",
      trashed: false,
      parents: ["other-client-root"],
      webViewLink: "https://drive.google.com/file/d/outside-client-root/view",
    });
    const outsideClientRoot = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/documents/contract_admin`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ driveUrl: "https://drive.google.com/file/d/outside-client-root/view" }),
      },
    );
    assert.equal(outsideClientRoot.response.status, 403);
    assert.match(outsideClientRoot.body.message, /outside the selected client folder/i);

    setDriveItem("client-contract-pdf", 200, {
      id: "client-contract-pdf",
      name: "Signed Contract.pdf",
      mimeType: "application/pdf",
      trashed: false,
      parents: ["valid-folder"],
      webViewLink: "https://drive.google.com/file/d/client-contract-pdf/view?usp=drive_link",
    });
    const savedPdf = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/documents/contract_admin`,
      primaryWriter.token,
      {
        method: "PATCH",
        body: JSON.stringify({ driveUrl: "https://drive.google.com/file/d/client-contract-pdf/view" }),
      },
    );
    assert.equal(savedPdf.response.status, 200);
    assert.equal(
      savedPdf.body.data.find((item: any) => item.documentType === "contract_admin").driveUrl,
      "https://drive.google.com/file/d/client-contract-pdf/view?usp=drive_link",
    );

    for (const [itemType, status] of [
      ["ga4", "received"],
      ["website", "received"],
      ["gbp", "not_needed"],
    ] as const) {
      const accessUpdate = await fetchJson(
        baseUrl,
        `/api/client-accounts/${primary.clinicId}/access-items/${itemType}`,
        primary.token,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );
      assert.equal(accessUpdate.response.status, 200);
    }

    const partiallyCompletedDocuments = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/documents`,
      primary.token,
    );
    assert.equal(partiallyCompletedDocuments.response.status, 200);
    assert.equal(
      partiallyCompletedDocuments.body.data.filter((item: any) => item.status === "missing").length,
      8,
    );

    const partiallyCompletedAccessItems = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/access-items`,
      primary.token,
    );
    assert.equal(partiallyCompletedAccessItems.response.status, 200);
    assert.equal(
      partiallyCompletedAccessItems.body.data.filter((item: any) => item.isMissing).length,
      7,
    );

    const partiallyCompletedProfile = await fetchJson(
      baseUrl,
      "/api/client-accounts/profile",
      primary.token,
    );
    assert.equal(partiallyCompletedProfile.response.status, 200);
    assert.equal(partiallyCompletedProfile.body.data.missingDocumentCount, 8);
    assert.equal(partiallyCompletedProfile.body.data.missingAccessCount, 7);

    const partiallyCompletedAccountList = await fetchJson(
      baseUrl,
      "/api/client-accounts",
      primary.token,
    );
    assert.equal(partiallyCompletedAccountList.response.status, 200);
    const partiallyCompletedAccount = partiallyCompletedAccountList.body.data.find(
      (account: any) => account.clinicId === primary.clinicId,
    );
    assert.ok(partiallyCompletedAccount);
    assert.equal(partiallyCompletedAccount.missingDocumentCount, 8);
    assert.equal(partiallyCompletedAccount.missingAccessCount, 7);

    setDriveItem("client-google-doc", 200, {
      id: "client-google-doc",
      name: "Reporting Setup",
      mimeType: "application/vnd.google-apps.document",
      trashed: false,
      parents: ["valid-folder"],
      webViewLink: "https://docs.google.com/document/d/client-google-doc/edit",
    });
    const savedGoogleDoc = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/documents/reports`,
      primaryWriter.token,
      {
        method: "PATCH",
        body: JSON.stringify({ driveUrl: "https://docs.google.com/document/d/client-google-doc/edit" }),
      },
    );
    assert.equal(savedGoogleDoc.response.status, 200);
    assert.equal(
      savedGoogleDoc.body.data.find((item: any) => item.documentType === "reports").driveUrl,
      "https://docs.google.com/document/d/client-google-doc/edit",
    );

    setDriveItem("replacement-root", 200, {
      id: "replacement-root",
      name: "Replacement Client Folder",
      mimeType: "application/vnd.google-apps.folder",
      trashed: false,
    });
    const blockedRootChange = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/documents/main_client_folder`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ driveUrl: "https://drive.google.com/drive/folders/replacement-root" }),
      },
    );
    assert.equal(blockedRootChange.response.status, 409);
    assert.match(blockedRootChange.body.message, /remove the client document links/i);

    const blockedRootRemoval = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/documents/main_client_folder`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ driveUrl: null, driveItemId: null }),
      },
    );
    assert.equal(blockedRootRemoval.response.status, 409);
    assert.match(blockedRootRemoval.body.message, /remove the client document links/i);

    const initialAccessItems = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/access-items`,
      primary.token,
    );
    assert.equal(initialAccessItems.response.status, 200);
    assert.equal(initialAccessItems.body.data.length, 10);
    assert.equal(initialAccessItems.body.data.filter((item: any) => item.isMissing).length, 7);

    const updatedAccessItem = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/access-items/ga4`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "received", notes: "GA4 admin access confirmed" }),
      },
    );
    assert.equal(updatedAccessItem.response.status, 200);
    const ga4 = updatedAccessItem.body.data.find((item: any) => item.itemType === "ga4");
    assert.equal(ga4.status, "received");
    assert.equal(ga4.isMissing, false);
    assert.equal(ga4.notes, "GA4 admin access confirmed");

    const invalidAccessNotes = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/access-items/ga4`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "received", notes: 42 }),
      },
    );
    assert.equal(invalidAccessNotes.response.status, 400);

    await pool.execute(
      `UPDATE client_account_access_item
       SET received_at = '2026-07-25 10:00:00'
       WHERE clinic_id = ?
         AND client_account_profile_id = ?
         AND item_type = 'ga4'`,
      [primary.clinicId, primaryProfileId],
    );
    const accessBeforeNotesSave = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/access-items`,
      primary.token,
    );
    const ga4BeforeNotesSave = accessBeforeNotesSave.body.data.find((item: any) => item.itemType === "ga4");
    const savedAccessNotes = await fetchJson(
      baseUrl,
      `/api/client-accounts/${primary.clinicId}/access-items/ga4`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "received", notes: "GA4 access confirmed and documented" }),
      },
    );
    assert.equal(savedAccessNotes.response.status, 200);
    const ga4AfterNotesSave = savedAccessNotes.body.data.find((item: any) => item.itemType === "ga4");
    assert.equal(ga4AfterNotesSave.status, "received");
    assert.equal(ga4AfterNotesSave.isMissing, false);
    assert.equal(ga4AfterNotesSave.notes, "GA4 access confirmed and documented");
    assert.equal(ga4AfterNotesSave.receivedAt, ga4BeforeNotesSave.receivedAt);

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

    for (const documentType of ["proposal", "contract_admin", "reports"]) {
      const removedDocument = await fetchJson(
        baseUrl,
        `/api/client-accounts/${primary.clinicId}/documents/${documentType}`,
        primaryWriter.token,
        {
          method: "PATCH",
          body: JSON.stringify({ driveUrl: null, driveItemId: null }),
        },
      );
      assert.equal(removedDocument.response.status, 200);
    }

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
    await pool.execute("DELETE FROM integration WHERE id = ?", [driveIntegrationId]);
    await pool.execute("DELETE FROM role_permission WHERE role_id = ?", [primaryWriter.roleId]);
    await pool.execute("DELETE FROM role WHERE id = ?", [primaryWriter.roleId]);
    await closeTestServer(server);
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
  await createClientAccountProfile(clientA.clinicId, clientA.userId);
  await createClientAccountProfile(clientB.clinicId, clientB.userId);

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

    const emailId = uuidv4();
    const smsId = uuidv4();
    const whatsappConversationId = uuidv4();
    const whatsappMessageId = uuidv4();
    const callId = uuidv4();
    await pool.execute(
      `INSERT INTO email (id, clinic_id, contact_id, user_id, subject, body, direction, status)
       VALUES (?, ?, ?, ?, 'Board decision', 'Client approved the launch plan and asked for a follow-up on tracking.', 'inbound', 'read')`,
      [emailId, primary.clinicId, contactId, primary.userId],
    );
    await pool.execute(
      `INSERT INTO sms (id, clinic_id, contact_id, user_id, message, direction, status)
       VALUES (?, ?, ?, ?, 'We will send the revised action plan tomorrow.', 'outbound', 'sent')`,
      [smsId, primary.clinicId, contactId, primary.userId],
    );
    await pool.execute(
      `INSERT INTO whatsapp_conversation (id, clinic_id, contact_id, whatsapp_number, owner_user_id, status)
       VALUES (?, ?, ?, '447700900111', ?, 'open')`,
      [whatsappConversationId, primary.clinicId, contactId, primary.userId],
    );
    await pool.execute(
      `INSERT INTO whatsapp_message (id, clinic_id, conversation_id, contact_id, user_id, direction, body, status)
       VALUES (?, ?, ?, ?, ?, 'inbound', 'There is an outstanding complaint about reporting access.', 'received')`,
      [whatsappMessageId, primary.clinicId, whatsappConversationId, contactId, primary.userId],
    );
    await pool.execute(
      `INSERT INTO \` call \`
        (id, clinic_id, contact_id, user_id, direction, call_status, recording_url, recording_status, transcript, ai_summary, notes)
       VALUES (?, ?, ?, ?, 'inbound', 'completed', 'https://recordings.example.test/client-call.mp3', 'completed',
        'The client asked for a decision on next steps and confirmed the commitment.',
        'Call covered next steps, reporting concerns and owner commitments.', 'Follow-up call')`,
      [callId, primary.clinicId, contactId, primary.userId],
    );

    const communicationHistory = await fetchJson(
      baseUrl,
      `/api/client-accounts/${clientA.clinicId}/communication-history`,
      primary.token,
    );
    assert.equal(communicationHistory.response.status, 200, JSON.stringify(communicationHistory.body));
    assert.equal(communicationHistory.body.data.counts.email, 1);
    assert.equal(communicationHistory.body.data.counts.sms, 1);
    assert.equal(communicationHistory.body.data.counts.whatsapp, 1);
    assert.equal(communicationHistory.body.data.counts.calls, 1);
    assert.equal(communicationHistory.body.data.counts.recordings, 1);
    assert.equal(communicationHistory.body.data.counts.transcripts, 1);
    assert.equal(communicationHistory.body.data.items.some((item: any) => item.channel === "call" && item.hasTranscript), true);
    assert.equal(communicationHistory.body.data.items.some((item: any) => item.twilioCallSid), false);
    assert.match(communicationHistory.body.data.aiContext.searchableText, /Board decision/);
    assert.ok(communicationHistory.body.data.aiContext.commitmentSignals > 0);
    assert.ok(communicationHistory.body.data.aiContext.complaintSignals > 0);

    const searchedCommunicationHistory = await fetchJson(
      baseUrl,
      `/api/client-accounts/${clientA.clinicId}/communication-history?search=complaint`,
      primary.token,
    );
    assert.equal(searchedCommunicationHistory.response.status, 200);
    assert.equal(searchedCommunicationHistory.body.data.counts.total >= 1, true);
    assert.equal(
      searchedCommunicationHistory.body.data.items.every((item: any) =>
        [item.preview, item.body, item.transcript, item.aiSummary].filter(Boolean).join(" ").toLowerCase().includes("complaint"),
      ),
      true,
    );

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
    await pool.execute("DELETE FROM ` call ` WHERE clinic_id = ? AND contact_id = ?", [primary.clinicId, contactId]);
    await pool.execute("DELETE FROM whatsapp_message WHERE clinic_id = ? AND contact_id = ?", [primary.clinicId, contactId]);
    await pool.execute("DELETE FROM whatsapp_conversation WHERE clinic_id = ? AND contact_id = ?", [primary.clinicId, contactId]);
    await pool.execute("DELETE FROM sms WHERE clinic_id = ? AND contact_id = ?", [primary.clinicId, contactId]);
    await pool.execute("DELETE FROM email WHERE clinic_id = ? AND contact_id = ?", [primary.clinicId, contactId]);
    await pool.execute("DELETE FROM task WHERE clinic_id = ? AND contact_id = ?", [primary.clinicId, contactId]);
    await pool.execute("DELETE FROM client_account_contact WHERE clinic_id = ? AND contact_id IN (?, ?)", [primary.clinicId, contactId, secondContactId]);
    await pool.execute("UPDATE contact SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id IN (?, ?)", [primary.clinicId, contactId, secondContactId]);
    await pool.execute("DELETE FROM role_permission WHERE role_id IN (?, ?)", [clientWriter.roleId, taskWriter.roleId]);
    await pool.execute("DELETE FROM role WHERE id IN (?, ?)", [clientWriter.roleId, taskWriter.roleId]);
    await closeTestServer(server);
  }
});

test("won opportunities convert into client accounts with preserved history and onboarding tasks", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("WonDealConversion");
  const contactId = await createTestContact(primary.clinicId, "WonConversion", "Won Conversion Account");
  const pipelineId = uuidv4();
  const stageId = uuidv4();
  const dealId = uuidv4();
  const proposalId = uuidv4();
  const acceptanceId = uuidv4();
  const growthScoreSnapshotId = uuidv4();
  const secondaryAssigneeId = uuidv4();
  const rollbackAccountName = `Rollback Won Conversion ${dealId}`;
  const convertedAccountName = `${`Won Conversion Client ${dealId} `}${"X".repeat(255)}`.slice(0, 255);

  await pool.execute(
    `UPDATE contact
     SET website = 'https://won-conversion.example',
         address = '42 Client Road',
         city = 'London',
         state = 'England',
         postal_code = 'WC1 1AA',
         country = 'UK',
         treatment_interests = JSON_ARRAY('Growth Engine', 'SEO'),
         package_interest = 'Growth Engine',
         recommended_package = 'Market Leader',
         notes = 'Original sales notes stay on the contact.',
         growth_score_overall = 71.50,
         growth_score_categories = JSON_OBJECT('seo', 62, 'tracking', 58),
         growth_score_recommended_package = 'Market Leader',
         growth_score_gap_summary = 'Tracking and SEO are the biggest gaps.',
         growth_score_updated_at = '2026-07-20 10:00:00'
     WHERE id = ? AND clinic_id = ?`,
    [contactId, primary.clinicId],
  );

  await pool.execute(
    "INSERT INTO pipeline (id, clinic_id, name, description, stages) VALUES (?, ?, ?, ?, JSON_ARRAY('Won'))",
    [pipelineId, primary.clinicId, `Won Conversion Pipeline ${Date.now()}`, "MC-041 conversion test pipeline"],
  );
  await pool.execute(
    `INSERT INTO pipeline_stage
      (id, clinic_id, pipeline_id, name, color, position, kind, is_locked, created_by)
     VALUES (?, ?, ?, 'Won', 'bg-emerald-500', 1, 'won', 1, ?)`,
    [stageId, primary.clinicId, pipelineId, primary.userId],
  );
  await pool.execute(
    `INSERT INTO deal
      (id, clinic_id, contact_id, pipeline_id, pipeline_stage_id, title, value, stage, probability,
       owner_id, source, treatment, status, stage_changed_at, sold_at, created_by)
     VALUES (?, ?, ?, ?, ?, 'Won SEO and Ads Opportunity', 1995.00, 'Won', 100,
       ?, 'website', 'Growth Engine', 'won', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
    [dealId, primary.clinicId, contactId, pipelineId, stageId, primary.userId, primary.userId],
  );
  await pool.execute(
    `INSERT INTO proposal
      (id, clinic_id, contact_id, deal_id, proposal_name, package_name, owner_id, status, value, created_by, updated_by)
     VALUES (?, ?, ?, ?, 'Growth Engine Proposal', 'Growth Engine', ?, 'won', 1995.00, ?, ?)`,
    [proposalId, primary.clinicId, contactId, dealId, primary.userId, primary.userId, primary.userId],
  );
  await pool.execute(
    `INSERT INTO proposal_acceptance_record
      (id, clinic_id, proposal_id, contact_id, deal_id, accepted_by_name, accepted_by_email,
       legal_company_name, billing_email, preferred_start_date, agreement_accepted,
       confirmation_text, acceptance_source, evidence_sha256, locked_at,
       package_name, monthly_fee_cents, setup_fee_cents, payment_terms, start_date,
       minimum_term_months, notice_period_days, created_by)
     VALUES (?, ?, ?, ?, ?, 'Won Conversion', 'won.conversion@test.com',
       'Won Conversion Ltd', 'billing.won@test.com', '2026-08-01', 1,
       'Won Conversion', 'public_link', REPEAT('a', 64), '2026-07-25 12:00:00',
       'Growth Engine', 199500, 0, 'Monthly in advance', '2026-08-01',
       6, 30, ?)`,
    [acceptanceId, primary.clinicId, proposalId, contactId, dealId, primary.userId],
  );
  await pool.execute(
    `INSERT INTO growth_score_snapshot
      (id, clinic_id, contact_id, snapshot_date, overall_score, category_scores,
       seo_score, tracking_score, recommended_package, gap_summary, source, created_by)
     VALUES (?, ?, ?, '2026-07-20', 71.50, JSON_OBJECT('seo', 62, 'tracking', 58),
       62, 58, 'Market Leader', 'Tracking and SEO are the biggest gaps.', 'manual', ?)`,
    [growthScoreSnapshotId, primary.clinicId, contactId, primary.userId],
  );

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
    throw new Error("Failed to start won deal conversion test server");
  }

  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    const serviceWithPrivateHooks = clientAccountsService as any;
    const originalConversionEventInserter = serviceWithPrivateHooks.insertConversionEvents;
    let rolledBackClientClinicId: string | null = null;
    serviceWithPrivateHooks.insertConversionEvents = async (...args: any[]) => {
      rolledBackClientClinicId = args[1].createdClinicId;
      await originalConversionEventInserter.apply(clientAccountsService, args);
      throw new Error("Injected conversion event failure");
    };

    let rolledBackConversion: any;
    try {
      rolledBackConversion = await fetchJson(baseUrl, "/api/client-accounts/convert-won", primary.token, {
        method: "POST",
        body: JSON.stringify({
          dealId,
          accountName: rollbackAccountName,
          clientStatus: "onboarding",
          onboardingStatus: "in_progress",
          createOnboardingTasks: true,
        }),
      });
    } finally {
      serviceWithPrivateHooks.insertConversionEvents = originalConversionEventInserter;
    }

    assert.equal(rolledBackConversion.response.status, 500);
    assert.ok(rolledBackClientClinicId);

    const [rolledBackDealRows]: any = await pool.execute(
      `SELECT client_account_profile_id as clientAccountProfileId, client_converted_at as clientConvertedAt
       FROM deal
       WHERE id = ? AND clinic_id = ?`,
      [dealId, primary.clinicId],
    );
    assert.equal(rolledBackDealRows[0].clientAccountProfileId, null);
    assert.equal(rolledBackDealRows[0].clientConvertedAt, null);

    const [rolledBackHistoryRows]: any = await pool.execute(
      `SELECT
         (SELECT client_account_profile_id FROM proposal WHERE id = ?) as proposalProfileId,
         (SELECT client_account_profile_id FROM proposal_acceptance_record WHERE id = ?) as acceptanceProfileId,
         (SELECT client_account_profile_id FROM growth_score_snapshot WHERE id = ?) as growthScoreProfileId,
         (SELECT COUNT(*) FROM client_account_contact WHERE clinic_id = ? AND contact_id = ?) as relationCount,
         (SELECT COUNT(*) FROM task WHERE clinic_id = ? AND template_key LIKE ?) as taskCount,
         (SELECT COUNT(*) FROM clinic WHERE name = ? AND deleted_at IS NULL) as accountCount`,
      [
        proposalId,
        acceptanceId,
        growthScoreSnapshotId,
        primary.clinicId,
        contactId,
        primary.clinicId,
        `won_client_onboarding:${dealId}:%`,
        rollbackAccountName,
      ],
    );
    assert.equal(rolledBackHistoryRows[0].proposalProfileId, null);
    assert.equal(rolledBackHistoryRows[0].acceptanceProfileId, null);
    assert.equal(rolledBackHistoryRows[0].growthScoreProfileId, null);
    assert.equal(Number(rolledBackHistoryRows[0].relationCount), 0);
    assert.equal(Number(rolledBackHistoryRows[0].taskCount), 0);
    assert.equal(Number(rolledBackHistoryRows[0].accountCount), 0);

    const [rolledBackEventRows]: any = await pool.execute(
      `SELECT
         (SELECT COUNT(*)
          FROM audit_log
          WHERE clinic_id = ?
            AND action = 'CLIENT_ACCOUNT_CREATED') as accountCreatedAuditCount,
         (SELECT COUNT(*)
          FROM audit_log
          WHERE clinic_id = ?
            AND action = 'WON_DEAL_CONVERTED_TO_CLIENT_ACCOUNT'
            AND entity_id = ?) as conversionAuditCount,
         (SELECT COUNT(*)
          FROM activity
          WHERE clinic_id = ?
            AND contact_id = ?
            AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.action')) = 'won_deal_converted_to_client'
            AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.changes.dealId')) = ?) as conversionActivityCount`,
      [
        rolledBackClientClinicId,
        primary.clinicId,
        dealId,
        primary.clinicId,
        contactId,
        dealId,
      ],
    );
    assert.equal(Number(rolledBackEventRows[0].accountCreatedAuditCount), 0);
    assert.equal(Number(rolledBackEventRows[0].conversionAuditCount), 0);
    assert.equal(Number(rolledBackEventRows[0].conversionActivityCount), 0);

    const [rolledBackContactRows]: any = await pool.execute(
      `SELECT status, lead_status as leadStatus, notes
       FROM contact
       WHERE id = ? AND clinic_id = ?`,
      [contactId, primary.clinicId],
    );
    assert.equal(rolledBackContactRows[0].status, "lead");
    assert.equal(rolledBackContactRows[0].leadStatus, "new");
    assert.equal(rolledBackContactRows[0].notes, "Original sales notes stay on the contact.");

    const conversionPayload = {
      dealId,
      accountName: convertedAccountName,
      clientStatus: "onboarding",
      onboardingStatus: "in_progress",
      createOnboardingTasks: true,
    };
    const convert = () => fetchJson(baseUrl, "/api/client-accounts/convert-won", primary.token, {
      method: "POST",
      body: JSON.stringify(conversionPayload),
    });
    const originalAccountInserter = serviceWithPrivateHooks.insertAccountRows;
    let signalAccountInsertReached!: () => void;
    let releaseAccountInsert!: () => void;
    const accountInsertReached = new Promise<void>((resolve) => {
      signalAccountInsertReached = resolve;
    });
    const accountInsertRelease = new Promise<void>((resolve) => {
      releaseAccountInsert = resolve;
    });
    let pauseNextAccountInsert = true;
    serviceWithPrivateHooks.insertAccountRows = async (...args: any[]) => {
      if (pauseNextAccountInsert) {
        pauseNextAccountInsert = false;
        signalAccountInsertReached();
        await accountInsertRelease;
      }
      return originalAccountInserter.apply(clientAccountsService, args);
    };

    let firstConversionPromise: Promise<any> | null = null;
    let concurrentConversionPromise: Promise<any> | null = null;
    let contactEditPromise: Promise<any> | null = null;
    const earlierContactEditor = await pool.getConnection();
    let earlierContactEditCommitted = false;
    let converted: any;
    let concurrentConversion: any;
    try {
      await earlierContactEditor.beginTransaction();
      await earlierContactEditor.execute(
        `SELECT id
         FROM contact
         WHERE id = ? AND clinic_id = ?
         FOR UPDATE`,
        [contactId, primary.clinicId],
      );
      await earlierContactEditor.execute(
        `UPDATE contact
         SET notes = 'Editor note committed before conversion.',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND clinic_id = ?`,
        [contactId, primary.clinicId],
      );

      firstConversionPromise = convert();
      const conversionWhileContactLocked = await Promise.race([
        firstConversionPromise.then(() => "completed"),
        new Promise<"blocked">((resolve) => setTimeout(() => resolve("blocked"), 100)),
      ]);
      assert.equal(
        conversionWhileContactLocked,
        "blocked",
        "Conversion should wait for a contact edit that already owns the row lock",
      );

      await earlierContactEditor.commit();
      earlierContactEditCommitted = true;
      await accountInsertReached;

      contactEditPromise = pool.execute(
        `UPDATE contact
         SET notes = 'Concurrent editor note is preserved.',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND clinic_id = ?`,
        [contactId, primary.clinicId],
      );
      const contactEditState = await Promise.race([
        contactEditPromise.then(() => "completed"),
        new Promise<"blocked">((resolve) => setTimeout(() => resolve("blocked"), 100)),
      ]);
      assert.equal(contactEditState, "blocked", "Contact edits should wait for the conversion transaction");

      concurrentConversionPromise = convert();
      const concurrentConversionState = await Promise.race([
        concurrentConversionPromise.then(() => "completed"),
        new Promise<"blocked">((resolve) => setTimeout(() => resolve("blocked"), 100)),
      ]);
      assert.equal(
        concurrentConversionState,
        "blocked",
        "A concurrent conversion should wait for the locked deal",
      );

      releaseAccountInsert();
      [converted, concurrentConversion] = await Promise.all([
        firstConversionPromise,
        concurrentConversionPromise,
      ]);
      await contactEditPromise;
    } finally {
      if (!earlierContactEditCommitted) {
        await earlierContactEditor.rollback();
      }
      earlierContactEditor.release();
      releaseAccountInsert();
      serviceWithPrivateHooks.insertAccountRows = originalAccountInserter;
      await Promise.allSettled(
        [firstConversionPromise, concurrentConversionPromise, contactEditPromise]
          .filter((promise): promise is Promise<any> => promise !== null),
      );
    }

    assert.equal(converted.response.status, 201);
    assert.equal(concurrentConversion.response.status, 201);
    assert.equal(converted.body.status, "success");
    assert.equal(concurrentConversion.body.status, "success");
    assert.ok(converted.body.data.id, "Converted client account should return a stable profile id");
    assert.equal(concurrentConversion.body.data.id, converted.body.data.id);
    assert.equal(concurrentConversion.body.data.clinicId, converted.body.data.clinicId);
    assert.notEqual(converted.body.data.clinicId, primary.clinicId, "Client status must live on the new client account, not the sales workspace");
    assert.equal(converted.body.data.clientStatus, "onboarding");
    assert.equal(converted.body.data.onboardingStatus, "in_progress");
    assert.equal(converted.body.data.currentPackage, "Growth Engine");
    assert.equal(converted.body.data.monthlyPrice, 1995);
    assert.equal(converted.body.data.setupFee, 0);
    assert.equal(converted.body.data.currency, "GBP");
    assert.equal(converted.body.data.contractStartDate, "2026-08-01");
    assert.equal(converted.body.data.noticeDate, "2027-01-02");
    assert.equal(converted.body.data.paymentStatus, "pending");
    assert.equal(converted.body.data.invoiceStatus, "not_sent");
    assert.equal(converted.body.data.recommendedNextPackage, "Market Leader");

    const clientAccountProfileId = converted.body.data.id;
    const clientClinicId = converted.body.data.clinicId;
    const [convertedProfileRows]: any = await pool.execute(
      `SELECT key_notes as keyNotes
       FROM client_account_profile
       WHERE id = ? AND clinic_id = ?`,
      [clientAccountProfileId, clientClinicId],
    );
    assert.match(
      convertedProfileRows[0].keyNotes,
      /Editor note committed before conversion\./,
      "Conversion should read the contact notes committed before it acquired the contact lock",
    );

    const [createdAccountRows]: any = await pool.execute(
      `SELECT COUNT(*) as count
       FROM clinic c
       JOIN client_account_profile cap ON cap.clinic_id = c.id
       WHERE c.name = ?
         AND c.deleted_at IS NULL`,
      [convertedAccountName],
    );
    assert.equal(Number(createdAccountRows[0].count), 1, "Concurrent conversion should create one client account");

    const [dealRows]: any = await pool.execute(
      `SELECT status, client_account_profile_id as clientAccountProfileId, client_converted_at as clientConvertedAt
       FROM deal WHERE id = ? AND clinic_id = ?`,
      [dealId, primary.clinicId],
    );
    assert.equal(dealRows[0].status, "won", "Deal stage/status remains separate from client status");
    assert.equal(dealRows[0].clientAccountProfileId, clientAccountProfileId);
    assert.ok(dealRows[0].clientConvertedAt);

    const [contactRows]: any = await pool.execute(
      `SELECT lead_status as leadStatus, status, account_name as accountName, notes
       FROM contact WHERE id = ? AND clinic_id = ?`,
      [contactId, primary.clinicId],
    );
    assert.equal(contactRows[0].leadStatus, "converted");
    assert.equal(contactRows[0].status, "active");
    assert.equal(contactRows[0].accountName, "Won Conversion Account");
    assert.equal(contactRows[0].notes, "Concurrent editor note is preserved.");

    const [relationRows]: any = await pool.execute(
      `SELECT id, client_account_profile_id as clientAccountProfileId
       FROM client_account_contact
       WHERE clinic_id = ? AND contact_id = ? AND client_account_profile_id = ?`,
      [primary.clinicId, contactId, clientAccountProfileId],
    );
    assert.equal(relationRows.length, 1);

    const [proposalRows]: any = await pool.execute(
      "SELECT client_account_profile_id as clientAccountProfileId FROM proposal WHERE id = ?",
      [proposalId],
    );
    assert.equal(proposalRows[0].clientAccountProfileId, clientAccountProfileId);

    const [acceptanceRows]: any = await pool.execute(
      "SELECT client_account_profile_id as clientAccountProfileId FROM proposal_acceptance_record WHERE id = ?",
      [acceptanceId],
    );
    assert.equal(acceptanceRows[0].clientAccountProfileId, clientAccountProfileId);

    const [snapshotRows]: any = await pool.execute(
      "SELECT client_account_profile_id as clientAccountProfileId FROM growth_score_snapshot WHERE id = ?",
      [growthScoreSnapshotId],
    );
    assert.equal(snapshotRows[0].clientAccountProfileId, clientAccountProfileId);

    const [taskRows]: any = await pool.execute(
      `SELECT title, client_account_profile_id as clientAccountProfileId, contact_id as contactId,
              assigned_user_id as assignedUserId, due_date as dueDate, status, category, template_key as templateKey
       FROM task
       WHERE clinic_id = ?
         AND client_account_profile_id = ?
         AND contact_id = ?
         AND category = 'client_onboarding'
         AND is_internal = 1
         AND deleted_at IS NULL`,
      [primary.clinicId, clientAccountProfileId, contactId],
    );
    assert.equal(taskRows.length, 16);
    assert.equal(taskRows.every((task: any) => task.status === "pending"), true);
    assert.equal(taskRows.every((task: any) => task.assignedUserId === primary.userId), true);
    assert.equal(taskRows.every((task: any) => task.dueDate), true);
    assert.equal(taskRows.every((task: any) => String(task.title).length <= 255), true);
    assert.equal(taskRows.every((task: any) => String(task.templateKey).startsWith(`won_client_onboarding:${dealId}:`)), true);
    const onboardingTemplateKeys = taskRows.map((task: any) => String(task.templateKey));
    for (const key of [
      "owner-assignment",
      "invoice",
      "gocardless",
      "onboarding-form",
      "drive-folder",
      "website-access",
      "ga4",
      "gsc",
      "gtm",
      "google-ads",
      "gbp",
      "meta",
      "brand-assets",
      "treatment-pricing-info",
      "reporting-setup",
      "first-review",
    ]) {
      assert.ok(onboardingTemplateKeys.includes(`won_client_onboarding:${dealId}:${key}`), `Missing onboarding checklist item ${key}`);
    }

    await pool.execute(
      `UPDATE task
       SET due_date = DATE_ADD(CURDATE(), INTERVAL 30 DAY)
       WHERE clinic_id = ?
         AND client_account_profile_id = ?
         AND category = 'client_onboarding'
         AND is_internal = 1
         AND deleted_at IS NULL`,
      [primary.clinicId, clientAccountProfileId],
    );
    await pool.execute(
      `UPDATE task
       SET due_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY),
           needs_qa = 1,
           approval_status = 'pending',
           missed_task = 1,
           escalation_flag = 1
       WHERE clinic_id = ?
         AND client_account_profile_id = ?
         AND template_key = ?`,
      [
        primary.clinicId,
        clientAccountProfileId,
        `won_client_onboarding:${dealId}:owner-assignment`,
      ],
    );

    const convertedAccountList = await fetchJson(baseUrl, "/api/client-accounts", primary.token);
    assert.equal(convertedAccountList.response.status, 200);
    const convertedAccountSummary = convertedAccountList.body.data.find(
      (account: any) => account.id === clientAccountProfileId,
    );
    assert.ok(convertedAccountSummary, "Managed won conversion should appear in the client account list");
    assert.equal(convertedAccountSummary.pendingTaskCount, 16);
    assert.equal(convertedAccountSummary.overdueTaskCount, 1);
    assert.equal(convertedAccountSummary.qaTaskCount, 1);
    assert.equal(convertedAccountSummary.missedTaskCount, 1);
    assert.equal(convertedAccountSummary.escalatedTaskCount, 1);

    await pool.execute(
      `INSERT INTO user
        (id, clinic_id, email, password_hash, first_name, last_name, role,
         email_verified_at, status, is_active)
       VALUES (?, ?, ?, ?, 'Secondary', 'Assignee', 'STAFF',
         CURRENT_TIMESTAMP, 'active', 1)`,
      [
        secondaryAssigneeId,
        clientClinicId,
        uniqueEmail("won_secondary_assignee"),
        await hashPassword("password123"),
      ],
    );
    await pool.execute(
      `INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
       VALUES (?, ?, 'STAFF', 'active', 0)`,
      [secondaryAssigneeId, primary.clinicId],
    );
    await pool.execute(
      `UPDATE task
       SET assigned_user_id = ?
       WHERE clinic_id = ?
         AND template_key = ?`,
      [secondaryAssigneeId, primary.clinicId, `won_client_onboarding:${dealId}:invoice`],
    );
    const linkedWithSecondaryAssignee = await fetchJson(
      baseUrl,
      `/api/client-accounts/${clientClinicId}/linked-records`,
      primary.token,
    );
    assert.equal(linkedWithSecondaryAssignee.response.status, 200);
    assert.equal(
      linkedWithSecondaryAssignee.body.data.openTasks.find(
        (task: any) => task.templateKey === `won_client_onboarding:${dealId}:invoice`,
      ).assignedTo,
      "Secondary Assignee",
    );
    await pool.execute(
      "UPDATE clinic_membership SET status = 'inactive' WHERE user_id = ? AND clinic_id = ?",
      [secondaryAssigneeId, primary.clinicId],
    );

    const secondConversion = await fetchJson(baseUrl, "/api/client-accounts/convert-won", primary.token, {
      method: "POST",
      body: JSON.stringify({
        dealId,
        accountName: "Duplicate Conversion Attempt",
        accountManagerId: uuidv4(),
      }),
    });
    assert.equal(secondConversion.response.status, 201);
    assert.equal(secondConversion.body.data.id, clientAccountProfileId);

    const [taskRowsAfterRetry]: any = await pool.execute(
      `SELECT COUNT(*) as count
       FROM task
       WHERE clinic_id = ?
         AND client_account_profile_id = ?
         AND category = 'client_onboarding'
         AND is_internal = 1
         AND deleted_at IS NULL`,
      [primary.clinicId, clientAccountProfileId],
    );
    assert.equal(Number(taskRowsAfterRetry[0].count), 16, "Retrying conversion should not duplicate onboarding tasks");
    const [repairedAssigneeRows]: any = await pool.execute(
      `SELECT assigned_user_id as assignedUserId
       FROM task
       WHERE clinic_id = ?
         AND template_key = ?`,
      [primary.clinicId, `won_client_onboarding:${dealId}:invoice`],
    );
    assert.equal(repairedAssigneeRows[0].assignedUserId, primary.userId);

    const linkedRecords = await fetchJson(baseUrl, `/api/client-accounts/${clientClinicId}/linked-records`, primary.token);
    assert.equal(linkedRecords.response.status, 200);
    assert.equal(linkedRecords.body.data.contacts.some((contact: any) => contact.id === contactId), true);
    assert.equal(linkedRecords.body.data.openTasks.length, 16);
    assert.equal(linkedRecords.body.data.acceptedProposals.length, 1);
    assert.equal(linkedRecords.body.data.counts.acceptedProposals, 1);
    assert.equal(linkedRecords.body.data.acceptedProposals[0].proposalId, proposalId);
    assert.equal(linkedRecords.body.data.acceptedProposals[0].proposalName, "Growth Engine Proposal");
    assert.equal(linkedRecords.body.data.acceptedProposals[0].acceptedByName, "Won Conversion");
    assert.equal(linkedRecords.body.data.acceptedProposals[0].legalCompanyName, "Won Conversion Ltd");
    assert.equal(linkedRecords.body.data.acceptedProposals[0].billingEmail, "billing.won@test.com");
    assert.equal(linkedRecords.body.data.acceptedProposals[0].preferredStartDate, "2026-08-01");
    assert.equal(linkedRecords.body.data.acceptedProposals[0].evidenceSha256, "a".repeat(64));
    assert.ok(linkedRecords.body.data.acceptedProposals[0].lockedAt);
    assert.equal(
      linkedRecords.body.data.openTasks.every((task: any) => task.assignedTo === "WonDealConversion Admin"),
      true,
    );

    const [accountCreatedAuditRows]: any = await pool.execute(
      `SELECT COUNT(*) as count
       FROM audit_log
       WHERE clinic_id = ?
         AND action = 'CLIENT_ACCOUNT_CREATED'
         AND entity_type = 'client_account_profile'
         AND entity_id = ?
         AND deleted_at IS NULL`,
      [clientClinicId, clientAccountProfileId],
    );
    assert.equal(Number(accountCreatedAuditRows[0].count), 1, "Concurrent conversion should emit one account-created audit");

    const [conversionAuditRows]: any = await pool.execute(
      `SELECT COUNT(*) as count
       FROM audit_log
       WHERE clinic_id = ?
         AND action = 'WON_DEAL_CONVERTED_TO_CLIENT_ACCOUNT'
         AND entity_type = 'deal'
         AND entity_id = ?
         AND deleted_at IS NULL`,
      [primary.clinicId, dealId],
    );
    assert.equal(Number(conversionAuditRows[0].count), 1, "Concurrent conversion should emit one conversion audit");

    const [conversionActivityRows]: any = await pool.execute(
      `SELECT COUNT(*) as count
       FROM activity
       WHERE clinic_id = ?
         AND contact_id = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.action')) = 'won_deal_converted_to_client'
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.changes.dealId')) = ?
         AND deleted_at IS NULL`,
      [primary.clinicId, contactId, dealId],
    );
    assert.equal(Number(conversionActivityRows[0].count), 1, "Concurrent conversion should emit one timeline event");

    console.log("[client-accounts] won deal conversion, history links, and onboarding tasks passed");
  } finally {
    const [createdClientRows]: any = await pool.execute(
      `SELECT c.id as clinicId
       FROM clinic c
       JOIN client_account_profile cap ON cap.clinic_id = c.id
       WHERE c.name IN (?, ?)`,
      [rollbackAccountName, convertedAccountName],
    );

    await pool.execute(
      `DELETE FROM activity
       WHERE clinic_id = ?
         AND contact_id = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.action')) = 'won_deal_converted_to_client'
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.changes.dealId')) = ?`,
      [primary.clinicId, contactId, dealId],
    );
    await pool.execute(
      "DELETE FROM audit_log WHERE clinic_id = ? AND action = 'WON_DEAL_CONVERTED_TO_CLIENT_ACCOUNT' AND entity_id = ?",
      [primary.clinicId, dealId],
    );
    await pool.execute("DELETE FROM task WHERE clinic_id = ? AND template_key LIKE ?", [primary.clinicId, `won_client_onboarding:${dealId}:%`]);
    await pool.execute("DELETE FROM proposal_acceptance_record WHERE id = ?", [acceptanceId]);
    await pool.execute("DELETE FROM proposal WHERE id = ?", [proposalId]);
    await pool.execute("DELETE FROM growth_score_snapshot WHERE id = ?", [growthScoreSnapshotId]);
    await pool.execute("DELETE FROM deal WHERE id = ?", [dealId]);
    await pool.execute("DELETE FROM pipeline_stage WHERE id = ?", [stageId]);
    await pool.execute("DELETE FROM pipeline WHERE id = ?", [pipelineId]);
    await pool.execute("DELETE FROM client_account_contact WHERE clinic_id = ? AND contact_id = ?", [primary.clinicId, contactId]);
    await pool.execute("UPDATE contact SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ?", [contactId, primary.clinicId]);
    await pool.execute("DELETE FROM clinic_membership WHERE user_id = ?", [secondaryAssigneeId]);
    await pool.execute("DELETE FROM user WHERE id = ?", [secondaryAssigneeId]);
    for (const createdClient of createdClientRows) {
      await pool.execute("DELETE FROM audit_log WHERE clinic_id = ?", [createdClient.clinicId]);
      await pool.execute("DELETE FROM client_account_profile WHERE clinic_id = ?", [createdClient.clinicId]);
      await pool.execute("DELETE FROM clinic WHERE id = ?", [createdClient.clinicId]);
    }
    await closeTestServer(server);
  }
});

test("moving an opportunity to Won automatically and safely creates the onboarding checklist", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("PipelineWonAutomation");
  const contactWriter = await createContactWriterUser(primary.clinicId, "PipelineWonAutomation");
  const pipelineId = uuidv4();
  const openStageId = uuidv4();
  const wonStageId = uuidv4();
  const automaticDealId = uuidv4();
  const failedDealId = uuidv4();
  const automaticContactId = await createTestContact(
    primary.clinicId,
    "AutomaticWon",
    `Automatic Won Client ${automaticDealId}`,
  );
  const failedContactId = await createTestContact(
    primary.clinicId,
    "FailedAutomaticWon",
    `Failed Automatic Won Client ${failedDealId}`,
  );

  await pool.execute(
    "INSERT INTO pipeline (id, clinic_id, name, description, stages) VALUES (?, ?, ?, ?, JSON_ARRAY('Open', 'Won'))",
    [pipelineId, primary.clinicId, defaultPipelineName, "MC-043 automatic conversion test"],
  );
  await pool.execute(
    `INSERT INTO pipeline_stage
      (id, clinic_id, pipeline_id, name, color, position, kind, is_locked, created_by)
     VALUES
      (?, ?, ?, 'Open', 'bg-slate-500', 1, 'open', 0, ?),
      (?, ?, ?, 'Won', 'bg-emerald-500', 2, 'won', 1, ?)`,
    [
      openStageId,
      primary.clinicId,
      pipelineId,
      primary.userId,
      wonStageId,
      primary.clinicId,
      pipelineId,
      primary.userId,
    ],
  );
  const automationDeals: Array<[string, string]> = [
    [automaticDealId, automaticContactId],
    [failedDealId, failedContactId],
  ];
  for (const [dealId, contactId] of automationDeals) {
    await pool.execute(
      `INSERT INTO deal
        (id, clinic_id, contact_id, pipeline_id, pipeline_stage_id, title, value, stage,
         probability, owner_id, source, treatment, status, stage_changed_at, created_by)
       VALUES (?, ?, ?, ?, ?, 'Growth delivery opportunity', 1750.00, 'Open',
         50, ?, 'referral', 'Growth Engine', 'open', '2026-07-20 09:00:00', ?)`,
      [dealId, primary.clinicId, contactId, pipelineId, openStageId, primary.userId, primary.userId],
    );
  }

  const expressModule = await import("express") as any;
  const express = expressModule.default;
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/pipeline", pipelineRoutes);
  testApp.use(errorHandler);

  const server = testApp.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start pipeline won automation test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    const rejectedWonCreation = await fetchJson(
      baseUrl,
      "/api/pipeline/deals",
      primary.token,
      {
        method: "POST",
        body: JSON.stringify({
          contactId: automaticContactId,
          stageId: wonStageId,
          title: "Direct Won bypass attempt",
          valueCents: 175000,
          treatment: "Growth Engine",
        }),
      },
    );
    assert.equal(rejectedWonCreation.response.status, 400);
    assert.match(rejectedWonCreation.body.message, /open stage.*move it to Won/i);

    const rejectedDirectWonStatus = await fetchJson(
      baseUrl,
      `/api/pipeline/deals/${failedDealId}`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "won" }),
      },
    );
    assert.equal(rejectedDirectWonStatus.response.status, 400);
    assert.match(rejectedDirectWonStatus.body.message, /controlled by its pipeline stage/i);

    const rejectedOccupiedStageKindChange = await fetchJson(
      baseUrl,
      `/api/pipeline/stages/${openStageId}`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ kind: "won" }),
      },
    );
    assert.equal(rejectedOccupiedStageKindChange.response.status, 409);
    assert.match(rejectedOccupiedStageKindChange.body.message, /move every opportunity out/i);

    const denied = await fetchJson(
      baseUrl,
      `/api/pipeline/deals/${automaticDealId}/move`,
      contactWriter.token,
      {
        method: "PATCH",
        body: JSON.stringify({ stageId: wonStageId }),
      },
    );
    assert.equal(denied.response.status, 403);
    const [afterDeniedRows]: any = await pool.execute(
      `SELECT pipeline_stage_id as stageId, status, client_account_profile_id as profileId
       FROM deal
       WHERE id = ? AND clinic_id = ?`,
      [automaticDealId, primary.clinicId],
    );
    assert.equal(afterDeniedRows[0].stageId, openStageId);
    assert.equal(afterDeniedRows[0].status, "open");
    assert.equal(afterDeniedRows[0].profileId, null);

    const automatic = await fetchJson(
      baseUrl,
      `/api/pipeline/deals/${automaticDealId}/move`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ stageId: wonStageId }),
      },
    );
    assert.equal(automatic.response.status, 200);
    assert.equal(automatic.body.data.status, "won");
    assert.ok(automatic.body.data.clientAccountProfileId);

    const [automaticTaskRows]: any = await pool.execute(
      `SELECT assigned_user_id as assignedUserId, due_date as dueDate
       FROM task
       WHERE clinic_id = ?
         AND template_key LIKE ?
         AND deleted_at IS NULL
         AND archived_at IS NULL`,
      [primary.clinicId, `won_client_onboarding:${automaticDealId}:%`],
    );
    assert.equal(automaticTaskRows.length, 16);
    assert.equal(automaticTaskRows.every((row: any) => row.assignedUserId === primary.userId), true);
    assert.equal(automaticTaskRows.every((row: any) => row.dueDate), true);

    const sameStageRetry = await fetchJson(
      baseUrl,
      `/api/pipeline/deals/${automaticDealId}/move`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ stageId: wonStageId }),
      },
    );
    assert.equal(sameStageRetry.response.status, 200);
    const [retryCountRows]: any = await pool.execute(
      `SELECT COUNT(*) as count
       FROM task
       WHERE clinic_id = ?
         AND template_key LIKE ?
         AND deleted_at IS NULL
         AND archived_at IS NULL`,
      [primary.clinicId, `won_client_onboarding:${automaticDealId}:%`],
    );
    assert.equal(Number(retryCountRows[0].count), 16);

    const serviceWithPrivateHooks = clientAccountsService as any;
    const originalConversionEventInserter = serviceWithPrivateHooks.insertConversionEvents;
    serviceWithPrivateHooks.insertConversionEvents = async (...args: any[]) => {
      await originalConversionEventInserter.apply(clientAccountsService, args);
      throw new Error("Injected automatic conversion failure");
    };
    let failedMove: any;
    try {
      failedMove = await fetchJson(
        baseUrl,
        `/api/pipeline/deals/${failedDealId}/move`,
        primary.token,
        {
          method: "PATCH",
          body: JSON.stringify({ stageId: wonStageId }),
        },
      );
    } finally {
      serviceWithPrivateHooks.insertConversionEvents = originalConversionEventInserter;
    }
    assert.equal(failedMove.response.status, 500);
    const [failedDealRows]: any = await pool.execute(
      `SELECT pipeline_stage_id as stageId,
              stage,
              status,
              sold_at as soldAt,
              client_account_profile_id as profileId,
              DATE_FORMAT(stage_changed_at, '%Y-%m-%d %H:%i:%s') as stageChangedAt
       FROM deal
       WHERE id = ? AND clinic_id = ?`,
      [failedDealId, primary.clinicId],
    );
    assert.equal(failedDealRows[0].stageId, openStageId);
    assert.equal(failedDealRows[0].stage, "Open");
    assert.equal(failedDealRows[0].status, "open");
    assert.equal(failedDealRows[0].soldAt, null);
    assert.equal(failedDealRows[0].profileId, null);
    assert.equal(failedDealRows[0].stageChangedAt, "2026-07-20 09:00:00");
    const [failedTaskRows]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM task WHERE clinic_id = ? AND template_key LIKE ?",
      [primary.clinicId, `won_client_onboarding:${failedDealId}:%`],
    );
    assert.equal(Number(failedTaskRows[0].count), 0);

    const pipelineWithPrivateHooks = pipelineDealsService as any;
    const originalWonMoveEventsInserter = pipelineWithPrivateHooks.insertWonMoveEvents;
    pipelineWithPrivateHooks.insertWonMoveEvents = async (...args: any[]) => {
      await originalWonMoveEventsInserter.apply(pipelineDealsService, args);
      throw new Error("Injected Won movement history failure");
    };
    let failedHistoryMove: any;
    try {
      failedHistoryMove = await fetchJson(
        baseUrl,
        `/api/pipeline/deals/${failedDealId}/move`,
        primary.token,
        {
          method: "PATCH",
          body: JSON.stringify({ stageId: wonStageId }),
        },
      );
    } finally {
      pipelineWithPrivateHooks.insertWonMoveEvents = originalWonMoveEventsInserter;
    }
    assert.equal(failedHistoryMove.response.status, 500);

    const [failedHistoryRows]: any = await pool.execute(
      `SELECT
         (SELECT pipeline_stage_id FROM deal WHERE id = ?) as stageId,
         (SELECT status FROM deal WHERE id = ?) as status,
         (SELECT client_account_profile_id FROM deal WHERE id = ?) as profileId,
         (SELECT COUNT(*) FROM pipeline_deal_movement WHERE clinic_id = ? AND deal_id = ?) as movementCount,
         (SELECT COUNT(*) FROM audit_log
          WHERE clinic_id = ? AND entity_id = ? AND action IN (
            'CLIENT_ACCOUNT_CREATED',
            'WON_DEAL_CONVERTED_TO_CLIENT_ACCOUNT',
            'PIPELINE_DEAL_MOVED'
          )) as auditCount,
         (SELECT COUNT(*) FROM activity
          WHERE clinic_id = ?
            AND contact_id = ?
            AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.recordId')) = ?) as activityCount,
         (SELECT COUNT(*) FROM task WHERE clinic_id = ? AND template_key LIKE ?) as taskCount,
         (SELECT COUNT(*) FROM clinic WHERE name = ? AND deleted_at IS NULL) as clientCount`,
      [
        failedDealId,
        failedDealId,
        failedDealId,
        primary.clinicId,
        failedDealId,
        primary.clinicId,
        failedContactId,
        failedDealId,
        primary.clinicId,
        failedDealId,
        primary.clinicId,
        `won_client_onboarding:${failedDealId}:%`,
        `Failed Automatic Won Client ${failedDealId}`,
      ],
    );
    assert.equal(failedHistoryRows[0].stageId, openStageId);
    assert.equal(failedHistoryRows[0].status, "open");
    assert.equal(failedHistoryRows[0].profileId, null);
    assert.equal(Number(failedHistoryRows[0].movementCount), 0);
    assert.equal(Number(failedHistoryRows[0].auditCount), 0);
    assert.equal(Number(failedHistoryRows[0].activityCount), 0);
    assert.equal(Number(failedHistoryRows[0].taskCount), 0);
    assert.equal(Number(failedHistoryRows[0].clientCount), 0);

    console.log("[client-accounts] pipeline Won automation, RBAC, idempotency and atomic rollback passed");
  } finally {
    const [createdClientRows]: any = await pool.execute(
      `SELECT DISTINCT cap.clinic_id as clinicId
       FROM deal d
       JOIN client_account_profile cap ON cap.id = d.client_account_profile_id
       WHERE d.id IN (?, ?)`,
      [automaticDealId, failedDealId],
    );
    await pool.execute(
      "DELETE FROM activity WHERE clinic_id = ? AND contact_id IN (?, ?)",
      [primary.clinicId, automaticContactId, failedContactId],
    );
    await pool.execute(
      "DELETE FROM audit_log WHERE clinic_id = ? AND entity_id IN (?, ?)",
      [primary.clinicId, automaticDealId, failedDealId],
    );
    await pool.execute(
      "DELETE FROM task WHERE clinic_id = ? AND (template_key LIKE ? OR template_key LIKE ?)",
      [
        primary.clinicId,
        `won_client_onboarding:${automaticDealId}:%`,
        `won_client_onboarding:${failedDealId}:%`,
      ],
    );
    await pool.execute(
      "DELETE FROM client_account_contact WHERE clinic_id = ? AND contact_id IN (?, ?)",
      [primary.clinicId, automaticContactId, failedContactId],
    );
    await pool.execute(
      "DELETE FROM pipeline_deal_movement WHERE clinic_id = ? AND deal_id IN (?, ?)",
      [primary.clinicId, automaticDealId, failedDealId],
    );
    await pool.execute("DELETE FROM deal WHERE id IN (?, ?)", [automaticDealId, failedDealId]);
    await pool.execute("DELETE FROM pipeline_stage WHERE id IN (?, ?)", [openStageId, wonStageId]);
    await pool.execute("DELETE FROM pipeline WHERE id = ?", [pipelineId]);
    await pool.execute("DELETE FROM contact WHERE id IN (?, ?)", [automaticContactId, failedContactId]);
    for (const createdClient of createdClientRows) {
      await pool.execute("DELETE FROM audit_log WHERE clinic_id = ?", [createdClient.clinicId]);
      await pool.execute("DELETE FROM client_account_profile WHERE clinic_id = ?", [createdClient.clinicId]);
      await pool.execute("DELETE FROM clinic WHERE id = ?", [createdClient.clinicId]);
    }
    await pool.execute("DELETE FROM role_permission WHERE role_id = ?", [contactWriter.roleId]);
    await pool.execute("DELETE FROM role WHERE id = ?", [contactWriter.roleId]);
    await closeTestServer(server);
  }
});

test("client account profile API is permission protected, updateable, audited, and separate from legacy contact data", async () => {
  await testConnection();

  const admin = await createClinicAndAdmin("ClientAccountProfile");
  const limitedUser = await createInternalViewerUser(admin.clinicId, "ClientAccountProfile");
  const clientAccountWriter = await createClientAccountWriterUser(admin.clinicId, "ClientAccountProfile");
  const deliveryUser = await createDeliveryUser(admin.clinicId, "ClientAccountProfile");
  const originalAutoProvisionClinicId = config.oauth.google.autoProvisionClinicId;
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
    throw new Error("Failed to start client account test server");
  }

  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
  let managedClientClinicId: string | null = null;
  let deliveryCreatedClientClinicId: string | null = null;

  try {
    (config as any).oauth.google.autoProvisionClinicId = admin.clinicId;

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
    const absentAccountSummary = initialList.body.data.find(
      (account: any) => account.clinicId === admin.clinicId,
    );
    assert.equal(absentAccountSummary, undefined, "A workspace without a client profile is not a client account");

    const updatePayload = {
      accountManagerId: admin.userId,
      activeServices: ["ppc", "seo", "strategy"],
      onboardingStatus: "in_progress",
      healthStatus: "healthy",
      clientStatus: "active",
      monthlyPrice: "3495.00",
      setupFee: "500.00",
      currency: "GBP",
      contractStartDate: "2026-07-01",
      noticeDate: "2026-12-01",
      paymentStatus: "pending",
      invoiceStatus: "sent",
      paymentNotes: "Manual invoice raised in QuickBooks sandbox notes.",
      currentPackage: "Growth Diagnostic",
      recommendedNextPackage: "Lead Concierge",
      growthScoreCategories: {
        websiteVisibility: 74,
        seo: 68,
        gbp: 72,
        tracking: 80,
        conversion: 65,
        leadHandling: 45,
        responseSpeed: 52,
        enquiryVisibility: 70,
        treatmentPerformance: 66,
        revenueLeakage: 62,
        growthOpportunity: 71,
      },
      churnRisk: "low",
      lastContactAt: "2026-07-10",
      lastReportAt: "2026-07-11",
      lastLoomAt: "2026-07-12",
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

    const populatedList = await fetchJson(baseUrl, "/api/client-accounts", admin.token);
    const populatedAccountSummary = populatedList.body.data.find(
      (account: any) => account.clinicId === admin.clinicId,
    );
    assert.ok(populatedAccountSummary, "A workspace with a client profile is a client account");
    const accountSummary = populatedAccountSummary;
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

    assert.equal(updated.body.data.accountManager.id, admin.userId);
    assert.deepEqual(updated.body.data.activeServices, ["ppc", "seo", "strategy"]);
    assert.equal(updated.body.data.onboardingStatus, "in_progress");
    assert.equal(updated.body.data.healthStatus, "healthy");
    assert.equal(updated.body.data.monthlyPrice, 3495);
    assert.equal(updated.body.data.setupFee, 500);
    assert.equal(updated.body.data.currency, "GBP");
    assert.equal(updated.body.data.contractStartDate, "2026-07-01");
    assert.equal(updated.body.data.noticeDate, "2026-12-01");
    assert.equal(updated.body.data.paymentStatus, "pending");
    assert.equal(updated.body.data.invoiceStatus, "sent");
    assert.equal(updated.body.data.paymentNotes, "Manual invoice raised in QuickBooks sandbox notes.");
    assert.equal(updated.body.data.currentPackage, "Growth Diagnostic");
    assert.equal(updated.body.data.recommendedNextPackage, "Lead Concierge");
    assert.equal(updated.body.data.churnRisk, "low");
    assert.equal(updated.body.data.lastContactAt.slice(0, 10), "2026-07-10");
    assert.equal(updated.body.data.lastReportAt.slice(0, 10), "2026-07-11");
    assert.equal(updated.body.data.lastLoomAt.slice(0, 10), "2026-07-12");
    assert.equal(updated.body.data.upsellPrompts.length, 1);
    assert.equal(updated.body.data.upsellPrompts[0].ruleKey, "growth_diagnostic_to_lead_concierge");
    assert.equal(updated.body.data.upsellPrompts[0].toPackage, "Lead Concierge");
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
    assert.equal(auditChanges.currentPackage.after, "Growth Diagnostic");
    assert.equal(auditChanges.healthStatus.after, "healthy");
    assert.equal(auditChanges.clientStatus.after, "active");
    assert.equal(auditChanges.contractStatus.after, "active");
    assert.equal(auditChanges.monthlyPrice.after, "3495.00");
    assert.equal(auditChanges.setupFee.after, "500.00");
    assert.equal(auditChanges.paymentStatus.after, "pending");
    assert.equal(auditChanges.invoiceStatus.after, "sent");
    assert.equal(auditChanges.lastContactAt.after, "2026-07-10 00:00:00");
    assert.equal(auditChanges.lastReportAt.after, "2026-07-11 00:00:00");
    assert.equal(auditChanges.lastLoomAt.after, "2026-07-12 00:00:00");

    const forbiddenDeliveryCreateAssignment = await fetchJson(
      baseUrl,
      "/api/client-accounts",
      deliveryUser.token,
      {
        method: "POST",
        body: JSON.stringify({
          name: "Delivery cannot assign this account",
          accountManagerId: admin.userId,
        }),
      },
    );
    assert.equal(forbiddenDeliveryCreateAssignment.response.status, 403);
    assert.equal(
      forbiddenDeliveryCreateAssignment.body.message,
      "Only an Admin can assign or change an account manager.",
    );

    const deliveryCreatedAccount = await fetchJson(
      baseUrl,
      "/api/client-accounts",
      deliveryUser.token,
      {
        method: "POST",
        body: JSON.stringify({ name: `Delivery-created Client ${admin.clinicId}` }),
      },
    );
    assert.equal(deliveryCreatedAccount.response.status, 201);
    deliveryCreatedClientClinicId = deliveryCreatedAccount.body.data.clinicId;
    assert.equal(deliveryCreatedAccount.body.data.accountManager, null);

    const forbiddenDeliveryManagerUpdate = await fetchJson(
      baseUrl,
      "/api/client-accounts/profile",
      deliveryUser.token,
      {
        method: "PATCH",
        body: JSON.stringify({ accountManagerId: null }),
      },
    );
    assert.equal(forbiddenDeliveryManagerUpdate.response.status, 403);
    assert.equal(
      forbiddenDeliveryManagerUpdate.body.message,
      "Only an Admin can assign or change an account manager.",
    );

    const allowedDeliveryProfileUpdate = await fetchJson(
      baseUrl,
      "/api/client-accounts/profile",
      deliveryUser.token,
      {
        method: "PATCH",
        body: JSON.stringify({ keyNotes: "Delivery can update non-assignment account fields." }),
      },
    );
    assert.equal(allowedDeliveryProfileUpdate.response.status, 200);
    assert.equal(allowedDeliveryProfileUpdate.body.data.accountManager.id, admin.userId);
    assert.equal(
      allowedDeliveryProfileUpdate.body.data.keyNotes,
      "Delivery can update non-assignment account fields.",
    );

    const issueTaskRes = await fetchJson(baseUrl, "/api/tasks/internal", admin.token, {
      method: "POST",
      body: JSON.stringify({
        title: "Fix client tracking issue",
        description: "Created by MC-049 issue test",
        priority: "high",
        boardKey: "delivery",
        serviceType: "tracking",
        category: "client_issue",
        clientAccountProfileId: profileRows[0].id,
        dueDate: "2020-01-01",
        assignedUserId: admin.userId,
      }),
    });
    assert.equal(issueTaskRes.response.status, 400);

    const linkedTaskRes = await fetchJson(baseUrl, "/api/tasks/internal", admin.token, {
      method: "POST",
      body: JSON.stringify({
        title: "Fix client tracking issue",
        description: "Created by MC-049 issue test",
        priority: "high",
        boardKey: "delivery",
        serviceType: "strategy",
        category: "client_issue",
        clientAccountProfileId: profileRows[0].id,
        dueDate: "2020-01-01",
        assignedUserId: admin.userId,
      }),
    });
    assert.equal(linkedTaskRes.response.status, 201);
    const linkedTaskId = linkedTaskRes.body.data.id;

    const completedTaskRes = await fetchJson(baseUrl, "/api/tasks/internal", admin.token, {
      method: "POST",
      body: JSON.stringify({
        title: "Already completed client issue task",
        description: "A completed task cannot be linked to an active client issue",
        priority: "medium",
        status: "completed",
        boardKey: "delivery",
        serviceType: "strategy",
        category: "client_issue",
        clientAccountProfileId: profileRows[0].id,
        assignedUserId: admin.userId,
      }),
    });
    assert.equal(completedTaskRes.response.status, 201);

    const completedTaskIssueRes = await fetchJson(
      baseUrl,
      `/api/client-accounts/${admin.clinicId}/issues`,
      admin.token,
      {
        method: "POST",
        body: JSON.stringify({
          title: "Completed task bypass attempt",
          taskId: completedTaskRes.body.data.id,
        }),
      },
    );
    assert.equal(completedTaskIssueRes.response.status, 400);
    assert.equal(
      completedTaskIssueRes.body.message,
      "Linked task must be an open internal task for this client account",
    );

    const forbiddenDeliveryIssueOwnerCreate = await fetchJson(
      baseUrl,
      `/api/client-accounts/${admin.clinicId}/issues`,
      deliveryUser.token,
      {
        method: "POST",
        body: JSON.stringify({
          title: "Delivery cannot assign this issue",
          ownerUserId: admin.userId,
        }),
      },
    );
    assert.equal(forbiddenDeliveryIssueOwnerCreate.response.status, 403);
    assert.equal(
      forbiddenDeliveryIssueOwnerCreate.body.message,
      "Only an Admin can assign or change an issue owner.",
    );

    const deliveryCreatedIssue = await fetchJson(
      baseUrl,
      `/api/client-accounts/${admin.clinicId}/issues`,
      deliveryUser.token,
      {
        method: "POST",
        body: JSON.stringify({
          title: "Delivery-created unassigned issue",
          priority: "medium",
        }),
      },
    );
    assert.equal(deliveryCreatedIssue.response.status, 201);
    const deliveryIssue = deliveryCreatedIssue.body.data.find(
      (issue: any) => issue.title === "Delivery-created unassigned issue",
    );
    assert.ok(deliveryIssue);
    assert.equal(deliveryIssue.owner, null);

    const forbiddenDeliveryIssueOwnerUpdate = await fetchJson(
      baseUrl,
      `/api/client-accounts/${admin.clinicId}/issues/${deliveryIssue.id}`,
      deliveryUser.token,
      {
        method: "PATCH",
        body: JSON.stringify({ ownerUserId: admin.userId }),
      },
    );
    assert.equal(forbiddenDeliveryIssueOwnerUpdate.response.status, 403);
    assert.equal(
      forbiddenDeliveryIssueOwnerUpdate.body.message,
      "Only an Admin can assign or change an issue owner.",
    );

    const allowedDeliveryIssueUpdate = await fetchJson(
      baseUrl,
      `/api/client-accounts/${admin.clinicId}/issues/${deliveryIssue.id}`,
      deliveryUser.token,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "resolved",
          notes: "Delivery can update non-assignment issue fields.",
        }),
      },
    );
    assert.equal(allowedDeliveryIssueUpdate.response.status, 200);
    const resolvedDeliveryIssue = allowedDeliveryIssueUpdate.body.data.find(
      (issue: any) => issue.id === deliveryIssue.id,
    );
    assert.equal(resolvedDeliveryIssue.status, "resolved");
    assert.equal(resolvedDeliveryIssue.owner, null);

    const createIssueRes = await fetchJson(baseUrl, `/api/client-accounts/${admin.clinicId}/issues`, admin.token, {
      method: "POST",
      body: JSON.stringify({
        title: "Tracking outage reported by client",
        priority: "high",
        sourceChannel: "email",
        ownerUserId: admin.userId,
        dueDate: "2020-01-01",
        slaDueAt: "2020-01-01T09:00:00.000Z",
        notes: "Client reported missing conversion data after website changes.",
        taskId: linkedTaskId,
      }),
    });
    assert.equal(createIssueRes.response.status, 201);
    const trackingIssue = createIssueRes.body.data.find(
      (issue: any) => issue.title === "Tracking outage reported by client",
    );
    assert.ok(trackingIssue);
    assert.equal(trackingIssue.priority, "high");
    assert.equal(trackingIssue.status, "open");
    assert.equal(trackingIssue.sourceChannel, "email");
    assert.equal(trackingIssue.owner.id, admin.userId);
    assert.equal(trackingIssue.task.id, linkedTaskId);
    assert.equal(trackingIssue.isOverdue, true);
    assert.equal(trackingIssue.slaStatus, "overdue");
    assert.equal(trackingIssue.isEscalated, true);
    assert.ok(trackingIssue.slaDueAt);
    assert.ok(trackingIssue.escalatedAt);
    assert.equal(trackingIssue.resolvedAt, null);
    const issueId = trackingIssue.id;

    const listIssuesRes = await fetchJson(baseUrl, `/api/client-accounts/${admin.clinicId}/issues`, admin.token);
    assert.equal(listIssuesRes.response.status, 200);
    assert.equal(listIssuesRes.body.data.some((issue: any) => issue.id === issueId), true);

    const issueCountList = await fetchJson(baseUrl, "/api/client-accounts", admin.token);
    const issueAccount = issueCountList.body.data.find((account: any) => account.clinicId === admin.clinicId);
    assert.equal(issueAccount.openIssueCount, 1);
    assert.equal(issueAccount.overdueIssueCount, 1);

    const resolvedIssueRes = await fetchJson(baseUrl, `/api/client-accounts/${admin.clinicId}/issues/${issueId}`, admin.token, {
      method: "PATCH",
      body: JSON.stringify({ status: "resolved" }),
    });
    assert.equal(resolvedIssueRes.response.status, 200);
    const resolvedIssue = resolvedIssueRes.body.data.find((issue: any) => issue.id === issueId);
    assert.equal(resolvedIssue.status, "resolved");
    assert.equal(resolvedIssue.slaStatus, "resolved");
    assert.ok(resolvedIssue.resolvedAt);

    const resolvedCountList = await fetchJson(baseUrl, "/api/client-accounts", admin.token);
    const resolvedAccount = resolvedCountList.body.data.find((account: any) => account.clinicId === admin.clinicId);
    assert.equal(resolvedAccount.openIssueCount, 0);
    assert.equal(resolvedAccount.overdueIssueCount, 0);

    const [issueAuditRows]: any = await pool.execute(
      `SELECT action FROM audit_log
       WHERE clinic_id = ?
         AND entity_type = 'client_account_issue'
         AND entity_id = ?
       ORDER BY created_at ASC`,
      [admin.clinicId, issueId],
    );
    assert.deepEqual(issueAuditRows.map((row: any) => row.action).sort(), [
      "CLIENT_ACCOUNT_ISSUE_CREATED",
      "CLIENT_ACCOUNT_ISSUE_UPDATED",
    ].sort());

    console.log("[client-accounts] issue/support tracker integration test passed");

    const writerSelfProfile = await fetchJson(
      baseUrl,
      "/api/client-accounts/profile",
      clientAccountWriter.token,
    );
    assert.equal(writerSelfProfile.response.status, 200);

    const writerSelfUpdate = await fetchJson(
      baseUrl,
      "/api/client-accounts/profile",
      clientAccountWriter.token,
      {
        method: "PATCH",
        body: JSON.stringify({ keyNotes: "Quarterly review scheduled by client account writer" }),
      },
    );
    assert.equal(writerSelfUpdate.response.status, 200);
    assert.equal(
      writerSelfUpdate.body.data.keyNotes,
      "Quarterly review scheduled by client account writer",
    );

    const createdManagedClient = await fetchJson(baseUrl, "/api/client-accounts", admin.token, {
      method: "POST",
      body: JSON.stringify({
        name: `Managed Client ${admin.clinicId}`,
        currentPackage: "Growth Engine",
        monthlyPrice: 1995,
      }),
    });
    assert.equal(createdManagedClient.response.status, 201);
    managedClientClinicId = createdManagedClient.body.data.clinicId;
    assert.equal(createdManagedClient.body.data.missingDocumentCount, 11);
    assert.equal(createdManagedClient.body.data.missingAccessCount, 10);

    const managedAccountList = await fetchJson(baseUrl, "/api/client-accounts", admin.token);
    assert.equal(managedAccountList.response.status, 200);
    const managedAccountSummary = managedAccountList.body.data.find(
      (account: any) => account.clinicId === managedClientClinicId,
    );
    assert.ok(managedAccountSummary);
    assert.equal(managedAccountSummary.missingDocumentCount, 11);
    assert.equal(managedAccountSummary.missingAccessCount, 10);

    const writerManagedProfile = await fetchJson(
      baseUrl,
      `/api/client-accounts/${managedClientClinicId}/profile`,
      clientAccountWriter.token,
    );
    assert.equal(writerManagedProfile.response.status, 403);

    const writerManagedUpdate = await fetchJson(
      baseUrl,
      `/api/client-accounts/${managedClientClinicId}/profile`,
      clientAccountWriter.token,
      {
        method: "PATCH",
        body: JSON.stringify({
          monthlyPrice: 1,
          paymentStatus: "paid",
          invoiceStatus: "paid",
        }),
      },
    );
    assert.equal(writerManagedUpdate.response.status, 403);

    const managedProfile = await fetchJson(
      baseUrl,
      `/api/client-accounts/${managedClientClinicId}/profile`,
      admin.token,
    );
    assert.equal(managedProfile.response.status, 200);
    assert.equal(managedProfile.body.data.clinicId, managedClientClinicId);
    assert.equal(managedProfile.body.data.currentPackage, "Growth Engine");
    assert.equal(managedProfile.body.data.missingDocumentCount, 11);
    assert.equal(managedProfile.body.data.missingAccessCount, 10);
    assert.equal(
      managedProfile.body.data.monthlyPrice,
      1995,
      "Forbidden managed update must not change commercial fields",
    );

    const managedDocuments = await fetchJson(
      baseUrl,
      `/api/client-accounts/${managedClientClinicId}/documents`,
      admin.token,
    );
    assert.equal(managedDocuments.response.status, 200);
    assert.equal(managedDocuments.body.data.length, 11);
    assert.equal(
      managedDocuments.body.data.filter((item: any) => item.status === "missing").length,
      managedProfile.body.data.missingDocumentCount,
    );

    const managedAccessItems = await fetchJson(
      baseUrl,
      `/api/client-accounts/${managedClientClinicId}/access-items`,
      admin.token,
    );
    assert.equal(managedAccessItems.response.status, 200);
    assert.equal(managedAccessItems.body.data.length, 10);
    assert.equal(
      managedAccessItems.body.data.filter((item: any) => item.isMissing).length,
      managedProfile.body.data.missingAccessCount,
    );

    const managedUpdate = await fetchJson(
      baseUrl,
      `/api/client-accounts/${managedClientClinicId}/profile`,
      admin.token,
      {
        method: "PATCH",
        body: JSON.stringify({
          accountManagerId: admin.userId,
          monthlyPrice: 2495,
          paymentStatus: "paid",
          invoiceStatus: "paid",
        }),
      },
    );
    assert.equal(managedUpdate.response.status, 200);
    assert.equal(managedUpdate.body.data.accountManager.id, admin.userId);
    assert.equal(managedUpdate.body.data.monthlyPrice, 2495);
    assert.equal(managedUpdate.body.data.paymentStatus, "paid");
    assert.equal(managedUpdate.body.data.invoiceStatus, "paid");

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
    (config as any).oauth.google.autoProvisionClinicId = originalAutoProvisionClinicId;
    if (managedClientClinicId) {
      await pool.execute("DELETE FROM audit_log WHERE clinic_id IN (?, ?)", [admin.clinicId, managedClientClinicId]);
      await pool.execute("DELETE FROM client_account_profile WHERE clinic_id = ?", [managedClientClinicId]);
      await pool.execute("DELETE FROM clinic WHERE id = ?", [managedClientClinicId]);
    }
    if (deliveryCreatedClientClinicId) {
      await pool.execute("DELETE FROM audit_log WHERE clinic_id = ?", [deliveryCreatedClientClinicId]);
      await pool.execute("DELETE FROM client_account_profile WHERE clinic_id = ?", [deliveryCreatedClientClinicId]);
      await pool.execute("DELETE FROM clinic WHERE id = ?", [deliveryCreatedClientClinicId]);
    }
    await pool.execute(
      "DELETE FROM role_permission WHERE role_id IN (?, ?)",
      [limitedUser.roleId, clientAccountWriter.roleId],
    );
    await pool.execute(
      "DELETE FROM role WHERE id IN (?, ?)",
      [limitedUser.roleId, clientAccountWriter.roleId],
    );

    // Clean up service records before profile/contact cleanup
    await pool.execute(`DELETE FROM audit_log WHERE clinic_id = ? AND entity_type = 'client_account_service'`, [admin.clinicId]);
    await pool.execute(`DELETE FROM audit_log WHERE clinic_id = ? AND entity_type = 'client_account_issue'`, [admin.clinicId]);
    await pool.execute(`DELETE FROM client_account_issue WHERE clinic_id = ?`, [admin.clinicId]);
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

    await closeTestServer(server);
    await pool.end();
  }
});
