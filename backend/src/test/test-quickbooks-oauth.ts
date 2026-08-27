import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

process.env.JWT_SECRET = "quickbooks-test-jwt-secret-with-more-than-32-characters";
process.env.API_PUBLIC_URL = "https://mission-control.test/api";
process.env.QUICKBOOKS_OAUTH_ENABLED = "true";
process.env.QUICKBOOKS_CLIENT_ID = "quickbooks-client-id";
process.env.QUICKBOOKS_CLIENT_SECRET = "quickbooks-client-secret";
process.env.QUICKBOOKS_ENVIRONMENT = "sandbox";
process.env.QUICKBOOKS_SCOPES = "com.intuit.quickbooks.accounting";
process.env.CREDENTIAL_ENCRYPTION_KEY = "quickbooks-test-credential-key-32-chars-plus";

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(currentDir, "../../scripts/migrations/20260804_add_quickbooks_integration_foundation.sql");
const routesPath = resolve(currentDir, "../modules/quickbooks/quickbooks.routes.js");

type TestModules = {
  pool: typeof import("../config/database.js").default;
  app: typeof import("../app.js").default;
  quickBooksService: typeof import("../modules/quickbooks/quickbooks.service.js").quickBooksService;
  hashPassword: typeof import("../utils/helpers.js").hashPassword;
  generateToken: typeof import("../utils/helpers.js").generateToken;
  encryptProviderCredential: typeof import("../utils/provider-credentials.js").encryptProviderCredential;
};

let modulesPromise: Promise<TestModules> | null = null;

async function modules() {
  if (!modulesPromise) {
    modulesPromise = Promise.all([
      import("../config/database.js"),
      import("../app.js"),
      import("../modules/quickbooks/quickbooks.service.js"),
      import("../utils/helpers.js"),
      import("../utils/provider-credentials.js"),
    ]).then(([databaseModule, appModule, quickBooksModule, helpersModule, credentialsModule]) => ({
      pool: databaseModule.default,
      app: appModule.default,
      quickBooksService: quickBooksModule.quickBooksService,
      hashPassword: helpersModule.hashPassword,
      generateToken: helpersModule.generateToken,
      encryptProviderCredential: credentialsModule.encryptProviderCredential,
    }));
  }
  return modulesPromise;
}

function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function runQuickBooksMigration() {
  const { pool } = await modules();
  const sql = await readFile(migrationPath, "utf8");
  for (const statement of sql.split(/;\s*\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    await pool.query(statement);
  }
}

async function createWorkspace(prefix: string) {
  const { pool, hashPassword, generateToken } = await modules();
  const clinicId = uuidv4();
  const userId = uuidv4();
  const email = `${unique(prefix)}@quickbooks.test`;
  await pool.execute(
    `INSERT INTO clinic
      (id, name, email, phone, timezone, subscription_plan, subscription_status, max_users)
     VALUES (?, ?, ?, '020 7946 0000', 'Europe/London', 'professional', 'active', 20)`,
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
  return { clinicId, userId, token: generateToken({ userId, clinicId, role: "SUPER_ADMIN", email }) };
}

async function createUserWithPermissions(clinicId: string, prefix: string, permissions: string[]) {
  const { pool, hashPassword, generateToken } = await modules();
  const userId = uuidv4();
  const roleId = uuidv4();
  const roleName = unique(prefix);
  const email = `${unique(prefix)}@quickbooks.test`;
  await pool.execute(
    "INSERT INTO role (id, clinic_id, name, display_name, is_system) VALUES (?, ?, ?, ?, 0)",
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
    "INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary) VALUES (?, ?, ?, 'active', 1)",
    [userId, clinicId, roleName],
  );
  return { userId, roleId, token: generateToken({ userId, clinicId, role: roleName, email }) };
}

async function createClientAccount(prefix: string, workspace?: { clinicId: string; userId: string }) {
  const { pool } = await modules();
  const clientClinicId = uuidv4();
  const profileId = uuidv4();
  const contactId = uuidv4();
  await pool.execute(
    `INSERT INTO clinic
      (id, name, email, phone, timezone, subscription_plan, subscription_status, max_users)
     VALUES (?, ?, ?, '020 7946 0000', 'Europe/London', 'professional', 'active', 20)`,
    [clientClinicId, `${prefix} Client`, `${unique(prefix)}@client.test`],
  );
  await pool.execute(
    `INSERT INTO client_account_profile
      (id, clinic_id, active_services, payment_status, invoice_status, payment_notes)
     VALUES (?, ?, ?, 'pending', 'sent', 'Manual finance fields should stay unchanged.')`,
    [profileId, clientClinicId, JSON.stringify([])],
  );
  if (workspace) {
    await pool.execute(
      `INSERT INTO contact
        (id, clinic_id, first_name, last_name, email, phone, status, lead_status)
       VALUES (?, ?, ?, 'Contact', ?, '020 7946 0000', 'active', 'converted')`,
      [contactId, workspace.clinicId, prefix, `${unique(prefix)}@contact.test`],
    );
    await pool.execute(
      `INSERT INTO client_account_contact
        (id, clinic_id, client_account_profile_id, contact_id, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), workspace.clinicId, profileId, contactId, workspace.userId],
    );
  }
  return { clientClinicId, profileId };
}

async function connectQuickBooks(clinicId: string, userId: string, realmId = "realm-123") {
  const { pool, encryptProviderCredential } = await modules();
  await pool.execute(
    `INSERT INTO integration (id, clinic_id, name, type, config, is_active, last_sync)
     VALUES (?, ?, 'QuickBooks', 'quickbooks', ?, 1, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE config = VALUES(config), is_active = 1, deleted_at = NULL`,
    [
      uuidv4(),
      clinicId,
      JSON.stringify({
        oauthConnected: true,
        environment: "sandbox",
        realmId,
        companyName: "QuickBooks Sandbox Company",
        connectedAt: new Date().toISOString(),
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        encryptedAccessToken: encryptProviderCredential("qb-access-token"),
        encryptedRefreshToken: encryptProviderCredential("qb-refresh-token"),
      }),
    ],
  );
}

async function closeServer(server: Server) {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function mockQuickBooksCustomer(customer: {
  id: string;
  displayName: string;
  companyName?: string;
  email?: string;
  active?: boolean;
}) {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = (async (input: string | URL) => {
    requestCount += 1;
    const url = String(input);
    if (!url.includes("/v3/company/realm-123/query")) {
      return new Response(JSON.stringify({ Fault: { Error: [{ Message: `Unexpected QuickBooks URL ${url}` }] } }), { status: 500 });
    }
    return new Response(JSON.stringify({
      QueryResponse: {
        Customer: [{
          Id: customer.id,
          DisplayName: customer.displayName,
          CompanyName: customer.companyName || null,
          PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
          Active: customer.active !== false,
        }],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return {
    get requestCount() {
      return requestCount;
    },
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

test.before(async () => {
  await runQuickBooksMigration();
});

test.after(async () => {
  const { pool } = await modules();
  await pool.end();
});

test("QuickBooks OAuth URL is tenant scoped and requests accounting access", async () => {
  const { quickBooksService } = await import("../modules/quickbooks/quickbooks.service.js");
  const authorizeUrl = quickBooksService.getAuthorizationUrl("clinic-001", "user-001");
  const parsed = new URL(authorizeUrl);

  assert.equal(parsed.origin + parsed.pathname, "https://appcenter.intuit.com/connect/oauth2");
  assert.equal(parsed.searchParams.get("client_id"), "quickbooks-client-id");
  assert.equal(parsed.searchParams.get("response_type"), "code");
  assert.equal(parsed.searchParams.get("scope"), "com.intuit.quickbooks.accounting");
  assert.equal(parsed.searchParams.get("redirect_uri"), "https://mission-control.test/api/quickbooks/oauth/callback");

  const state = parsed.searchParams.get("state");
  assert.ok(state);
  const decoded = jwt.verify(state, process.env.JWT_SECRET!) as any;
  assert.equal(decoded.purpose, "quickbooks");
  assert.equal(decoded.provider, "quickbooks");
  assert.equal(decoded.clinicId, "clinic-001");
  assert.equal(decoded.userId, "user-001");
});

test("QuickBooks client mapping requires a connected QuickBooks account", async () => {
  const { quickBooksService, pool } = await modules();
  const workspace = await createWorkspace("quickbooks-not-connected");
  const client = await createClientAccount("quickbooks-not-connected", workspace);

  await assert.rejects(
    () => quickBooksService.saveClientMapping(
      workspace.clinicId,
      workspace.userId,
      client.profileId,
      {
        quickbooksCustomerId: "qb-customer-1",
        quickbooksCustomerName: "Unverified Customer",
      },
    ),
    /QuickBooks must be connected before customer mapping/,
  );

  const [profileRows] = await pool.execute<any[]>(
    "SELECT payment_status as paymentStatus, invoice_status as invoiceStatus, payment_notes as paymentNotes FROM client_account_profile WHERE id = ?",
    [client.profileId],
  );
  assert.equal(profileRows[0].paymentStatus, "pending");
  assert.equal(profileRows[0].invoiceStatus, "sent");
  assert.equal(profileRows[0].paymentNotes, "Manual finance fields should stay unchanged.");
});

test("QuickBooks customer mapping validates the customer remotely and keeps manual finance fields unchanged", async () => {
  const { quickBooksService, pool } = await modules();
  const workspace = await createWorkspace("quickbooks-valid-map");
  const clientA = await createClientAccount("quickbooks-valid-alpha", workspace);
  const clientB = await createClientAccount("quickbooks-valid-beta", workspace);
  await connectQuickBooks(workspace.clinicId, workspace.userId);
  const mock = mockQuickBooksCustomer({
    id: "qb-customer-123",
    displayName: "Verified QuickBooks Customer",
    companyName: "Verified Ltd",
    email: "billing@verified.example",
  });

  try {
    const mapping = await quickBooksService.saveClientMapping(
      workspace.clinicId,
      workspace.userId,
      clientA.profileId,
      {
        quickbooksCustomerId: "qb-customer-123",
        quickbooksCustomerName: "Typed Different Name",
        quickbooksCompanyName: "Typed Different Company",
        quickbooksEmail: "typed@example.com",
      },
    );

    assert.equal(mapping?.quickbooksCustomerId, "qb-customer-123");
    assert.equal(mapping?.quickbooksCustomerName, "Verified QuickBooks Customer");
    assert.equal(mapping?.quickbooksCompanyName, "Verified Ltd");
    assert.equal(mapping?.quickbooksEmail, "billing@verified.example");
    assert.equal(mapping?.mappingSource, "quickbooks_lookup");

    const [profileRows] = await pool.execute<any[]>(
      "SELECT payment_status as paymentStatus, invoice_status as invoiceStatus, payment_notes as paymentNotes FROM client_account_profile WHERE id = ?",
      [clientA.profileId],
    );
    assert.equal(profileRows[0].paymentStatus, "pending");
    assert.equal(profileRows[0].invoiceStatus, "sent");
    assert.equal(profileRows[0].paymentNotes, "Manual finance fields should stay unchanged.");

    await assert.rejects(
      () => quickBooksService.saveClientMapping(
        workspace.clinicId,
        workspace.userId,
        clientB.profileId,
        {
          quickbooksCustomerId: "qb-customer-123",
          quickbooksCustomerName: "Verified QuickBooks Customer",
        },
      ),
      /already mapped to another Mission Control client/,
    );
    assert.ok(mock.requestCount >= 1);
  } finally {
    mock.restore();
  }
});

test("QuickBooks customer mapping rejects inactive or missing customers without saving a mapping", async () => {
  const { quickBooksService } = await modules();
  const workspace = await createWorkspace("quickbooks-inactive-map");
  const client = await createClientAccount("quickbooks-inactive-map", workspace);
  await connectQuickBooks(workspace.clinicId, workspace.userId);
  const mock = mockQuickBooksCustomer({
    id: "qb-inactive",
    displayName: "Inactive Customer",
    active: false,
  });

  try {
    await assert.rejects(
      () => quickBooksService.saveClientMapping(
        workspace.clinicId,
        workspace.userId,
        client.profileId,
        {
          quickbooksCustomerId: "qb-inactive",
          quickbooksCustomerName: "Inactive Customer",
        },
      ),
      /QuickBooks customer could not be found or is inactive/,
    );

    const mapping = await quickBooksService.getClientMapping(workspace.clinicId, client.profileId);
    assert.equal(mapping, null);
  } finally {
    mock.restore();
  }
});

test("QuickBooks mapping routes are permission protected", async () => {
  const { app } = await modules();
  const workspace = await createWorkspace("quickbooks-route-permissions");
  const client = await createClientAccount("quickbooks-route-permissions");
  const contactOnlyUser = await createUserWithPermissions(workspace.clinicId, "quickbooks_contact_only", ["contacts:write"]);
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start QuickBooks route permission test server");
  }

  try {
    const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}/api/quickbooks/client-mappings/${client.profileId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${contactOnlyUser.token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quickbooksCustomerId: "qb-customer-123",
        quickbooksCustomerName: "Should Not Save",
      }),
    });
    const body = await response.json() as { message?: string };

    assert.equal(response.status, 403);
    assert.equal(body.message, "You do not have permission to perform this action");
  } finally {
    await closeServer(server);
  }
});

test("QuickBooks commercial draft processing requires billing write permission", async () => {
  const routesSource = await readFile(routesPath, "utf8");
  assert.match(
    routesSource,
    /["']\/commercial-drafts\/:draftId\/process["'][\s\S]*?authorizePermission\(["']billing:write["']\)/,
  );
});
