import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { v4 as uuidv4 } from "uuid";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
}

async function createClinicAndAdmin(prefix: string) {
  const result = await authService.registerClinic({
    clinicName: `${prefix} Clinic`,
    adminEmail: uniqueEmail(`${prefix}_admin`),
    adminPassword: "password123",
    firstName: prefix,
    lastName: "Admin",
    phone: "555-0100",
  });

  return {
    clinicId: result.user.clinicId,
    userId: result.user.id,
    token: result.tokens.token,
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

test("role management creates, updates, protects system roles, and archives safely", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("RoleManagementPrimary");
  const secondary = await createClinicAndAdmin("RoleManagementSecondary");
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start role management test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  let roleId = "";
  let roleName = "";
  let invitationId = "";

  try {
    const roles = await fetchJson(baseUrl, "/api/roles", primary.token);
    assert.equal(roles.response.status, 200);
    assert.equal(roles.body.data.some((role: any) => role.isSystem), true);

    const systemRole = roles.body.data.find((role: any) => role.isSystem);
    const systemUpdate = await fetchJson(baseUrl, `/api/roles/${systemRole.id}`, primary.token, {
      method: "PATCH",
      body: JSON.stringify({ displayName: "Changed System Role" }),
    });
    assert.equal(systemUpdate.response.status, 403);

    const create = await fetchJson(baseUrl, "/api/roles", primary.token, {
      method: "POST",
      body: JSON.stringify({
        displayName: "Growth Ops Manager",
        description: "Can read settings and manage marketing",
        permissions: ["settings:read", "marketing:read"],
      }),
    });
    assert.equal(create.response.status, 201);
    roleId = create.body.data.id;
    roleName = create.body.data.name;
    assert.equal(create.body.data.isSystem, false);
    assert.deepEqual(create.body.data.permissions.sort(), ["marketing:read", "settings:read"]);

    const crossTenantUpdate = await fetchJson(baseUrl, `/api/roles/${roleId}`, secondary.token, {
      method: "PATCH",
      body: JSON.stringify({ displayName: "Nope" }),
    });
    assert.equal(crossTenantUpdate.response.status, 403);

    const update = await fetchJson(baseUrl, `/api/roles/${roleId}`, primary.token, {
      method: "PATCH",
      body: JSON.stringify({
        displayName: "Growth Ops Lead",
        description: "Can manage campaign work",
        permissions: ["settings:read", "marketing:read", "marketing:write"],
      }),
    });
    assert.equal(update.response.status, 200);
    assert.equal(update.body.data.displayName, "Growth Ops Lead");
    assert.equal(update.body.data.permissions.includes("marketing:write"), true);

    invitationId = uuidv4();
    await pool.execute(
      `INSERT INTO invitation (id, clinic_id, email, role, token_hash, invited_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 DAY))`,
      [
        invitationId,
        primary.clinicId,
        uniqueEmail("role_pending_invite"),
        roleName,
        `test-token-hash-${invitationId}`,
        primary.userId,
      ],
    );

    const blockedArchive = await fetchJson(baseUrl, `/api/roles/${roleId}`, primary.token, {
      method: "DELETE",
    });
    assert.equal(blockedArchive.response.status, 400);
    assert.match(blockedArchive.body.message, /pending invitations/);

    await pool.execute("UPDATE invitation SET status = 'expired' WHERE id = ?", [invitationId]);
    const archive = await fetchJson(baseUrl, `/api/roles/${roleId}`, primary.token, {
      method: "DELETE",
    });
    assert.equal(archive.response.status, 200);

    const afterArchive = await fetchJson(baseUrl, "/api/roles", primary.token);
    assert.equal(afterArchive.body.data.some((role: any) => role.id === roleId), false);
    console.log("[roles-management] create, update, guards, and archive test passed");
  } finally {
    if (invitationId) {
      await pool.execute("UPDATE invitation SET status = 'expired' WHERE id = ?", [invitationId]);
    }
    if (roleId) {
      await pool.execute("UPDATE role SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [roleId]);
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await pool.end();
  }
});
