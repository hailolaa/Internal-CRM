import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildProposalV5PreviewSnapshot, listProposalV5PreviewClinicTypes, proposalV5PreviewPackages } from "./data/previewSnapshot";
import { proposalV5MobilePageIds, proposalV5MobileSections } from "./mobile/mobileSectionRegistry";
import { ProposalV5MobileRenderer } from "./mobile/ProposalV5MobileRenderer";

function renderMobile(snapshot = buildProposalV5PreviewSnapshot()) {
  return renderToStaticMarkup(createElement(ProposalV5MobileRenderer, { snapshot }));
}

describe("ProposalV5MobileRenderer V19", () => {
  it("renders 15 responsive sections from the same snapshot instead of A4 pages", () => {
    const html = renderMobile();

    expect(proposalV5MobileSections).toHaveLength(15);
    expect(proposalV5MobilePageIds).toHaveLength(15);
    expect(html).toContain('data-v5-mobile-page-count="15"');
    expect(html.match(/data-v5-mobile-section-id=/g)).toHaveLength(15);
    expect(html).toContain('data-v5-page-id="V5Page15Decision"');
    expect(html).not.toContain("width:210mm;height:297mm");
    expect(html).not.toContain('data-v5-page-id="V5Page16');
  });

  it("renders every clinic variant with matching terminology and assets", () => {
    for (const clinicType of listProposalV5PreviewClinicTypes()) {
      const snapshot = buildProposalV5PreviewSnapshot({ clinicType, packageId: "clinic-growth-engine" });
      const html = renderMobile(snapshot);

      expect(html).toContain(snapshot.clinic.name.value);
      expect(html).toContain(snapshot.assets.sectorImages.cover.url);
      expect(html).toContain(snapshot.selectedPackage.name);
    }
  });

  it("keeps package choice independent on mobile", () => {
    for (const packageRecord of proposalV5PreviewPackages) {
      const snapshot = buildProposalV5PreviewSnapshot({ clinicType: "medical_spa", packageId: packageRecord.id });
      const html = renderMobile(snapshot);

      expect(html).toContain(packageRecord.name);
      expect(snapshot.clinic.clinicType).toBe("medical_spa");
    }
  });

  it("keeps the V19 Page 11 proof hierarchy on mobile without internal labels", () => {
    const snapshot = buildProposalV5PreviewSnapshot({ clinicType: "dental_clinic", packageId: "clinic-growth-engine" });
    const html = renderMobile(snapshot);

    expect(html).toContain('data-v5-page-id="V5Page11PublishedProof"');
    expect(html).toContain("Dr Tanja Phillips");
    expect(html).toContain("Illustrative media ROAS");
    expect(html).not.toContain("Media arithmetic");
    expect(html).toContain("+262.73%");
    expect(html).toContain("-31.41%");
    expect(html).toContain("+100.6%");
    expect(html).toContain("DREAMAMED");
    expect(html).toContain("MEDISKIN");
    expect(html).toContain("/brand/proposal/v5-reference/tanja-testimonial.jpg");
    expect(html).not.toContain("case_study");
    expect(html).not.toContain("performance_");
  });

  it("uses the V19 Page 13 and Page 15 decision wording on mobile", () => {
    const snapshot = buildProposalV5PreviewSnapshot({ clinicType: "dental_clinic", packageId: "clinic-growth-engine" });
    const html = renderMobile(snapshot);

    expect(html).toContain("for about £82 per day");
    expect(html).toContain("without disconnected suppliers or reports for");
    expect(html).toContain("The decision requested");
    expect(html).toContain("you do not need another supplier that stops at enquiries");
    expect(html).toContain("Prepare the final agreement for");
    expect(html).toContain("Yes - prepare");
    expect(html).toContain("90 days&#x27; written notice");
    expect(html).not.toContain(`Prepare the final agreement for ${snapshot.proposal.reference}`);
  });
});
