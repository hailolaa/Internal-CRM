import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { v4 as uuidv4 } from "uuid";
import pool, { testConnection } from "../config/database.js";
import { buildAgreementHtml, ServiceAgreementsService } from "../modules/service-agreements/service-agreements.service.js";
import type { ServiceAgreementRegistry } from "../modules/service-agreements/service-agreements.types.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

const root = process.cwd();
const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const hashC = "c".repeat(64);
const hashD = "d".repeat(64);
const pdfHash = "e".repeat(64);

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function registry(overrides: Partial<ServiceAgreementRegistry> = {}): ServiceAgreementRegistry {
  return {
    legalTermsVersion: "clinicgrower-legal-v1",
    legalContentSha256: hashA,
    templateVersion: "clinicgrower-service-agreement-v1",
    templateSha256: hashB,
    cssSha256: hashC,
    assetManifestSha256: hashD,
    allowedAssetPrefixes: ["/brand/agreements/clinicgrower/"],
    productionSendEnabled: true,
    ...overrides,
  };
}

async function seedAcceptedProposal(prefix: string, options: { paid?: boolean; expired?: boolean } = {}) {
  const admin = await createTestClinicAndAdmin(prefix);
  const clientAccountProfileId = uuidv4();
  const proposalId = uuidv4();
  const acceptanceId = uuidv4();
  await pool.execute(
    `INSERT INTO client_account_profile
      (id, clinic_id, active_services, onboarding_status, client_status,
       current_package, payment_status, invoice_status, created_by, updated_by)
     VALUES (?, ?, JSON_ARRAY('growth'), 'not_started', 'onboarding',
       'Clinic Growth', ?, 'not_sent', ?, ?)`,
    [clientAccountProfileId, admin.clinicId, options.paid ? "paid" : "pending", admin.userId, admin.userId],
  );
  await pool.execute(
    `INSERT INTO proposal
      (id, clinic_id, client_account_profile_id, proposal_name, package_name,
       status, value, currency, accepted_at, expires_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, 'Clinic Growth', 'accepted', 1995.00, 'GBP',
       DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY),
       ${options.expired ? "DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 2 DAY)" : "DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 14 DAY)"},
       ?, ?)`,
    [proposalId, admin.clinicId, clientAccountProfileId, "Dr <script>alert(1)</script> Tanja", admin.userId, admin.userId],
  );
  await pool.execute(
    `INSERT INTO proposal_acceptance_record
      (id, clinic_id, proposal_id, client_account_profile_id, accepted_by_name,
       accepted_by_email, acceptance_status, package_name, monthly_fee_cents,
       setup_fee_cents, currency, payment_terms, start_date,
       minimum_term_months, notice_period_days, scope, created_by)
     VALUES (?, ?, ?, ?, ?, 'tanja@example.test', 'accepted', 'Clinic Growth',
       199500, 99500, 'GBP', 'Monthly in advance by direct debit.',
       '2026-09-01', 12, 90, JSON_OBJECT('treatments', JSON_ARRAY('Dental implants')),
       ?)`,
    [acceptanceId, admin.clinicId, proposalId, clientAccountProfileId, "Dr <script>alert(1)</script> Tanja", admin.userId],
  );
  return { ...admin, clientAccountProfileId, proposalId, acceptanceId };
}

async function seedSignatureEvidence(clinicId: string, proposalId: string, userId: string) {
  const requestId = uuidv4();
  const evidenceId = uuidv4();
  await pool.execute(
    `INSERT INTO proposal_signature_request
      (id, clinic_id, proposal_id, provider, provider_request_id, status,
       signer_name, signer_email, signature_url, idempotency_key, sent_at, signed_at, created_by)
     VALUES (?, ?, ?, 'log', ?, 'signed', 'Dr Tanja', 'tanja@example.test',
       'https://example.test/sign', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
    [requestId, clinicId, proposalId, `log_${requestId}`, `proposal:${proposalId}:signer:tanja@example.test`, userId],
  );
  await pool.execute(
    `INSERT INTO proposal_signature_evidence
      (id, clinic_id, proposal_id, signature_request_id, provider, provider_request_id,
       signer_name, signer_email, signed_at, signed_pdf_url, audit_certificate_url,
       evidence_sha256, evidence_json)
     VALUES (?, ?, ?, ?, 'log', ?, 'Dr Tanja', 'tanja@example.test',
       CURRENT_TIMESTAMP, 'https://example.test/signed.pdf',
       'https://example.test/audit.pdf', ?, JSON_OBJECT('provider', 'log'))`,
    [evidenceId, clinicId, proposalId, requestId, `log_${requestId}`, "f".repeat(64)],
  );
  return evidenceId;
}

test("service agreement routes are mounted behind least-privilege permissions", () => {
  const app = read("src/app.ts");
  const routes = read("src/modules/service-agreements/service-agreements.routes.ts");

  assert.match(app, /serviceAgreementsRoutes/);
  assert.match(app, /\/api\/service-agreements/);
  assert.match(routes, /authorizePermission\("service_agreements:read"\)/);
  assert.match(routes, /authorizePermission\("service_agreements:write"\)/);
  assert.match(routes, /authorizePermission\("service_agreements:approve"\)/);
  assert.match(routes, /\/:id\/max-approval/);
  assert.match(routes, /\/:id\/quickbooks/);
  assert.match(routes, /\/:id\/onboarding\/unlock/);
});

test("accepted proposal agreement journey is tenant-scoped, idempotent and gated", async () => {
  await testConnection();
  const source = await seedAcceptedProposal("service-agreement", { paid: false });
  const other = await seedAcceptedProposal("service-agreement-other", { paid: true });
  const service = new ServiceAgreementsService(() => registry());

  const generated = await service.generateAgreement({
    clinicId: source.clinicId,
    userId: source.userId,
    sourceType: "accepted_proposal",
    proposalId: source.proposalId,
    renderMode: "test_do_not_send",
    legalTermsVersion: "clinicgrower-legal-v1",
    legalContentSha256: hashA,
    templateVersion: "clinicgrower-service-agreement-v1",
    templateSha256: hashB,
    cssSha256: hashC,
    assetManifestSha256: hashD,
    assetPaths: ["/brand/agreements/clinicgrower/logo.svg"],
  });
  const rerun = await service.generateAgreement({
    clinicId: source.clinicId,
    userId: source.userId,
    sourceType: "accepted_proposal",
    proposalId: source.proposalId,
    renderMode: "test_do_not_send",
    legalTermsVersion: "clinicgrower-legal-v1",
    legalContentSha256: hashA,
    templateVersion: "clinicgrower-service-agreement-v1",
    templateSha256: hashB,
    cssSha256: hashC,
    assetManifestSha256: hashD,
    assetPaths: ["/brand/agreements/clinicgrower/logo.svg"],
  });

  assert.equal(rerun.id, generated.id);
  assert.equal(generated.watermark, "DO NOT SEND - TEST RENDER");
  assert.equal(generated.status, "max_approval_required");
  assert.equal(JSON.stringify(generated.agreementPayload).includes("Dr <script>alert(1)</script> Tanja"), true);
  const rendered = buildAgreementHtml(generated.agreementPayload, generated.renderMode);
  assert.equal(rendered.includes("Dr <script>alert(1)</script> Tanja"), false);
  assert.equal(rendered.includes("Dr &lt;script&gt;alert(1)&lt;/script&gt; Tanja"), true);
  await assert.rejects(
    () => service.getAgreement(other.clinicId, generated.id),
    /not found/i,
  );
  await assert.rejects(
    () => service.approveForExternalSend(source.clinicId, source.userId, generated.id),
    /Only production renders/,
  );
  await assert.rejects(
    () => service.unlockOnboardingAfterClearedPayment({
      clinicId: source.clinicId,
      userId: source.userId,
      agreementId: generated.id,
      paymentStatus: "paid",
      authenticated: true,
      clearedAt: "2026-09-02",
    }),
    /signed agreement/,
  );
});

test("production journey binds approval, signature evidence, QuickBooks and paid onboarding exactly once", async () => {
  await testConnection();
  const source = await seedAcceptedProposal("service-agreement-prod", { paid: true });
  const service = new ServiceAgreementsService(() => registry());

  const agreement = await service.generateAgreement({
    clinicId: source.clinicId,
    userId: source.userId,
    sourceType: "accepted_proposal",
    proposalId: source.proposalId,
    renderMode: "production",
    legalTermsVersion: "clinicgrower-legal-v1",
    legalContentSha256: hashA,
    templateVersion: "clinicgrower-service-agreement-v1",
    templateSha256: hashB,
    cssSha256: hashC,
    assetManifestSha256: hashD,
  });
  const approved = await service.approveForExternalSend(source.clinicId, source.userId, agreement.id);
  const approvedAgain = await service.approveForExternalSend(source.clinicId, source.userId, agreement.id);
  const signatureEvidenceId = await seedSignatureEvidence(source.clinicId, source.proposalId, source.userId);
  const signed = await service.attachSignatureEvidence({
    clinicId: source.clinicId,
    userId: source.userId,
    agreementId: agreement.id,
    signatureEvidenceId,
    acceptedPdfSha256: pdfHash,
  });
  const draft = await service.triggerQuickBooksOnce(source.clinicId, source.userId, agreement.id);
  const duplicateDraft = await service.triggerQuickBooksOnce(source.clinicId, source.userId, agreement.id);
  const unlocked = await service.unlockOnboardingAfterClearedPayment({
    clinicId: source.clinicId,
    userId: source.userId,
    agreementId: agreement.id,
    paymentStatus: "paid",
    authenticated: true,
    clearedAt: "2026-09-02",
  });
  const [draftRows]: any = await pool.execute(
    "SELECT COUNT(*) as count FROM quickbooks_commercial_draft WHERE clinic_id = ? AND event_id = ?",
    [source.clinicId, agreement.id],
  );
  const [profileRows]: any = await pool.execute(
    "SELECT onboarding_status as onboardingStatus FROM client_account_profile WHERE clinic_id = ? AND id = ?",
    [source.clinicId, source.clientAccountProfileId],
  );

  assert.equal(approved.status, "approved_for_send");
  assert.equal(approved.maxApprovedBy, source.userId);
  assert.equal(approved.approvalEventSha256, approvedAgain.approvalEventSha256);
  assert.equal(signed.status, "signed");
  assert.equal(signed.signedEvidenceId, signatureEvidenceId);
  assert.equal(draft.id, duplicateDraft.id);
  assert.equal(Number(draftRows[0].count), 1);
  assert.equal(unlocked.onboardingUnlockedAt?.startsWith("2026-09-02"), true);
  assert.equal(profileRows[0].onboardingStatus, "in_progress");
});

test("validation fails closed for unregistered legal hashes, external assets and expired acceptances", async () => {
  await testConnection();
  const source = await seedAcceptedProposal("service-agreement-fail", { expired: true });
  const service = new ServiceAgreementsService(() => registry());

  await assert.rejects(
    () => service.generateAgreement({
      clinicId: source.clinicId,
      userId: source.userId,
      sourceType: "accepted_proposal",
      proposalId: source.proposalId,
      legalTermsVersion: "clinicgrower-legal-v1",
      legalContentSha256: "0".repeat(64),
      templateVersion: "clinicgrower-service-agreement-v1",
      templateSha256: hashB,
      cssSha256: hashC,
      assetManifestSha256: hashD,
    }),
    /server registry/,
  );
  await assert.rejects(
    () => service.generateAgreement({
      clinicId: source.clinicId,
      userId: source.userId,
      sourceType: "accepted_proposal",
      proposalId: source.proposalId,
      legalTermsVersion: "clinicgrower-legal-v1",
      legalContentSha256: hashA,
      templateVersion: "clinicgrower-service-agreement-v1",
      templateSha256: hashB,
      cssSha256: hashC,
      assetManifestSha256: hashD,
      assetPaths: ["https://example.test/logo.svg"],
    }),
    /local allowlisted/,
  );
  await assert.rejects(
    () => service.generateAgreement({
      clinicId: source.clinicId,
      userId: source.userId,
      sourceType: "accepted_proposal",
      proposalId: source.proposalId,
      legalTermsVersion: "clinicgrower-legal-v1",
      legalContentSha256: hashA,
      templateVersion: "clinicgrower-service-agreement-v1",
      templateSha256: hashB,
      cssSha256: hashC,
      assetManifestSha256: hashD,
    }),
    /expiry/,
  );
});
