import type { GrowthPackageRecord, ProposalRecord } from "@/lib/api-types";

export const PROPOSAL_EDITOR_STATUSES = [
  "draft",
  "ready",
  "sent",
  "viewed",
  "follow_up_due",
] as const satisfies readonly ProposalRecord["status"][];

const FINAL_PROPOSAL_STATUSES = [
  "accepted",
  "won",
  "lost",
  "expired",
  "archived",
] as const satisfies readonly ProposalRecord["status"][];

export type ProposalIdentity = Pick<
  ProposalRecord,
  "contactName" | "accountName" | "clientAccountName"
>;

export type ProposalSaveTarget =
  | { mode: "create" }
  | { mode: "update"; proposalId: string };

export type ProposalRequestContext = {
  requestId: number;
  routeKey: string;
};

export function proposalEditorHref(proposalId: string) {
  return `/app/crm/proposals/edit?id=${encodeURIComponent(proposalId)}`;
}

export function proposalIdentityFromRecord(proposal: ProposalRecord): ProposalIdentity {
  return {
    contactName: proposal.contactName || null,
    accountName: proposal.accountName || null,
    clientAccountName: proposal.clientAccountName || null,
  };
}

export function resolveProposalSaveTarget(
  routeProposalId: string,
  loadedProposalId: string,
): ProposalSaveTarget | null {
  if (!routeProposalId) {
    return loadedProposalId ? null : { mode: "create" };
  }

  return routeProposalId === loadedProposalId
    ? { mode: "update", proposalId: routeProposalId }
    : null;
}

export function isFinalProposalStatus(status: ProposalRecord["status"]) {
  return FINAL_PROPOSAL_STATUSES.includes(
    status as (typeof FINAL_PROPOSAL_STATUSES)[number],
  );
}

export function isCurrentProposalRequest(
  current: ProposalRequestContext,
  request: ProposalRequestContext,
) {
  return current.requestId === request.requestId && current.routeKey === request.routeKey;
}

export function proposalRequestRouteKey(pathname: string, searchParams: string) {
  const normalizedPathname = pathname === "/"
    ? pathname
    : pathname.replace(/\/+$/, "");
  const normalizedSearchParams = new URLSearchParams(searchParams).toString();
  return `${normalizedPathname}?${normalizedSearchParams}`;
}

export async function loadOptionalProposalPackages(
  load: () => Promise<GrowthPackageRecord[]>,
) {
  try {
    return await load();
  } catch {
    return [];
  }
}
