import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProposalPublicUrl,
  isProposalPubliclyVisible,
  mapProposalPublicPackage,
  mapProposalPublicResponse,
} from "../modules/proposals/proposals.public.js";
import { buildProposalV5Snapshot, hashProposalV5Snapshot } from "../modules/proposals/proposal-v5-snapshot.js";
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
  coreData: null,
  v5Snapshot: null,
  v5SnapshotHash: null,
  v5SnapshotVersion: null,
  v5SnapshotFrozenAt: null,
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
    legalCompanyName: "Example Clinic Ltd",
    billingEmail: "billing@example.com",
    preferredStartDate: "2026-08-05",
    agreementAccepted: true,
    confirmationText: "Decision Maker",
    acceptanceSource: "public_proposal_link",
    acceptedIpAddress: "203.0.113.10",
    acceptedUserAgent: "Test browser",
    evidenceSha256: "a".repeat(64),
    lockedAt: "2026-07-23T09:00:00.000Z",
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
    coreDataSnapshot: null,
    v5Snapshot: null,
    v5SnapshotHash: null,
    v5SnapshotVersion: null,
    createdAt: "2026-07-23T09:00:00.000Z",
    updatedAt: "2026-07-23T09:00:00.000Z",
  },
};

const v5PackageRecord = {
  id: "package-secret-id",
  name: "Clinic Growth Engine",
  priceCents: 200000,
  setupFeeCents: 50000,
  currency: "GBP",
  billingFrequency: "monthly",
  catalogueVersion: "catalogue-secret-version",
  commercialNotes: {
    v5ScopeItems: [
      {
        category: "Growth OS",
        title: "ClinicGrower OS commercial visibility",
        description: "Client-facing V5 scope line.",
        frequency: "Monthly",
        quantityLimit: "One priority journey",
        treatmentsAndLocations: "Dental implants in Bristol",
        dependency: "Connected sources where available",
        owner: "ClinicGrower",
        exclusion: "Media spend and unsupported systems",
        thirdPartyCosts: "Paid media spend billed separately",
        inclusionStatus: "included",
        deliveryType: "recurring",
        isOptionalAddOn: false,
        approvalStatus: "not_required",
        sortOrder: 10,
      },
    ],
  },
};

function buildPublicReadyV5Proposal(overrides: Partial<ProposalResponse> = {}): ProposalResponse {
  const sourceProposal: ProposalResponse = {
    ...internalProposal,
    templateKey: "clinicgrower_v5",
    packageName: "Clinic Growth Engine",
    recommendedPackageId: "package-secret-id",
    monthlyFeeCents: 200000,
    setupFeeCents: 50000,
    sectionContent: {
      proposalReference: "CG-V5-PUBLIC-001",
      clinicTypeVariant: "dental_clinic",
      discoverySource: "Discovery call",
      customerWording: "Owner wording captured for the proposal.",
      evidenceConfidenceState: "known",
      primaryGoal: "Increase private implant enquiries.",
      whyActNow: "The clinic wants clearer commercial accountability before increasing spend.",
      diagnosis: "High-value enquiries are not consistently tracked from source to booking.",
      currentWebsiteCrmBookingSetup: "Website, call tracking and booking diary are reviewed where connected.",
      clinicTypeAndLocations: "Bristol private dental practice",
      priorityTreatments: "Implants; Invisalign",
      fieldEvidenceReferences: {
        "discovery.customerWording": "secret-field-evidence-reference",
      },
      fieldApprovals: {
        "discovery.customerWording": {
          evidenceReference: "secret-approved-evidence-reference",
          approvedBy: "Secret Approver",
          approvedAt: "2026-08-10T10:00:00.000Z",
          approvalStatus: "approved",
        },
      },
      activeConstraintId: "Treatment-coordinator review",
      activeConstraintConfidenceState: "working_diagnosis",
      problemsDiscussed: "Lead handling; Attendance; Case value",
      economicUnit: "accepted implant case",
      clinicConfirmedContribution: "3000",
      contributionEvidenceSourceDate: "2026-08-10",
      contributionConfirmationState: "known",
      selectedMediaSpend: "1500",
      paybackState: "known",
      availableCommercialCapacity: "6",
      commercialDataSource: "Discovery call",
      successMetrics: ["Response time|Not currently measured|CRM"],
      proofAssets: [
        {
          id: "proof-secret-id",
          type: "case_study",
          title: "Approved proof",
          copy: "Client-facing proof copy.",
          mediaUrl: "/brand/proof/dental-proof.png",
          sectorTags: ["dental", "source:ClinicGrower proof library", "state:known", "timeframe:90 days"],
          sortOrder: 10,
          isActive: true,
          createdAt: "2026-08-10T09:00:00.000Z",
          updatedAt: "2026-08-10T09:00:00.000Z",
        },
        {
          id: "proof-secret-id-no-media",
          type: "award",
          title: "Selected proof without media",
          copy: "Client-facing proof copy without a media asset.",
          mediaUrl: null,
          sectorTags: ["source:ClinicGrower proof library", "state:known", "timeframe:2026", "disclaimer:Credibility proof is not a guarantee."],
          sortOrder: 20,
          isActive: true,
          createdAt: "2026-08-10T09:00:00.000Z",
          updatedAt: "2026-08-10T09:00:00.000Z",
        },
      ],
    },
    ...overrides,
  };
  const v5Snapshot = buildProposalV5Snapshot({
    proposal: sourceProposal,
    packageRecord: v5PackageRecord as never,
    generatedAt: "2026-08-11T09:00:00.000Z",
    sourceProposalVersion: "public-test-source-version",
    acceptanceUrl: "https://crm.clinicgrower.co.uk/proposals/shared/?token=public",
    questionUrl: "mailto:hello@clinicgrower.co.uk?subject=Question",
  });

  return {
    ...sourceProposal,
    v5Snapshot,
    v5SnapshotHash: v5Snapshot.snapshotHash,
    v5SnapshotVersion: "proposal_v5_2026_08_11",
    v5SnapshotFrozenAt: "2026-08-11T09:01:00.000Z",
  };
}

test("public proposal mapper returns only the client-facing allow-list", () => {
  const result = mapProposalPublicResponse(buildPublicReadyV5Proposal());

  assert.deepEqual(Object.keys(result).sort(), [
    "accountName",
    "adSpendNote",
    "addOns",
    "clientAccountName",
    "contactName",
    "coreData",
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
    "v5Snapshot",
    "v5SnapshotSchemaVersion",
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
      "v5SnapshotHash",
      "v5SnapshotVersion",
      "v5SnapshotFrozenAt",
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

test("public V5 mapper suppresses raw editor data and nested internal asset IDs", () => {
  const proposalWithV5 = buildPublicReadyV5Proposal();
  const result = mapProposalPublicResponse({
    ...proposalWithV5,
    sectionContent: { internalAuthoringNote: "secret editor data" } as any,
    coreData: { immutableVersion: "secret-core-version" } as any,
  });

  assert.equal(result.sectionContent, null);
  assert.equal(result.coreData, null);
  assert.equal(result.v5Snapshot?.schemaVersion, "proposal_v5");
  assert.equal((result.v5Snapshot as any).proposal.reference, "CG-V5-PUBLIC-001");
  assert.equal(Object.hasOwn((result.v5Snapshot as any).discovery.customerWording, "source"), false);
  assert.equal(Object.hasOwn((result.v5Snapshot as any).discovery.customerWording, "sourceDate"), false);
  assert.equal(Object.hasOwn((result.v5Snapshot as any).discovery.customerWording, "evidenceReference"), false);
  assert.equal(Object.hasOwn((result.v5Snapshot as any).discovery.customerWording, "approvedBy"), false);
  assert.equal(Object.hasOwn((result.v5Snapshot as any).discovery.customerWording, "approvedAt"), false);
  assert.deepEqual((result.v5Snapshot as any).proof[0].sectorTags, ["dental"]);
  assert.equal((result.v5Snapshot as any).proof[0].mediaUrl, "/brand/proof/dental-proof.png");
  assert.equal(Object.hasOwn((result.v5Snapshot as any).proof[0], "id"), false);
  assert.equal((result.v5Snapshot as any).proof[1].title, "Selected proof without media");
  assert.equal((result.v5Snapshot as any).proof[1].mediaUrl, null);
  assert.equal(Object.hasOwn((result.v5Snapshot as any).proof[1], "id"), false);
  const serialized = JSON.stringify(result);
  for (const secret of [
    "public-test-source-version",
    "package-secret-id",
    "catalogue-secret-version",
    "proof-secret-id",
    "proof-secret-id-no-media",
    "secret-field-evidence-reference",
    "secret-approved-evidence-reference",
    "Secret Approver",
    "secret editor data",
    "secret-core-version",
    proposalWithV5.v5SnapshotHash,
    proposalWithV5.v5Snapshot?.acceptance.lockedSnapshotHash,
  ]) {
    if (secret) assert.equal(serialized.includes(secret), false, `${secret} must not be public`);
  }
});

test("public V5 mapper fails safely when the frozen snapshot is corrupt", () => {
  const proposalWithV5 = buildPublicReadyV5Proposal();

  assert.throws(
    () =>
      mapProposalPublicResponse({
        ...proposalWithV5,
        v5Snapshot: {
          ...proposalWithV5.v5Snapshot!,
          pageCount: 18,
        } as any,
      }),
    /Proposal link not found/,
  );
});

test("public V5 mapper fails safely when the frozen snapshot is not in a sent state", () => {
  const proposalWithV5 = buildPublicReadyV5Proposal({ status: "ready" });

  assert.throws(
    () => mapProposalPublicResponse(proposalWithV5),
    /Proposal link not found/,
  );
});

test("public V5 mapper fails safely when the stored snapshot hash does not match", () => {
  const proposalWithV5 = buildPublicReadyV5Proposal();

  assert.throws(
    () =>
      mapProposalPublicResponse({
        ...proposalWithV5,
        v5SnapshotHash: "0".repeat(64),
      }),
    /Proposal link not found/,
  );
});

test("V5 snapshot hash is canonical SHA-256 and changes with client-facing data", () => {
  const left = {
    snapshotHash: "ignored",
    schemaVersion: "proposal_v5",
    clientFacing: {
      clinicName: "Example Clinic",
      packageName: "Clinic Growth Engine",
    },
    pages: [
      { id: "V5Page01Cover", pageNumber: 1 },
      { id: "V5Page02Recommendation", pageNumber: 2 },
    ],
  };
  const right = {
    pages: [
      { pageNumber: 1, id: "V5Page01Cover" },
      { pageNumber: 2, id: "V5Page02Recommendation" },
    ],
    clientFacing: {
      packageName: "Clinic Growth Engine",
      clinicName: "Example Clinic",
    },
    schemaVersion: "proposal_v5",
    snapshotHash: "different ignored hash",
  };
  const changed = {
    ...left,
    clientFacing: {
      ...left.clientFacing,
      clinicName: "Changed Clinic",
    },
  };

  const hash = hashProposalV5Snapshot(left as any);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hashProposalV5Snapshot(right as any), hash);
  assert.notEqual(hashProposalV5Snapshot(changed as any), hash);
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
