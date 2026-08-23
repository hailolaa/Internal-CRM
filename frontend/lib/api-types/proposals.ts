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

export type ProposalProofAssetType =
  | "award"
  | "testimonial"
  | "testimonial_video"
  | "case_study"
  | "client_logo"
  | "performance_result"
  | "product_screenshot"
  | "team_image";

export type ProposalDataState = "known" | "working_diagnosis" | "provisional" | "to_confirm";
export type ProposalDiscoveryStatus = "in_progress" | "paused" | "completed" | "draft_created" | "archived";
export type ProposalTemplateVersionStatus = "draft" | "in_review" | "approved" | "published" | "rejected" | "superseded";

// Internal frozen V5 snapshots are full integrity records and may include hash/source metadata.
export type ProposalV5PersistedSnapshot = Record<string, unknown> & {
  schemaVersion: "proposal_v5";
  proposal: {
    reference: string;
  };
  template?: {
    templateId: string | null;
    templateKey: string;
    versionId: string | null;
    versionNumber: number | null;
    contentHash: string | null;
    status: ProposalTemplateVersionStatus | null;
  };
  generatedAt?: string;
  pageCount?: 15;
  sourceProposalVersion?: string;
  snapshotHash?: string;
};

// Public V5 snapshots are sanitized by the backend and must not include hash, source, package, proof or image IDs.
export type ProposalV5PublicSnapshot = Record<string, unknown> & {
  schemaVersion: "proposal_v5";
  proposal: {
    reference: string;
  };
  template?: never;
  snapshotHash?: never;
  sourceProposalVersion?: never;
};

export interface ProposalRecord {
  id: string;
  contactId: string | null;
  dealId: string | null;
  clientAccountProfileId: string | null;
  proposalName: string;
  templateId?: string | null;
  templateKey: string;
  templateVersionId?: string | null;
  templateVersionNumber?: number | null;
  templateContentHash?: string | null;
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
  coreData?: ProposalCoreData | null;
  v5Snapshot?: ProposalV5PersistedSnapshot | null;
  v5SnapshotHash?: string | null;
  v5SnapshotVersion?: string | null;
  v5SnapshotFrozenAt?: string | null;
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

export interface ProposalClientReadinessRecord {
  proposalId: string;
  ready: boolean;
  status: ProposalStatus;
  frozen: boolean;
  canRenderV5: boolean;
  pageCount: number | null;
  packageId: string | null;
  issues: string[];
}

export interface ProposalRenderRecord {
  proposal: ProposalRecord;
  v5Snapshot: ProposalV5PersistedSnapshot | null;
  frozen: boolean;
  validation: ProposalClientReadinessRecord;
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
  legalCompanyName: string | null;
  billingEmail: string | null;
  preferredStartDate: string | null;
  agreementAccepted: boolean;
  confirmationText: string | null;
  acceptanceSource: string | null;
  acceptedIpAddress: string | null;
  acceptedUserAgent: string | null;
  evidenceSha256: string | null;
  lockedAt: string | null;
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
  coreDataSnapshot?: ProposalCoreData | null;
  v5Snapshot?: ProposalV5PersistedSnapshot | null;
  v5SnapshotHash?: string | null;
  v5SnapshotVersion?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalCoreData {
  schemaVersion: "proposal_core_v1";
  proposalId: string;
  immutableVersion: string;
  lifecycle: {
    status: ProposalStatus;
    createdAt: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
    proposedStartDate: string | null;
  };
  recipient: {
    name: string | null;
    email: string | null;
    clinicName: string | null;
    location: string | null;
    clinicType: string | null;
    authorisedDecisionMaker: string | null;
  };
  discovery: {
    source: string | null;
    customerWording: string | null;
    priorityServices: string | null;
    goal: string | null;
    workingDiagnosis: string | null;
    confidenceState: ProposalDataState;
  };
  journey: {
    stages: string[];
    activeConstraintId: string | null;
    diagnosedLeaks: string[];
    evidence: string | null;
    confidenceState: ProposalDataState;
  };
  commercial: {
    selectedPackageId: string | null;
    packageName: string | null;
    monthlyFeeCents: number | null;
    setupFeeCents: number | null;
    currency: string;
    vatStatus: string | null;
    selectedMedia: string | null;
    minimumTermMonths: number | null;
    noticePeriodDays: number | null;
    exactTerms: string | null;
  };
  economics: {
    economicUnit: string | null;
    clinicConfirmedContribution: string | null;
    contributionEvidenceSourceDate: string | null;
    contributionConfirmationState: ProposalDataState;
    relevantMonthlyInvestment: string | null;
    capacity: string | null;
    paybackState: ProposalDataState;
    wholeUnitBreakEvenRule: string | null;
  };
  kpis: Array<{
    name: string;
    baselineState: ProposalDataState;
    reviewCadence: string | null;
    connectedDataSource: string | null;
  }>;
  scopeLines: Array<{
    category: string;
    title: string;
    quantityLimit: string | null;
    frequency: string | null;
    dependency: string | null;
    owner: string | null;
    exclusion: string | null;
  }>;
  dataVisibility: {
    connectedSources: string[];
    productStatus: "demo_data" | "partially_connected" | "live_connected" | "not_connected" | null;
    knownLimitations: string | null;
  };
  proofAssets: Array<{
    id: string | null;
    type: ProposalProofAssetType | null;
    title: string | null;
    proofMode: string | null;
    proofScope: string | null;
    source: string | null;
    timeframe: string | null;
    disclaimer: string | null;
  }>;
  sectorImages: Array<{
    slot: "cover" | "journey" | "proof" | "close";
    imageId: string | null;
    url: string | null;
    cropPosition: string | null;
    licence: string | null;
    provenance: string | null;
    approvalStatus: "approved" | "to_confirm" | null;
  }>;
  approval: {
    approvalVersion: string | null;
    recipient: string | null;
    timestamp: string | null;
    packageName: string | null;
    scope: Record<string, unknown> | null;
    exactTermsPresented: string | null;
  };
}

export interface ProposalSectionContent {
  proposalReference?: string | null;
  proposalDate?: string | null;
  clinicTypeVariant?: string | null;
  clinicTypeAssetVersion?: string | null;
  heroImageUrl?: string | null;
  heroImageAlt?: string | null;
  heroImageId?: string | null;
  heroImageCropPosition?: string | null;
  heroImageLicence?: string | null;
  discoverySource?: string | null;
  customerWording?: string | null;
  evidenceConfidenceState?: "known" | "confirmed_on_call" | "working_diagnosis" | "provisional" | "to_confirm" | null;
  activeConstraintId?: string | null;
  activeConstraintConfidenceState?: "known" | "confirmed_on_call" | "working_diagnosis" | "provisional" | "to_confirm" | null;
  economicUnit?: string | null;
  clinicConfirmedContribution?: string | null;
  contributionEvidenceSourceDate?: string | null;
  contributionConfirmationState?: "known" | "confirmed_on_call" | "working_diagnosis" | "provisional" | "to_confirm" | null;
  selectedMediaSpend?: string | null;
  paybackState?: "known" | "confirmed_on_call" | "working_diagnosis" | "provisional" | "to_confirm" | null;
  liveDataStatus?: "demo_data" | "partially_connected" | "live_connected" | "not_connected" | null;
  knownDataLimitations?: string | null;
  sectorImageApprovalStatus?: "approved" | "to_confirm" | null;
  sectorImageProvenance?: string | null;
  sectorImages?: ProposalSectorImage[] | null;
  executiveSummary?: string | null;
  personalIntroduction?: string | null;
  diagnosis?: string | null;
  introVideoUrl?: string | null;
  introVideoTitle?: string | null;
  introVideoThumbnailUrl?: string | null;
  fallbackVideoUrl?: string | null;
  primaryGoal?: string | null;
  clinicTypeAndLocations?: string | null;
  currentPosition?: string | null;
  currentMarketingSpend?: string | null;
  currentWebsiteCrmBookingSetup?: string | null;
  problemsDiscussed?: string | null;
  whyActNow?: string | null;
  currentlyUnmeasured?: string | null;
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
  currentBookingRate?: string | null;
  attendanceRate?: string | null;
  consultationToTreatmentConversionRate?: string | null;
  targetBookings?: string | null;
  consultationValue?: string | null;
  averageTreatmentValue?: string | null;
  availableCommercialCapacity?: string | null;
  currentAcquisitionCost?: string | null;
  recommendedAdSpend?: string | null;
  estimatedCostPerLead?: string | null;
  estimatedLeads?: string | null;
  estimatedBookedPatients?: string | null;
  breakEvenBookings?: string | null;
  commercialDataSource?: string | null;
  commercialChangeReason?: string | null;
  commercialApprovalStatus?: "not_required" | "pending" | "approved" | "rejected" | null;
  recommendedPlan?: string | null;
  proofAssetIds?: string[];
  proofAssets?: ProposalProofAssetRecord[];
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
  fieldEvidenceReferences?: Record<string, string | null> | null;
  fieldApprovals?: Record<string, ProposalFieldApproval | null> | null;
}

export interface ProposalFieldApproval {
  evidenceReference?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  approvalStatus?: "not_required" | "pending" | "approved" | "rejected" | null;
}

export interface ProposalSectorImage {
  slot: "cover" | "journey" | "proof" | "close";
  imageId?: string | null;
  url?: string | null;
  cropPosition?: string | null;
  licence?: string | null;
  provenance?: string | null;
  approvalStatus?: "approved" | "to_confirm" | null;
}

export interface ProposalDiscoveryAnswer {
  value: string | null;
  state: ProposalDataState;
  sourceLabel: string | null;
  sourceAt: string | null;
  evidenceReference?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  approvalStatus?: "not_required" | "pending" | "approved" | "rejected" | null;
  customerWording: string | null;
  notes?: string | null;
}

export type ProposalDiscoveryAnswers = Record<string, ProposalDiscoveryAnswer | undefined>;

export interface ProposalDiscoveryGuideField {
  key: string;
  label: string;
  prompt: string;
  requiredForIssue?: boolean;
}

export interface ProposalDiscoveryGuideSection {
  key: string;
  title: string;
  purpose: string;
  fields: ProposalDiscoveryGuideField[];
}

export interface ProposalDiscoveryIssue {
  fieldKey: string;
  label: string;
  message: string;
  severity: "required" | "warning";
}

export interface ProposalDiscoveryConflict {
  code: string;
  message: string;
  severity: "blocking" | "warning";
}

export interface ProposalDiscoverySectorBehaviour {
  clinicType: string;
  firstJourneyEmphasis: string;
  economicUnit: string;
}

export interface ProposalDiscoverySessionRecord {
  id: string;
  contactId: string | null;
  dealId: string | null;
  clientAccountProfileId: string | null;
  proposalId: string | null;
  status: ProposalDiscoveryStatus;
  clinicType: string | null;
  recommendedPackageId: string | null;
  activeConstraintId: string | null;
  selectedMediaSpendCents: number | null;
  prefillSnapshot: Record<string, unknown> | null;
  answers: ProposalDiscoveryAnswers;
  freeNotes: string | null;
  missingFields: ProposalDiscoveryIssue[];
  topMissingFields: ProposalDiscoveryIssue[];
  conflicts: ProposalDiscoveryConflict[];
  callOutcome: string | null;
  nextAction: string | null;
  nextActionOwnerId: string | null;
  nextActionDueAt: string | null;
  startedAt: string;
  lastAutosavedAt: string | null;
  completedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  guide: ProposalDiscoveryGuideSection[];
  sectorBehaviour: ProposalDiscoverySectorBehaviour[];
}

export interface ProposalDiscoveryStartPayload {
  contactId?: string | null;
  dealId?: string | null;
  clientAccountProfileId?: string | null;
  proposalId?: string | null;
}

export interface ProposalDiscoveryUpdatePayload {
  status?: ProposalDiscoveryStatus;
  clinicType?: string | null;
  recommendedPackageId?: string | null;
  activeConstraintId?: string | null;
  selectedMediaSpendCents?: number | null;
  answers?: ProposalDiscoveryAnswers;
  freeNotes?: string | null;
  callOutcome?: string | null;
  nextAction?: string | null;
  nextActionOwnerId?: string | null;
  nextActionDueAt?: string | null;
}

export interface ProposalDiscoveryDraftResult {
  session: ProposalDiscoverySessionRecord;
  proposal: ProposalRecord;
}

export interface ProposalScopeItem {
  libraryItemId?: string | null;
  libraryVersion?: number | null;
  category: string;
  title: string;
  clientDescription: string;
  frequency?: string | null;
  quantityLimit?: string | null;
  treatmentsAndLocations?: string | null;
  dependencies?: string | null;
  clientResponsibilities?: string | null;
  exclusions?: string | null;
  thirdPartyCosts?: string | null;
  inclusionStatus: "included" | "excluded";
  deliveryType: "recurring" | "one_off";
  isOptionalAddOn: boolean;
  isCustom?: boolean;
  changeReason?: string | null;
  approvalStatus?: "not_required" | "pending" | "approved" | "rejected" | null;
  sortOrder: number;
}

export type ProposalScopeLibraryStatus = "active" | "archived";

export interface ProposalScopeLibraryItemRecord extends ProposalScopeItem {
  id: string;
  templateKey: string;
  name: string;
  deliverables: string[];
  status: ProposalScopeLibraryStatus;
  isActive: boolean;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalScopeLibraryListRecord {
  items: ProposalScopeLibraryItemRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProposalScopeLibraryItemPayload {
  templateKey?: string | null;
  name?: string | null;
  category?: string | null;
  description?: string | null;
  clientDescription?: string | null;
  deliverables?: string[] | null;
  frequency?: string | null;
  quantityLimit?: string | null;
  treatmentsAndLocations?: string | null;
  dependencies?: string | null;
  clientResponsibilities?: string | null;
  exclusions?: string | null;
  thirdPartyCosts?: string | null;
  inclusionStatus?: "included" | "excluded" | null;
  deliveryType?: "recurring" | "one_off" | null;
  isOptionalAddOn?: boolean | null;
  sortOrder?: number | null;
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
  activeVersion: ProposalTemplateVersionSummary | null;
}

export interface ProposalTemplateContent {
  name?: string | null;
  description?: string | null;
  packageName?: string | null;
  defaultSections?: ProposalSectionContent | null;
  defaultRoadmap?: string[] | null;
  defaultTerms?: string | null;
  defaultSuccessMetrics?: string[] | null;
  editablePolicyVersion?: string | null;
  lockedFields?: string[] | null;
}

export interface ProposalTemplateVersionSummary {
  id: string;
  templateId: string;
  templateKey: string;
  versionNumber: number;
  status: ProposalTemplateVersionStatus;
  contentHash: string;
  sourceVersionId: string | null;
  createdBy: string | null;
  createdByName: string | null;
  submittedBy: string | null;
  approvedBy: string | null;
  rejectedBy: string | null;
  publishedBy: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  publishedAt: string | null;
  supersededAt: string | null;
  rejectionReason: string | null;
  changeSummary: string | null;
}

export interface ProposalTemplateVersionRecord extends ProposalTemplateVersionSummary {
  content: ProposalTemplateContent;
}

export interface ProposalTemplatePayload {
  templateKey?: string | null;
  name?: string | null;
  description?: string | null;
  content?: ProposalTemplateContent | null;
  changeSummary?: string | null;
}

export interface ProposalTemplateVersionPayload {
  content?: ProposalTemplateContent | null;
  expectedContentHash?: string | null;
  changeSummary?: string | null;
}

export interface ProposalTemplateVersionCompareRecord {
  fromVersion: ProposalTemplateVersionSummary;
  toVersion: ProposalTemplateVersionSummary;
  diffs: Array<{
    path: string;
    before: unknown;
    after: unknown;
    changed: boolean;
  }>;
}

export interface ProposalProofAssetRecord {
  id: string;
  type: ProposalProofAssetType;
  title: string;
  copy: string;
  mediaUrl: string | null;
  sectorTags: string[];
  sortOrder: number;
  status?: "active" | "archived";
  isActive: boolean;
  version?: number;
  createdBy?: string | null;
  updatedBy?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalProofAssetListRecord {
  items: ProposalProofAssetRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProposalProofAssetPayload {
  type: ProposalProofAssetType;
  title: string;
  copy: string;
  mediaUrl?: string | null;
  sectorTags?: string[] | null;
  sortOrder?: number | null;
  isActive?: boolean;
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

export interface ProposalPublicAcceptancePayload {
  fullName: string;
  email: string;
  legalCompanyName: string;
  billingEmail: string;
  preferredStartDate?: string | null;
  agreementAccepted: boolean;
  signatureConfirmation: string;
}

export interface ProposalPublicEventPayload {
  eventType:
    | "section_viewed"
    | "video_opened"
    | "pdf_download_clicked"
    | "acceptance_cta_clicked"
    | "question_clicked"
    | "book_call_clicked";
  sectionKey?: string | null;
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
  | "coreData"
  | "contactName"
  | "accountName"
  | "clientAccountName"
>;

export type ProposalPublicRecordWithV5 = ProposalPublicRecord & {
  v5Snapshot?: ProposalV5PublicSnapshot | null;
  v5SnapshotSchemaVersion?: "proposal_v5" | null;
};

export interface ProposalPublicPreviewRecord {
  proposal: ProposalPublicRecordWithV5;
  packageRecord: Pick<
    GrowthPackageRecord,
    "name" | "priceCents" | "setupFeeCents" | "currency" | "billingFrequency" | "includedFeatures" | "proposalWording"
  > | null;
  acceptance: ProposalPublicAcceptanceSummary | null;
  acceptanceUrl: string | null;
  acceptanceQrCodeDataUrl: string | null;
}

export interface ProposalPublicAcceptanceSummary {
  acceptedByName: string | null;
  acceptedByEmail: string | null;
  legalCompanyName: string | null;
  billingEmail: string | null;
  preferredStartDate: string | null;
  acceptedAt: string;
  lockedAt: string | null;
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
  templateVersionId?: string | null;
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
