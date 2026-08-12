import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { metadata } from "@/app/app/crm/proposals/v5-mobile-preview/page";
import { ProposalV5PrivateMobilePreviewView } from "@/app/app/crm/proposals/v5-mobile-preview/v5-mobile-preview-content";
import type { ProposalProofAssetRecord } from "@/lib/api-types/proposals";
import {
  buildProposalV5PreviewSnapshot,
  listProposalV5PreviewClinicTypes,
  proposalV5PreviewPackages,
} from "./data/previewSnapshot";
import type { ProposalV5EvidenceState, ProposalV5Snapshot } from "./data/proposalV5Types";
import { getProposalV5ProofReadinessMissingFields } from "./data/proofValidation";
import { ProposalV5MobileRenderer } from "./mobile/ProposalV5MobileRenderer";
import { proposalV5MobilePageIds, proposalV5MobileSections } from "./mobile/mobileSectionRegistry";
import { proposalV5PageIds } from "./pages/pageOrder";

function renderMobile(snapshot: ProposalV5Snapshot) {
  return renderToStaticMarkup(createElement(ProposalV5MobileRenderer, { snapshot }));
}

function extractSection(html: string, sectionId: string) {
  const marker = `data-v5-mobile-section-id="${sectionId}"`;
  const start = html.indexOf(marker);
  if (start < 0) return "";
  const sectionStart = html.lastIndexOf("<section", start);
  const next = html.indexOf("data-v5-mobile-section-id=", start + marker.length);
  return html.slice(sectionStart >= 0 ? sectionStart : start, next < 0 ? undefined : next);
}

function extractMobileProofPair(html: string, title: string) {
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
      mediaUrl: "/brand/proof/award-mobile-density.webp",
      sectorTags: ["dental", "state:known", "source:ClinicGrower awards library", "timeframe:2025", "disclaimer:Credibility proof only."],
    },
    {
      type: "case_study",
      title: "Dental case study proof",
      copy: "Dental case study with documented delivery context and relevance to the selected clinic type.",
      mediaUrl: "/brand/proof/case-mobile-density.webp",
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
      mediaUrl: "/brand/proof/result-mobile-density.webp",
      sectorTags: ["dental", "state:known", "proof_scope:Dental delivery proof.", "source:ClinicGrower proof library", "timeframe:90 days", "disclaimer:Historical proof only."],
    },
    {
      type: "product_screenshot",
      title: "ClinicGrower OS screenshot",
      copy: "ClinicGrower OS screenshot showing leakage visibility and next actions where connected.",
      mediaUrl: "/brand/proof/os-mobile-density.webp",
      sectorTags: ["dental", "clinicgrower os", "product screenshot", "state:known", "source:ClinicGrower OS screenshot library", "timeframe:Current V5 reference", "disclaimer:Illustrative where connected."],
    },
  ] as const;

  return Array.from({ length: count }, (_, index) => {
    const template = templates[index % templates.length];
    return {
      ...template,
      id: `mobile-density-proof-${index + 1}`,
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

describe("ProposalV5MobileRenderer", () => {
  it("requires ProposalV5Snapshot and rejects raw proposal-shaped data", () => {
    const snapshot = buildProposalV5PreviewSnapshot();
    expect(renderMobile(snapshot)).toContain("proposal-v5-mobile-renderer");
    expect(() => renderToStaticMarkup(createElement(ProposalV5MobileRenderer, { snapshot: { id: "raw-proposal" } as never }))).toThrow(
      /ProposalV5MobileRenderer requires ProposalV5Snapshot/,
    );
  });

  it("represents all 19 original V5 page IDs without renumbering them", () => {
    const html = renderMobile(buildProposalV5PreviewSnapshot());
    expect(proposalV5MobilePageIds).toEqual(proposalV5PageIds);
    proposalV5PageIds.forEach((pageId) => {
      expect(html).toContain(`data-v5-page-id="${pageId}"`);
    });
  });

  it("renders the required mobile chapter groups and semantic page anchors", () => {
    const html = renderMobile(buildProposalV5PreviewSnapshot());
    proposalV5MobileSections.forEach((section) => {
      const chapter = extractSection(html, section.id);
      expect(chapter).toContain(`data-v5-page-ids="${section.pageIds.join(" ")}"`);
      section.pageIds.forEach((pageId) => {
        expect(chapter).toContain(`data-v5-page-id="${pageId}"`);
      });
    });
  });

  it("renders all eight clinic variants from the same snapshot contract", () => {
    const clinicTypes = listProposalV5PreviewClinicTypes();
    expect(clinicTypes).toHaveLength(8);
    clinicTypes.forEach((clinicType) => {
      const snapshot = buildProposalV5PreviewSnapshot({ clinicType });
      const html = renderMobile(snapshot);
      expect(html).toContain(snapshot.clinic.typeShortLabel);
      expect(html).toContain(snapshot.clinic.name.value as string);
      expect(html).toContain(snapshot.journey.clinicalBoundary);
    });
  });

  it("renders all canonical V5 packages and changes Page 15 scope by package", () => {
    const scopeTitles = new Set<string>();
    proposalV5PreviewPackages.forEach((packageRecord) => {
      const snapshot = buildProposalV5PreviewSnapshot({ packageId: packageRecord.id });
      const html = renderMobile(snapshot);
      const scopeSection = extractSection(html, "mobile-scope");
      expect(html).toContain(packageRecord.name);
      expect(html).not.toContain(packageRecord.id);
      expect(snapshot.scope.length).toBeGreaterThan(0);
      expect(scopeSection).toContain(snapshot.scope[0].title as string);
      expect(scopeSection).toContain(snapshot.scope[0].owner as string);
      expect(scopeSection).toContain(snapshot.scope[0].exclusion as string);
      scopeTitles.add(snapshot.scope[0].title as string);
    });
    expect(scopeTitles.size).toBeGreaterThan(4);
  });

  it("keeps long clinic names visible with cover metadata", () => {
    const snapshot = buildProposalV5PreviewSnapshot({ longContent: true });
    const html = renderMobile(snapshot);
    const cover = extractSection(html, "mobile-cover");
    expect(cover).toContain(snapshot.clinic.name.value as string);
    expect(cover).toContain("Location");
    expect(cover).toContain("Prepared for");
    expect(cover).toContain("Programme");
    expect(cover).toContain("Valid until");
  });

  it("preserves Page 12 evidence gating and does not expose break-even values when not ready", () => {
    const gatedSnapshot = withBreakEvenState(buildProposalV5PreviewSnapshot(), "to_confirm");
    const html = renderMobile(gatedSnapshot);
    const economics = extractSection(html, "mobile-economics");
    expect(economics).toContain("To confirm");
    expect(economics).toContain("Commercial values stay gated");
    expect(economics).not.toContain("Monthly investment");
    expect(economics).not.toContain("Monthly break-even");
    expect(economics).not.toContain("£3,000");
  });

  it("renders selected Page 17 proof on mobile while readiness reports clinic mismatches separately", () => {
    const snapshot = buildProposalV5PreviewSnapshot({ clinicType: "dental_clinic" });
    const unrelatedProof: ProposalProofAssetRecord = {
      id: "unrelated-proof",
      type: "case_study",
      title: "Selected hair transplant proof with mismatch warning",
      copy: "This proof has known provenance but the wrong clinic tag.",
      mediaUrl: "/brand/proof/unrelated.webp",
      sectorTags: [
        "hair-transplant",
        "state:known",
        "source:ClinicGrower proof library",
        "timeframe:Documented delivery period",
        "disclaimer:Wrong-sector proof must not render.",
      ],
      sortOrder: 1,
      isActive: true,
      createdAt: "2026-08-11T09:00:00.000Z",
      updatedAt: "2026-08-11T09:00:00.000Z",
    };
    const proofSnapshot: ProposalV5Snapshot = {
      ...snapshot,
      proof: [...snapshot.proof, {
        id: unrelatedProof.id,
        type: unrelatedProof.type,
        title: unrelatedProof.title,
        copy: unrelatedProof.copy,
        mediaUrl: unrelatedProof.mediaUrl,
        sectorTags: unrelatedProof.sectorTags,
        state: "known",
        proofMode: null,
        proofScope: null,
        source: "ClinicGrower proof library",
        timeframe: "Documented delivery period",
        disclaimer: "Wrong-sector proof must not render.",
      }],
    };
    const html = renderMobile(proofSnapshot);
    const proof = extractSection(html, "mobile-proof");

    expect(getProposalV5ProofReadinessMissingFields(proofSnapshot)).toContain("proof.clinic_type_match");
    expect(proof).toContain("Dr Tanja Phillips");
    expect(proof).toContain("Selected hair transplant proof with mismatch warning");
    expect(proof).toContain("/brand/proof/unrelated.webp");
    expect(proof).not.toContain("No relevant proof assets are selected");
  });

  it("preserves proof/media pairing on mobile proof cards", () => {
    const snapshot = buildProposalV5PreviewSnapshot({ clinicType: "dental_clinic" });
    const proofSnapshot: ProposalV5Snapshot = {
      ...snapshot,
      proof: snapshot.proof.map((proof, index) => ({
        ...proof,
        mediaUrl: `/brand/proof/mobile-proof-${index + 1}.webp`,
      })),
    };
    const html = renderMobile(proofSnapshot);

    for (const [index, proof] of proofSnapshot.proof.entries()) {
      const pair = extractMobileProofPair(html, proof.title as string);
      expect(pair).toContain(`/brand/proof/mobile-proof-${index + 1}.webp`);
      if (index > 0) expect(pair).not.toContain("/brand/proof/mobile-proof-1.webp");
    }
  });

  it("renders every selected Page 17 proof on mobile", () => {
    const proofAssets = proofAssetsForCount(20);
    const proofSnapshot: ProposalV5Snapshot = {
      ...buildProposalV5PreviewSnapshot({ clinicType: "dental_clinic" }),
      proof: proofAssets,
    };
    const html = renderMobile(proofSnapshot);
    const proof = extractSection(html, "mobile-proof");

    expect((proof.match(/data-v5-mobile-proof-pair/g) || [])).toHaveLength(20);
    proofAssets.forEach((asset) => {
      const pair = extractMobileProofPair(proof, asset.title);
      if (asset.mediaUrl) {
        expect(pair).toContain(asset.mediaUrl);
      } else {
        expect(pair).toContain("Evidence summary");
      }
    });
  });

  it("renders Page 18 from snapshot commercial values only", () => {
    const snapshot = buildProposalV5PreviewSnapshot({ packageId: "market-leader" });
    const html = renderMobile(snapshot);
    const investment = extractSection(html, "mobile-investment");
    expect(investment).toContain("Market Leader");
    expect(investment).toContain("£4,995");
    expect(investment).toContain("£995");
    expect(investment).toContain("plus_vat");
    expect(investment).not.toContain("market-leader");
    expect(investment).not.toContain(snapshot.snapshotHash);
  });

  it("uses only safe Page 19 acceptance and question links", () => {
    const snapshot: ProposalV5Snapshot = {
      ...buildProposalV5PreviewSnapshot(),
      links: {
        ...buildProposalV5PreviewSnapshot().links,
        acceptUrl: "javascript:alert(1)",
        questionUrl: "https://clinicgrower.co.uk/question",
      },
    };
    const html = renderMobile(snapshot);
    const close = extractSection(html, "mobile-close");
    expect(close).not.toContain("javascript:alert");
    expect(close).not.toContain("Approve proposal</a>");
    expect(close).toContain("https://clinicgrower.co.uk/question");
  });

  it("does not expose internal snapshot metadata, source metadata or filler copy", () => {
    const snapshot = buildProposalV5PreviewSnapshot();
    const html = renderMobile(snapshot);
    expect(html).not.toContain(snapshot.snapshotHash);
    expect(html).not.toContain(snapshot.sourceProposalVersion);
    expect(html).not.toContain("snapshot hash");
    expect(html).not.toContain("source version");
    expect(html).not.toContain("package ID");
    expect(html).not.toContain("Lorem ipsum");
    expect(html).not.toContain("required before sending");
    expect(html).not.toMatch(/fallback|localhost/i);
  });

  it("does not use A4 dimensions and sets mobile overflow protection", () => {
    const html = renderMobile(buildProposalV5PreviewSnapshot());
    expect(html).not.toContain("210mm");
    expect(html).not.toContain("297mm");
    expect(html).not.toContain("176mm");
    expect(html).toContain("overflow-x:hidden");
    expect(html).toContain("max-width:var(--proposal-v5-mobile-max-width)");
  });

  it("keeps the private mobile preview noindex and renders through the real preview view", () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    const html = renderToStaticMarkup(
      createElement(ProposalV5PrivateMobilePreviewView, {
        clinicTypeInput: "dental_clinic",
        packageIdInput: "clinic-growth-engine",
        longContent: true,
      }),
    );
    expect(html).toContain("ClinicGrower V5 mobile proposal renderer");
    expect(html).toContain("proposal-v5-mobile-renderer");
    expect(html).toContain("Open desktop V5 preview");
  });
});
