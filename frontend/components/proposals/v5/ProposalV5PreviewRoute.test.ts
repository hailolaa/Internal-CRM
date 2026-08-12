import { existsSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { metadata } from "@/app/app/crm/proposals/v5-preview/page";
import { ProposalV5PrivatePreviewView } from "@/app/app/crm/proposals/v5-preview/v5-preview-content";
import {
  buildProposalV5PreviewSnapshot,
  getProposalV5PreviewAssetUrls,
  listProposalV5PreviewClinicTypes,
  proposalV5PreviewPackages,
} from "./data/previewSnapshot";
import { ProposalV5Renderer } from "./renderer/ProposalV5Renderer";

function publicAssetExists(url: string) {
  return existsSync(join(process.cwd(), "public", url.replace(/^\//, "")));
}

describe("private V5 proposal preview route", () => {
  it("is noindex and renders the isolated V5 renderer inside the internal preview route", async () => {
    const html = renderToStaticMarkup(
      createElement(ProposalV5PrivatePreviewView, {
        clinicTypeInput: "dental_clinic",
        packageIdInput: "clinic-growth-engine",
      }),
    );

    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(html).toContain("proposal-v5-private-preview");
    expect(html).toContain("proposal-v5-private-preview-print-root");
    expect(html).toContain("proposal-v5-renderer");
    expect(html.match(/data-v5-page-id=/g)).toHaveLength(19);
    expect(html).toContain("BristolDent Harbourside");
    expect(html).toContain("Clinic Growth Engine");
    expect(html).not.toContain("/proposals/shared?token=");
  });

  it("builds preview snapshots through the real V5 snapshot contract for every clinic type", () => {
    const coverImages = new Set<string>();

    listProposalV5PreviewClinicTypes().forEach((clinicType) => {
      const snapshot = buildProposalV5PreviewSnapshot({
        clinicType,
        packageId: "clinic-growth-engine",
      });
      const html = renderToStaticMarkup(createElement(ProposalV5Renderer, { snapshot }));

      expect(snapshot.schemaVersion).toBe("proposal_v5");
      expect(snapshot.pageCount).toBe(19);
      expect(snapshot.pages).toHaveLength(19);
      expect(snapshot.clinic.clinicType).toBe(clinicType);
      expect(snapshot.selectedPackage.id).toBe("clinic-growth-engine");
      expect(snapshot.assets.sectorImages.cover.url).toMatch(/^\/brand\/proposal\/v5-reference\//);
      expect(html.match(/data-v5-page-id=/g)).toHaveLength(19);
      coverImages.add(snapshot.assets.sectorImages.cover.url || "");
    });

    expect(coverImages.size).toBeGreaterThan(1);
  });

  it("keeps clinic type and package selection independent across package previews", () => {
    const dentalByPackage = proposalV5PreviewPackages.map((packageRecord) =>
      buildProposalV5PreviewSnapshot({
        clinicType: "dental_clinic",
        packageId: packageRecord.id,
      }),
    );
    const aestheticsMarketLeader = buildProposalV5PreviewSnapshot({
      clinicType: "aesthetic_clinic",
      packageId: "market-leader",
    });

    dentalByPackage.forEach((snapshot, index) => {
      expect(snapshot.clinic.clinicType).toBe("dental_clinic");
      expect(snapshot.selectedPackage.id).toBe(proposalV5PreviewPackages[index].id);
      expect(snapshot.scope[0]?.title).toBeTruthy();
    });

    expect(aestheticsMarketLeader.clinic.clinicType).toBe("aesthetic_clinic");
    expect(aestheticsMarketLeader.selectedPackage.id).toBe("market-leader");
    expect(aestheticsMarketLeader.scope[0]?.title).toContain("Senior market leadership");
  });

  it("has real public assets for the private preview snapshot", () => {
    const snapshot = buildProposalV5PreviewSnapshot({
      clinicType: "dental_clinic",
      packageId: "clinic-growth-engine",
    });
    const assetUrls = getProposalV5PreviewAssetUrls(snapshot);

    expect(assetUrls).toContain("/brand/clinic-grower-logo-inline.png");
    expect(assetUrls).toContain("/brand/proposal/v5-reference/dental_practices/p01-img02-1672x941.png");
    expect(assetUrls.every(publicAssetExists)).toBe(true);
  });

  it("renders the long-content preview without changing page count or selected package", () => {
    const snapshot = buildProposalV5PreviewSnapshot({
      clinicType: "private_gp_medical_clinic",
      packageId: "growth-engine-plus",
      longContent: true,
    });
    const html = renderToStaticMarkup(createElement(ProposalV5Renderer, { snapshot }));

    expect(snapshot.clinic.clinicType).toBe("private_gp_medical_clinic");
    expect(snapshot.selectedPackage.id).toBe("growth-engine-plus");
    expect(snapshot.scope.some((item) => item.title?.includes("Extended responsibility"))).toBe(true);
    expect(html.match(/data-v5-page-id=/g)).toHaveLength(19);
  });

  it("can render an already persisted frozen snapshot without rebuilding fixture data", () => {
    const snapshot = buildProposalV5PreviewSnapshot({
      clinicType: "dental_clinic",
      packageId: "clinic-growth-engine",
    });
    const html = renderToStaticMarkup(
      createElement(ProposalV5PrivatePreviewView, {
        persistedSnapshot: snapshot,
        persistedProposalName: "Persisted V5 Proposal",
      }),
    );

    expect(html).toContain("Rendering the frozen V5 snapshot stored on Persisted V5 Proposal");
    expect(html).toContain(snapshot.snapshotHash);
    expect(html.match(/data-v5-page-id=/g)).toHaveLength(19);
  });
});
