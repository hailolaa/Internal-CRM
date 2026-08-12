import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { metadata } from "@/app/app/crm/proposals/v5-record-preview/page";
import {
  normaliseProposalV5InternalRenderer,
  ProposalV5RealRecordPreviewView,
  resolveProposalV5FrozenSnapshot,
} from "@/app/app/crm/proposals/preview/v5-real-record-preview";
import type { ProposalRecord } from "@/lib/api-types";
import { buildProposalV5PreviewSnapshot } from "./data/previewSnapshot";
import type { ProposalV5Snapshot } from "./data/proposalV5Types";

function proposalWithSnapshot(
  snapshot: ProposalV5Snapshot | Record<string, unknown> | null,
  overrides: Partial<ProposalRecord> = {},
): ProposalRecord {
  const v5Snapshot = snapshot as ProposalRecord["v5Snapshot"];
  const snapshotHash = snapshot && typeof snapshot.snapshotHash === "string" ? snapshot.snapshotHash : null;

  return {
    id: "real-proposal-001",
    contactId: "contact-001",
    dealId: "deal-001",
    clientAccountProfileId: null,
    proposalName: "Real frozen V5 proposal",
    templateKey: "clinicgrower_v5",
    packageName: "Mutable proposal package must not render",
    recommendedPackageId: "mutable-package-id",
    ownerId: "user-001",
    ownerName: "ClinicGrower Sales",
    status: "sent",
    valueCents: 123,
    monthlyFeeCents: 123,
    setupFeeCents: 456,
    currency: "GBP",
    adSpendNote: "Mutable media note must not render",
    vatStatus: "mutable_vat",
    minimumTermMonths: 1,
    noticePeriodDays: 1,
    startDate: "2026-09-01",
    followUpAt: null,
    readyAt: null,
    sentAt: "2026-08-11T10:00:00.000Z",
    sentToEmail: "owner@exampleclinic.co.uk",
    sentToName: "Practice Owner",
    sendMethod: "manual_email",
    sendNote: null,
    sentBy: "user-001",
    sentByName: "ClinicGrower Sales",
    viewedAt: null,
    acceptedAt: null,
    acceptedReason: null,
    wonAt: null,
    wonReason: null,
    lostAt: null,
    lostReason: null,
    objectionType: null,
    expiresAt: "2026-09-30T23:59:59.000Z",
    proposalUrl: "https://mission-control.example/proposals/shared/?token=private-token",
    notes: "Mutable internal notes must not render",
    addOns: [],
    discounts: [],
    internalMarginNote: "Mutable margin note must not render",
    sectionContent: {
      clinicTypeVariant: "aesthetic_clinic",
      priorityTreatments: "Mutable section content must not render",
      scopeItems: [
        {
          category: "Mutable",
          title: "Mutable scope must not render",
          clientDescription: "Mutable section scope must not render",
          frequency: "Mutable",
          quantityLimit: "Mutable",
          treatmentsAndLocations: "Mutable",
          dependencies: "Mutable",
          clientResponsibilities: "Mutable",
          exclusions: "Mutable",
          thirdPartyCosts: "Mutable",
          inclusionStatus: "included",
          deliveryType: "recurring",
          isOptionalAddOn: false,
          approvalStatus: "not_required",
          sortOrder: 1,
        },
      ],
    },
    coreData: null,
    v5Snapshot,
    v5SnapshotHash: snapshotHash,
    v5SnapshotVersion: snapshotHash ? "proposal_v5_2026_08_11" : null,
    v5SnapshotFrozenAt: snapshotHash ? "2026-08-11T10:00:00.000Z" : null,
    draftSavedAt: null,
    contactName: "Mutable Contact",
    contactEmail: "mutable@exampleclinic.co.uk",
    accountName: "Mutable Account",
    dealTitle: "Mutable Deal",
    clientAccountName: null,
    createdBy: "user-001",
    updatedBy: "user-001",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-11T09:30:00.000Z",
    acceptanceRecord: null,
    ...overrides,
  };
}

function renderRealRecord(snapshot: ProposalV5Snapshot, renderer: "v5" | "v5-mobile" | "v5-print") {
  return renderToStaticMarkup(
    createElement(ProposalV5RealRecordPreviewView, {
      proposal: proposalWithSnapshot(snapshot),
      renderer,
    }),
  );
}

describe("real-record V5 proposal preview bridge", () => {
  it("adds a noindex private route for real frozen proposal records", () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("normalises only the supported V5 renderer values", () => {
    expect(normaliseProposalV5InternalRenderer("v5")).toBe("v5");
    expect(normaliseProposalV5InternalRenderer("v5-mobile")).toBe("v5-mobile");
    expect(normaliseProposalV5InternalRenderer("v5-print")).toBe("v5-print");
    expect(normaliseProposalV5InternalRenderer("legacy")).toBeNull();
    expect(normaliseProposalV5InternalRenderer(null)).toBeNull();
  });

  it("rejects missing, invalid and incomplete frozen records before rendering V5", () => {
    const snapshot = buildProposalV5PreviewSnapshot();
    const missing = resolveProposalV5FrozenSnapshot(proposalWithSnapshot(null));
    const invalid = resolveProposalV5FrozenSnapshot(proposalWithSnapshot({ schemaVersion: "proposal_v5", pageCount: 18 }));
    const incomplete = resolveProposalV5FrozenSnapshot(
      proposalWithSnapshot(snapshot, { v5SnapshotHash: null, v5SnapshotVersion: null, v5SnapshotFrozenAt: null }),
    );
    const mismatch = resolveProposalV5FrozenSnapshot(
      proposalWithSnapshot(snapshot, { v5SnapshotHash: "0".repeat(64) }),
    );
    const draft = resolveProposalV5FrozenSnapshot(proposalWithSnapshot(snapshot, { status: "draft" }));

    expect(missing.status).toBe("missing_snapshot");
    expect(invalid.status).toBe("invalid");
    expect(incomplete.status).toBe("invalid");
    expect(mismatch.status).toBe("invalid");
    expect(draft.status).toBe("unsupported_status");
  });

  it("renders desktop, mobile and print from the exact same frozen snapshot", () => {
    const snapshot = buildProposalV5PreviewSnapshot({
      clinicType: "dental_clinic",
      packageId: "clinic-growth-engine",
    });
    const desktop = renderRealRecord(snapshot, "v5");
    const mobile = renderRealRecord(snapshot, "v5-mobile");
    const print = renderRealRecord(snapshot, "v5-print");

    expect(desktop).toContain("proposal-v5-renderer");
    expect(mobile).toContain("proposal-v5-mobile-renderer");
    expect(print).toContain("proposal-v5-print-root");
    [desktop, mobile, print].forEach((html) => {
      expect(html).toContain("BristolDent Harbourside");
      expect(html).toContain("Clinic Growth Engine");
      expect(html).toContain("Dr Tanja Phillips");
      expect(html).not.toContain(snapshot.snapshotHash);
      expect(html).not.toContain(snapshot.sourceProposalVersion);
      expect(html).not.toContain("mutable-package-id");
      expect(html).not.toContain("Mutable scope must not render");
      expect(html).not.toContain("Mutable internal notes must not render");
      expect(html).not.toContain("Mutable margin note must not render");
    });
  });

  it("keeps package-specific scope and commercial values snapshot-driven across real records", () => {
    const packageCases = [
      ["growth-diagnostic", "Growth Diagnostic"],
      ["clinic-growth-engine", "Clinic Growth Engine"],
      ["market-leader", "Market Leader"],
    ] as const;
    const firstScopeTitles = new Set<string>();

    packageCases.forEach(([packageId, packageName]) => {
      const snapshot = buildProposalV5PreviewSnapshot({ packageId });
      const html = renderRealRecord(snapshot, "v5-print");

      expect(snapshot.selectedPackage.id).toBe(packageId);
      expect(html).toContain(packageName);
      expect(html).toContain(snapshot.scope[0]?.title as string);
      expect(html).toContain(snapshot.scope[0]?.exclusion as string);
      expect(html).not.toContain(packageId);
      firstScopeTitles.add(snapshot.scope[0]?.title as string);
    });

    expect(firstScopeTitles.size).toBe(3);
  });

  it("keeps clinic variant, proof and clinical-boundary content from the frozen snapshot", () => {
    const clinicCases = [
      "dental_clinic",
      "aesthetic_clinic",
      "hair_transplant_clinic",
    ] as const;

    clinicCases.forEach((clinicType) => {
      const snapshot = buildProposalV5PreviewSnapshot({ clinicType });
      const html = renderRealRecord(snapshot, "v5");

      expect(snapshot.clinic.clinicType).toBe(clinicType);
      expect(html).toContain(snapshot.clinic.typeShortLabel);
      expect(html).toContain(snapshot.journey.clinicalBoundary);
      expect(html).toContain(snapshot.assets.sectorImages.cover.url as string);
      expect(html).toContain(snapshot.proof[0]?.title as string);
    });
  });

  it("preserves economics gating and safe proposal links from the frozen snapshot", () => {
    const snapshot: ProposalV5Snapshot = {
      ...buildProposalV5PreviewSnapshot(),
      economics: {
        ...buildProposalV5PreviewSnapshot().economics,
        contribution: {
          ...buildProposalV5PreviewSnapshot().economics.contribution,
          value: null,
          state: "to_confirm",
        },
        selectedMediaSpend: {
          ...buildProposalV5PreviewSnapshot().economics.selectedMediaSpend,
          value: null,
          state: "to_confirm",
        },
        recurringBreakEvenUnits: null,
        firstMonthBreakEvenUnits: null,
      },
      readiness: {
        ...buildProposalV5PreviewSnapshot().readiness,
        breakEven: {
          canDisplayValues: false,
          state: "to_confirm",
          missingFields: ["economics.contribution.value"],
        },
      },
      links: {
        ...buildProposalV5PreviewSnapshot().links,
        acceptUrl: "javascript:alert(1)",
        questionUrl: "https://clinicgrower.co.uk/question",
      },
    };
    const html = renderRealRecord(snapshot, "v5-mobile");

    expect(html).toContain("Commercial values stay gated");
    expect(html).not.toContain("javascript:alert");
    expect(html).not.toContain("Approve proposal</a>");
    expect(html).toContain("https://clinicgrower.co.uk/question");
  });

  it("does not allow fixture data to supply the real-record preview path", () => {
    const source = readFileSync("app/app/crm/proposals/preview/v5-real-record-preview.tsx", "utf8");

    expect(source).not.toContain("previewSnapshot");
    expect(source).not.toContain("buildProposalV5PreviewSnapshot");
    expect(source).not.toContain("fixture");
    expect(source).not.toContain("demo proposal");
    expect(source).not.toContain("hardcoded package");
    expect(source).not.toContain("hardcoded clinic type");
    expect(source).not.toContain("hardcoded pricing");
  });

  it("makes the normal CRM proposal preview route V5-only by default", () => {
    const source = readFileSync("app/app/crm/proposals/preview/page.tsx", "utf8");

    expect(source).toContain("ProposalV5RealRecordPreviewContent");
    expect(source).toContain('searchParams.get("renderer") || "v5"');
    expect(source).not.toContain("ClinicGrowerProposalTemplate");
    expect(source).not.toContain("ProposalLegacyPreviewPageContent");
  });

  it("guards the editor V5 live preview until required page data is complete", () => {
    const source = readFileSync("app/app/crm/proposals/edit/page.tsx", "utf8");

    expect(source).toContain("getV5Page01MissingFields");
    expect(source).toContain("getProposalV5PreviewMissingFields");
    expect(source).toContain("Complete these V5 preview fields");
    expect(source).toContain("proposalV5Preview.missingItems");
    expect(source).toContain("proposalV5Preview.snapshot ? (");
  });

  it("keeps the public proposal route on public-safe V5 desktop/mobile/print paths only", () => {
    const publicSource = readFileSync("app/proposals/shared/shared-proposal-content.tsx", "utf8");

    expect(publicSource).not.toContain("ClinicGrowerProposalTemplate");
    expect(publicSource).toContain("ProposalV5Renderer");
    expect(publicSource).toContain("ProposalV5MobileRenderer");
    expect(publicSource).toContain("ProposalV5PrintRenderer");
    expect(publicSource).toContain("isProposalV5PublicSnapshot");
    expect(publicSource).not.toContain("buildProposalV5Snapshot");
    expect(publicSource).not.toContain("buildProposalV5PreviewSnapshot");
    expect(publicSource).not.toContain("v5-real-record-preview");
  });

  it("does not wire the legacy proposal renderer into active proposal routes", () => {
    const activeRouteFiles = [
      "app/app/crm/proposals/edit/page.tsx",
      "app/app/crm/proposals/preview/page.tsx",
      "app/app/crm/proposals/preview/v5-real-record-preview.tsx",
      "app/proposals/shared/shared-proposal-content.tsx",
    ];

    activeRouteFiles.forEach((filePath) => {
      const source = readFileSync(filePath, "utf8");
      expect(source).not.toContain("ClinicGrowerProposalTemplate");
      expect(source).not.toContain("clinicgrower-proposal-template");
    });
  });
});
