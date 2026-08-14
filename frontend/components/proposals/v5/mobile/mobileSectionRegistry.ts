import type { ProposalV5PageId } from "../data/proposalV5Types";

export type ProposalV5MobileSectionId =
  | "mobile-page-01"
  | "mobile-page-02"
  | "mobile-page-03"
  | "mobile-page-04"
  | "mobile-page-05"
  | "mobile-page-06"
  | "mobile-page-07"
  | "mobile-page-08"
  | "mobile-page-09"
  | "mobile-page-10"
  | "mobile-page-11"
  | "mobile-page-12"
  | "mobile-page-13"
  | "mobile-page-14"
  | "mobile-page-15";

export interface ProposalV5MobileSectionRegistration {
  id: ProposalV5MobileSectionId;
  label: string;
  pageIds: ProposalV5PageId[];
}

export const proposalV5MobileSections = [
  { id: "mobile-page-01", label: "Cover", pageIds: ["V5Page01Cover"] },
  { id: "mobile-page-02", label: "Recommendation", pageIds: ["V5Page02Recommendation"] },
  { id: "mobile-page-03", label: "Commercial case", pageIds: ["V5Page03GoogleMediaRoas"] },
  { id: "mobile-page-04", label: "Growth engine", pageIds: ["V5Page04GrowthEngine"] },
  { id: "mobile-page-05", label: "Google Ads", pageIds: ["V5Page05GoogleAds"] },
  { id: "mobile-page-06", label: "Landing conversion", pageIds: ["V5Page06LandingConversion"] },
  { id: "mobile-page-07", label: "SEO, GBP and website", pageIds: ["V5Page07SeoGbpWebsite"] },
  { id: "mobile-page-08", label: "Tracking and optimisation", pageIds: ["V5Page08TrackingOptimisation"] },
  { id: "mobile-page-09", label: "Roadmap", pageIds: ["V5Page09Roadmap"] },
  { id: "mobile-page-10", label: "Management scope", pageIds: ["V5Page10ManagementScope"] },
  { id: "mobile-page-11", label: "Proof", pageIds: ["V5Page11PublishedProof"] },
  { id: "mobile-page-12", label: "Why ClinicGrower", pageIds: ["V5Page12WhyClinicGrower"] },
  { id: "mobile-page-13", label: "Investment", pageIds: ["V5Page13PartnershipInvestment"] },
  { id: "mobile-page-14", label: "Billing terms", pageIds: ["V5Page14BillingTerms"] },
  { id: "mobile-page-15", label: "Decision", pageIds: ["V5Page15Decision"] },
] as const satisfies readonly ProposalV5MobileSectionRegistration[];

export const proposalV5MobilePageIds = proposalV5MobileSections.flatMap((section) => section.pageIds);
