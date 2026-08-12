import type { ProposalV5RenderableRendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5PageRegistry, validateProposalV5PageRegistry } from "../pages/registry";
import { isProposalV5RenderableSnapshot } from "../renderer/ProposalV5Renderer";

export function ProposalV5PrintRenderer({ snapshot }: ProposalV5RenderableRendererProps) {
  if (!isProposalV5RenderableSnapshot(snapshot)) {
    throw new Error("ProposalV5PrintRenderer requires ProposalV5Snapshot or ProposalV5PublicSnapshot. Use the frozen V5 snapshot for sent proposals.");
  }

  validateProposalV5PageRegistry();
  const renderSnapshot = snapshot as ProposalV5Snapshot;

  return (
    <article
      aria-label={`Printable ClinicGrower V5 proposal for ${renderSnapshot.clinic.name.value || "clinic"}`}
      className="proposal-v5-print-root"
      data-v5-print-page-count={renderSnapshot.pageCount}
    >
      {proposalV5PageRegistry.map((page) => (
        <page.Component key={page.id} snapshot={renderSnapshot} />
      ))}
    </article>
  );
}
