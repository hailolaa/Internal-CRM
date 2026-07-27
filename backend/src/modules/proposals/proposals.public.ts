import {
  proposalPublicStatuses,
  type ProposalPublicPackageResponse,
  type ProposalPublicResponse,
  type ProposalPublicStatus,
  type ProposalResponse,
  type ProposalStatus,
} from "./proposals.types.js";

export const proposalViewTransitionStatuses = [
  "ready",
  "sent",
  "follow_up_due",
] as const satisfies readonly ProposalStatus[];

export function isProposalPublicStatus(status: ProposalStatus): status is ProposalPublicStatus {
  return proposalPublicStatuses.includes(status as ProposalPublicStatus);
}

export function isProposalPubliclyVisible(
  status: ProposalStatus,
  expiresAt: string | Date | null | undefined,
  now = new Date(),
) {
  if (!isProposalPublicStatus(status)) return false;
  if (!expiresAt) return true;

  const expiryTime = new Date(expiresAt).getTime();
  return Number.isFinite(expiryTime) && expiryTime > now.getTime();
}

export function mapProposalPublicResponse(proposal: ProposalResponse): ProposalPublicResponse {
  if (!isProposalPublicStatus(proposal.status)) {
    throw new Error(`Proposal status ${proposal.status} is not public`);
  }

  return {
    proposalName: proposal.proposalName,
    templateKey: proposal.templateKey,
    packageName: proposal.packageName,
    valueCents: proposal.valueCents,
    monthlyFeeCents: proposal.monthlyFeeCents,
    setupFeeCents: proposal.setupFeeCents,
    currency: proposal.currency,
    adSpendNote: proposal.adSpendNote,
    vatStatus: proposal.vatStatus,
    minimumTermMonths: proposal.minimumTermMonths,
    noticePeriodDays: proposal.noticePeriodDays,
    startDate: proposal.startDate,
    expiresAt: proposal.expiresAt,
    addOns: proposal.addOns,
    discounts: proposal.discounts,
    sectionContent: proposal.sectionContent,
    contactName: proposal.contactName,
    accountName: proposal.accountName,
    clientAccountName: proposal.clientAccountName,
  };
}

export function mapProposalPublicPackage(
  packageRecord: ProposalPublicPackageResponse | null,
): ProposalPublicPackageResponse | null {
  if (!packageRecord) return null;

  return {
    name: packageRecord.name,
    priceCents: packageRecord.priceCents,
    setupFeeCents: packageRecord.setupFeeCents,
    currency: packageRecord.currency,
    billingFrequency: packageRecord.billingFrequency,
    includedFeatures: packageRecord.includedFeatures,
    proposalWording: packageRecord.proposalWording,
  };
}

export function buildProposalPublicUrl(frontendUrl: string, token: string) {
  return `${frontendUrl.replace(/\/+$/, "")}/proposals/shared/?token=${encodeURIComponent(token)}`;
}
