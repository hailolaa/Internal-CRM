import type { ReactElement } from "react";
import type { PackageBillingFrequency } from "@/lib/api-types/packages";
import type { ProposalDataState, ProposalProofAssetType, ProposalStatus } from "@/lib/api-types/proposals";

export type ProposalV5SchemaVersion = "proposal_v5";
export type ProposalV5EvidenceState = ProposalDataState;
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

export interface ProposalV5Stated<T> {
  value: T | null;
  state: ProposalV5EvidenceState;
  source: string | null;
  sourceDate: string | null;
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

export interface ClinicTypeVariant {
  id: ProposalV5ClinicTypeId;
  label: string;
  shortLabel: string;
  terminology: {
    patient: string;
    enquiry: string;
    consultation: string;
    economicUnit: string;
  };
  journeyStages: string[];
  painExamples: string[];
  responseExample: string;
  clinicalBoundary: string;
  demandQuestion: string;
  progressionQuestion: string;
  postBookingContinuation: string;
  operatingRhythmMorning: string;
  operatingRhythmMonthly: string;
  proofTags: string[];
  assetPack: Record<ProposalV5ImageSlot, ProposalV5Image>;
  osScreens: ProposalV5Image[];
  founderVideoThumbnail: ProposalV5Image;
  postBookingScreenshot: ProposalV5Image;
  implementationImage: ProposalV5Image;
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
  state: ProposalV5EvidenceState;
  proofMode: string | null;
  proofScope: string | null;
  source: string | null;
  timeframe: string | null;
  disclaimer: string | null;
}

export interface ProposalV5PageRegistration {
  id: ProposalV5PageId;
  pageNumber: number;
  theme: ProposalV5Theme;
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
    economicUnit: string | null;
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
      state: ProposalV5EvidenceState;
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
  "snapshotHash" | "sourceProposalVersion" | "selectedPackage" | "proof" | "assets" | "acceptance"
> & {
  snapshotHash?: never;
  sourceProposalVersion?: never;
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

export type ProposalV5RenderableSnapshot = ProposalV5Snapshot | ProposalV5PublicSnapshot;

export interface ProposalV5RendererProps {
  snapshot: ProposalV5Snapshot;
}

export interface ProposalV5RenderableRendererProps {
  snapshot: ProposalV5RenderableSnapshot;
}

export type ProposalV5PageComponent = (props: ProposalV5RendererProps) => ReactElement;
