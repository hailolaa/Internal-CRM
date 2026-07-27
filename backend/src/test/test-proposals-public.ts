import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProposalPublicUrl,
  isProposalPubliclyVisible,
  mapProposalPublicPackage,
  mapProposalPublicResponse,
} from "../modules/proposals/proposals.public.js";
import type { ProposalResponse, ProposalStatus } from "../modules/proposals/proposals.types.js";

const internalProposal: ProposalResponse = {
  id: "proposal-secret-id",
  contactId: "contact-secret-id",
  dealId: "deal-secret-id",
  clientAccountProfileId: "account-secret-id",
  proposalName: "Growth proposal",
  templateKey: "internal-template-key",
  packageName: "Growth Engine",
  recommendedPackageId: "package-secret-id",
  ownerId: "owner-secret-id",
  ownerName: "Internal Owner",
  status: "sent",
  valueCents: 250000,
  monthlyFeeCents: 200000,
  setupFeeCents: 50000,
  currency: "GBP",
  adSpendNote: "Ad spend agreed separately",
  vatStatus: "exclusive",
  minimumTermMonths: 6,
  noticePeriodDays: 30,
  startDate: "2026-08-01",
  followUpAt: "2026-07-30T09:00:00.000Z",
  readyAt: "2026-07-20T09:00:00.000Z",
  sentAt: "2026-07-21T09:00:00.000Z",
  sentToEmail: "decision-maker@example.com",
  sentToName: "Decision Maker",
  sendMethod: "manual_email",
  sendNote: "Internal send note",
  sentBy: "sender-secret-id",
  sentByName: "Internal Sender",
  viewedAt: "2026-07-22T09:00:00.000Z",
  acceptedAt: "2026-07-23T09:00:00.000Z",
  acceptedReason: "Internal acceptance reason",
  wonAt: "2026-07-24T09:00:00.000Z",
  wonReason: "Internal won reason",
  lostAt: null,
  lostReason: "budget",
  objectionType: "budget",
  expiresAt: "2026-08-20T09:00:00.000Z",
  proposalUrl: "https://example.test/proposals/shared/?token=secret",
  notes: "Internal notes",
  addOns: [{ name: "SEO", amountCents: 25000 }],
  discounts: [{ name: "Launch discount", amountCents: 10000 }],
  internalMarginNote: "Internal margin",
  sectionContent: {
    executiveSummary: "Client-facing summary",
    includedFeatures: ["Website", "SEO"],
  },
  draftSavedAt: "2026-07-19T09:00:00.000Z",
  contactName: "Decision Maker",
  contactEmail: "decision-maker@example.com",
  accountName: "Example Clinic",
  dealTitle: "Internal deal title",
  clientAccountName: "Example Clinic",
  createdBy: "creator-secret-id",
  updatedBy: "updater-secret-id",
  createdAt: "2026-07-19T09:00:00.000Z",
  updatedAt: "2026-07-24T09:00:00.000Z",
  acceptanceRecord: {
    id: "acceptance-secret-id",
    proposalId: "proposal-secret-id",
    contactId: "contact-secret-id",
    dealId: "deal-secret-id",
    clientAccountProfileId: "account-secret-id",
    acceptedByName: "Decision Maker",
    acceptedByEmail: "decision-maker@example.com",
    acceptedAt: "2026-07-23T09:00:00.000Z",
    acceptanceStatus: "accepted",
    packageName: "Growth Engine",
    recommendedPackageId: "package-secret-id",
    monthlyFeeCents: 200000,
    setupFeeCents: 50000,
    currency: "GBP",
    paymentTerms: "Internal payment terms",
    startDate: "2026-08-01",
    minimumTermMonths: 6,
    noticePeriodDays: 30,
    scope: { internal: true },
    commercialSnapshot: { margin: "secret" },
    proposalSnapshot: { notes: "secret" },
    createdAt: "2026-07-23T09:00:00.000Z",
    updatedAt: "2026-07-23T09:00:00.000Z",
  },
};

test("public proposal mapper returns only the client-facing allow-list", () => {
  const result = mapProposalPublicResponse(internalProposal);

  assert.deepEqual(Object.keys(result).sort(), [
    "accountName",
    "adSpendNote",
    "addOns",
    "clientAccountName",
    "contactName",
    "currency",
    "discounts",
    "expiresAt",
    "minimumTermMonths",
    "monthlyFeeCents",
    "noticePeriodDays",
    "packageName",
    "proposalName",
    "sectionContent",
    "setupFeeCents",
    "startDate",
    "templateKey",
    "valueCents",
    "vatStatus",
  ].sort());

  for (const sensitiveField of [
    "id",
    "contactId",
    "dealId",
    "clientAccountProfileId",
    "recommendedPackageId",
    "ownerId",
    "ownerName",
    "status",
    "followUpAt",
    "sentAt",
    "sentToEmail",
    "sentToName",
    "sendMethod",
    "sendNote",
    "sentBy",
    "sentByName",
    "viewedAt",
    "acceptedAt",
    "acceptedReason",
    "wonAt",
    "wonReason",
    "lostAt",
    "lostReason",
    "objectionType",
    "proposalUrl",
    "notes",
    "internalMarginNote",
    "contactEmail",
    "dealTitle",
    "createdBy",
    "updatedBy",
    "createdAt",
    "updatedAt",
    "acceptanceRecord",
  ]) {
    assert.equal(Object.hasOwn(result, sensitiveField), false, `${sensitiveField} must not be public`);
  }
});

test("public package mapper removes the package id", () => {
  const internalPackage = {
    id: "package-secret-id",
    name: "Growth Engine",
    priceCents: 200000,
    setupFeeCents: 50000,
    currency: "GBP",
    billingFrequency: "monthly",
    includedFeatures: ["Website", "SEO"],
    proposalWording: "Client-facing wording",
  };

  const result = mapProposalPublicPackage(internalPackage);

  assert.equal(Object.hasOwn(result!, "id"), false);
  assert.deepEqual(result, {
    name: "Growth Engine",
    priceCents: 200000,
    setupFeeCents: 50000,
    currency: "GBP",
    billingFrequency: "monthly",
    includedFeatures: ["Website", "SEO"],
    proposalWording: "Client-facing wording",
  });
});

test("public proposal visibility permits only active client-facing statuses before expiry", () => {
  const now = new Date("2026-07-24T12:00:00.000Z");
  const allowed: ProposalStatus[] = ["ready", "sent", "viewed", "follow_up_due", "accepted", "won"];
  const denied: ProposalStatus[] = ["draft", "lost", "expired", "archived"];

  for (const status of allowed) {
    assert.equal(isProposalPubliclyVisible(status, null, now), true);
    assert.equal(isProposalPubliclyVisible(status, "2026-07-24T12:00:01.000Z", now), true);
  }
  for (const status of denied) {
    assert.equal(isProposalPubliclyVisible(status, null, now), false);
  }

  assert.equal(isProposalPubliclyVisible("sent", "2026-07-24T12:00:00.000Z", now), false);
  assert.equal(isProposalPubliclyVisible("sent", "2026-07-24T11:59:59.000Z", now), false);
  assert.equal(isProposalPubliclyVisible("sent", "not-a-date", now), false);
});

test("proposal share URLs use the static shared route and encoded query token", () => {
  assert.equal(
    buildProposalPublicUrl("https://mission-control.example///", "token /+?"),
    "https://mission-control.example/proposals/shared/?token=token%20%2F%2B%3F",
  );
});
