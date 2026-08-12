import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProposalV5Renderer, proposalV5MobilePageIds } from "@/components/proposals/v5";
import { buildProposalV5PreviewSnapshot } from "@/components/proposals/v5/data/previewSnapshot";
import type { ProposalV5PublicSnapshot, ProposalV5Snapshot } from "@/components/proposals/v5/data/proposalV5Types";
import type { ProposalPublicPreviewRecord, ProposalPublicRecordWithV5 } from "@/lib/api-types/proposals";
import { resolveSharedProposalRenderModel, SharedProposalV5Document, SharedProposalV5PrintDocument } from "./shared-proposal-content";

function toPublicSnapshot(snapshot: ProposalV5Snapshot): ProposalV5PublicSnapshot {
  const publicSnapshot = JSON.parse(JSON.stringify(snapshot));
  delete publicSnapshot.snapshotHash;
  delete publicSnapshot.sourceProposalVersion;
  delete publicSnapshot.selectedPackage.id;
  delete publicSnapshot.selectedPackage.catalogueVersion;
  publicSnapshot.proof.forEach((asset: Record<string, unknown>) => {
    delete asset.id;
  });
  Object.values(publicSnapshot.assets.sectorImages).forEach((image) => {
    delete (image as Record<string, unknown>).imageId;
  });
  publicSnapshot.assets.osScreens.forEach((image: Record<string, unknown>) => {
    delete image.imageId;
  });
  if (publicSnapshot.assets.founderVideoThumbnail) delete publicSnapshot.assets.founderVideoThumbnail.imageId;
  if (publicSnapshot.assets.postBookingScreenshot) delete publicSnapshot.assets.postBookingScreenshot.imageId;
  if (publicSnapshot.assets.implementationImage) delete publicSnapshot.assets.implementationImage.imageId;
  delete publicSnapshot.acceptance.lockedSnapshotHash;
  return publicSnapshot;
}

function publicProposal(overrides: Partial<ProposalPublicRecordWithV5> = {}): ProposalPublicRecordWithV5 {
  return {
    proposalName: "Public proposal",
    templateKey: "clinicgrower_v5",
    packageName: "Mutable package must not render",
    valueCents: 1,
    monthlyFeeCents: 1,
    setupFeeCents: 1,
    currency: "GBP",
    adSpendNote: "Mutable ad spend must not render",
    vatStatus: "mutable_vat",
    minimumTermMonths: 1,
    noticePeriodDays: 1,
    startDate: "2026-09-01",
    expiresAt: "2026-09-30T23:59:59.000Z",
    addOns: [],
    discounts: [],
    sectionContent: null,
    coreData: null,
    contactName: "Mutable contact",
    accountName: "Mutable account",
    clientAccountName: null,
    v5Snapshot: null,
    v5SnapshotSchemaVersion: null,
    ...overrides,
  };
}

function publicPreview(proposal: ProposalPublicRecordWithV5): ProposalPublicPreviewRecord {
  return {
    proposal,
    packageRecord: null,
    acceptance: null,
    acceptanceUrl: "https://crm.clinicgrower.co.uk/proposals/shared/?token=public",
    acceptanceQrCodeDataUrl: null,
  };
}

function extractProofPair(html: string, title: string) {
  const titleIndex = html.indexOf(title);
  expect(titleIndex, `${title} should render`).toBeGreaterThanOrEqual(0);
  const articleStart = html.lastIndexOf("<article", titleIndex);
  const articleEnd = html.indexOf("</article>", titleIndex);
  expect(articleStart, `${title} should render inside a proof pair`).toBeGreaterThanOrEqual(0);
  expect(articleEnd, `${title} proof pair should close`).toBeGreaterThanOrEqual(titleIndex);
  return html.slice(articleStart, articleEnd);
}

describe("shared public proposal V5 routing", () => {
  it("renders a public-safe V5 proposal through the V5 renderer", () => {
    const internalSnapshot = buildProposalV5PreviewSnapshot();
    const snapshot = toPublicSnapshot(internalSnapshot);
    const model = resolveSharedProposalRenderModel(publicPreview(publicProposal({ v5Snapshot: snapshot })));

    expect(model.kind).toBe("v5");
    if (model.kind !== "v5") throw new Error("Expected public V5 model");
    const html = renderToStaticMarkup(createElement(ProposalV5Renderer, { snapshot: model.snapshot }));

    expect(html).toContain("proposal-v5-renderer");
    expect(html).toContain("CG-V5-PREVIEW-001");
    expect(html).toContain(snapshot.clinic.name.value as string);
    expect(html).not.toContain(internalSnapshot.snapshotHash);
    expect(html).not.toContain(internalSnapshot.sourceProposalVersion);
  });

  it("renders desktop and mobile public V5 from the same public-safe snapshot", () => {
    const internalSnapshot = buildProposalV5PreviewSnapshot({
      clinicType: "dental_clinic",
      packageId: "clinic-growth-engine",
    });
    const snapshot = toPublicSnapshot(internalSnapshot);
    const desktopHtml = renderToStaticMarkup(createElement(SharedProposalV5Document, { snapshot, isMobile: false }));
    const mobileHtml = renderToStaticMarkup(createElement(SharedProposalV5Document, { snapshot, isMobile: true }));

    expect(desktopHtml).toContain("proposal-v5-renderer");
    expect(desktopHtml).not.toContain("proposal-v5-mobile-renderer");
    expect(mobileHtml).toContain("proposal-v5-mobile-renderer");
    expect(mobileHtml).not.toContain("proposal-v5-renderer");

    for (const clientFacingValue of [
      snapshot.proposal.reference,
      snapshot.clinic.name.value,
      snapshot.clinic.typeShortLabel,
      snapshot.selectedPackage.name,
      snapshot.scope[0]?.title,
      snapshot.proof[0]?.title,
    ]) {
      expect(desktopHtml).toContain(clientFacingValue as string);
      expect(mobileHtml).toContain(clientFacingValue as string);
    }
  });

  it("preserves all 19 page IDs in the public mobile renderer without A4 squeezing", () => {
    const snapshot = toPublicSnapshot(buildProposalV5PreviewSnapshot());
    const mobileHtml = renderToStaticMarkup(createElement(SharedProposalV5Document, { snapshot, isMobile: true }));

    expect(mobileHtml.match(/data-v5-page-id=/g)).toHaveLength(19);
    proposalV5MobilePageIds.forEach((pageId) => {
      expect(mobileHtml).toContain(`data-v5-page-id="${pageId}"`);
    });
    expect(mobileHtml).toContain("max-width:var(--proposal-v5-mobile-max-width)");
    expect(mobileHtml).not.toContain("width:210mm");
    expect(mobileHtml).not.toContain("height:297mm");
  });

  it("renders the public V5 print document from the same public-safe frozen snapshot", () => {
    const internalSnapshot = buildProposalV5PreviewSnapshot({
      clinicType: "dental_clinic",
      packageId: "clinic-growth-engine",
    });
    const snapshot = toPublicSnapshot(internalSnapshot);
    const printHtml = renderToStaticMarkup(createElement(SharedProposalV5PrintDocument, { snapshot }));

    expect(printHtml).toContain("proposal-v5-public-print");
    expect(printHtml).toContain("proposal-v5-print-root");
    expect(printHtml).toContain('data-v5-print-page-count="19"');
    expect(printHtml.match(/data-v5-page-id=/g)).toHaveLength(19);
    expect(printHtml.match(/width:210mm;height:297mm/g)).toHaveLength(19);
    expect(printHtml).not.toContain('data-v5-page-number="20"');
    expect(printHtml).toContain(snapshot.proposal.reference);
    expect(printHtml).toContain(snapshot.clinic.name.value as string);
    expect(printHtml).toContain(snapshot.selectedPackage.name as string);
    expect(printHtml).toContain(snapshot.scope[0]?.title as string);
    expect(printHtml).not.toContain(internalSnapshot.snapshotHash);
    expect(printHtml).not.toContain(internalSnapshot.sourceProposalVersion);
    expect(printHtml).not.toContain(internalSnapshot.selectedPackage.id as string);
  });

  it("fails safely when a public proposal has no frozen V5 snapshot", () => {
    const model = resolveSharedProposalRenderModel(publicPreview(publicProposal({ templateKey: "clinicgrower_growth_engine" })));

    expect(model.kind).toBe("invalid_v5");
    expect(model).toMatchObject({ message: "This proposal version could not be opened." });
  });

  it("does not fall back when a V5 proposal is missing its frozen snapshot", () => {
    const model = resolveSharedProposalRenderModel(publicPreview(publicProposal({ templateKey: "clinicgrower_v5", v5Snapshot: null })));

    expect(model.kind).toBe("invalid_v5");
  });

  it("fails safely when the public V5 snapshot is corrupt", () => {
    const snapshot = toPublicSnapshot(buildProposalV5PreviewSnapshot()) as Record<string, unknown>;
    snapshot.pageCount = 18;
    const model = resolveSharedProposalRenderModel(publicPreview(publicProposal({ v5Snapshot: snapshot as never })));

    expect(model.kind).toBe("invalid_v5");
    expect(model).toMatchObject({ message: "This proposal version could not be opened." });
  });

  it("fails safely when internal hash metadata is present on the public snapshot", () => {
    const snapshot = toPublicSnapshot(buildProposalV5PreviewSnapshot()) as Record<string, unknown>;
    snapshot.snapshotHash = "0".repeat(64);
    const model = resolveSharedProposalRenderModel(publicPreview(publicProposal({ v5Snapshot: snapshot as never })));

    expect(model.kind).toBe("invalid_v5");
  });

  it("does not use raw sectionContent or coreData on the V5 public path", () => {
    const snapshot = toPublicSnapshot(buildProposalV5PreviewSnapshot());
    const model = resolveSharedProposalRenderModel(
      publicPreview(
        publicProposal({
          sectionContent: { personalIntroduction: "RAW SECTION SECRET" },
          coreData: { immutableVersion: "RAW CORE SECRET" } as never,
          v5Snapshot: snapshot,
        }),
      ),
    );

    expect(model.kind).toBe("v5");
    if (model.kind !== "v5") throw new Error("Expected public V5 model");
    const html = renderToStaticMarkup(createElement(ProposalV5Renderer, { snapshot: model.snapshot }));

    expect(html).not.toContain("RAW SECTION SECRET");
    expect(html).not.toContain("RAW CORE SECRET");
  });

  it("passes the exact public snapshot object returned by the API into the renderer decision", () => {
    const snapshot = toPublicSnapshot(buildProposalV5PreviewSnapshot());
    const model = resolveSharedProposalRenderModel(publicPreview(publicProposal({ v5Snapshot: snapshot })));

    expect(model.kind).toBe("v5");
    if (model.kind !== "v5") throw new Error("Expected public V5 model");
    expect(model.snapshot).toBe(snapshot);
  });

  it("keeps internal IDs absent from the public render-safe snapshot", () => {
    const internalSnapshot = buildProposalV5PreviewSnapshot();
    const snapshot = toPublicSnapshot(internalSnapshot);
    const serialized = JSON.stringify(snapshot);

    expect(serialized).not.toContain(internalSnapshot.selectedPackage.id as string);
    expect(serialized).not.toContain(internalSnapshot.proof[0]?.id as string);
    expect(serialized).not.toContain(internalSnapshot.assets.sectorImages.cover.imageId as string);
    expect(serialized).not.toContain(internalSnapshot.snapshotHash);
    expect(serialized).not.toContain(internalSnapshot.sourceProposalVersion);
  });

  it("preserves proof media pairing while stripping internal proof IDs on public V5 output", () => {
    const internalSnapshot = buildProposalV5PreviewSnapshot({ clinicType: "dental_clinic" });
    const internalProofId = internalSnapshot.proof[0]?.id as string;
    const snapshot = toPublicSnapshot({
      ...internalSnapshot,
      proof: internalSnapshot.proof.map((proof, index) => ({
        ...proof,
        mediaUrl: `/brand/proof/public-proof-${index + 1}.webp`,
      })),
    });
    const model = resolveSharedProposalRenderModel(publicPreview(publicProposal({ v5Snapshot: snapshot })));

    expect(model.kind).toBe("v5");
    if (model.kind !== "v5") throw new Error("Expected public V5 model");
    const serialized = JSON.stringify(model.snapshot);
    expect(serialized).not.toContain(internalProofId);
    expect(serialized).toContain("/brand/proof/public-proof-1.webp");

    const desktopHtml = renderToStaticMarkup(createElement(SharedProposalV5Document, { snapshot: model.snapshot, isMobile: false }));
    const mobileHtml = renderToStaticMarkup(createElement(SharedProposalV5Document, { snapshot: model.snapshot, isMobile: true }));
    const printHtml = renderToStaticMarkup(createElement(SharedProposalV5PrintDocument, { snapshot: model.snapshot }));

    for (const html of [desktopHtml, mobileHtml, printHtml]) {
      const firstPair = extractProofPair(html, model.snapshot.proof[0]?.title as string);
      const secondPair = extractProofPair(html, model.snapshot.proof[1]?.title as string);
      expect(firstPair).toContain("/brand/proof/public-proof-1.webp");
      expect(firstPair).not.toContain("/brand/proof/public-proof-2.webp");
      expect(secondPair).toContain("/brand/proof/public-proof-2.webp");
      expect(secondPair).not.toContain("/brand/proof/public-proof-1.webp");
    }
  });
});
