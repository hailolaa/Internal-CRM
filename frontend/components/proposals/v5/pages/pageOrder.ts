import type { ProposalV5PageId, ProposalV5PageRegistration } from "../data/proposalV5Types";

export const proposalV5PageOrder = [
  { id: "V5Page01Cover", pageNumber: 1, theme: "dark" },
  { id: "V5Page02Recommendation", pageNumber: 2, theme: "light" },
  { id: "V5Page03GoogleMediaRoas", pageNumber: 3, theme: "dark" },
  { id: "V5Page04GrowthEngine", pageNumber: 4, theme: "light" },
  { id: "V5Page05GoogleAds", pageNumber: 5, theme: "light" },
  { id: "V5Page06LandingConversion", pageNumber: 6, theme: "dark" },
  { id: "V5Page07SeoGbpWebsite", pageNumber: 7, theme: "light" },
  { id: "V5Page08TrackingOptimisation", pageNumber: 8, theme: "dark" },
  { id: "V5Page09Roadmap", pageNumber: 9, theme: "light" },
  { id: "V5Page10ManagementScope", pageNumber: 10, theme: "light" },
  { id: "V5Page11PublishedProof", pageNumber: 11, theme: "light" },
  { id: "V5Page12WhyClinicGrower", pageNumber: 12, theme: "dark" },
  { id: "V5Page13PartnershipInvestment", pageNumber: 13, theme: "dark" },
  { id: "V5Page14BillingTerms", pageNumber: 14, theme: "light" },
  { id: "V5Page15Decision", pageNumber: 15, theme: "light" },
] as const satisfies readonly ProposalV5PageRegistration[];

export const proposalV5PageIds = proposalV5PageOrder.map((page) => page.id) as ProposalV5PageId[];
