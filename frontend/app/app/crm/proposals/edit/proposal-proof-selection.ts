import type { ProposalProofAssetRecord, ProposalProofAssetType } from "@/lib/api-types";
import type { ProposalClinicTypeVariant } from "@/lib/proposal-clinic-variants";

export type ProposalProofTier = "required" | "common" | "optional";

export const proofTierLabels: Record<ProposalProofTier, string> = {
  required: "Required",
  common: "Common",
  optional: "Optional",
};

export interface ProposalProofSelectionForm {
  clinicTypeAndLocations?: string | null;
  priorityTreatments?: string | null;
  targetArea?: string | null;
  primaryGoal?: string | null;
  proofAssetIds?: string[] | null;
}

const crossSectorSignals = [
  "all clinics",
  "all-clinics",
  "all clinic",
  "cross-sector",
  "cross sector",
  "broadly applicable",
  "common proof",
];

const clinicCategoryGroups = [
  ["dental", "dentist", "implant", "invisalign", "smile"],
  ["aesthetic", "aesthetics", "skin", "injectable", "laser"],
  ["surgery", "surgeon", "procedure", "cosmetic surgery"],
  ["dermatology", "acne", "mole", "eczema"],
  ["hair", "hair transplant", "hair restoration", "fue"],
  ["wellness", "longevity", "health optimisation", "functional", "wellbeing"],
  ["private gp", "medical", "doctor", "health check", "screening"],
  ["medical spa", "medspa", "spa"],
];

const segmentMatchTerms: Record<string, string[]> = {
  dental: ["dental", "dentist", "implant", "invisalign", "smile"],
  ent: ["ent", "ear nose throat", "snoring", "sleep", "hearing", "sinus"],
  dermatology: ["dermatology", "skin", "acne", "mole", "eczema"],
  aesthetics: ["aesthetic", "aesthetics", "skin", "injectable", "laser", "botox"],
  physiotherapy: ["physio", "physiotherapy", "rehab", "sports injury"],
  "primary care": ["private gp", "general practice", "gp clinic", "medical", "doctor", "screening"],
};

function normaliseProofText(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function normaliseProofTag(value: string | null | undefined) {
  return normaliseProofText(value).replace(/[_\s]+/g, "-");
}

function proofTagParts(asset: ProposalProofAssetRecord) {
  return (asset.sectorTags || [])
    .flatMap((tag) => {
      const raw = normaliseProofText(tag);
      const [key, ...rest] = raw.split(":");
      return [raw, key, rest.join(":")].filter(Boolean);
    });
}

export function proofAssetText(asset: ProposalProofAssetRecord) {
  return `${asset.title} ${asset.copy} ${(asset.sectorTags || []).join(" ")}`.toLowerCase();
}

function inferClinicSegmentsFromForm(form: ProposalProofSelectionForm) {
  const text = [
    form.clinicTypeAndLocations,
    form.priorityTreatments,
    form.targetArea,
    form.primaryGoal,
  ].filter(Boolean).join(" ").toLowerCase();
  const segments = new Set<string>();
  const addIf = (terms: string[], segment: string) => {
    if (terms.some((term) => text.includes(term))) segments.add(segment);
  };
  addIf(["dental", "dentist", "implant", "invisalign", "orthodont", "smile"], "dental");
  addIf(["ent", "ear nose throat", "snoring", "sleep", "hearing", "sinus"], "ent");
  addIf(["dermatology", "dermatologist", "skin clinic", "mole", "acne", "eczema"], "dermatology");
  addIf(["aesthetic", "aesthetics", "botox", "injectable", "laser", "skin"], "aesthetics");
  addIf(["physio", "physiotherapy", "rehab", "sports injury"], "physiotherapy");
  addIf(["private gp", "general practice", "gp clinic"], "primary care");
  return [...segments];
}

function proofMatchesClinicSegments(asset: ProposalProofAssetRecord, segments: string[]) {
  if (!segments.length) return true;
  const text = proofAssetText(asset);
  return segments.some((segment) =>
    (segmentMatchTerms[segment] || [segment]).some((term) => text.includes(term)),
  );
}

export function proofIsCommonAsset(asset: ProposalProofAssetRecord) {
  const text = proofAssetText(asset);
  const tagParts = proofTagParts(asset);
  if (asset.type === "product_screenshot" && text.includes("clinicgrower os")) return true;
  if (crossSectorSignals.some((signal) => tagParts.some((tag) => tag.includes(signal)) || text.includes(signal))) {
    return true;
  }

  const matchedCategoryCount = clinicCategoryGroups.filter((group) =>
    group.some((term) => tagParts.some((tag) => tag.includes(term)) || text.includes(term)),
  ).length;
  return matchedCategoryCount >= 4;
}

export function proofMatchesClinicVariant(
  asset: ProposalProofAssetRecord,
  variant: ProposalClinicTypeVariant,
) {
  const text = proofAssetText(asset);
  const variantTags = variant.proofTags.map(normaliseProofText).filter(Boolean);
  if (!variantTags.length) return proofIsCommonAsset(asset);
  if (proofIsCommonAsset(asset)) return true;
  return variantTags.some((tag) =>
    text.includes(tag) ||
    proofTagParts(asset).some((part) => normaliseProofTag(part).includes(normaliseProofTag(tag))),
  );
}

export function proofHasPermission(asset: ProposalProofAssetRecord) {
  const text = proofAssetText(asset);
  return text.includes("permission") || text.includes("approved") || text.includes("consent");
}

export function proofHasMedia(asset: ProposalProofAssetRecord) {
  return Boolean(String(asset.mediaUrl || "").trim());
}

export function proofMediaLooksLikeImage(asset: ProposalProofAssetRecord) {
  const value = String(asset.mediaUrl || "").trim();
  if (!value) return false;
  if (value.startsWith("/")) return true;
  return /\.(avif|gif|jpe?g|png|svg|webp)(\?.*)?(#.*)?$/i.test(value);
}

export function proofNeedsMediaForReadiness(asset: ProposalProofAssetRecord) {
  return asset.type === "product_screenshot" || proofIsDrTanja(asset);
}

export function proofHasResultContext(asset: ProposalProofAssetRecord) {
  if (asset.type !== "performance_result") return true;
  return /\b(week|month|quarter|year|day|within|over|from|between|20\d{2}|delivery context|timeframe|documented delivery period)\b/.test(proofAssetText(asset));
}

export function proofHasVerifiedImage(asset: ProposalProofAssetRecord) {
  const text = proofAssetText(asset);
  const mediaUrl = String(asset.mediaUrl || "").toLowerCase();
  return Boolean(asset.mediaUrl) && (
    text.includes("verified image") ||
    text.includes("approved image") ||
    text.includes("image approved") ||
    mediaUrl.includes("tanja-phillips") ||
    mediaUrl.includes("dr-tanja") ||
    mediaUrl.includes("p17-img02-2400x1350")
  );
}

export function proofIsDrTanja(asset: ProposalProofAssetRecord) {
  return /dr\.?\s*tanja|tanja/i.test(proofAssetText(asset));
}

export function formatProofAssetType(type: ProposalProofAssetType) {
  return type.replace(/_/g, " ");
}

export function proofIsMatchedCaseStudy(
  asset: ProposalProofAssetRecord,
  form: ProposalProofSelectionForm,
  selectedClinicVariant: ProposalClinicTypeVariant,
) {
  return asset.type === "case_study" &&
    proofMatchesClinicSegments(asset, inferClinicSegmentsFromForm(form)) &&
    proofMatchesClinicVariant(asset, selectedClinicVariant);
}

export function proofIsPermissionedTestimonial(
  asset: ProposalProofAssetRecord,
  selectedClinicVariant: ProposalClinicTypeVariant,
) {
  return asset.type === "testimonial" &&
    proofHasPermission(asset) &&
    proofMatchesClinicVariant(asset, selectedClinicVariant);
}

export function proofIsPermissionedTestimonialVideo(
  asset: ProposalProofAssetRecord,
  selectedClinicVariant: ProposalClinicTypeVariant,
) {
  return asset.type === "testimonial_video" &&
    proofHasPermission(asset) &&
    proofMatchesClinicVariant(asset, selectedClinicVariant);
}

export function proofIsProductScreenshot(asset: ProposalProofAssetRecord) {
  return asset.type === "product_screenshot" &&
    proofHasMedia(asset) &&
    proofAssetText(asset).includes("clinicgrower os");
}

export function proofIsContextualPerformanceResult(asset: ProposalProofAssetRecord) {
  return asset.type === "performance_result" &&
    proofHasResultContext(asset);
}

export function getRecommendedProofAssetIds(
  proofAssets: ProposalProofAssetRecord[],
  form: ProposalProofSelectionForm,
  selectedClinicVariant: ProposalClinicTypeVariant,
) {
  const ids = new Set<string>();
  const candidates = proofAssets
    .filter((asset) => proofMatchesClinicVariant(asset, selectedClinicVariant))
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.title.localeCompare(b.title));
  const addFirst = (predicate: (asset: ProposalProofAssetRecord) => boolean, count = 1) => {
    for (const asset of candidates.filter(predicate).slice(0, count)) {
      ids.add(asset.id);
    }
  };

  addFirst((asset) => proofIsMatchedCaseStudy(asset, form, selectedClinicVariant));
  addFirst((asset) => proofIsPermissionedTestimonial(asset, selectedClinicVariant));
  addFirst((asset) => proofIsPermissionedTestimonialVideo(asset, selectedClinicVariant));
  addFirst(proofIsProductScreenshot);
  addFirst((asset) => proofIsContextualPerformanceResult(asset), 3);
  addFirst((asset) => asset.type === "award", 2);
  addFirst((asset) => asset.type === "client_logo" && proofHasMedia(asset), 1);
  addFirst((asset) => asset.type === "team_image" && proofHasMedia(asset), 1);

  return [...ids];
}

export function classifyProofAsset(
  asset: ProposalProofAssetRecord,
  form: ProposalProofSelectionForm,
  selectedClinicVariant: ProposalClinicTypeVariant,
): { tier: ProposalProofTier; note: string } {
  if (proofIsMatchedCaseStudy(asset, form, selectedClinicVariant)) {
    return { tier: "required", note: `case study matched to ${selectedClinicVariant.label}` };
  }
  if (proofIsPermissionedTestimonial(asset, selectedClinicVariant)) {
    return { tier: "required", note: "testimonial with permission" };
  }
  if (proofIsPermissionedTestimonialVideo(asset, selectedClinicVariant)) {
    return { tier: "required", note: "testimonial video with permission" };
  }
  if (proofIsProductScreenshot(asset)) {
    return { tier: "required", note: "ClinicGrower OS screenshot" };
  }
  if (proofIsContextualPerformanceResult(asset) && proofMatchesClinicVariant(asset, selectedClinicVariant)) {
    return { tier: "required", note: "performance result with timeframe and context" };
  }
  if (proofIsCommonAsset(asset)) {
    return { tier: "common", note: "common credibility asset" };
  }
  if (!proofMatchesClinicVariant(asset, selectedClinicVariant)) {
    return { tier: "optional", note: `not matched to ${selectedClinicVariant.label}` };
  }
  return { tier: "optional", note: "supporting proof" };
}
