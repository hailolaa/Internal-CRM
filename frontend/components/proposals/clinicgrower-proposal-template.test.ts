import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClinicGrowerProposalTemplate } from "./clinicgrower-proposal-template";
import type { ProposalPublicRecord, ProposalRecord } from "@/lib/api-types";

const publicProposal: ProposalPublicRecord = {
  proposalName: "Example Clinic Growth Proposal",
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
});
