import { describe, expect, it } from "vitest";
import type { ProposalProofAssetRecord } from "@/lib/api-types";
import { getProposalClinicTypeVariant } from "@/lib/proposal-clinic-variants";
import {
  classifyProofAsset,
  getRecommendedProofAssetIds,
  proofMatchesClinicVariant,
} from "./proposal-proof-selection";

function proof(overrides: Partial<ProposalProofAssetRecord>): ProposalProofAssetRecord {
  return {
    id: overrides.id || "proof",
    type: overrides.type || "performance_result",
    title: overrides.title || "Proof",
    copy: overrides.copy || "Proof copy",
    mediaUrl: Object.prototype.hasOwnProperty.call(overrides, "mediaUrl") ? overrides.mediaUrl! : null,
    sectorTags: overrides.sectorTags || [],
    sortOrder: overrides.sortOrder || 10,
    isActive: true,
    createdAt: "2026-08-12T09:00:00.000Z",
    updatedAt: "2026-08-12T09:00:00.000Z",
  };
}

const baseForm = {
  clinicTypeAndLocations: "Aesthetic clinic in Bristol",
  priorityTreatments: "Injectables\nSkin treatments\nLaser treatments",
  targetArea: "Bristol aesthetics catchment",
  primaryGoal: "Increase qualified treatment consultations",
};

describe("proposal proof selection", () => {
  it("preselects common and selected-clinic proof without relying on hardcoded proof IDs", () => {
    const aestheticVariant = getProposalClinicTypeVariant("aesthetic_clinic");
    const dentalVariant = getProposalClinicTypeVariant("dental_clinic");
    const assets = [
      proof({
        id: "common-result",
        type: "performance_result",
        title: "Cross-sector documented proof",
        copy: "Documented delivery period with cross-sector ClinicGrower proof.",
        sectorTags: [
          "dental",
          "aesthetic",
          "dermatology",
          "cosmetic surgery",
          "hair transplant",
          "wellness",
          "private gp",
          "medical spa",
          "timeframe:Documented delivery period",
          "disclaimer:Historical proof only.",
        ],
        sortOrder: 10,
      }),
      proof({
        id: "aesthetic-award",
        type: "award",
        title: "Aesthetic clinic award",
        copy: "Award recognition for aesthetic clinics.",
        mediaUrl: "/brand/proof/aesthetic-award.webp",
        sectorTags: ["aesthetic", "skin", "source:ClinicGrower proof library", "timeframe:2025", "disclaimer:Credibility proof."],
        sortOrder: 20,
      }),
      proof({
        id: "dental-only-case",
        type: "case_study",
        title: "Dental implant case study",
        copy: "Dental implant case-study proof.",
        mediaUrl: "/brand/proof/dental-case.webp",
        sectorTags: ["dental", "implant", "source:ClinicGrower proof library", "timeframe:90 days", "disclaimer:Contextual proof."],
        sortOrder: 30,
      }),
    ];

    const aestheticRecommended = getRecommendedProofAssetIds(assets, baseForm, aestheticVariant);
    const dentalRecommended = getRecommendedProofAssetIds(assets, {
      ...baseForm,
      clinicTypeAndLocations: "Dental practice in Bristol",
      priorityTreatments: "Implants\nInvisalign\nSmile makeovers",
    }, dentalVariant);

    expect(aestheticRecommended).toContain("common-result");
    expect(aestheticRecommended).toContain("aesthetic-award");
    expect(aestheticRecommended).not.toContain("dental-only-case");
    expect(dentalRecommended).toContain("common-result");
    expect(dentalRecommended).toContain("dental-only-case");
    expect(dentalRecommended).not.toContain("aesthetic-award");
  });

  it("allows broader category proof without treating unrelated clinic proof as universal", () => {
    const aestheticVariant = getProposalClinicTypeVariant("aesthetic_clinic");
    const dermatologyVariant = getProposalClinicTypeVariant("dermatology_clinic");
    const dentalVariant = getProposalClinicTypeVariant("dental_clinic");
    const skinProof = proof({
      id: "skin-category-proof",
      type: "case_study",
      title: "Skin treatment conversion case study",
      copy: "Skin treatment consultation proof with documented delivery period.",
      mediaUrl: "/brand/proof/skin-case.webp",
      sectorTags: ["skin", "source:ClinicGrower proof library", "timeframe:90 days", "disclaimer:Contextual proof."],
    });

    expect(proofMatchesClinicVariant(skinProof, aestheticVariant)).toBe(true);
    expect(proofMatchesClinicVariant(skinProof, dermatologyVariant)).toBe(true);
    expect(proofMatchesClinicVariant(skinProof, dentalVariant)).toBe(false);
    expect(classifyProofAsset(skinProof, baseForm, aestheticVariant).tier).toBe("required");
    expect(classifyProofAsset(skinProof, baseForm, dentalVariant).tier).toBe("optional");
  });

  it("keeps product screenshots common only when they are ClinicGrower OS proof", () => {
    const dentalVariant = getProposalClinicTypeVariant("dental_clinic");
    const osScreenshot = proof({
      id: "os-screen",
      type: "product_screenshot",
      title: "ClinicGrower OS leakage view",
      copy: "ClinicGrower OS screenshot with Growth Score and next actions.",
      mediaUrl: "/brand/proof/os.webp",
      sectorTags: ["product screenshot", "state:known"],
    });
    const unrelatedScreenshot = proof({
      id: "other-screen",
      type: "product_screenshot",
      title: "Unrelated analytics screenshot",
      copy: "External analytics screenshot.",
      mediaUrl: "/brand/proof/other.webp",
      sectorTags: ["product screenshot", "state:known"],
    });

    const recommended = getRecommendedProofAssetIds([osScreenshot, unrelatedScreenshot], baseForm, dentalVariant);

    expect(recommended).toContain("os-screen");
    expect(recommended).not.toContain("other-screen");
  });
});
