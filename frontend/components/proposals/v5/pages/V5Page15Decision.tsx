import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { getV19ReferenceMissingFields, renderV19ReferencePage } from "./v19ReferenceLayout";

export function getV5Page15MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  return [
    ...getV19ReferenceMissingFields(snapshot),
    ...(!snapshot?.links?.acceptUrl && !snapshot?.links?.onlineProposalUrl ? ["links.acceptUrl"] : []),
  ];
}

export function V5Page15Decision({ snapshot }: ProposalV5RendererProps) {
  return renderV19ReferencePage(snapshot, 15);
}
