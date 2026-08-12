import { proposalV5Tokens } from "../design/proposalV5Tokens";
import type { ProposalV5PageComponent, ProposalV5PageRegistration } from "../data/proposalV5Types";
import { proposalV5PageOrder } from "./pageOrder";
import { V5Page01Cover } from "./V5Page01Cover";
import { V5Page02EvidenceQuestions } from "./V5Page02EvidenceQuestions";
import { V5Page03EvidenceTrail } from "./V5Page03EvidenceTrail";
import { V5Page04CommercialDiagnosis } from "./V5Page04CommercialDiagnosis";
import { V5Page05PartnerProposition } from "./V5Page05PartnerProposition";
import { V5Page06SystemsFit } from "./V5Page06SystemsFit";
import { V5Page07DemandProgression } from "./V5Page07DemandProgression";
import { V5Page08ResponseOwnership } from "./V5Page08ResponseOwnership";
import { V5Page09PostBooking } from "./V5Page09PostBooking";
import { V5Page10CommercialAccountability } from "./V5Page10CommercialAccountability";
import { V5Page11OSCapability } from "./V5Page11OSCapability";
import { V5Page12BreakEven } from "./V5Page12BreakEven";
import { V5Page13Implementation } from "./V5Page13Implementation";
import { V5Page14OperatingRhythm } from "./V5Page14OperatingRhythm";
import { V5Page15ScopeMatrix } from "./V5Page15ScopeMatrix";
import { V5Page16Responsibilities } from "./V5Page16Responsibilities";
import { V5Page17Proof } from "./V5Page17Proof";
import { V5Page18Investment } from "./V5Page18Investment";
import { V5Page19Close } from "./V5Page19Close";

export interface ProposalV5RegisteredPage extends ProposalV5PageRegistration {
  Component: ProposalV5PageComponent;
}

export const proposalV5PageRegistry = [
  { ...proposalV5PageOrder[0], Component: V5Page01Cover },
  { ...proposalV5PageOrder[1], Component: V5Page02EvidenceQuestions },
  { ...proposalV5PageOrder[2], Component: V5Page03EvidenceTrail },
  { ...proposalV5PageOrder[3], Component: V5Page04CommercialDiagnosis },
  { ...proposalV5PageOrder[4], Component: V5Page05PartnerProposition },
  { ...proposalV5PageOrder[5], Component: V5Page06SystemsFit },
  { ...proposalV5PageOrder[6], Component: V5Page07DemandProgression },
  { ...proposalV5PageOrder[7], Component: V5Page08ResponseOwnership },
  { ...proposalV5PageOrder[8], Component: V5Page09PostBooking },
  { ...proposalV5PageOrder[9], Component: V5Page10CommercialAccountability },
  { ...proposalV5PageOrder[10], Component: V5Page11OSCapability },
  { ...proposalV5PageOrder[11], Component: V5Page12BreakEven },
  { ...proposalV5PageOrder[12], Component: V5Page13Implementation },
  { ...proposalV5PageOrder[13], Component: V5Page14OperatingRhythm },
  { ...proposalV5PageOrder[14], Component: V5Page15ScopeMatrix },
  { ...proposalV5PageOrder[15], Component: V5Page16Responsibilities },
  { ...proposalV5PageOrder[16], Component: V5Page17Proof },
  { ...proposalV5PageOrder[17], Component: V5Page18Investment },
  { ...proposalV5PageOrder[18], Component: V5Page19Close },
] as const satisfies readonly ProposalV5RegisteredPage[];

export function validateProposalV5PageRegistry(pages: readonly ProposalV5RegisteredPage[] = proposalV5PageRegistry) {
  if (pages.length !== 19) {
    throw new Error(`Proposal V5 renderer must register exactly 19 pages; received ${pages.length}.`);
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
