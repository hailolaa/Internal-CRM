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
  currency: string;
  followUpAt: string | null;
  readyAt: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  wonAt: string | null;
  lostAt: string | null;
  expiresAt: string | null;
  proposalUrl: string | null;
  notes: string | null;
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
  currency?: string | null;
  followUpAt?: string | null;
  readyAt?: string | null;
  sentAt?: string | null;
  viewedAt?: string | null;
  acceptedAt?: string | null;
  wonAt?: string | null;
  lostAt?: string | null;
  expiresAt?: string | null;
  proposalUrl?: string | null;
  notes?: string | null;
  sectionContent?: ProposalSectionContent | null;
}
