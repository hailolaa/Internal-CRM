import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { getV19ReferenceMissingFields, renderV19ReferencePage } from "./v19ReferenceLayout";

export function getV5Page02MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  return getV19ReferenceMissingFields(snapshot);
}

export function V5Page02Recommendation({ snapshot }: ProposalV5RendererProps) {
  return renderV19ReferencePage(snapshot, 2);
}
