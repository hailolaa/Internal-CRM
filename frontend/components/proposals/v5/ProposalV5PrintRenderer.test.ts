import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildProposalV5PreviewSnapshot, proposalV5PreviewPackages } from "./data/previewSnapshot";
import { ProposalV5PrintRenderer } from "./print/ProposalV5PrintRenderer";

function renderPrint(snapshot = buildProposalV5PreviewSnapshot()) {
  return renderToStaticMarkup(createElement(ProposalV5PrintRenderer, { snapshot }));
}

describe("ProposalV5PrintRenderer V19", () => {
  it("renders exactly 15 A4 print pages with no Page 16", () => {
    const html = renderPrint();

    expect(html).toContain('data-v5-print-page-count="15"');
    expect(html.match(/data-v5-page-id=/g)).toHaveLength(15);
    expect(html.match(/width:210mm;height:297mm/g)).toHaveLength(15);
    expect(html).toContain('data-v5-page-id="V5Page15Decision"');
    expect(html).not.toContain('data-v5-page-id="V5Page16');
  });

  it("prints proof/media pairs on Page 11", () => {
    const snapshot = buildProposalV5PreviewSnapshot({ clinicType: "dental_clinic", packageId: "clinic-growth" });
    const html = renderPrint(snapshot);

    expect(html).toContain('data-v5-page-id="V5Page11PublishedProof"');
    expect(html).toContain("data-v5-proof-pair");
    expect(html).toContain("Dr Tanja Phillips");
    expect(html).toContain("+262.73%");
    expect(html).toContain("DREAMAMED");
    expect(html).toContain("MEDISKIN");
    expect(html).not.toContain("case_study");
    expect(html).not.toContain("performance_");
  });

  it("prints package-specific investment and scope for each canonical package", () => {
    for (const packageRecord of proposalV5PreviewPackages) {
      const snapshot = buildProposalV5PreviewSnapshot({ clinicType: "wellness_clinic", packageId: packageRecord.id });
      const html = renderPrint(snapshot);

      expect(html).toContain(packageRecord.name);
      expect(html).toContain('data-v5-page-id="V5Page10ManagementScope"');
      expect(html).toContain('data-v5-page-id="V5Page13PartnershipInvestment"');
      expect(snapshot.scope.length).toBeGreaterThan(0);
    }
  });
});
