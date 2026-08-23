import type { PackageBillingFrequency } from "../packages/packages.types.js";

export const proposalStatuses = [
  "draft",
  "ready",
  "sent",
  "viewed",
  "follow_up_due",
  "accepted",
  "won",
  "lost",
  "expired",
  "archived",
] as const;

export type ProposalStatus = typeof proposalStatuses[number];

export const proposalPublicStatuses = [
  "ready",
  "sent",
  "viewed",
  "follow_up_due",
  "accepted",
  "won",
] as const satisfies readonly ProposalStatus[];

export type ProposalPublicStatus = typeof proposalPublicStatuses[number];

export const proposalProofAssetTypes = [
  "award",
  "testimonial",
  "testimonial_video",
  "case_study",
  "client_logo",
  "performance_result",
  "product_screenshot",
  "team_image",
] as const;

export type ProposalProofAssetType = typeof proposalProofAssetTypes[number];

export const proposalDataStates = [
  "known",
  "working_diagnosis",
  "provisional",
  "to_confirm",
] as const;

export type ProposalDataState = typeof proposalDataStates[number];

export const proposalTemplateVersionStatuses = [
  "draft",
  "in_review",
  "approved",
  "published",
  "rejected",
  "superseded",
] as const;

export type ProposalTemplateVersionStatus = typeof proposalTemplateVersionStatuses[number];

export type ProposalV5SchemaVersion = "proposal_v5";
export type ProposalV5Theme = "dark" | "light";

export type ProposalV5PageId =
  | "V5Page01Cover"
  | "V5Page02Recommendation"
  | "V5Page03GoogleMediaRoas"
  | "V5Page04GrowthEngine"
  | "V5Page05GoogleAds"
  | "V5Page06LandingConversion"
  | "V5Page07SeoGbpWebsite"
  | "V5Page08TrackingOptimisation"
  | "V5Page09Roadmap"
  | "V5Page10ManagementScope"
  | "V5Page11PublishedProof"
  | "V5Page12WhyClinicGrower"
  | "V5Page13PartnershipInvestment"
  | "V5Page14BillingTerms"
  | "V5Page15Decision";

export type ProposalV5ClinicTypeId =
  | "general"
  | "aesthetic_clinic"
  | "dental_clinic"
  | "cosmetic_surgery_clinic"
  | "dermatology_clinic"
  | "hair_transplant_clinic"
  | "wellness_clinic"
  | "private_gp_medical_clinic"
  | "medical_spa";

export type ProposalV5ImageSlot = "cover" | "journey" | "proof" | "close";

export interface ProposalV5PageRegistration {
  id: ProposalV5PageId;
  pageNumber: number;
  theme: ProposalV5Theme;
}

export interface ProposalV5Stated<T> {
  value: T | null;
  state: ProposalDataState;
  source: string | null;
  sourceDate: string | null;
  evidenceReference: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  customerWording: string | null;
}

export interface ProposalV5Image {
  slot: ProposalV5ImageSlot;
  imageId: string | null;
  url: string | null;
  alt: string | null;
  cropPosition: string | null;
  licence: string | null;
  provenance: string | null;
  approvalStatus: "approved" | "to_confirm" | null;
}

export interface ProposalV5Package {
  id: string | null;
  catalogueVersion: string | null;
  name: string | null;
  monthlyFeeCents: number | null;
  setupFeeCents: number | null;
  currency: string;
  billingFrequency: PackageBillingFrequency | null;
  vatStatus: string | null;
  mediaSpendRule: string | null;
  minimumTermMonths: number | null;
  noticePeriodDays: number | null;
}

export interface ProposalV5ScopeLine {
  category: string | null;
  title: string | null;
  description: string | null;
  quantityLimit: string | null;
  frequency: string | null;
  treatmentsAndLocations: string | null;
  dependency: string | null;
  owner: string | null;
  exclusion: string | null;
  thirdPartyCosts: string | null;
  inclusionStatus: "included" | "excluded" | null;
  deliveryType: "recurring" | "one_off" | null;
  isOptionalAddOn: boolean;
  approvalStatus: "not_required" | "pending" | "approved" | "rejected" | null;
}

export interface ProposalV5ProofAsset {
  id: string | null;
  type: ProposalProofAssetType | null;
  title: string | null;
  copy: string | null;
  mediaUrl: string | null;
  sectorTags: string[];
  state: ProposalDataState;
  proofMode: string | null;
  proofScope: string | null;
  source: string | null;
  timeframe: string | null;
  disclaimer: string | null;
}

export interface ProposalV5NarrativePanel {
  label: string;
  title: string;
  text: string;
}

export interface ProposalV5NarrativePoint {
  title: string;
  text: string;
}

export interface ProposalV5ImplementationCheckpoint {
  label: string;
  title: string;
  text: string;
}

export interface ProposalV5ResponsibilityNarrative {
  providerLabel: string;
  providerTitle: string;
  clientTitle: string;
  lede: string;
  transitionLabel: string;
  transitionText: string;
}

export interface ProposalV5Snapshot {
  schemaVersion: ProposalV5SchemaVersion;
  generatedAt: string;
  sourceProposalVersion: string;
  snapshotHash: string;
  pageCount: 15;
  pages: ProposalV5PageRegistration[];
  template: {
    templateId: string | null;
    templateKey: string;
    versionId: string | null;
    versionNumber: number | null;
    contentHash: string | null;
    status: ProposalTemplateVersionStatus | null;
  };
  proposal: {
    reference: string;
  };
  lifecycle: {
    status: ProposalStatus | null;
    createdAt: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
    proposedStartDate: string | null;
  };
  recipient: {
    name: ProposalV5Stated<string>;
    email: ProposalV5Stated<string>;
    authorisedDecisionMaker: ProposalV5Stated<string>;
  };
  clinic: {
    name: ProposalV5Stated<string>;
    location: ProposalV5Stated<string>;
    clinicType: ProposalV5ClinicTypeId;
    typeLabel: string;
    typeShortLabel: string;
    proofTags: string[];
    priorityServices: ProposalV5Stated<string[]>;
  };
  selectedPackage: ProposalV5Package;
  commercial: {
    monthlyFeeCents: number | null;
    setupFeeCents: number | null;
    mediaSpend: ProposalV5Stated<number>;
    vatStatus: string | null;
    mediaSpendRule: string | null;
    billingFrequency: PackageBillingFrequency | null;
    minimumTermMonths: number | null;
    noticePeriodDays: number | null;
    proposedStartDate: string | null;
    expiresAt: string | null;
  };
  discovery: {
    source: string | null;
    customerWording: ProposalV5Stated<string>;
    goal: ProposalV5Stated<string>;
    whyNow: ProposalV5Stated<string>;
    workingDiagnosis: ProposalV5Stated<string>;
    currentSystems: ProposalV5Stated<string>;
  };
  journey: {
    stages: string[];
    activeConstraint: ProposalV5Stated<string>;
    diagnosedLeaks: ProposalV5Stated<string[]>;
    demandQuestion: string;
    progressionQuestion: string;
    postBookingContinuation: string;
    clinicalBoundary: string;
  };
  operatingRhythm: {
    morning: string;
    weekly: string;
    monthly: string;
    beforeSpend: string;
  };
  economics: {
    economicUnit: ProposalV5Stated<string>;
    contribution: ProposalV5Stated<number>;
    contributionEvidenceSourceDate: string | null;
    capacity: ProposalV5Stated<number>;
    selectedMediaSpend: ProposalV5Stated<number>;
    recurringBreakEvenUnits: number | null;
    firstMonthBreakEvenUnits: number | null;
  };
  readiness: {
    breakEven: {
      canDisplayValues: boolean;
      state: ProposalDataState;
      missingFields: string[];
    };
  };
  narrative: {
    partnerProposition: {
      eyebrow: string;
      headline: string;
      lede: string;
      founderLabel: string;
      videoCtaLabel: string;
      credentialStatement: string;
      footerNote: string;
    };
    systemsFit: {
      eyebrow: string;
      headline: string;
      lede: string;
      panels: [ProposalV5NarrativePanel, ProposalV5NarrativePanel, ProposalV5NarrativePanel];
      imageCaption: string;
      closeStatement: string;
      footerNote: string;
    };
    osCapability: {
      eyebrow: string;
      headline: string;
      lede: string;
      availableTitle: string;
      availableItems: string[];
      dependentTitle: string;
      dependentItems: string[];
      capabilities: ProposalV5NarrativePoint[];
      closeStatement: string;
      footerNote: string;
    };
    implementation: {
      eyebrow: string;
      headline: string;
      lede: string;
      checkpoints: ProposalV5ImplementationCheckpoint[];
      imageCaption: string;
      decisionTitle: string;
      decisionText: string;
      footerNote: string;
    };
    responsibilities: ProposalV5ResponsibilityNarrative;
  };
  kpis: Array<{
    name: string;
    baseline: ProposalV5Stated<string>;
    cadence: string | null;
    source: string | null;
  }>;
  scope: ProposalV5ScopeLine[];
  proof: ProposalV5ProofAsset[];
  assets: {
    sectorImages: Record<ProposalV5ImageSlot, ProposalV5Image>;
    osScreens: ProposalV5Image[];
    founderVideoThumbnail: ProposalV5Image | null;
    postBookingScreenshot: ProposalV5Image | null;
    implementationImage: ProposalV5Image | null;
  };
  links: {
    onlineProposalUrl: string | null;
    acceptUrl: string | null;
    questionUrl: string | null;
    videoUrl: string | null;
    videoThumbnailUrl: string | null;
  };
  acceptance: {
    canAccept: boolean;
    lockedSnapshotHash: string | null;
  };
}

// Public V5 snapshots deliberately separate render-safe proposal data from the
// internal frozen integrity record stored on the proposal.
export type ProposalV5PublicImage = Omit<ProposalV5Image, "imageId"> & {
  imageId?: never;
};

export type ProposalV5PublicPackage = Omit<ProposalV5Package, "id" | "catalogueVersion"> & {
  id?: never;
  catalogueVersion?: never;
};

export type ProposalV5PublicProofAsset = Omit<ProposalV5ProofAsset, "id"> & {
  id?: never;
};

export type ProposalV5PublicSnapshot = Omit<
  ProposalV5Snapshot,
  "snapshotHash" | "sourceProposalVersion" | "template" | "selectedPackage" | "proof" | "assets" | "acceptance"
> & {
  snapshotHash?: never;
  sourceProposalVersion?: never;
  template?: never;
  selectedPackage: ProposalV5PublicPackage;
  proof: ProposalV5PublicProofAsset[];
  assets: {
    sectorImages: Record<ProposalV5ImageSlot, ProposalV5PublicImage>;
    osScreens: ProposalV5PublicImage[];
    founderVideoThumbnail: ProposalV5PublicImage | null;
    postBookingScreenshot: ProposalV5PublicImage | null;
    implementationImage: ProposalV5PublicImage | null;
  };
  acceptance: Omit<ProposalV5Snapshot["acceptance"], "lockedSnapshotHash"> & {
    lockedSnapshotHash?: never;
  };
};

export interface ProposalLinkAccess {
  canManageAllClientAccounts: boolean;
}

export interface ProposalMutationDTO {
  contactId?: string | null;
  dealId?: string | null;
  clientAccountProfileId?: string | null;
  proposalName?: string | null;
  templateKey?: string | null;
  templateId?: string | null;
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
  startDate?: string | Date | null;
  followUpAt?: string | Date | null;
  readyAt?: string | Date | null;
  sentAt?: string | Date | null;
  viewedAt?: string | Date | null;
  acceptedAt?: string | Date | null;
  acceptedReason?: string | null;
  acceptedByName?: string | null;
  acceptedByEmail?: string | null;
  legalCompanyName?: string | null;
  billingEmail?: string | null;
  preferredStartDate?: string | Date | null;
  agreementAccepted?: boolean | null;
  confirmationText?: string | null;
  acceptanceSource?: string | null;
  acceptedIpAddress?: string | null;
  acceptedUserAgent?: string | null;
  evidenceSha256?: string | null;
  paymentTerms?: string | null;
  wonAt?: string | Date | null;
  wonReason?: string | null;
  lostAt?: string | Date | null;
  lostReason?: string | null;
  objectionType?: string | null;
  expiresAt?: string | Date | null;
  proposalUrl?: string | null;
  notes?: string | null;
  addOns?: ProposalCommercialItem[] | null;
  discounts?: ProposalCommercialItem[] | null;
  internalMarginNote?: string | null;
  sectionContent?: ProposalSectionContent | null;
}

export interface ProposalSendDTO {
  recipientEmail?: string | null;
  recipientName?: string | null;
  sendMethod?: "manual_email" | "gmail" | "brevo" | "whatsapp" | "phone" | "other" | string | null;
  sendNote?: string | null;
}

export interface ProposalStatusUpdateDTO {
  status: Extract<ProposalStatus, "follow_up_due" | "accepted" | "won" | "lost">;
  followUpAt?: string | Date | null;
  reason?: string | null;
  objectionType?: string | null;
  acceptedByName?: string | null;
  acceptedByEmail?: string | null;
  acceptedAt?: string | Date | null;
  legalCompanyName?: string | null;
  billingEmail?: string | null;
  preferredStartDate?: string | Date | null;
  agreementAccepted?: boolean | null;
  confirmationText?: string | null;
  acceptanceSource?: string | null;
  acceptedIpAddress?: string | null;
  acceptedUserAgent?: string | null;
  evidenceSha256?: string | null;
  paymentTerms?: string | null;
}

export interface ProposalPublicAcceptanceDTO {
  fullName: string;
  email: string;
  legalCompanyName: string;
  billingEmail: string;
  preferredStartDate?: string | Date | null;
  agreementAccepted: boolean;
  signatureConfirmation: string;
}

export interface ProposalListQuery {
  contactId?: string;
  dealId?: string;
  clientAccountProfileId?: string;
  ownerId?: string;
  status?: ProposalStatus | "all";
  followUpDue?: boolean | string;
  includeArchived?: boolean | string;
  search?: string;
  limit?: number | string;
}

export interface ProposalSourceDataQuery {
  contactId?: string;
  dealId?: string;
  clientAccountProfileId?: string;
}

export interface ProposalResponse {
  id: string;
  contactId: string | null;
  dealId: string | null;
  clientAccountProfileId: string | null;
  proposalName: string;
  templateId: string | null;
  templateKey: string;
  templateVersionId: string | null;
  templateVersionNumber: number | null;
  templateContentHash: string | null;
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
  v5Snapshot?: ProposalV5Snapshot | null;
  v5SnapshotHash: string | null;
  v5SnapshotVersion: string | null;
  v5SnapshotFrozenAt: string | null;
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
  v5Snapshot?: ProposalV5Snapshot | null;
  v5SnapshotHash: string | null;
  v5SnapshotVersion: string | null;
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
  introVideoThumbnailUrl?: string | null;
  executiveSummary?: string | null;
  personalIntroduction?: string | null;
  diagnosis?: string | null;
  introVideoUrl?: string | null;
  introVideoTitle?: string | null;
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
  proofAssets?: ProposalProofAssetResponse[];
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

export interface ProposalScopeLibraryQuery {
  search?: string | null;
  category?: string | null;
  status?: ProposalScopeLibraryStatus | "all" | null;
  templateKey?: string | null;
  page?: string | number | null;
  limit?: string | number | null;
}

export interface ProposalScopeLibraryItemResponse extends ProposalScopeItem {
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

export interface ProposalScopeLibraryListResponse {
  items: ProposalScopeLibraryItemResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProposalScopeLibraryItemMutationDTO {
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

export interface ProposalTemplateResponse {
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

export interface ProposalTemplateVersionResponse extends ProposalTemplateVersionSummary {
  content: ProposalTemplateContent;
}

export interface ProposalTemplateMutationDTO {
  templateKey?: string | null;
  name?: string | null;
  description?: string | null;
  content?: ProposalTemplateContent | null;
  changeSummary?: string | null;
}

export interface ProposalTemplateVersionMutationDTO {
  content?: ProposalTemplateContent | null;
  expectedContentHash?: string | null;
  changeSummary?: string | null;
}

export interface ProposalTemplateRejectDTO {
  reason?: string | null;
}

export interface ProposalTemplateRollbackDTO {
  sourceVersionId?: string | null;
  reason?: string | null;
}

export interface ProposalTemplateVersionDiff {
  path: string;
  before: unknown;
  after: unknown;
  changed: boolean;
}

export interface ProposalTemplateVersionCompareResponse {
  fromVersion: ProposalTemplateVersionSummary;
  toVersion: ProposalTemplateVersionSummary;
  diffs: ProposalTemplateVersionDiff[];
}

export interface ProposalProofAssetMutationDTO {
  type: ProposalProofAssetType;
  title: string;
  copy: string;
  mediaUrl?: string | null;
  sectorTags?: string[] | null;
  sortOrder?: number | null;
  isActive?: boolean;
}

export interface ProposalProofAssetResponse {
  id: string;
  type: ProposalProofAssetType;
  title: string;
  copy: string;
  mediaUrl: string | null;
  sectorTags: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalShareResponse {
  proposalId: string;
  proposalUrl: string;
  createdAt: string;
}

export interface ProposalPublicResponse {
  proposalName: string;
  templateKey: string;
  packageName: string | null;
  valueCents: number | null;
  monthlyFeeCents: number | null;
  setupFeeCents: number | null;
  currency: string;
  adSpendNote: string | null;
  vatStatus: string | null;
  minimumTermMonths: number | null;
  noticePeriodDays: number | null;
  startDate: string | null;
  expiresAt: string | null;
  addOns: ProposalCommercialItem[];
  discounts: ProposalCommercialItem[];
  sectionContent: ProposalSectionContent | null;
  coreData: ProposalCoreData | null;
  v5Snapshot?: ProposalV5PublicSnapshot | null;
  v5SnapshotSchemaVersion?: ProposalV5SchemaVersion | null;
  contactName: string | null;
  accountName: string | null;
  clientAccountName: string | null;
}

export interface ProposalPublicPackageResponse {
  name: string;
  priceCents: number | null;
  setupFeeCents: number | null;
  currency: string;
  billingFrequency: string | null;
  includedFeatures: string[];
  proposalWording: string | null;
}

export interface ProposalPublicPreviewResponse {
  proposal: ProposalPublicResponse;
  packageRecord: ProposalPublicPackageResponse | null;
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

export type ProposalPublicEventType =
  | "section_viewed"
  | "video_opened"
  | "pdf_download_clicked"
  | "acceptance_cta_clicked"
  | "question_clicked"
  | "book_call_clicked";

export interface ProposalPublicEventDTO {
  eventType?: ProposalPublicEventType | null;
  sectionKey?: string | null;
}

export interface ProposalSourceDataResponse {
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

export interface ProposalClientReadinessResponse {
  proposalId: string;
  ready: boolean;
  status: ProposalStatus;
  frozen: boolean;
  canRenderV5: boolean;
  pageCount: number | null;
  packageId: string | null;
  issues: string[];
}

export interface ProposalRenderResponse {
  proposal: ProposalResponse;
  v5Snapshot: ProposalV5Snapshot | null;
  frozen: boolean;
  validation: ProposalClientReadinessResponse;
}
