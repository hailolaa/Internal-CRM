import type { ProposalV5ClinicTypeId, ProposalV5ProofAsset } from "./proposalV5Types";

export interface ProposalV5ProofContext {
  clinic: {
    clinicType: ProposalV5ClinicTypeId | null;
    proofTags: string[];
  };
  proof: ProposalV5ProofAsset[];
}

function normaliseTag(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
}

function proofText(asset: ProposalV5ProofAsset | undefined) {
  return `${asset?.title || ""} ${asset?.copy || ""} ${(asset?.sectorTags || []).join(" ")} ${asset?.source || ""} ${asset?.timeframe || ""} ${asset?.disclaimer || ""}`.toLowerCase();
}

function proofTagParts(asset: ProposalV5ProofAsset) {
  return asset.sectorTags.flatMap((tag) => {
    const raw = String(tag || "").trim().toLowerCase();
    const [key, ...rest] = raw.split(":");
    return [raw, key, rest.join(":")].filter(Boolean);
  });
}

const crossSectorProofSignals = [
  "all clinics",
  "all-clinics",
  "all clinic",
  "cross-sector",
  "cross sector",
  "broadly applicable",
  "common proof",
];

const proofClinicCategoryGroups = [
  ["dental", "dentist", "implant", "invisalign", "smile"],
  ["aesthetic", "aesthetics", "skin", "injectable", "laser"],
  ["surgery", "surgeon", "procedure", "cosmetic surgery"],
  ["dermatology", "acne", "mole", "eczema"],
  ["hair", "hair transplant", "hair restoration", "fue"],
  ["wellness", "longevity", "health optimisation", "functional", "wellbeing"],
  ["private gp", "medical", "doctor", "health check", "screening"],
  ["medical spa", "medspa", "spa"],
];

function proofIsCommonAsset(asset: ProposalV5ProofAsset) {
  const text = proofText(asset);
  const tagParts = proofTagParts(asset);
  if (asset.type === "product_screenshot" && text.includes("clinicgrower os")) return true;
  if (crossSectorProofSignals.some((signal) => tagParts.some((tag) => tag.includes(signal)) || text.includes(signal))) {
    return true;
  }
  const matchedCategoryCount = proofClinicCategoryGroups.filter((group) =>
    group.some((term) => tagParts.some((tag) => tag.includes(term)) || text.includes(term)),
  ).length;
  return matchedCategoryCount >= 4;
}

export function proposalV5ProofAssetMatchesClinic(asset: ProposalV5ProofAsset, proofTags: string[]) {
  if (proofIsCommonAsset(asset)) return true;
  const allowedTags = new Set(proofTags.map(normaliseTag).filter(Boolean));
  if (allowedTags.size === 0) return false;
  return proofTagParts(asset).some((tag) => {
    const [key] = tag.split(":");
    return allowedTags.has(normaliseTag(key)) ||
      [...allowedTags].some((allowedTag) => normaliseTag(tag).includes(allowedTag));
  });
}

export function proposalV5ProofAssetHasKnownProvenance(asset: ProposalV5ProofAsset | undefined) {
  return Boolean(asset?.title && asset.copy && asset.source && asset.timeframe && asset.disclaimer && asset.state === "known");
}

export function getProposalV5SelectedProofAssets(snapshot: ProposalV5ProofContext) {
  return snapshot.proof.filter((asset) => Boolean(asset.title || asset.copy || asset.mediaUrl));
}

export function getProposalV5RelevantProofAssets(snapshot: ProposalV5ProofContext) {
  return getProposalV5SelectedProofAssets(snapshot).filter((asset) =>
    proposalV5ProofAssetMatchesClinic(asset, snapshot.clinic.proofTags) &&
    proposalV5ProofAssetHasKnownProvenance(asset),
  );
}

export function getProposalV5RelevantProofSet(snapshot: ProposalV5ProofContext) {
  const relevantProof = getProposalV5RelevantProofAssets(snapshot);

  return {
    performanceResults: relevantProof.filter((asset) => asset.type === "performance_result"),
    testimonial: relevantProof.find((asset) => asset.type === "testimonial"),
    testimonialVideo: relevantProof.find((asset) => asset.type === "testimonial_video"),
    caseStudy: relevantProof.find((asset) => asset.type === "case_study"),
    productScreenshot: relevantProof.find((asset) => (
      asset.type === "product_screenshot" &&
      Boolean(asset.mediaUrl) &&
      proofText(asset).includes("clinicgrower os")
    )),
  };
}

function proofRequiresClinicMatch(asset: ProposalV5ProofAsset) {
  return ["case_study", "testimonial", "testimonial_video", "performance_result"].includes(String(asset.type || ""));
}

function proofHasPermission(asset: ProposalV5ProofAsset) {
  const text = proofText(asset);
  return text.includes("permission") || text.includes("approved") || text.includes("consent");
}

function proofHasResultContext(asset: ProposalV5ProofAsset) {
  if (asset.type !== "performance_result") return true;
  return /\b(week|month|quarter|year|day|within|over|from|between|20\d{2}|delivery context|timeframe|documented delivery period)\b/.test(proofText(asset));
}

function proofHasVerifiedDrTanjaImage(asset: ProposalV5ProofAsset) {
  const text = proofText(asset);
  const mediaUrl = String(asset.mediaUrl || "").toLowerCase();
  if (!/dr\.?\s*tanja|tanja/i.test(text)) return true;
  return Boolean(asset.mediaUrl) && (
    text.includes("verified image") ||
    text.includes("approved image") ||
    text.includes("image approved") ||
    mediaUrl.includes("tanja-phillips") ||
    mediaUrl.includes("dr-tanja") ||
    mediaUrl.includes("p17-img02-2400x1350")
  );
}

export function getProposalV5ProofReadinessMissingFields(snapshot: ProposalV5ProofContext) {
  const missing: string[] = [];
  if (!snapshot.clinic.clinicType) missing.push("clinic.clinicType");
  if (!snapshot.clinic.proofTags.length) missing.push("clinic.proofTags");

  const selectedProof = getProposalV5SelectedProofAssets(snapshot);
  if (!selectedProof.length) return [...missing, "proof.selected"];

  const mismatchedClinicProof = selectedProof.some((asset) =>
    proofRequiresClinicMatch(asset) &&
    !proposalV5ProofAssetMatchesClinic(asset, snapshot.clinic.proofTags),
  );
  const matchedCaseStudy = selectedProof.some((asset) =>
    asset.type === "case_study" &&
    proposalV5ProofAssetMatchesClinic(asset, snapshot.clinic.proofTags),
  );
  const permissionedTestimonial = selectedProof.some((asset) =>
    (asset.type === "testimonial" || asset.type === "testimonial_video") &&
    proofHasPermission(asset) &&
    proposalV5ProofAssetMatchesClinic(asset, snapshot.clinic.proofTags),
  );
  const productScreenshot = selectedProof.some((asset) =>
    asset.type === "product_screenshot" &&
    Boolean(asset.mediaUrl) &&
    proofText(asset).includes("clinicgrower os"),
  );
  const contextualResult = selectedProof.some((asset) =>
    asset.type === "performance_result" &&
    proofHasResultContext(asset),
  );
  const resultMissingContext = selectedProof.some((asset) => !proofHasResultContext(asset));
  const invalidDrTanjaImage = selectedProof.some((asset) => !proofHasVerifiedDrTanjaImage(asset));

  if (!matchedCaseStudy) missing.push("proof.case_study");
  if (!permissionedTestimonial) missing.push("proof.testimonial_or_video");
  if (!productScreenshot) missing.push("proof.product_screenshot_media");
  if (!contextualResult) missing.push("proof.performance_result_context");
  if (resultMissingContext) missing.push("proof.performance_result_context_all");
  if (invalidDrTanjaImage) missing.push("proof.dr_tanja_verified_image");
  if (mismatchedClinicProof) missing.push("proof.clinic_type_match");

  return missing;
}

export function hasProposalV5ReadyProofSet(snapshot: ProposalV5ProofContext) {
  return getProposalV5ProofReadinessMissingFields(snapshot).length === 0;
}
