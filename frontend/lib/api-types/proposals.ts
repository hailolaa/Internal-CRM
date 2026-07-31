import type { GrowthPackageRecord } from "@/lib/api-types/packages";

export type ProposalStatus =
  | "draft"
  | "ready"
  | "sent"
  | "viewed"
  | "follow_up_due"
  | "accepted"
  | "won"
  | "lost"
  | "expired"
  | "archived";

export interface ProposalRecord {
  id: string;
  contactId: string | null;
  dealId: string | null;
  clientAccountProfileId: string | null;
  proposalName: string;
  templateKey: string;
  packageName: string | null;
  recommendedPackageId: string | null;
  ownerId: string | null;
  ownerName: string | null;
  status: ProposalStatus;
  valueCents: number | null;
  monthlyFeeCents: number | null;
  setupFeeCents: number | null;
  currency: string;
  adSpendNote: string | null;
  vatStatus: string | null;
  minimumTermMonths: number | null;
  noticePeriodDays: number | null;
  startDate: string | null;
  followUpAt: string | null;
  readyAt: string | null;
  sentAt: string | null;
  sentToEmail: string | null;
  sentToName: string | null;
  sendMethod: string | null;
  sendNote: string | null;
  sentBy: string | null;
  sentByName: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  acceptedReason: string | null;
  wonAt: string | null;
  wonReason: string | null;
  lostAt: string | null;
  lostReason: string | null;
  objectionType: string | null;
  expiresAt: string | null;
  proposalUrl: string | null;
  notes: string | null;
  addOns: ProposalCommercialItem[];
  discounts: ProposalCommercialItem[];
  internalMarginNote: string | null;
  sectionContent: ProposalSectionContent | null;
  draftSavedAt: string | null;
  contactName: string | null;
  contactEmail: string | null;
  accountName: string | null;
  dealTitle: string | null;
  clientAccountName: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  acceptanceRecord: ProposalAcceptanceRecord | null;
}

export type ProposalSignatureStatus =
  | "requested"
  | "sent"
  | "viewed"
  | "signed"
  | "declined"
  | "expired"
  | "cancelled"
  | "failed";

export interface ProposalSignatureEvidenceRecord {
  id: string;
  proposalId: string;
  signatureRequestId: string;
  provider: string;
  providerRequestId: string | null;
  signerName: string;
  signerEmail: string;
  signedAt: string;
  signedPdfUrl: string | null;
  auditCertificateUrl: string | null;
  evidenceSha256: string;
  evidenceJson: Record<string, unknown>;
  createdAt: string;
}

export interface ProposalSignatureRequestRecord {
  id: string;
  proposalId: string;
  provider: string;
  providerRequestId: string | null;
  status: ProposalSignatureStatus;
  signerName: string | null;
  signerEmail: string | null;
  signatureUrl: string | null;
  idempotencyKey: string;
  requestedAt: string;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  expiredAt: string | null;
  failureReason: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  evidence: ProposalSignatureEvidenceRecord | null;
}

export interface ProposalAcceptanceRecord {
  id: string;
  proposalId: string;
  contactId: string | null;
  dealId: string | null;
  clientAccountProfileId: string | null;
  acceptedByName: string | null;
  acceptedByEmail: string | null;
  acceptedAt: string;
  acceptanceStatus: "accepted" | "won";
  packageName: string | null;
  recommendedPackageId: string | null;
  monthlyFeeCents: number | null;
  setupFeeCents: number | null;
  currency: string;
  paymentTerms: string | null;
  startDate: string | null;
  minimumTermMonths: number | null;
  noticePeriodDays: number | null;
  scope: Record<string, unknown> | null;
  commercialSnapshot: Record<string, unknown> | null;
  proposalSnapshot: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalSectionContent {
  executiveSummary?: string | null;
  personalIntroduction?: string | null;
  diagnosis?: string | null;
  introVideoUrl?: string | null;
  introVideoTitle?: string | null;
  fallbackVideoUrl?: string | null;
  primaryGoal?: string | null;
  currentPosition?: string | null;
  availableCapacity?: string | null;
  priorityTreatments?: string | null;
  targetArea?: string | null;
  desiredOutcome?: string | null;
  growthScoreOverall?: number | null;
  visibilityScore?: number | null;
  conversionScore?: number | null;
  trackingScore?: number | null;
  leadHandlingScore?: number | null;
  salesConversionScore?: number | null;
  retentionScore?: number | null;
  biggestRisk?: string | null;
  biggestOpportunity?: string | null;
  firstRecommendedFix?: string | null;
  currentMonthlyEnquiries?: string | null;
  currentMonthlyBookedPatients?: string | null;
  targetBookings?: string | null;
  consultationValue?: string | null;
  averageTreatmentValue?: string | null;
  availableCommercialCapacity?: string | null;
  recommendedAdSpend?: string | null;
  estimatedCostPerLead?: string | null;
  estimatedLeads?: string | null;
  estimatedBookedPatients?: string | null;
  breakEvenBookings?: string | null;
  commercialDataSource?: string | null;
  recommendedPlan?: string | null;
  scopeItems?: ProposalScopeItem[];
  strategyPoints?: string[];
  includedFeatures?: string[];
  successMetrics?: string[];
  clinicGrowerResponsibilities?: string[];
  clientResponsibilities?: string[];
  timeline?: string | null;
  termsSummary?: string | null;
  investmentNotes?: string | null;
  nextSteps?: string | null;
}

export interface ProposalScopeItem {
  category: string;
  title: string;
  clientDescription: string;
  frequency?: string | null;
  quantityLimit?: string | null;
  inclusionStatus: "included" | "excluded";
  deliveryType: "recurring" | "one_off";
  isOptionalAddOn: boolean;
  sortOrder: number;
}

export interface ProposalCommercialItem {
  name: string;
  amountCents?: number | null;
  note?: string | null;
}

export interface ProposalTemplateRecord {
  id: string;
  templateKey: string;
  name: string;
  description: string | null;
  packageName: string | null;
  defaultSections: ProposalSectionContent | null;
  defaultRoadmap: string[];
  defaultTerms: string | null;
  defaultSuccessMetrics: string[];
  defaultScopeItems: ProposalScopeItem[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalShareRecord {
  proposalId: string;
  proposalUrl: string;
  createdAt: string;
}

export interface ProposalSendPayload {
  recipientEmail?: string | null;
  recipientName?: string | null;
  sendMethod?: string | null;
  sendNote?: string | null;
}

export interface ProposalStatusUpdatePayload {
  status: Extract<ProposalStatus, "follow_up_due" | "accepted" | "won" | "lost">;
  followUpAt?: string | null;
  reason?: string | null;
  objectionType?: string | null;
  acceptedByName?: string | null;
  acceptedByEmail?: string | null;
  acceptedAt?: string | null;
  paymentTerms?: string | null;
}

export type ProposalPublicRecord = Pick<
  ProposalRecord,
  | "proposalName"
  | "templateKey"
  | "packageName"
  | "valueCents"
  | "monthlyFeeCents"
  | "setupFeeCents"
  | "currency"
  | "adSpendNote"
  | "vatStatus"
  | "minimumTermMonths"
  | "noticePeriodDays"
  | "startDate"
  | "expiresAt"
  | "addOns"
  | "discounts"
  | "sectionContent"
  | "contactName"
  | "accountName"
  | "clientAccountName"
>;

export interface ProposalPublicPreviewRecord {
  proposal: ProposalPublicRecord;
  packageRecord: Pick<
    GrowthPackageRecord,
    "name" | "priceCents" | "setupFeeCents" | "currency" | "billingFrequency" | "includedFeatures" | "proposalWording"
  > | null;
}

export interface ProposalListParams {
  contactId?: string;
  dealId?: string;
  clientAccountProfileId?: string;
  ownerId?: string;
  status?: ProposalStatus | "all";
  followUpDue?: boolean;
  includeArchived?: boolean;
  search?: string;
  limit?: number;
}

export interface ProposalPayload {
  contactId?: string | null;
  dealId?: string | null;
  clientAccountProfileId?: string | null;
  proposalName?: string | null;
  templateKey?: string | null;
  packageName?: string | null;
  recommendedPackageId?: string | null;
  ownerId?: string | null;
  status?: ProposalStatus;
  valueCents?: number | null;
  monthlyFeeCents?: number | null;
  setupFeeCents?: number | null;
  currency?: string | null;
  adSpendNote?: string | null;
  vatStatus?: string | null;
  minimumTermMonths?: number | null;
  noticePeriodDays?: number | null;
  startDate?: string | null;
  followUpAt?: string | null;
  readyAt?: string | null;
  sentAt?: string | null;
  viewedAt?: string | null;
  acceptedAt?: string | null;
  acceptedReason?: string | null;
  acceptedByName?: string | null;
  acceptedByEmail?: string | null;
  paymentTerms?: string | null;
  wonAt?: string | null;
  wonReason?: string | null;
  lostAt?: string | null;
  lostReason?: string | null;
  objectionType?: string | null;
  expiresAt?: string | null;
  proposalUrl?: string | null;
  notes?: string | null;
  addOns?: ProposalCommercialItem[] | null;
  discounts?: ProposalCommercialItem[] | null;
  internalMarginNote?: string | null;
  sectionContent?: ProposalSectionContent | null;
}

export interface ProposalSourceDataParams {
  contactId?: string;
  dealId?: string;
  clientAccountProfileId?: string;
}

export interface ProposalSourceDataRecord {
  links: {
    contactId: string | null;
    dealId: string | null;
    clientAccountProfileId: string | null;
  };
  contact: {
    id: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    roleTitle: string | null;
    accountName: string | null;
    website: string | null;
    location: string | null;
    source: string | null;
  };
  deal: {
    id: string | null;
    title: string | null;
    stageName: string | null;
    packageName: string | null;
    valueCents: number | null;
  };
  clientAccount: {
    id: string | null;
    name: string | null;
    currentPackage: string | null;
    recommendedNextPackage: string | null;
    upsellOpportunity: string | null;
  };
  growthScore: {
    overall: number | null;
    categories: Record<string, number | null>;
    gaps: Array<{ key: string; label: string; score: number | null }>;
    recommendedPackage: string | null;
    gapSummary: string | null;
    updatedAt: string | null;
  };
  audit: {
    status: string | null;
    followUpDueAt: string | null;
    updatedAt: string | null;
  };
  recommendedPackage: {
    id: string | null;
    name: string | null;
    priceCents: number | null;
    setupFeeCents: number | null;
    currency: string | null;
    billingFrequency: string | null;
    includedFeatures: string[];
    proposalWording: string | null;
  };
  suggested: {
    proposalName: string;
    templateKey: string;
    packageName: string | null;
    recommendedPackageId: string | null;
    valueCents: number | null;
    monthlyFeeCents: number | null;
    setupFeeCents: number | null;
    currency: string;
    adSpendNote: string | null;
    sectionContent: ProposalSectionContent;
  };
}
