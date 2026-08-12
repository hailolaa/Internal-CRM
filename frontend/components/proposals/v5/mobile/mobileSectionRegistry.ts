import type { ProposalV5PageId } from "../data/proposalV5Types";

export type ProposalV5MobileSectionId =
  | "mobile-cover"
  | "mobile-evidence"
  | "mobile-partner"
  | "mobile-operating-system"
  | "mobile-economics"
  | "mobile-implementation"
  | "mobile-scope"
  | "mobile-responsibilities"
  | "mobile-proof"
  | "mobile-investment"
  | "mobile-close";

export interface ProposalV5MobileSectionRegistration {
  id: ProposalV5MobileSectionId;
  label: string;
  pageIds: ProposalV5PageId[];
}

export const proposalV5MobileSections = [
  { id: "mobile-cover", label: "Cover", pageIds: ["V5Page01Cover"] },
  {
    id: "mobile-evidence",
    label: "Evidence and diagnosis",
    pageIds: ["V5Page02EvidenceQuestions", "V5Page03EvidenceTrail", "V5Page04CommercialDiagnosis"],
  },
  { id: "mobile-partner", label: "Partner proposition", pageIds: ["V5Page05PartnerProposition"] },
  {
    id: "mobile-operating-system",
    label: "Operating system and journey",
    pageIds: [
      "V5Page06SystemsFit",
      "V5Page07DemandProgression",
      "V5Page08ResponseOwnership",
      "V5Page09PostBooking",
      "V5Page10CommercialAccountability",
      "V5Page11OSCapability",
    ],
  },
  { id: "mobile-economics", label: "Economics", pageIds: ["V5Page12BreakEven"] },
  {
    id: "mobile-implementation",
    label: "Implementation and rhythm",
    pageIds: ["V5Page13Implementation", "V5Page14OperatingRhythm"],
  },
  { id: "mobile-scope", label: "Scope", pageIds: ["V5Page15ScopeMatrix"] },
  { id: "mobile-responsibilities", label: "Responsibilities", pageIds: ["V5Page16Responsibilities"] },
  { id: "mobile-proof", label: "Proof", pageIds: ["V5Page17Proof"] },
  { id: "mobile-investment", label: "Investment", pageIds: ["V5Page18Investment"] },
  { id: "mobile-close", label: "Close", pageIds: ["V5Page19Close"] },
] as const satisfies readonly ProposalV5MobileSectionRegistration[];

export const proposalV5MobilePageIds = proposalV5MobileSections.flatMap((section) => section.pageIds);
