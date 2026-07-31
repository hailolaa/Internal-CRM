import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClinicGrowerProposalTemplate } from "./clinicgrower-proposal-template";
import type { ProposalPublicRecord, ProposalRecord, ProposalScopeItem } from "@/lib/api-types";

const publicProposal: ProposalPublicRecord = {
  proposalName: "Example Clinic Growth Proposal",
  templateKey: "clinicgrower_standard",
  packageName: "Growth Engine",
  valueCents: 199_500,
  monthlyFeeCents: 199_500,
  setupFeeCents: 50_000,
  currency: "GBP",
  adSpendNote: "Advertising spend is agreed separately.",
  vatStatus: "plus_vat",
  minimumTermMonths: 6,
  noticePeriodDays: 30,
  startDate: "2026-08-01",
  expiresAt: "2026-08-31T23:59:59.000Z",
  addOns: [],
  discounts: [],
  sectionContent: null,
  contactName: "Alex Owner",
  accountName: "Example Clinic",
  clientAccountName: null,
};

describe("ClinicGrowerProposalTemplate", () => {
  it("keeps internal workflow metadata and process copy out of the public proposal", () => {
    const html = renderToStaticMarkup(
      ClinicGrowerProposalTemplate({
        proposal: publicProposal,
        packageRecord: null,
        previewMode: false,
      }),
    );

    expect(html).not.toMatch(/>Status</);
    expect(html).not.toMatch(/>Owner</);
    expect(html).not.toMatch(/>Follow-up</);
    expect(html).not.toContain("Mission Control");
    expect(html).not.toContain("Better Proposals");
    expect(html).not.toContain("CRM timeline");
    expect(html).toContain("Ready to move forward");
  });

  it("retains workflow context in the authenticated CRM preview", () => {
    const internalProposal: ProposalRecord = {
      ...publicProposal,
      id: "proposal-1",
      contactId: null,
      dealId: null,
      clientAccountProfileId: null,
      templateKey: "clinicgrower_standard",
      recommendedPackageId: null,
      ownerId: "owner-1",
      ownerName: "Internal Owner",
      status: "ready",
      followUpAt: "2026-08-05T09:00:00.000Z",
      readyAt: null,
      sentAt: null,
      sentToEmail: null,
      sentToName: null,
      sendMethod: null,
      sendNote: null,
      sentBy: null,
      sentByName: null,
      viewedAt: null,
      acceptedAt: null,
      acceptedReason: null,
      wonAt: null,
      wonReason: null,
      lostAt: null,
      lostReason: null,
      objectionType: null,
      proposalUrl: null,
      notes: null,
      internalMarginNote: null,
      draftSavedAt: null,
      contactEmail: "alex@example.com",
      dealTitle: null,
      createdBy: null,
      updatedBy: null,
      createdAt: "2026-07-24T09:00:00.000Z",
      updatedAt: "2026-07-24T09:00:00.000Z",
      acceptanceRecord: null,
    };

    const html = renderToStaticMarkup(
      ClinicGrowerProposalTemplate({
        proposal: internalProposal,
        packageRecord: null,
      }),
    );

    expect(html).toMatch(/>Status</);
    expect(html).toMatch(/>Owner</);
    expect(html).toMatch(/>Follow-up</);
    expect(html).toContain("Internal Owner");
    expect(html).toContain("Continue in Mission Control");
  });

  it.each([
    [
      "clinicgrower_standard",
      "Personalised Growth Proposal",
      "The first 90 days",
      "A controlled path from insight to action.",
    ],
    [
      "growth_score_follow_up",
      "Personalised Growth Proposal",
      "The first 90 days",
      "Turn the Growth Score into measurable progress.",
    ],
    [
      "bespoke_growth_plan",
      "Personalised Growth Proposal",
      "The first 90 days",
      "A tailored engagement with clear ownership.",
    ],
  ])("renders practical %s template content", (templateKey, coverLabel, timelineLabel, includedHeading) => {
    const html = renderToStaticMarkup(
      ClinicGrowerProposalTemplate({
        proposal: { ...publicProposal, templateKey },
        packageRecord: null,
        previewMode: false,
      }),
    );

    expect(html).toContain(coverLabel);
    expect(html).toContain(timelineLabel);
    expect(html).toContain(includedHeading);
  });

  it("renders the diagnosis-led proposal flow before investment", () => {
    const html = renderToStaticMarkup(
      ClinicGrowerProposalTemplate({
        proposal: {
          ...publicProposal,
          sectionContent: {
            personalIntroduction: "Hi Alex, this is a tailored growth proposal.",
            primaryGoal: "Add 10 booked consultations per week.",
            growthScoreOverall: 49,
            visibilityScore: 58,
            conversionScore: 46,
            biggestRisk: "Tracking is incomplete.",
            biggestOpportunity: "Available clinical capacity can be filled.",
            firstRecommendedFix: "Fix tracking before scaling spend.",
            recommendedPlan: "Capture demand and improve the full patient journey.",
          },
        },
        packageRecord: null,
        previewMode: false,
      }),
    );

    expect(html.indexOf("What we understood")).toBeLessThan(html.indexOf("Recommended programme and investment"));
    expect(html.indexOf("Growth diagnosis")).toBeLessThan(html.indexOf("Recommended programme and investment"));
    expect(html.indexOf("The first 90 days")).toBeLessThan(html.indexOf("Recommended programme and investment"));
    expect(html).toContain("Next steps and acceptance");
    expect(html).toContain("Accept proposal");
    expect(html).toContain("Add 10 booked consultations per week.");
    expect(html).toContain("49 / 100");
  });

  it("renders a Vimeo proposal video when a video URL is saved", () => {
    const html = renderToStaticMarkup(
      ClinicGrowerProposalTemplate({
        proposal: {
          ...publicProposal,
          sectionContent: {
            introVideoTitle: "A message from ClinicGrower",
            introVideoUrl: "https://vimeo.com/1144662620",
          },
        },
        packageRecord: null,
        previewMode: false,
      }),
    );

    expect(html).toContain("Proposal video");
    expect(html).toContain("A message from ClinicGrower");
    expect(html).toContain("https://player.vimeo.com/video/1144662620");
  });

  it("renders structured scope items without exposing internal delivery notes", () => {
    const scopeItemWithInternalNotes: ProposalScopeItem & { internalNotes: string } = {
      category: "Google Ads",
      title: "Google Ads management",
      clientDescription: "Campaign structure, search intent and optimisation for agreed priority services.",
      frequency: "Ongoing",
      quantityLimit: "Subject to agreed ad spend",
      inclusionStatus: "included",
      deliveryType: "recurring",
      isOptionalAddOn: false,
      sortOrder: 10,
      internalNotes: "Do not show this delivery note publicly.",
    };
    const html = renderToStaticMarkup(
      ClinicGrowerProposalTemplate({
        proposal: {
          ...publicProposal,
          sectionContent: {
            scopeItems: [scopeItemWithInternalNotes],
          },
        },
        packageRecord: null,
        previewMode: false,
      }),
    );

    expect(html).toContain("Google Ads management");
    expect(html).toContain("Subject to agreed ad spend");
    expect(html).toContain("Recurring");
    expect(html).not.toContain("Do not show this delivery note publicly.");
  });
});
