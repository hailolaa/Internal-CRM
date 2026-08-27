import assert from "node:assert/strict";
import test from "node:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { v4 as uuidv4 } from "uuid";
import pool, { testConnection } from "../config/database.js";
import { config } from "../config/index.js";
import app from "../app.js";
import { directDebitService } from "../modules/direct-debit/direct-debit.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const routesPath = resolve(currentDir, "../modules/direct-debit/direct-debit.routes.js");

async function closeServer(server: Server) {
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
}

test.before(async () => {
  const mutableConfig = config as unknown as { directDebit: { webhookSecret: string } };
  mutableConfig.directDebit.webhookSecret = "direct-debit-test-secret";
});

test("Direct Debit mandate setup is idempotent and provider callbacks update CRM status", async () => {
  await testConnection();
  const clinic = await createTestClinicAndAdmin("direct-debit-setup");
  const suffix = uuidv4();

  const setup = await directDebitService.createMandateSetup({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerCustomerId: `CU-${suffix}`,
    setupReference: `setup-dd-${suffix}`,
    setupUrl: `https://pay.gocardless.test/setup-dd-${suffix}`,
  });
  const duplicateSetup = await directDebitService.createMandateSetup({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerCustomerId: `CU-${suffix}`,
    setupReference: `setup-dd-${suffix}`,
    setupUrl: `https://pay.gocardless.test/setup-dd-${suffix}`,
  });
  const active = await directDebitService.applyProviderCallback({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerEventId: `EVT-DD-${suffix}`,
    providerMandateId: `MD-${suffix}`,
    providerCustomerId: `CU-${suffix}`,
    status: "active",
    eventType: "mandates.active",
    payload: { id: `EVT-DD-${suffix}`, mandate: `MD-${suffix}` },
  });
  const duplicateEvent = await directDebitService.applyProviderCallback({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerEventId: `EVT-DD-${suffix}`,
    providerMandateId: `MD-${suffix}`,
    status: "active",
    eventType: "mandates.active",
    payload: { id: `EVT-DD-${suffix}`, mandate: `MD-${suffix}` },
  });
  const [eventRows]: any = await pool.execute(
    `SELECT COUNT(*) as count FROM direct_debit_mandate_event WHERE clinic_id = ? AND provider_event_id = ?`,
    [clinic.clinicId, `EVT-DD-${suffix}`],
  );

  assert.equal(setup.id, duplicateSetup.id);
  assert.equal(setup.status, "pending_customer_authorisation");
  assert.equal(active.mandate.status, "active");
  assert.equal(active.mandate.providerMandateId, `MD-${suffix}`);
  assert.equal(active.duplicate, false);
  assert.equal(duplicateEvent.duplicate, true);
  assert.equal(Number(eventRows[0].count), 1);
});

test("Direct Debit failed payment callbacks create alerts and active callbacks resolve them", async () => {
  const clinic = await createTestClinicAndAdmin("direct-debit-alerts");
  const suffix = uuidv4();

  const failed = await directDebitService.applyProviderCallback({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerEventId: `EVT-DD-FAIL-${suffix}`,
    providerMandateId: `MD-FAIL-${suffix}`,
    status: "failed",
    eventType: "payments.failed",
    failureReason: "Bank rejected the payment.",
    payload: { id: `EVT-DD-FAIL-${suffix}` },
  });
  const recovered = await directDebitService.applyProviderCallback({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerEventId: `EVT-DD-RECOVERED-${suffix}`,
    providerMandateId: `MD-FAIL-${suffix}`,
    status: "active",
    eventType: "mandates.active",
    payload: { id: `EVT-DD-RECOVERED-${suffix}` },
  });
  const [alertRows]: any = await pool.execute(
    `SELECT status FROM direct_debit_alert WHERE clinic_id = ? AND mandate_id = ?`,
    [clinic.clinicId, failed.mandate.id],
  );

  assert.equal(failed.alert?.alertType, "payment_failed");
  assert.equal(failed.mandate.status, "failed");
  assert.equal(recovered.mandate.status, "active");
  assert.equal(alertRows[0].status, "resolved");
});

test("Direct Debit ignores stale lifecycle callbacks after a mandate becomes active", async () => {
  const clinic = await createTestClinicAndAdmin("direct-debit-out-of-order");
  const suffix = uuidv4();
  const providerMandateId = `MD-ORDER-${suffix}`;

  const active = await directDebitService.applyProviderCallback({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerEventId: `EVT-DD-ACTIVE-${suffix}`,
    providerMandateId,
    status: "active",
    eventType: "mandates.active",
    payload: { id: `EVT-DD-ACTIVE-${suffix}` },
  });
  const staleSubmitted = await directDebitService.applyProviderCallback({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerEventId: `EVT-DD-SUBMITTED-${suffix}`,
    providerMandateId,
    status: "submitted",
    eventType: "mandates.submitted",
    payload: { id: `EVT-DD-SUBMITTED-${suffix}` },
  });
  const [eventRows]: any = await pool.execute(
    `SELECT event_status as eventStatus
     FROM direct_debit_mandate_event
     WHERE clinic_id = ? AND mandate_id = ?
     ORDER BY event_status ASC`,
    [clinic.clinicId, active.mandate.id],
  );

  assert.equal(active.mandate.status, "active");
  assert.equal(staleSubmitted.mandate.status, "active");
  assert.equal(staleSubmitted.duplicate, false, "a distinct stale provider event is still recorded");
  assert.deepEqual(eventRows.map((row: any) => row.eventStatus), ["active", "submitted"]);
});

test("Direct Debit reconciliation records mismatches and opens review alerts", async () => {
  const clinic = await createTestClinicAndAdmin("direct-debit-reconciliation");
  const suffix = uuidv4();
  const providerMandateId = `MD-RECON-${suffix}`;
  await directDebitService.applyProviderCallback({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerEventId: `EVT-DD-RECON-${suffix}`,
    providerMandateId,
    status: "active",
    eventType: "mandates.active",
    payload: { id: `EVT-DD-RECON-${suffix}` },
  });

  const passed = await directDebitService.reconcileMandates({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerStatuses: [{ providerMandateId, status: "active" }],
  });
  const mismatch = await directDebitService.reconcileMandates({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerStatuses: [{ providerMandateId, status: "cancelled" }],
  });
  const [alertRows]: any = await pool.execute(
    `SELECT COUNT(*) as count FROM direct_debit_alert WHERE clinic_id = ? AND alert_type = 'reconciliation_mismatch' AND status = 'open'`,
    [clinic.clinicId],
  );

  assert.equal(passed.result, "passed");
  assert.equal(passed.mismatchCount, 0);
  assert.equal(mismatch.result, "mismatch");
  assert.equal(mismatch.mismatchCount, 1);
  assert.equal(Number(alertRows[0].count), 1);
});

test("Direct Debit setup and reconciliation routes require billing write permission", async () => {
  const routesSource = await readFile(routesPath, "utf8");
  assert.match(
    routesSource,
    /["']\/mandates\/setup["'][\s\S]*?authorizePermission\(["']billing:write["']\)/,
  );
  assert.match(
    routesSource,
    /["']\/reconciliation\/run["'][\s\S]*?authorizePermission\(["']billing:write["']\)/,
  );
});

test("Direct Debit API creates mandate setup for authenticated billing users", async () => {
  const clinic = await createTestClinicAndAdmin("direct-debit-api-setup");
  const suffix = uuidv4();
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start Direct Debit API test server");
  }

  try {
    const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}/api/direct-debit/mandates/setup`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clinic.token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: "gocardless",
        providerCustomerId: `CU-API-${suffix}`,
        setupReference: `api-setup-dd-${suffix}`,
        setupUrl: `https://pay.gocardless.test/api-setup-dd-${suffix}`,
      }),
    });
    const body = await response.json() as { data?: { setupReference?: string; status?: string } };

    assert.equal(response.status, 201);
    assert.equal(body.data?.setupReference, `api-setup-dd-${suffix}`);
    assert.equal(body.data?.status, "pending_customer_authorisation");
  } finally {
    await closeServer(server);
  }
});

test("Direct Debit provider callback requires a configured shared secret", async () => {
  const clinic = await createTestClinicAndAdmin("direct-debit-callback-secret");
  const suffix = uuidv4();
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start Direct Debit callback test server");
  }
  const url = `http://127.0.0.1:${(address as AddressInfo).port}/api/direct-debit/provider-callback`;
  const payload = {
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerEventId: `EVT-DD-ROUTE-SECRET-${suffix}`,
    providerMandateId: `MD-ROUTE-SECRET-${suffix}`,
    status: "active",
  };

  try {
    const rejected = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const accepted = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Direct-Debit-Webhook-Secret": "direct-debit-test-secret",
      },
      body: JSON.stringify(payload),
    });
    const body = await accepted.json() as { data?: { mandate?: { status?: string; providerMandateId?: string }; duplicate?: boolean } };

    assert.equal(rejected.status, 401);
    assert.equal(accepted.status, 200);
    assert.equal(body.data?.mandate?.status, "active");
    assert.equal(body.data?.mandate?.providerMandateId, `MD-ROUTE-SECRET-${suffix}`);
    assert.equal(body.data?.duplicate, false);
  } finally {
    await closeServer(server);
  }
});
