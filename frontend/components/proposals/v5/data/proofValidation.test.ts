import { describe, expect, it } from "vitest";
import type { ProposalV5ProofAsset } from "./proposalV5Types";
import type { ProposalV5ProofContext } from "./proofValidation";
import {
  getProposalV5ProofReadinessMissingFields,
  proposalV5ProofAssetMatchesClinic,
} from "./proofValidation";

function proof(overrides: Partial<ProposalV5ProofAsset>): ProposalV5ProofAsset {
  return {
    id: overrides.id || "proof",
    type: overrides.type || "performance_result",
    title: overrides.title || "Proof",
    copy: overrides.copy || "Proof copy",
    mediaUrl: Object.prototype.hasOwnProperty.call(overrides, "mediaUrl") ? overrides.mediaUrl! : null,
    sectorTags: overrides.sectorTags || [],
    state: overrides.state || "known",
    proofMode: overrides.proofMode || null,
    proofScope: overrides.proofScope || null,
    source: overrides.source || "ClinicGrower proof library",
    timeframe: overrides.timeframe || "Documented delivery period",
    disclaimer: overrides.disclaimer || "Contextual proof only, not a guarantee.",
  };
}

function context(proofAssets: ProposalV5ProofAsset[]): ProposalV5ProofContext {
  return {
    clinic: {
      clinicType: "aesthetic_clinic",
      proofTags: ["aesthetic", "aesthetics", "skin", "injectable", "laser"],
    },
    proof: proofAssets,
  };
}

describe("V5 proof validation", () => {
  it("treats common cross-sector proof as applicable without making selected proof disappear", () => {
    const commonResult = proof({
      id: "common-result",
      type: "performance_result",
      title: "Cross-sector documented result",
      copy: "Documented delivery period with cross-sector ClinicGrower proof.",
      mediaUrl: null,
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
    });

    expect(proposalV5ProofAssetMatchesClinic(commonResult, context([]).clinic.proofTags)).toBe(true);
  });

  it("allows category proof for matching clinic types and rejects unrelated clinic categories", () => {
    const skinCaseStudy = proof({
      id: "skin-case",
      type: "case_study",
      title: "Skin treatment case study",
      copy: "Skin treatment proof with documented delivery period.",
      mediaUrl: "/brand/proof/skin-case.webp",
      sectorTags: ["skin", "source:ClinicGrower proof library", "timeframe:90 days", "disclaimer:Contextual proof."],
    });

    expect(proposalV5ProofAssetMatchesClinic(skinCaseStudy, ["aesthetic", "skin"])).toBe(true);
    expect(proposalV5ProofAssetMatchesClinic(skinCaseStudy, ["dermatology", "skin"])).toBe(true);
    expect(proposalV5ProofAssetMatchesClinic(skinCaseStudy, ["dental", "implant"])).toBe(false);
  });

  it("keeps readiness separate from optional media while enforcing required proof media", () => {
    const readyProof = context([
      proof({
        id: "case",
        type: "case_study",
        title: "Aesthetic skin case study",
        copy: "Aesthetic skin proof with documented delivery period.",
        mediaUrl: null,
        sectorTags: ["aesthetic", "skin", "source:ClinicGrower proof library", "timeframe:90 days", "disclaimer:Contextual proof."],
      }),
      proof({
        id: "testimonial",
        type: "testimonial",
        title: "Permissioned aesthetic testimonial",
        copy: "Permission approved testimonial for aesthetic clinics.",
        mediaUrl: null,
        sectorTags: ["aesthetic", "permission approved", "source:ClinicGrower proof library", "timeframe:Permissioned testimonial", "disclaimer:Permissioned testimonial."],
      }),
      proof({
        id: "os",
        type: "product_screenshot",
        title: "ClinicGrower OS screenshot",
        copy: "ClinicGrower OS screenshot showing leakage visibility.",
        mediaUrl: "/brand/proof/os.webp",
        sectorTags: ["clinicgrower os", "product screenshot", "source:ClinicGrower OS", "timeframe:Current", "disclaimer:Illustrative where connected."],
      }),
      proof({
        id: "result",
        type: "performance_result",
        title: "Aesthetic result",
        copy: "Aesthetic result over 90 days with delivery context.",
        mediaUrl: null,
        sectorTags: ["aesthetic", "source:ClinicGrower proof library", "timeframe:90 days", "disclaimer:Contextual proof."],
      }),
      proof({
        id: "award",
        type: "award",
        title: "Text-only credibility proof",
        copy: "Award proof selected without an image.",
        mediaUrl: null,
        sectorTags: ["aesthetic", "source:ClinicGrower proof library", "timeframe:2025", "disclaimer:Credibility proof."],
      }),
    ]);

    expect(getProposalV5ProofReadinessMissingFields(readyProof)).toEqual([]);

    const missingRequiredImage = context([
      ...readyProof.proof.filter((asset) => asset.id !== "os"),
      proof({
        id: "os-no-media",
        type: "product_screenshot",
        title: "ClinicGrower OS screenshot",
        copy: "ClinicGrower OS screenshot showing leakage visibility.",
        mediaUrl: null,
        sectorTags: ["clinicgrower os", "product screenshot", "source:ClinicGrower OS", "timeframe:Current", "disclaimer:Illustrative where connected."],
      }),
    ]);

    expect(getProposalV5ProofReadinessMissingFields(missingRequiredImage)).toContain("proof.product_screenshot_media");
  });
});
