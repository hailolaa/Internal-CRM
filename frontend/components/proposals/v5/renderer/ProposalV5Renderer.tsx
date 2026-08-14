import type { ProposalV5PublicSnapshot, ProposalV5RenderableRendererProps, ProposalV5RenderableSnapshot, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5PageRegistry, validateProposalV5PageRegistry } from "../pages/registry";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasV5PageContract(candidate: Partial<ProposalV5RenderableSnapshot>) {
  return (
    candidate.schemaVersion === "proposal_v5" &&
    candidate.pageCount === 15 &&
    Array.isArray(candidate.pages) &&
    candidate.pages.length === 15 &&
    typeof candidate.generatedAt === "string" &&
    typeof candidate.proposal?.reference === "string" &&
    candidate.proposal.reference.trim().length > 0
  );
}

export function isProposalV5Snapshot(value: unknown): value is ProposalV5Snapshot {
  if (!isObjectRecord(value)) return false;
  const candidate = value as Partial<ProposalV5Snapshot>;
  return (
    hasV5PageContract(candidate) &&
    typeof candidate.sourceProposalVersion === "string" &&
    typeof candidate.snapshotHash === "string"
  );
}

function recordHasKey(value: unknown, key: string) {
  return isObjectRecord(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function publicImagesHaveNoIds(images: unknown) {
  if (!images) return true;
  if (Array.isArray(images)) return images.every((image) => !recordHasKey(image, "imageId"));
  if (isObjectRecord(images)) return Object.values(images).every((image) => !recordHasKey(image, "imageId"));
  return false;
}

export function isProposalV5PublicSnapshot(value: unknown): value is ProposalV5PublicSnapshot {
  if (!isObjectRecord(value)) return false;
  const candidate = value as Partial<ProposalV5PublicSnapshot> & Record<string, unknown>;
  if (!hasV5PageContract(candidate)) return false;
  if (recordHasKey(candidate, "snapshotHash") || recordHasKey(candidate, "sourceProposalVersion")) return false;
  if (recordHasKey(candidate.selectedPackage, "id") || recordHasKey(candidate.selectedPackage, "catalogueVersion")) return false;
  if (Array.isArray(candidate.proof) && candidate.proof.some((asset) => recordHasKey(asset, "id"))) return false;
  if (isObjectRecord(candidate.assets)) {
    if (!publicImagesHaveNoIds(candidate.assets.sectorImages)) return false;
    if (!publicImagesHaveNoIds(candidate.assets.osScreens)) return false;
    if (recordHasKey(candidate.assets.founderVideoThumbnail, "imageId")) return false;
    if (recordHasKey(candidate.assets.postBookingScreenshot, "imageId")) return false;
    if (recordHasKey(candidate.assets.implementationImage, "imageId")) return false;
  }
  if (recordHasKey(candidate.acceptance, "lockedSnapshotHash")) return false;
  return true;
}

export function isProposalV5RenderableSnapshot(value: unknown): value is ProposalV5RenderableSnapshot {
  return isProposalV5Snapshot(value) || isProposalV5PublicSnapshot(value);
}

export function ProposalV5Renderer({ snapshot }: ProposalV5RenderableRendererProps) {
  if (!isProposalV5RenderableSnapshot(snapshot)) {
    throw new Error("ProposalV5Renderer requires ProposalV5Snapshot or ProposalV5PublicSnapshot. Build or sanitize the V5 snapshot before rendering.");
  }

  validateProposalV5PageRegistry();
  const renderSnapshot = snapshot as ProposalV5Snapshot;

  return (
    <article className="proposal-v5-renderer" style={{ display: "grid", gap: 0 }}>
      {proposalV5PageRegistry.map((page) => (
        <page.Component key={page.id} snapshot={renderSnapshot} />
      ))}
    </article>
  );
}
