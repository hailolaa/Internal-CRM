import type { ProposalV5PageId, ProposalV5PageRegistration } from "../data/proposalV5Types";

export const proposalV5PageOrder = [
  { id: "V5Page01Cover", pageNumber: 1, theme: "dark" },
  { id: "V5Page02EvidenceQuestions", pageNumber: 2, theme: "light" },
  { id: "V5Page03EvidenceTrail", pageNumber: 3, theme: "dark" },
  { id: "V5Page04CommercialDiagnosis", pageNumber: 4, theme: "light" },
  { id: "V5Page05PartnerProposition", pageNumber: 5, theme: "dark" },
  { id: "V5Page06SystemsFit", pageNumber: 6, theme: "light" },
  { id: "V5Page07DemandProgression", pageNumber: 7, theme: "light" },
  { id: "V5Page08ResponseOwnership", pageNumber: 8, theme: "dark" },
  { id: "V5Page09PostBooking", pageNumber: 9, theme: "light" },
  { id: "V5Page10CommercialAccountability", pageNumber: 10, theme: "light" },
  { id: "V5Page11OSCapability", pageNumber: 11, theme: "dark" },
  { id: "V5Page12BreakEven", pageNumber: 12, theme: "light" },
  { id: "V5Page13Implementation", pageNumber: 13, theme: "light" },
  { id: "V5Page14OperatingRhythm", pageNumber: 14, theme: "light" },
  { id: "V5Page15ScopeMatrix", pageNumber: 15, theme: "light" },
  { id: "V5Page16Responsibilities", pageNumber: 16, theme: "light" },
  { id: "V5Page17Proof", pageNumber: 17, theme: "light" },
  { id: "V5Page18Investment", pageNumber: 18, theme: "dark" },
  { id: "V5Page19Close", pageNumber: 19, theme: "dark" },
] as const satisfies readonly ProposalV5PageRegistration[];

export const proposalV5PageIds = proposalV5PageOrder.map((page) => page.id) as ProposalV5PageId[];
