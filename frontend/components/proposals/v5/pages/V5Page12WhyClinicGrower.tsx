import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { getV19ReferenceMissingFields, renderV19ReferencePage } from "./v19ReferenceLayout";

export function getV5Page12MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  return [
    ...getV19ReferenceMissingFields(snapshot),
    ...(!snapshot?.assets?.founderVideoThumbnail?.url ? ["assets.founderVideoThumbnail.url"] : []),
  ];
}

export function V5Page12WhyClinicGrower({ snapshot }: ProposalV5RendererProps) {
  return renderV19ReferencePage(snapshot, 12);
}
