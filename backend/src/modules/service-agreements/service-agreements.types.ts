export type ServiceAgreementSourceType = "accepted_proposal" | "manual_entry" | "transcript_draft";
export type ServiceAgreementStatus = "max_approval_required" | "approved_for_send" | "sent" | "signed" | "voided";
export type ServiceAgreementRenderMode = "test_do_not_send" | "production";

export interface ServiceAgreementRegistry {
  legalTermsVersion: string;
  legalContentSha256: string;
  templateVersion: string;
  templateSha256: string;
  cssSha256: string;
  assetManifestSha256: string;
  allowedAssetPrefixes: string[];
  productionSendEnabled: boolean;
}

export interface ServiceAgreementCommercialTerms {
  clientName: string;
  packageName: string;
  monthlyFeeCents: number;
  setupFeeCents: number;
  currency: "GBP";
  vatTreatment: "prices_exclude_vat";
  paymentTerms: string;
  startDate: string;
  minimumTermMonths: number;
  noticePeriodDays: number;
  scope: Record<string, unknown>;
}

export interface GenerateServiceAgreementInput {
  clinicId: string;
  userId: string;
  sourceType: ServiceAgreementSourceType;
  sourceReference?: string | null;
  proposalId?: string | null;
  clientAccountProfileId?: string | null;
  renderMode?: ServiceAgreementRenderMode | null;
  legalTermsVersion: string;
  legalContentSha256: string;
  templateVersion: string;
  templateSha256: string;
  cssSha256: string;
  assetManifestSha256: string;
  assetPaths?: string[];
  commercialTerms?: ServiceAgreementCommercialTerms;
}

export interface ServiceAgreementRecord {
  id: string;
  clinicId: string;
  proposalId: string | null;
  clientAccountProfileId: string | null;
  sourceType: ServiceAgreementSourceType;
  sourceReference: string;
  status: ServiceAgreementStatus;
  renderMode: ServiceAgreementRenderMode;
  legalTermsVersion: string;
  legalContentSha256: string;
  templateVersion: string;
  templateSha256: string;
  cssSha256: string;
  assetManifestSha256: string;
  agreementPayload: Record<string, unknown>;
  agreementPayloadSha256: string;
  renderedHtmlSha256: string;
  watermark: string | null;
  maxApprovedBy: string | null;
  maxApprovedAt: string | null;
  approvalEventSha256: string | null;
  signedEvidenceId: string | null;
  acceptedPdfSha256: string | null;
  quickBooksDraftId: string | null;
  onboardingUnlockedAt: string | null;
}

export interface ServiceAgreementAuditEvent {
  id: string;
  eventType: string;
  idempotencyKey: string;
  eventPayload: Record<string, unknown>;
  eventSha256: string;
  createdAt: string;
}
