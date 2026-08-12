import {
  proposalPublicStatuses,
  type ProposalPublicPackageResponse,
  type ProposalPublicResponse,
  type ProposalPublicStatus,
  type ProposalResponse,
  type ProposalStatus,
} from "./proposals.types.js";
import { assertProposalV5SnapshotReady, sanitizeProposalV5SnapshotForPublic } from "./proposal-v5-snapshot.js";
import { ApiError } from "../../utils/ApiError.js";

export const proposalViewTransitionStatuses = [
  "ready",
  "sent",
  "follow_up_due",
] as const satisfies readonly ProposalStatus[];

const proposalV5PublicFrozenStatuses = [
  "sent",
  "viewed",
  "follow_up_due",
  "accepted",
  "won",
] as const satisfies readonly ProposalStatus[];
const proposalV5PublicFrozenStatusSet = new Set<ProposalStatus>(proposalV5PublicFrozenStatuses);

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

export function resolvePublicProposalV5Snapshot(proposal: ProposalResponse) {
  if (!proposal.v5Snapshot) throw ApiError.notFound("Proposal link not found");

  if (!proposalV5PublicFrozenStatusSet.has(proposal.status)) {
    throw ApiError.notFound("Proposal link not found");
  }

  if (!proposal.v5SnapshotHash || !proposal.v5SnapshotVersion || !proposal.v5SnapshotFrozenAt) {
    throw ApiError.notFound("Proposal link not found");
  }

  try {
    assertProposalV5SnapshotReady(proposal.v5Snapshot);
  } catch {
    throw ApiError.notFound("Proposal link not found");
  }

  if (proposal.v5Snapshot.snapshotHash !== proposal.v5SnapshotHash) {
    throw ApiError.notFound("Proposal link not found");
  }

  return sanitizeProposalV5SnapshotForPublic(proposal.v5Snapshot);
}

export function assertPublicProposalV5Acceptable(proposal: ProposalResponse) {
  resolvePublicProposalV5Snapshot(proposal);
}

export function mapProposalPublicResponse(proposal: ProposalResponse): ProposalPublicResponse {
  if (!isProposalPublicStatus(proposal.status)) {
    throw new Error(`Proposal status ${proposal.status} is not public`);
  }
  const publicV5Snapshot = resolvePublicProposalV5Snapshot(proposal);

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
    sectionContent: null,
    coreData: null,
    v5Snapshot: publicV5Snapshot,
    v5SnapshotSchemaVersion: proposal.v5Snapshot?.schemaVersion || null,
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
  const trimmed = frontendUrl.trim().replace(/\/+$/, "");
  const hasProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed);
  const baseUrl = hasProtocol
    ? trimmed
    : /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(trimmed)
      ? `http://${trimmed}`
      : `https://${trimmed}`;
  return `${baseUrl}/proposals/shared/?token=${encodeURIComponent(token)}`;
}
