import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildProposalV5PreviewSnapshot, listProposalV5PreviewClinicTypes, proposalV5PreviewPackages } from "./data/previewSnapshot";
import { proposalV5Tokens } from "./design/proposalV5Tokens";
import { ProposalV5Renderer, isProposalV5Snapshot } from "./renderer/ProposalV5Renderer";
import { proposalV5PageIds, proposalV5PageOrder } from "./pages/pageOrder";

const expectedPageIds = [
  "V5Page01Cover",
  "V5Page02Recommendation",
  "V5Page03GoogleMediaRoas",
  "V5Page04GrowthEngine",
  "V5Page05GoogleAds",
  "V5Page06LandingConversion",
  "V5Page07SeoGbpWebsite",
  "V5Page08TrackingOptimisation",
  "V5Page09Roadmap",
  "V5Page10ManagementScope",
  "V5Page11PublishedProof",
  "V5Page12WhyClinicGrower",
  "V5Page13PartnershipInvestment",
  "V5Page14BillingTerms",
  "V5Page15Decision",
] as const;

function render(snapshot = buildProposalV5PreviewSnapshot()) {
  return renderToStaticMarkup(createElement(ProposalV5Renderer, { snapshot }));
}

describe("ProposalV5Renderer V19", () => {
  it("registers exactly 15 pages in the approved V19 order and dark rhythm", () => {
    expect(proposalV5PageOrder).toHaveLength(15);
    expect(proposalV5PageIds).toEqual(expectedPageIds);
    expect(proposalV5PageOrder.map((page) => page.pageNumber)).toEqual(Array.from({ length: 15 }, (_, index) => index + 1));
    expect(proposalV5PageOrder.filter((page) => page.theme === "dark").map((page) => page.pageNumber)).toEqual([
      ...proposalV5Tokens.darkPages,
    ]);
  });

  it("builds and renders a 15-page snapshot without Page 16", () => {
    const snapshot = buildProposalV5PreviewSnapshot({ clinicType: "dental_clinic", packageId: "clinic-growth" });
    const html = render(snapshot);

    expect(isProposalV5Snapshot(snapshot)).toBe(true);
    expect(snapshot.pageCount).toBe(15);
    expect(snapshot.pages.map((page) => page.id)).toEqual(expectedPageIds);
    expect(html.match(/data-v5-page-id=/g)).toHaveLength(15);
    expect(html).toContain('data-v5-page-id="V5Page15Decision"');
    expect(html).not.toContain('data-v5-page-id="V5Page16');
    expect(html).not.toContain('data-v5-page-id="V5Page17');
    expect(html).not.toContain('data-v5-page-id="V5Page18');
    expect(html).not.toContain('data-v5-page-id="V5Page19');
  });

  it("keeps Page 4 readable when the clinic name makes the headline longer", () => {
    const snapshot = buildProposalV5PreviewSnapshot({ clinicType: "dental_clinic", packageId: "clinic-growth" });
    const html = render({
      ...snapshot,
      clinic: {
        ...snapshot.clinic,
        name: {
          ...snapshot.clinic.name,
          value: "BristolDent Harbourside",
        },
      },
    });

    const titleIndex = html.indexOf("ClinicGrower connects BristolDent Harbourside");
    expect(titleIndex).toBeGreaterThanOrEqual(0);
    const titleMarkup = html.slice(html.lastIndexOf("<p", titleIndex), html.indexOf("</p>", titleIndex));
    expect(titleMarkup).toContain("font-size:26pt");

    const bodyIndex = html.indexOf("We connect BristolDent Harbourside");
    expect(bodyIndex).toBeGreaterThanOrEqual(0);
    const bodyMarkup = html.slice(html.lastIndexOf("<p", bodyIndex), html.indexOf("</p>", bodyIndex));
    expect(bodyMarkup).toContain("top:250pt");
  });

  it("keeps Page 7 readable for longer clinic names and preserves title plus first name", () => {
    const snapshot = buildProposalV5PreviewSnapshot({ clinicType: "dental_clinic", packageId: "clinic-growth" });
    const html = render(snapshot);

    const title = "Build BristolDent Harbourside&#x27;s local authority while paid search for Dental implants learns.";
    const titleIndex = html.indexOf(title);
    expect(titleIndex).toBeGreaterThanOrEqual(0);
    const titleMarkup = html.slice(html.lastIndexOf("<p", titleIndex), html.indexOf("</p>", titleIndex));
    expect(titleMarkup).toContain("font-size:25.2pt");
    expect(titleMarkup).toContain("line-height:27.2pt");

    const bodyIndex = html.indexOf("Google Ads captures patients searching now.");
    expect(bodyIndex).toBeGreaterThanOrEqual(0);
    const bodyMarkup = html.slice(html.lastIndexOf("<p", bodyIndex), html.indexOf("</p>", bodyIndex));
    expect(bodyMarkup).toContain("top:252pt");

    expect(html).toContain("What Dr Tanja will see");
    expect(html).not.toContain("What Dr will see");
  });

  it("keeps clinic type and selected package independent", () => {
    const dentalGrowth = buildProposalV5PreviewSnapshot({ clinicType: "dental_clinic", packageId: "clinic-growth" });
    const dentalAudit = buildProposalV5PreviewSnapshot({ clinicType: "dental_clinic", packageId: "free-clinic-growth-audit" });
    const aestheticsGrowth = buildProposalV5PreviewSnapshot({ clinicType: "aesthetic_clinic", packageId: "clinic-growth" });

    expect(dentalGrowth.clinic.clinicType).toBe(dentalAudit.clinic.clinicType);
    expect(dentalGrowth.selectedPackage.name).not.toBe(dentalAudit.selectedPackage.name);
    expect(dentalGrowth.selectedPackage.name).toBe(aestheticsGrowth.selectedPackage.name);
    expect(dentalGrowth.clinic.clinicType).not.toBe(aestheticsGrowth.clinic.clinicType);
  });

  it("renders every clinic variant with sector assets and proof", () => {
    for (const clinicType of listProposalV5PreviewClinicTypes()) {
      const snapshot = buildProposalV5PreviewSnapshot({ clinicType, packageId: "clinic-growth" });
      const html = render(snapshot);

      expect(html).toContain(snapshot.clinic.typeShortLabel);
      expect(html).toContain(snapshot.assets.sectorImages.cover.url);
      expect(html).toContain('data-v5-page-id="V5Page11PublishedProof"');
      expect(html).toContain("data-v5-proof-pair");
    }
  });

  it("uses the selected canonical package for scope and investment", () => {
    for (const packageRecord of proposalV5PreviewPackages) {
      const snapshot = buildProposalV5PreviewSnapshot({ clinicType: "dental_clinic", packageId: packageRecord.id });
      const html = render(snapshot);

      expect(snapshot.selectedPackage.id).toBe(packageRecord.id);
      expect(html).toContain(packageRecord.name);
      expect(html).toContain(packageRecord.name);
      expect(snapshot.scope.length).toBeGreaterThan(0);
      expect(html).toContain('data-v5-page-id="V5Page10ManagementScope"');
      expect(html).toContain('data-v5-page-id="V5Page13PartnershipInvestment"');
    }
  });

  it("keeps proof media paired on the published proof page for high proof counts", () => {
    const snapshot = buildProposalV5PreviewSnapshot({ clinicType: "aesthetic_clinic", packageId: "market-leader" });
    const repeatedProof = Array.from({ length: 20 }, (_, index) => ({
      ...snapshot.proof[index % snapshot.proof.length],
      title: `${snapshot.proof[index % snapshot.proof.length].title} ${index + 1}`,
    }));
    const html = render({ ...snapshot, proof: repeatedProof });

    expect(html).toContain('data-v5-page-id="V5Page11PublishedProof"');
    expect(html).toContain('data-v5-proof-slot="featured-client-story"');
    expect(html).toContain('data-v5-proof-slot="result-1"');
    expect(html).toContain('data-v5-proof-slot="published-row-1"');
    expect(html).toContain("/brand/proposal/v5-reference/tanja-testimonial.jpg");
    expect(html).not.toContain("case_study");
    expect(html).not.toContain("performance_");
    expect(html).not.toContain('data-v5-proof-density="maximum"');
  });

  it("renders the strict V19 reference copy for the audited pages", () => {
    const snapshot = buildProposalV5PreviewSnapshot({ clinicType: "dental_clinic", packageId: "clinic-growth" });
    const html = render(snapshot);

    expect(html).toContain("Illustrative media ROAS");
    expect(html).not.toContain("Media arithmetic");
    expect(html).toContain("Turn BristolDent Harbourside&#x27;s paid-search traffic into qualified implant enquiries.");
    expect(html).toContain("Marketing results matter. What happens after the lead matters more.");
    expect(html).toContain("Dr Tanja Phillips");
    expect(html).toContain("+262.73%");
    expect(html).toContain("-31.41%");
    expect(html).toContain("+100.6%");
    expect(html).toContain("DREAMAMED");
    expect(html).toContain("MEDISKIN");
    expect(html).toContain("billed monthly at £1,995 + VAT");
    expect(html).not.toMatch(/per day|Per calendar day|daily-equivalent/i);
    expect(html).toContain("90 days&#x27; written notice");
    expect(html).toContain("One initial six-month Growth Partnership");
    expect(html).toContain("Clinic Growth");
    expect(html).not.toContain("Selected matched case study");
  });
});
