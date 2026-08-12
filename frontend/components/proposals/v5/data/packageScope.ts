import type { GrowthPackageRecord } from "@/lib/api-types/packages";
import type { ProposalScopeItem } from "@/lib/api-types/proposals";
import type { ProposalV5ScopeLine } from "./proposalV5Types";

type PackageScopeSource = Partial<ProposalScopeItem & ProposalV5ScopeLine> & {
  sortOrder?: number | string | null;
  clientDescription?: string | null;
  dependencies?: string | null;
  clientResponsibilities?: string | null;
  exclusions?: string | null;
};

function cleanString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function normalizeInclusionStatus(value: unknown): ProposalV5ScopeLine["inclusionStatus"] {
  return value === "included" || value === "excluded" ? value : null;
}

function normalizeDeliveryType(value: unknown): ProposalV5ScopeLine["deliveryType"] {
  return value === "recurring" || value === "one_off" ? value : null;
}

function normalizeApprovalStatus(value: unknown): ProposalV5ScopeLine["approvalStatus"] {
  if (value === "not_required" || value === "pending" || value === "approved" || value === "rejected") return value;
  return null;
}

function scopeSortOrder(item: PackageScopeSource) {
  const parsed = Number(item.sortOrder);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mapProposalV5ScopeLine(item: PackageScopeSource): ProposalV5ScopeLine {
  return {
    category: cleanString(item.category),
    title: cleanString(item.title),
    description: cleanString(item.description) || cleanString(item.clientDescription),
    quantityLimit: cleanString(item.quantityLimit),
    frequency: cleanString(item.frequency),
    treatmentsAndLocations: cleanString(item.treatmentsAndLocations),
    dependency: cleanString(item.dependency) || cleanString(item.dependencies),
    owner: cleanString(item.owner) || cleanString(item.clientResponsibilities),
    exclusion: cleanString(item.exclusion) || cleanString(item.exclusions),
    thirdPartyCosts: cleanString(item.thirdPartyCosts),
    inclusionStatus: normalizeInclusionStatus(item.inclusionStatus),
    deliveryType: normalizeDeliveryType(item.deliveryType),
    isOptionalAddOn: Boolean(item.isOptionalAddOn),
    approvalStatus: normalizeApprovalStatus(item.approvalStatus),
  };
}

export function getPackageProposalV5Scope(packageRecord: Partial<GrowthPackageRecord> | null | undefined) {
  const notes = packageRecord?.commercialNotes;
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) return [];
  const scopeItems = (notes as { v5ScopeItems?: unknown }).v5ScopeItems;
  if (!Array.isArray(scopeItems)) return [];
  return scopeItems
    .filter((item): item is PackageScopeSource => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    .sort((left, right) => scopeSortOrder(left) - scopeSortOrder(right))
    .map(mapProposalV5ScopeLine)
    .filter((item) => Boolean(item.title));
}

export function resolveProposalV5Scope({
  packageRecord,
  proposalScopeItems,
}: {
  packageRecord: Partial<GrowthPackageRecord> | null | undefined;
  proposalScopeItems: ProposalScopeItem[] | null | undefined;
}) {
  const packageScope = getPackageProposalV5Scope(packageRecord);
  if (packageScope.length) return packageScope;
  return (proposalScopeItems || []).slice().sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0)).map(mapProposalV5ScopeLine);
}
