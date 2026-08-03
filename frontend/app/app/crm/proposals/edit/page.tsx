"use client";

import { ArrowLeft, CheckCircle2, ChevronDown, Eye, FileText, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertBanner, PageHeader } from "@/components/ui";
import { ClinicGrowerProposalTemplate } from "@/components/proposals/clinicgrower-proposal-template";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { GrowthPackageRecord, ProposalCommercialItem, ProposalPayload, ProposalProofAssetRecord, ProposalProofAssetType, ProposalPublicRecord, ProposalRecord, ProposalScopeItem, ProposalSectionContent, ProposalSourceDataRecord, ProposalTemplateRecord } from "@/lib/api-types";
import {
  PROPOSAL_EDITOR_STATUSES,
  isCurrentProposalRequest,
  isFinalProposalStatus,
  loadOptionalProposalPackages,
  proposalEditorHref,
  proposalIdentityFromRecord,
  resolveProposalSaveTarget,
  type ProposalIdentity,
} from "@/lib/proposal-editor-state";

const defaultProposalIntroVideoUrl = "https://vimeo.com/1008757315?fl=pl&fe=sh";
const oldGrowthEnginePersonalIntroduction =
  "I have kept this proposal focused on the areas that matter most: visibility, conversion, tracking, lead handling and the first actions needed to create measurable progress.";
const growthEnginePersonalIntroduction =
  "Hi, thanks again for taking the time to walk me through where the clinic is now and what you want growth to look like. I have pulled this proposal together around the main opportunities we discussed: improving local visibility, tightening the enquiry journey, making tracking clearer, and giving the team a practical plan for turning more of the right enquiries into booked consultations.";

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
  { value: "team_image", label: "Team image" },
];

const fallbackGrowthEngineScopeItems: ProposalScopeItem[] = [
  {
    category: "Strategy",
    title: "Growth strategy and priorities",
    clientDescription: "A focused growth plan built around the clinic goals, service priorities, commercial capacity and highest-impact opportunities.",
    frequency: "Monthly",
    quantityLimit: "Included in programme",
    inclusionStatus: "included",
    deliveryType: "recurring",
    isOptionalAddOn: false,
    sortOrder: 10,
  },
  {
    category: "Google Ads",
    title: "Google Ads management",
    clientDescription: "Campaign structure, search intent, budget control and optimisation for the agreed priority services and locations.",
    frequency: "Ongoing",
    quantityLimit: "Subject to agreed ad spend",
    inclusionStatus: "included",
    deliveryType: "recurring",
    isOptionalAddOn: false,
    sortOrder: 20,
  },
  {
    category: "Tracking",
    title: "Lead tracking and reporting setup",
    clientDescription: "Tracking recommendations for calls, forms, campaign sources and booked enquiry visibility.",
    frequency: "Setup then ongoing review",
    quantityLimit: "Tracking depends on access and platform limits",
    inclusionStatus: "included",
    deliveryType: "recurring",
    isOptionalAddOn: false,
    sortOrder: 30,
  },
];

const fallbackBespokeScopeItems: ProposalScopeItem[] = [
  {
    category: "Strategy",
    title: "Bespoke growth strategy",
    clientDescription: "A tailored plan based on the agreed commercial objective, available capacity, current constraints and internal team setup.",
    frequency: "Agreed per scope",
    quantityLimit: "Defined in proposal",
    inclusionStatus: "included",
    deliveryType: "one_off",
    isOptionalAddOn: false,
    sortOrder: 10,
  },
  {
    category: "Website/Landing Pages",
    title: "Priority website or landing page work",
    clientDescription: "The agreed website, landing page or conversion workstream needed to support the first commercial priority.",
    frequency: "Agreed per scope",
    quantityLimit: "Pages and deliverables confirmed before acceptance",
    inclusionStatus: "included",
    deliveryType: "one_off",
    isOptionalAddOn: false,
    sortOrder: 20,
  },
];

const fallbackProposalTemplates: ProposalTemplateRecord[] = [
  {
    id: "fallback-clinic-growth-engine",
    templateKey: "clinicgrower_standard",
    name: "Clinic Growth Engine",
    description: "Default sales proposal for Growth Score, growth plan and ongoing package recommendations.",
    packageName: "Growth Engine",
    defaultSections: {
      executiveSummary: "This proposal is built around the growth gaps we can see today, the commercial opportunity available, and the practical plan to turn more existing demand into booked, trackable enquiries.",
      personalIntroduction: growthEnginePersonalIntroduction,
      diagnosis: "The main opportunity is not simply more activity. The priority is to connect the website, tracking, paid media, follow-up process and reporting into one growth system that the team can trust.",
      introVideoUrl: defaultProposalIntroVideoUrl,
      introVideoTitle: "A short message from ClinicGrower",
      recommendedPlan: "Build a joined-up ClinicGrower growth engine across website conversion, tracking, campaign structure, lead handling and performance reporting.",
    },
    defaultRoadmap: [
      "Confirm offer, goals, access and commercial assumptions",
      "Complete tracking and visibility foundations",
      "Launch agreed campaign and conversion improvements",
      "Review first performance signals and tighten lead handling",
      "Scale the strongest channels and agree the next growth priority",
    ],
    defaultTerms: "Monthly service with the agreed minimum term, notice period, start date, VAT position and ad spend note confirmed before launch.",
    defaultSuccessMetrics: [
      "Qualified enquiries",
      "Booked calls or consultations",
      "Speed to lead",
      "Tracking completeness",
      "Pipeline and revenue visibility",
    ],
    defaultScopeItems: fallbackGrowthEngineScopeItems,
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
    defaultSections: {
      executiveSummary: "This proposal is shaped around the specific commercial situation, constraints and growth priorities discussed so the scope can stay practical rather than generic.",
      personalIntroduction: "I have used the agreed context as the starting point and left the scope flexible enough to match the level of support required.",
      diagnosis: "The opportunity needs a tailored plan because the growth constraints, delivery requirements or commercial model do not fit a standard package cleanly.",
      introVideoUrl: defaultProposalIntroVideoUrl,
      introVideoTitle: "A short message from ClinicGrower",
      recommendedPlan: "Create a bespoke growth plan with agreed priorities, responsibilities, milestones and reporting.",
    },
    defaultRoadmap: [
      "Confirm bespoke scope and commercial objective",
      "Agree access, responsibilities and first milestone",
      "Deliver the first priority workstream",
      "Review early results and blockers",
      "Confirm the next phase or package recommendation",
    ],
    defaultTerms: "Bespoke terms should be confirmed against the agreed scope, payment timing, start date, minimum commitment and notice period.",
    defaultSuccessMetrics: [
      "Agreed milestone completion",
      "Enquiry or conversion visibility",
      "Priority blocker removal",
      "Client-side readiness",
      "Next-phase decision clarity",
    ],
    defaultScopeItems: fallbackBespokeScopeItems,
    sortOrder: 20,
    isActive: true,
    createdAt: "",
    updatedAt: "",
  },
];

const statusLabels: Record<(typeof PROPOSAL_EDITOR_STATUSES)[number], string> = {
  draft: "Draft",
  ready: "Ready",
  sent: "Sent",
  viewed: "Viewed",
  follow_up_due: "Follow-up due",
};

const statusOptions = PROPOSAL_EDITOR_STATUSES.map((value) => ({
  value,
  label: statusLabels[value],
}));

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
  executiveSummary: string;
  personalIntroduction: string;
  diagnosis: string;
  introVideoUrl: string;
  introVideoTitle: string;
  fallbackVideoUrl: string;
  primaryGoal: string;
  currentPosition: string;
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
  targetBookings: string;
  consultationValue: string;
  averageTreatmentValue: string;
  availableCommercialCapacity: string;
  recommendedAdSpend: string;
  estimatedCostPerLead: string;
  estimatedLeads: string;
  estimatedBookedPatients: string;
  breakEvenBookings: string;
  commercialDataSource: string;
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

function textLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function cleanScopeItems(items: ProposalScopeItem[] | null | undefined): ProposalScopeItem[] {
  return (items || [])
    .map((item, index) => ({
      category: scopeCategories.includes(item.category) ? item.category : "Strategy",
      title: item.title.trim(),
      clientDescription: item.clientDescription.trim(),
      frequency: item.frequency?.trim() || null,
      quantityLimit: item.quantityLimit?.trim() || null,
      inclusionStatus: item.inclusionStatus === "excluded" ? "excluded" as const : "included" as const,
      deliveryType: item.deliveryType === "one_off" ? "one_off" as const : "recurring" as const,
      isOptionalAddOn: Boolean(item.isOptionalAddOn),
      sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index + 1,
    }))
    .filter((item) => item.title && item.clientDescription)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
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
    executiveSummary: form.executiveSummary.trim() || null,
    personalIntroduction: form.personalIntroduction.trim() || null,
    diagnosis: form.diagnosis.trim() || null,
    introVideoUrl: form.introVideoUrl.trim() || null,
    introVideoTitle: form.introVideoTitle.trim() || null,
    fallbackVideoUrl: form.fallbackVideoUrl.trim() || null,
    primaryGoal: form.primaryGoal.trim() || null,
    currentPosition: form.currentPosition.trim() || null,
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
    targetBookings: form.targetBookings.trim() || null,
    consultationValue: form.consultationValue.trim() || null,
    averageTreatmentValue: form.averageTreatmentValue.trim() || null,
    availableCommercialCapacity: form.availableCommercialCapacity.trim() || null,
    recommendedAdSpend: form.recommendedAdSpend.trim() || null,
    estimatedCostPerLead: form.estimatedCostPerLead.trim() || null,
    estimatedLeads: form.estimatedLeads.trim() || null,
    estimatedBookedPatients: form.estimatedBookedPatients.trim() || null,
    breakEvenBookings: form.breakEvenBookings.trim() || null,
    commercialDataSource: form.commercialDataSource.trim() || null,
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
    templateKey: proposal.templateKey || "clinicgrower_standard",
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
    executiveSummary: sections.executiveSummary || "",
    personalIntroduction: sections.personalIntroduction || "",
    diagnosis: sections.diagnosis || "",
    introVideoUrl: sections.introVideoUrl || "",
    introVideoTitle: sections.introVideoTitle || "",
    fallbackVideoUrl: sections.fallbackVideoUrl || "",
    primaryGoal: sections.primaryGoal || "",
    currentPosition: sections.currentPosition || "",
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
    targetBookings: sections.targetBookings || "",
    consultationValue: sections.consultationValue || "",
    averageTreatmentValue: sections.averageTreatmentValue || "",
    availableCommercialCapacity: sections.availableCommercialCapacity || "",
    recommendedAdSpend: sections.recommendedAdSpend || "",
    estimatedCostPerLead: sections.estimatedCostPerLead || "",
    estimatedLeads: sections.estimatedLeads || "",
    estimatedBookedPatients: sections.estimatedBookedPatients || "",
    breakEvenBookings: sections.breakEvenBookings || "",
    commercialDataSource: sections.commercialDataSource || "",
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
    templateKey: searchParams.get("templateKey") || "clinicgrower_standard",
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
    executiveSummary: "",
    personalIntroduction: "",
    diagnosis: "",
    introVideoUrl: defaultProposalIntroVideoUrl,
    introVideoTitle: "A short message from ClinicGrower",
    fallbackVideoUrl: "",
    primaryGoal: "",
    currentPosition: "",
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
    targetBookings: "",
    consultationValue: "",
    averageTreatmentValue: "",
    availableCommercialCapacity: "",
    recommendedAdSpend: "",
    estimatedCostPerLead: "",
    estimatedLeads: "",
    estimatedBookedPatients: "",
    breakEvenBookings: "",
    commercialDataSource: "",
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

function mergeIfBlank(currentValue: string, suggestedValue: string | null | undefined) {
  return currentValue.trim() ? currentValue : suggestedValue || "";
}

function mergeIntroVideoUrl(currentValue: string, suggestedValue: string | null | undefined) {
  if (!suggestedValue) return currentValue;
  return !currentValue.trim() || currentValue === defaultProposalIntroVideoUrl ? suggestedValue : currentValue;
}

function normaliseProposalTemplate(template: ProposalTemplateRecord): ProposalTemplateRecord {
  const sections = template.defaultSections;
  if (!sections || sections.personalIntroduction !== oldGrowthEnginePersonalIntroduction) {
    return template;
  }

  return {
    ...template,
    defaultSections: {
      ...sections,
      personalIntroduction: growthEnginePersonalIntroduction,
    },
  };
}

function formWithTemplateDefaults(current: ProposalForm, template: ProposalTemplateRecord): ProposalForm {
  const sections = template.defaultSections || {};
  const timeline = sections.timeline || template.defaultRoadmap.join("\n");
  const successMetrics = (sections.successMetrics || template.defaultSuccessMetrics).join("\n");
  return {
    ...current,
    templateKey: template.templateKey,
    packageName: mergeIfBlank(current.packageName, template.packageName),
    executiveSummary: mergeIfBlank(current.executiveSummary, sections.executiveSummary),
    personalIntroduction: mergeIfBlank(current.personalIntroduction, sections.personalIntroduction),
    diagnosis: mergeIfBlank(current.diagnosis, sections.diagnosis),
    introVideoUrl: mergeIntroVideoUrl(current.introVideoUrl, sections.introVideoUrl),
    introVideoTitle: mergeIfBlank(current.introVideoTitle, sections.introVideoTitle),
    fallbackVideoUrl: mergeIfBlank(current.fallbackVideoUrl, sections.fallbackVideoUrl),
    primaryGoal: mergeIfBlank(current.primaryGoal, sections.primaryGoal),
    currentPosition: mergeIfBlank(current.currentPosition, sections.currentPosition),
    availableCapacity: mergeIfBlank(current.availableCapacity, sections.availableCapacity),
    priorityTreatments: mergeIfBlank(current.priorityTreatments, sections.priorityTreatments),
    targetArea: mergeIfBlank(current.targetArea, sections.targetArea),
    desiredOutcome: mergeIfBlank(current.desiredOutcome, sections.desiredOutcome),
    biggestRisk: mergeIfBlank(current.biggestRisk, sections.biggestRisk),
    biggestOpportunity: mergeIfBlank(current.biggestOpportunity, sections.biggestOpportunity),
    firstRecommendedFix: mergeIfBlank(current.firstRecommendedFix, sections.firstRecommendedFix),
    currentMonthlyEnquiries: mergeIfBlank(current.currentMonthlyEnquiries, sections.currentMonthlyEnquiries),
    currentMonthlyBookedPatients: mergeIfBlank(current.currentMonthlyBookedPatients, sections.currentMonthlyBookedPatients),
    targetBookings: mergeIfBlank(current.targetBookings, sections.targetBookings),
    consultationValue: mergeIfBlank(current.consultationValue, sections.consultationValue),
    averageTreatmentValue: mergeIfBlank(current.averageTreatmentValue, sections.averageTreatmentValue),
    availableCommercialCapacity: mergeIfBlank(current.availableCommercialCapacity, sections.availableCommercialCapacity),
    recommendedAdSpend: mergeIfBlank(current.recommendedAdSpend, sections.recommendedAdSpend),
    estimatedCostPerLead: mergeIfBlank(current.estimatedCostPerLead, sections.estimatedCostPerLead),
    estimatedLeads: mergeIfBlank(current.estimatedLeads, sections.estimatedLeads),
    estimatedBookedPatients: mergeIfBlank(current.estimatedBookedPatients, sections.estimatedBookedPatients),
    breakEvenBookings: mergeIfBlank(current.breakEvenBookings, sections.breakEvenBookings),
    commercialDataSource: mergeIfBlank(current.commercialDataSource, sections.commercialDataSource),
    recommendedPlan: mergeIfBlank(current.recommendedPlan, sections.recommendedPlan),
    scopeItems: current.scopeItems.length ? current.scopeItems : cleanScopeItems(sections.scopeItems?.length ? sections.scopeItems : template.defaultScopeItems),
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
  return {
    ...current,
    contactId: mergeIfBlank(current.contactId, sourceData.links.contactId),
    dealId: mergeIfBlank(current.dealId, sourceData.links.dealId),
    clientAccountProfileId: mergeIfBlank(current.clientAccountProfileId, sourceData.links.clientAccountProfileId),
    proposalName: mergeIfBlank(current.proposalName, suggested.proposalName),
    templateKey: current.templateKey === "clinicgrower_standard" ? suggested.templateKey || current.templateKey : current.templateKey,
    recommendedPackageId: mergeIfBlank(current.recommendedPackageId, suggested.recommendedPackageId),
    packageName: mergeIfBlank(current.packageName, suggested.packageName),
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
    fallbackVideoUrl: mergeIfBlank(current.fallbackVideoUrl, sections.fallbackVideoUrl),
    primaryGoal: mergeIfBlank(current.primaryGoal, sections.primaryGoal),
    currentPosition: mergeIfBlank(current.currentPosition, sections.currentPosition),
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
    targetBookings: mergeIfBlank(current.targetBookings, sections.targetBookings),
    consultationValue: mergeIfBlank(current.consultationValue, sections.consultationValue),
    averageTreatmentValue: mergeIfBlank(current.averageTreatmentValue, sections.averageTreatmentValue),
    availableCommercialCapacity: mergeIfBlank(current.availableCommercialCapacity, sections.availableCommercialCapacity),
    recommendedAdSpend: mergeIfBlank(current.recommendedAdSpend, sections.recommendedAdSpend),
    estimatedCostPerLead: mergeIfBlank(current.estimatedCostPerLead, sections.estimatedCostPerLead),
    estimatedLeads: mergeIfBlank(current.estimatedLeads, sections.estimatedLeads),
    estimatedBookedPatients: mergeIfBlank(current.estimatedBookedPatients, sections.estimatedBookedPatients),
    breakEvenBookings: mergeIfBlank(current.breakEvenBookings, sections.breakEvenBookings),
    commercialDataSource: mergeIfBlank(current.commercialDataSource, sections.commercialDataSource),
    recommendedPlan: mergeIfBlank(current.recommendedPlan, sections.recommendedPlan),
    scopeItems: current.scopeItems.length ? current.scopeItems : cleanScopeItems(sections.scopeItems),
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

function formatScore(value: number | null | undefined) {
  return value === null || value === undefined ? "Not scored" : `${Math.round(value)} / 100`;
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
  const [isPullingSourceData, setIsPullingSourceData] = useState(false);
  const [savedProposalId, setSavedProposalId] = useState("");
  const [sourceData, setSourceData] = useState<ProposalSourceDataRecord | null>(null);
  const [advancedLinksOpen, setAdvancedLinksOpen] = useState(false);
  const [loadedIdentity, setLoadedIdentity] = useState<ProposalIdentity>(
    () => identityFromSearchParams(searchParams),
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const proposalIsFinal = Boolean(
    savedProposalId && isFinalProposalStatus(form.status),
  );
  const canEditCurrentProposal = canWriteProposals && (
    proposalId ? savedProposalId === proposalId : !savedProposalId
  ) && !proposalIsFinal;
  const routeHasMismatchedProposal = proposalId
    ? Boolean(savedProposalId && savedProposalId !== proposalId)
    : Boolean(savedProposalId);
  const routeAwaitsProposal = Boolean(proposalId && !savedProposalId && !error);
  const routeIsLoading =
    isLoading || routeHasMismatchedProposal || routeAwaitsProposal;

  const selectedTemplate = useMemo(
    () => proposalTemplates.find((item) => item.templateKey === form.templateKey) || proposalTemplates[0],
    [form.templateKey, proposalTemplates],
  );

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
  const hasRecordLink = Boolean(form.contactId || form.dealId || form.clientAccountProfileId);
  const linkedRecordLabel = sourceData?.contact.name ||
    sourceData?.clientAccount.name ||
    loadedIdentity.contactName ||
    loadedIdentity.clientAccountName ||
    (hasRecordLink ? "Linked CRM record" : "No lead, deal or client linked yet");
  const proposalNavItems = [
    ["Story", "#proposal-story"],
    ["Diagnosis", "#proposal-diagnosis"],
    ["Numbers", "#proposal-commercial"],
    ["Scope", "#proposal-scope"],
    ["Proof", "#proposal-proof"],
    ["Final copy", "#proposal-final-copy"],
    ["Preview", "#proposal-live-preview"],
  ];

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

  const updateForm = (patch: Partial<ProposalForm>) => {
    if (!canEditCurrentProposal) return;
    setForm((current) => ({ ...current, ...patch }));
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
      scopeItems: cleanScopeItems(template.defaultScopeItems),
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
      setIsPullingSourceData(false);
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
            activeTemplates.find((item) => item.templateKey === "clinicgrower_standard") ||
            activeTemplates[0];
          setForm((current) => formWithTemplateDefaults(current, initialTemplate));
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
      recommendedPlan: form.recommendedPlan || packageRecord?.proposalWording || "",
      includedFeatures: form.includedFeatures || (packageRecord?.includedFeatures || []).join("\n"),
      scopeItems: form.scopeItems.length ? form.scopeItems : cleanScopeItems(selectedTemplate.defaultScopeItems),
    });
  };

  const updateScopeItem = (index: number, patch: Partial<ProposalScopeItem>) => {
    if (!canEditCurrentProposal) return;
    setForm((current) => ({
      ...current,
      scopeItems: current.scopeItems.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
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
          inclusionStatus: "included",
          deliveryType: "recurring",
          isOptionalAddOn: false,
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
      setForm((current) => formWithSourceData(current, pulled));
      setMessage("CRM, audit and Growth Score data pulled into empty proposal fields.");
    } catch (pullError) {
      if (!requestIsCurrent()) return;
      setError(pullError instanceof Error ? pullError.message : "Could not pull proposal source data.");
    } finally {
      if (requestIsCurrent()) setIsPullingSourceData(false);
    }
  }, [canEditCurrentProposal, form.clientAccountProfileId, form.contactId, form.dealId, token]);

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

  return (
    <div className="min-h-screen bg-[#f5f6f1]">
      <PageHeader
        title={proposalId ? "Edit Proposal" : "Create Proposal"}
        subtitle="Create and continue proposal drafts from a lead, deal or client account record."
        right={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/app/crm/pipeline"
              className="inline-flex items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6]"
            >
              <ArrowLeft className="h-4 w-4" />
              Pipeline
            </Link>
            {proposalId ? (
              <Link
                href={`/app/crm/proposals/preview?id=${encodeURIComponent(proposalId)}`}
                className="inline-flex items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6]"
              >
                <Eye className="h-4 w-4" />
                Preview & outcomes
              </Link>
            ) : null}
            <button
              type="button"
              disabled={isSaving || isPullingSourceData || routeIsLoading || !canEditCurrentProposal}
              onClick={() => void pullProposalSourceData()}
              className="inline-flex items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPullingSourceData ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Pull CRM data
            </button>
            <button
              type="button"
              disabled={isSaving || isPullingSourceData || routeIsLoading || !canEditCurrentProposal}
              onClick={() => void saveProposal(false)}
              className="inline-flex items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save draft
            </button>
            <button
              type="button"
              disabled={isSaving || isPullingSourceData || routeIsLoading || !canEditCurrentProposal}
              onClick={() => void saveProposal(true)}
              className="inline-flex items-center gap-2 rounded-[8px] bg-[#315f51] px-3 py-2 text-sm font-semibold text-white hover:bg-[#24483d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Eye className="h-4 w-4" />
              Save & preview
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
          {error ? <AlertBanner title="Proposal draft issue" description={error} variant="error" /> : null}
          {message ? <AlertBanner title="Saved" description={message} variant="success" /> : null}

          {routeIsLoading ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-[8px] border border-[#d8e4df] bg-white">
              <Loader2 className="h-6 w-6 animate-spin text-[#315f51]" />
            </div>
          ) : (
            <>
            <fieldset
              disabled={!canEditCurrentProposal}
              className="m-0 min-w-0 border-0 p-0 disabled:opacity-90"
            >
            {!proposalId ? (
              <section className="rounded-[8px] border border-[#d8e4df] bg-white p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b817a]">Create proposal</p>
                    <h2 className="mt-2 text-xl font-semibold text-[#14231f]">Start with the client story, then confirm the commercial offer.</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5b7069]">
                      Best route: open a lead or pipeline opportunity first, then create the proposal from there so the contact, Growth Score, package and activity history stay linked.
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-[#e3ece8] bg-[#f8fbf9] px-4 py-3 text-sm">
                    <p className="font-semibold text-[#14231f]">{linkedRecordLabel}</p>
                    <p className="mt-1 text-xs leading-5 text-[#5b7069]">
                      {hasRecordLink ? "This proposal can pull CRM context." : "Create from a contact or pipeline record for the cleanest workflow."}
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  {[
                    ["1", "Link the record", hasRecordLink ? "Connected" : "Start from contact or deal"],
                    ["2", "Choose template", selectedTemplate.name],
                    ["3", "Write proposal", form.personalIntroduction.trim() ? "Personal note added" : "Add a real opening note"],
                    ["4", "Save and preview", proposalId || savedProposalId ? "Ready to preview" : "Save draft first"],
                  ].map(([step, title, detail]) => (
                    <div key={step} className="rounded-[8px] border border-[#e3ece8] bg-[#fbfdfc] p-4">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#315f51] text-xs font-bold text-white">{step}</span>
                        <p className="text-sm font-semibold text-[#14231f]">{title}</p>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[#5b7069]">{detail}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            <div className="space-y-5">
              <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(320px,0.85fr)]">
                <div className="rounded-[8px] border border-[#d8e4df] bg-white p-5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[#315f51]" />
                    <h2 className="text-base font-semibold text-[#14231f]">Proposal setup</h2>
                  </div>

                  <div className="mt-5 space-y-4">
                    <label className="block text-sm font-medium text-[#354943]">
                      Proposal name
                      <input
                        value={form.proposalName}
                        onChange={(event) => updateForm({ proposalName: event.target.value })}
                        placeholder="Personalised Growth Proposal for BristolDent Harbourside"
                        className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      />
                      <span className="mt-1 block text-xs font-normal leading-5 text-[#5b7069]">
                        This is the internal proposal title. The public proposal title uses the clinic/account name.
                      </span>
                    </label>

                    <label className="block text-sm font-medium text-[#354943]">
                      Template
                      <select
                        value={form.templateKey}
                        onChange={(event) => applyProposalTemplate(event.target.value)}
                        className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      >
                        {proposalTemplates.map((template) => (
                          <option key={template.id} value={template.templateKey}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="rounded-[8px] bg-[#f3f7f4] p-3 text-xs leading-5 text-[#5b7069]">
                      {selectedTemplate.description}
                    </p>

                    <label className="block text-sm font-medium text-[#354943]">
                      Recommended package
                      <select
                        value={form.recommendedPackageId}
                        onChange={(event) => applyPackage(event.target.value)}
                        className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      >
                        <option value="">Bespoke / no package selected</option>
                        {packages.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} - {formatPackagePrice(item)}
                          </option>
                        ))}
                      </select>
                      <span className="mt-1 block text-xs font-normal leading-5 text-[#5b7069]">
                        Selecting a package fills pricing and default proposal wording where available.
                      </span>
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-[#354943]">
                        Client-facing package label
                        <input
                          value={form.packageName}
                          onChange={(event) => updateForm({ packageName: event.target.value })}
                          placeholder="Growth Engine"
                          className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#354943]">
                        Total proposal value
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.value}
                          onChange={(event) => updateForm({ value: event.target.value })}
                          placeholder="1995"
                          className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                    </div>

                    <details className="rounded-[8px] border border-[#e3ece8] bg-[#fbfdfc] p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-[#315f51]">
                        Internal status and dates
                      </summary>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-[#354943]">
                          Status
                          <select
                            value={form.status}
                            onChange={(event) => updateForm({ status: event.target.value as ProposalRecord["status"] })}
                            className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                          >
                            {isFinalProposalStatus(form.status) ? (
                              <option value={form.status}>
                                {statusLabel(form.status)} (locked)
                              </option>
                            ) : null}
                            {statusOptions.map((status) => (
                              <option key={status.value} value={status.value}>
                                {status.label}
                              </option>
                            ))}
                          </select>
                          <span className="mt-1 block text-xs font-normal leading-5 text-[#5b7069]">
                            Record Accepted, Won or Lost from Preview & outcomes so the required evidence is saved.
                          </span>
                        </label>
                        <label className="block text-sm font-medium text-[#354943]">
                          Currency
                          <input
                            value={form.currency}
                            onChange={(event) => updateForm({ currency: event.target.value.toUpperCase().slice(0, 3) })}
                            placeholder="GBP"
                            className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                          />
                        </label>
                        <label className="block text-sm font-medium text-[#354943]">
                          Follow-up
                          <input
                            type="datetime-local"
                            value={form.followUpAt}
                            onChange={(event) => updateForm({ followUpAt: event.target.value })}
                            className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                          />
                        </label>
                        <label className="block text-sm font-medium text-[#354943]">
                          Expires
                          <input
                            type="datetime-local"
                            value={form.expiresAt}
                            onChange={(event) => updateForm({ expiresAt: event.target.value })}
                            className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                          />
                        </label>
                      </div>
                    </details>
                  </div>
                </div>

                <div className="rounded-[8px] border border-[#d8e4df] bg-white p-5">
                  <h2 className="text-base font-semibold text-[#14231f]">Commercial terms</h2>
                  <p className="mt-1 text-sm text-[#5b7069]">Structured pricing fields for reporting and finance review.</p>
                  <div className="mt-5 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-[#354943]">
                        Monthly fee
                        <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.monthlyFee}
                        onChange={(event) => updateForm({ monthlyFee: event.target.value })}
                        placeholder="1995"
                        className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      />
                      </label>
                      <label className="block text-sm font-medium text-[#354943]">
                        Setup fee
                        <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.setupFee}
                        onChange={(event) => updateForm({ setupFee: event.target.value })}
                        placeholder="500"
                        className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      />
                      </label>
                    </div>

                    <label className="block text-sm font-medium text-[#354943]">
                      Ad spend note
                      <textarea
                        rows={2}
                        value={form.adSpendNote}
                        onChange={(event) => updateForm({ adSpendNote: event.target.value })}
                        placeholder="Advertising spend is paid directly by the client and agreed separately before launch. Recommended starting range: £2,000 to £4,000 per month."
                        className="mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-[#354943]">
                        VAT status
                        <select
                          value={form.vatStatus}
                          onChange={(event) => updateForm({ vatStatus: event.target.value })}
                          className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        >
                          <option value="">Not set</option>
                          <option value="plus_vat">Plus VAT</option>
                          <option value="vat_included">VAT included</option>
                          <option value="vat_exempt">VAT exempt</option>
                          <option value="not_vat_registered">Not VAT registered</option>
                        </select>
                      </label>
                      <label className="block text-sm font-medium text-[#354943]">
                        Start date
                        <input
                          type="date"
                          value={form.startDate}
                          onChange={(event) => updateForm({ startDate: event.target.value })}
                          className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-[#354943]">
                        Minimum term months
                        <input
                        type="number"
                        min="0"
                        value={form.minimumTermMonths}
                        onChange={(event) => updateForm({ minimumTermMonths: event.target.value })}
                        placeholder="6"
                        className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      />
                      </label>
                      <label className="block text-sm font-medium text-[#354943]">
                        Notice period days
                        <input
                        type="number"
                        min="0"
                        value={form.noticePeriodDays}
                        onChange={(event) => updateForm({ noticePeriodDays: event.target.value })}
                        placeholder="30"
                        className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      />
                      </label>
                    </div>

                    <details className="rounded-[8px] border border-[#e3ece8] bg-[#fbfdfc] p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-[#315f51]">
                        Add-ons, discounts and internal margin notes
                      </summary>
                      <div className="mt-4 space-y-4">
                        <label className="block text-sm font-medium text-[#354943]">
                          Add-ons
                          <textarea
                            rows={3}
                            value={form.addOns}
                            onChange={(event) => updateForm({ addOns: event.target.value })}
                            placeholder="One per line, e.g. Landing page | 750 | Optional launch asset"
                            className="mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                          />
                        </label>

                        <label className="block text-sm font-medium text-[#354943]">
                          Discounts
                          <textarea
                            rows={3}
                            value={form.discounts}
                            onChange={(event) => updateForm({ discounts: event.target.value })}
                            placeholder="One per line, e.g. Founder discount | 500 | First 3 months"
                            className="mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                          />
                        </label>

                        <label className="block text-sm font-medium text-[#354943]">
                          Internal margin note
                          <textarea
                            rows={3}
                            value={form.internalMarginNote}
                            onChange={(event) => updateForm({ internalMarginNote: event.target.value })}
                            placeholder="Internal only: delivery capacity, pricing sensitivity, discount reason or margin risk. This will never appear in the client-facing proposal."
                            className="mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-[#fff8ed] px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                          />
                        </label>
                      </div>
                    </details>
                  </div>
                </div>

                <div id="proposal-records" className="scroll-mt-24 rounded-[8px] border border-[#d8e4df] bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold text-[#14231f]">CRM link and source data</h2>
                      <p className="mt-1 text-sm leading-6 text-[#5b7069]">
                        Create proposals from a contact, pipeline opportunity or client account wherever possible. Manual IDs are only for fixing or recovering a draft.
                      </p>
                    </div>
                    {hasRecordLink ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#e4f5ec] px-2.5 py-1 text-xs font-semibold text-[#256148]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Linked
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#fff8ed] px-2.5 py-1 text-xs font-semibold text-[#775a22]">
                        Not linked
                      </span>
                    )}
                  </div>

                  <div className="mt-4 rounded-[8px] border border-[#e3ece8] bg-[#f8fbf9] p-4">
                    <p className="text-sm font-semibold text-[#14231f]">{linkedRecordLabel}</p>
                    <p className="mt-1 text-xs leading-5 text-[#5b7069]">
                      {hasRecordLink
                        ? "Use the pull button to refresh contact, Growth Score and package context."
                        : "Open a lead/contact or pipeline opportunity and choose create proposal from there for the cleanest setup."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href="/app/crm/contacts" className="inline-flex items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6]">
                        Contacts
                      </Link>
                      <Link href="/app/crm/pipeline" className="inline-flex items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6]">
                        Pipeline
                      </Link>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isPullingSourceData || !canEditCurrentProposal || !hasRecordLink}
                    onClick={() => void pullProposalSourceData()}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-[#315f51] px-3 py-2 text-sm font-semibold text-white hover:bg-[#24483d] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPullingSourceData ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Pull CRM, audit and Growth Score data
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdvancedLinksOpen((open) => !open)}
                    className="mt-4 inline-flex w-full items-center justify-between rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6]"
                    aria-expanded={advancedLinksOpen}
                  >
                    Advanced manual link fields
                    <ChevronDown className={`h-4 w-4 transition ${advancedLinksOpen ? "rotate-180" : ""}`} />
                  </button>

                  {advancedLinksOpen ? (
                    <div className="mt-4 space-y-4 rounded-[8px] border border-[#e3ece8] bg-[#fbfdfc] p-4">
                      <label className="block text-sm font-medium text-[#354943]">
                        Contact / lead ID
                        <input
                          value={form.contactId}
                          onChange={(event) => updateForm({ contactId: event.target.value })}
                          placeholder="Paste contact ID only if the proposal was not opened from the contact record"
                          className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#354943]">
                        Deal ID
                        <input
                          value={form.dealId}
                          onChange={(event) => updateForm({ dealId: event.target.value })}
                          placeholder="Paste pipeline deal ID when recovering a draft"
                          className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#354943]">
                        Client account profile ID
                        <input
                          value={form.clientAccountProfileId}
                          onChange={(event) => updateForm({ clientAccountProfileId: event.target.value })}
                          placeholder="Paste client profile ID only for accepted/client proposals"
                          className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                    </div>
                  ) : null}
                </div>

                {sourceData ? (
                  <div className="rounded-[8px] border border-[#d8e4df] bg-white p-5">
                    <h2 className="text-base font-semibold text-[#14231f]">Pulled source data</h2>
                    <div className="mt-4 space-y-3 text-sm text-[#354943]">
                      <div className="flex justify-between gap-4 border-b border-[#edf2ef] pb-2">
                        <span className="text-[#6b817a]">Contact</span>
                        <span className="text-right font-semibold">{sourceData.contact.name || "Not linked"}</span>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-[#edf2ef] pb-2">
                        <span className="text-[#6b817a]">Account</span>
                        <span className="text-right font-semibold">{sourceData.clientAccount.name || sourceData.contact.accountName || "Not linked"}</span>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-[#edf2ef] pb-2">
                        <span className="text-[#6b817a]">Growth Score</span>
                        <span className="text-right font-semibold">{formatScore(sourceData.growthScore.overall)}</span>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-[#edf2ef] pb-2">
                        <span className="text-[#6b817a]">Recommended package</span>
                        <span className="text-right font-semibold">{sourceData.recommendedPackage.name || sourceData.suggested.packageName || "Not set"}</span>
                      </div>
                      <div>
                        <p className="text-[#6b817a]">Score gaps</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {sourceData.growthScore.gaps.length ? sourceData.growthScore.gaps.map((gap) => (
                            <span key={gap.key} className="rounded-full bg-[#fff8ed] px-2 py-1 text-xs font-semibold text-[#775a22]">
                              {gap.label}: {formatScore(gap.score)}
                            </span>
                          )) : (
                            <span className="text-sm text-[#6b817a]">No scored gaps found.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="rounded-[8px] border border-[#d8e4df] bg-white p-5">
                <h2 className="text-base font-semibold text-[#14231f]">Editable proposal sections</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {proposalNavItems.map(([label, href]) => (
                    <a
                      key={href}
                      href={href}
                      className="rounded-full border border-[#d8e4df] bg-[#f8fbf9] px-3 py-1.5 text-xs font-semibold text-[#315f51] hover:border-[#8cb8a6] hover:bg-white"
                    >
                      {label}
                    </a>
                  ))}
                </div>
                <div className="mt-5 space-y-5">
                  <div id="proposal-story" className="scroll-mt-24 rounded-[8px] border border-[#edf2ef] bg-[#f8fbf9] p-4">
                    <h3 className="text-sm font-semibold text-[#14231f]">Personal note and clinic summary</h3>
                    <div className="mt-4 space-y-3">
                      <label className="block text-sm font-medium text-[#354943]">
                        Personal introduction
                        <textarea
                          rows={4}
                          value={form.personalIntroduction}
                          onChange={(event) => updateForm({ personalIntroduction: event.target.value })}
                          placeholder="Hi Alex, thanks for speaking with me about the clinic's growth goals. I have pulled this together around the main opportunities we discussed: stronger local visibility, clearer tracking, faster lead follow-up and a plan that can turn more enquiries into booked consultations."
                          className="mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {[
                          ["Primary goal", "primaryGoal", "Increase predictable enquiries and booked consultations from the existing local market."],
                          ["Current position", "currentPosition", "There is demand available, but visibility, conversion, follow-up and measurement need to work together more consistently."],
                          ["Available capacity", "availableCapacity", "The clinic has capacity for additional consultations once lead quality and response speed are under control."],
                          ["Priority treatments", "priorityTreatments", "Dental implants, Invisalign and higher-value private treatment enquiries."],
                          ["Target area", "targetArea", "A 15 to 20 mile radius around the clinic, prioritising the strongest local search locations."],
                          ["Desired outcome/timeframe", "desiredOutcome", "A clearer growth system within the first 90 days, then scalable monthly improvement from better data."],
                        ].map(([label, key, placeholder]) => (
                          <label key={key} className="block text-sm font-medium text-[#354943]">
                            {label}
                            <input
                              value={formTextValue(form, key as keyof ProposalForm)}
                              onChange={(event) => updateForm({ [key]: event.target.value } as Partial<ProposalForm>)}
                              placeholder={placeholder}
                              className="mt-1 min-h-11 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[8px] border border-[#edf2ef] bg-[#f8fbf9] p-4">
                    <h3 className="text-sm font-semibold text-[#14231f]">Proposal video</h3>
                    <p className="mt-1 text-sm leading-6 text-[#5b7069]">
                      Add the confirmed Vimeo or website video used in the sales proposal.
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                      <label className="block text-sm font-medium text-[#354943]">
                        Video title
                        <input
                          value={form.introVideoTitle}
                          onChange={(event) => updateForm({ introVideoTitle: event.target.value })}
                          placeholder="A short proposal walkthrough from Max"
                          className="mt-1 min-h-11 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#354943]">
                        Video URL
                        <input
                          value={form.introVideoUrl}
                          onChange={(event) => updateForm({ introVideoUrl: event.target.value })}
                          placeholder="https://vimeo.com/1008757315"
                          className="mt-1 min-h-11 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                    </div>
                    <label className="mt-3 block text-sm font-medium text-[#354943]">
                      Backup video link
                      <input
                        value={form.fallbackVideoUrl}
                        onChange={(event) => updateForm({ fallbackVideoUrl: event.target.value })}
                        placeholder="https://clinicgrower.co.uk/proposal-video-backup"
                        className="mt-1 min-h-11 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      />
                    </label>
                  </div>

                  <div id="proposal-diagnosis" className="scroll-mt-24 rounded-[8px] border border-[#edf2ef] bg-[#f8fbf9] p-4">
                    <h3 className="text-sm font-semibold text-[#14231f]">Growth diagnosis</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-7">
                      {[
                        ["Overall score", "growthScoreOverall"],
                        ["Visibility", "visibilityScore"],
                        ["Conversion", "conversionScore"],
                        ["Tracking", "trackingScore"],
                        ["Lead handling", "leadHandlingScore"],
                        ["Sales conversion", "salesConversionScore"],
                        ["Retention", "retentionScore"],
                      ].map(([label, key]) => (
                        <label key={key} className="block text-sm font-medium text-[#354943]">
                          {label}
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={formTextValue(form, key as keyof ProposalForm)}
                            onChange={(event) => updateForm({ [key]: event.target.value } as Partial<ProposalForm>)}
                            className="mt-1 min-h-11 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                          />
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      {[
                        ["Biggest current risk", "biggestRisk", "The clinic is generating interest, but incomplete tracking and inconsistent follow-up make it hard to see which enquiries are turning into booked patients."],
                        ["Biggest opportunity", "biggestOpportunity", "There is room to capture more high-intent local demand and convert it more reliably before increasing media spend."],
                        ["First recommended fix", "firstRecommendedFix", "Fix tracking, lead source visibility and response handling before scaling campaigns."],
                      ].map(([label, key, placeholder]) => (
                        <label key={key} className="block text-sm font-medium text-[#354943]">
                          {label}
                          <textarea
                            rows={3}
                            value={formTextValue(form, key as keyof ProposalForm)}
                            onChange={(event) => updateForm({ [key]: event.target.value } as Partial<ProposalForm>)}
                            placeholder={placeholder}
                            className="mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div id="proposal-commercial" className="scroll-mt-24 rounded-[8px] border border-[#edf2ef] bg-[#f8fbf9] p-4">
                    <h3 className="text-sm font-semibold text-[#14231f]">Commercial opportunity</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {[
                        ["Monthly enquiries", "currentMonthlyEnquiries", "Around 45 to 60 website, GBP and paid enquiries per month."],
                        ["Monthly booked patients", "currentMonthlyBookedPatients", "Estimated 18 to 25 booked consultations from current enquiry volume."],
                        ["Target bookings", "targetBookings", "Increase to 35+ qualified booked consultations per month."],
                        ["Consultation value", "consultationValue", "Typical first appointment value or consultation value to be confirmed."],
                        ["Average treatment value", "averageTreatmentValue", "Example: £2,500 to £4,500 depending on treatment mix."],
                        ["Commercial capacity", "availableCommercialCapacity", "The clinic can support additional private consultations without stretching diary capacity."],
                        ["Recommended ad spend", "recommendedAdSpend", "Recommended starting ad spend: £2,000 to £4,000 per month."],
                        ["Estimated cost per lead", "estimatedCostPerLead", "Target range: £35 to £85 per qualified enquiry once campaigns settle."],
                        ["Estimated leads", "estimatedLeads", "Forecast 40 to 70 qualified enquiries per month after launch period."],
                        ["Estimated booked patients", "estimatedBookedPatients", "Forecast 20 to 35 booked consultations if response and booking process are followed."],
                        ["Break-even bookings", "breakEvenBookings", "Usually one or two accepted high-value cases can cover the monthly programme cost."],
                        ["Data source/label", "commercialDataSource", "Based on current visibility, available clinic data, market demand and agreed assumptions."],
                      ].map(([label, key, placeholder]) => (
                        <label key={key} className="block text-sm font-medium text-[#354943]">
                          {label}
                          <input
                            value={formTextValue(form, key as keyof ProposalForm)}
                            onChange={(event) => updateForm({ [key]: event.target.value } as Partial<ProposalForm>)}
                            placeholder={placeholder}
                            className="mt-1 min-h-11 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div id="proposal-scope" className="scroll-mt-24 rounded-[8px] border border-[#edf2ef] bg-[#f8fbf9] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#14231f]">Scope and deliverables</h3>
                        <p className="mt-1 text-sm leading-6 text-[#5b7069]">
                          These rows appear in the client-facing proposal. Internal delivery notes are not included here.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addScopeItem}
                        disabled={!canEditCurrentProposal}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#315f51] bg-white px-3 text-sm font-semibold text-[#315f51] hover:bg-[#f3f7f4] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Plus className="h-4 w-4" />
                        Add scope item
                      </button>
                    </div>

                    <div className="mt-4 space-y-4">
                      {form.scopeItems.length ? form.scopeItems.map((item, index) => (
                        <div key={`${item.sortOrder}-${index}`} className="rounded-[8px] border border-[#d8e4df] bg-white p-4">
                          <div className="grid gap-3 lg:grid-cols-[minmax(180px,0.5fr)_minmax(280px,1fr)_auto]">
                            <label className="block text-sm font-medium text-[#354943]">
                              Category
                              <select
                                value={item.category}
                                onChange={(event) => updateScopeItem(index, { category: event.target.value })}
                                className="mt-1 min-h-11 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                              >
                                {scopeCategories.map((category) => (
                                  <option key={category} value={category}>{category}</option>
                                ))}
                              </select>
                            </label>
                            <label className="block text-sm font-medium text-[#354943]">
                              Title
                              <input
                                value={item.title}
                                onChange={(event) => updateScopeItem(index, { title: event.target.value })}
                                placeholder="Google Ads campaign restructure"
                                className="mt-1 min-h-11 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => removeScopeItem(index)}
                              disabled={!canEditCurrentProposal}
                              aria-label={`Remove scope item ${item.title || index + 1}`}
                              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[#e1b8b2] bg-white px-3 text-[#9d2f22] hover:bg-[#fff5f3] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <label className="mt-3 block text-sm font-medium text-[#354943]">
                            Client-facing description
                            <textarea
                              rows={3}
                              value={item.clientDescription}
                              onChange={(event) => updateScopeItem(index, { clientDescription: event.target.value })}
                              placeholder="We will rebuild the campaign structure around the priority services, improve search intent quality, reduce wasted spend and report on the enquiries that matter commercially."
                              className="mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                            />
                          </label>

                          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <label className="block text-sm font-medium text-[#354943]">
                              Frequency
                              <input
                                value={item.frequency || ""}
                                onChange={(event) => updateScopeItem(index, { frequency: event.target.value })}
                                placeholder="Ongoing monthly"
                                className="mt-1 min-h-11 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                              />
                            </label>
                            <label className="block text-sm font-medium text-[#354943]">
                              Quantity / limit
                              <input
                                value={item.quantityLimit || ""}
                                onChange={(event) => updateScopeItem(index, { quantityLimit: event.target.value })}
                                placeholder="Subject to agreed ad spend"
                                className="mt-1 min-h-11 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                              />
                            </label>
                            <label className="block text-sm font-medium text-[#354943]">
                              Included
                              <select
                                value={item.inclusionStatus}
                                onChange={(event) => updateScopeItem(index, { inclusionStatus: event.target.value === "excluded" ? "excluded" : "included" })}
                                className="mt-1 min-h-11 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                              >
                                <option value="included">Included</option>
                                <option value="excluded">Excluded</option>
                              </select>
                            </label>
                            <label className="block text-sm font-medium text-[#354943]">
                              Type
                              <select
                                value={item.deliveryType}
                                onChange={(event) => updateScopeItem(index, { deliveryType: event.target.value === "one_off" ? "one_off" : "recurring" })}
                                className="mt-1 min-h-11 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                              >
                                <option value="recurring">Recurring</option>
                                <option value="one_off">One-off</option>
                              </select>
                            </label>
                            <label className="flex min-h-11 items-center gap-2 self-end rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm font-medium text-[#354943] xl:col-span-4">
                              <input
                                type="checkbox"
                                checked={item.isOptionalAddOn}
                                onChange={(event) => updateScopeItem(index, { isOptionalAddOn: event.target.checked })}
                                className="h-4 w-4 rounded border-[#b8c8c2] text-[#315f51] focus:ring-[#315f51]"
                              />
                              Optional add-on
                            </label>
                          </div>
                        </div>
                      )) : (
                        <div className="rounded-[8px] border border-dashed border-[#b8c8c2] bg-white p-5 text-sm text-[#5b7069]">
                          No structured scope items are selected yet. Choose a template or add scope items before sending.
                        </div>
                      )}
                    </div>
                  </div>

                  <div id="proposal-proof" className="scroll-mt-24 rounded-[8px] border border-[#edf2ef] bg-[#f8fbf9] p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[#14231f]">Proof and credibility blocks</h3>
                      <p className="mt-1 text-sm leading-6 text-[#5b7069]">
                        Select the proof blocks that should appear publicly in this proposal.
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {proofAssets.length ? proofAssets.map((asset) => {
                        const selected = form.proofAssetIds.includes(asset.id);
                        return (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => toggleProofAsset(asset.id)}
                            disabled={!canEditCurrentProposal}
                            aria-pressed={selected}
                            className={`rounded-[8px] border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              selected
                                ? "border-[#315f51] bg-[#edf5f1]"
                                : "border-[#d8e4df] bg-white hover:border-[#8cb8a6]"
                            }`}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold capitalize text-[#315f51]">
                                {asset.type.replace(/_/g, " ")}
                              </span>
                              {asset.sectorTags.slice(0, 3).map((tag) => (
                                <span key={tag} className="rounded-full bg-[#f3f7f4] px-2 py-1 text-xs font-semibold text-[#6b817a]">
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <p className="mt-3 text-sm font-semibold text-[#14231f]">{asset.title}</p>
                            <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#5b7069]">{asset.copy}</p>
                            {asset.mediaUrl ? (
                              <p className="mt-2 truncate text-xs font-semibold text-[#315f51]">{asset.mediaUrl}</p>
                            ) : null}
                          </button>
                        );
                      }) : (
                        <div className="rounded-[8px] border border-dashed border-[#b8c8c2] bg-white p-5 text-sm text-[#5b7069]">
                          No proof assets exist yet. Create the first proof block below.
                        </div>
                      )}
                    </div>

                    <div className="mt-5 rounded-[8px] border border-[#d8e4df] bg-white p-4">
                      <h4 className="text-sm font-semibold text-[#14231f]">Create proof asset</h4>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <label className="block text-sm font-medium text-[#354943]">
                          Type
                          <select
                            value={proofAssetDraft.type}
                            onChange={(event) => setProofAssetDraft((current) => ({ ...current, type: event.target.value as ProposalProofAssetType }))}
                            className="mt-1 min-h-11 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                          >
                            {proofAssetTypes.map((type) => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-[#354943]">
                          Title
                          <input
                            value={proofAssetDraft.title}
                            onChange={(event) => setProofAssetDraft((current) => ({ ...current, title: event.target.value }))}
                            placeholder="Private clinic growth case study"
                            className="mt-1 min-h-11 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                          />
                        </label>
                      </div>
                      <label className="mt-3 block text-sm font-medium text-[#354943]">
                        Client-facing copy
                        <textarea
                          rows={3}
                          value={proofAssetDraft.copy}
                          onChange={(event) => setProofAssetDraft((current) => ({ ...current, copy: event.target.value }))}
                          placeholder="A relevant example showing how clearer tracking, stronger campaign structure and better lead handling helped a clinic understand which enquiries were becoming booked consultations."
                          className="mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_auto]">
                        <label className="block text-sm font-medium text-[#354943]">
                          Media URL
                          <input
                            value={proofAssetDraft.mediaUrl}
                            onChange={(event) => setProofAssetDraft((current) => ({ ...current, mediaUrl: event.target.value }))}
                            placeholder="https://clinicgrower.co.uk/results"
                            className="mt-1 min-h-11 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                          />
                        </label>
                        <label className="block text-sm font-medium text-[#354943]">
                          Sector tags
                          <input
                            value={proofAssetDraft.sectorTags}
                            onChange={(event) => setProofAssetDraft((current) => ({ ...current, sectorTags: event.target.value }))}
                            placeholder="dentistry, implants, private healthcare"
                            className="mt-1 min-h-11 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void createProofAsset()}
                          disabled={!canEditCurrentProposal || isCreatingProofAsset}
                          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[#315f51] px-4 text-sm font-semibold text-white hover:bg-[#24483d] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isCreatingProofAsset ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                          Create
                        </button>
                      </div>
                    </div>
                  </div>

                  <div id="proposal-final-copy" className="scroll-mt-24 rounded-[8px] border border-[#edf2ef] bg-[#f8fbf9] p-4">
                    <h3 className="text-sm font-semibold text-[#14231f]">Final proposal copy</h3>
                    <p className="mt-1 text-sm leading-6 text-[#5b7069]">
                      These sections control the longer proposal wording. They stay full width so editing does not feel cramped.
                    </p>
                    <div className="mt-4 space-y-4">
                  {[
                    ["Executive summary", "executiveSummary", "This proposal sets out the clearest route to improve enquiry quality, booked consultations and performance visibility without adding unnecessary complexity."],
                    ["Current diagnosis", "diagnosis", "The main gap is not only traffic volume. The clinic needs clearer tracking, stronger local visibility, better conversion points and tighter lead follow-up so growth can be measured and improved."],
                    ["Recommended plan", "recommendedPlan", "Build a joined-up growth system across website conversion, Google visibility, paid search, call/form tracking, lead response and monthly performance reviews."],
                    ["Strategy points", "strategyPoints", "Capture high-intent demand from search and maps.\nImprove the path from page visit to enquiry.\nTrack calls, forms and WhatsApp enquiries through to booked outcomes.\nReduce lead-handling leakage with clearer follow-up visibility."],
                    ["Included features fallback", "includedFeatures", "Clinic Growth Score review and opportunity map\nWebsite and conversion audit\nSEO, GBP and paid lead source review\nTracking and reporting setup guidance\nLead handling and follow-up recommendations"],
                    ["Success metrics", "successMetrics", "Qualified enquiries | Baseline to establish | Lead tracking and call tracking\nBooked consultations | Directional improvement | Booking and CRM data\nResponse time | Under 10 minutes where practical | Call and lead data"],
                    ["ClinicGrower responsibilities", "clinicGrowerResponsibilities", "Deliver the agreed scope and raise blockers quickly.\nTrack agreed conversion events and report on the patient journey.\nOptimise based on reliable data, lead quality and booked outcomes."],
                    ["Client responsibilities", "clientResponsibilities", "Provide access, approvals and required assets promptly.\nRespond to enquiries quickly and maintain appointment capacity.\nShare accurate booking and sales outcome data where available."],
                    ["Delivery timeline", "timeline", "Days 1 to 14: confirm access, validate tracking and review priority pages.\nDays 15 to 45: launch agreed improvements and review first lead quality signals.\nDays 46 to 90: scale what is working and agree the next growth priority."],
                    ["Terms summary", "termsSummary", "Monthly service with agreed minimum term, notice period, payment timing, VAT position and ad spend arrangements confirmed before launch."],
                    ["Investment notes", "investmentNotes", "The recommended investment is designed around the work needed to create a controlled, measurable growth system rather than isolated marketing activity."],
                    ["Next steps", "nextSteps", "Review the proposal, confirm any questions, approve the recommended programme and schedule the onboarding call."],
                  ].map(([label, key, placeholder]) => (
                    <label key={key} className="block text-sm font-medium text-[#354943]">
                      {label}
                      <textarea
                        rows={key === "includedFeatures" || key === "timeline" ? 5 : 4}
                        value={formTextValue(form, key as keyof ProposalForm)}
                        onChange={(event) => updateForm({ [key]: event.target.value } as Partial<ProposalForm>)}
                        placeholder={placeholder}
                        className="mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      />
                    </label>
                  ))}
                    </div>
                  </div>
                  <label className="block text-sm font-medium text-[#354943]">
                    Internal notes
                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={(event) => updateForm({ notes: event.target.value })}
                      placeholder="Internal only: decision maker context, pricing sensitivity, approval notes or follow-up reminders. This will not appear in the client-facing proposal."
                      className="mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                    />
                  </label>
                </div>
              </section>
            </div>
            </fieldset>
            <section id="proposal-live-preview" aria-labelledby="proposal-live-preview-title" className="scroll-mt-24 space-y-3 pt-2">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b817a]">
                    Client-facing output
                  </p>
                  <h2 id="proposal-live-preview-title" className="mt-1 text-lg font-semibold text-[#14231f]">
                    Live {selectedTemplate.name} preview
                  </h2>
                </div>
                <p className="max-w-xl text-sm text-[#5b7069]">
                  Template, commercial and section changes appear here before the draft is saved.
                </p>
              </div>
              <ClinicGrowerProposalTemplate
                proposal={proposalPreview}
                packageRecord={selectedPackage}
                previewMode={false}
              />
            </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
