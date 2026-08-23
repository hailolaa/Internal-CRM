import assert from "node:assert/strict";
import test from "node:test";
import pool, { testConnection } from "../config/database.js";
import { directDebitService } from "../modules/direct-debit/direct-debit.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

test("Direct Debit mandate setup is idempotent and provider callbacks update CRM status", async () => {
  await testConnection();
  const clinic = await createTestClinicAndAdmin("direct-debit-setup");

  const setup = await directDebitService.createMandateSetup({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerCustomerId: "CU123",
    setupReference: "setup-dd-001",
    setupUrl: "https://pay.gocardless.test/setup-dd-001",
  });
  const duplicateSetup = await directDebitService.createMandateSetup({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerCustomerId: "CU123",
    setupReference: "setup-dd-001",
    setupUrl: "https://pay.gocardless.test/setup-dd-001",
  });
  const active = await directDebitService.applyProviderCallback({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerEventId: "EVT-DD-001",
    providerMandateId: "MD0001",
    providerCustomerId: "CU123",
    status: "active",
    eventType: "mandates.active",
    payload: { id: "EVT-DD-001", mandate: "MD0001" },
  });
  const duplicateEvent = await directDebitService.applyProviderCallback({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerEventId: "EVT-DD-001",
    providerMandateId: "MD0001",
    status: "active",
    eventType: "mandates.active",
    payload: { id: "EVT-DD-001", mandate: "MD0001" },
  });
  const [eventRows]: any = await pool.execute(
    `SELECT COUNT(*) as count FROM direct_debit_mandate_event WHERE clinic_id = ? AND provider_event_id = 'EVT-DD-001'`,
    [clinic.clinicId],
  );

  assert.equal(setup.id, duplicateSetup.id);
  assert.equal(setup.status, "pending_customer_authorisation");
  assert.equal(active.mandate.status, "active");
  assert.equal(active.mandate.providerMandateId, "MD0001");
  assert.equal(active.duplicate, false);
  assert.equal(duplicateEvent.duplicate, true);
  assert.equal(Number(eventRows[0].count), 1);
});

test("Direct Debit failed payment callbacks create alerts and active callbacks resolve them", async () => {
  const clinic = await createTestClinicAndAdmin("direct-debit-alerts");

  const failed = await directDebitService.applyProviderCallback({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerEventId: "EVT-DD-FAIL",
    providerMandateId: "MD-FAIL",
    status: "failed",
    eventType: "payments.failed",
    failureReason: "Bank rejected the payment.",
    payload: { id: "EVT-DD-FAIL" },
  });
  const recovered = await directDebitService.applyProviderCallback({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerEventId: "EVT-DD-RECOVERED",
    providerMandateId: "MD-FAIL",
    status: "active",
    eventType: "mandates.active",
    payload: { id: "EVT-DD-RECOVERED" },
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

test("Direct Debit reconciliation records mismatches and opens review alerts", async () => {
  const clinic = await createTestClinicAndAdmin("direct-debit-reconciliation");
  await directDebitService.applyProviderCallback({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerEventId: "EVT-DD-RECON",
    providerMandateId: "MD-RECON",
    status: "active",
    eventType: "mandates.active",
    payload: { id: "EVT-DD-RECON" },
  });

  const passed = await directDebitService.reconcileMandates({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerStatuses: [{ providerMandateId: "MD-RECON", status: "active" }],
  });
  const mismatch = await directDebitService.reconcileMandates({
    clinicId: clinic.clinicId,
    provider: "gocardless",
    providerStatuses: [{ providerMandateId: "MD-RECON", status: "cancelled" }],
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
