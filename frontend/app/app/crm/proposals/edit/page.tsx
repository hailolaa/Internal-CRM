"use client";

import { ArrowLeft, CheckCircle2, Eye, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertBanner, ErrorBoundary, PageHeader } from "@/components/ui";
import { ProposalV5Renderer, buildProposalV5Snapshot, type ProposalV5Snapshot } from "@/components/proposals/v5";
import { getPackageProposalV5Scope } from "@/components/proposals/v5/data/packageScope";
import { getV5Page01MissingFields } from "@/components/proposals/v5/pages/V5Page01Cover";
import { getV5Page02MissingFields } from "@/components/proposals/v5/pages/V5Page02Recommendation";
import { getV5Page03MissingFields } from "@/components/proposals/v5/pages/V5Page03GoogleMediaRoas";
import { getV5Page04MissingFields } from "@/components/proposals/v5/pages/V5Page04GrowthEngine";
import { getV5Page05MissingFields } from "@/components/proposals/v5/pages/V5Page05GoogleAds";
import { getV5Page06MissingFields } from "@/components/proposals/v5/pages/V5Page06LandingConversion";
import { getV5Page07MissingFields } from "@/components/proposals/v5/pages/V5Page07SeoGbpWebsite";
import { getV5Page08MissingFields } from "@/components/proposals/v5/pages/V5Page08TrackingOptimisation";
import { getV5Page09MissingFields } from "@/components/proposals/v5/pages/V5Page09Roadmap";
import { getV5Page10MissingFields } from "@/components/proposals/v5/pages/V5Page10ManagementScope";
import { getV5Page11MissingFields } from "@/components/proposals/v5/pages/V5Page11PublishedProof";
import { getV5Page12MissingFields } from "@/components/proposals/v5/pages/V5Page12WhyClinicGrower";
import { getV5Page13MissingFields } from "@/components/proposals/v5/pages/V5Page13PartnershipInvestment";
import { getV5Page14MissingFields } from "@/components/proposals/v5/pages/V5Page14BillingTerms";
import { getV5Page15MissingFields } from "@/components/proposals/v5/pages/V5Page15Decision";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { GrowthPackageRecord, ProposalCommercialItem, ProposalDataState, ProposalPayload, ProposalProofAssetRecord, ProposalProofAssetType, ProposalPublicRecord, ProposalRecord, ProposalScopeItem, ProposalSectionContent, ProposalSectorImage, ProposalSourceDataRecord, ProposalTemplateRecord } from "@/lib/api-types";
import {
  PROPOSAL_CLINIC_TYPE_VARIANT_VERSION,
  getProposalClinicTypeAssetPack,
  getProposalClinicTypeVariant,
  inferProposalClinicTypeVariant,
  proposalClinicTypeVariants,
} from "@/lib/proposal-clinic-variants";
import {
  isCurrentProposalRequest,
  isFinalProposalStatus,
  loadOptionalProposalPackages,
  proposalEditorHref,
  proposalIdentityFromRecord,
  resolveProposalSaveTarget,
  type ProposalIdentity,
} from "@/lib/proposal-editor-state";
import {
  getFirstIncompleteProposalBuilderStep,
  getProposalBuilderMissingCount,
  getProposalBuilderStepProgress,
  proposalBuilderSteps,
  type ProposalBuilderStepId,
} from "./proposal-builder-ux";
import {
  classifyProofAsset,
  formatProofAssetType,
  getRecommendedProofAssetIds,
  proofHasMedia,
  proofHasResultContext,
  proofHasVerifiedImage,
  proofIsContextualPerformanceResult,
  proofIsDrTanja,
  proofIsMatchedCaseStudy,
  proofIsPermissionedTestimonial,
  proofIsPermissionedTestimonialVideo,
  proofIsProductScreenshot,
  proofMatchesClinicVariant,
  proofMediaLooksLikeImage,
  proofNeedsMediaForReadiness,
  proofTierLabels,
  type ProposalProofTier,
} from "./proposal-proof-selection";

const defaultProposalIntroVideoUrl = "https://vimeo.com/1008757315?fl=pl&fe=sh";

const scopeCategories = [
  "Strategy",
  "Google Ads",
  "Meta Ads",
  "SEO",
  "Google Business Profile",
  "Website/Landing Pages",
  "Tracking",
  "Lead Handling",
  "Reporting",
  "Content",
  "Conversion",
  "Retention",
  "Support",
];

const proofAssetTypes: Array<{ value: ProposalProofAssetType; label: string }> = [
  { value: "award", label: "Award" },
  { value: "testimonial", label: "Testimonial" },
  { value: "testimonial_video", label: "Testimonial video" },
  { value: "case_study", label: "Case study" },
  { value: "client_logo", label: "Client logo" },
  { value: "performance_result", label: "Performance result" },
  { value: "product_screenshot", label: "Product screenshot" },
  { value: "team_image", label: "Team image" },
];

const proofAssetGuidance: Record<ProposalProofAssetType, { copy: string; placeholder: string; tags: string }> = {
  award: {
    copy: "Use approved recognition only. Awards support credibility, but must not imply guaranteed future performance.",
    placeholder: "Aesthetics Awards 2025 Highly Commended. Included as credibility only, not as a guarantee of leads, bookings, revenue or ROI.",
    tags: "award, recognition, aesthetics",
  },
  testimonial: {
    copy: "Use a named testimonial only where permission, approval or consent is recorded in the copy or tags.",
    placeholder: "Named testimonial with permission approved: describe what the client valued and keep it relevant to this clinic type.",
    tags: "testimonial, permission approved, dentistry",
  },
  testimonial_video: {
    copy: "Use only approved testimonial videos. Include permission/approval wording and a media URL.",
    placeholder: "Named testimonial video with permission approved. Summarise the clinic context and what changed without implying a guarantee.",
    tags: "testimonial video, permission approved, aesthetics",
  },
  case_study: {
    copy: "Match the case study to the prospect's clinic type. Dental, ENT, dermatology and aesthetics should not all receive the same proof.",
    placeholder: "Verified case study for a similar clinic type. State the clinic context, problem, work delivered and why it is relevant to this prospect.",
    tags: "case study, dental, implants",
  },
  client_logo: {
    copy: "Use approved client logos only. Logo proof should support trust, not replace a real case study.",
    placeholder: "Approved client logo used as trust proof with permission recorded.",
    tags: "client logo, permission approved, private healthcare",
  },
  performance_result: {
    copy: "Every result needs timeframe and delivery context. Do not present old PPC, SEO or website results as ClinicGrower OS results.",
    placeholder: "Over 90 days, this clinic saw clearer source visibility and improved booked-consultation tracking after campaign and follow-up changes. Historical channel result, not a ClinicGrower OS guarantee.",
    tags: "performance result, 90 days, delivery context, aesthetics",
  },
  product_screenshot: {
    copy: "Use real ClinicGrower OS screenshots only. Add a media URL and include ClinicGrower OS in the title, copy or tags.",
    placeholder: "Real ClinicGrower OS screenshot showing Growth Score, leakage visibility, lead handling or next actions where connected.",
    tags: "ClinicGrower OS, product screenshot, Growth Score",
  },
  team_image: {
    copy: "Use approved team imagery only where it supports confidence in delivery or onboarding.",
    placeholder: "Approved ClinicGrower team image used to support credibility and delivery confidence.",
    tags: "team image, verified image, ClinicGrower",
  },
};

const fallbackProposalTemplates: ProposalTemplateRecord[] = [
  {
    id: "fallback-clinic-growth-engine",
    templateKey: "clinicgrower_v5",
    name: "Clinic Growth Engine",
    description: "Default sales proposal for Growth Score, growth plan and ongoing package recommendations.",
    packageName: "Clinic Growth Engine",
    defaultSections: {},
    defaultRoadmap: [],
    defaultTerms: "",
    defaultSuccessMetrics: [],
    defaultScopeItems: [],
    sortOrder: 10,
    isActive: true,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "fallback-bespoke-growth-plan",
    templateKey: "bespoke_growth_plan",
    name: "Bespoke Growth Plan",
    description: "Flexible structure for custom scope, mixed delivery or multi-location opportunities.",
    packageName: "Bespoke Growth Plan",
    defaultSections: {},
    defaultRoadmap: [],
    defaultTerms: "",
    defaultSuccessMetrics: [],
    defaultScopeItems: [],
    sortOrder: 20,
    isActive: true,
    createdAt: "",
    updatedAt: "",
  },
];

const builderInputClassName =
  "mt-1 min-h-11 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15";
const builderTextareaClassName =
  "mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15";
const builderLabelClassName = "block text-sm font-medium text-[#354943]";
const builderCardClassName = "rounded-[8px] border border-[#d8e4df] bg-white p-5";
const builderNumericFieldKeys = new Set([
  "currentMonthlyEnquiries",
  "currentMonthlyBookedPatients",
  "currentBookingRate",
  "attendanceRate",
  "consultationToTreatmentConversionRate",
  "averageTreatmentValue",
  "availableCommercialCapacity",
  "currentMarketingSpend",
  "currentAcquisitionCost",
  "clinicConfirmedContribution",
  "selectedMediaSpend",
  "targetBookings",
  "estimatedLeads",
  "estimatedBookedPatients",
  "breakEvenBookings",
]);
const builderFieldHints: Record<string, string> = {
  currentMonthlyEnquiries: "Number, for example 45.",
  currentMonthlyBookedPatients: "Number, for example 18.",
  currentBookingRate: "Percentage, for example 40%.",
  attendanceRate: "Percentage, for example 82%.",
  consultationToTreatmentConversionRate: "Percentage, for example 45%.",
  averageTreatmentValue: "GBP amount, for example 2700.",
  availableCommercialCapacity: "Number, for example 6 additional consultations per month.",
  currentMarketingSpend: "GBP amount per month, for example 3000.",
  currentAcquisitionCost: "GBP amount, for example 95.",
  clinicConfirmedContribution: "GBP amount, for example 1200.",
  selectedMediaSpend: "GBP amount per month, for example 1000.",
  targetBookings: "Number, for example 35.",
  estimatedLeads: "Number, for example 50.",
  estimatedBookedPatients: "Number, for example 25.",
  breakEvenBookings: "Number, for example 2.",
};

function builderInputModeForKey(key: string): "decimal" | undefined {
  return builderNumericFieldKeys.has(key) ? "decimal" : undefined;
}

type ProposalForm = {
  contactId: string;
  dealId: string;
  clientAccountProfileId: string;
  proposalName: string;
  templateKey: string;
  recommendedPackageId: string;
  packageName: string;
  value: string;
  monthlyFee: string;
  setupFee: string;
  currency: string;
  adSpendNote: string;
  vatStatus: string;
  minimumTermMonths: string;
  noticePeriodDays: string;
  startDate: string;
  status: ProposalRecord["status"];
  followUpAt: string;
  expiresAt: string;
  proposalUrl: string;
  notes: string;
  addOns: string;
  discounts: string;
  internalMarginNote: string;
  proposalReference: string;
  proposalDate: string;
  clinicTypeVariant: string;
  clinicTypeAssetVersion: string;
  heroImageUrl: string;
  heroImageAlt: string;
  discoverySource: string;
  customerWording: string;
  evidenceConfidenceState: ProposalDataState;
  activeConstraintId: string;
  activeConstraintConfidenceState: ProposalDataState;
  economicUnit: string;
  clinicConfirmedContribution: string;
  contributionEvidenceSourceDate: string;
  contributionConfirmationState: ProposalDataState;
  selectedMediaSpend: string;
  paybackState: ProposalDataState;
  liveDataStatus: "demo_data" | "partially_connected" | "live_connected" | "not_connected";
  knownDataLimitations: string;
  sectorImageApprovalStatus: "approved" | "to_confirm";
  sectorImageProvenance: string;
  sectorImages: ProposalSectorImage[];
  executiveSummary: string;
  personalIntroduction: string;
  diagnosis: string;
  introVideoUrl: string;
  introVideoTitle: string;
  introVideoThumbnailUrl: string;
  fallbackVideoUrl: string;
  primaryGoal: string;
  clinicTypeAndLocations: string;
  currentPosition: string;
  currentMarketingSpend: string;
  currentWebsiteCrmBookingSetup: string;
  problemsDiscussed: string;
  whyActNow: string;
  currentlyUnmeasured: string;
  availableCapacity: string;
  priorityTreatments: string;
  targetArea: string;
  desiredOutcome: string;
  growthScoreOverall: string;
  visibilityScore: string;
  conversionScore: string;
  trackingScore: string;
  leadHandlingScore: string;
  salesConversionScore: string;
  retentionScore: string;
  biggestRisk: string;
  biggestOpportunity: string;
  firstRecommendedFix: string;
  currentMonthlyEnquiries: string;
  currentMonthlyBookedPatients: string;
  currentBookingRate: string;
  attendanceRate: string;
  consultationToTreatmentConversionRate: string;
  targetBookings: string;
  consultationValue: string;
  averageTreatmentValue: string;
  availableCommercialCapacity: string;
  currentAcquisitionCost: string;
  recommendedAdSpend: string;
  estimatedCostPerLead: string;
  estimatedLeads: string;
  estimatedBookedPatients: string;
  breakEvenBookings: string;
  commercialDataSource: string;
  commercialChangeReason: string;
  commercialApprovalStatus: "not_required" | "pending" | "approved" | "rejected";
  recommendedPlan: string;
  proofAssetIds: string[];
  scopeItems: ProposalScopeItem[];
  strategyPoints: string;
  includedFeatures: string;
  successMetrics: string;
  clinicGrowerResponsibilities: string;
  clientResponsibilities: string;
  timeline: string;
  termsSummary: string;
  investmentNotes: string;
  nextSteps: string;
};

type ProofAssetDraft = {
  type: ProposalProofAssetType;
  title: string;
  copy: string;
  mediaUrl: string;
  sectorTags: string;
};

const emptyProofAssetDraft: ProofAssetDraft = {
  type: "testimonial",
  title: "",
  copy: "",
  mediaUrl: "",
  sectorTags: "",
};

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function moneyFromCents(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value / 100);
}

function centsFromMoney(value: string) {
  if (!value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric * 100) : null;
}

function intOrNull(value: string) {
  if (!value.trim()) return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function scoreOrNull(value: string) {
  if (!value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100 ? numeric : null;
}

function proposalDataState(value: unknown, fallback: ProposalDataState = "to_confirm"): ProposalDataState {
  if (value === "known" || value === "confirmed_on_call") return "known";
  if (value === "working_diagnosis" || value === "provisional" || value === "to_confirm") return value;
  return fallback;
}

function textLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function hasClientUseText(value: unknown) {
  return Boolean(String(value ?? "").trim());
}

function containsUndefinedScopePhrase(value: unknown) {
  const text = String(value ?? "").trim().toLowerCase();
  return [
    "as required",
    "agreed in roadmap",
    "confirmed separately",
    "to be agreed",
    "to be confirmed",
    "subject to agreed",
    "depends on access",
  ].some((phrase) => text.includes(phrase));
}

function isIncompleteSuccessMetric(value: string) {
  const parts = value.split("|").map((part) => part.trim());
  if (parts.length < 3 || parts.some((part) => !hasClientUseText(part))) return true;

  const text = parts.join(" ").toLowerCase();
  return [
    "baseline to establish",
    "directional improvement",
    "required before sending",
    "agreed during onboarding",
    "measured from agreed tracking sources",
  ].some((phrase) => text.includes(phrase));
}

function withRecommendedProofAssets(
  current: ProposalForm,
  proofAssets: ProposalProofAssetRecord[],
) {
  if (!proofAssets.length) return current;
  const variant = getProposalClinicTypeVariant(current.clinicTypeVariant);
  const recommendedIds = getRecommendedProofAssetIds(proofAssets, current, variant);
  const nextIds = Array.from(new Set([...current.proofAssetIds, ...recommendedIds]));
  return nextIds.length === current.proofAssetIds.length
    ? current
    : { ...current, proofAssetIds: nextIds };
}

function getProposalClientUseMissingItems(
  form: ProposalForm,
  selectedProofAssets: ProposalProofAssetRecord[],
  selectedClinicVariant: ReturnType<typeof getProposalClinicTypeVariant>,
) {
  const issues: string[] = [];
  const scopeItems = form.scopeItems.filter((item) => [
    item.category,
    item.title,
    item.clientDescription,
    item.frequency,
    item.quantityLimit,
    item.treatmentsAndLocations,
    item.dependencies,
    item.clientResponsibilities,
    item.exclusions,
    item.thirdPartyCosts,
  ].some(hasClientUseText));
  if (!scopeItems.length) {
    issues.push("Scope: add approved package scope rows");
  } else {
    const incompleteScope = scopeItems.some((item) => (
      !hasClientUseText(item.category) ||
      !hasClientUseText(item.title) ||
      !hasClientUseText(item.clientDescription) ||
      !hasClientUseText(item.frequency) ||
      !hasClientUseText(item.quantityLimit) ||
      !hasClientUseText(item.treatmentsAndLocations) ||
      !hasClientUseText(item.dependencies) ||
      !hasClientUseText(item.clientResponsibilities) ||
      !hasClientUseText(item.exclusions) ||
      !hasClientUseText(item.thirdPartyCosts) ||
      !hasClientUseText(item.deliveryType) ||
      !hasClientUseText(item.inclusionStatus)
    ));
    if (incompleteScope) {
      issues.push("Scope: complete every scope row with category, description, frequency, quantity, treatments/locations, dependencies, responsibilities, exclusions and third-party costs");
    }

    const vagueScope = scopeItems.some((item) => [
      item.clientDescription,
      item.frequency,
      item.quantityLimit,
      item.treatmentsAndLocations,
      item.dependencies,
      item.clientResponsibilities,
      item.exclusions,
      item.thirdPartyCosts,
    ].some(containsUndefinedScopePhrase));
    if (vagueScope) {
      issues.push("Scope: replace vague wording such as as required, agreed in roadmap, confirmed separately or to be agreed");
    }

    const unapprovedCustomScope = scopeItems.some((item) => (
      item.isCustom &&
      (!hasClientUseText(item.changeReason) || item.approvalStatus !== "approved")
    ));
    if (unapprovedCustomScope) {
      issues.push("Scope: approve every custom scope change and record the reason");
    }
  }

  const successMetrics = textLines(form.successMetrics);
  if (!successMetrics.length) {
    issues.push("Review: complete success measures with metric, target and measurement source");
  } else if (successMetrics.some(isIncompleteSuccessMetric)) {
    issues.push("Review: replace placeholder success measures with specific metric, target and source rows");
  }

  if (!selectedProofAssets.length) {
    issues.push("Proof: select relevant proof or credibility assets");
  } else {
    const proofTypesRequiringClinicMatch = ["case_study", "testimonial", "testimonial_video", "performance_result"];
    const mismatchedClinicProof = selectedProofAssets.some((asset) => (
      proofTypesRequiringClinicMatch.includes(asset.type) &&
      !proofMatchesClinicVariant(asset, selectedClinicVariant)
    ));
    const matchedCaseStudy = selectedProofAssets.some((asset) => (
      proofIsMatchedCaseStudy(asset, form, selectedClinicVariant)
    ));
    const permissionedTestimonial = selectedProofAssets.some((asset) => (
      proofIsPermissionedTestimonial(asset, selectedClinicVariant) ||
      proofIsPermissionedTestimonialVideo(asset, selectedClinicVariant)
    ));
    const productScreenshot = selectedProofAssets.some(proofIsProductScreenshot);
    const contextualResult = selectedProofAssets.some((asset) => (
        proofIsContextualPerformanceResult(asset)
    ));
    const invalidDrTanjaAsset = selectedProofAssets.some((asset) => (
      proofIsDrTanja(asset) &&
      !proofHasVerifiedImage(asset)
    ));
    const resultMissingContext = selectedProofAssets.some((asset) => !proofHasResultContext(asset));

    if (!matchedCaseStudy) issues.push("Proof: select one verified case study matched to the clinic type");
    if (!permissionedTestimonial) issues.push("Proof: select one named testimonial or testimonial video with permission recorded");
    if (!productScreenshot) issues.push("Proof: select at least one real ClinicGrower OS product screenshot");
    if (!contextualResult) issues.push("Proof: select a performance result with timeframe and delivery context");
    if (resultMissingContext) issues.push("Proof: add timeframe and delivery context to every performance-result asset");
    if (invalidDrTanjaAsset) issues.push("Proof: use the verified Dr Tanja image for Dr Tanja proof");
    if (mismatchedClinicProof) issues.push(`Proof: remove assets that do not match ${selectedClinicVariant.label}`);
  }

  return Array.from(new Set(issues));
}

function cleanScopeItems(items: ProposalScopeItem[] | null | undefined): ProposalScopeItem[] {
  return (items || [])
    .map((item, index) => ({
      category: scopeCategories.includes(item.category) ? item.category : "Strategy",
      title: item.title.trim(),
      clientDescription: item.clientDescription.trim(),
      frequency: item.frequency?.trim() || null,
      quantityLimit: item.quantityLimit?.trim() || null,
      treatmentsAndLocations: item.treatmentsAndLocations?.trim() || null,
      dependencies: item.dependencies?.trim() || null,
      clientResponsibilities: item.clientResponsibilities?.trim() || null,
      exclusions: item.exclusions?.trim() || null,
      thirdPartyCosts: item.thirdPartyCosts?.trim() || null,
      inclusionStatus: item.inclusionStatus === "excluded" ? "excluded" as const : "included" as const,
      deliveryType: item.deliveryType === "one_off" ? "one_off" as const : "recurring" as const,
      isOptionalAddOn: Boolean(item.isOptionalAddOn),
      isCustom: Boolean(item.isCustom),
      changeReason: item.changeReason?.trim() || null,
      approvalStatus: item.approvalStatus === "approved" || item.approvalStatus === "pending" || item.approvalStatus === "rejected"
        ? item.approvalStatus
        : "not_required" as const,
      sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index + 1,
    }))
    .filter((item) => item.title && item.clientDescription)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

function packageCatalogueScopeItems(packageRecord: GrowthPackageRecord | null | undefined): ProposalScopeItem[] {
  return getPackageProposalV5Scope(packageRecord).map((item, index) => ({
    category: item.category || "Strategy",
    title: item.title || "",
    clientDescription: item.description || "",
    frequency: item.frequency,
    quantityLimit: item.quantityLimit,
    treatmentsAndLocations: item.treatmentsAndLocations,
    dependencies: item.dependency,
    clientResponsibilities: item.owner,
    exclusions: item.exclusion,
    thirdPartyCosts: item.thirdPartyCosts,
    inclusionStatus: item.inclusionStatus || "included",
    deliveryType: item.deliveryType || "recurring",
    isOptionalAddOn: item.isOptionalAddOn,
    isCustom: false,
    approvalStatus: item.approvalStatus || "not_required",
    sortOrder: index + 1,
  }));
}

function commercialItemsFromText(value: string): ProposalCommercialItem[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [namePart, amountPart, notePart] = line.split("|").map((part) => part.trim());
      return {
        name: namePart,
        amountCents: amountPart ? centsFromMoney(amountPart) : null,
        note: notePart || null,
      };
    });
}

function commercialItemsToText(items: ProposalCommercialItem[] | null | undefined) {
  return (items || [])
    .map((item) => [item.name, item.amountCents === null || item.amountCents === undefined ? "" : String(item.amountCents / 100), item.note || ""]
      .filter((part, index) => index === 0 || part)
      .join(" | "))
    .join("\n");
}

function sectionContentFromForm(form: ProposalForm): ProposalSectionContent {
  return {
    proposalReference: form.proposalReference.trim() || null,
    proposalDate: form.proposalDate || null,
    clinicTypeVariant: form.clinicTypeVariant || "general",
    clinicTypeAssetVersion: form.clinicTypeAssetVersion || PROPOSAL_CLINIC_TYPE_VARIANT_VERSION,
    heroImageUrl: form.heroImageUrl.trim() || null,
    heroImageAlt: form.heroImageAlt.trim() || null,
    discoverySource: form.discoverySource.trim() || null,
    customerWording: form.customerWording.trim() || null,
    evidenceConfidenceState: form.evidenceConfidenceState,
    activeConstraintId: form.activeConstraintId.trim() || null,
    activeConstraintConfidenceState: form.activeConstraintConfidenceState,
    economicUnit: form.economicUnit.trim() || null,
    clinicConfirmedContribution: form.clinicConfirmedContribution.trim() || null,
    contributionEvidenceSourceDate: form.contributionEvidenceSourceDate.trim() || null,
    contributionConfirmationState: form.contributionConfirmationState,
    selectedMediaSpend: form.selectedMediaSpend.trim() || null,
    paybackState: form.paybackState,
    liveDataStatus: form.liveDataStatus,
    knownDataLimitations: form.knownDataLimitations.trim() || null,
    sectorImageApprovalStatus: form.sectorImageApprovalStatus,
    sectorImageProvenance: form.sectorImageProvenance.trim() || null,
    sectorImages: form.sectorImages,
    executiveSummary: form.executiveSummary.trim() || null,
    personalIntroduction: form.personalIntroduction.trim() || null,
    diagnosis: form.diagnosis.trim() || null,
    introVideoUrl: form.introVideoUrl.trim() || null,
    introVideoTitle: form.introVideoTitle.trim() || null,
    introVideoThumbnailUrl: form.introVideoThumbnailUrl.trim() || null,
    fallbackVideoUrl: form.fallbackVideoUrl.trim() || null,
    primaryGoal: form.primaryGoal.trim() || null,
    clinicTypeAndLocations: form.clinicTypeAndLocations.trim() || null,
    currentPosition: form.currentPosition.trim() || null,
    currentMarketingSpend: form.currentMarketingSpend.trim() || null,
    currentWebsiteCrmBookingSetup: form.currentWebsiteCrmBookingSetup.trim() || null,
    problemsDiscussed: form.problemsDiscussed.trim() || null,
    whyActNow: form.whyActNow.trim() || null,
    currentlyUnmeasured: form.currentlyUnmeasured.trim() || null,
    availableCapacity: form.availableCapacity.trim() || null,
    priorityTreatments: form.priorityTreatments.trim() || null,
    targetArea: form.targetArea.trim() || null,
    desiredOutcome: form.desiredOutcome.trim() || null,
    growthScoreOverall: scoreOrNull(form.growthScoreOverall),
    visibilityScore: scoreOrNull(form.visibilityScore),
    conversionScore: scoreOrNull(form.conversionScore),
    trackingScore: scoreOrNull(form.trackingScore),
    leadHandlingScore: scoreOrNull(form.leadHandlingScore),
    salesConversionScore: scoreOrNull(form.salesConversionScore),
    retentionScore: scoreOrNull(form.retentionScore),
    biggestRisk: form.biggestRisk.trim() || null,
    biggestOpportunity: form.biggestOpportunity.trim() || null,
    firstRecommendedFix: form.firstRecommendedFix.trim() || null,
    currentMonthlyEnquiries: form.currentMonthlyEnquiries.trim() || null,
    currentMonthlyBookedPatients: form.currentMonthlyBookedPatients.trim() || null,
    currentBookingRate: form.currentBookingRate.trim() || null,
    attendanceRate: form.attendanceRate.trim() || null,
    consultationToTreatmentConversionRate: form.consultationToTreatmentConversionRate.trim() || null,
    targetBookings: form.targetBookings.trim() || null,
    consultationValue: form.consultationValue.trim() || null,
    averageTreatmentValue: form.averageTreatmentValue.trim() || null,
    availableCommercialCapacity: form.availableCommercialCapacity.trim() || null,
    currentAcquisitionCost: form.currentAcquisitionCost.trim() || null,
    recommendedAdSpend: form.recommendedAdSpend.trim() || null,
    estimatedCostPerLead: form.estimatedCostPerLead.trim() || null,
    estimatedLeads: form.estimatedLeads.trim() || null,
    estimatedBookedPatients: form.estimatedBookedPatients.trim() || null,
    breakEvenBookings: form.breakEvenBookings.trim() || null,
    commercialDataSource: form.commercialDataSource.trim() || null,
    commercialChangeReason: form.commercialChangeReason.trim() || null,
    commercialApprovalStatus: form.commercialApprovalStatus,
    recommendedPlan: form.recommendedPlan.trim() || null,
    proofAssetIds: form.proofAssetIds,
    scopeItems: cleanScopeItems(form.scopeItems),
    strategyPoints: textLines(form.strategyPoints),
    includedFeatures: textLines(form.includedFeatures),
    successMetrics: textLines(form.successMetrics),
    clinicGrowerResponsibilities: textLines(form.clinicGrowerResponsibilities),
    clientResponsibilities: textLines(form.clientResponsibilities),
    timeline: form.timeline.trim() || null,
    termsSummary: form.termsSummary.trim() || null,
    investmentNotes: form.investmentNotes.trim() || null,
    nextSteps: form.nextSteps.trim() || null,
  };
}

function formFromProposal(proposal: ProposalRecord): ProposalForm {
  const sections = proposal.sectionContent || {};
  return {
    contactId: proposal.contactId || "",
    dealId: proposal.dealId || "",
    clientAccountProfileId: proposal.clientAccountProfileId || "",
    proposalName: proposal.proposalName || "",
    templateKey: proposal.templateKey || "clinicgrower_v5",
    recommendedPackageId: proposal.recommendedPackageId || "",
    packageName: proposal.packageName || "",
    value: moneyFromCents(proposal.valueCents),
    monthlyFee: moneyFromCents(proposal.monthlyFeeCents),
    setupFee: moneyFromCents(proposal.setupFeeCents),
    currency: proposal.currency || "GBP",
    adSpendNote: proposal.adSpendNote || "",
    vatStatus: proposal.vatStatus || "",
    minimumTermMonths: proposal.minimumTermMonths === null || proposal.minimumTermMonths === undefined ? "" : String(proposal.minimumTermMonths),
    noticePeriodDays: proposal.noticePeriodDays === null || proposal.noticePeriodDays === undefined ? "" : String(proposal.noticePeriodDays),
    startDate: proposal.startDate || "",
    status: proposal.status,
    followUpAt: toDateTimeLocal(proposal.followUpAt),
    expiresAt: toDateTimeLocal(proposal.expiresAt),
    proposalUrl: proposal.proposalUrl || "",
    notes: proposal.notes || "",
    addOns: commercialItemsToText(proposal.addOns),
    discounts: commercialItemsToText(proposal.discounts),
    internalMarginNote: proposal.internalMarginNote || "",
    proposalReference: sections.proposalReference || "",
    proposalDate: sections.proposalDate || "",
    clinicTypeVariant: sections.clinicTypeVariant || "general",
    clinicTypeAssetVersion: sections.clinicTypeAssetVersion || PROPOSAL_CLINIC_TYPE_VARIANT_VERSION,
    heroImageUrl: sections.heroImageUrl || "",
    heroImageAlt: sections.heroImageAlt || "",
    discoverySource: sections.discoverySource || "",
    customerWording: sections.customerWording || "",
    evidenceConfidenceState: proposalDataState(sections.evidenceConfidenceState),
    activeConstraintId: sections.activeConstraintId || "",
    activeConstraintConfidenceState: proposalDataState(sections.activeConstraintConfidenceState, "working_diagnosis"),
    economicUnit: sections.economicUnit || "",
    clinicConfirmedContribution: sections.clinicConfirmedContribution || "",
    contributionEvidenceSourceDate: sections.contributionEvidenceSourceDate || "",
    contributionConfirmationState: proposalDataState(sections.contributionConfirmationState),
    selectedMediaSpend: sections.selectedMediaSpend || "",
    paybackState: proposalDataState(sections.paybackState),
    liveDataStatus: sections.liveDataStatus || "demo_data",
    knownDataLimitations: sections.knownDataLimitations || "",
    sectorImageApprovalStatus: sections.sectorImageApprovalStatus || "approved",
    sectorImageProvenance: sections.sectorImageProvenance || "",
    sectorImages: sections.sectorImages?.length ? sections.sectorImages : sectorImagesFromVariant(sections.clinicTypeVariant || "general"),
    executiveSummary: sections.executiveSummary || "",
    personalIntroduction: sections.personalIntroduction || "",
    diagnosis: sections.diagnosis || "",
    introVideoUrl: sections.introVideoUrl || "",
    introVideoTitle: sections.introVideoTitle || "",
    introVideoThumbnailUrl: sections.introVideoThumbnailUrl || "",
    fallbackVideoUrl: sections.fallbackVideoUrl || "",
    primaryGoal: sections.primaryGoal || "",
    clinicTypeAndLocations: sections.clinicTypeAndLocations || "",
    currentPosition: sections.currentPosition || "",
    currentMarketingSpend: sections.currentMarketingSpend || "",
    currentWebsiteCrmBookingSetup: sections.currentWebsiteCrmBookingSetup || "",
    problemsDiscussed: sections.problemsDiscussed || "",
    whyActNow: sections.whyActNow || "",
    currentlyUnmeasured: sections.currentlyUnmeasured || "",
    availableCapacity: sections.availableCapacity || "",
    priorityTreatments: sections.priorityTreatments || "",
    targetArea: sections.targetArea || "",
    desiredOutcome: sections.desiredOutcome || "",
    growthScoreOverall: sections.growthScoreOverall === null || sections.growthScoreOverall === undefined ? "" : String(sections.growthScoreOverall),
    visibilityScore: sections.visibilityScore === null || sections.visibilityScore === undefined ? "" : String(sections.visibilityScore),
    conversionScore: sections.conversionScore === null || sections.conversionScore === undefined ? "" : String(sections.conversionScore),
    trackingScore: sections.trackingScore === null || sections.trackingScore === undefined ? "" : String(sections.trackingScore),
    leadHandlingScore: sections.leadHandlingScore === null || sections.leadHandlingScore === undefined ? "" : String(sections.leadHandlingScore),
    salesConversionScore: sections.salesConversionScore === null || sections.salesConversionScore === undefined ? "" : String(sections.salesConversionScore),
    retentionScore: sections.retentionScore === null || sections.retentionScore === undefined ? "" : String(sections.retentionScore),
    biggestRisk: sections.biggestRisk || "",
    biggestOpportunity: sections.biggestOpportunity || "",
    firstRecommendedFix: sections.firstRecommendedFix || "",
    currentMonthlyEnquiries: sections.currentMonthlyEnquiries || "",
    currentMonthlyBookedPatients: sections.currentMonthlyBookedPatients || "",
    currentBookingRate: sections.currentBookingRate || "",
    attendanceRate: sections.attendanceRate || "",
    consultationToTreatmentConversionRate: sections.consultationToTreatmentConversionRate || "",
    targetBookings: sections.targetBookings || "",
    consultationValue: sections.consultationValue || "",
    averageTreatmentValue: sections.averageTreatmentValue || "",
    availableCommercialCapacity: sections.availableCommercialCapacity || "",
    currentAcquisitionCost: sections.currentAcquisitionCost || "",
    recommendedAdSpend: sections.recommendedAdSpend || "",
    estimatedCostPerLead: sections.estimatedCostPerLead || "",
    estimatedLeads: sections.estimatedLeads || "",
    estimatedBookedPatients: sections.estimatedBookedPatients || "",
    breakEvenBookings: sections.breakEvenBookings || "",
    commercialDataSource: sections.commercialDataSource || "",
    commercialChangeReason: sections.commercialChangeReason || "",
    commercialApprovalStatus: sections.commercialApprovalStatus || "not_required",
    recommendedPlan: sections.recommendedPlan || "",
    proofAssetIds: Array.isArray(sections.proofAssetIds) ? sections.proofAssetIds : [],
    scopeItems: cleanScopeItems(sections.scopeItems),
    strategyPoints: (sections.strategyPoints || []).join("\n"),
    includedFeatures: (sections.includedFeatures || []).join("\n"),
    successMetrics: (sections.successMetrics || []).join("\n"),
    clinicGrowerResponsibilities: (sections.clinicGrowerResponsibilities || []).join("\n"),
    clientResponsibilities: (sections.clientResponsibilities || []).join("\n"),
    timeline: sections.timeline || "",
    termsSummary: sections.termsSummary || "",
    investmentNotes: sections.investmentNotes || "",
    nextSteps: sections.nextSteps || "",
  };
}

function createInitialForm(searchParams: URLSearchParams): ProposalForm {
  const packageName = searchParams.get("packageName") || "";
  const accountName = searchParams.get("accountName") || "New opportunity";
  return {
    contactId: searchParams.get("contactId") || "",
    dealId: searchParams.get("dealId") || "",
    clientAccountProfileId: searchParams.get("clientAccountProfileId") || "",
    proposalName: searchParams.get("proposalName") || `${accountName} proposal`,
    templateKey: searchParams.get("templateKey") || "clinicgrower_v5",
    recommendedPackageId: searchParams.get("recommendedPackageId") || "",
    packageName,
    value: "",
    monthlyFee: "",
    setupFee: "",
    currency: "GBP",
    adSpendNote: "",
    vatStatus: "",
    minimumTermMonths: "",
    noticePeriodDays: "",
    startDate: "",
    status: "draft",
    followUpAt: "",
    expiresAt: "",
    proposalUrl: "",
    notes: "",
    addOns: "",
    discounts: "",
    internalMarginNote: "",
    proposalReference: defaultProposalReference(),
    proposalDate: new Date().toISOString().slice(0, 10),
    clinicTypeVariant: "general",
    clinicTypeAssetVersion: PROPOSAL_CLINIC_TYPE_VARIANT_VERSION,
    heroImageUrl: "",
    heroImageAlt: "",
    discoverySource: "",
    customerWording: "",
    evidenceConfidenceState: "to_confirm",
    activeConstraintId: "",
    activeConstraintConfidenceState: "working_diagnosis",
    economicUnit: "",
    clinicConfirmedContribution: "",
    contributionEvidenceSourceDate: "",
    contributionConfirmationState: "to_confirm",
    selectedMediaSpend: "",
    paybackState: "to_confirm",
    liveDataStatus: "demo_data",
    knownDataLimitations: "",
    sectorImageApprovalStatus: "approved",
    sectorImageProvenance: "",
    sectorImages: sectorImagesFromVariant("general"),
    executiveSummary: "",
    personalIntroduction: "",
    diagnosis: "",
    introVideoUrl: defaultProposalIntroVideoUrl,
    introVideoTitle: "A short message from ClinicGrower",
    introVideoThumbnailUrl: "",
    fallbackVideoUrl: "",
    primaryGoal: "",
    clinicTypeAndLocations: "",
    currentPosition: "",
    currentMarketingSpend: "",
    currentWebsiteCrmBookingSetup: "",
    problemsDiscussed: "",
    whyActNow: "",
    currentlyUnmeasured: "",
    availableCapacity: "",
    priorityTreatments: "",
    targetArea: "",
    desiredOutcome: "",
    growthScoreOverall: "",
    visibilityScore: "",
    conversionScore: "",
    trackingScore: "",
    leadHandlingScore: "",
    salesConversionScore: "",
    retentionScore: "",
    biggestRisk: "",
    biggestOpportunity: "",
    firstRecommendedFix: "",
    currentMonthlyEnquiries: "",
    currentMonthlyBookedPatients: "",
    currentBookingRate: "",
    attendanceRate: "",
    consultationToTreatmentConversionRate: "",
    targetBookings: "",
    consultationValue: "",
    averageTreatmentValue: "",
    availableCommercialCapacity: "",
    currentAcquisitionCost: "",
    recommendedAdSpend: "",
    estimatedCostPerLead: "",
    estimatedLeads: "",
    estimatedBookedPatients: "",
    breakEvenBookings: "",
    commercialDataSource: "",
    commercialChangeReason: "",
    commercialApprovalStatus: "not_required",
    recommendedPlan: "",
    proofAssetIds: [],
    scopeItems: [],
    strategyPoints: "",
    includedFeatures: "",
    successMetrics: "",
    clinicGrowerResponsibilities: "",
    clientResponsibilities: "",
    timeline: "",
    termsSummary: "",
    investmentNotes: "",
    nextSteps: "",
  };
}

function identityFromSearchParams(searchParams: URLSearchParams): ProposalIdentity {
  return {
    contactName: searchParams.get("contactName") || null,
    accountName: searchParams.get("accountName") || null,
    clientAccountName: searchParams.get("clientAccountName") || null,
  };
}

function currentBrowserRouteKey() {
  return `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`;
}

function statusLabel(value: ProposalRecord["status"]) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const CLIENT_VISIBLE_LOCKED_PROPOSAL_STATUSES = [
  "sent",
  "viewed",
  "follow_up_due",
] as const satisfies readonly ProposalRecord["status"][];

function formTextValue(form: ProposalForm, key: keyof ProposalForm) {
  const value = form[key];
  return typeof value === "string" ? value : "";
}

function formatPackagePrice(item: GrowthPackageRecord) {
  if (item.priceCents === null || item.priceCents === undefined) return "Bespoke";
  const price = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: item.currency || "GBP",
    maximumFractionDigits: 0,
  }).format(item.priceCents / 100);
  return item.billingFrequency === "one_off" ? `${price} one-off` : `${price}/${item.billingFrequency.replace(/_/g, " ")}`;
}

function packageCommercialText(packageRecord: GrowthPackageRecord | null | undefined, key: string) {
  const notes = packageRecord?.commercialNotes;
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) return "";
  const value = (notes as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function mergeIfBlank(currentValue: string, suggestedValue: string | null | undefined) {
  return currentValue.trim() ? currentValue : suggestedValue || "";
}

function mergeIntroVideoUrl(currentValue: string, suggestedValue: string | null | undefined) {
  if (!suggestedValue) return currentValue;
  return !currentValue.trim() || currentValue === defaultProposalIntroVideoUrl ? suggestedValue : currentValue;
}

function sectorImagesFromVariant(variantId: string): ProposalSectorImage[] {
  return getProposalClinicTypeAssetPack(variantId).sectorImages.map((image) => ({
    slot: image.slot,
    imageId: image.imageId,
    url: image.url,
    cropPosition: image.cropPosition,
    licence: image.licence,
    provenance: image.provenance,
    approvalStatus: image.approvalStatus,
  }));
}

function applyClinicVariantDefaults(current: ProposalForm, variantId: string): ProposalForm {
  const variant = getProposalClinicTypeVariant(variantId);
  const currentVariant = getProposalClinicTypeVariant(current.clinicTypeVariant);
  const mayRefreshVariantDefaults = currentVariant.id !== variant.id;
  const nextSectorImages = mayRefreshVariantDefaults || current.sectorImages.length < 4
    ? sectorImagesFromVariant(variant.id)
    : current.sectorImages;
  return {
    ...current,
    clinicTypeVariant: variant.id,
    clinicTypeAssetVersion: PROPOSAL_CLINIC_TYPE_VARIANT_VERSION,
    heroImageUrl: mergeIfBlank(current.heroImageUrl, variant.heroImageUrl),
    heroImageAlt: mergeIfBlank(current.heroImageAlt, variant.heroImageAlt),
    economicUnit: mayRefreshVariantDefaults || !current.economicUnit.trim()
      ? variant.economicUnit
      : current.economicUnit,
    activeConstraintId: mayRefreshVariantDefaults || !current.activeConstraintId.trim()
      ? variant.activeConstraintExample
      : current.activeConstraintId,
    sectorImageApprovalStatus: "approved",
    sectorImageProvenance: mergeIfBlank(current.sectorImageProvenance, variant.heroImageSourceUrl),
    sectorImages: nextSectorImages,
    clinicTypeAndLocations: mergeIfBlank(current.clinicTypeAndLocations, `${variant.label} with location and catchment confirmed from the CRM record or discovery notes.`),
    priorityTreatments: mayRefreshVariantDefaults || !current.priorityTreatments.trim()
      ? variant.treatmentExamples
      : current.priorityTreatments,
    problemsDiscussed: mayRefreshVariantDefaults || !current.problemsDiscussed.trim()
      ? variant.painPoints.join("; ")
      : current.problemsDiscussed,
    availableCapacity: mayRefreshVariantDefaults || !current.availableCapacity.trim()
      ? `Not currently measured. Confirm capacity against the ${variant.economicUnit} route before issue. ${variant.activeConstraintExample}`
      : current.availableCapacity,
    currentPosition: mayRefreshVariantDefaults || !current.currentPosition.trim()
      ? `The priority journey is ${variant.firstJourneyEmphasis}. The proposal should show what is known, what is provisional and what still needs confirming.`
      : current.currentPosition,
    firstRecommendedFix: mayRefreshVariantDefaults || !current.firstRecommendedFix.trim()
      ? variant.responseExample
      : current.firstRecommendedFix,
    currentlyUnmeasured: mayRefreshVariantDefaults || !current.currentlyUnmeasured.trim()
      ? `${variant.appointmentLanguage}, response speed, source-to-booking movement, contribution per ${variant.economicUnit} and revenue visibility where connected.`
      : current.currentlyUnmeasured,
  };
}

function defaultProposalReference() {
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = now.getTime().toString(36).slice(-4).toUpperCase();
  return `CG-${yyyymmdd}-${suffix}`;
}

function normaliseProposalTemplate(template: ProposalTemplateRecord): ProposalTemplateRecord {
  return template;
}

function formWithTemplateDefaults(current: ProposalForm, template: ProposalTemplateRecord): ProposalForm {
  const sections = template.defaultSections || {};
  const timeline = sections.timeline || template.defaultRoadmap.join("\n");
  const successMetrics = (sections.successMetrics || template.defaultSuccessMetrics).join("\n");
  return {
    ...current,
    templateKey: template.templateKey,
    packageName: mergeIfBlank(current.packageName, template.packageName),
    proposalReference: mergeIfBlank(current.proposalReference, sections.proposalReference),
    proposalDate: mergeIfBlank(current.proposalDate, sections.proposalDate),
    clinicTypeVariant: current.clinicTypeVariant || sections.clinicTypeVariant || "general",
    clinicTypeAssetVersion: current.clinicTypeAssetVersion || sections.clinicTypeAssetVersion || PROPOSAL_CLINIC_TYPE_VARIANT_VERSION,
    heroImageUrl: mergeIfBlank(current.heroImageUrl, sections.heroImageUrl),
    heroImageAlt: mergeIfBlank(current.heroImageAlt, sections.heroImageAlt),
    executiveSummary: mergeIfBlank(current.executiveSummary, sections.executiveSummary),
    personalIntroduction: mergeIfBlank(current.personalIntroduction, sections.personalIntroduction),
    diagnosis: mergeIfBlank(current.diagnosis, sections.diagnosis),
    introVideoUrl: mergeIntroVideoUrl(current.introVideoUrl, sections.introVideoUrl),
    introVideoTitle: mergeIfBlank(current.introVideoTitle, sections.introVideoTitle),
    introVideoThumbnailUrl: mergeIfBlank(current.introVideoThumbnailUrl, sections.introVideoThumbnailUrl),
    fallbackVideoUrl: mergeIfBlank(current.fallbackVideoUrl, sections.fallbackVideoUrl),
    primaryGoal: mergeIfBlank(current.primaryGoal, sections.primaryGoal),
    clinicTypeAndLocations: mergeIfBlank(current.clinicTypeAndLocations, sections.clinicTypeAndLocations),
    currentPosition: mergeIfBlank(current.currentPosition, sections.currentPosition),
    currentMarketingSpend: mergeIfBlank(current.currentMarketingSpend, sections.currentMarketingSpend),
    currentWebsiteCrmBookingSetup: mergeIfBlank(current.currentWebsiteCrmBookingSetup, sections.currentWebsiteCrmBookingSetup),
    problemsDiscussed: mergeIfBlank(current.problemsDiscussed, sections.problemsDiscussed),
    whyActNow: mergeIfBlank(current.whyActNow, sections.whyActNow),
    currentlyUnmeasured: mergeIfBlank(current.currentlyUnmeasured, sections.currentlyUnmeasured),
    availableCapacity: mergeIfBlank(current.availableCapacity, sections.availableCapacity),
    priorityTreatments: mergeIfBlank(current.priorityTreatments, sections.priorityTreatments),
    targetArea: mergeIfBlank(current.targetArea, sections.targetArea),
    desiredOutcome: mergeIfBlank(current.desiredOutcome, sections.desiredOutcome),
    biggestRisk: mergeIfBlank(current.biggestRisk, sections.biggestRisk),
    biggestOpportunity: mergeIfBlank(current.biggestOpportunity, sections.biggestOpportunity),
    firstRecommendedFix: mergeIfBlank(current.firstRecommendedFix, sections.firstRecommendedFix),
    currentMonthlyEnquiries: mergeIfBlank(current.currentMonthlyEnquiries, sections.currentMonthlyEnquiries),
    currentMonthlyBookedPatients: mergeIfBlank(current.currentMonthlyBookedPatients, sections.currentMonthlyBookedPatients),
    currentBookingRate: mergeIfBlank(current.currentBookingRate, sections.currentBookingRate),
    attendanceRate: mergeIfBlank(current.attendanceRate, sections.attendanceRate),
    consultationToTreatmentConversionRate: mergeIfBlank(current.consultationToTreatmentConversionRate, sections.consultationToTreatmentConversionRate),
    targetBookings: mergeIfBlank(current.targetBookings, sections.targetBookings),
    consultationValue: mergeIfBlank(current.consultationValue, sections.consultationValue),
    averageTreatmentValue: mergeIfBlank(current.averageTreatmentValue, sections.averageTreatmentValue),
    availableCommercialCapacity: mergeIfBlank(current.availableCommercialCapacity, sections.availableCommercialCapacity),
    currentAcquisitionCost: mergeIfBlank(current.currentAcquisitionCost, sections.currentAcquisitionCost),
    recommendedAdSpend: mergeIfBlank(current.recommendedAdSpend, sections.recommendedAdSpend),
    estimatedCostPerLead: mergeIfBlank(current.estimatedCostPerLead, sections.estimatedCostPerLead),
    estimatedLeads: mergeIfBlank(current.estimatedLeads, sections.estimatedLeads),
    estimatedBookedPatients: mergeIfBlank(current.estimatedBookedPatients, sections.estimatedBookedPatients),
    breakEvenBookings: mergeIfBlank(current.breakEvenBookings, sections.breakEvenBookings),
    commercialDataSource: mergeIfBlank(current.commercialDataSource, sections.commercialDataSource),
    commercialChangeReason: mergeIfBlank(current.commercialChangeReason, sections.commercialChangeReason),
    commercialApprovalStatus: current.commercialApprovalStatus === "not_required" ? sections.commercialApprovalStatus || current.commercialApprovalStatus : current.commercialApprovalStatus,
    recommendedPlan: mergeIfBlank(current.recommendedPlan, sections.recommendedPlan),
    scopeItems: current.scopeItems.length
      ? current.scopeItems
      : cleanScopeItems(sections.scopeItems || []),
    strategyPoints: mergeIfBlank(current.strategyPoints, (sections.strategyPoints || []).join("\n")),
    includedFeatures: mergeIfBlank(current.includedFeatures, (sections.includedFeatures || []).join("\n")),
    successMetrics: mergeIfBlank(current.successMetrics, successMetrics),
    clinicGrowerResponsibilities: mergeIfBlank(current.clinicGrowerResponsibilities, (sections.clinicGrowerResponsibilities || []).join("\n")),
    clientResponsibilities: mergeIfBlank(current.clientResponsibilities, (sections.clientResponsibilities || []).join("\n")),
    timeline: mergeIfBlank(current.timeline, timeline),
    termsSummary: mergeIfBlank(current.termsSummary, sections.termsSummary || template.defaultTerms),
    investmentNotes: mergeIfBlank(current.investmentNotes, sections.investmentNotes),
    nextSteps: mergeIfBlank(current.nextSteps, sections.nextSteps),
  };
}

function formWithSourceData(current: ProposalForm, sourceData: ProposalSourceDataRecord): ProposalForm {
  const suggested = sourceData.suggested;
  const sections = suggested.sectionContent || {};
  const inferredClinicTypeVariant = sections.clinicTypeVariant || inferProposalClinicTypeVariant([
    sourceData.contact.accountName,
    sourceData.clientAccount.name,
    sections.clinicTypeAndLocations,
    sections.priorityTreatments,
  ]).id;
  const nextClinicTypeVariant = current.clinicTypeVariant && current.clinicTypeVariant !== "general"
    ? current.clinicTypeVariant
    : inferredClinicTypeVariant;
  const nextSectorImages = sections.sectorImages?.length
    ? sections.sectorImages
    : current.clinicTypeVariant === nextClinicTypeVariant && current.sectorImages.length >= 4
      ? current.sectorImages
      : sectorImagesFromVariant(nextClinicTypeVariant);
  return {
    ...current,
    contactId: mergeIfBlank(current.contactId, sourceData.links.contactId),
    dealId: mergeIfBlank(current.dealId, sourceData.links.dealId),
    clientAccountProfileId: mergeIfBlank(current.clientAccountProfileId, sourceData.links.clientAccountProfileId),
    proposalName: mergeIfBlank(current.proposalName, suggested.proposalName),
    templateKey: current.templateKey === "clinicgrower_v5" ? suggested.templateKey || current.templateKey : current.templateKey,
    recommendedPackageId: mergeIfBlank(current.recommendedPackageId, suggested.recommendedPackageId),
    packageName: mergeIfBlank(current.packageName, suggested.packageName),
    proposalReference: mergeIfBlank(current.proposalReference, sections.proposalReference),
    proposalDate: mergeIfBlank(current.proposalDate, sections.proposalDate),
    clinicTypeVariant: nextClinicTypeVariant,
    clinicTypeAssetVersion: current.clinicTypeAssetVersion || sections.clinicTypeAssetVersion || PROPOSAL_CLINIC_TYPE_VARIANT_VERSION,
    heroImageUrl: mergeIfBlank(current.heroImageUrl, sections.heroImageUrl),
    heroImageAlt: mergeIfBlank(current.heroImageAlt, sections.heroImageAlt),
    sectorImages: nextSectorImages,
    value: mergeIfBlank(current.value, moneyFromCents(suggested.valueCents)),
    monthlyFee: mergeIfBlank(current.monthlyFee, moneyFromCents(suggested.monthlyFeeCents)),
    setupFee: mergeIfBlank(current.setupFee, moneyFromCents(suggested.setupFeeCents)),
    currency: current.currency || suggested.currency || "GBP",
    adSpendNote: mergeIfBlank(current.adSpendNote, suggested.adSpendNote),
    executiveSummary: mergeIfBlank(current.executiveSummary, sections.executiveSummary),
    personalIntroduction: mergeIfBlank(current.personalIntroduction, sections.personalIntroduction),
    diagnosis: mergeIfBlank(current.diagnosis, sections.diagnosis),
    introVideoUrl: mergeIfBlank(current.introVideoUrl, sections.introVideoUrl),
    introVideoTitle: mergeIfBlank(current.introVideoTitle, sections.introVideoTitle),
    introVideoThumbnailUrl: mergeIfBlank(current.introVideoThumbnailUrl, sections.introVideoThumbnailUrl),
    fallbackVideoUrl: mergeIfBlank(current.fallbackVideoUrl, sections.fallbackVideoUrl),
    primaryGoal: mergeIfBlank(current.primaryGoal, sections.primaryGoal),
    clinicTypeAndLocations: mergeIfBlank(current.clinicTypeAndLocations, sections.clinicTypeAndLocations),
    currentPosition: mergeIfBlank(current.currentPosition, sections.currentPosition),
    currentMarketingSpend: mergeIfBlank(current.currentMarketingSpend, sections.currentMarketingSpend),
    currentWebsiteCrmBookingSetup: mergeIfBlank(current.currentWebsiteCrmBookingSetup, sections.currentWebsiteCrmBookingSetup),
    problemsDiscussed: mergeIfBlank(current.problemsDiscussed, sections.problemsDiscussed),
    whyActNow: mergeIfBlank(current.whyActNow, sections.whyActNow),
    currentlyUnmeasured: mergeIfBlank(current.currentlyUnmeasured, sections.currentlyUnmeasured),
    availableCapacity: mergeIfBlank(current.availableCapacity, sections.availableCapacity),
    priorityTreatments: mergeIfBlank(current.priorityTreatments, sections.priorityTreatments),
    targetArea: mergeIfBlank(current.targetArea, sections.targetArea),
    desiredOutcome: mergeIfBlank(current.desiredOutcome, sections.desiredOutcome),
    growthScoreOverall: mergeIfBlank(current.growthScoreOverall, sections.growthScoreOverall === null || sections.growthScoreOverall === undefined ? null : String(sections.growthScoreOverall)),
    visibilityScore: mergeIfBlank(current.visibilityScore, sections.visibilityScore === null || sections.visibilityScore === undefined ? null : String(sections.visibilityScore)),
    conversionScore: mergeIfBlank(current.conversionScore, sections.conversionScore === null || sections.conversionScore === undefined ? null : String(sections.conversionScore)),
    trackingScore: mergeIfBlank(current.trackingScore, sections.trackingScore === null || sections.trackingScore === undefined ? null : String(sections.trackingScore)),
    leadHandlingScore: mergeIfBlank(current.leadHandlingScore, sections.leadHandlingScore === null || sections.leadHandlingScore === undefined ? null : String(sections.leadHandlingScore)),
    salesConversionScore: mergeIfBlank(current.salesConversionScore, sections.salesConversionScore === null || sections.salesConversionScore === undefined ? null : String(sections.salesConversionScore)),
    retentionScore: mergeIfBlank(current.retentionScore, sections.retentionScore === null || sections.retentionScore === undefined ? null : String(sections.retentionScore)),
    biggestRisk: mergeIfBlank(current.biggestRisk, sections.biggestRisk),
    biggestOpportunity: mergeIfBlank(current.biggestOpportunity, sections.biggestOpportunity),
    firstRecommendedFix: mergeIfBlank(current.firstRecommendedFix, sections.firstRecommendedFix),
    currentMonthlyEnquiries: mergeIfBlank(current.currentMonthlyEnquiries, sections.currentMonthlyEnquiries),
    currentMonthlyBookedPatients: mergeIfBlank(current.currentMonthlyBookedPatients, sections.currentMonthlyBookedPatients),
    currentBookingRate: mergeIfBlank(current.currentBookingRate, sections.currentBookingRate),
    attendanceRate: mergeIfBlank(current.attendanceRate, sections.attendanceRate),
    consultationToTreatmentConversionRate: mergeIfBlank(current.consultationToTreatmentConversionRate, sections.consultationToTreatmentConversionRate),
    targetBookings: mergeIfBlank(current.targetBookings, sections.targetBookings),
    consultationValue: mergeIfBlank(current.consultationValue, sections.consultationValue),
    averageTreatmentValue: mergeIfBlank(current.averageTreatmentValue, sections.averageTreatmentValue),
    availableCommercialCapacity: mergeIfBlank(current.availableCommercialCapacity, sections.availableCommercialCapacity),
    currentAcquisitionCost: mergeIfBlank(current.currentAcquisitionCost, sections.currentAcquisitionCost),
    recommendedAdSpend: mergeIfBlank(current.recommendedAdSpend, sections.recommendedAdSpend),
    estimatedCostPerLead: mergeIfBlank(current.estimatedCostPerLead, sections.estimatedCostPerLead),
    estimatedLeads: mergeIfBlank(current.estimatedLeads, sections.estimatedLeads),
    estimatedBookedPatients: mergeIfBlank(current.estimatedBookedPatients, sections.estimatedBookedPatients),
    breakEvenBookings: mergeIfBlank(current.breakEvenBookings, sections.breakEvenBookings),
    commercialDataSource: mergeIfBlank(current.commercialDataSource, sections.commercialDataSource),
    commercialChangeReason: mergeIfBlank(current.commercialChangeReason, sections.commercialChangeReason),
    commercialApprovalStatus: current.commercialApprovalStatus === "not_required" ? sections.commercialApprovalStatus || current.commercialApprovalStatus : current.commercialApprovalStatus,
    recommendedPlan: mergeIfBlank(current.recommendedPlan, sections.recommendedPlan),
    scopeItems: current.scopeItems.length
      ? current.scopeItems
      : cleanScopeItems(sections.scopeItems?.length ? sections.scopeItems : []),
    strategyPoints: mergeIfBlank(current.strategyPoints, (sections.strategyPoints || []).join("\n")),
    includedFeatures: mergeIfBlank(current.includedFeatures, (sections.includedFeatures || []).join("\n")),
    successMetrics: mergeIfBlank(current.successMetrics, (sections.successMetrics || []).join("\n")),
    clinicGrowerResponsibilities: mergeIfBlank(current.clinicGrowerResponsibilities, (sections.clinicGrowerResponsibilities || []).join("\n")),
    clientResponsibilities: mergeIfBlank(current.clientResponsibilities, (sections.clientResponsibilities || []).join("\n")),
    timeline: mergeIfBlank(current.timeline, sections.timeline),
    termsSummary: mergeIfBlank(current.termsSummary, sections.termsSummary),
    investmentNotes: mergeIfBlank(current.investmentNotes, sections.investmentNotes),
    nextSteps: mergeIfBlank(current.nextSteps, sections.nextSteps),
  };
}

const proposalV5PreviewMissingFieldChecks = [
  getV5Page01MissingFields,
  getV5Page02MissingFields,
  getV5Page03MissingFields,
  getV5Page04MissingFields,
  getV5Page05MissingFields,
  getV5Page06MissingFields,
  getV5Page07MissingFields,
  getV5Page08MissingFields,
  getV5Page09MissingFields,
  getV5Page10MissingFields,
  getV5Page11MissingFields,
  getV5Page12MissingFields,
  getV5Page13MissingFields,
  getV5Page14MissingFields,
  getV5Page15MissingFields,
] as const;

function getProposalV5PreviewMissingFields(snapshot: ProposalV5Snapshot) {
  return Array.from(new Set(proposalV5PreviewMissingFieldChecks.flatMap((check) => check(snapshot))));
}

function proposalV5MissingFieldLabel(field: string) {
  const exactLabels: Record<string, string> = {
    schemaVersion: "V5 snapshot data",
    "proposal.reference": "Proposal reference",
    "clinic.name": "Clinic name",
    "clinic.location": "Client: clinic location",
    "clinic.typeLabel": "Client: clinic type",
    "clinic.clinicType": "Client: clinic type",
    "clinic.proofTags": "Client: clinic proof category",
    "recipient.name": "Client: recipient name",
    "discovery.goal": "Discovery: clinic growth goal",
    "discovery.currentSystems.value": "Discovery: Website, CRM and booking setup",
    "economics.economicUnit": "Economics: economic unit",
    "economics.capacity.value": "Economics: Commercial capacity (number)",
    "economics.capacity.state": "Economics: commercial evidence status set to Known",
    "selectedPackage.name": "Investment: selected package",
    "lifecycle.expiresAt": "Investment: proposal expiry date",
    "assets.sectorImages.cover.url": "Clinic type cover image",
    "assets.sectorImages.journey.url": "Clinic journey image",
    "assets.sectorImages.proof.url": "Clinic proof image",
    "assets.founderVideoThumbnail.url": "Founder video thumbnail",
    "assets.osScreens": "ClinicGrower OS screenshot assets",
    "assets.osScreens[0].url": "ClinicGrower OS screenshot",
    "assets.postBookingScreenshot.url": "Post-booking OS screenshot",
    "assets.implementationImage.url": "Implementation image",
    "journey.stages[8]": "Full patient journey stages",
    "journey.activeConstraint.value": "Diagnosis: working constraint",
    "journey.activeConstraint.value matching journey.stages": "Diagnosis: working constraint matching the selected clinic journey",
    "journey.diagnosedLeaks.value": "Diagnosis: diagnosed leaks",
    "journey.diagnosedLeaks.value[3]": "Diagnosis: at least three diagnosed leaks",
    "journey.demandQuestion": "Diagnosis: demand question for clinic type",
    "journey.progressionQuestion": "Diagnosis: progression question for clinic type",
    "journey.postBookingContinuation": "Diagnosis: post-booking journey wording",
    "journey.clinicalBoundary": "Diagnosis: clinical-care boundary wording",
    "clinic.priorityServices.value": "Client: priority services",
    "clinic.priorityServices.value[0]": "Client: priority services",
    "clinic.priorityServices.value[2]": "Client: at least three different priority services",
    "links.videoUrl": "Intro video URL",
    "links.acceptUrl": "Acceptance link",
    "links.questionUrl": "Question/contact link",
    "acceptance.canAccept": "Saved proposal with expiry date before sending",
    "commercial.monthlyFeeCents": "Investment: monthly fee",
    "commercial.setupFeeCents": "Investment: setup fee, even if zero",
    "commercial.vatStatus": "Investment: VAT status",
    "commercial.mediaSpendRule": "Investment: ad spend rule",
    "commercial.billingFrequency": "Investment: billing frequency from selected package",
    "commercial.minimumTermMonths": "Investment: minimum term",
    "commercial.noticePeriodDays": "Investment: notice period",
    "commercial.proposedStartDate": "Investment: start date",
    "commercial.expiresAt": "Investment: proposal expiry date",
    "commercial.mediaSpend.value": "Economics: media spend amount",
    "commercial.mediaSpend.state": "Economics: commercial evidence status set to Known",
    "operatingRhythm.morning": "Morning operating rhythm",
    "operatingRhythm.weekly": "Weekly operating rhythm",
    "operatingRhythm.monthly": "Monthly operating rhythm",
    "operatingRhythm.beforeSpend": "Pre-spend operating rhythm",
    scope: "Package scope",
    "scope[].dependency": "Scope dependencies",
    "scope[].owner": "Scope owner/client responsibility",
    "scope[].exclusion": "Scope exclusions",
    "scope[].frequency": "Scope frequency",
    "narrative.partnerProposition.headline": "Diagnosis: partner proposition headline",
    "narrative.partnerProposition.lede": "Diagnosis: partner proposition wording",
    "narrative.systemsFit.headline": "Discovery: systems-fit wording",
    "narrative.systemsFit.panels": "Discovery: Website, CRM and booking setup",
    "narrative.implementation.checkpoints": "Scope: implementation checkpoints",
    "narrative.responsibilities.lede": "Scope: responsibilities wording",
  };
  if (exactLabels[field]) return exactLabels[field];
  if (/^scope\[\d+\]\.title$/.test(field)) return "Scope item title";
  if (/^scope\[\d+\]\.inclusionStatus$/.test(field)) return "Scope included/excluded status";
  if (/^scope\[\d+\]\.deliveryType$/.test(field)) return "Scope recurring/one-off type";
  if (/^scope\[\d+\]\.frequency_or_quantityLimit$/.test(field)) return "Scope frequency or quantity limit";
  if (/^scope\[\d+\]\.owner$/.test(field)) return "Scope owner/client responsibility";
  if (/^scope\[\d+\]\.dependency$/.test(field)) return "Scope dependency";
  if (/^scope\[\d+\]\.exclusion$/.test(field)) return "Scope exclusion";
  return field;
}

function formatProposalV5MissingFields(fields: string[]) {
  return Array.from(new Set(fields.map(proposalV5MissingFieldLabel)));
}

function ProposalBuilderPreviewFallback() {
  return (
    <div className="rounded-[8px] border border-[#f1d2a6] bg-[#fff9ed] p-5 text-sm text-[#6f4b00]">
      <p className="font-semibold text-[#5a3a00]">Preview needs more proposal detail</p>
      <p className="mt-2 leading-6">
        Complete the required client-facing fields in the builder, then open the preview again.
      </p>
    </div>
  );
}

export default function ProposalEditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const proposalId = searchParams.get("id") || "";
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const canWriteProposals = hasPermission("proposals:write");
  const sourceRequestRef = useRef(0);
  const saveRequestRef = useRef(0);
  const [form, setForm] = useState<ProposalForm>(() => createInitialForm(searchParams));
  const [packages, setPackages] = useState<GrowthPackageRecord[]>([]);
  const [proposalTemplates, setProposalTemplates] = useState<ProposalTemplateRecord[]>(fallbackProposalTemplates);
  const [proofAssets, setProofAssets] = useState<ProposalProofAssetRecord[]>([]);
  const [proofAssetDraft, setProofAssetDraft] = useState<ProofAssetDraft>(emptyProofAssetDraft);
  const [isCreatingProofAsset, setIsCreatingProofAsset] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(proposalId));
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isPullingSourceData, setIsPullingSourceData] = useState(false);
  const [savedProposalId, setSavedProposalId] = useState("");
  const [sourceData, setSourceData] = useState<ProposalSourceDataRecord | null>(null);
  const [showMoreEconomics, setShowMoreEconomics] = useState(false);
  const [activeBuilderStep, setActiveBuilderStep] = useState<ProposalBuilderStepId>("client");
  const [loadedIdentity, setLoadedIdentity] = useState<ProposalIdentity>(
    () => identityFromSearchParams(searchParams),
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const proposalClientVisibleLocked = Boolean(
    savedProposalId &&
    CLIENT_VISIBLE_LOCKED_PROPOSAL_STATUSES.includes(
      form.status as (typeof CLIENT_VISIBLE_LOCKED_PROPOSAL_STATUSES)[number],
    ),
  );
  const proposalIsFinal = Boolean(
    savedProposalId && isFinalProposalStatus(form.status),
  );
  const proposalIsLocked = proposalIsFinal || proposalClientVisibleLocked;
  const canEditCurrentProposal = canWriteProposals && (
    proposalId ? savedProposalId === proposalId : !savedProposalId
  ) && !proposalIsLocked;
  const routeHasMismatchedProposal = proposalId
    ? Boolean(savedProposalId && savedProposalId !== proposalId)
    : Boolean(savedProposalId);
  const routeAwaitsProposal = Boolean(proposalId && !savedProposalId && !error);
  const routeIsLoading =
    isLoading || routeHasMismatchedProposal || routeAwaitsProposal;

  const selectedPackage = useMemo(
    () => packages.find((item) => item.id === form.recommendedPackageId) || null,
    [form.recommendedPackageId, packages],
  );

  const selectedProofAssets = useMemo(
    () => form.proofAssetIds
      .map((assetId) => proofAssets.find((asset) => asset.id === assetId))
      .filter(Boolean) as ProposalProofAssetRecord[],
    [form.proofAssetIds, proofAssets],
  );
  const selectedClinicVariant = useMemo(
    () => getProposalClinicTypeVariant(form.clinicTypeVariant),
    [form.clinicTypeVariant],
  );
  const proposalClientUseMissingItems = useMemo(
    () => getProposalClientUseMissingItems(form, selectedProofAssets, selectedClinicVariant),
    [form, selectedProofAssets, selectedClinicVariant],
  );
  const proofReadinessIssues = useMemo(
    () => proposalClientUseMissingItems
      .filter((item) => item.startsWith("Proof:"))
      .map((item) => item.replace(/^Proof:\s*/, "")),
    [proposalClientUseMissingItems],
  );
  const recommendedProofAssetIds = useMemo(
    () => getRecommendedProofAssetIds(proofAssets, form, selectedClinicVariant),
    [form, proofAssets, selectedClinicVariant],
  );
  const proofRequirementChecks = useMemo(() => ([
    {
      label: "case study",
      description: `One verified case study matched to ${selectedClinicVariant.label}.`,
      complete: selectedProofAssets.some((asset) => proofIsMatchedCaseStudy(asset, form, selectedClinicVariant)),
    },
    {
      label: "testimonial or video",
      description: "One testimonial or testimonial video with permission recorded.",
      complete: selectedProofAssets.some((asset) =>
        proofIsPermissionedTestimonial(asset, selectedClinicVariant) ||
        proofIsPermissionedTestimonialVideo(asset, selectedClinicVariant),
      ),
    },
    {
      label: "product screenshot",
      description: "One real ClinicGrower OS screenshot with media.",
      complete: selectedProofAssets.some(proofIsProductScreenshot),
    },
    {
      label: "performance result",
      description: "One performance result with timeframe and delivery context.",
      complete: selectedProofAssets.some((asset) => proofIsContextualPerformanceResult(asset)),
    },
  ]), [form, selectedClinicVariant, selectedProofAssets]);
  const classifiedProofAssets = useMemo(() => proofAssets
    .map((asset) => ({
      asset,
      classification: classifyProofAsset(asset, form, selectedClinicVariant),
      recommended: recommendedProofAssetIds.includes(asset.id),
    }))
    .sort((a, b) => {
      const tierOrder: Record<ProposalProofTier, number> = { required: 0, common: 1, optional: 2 };
      return tierOrder[a.classification.tier] - tierOrder[b.classification.tier] ||
        Number(b.recommended) - Number(a.recommended) ||
        a.asset.type.localeCompare(b.asset.type) ||
        a.asset.title.localeCompare(b.asset.title);
    }), [form, proofAssets, recommendedProofAssetIds, selectedClinicVariant]);
  const hasRecordLink = Boolean(form.contactId || form.dealId || form.clientAccountProfileId);
  const linkedRecordLabel = sourceData?.contact.name ||
    sourceData?.clientAccount.name ||
    loadedIdentity.contactName ||
    loadedIdentity.clientAccountName ||
    (hasRecordLink ? "Linked CRM record" : "No lead, deal or client linked yet");
  const proposalPreview = useMemo<ProposalPublicRecord>(() => ({
    proposalName: form.proposalName.trim() || "Untitled proposal",
    templateKey: form.templateKey,
    packageName: form.packageName.trim() || selectedPackage?.name || null,
    valueCents: centsFromMoney(form.value),
    monthlyFeeCents: centsFromMoney(form.monthlyFee),
    setupFeeCents: centsFromMoney(form.setupFee),
    currency: form.currency.trim() || "GBP",
    adSpendNote: form.adSpendNote.trim() || null,
    vatStatus: form.vatStatus.trim() || null,
    minimumTermMonths: intOrNull(form.minimumTermMonths),
    noticePeriodDays: intOrNull(form.noticePeriodDays),
    startDate: form.startDate || null,
    expiresAt: fromDateTimeLocal(form.expiresAt),
    addOns: commercialItemsFromText(form.addOns),
    discounts: commercialItemsFromText(form.discounts),
    sectionContent: {
      ...sectionContentFromForm(form),
      proofAssets: selectedProofAssets,
    },
    contactName: sourceData?.contact.name || loadedIdentity.contactName,
    accountName:
      sourceData?.clientAccount.name ||
      sourceData?.contact.accountName ||
      loadedIdentity.clientAccountName ||
      loadedIdentity.accountName,
    clientAccountName:
      sourceData?.clientAccount.name || loadedIdentity.clientAccountName,
  }), [form, loadedIdentity, selectedPackage, selectedProofAssets, sourceData]);

  const proposalV5Preview = useMemo(() => {
    try {
      const snapshot = buildProposalV5Snapshot({
        proposal: proposalPreview,
        packageRecord: selectedPackage,
        generatedAt: form.proposalDate || undefined,
        sourceProposalVersion: savedProposalId
          ? `editor-preview:${savedProposalId}:${form.proposalDate || "draft"}`
          : `editor-preview:new:${form.proposalDate || "draft"}`,
        acceptanceUrl: savedProposalId
          ? `/app/crm/proposals/preview?id=${encodeURIComponent(savedProposalId)}#acceptance-form`
          : "#proposal-builder-send",
        questionUrl: "mailto:hello@clinicgrower.co.uk",
      });
      const missingPreviewFields = getProposalV5PreviewMissingFields(snapshot);
      if (missingPreviewFields.length > 0) {
        const missingItems = formatProposalV5MissingFields(missingPreviewFields);
        return {
          snapshot: null,
          error: `Complete these V5 preview fields: ${missingItems.slice(0, 8).join(", ")}${missingItems.length > 8 ? ", and more" : ""}.`,
          missingItems,
        };
      }
      return {
        snapshot,
        error: "",
        missingItems: [],
      };
    } catch (previewError) {
      return {
        snapshot: null,
        error: previewError instanceof Error ? previewError.message : "The preview is not ready yet.",
        missingItems: [],
      };
    }
  }, [form.proposalDate, proposalPreview, savedProposalId, selectedPackage]);

  const builderClinicName =
    sourceData?.clientAccount.name ||
    sourceData?.contact.accountName ||
    loadedIdentity.clientAccountName ||
    loadedIdentity.accountName ||
    "";
  const builderContactName = sourceData?.contact.name || loadedIdentity.contactName || "";
  const builderProgress = useMemo(() => getProposalBuilderStepProgress({
    clientLinked: hasRecordLink,
    clinicName: builderClinicName,
    contactName: builderContactName,
    proposalReference: form.proposalReference,
    clinicType: form.clinicTypeVariant,
    location: form.clinicTypeAndLocations || sourceData?.contact.location || "",
    selectedPackageId: form.recommendedPackageId,
    personalIntroduction: form.personalIntroduction,
    discoverySource: form.discoverySource,
    evidenceConfidenceState: form.evidenceConfidenceState,
    primaryGoal: form.primaryGoal,
    whyActNow: form.whyActNow,
    priorityServices: form.priorityTreatments,
    targetArea: form.targetArea,
    currentPosition: form.currentPosition,
    currentMarketing: form.currentMarketingSpend,
    capacity: form.availableCapacity,
    limitations: form.currentlyUnmeasured || form.knownDataLimitations,
    customerWording: form.customerWording,
    diagnosis: form.diagnosis,
    workingConstraint: form.activeConstraintId,
    activeConstraintConfidenceState: form.activeConstraintConfidenceState,
    diagnosedLeaks: form.problemsDiscussed,
    biggestRisk: form.biggestRisk,
    recommendedDirection: form.recommendedPlan || form.firstRecommendedFix,
    currentEnquiries: form.currentMonthlyEnquiries,
    bookedPatients: form.currentMonthlyBookedPatients,
    currentBookingRate: form.currentBookingRate,
    attendanceRate: form.attendanceRate,
    consultationToTreatmentConversionRate: form.consultationToTreatmentConversionRate,
    treatmentValue: form.averageTreatmentValue || form.consultationValue,
    marketingSpend: form.currentMarketingSpend,
    economicUnit: form.economicUnit,
    confirmedContribution: form.clinicConfirmedContribution,
    contributionEvidenceSourceDate: form.contributionEvidenceSourceDate,
    contributionConfirmationState: form.contributionConfirmationState,
    selectedMediaSpend: form.selectedMediaSpend,
    commercialCapacity: form.availableCommercialCapacity || form.availableCapacity,
    commercialEvidenceState: form.paybackState,
    currentAcquisitionCost: form.currentAcquisitionCost,
    commercialDataSource: form.commercialDataSource,
    liveDataStatus: form.liveDataStatus,
    knownDataLimitations: form.knownDataLimitations,
    sectorImageProvenance: form.sectorImageProvenance,
    sectorImageApprovalStatus: form.sectorImageApprovalStatus,
    adSpendRule: form.adSpendNote,
    proofAssetCount: form.proofAssetIds.length,
    scopeItemCount: form.scopeItems.length,
    scopeHasClientDescriptions: form.scopeItems.every((item) => !item.title.trim() || item.clientDescription.trim()),
    monthlyFee: form.monthlyFee,
    setupFee: form.setupFee,
    vatStatus: form.vatStatus,
    minimumTerm: form.minimumTermMonths,
    noticePeriod: form.noticePeriodDays,
    startDate: form.startDate,
    expiryDate: form.expiresAt,
    previewReady: Boolean(proposalV5Preview.snapshot),
    previewMissingItems: proposalV5Preview.missingItems,
    clientUseMissingItems: proposalClientUseMissingItems,
    savedProposalId,
  }), [
    builderClinicName,
    builderContactName,
    form.availableCommercialCapacity,
    form.availableCapacity,
    form.averageTreatmentValue,
    form.activeConstraintId,
    form.activeConstraintConfidenceState,
    form.adSpendNote,
    form.biggestRisk,
    form.clinicTypeAndLocations,
    form.clinicTypeVariant,
    form.consultationValue,
    form.consultationToTreatmentConversionRate,
    form.commercialDataSource,
    form.contributionConfirmationState,
    form.contributionEvidenceSourceDate,
    form.currentAcquisitionCost,
    form.currentBookingRate,
    form.currentMarketingSpend,
    form.currentMonthlyBookedPatients,
    form.currentMonthlyEnquiries,
    form.currentPosition,
    form.currentlyUnmeasured,
    form.customerWording,
    form.diagnosis,
    form.discoverySource,
    form.economicUnit,
    form.evidenceConfidenceState,
    form.expiresAt,
    form.firstRecommendedFix,
    form.attendanceRate,
    form.clinicConfirmedContribution,
    form.knownDataLimitations,
    form.liveDataStatus,
    form.minimumTermMonths,
    form.monthlyFee,
    form.noticePeriodDays,
    form.paybackState,
    form.personalIntroduction,
    form.primaryGoal,
    form.problemsDiscussed,
    form.priorityTreatments,
    form.proofAssetIds.length,
    form.proposalReference,
    form.recommendedPackageId,
    form.recommendedPlan,
    form.scopeItems,
    form.sectorImageApprovalStatus,
    form.sectorImageProvenance,
    form.selectedMediaSpend,
    form.setupFee,
    form.startDate,
    form.targetArea,
    form.vatStatus,
    form.whyActNow,
    hasRecordLink,
    proposalV5Preview.missingItems,
    proposalV5Preview.snapshot,
    proposalClientUseMissingItems,
    savedProposalId,
    sourceData?.contact.location,
  ]);
  const currentBuilderStep = builderProgress.find((step) => step.id === activeBuilderStep) || builderProgress[0];
  const currentBuilderStepIndex = proposalBuilderSteps.findIndex((step) => step.id === currentBuilderStep.id);
  const firstIncompleteBuilderStep = getFirstIncompleteProposalBuilderStep(builderProgress);
  const builderMissingCount = getProposalBuilderMissingCount(builderProgress);
  const builderSendBlockerCount =
    builderProgress.find((step) => step.id === "send")?.missing.filter((item) => item !== "Ready V5 proposal").length || 0;
  const builderActionMissingCount = builderMissingCount + builderSendBlockerCount;
  const builderIsReady = builderActionMissingCount === 0 && Boolean(proposalV5Preview.snapshot);
  const proposalCanBeSent = form.status === "draft" || form.status === "ready";
  const canSendFromBuilder = Boolean(token && canEditCurrentProposal && savedProposalId && builderIsReady && proposalCanBeSent && !isSaving && !isSending);
  const saveStateLabel = isSaving
    ? "Saving..."
    : isSending
      ? "Sending..."
      : proposalClientVisibleLocked
        ? "Version frozen"
        : proposalIsFinal
          ? "Locked"
          : message
            ? "Saved just now"
            : savedProposalId
              ? "Draft changes need saving"
              : "New draft";
  const primaryActionLabel = activeBuilderStep === "send"
    ? proposalClientVisibleLocked
      ? "Version frozen"
      : builderIsReady
      ? "Send proposal"
      : `Fix ${builderActionMissingCount || 1} item${builderActionMissingCount === 1 ? "" : "s"}`
    : activeBuilderStep === "review"
      ? builderIsReady
        ? "Continue to send"
        : `Fix ${builderActionMissingCount || 1} item${builderActionMissingCount === 1 ? "" : "s"}`
      : "Continue";

  const updateForm = (patch: Partial<ProposalForm>) => {
    if (!canEditCurrentProposal) return;
    setForm((current) => ({ ...current, ...patch }));
  };

  const updateCommercialForm = (patch: Partial<ProposalForm>) => {
    if (!canEditCurrentProposal) return;
    setForm((current) => ({
      ...current,
      ...patch,
      commercialApprovalStatus: "pending",
    }));
  };

  const updateClinicVariant = (variantId: string) => {
    if (!canEditCurrentProposal) return;
    setForm((current) => withRecommendedProofAssets(
      applyClinicVariantDefaults(current, variantId),
      proofAssets,
    ));
  };

  const applyProposalTemplate = (templateKey: string) => {
    if (!canEditCurrentProposal) return;
    const template = proposalTemplates.find((item) => item.templateKey === templateKey);
    if (!template) {
      updateForm({ templateKey });
      return;
    }
    setForm((current) => ({
      ...formWithTemplateDefaults(current, template),
      scopeItems: current.recommendedPackageId
        ? packageCatalogueScopeItems(packages.find((item) => item.id === current.recommendedPackageId))
        : cleanScopeItems(template.defaultScopeItems),
    }));
  };

  useEffect(() => {
    let active = true;
    sourceRequestRef.current += 1;
    saveRequestRef.current += 1;
    void Promise.resolve().then(async () => {
      if (!active) return;
      const routeSearchParams = new URLSearchParams(searchParamsKey);

      setForm(createInitialForm(routeSearchParams));
      setPackages([]);
      setProposalTemplates(fallbackProposalTemplates);
      setProofAssets([]);
      setProofAssetDraft(emptyProofAssetDraft);
      setIsCreatingProofAsset(false);
      setSavedProposalId("");
      setSourceData(null);
      setLoadedIdentity(identityFromSearchParams(routeSearchParams));
      setIsSaving(false);
      setIsSending(false);
      setIsPullingSourceData(false);
      setShowMoreEconomics(false);
      setActiveBuilderStep("client");
      setMessage("");
      setError("");

      if (!token) {
        setIsLoading(Boolean(proposalId));
        return;
      }

      setIsLoading(true);
      try {
        const [packageRecords, templateRecords, proofAssetRecords, proposalRecord] = await Promise.all([
          loadOptionalProposalPackages(
            () => api.packages.list(token, { includeInactive: true }),
          ),
          api.proposals.templates(token).catch(() => fallbackProposalTemplates),
          api.proposals.proofAssets(token).catch(() => []),
          proposalId ? api.proposals.get(token, proposalId) : Promise.resolve(null),
        ]);
        if (!active) return;
        const activeTemplates = (templateRecords.length ? templateRecords : fallbackProposalTemplates)
          .map(normaliseProposalTemplate);
        setPackages(packageRecords);
        setProposalTemplates(activeTemplates);
        setProofAssets(proofAssetRecords);
        if (proposalRecord) {
          setForm(formFromProposal(proposalRecord));
          setSavedProposalId(proposalRecord.id);
          setLoadedIdentity(proposalIdentityFromRecord(proposalRecord));
        } else {
          const initialTemplate = activeTemplates.find((item) => item.templateKey === routeSearchParams.get("templateKey")) ||
            activeTemplates.find((item) => item.templateKey === "clinicgrower_v5") ||
            activeTemplates[0];
          setForm((current) => withRecommendedProofAssets(
            formWithTemplateDefaults(current, initialTemplate),
            proofAssetRecords,
          ));
        }
      } catch (loadError: unknown) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load proposal workflow.");
      } finally {
        if (active) setIsLoading(false);
      }
    });

    return () => {
      active = false;
      sourceRequestRef.current += 1;
      saveRequestRef.current += 1;
    };
  }, [proposalId, searchParamsKey, token]);

  const applyPackage = (packageId: string) => {
    if (!canEditCurrentProposal) return;
    const packageRecord = packages.find((item) => item.id === packageId);
    const isReferenceGrowthPackage = packageRecord?.name === "Clinic Growth Engine";
    updateForm({
      recommendedPackageId: packageId,
      packageName: packageRecord?.name || "",
      value: packageRecord?.priceCents === null || packageRecord?.priceCents === undefined
        ? form.value
        : moneyFromCents(packageRecord.priceCents),
      monthlyFee: packageRecord?.billingFrequency === "monthly" && packageRecord.priceCents !== null && packageRecord.priceCents !== undefined
        ? moneyFromCents(packageRecord.priceCents)
        : form.monthlyFee,
      setupFee: packageRecord?.setupFeeCents === null || packageRecord?.setupFeeCents === undefined
        ? form.setupFee
        : moneyFromCents(packageRecord.setupFeeCents),
      currency: packageRecord?.currency || form.currency || "GBP",
      adSpendNote: form.adSpendNote || packageCommercialText(packageRecord, "mediaSpendHandling"),
      recommendedPlan: form.recommendedPlan || packageRecord?.proposalWording || "",
      includedFeatures: form.includedFeatures || (packageRecord?.includedFeatures || []).join("\n"),
      minimumTermMonths: form.minimumTermMonths || (isReferenceGrowthPackage ? "6" : form.minimumTermMonths),
      noticePeriodDays: form.noticePeriodDays || (isReferenceGrowthPackage ? "90" : form.noticePeriodDays),
      commercialChangeReason: "",
      commercialApprovalStatus: "not_required",
      scopeItems: packageCatalogueScopeItems(packageRecord),
    });
  };

  const updateScopeItem = (index: number, patch: Partial<ProposalScopeItem>) => {
    if (!canEditCurrentProposal) return;
    const approvalOnlyPatch = Object.keys(patch).every((key) => ["changeReason", "approvalStatus"].includes(key));
    setForm((current) => ({
      ...current,
      scopeItems: current.scopeItems.map((item, itemIndex) => (
        itemIndex === index ? {
          ...item,
          ...patch,
          ...(approvalOnlyPatch ? {} : { isCustom: true, approvalStatus: "pending" as const }),
        } : item
      )),
    }));
  };

  const addScopeItem = () => {
    if (!canEditCurrentProposal) return;
    setForm((current) => ({
      ...current,
      scopeItems: [
        ...current.scopeItems,
        {
          category: "Strategy",
          title: "",
          clientDescription: "",
          frequency: "",
          quantityLimit: "",
          treatmentsAndLocations: "",
          dependencies: "",
          clientResponsibilities: "",
          exclusions: "",
          thirdPartyCosts: "",
          inclusionStatus: "included",
          deliveryType: "recurring",
          isOptionalAddOn: false,
          isCustom: true,
          changeReason: "",
          approvalStatus: "pending",
          sortOrder: current.scopeItems.length ? Math.max(...current.scopeItems.map((item) => item.sortOrder || 0)) + 10 : 10,
        },
      ],
    }));
  };

  const removeScopeItem = (index: number) => {
    if (!canEditCurrentProposal) return;
    setForm((current) => ({
      ...current,
      scopeItems: current.scopeItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const toggleProofAsset = (assetId: string) => {
    if (!canEditCurrentProposal) return;
    setForm((current) => ({
      ...current,
      proofAssetIds: current.proofAssetIds.includes(assetId)
        ? current.proofAssetIds.filter((id) => id !== assetId)
        : [...current.proofAssetIds, assetId],
    }));
  };

  const createProofAsset = async () => {
    if (!token || !canEditCurrentProposal || isCreatingProofAsset) return;
    const title = proofAssetDraft.title.trim();
    const copy = proofAssetDraft.copy.trim();
    if (!title || !copy) {
      setError("Proof title and copy are required.");
      return;
    }

    setIsCreatingProofAsset(true);
    setError("");
    setMessage("");
    try {
      const created = await api.proposals.createProofAsset(token, {
        type: proofAssetDraft.type,
        title,
        copy,
        mediaUrl: proofAssetDraft.mediaUrl.trim() || null,
        sectorTags: proofAssetDraft.sectorTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        sortOrder: proofAssets.length ? Math.max(...proofAssets.map((asset) => asset.sortOrder || 0)) + 10 : 10,
      });
      setProofAssets((current) => [...current, created].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)));
      setForm((current) => ({
        ...current,
        proofAssetIds: [...current.proofAssetIds, created.id],
      }));
      setProofAssetDraft(emptyProofAssetDraft);
      setMessage("Proof asset created and selected for this proposal.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create proof asset.");
    } finally {
      setIsCreatingProofAsset(false);
    }
  };

  const pullProposalSourceData = useCallback(async () => {
    if (!token || !canEditCurrentProposal) return;
    const params = {
      contactId: form.contactId.trim() || undefined,
      dealId: form.dealId.trim() || undefined,
      clientAccountProfileId: form.clientAccountProfileId.trim() || undefined,
    };
    if (!params.contactId && !params.dealId && !params.clientAccountProfileId) {
      setError("Link a contact, deal or client account before pulling CRM data.");
      return;
    }

    setIsPullingSourceData(true);
    setError("");
    setMessage("");
    const request = {
      requestId: ++sourceRequestRef.current,
      routeKey: currentBrowserRouteKey(),
    };
    const requestIsCurrent = () => isCurrentProposalRequest(
      {
        requestId: sourceRequestRef.current,
        routeKey: currentBrowserRouteKey(),
      },
      request,
    );
    try {
      const pulled = await api.proposals.sourceData(token, params);
      if (!requestIsCurrent()) return;
      setSourceData(pulled);
      setForm((current) => withRecommendedProofAssets(
        formWithSourceData(current, pulled),
        proofAssets,
      ));
      setMessage("CRM, audit and Growth Score data pulled into empty proposal fields.");
    } catch (pullError) {
      if (!requestIsCurrent()) return;
      setError(pullError instanceof Error ? pullError.message : "Could not pull proposal source data.");
    } finally {
      if (requestIsCurrent()) setIsPullingSourceData(false);
    }
  }, [canEditCurrentProposal, form.clientAccountProfileId, form.contactId, form.dealId, proofAssets, token]);

  const buildPayload = (statusOverride?: ProposalRecord["status"]): ProposalPayload => ({
    contactId: form.contactId.trim() || null,
    dealId: form.dealId.trim() || null,
    clientAccountProfileId: form.clientAccountProfileId.trim() || null,
    proposalName: form.proposalName.trim(),
    templateKey: form.templateKey,
    recommendedPackageId: form.recommendedPackageId || null,
    packageName: form.packageName.trim() || selectedPackage?.name || null,
    status: statusOverride || form.status || "draft",
    valueCents: centsFromMoney(form.value),
    monthlyFeeCents: centsFromMoney(form.monthlyFee),
    setupFeeCents: centsFromMoney(form.setupFee),
    currency: form.currency.trim() || "GBP",
    adSpendNote: form.adSpendNote.trim() || null,
    vatStatus: form.vatStatus.trim() || null,
    minimumTermMonths: intOrNull(form.minimumTermMonths),
    noticePeriodDays: intOrNull(form.noticePeriodDays),
    startDate: form.startDate || null,
    followUpAt: fromDateTimeLocal(form.followUpAt),
    expiresAt: fromDateTimeLocal(form.expiresAt),
    proposalUrl: form.proposalUrl.trim() || null,
    notes: form.notes.trim() || null,
    addOns: commercialItemsFromText(form.addOns),
    discounts: commercialItemsFromText(form.discounts),
    internalMarginNote: form.internalMarginNote.trim() || null,
    sectionContent: sectionContentFromForm(form),
  });

  const saveProposal = async (previewAfterSave = false) => {
    if (!token || !canEditCurrentProposal || isPullingSourceData) return;
    const saveTarget = resolveProposalSaveTarget(proposalId, savedProposalId);
    if (!saveTarget) {
      setError("This proposal did not load for the current URL. Refresh before making changes.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");
    const request = {
      requestId: ++saveRequestRef.current,
      routeKey: currentBrowserRouteKey(),
    };
    const requestIsCurrent = () => isCurrentProposalRequest(
      {
        requestId: saveRequestRef.current,
        routeKey: currentBrowserRouteKey(),
      },
      request,
    );
    try {
      const payload = buildPayload(saveTarget.mode === "update" ? form.status : "draft");
      const saved = saveTarget.mode === "update"
        ? await api.proposals.update(token, saveTarget.proposalId, payload)
        : await api.proposals.create(token, payload);
      if (!requestIsCurrent()) return;
      setSavedProposalId(saved.id);
      setForm(formFromProposal(saved));
      setLoadedIdentity(proposalIdentityFromRecord(saved));
      setMessage("Draft saved.");
      if (saveTarget.mode === "create") {
        router.replace(proposalEditorHref(saved.id));
      }
      if (previewAfterSave) {
        router.push(`/app/crm/proposals/preview?id=${encodeURIComponent(saved.id)}`);
      }
    } catch (saveError) {
      if (!requestIsCurrent()) return;
      setError(saveError instanceof Error ? saveError.message : "Could not save proposal draft.");
    } finally {
      if (requestIsCurrent()) setIsSaving(false);
    }
  };

  const sendProposalFromBuilder = async () => {
    if (!token || !canEditCurrentProposal || isSaving || isSending) return;
    if (!savedProposalId) {
      setError("Save the draft before sending.");
      setActiveBuilderStep("send");
      return;
    }
    if (!builderIsReady) {
      setActiveBuilderStep(firstIncompleteBuilderStep);
      setError("Complete the readiness checklist before sending.");
      return;
    }
    if (!proposalCanBeSent) {
      setError("This proposal version has already been sent or locked. Open the preview or create a new proposal version for changes.");
      setActiveBuilderStep("send");
      return;
    }

    setIsSending(true);
    setError("");
    setMessage("");
    try {
      const sent = await api.proposals.send(token, savedProposalId, {
        recipientEmail: sourceData?.contact.email || null,
        recipientName: builderContactName || null,
        sendMethod: "manual_email",
        sendNote: "Sent from Mission Control proposal builder.",
      });
      setForm(formFromProposal(sent));
      setSavedProposalId(sent.id);
      setLoadedIdentity(proposalIdentityFromRecord(sent));
      setMessage("Proposal sent and version frozen.");
      router.push(`/app/crm/proposals/preview?id=${encodeURIComponent(sent.id)}`);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send proposal.");
    } finally {
      setIsSending(false);
    }
  };

  const goToNextBuilderStep = () => {
    const nextStep = proposalBuilderSteps[currentBuilderStepIndex + 1];
    if (nextStep) {
      setActiveBuilderStep(nextStep.id);
      return;
    }
    setActiveBuilderStep("send");
  };

  const handlePrimaryBuilderAction = () => {
    if (activeBuilderStep === "send") {
      if (builderIsReady) {
        void sendProposalFromBuilder();
        return;
      }
      setActiveBuilderStep(firstIncompleteBuilderStep);
      return;
    }
    if (activeBuilderStep === "review" && !builderIsReady) {
      setActiveBuilderStep(firstIncompleteBuilderStep);
      return;
    }
    goToNextBuilderStep();
  };

  return (
    <div className="min-h-screen bg-[#f5f6f1]">
      <PageHeader
        title={builderClinicName || form.proposalName || (proposalId ? "Edit proposal" : "Create proposal")}
        subtitle={`${statusLabel(form.status)} · ${saveStateLabel}`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/crm/pipeline"
              className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6]"
            >
              <ArrowLeft className="h-4 w-4" />
              Pipeline
            </Link>
            {savedProposalId ? (
              <Link
                href={`/app/crm/proposals/preview?id=${encodeURIComponent(savedProposalId)}`}
                className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6]"
              >
                <Eye className="h-4 w-4" />
                Preview
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setActiveBuilderStep("review")}
                disabled={routeIsLoading}
                className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Eye className="h-4 w-4" />
                Preview
              </button>
            )}
            <button
              type="button"
              disabled={isSaving || isSending || isPullingSourceData || routeIsLoading || !canEditCurrentProposal}
              onClick={() => void saveProposal(false)}
              className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
            <button
              type="button"
              disabled={routeIsLoading || isSaving || isSending || !canEditCurrentProposal || (activeBuilderStep === "send" && builderIsReady && !canSendFromBuilder)}
              onClick={handlePrimaryBuilderAction}
              className="inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#315f51] px-4 text-sm font-semibold text-white hover:bg-[#24483d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : activeBuilderStep === "send" ? <CheckCircle2 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {primaryActionLabel}
            </button>
          </div>
        }
      />

      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-5">
          {!canWriteProposals && token ? (
            <AlertBanner
              title="Read-only proposal access"
              description="You can review this proposal and its client-facing output, but your role cannot change or save proposal data."
              variant="warning"
            />
          ) : null}
          {proposalIsFinal ? (
            <AlertBanner
              title={`${statusLabel(form.status)} proposal locked`}
              description="This outcome is final, so the proposal remains available to review but cannot be changed or moved back from the editor."
              variant="info"
            />
          ) : null}
          {proposalClientVisibleLocked ? (
            <AlertBanner
              title={`${statusLabel(form.status)} proposal frozen`}
              description="This proposal version has already been sent to the client. Review the frozen preview or create a new proposal version for changes."
              variant="info"
            />
          ) : null}
          {error ? <AlertBanner title="Proposal draft issue" description={error} variant="error" /> : null}
          {message ? <AlertBanner title="Saved" description={message} variant="success" /> : null}

          {!routeIsLoading ? (
            <section data-testid="proposal-builder-shell" className="rounded-[8px] border border-[#d8e4df] bg-[#fbfdf9] p-4 shadow-sm">
              <div className="flex flex-col gap-4 border-b border-[#dfe9e4] pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6b817a]">
                    Proposal builder
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.01em] text-[#14231f]">
                    {currentBuilderStep.title}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b7069]">
                    {currentBuilderStep.description}
                  </p>
                </div>
                <div className="rounded-[8px] border border-[#d8e4df] bg-white px-4 py-3 text-sm">
                  <div className="flex items-center gap-2 font-semibold text-[#14231f]">
                    {builderIsReady || proposalClientVisibleLocked ? (
                      <CheckCircle2 className="h-4 w-4 text-[#2f7d61]" />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#fff3d6] text-[10px] font-bold text-[#8a5a00]">
                        {builderActionMissingCount}
                      </span>
                    )}
                    {proposalClientVisibleLocked
                      ? "Version frozen"
                      : builderIsReady
                        ? "Ready to send"
                        : `${builderActionMissingCount} item${builderActionMissingCount === 1 ? "" : "s"} need attention`}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#5b7069]">
                    {proposalClientVisibleLocked
                      ? "This proposal has already been sent. Use Preview to review the frozen client-facing version."
                      : builderIsReady
                      ? "The current proposal can be previewed and sent."
                      : "Use the stepper or the primary button to move to the next issue."}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-9">
                {builderProgress.map((step) => {
                  const isActive = step.id === activeBuilderStep;
                  const isComplete = step.status === "complete";
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setActiveBuilderStep(step.id)}
                      className={`rounded-[8px] border px-3 py-3 text-left transition ${
                        isActive
                          ? "border-[#315f51] bg-[#edf5f1]"
                          : "border-[#d8e4df] bg-white hover:border-[#8cb8a6]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b817a]">
                          {step.number}
                        </span>
                        {isComplete ? (
                          <CheckCircle2 className="h-4 w-4 text-[#2f7d61]" />
                        ) : (
                          <span className="rounded-full bg-[#fff8ed] px-2 py-0.5 text-[11px] font-semibold text-[#775a22]">
                            {step.missing.length}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[#14231f]">{step.label}</p>
                    </button>
                  );
                })}
              </div>

              <fieldset
                disabled={!canEditCurrentProposal}
                className="mt-5 m-0 min-w-0 border-0 p-0 disabled:opacity-90"
              >
                <div className="rounded-[8px] border border-[#d8e4df] bg-white p-5">
                  {currentBuilderStep.missing.length ? (
                    <div className="mb-5 rounded-[8px] border border-[#ead7b3] bg-[#fff8ed] p-4">
                      <p className="text-sm font-semibold text-[#5c4214]">
                        Complete this step
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                      {currentBuilderStep.missing.slice(0, 8).map((item, index) => (
                        <span key={`${item}-${index}`} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#775a22]">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {activeBuilderStep === "client" ? (
                    <div className="space-y-5" data-testid="proposal-builder-step-client">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="rounded-[8px] border border-[#d8e4df] bg-[#f8fbf9] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b817a]">
                                CRM record
                              </p>
                              <h3 className="mt-1 text-base font-semibold text-[#14231f]">{linkedRecordLabel}</h3>
                              <p className="mt-1 text-sm leading-6 text-[#5b7069]">
                                {hasRecordLink ? "Linked to CRM. Pull the latest context when the lead or deal has changed." : "Start from a contact or deal where possible, then pull CRM context."}
                              </p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${hasRecordLink ? "bg-[#e4f5ec] text-[#256148]" : "bg-[#fff8ed] text-[#775a22]"}`}>
                              {hasRecordLink ? "Linked to CRM" : "Not linked"}
                            </span>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={isPullingSourceData || !canEditCurrentProposal || !hasRecordLink}
                              onClick={() => void pullProposalSourceData()}
                              className="inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#315f51] px-3 text-sm font-semibold text-white hover:bg-[#24483d] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isPullingSourceData ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                              Pull CRM data
                            </button>
                            <Link href="/app/crm/contacts" className="inline-flex min-h-10 items-center rounded-[8px] border border-[#d8e4df] bg-white px-3 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6]">
                              Contacts
                            </Link>
                            <Link href="/app/crm/pipeline" className="inline-flex min-h-10 items-center rounded-[8px] border border-[#d8e4df] bg-white px-3 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6]">
                              Pipeline
                            </Link>
                          </div>
                        </div>
                        <div className="rounded-[8px] border border-[#d8e4df] bg-white p-4">
                          <p className="text-sm font-semibold text-[#14231f]">Client summary</p>
                          <dl className="mt-3 space-y-2 text-sm">
                            <div className="flex justify-between gap-4">
                              <dt className="text-[#6b817a]">Clinic</dt>
                              <dd className="text-right font-semibold text-[#14231f]">{builderClinicName || "Missing"}</dd>
                            </div>
                            <div className="flex justify-between gap-4">
                              <dt className="text-[#6b817a]">Contact</dt>
                              <dd className="text-right font-semibold text-[#14231f]">{builderContactName || "Missing"}</dd>
                            </div>
                            <div className="flex justify-between gap-4">
                              <dt className="text-[#6b817a]">Package</dt>
                              <dd className="text-right font-semibold text-[#14231f]">{selectedPackage?.name || form.packageName || "Missing"}</dd>
                            </div>
                          </dl>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <label className={builderLabelClassName}>
                          Proposal name
                          <input
                            value={form.proposalName}
                            onChange={(event) => updateForm({ proposalName: event.target.value })}
                            placeholder="Personalised Growth Proposal for the clinic"
                            className={builderInputClassName}
                          />
                        </label>
                        <label className={builderLabelClassName}>
                          Proposal reference
                          <input
                            value={form.proposalReference}
                            onChange={(event) => updateForm({ proposalReference: event.target.value })}
                            placeholder="CG-2026-001"
                            className={builderInputClassName}
                          />
                        </label>
                        <label className={builderLabelClassName}>
                          Proposal date
                          <input
                            type="date"
                            value={form.proposalDate}
                            onChange={(event) => updateForm({ proposalDate: event.target.value })}
                            className={builderInputClassName}
                          />
                        </label>
                        <label className={builderLabelClassName}>
                          Clinic type
                          <select
                            value={form.clinicTypeVariant}
                            onChange={(event) => updateClinicVariant(event.target.value)}
                            className={builderInputClassName}
                          >
                            {proposalClinicTypeVariants.map((variant) => (
                              <option key={variant.id} value={variant.id}>
                                {variant.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={`${builderLabelClassName} xl:col-span-2`}>
                          Clinic type and location
                          <input
                            value={form.clinicTypeAndLocations}
                            onChange={(event) => updateForm({ clinicTypeAndLocations: event.target.value })}
                            placeholder={`${selectedClinicVariant.label} in the clinic location or catchment area`}
                            className={builderInputClassName}
                          />
                        </label>
                        <label className={`${builderLabelClassName} xl:col-span-2`}>
                          Sector image provenance
                          <input
                            value={form.sectorImageProvenance}
                            onChange={(event) => updateForm({ sectorImageProvenance: event.target.value })}
                            placeholder={selectedClinicVariant.heroImageSourceUrl || "ClinicGrower approved V5 sector image pack"}
                            className={builderInputClassName}
                          />
                          <span className="mt-1 block text-xs font-normal leading-5 text-[#6b817a]">
                            Required before sending. Use the source or asset pack reference for the selected imagery.
                          </span>
                        </label>
                        <label className={builderLabelClassName}>
                          Package
                          <select
                            value={form.recommendedPackageId}
                            onChange={(event) => applyPackage(event.target.value)}
                            className={builderInputClassName}
                          >
                            <option value="">Choose a package</option>
                            {packages.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} - {formatPackagePrice(item)}
                              </option>
                            ))}
                          </select>
                          <span className="mt-1 block text-xs font-normal leading-5 text-[#6b817a]">
                            Scope and pricing are pulled from the selected package where available.
                          </span>
                        </label>
                        <label className={builderLabelClassName}>
                          Client-facing package label
                          <input
                            value={form.packageName}
                            onChange={(event) => updateForm({ packageName: event.target.value })}
                            placeholder="Clinic Growth Engine"
                            className={builderInputClassName}
                          />
                        </label>
                        <label className={builderLabelClassName}>
                          Template
                          <select
                            value={form.templateKey}
                            onChange={(event) => applyProposalTemplate(event.target.value)}
                            className={builderInputClassName}
                          >
                            {proposalTemplates.map((template) => (
                              <option key={template.id} value={template.templateKey}>
                                {template.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <details className="rounded-[8px] border border-[#d8e4df] bg-[#fbfdfc] p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-[#315f51]">
                          More CRM linking options
                        </summary>
                        <div className="mt-4 grid gap-4 md:grid-cols-3">
                          <label className={builderLabelClassName}>
                            Contact / lead ID
                            <input value={form.contactId} onChange={(event) => updateForm({ contactId: event.target.value })} className={builderInputClassName} />
                          </label>
                          <label className={builderLabelClassName}>
                            Deal ID
                            <input value={form.dealId} onChange={(event) => updateForm({ dealId: event.target.value })} className={builderInputClassName} />
                          </label>
                          <label className={builderLabelClassName}>
                            Client account profile ID
                            <input value={form.clientAccountProfileId} onChange={(event) => updateForm({ clientAccountProfileId: event.target.value })} className={builderInputClassName} />
                          </label>
                        </div>
                      </details>
                    </div>
                  ) : null}

                  {activeBuilderStep === "discovery" ? (
                    <div className="space-y-5" data-testid="proposal-builder-step-discovery">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className={builderCardClassName}>
                          <h3 className="text-base font-semibold text-[#14231f]">Current situation</h3>
                          <p className="mt-1 text-sm text-[#5b7069]">What is happening today?</p>
                          <textarea
                            rows={5}
                            value={form.currentPosition}
                            onChange={(event) => updateForm({ currentPosition: event.target.value })}
                            placeholder={"Summarise the clinic's current visibility, enquiries, booking flow and tracking position."}
                            className={builderTextareaClassName}
                          />
                          <span className="mt-1 block text-xs font-normal leading-5 text-[#6b817a]">
                            Text field. Use the clinic&apos;s actual situation.
                          </span>
                        </div>
                        <div className={builderCardClassName}>
                          <h3 className="text-base font-semibold text-[#14231f]">Goal</h3>
                          <p className="mt-1 text-sm text-[#5b7069]">What does the clinic want to achieve?</p>
                          <textarea
                            rows={5}
                            value={form.primaryGoal}
                            onChange={(event) => updateForm({ primaryGoal: event.target.value })}
                            placeholder={`Increase predictable ${selectedClinicVariant.appointmentLanguage} from the strongest local demand.`}
                            className={builderTextareaClassName}
                          />
                          <span className="mt-1 block text-xs font-normal leading-5 text-[#6b817a]">
                            Text field. Add the clinic&apos;s actual growth target.
                          </span>
                          <label className={`${builderLabelClassName} mt-4`}>
                            Priority services
                            <span className="ml-1 text-xs font-normal text-[#6b817a]">(three different, one per line)</span>
                            <textarea
                              rows={3}
                              value={form.priorityTreatments}
                              onChange={(event) => updateForm({ priorityTreatments: event.target.value })}
                              placeholder={selectedClinicVariant.treatmentExamples.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean).slice(0, 4).join("\n")}
                              className={builderTextareaClassName}
                            />
                            <span className="mt-1 block text-xs font-normal leading-5 text-[#6b817a]">
                              Text list. Repeating the same service does not count.
                            </span>
                          </label>
                        </div>
                        <div className={builderCardClassName}>
                          <h3 className="text-base font-semibold text-[#14231f]">Current marketing</h3>
                          <p className="mt-1 text-sm text-[#5b7069]">How are enquiries currently generated?</p>
                          <div className="mt-3 grid gap-3">
                            <label className={builderLabelClassName}>
                              Current marketing spend (GBP/month)
                              <input
                                value={form.currentMarketingSpend}
                                onChange={(event) => updateForm({ currentMarketingSpend: event.target.value })}
                                inputMode={builderInputModeForKey("currentMarketingSpend")}
                                placeholder="3000"
                                className={builderInputClassName}
                              />
                              <span className="mt-1 block text-xs font-normal leading-5 text-[#6b817a]">
                                Number field. Use a monthly amount where known.
                              </span>
                            </label>
                            <label className={builderLabelClassName}>
                              Website, CRM and booking setup
                              <textarea
                                rows={3}
                                value={form.currentWebsiteCrmBookingSetup}
                                onChange={(event) => updateForm({ currentWebsiteCrmBookingSetup: event.target.value })}
                                placeholder="Example: WordPress website, Calendly booking, Cliniko CRM and CallRail tracking."
                                className={builderTextareaClassName}
                              />
                              <span className="mt-1 block text-xs font-normal leading-5 text-[#6b817a]">
                                Text field. Type the real setup; placeholder text is not saved.
                              </span>
                            </label>
                          </div>
                        </div>
                        <div className={builderCardClassName}>
                          <h3 className="text-base font-semibold text-[#14231f]">Capacity</h3>
                          <p className="mt-1 text-sm text-[#5b7069]">What can the clinic realistically handle?</p>
                          <textarea
                            rows={5}
                            value={form.availableCapacity}
                            onChange={(event) => updateForm({ availableCapacity: event.target.value })}
                            placeholder="Describe available appointments, clinician capacity, bottlenecks and realistic growth room."
                            className={builderTextareaClassName}
                          />
                          <span className="mt-1 block text-xs font-normal leading-5 text-[#6b817a]">
                            Text field. Use Economics for numeric commercial capacity.
                          </span>
                        </div>
                        <div className={`${builderCardClassName} lg:col-span-2`}>
                          <h3 className="text-base font-semibold text-[#14231f]">Known limitations</h3>
                          <p className="mt-1 text-sm text-[#5b7069]">What is currently getting in the way?</p>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <textarea
                              rows={4}
                              value={form.currentlyUnmeasured}
                              onChange={(event) => updateForm({ currentlyUnmeasured: event.target.value })}
                              placeholder="What is not currently measured: response time, lead source, booking rate, treatment value, revenue by source."
                              className={builderTextareaClassName}
                            />
                            <textarea
                              rows={4}
                              value={form.knownDataLimitations}
                              onChange={(event) => updateForm({ knownDataLimitations: event.target.value })}
                              placeholder="Known data limitations: no call tracking, incomplete CRM, diary data unavailable, revenue not connected."
                              className={builderTextareaClassName}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <label className={builderLabelClassName}>
                          Discovery source
                          <input
                            value={form.discoverySource}
                            onChange={(event) => updateForm({ discoverySource: event.target.value })}
                            placeholder="Discovery call, CRM notes or outside-in review"
                            className={builderInputClassName}
                          />
                        </label>
                        <label className={builderLabelClassName}>
                          Evidence confidence
                          <select
                            value={form.evidenceConfidenceState}
                            onChange={(event) => updateForm({ evidenceConfidenceState: event.target.value as ProposalForm["evidenceConfidenceState"] })}
                            className={builderInputClassName}
                          >
                            <option value="known">Known</option>
                            <option value="working_diagnosis">Working diagnosis</option>
                            <option value="provisional">Provisional</option>
                            <option value="to_confirm">To confirm</option>
                          </select>
                        </label>
                        <label className={builderLabelClassName}>
                          Target area
                          <textarea
                            rows={3}
                            value={form.targetArea}
                            onChange={(event) => updateForm({ targetArea: event.target.value })}
                            placeholder="Local catchment area or priority locations."
                            className={builderTextareaClassName}
                          />
                        </label>
                        <label className={builderLabelClassName}>
                          Why act now
                          <textarea
                            rows={3}
                            value={form.whyActNow}
                            onChange={(event) => updateForm({ whyActNow: event.target.value })}
                            placeholder="What makes this urgent for the clinic now?"
                            className={builderTextareaClassName}
                          />
                        </label>
                        <label className={`${builderLabelClassName} xl:col-span-2`}>
                          Desired outcome/timeframe
                          <textarea
                            rows={3}
                            value={form.desiredOutcome}
                            onChange={(event) => updateForm({ desiredOutcome: event.target.value })}
                            placeholder="What should be different by day 90 or month 6?"
                            className={builderTextareaClassName}
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {activeBuilderStep === "diagnosis" ? (
                    <div className="space-y-5" data-testid="proposal-builder-step-diagnosis">
                      <div className="grid gap-4 lg:grid-cols-3">
                        <div className={builderCardClassName}>
                          <h3 className="text-base font-semibold text-[#14231f]">What we heard</h3>
                          <p className="mt-1 text-sm text-[#5b7069]">This appears in the proposal. Keep it client-facing.</p>
                          <textarea
                            rows={7}
                            value={form.customerWording}
                            onChange={(event) => updateForm({ customerWording: event.target.value })}
                            placeholder="Use the clinic owner's own words where they matter commercially."
                            className={builderTextareaClassName}
                          />
                        </div>
                        <div className={builderCardClassName}>
                          <h3 className="text-base font-semibold text-[#14231f]">Our diagnosis</h3>
                          <p className="mt-1 text-sm text-[#5b7069]">Explain where patients, bookings or revenue are being lost.</p>
                          <textarea
                            rows={7}
                            value={form.diagnosis}
                            onChange={(event) => updateForm({ diagnosis: event.target.value })}
                            placeholder="The main gap is not only traffic volume. Explain the visibility, conversion, follow-up or measurement problem."
                            className={builderTextareaClassName}
                          />
                        </div>
                        <div className={builderCardClassName}>
                          <h3 className="text-base font-semibold text-[#14231f]">Recommended direction</h3>
                          <p className="mt-1 text-sm text-[#5b7069]">Connect the diagnosis to the proposed ClinicGrower OS programme.</p>
                          <textarea
                            rows={7}
                            value={form.recommendedPlan}
                            onChange={(event) => updateForm({ recommendedPlan: event.target.value })}
                            placeholder="Set out the first priority and how ClinicGrower OS creates visibility and accountability."
                            className={builderTextareaClassName}
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                        <label className={builderLabelClassName}>
                          Working constraint
                          <select
                            value={form.activeConstraintId}
                            onChange={(event) => updateForm({ activeConstraintId: event.target.value })}
                            className={builderInputClassName}
                          >
                            <option value="">Choose the main journey constraint</option>
                            {form.activeConstraintId && !selectedClinicVariant.patientJourney.includes(form.activeConstraintId) ? (
                              <option value={form.activeConstraintId}>{form.activeConstraintId}</option>
                            ) : null}
                            {selectedClinicVariant.patientJourney.map((stage) => (
                              <option key={stage} value={stage}>
                                {stage}
                              </option>
                            ))}
                          </select>
                          <span className="mt-1 block text-xs font-normal leading-5 text-[#6b817a]">
                            Select the point in the patient journey that needs fixing first.
                          </span>
                        </label>
                        <label className={builderLabelClassName}>
                          Diagnosed leaks
                          <span className="ml-1 text-xs font-normal text-[#6b817a]">(at least three, one per line)</span>
                          <textarea
                            rows={4}
                            value={form.problemsDiscussed}
                            onChange={(event) => updateForm({ problemsDiscussed: event.target.value })}
                            placeholder={"Missed calls or slow response\nUnclear enquiry source\nNo booked-outcome tracking"}
                            className={builderTextareaClassName}
                          />
                        </label>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className={builderLabelClassName}>
                          Main leakage or risk
                          <textarea
                            rows={4}
                            value={form.biggestRisk}
                            onChange={(event) => updateForm({ biggestRisk: event.target.value })}
                            placeholder="The most important risk or leak in the current patient journey."
                            className={builderTextareaClassName}
                          />
                        </label>
                        <label className={builderLabelClassName}>
                          First recommended fix
                          <textarea
                            rows={4}
                            value={form.firstRecommendedFix}
                            onChange={(event) => updateForm({ firstRecommendedFix: event.target.value })}
                            placeholder="The first thing that should be fixed before scaling spend or activity."
                            className={builderTextareaClassName}
                          />
                        </label>
                        <label className={builderLabelClassName}>
                          Executive recommendation
                          <textarea
                            rows={4}
                            value={form.executiveSummary}
                            onChange={(event) => updateForm({ executiveSummary: event.target.value })}
                            placeholder="One clear paragraph summarising the recommendation."
                            className={builderTextareaClassName}
                          />
                        </label>
                        <label className={builderLabelClassName}>
                          Personal note
                          <textarea
                            rows={4}
                            value={form.personalIntroduction}
                            onChange={(event) => updateForm({ personalIntroduction: event.target.value })}
                            placeholder="A short, natural note that proves this proposal was built for this clinic."
                            className={builderTextareaClassName}
                          />
                        </label>
                      </div>
                      <details className="rounded-[8px] border border-[#d8e4df] bg-[#fbfdfc] p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-[#315f51]">
                          More diagnosis controls
                        </summary>
                        <div className="mt-4 grid gap-4 md:grid-cols-3">
                          <label className={builderLabelClassName}>
                            Live data status
                            <select value={form.liveDataStatus} onChange={(event) => updateForm({ liveDataStatus: event.target.value as ProposalForm["liveDataStatus"] })} className={builderInputClassName}>
                              <option value="demo_data">Illustrative OS view</option>
                              <option value="not_connected">Not connected</option>
                              <option value="partially_connected">Partially connected</option>
                              <option value="live_connected">Live connected</option>
                            </select>
                          </label>
                        </div>
                      </details>
                    </div>
                  ) : null}

                  {activeBuilderStep === "economics" ? (
                    <div className="space-y-5" data-testid="proposal-builder-step-economics">
                      <div className="rounded-[8px] border border-[#d8e4df] bg-[#f8fbf9] p-4">
                        <p className="text-sm font-semibold text-[#14231f]">Patient journey numbers</p>
                        <p className="mt-1 text-sm leading-6 text-[#5b7069]">Use the few numbers that explain the current leak. Do not enter invented ROI or unconfirmed commercial values.</p>
                        <div className="mt-4 grid gap-3 md:grid-cols-5">
                          {[
                            ["Enquiries (number)", "currentMonthlyEnquiries", "45"],
                            ["Booked (number)", "currentMonthlyBookedPatients", "18"],
                            ["Booking rate (%)", "currentBookingRate", "40%"],
                            ["Attendance (%)", "attendanceRate", "82%"],
                            ["Consult to treatment (%)", "consultationToTreatmentConversionRate", "45%"],
                          ].map(([label, key, placeholder]) => (
                            <label key={key} className={builderLabelClassName}>
                              {label}
                              <input
                                value={formTextValue(form, key as keyof ProposalForm)}
                                onChange={(event) => updateForm({ [key]: event.target.value } as Partial<ProposalForm>)}
                                inputMode={builderInputModeForKey(key)}
                                placeholder={placeholder}
                                className={builderInputClassName}
                              />
                              {builderFieldHints[key] ? (
                                <span className="mt-1 block text-xs font-normal leading-5 text-[#6b817a]">{builderFieldHints[key]}</span>
                              ) : null}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className={builderCardClassName}>
                          <h3 className="text-base font-semibold text-[#14231f]">Economic context</h3>
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {[
                              ["Average treatment value (GBP)", "averageTreatmentValue", "2700"],
                              ["Commercial capacity (number)", "availableCommercialCapacity", "6 additional consultations per month"],
                              ["Current spend (GBP/month)", "currentMarketingSpend", "3000"],
                              ["Current acquisition cost (GBP)", "currentAcquisitionCost", "95"],
                              ["Confirmed contribution (GBP)", "clinicConfirmedContribution", "1200"],
                              ["Media spend (GBP/month)", "selectedMediaSpend", "1000"],
                            ].map(([label, key, placeholder]) => (
                              <label key={key} className={builderLabelClassName}>
                                {label}
                                <input
                                  value={formTextValue(form, key as keyof ProposalForm)}
                                  onChange={(event) => updateForm({ [key]: event.target.value } as Partial<ProposalForm>)}
                                  inputMode={builderInputModeForKey(key)}
                                  placeholder={placeholder}
                                  className={builderInputClassName}
                                />
                                {builderFieldHints[key] ? (
                                  <span className="mt-1 block text-xs font-normal leading-5 text-[#6b817a]">{builderFieldHints[key]}</span>
                                ) : null}
                              </label>
                            ))}
                            <label className={builderLabelClassName}>
                              Commercial evidence status
                              <select
                                value={form.paybackState}
                                onChange={(event) => updateForm({ paybackState: event.target.value as ProposalForm["paybackState"] })}
                                className={builderInputClassName}
                              >
                                <option value="known">Known</option>
                                <option value="working_diagnosis">Working diagnosis</option>
                                <option value="provisional">Provisional</option>
                                <option value="to_confirm">To confirm</option>
                              </select>
                              <span className="mt-1 block text-xs font-normal leading-5 text-[#6b817a]">
                                Use Known only when the commercial inputs have been confirmed.
                              </span>
                            </label>
                          </div>
                        </div>
                        <div className={builderCardClassName}>
                          <h3 className="text-base font-semibold text-[#14231f]">Opportunity</h3>
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {[
                              ["Target bookings (number)", "targetBookings", "35"],
                              ["Estimated leads (number)", "estimatedLeads", "50"],
                              ["Estimated booked patients (number)", "estimatedBookedPatients", "25"],
                              ["Break-even bookings (number)", "breakEvenBookings", "2"],
                            ].map(([label, key, placeholder]) => (
                              <label key={key} className={builderLabelClassName}>
                                {label}
                                <input
                                  value={formTextValue(form, key as keyof ProposalForm)}
                                  onChange={(event) => updateForm({ [key]: event.target.value } as Partial<ProposalForm>)}
                                  inputMode={builderInputModeForKey(key)}
                                  placeholder={placeholder}
                                  className={builderInputClassName}
                                />
                                {builderFieldHints[key] ? (
                                  <span className="mt-1 block text-xs font-normal leading-5 text-[#6b817a]">{builderFieldHints[key]}</span>
                                ) : null}
                              </label>
                            ))}
                          </div>
                          <div className="mt-4 rounded-[8px] bg-[#f8fbf9] p-3 text-sm leading-6 text-[#5b7069]">
                            The proposal will only show commercial values when the supporting fields are complete enough for the readiness rules.
                          </div>
                        </div>
                      </div>
                      <div className={builderCardClassName}>
                        <h3 className="text-base font-semibold text-[#14231f]">Commercial evidence</h3>
                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <label className={builderLabelClassName}>
                            Economic unit
                            <input
                              value={form.economicUnit}
                              onChange={(event) => updateForm({ economicUnit: event.target.value })}
                              placeholder={selectedClinicVariant.economicUnit}
                              className={builderInputClassName}
                            />
                          </label>
                          <label className={builderLabelClassName}>
                            Contribution source/date
                            <input
                              value={form.contributionEvidenceSourceDate}
                              onChange={(event) => updateForm({ contributionEvidenceSourceDate: event.target.value })}
                              placeholder="Discovery call, 10 Aug 2026"
                              className={builderInputClassName}
                            />
                          </label>
                          <label className={builderLabelClassName}>
                            Contribution confirmation
                            <select
                              value={form.contributionConfirmationState}
                              onChange={(event) => updateForm({ contributionConfirmationState: event.target.value as ProposalForm["contributionConfirmationState"] })}
                              className={builderInputClassName}
                            >
                              <option value="known">Known</option>
                              <option value="working_diagnosis">Working diagnosis</option>
                              <option value="provisional">Provisional</option>
                              <option value="to_confirm">To confirm</option>
                            </select>
                          </label>
                          <label className={builderLabelClassName}>
                            Commercial data source
                            <input
                              value={form.commercialDataSource}
                              onChange={(event) => updateForm({ commercialDataSource: event.target.value })}
                              placeholder="Discovery call and current media report"
                              className={builderInputClassName}
                            />
                          </label>
                        </div>
                      </div>
                      <button type="button" onClick={() => setShowMoreEconomics((open) => !open)} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6]">
                        <Plus className="h-4 w-4" />
                        {showMoreEconomics ? "Hide score context" : "Add score context"}
                      </button>
                      {showMoreEconomics ? (
                        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
                          {[
                            ["Overall", "growthScoreOverall"],
                            ["Visibility", "visibilityScore"],
                            ["Conversion", "conversionScore"],
                            ["Tracking", "trackingScore"],
                            ["Lead handling", "leadHandlingScore"],
                            ["Sales conversion", "salesConversionScore"],
                            ["Retention", "retentionScore"],
                          ].map(([label, key]) => (
                            <label key={key} className={builderLabelClassName}>
                              {label}
                              <input type="number" min="0" max="100" value={formTextValue(form, key as keyof ProposalForm)} onChange={(event) => updateForm({ [key]: event.target.value } as Partial<ProposalForm>)} className={builderInputClassName} />
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {activeBuilderStep === "proof" ? (
                    <div className="space-y-5" data-testid="proposal-builder-step-proof">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-[#14231f]">Choose proof for this proposal</h3>
                          <p className="mt-1 text-sm leading-6 text-[#5b7069]">
                            The builder preselects matching proof where the asset already exists. Confirm the required set, then add only real proof where something is missing.
                          </p>
                        </div>
                        <span className="rounded-full bg-[#edf5f1] px-3 py-1 text-xs font-semibold text-[#315f51]">
                          {form.proofAssetIds.length} selected
                        </span>
                      </div>
                      <div className={`rounded-[8px] border p-4 text-sm leading-6 ${proofReadinessIssues.length ? "border-[#f1d2a6] bg-[#fff9ed] text-[#6f4b00]" : "border-[#cfe4dc] bg-[#f2faf6] text-[#315f51]"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className={`font-semibold ${proofReadinessIssues.length ? "text-[#5a3a00]" : "text-[#24483d]"}`}>
                            {proofReadinessIssues.length ? "Proof still needed" : "Proof requirements met"}
                          </p>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">
                            Specific to {selectedClinicVariant.label}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                          {proofRequirementChecks.map((item) => (
                            <div key={item.label} className="rounded-[8px] bg-white p-3">
                              <div className="flex items-center gap-2">
                                {item.complete ? <CheckCircle2 className="h-4 w-4 text-[#2f7d61]" /> : <span className="h-4 w-4 rounded-full border border-[#d79b3a]" />}
                                <p className="text-xs font-semibold capitalize text-[#14231f]">{item.label}</p>
                              </div>
                              <p className="mt-2 text-xs leading-5 text-[#6b817a]">{item.description}</p>
                            </div>
                          ))}
                        </div>
                        {proofReadinessIssues.length ? (
                          <ul className="mt-3 list-disc space-y-1 pl-5">
                            {proofReadinessIssues.map((issue, index) => (
                              <li key={`${issue}-${index}`}>{issue}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <div className="grid gap-3 lg:grid-cols-3">
                        {classifiedProofAssets.length ? classifiedProofAssets.map(({ asset, classification, recommended }) => {
                          const selected = form.proofAssetIds.includes(asset.id);
                          return (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={() => toggleProofAsset(asset.id)}
                              disabled={!canEditCurrentProposal}
                              aria-pressed={selected}
                              className={`rounded-[8px] border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${selected ? "border-[#315f51] bg-[#edf5f1]" : "border-[#d8e4df] bg-white hover:border-[#8cb8a6]"}`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="rounded-full bg-[#f8fbf9] px-2 py-1 text-xs font-semibold capitalize text-[#315f51]">
                                  {formatProofAssetType(asset.type)}
                                </span>
                                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${classification.tier === "required" ? "bg-[#14231f] text-white" : classification.tier === "common" ? "bg-[#dff1ef] text-[#24483d]" : "bg-[#f3f7f4] text-[#6b817a]"}`}>
                                  {proofTierLabels[classification.tier]}
                                </span>
                                {selected ? <CheckCircle2 className="h-4 w-4 text-[#2f7d61]" /> : null}
                              </div>
                              <p className="mt-3 text-sm font-semibold text-[#14231f]">{asset.title}</p>
                              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#5b7069]">{asset.copy}</p>
                              {proofHasMedia(asset) ? (
                                proofMediaLooksLikeImage(asset) ? (
                                  <span
                                    aria-label={`${asset.title} proof media`}
                                    role="img"
                                    className="mt-3 block h-28 rounded-[8px] border border-[#d8e4df] bg-[#f3f8f6] bg-cover bg-center"
                                    style={{ backgroundImage: `url("${asset.mediaUrl}")` }}
                                  />
                                ) : (
                                  <span className="mt-3 block rounded-[8px] border border-[#d8e4df] bg-[#f8fbf9] px-3 py-2 text-xs font-semibold text-[#315f51]">
                                    Linked media attached to this {formatProofAssetType(asset.type)}
                                  </span>
                                )
                              ) : (
                                <span className={`mt-3 block rounded-[8px] border px-3 py-2 text-xs font-semibold ${proofNeedsMediaForReadiness(asset) ? "border-[#f1d2a6] bg-[#fff9ed] text-[#7a4d00]" : "border-[#d8e4df] bg-[#f8fbf9] text-[#6b817a]"}`}>
                                  {proofNeedsMediaForReadiness(asset) ? "Required proof image missing" : "No image yet"}
                                </span>
                              )}
                              <p className="mt-3 text-xs font-semibold text-[#315f51]">{classification.note}</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {recommended ? (
                                  <span className="rounded-full bg-[#f2faf6] px-2 py-1 text-xs font-semibold text-[#315f51]">Preselected when suitable</span>
                                ) : null}
                                {proofHasMedia(asset) ? (
                                  <span className="rounded-full bg-[#f8fbf9] px-2 py-1 text-xs font-semibold text-[#6b817a]">Media</span>
                                ) : null}
                                {proofMatchesClinicVariant(asset, selectedClinicVariant) ? (
                                  <span className="rounded-full bg-[#f8fbf9] px-2 py-1 text-xs font-semibold text-[#6b817a]">
                                    {selectedClinicVariant.label}
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          );
                        }) : (
                          <div className="rounded-[8px] border border-dashed border-[#b8c8c2] bg-white p-5 text-sm text-[#5b7069]">
                            No proof assets exist yet. Add a real proof asset below, then select it for this proposal.
                          </div>
                        )}
                      </div>
                      <div className="grid gap-4 lg:grid-cols-3">
                        <label className={builderLabelClassName}>
                          Video title
                          <input value={form.introVideoTitle} onChange={(event) => updateForm({ introVideoTitle: event.target.value })} placeholder="A short proposal walkthrough from Max" className={builderInputClassName} />
                        </label>
                        <label className={builderLabelClassName}>
                          Video URL
                          <input value={form.introVideoUrl} onChange={(event) => updateForm({ introVideoUrl: event.target.value })} placeholder="https://vimeo.com/1008757315" className={builderInputClassName} />
                        </label>
                        <label className={builderLabelClassName}>
                          Thumbnail URL
                          <input value={form.introVideoThumbnailUrl} onChange={(event) => updateForm({ introVideoThumbnailUrl: event.target.value })} placeholder="Optional selected thumbnail" className={builderInputClassName} />
                        </label>
                      </div>
                      <details className="rounded-[8px] border border-[#d8e4df] bg-[#fbfdfc] p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-[#315f51]">Add proof asset</summary>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <label className={builderLabelClassName}>
                            Type
                            <select value={proofAssetDraft.type} onChange={(event) => setProofAssetDraft((current) => ({ ...current, type: event.target.value as ProposalProofAssetType }))} className={builderInputClassName}>
                              {proofAssetTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                            </select>
                          </label>
                          <label className={builderLabelClassName}>
                            Title
                            <input value={proofAssetDraft.title} onChange={(event) => setProofAssetDraft((current) => ({ ...current, title: event.target.value }))} className={builderInputClassName} />
                          </label>
                          <label className={`${builderLabelClassName} md:col-span-2`}>
                            Client-facing copy
                            <textarea rows={3} value={proofAssetDraft.copy} onChange={(event) => setProofAssetDraft((current) => ({ ...current, copy: event.target.value }))} placeholder={proofAssetGuidance[proofAssetDraft.type].placeholder} className={builderTextareaClassName} />
                          </label>
                          <label className={builderLabelClassName}>
                            Media URL
                            <input value={proofAssetDraft.mediaUrl} onChange={(event) => setProofAssetDraft((current) => ({ ...current, mediaUrl: event.target.value }))} className={builderInputClassName} />
                          </label>
                          <label className={builderLabelClassName}>
                            Sector tags
                            <input value={proofAssetDraft.sectorTags} onChange={(event) => setProofAssetDraft((current) => ({ ...current, sectorTags: event.target.value }))} className={builderInputClassName} />
                          </label>
                          <button type="button" onClick={() => void createProofAsset()} disabled={!canEditCurrentProposal || isCreatingProofAsset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[#315f51] px-4 text-sm font-semibold text-white hover:bg-[#24483d] disabled:cursor-not-allowed disabled:opacity-60">
                            {isCreatingProofAsset ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Create proof
                          </button>
                        </div>
                      </details>
                    </div>
                  ) : null}

                  {activeBuilderStep === "scope" ? (
                    <div className="space-y-5" data-testid="proposal-builder-step-scope">
                      <div className="rounded-[8px] border border-[#d8e4df] bg-[#f8fbf9] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b817a]">Package</p>
                        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-semibold text-[#14231f]">{selectedPackage?.name || form.packageName || "No package selected"}</h3>
                            <p className="mt-1 text-sm text-[#5b7069]">
                              Scope is loaded from the selected package. Custom edits are marked for approval.
                            </p>
                          </div>
                          <button type="button" onClick={addScopeItem} disabled={!canEditCurrentProposal} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#315f51] bg-white px-3 text-sm font-semibold text-[#315f51] hover:bg-[#f3f7f4] disabled:cursor-not-allowed disabled:opacity-60">
                            <Plus className="h-4 w-4" />
                            Add custom item
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {form.scopeItems.length ? form.scopeItems.map((item, index) => (
                          <div key={`${item.sortOrder}-${index}`} className="rounded-[8px] border border-[#d8e4df] bg-white p-4">
                            <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_auto]">
                              <label className={builderLabelClassName}>
                                Category
                                <select value={item.category} onChange={(event) => updateScopeItem(index, { category: event.target.value })} className={builderInputClassName}>
                                  {scopeCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                                </select>
                              </label>
                              <label className={builderLabelClassName}>
                                Deliverable
                                <input value={item.title} onChange={(event) => updateScopeItem(index, { title: event.target.value })} placeholder="Tracking and reporting setup" className={builderInputClassName} />
                              </label>
                              <button type="button" onClick={() => removeScopeItem(index)} disabled={!canEditCurrentProposal} aria-label={`Remove scope item ${item.title || index + 1}`} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[#e1b8b2] bg-white px-3 text-[#9d2f22] hover:bg-[#fff5f3] disabled:cursor-not-allowed disabled:opacity-60">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <label className={`mt-3 ${builderLabelClassName}`}>
                              Client-facing description
                              <textarea rows={3} value={item.clientDescription} onChange={(event) => updateScopeItem(index, { clientDescription: event.target.value })} placeholder="Explain what is included in language a clinic owner would understand." className={builderTextareaClassName} />
                            </label>
                            <details className="mt-3 rounded-[8px] border border-[#edf2ef] bg-[#fbfdfc] p-3">
                              <summary className="cursor-pointer text-sm font-semibold text-[#315f51]">Cadence, limits and responsibilities</summary>
                              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                {[
                                  ["Frequency", "frequency", "Ongoing monthly"],
                                  ["Quantity / limit", "quantityLimit", "One clinic location"],
                                  ["Treatments and locations", "treatmentsAndLocations", "Priority services and selected location"],
                                  ["Dependencies", "dependencies", "Access, approvals and tracking"],
                                ].map(([label, key, placeholder]) => (
                                  <label key={key} className={builderLabelClassName}>
                                    {label}
                                    <input value={String(item[key as keyof ProposalScopeItem] || "")} onChange={(event) => updateScopeItem(index, { [key]: event.target.value } as Partial<ProposalScopeItem>)} placeholder={placeholder} className={builderInputClassName} />
                                  </label>
                                ))}
                                <label className={`${builderLabelClassName} md:col-span-2`}>
                                  Client responsibilities
                                  <textarea rows={2} value={item.clientResponsibilities || ""} onChange={(event) => updateScopeItem(index, { clientResponsibilities: event.target.value })} className={builderTextareaClassName} />
                                </label>
                                <label className={`${builderLabelClassName} md:col-span-2`}>
                                  Exclusions
                                  <textarea rows={2} value={item.exclusions || ""} onChange={(event) => updateScopeItem(index, { exclusions: event.target.value })} className={builderTextareaClassName} />
                                </label>
                              </div>
                            </details>
                          </div>
                        )) : (
                          <div className="rounded-[8px] border border-dashed border-[#b8c8c2] bg-white p-5 text-sm text-[#5b7069]">
                            No package scope is selected yet. Choose a package in step 01 or add a custom item.
                          </div>
                        )}
                      </div>
                      <div className="grid gap-4 lg:grid-cols-3">
                        <label className={`${builderLabelClassName} lg:col-span-3`}>
                          Success measures
                          <span className="ml-1 text-xs font-normal text-[#6b817a]">(metric | target | source, one per line)</span>
                          <textarea
                            rows={4}
                            value={form.successMetrics}
                            onChange={(event) => updateForm({ successMetrics: event.target.value })}
                            placeholder={"Qualified enquiries | 60 per month | Call and form tracking\nBooked consultations | 30 per month | Booking system and CRM\nResponse time | Under 10 minutes where practical | Call and lead data"}
                            className={builderTextareaClassName}
                          />
                          <span className="mt-1 block text-xs font-normal leading-5 text-[#6b817a]">
                            These rows must be specific enough to measure after launch.
                          </span>
                        </label>
                        <label className={builderLabelClassName}>
                          ClinicGrower responsibilities
                          <textarea
                            rows={4}
                            value={form.clinicGrowerResponsibilities}
                            onChange={(event) => updateForm({ clinicGrowerResponsibilities: event.target.value })}
                            placeholder="What ClinicGrower will own during delivery."
                            className={builderTextareaClassName}
                          />
                        </label>
                        <label className={builderLabelClassName}>
                          Client responsibilities
                          <textarea
                            rows={4}
                            value={form.clientResponsibilities}
                            onChange={(event) => updateForm({ clientResponsibilities: event.target.value })}
                            placeholder="What the clinic must provide or maintain."
                            className={builderTextareaClassName}
                          />
                        </label>
                        <label className={builderLabelClassName}>
                          Operating rhythm
                          <textarea
                            rows={4}
                            value={form.timeline}
                            onChange={(event) => updateForm({ timeline: event.target.value })}
                            placeholder="How the first 90 days and regular reviews will run."
                            className={builderTextareaClassName}
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {activeBuilderStep === "investment" ? (
                    <div className="space-y-5" data-testid="proposal-builder-step-investment">
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <label className={builderLabelClassName}>
                          Monthly fee
                          <input type="number" min="0" step="0.01" value={form.monthlyFee} onChange={(event) => updateCommercialForm({ monthlyFee: event.target.value })} placeholder={selectedPackage?.billingFrequency === "monthly" && selectedPackage.priceCents !== null && selectedPackage.priceCents !== undefined ? "From package" : "1995"} className={builderInputClassName} />
                        </label>
                        <label className={builderLabelClassName}>
                          Setup fee
                          <input type="number" min="0" step="0.01" value={form.setupFee} onChange={(event) => updateCommercialForm({ setupFee: event.target.value })} placeholder={selectedPackage?.setupFeeCents !== null && selectedPackage?.setupFeeCents !== undefined ? "From package" : "0"} className={builderInputClassName} />
                        </label>
                        <label className={builderLabelClassName}>
                          VAT status
                          <select value={form.vatStatus} onChange={(event) => updateForm({ vatStatus: event.target.value })} className={builderInputClassName}>
                            <option value="">Choose VAT status</option>
                            <option value="plus_vat">Plus VAT</option>
                            <option value="vat_included">VAT included</option>
                            <option value="vat_exempt">VAT exempt</option>
                            <option value="not_vat_registered">Not VAT registered</option>
                          </select>
                        </label>
                        <label className={builderLabelClassName}>
                          Minimum term months
                          <input type="number" min="0" value={form.minimumTermMonths} onChange={(event) => updateForm({ minimumTermMonths: event.target.value })} placeholder="6" className={builderInputClassName} />
                        </label>
                        <label className={builderLabelClassName}>
                          Notice period days
                          <input type="number" min="0" value={form.noticePeriodDays} onChange={(event) => updateForm({ noticePeriodDays: event.target.value })} placeholder="90" className={builderInputClassName} />
                        </label>
                        <label className={builderLabelClassName}>
                          Start date
                          <input type="date" value={form.startDate} onChange={(event) => updateForm({ startDate: event.target.value })} className={builderInputClassName} />
                        </label>
                        <label className={builderLabelClassName}>
                          Expiry
                          <input type="datetime-local" value={form.expiresAt} onChange={(event) => updateForm({ expiresAt: event.target.value })} className={builderInputClassName} />
                        </label>
                        <label className={`${builderLabelClassName} md:col-span-2`}>
                          Ad spend rule
                          <textarea rows={3} value={form.adSpendNote} onChange={(event) => updateCommercialForm({ adSpendNote: event.target.value })} placeholder="Advertising spend is paid directly by the client and agreed separately before launch." className={builderTextareaClassName} />
                        </label>
                      </div>
                      <div className="rounded-[8px] border border-[#d8e4df] bg-[#f8fbf9] p-5">
                        <p className="text-sm font-semibold text-[#14231f]">Investment summary</p>
                        <dl className="mt-4 grid gap-3 md:grid-cols-4">
                          {[
                            ["Package", selectedPackage?.name || form.packageName || "Not selected"],
                            ["Monthly", form.monthlyFee ? `${form.currency || "GBP"} ${form.monthlyFee}` : "Missing"],
                            ["Setup", form.setupFee ? `${form.currency || "GBP"} ${form.setupFee}` : "Missing"],
                            ["Term", form.minimumTermMonths ? `${form.minimumTermMonths} months` : "Missing"],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-[8px] bg-white p-3">
                              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b817a]">{label}</dt>
                              <dd className="mt-1 text-sm font-semibold text-[#14231f]">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-3">
                        <label className={builderLabelClassName}>
                          Terms summary
                          <textarea
                            rows={4}
                            value={form.termsSummary}
                            onChange={(event) => updateForm({ termsSummary: event.target.value })}
                            placeholder="Summarise payment timing, term, notice, VAT and ad spend arrangements."
                            className={builderTextareaClassName}
                          />
                        </label>
                        <label className={builderLabelClassName}>
                          Investment rationale
                          <textarea
                            rows={4}
                            value={form.investmentNotes}
                            onChange={(event) => updateForm({ investmentNotes: event.target.value })}
                            placeholder="Explain why this is the recommended level of investment for the diagnosed problem."
                            className={builderTextareaClassName}
                          />
                        </label>
                        <label className={builderLabelClassName}>
                          Next steps
                          <textarea
                            rows={4}
                            value={form.nextSteps}
                            onChange={(event) => updateForm({ nextSteps: event.target.value })}
                            placeholder="Approve the proposal, complete acceptance and schedule onboarding."
                            className={builderTextareaClassName}
                          />
                        </label>
                      </div>
                      <details className="rounded-[8px] border border-[#d8e4df] bg-[#fbfdfc] p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-[#315f51]">Add-ons, discounts and approval notes</summary>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <label className={builderLabelClassName}>
                            Add-ons
                            <textarea rows={3} value={form.addOns} onChange={(event) => updateCommercialForm({ addOns: event.target.value })} className={builderTextareaClassName} />
                          </label>
                          <label className={builderLabelClassName}>
                            Discounts
                            <textarea rows={3} value={form.discounts} onChange={(event) => updateCommercialForm({ discounts: event.target.value })} className={builderTextareaClassName} />
                          </label>
                          <label className={builderLabelClassName}>
                            Reason for commercial change
                            <input value={form.commercialChangeReason} onChange={(event) => updateForm({ commercialChangeReason: event.target.value })} className={builderInputClassName} />
                          </label>
                          <label className={builderLabelClassName}>
                            Approval status
                            <select value={form.commercialApprovalStatus} onChange={(event) => updateForm({ commercialApprovalStatus: event.target.value as ProposalForm["commercialApprovalStatus"] })} className={builderInputClassName}>
                              <option value="not_required">Not required</option>
                              <option value="pending">Pending approval</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </label>
                        </div>
                      </details>
                    </div>
                  ) : null}

                  {activeBuilderStep === "review" ? (
                    <div className="space-y-5" data-testid="proposal-builder-step-review">
                      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {builderProgress.filter((step) => step.id !== "send").map((step) => (
                          <button key={step.id} type="button" onClick={() => setActiveBuilderStep(step.id)} className="rounded-[8px] border border-[#d8e4df] bg-[#f8fbf9] p-3 text-left hover:border-[#8cb8a6]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-[#14231f]">{step.label}</span>
                              {step.status === "complete" ? <CheckCircle2 className="h-4 w-4 text-[#2f7d61]" /> : <span className="rounded-full bg-[#fff8ed] px-2 py-0.5 text-xs font-semibold text-[#775a22]">{step.missing.length}</span>}
                            </div>
                            {step.missing.length ? <p className="mt-2 text-xs leading-5 text-[#6b817a]">{step.missing.slice(0, 2).join(", ")}</p> : <p className="mt-2 text-xs leading-5 text-[#6b817a]">Complete</p>}
                          </button>
                        ))}
                      </div>
                      <div id="proposal-live-preview" aria-labelledby="proposal-live-preview-title" className="scroll-mt-24 space-y-3">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Client-facing output</p>
                            <h2 id="proposal-live-preview-title" className="mt-1 text-lg font-semibold text-[#14231f]">Proposal preview</h2>
                          </div>
                          <p className="max-w-xl text-sm text-[#5b7069]">
                            This is the actual client-facing proposal generated from the current proposal data.
                          </p>
                        </div>
                        {proposalV5Preview.snapshot ? (
                          <div className="overflow-x-auto rounded-[8px] border border-[#d8e4df] bg-[#f5f6f1] p-4">
                            <div className="w-fit">
                              <ErrorBoundary
                                key={proposalV5Preview.snapshot.snapshotHash}
                                fallback={<ProposalBuilderPreviewFallback />}
                              >
                                <ProposalV5Renderer snapshot={proposalV5Preview.snapshot} />
                              </ErrorBoundary>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-[8px] border border-[#f1d2a6] bg-[#fff9ed] p-5 text-sm text-[#6f4b00]">
                            <p className="font-semibold text-[#5a3a00]">Preview is not ready yet</p>
                            <p className="mt-2 leading-6">{proposalV5Preview.error}</p>
                            {proposalV5Preview.missingItems.length ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {proposalV5Preview.missingItems.slice(0, 10).map((item, index) => (
                                  <span key={`${item}-${index}`} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#775a22]">
                                    {item}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {activeBuilderStep === "send" ? (
                    <div id="proposal-builder-send" className="space-y-5" data-testid="proposal-builder-step-send">
                      <div className="rounded-[8px] border border-[#d8e4df] bg-[#f8fbf9] p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b817a]">
                          {proposalClientVisibleLocked ? "Frozen version" : "Ready to send"}
                        </p>
                        <h3 className="mt-2 text-2xl font-semibold text-[#14231f]">
                          {proposalClientVisibleLocked
                            ? "This proposal version is frozen"
                            : builderIsReady
                              ? "Send this proposal"
                              : "Finish the readiness checklist first"}
                        </h3>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b7069]">
                          {proposalClientVisibleLocked
                            ? "This version has already been sent. Use the preview to review the exact client-facing proposal."
                            : "Sending freezes this proposal version. Changes after sending require a new proposal version before the client sees the updated offer."}
                        </p>
                        <dl className="mt-5 grid gap-3 md:grid-cols-4">
                          {[
                            ["Clinic", builderClinicName || "Missing"],
                            ["Contact", builderContactName || "Missing"],
                            ["Package", selectedPackage?.name || form.packageName || "Missing"],
                            ["Reference", form.proposalReference || "Missing"],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-[8px] bg-white p-3">
                              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b817a]">{label}</dt>
                              <dd className="mt-1 text-sm font-semibold text-[#14231f]">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setActiveBuilderStep("review")} className="inline-flex min-h-10 items-center rounded-[8px] border border-[#d8e4df] bg-white px-3 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6]">
                          Back to review
                        </button>
                        {savedProposalId ? (
                          <Link href={`/app/crm/proposals/preview?id=${encodeURIComponent(savedProposalId)}`} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6]">
                            <Eye className="h-4 w-4" />
                            Preview
                          </Link>
                        ) : null}
                        {!proposalClientVisibleLocked ? (
                          <button type="button" onClick={() => void sendProposalFromBuilder()} disabled={!canSendFromBuilder} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#315f51] px-4 text-sm font-semibold text-white hover:bg-[#24483d] disabled:cursor-not-allowed disabled:opacity-60">
                            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Send proposal
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </fieldset>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#dfe9e4] pt-4">
                <button
                  type="button"
                  disabled={currentBuilderStepIndex <= 0}
                  onClick={() => setActiveBuilderStep(proposalBuilderSteps[Math.max(0, currentBuilderStepIndex - 1)].id)}
                  className="inline-flex min-h-10 items-center rounded-[8px] border border-[#d8e4df] bg-white px-3 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Back
                </button>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isSaving || isSending || isPullingSourceData || !canEditCurrentProposal}
                    onClick={() => void saveProposal(false)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                  <button
                    type="button"
                    disabled={isSending || (activeBuilderStep === "send" && builderIsReady && !canSendFromBuilder)}
                    onClick={handlePrimaryBuilderAction}
                    className="inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#315f51] px-4 text-sm font-semibold text-white hover:bg-[#24483d] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                    {primaryActionLabel}
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {routeIsLoading ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-[8px] border border-[#d8e4df] bg-white">
              <Loader2 className="h-6 w-6 animate-spin text-[#315f51]" />
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
