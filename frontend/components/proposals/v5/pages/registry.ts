import { proposalV5Tokens } from "../design/proposalV5Tokens";
import type { ProposalV5PageComponent, ProposalV5PageRegistration } from "../data/proposalV5Types";
import { proposalV5PageOrder } from "./pageOrder";
import { V5Page01Cover } from "./V5Page01Cover";
import { V5Page02Recommendation } from "./V5Page02Recommendation";
import { V5Page03GoogleMediaRoas } from "./V5Page03GoogleMediaRoas";
import { V5Page04GrowthEngine } from "./V5Page04GrowthEngine";
import { V5Page05GoogleAds } from "./V5Page05GoogleAds";
import { V5Page06LandingConversion } from "./V5Page06LandingConversion";
import { V5Page07SeoGbpWebsite } from "./V5Page07SeoGbpWebsite";
import { V5Page08TrackingOptimisation } from "./V5Page08TrackingOptimisation";
import { V5Page09Roadmap } from "./V5Page09Roadmap";
import { V5Page10ManagementScope } from "./V5Page10ManagementScope";
import { V5Page11PublishedProof } from "./V5Page11PublishedProof";
import { V5Page12WhyClinicGrower } from "./V5Page12WhyClinicGrower";
import { V5Page13PartnershipInvestment } from "./V5Page13PartnershipInvestment";
import { V5Page14BillingTerms } from "./V5Page14BillingTerms";
import { V5Page15Decision } from "./V5Page15Decision";

export interface ProposalV5RegisteredPage extends ProposalV5PageRegistration {
  Component: ProposalV5PageComponent;
}

export const proposalV5PageRegistry = [
  { ...proposalV5PageOrder[0], Component: V5Page01Cover },
  { ...proposalV5PageOrder[1], Component: V5Page02Recommendation },
  { ...proposalV5PageOrder[2], Component: V5Page03GoogleMediaRoas },
  { ...proposalV5PageOrder[3], Component: V5Page04GrowthEngine },
  { ...proposalV5PageOrder[4], Component: V5Page05GoogleAds },
  { ...proposalV5PageOrder[5], Component: V5Page06LandingConversion },
  { ...proposalV5PageOrder[6], Component: V5Page07SeoGbpWebsite },
  { ...proposalV5PageOrder[7], Component: V5Page08TrackingOptimisation },
  { ...proposalV5PageOrder[8], Component: V5Page09Roadmap },
  { ...proposalV5PageOrder[9], Component: V5Page10ManagementScope },
  { ...proposalV5PageOrder[10], Component: V5Page11PublishedProof },
  { ...proposalV5PageOrder[11], Component: V5Page12WhyClinicGrower },
  { ...proposalV5PageOrder[12], Component: V5Page13PartnershipInvestment },
  { ...proposalV5PageOrder[13], Component: V5Page14BillingTerms },
  { ...proposalV5PageOrder[14], Component: V5Page15Decision },
] as const satisfies readonly ProposalV5RegisteredPage[];

export function validateProposalV5PageRegistry(pages: readonly ProposalV5RegisteredPage[] = proposalV5PageRegistry) {
  if (pages.length !== 15) {
    throw new Error(`Proposal V5 renderer must register exactly 15 pages; received ${pages.length}.`);
  }

  const ids = new Set<string>();
  const numbers = new Set<number>();
  const darkPages: number[] = [];

  pages.forEach((page, index) => {
    const expected = proposalV5PageOrder[index];
    if (!expected || page.id !== expected.id) {
      throw new Error(`Proposal V5 page order mismatch at index ${index}.`);
    }
    if (page.pageNumber !== index + 1 || page.pageNumber !== expected.pageNumber) {
      throw new Error(`Proposal V5 page number mismatch for ${page.id}.`);
    }
    if (page.theme !== expected.theme) {
      throw new Error(`Proposal V5 page theme mismatch for ${page.id}.`);
    }
    if (ids.has(page.id)) {
      throw new Error(`Proposal V5 page id is duplicated: ${page.id}.`);
    }
    if (numbers.has(page.pageNumber)) {
      throw new Error(`Proposal V5 page number is duplicated: ${page.pageNumber}.`);
    }
    ids.add(page.id);
    numbers.add(page.pageNumber);
    if (page.theme === "dark") darkPages.push(page.pageNumber);
  });

  if (darkPages.join(",") !== proposalV5Tokens.darkPages.join(",")) {
    throw new Error("Proposal V5 dark page rhythm does not match the approved sequence.");
  }
}
