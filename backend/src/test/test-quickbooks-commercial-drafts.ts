import assert from "node:assert/strict";
import test from "node:test";
import { v4 as uuidv4 } from "uuid";
import pool, { testConnection } from "../config/database.js";
import { quickBooksService } from "../modules/quickbooks/quickbooks.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

test("accepted proposal events stage one idempotent QuickBooks customer and invoice draft", async () => {
  await testConnection();
  const clinic = await createTestClinicAndAdmin("quickbooks-commercial-draft");
  const eventId = uuidv4();
  const proposalId = uuidv4();
  const profileId = uuidv4();
  const idempotencyKey = `proposal_accepted:${proposalId}:snapshot-1`;
  const payload = {
    legalCompanyName: "Example Clinic Ltd",
    billingEmail: "billing@example.test",
    packageId: "clinic-growth",
    packageName: "Clinic Growth",
    monthlyFeeCents: 199500,
    setupFeeCents: 0,
    currency: "GBP",
  };

  const first = await (quickBooksService as any).stageCommercialDraft({
    clinicId: clinic.clinicId,
    eventId,
    proposalId,
    clientAccountProfileId: profileId,
    idempotencyKey,
    payload,
  });
  const repeated = await (quickBooksService as any).stageCommercialDraft({
    clinicId: clinic.clinicId,
    eventId,
    proposalId,
    clientAccountProfileId: profileId,
    idempotencyKey,
    payload,
  });
  const [rows]: any = await pool.execute(
    `SELECT id, event_id as eventId, proposal_id as proposalId,
            client_account_profile_id as clientAccountProfileId,
            status, customer_action as customerAction,
            invoice_action as invoiceAction, payload
     FROM quickbooks_commercial_draft
     WHERE clinic_id = ? AND idempotency_key = ?`,
    [clinic.clinicId, idempotencyKey],
  );

  assert.equal(first.id, repeated.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].eventId, eventId);
  assert.equal(rows[0].proposalId, proposalId);
  assert.equal(rows[0].clientAccountProfileId, profileId);
  assert.equal(rows[0].status, "pending");
  assert.equal(rows[0].customerAction, "create_or_link");
  assert.equal(rows[0].invoiceAction, "create_draft");
  const storedPayload = typeof rows[0].payload === "string" ? JSON.parse(rows[0].payload) : rows[0].payload;
  assert.deepEqual(storedPayload, payload);
  await pool.execute("DELETE FROM quickbooks_commercial_draft WHERE id = ?", [first.id]);
});

test("QuickBooks draft processing is retryable without duplicating the customer or invoice", async () => {
  const clinic = await createTestClinicAndAdmin("quickbooks-commercial-process");
  const proposalId = uuidv4();
  const draft = await (quickBooksService as any).stageCommercialDraft({
    clinicId: clinic.clinicId,
    eventId: uuidv4(),
    proposalId,
    clientAccountProfileId: uuidv4(),
    idempotencyKey: `proposal_accepted:${proposalId}:snapshot-1`,
    payload: {
      legalCompanyName: "Retry Clinic Ltd",
      billingEmail: "billing-retry@example.test",
      packageName: "Clinic Growth",
      monthlyFeeCents: 199500,
      setupFeeCents: 0,
      currency: "GBP",
    },
  });
  let customerCalls = 0;
  let invoiceCalls = 0;
  let failInvoice = true;
  const adapter = {
    ensureCustomer: async (input: any) => {
      customerCalls += 1;
      assert.equal(input.idempotencyKey.endsWith(":customer"), true);
      return { id: "qb-customer-123" };
    },
    createDraftInvoice: async (input: any) => {
      invoiceCalls += 1;
      assert.equal(input.customerId, "qb-customer-123");
      assert.equal(input.idempotencyKey.endsWith(":invoice"), true);
      if (failInvoice) throw new Error("QuickBooks sandbox temporarily unavailable");
      return { id: "qb-invoice-456" };
    },
  };

  await assert.rejects(
    () => (quickBooksService as any).processCommercialDraft({ clinicId: clinic.clinicId, draftId: draft.id }, adapter),
    /temporarily unavailable/,
  );
  failInvoice = false;
  const processed = await (quickBooksService as any).processCommercialDraft(
    { clinicId: clinic.clinicId, draftId: draft.id },
    adapter,
  );
  const repeated = await (quickBooksService as any).processCommercialDraft(
    { clinicId: clinic.clinicId, draftId: draft.id },
    adapter,
  );

  assert.equal(processed.status, "processed");
  assert.equal(processed.quickBooksCustomerId, "qb-customer-123");
  assert.equal(processed.quickBooksInvoiceId, "qb-invoice-456");
  assert.equal(repeated.status, "processed");
  assert.equal(customerCalls, 1, "a successful customer step is reused after invoice failure");
  assert.equal(invoiceCalls, 2, "only the failed invoice step is retried");
});

test("QuickBooks draft batches recover stale claims and continue after individual failures", async () => {
  await pool.execute("DELETE FROM quickbooks_commercial_draft");
  const clinic = await createTestClinicAndAdmin("quickbooks-commercial-batch");
  const makeDraft = (label: string) => (quickBooksService as any).stageCommercialDraft({
    clinicId: clinic.clinicId,
    eventId: uuidv4(),
    proposalId: uuidv4(),
    idempotencyKey: `proposal_accepted:${label}:${uuidv4()}`,
    payload: { legalCompanyName: `${label} Ltd`, packageName: label, monthlyFeeCents: 10000, currency: "GBP" },
  });
  const stale = await makeDraft("Stale success");
  const broken = await makeDraft("Broken invoice");
  await pool.execute(
    `UPDATE quickbooks_commercial_draft
     SET status = 'processing', updated_at = DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 2 HOUR)
     WHERE id = ? AND clinic_id = ?`,
    [stale.id, clinic.clinicId],
  );
  const adapter = {
    ensureCustomer: async ({ payload }: any) => ({ id: `customer-${String(payload.packageName).toLowerCase().replace(/\s+/g, "-")}` }),
    createDraftInvoice: async ({ payload }: any) => {
      if (payload.packageName === "Broken invoice") throw new Error("Expected isolated invoice failure");
      return { id: "invoice-stale-success" };
    },
  };

  const result = await (quickBooksService as any).processCommercialDraftBatch(
    { limit: 10, staleAfterMinutes: 30 },
    async () => adapter,
  );
  const [rows]: any = await pool.execute(
    `SELECT id, status FROM quickbooks_commercial_draft WHERE id IN (?, ?) ORDER BY id`,
    [stale.id, broken.id],
  );
  const statuses = new Map(rows.map((row: any) => [row.id, row.status]));

  assert.deepEqual(result, { recoveredStale: 1, attempted: 2, processed: 1, failed: 1 });
  assert.equal(statuses.get(stale.id), "processed");
  assert.equal(statuses.get(broken.id), "failed");
});
