import { existsSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { metadata } from "@/app/app/crm/proposals/v5-print-preview/page";
import { ProposalV5PrivatePrintPreviewView } from "@/app/app/crm/proposals/v5-print-preview/v5-print-preview-content";
import type { ProposalV5EvidenceState, ProposalV5Snapshot } from "./data/proposalV5Types";
import { getProposalV5ProofReadinessMissingFields } from "./data/proofValidation";
import {
  buildProposalV5PreviewSnapshot,
  getProposalV5PreviewAssetUrls,
  listProposalV5PreviewClinicTypes,
  proposalV5PreviewPackages,
} from "./data/previewSnapshot";
import { proposalV5Tokens } from "./design/proposalV5Tokens";
import { proposalV5PageIds, proposalV5PageOrder } from "./pages/pageOrder";
import { ProposalV5PrintRenderer } from "./print/ProposalV5PrintRenderer";

function renderPrint(snapshot: ProposalV5Snapshot) {
  return renderToStaticMarkup(createElement(ProposalV5PrintRenderer, { snapshot }));
}

function extractPrintRoot(html: string) {
  const marker = 'class="proposal-v5-print-root"';
  const start = html.indexOf(marker);
  if (start < 0) return "";
  const articleStart = html.lastIndexOf("<article", start);
  return html.slice(articleStart >= 0 ? articleStart : start);
}

function extractPage(html: string, pageId: string) {
  const marker = `data-v5-page-id="${pageId}"`;
  const start = html.indexOf(marker);
  if (start < 0) return "";
  const sectionStart = html.lastIndexOf("<section", start);
  const next = html.indexOf("data-v5-page-id=", start + marker.length);
  return html.slice(sectionStart >= 0 ? sectionStart : start, next < 0 ? undefined : next);
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

function proofAssetsForCount(count: number) {
  const templates = [
    {
      type: "award",
      title: "Aesthetics Awards proof",
      copy: "Award recognition selected for the proposal proof sequence.",
      mediaUrl: "/brand/proof/award-print-density.webp",
      sectorTags: ["dental", "state:known", "source:ClinicGrower awards library", "timeframe:2025", "disclaimer:Credibility proof only."],
    },
    {
      type: "case_study",
      title: "Dental case study proof",
      copy: "Dental case study with documented delivery context and relevance to the selected clinic type.",
      mediaUrl: "/brand/proof/case-print-density.webp",
      sectorTags: ["dental", "case study", "state:known", "source:ClinicGrower proof library", "timeframe:90 days", "disclaimer:Contextual proof only."],
    },
    {
      type: "testimonial",
      title: "Permissioned testimonial proof",
      copy: "Permission approved clinic owner testimonial selected for this proposal.",
      mediaUrl: null,
      sectorTags: ["dental", "permission approved", "state:known", "source:ClinicGrower testimonial library", "timeframe:Permissioned testimonial", "disclaimer:Permissioned proof only."],
    },
    {
      type: "performance_result",
      title: "Booked-consultation result",
      copy: "Over 90 days, enquiry and booking accountability became clearer against the selected delivery context.",
      mediaUrl: "/brand/proof/result-print-density.webp",
      sectorTags: ["dental", "state:known", "proof_scope:Dental delivery proof.", "source:ClinicGrower proof library", "timeframe:90 days", "disclaimer:Historical proof only."],
    },
    {
      type: "product_screenshot",
      title: "ClinicGrower OS screenshot",
      copy: "ClinicGrower OS screenshot showing leakage visibility and next actions where connected.",
      mediaUrl: "/brand/proof/os-print-density.webp",
      sectorTags: ["dental", "clinicgrower os", "product screenshot", "state:known", "source:ClinicGrower OS screenshot library", "timeframe:Current V5 reference", "disclaimer:Illustrative where connected."],
    },
  ] as const;

  return Array.from({ length: count }, (_, index) => {
    const template = templates[index % templates.length];
    return {
      ...template,
      id: `print-density-proof-${index + 1}`,
      title: `${template.title} ${index + 1}`,
      mediaUrl: index % 4 === 2 ? null : template.mediaUrl,
      sectorTags: [...template.sectorTags],
      sortOrder: index + 1,
      isActive: true,
      createdAt: "2026-08-10T09:00:00.000Z",
      updatedAt: "2026-08-10T09:00:00.000Z",
      state: "known" as const,
      proofMode: null,
      proofScope: index % 5 === 3 ? "Dental delivery proof." : null,
      source: template.sectorTags.find((tag) => tag.startsWith("source:"))?.replace("source:", "") || null,
      timeframe: template.sectorTags.find((tag) => tag.startsWith("timeframe:"))?.replace("timeframe:", "") || null,
      disclaimer: template.sectorTags.find((tag) => tag.startsWith("disclaimer:"))?.replace("disclaimer:", "") || null,
    };
  });
}

function publicAssetExists(url: string) {
  return existsSync(join(process.cwd(), "public", url.replace(/^\//, "")));
}

function withBreakEvenState(snapshot: ProposalV5Snapshot, state: ProposalV5EvidenceState): ProposalV5Snapshot {
  return {
    ...snapshot,
    economics: {
      ...snapshot.economics,
      contribution: {
        ...snapshot.economics.contribution,
        value: null,
        state,
      },
      selectedMediaSpend: {
        ...snapshot.economics.selectedMediaSpend,
        value: null,
        state,
      },
      recurringBreakEvenUnits: null,
      firstMonthBreakEvenUnits: null,
    },
    readiness: {
      ...snapshot.readiness,
      breakEven: {
        canDisplayValues: false,
        state,
        missingFields: ["economics.contribution.value", "economics.selectedMediaSpend.value"],
      },
    },
  };
}

describe("ProposalV5PrintRenderer", () => {
  it("accepts ProposalV5Snapshot only and rejects raw proposal-shaped data", () => {
    const snapshot = buildProposalV5PreviewSnapshot();
    expect(renderPrint(snapshot)).toContain("proposal-v5-print-root");
    expect(() => renderToStaticMarkup(createElement(ProposalV5PrintRenderer, { snapshot: { id: "raw-proposal" } as never }))).toThrow(
      /ProposalV5PrintRenderer requires ProposalV5Snapshot/,
    );
  });

  it("renders exactly 19 A4 print pages in the approved order with no Page 20", () => {
    const html = renderPrint(buildProposalV5PreviewSnapshot());

    expect(html.match(/data-v5-page-id=/g)).toHaveLength(19);
    expect(html.match(/width:210mm;height:297mm/g)).toHaveLength(19);
    expect((html.match(/width:176mm/g) || []).length).toBeGreaterThanOrEqual(19);
    expect(html.match(/max-height:297mm/g)).toHaveLength(19);
    expect(html).toContain('data-v5-print-page-count="19"');
    expect(html).not.toContain('data-v5-page-number="20"');

    proposalV5PageOrder.forEach((page) => {
      const pageHtml = extractPage(html, page.id);
      expect(pageHtml).toContain(`data-v5-page-number="${page.pageNumber}"`);
      expect(pageHtml).toContain(`data-v5-page-theme="${page.theme}"`);
    });
    expect(proposalV5PageIds).toEqual(proposalV5PageOrder.map((page) => page.id));
  });

  it("preserves the approved dark/light rhythm in the print renderer", () => {
    const html = renderPrint(buildProposalV5PreviewSnapshot());
    const darkPages = proposalV5PageOrder.filter((page) => page.theme === "dark").map((page) => page.pageNumber);

    expect(darkPages).toEqual(proposalV5Tokens.darkPages);
    proposalV5PageOrder.forEach((page) => {
      const pageHtml = extractPage(html, page.id);
      expect(pageHtml).toContain(`data-v5-page-theme="${page.theme}"`);
    });
  });

  it("does not use legacy proposal print classes or public proposal route wiring", () => {
    const html = renderPrint(buildProposalV5PreviewSnapshot());

    expect(html).not.toContain("proposal-print-root");
    expect(html).not.toContain("proposal-client-document");
    expect(html).not.toContain("proposal-cover-page");
    expect(html).not.toContain("proposal-intro-page");
    expect(html).not.toContain("/proposals/shared?token=");
  });

  it("keeps the private print preview noindex and renders through the isolated print renderer", () => {
    const html = renderToStaticMarkup(
      createElement(ProposalV5PrivatePrintPreviewView, {
        clinicTypeInput: "dental_clinic",
        packageIdInput: "clinic-growth-engine",
        longContent: true,
      }),
    );

    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(html).toContain("proposal-v5-print-preview");
    expect(html).toContain("proposal-v5-print-root");
    expect(html).toContain("Print / save PDF");
    expect(extractPrintRoot(html).match(/data-v5-page-id=/g)).toHaveLength(19);
  });

  it("uses a persisted frozen snapshot as authoritative when one is supplied", () => {
    const persistedSnapshot = buildProposalV5PreviewSnapshot({
      clinicType: "dental_clinic",
      packageId: "clinic-growth-engine",
    });
    const html = renderToStaticMarkup(
      createElement(ProposalV5PrivatePrintPreviewView, {
        clinicTypeInput: "aesthetic_clinic",
        packageIdInput: "market-leader",
        persistedSnapshot,
        persistedProposalName: "Frozen V5 Proposal",
      }),
    );
    const printRoot = extractPrintRoot(html);
    const investment = extractPage(printRoot, "V5Page18Investment");

    expect(html).toContain("Rendering the frozen V5 snapshot stored on Frozen V5 Proposal");
    expect(printRoot).toContain("BristolDent Harbourside");
    expect(printRoot).not.toContain("Harbourside Aesthetics Clinic");
    expect(investment).toContain("Clinic Growth Engine");
    expect(investment).not.toContain("Market Leader");
  });

  it("keeps long and extreme clinic names inside Page 01 with cover metadata still present", () => {
    const longHtml = extractPage(renderPrint(buildProposalV5PreviewSnapshot({ longContent: true })), "V5Page01Cover");
    const extremeRouteHtml = renderToStaticMarkup(
      createElement(ProposalV5PrivatePrintPreviewView, {
        clinicTypeInput: "dental_clinic",
        packageIdInput: "clinic-growth-engine",
        extremeContent: true,
      }),
    );
    const extremeCover = extractPage(extractPrintRoot(extremeRouteHtml), "V5Page01Cover");

    [longHtml, extremeCover].forEach((cover) => {
      expect(cover).toContain("Prepared for");
      expect(cover).toContain("Location");
      expect(cover).toContain("Programme");
      expect(cover).toContain("Valid until");
      expect(cover).toContain('data-v5-page-number="1"');
    });
    expect(extremeCover).toContain("The Very Long Multi Location Private Dental Aesthetic Surgical Medical Spa Group");
  });

  it("preserves Page 12 economics gating and never prints values when not ready", () => {
    const gatedSnapshot = withBreakEvenState(buildProposalV5PreviewSnapshot(), "to_confirm");
    const page = extractPage(renderPrint(gatedSnapshot), "V5Page12BreakEven");

    expect(page).toContain("To confirm");
    expect(page).toContain("______ contribution");
    expect(page).toContain("______ investment");
    expect(page).not.toContain("\u00a33,000 contribution");
    expect(page).not.toContain("\u00a35,495 investment");
  });

  it("renders Page 15 from package-specific scope held in the snapshot", () => {
    const scopeTitles = new Set<string>();

    proposalV5PreviewPackages.forEach((packageRecord) => {
      const snapshot = buildProposalV5PreviewSnapshot({ packageId: packageRecord.id });
      const page = extractPage(renderPrint(snapshot), "V5Page15ScopeMatrix");

      expect(snapshot.selectedPackage.id).toBe(packageRecord.id);
      expect(snapshot.scope.length).toBeGreaterThan(0);
      expect(page).toContain(snapshot.scope[0].title as string);
      expect(page).toContain(snapshot.scope[0].owner as string);
      expect(page).toContain(snapshot.scope[0].exclusion as string);
      expect(page).not.toContain(packageRecord.id);
      scopeTitles.add(snapshot.scope[0].title as string);
    });

    expect(scopeTitles.size).toBeGreaterThan(4);
  });

  it("prints selected Page 17 proof while readiness reports clinic mismatches separately", () => {
    const snapshot = buildProposalV5PreviewSnapshot({ clinicType: "dental_clinic" });
    const proofSnapshot: ProposalV5Snapshot = {
      ...snapshot,
      proof: [
        ...snapshot.proof,
        {
          id: "hair-proof-should-not-render",
          type: "case_study",
          title: "Selected hair transplant proof with mismatch warning",
          copy: "Known proof with the wrong clinic tag.",
          mediaUrl: "/brand/proof/tanja-phillips.webp",
          sectorTags: [
            "hair-transplant",
            "state:known",
            "source:ClinicGrower proof library",
            "timeframe:Documented delivery period",
            "disclaimer:Wrong-sector proof must not render.",
          ],
          state: "known",
          proofMode: null,
          proofScope: null,
          source: "ClinicGrower proof library",
          timeframe: "Documented delivery period",
          disclaimer: "Wrong-sector proof must not render.",
        },
      ],
    };
    const proof = extractPage(renderPrint(proofSnapshot), "V5Page17Proof");

    expect(getProposalV5ProofReadinessMissingFields(proofSnapshot)).toContain("proof.clinic_type_match");
    expect(proof).toContain("Dr Tanja Phillips");
    expect(proof).toContain("ClinicGrower approved proof library");
    expect(proof).toContain("Documented delivery period");
    expect(proof).not.toMatch(/href="\/brand\//);
    expect(proof).toContain("Selected hair transplant proof with mismatch warning");
    expect(proof).toContain("/brand/proof/tanja-phillips.webp");
    expect(proof).not.toContain("No relevant proof assets are selected");
  });

  it("preserves proof/media pairing in the print renderer", () => {
    const snapshot = buildProposalV5PreviewSnapshot({ clinicType: "dental_clinic" });
    const proofSnapshot: ProposalV5Snapshot = {
      ...snapshot,
      proof: snapshot.proof.map((proof, index) => ({
        ...proof,
        mediaUrl: `/brand/proof/print-proof-${index + 1}.webp`,
      })),
    };
    const proof = extractPage(renderPrint(proofSnapshot), "V5Page17Proof");

    for (const [index, asset] of proofSnapshot.proof.entries()) {
      const pair = extractProofPair(proof, asset.title as string);
      expect(pair).toContain(`/brand/proof/print-proof-${index + 1}.webp`);
      if (index > 0) expect(pair).not.toContain("/brand/proof/print-proof-1.webp");
    }
  });

  it("prints every selected Page 17 proof with the same adaptive density", () => {
    const proofAssets = proofAssetsForCount(20);
    const proofSnapshot: ProposalV5Snapshot = {
      ...buildProposalV5PreviewSnapshot({ clinicType: "dental_clinic" }),
      proof: proofAssets,
    };
    const html = renderPrint(proofSnapshot);
    const proof = extractPage(html, "V5Page17Proof");

    expect(html.match(/data-v5-page-id=/g)).toHaveLength(19);
    expect(html).not.toContain('data-v5-page-number="20"');
    expect(proof).toContain('data-v5-page-17-proof-count="20"');
    expect(proof).toContain('data-v5-page-17-density="maximum"');
    expect(proof).toContain('data-v5-proof-count="20"');
    expect(proof).toContain('data-v5-proof-density="maximum"');
    expect((proof.match(/data-v5-proof-pair/g) || [])).toHaveLength(20);

    proofAssets.forEach((asset) => {
      const pair = extractProofPair(proof, asset.title);
      if (asset.mediaUrl) {
        expect(pair).toContain(asset.mediaUrl);
      } else {
        expect(pair).toContain("Evidence summary");
      }
    });
  });

  it("renders Page 18 only from snapshot commercial values", () => {
    const snapshot = buildProposalV5PreviewSnapshot({ packageId: "market-leader" });
    const investment = extractPage(renderPrint(snapshot), "V5Page18Investment");

    expect(investment).toContain("Market Leader");
    expect(investment).toContain("\u00a34,995");
    expect(investment).toContain("\u00a3995");
    expect(investment).toContain("+ VAT");
    expect(investment).toContain("Selected media");
    expect(investment).toContain("Decision point");
    expect(investment).not.toContain("market-leader");
    expect(investment).not.toContain(snapshot.snapshotHash);
    expect(investment).not.toContain(snapshot.sourceProposalVersion);
  });

  it("keeps Page 19 customer-facing and hides snapshot/internal metadata", () => {
    const snapshot = buildProposalV5PreviewSnapshot();
    const close = extractPage(renderPrint(snapshot), "V5Page19Close");

    expect(close).toContain("Review and accept online");
    expect(close).toContain("Ask a question");
    expect(close).toContain("#accept-preview");
    expect(close).toContain("mailto:hello@clinicgrower.co.uk");
    expect(close).not.toContain(snapshot.snapshotHash);
    expect(close).not.toContain(snapshot.sourceProposalVersion);
    expect(close).not.toMatch(/internal id|package id|proof id|image id|snapshot hash|source version/i);
    expect(close).not.toMatch(/localhost|data-proposal-v5/i);
  });

  it("resolves required public assets used by the print preview snapshots", () => {
    listProposalV5PreviewClinicTypes().forEach((clinicType) => {
      const snapshot = buildProposalV5PreviewSnapshot({ clinicType, packageId: "clinic-growth-engine" });
      const assetUrls = getProposalV5PreviewAssetUrls(snapshot);

      expect(assetUrls).toContain("/brand/clinic-grower-logo-inline.png");
      expect(assetUrls.length).toBeGreaterThan(8);
      expect(assetUrls.every(publicAssetExists)).toBe(true);
    });
  });

  it("renders all eight clinic variants without falling back to the aesthetic variant", () => {
    const coverImages = new Set<string>();

    listProposalV5PreviewClinicTypes().forEach((clinicType) => {
      const snapshot = buildProposalV5PreviewSnapshot({ clinicType, packageId: "clinic-growth-engine" });
      const html = renderPrint(snapshot);

      expect(snapshot.clinic.clinicType).toBe(clinicType);
      expect(html).toContain(snapshot.clinic.typeShortLabel);
      expect(html).toContain(snapshot.clinic.name.value as string);
      expect(html.match(/data-v5-page-id=/g)).toHaveLength(19);
      coverImages.add(snapshot.assets.sectorImages.cover.url || "");
      if (clinicType !== "aesthetic_clinic") {
        expect(snapshot.assets.sectorImages.cover.url).not.toContain("/aesthetic_clinics/");
      }
    });

    expect(coverImages.size).toBe(8);
  });

  it("renders all canonical V5 packages with package-specific scope and investment values", () => {
    proposalV5PreviewPackages.forEach((packageRecord) => {
      const snapshot = buildProposalV5PreviewSnapshot({
        clinicType: "dental_clinic",
        packageId: packageRecord.id,
      });
      const html = renderPrint(snapshot);
      const scope = extractPage(html, "V5Page15ScopeMatrix");
      const investment = extractPage(html, "V5Page18Investment");

      expect(snapshot.selectedPackage.id).toBe(packageRecord.id);
      expect(scope).toContain(snapshot.scope[0].title as string);
      expect(investment).toContain(packageRecord.name);
      expect(investment).not.toContain(packageRecord.id);
    });
  });

  it("does not render filler, fallback copy or internal metadata inside the printable proposal", () => {
    const snapshot = buildProposalV5PreviewSnapshot();
    const html = renderPrint(snapshot);

    expect(html).not.toMatch(/Lorem ipsum|placeholder|fallback|required before sending|localhost/i);
    expect(html).not.toMatch(/snapshot hash|source version|package id|proof id|image id/i);
    expect(html).not.toContain(snapshot.snapshotHash);
    expect(html).not.toContain(snapshot.sourceProposalVersion);
    expect(html).not.toContain(snapshot.selectedPackage.id);
  });
});
