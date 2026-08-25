import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { clinicOsEntitlementsService } from "../modules/clinic-os-entitlements/clinic-os-entitlements.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

async function closeServer(server: Server) {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
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

test.after(async () => {
  await pool.end();
});

test("Clinic OS entitlement push enforces free audit outside-in access and blocks Growth Score", async () => {
  await testConnection();
  const clinic = await createTestClinicAndAdmin("clinic-os-free-audit");

  const { version, push } = await clinicOsEntitlementsService.publishSettings({
    clinicId: clinic.clinicId,
    tenantKey: `clinic-os-${clinic.clinicId}`,
    accessTier: "free_audit",
    growthScoreRequested: true,
    paidDiagnosticConfirmed: false,
    sufficientDataConfirmed: true,
    settings: { requestedModule: "growth_score" },
    changedBy: "Haile Michael",
  });

  assert.equal(version.version, 1);
  assert.equal(version.accessTier, "free_audit");
  assert.equal(version.growthScoreEnabled, false);
  assert.equal(version.settings.freeAuditMode, "outside_in_no_login");
  assert.equal(version.settings.growthScoreEnabled, false);
  assert.equal(push.status, "pending");
  assert.equal(push.payloadHash, version.payloadHash);
  assert.ok(new Date(push.slaDueAt).getTime() > Date.now());
});

test("Clinic OS entitlement settings are versioned, queued, acknowledged and rollback creates a new version", async () => {
  const clinic = await createTestClinicAndAdmin("clinic-os-versioned");
  const tenantKey = `clinic-os-versioned-${clinic.clinicId}`;

  const first = await clinicOsEntitlementsService.publishSettings({
    clinicId: clinic.clinicId,
    tenantKey,
    accessTier: "paid_diagnostic",
    growthScoreRequested: true,
    paidDiagnosticConfirmed: true,
    sufficientDataConfirmed: true,
    settings: { modules: ["growth_score"] },
    changedBy: "Haile Michael",
  });
  const second = await clinicOsEntitlementsService.publishSettings({
    clinicId: clinic.clinicId,
    tenantKey,
    accessTier: "clinic_os",
    growthScoreRequested: true,
    paidDiagnosticConfirmed: true,
    sufficientDataConfirmed: true,
    settings: { modules: ["growth_score", "pipeline"] },
    changedBy: "Haile Michael",
  });
  const sent = await clinicOsEntitlementsService.markPushSent(clinic.clinicId, second.push.id);
  const acknowledged = await clinicOsEntitlementsService.acknowledgePush(clinic.clinicId, second.push.id, second.push.payloadHash);
  const rollback = await clinicOsEntitlementsService.rollbackToVersion({
    clinicId: clinic.clinicId,
    tenantKey,
    version: first.version.version,
    changedBy: "Haile Michael",
  });
  const [rows]: any = await pool.execute(
    `SELECT version, status, rollback_of_version_id as rollbackOfVersionId
     FROM clinic_os_entitlement_version
     WHERE clinic_id = ? AND tenant_key = ?
     ORDER BY version ASC`,
    [clinic.clinicId, tenantKey],
  );

  assert.equal(first.version.growthScoreEnabled, true);
  assert.equal(second.version.version, 2);
  assert.equal(sent.status, "sent");
  assert.equal(acknowledged.status, "acknowledged");
  assert.equal(rollback.version.version, 3);
  assert.equal(rollback.version.rollbackOfVersionId, first.version.id);
  assert.equal(rollback.version.accessTier, first.version.accessTier);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].status, "superseded");
  assert.equal(rows[2].rollbackOfVersionId, first.version.id);
});

test("Clinic OS entitlement push rejects Growth Score when paid diagnostic or data sufficiency is missing", async () => {
  const clinic = await createTestClinicAndAdmin("clinic-os-growth-score-guard");

  const missingDiagnostic = await clinicOsEntitlementsService.publishSettings({
    clinicId: clinic.clinicId,
    tenantKey: `clinic-os-guard-${clinic.clinicId}`,
    accessTier: "clinic_os",
    growthScoreRequested: true,
    paidDiagnosticConfirmed: false,
    sufficientDataConfirmed: true,
    changedBy: "Haile Michael",
  });
  const missingData = await clinicOsEntitlementsService.publishSettings({
    clinicId: clinic.clinicId,
    tenantKey: `clinic-os-guard-${clinic.clinicId}`,
    accessTier: "paid_diagnostic",
    growthScoreRequested: true,
    paidDiagnosticConfirmed: true,
    sufficientDataConfirmed: false,
    changedBy: "Haile Michael",
  });
  const pending = await clinicOsEntitlementsService.listPendingPushes(200);

  assert.equal(missingDiagnostic.version.growthScoreEnabled, false);
  assert.equal(missingData.version.growthScoreEnabled, false);
  assert.equal(pending.some((push) => push.entitlementVersionId === missingData.version.id), true);
});

test("Clinic OS entitlement route is authenticated and publishes queued settings", async () => {
  const clinic = await createTestClinicAndAdmin("clinic-os-route");
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to start Clinic OS entitlement route test server");
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    const denied = await fetchJson(baseUrl, "/api/clinic-os-entitlements/publish", undefined, {
      method: "POST",
      body: JSON.stringify({
        clinicId: clinic.clinicId,
        tenantKey: `clinic-os-route-${clinic.clinicId}`,
        accessTier: "free_audit",
      }),
    });
    assert.equal(denied.response.status, 401);

    const published = await fetchJson(baseUrl, "/api/clinic-os-entitlements/publish", clinic.token, {
      method: "POST",
      body: JSON.stringify({
        clinicId: clinic.clinicId,
        tenantKey: `clinic-os-route-${clinic.clinicId}`,
        accessTier: "paid_diagnostic",
        growthScoreRequested: true,
        paidDiagnosticConfirmed: true,
        sufficientDataConfirmed: true,
        settings: { modules: ["growth_score"] },
      }),
    });
    assert.equal(published.response.status, 201, JSON.stringify(published.body));
    assert.equal(published.body.data.version.growthScoreEnabled, true);
    assert.equal(published.body.data.push.status, "pending");
  } finally {
    await closeServer(server);
  }
});
