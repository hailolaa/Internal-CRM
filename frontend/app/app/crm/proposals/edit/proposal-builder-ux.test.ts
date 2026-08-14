import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  proposalClinicTypeVariants,
  type ProposalClinicTypeVariant,
} from "@/lib/proposal-clinic-variants";
import {
  getFirstIncompleteProposalBuilderStep,
  getProposalBuilderMissingCount,
  getProposalBuilderStepProgress,
  proposalBuilderSteps,
  type ProposalBuilderProgressInput,
} from "./proposal-builder-ux";

function variantTreatmentLines(variant: ProposalClinicTypeVariant) {
  return variant.treatmentExamples
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const completeInput: ProposalBuilderProgressInput = {
  clientLinked: true,
  clinicName: "BristolDent Harbourside",
  contactName: "Alex Morgan",
  proposalReference: "CG-2026-001",
  clinicType: "dental_clinic",
  location: "Private dental practice in Bristol",
  selectedPackageId: "clinic-growth-engine",
  personalIntroduction: "Hi Alex, this is built around the growth issues discussed.",
  discoverySource: "Discovery call on 10 August 2026",
  evidenceConfidenceState: "working_diagnosis",
  primaryGoal: "Increase predictable implant consultations.",
  whyActNow: "The clinic wants clearer evidence before adding more spend.",
  priorityServices: "Dental implants\nInvisalign\nComposite bonding",
  targetArea: "Bristol and surrounding private dentistry catchment.",
  currentPosition: "Demand exists but enquiry handling and tracking are inconsistent.",
  currentMarketing: "Google Ads, GBP and referral activity.",
  capacity: "Two clinicians can support additional consultations.",
  limitations: "Call tracking and booking outcomes are not fully measured.",
  customerWording: "We need to know where the good enquiries are coming from.",
  diagnosis: "Patients are leaking between enquiry, response and booking.",
  workingConstraint: "Response",
  activeConstraintConfidenceState: "working_diagnosis",
  diagnosedLeaks: "Slow response\nUnclear source tracking\nNo booked-outcome tracking",
  biggestRisk: "Slow response and incomplete attribution hide lost revenue.",
  recommendedDirection: "Use ClinicGrower OS to expose leakage and set the first operating rhythm.",
  currentEnquiries: "60",
  bookedPatients: "24",
  currentBookingRate: "40%",
  attendanceRate: "82%",
  consultationToTreatmentConversionRate: "45%",
  treatmentValue: "GBP 3,500",
  marketingSpend: "GBP 3,000",
  economicUnit: "accepted treatment plan",
  confirmedContribution: "GBP 1,200",
  contributionEvidenceSourceDate: "Discovery call on 10 August 2026",
  contributionConfirmationState: "known",
  selectedMediaSpend: "GBP 3,000",
  commercialCapacity: "12 additional consultations per month.",
  commercialEvidenceState: "known",
  currentAcquisitionCost: "GBP 95",
  commercialDataSource: "Discovery call and current media report",
  liveDataStatus: "demo_data",
  knownDataLimitations: "Diary and revenue data are not connected yet.",
  sectorImageProvenance: "ClinicGrower approved V5 sector image pack",
  sectorImageApprovalStatus: "approved",
  adSpendRule: "Advertising spend is paid directly by the client and agreed before launch.",
  proofAssetCount: 2,
  scopeItemCount: 6,
  scopeHasClientDescriptions: true,
  monthlyFee: "1995",
  setupFee: "0",
  vatStatus: "plus_vat",
  minimumTerm: "6",
  noticePeriod: "30",
  startDate: "2026-09-01",
  expiryDate: "2026-09-15T17:00",
  previewReady: true,
  clientUseMissingItems: [],
  savedProposalId: "proposal-001",
};

describe("proposal builder UX workflow", () => {
  it("keeps the agreed nine-step proposal builder order", () => {
    expect(proposalBuilderSteps.map((step) => step.id)).toEqual([
      "client",
      "discovery",
      "diagnosis",
      "economics",
      "proof",
      "scope",
      "investment",
      "review",
      "send",
    ]);
  });

  it("marks a complete proposal workflow ready for review and send", () => {
    const progress = getProposalBuilderStepProgress(completeInput);

    expect(getProposalBuilderMissingCount(progress)).toBe(0);
    expect(getFirstIncompleteProposalBuilderStep(progress)).toBe("send");
    expect(progress.every((step) => step.status === "complete")).toBe(true);
  });

  it("routes users to client setup when CRM link, proposal reference or package are missing", () => {
    const progress = getProposalBuilderStepProgress({
      ...completeInput,
      clientLinked: false,
      proposalReference: "",
      selectedPackageId: "",
    });
    const clientStep = progress.find((step) => step.id === "client");

    expect(getFirstIncompleteProposalBuilderStep(progress)).toBe("client");
    expect(getProposalBuilderMissingCount(progress)).toBe(3);
    expect(clientStep?.missing).toEqual(expect.arrayContaining(["Linked CRM record", "Proposal reference", "Package"]));
  });

  it("requires three separate priority services for the V5 response ownership page", () => {
    const progress = getProposalBuilderStepProgress({
      ...completeInput,
      priorityServices: "Dental implants\nInvisalign",
    });
    const discoveryStep = progress.find((step) => step.id === "discovery");

    expect(discoveryStep?.missing).toContain("At least three different priority services");
    expect(getFirstIncompleteProposalBuilderStep(progress)).toBe("discovery");
  });

  it("does not count repeated priority services as separate V5 services", () => {
    const progress = getProposalBuilderStepProgress({
      ...completeInput,
      priorityServices: "priority treatments\npriority treatments\npriority treatments",
    });
    const discoveryStep = progress.find((step) => step.id === "discovery");

    expect(discoveryStep?.missing).toContain("At least three different priority services");
    expect(getFirstIncompleteProposalBuilderStep(progress)).toBe("discovery");
  });

  it("keeps clinic-type treatment defaults compatible with one-per-line validation", () => {
    for (const variant of proposalClinicTypeVariants) {
      const lines = variantTreatmentLines(variant);

      expect(lines.length, variant.label).toBeGreaterThanOrEqual(3);
      expect(new Set(lines.map((line) => line.toLowerCase())).size, variant.label).toBe(lines.length);
    }
  });

  it("requires three separate diagnosed leaks for the V5 diagnosis page", () => {
    const progress = getProposalBuilderStepProgress({
      ...completeInput,
      diagnosedLeaks: "Slow response\nUnclear source tracking",
    });
    const diagnosisStep = progress.find((step) => step.id === "diagnosis");

    expect(diagnosisStep?.missing).toContain("At least three different diagnosed leaks");
    expect(getFirstIncompleteProposalBuilderStep(progress)).toBe("diagnosis");
  });

  it("keeps commercial fields clear when the V5 snapshot needs a number", () => {
    const progress = getProposalBuilderStepProgress({
      ...completeInput,
      commercialCapacity: "additional consultations",
    });
    const economicsStep = progress.find((step) => step.id === "economics");

    expect(economicsStep?.missing).toContain("Commercial capacity number");
    expect(getFirstIncompleteProposalBuilderStep(progress)).toBe("economics");
  });

  it("blocks send when backend client-use readiness fields are missing", () => {
    const progress = getProposalBuilderStepProgress({
      ...completeInput,
      discoverySource: "",
      economicUnit: "",
      contributionEvidenceSourceDate: "",
      sectorImageProvenance: "",
      evidenceConfidenceState: "to_confirm",
      contributionConfirmationState: "working_diagnosis",
      whyActNow: "",
      targetArea: "",
    });
    const clientStep = progress.find((step) => step.id === "client");
    const discoveryStep = progress.find((step) => step.id === "discovery");
    const economicsStep = progress.find((step) => step.id === "economics");
    const sendStep = progress.find((step) => step.id === "send");

    expect(clientStep?.missing).toContain("Sector image provenance");
    expect(discoveryStep?.missing).toEqual(expect.arrayContaining([
      "Discovery source",
      "Evidence confidence set to Known, Working diagnosis or Provisional",
      "Why act now",
      "Target area",
    ]));
    expect(economicsStep?.missing).toEqual(expect.arrayContaining([
      "Economic unit",
      "Contribution evidence source/date",
      "Contribution confirmation set to Known",
    ]));
    expect(sendStep?.missing).toContain("Ready V5 proposal");
  });

  it("keeps review and send blocked when client-use validation still has backend blockers", () => {
    const progress = getProposalBuilderStepProgress({
      ...completeInput,
      clientUseMissingItems: [
        "Proof: select at least one real ClinicGrower OS product screenshot",
        "Scope: replace vague wording such as as required, agreed in roadmap, confirmed separately or to be agreed",
      ],
    });
    const proofStep = progress.find((step) => step.id === "proof");
    const scopeStep = progress.find((step) => step.id === "scope");
    const reviewStep = progress.find((step) => step.id === "review");
    const sendStep = progress.find((step) => step.id === "send");

    expect(proofStep?.missing).toContain("Proof: select at least one real ClinicGrower OS product screenshot");
    expect(scopeStep?.missing).toContain("Scope: replace vague wording such as as required, agreed in roadmap, confirmed separately or to be agreed");
    expect(reviewStep?.missing).toEqual(expect.arrayContaining([
      "Proof: select at least one real ClinicGrower OS product screenshot",
      "Scope: replace vague wording such as as required, agreed in roadmap, confirmed separately or to be agreed",
    ]));
    expect(sendStep?.missing).toContain("Ready V5 proposal");
    expect(getProposalBuilderMissingCount(progress)).toBe(2);
  });

  it("requires a client-facing ad spend rule for the V5 investment page", () => {
    const progress = getProposalBuilderStepProgress({
      ...completeInput,
      adSpendRule: "",
    });
    const investmentStep = progress.find((step) => step.id === "investment");

    expect(investmentStep?.missing).toContain("Ad spend rule");
    expect(getFirstIncompleteProposalBuilderStep(progress)).toBe("investment");
  });

  it("keeps scope package-driven and flags incomplete client-facing scope descriptions", () => {
    const progress = getProposalBuilderStepProgress({
      ...completeInput,
      scopeItemCount: 4,
      scopeHasClientDescriptions: false,
    });
    const scopeStep = progress.find((step) => step.id === "scope");

    expect(scopeStep?.missing).toContain("Client-facing scope descriptions");
    expect(getFirstIncompleteProposalBuilderStep(progress)).toBe("scope");
  });

  it("blocks review and send until preview readiness and a saved proposal exist", () => {
    const progress = getProposalBuilderStepProgress({
      ...completeInput,
      previewReady: false,
      savedProposalId: "",
    });
    const reviewStep = progress.find((step) => step.id === "review");
    const sendStep = progress.find((step) => step.id === "send");

    expect(reviewStep?.missing).toContain("V5 preview readiness");
    expect(sendStep?.missing).toEqual(expect.arrayContaining(["Ready V5 proposal", "Saved draft"]));
  });

  it("wires the editor to the guided builder while preserving the real proposal preview", () => {
    const source = readFileSync("app/app/crm/proposals/edit/page.tsx", "utf8");

    expect(source).toContain('data-testid="proposal-builder-shell"');
    expect(source).not.toContain("Advanced full field editor");
    expect(source).not.toContain("proposal-builder-advanced-editor");
    expect(source).toContain("getProposalBuilderStepProgress");
    expect(source).toContain("ProposalV5Renderer");
    expect(source).toContain("sendProposalFromBuilder");
    expect(source).toContain("proposalClientVisibleLocked");
    expect(source).toContain("Version frozen");
    expect(source).toContain("Proof requirements met");
    expect(source).toContain("Success measures");
    expect(source).toContain("ClinicGrower responsibilities");
    expect(source).toContain("Discovery: Website, CRM and booking setup");
    expect(source).toContain("Economics: Commercial capacity");
    expect(source).not.toContain("Systems-fit panels");
    expect(source).not.toContain("V5 snapshot contract");
    expect(source).not.toContain("v5ScopeItems");
    expect(source).not.toContain("sourceProposalVersion</");
    expect(source).not.toContain("snapshotHash</");
  });
});
