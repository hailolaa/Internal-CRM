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
}

export interface ProposalSectionContent {
  executiveSummary?: string | null;
  diagnosis?: string | null;
  recommendedPlan?: string | null;
  includedFeatures?: string[];
  timeline?: string | null;
  investmentNotes?: string | null;
  nextSteps?: string | null;
}

export interface ProposalCommercialItem {
  name: string;
  amountCents?: number | null;
  note?: string | null;
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
}

export interface ProposalPublicPreviewRecord {
  proposal: ProposalRecord;
  packageRecord: Pick<
    GrowthPackageRecord,
    "id" | "name" | "priceCents" | "setupFeeCents" | "currency" | "billingFrequency" | "includedFeatures" | "proposalWording"
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
  wonAt?: string | null;
  wonReason?: string | null;
  lostAt?: string | null;
  lostReason?: string | null;
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
