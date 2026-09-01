import { createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import type { PoolConnection } from "mysql2/promise";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import { insertAuditEvent, logAuditEvent } from "../../utils/audit.js";
import { quickBooksService } from "../quickbooks/quickbooks.service.js";
import { assertRegistryReady, loadServiceAgreementRegistry } from "./service-agreements.registry.js";
import type {
  GenerateServiceAgreementInput,
  ServiceAgreementCommercialTerms,
  ServiceAgreementRecord,
  ServiceAgreementRegistry,
  ServiceAgreementRenderMode,
  ServiceAgreementSourceType,
} from "./service-agreements.types.js";

type QueryExecutor = Pick<PoolConnection, "execute">;

const HEX_SHA256 = /^[a-f0-9]{64}$/i;
const TEST_WATERMARK = "DO NOT SEND - TEST RENDER";

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function toIso(value: unknown) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toDateOnly(value: unknown, field: string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const cleaned = cleanString(value);
  if (!cleaned) throw ApiError.badRequest(`${field} is required.`);
  const parsed = new Date(`${cleaned.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw ApiError.badRequest(`${field} must be a valid date.`);
  return parsed.toISOString().slice(0, 10);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function requireString(value: unknown, field: string) {
  const cleaned = cleanString(value);
  if (!cleaned) throw ApiError.badRequest(`${field} is required.`);
  return cleaned;
}

function requireHash(value: unknown, field: string) {
  const cleaned = requireString(value, field);
  if (!HEX_SHA256.test(cleaned)) throw ApiError.badRequest(`${field} must be a sha256 hash.`);
  return cleaned.toLowerCase();
}

function requirePositiveInt(value: unknown, field: string, allowZero = false) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < (allowZero ? 0 : 1)) {
    throw ApiError.badRequest(`${field} must be ${allowZero ? "a non-negative" : "a positive"} integer.`);
  }
  return numberValue;
}

function assertRegistryMatch(input: GenerateServiceAgreementInput, registry: ServiceAgreementRegistry) {
  assertRegistryReady(registry);
  const comparisons: Array<[string, string, string]> = [
    ["legalTermsVersion", input.legalTermsVersion, registry.legalTermsVersion],
    ["legalContentSha256", input.legalContentSha256, registry.legalContentSha256],
    ["templateVersion", input.templateVersion, registry.templateVersion],
    ["templateSha256", input.templateSha256, registry.templateSha256],
    ["cssSha256", input.cssSha256, registry.cssSha256],
    ["assetManifestSha256", input.assetManifestSha256, registry.assetManifestSha256],
  ];

  for (const [field, submitted, registered] of comparisons) {
    const normalizedSubmitted = field.endsWith("Sha256") ? requireHash(submitted, field) : requireString(submitted, field);
    if (normalizedSubmitted !== registered.trim()) {
      throw ApiError.badRequest("Service agreement version is not approved in the server registry.", { field });
    }
  }
}

function assertAllowedAssets(paths: string[] | undefined, registry: ServiceAgreementRegistry) {
  for (const path of paths || []) {
    const cleaned = requireString(path, "assetPath");
    if (cleaned.includes("..") || /^https?:\/\//i.test(cleaned)) {
      throw ApiError.badRequest("Service agreement assets must be local allowlisted files.");
    }
    if (!registry.allowedAssetPrefixes.some((prefix) => cleaned.startsWith(prefix))) {
      throw ApiError.badRequest("Service agreement asset is not allowlisted.", { assetPath: cleaned });
    }
  }
}

function validateCommercialTerms(input: ServiceAgreementCommercialTerms): ServiceAgreementCommercialTerms {
  const clientName = requireString(input.clientName, "commercialTerms.clientName");
  const packageName = requireString(input.packageName, "commercialTerms.packageName");
  const monthlyFeeCents = requirePositiveInt(input.monthlyFeeCents, "commercialTerms.monthlyFeeCents");
  const setupFeeCents = requirePositiveInt(input.setupFeeCents, "commercialTerms.setupFeeCents", true);
  const currency = requireString(input.currency, "commercialTerms.currency");
  if (currency !== "GBP") throw ApiError.badRequest("commercialTerms.currency must be GBP.");
  if (input.vatTreatment !== "prices_exclude_vat") throw ApiError.badRequest("VAT treatment must be prices_exclude_vat.");
  const paymentTerms = requireString(input.paymentTerms, "commercialTerms.paymentTerms");
  const startDate = toDateOnly(input.startDate, "commercialTerms.startDate");
  const minimumTermMonths = requirePositiveInt(input.minimumTermMonths, "commercialTerms.minimumTermMonths");
  const noticePeriodDays = requirePositiveInt(input.noticePeriodDays, "commercialTerms.noticePeriodDays", true);
  if (!input.scope || typeof input.scope !== "object" || Array.isArray(input.scope)) {
    throw ApiError.badRequest("commercialTerms.scope must be an object.");
  }

  return {
    clientName,
    packageName,
    monthlyFeeCents,
    setupFeeCents,
    currency: "GBP",
    vatTreatment: "prices_exclude_vat",
    paymentTerms,
    startDate,
    minimumTermMonths,
    noticePeriodDays,
    scope: input.scope,
  };
}

export function buildAgreementHtml(payload: Record<string, unknown>, renderMode: ServiceAgreementRenderMode) {
  const terms = parseJsonObject(payload.commercialTerms);
  const source = parseJsonObject(payload.source);
  const watermark = renderMode === "test_do_not_send"
    ? `<div class="watermark">${TEST_WATERMARK}</div>`
    : "";
  const rows = [
    ["Clinic", terms.clientName],
    ["Package", terms.packageName],
    ["Monthly fee", `GBP ${(Number(terms.monthlyFeeCents) / 100).toFixed(2)} + VAT`],
    ["Implementation and benchmarking", `GBP ${(Number(terms.setupFeeCents) / 100).toFixed(2)} + VAT`],
    ["Payment terms", terms.paymentTerms],
    ["Start date", terms.startDate],
    ["Minimum term", `${terms.minimumTermMonths} months`],
    ["Notice period", `${terms.noticePeriodDays} days`],
  ].map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("");

  return [
    "<!doctype html>",
    "<html><head><meta charset=\"utf-8\"><style>",
    "@page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#082326;margin:0}.page{min-height:260mm;position:relative}",
    ".eyebrow{color:#00776f;font-size:11px;font-weight:700;letter-spacing:.02em;text-transform:uppercase}.watermark{position:fixed;top:45%;left:10%;right:10%;text-align:center;font-size:42px;font-weight:800;color:rgba(180,0,0,.18);transform:rotate(-18deg);z-index:0}",
    "h1{font-size:30px;line-height:1.08;margin:28px 0 14px}.notice{font-size:12px;line-height:1.5;color:#476064;max-width:680px}dl{display:grid;grid-template-columns:210px 1fr;gap:10px 20px;margin-top:28px}dt{font-weight:700;color:#006c65}dd{margin:0}.approval{margin-top:36px;border-top:1px solid #bfd7d4;padding-top:14px;font-size:12px;color:#476064}",
    "</style></head><body>",
    watermark,
    "<main class=\"page\">",
    "<p class=\"eyebrow\">ClinicGrower service agreement</p>",
    `<h1>${escapeHtml(terms.clientName)} service agreement</h1>`,
    "<p class=\"notice\">This controlled render binds the clinic-specific commercial data to the locked legal wording version and registered brand/template hashes. It is not valid for external send until Max approval is recorded against this exact version.</p>",
    `<dl>${rows}</dl>`,
    `<p class=\"approval\">Source: ${escapeHtml(source.type)} / ${escapeHtml(source.reference)}. No legal or commercial terms are invented by the renderer.</p>`,
    "</main></body></html>",
  ].join("");
}

function mapAgreement(row: any): ServiceAgreementRecord {
  return {
    id: row.id,
    clinicId: row.clinicId,
    proposalId: row.proposalId || null,
    clientAccountProfileId: row.clientAccountProfileId || null,
    sourceType: row.sourceType,
    sourceReference: row.sourceReference,
    status: row.status,
    renderMode: row.renderMode,
    legalTermsVersion: row.legalTermsVersion,
    legalContentSha256: row.legalContentSha256,
    templateVersion: row.templateVersion,
    templateSha256: row.templateSha256,
    cssSha256: row.cssSha256,
    assetManifestSha256: row.assetManifestSha256,
    agreementPayload: parseJsonObject(row.agreementPayload),
    agreementPayloadSha256: row.agreementPayloadSha256,
    renderedHtmlSha256: row.renderedHtmlSha256,
    watermark: row.watermark || null,
    maxApprovedBy: row.maxApprovedBy || null,
    maxApprovedAt: toIso(row.maxApprovedAt),
    approvalEventSha256: row.approvalEventSha256 || null,
    signedEvidenceId: row.signedEvidenceId || null,
    acceptedPdfSha256: row.acceptedPdfSha256 || null,
    quickBooksDraftId: row.quickBooksDraftId || null,
    onboardingUnlockedAt: toIso(row.onboardingUnlockedAt),
  };
}

export class ServiceAgreementsService {
  constructor(private readonly registryLoader: () => ServiceAgreementRegistry = loadServiceAgreementRegistry) {}

  async generateAgreement(input: GenerateServiceAgreementInput): Promise<ServiceAgreementRecord> {
    const registry = this.registryLoader();
    assertRegistryMatch(input, registry);
    assertAllowedAssets(input.assetPaths, registry);

    const sourceType = input.sourceType;
    const renderMode = input.renderMode || "test_do_not_send";
    if (!["accepted_proposal", "manual_entry", "transcript_draft"].includes(sourceType)) {
      throw ApiError.badRequest("Unsupported service agreement source type.");
    }
    if (!["test_do_not_send", "production"].includes(renderMode)) throw ApiError.badRequest("Unsupported render mode.");

    const sourceData = sourceType === "accepted_proposal"
      ? await this.buildAcceptedProposalTerms(input)
      : await this.buildEnteredTerms(input);
    const sourceReference = sourceData.sourceReference;
    const commercialTerms = validateCommercialTerms(sourceData.commercialTerms);
    const payload = {
      schema: "https://json-schema.org/draft/2020-12/schema",
      contract: "clinicgrower.service_agreement.v1",
      source: {
        type: sourceType,
        reference: sourceReference,
        proposalId: sourceData.proposalId,
      },
      clientAccountProfileId: sourceData.clientAccountProfileId,
      commercialTerms,
      legal: {
        legalTermsVersion: registry.legalTermsVersion,
        legalContentSha256: registry.legalContentSha256,
        templateVersion: registry.templateVersion,
        templateSha256: registry.templateSha256,
        cssSha256: registry.cssSha256,
        assetManifestSha256: registry.assetManifestSha256,
      },
      assetPaths: input.assetPaths || [],
    };
    const payloadJson = stableJson(payload);
    const payloadSha = sha256(payloadJson);
    const renderedHtml = buildAgreementHtml(payload, renderMode);
    const renderedHtmlSha = sha256(renderedHtml);
    const id = uuidv4();
    const watermark = renderMode === "test_do_not_send" ? TEST_WATERMARK : null;

    await pool.execute(
      `INSERT INTO service_agreement
        (id, clinic_id, proposal_id, client_account_profile_id, source_type, source_reference,
         status, render_mode, legal_terms_version, legal_content_sha256, template_version,
         template_sha256, css_sha256, asset_manifest_sha256, agreement_payload,
         agreement_payload_sha256, rendered_html_sha256, watermark, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'max_approval_required', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        input.clinicId,
        sourceData.proposalId,
        sourceData.clientAccountProfileId,
        sourceType,
        sourceReference,
        renderMode,
        registry.legalTermsVersion,
        registry.legalContentSha256.toLowerCase(),
        registry.templateVersion,
        registry.templateSha256.toLowerCase(),
        registry.cssSha256.toLowerCase(),
        registry.assetManifestSha256.toLowerCase(),
        payloadJson,
        payloadSha,
        renderedHtmlSha,
        watermark,
        input.userId,
      ],
    );

    const agreement = await this.getBySource(input.clinicId, sourceType, sourceReference);
    if (agreement.agreementPayloadSha256 !== payloadSha) {
      throw ApiError.conflict("A service agreement already exists for this source with different terms.");
    }
    await this.writeAgreementEvent({
      clinicId: input.clinicId,
      agreementId: agreement.id,
      eventType: "generated",
      idempotencyKey: `service_agreement:${agreement.id}:generated:${payloadSha}`,
      userId: input.userId,
      payload: { sourceType, sourceReference, payloadSha, renderMode, watermark },
    });
    await logAuditEvent({
      clinicId: input.clinicId,
      userId: input.userId,
      action: "SERVICE_AGREEMENT_GENERATED",
      entityType: "service_agreement",
      entityId: agreement.id,
      changes: { sourceType, sourceReference, payloadSha, renderMode },
    });
    return agreement;
  }

  async getAgreement(clinicId: string, agreementId: string): Promise<ServiceAgreementRecord> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, proposal_id as proposalId, client_account_profile_id as clientAccountProfileId,
              source_type as sourceType, source_reference as sourceReference, status, render_mode as renderMode,
              legal_terms_version as legalTermsVersion, legal_content_sha256 as legalContentSha256,
              template_version as templateVersion, template_sha256 as templateSha256,
              css_sha256 as cssSha256, asset_manifest_sha256 as assetManifestSha256,
              agreement_payload as agreementPayload, agreement_payload_sha256 as agreementPayloadSha256,
              rendered_html_sha256 as renderedHtmlSha256, watermark,
              max_approved_by as maxApprovedBy, max_approved_at as maxApprovedAt,
              approval_event_sha256 as approvalEventSha256, signed_evidence_id as signedEvidenceId,
              accepted_pdf_sha256 as acceptedPdfSha256, quickbooks_draft_id as quickBooksDraftId,
              onboarding_unlocked_at as onboardingUnlockedAt
       FROM service_agreement
       WHERE clinic_id = ? AND id = ?
       LIMIT 1`,
      [clinicId, agreementId],
    );
    if (!rows[0]) throw ApiError.notFound("Service agreement not found.");
    return mapAgreement(rows[0]);
  }

  async approveForExternalSend(clinicId: string, userId: string, agreementId: string) {
    const registry = this.registryLoader();
    assertRegistryReady(registry);
    if (!registry.productionSendEnabled) {
      throw ApiError.serviceUnavailable("Service agreement production send is not enabled by Max approval.");
    }
    const agreement = await this.getAgreement(clinicId, agreementId);
    if (agreement.renderMode !== "production") throw ApiError.badRequest("Only production renders can be approved for external send.");
    if (agreement.status !== "max_approval_required" && agreement.status !== "approved_for_send") {
      throw ApiError.badRequest("Only agreements awaiting Max approval can be approved for send.");
    }

    const eventPayload = {
      agreementId,
      payloadSha: agreement.agreementPayloadSha256,
      legalContentSha256: agreement.legalContentSha256,
      templateSha256: agreement.templateSha256,
      cssSha256: agreement.cssSha256,
      assetManifestSha256: agreement.assetManifestSha256,
      approverId: userId,
      event: "max_approved",
    };
    const approvalSha = sha256(stableJson(eventPayload));
    await pool.execute(
      `UPDATE service_agreement
       SET status = 'approved_for_send',
           max_approved_by = COALESCE(max_approved_by, ?),
           max_approved_at = COALESCE(max_approved_at, CURRENT_TIMESTAMP),
           approval_event_sha256 = COALESCE(approval_event_sha256, ?),
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ? AND id = ?`,
      [userId, approvalSha, clinicId, agreementId],
    );
    await this.writeAgreementEvent({
      clinicId,
      agreementId,
      eventType: "max_approved",
      idempotencyKey: `service_agreement:${agreementId}:max_approved:${approvalSha}`,
      userId,
      payload: eventPayload,
    });
    await logAuditEvent({
      clinicId,
      userId,
      action: "SERVICE_AGREEMENT_MAX_APPROVED",
      entityType: "service_agreement",
      entityId: agreementId,
      changes: eventPayload,
    });
    return this.getAgreement(clinicId, agreementId);
  }

  async attachSignatureEvidence(input: {
    clinicId: string;
    userId: string;
    agreementId: string;
    signatureEvidenceId: string;
    acceptedPdfSha256: string;
  }) {
    const acceptedPdfSha256 = requireHash(input.acceptedPdfSha256, "acceptedPdfSha256");
    const agreement = await this.getAgreement(input.clinicId, input.agreementId);
    if (!["approved_for_send", "sent", "signed"].includes(agreement.status)) {
      throw ApiError.badRequest("Signature evidence can only be attached after Max approval.");
    }
    if (agreement.signedEvidenceId && agreement.signedEvidenceId !== input.signatureEvidenceId) {
      throw ApiError.conflict("Service agreement already has immutable signature evidence.");
    }
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM proposal_signature_evidence
       WHERE id = ? AND clinic_id = ? AND proposal_id = ?
       LIMIT 1`,
      [input.signatureEvidenceId, input.clinicId, agreement.proposalId],
    );
    if (!rows[0]) throw ApiError.notFound("Signature evidence not found for this agreement.");

    await pool.execute(
      `UPDATE service_agreement
       SET status = 'signed',
           signed_evidence_id = ?,
           accepted_pdf_sha256 = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ? AND id = ?`,
      [input.signatureEvidenceId, acceptedPdfSha256, input.clinicId, input.agreementId],
    );
    await this.writeAgreementEvent({
      clinicId: input.clinicId,
      agreementId: input.agreementId,
      eventType: "signature_attached",
      idempotencyKey: `service_agreement:${input.agreementId}:signature:${input.signatureEvidenceId}`,
      userId: input.userId,
      payload: { signatureEvidenceId: input.signatureEvidenceId, acceptedPdfSha256 },
    });
    return this.getAgreement(input.clinicId, input.agreementId);
  }

  async triggerQuickBooksOnce(clinicId: string, userId: string, agreementId: string) {
    const agreement = await this.getAgreement(clinicId, agreementId);
    if (agreement.status !== "signed") throw ApiError.badRequest("QuickBooks can only be triggered after signed agreement evidence is stored.");
    if (!agreement.proposalId) throw ApiError.badRequest("QuickBooks trigger requires a source proposal.");

    const draft = await quickBooksService.stageCommercialDraft({
      clinicId,
      eventId: agreement.id,
      proposalId: agreement.proposalId,
      clientAccountProfileId: agreement.clientAccountProfileId,
      idempotencyKey: `service_agreement:${agreement.id}:quickbooks`,
      payload: {
        source: "service_agreement",
        serviceAgreementId: agreement.id,
        agreementPayloadSha256: agreement.agreementPayloadSha256,
        acceptedPdfSha256: agreement.acceptedPdfSha256,
        commercialTerms: parseJsonObject(agreement.agreementPayload.commercialTerms),
      },
    });

    await pool.execute(
      `UPDATE service_agreement
       SET quickbooks_draft_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ? AND id = ? AND quickbooks_draft_id IS NULL`,
      [draft.id, clinicId, agreementId],
    );
    await this.writeAgreementEvent({
      clinicId,
      agreementId,
      eventType: "quickbooks_triggered",
      idempotencyKey: `service_agreement:${agreementId}:quickbooks:${draft.id}`,
      userId,
      payload: { quickBooksDraftId: draft.id },
    });
    return draft;
  }

  async unlockOnboardingAfterClearedPayment(input: {
    clinicId: string;
    userId: string;
    agreementId: string;
    paymentStatus: "paid";
    authenticated: boolean;
    clearedAt: string;
  }) {
    if (input.paymentStatus !== "paid" || input.authenticated !== true) {
      throw ApiError.badRequest("Authenticated cleared payment evidence is required before onboarding can start.");
    }
    const clearedAt = toDateOnly(input.clearedAt, "clearedAt");
    const agreement = await this.getAgreement(input.clinicId, input.agreementId);
    if (agreement.status !== "signed") throw ApiError.badRequest("Onboarding requires a signed agreement.");
    if (!agreement.quickBooksDraftId) throw ApiError.badRequest("Onboarding requires the QuickBooks commercial draft trigger.");
    if (!agreement.clientAccountProfileId) throw ApiError.badRequest("Onboarding requires a client account profile.");

    const [profileRows]: any = await pool.execute(
      `SELECT payment_status as paymentStatus
       FROM client_account_profile
       WHERE clinic_id = ? AND id = ?
       LIMIT 1`,
      [input.clinicId, agreement.clientAccountProfileId],
    );
    if (!profileRows[0] || profileRows[0].paymentStatus !== "paid") {
      throw ApiError.badRequest("Client payment is not recorded as paid.");
    }

    await pool.execute(
      `UPDATE client_account_profile
       SET onboarding_status = CASE
             WHEN onboarding_status = 'completed' THEN onboarding_status
             ELSE 'in_progress'
           END,
           updated_by = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ? AND id = ?`,
      [input.userId, input.clinicId, agreement.clientAccountProfileId],
    );
    await pool.execute(
      `UPDATE service_agreement
       SET onboarding_unlocked_at = COALESCE(onboarding_unlocked_at, ?),
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ? AND id = ?`,
      [clearedAt, input.clinicId, input.agreementId],
    );
    await this.writeAgreementEvent({
      clinicId: input.clinicId,
      agreementId: input.agreementId,
      eventType: "onboarding_unlocked",
      idempotencyKey: `service_agreement:${input.agreementId}:onboarding:${clearedAt}`,
      userId: input.userId,
      payload: { paymentStatus: "paid", authenticated: true, clearedAt },
    });
    return this.getAgreement(input.clinicId, input.agreementId);
  }

  private async buildAcceptedProposalTerms(input: GenerateServiceAgreementInput) {
    const proposalId = cleanString(input.proposalId);
    if (!proposalId) throw ApiError.badRequest("proposalId is required for accepted proposal agreements.");
    const [rows]: any = await pool.execute(
      `SELECT p.id as proposalId,
              p.proposal_name as proposalName,
              p.status as proposalStatus,
              p.expires_at as expiresAt,
              p.client_account_profile_id as proposalClientAccountProfileId,
              p.value as proposalValue,
              p.currency as proposalCurrency,
              ar.id as acceptanceRecordId,
              ar.accepted_at as acceptedAt,
              ar.acceptance_status as acceptanceStatus,
              ar.client_account_profile_id as acceptanceClientAccountProfileId,
              ar.accepted_by_name as acceptedByName,
              ar.package_name as packageName,
              ar.monthly_fee_cents as monthlyFeeCents,
              ar.setup_fee_cents as setupFeeCents,
              ar.currency,
              ar.payment_terms as paymentTerms,
              ar.start_date as startDate,
              ar.minimum_term_months as minimumTermMonths,
              ar.notice_period_days as noticePeriodDays,
              ar.scope
       FROM proposal p
       JOIN proposal_acceptance_record ar
         ON ar.proposal_id = p.id
        AND ar.clinic_id = p.clinic_id
        AND ar.deleted_at IS NULL
       WHERE p.clinic_id = ?
         AND p.id = ?
         AND p.deleted_at IS NULL
       LIMIT 1`,
      [input.clinicId, proposalId],
    );
    const row = rows[0];
    if (!row) throw ApiError.notFound("Accepted proposal not found.");
    if (!["accepted", "won"].includes(row.proposalStatus) || !["accepted", "won"].includes(row.acceptanceStatus)) {
      throw ApiError.badRequest("Only accepted human-approved proposals can generate service agreements.");
    }
    if (row.expiresAt && row.acceptedAt && new Date(row.acceptedAt).getTime() > new Date(row.expiresAt).getTime()) {
      throw ApiError.badRequest("The accepted proposal is outside its proposal expiry window.");
    }
    const clientAccountProfileId = row.acceptanceClientAccountProfileId || row.proposalClientAccountProfileId;
    if (!clientAccountProfileId) throw ApiError.badRequest("Accepted proposal must be linked to a client account profile.");

    return {
      proposalId,
      clientAccountProfileId,
      sourceReference: proposalId,
      commercialTerms: {
        clientName: row.acceptedByName || row.proposalName,
        packageName: row.packageName,
        monthlyFeeCents: row.monthlyFeeCents,
        setupFeeCents: row.setupFeeCents,
        currency: row.currency || row.proposalCurrency || "GBP",
        vatTreatment: "prices_exclude_vat" as const,
        paymentTerms: row.paymentTerms,
        startDate: row.startDate,
        minimumTermMonths: row.minimumTermMonths,
        noticePeriodDays: row.noticePeriodDays,
        scope: parseJsonObject(row.scope),
      },
    };
  }

  private async buildEnteredTerms(input: GenerateServiceAgreementInput) {
    const sourceReference = cleanString(input.sourceReference);
    if (!sourceReference) throw ApiError.badRequest("sourceReference is required for manual or transcript agreements.");
    const clientAccountProfileId = cleanString(input.clientAccountProfileId);
    if (!clientAccountProfileId) throw ApiError.badRequest("clientAccountProfileId is required for manual or transcript agreements.");
    if (!input.commercialTerms) {
      throw ApiError.badRequest("commercialTerms are required. The system cannot invent legal or commercial terms.");
    }
    await this.ensureClientAccountProfile(input.clinicId, clientAccountProfileId);
    return {
      proposalId: cleanString(input.proposalId),
      clientAccountProfileId,
      sourceReference,
      commercialTerms: input.commercialTerms,
    };
  }

  private async ensureClientAccountProfile(clinicId: string, clientAccountProfileId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id FROM client_account_profile WHERE clinic_id = ? AND id = ? LIMIT 1`,
      [clinicId, clientAccountProfileId],
    );
    if (!rows[0]) throw ApiError.notFound("Client account profile not found.");
  }

  private async getBySource(clinicId: string, sourceType: ServiceAgreementSourceType, sourceReference: string) {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM service_agreement
       WHERE clinic_id = ? AND source_type = ? AND source_reference = ?
       LIMIT 1`,
      [clinicId, sourceType, sourceReference],
    );
    if (!rows[0]) throw ApiError.internal("Service agreement could not be loaded.");
    return this.getAgreement(clinicId, rows[0].id);
  }

  private async writeAgreementEvent(input: {
    clinicId: string;
    agreementId: string;
    eventType: string;
    idempotencyKey: string;
    userId: string;
    payload: Record<string, unknown>;
  }, executor: QueryExecutor = pool) {
    const eventPayload = stableJson(input.payload);
    const eventSha = sha256(eventPayload);
    await executor.execute(
      `INSERT INTO service_agreement_audit_event
        (id, clinic_id, service_agreement_id, event_type, idempotency_key, event_payload, event_sha256, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE event_sha256 = event_sha256`,
      [uuidv4(), input.clinicId, input.agreementId, input.eventType, input.idempotencyKey, eventPayload, eventSha, input.userId],
    );
    await insertAuditEvent(executor, {
      clinicId: input.clinicId,
      userId: input.userId,
      action: `SERVICE_AGREEMENT_${input.eventType.toUpperCase()}`,
      entityType: "service_agreement",
      entityId: input.agreementId,
      changes: input.payload,
    });
  }
}

export const serviceAgreementsService = new ServiceAgreementsService();
