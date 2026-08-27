import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo, Server } from "node:net";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

test("legacy clinic-facing profile endpoints are blocked behind authentication", async () => {
  await testConnection();
  const admin = await createTestClinicAndAdmin("LegacyRouteIsolation");
  const server = await new Promise<Server>((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    instance.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to start test server");
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
  const path = "/api/profiles/patient/00000000-0000-4000-8000-000000000001";

  try {
    const unauthenticated = await fetch(`${baseUrl}${path}`);
    assert.equal(unauthenticated.status, 401);

    for (const method of ["GET", "PUT", "PATCH", "DELETE"]) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${admin.token}`, "Content-Type": "application/json" },
        ...(method === "GET" ? {} : { body: "{}" }),
      });
      const body: any = await response.json();
      assert.equal(response.status, 410);
      assert.match(body.message, /legacy profile endpoint is retired/i);
      assert.doesNotMatch(body.message, /patient/i);
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await pool.execute("DELETE FROM audit_log WHERE clinic_id = ?", [admin.clinicId]);
    await pool.execute("DELETE FROM clinic_membership WHERE clinic_id = ?", [admin.clinicId]);
    await pool.execute("DELETE FROM user WHERE clinic_id = ?", [admin.clinicId]);
    await pool.execute("DELETE FROM clinic WHERE id = ?", [admin.clinicId]);
  }
});
