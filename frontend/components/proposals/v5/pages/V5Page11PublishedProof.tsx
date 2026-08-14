import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { getV19ReferenceMissingFields, renderV19ReferencePage } from "./v19ReferenceLayout";

export function getV5Page11MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  return [
    ...getV19ReferenceMissingFields(snapshot),
    ...(!snapshot?.proof?.length ? ["proof"] : []),
  ];
}

export function V5Page11PublishedProof({ snapshot }: ProposalV5RendererProps) {
  return renderV19ReferencePage(snapshot, 11);
}
