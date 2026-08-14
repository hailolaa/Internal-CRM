import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { getV19ReferenceMissingFields, renderV19ReferencePage } from "./v19ReferenceLayout";

export function getV5Page06MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  return getV19ReferenceMissingFields(snapshot);
}

export function V5Page06LandingConversion({ snapshot }: ProposalV5RendererProps) {
  return renderV19ReferencePage(snapshot, 6);
}
