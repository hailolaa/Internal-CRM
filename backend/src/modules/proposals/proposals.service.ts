import { v4 as uuidv4 } from "uuid";
import { createHash } from "node:crypto";
import QRCode from "qrcode";
import type { PoolConnection } from "mysql2/promise";
import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { csvRows } from "../../utils/csv.js";
import { insertAuditEvent, logAuditEvent } from "../../utils/audit.js";
import { buildTimelineMetadata, insertTimelineActivity, logTimelineActivity } from "../../utils/activity.js";
import { generateResetToken, hashToken } from "../../utils/helpers.js";
import { clientAccountsService } from "../client-accounts/client-accounts.service.js";
import { stageClickUpDeliveryProvision } from "../clickup/clickup.delivery.persistence.js";
import { quickBooksService } from "../quickbooks/quickbooks.service.js";
import { phase1TimelineActions } from "../events/phase1-events.js";
import {
  insertPipelineDealMovement,
  movePipelineDealStage,
} from "../pipeline/pipeline.deals.persistence.js";
import {
  assertPublicProposalV5Acceptable,
  buildProposalPublicUrl,
  isProposalPubliclyVisible,
  mapProposalPublicPackage,
  mapProposalPublicResponse,
  proposalViewTransitionStatuses,
} from "./proposals.public.js";
import {
  assertProposalV5SnapshotReady,
  buildProposalV5Snapshot,
  isProposalV5Proposal,
  parseProposalV5Snapshot,
  proposalV5SnapshotVersion,
  serializeProposalV5Snapshot,
} from "./proposal-v5-snapshot.js";
import { proposalPublicStatuses } from "./proposals.types.js";
import type {
  ProposalCommercialItem,
  ProposalClientReadinessResponse,
  ProposalCoreData,
  ProposalDataState,
  ProposalLinkAccess,
  ProposalListQuery,
  ProposalPublicPreviewResponse,
  ProposalMutationDTO,
  ProposalPublicEventDTO,
  ProposalProofAssetLibraryQuery,
  ProposalProofAssetListResponse,
  ProposalProofAssetMutationDTO,
  ProposalProofAssetResponse,
  ProposalProofAssetType,
  ProposalScopeLibraryItemMutationDTO,
  ProposalScopeLibraryItemResponse,
  ProposalScopeLibraryListResponse,
  ProposalScopeLibraryQuery,
  ProposalPublicAcceptanceDTO,
  ProposalPublicAcceptanceSummary,
  ProposalRenderArchiveQuery,
  ProposalResponse,
  ProposalSectionContent,
  ProposalSendDTO,
  ProposalShareResponse,
  ProposalSectorImage,
  ProposalScopeItem,
  ProposalSourceDataQuery,
  ProposalSourceDataResponse,
  ProposalStatus,
  ProposalStatusUpdateDTO,
  ProposalTemplateContent,
  ProposalTemplateMutationDTO,
  ProposalTemplateRejectDTO,
  ProposalTemplateRollbackDTO,
  ProposalTemplateResponse,
  ProposalTemplateVersionCompareResponse,
  ProposalTemplateVersionDiff,
  ProposalTemplateVersionMutationDTO,
  ProposalTemplateVersionResponse,
  ProposalTemplateVersionStatus,
  ProposalTemplateVersionSummary,
  ProposalRenderResponse,
  ProposalV5Snapshot,
} from "./proposals.types.js";

type QueryExecutor = Pick<PoolConnection, "execute">;

function cleanString(value: unknown) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function hasText(value: unknown) {
  return Boolean(cleanString(value));
}

function containsUndefinedScopePhrase(value: unknown) {
  const text = cleanString(value)?.toLowerCase() || "";
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

function isIncompleteSuccessMetric(value: unknown) {
  const parts = String(value || "")
    .split("|")
    .map((part) => part.trim());
  if (parts.length < 3 || parts.some((part) => !hasText(part))) return true;

  const text = parts.join(" ").toLowerCase();
  return [
    "baseline to establish",
    "directional improvement",
    "required before sending",
    "agreed during onboarding",
    "measured from agreed tracking sources",
  ].some((phrase) => text.includes(phrase));
}

const proposalClinicTypeAssetVersion = "2026-08-10.v5-approved-assets";
const proposalClinicTypeVariants = {
  general: {
    label: "General ClinicGrower",
    proofTags: ["clinic", "general", "clinicgrower os"],
  },
  aesthetic_clinic: {
    label: "Aesthetic Clinics",
    proofTags: ["aesthetic", "aesthetics", "skin", "injectable", "laser"],
  },
  dental_clinic: {
    label: "Dental Practices",
    proofTags: ["dental", "dentist", "implant", "invisalign", "smile"],
  },
  cosmetic_surgery_clinic: {
    label: "Cosmetic Surgery Clinics",
    proofTags: ["surgery", "surgeon", "procedure", "cosmetic surgery"],
  },
  dermatology_clinic: {
    label: "Dermatology Clinics",
    proofTags: ["dermatology", "skin", "acne", "mole", "eczema"],
  },
  hair_transplant_clinic: {
    label: "Hair Transplant Clinics",
    proofTags: ["hair", "hair transplant", "hair restoration", "fue"],
  },
  wellness_clinic: {
    label: "Wellness Clinics",
    proofTags: ["wellness", "longevity", "health optimisation", "functional", "wellbeing"],
  },
  private_gp_medical_clinic: {
    label: "Private GP & Medical Clinics",
    proofTags: ["private gp", "medical", "doctor", "health check", "screening"],
  },
  medical_spa: {
    label: "Medical Spas",
    proofTags: ["medical spa", "medspa", "spa", "aesthetic", "skin", "laser"],
  },
} as const;

type ProposalClinicTypeVariantId = keyof typeof proposalClinicTypeVariants;

function getProposalClinicTypeVariant(value: unknown) {
  const variant = cleanString(value);
  if (variant && Object.prototype.hasOwnProperty.call(proposalClinicTypeVariants, variant)) {
    return variant as ProposalClinicTypeVariantId;
  }
  return null;
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

const segmentMatchTerms: Record<string, string[]> = {
  dental: ["dental", "dentist", "implant", "invisalign", "smile"],
  ent: ["ent", "ear nose throat", "snoring", "sleep", "hearing", "sinus"],
  dermatology: ["dermatology", "skin", "acne", "mole", "eczema"],
  aesthetics: ["aesthetic", "aesthetics", "skin", "injectable", "laser", "botox"],
  physiotherapy: ["physio", "physiotherapy", "rehab", "sports injury"],
  "primary care": ["private gp", "general practice", "gp clinic", "medical", "doctor", "screening"],
};

function normaliseProofTag(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
}

function proofTagParts(asset: ProposalProofAssetResponse) {
  return (asset.sectorTags || [])
    .flatMap((tag) => {
      const raw = cleanString(tag)?.toLowerCase() || "";
      const [key, ...rest] = raw.split(":");
      return [raw, key, rest.join(":")].filter(Boolean);
    })
    .filter((tag): tag is string => Boolean(tag));
}

function proofIsCommonAsset(asset: ProposalProofAssetResponse) {
  const text = proofAssetText(asset);
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

function proofMatchesClinicVariant(asset: ProposalProofAssetResponse, variantId: ProposalClinicTypeVariantId) {
  if (proofIsCommonAsset(asset)) return true;
  const text = proofAssetText(asset);
  return proposalClinicTypeVariants[variantId].proofTags.some((tag) =>
    text.includes(tag) ||
    proofTagParts(asset).some((part) => normaliseProofTag(part).includes(normaliseProofTag(tag))),
  );
}

function buildAcceptanceUrl(proposalUrl: string | null | undefined) {
  const cleanUrl = cleanString(proposalUrl);
  if (!cleanUrl) return null;
  return `${cleanUrl.replace(/#.*$/, "")}#acceptance-form`;
}

async function buildAcceptanceQrCodeDataUrl(acceptanceUrl: string | null) {
  if (!acceptanceUrl) return null;
  try {
    return await QRCode.toDataURL(acceptanceUrl, {
      margin: 1,
      width: 220,
      color: {
        dark: "#102b2f",
        light: "#ffffff",
      },
    });
  } catch {
    return null;
  }
}

function proofAssetText(asset: ProposalProofAssetResponse) {
  return `${asset.title} ${asset.copy} ${(asset.sectorTags || []).join(" ")}`.toLowerCase();
}

function inferClinicSegmentsFromSection(section: ProposalSectionContent) {
  const text = [
    section.clinicTypeAndLocations,
    section.priorityTreatments,
    section.targetArea,
    section.primaryGoal,
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

function proofMatchesClinicSegments(asset: ProposalProofAssetResponse, segments: string[]) {
  if (!segments.length) return true;
  const text = proofAssetText(asset);
  return segments.some((segment) =>
    (segmentMatchTerms[segment] || [segment]).some((term) => text.includes(term)),
  );
}

function proofHasPermission(asset: ProposalProofAssetResponse) {
  const text = proofAssetText(asset);
  return text.includes("permission") || text.includes("approved") || text.includes("consent");
}

function proofHasResultContext(asset: ProposalProofAssetResponse) {
  if (asset.type !== "performance_result") return true;
  const text = proofAssetText(asset);
  return /\b(week|month|quarter|year|day|within|over|from|between|20\d{2}|delivery context|timeframe)\b/.test(text);
}

function proofHasVerifiedImage(asset: ProposalProofAssetResponse) {
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

function proofIsDrTanja(asset: ProposalProofAssetResponse) {
  return /dr\.?\s*tanja|tanja/i.test(proofAssetText(asset));
}

function toMysqlDateTime(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace("T", " ");
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 19).replace("T", " ");
  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

function toIso(value: unknown) {
  if (!value) return null;
  return new Date(value as string).toISOString();
}

function toDateOnly(value: unknown) {
  if (!value) return null;
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function toMysqlDateOnly(value: unknown) {
  if (!value) return null;
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function centsToValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric / 100 : null;
}

function valueToCents(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : null;
}

function contactName(row: any) {
  const name = [row.contactFirstName, row.contactLastName].filter(Boolean).join(" ").trim();
  return name || row.contactEmail || row.contactPhone || null;
}

function parseSectionContent(value: unknown): ProposalSectionContent | null {
  if (!value) return null;
  if (typeof value === "object") return value as ProposalSectionContent;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function serializeSectionContent(value: ProposalSectionContent | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return JSON.stringify(value);
}

function isFinalProposalStatus(status: ProposalStatus) {
  return ["accepted", "won", "lost", "expired", "archived"].includes(status);
}

function validateProposalStatusTransition(previousStatus: ProposalStatus, nextStatus: ProposalStatus) {
  if (previousStatus === nextStatus) return;
  if (previousStatus === "accepted" && nextStatus === "won") return;
  if (isFinalProposalStatus(previousStatus)) {
    throw ApiError.badRequest(
      `This ${previousStatus.replace(/_/g, " ")} proposal cannot be moved back to ${nextStatus.replace(/_/g, " ")}.`,
    );
  }
}

function parseCommercialItems(value: unknown): ProposalCommercialItem[] {
  if (!value) return [];
  try {
    const raw = typeof value === "object" ? value : JSON.parse(String(value));
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        if (typeof item === "string") return { name: item, amountCents: null, note: null };
        return {
          name: cleanString(item?.name) || "",
          amountCents: item?.amountCents === null || item?.amountCents === undefined ? null : Number(item.amountCents),
          note: cleanString(item?.note),
        };
      })
      .filter((item) => item.name);
  } catch {
    return [];
  }
}

function serializeCommercialItems(value: ProposalCommercialItem[] | null | undefined) {
  if (value === undefined) return undefined;
  if (!value) return null;
  return JSON.stringify(
    value
      .map((item) => ({
        name: cleanString(item.name) || "",
        amountCents: item.amountCents === null || item.amountCents === undefined ? null : Number(item.amountCents),
        note: cleanString(item.note),
      }))
      .filter((item) => item.name),
  );
}

function parseJsonObject(value: unknown) {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function parseProposalCoreData(value: unknown): ProposalCoreData | null {
  const parsed = parseJsonObject(value);
  if (!parsed) return null;
  return parsed as unknown as ProposalCoreData;
}

function serializeProposalCoreData(value: ProposalCoreData | null | undefined) {
  if (value === undefined) return undefined;
  if (!value) return null;
  return JSON.stringify(value);
}

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeProposalDataState(value: unknown): ProposalDataState {
  const state = cleanString(value);
  if (state === "known" || state === "confirmed_on_call") return "known";
  if (state === "working_diagnosis" || state === "provisional" || state === "to_confirm") {
    return state;
  }
  return "to_confirm";
}

function splitProposalLines(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanString(item)).filter((item): item is string => Boolean(item));
  }
  const text = cleanString(value);
  if (!text) return [];
  return text
    .split(/\r?\n|;/)
    .map((line) => cleanString(line))
    .filter((line): line is string => Boolean(line));
}

function parseSuccessMetricCore(value: string) {
  const [name, baseline, source] = value.split("|").map((part) => cleanString(part));
  return {
    name: name || value,
    baselineState: baseline ? "known" as ProposalDataState : "to_confirm" as ProposalDataState,
    reviewCadence: null,
    connectedDataSource: source || null,
  };
}

function proofTimeframeFromText(value: string | null) {
  if (!value) return null;
  const match = value.match(/\b(over|within|after|from|between)\s+[^.]{1,80}|\b\d{1,3}\s+(day|days|week|weeks|month|months|year|years)\b|\b20\d{2}\b/i);
  return match?.[0] || null;
}

function normalizeSectorImage(
  slot: ProposalSectorImage["slot"],
  image: Partial<ProposalSectorImage> | null | undefined,
  fallback: ProposalSectionContent,
) {
  return {
    slot,
    imageId: cleanString(image?.imageId) || (slot === "cover" ? cleanString(fallback.heroImageId) : null),
    url: cleanString(image?.url) || (slot === "cover" ? cleanString(fallback.heroImageUrl) : null),
    cropPosition: cleanString(image?.cropPosition) || (slot === "cover" ? cleanString(fallback.heroImageCropPosition) : null),
    licence: cleanString(image?.licence) || (slot === "cover" ? cleanString(fallback.heroImageLicence) : null),
    provenance: cleanString(image?.provenance) || cleanString(fallback.sectorImageProvenance),
    approvalStatus: image?.approvalStatus || fallback.sectorImageApprovalStatus || null,
  };
}

function proposalImmutableVersion(proposal: ProposalResponse) {
  const acceptanceEvidence =
    proposal.acceptanceRecord?.evidenceSha256 ||
    proposal.acceptanceRecord?.lockedAt ||
    proposal.acceptanceRecord?.acceptedAt;
  const proposalEvidence = acceptanceEvidence || proposal.sentAt || proposal.updatedAt || proposal.createdAt;
  return `${proposal.id}:${proposalEvidence || "draft"}`;
}

function buildProposalV5PrintArchiveFingerprint(input: {
  proposalId: string;
  artifactType: "v5_print_pdf";
  snapshotHash: string;
  snapshotVersion: string;
  sourceProposalVersion: string | null;
  pageCount: number;
  publicUrl: string | null;
  printUrl: string | null;
}) {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

function mapProposalRenderArchive(row: any) {
  return {
    id: row.id,
    proposalId: row.proposalId,
    contactId: row.contactId || null,
    dealId: row.dealId || null,
    clientAccountProfileId: row.clientAccountProfileId || null,
    artifactType: row.artifactType,
    status: row.status,
    proposalReference: row.proposalReference,
    proposalName: row.proposalName,
    clientName: row.clientName || null,
    packageName: row.packageName || null,
    publicUrl: row.publicUrl || null,
    printUrl: row.printUrl || null,
    snapshotHash: row.snapshotHash,
    snapshotVersion: row.snapshotVersion,
    sourceProposalVersion: row.sourceProposalVersion || null,
    templateVersionId: row.templateVersionId || null,
    templateContentHash: row.templateContentHash || null,
    pageCount: Number(row.pageCount || 0),
    contentFingerprint: row.contentFingerprint,
    createdBy: row.createdBy || null,
    createdAt: toIso(row.createdAt) || new Date(row.createdAt).toISOString(),
  };
}

function buildProposalCoreData(proposal: ProposalResponse): ProposalCoreData {
  const section = proposal.sectionContent || {};
  const sectorImages = Array.isArray(section.sectorImages) ? section.sectorImages : [];
  const sectorImageBySlot = new Map(sectorImages.map((image) => [image.slot, image]));
  const scopeItems = Array.isArray(section.scopeItems) ? section.scopeItems : [];
  const proofAssets = Array.isArray(section.proofAssets) ? section.proofAssets : [];
  const approvalScope = proposal.acceptanceRecord?.scope || null;
  const exactTerms = proposal.acceptanceRecord?.paymentTerms || section.termsSummary || null;

  return {
    schemaVersion: "proposal_core_v1",
    proposalId: proposal.id,
    immutableVersion: proposalImmutableVersion(proposal),
    lifecycle: {
      status: proposal.status,
      createdAt: proposal.createdAt || null,
      issuedAt: proposal.sentAt || proposal.readyAt || null,
      expiresAt: proposal.expiresAt || null,
      proposedStartDate: proposal.startDate || null,
    },
    recipient: {
      name: proposal.contactName || null,
      email: proposal.contactEmail || null,
      clinicName: proposal.clientAccountName || proposal.accountName || null,
      location: cleanString(section.targetArea) || null,
      clinicType: cleanString(section.clinicTypeVariant) || null,
      authorisedDecisionMaker: proposal.acceptanceRecord?.acceptedByName || proposal.contactName || null,
    },
    discovery: {
      source: cleanString(section.discoverySource),
      customerWording: cleanString(section.customerWording),
      priorityServices: cleanString(section.priorityTreatments),
      goal: cleanString(section.primaryGoal),
      workingDiagnosis: cleanString(section.diagnosis),
      confidenceState: normalizeProposalDataState(section.evidenceConfidenceState),
    },
    journey: {
      stages: [
        "Marketing and visibility",
        "Enquiry",
        "Response",
        "Booking",
        "Attendance",
        "Consultation",
        "Treatment",
        "Revenue",
        "Follow-up and retention",
      ],
      activeConstraintId: cleanString(section.activeConstraintId),
      diagnosedLeaks: splitProposalLines(section.problemsDiscussed || section.biggestRisk),
      evidence: cleanString(section.commercialDataSource || section.discoverySource),
      confidenceState: normalizeProposalDataState(section.activeConstraintConfidenceState),
    },
    commercial: {
      selectedPackageId: proposal.recommendedPackageId,
      packageName: proposal.packageName,
      monthlyFeeCents: proposal.monthlyFeeCents,
      setupFeeCents: proposal.setupFeeCents,
      currency: proposal.currency || "GBP",
      vatStatus: proposal.vatStatus,
      selectedMedia: proposal.adSpendNote || cleanString(section.selectedMediaSpend),
      minimumTermMonths: proposal.minimumTermMonths,
      noticePeriodDays: proposal.noticePeriodDays,
      exactTerms,
    },
    economics: {
      economicUnit: cleanString(section.economicUnit),
      clinicConfirmedContribution: cleanString(section.clinicConfirmedContribution),
      contributionEvidenceSourceDate: cleanString(section.contributionEvidenceSourceDate),
      contributionConfirmationState: normalizeProposalDataState(section.contributionConfirmationState),
      relevantMonthlyInvestment: cleanString(section.selectedMediaSpend) || proposal.adSpendNote,
      capacity: cleanString(section.availableCommercialCapacity || section.availableCapacity),
      paybackState: normalizeProposalDataState(section.paybackState),
      wholeUnitBreakEvenRule: "Use whole units only. Round required converted patients/treatments up to the next full unit after contribution, media and fee inputs are confirmed.",
    },
    kpis: splitProposalLines(section.successMetrics).map(parseSuccessMetricCore),
    scopeLines: scopeItems.map((item) => ({
      category: item.category,
      title: item.title,
      quantityLimit: item.quantityLimit || null,
      frequency: item.frequency || null,
      dependency: item.dependencies || null,
      owner: item.clientResponsibilities || null,
      exclusion: item.exclusions || null,
    })),
    dataVisibility: {
      connectedSources: splitProposalLines(section.currentWebsiteCrmBookingSetup),
      productStatus: section.liveDataStatus || null,
      knownLimitations: cleanString(section.knownDataLimitations),
    },
    proofAssets: proofAssets.map((asset) => ({
      id: asset.id || null,
      type: asset.type || null,
      title: asset.title || null,
      proofMode: asset.type || null,
      proofScope: (asset.sectorTags || []).join(", ") || null,
      source: asset.mediaUrl || null,
      timeframe: proofTimeframeFromText(`${asset.title} ${asset.copy}`),
      disclaimer: asset.type === "performance_result"
        ? "Historical result with delivery context. Not a guarantee."
        : "Credibility proof only. Not a guarantee.",
    })),
    sectorImages: (["cover", "journey", "proof", "close"] as const).map((slot) =>
      normalizeSectorImage(slot, sectorImageBySlot.get(slot), section),
    ),
    approval: {
      approvalVersion: proposal.acceptanceRecord?.id || null,
      recipient: proposal.acceptanceRecord?.acceptedByEmail || proposal.contactEmail || null,
      timestamp: proposal.acceptanceRecord?.acceptedAt || null,
      packageName: proposal.acceptanceRecord?.packageName || proposal.packageName,
      scope: approvalScope,
      exactTermsPresented: exactTerms,
    },
  };
}

function contactFullName(row: any) {
  return [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.email || row.phone || null;
}

function actualPersonName(row: any) {
  if (!row) return null;
  return [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || null;
}

function formatLocation(row: any) {
  return [row.city, row.state, row.country].filter(Boolean).join(", ") || null;
}

function formatAuditStatus(value: string | null | undefined) {
  if (!value) return "Not started";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const growthScoreCategoryLabels: Record<string, string> = {
  websiteVisibility: "Website visibility",
  seo: "SEO",
  gbp: "Google Business Profile",
  tracking: "Tracking",
  conversion: "Conversion",
  leadHandling: "Lead handling",
  responseSpeed: "Response speed",
  enquiryVisibility: "Enquiry visibility",
  treatmentPerformance: "Service/package performance",
  revenueLeakage: "Revenue leakage",
  growthOpportunity: "Growth opportunity",
};

function mapScoreCategories(row: any) {
  const parsed = parseJsonObject(row?.growthScoreCategories) || {};
  const score = (columnValue: unknown, key: string) => numberOrNull(columnValue ?? parsed[key]);
  return {
    websiteVisibility: score(row?.growthScoreWebsiteVisibility, "websiteVisibility"),
    seo: score(row?.growthScoreSeo, "seo"),
    gbp: score(row?.growthScoreGbp, "gbp"),
    tracking: score(row?.growthScoreTracking, "tracking"),
    conversion: score(row?.growthScoreConversion, "conversion"),
    leadHandling: score(row?.growthScoreLeadHandling, "leadHandling"),
    responseSpeed: score(row?.growthScoreResponseSpeed, "responseSpeed"),
    enquiryVisibility: score(row?.growthScoreEnquiryVisibility, "enquiryVisibility"),
    treatmentPerformance: score(row?.growthScoreTreatmentPerformance, "treatmentPerformance"),
    revenueLeakage: score(row?.growthScoreRevenueLeakage, "revenueLeakage"),
    growthOpportunity: score(row?.growthScoreGrowthOpportunity, "growthOpportunity"),
  };
}

function mergeScoreCategories(contact: any, clientAccount: any) {
  const contactCategories = mapScoreCategories(contact || {});
  const accountCategories = mapScoreCategories(clientAccount || {});
  return Object.fromEntries(
    Object.keys(contactCategories).map((key) => [
      key,
      contactCategories[key as keyof typeof contactCategories] ??
        accountCategories[key as keyof typeof accountCategories],
    ]),
  ) as Record<keyof typeof contactCategories, number | null>;
}

function scoreGaps(categories: Record<string, number | null>) {
  return Object.entries(categories)
    .filter(([, score]) => score !== null && score < 70)
    .sort(([, a], [, b]) => Number(a) - Number(b))
    .slice(0, 5)
    .map(([key, score]) => ({
      key,
      label: growthScoreCategoryLabels[key] || key,
      score,
    }));
}

function mapAcceptanceRecord(row: any) {
  if (!row.acceptanceRecordId) return null;
  return {
    id: row.acceptanceRecordId,
    proposalId: row.acceptanceProposalId,
    contactId: row.acceptanceContactId || null,
    dealId: row.acceptanceDealId || null,
    clientAccountProfileId: row.acceptanceClientAccountProfileId || null,
    acceptedByName: row.acceptedByName || null,
    acceptedByEmail: row.acceptedByEmail || null,
    legalCompanyName: row.acceptanceLegalCompanyName || null,
    billingEmail: row.acceptanceBillingEmail || null,
    preferredStartDate: toDateOnly(row.acceptancePreferredStartDate),
    agreementAccepted: Boolean(row.acceptanceAgreementAccepted),
    confirmationText: row.acceptanceConfirmationText || null,
    acceptanceSource: row.acceptanceSource || null,
    acceptedIpAddress: row.acceptanceIpAddress || null,
    acceptedUserAgent: row.acceptanceUserAgent || null,
    evidenceSha256: row.acceptanceEvidenceSha256 || null,
    lockedAt: toIso(row.acceptanceLockedAt),
    acceptedAt: new Date(row.acceptanceAcceptedAt).toISOString(),
    acceptanceStatus: row.acceptanceStatus || "accepted",
    packageName: row.acceptancePackageName || null,
    recommendedPackageId: row.acceptanceRecommendedPackageId || null,
    monthlyFeeCents: numberOrNull(row.acceptanceMonthlyFeeCents),
    setupFeeCents: numberOrNull(row.acceptanceSetupFeeCents),
    currency: row.acceptanceCurrency || "GBP",
    paymentTerms: row.acceptancePaymentTerms || null,
    startDate: toDateOnly(row.acceptanceStartDate),
    minimumTermMonths: numberOrNull(row.acceptanceMinimumTermMonths),
    noticePeriodDays: numberOrNull(row.acceptanceNoticePeriodDays),
    scope: parseJsonObject(row.acceptanceScope),
    commercialSnapshot: parseJsonObject(row.acceptanceCommercialSnapshot),
    proposalSnapshot: parseJsonObject(row.acceptanceProposalSnapshot),
    coreDataSnapshot: parseProposalCoreData(row.acceptanceCoreDataSnapshot),
    v5Snapshot: parseProposalV5Snapshot(row.acceptanceV5Snapshot),
    v5SnapshotHash: row.acceptanceV5SnapshotHash || null,
    v5SnapshotVersion: row.acceptanceV5SnapshotVersion || null,
    createdAt: new Date(row.acceptanceCreatedAt).toISOString(),
    updatedAt: new Date(row.acceptanceUpdatedAt).toISOString(),
  };
}

function mapProposal(row: any): ProposalResponse {
  const ownerName = [row.ownerFirstName, row.ownerLastName].filter(Boolean).join(" ").trim();
  return {
    id: row.id,
    contactId: row.contactId || null,
    dealId: row.dealId || null,
    clientAccountProfileId: row.clientAccountProfileId || null,
    proposalName: row.proposalName,
    templateId: row.templateId || null,
    templateKey: row.templateKey || "clinicgrower_v5",
    templateVersionId: row.templateVersionId || null,
    templateVersionNumber: numberOrNull(row.templateVersionNumber),
    templateContentHash: row.templateContentHash || null,
    packageName: row.packageName || null,
    recommendedPackageId: row.recommendedPackageId || null,
    ownerId: row.ownerId || null,
    ownerName: ownerName || row.ownerEmail || null,
    status: row.status,
    valueCents: valueToCents(row.value),
    monthlyFeeCents: numberOrNull(row.monthlyFeeCents),
    setupFeeCents: numberOrNull(row.setupFeeCents),
    currency: row.currency || "GBP",
    adSpendNote: row.adSpendNote || null,
    vatStatus: row.vatStatus || null,
    minimumTermMonths: numberOrNull(row.minimumTermMonths),
    noticePeriodDays: numberOrNull(row.noticePeriodDays),
    startDate: toDateOnly(row.startDate),
    followUpAt: toIso(row.followUpAt),
    readyAt: toIso(row.readyAt),
    sentAt: toIso(row.sentAt),
    sentToEmail: row.sentToEmail || null,
    sentToName: row.sentToName || null,
    sendMethod: row.sendMethod || null,
    sendNote: row.sendNote || null,
    sentBy: row.sentBy || null,
    sentByName: [row.sentByFirstName, row.sentByLastName].filter(Boolean).join(" ").trim() || row.sentByEmail || null,
    viewedAt: toIso(row.viewedAt),
    acceptedAt: toIso(row.acceptedAt),
    acceptedReason: row.acceptedReason || null,
    wonAt: toIso(row.wonAt),
    wonReason: row.wonReason || null,
    lostAt: toIso(row.lostAt),
    lostReason: row.lostReason || null,
    objectionType: row.objectionType || null,
    expiresAt: toIso(row.expiresAt),
    proposalUrl: row.proposalUrl || null,
    notes: row.notes || null,
    addOns: parseCommercialItems(row.addOns),
    discounts: parseCommercialItems(row.discounts),
    internalMarginNote: row.internalMarginNote || null,
    sectionContent: parseSectionContent(row.sectionContent),
    coreData: parseProposalCoreData(row.coreData),
    v5Snapshot: parseProposalV5Snapshot(row.v5Snapshot),
    v5SnapshotHash: row.v5SnapshotHash || null,
    v5SnapshotVersion: row.v5SnapshotVersion || null,
    v5SnapshotFrozenAt: toIso(row.v5SnapshotFrozenAt),
    draftSavedAt: toIso(row.draftSavedAt),
    contactName: contactName(row),
    contactEmail: row.contactEmail || null,
    accountName: row.accountName || null,
    dealTitle: row.dealTitle || null,
    clientAccountName: row.clientAccountName || null,
    createdBy: row.createdBy || null,
    updatedBy: row.updatedBy || null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    acceptanceRecord: mapAcceptanceRecord(row),
  };
}

function mapPublicAcceptanceSummary(proposal: ProposalResponse): ProposalPublicAcceptanceSummary | null {
  const record = proposal.acceptanceRecord;
  if (!record) return null;
  return {
    acceptedByName: record.acceptedByName,
    acceptedByEmail: record.acceptedByEmail,
    legalCompanyName: record.legalCompanyName,
    billingEmail: record.billingEmail,
    preferredStartDate: record.preferredStartDate,
    acceptedAt: record.acceptedAt,
    lockedAt: record.lockedAt,
  };
}

function hashAcceptanceEvidence(value: Record<string, unknown>) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function parseProofAssetIds(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const ids = (value as ProposalSectionContent).proofAssetIds;
  return Array.isArray(ids) ? ids.map((id) => cleanString(id)).filter(Boolean) as string[] : [];
}

function mapProposalTemplate(row: any): ProposalTemplateResponse {
  return {
    id: row.id,
    templateKey: row.templateKey,
    name: row.name,
    description: row.description || null,
    packageName: row.packageName || null,
    defaultSections: parseSectionContent(row.defaultSections),
    defaultRoadmap: parseJsonArray(row.defaultRoadmap),
    defaultTerms: row.defaultTerms || null,
    defaultSuccessMetrics: parseJsonArray(row.defaultSuccessMetrics),
    defaultScopeItems: [],
    sortOrder: Number(row.sortOrder || 0),
    isActive: Boolean(row.isActive),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    activeVersion: row.activeVersionId ? mapProposalTemplateVersionSummary(row, "activeVersion") : null,
  };
}

const proposalTemplateEditablePolicyVersion = "proposal-template-fields-2026-08-21";
const proposalTemplateEditableTopLevelFields = new Set([
  "name",
  "description",
  "defaultSections",
  "defaultRoadmap",
  "defaultSuccessMetrics",
]);
const proposalTemplateEditableSectionFields = new Set([
  "executiveSummary",
  "personalIntroduction",
  "diagnosis",
  "primaryGoal",
  "currentPosition",
  "desiredOutcome",
  "biggestRisk",
  "biggestOpportunity",
  "firstRecommendedFix",
  "recommendedPlan",
  "strategyPoints",
  "includedFeatures",
  "successMetrics",
  "clinicGrowerResponsibilities",
  "clientResponsibilities",
  "timeline",
  "investmentNotes",
  "nextSteps",
  "introVideoTitle",
  "introVideoUrl",
  "introVideoThumbnailUrl",
  "fallbackVideoUrl",
]);
const proposalTemplateLockedFields = [
  "packageName",
  "defaultTerms",
  "defaultScopeItems",
  "packageCatalogue",
  "proofAssets",
  "crmClientData",
  "legalCommercialControls",
  "v19ReferenceStructure",
];

function orderedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(orderedValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce((accumulator: Record<string, unknown>, key) => {
      accumulator[key] = orderedValue((value as Record<string, unknown>)[key]);
      return accumulator;
    }, {});
}

function stableJson(value: unknown) {
  return JSON.stringify(orderedValue(value));
}

function hashTemplateContent(content: ProposalTemplateContent) {
  return createHash("sha256").update(stableJson(content)).digest("hex");
}

function parseTemplateContent(value: unknown): ProposalTemplateContent {
  const parsed = parseJsonObject(value) as ProposalTemplateContent | null;
  return parsed || {};
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item)).filter(Boolean) as string[];
}

function cleanTemplateSectionContent(value: unknown): ProposalSectionContent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};
  for (const key of proposalTemplateEditableSectionFields) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const candidate = source[key];
    if (Array.isArray(candidate)) {
      cleaned[key] = cleanStringArray(candidate);
    } else if (candidate === null || candidate === undefined) {
      cleaned[key] = null;
    } else if (typeof candidate === "number" || typeof candidate === "boolean") {
      cleaned[key] = candidate;
    } else {
      cleaned[key] = cleanString(candidate);
    }
  }
  return Object.keys(cleaned).length ? cleaned as ProposalSectionContent : null;
}

function normalizeTemplateContent(
  input: ProposalTemplateContent | null | undefined,
  base: ProposalTemplateContent | null | undefined = {},
): ProposalTemplateContent {
  const source = input || {};
  const baseContent = base || {};
  const next: ProposalTemplateContent = {
    name: cleanString(baseContent.name),
    description: cleanString(baseContent.description),
    packageName: cleanString(baseContent.packageName),
    defaultSections: baseContent.defaultSections || null,
    defaultRoadmap: cleanStringArray(baseContent.defaultRoadmap),
    defaultTerms: cleanString(baseContent.defaultTerms),
    defaultSuccessMetrics: cleanStringArray(baseContent.defaultSuccessMetrics),
    editablePolicyVersion: proposalTemplateEditablePolicyVersion,
    lockedFields: [...proposalTemplateLockedFields],
  };

  for (const key of proposalTemplateEditableTopLevelFields) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    if (key === "defaultSections") {
      next.defaultSections = cleanTemplateSectionContent(source.defaultSections) || next.defaultSections || null;
    } else if (key === "defaultRoadmap") {
      next.defaultRoadmap = cleanStringArray(source.defaultRoadmap);
    } else if (key === "defaultSuccessMetrics") {
      next.defaultSuccessMetrics = cleanStringArray(source.defaultSuccessMetrics);
    } else if (key === "name") {
      next.name = cleanString(source.name);
    } else if (key === "description") {
      next.description = cleanString(source.description);
    }
  }

  if (!next.name) throw ApiError.badRequest("Template name is required");
  return next;
}

function templateContentFromTemplateRow(row: ProposalTemplateResponse): ProposalTemplateContent {
  return normalizeTemplateContent({
    name: row.name,
    description: row.description,
    packageName: row.packageName,
    defaultSections: row.defaultSections,
    defaultRoadmap: row.defaultRoadmap,
    defaultTerms: row.defaultTerms,
    defaultSuccessMetrics: row.defaultSuccessMetrics,
  }, {
    packageName: row.packageName,
    defaultTerms: row.defaultTerms,
  });
}

function mapProposalTemplateVersionSummary(row: any, prefix = ""): ProposalTemplateVersionSummary {
  const key = (name: string) => prefix ? `${prefix}${name.charAt(0).toUpperCase()}${name.slice(1)}` : name;
  const createdByName = [row[key("createdByFirstName")], row[key("createdByLastName")]].filter(Boolean).join(" ").trim();
  return {
    id: row[key("id")],
    templateId: row[key("templateId")],
    templateKey: row[key("templateKey")],
    versionNumber: Number(row[key("versionNumber")] || 0),
    status: row[key("status")] as ProposalTemplateVersionStatus,
    contentHash: row[key("contentHash")],
    sourceVersionId: row[key("sourceVersionId")] || null,
    createdBy: row[key("createdBy")] || null,
    createdByName: createdByName || row[key("createdByEmail")] || null,
    submittedBy: row[key("submittedBy")] || null,
    approvedBy: row[key("approvedBy")] || null,
    rejectedBy: row[key("rejectedBy")] || null,
    publishedBy: row[key("publishedBy")] || null,
    createdAt: new Date(row[key("createdAt")]).toISOString(),
    updatedAt: new Date(row[key("updatedAt")]).toISOString(),
    submittedAt: toIso(row[key("submittedAt")]),
    approvedAt: toIso(row[key("approvedAt")]),
    rejectedAt: toIso(row[key("rejectedAt")]),
    publishedAt: toIso(row[key("publishedAt")]),
    supersededAt: toIso(row[key("supersededAt")]),
    rejectionReason: row[key("rejectionReason")] || null,
    changeSummary: row[key("changeSummary")] || null,
  };
}

function mapProposalTemplateVersion(row: any): ProposalTemplateVersionResponse {
  return {
    ...mapProposalTemplateVersionSummary(row),
    content: parseTemplateContent(row.content),
  };
}

function diffTemplateContent(before: unknown, after: unknown, prefix = ""): ProposalTemplateVersionDiff[] {
  const beforeObject = before && typeof before === "object" && !Array.isArray(before) ? before as Record<string, unknown> : null;
  const afterObject = after && typeof after === "object" && !Array.isArray(after) ? after as Record<string, unknown> : null;
  if (beforeObject || afterObject) {
    const keys = new Set([...Object.keys(beforeObject || {}), ...Object.keys(afterObject || {})]);
    return [...keys].sort().flatMap((key) => diffTemplateContent(beforeObject?.[key], afterObject?.[key], prefix ? `${prefix}.${key}` : key));
  }
  const beforeJson = stableJson(before);
  const afterJson = stableJson(after);
  return beforeJson === afterJson ? [] : [{ path: prefix || "$", before: before ?? null, after: after ?? null, changed: true }];
}

function mapProposalScopeItem(row: any): ProposalScopeItem {
  return {
    libraryItemId: row.libraryItemId || null,
    libraryVersion: row.libraryVersion ? Number(row.libraryVersion) : null,
    category: row.category,
    title: row.title,
    clientDescription: row.clientDescription,
    frequency: row.frequency || null,
    quantityLimit: row.quantityLimit || null,
    treatmentsAndLocations: row.treatmentsAndLocations || null,
    dependencies: row.dependencies || null,
    clientResponsibilities: row.clientResponsibilities || null,
    exclusions: row.exclusions || null,
    thirdPartyCosts: row.thirdPartyCosts || null,
    inclusionStatus: row.inclusionStatus === "excluded" ? "excluded" : "included",
    deliveryType: row.deliveryType === "one_off" ? "one_off" : "recurring",
    isOptionalAddOn: Boolean(row.isOptionalAddOn),
    isCustom: Boolean(row.isCustom),
    changeReason: row.changeReason || null,
    approvalStatus: row.approvalStatus || "not_required",
    sortOrder: Number(row.sortOrder || 0),
  };
}

function mapProposalScopeLibraryItem(row: any): ProposalScopeLibraryItemResponse {
  return {
    ...mapProposalScopeItem(row),
    id: row.id,
    libraryItemId: row.id,
    libraryVersion: Number(row.version || 1),
    templateKey: row.templateKey,
    name: row.name || row.title,
    deliverables: parseJsonArray(row.deliverables),
    status: row.status === "archived" || row.isActive === 0 ? "archived" : "active",
    isActive: Boolean(row.isActive),
    version: Number(row.version || 1),
    createdBy: row.createdBy || null,
    updatedBy: row.updatedBy || null,
    archivedAt: row.archivedAt ? new Date(row.archivedAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function mapProposalProofAsset(row: any): ProposalProofAssetResponse {
  return {
    id: row.id,
    type: row.type as ProposalProofAssetType,
    title: row.title,
    copy: row.copy,
    mediaUrl: row.mediaUrl || null,
    sectorTags: parseJsonArray(row.sectorTags),
    sortOrder: Number(row.sortOrder || 0),
    status: row.isActive === 0 ? "archived" : "active",
    isActive: Boolean(row.isActive),
    version: Number(row.version || 1),
    createdBy: row.createdBy || null,
    updatedBy: row.updatedBy || null,
    archivedAt: row.archivedAt ? new Date(row.archivedAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function toProposalsCsv(proposals: ProposalResponse[]) {
  const headers = [
    "id",
    "contactId",
    "dealId",
    "clientAccountProfileId",
    "proposalName",
    "packageName",
    "recommendedPackageId",
    "ownerId",
    "ownerName",
    "status",
    "valueCents",
    "monthlyFeeCents",
    "setupFeeCents",
    "currency",
    "vatStatus",
    "minimumTermMonths",
    "noticePeriodDays",
    "startDate",
    "followUpAt",
    "readyAt",
    "sentAt",
    "sentToEmail",
    "sentToName",
    "sendMethod",
    "viewedAt",
    "acceptedAt",
    "wonAt",
    "lostAt",
    "lostReason",
    "objectionType",
    "expiresAt",
    "proposalUrl",
    "contactName",
    "contactEmail",
    "accountName",
    "dealTitle",
    "clientAccountName",
    "createdAt",
    "updatedAt",
  ];
  const rows = proposals.map((proposal) => [
    proposal.id,
    proposal.contactId,
    proposal.dealId,
    proposal.clientAccountProfileId,
    proposal.proposalName,
    proposal.packageName,
    proposal.recommendedPackageId,
    proposal.ownerId,
    proposal.ownerName,
    proposal.status,
    proposal.valueCents,
    proposal.monthlyFeeCents,
    proposal.setupFeeCents,
    proposal.currency,
    proposal.vatStatus,
    proposal.minimumTermMonths,
    proposal.noticePeriodDays,
    proposal.startDate,
    proposal.followUpAt,
    proposal.readyAt,
    proposal.sentAt,
    proposal.sentToEmail,
    proposal.sentToName,
    proposal.sendMethod,
    proposal.viewedAt,
    proposal.acceptedAt,
    proposal.wonAt,
    proposal.lostAt,
    proposal.lostReason,
    proposal.objectionType,
    proposal.expiresAt,
    proposal.proposalUrl,
    proposal.contactName,
    proposal.contactEmail,
    proposal.accountName,
    proposal.dealTitle,
    proposal.clientAccountName,
    proposal.createdAt,
    proposal.updatedAt,
  ]);

  return csvRows(headers, rows);
}

function proposalSelectSql() {
  return `SELECT p.id,
                 p.clinic_id as clinicId,
                 p.contact_id as contactId,
                 p.deal_id as dealId,
                 p.client_account_profile_id as clientAccountProfileId,
                 p.proposal_name as proposalName,
                 p.template_id as templateId,
                 p.template_key as templateKey,
                 p.template_version_id as templateVersionId,
                 p.template_version_number as templateVersionNumber,
                 p.template_content_hash as templateContentHash,
                 p.package_name as packageName,
                 p.recommended_package_id as recommendedPackageId,
                 p.owner_id as ownerId,
                 p.status,
                 p.value,
                 p.monthly_fee_cents as monthlyFeeCents,
                 p.setup_fee_cents as setupFeeCents,
                 p.currency,
                 p.ad_spend_note as adSpendNote,
                 p.vat_status as vatStatus,
                 p.minimum_term_months as minimumTermMonths,
                 p.notice_period_days as noticePeriodDays,
                 p.start_date as startDate,
                 p.follow_up_at as followUpAt,
                 p.ready_at as readyAt,
                 p.sent_at as sentAt,
                 p.sent_to_email as sentToEmail,
                 p.sent_to_name as sentToName,
                 p.send_method as sendMethod,
                 p.send_note as sendNote,
                 p.sent_by as sentBy,
                 p.viewed_at as viewedAt,
                 p.accepted_at as acceptedAt,
                 p.accepted_reason as acceptedReason,
                 p.won_at as wonAt,
                 p.won_reason as wonReason,
                 p.lost_at as lostAt,
                 p.lost_reason as lostReason,
                 p.objection_type as objectionType,
                 p.expires_at as expiresAt,
                 p.proposal_url as proposalUrl,
                 p.public_link_created_at as publicLinkCreatedAt,
                 p.public_last_accessed_at as publicLastAccessedAt,
                 p.notes,
                 p.add_ons as addOns,
                 p.discounts,
                 p.internal_margin_note as internalMarginNote,
                 p.section_content as sectionContent,
                 p.core_data as coreData,
                 p.v5_snapshot as v5Snapshot,
                 p.v5_snapshot_hash as v5SnapshotHash,
                 p.v5_snapshot_version as v5SnapshotVersion,
                 p.v5_snapshot_frozen_at as v5SnapshotFrozenAt,
                 p.draft_saved_at as draftSavedAt,
                 p.created_by as createdBy,
                 p.updated_by as updatedBy,
                 p.created_at as createdAt,
                 p.updated_at as updatedAt,
                 c.first_name as contactFirstName,
                 c.last_name as contactLastName,
                 c.email as contactEmail,
                 c.phone as contactPhone,
                 c.account_name as accountName,
                 d.title as dealTitle,
                 account_clinic.name as clientAccountName,
                 owner.first_name as ownerFirstName,
                 owner.last_name as ownerLastName,
                 owner.email as ownerEmail,
                 sent_by.first_name as sentByFirstName,
                 sent_by.last_name as sentByLastName,
                 sent_by.email as sentByEmail,
                 ar.id as acceptanceRecordId,
                 ar.proposal_id as acceptanceProposalId,
                 ar.contact_id as acceptanceContactId,
                 ar.deal_id as acceptanceDealId,
                 ar.client_account_profile_id as acceptanceClientAccountProfileId,
                 ar.accepted_by_name as acceptedByName,
                 ar.accepted_by_email as acceptedByEmail,
                 ar.legal_company_name as acceptanceLegalCompanyName,
                 ar.billing_email as acceptanceBillingEmail,
                 ar.preferred_start_date as acceptancePreferredStartDate,
                 ar.agreement_accepted as acceptanceAgreementAccepted,
                 ar.confirmation_text as acceptanceConfirmationText,
                 ar.acceptance_source as acceptanceSource,
                 ar.accepted_ip_address as acceptanceIpAddress,
                 ar.accepted_user_agent as acceptanceUserAgent,
                 ar.evidence_sha256 as acceptanceEvidenceSha256,
                 ar.locked_at as acceptanceLockedAt,
                 ar.accepted_at as acceptanceAcceptedAt,
                 ar.acceptance_status as acceptanceStatus,
                 ar.package_name as acceptancePackageName,
                 ar.recommended_package_id as acceptanceRecommendedPackageId,
                 ar.monthly_fee_cents as acceptanceMonthlyFeeCents,
                 ar.setup_fee_cents as acceptanceSetupFeeCents,
                 ar.currency as acceptanceCurrency,
                 ar.payment_terms as acceptancePaymentTerms,
                 ar.start_date as acceptanceStartDate,
                 ar.minimum_term_months as acceptanceMinimumTermMonths,
                 ar.notice_period_days as acceptanceNoticePeriodDays,
                 ar.scope as acceptanceScope,
                 ar.commercial_snapshot as acceptanceCommercialSnapshot,
                 ar.proposal_snapshot as acceptanceProposalSnapshot,
                 ar.core_data_snapshot as acceptanceCoreDataSnapshot,
                 ar.v5_snapshot as acceptanceV5Snapshot,
                 ar.v5_snapshot_hash as acceptanceV5SnapshotHash,
                 ar.v5_snapshot_version as acceptanceV5SnapshotVersion,
                 ar.created_at as acceptanceCreatedAt,
                 ar.updated_at as acceptanceUpdatedAt
          FROM proposal p
          LEFT JOIN contact c
            ON c.id = p.contact_id
           AND c.clinic_id = p.clinic_id
           AND c.deleted_at IS NULL
          LEFT JOIN deal d
            ON d.id = p.deal_id
           AND d.clinic_id = p.clinic_id
           AND d.deleted_at IS NULL
          LEFT JOIN client_account_profile cap
            ON cap.id = p.client_account_profile_id
          LEFT JOIN clinic account_clinic
            ON account_clinic.id = cap.clinic_id
           AND account_clinic.deleted_at IS NULL
          LEFT JOIN user owner
            ON owner.id = p.owner_id
           AND owner.deleted_at IS NULL
          LEFT JOIN user sent_by
            ON sent_by.id = p.sent_by
           AND sent_by.deleted_at IS NULL
          LEFT JOIN proposal_acceptance_record ar
            ON ar.proposal_id = p.id
           AND ar.clinic_id = p.clinic_id
           AND ar.deleted_at IS NULL`;
}

function isTruthy(value: unknown) {
  return value === true || value === "true" || value === "1" || value === 1;
}

export class ProposalsService {
  async listProofAssets(
    clinicId: string,
    query: ProposalProofAssetLibraryQuery & { includeInactive?: boolean } = {},
  ): Promise<ProposalProofAssetListResponse> {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 100)));
    const offset = (page - 1) * limit;
    const filters = ["clinic_id = ?", "deleted_at IS NULL"];
    const values: any[] = [clinicId];
    const status = cleanString(query.status);
    if (status === "archived") {
      filters.push("is_active = 0");
    } else if (status !== "all" && !query.includeInactive) {
      filters.push("is_active = 1");
    }
    const type = cleanString(query.type);
    if (type && type !== "all") {
      filters.push("type = ?");
      values.push(type);
    }
    const tag = cleanString(query.tag);
    if (tag) {
      filters.push("COALESCE(CAST(sector_tags AS CHAR), '') LIKE ?");
      values.push(`%${tag}%`);
    }
    const search = cleanString(query.search);
    if (search) {
      filters.push("(title LIKE ? OR copy LIKE ? OR COALESCE(media_url, '') LIKE ? OR COALESCE(CAST(sector_tags AS CHAR), '') LIKE ?)");
      values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    const whereSql = filters.join(" AND ");
    const [countRows]: any = await pool.execute(
      `SELECT COUNT(*) as total
       FROM proposal_proof_asset
       WHERE ${whereSql}`,
      values,
    );
    const total = Number(countRows[0]?.total || 0);
    const [rows]: any = await pool.execute(
      `SELECT id,
              type,
              title,
              copy,
              media_url as mediaUrl,
              sector_tags as sectorTags,
              sort_order as sortOrder,
              is_active as isActive,
              version,
              created_by as createdBy,
              updated_by as updatedBy,
              archived_at as archivedAt,
              created_at as createdAt,
              updated_at as updatedAt
       FROM proposal_proof_asset
       WHERE ${whereSql}
       ORDER BY sort_order ASC, title ASC
       LIMIT ${limit} OFFSET ${offset}`,
      values,
    );

    return {
      items: rows.map(mapProposalProofAsset),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async createProofAsset(
    clinicId: string,
    userId: string,
    data: ProposalProofAssetMutationDTO,
  ): Promise<ProposalProofAssetResponse> {
    const id = uuidv4();
    const sectorTags = Array.isArray(data.sectorTags)
      ? data.sectorTags.map((tag) => cleanString(tag)).filter(Boolean)
      : [];
    await pool.execute(
      `INSERT INTO proposal_proof_asset
        (id, clinic_id, type, title, copy, media_url, sector_tags, sort_order, is_active, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        data.type,
        cleanString(data.title),
        cleanString(data.copy),
        cleanString(data.mediaUrl),
        JSON.stringify(sectorTags),
        data.sortOrder ?? 0,
        data.isActive === false ? 0 : 1,
        userId,
        userId,
      ],
    );
    await logAuditEvent({
      clinicId,
      userId,
      entityType: "proposal_proof_asset",
      entityId: id,
      action: "PROPOSAL_PROOF_ASSET_CREATED",
      changes: { title: cleanString(data.title), type: data.type },
    });

    const [rows]: any = await pool.execute(
      `SELECT id,
              type,
              title,
              copy,
              media_url as mediaUrl,
              sector_tags as sectorTags,
              sort_order as sortOrder,
              is_active as isActive,
              version,
              created_by as createdBy,
              updated_by as updatedBy,
              archived_at as archivedAt,
              created_at as createdAt,
              updated_at as updatedAt
       FROM proposal_proof_asset
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [id, clinicId],
    );
    return mapProposalProofAsset(rows[0]);
  }

  async updateProofAsset(
    clinicId: string,
    userId: string,
    proofAssetId: string,
    data: Partial<ProposalProofAssetMutationDTO>,
  ): Promise<ProposalProofAssetResponse> {
    const existing = await this.getProofAsset(clinicId, proofAssetId);
    const sectorTags = Array.isArray(data.sectorTags)
      ? data.sectorTags.map((tag) => cleanString(tag)).filter(Boolean)
      : existing.sectorTags;
    const isActive = typeof data.isActive === "boolean" ? data.isActive : existing.isActive;
    await pool.execute(
      `UPDATE proposal_proof_asset
       SET type = ?,
           title = ?,
           copy = ?,
           media_url = ?,
           sector_tags = ?,
           sort_order = ?,
           is_active = ?,
           version = version + 1,
           updated_by = ?,
           archived_at = CASE WHEN ? = 1 THEN NULL ELSE COALESCE(archived_at, CURRENT_TIMESTAMP) END
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL`,
      [
        data.type || existing.type,
        cleanString(data.title) || existing.title,
        cleanString(data.copy) || existing.copy,
        data.mediaUrl === undefined ? existing.mediaUrl : cleanString(data.mediaUrl),
        JSON.stringify(sectorTags),
        data.sortOrder ?? existing.sortOrder,
        isActive ? 1 : 0,
        userId,
        isActive ? 1 : 0,
        proofAssetId,
        clinicId,
      ],
    );
    await logAuditEvent({
      clinicId,
      userId,
      entityType: "proposal_proof_asset",
      entityId: proofAssetId,
      action: "PROPOSAL_PROOF_ASSET_UPDATED",
      changes: { title: cleanString(data.title) || existing.title, previousVersion: existing.version },
    });
    return this.getProofAsset(clinicId, proofAssetId);
  }

  async setProofAssetArchived(
    clinicId: string,
    userId: string,
    proofAssetId: string,
    archived: boolean,
  ): Promise<ProposalProofAssetResponse> {
    const existing = await this.getProofAsset(clinicId, proofAssetId);
    await pool.execute(
      `UPDATE proposal_proof_asset
       SET is_active = ?,
           version = version + 1,
           updated_by = ?,
           archived_at = CASE WHEN ? = 1 THEN COALESCE(archived_at, CURRENT_TIMESTAMP) ELSE NULL END
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL`,
      [archived ? 0 : 1, userId, archived ? 1 : 0, proofAssetId, clinicId],
    );
    await logAuditEvent({
      clinicId,
      userId,
      entityType: "proposal_proof_asset",
      entityId: proofAssetId,
      action: archived ? "PROPOSAL_PROOF_ASSET_ARCHIVED" : "PROPOSAL_PROOF_ASSET_RESTORED",
      changes: { title: existing.title, previousVersion: existing.version },
    });
    return this.getProofAsset(clinicId, proofAssetId);
  }

  private async getProofAsset(clinicId: string, proofAssetId: string): Promise<ProposalProofAssetResponse> {
    const [rows]: any = await pool.execute(
      `SELECT id,
              type,
              title,
              copy,
              media_url as mediaUrl,
              sector_tags as sectorTags,
              sort_order as sortOrder,
              is_active as isActive,
              version,
              created_by as createdBy,
              updated_by as updatedBy,
              archived_at as archivedAt,
              created_at as createdAt,
              updated_at as updatedAt
       FROM proposal_proof_asset
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [proofAssetId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Proof asset not found");
    return mapProposalProofAsset(rows[0]);
  }

  private async resolveScopeLibraryTemplateKey(clinicId: string, requestedTemplateKey?: string | null) {
    const requested = cleanString(requestedTemplateKey);
    if (requested) {
      const [rows]: any = await pool.execute(
        `SELECT template_key as templateKey
         FROM proposal_template
         WHERE clinic_id = ?
           AND template_key = ?
         LIMIT 1`,
        [clinicId, requested],
      );
      if (rows[0]) return String(rows[0].templateKey);
      throw ApiError.badRequest("Scope library template key is not available for this workspace");
    }

    const [rows]: any = await pool.execute(
      `SELECT template_key as templateKey
       FROM proposal_template
       WHERE clinic_id = ?
       ORDER BY is_active DESC, sort_order ASC, name ASC
       LIMIT 1`,
      [clinicId],
    );
    if (!rows[0]) throw ApiError.badRequest("Create a proposal template before adding scope library items");
    return String(rows[0].templateKey);
  }

  private scopeLibrarySelectSql() {
    return `SELECT id,
                   template_key as templateKey,
                   title as name,
                   category,
                   title,
                   client_description as clientDescription,
                   deliverables,
                   frequency,
                   quantity_limit as quantityLimit,
                   inclusion_status as inclusionStatus,
                   delivery_type as deliveryType,
                   is_optional_add_on as isOptionalAddOn,
                   internal_notes as internalNotes,
                   sort_order as sortOrder,
                   is_active as isActive,
                   status,
                   version,
                   created_by as createdBy,
                   updated_by as updatedBy,
                   archived_at as archivedAt,
                   created_at as createdAt,
                   updated_at as updatedAt
            FROM proposal_scope_item`;
  }

  async listScopeLibraryItems(
    clinicId: string,
    query: ProposalScopeLibraryQuery = {},
  ): Promise<ProposalScopeLibraryListResponse> {
    const filters: string[] = ["clinic_id = ?"];
    const values: unknown[] = [clinicId];
    const status = cleanString(query.status) || "active";
    if (status !== "all") {
      filters.push("status = ?");
      values.push(status === "archived" ? "archived" : "active");
    }
    const category = cleanString(query.category);
    if (category) {
      filters.push("category = ?");
      values.push(category);
    }
    const templateKey = cleanString(query.templateKey);
    if (templateKey) {
      filters.push("template_key = ?");
      values.push(templateKey);
    }
    const search = cleanString(query.search);
    if (search) {
      filters.push("(title LIKE ? OR client_description LIKE ? OR COALESCE(CAST(deliverables AS CHAR), '') LIKE ?)");
      values.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
    const offset = (page - 1) * limit;

    const where = filters.join(" AND ");
    const [countRows]: any = await pool.execute(
      `SELECT COUNT(*) as total FROM proposal_scope_item WHERE ${where}`,
      values as any[],
    );
    const total = Number(countRows[0]?.total || 0);
    const [rows]: any = await pool.execute(
      `${this.scopeLibrarySelectSql()}
       WHERE ${where}
       ORDER BY sort_order ASC, category ASC, title ASC
       LIMIT ${limit} OFFSET ${offset}`,
      values as any[],
    );

    return {
      items: rows.map(mapProposalScopeLibraryItem),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async createScopeLibraryItem(
    clinicId: string,
    userId: string,
    data: ProposalScopeLibraryItemMutationDTO,
  ): Promise<ProposalScopeLibraryItemResponse> {
    const templateKey = await this.resolveScopeLibraryTemplateKey(clinicId, data.templateKey);
    const name = cleanString(data.name);
    const category = cleanString(data.category);
    const description = cleanString(data.clientDescription || data.description);
    if (!name || !category || !description) {
      throw ApiError.badRequest("Scope library name, category and description are required");
    }
    const [duplicates]: any = await pool.execute(
      `SELECT id FROM proposal_scope_item
       WHERE clinic_id = ?
         AND template_key = ?
         AND LOWER(category) = LOWER(?)
         AND LOWER(title) = LOWER(?)
         AND status = 'active'
       LIMIT 1`,
      [clinicId, templateKey, category, name],
    );
    if (duplicates[0]) throw ApiError.conflict("An active scope library item with this name already exists");

    const id = uuidv4();
    const deliverables = Array.isArray(data.deliverables)
      ? data.deliverables.map((item) => cleanString(item)).filter(Boolean)
      : [];
    await pool.execute(
      `INSERT INTO proposal_scope_item
        (id, clinic_id, template_key, category, title, client_description, deliverables, frequency, quantity_limit,
         inclusion_status, delivery_type, is_optional_add_on, internal_notes, sort_order, is_active, status,
         version, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'active', 1, ?, ?)`,
      [
        id,
        clinicId,
        templateKey,
        category,
        name,
        description,
        JSON.stringify(deliverables),
        cleanString(data.frequency),
        cleanString(data.quantityLimit),
        data.inclusionStatus === "excluded" ? "excluded" : "included",
        data.deliveryType === "one_off" ? "one_off" : "recurring",
        data.isOptionalAddOn ? 1 : 0,
        cleanString([
          data.treatmentsAndLocations ? `Treatments/locations: ${data.treatmentsAndLocations}` : "",
          data.dependencies ? `Dependencies: ${data.dependencies}` : "",
          data.clientResponsibilities ? `Client responsibilities: ${data.clientResponsibilities}` : "",
          data.exclusions ? `Exclusions: ${data.exclusions}` : "",
          data.thirdPartyCosts ? `Third-party costs: ${data.thirdPartyCosts}` : "",
        ].filter(Boolean).join("\n")),
        data.sortOrder ?? 0,
        userId,
        userId,
      ],
    );
    await logAuditEvent({
      clinicId,
      userId,
      action: "PROPOSAL_SCOPE_LIBRARY_ITEM_CREATED",
      entityType: "proposal_scope_item",
      entityId: id,
      changes: { name, category, templateKey },
    });
    return this.getScopeLibraryItem(clinicId, id);
  }

  async updateScopeLibraryItem(
    clinicId: string,
    userId: string,
    itemId: string,
    data: ProposalScopeLibraryItemMutationDTO,
  ): Promise<ProposalScopeLibraryItemResponse> {
    const existing = await this.getScopeLibraryItem(clinicId, itemId);
    const templateKey = data.templateKey !== undefined
      ? await this.resolveScopeLibraryTemplateKey(clinicId, data.templateKey)
      : existing.templateKey;
    const name = cleanString(data.name) || existing.name;
    const category = cleanString(data.category) || existing.category;
    const description = cleanString(data.clientDescription || data.description) || existing.clientDescription;
    const deliverables = data.deliverables !== undefined
      ? (data.deliverables || []).map((item) => cleanString(item)).filter(Boolean)
      : existing.deliverables;
    const [duplicates]: any = await pool.execute(
      `SELECT id FROM proposal_scope_item
       WHERE clinic_id = ?
         AND id <> ?
         AND template_key = ?
         AND LOWER(category) = LOWER(?)
         AND LOWER(title) = LOWER(?)
         AND status = 'active'
       LIMIT 1`,
      [clinicId, itemId, templateKey, category, name],
    );
    if (duplicates[0]) throw ApiError.conflict("An active scope library item with this name already exists");

    await pool.execute(
      `UPDATE proposal_scope_item
       SET template_key = ?,
           category = ?,
           title = ?,
           client_description = ?,
           deliverables = ?,
           frequency = ?,
           quantity_limit = ?,
           inclusion_status = ?,
           delivery_type = ?,
           is_optional_add_on = ?,
           internal_notes = ?,
           sort_order = ?,
           updated_by = ?,
           version = version + 1
       WHERE id = ?
         AND clinic_id = ?`,
      [
        templateKey,
        category,
        name,
        description,
        JSON.stringify(deliverables),
        data.frequency !== undefined ? cleanString(data.frequency) : existing.frequency,
        data.quantityLimit !== undefined ? cleanString(data.quantityLimit) : existing.quantityLimit,
        data.inclusionStatus === "excluded" ? "excluded" : existing.inclusionStatus,
        data.deliveryType === "one_off" ? "one_off" : existing.deliveryType,
        data.isOptionalAddOn !== undefined ? (data.isOptionalAddOn ? 1 : 0) : existing.isOptionalAddOn ? 1 : 0,
        cleanString([
          data.treatmentsAndLocations ? `Treatments/locations: ${data.treatmentsAndLocations}` : "",
          data.dependencies ? `Dependencies: ${data.dependencies}` : "",
          data.clientResponsibilities ? `Client responsibilities: ${data.clientResponsibilities}` : "",
          data.exclusions ? `Exclusions: ${data.exclusions}` : "",
          data.thirdPartyCosts ? `Third-party costs: ${data.thirdPartyCosts}` : "",
        ].filter(Boolean).join("\n")),
        data.sortOrder ?? existing.sortOrder,
        userId,
        itemId,
        clinicId,
      ] as any[],
    );
    await logAuditEvent({
      clinicId,
      userId,
      action: "PROPOSAL_SCOPE_LIBRARY_ITEM_UPDATED",
      entityType: "proposal_scope_item",
      entityId: itemId,
      changes: { name, category, templateKey, previousVersion: existing.version },
    });
    return this.getScopeLibraryItem(clinicId, itemId);
  }

  async setScopeLibraryItemArchived(
    clinicId: string,
    userId: string,
    itemId: string,
    archived: boolean,
  ): Promise<ProposalScopeLibraryItemResponse> {
    const existing = await this.getScopeLibraryItem(clinicId, itemId);
    await pool.execute(
      `UPDATE proposal_scope_item
       SET status = ?,
           is_active = ?,
           archived_at = ?,
           updated_by = ?,
           version = version + 1
       WHERE id = ?
         AND clinic_id = ?`,
      [archived ? "archived" : "active", archived ? 0 : 1, archived ? new Date() : null, userId, itemId, clinicId],
    );
    await logAuditEvent({
      clinicId,
      userId,
      action: archived ? "PROPOSAL_SCOPE_LIBRARY_ITEM_ARCHIVED" : "PROPOSAL_SCOPE_LIBRARY_ITEM_RESTORED",
      entityType: "proposal_scope_item",
      entityId: itemId,
      changes: { previousStatus: existing.status, status: archived ? "archived" : "active" },
    });
    return this.getScopeLibraryItem(clinicId, itemId);
  }

  private async getScopeLibraryItem(clinicId: string, itemId: string): Promise<ProposalScopeLibraryItemResponse> {
    const [rows]: any = await pool.execute(
      `${this.scopeLibrarySelectSql()}
       WHERE id = ?
         AND clinic_id = ?
       LIMIT 1`,
      [itemId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Scope library item not found");
    return mapProposalScopeLibraryItem(rows[0]);
  }

  async listProposalTemplates(clinicId: string, includeInactive = false): Promise<ProposalTemplateResponse[]> {
    const templateFilters = includeInactive ? "" : "AND proposal_template.is_active = 1";
    const scopeFilters = includeInactive ? "" : "AND is_active = 1";
    const [rows]: any = await pool.execute(
      `SELECT proposal_template.id,
              proposal_template.template_key as templateKey,
              proposal_template.name,
              proposal_template.description,
              proposal_template.package_name as packageName,
              proposal_template.default_sections as defaultSections,
              proposal_template.default_roadmap as defaultRoadmap,
              proposal_template.default_terms as defaultTerms,
              proposal_template.default_success_metrics as defaultSuccessMetrics,
              proposal_template.sort_order as sortOrder,
              proposal_template.is_active as isActive,
              proposal_template.created_at as createdAt,
              proposal_template.updated_at as updatedAt,
              active_version.id as activeVersionId,
              active_version.template_id as activeVersionTemplateId,
              active_version.template_key as activeVersionTemplateKey,
              active_version.version_number as activeVersionVersionNumber,
              active_version.status as activeVersionStatus,
              active_version.content_hash as activeVersionContentHash,
              active_version.source_version_id as activeVersionSourceVersionId,
              active_version.created_by as activeVersionCreatedBy,
              active_creator.first_name as activeVersionCreatedByFirstName,
              active_creator.last_name as activeVersionCreatedByLastName,
              active_creator.email as activeVersionCreatedByEmail,
              active_version.submitted_by as activeVersionSubmittedBy,
              active_version.approved_by as activeVersionApprovedBy,
              active_version.rejected_by as activeVersionRejectedBy,
              active_version.published_by as activeVersionPublishedBy,
              active_version.created_at as activeVersionCreatedAt,
              active_version.updated_at as activeVersionUpdatedAt,
              active_version.submitted_at as activeVersionSubmittedAt,
              active_version.approved_at as activeVersionApprovedAt,
              active_version.rejected_at as activeVersionRejectedAt,
              active_version.published_at as activeVersionPublishedAt,
              active_version.superseded_at as activeVersionSupersededAt,
              active_version.rejection_reason as activeVersionRejectionReason,
              active_version.change_summary as activeVersionChangeSummary
       FROM proposal_template
       LEFT JOIN proposal_template_version active_version
         ON active_version.template_id = proposal_template.id
        AND active_version.clinic_id = proposal_template.clinic_id
        AND active_version.status = 'published'
       LEFT JOIN user active_creator
         ON active_creator.id = active_version.created_by
       WHERE proposal_template.clinic_id = ?
         ${templateFilters}
       ORDER BY proposal_template.sort_order ASC, proposal_template.name ASC`,
      [clinicId],
    );

    const templates: ProposalTemplateResponse[] = rows.map(mapProposalTemplate);
    if (templates.length === 0) return templates;

    const [scopeRows]: any = await pool.execute(
      `SELECT template_key as templateKey,
              category,
              title,
              client_description as clientDescription,
              frequency,
              quantity_limit as quantityLimit,
              inclusion_status as inclusionStatus,
              delivery_type as deliveryType,
              is_optional_add_on as isOptionalAddOn,
              sort_order as sortOrder
       FROM proposal_scope_item
       WHERE clinic_id = ?
         ${scopeFilters}
       ORDER BY template_key ASC, sort_order ASC, title ASC`,
      [clinicId],
    );
    const scopeByTemplate = new Map<string, ProposalScopeItem[]>();
    for (const row of scopeRows) {
      const templateKey = String(row.templateKey || "");
      const items = scopeByTemplate.get(templateKey) || [];
      items.push(mapProposalScopeItem(row));
      scopeByTemplate.set(templateKey, items);
    }

    return templates.map((template) => ({
      ...template,
      defaultScopeItems: scopeByTemplate.get(template.templateKey) || [],
    }));
  }

  async createProposalTemplate(
    clinicId: string,
    userId: string,
    data: ProposalTemplateMutationDTO,
  ): Promise<ProposalTemplateResponse> {
    const templateKey = cleanString(data.templateKey)?.replace(/[^a-zA-Z0-9_:-]/g, "_").slice(0, 100);
    const content = normalizeTemplateContent(data.content || {
      name: cleanString(data.name),
      description: cleanString(data.description),
    });
    const id = uuidv4();
    const key = templateKey || `custom_template_${id.slice(0, 8)}`;
    const templateName = cleanString(content.name);
    if (!templateName) throw ApiError.badRequest("Template name is required");
    const templateInsertValues: any[] = [
      id,
      clinicId,
      key,
      templateName,
      content.description || null,
      content.packageName ?? null,
      JSON.stringify(content.defaultSections || {}),
      JSON.stringify(content.defaultRoadmap || []),
      content.defaultTerms ?? null,
      JSON.stringify(content.defaultSuccessMetrics || []),
    ];
    await this.withTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO proposal_template
          (id, clinic_id, template_key, name, description, package_name, default_sections,
           default_roadmap, default_terms, default_success_metrics, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100, 1)`,
        templateInsertValues,
      );
      await this.insertTemplateVersion(connection, {
        clinicId,
        templateId: id,
        templateKey: key,
        versionNumber: 1,
        content,
        status: "draft",
        userId,
        sourceVersionId: null,
        changeSummary: cleanString(data.changeSummary) || "Initial draft template version.",
      });
    });
    await this.logTemplateAudit(clinicId, userId, "PROPOSAL_TEMPLATE_CREATED", id, { templateKey: key });
    return this.getProposalTemplate(clinicId, id);
  }

  async listTemplateVersions(clinicId: string, templateId: string): Promise<ProposalTemplateVersionResponse[]> {
    const [rows]: any = await pool.execute(
      `${this.templateVersionSelectSql()}
       WHERE v.clinic_id = ?
         AND v.template_id = ?
       ORDER BY v.version_number DESC`,
      [clinicId, templateId],
    );
    return rows.map(mapProposalTemplateVersion);
  }

  async createTemplateDraftVersion(
    clinicId: string,
    userId: string,
    templateId: string,
    data: ProposalTemplateVersionMutationDTO = {},
  ): Promise<ProposalTemplateVersionResponse> {
    const template = await this.getProposalTemplate(clinicId, templateId);
    const source = await this.getLatestTemplateSourceVersion(clinicId, templateId);
    const baseContent = source?.content || templateContentFromTemplateRow(template);
    const content = normalizeTemplateContent(data.content || {}, baseContent);
    const nextVersionNumber = await this.nextTemplateVersionNumber(clinicId, template.templateKey);
    const version = await this.withTransaction(async (connection) => {
      const versionId = await this.insertTemplateVersion(connection, {
        clinicId,
        templateId,
        templateKey: template.templateKey,
        versionNumber: nextVersionNumber,
        content,
        status: "draft",
        userId,
        sourceVersionId: source?.id || null,
        changeSummary: cleanString(data.changeSummary) || "Draft created from the current template version.",
      });
      return this.getTemplateVersionById(clinicId, versionId, connection);
    });
    await this.logTemplateAudit(clinicId, userId, "PROPOSAL_TEMPLATE_VERSION_CREATED", version.id, {
      templateId,
      templateKey: template.templateKey,
      versionNumber: version.versionNumber,
      sourceVersionId: source?.id || null,
    });
    return version;
  }

  async updateTemplateDraftVersion(
    clinicId: string,
    userId: string,
    templateId: string,
    versionId: string,
    data: ProposalTemplateVersionMutationDTO,
  ): Promise<ProposalTemplateVersionResponse> {
    const existing = await this.getTemplateVersionById(clinicId, versionId);
    if (existing.templateId !== templateId) throw ApiError.notFound("Template version not found");
    if (existing.status !== "draft") {
      throw ApiError.conflict("Only draft template versions can be edited. Create a new draft version for approved or published content.");
    }
    if (data.expectedContentHash && data.expectedContentHash !== existing.contentHash) {
      throw ApiError.conflict("Template version changed while you were editing. Refresh before saving.");
    }
    const content = normalizeTemplateContent(data.content || {}, existing.content);
    const contentHash = hashTemplateContent(content);
    await pool.execute(
      `UPDATE proposal_template_version
       SET content = ?,
           content_hash = ?,
           change_summary = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?
         AND template_id = ?
         AND status = 'draft'`,
      [
        JSON.stringify(content),
        contentHash,
        cleanString(data.changeSummary) || existing.changeSummary,
        versionId,
        clinicId,
        templateId,
      ],
    );
    await this.logTemplateAudit(clinicId, userId, "PROPOSAL_TEMPLATE_VERSION_UPDATED", versionId, {
      templateId,
      versionNumber: existing.versionNumber,
      contentHash,
    });
    return this.getTemplateVersionById(clinicId, versionId);
  }

  async submitTemplateVersion(clinicId: string, userId: string, templateId: string, versionId: string) {
    return this.transitionTemplateVersion(clinicId, userId, templateId, versionId, "submit");
  }

  async approveTemplateVersion(clinicId: string, userId: string, templateId: string, versionId: string) {
    return this.transitionTemplateVersion(clinicId, userId, templateId, versionId, "approve");
  }

  async rejectTemplateVersion(
    clinicId: string,
    userId: string,
    templateId: string,
    versionId: string,
    data: ProposalTemplateRejectDTO,
  ) {
    const reason = cleanString(data.reason);
    if (!reason) throw ApiError.badRequest("Rejection reason is required");
    return this.transitionTemplateVersion(clinicId, userId, templateId, versionId, "reject", reason);
  }

  async publishTemplateVersion(clinicId: string, userId: string, templateId: string, versionId: string) {
    const version = await this.getTemplateVersionById(clinicId, versionId);
    if (version.templateId !== templateId) throw ApiError.notFound("Template version not found");
    if (version.status !== "approved") throw ApiError.conflict("Only approved template versions can be published");
    await this.withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE proposal_template_version
         SET status = 'superseded',
             superseded_at = CURRENT_TIMESTAMP,
             superseded_by_version_id = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE clinic_id = ?
           AND template_key = ?
           AND status = 'published'
           AND id <> ?`,
        [versionId, clinicId, version.templateKey, versionId],
      );
      const [result]: any = await connection.execute(
        `UPDATE proposal_template_version
         SET status = 'published',
             published_by = ?,
             published_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND clinic_id = ?
           AND template_id = ?
           AND status = 'approved'`,
        [userId, versionId, clinicId, templateId],
      );
      if (Number(result.affectedRows || 0) !== 1) throw ApiError.conflict("Template version could not be published");
      await this.syncTemplateLibraryFromVersion(connection, versionId, clinicId);
    });
    await this.logTemplateAudit(clinicId, userId, "PROPOSAL_TEMPLATE_VERSION_PUBLISHED", versionId, {
      templateId,
      templateKey: version.templateKey,
      versionNumber: version.versionNumber,
    });
    return this.getTemplateVersionById(clinicId, versionId);
  }

  async rollbackTemplateVersion(
    clinicId: string,
    userId: string,
    templateId: string,
    data: ProposalTemplateRollbackDTO,
  ): Promise<ProposalTemplateVersionResponse> {
    const sourceVersionId = cleanString(data.sourceVersionId);
    if (!sourceVersionId) throw ApiError.badRequest("Rollback source version is required");
    const source = await this.getTemplateVersionById(clinicId, sourceVersionId);
    if (source.templateId !== templateId) throw ApiError.notFound("Rollback source version not found");
    if (!["approved", "published", "superseded"].includes(source.status)) {
      throw ApiError.conflict("Rollback source must be an approved or previously published version");
    }
    const template = await this.getProposalTemplate(clinicId, templateId);
    const nextVersionNumber = await this.nextTemplateVersionNumber(clinicId, template.templateKey);
    let created: ProposalTemplateVersionResponse;
    await this.withTransaction(async (connection) => {
      const versionId = await this.insertTemplateVersion(connection, {
        clinicId,
        templateId,
        templateKey: template.templateKey,
        versionNumber: nextVersionNumber,
        content: source.content,
        status: "published",
        userId,
        sourceVersionId: source.id,
        changeSummary: cleanString(data.reason) || `Rollback to version ${source.versionNumber}.`,
      });
      await connection.execute(
        `UPDATE proposal_template_version
         SET status = 'superseded',
             superseded_at = CURRENT_TIMESTAMP,
             superseded_by_version_id = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE clinic_id = ?
           AND template_key = ?
           AND status = 'published'
           AND id <> ?`,
        [versionId, clinicId, template.templateKey, versionId],
      );
      await connection.execute(
        `UPDATE proposal_template_version
         SET submitted_by = ?, submitted_at = CURRENT_TIMESTAMP,
             approved_by = ?, approved_at = CURRENT_TIMESTAMP,
             published_by = ?, published_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND clinic_id = ?`,
        [userId, userId, userId, versionId, clinicId],
      );
      await this.syncTemplateLibraryFromVersion(connection, versionId, clinicId);
      created = await this.getTemplateVersionById(clinicId, versionId, connection);
    });
    await this.logTemplateAudit(clinicId, userId, "PROPOSAL_TEMPLATE_VERSION_ROLLED_BACK", created!.id, {
      templateId,
      templateKey: template.templateKey,
      versionNumber: created!.versionNumber,
      sourceVersionId: source.id,
      sourceVersionNumber: source.versionNumber,
    });
    return created!;
  }

  async compareTemplateVersions(
    clinicId: string,
    templateId: string,
    fromVersionId: string,
    toVersionId: string,
  ): Promise<ProposalTemplateVersionCompareResponse> {
    const fromVersion = await this.getTemplateVersionById(clinicId, fromVersionId);
    const toVersion = await this.getTemplateVersionById(clinicId, toVersionId);
    if (fromVersion.templateId !== templateId || toVersion.templateId !== templateId) {
      throw ApiError.notFound("Template versions not found");
    }
    return {
      fromVersion,
      toVersion,
      diffs: diffTemplateContent(fromVersion.content, toVersion.content),
    };
  }

  async listProposals(clinicId: string, query: ProposalListQuery = {}): Promise<ProposalResponse[]> {
    const where = ["p.clinic_id = ?"];
    const values: any[] = [clinicId];

    if (!isTruthy(query.includeArchived)) where.push("p.deleted_at IS NULL", "p.status <> 'archived'");
    if (query.contactId) {
      where.push("p.contact_id = ?");
      values.push(query.contactId);
    }
    if (query.dealId) {
      where.push("p.deal_id = ?");
      values.push(query.dealId);
    }
    if (query.clientAccountProfileId) {
      where.push("p.client_account_profile_id = ?");
      values.push(query.clientAccountProfileId);
    }
    if (query.ownerId) {
      where.push("p.owner_id = ?");
      values.push(query.ownerId);
    }
    if (query.status && query.status !== "all") {
      where.push("p.status = ?");
      values.push(query.status);
    }
    if (isTruthy(query.followUpDue)) {
      where.push("p.follow_up_at IS NOT NULL", "p.follow_up_at <= CURRENT_TIMESTAMP", "p.status NOT IN ('won', 'lost', 'expired', 'archived')");
    }
    const search = cleanString(query.search);
    if (search) {
      where.push(`(
        p.proposal_name LIKE ?
        OR p.package_name LIKE ?
        OR p.status LIKE ?
        OR c.first_name LIKE ?
        OR c.last_name LIKE ?
        OR c.email LIKE ?
        OR c.account_name LIKE ?
        OR d.title LIKE ?
        OR account_clinic.name LIKE ?
      )`);
      const like = `%${search}%`;
      values.push(like, like, like, like, like, like, like, like, like);
    }

    const maxLimit = isTruthy((query as any).exportAll) ? 5000 : 250;
    const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || 100));
    const [rows]: any = await pool.execute(
      `${proposalSelectSql()}
       WHERE ${where.join(" AND ")}
       ORDER BY
         CASE WHEN p.follow_up_at IS NULL THEN 1 ELSE 0 END,
         p.follow_up_at ASC,
         p.updated_at DESC
       LIMIT ${limit}`,
      values,
    );

    return rows.map(mapProposal);
  }

  async exportProposalsCsv(clinicId: string, query: ProposalListQuery = {}): Promise<string> {
    const proposals = await this.listProposals(clinicId, {
      ...query,
      includeArchived: query.includeArchived ?? true,
      limit: 5000,
      exportAll: true,
    } as ProposalListQuery);
    return toProposalsCsv(proposals);
  }

  async listProposalRenderArchive(
    clinicId: string,
    query: ProposalRenderArchiveQuery = {},
  ) {
    const where = ["clinic_id = ?"];
    const values: any[] = [clinicId];

    const proposalId = cleanString(query.proposalId);
    if (proposalId) {
      where.push("proposal_id = ?");
      values.push(proposalId);
    }

    const clientAccountProfileId = cleanString(query.clientAccountProfileId);
    if (clientAccountProfileId) {
      where.push("client_account_profile_id = ?");
      values.push(clientAccountProfileId);
    }

    const search = cleanString(query.search);
    if (search) {
      where.push(`(
        proposal_reference LIKE ?
        OR proposal_name LIKE ?
        OR client_name LIKE ?
        OR package_name LIKE ?
        OR snapshot_hash LIKE ?
        OR source_proposal_version LIKE ?
      )`);
      const like = `%${search}%`;
      values.push(like, like, like, like, like, like);
    }

    const limit = Math.min(250, Math.max(1, Number(query.limit) || 100));
    const [rows]: any = await pool.execute(
      `SELECT
          id,
          proposal_id as proposalId,
          contact_id as contactId,
          deal_id as dealId,
          client_account_profile_id as clientAccountProfileId,
          artifact_type as artifactType,
          status,
          proposal_reference as proposalReference,
          proposal_name as proposalName,
          client_name as clientName,
          package_name as packageName,
          public_url as publicUrl,
          print_url as printUrl,
          snapshot_hash as snapshotHash,
          snapshot_version as snapshotVersion,
          source_proposal_version as sourceProposalVersion,
          template_version_id as templateVersionId,
          template_content_hash as templateContentHash,
          page_count as pageCount,
          content_fingerprint as contentFingerprint,
          created_by as createdBy,
          created_at as createdAt
       FROM proposal_render_archive
       WHERE ${where.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT ${limit}`,
      values,
    );
    return rows.map(mapProposalRenderArchive);
  }

  async getProposal(
    clinicId: string,
    proposalId: string,
    executor: QueryExecutor = pool,
  ): Promise<ProposalResponse> {
    const [rows]: any = await executor.execute(
      `${proposalSelectSql()}
       WHERE p.id = ?
         AND p.clinic_id = ?
         AND p.deleted_at IS NULL
       LIMIT 1`,
      [proposalId, clinicId],
    );
    if (rows.length === 0) throw ApiError.notFound("Proposal not found");
    return this.hydrateSelectedProofAssets(clinicId, mapProposal(rows[0]), executor);
  }

  async validateProposalForClientUse(
    clinicId: string,
    proposalId: string,
  ): Promise<ProposalClientReadinessResponse> {
    const proposal = await this.getProposal(clinicId, proposalId);
    let approvedPackage: Awaited<ReturnType<ProposalsService["resolveRecommendedPackage"]>> | null = null;
    const issues: string[] = [];

    try {
      approvedPackage = await this.resolveRecommendedPackage(clinicId, proposal.recommendedPackageId);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 400) {
        issues.push(error.message);
      } else {
        throw error;
      }
    }
    try {
      await this.assertProposalTemplateVersionSendable(clinicId, proposal);
    } catch (error) {
      if (error instanceof ApiError && [400, 409].includes(error.statusCode)) {
        issues.push(error.message);
      } else {
        throw error;
      }
    }

    issues.push(...this.collectClientReadyIssues({
      ...proposal,
      status: "sent",
      contactName: proposal.contactName,
      approvedPackagePriceCents: approvedPackage?.priceCents ?? null,
      approvedPackageSetupFeeCents: approvedPackage?.setupFeeCents ?? null,
      approvedPackageBillingFrequency: approvedPackage?.billingFrequency ?? null,
    }));

    const frozen = Boolean(
      proposal.v5Snapshot ||
      proposal.v5SnapshotHash ||
      proposal.v5SnapshotVersion ||
      proposal.v5SnapshotFrozenAt
    );
    let canRenderV5 = false;
    let pageCount: number | null = proposal.v5Snapshot?.pageCount ?? null;
    if (!issues.length) {
      if (proposal.v5Snapshot) {
        try {
          assertProposalV5SnapshotReady(proposal.v5Snapshot);
          canRenderV5 = true;
        } catch (error) {
          issues.push(error instanceof Error ? error.message : "Frozen V5 snapshot is not renderable");
        }
      } else if (frozen) {
        issues.push("Frozen V5 snapshot is not renderable with the current proposal renderer");
      } else {
        try {
          const previewSnapshot = buildProposalV5Snapshot({
            proposal,
            packageRecord: approvedPackage,
            generatedAt: proposal.updatedAt || proposal.createdAt,
            sourceProposalVersion: `${proposal.id}:${proposal.updatedAt || proposal.createdAt}`,
            acceptanceUrl: proposal.proposalUrl ? buildAcceptanceUrl(proposal.proposalUrl) : null,
            questionUrl: `mailto:hello@clinicgrower.co.uk?subject=${encodeURIComponent(`Question about ${proposal.proposalName}`)}`,
          });
          pageCount = previewSnapshot.pageCount;
          canRenderV5 = true;
        } catch (error) {
          issues.push(error instanceof Error ? error.message : "Proposal V5 snapshot could not be rendered");
        }
      }
    }

    return {
      proposalId,
      ready: issues.length === 0,
      status: proposal.status,
      frozen,
      canRenderV5,
      pageCount,
      packageId: approvedPackage?.id || proposal.recommendedPackageId || null,
      issues,
    };
  }

  async approveProposalForClientUse(
    clinicId: string,
    userId: string,
    proposalId: string,
    access: ProposalLinkAccess,
  ): Promise<ProposalResponse> {
    const validation = await this.validateProposalForClientUse(clinicId, proposalId);
    if (!validation.ready) {
      throw ApiError.badRequest("Proposal is not ready for approval.", { issues: validation.issues });
    }
    const proposal = await this.getProposal(clinicId, proposalId);
    if (isFinalProposalStatus(proposal.status)) {
      throw ApiError.conflict(`This ${proposal.status.replace(/_/g, " ")} proposal cannot be approved again.`);
    }
    if (validation.frozen) {
      throw ApiError.conflict("This V5 proposal version is already frozen. Create a new proposal version before approving changes.");
    }
    if (proposal.status === "ready") return proposal;
    return this.updateProposal(clinicId, userId, proposalId, { status: "ready" }, access);
  }

  async lockProposalVersion(
    clinicId: string,
    userId: string,
    proposalId: string,
    data: ProposalSendDTO,
  ): Promise<ProposalResponse> {
    return this.markProposalSent(clinicId, userId, proposalId, {
      ...data,
      sendMethod: cleanString(data.sendMethod) || "version_lock",
      sendNote:
        cleanString(data.sendNote) ||
        "Version locked from Mission Control proposal lifecycle API.",
    });
  }

  async renderProposal(
    clinicId: string,
    proposalId: string,
  ): Promise<ProposalRenderResponse> {
    const proposal = await this.getProposal(clinicId, proposalId);
    const validation = await this.validateProposalForClientUse(clinicId, proposalId);
    if (proposal.v5Snapshot) {
      return {
        proposal,
        v5Snapshot: proposal.v5Snapshot,
        frozen: validation.frozen,
        validation,
      };
    }
    if (validation.frozen) {
      return {
        proposal,
        v5Snapshot: null,
        frozen: true,
        validation,
      };
    }
    if (!validation.ready) {
      return {
        proposal,
        v5Snapshot: null,
        frozen: false,
        validation,
      };
    }
    const approvedPackage = await this.resolveRecommendedPackage(clinicId, proposal.recommendedPackageId);
    const v5Snapshot = buildProposalV5Snapshot({
      proposal,
      packageRecord: approvedPackage,
      generatedAt: proposal.updatedAt || proposal.createdAt,
      sourceProposalVersion: `${proposal.id}:${proposal.updatedAt || proposal.createdAt}`,
      acceptanceUrl: proposal.proposalUrl ? buildAcceptanceUrl(proposal.proposalUrl) : null,
      questionUrl: `mailto:hello@clinicgrower.co.uk?subject=${encodeURIComponent(`Question about ${proposal.proposalName}`)}`,
    });
    return {
      proposal,
      v5Snapshot,
      frozen: false,
      validation,
    };
  }

  private async ensureProposalV5PrintArchive(
    executor: QueryExecutor,
    clinicId: string,
    userId: string,
    proposal: ProposalResponse,
    snapshot: {
      snapshotHash: string;
      sourceProposalVersion?: string | null;
      pageCount: number;
      proposal: { reference: string };
      selectedPackage: { name?: string | null };
      clinic: { name: { value?: string | null } };
    },
    proposalUrl: string | null,
  ) {
    const artifactType = "v5_print_pdf" as const;
    const printUrl = `/app/crm/proposals/v5-print-preview?proposalId=${encodeURIComponent(proposal.id)}`;
    const snapshotVersion = proposalV5SnapshotVersion;
    const contentFingerprint = buildProposalV5PrintArchiveFingerprint({
      proposalId: proposal.id,
      artifactType,
      snapshotHash: snapshot.snapshotHash,
      snapshotVersion,
      sourceProposalVersion: snapshot.sourceProposalVersion || null,
      pageCount: snapshot.pageCount,
      publicUrl: proposalUrl,
      printUrl,
    });
    const clientName =
      cleanString(proposal.clientAccountName) ||
      cleanString(proposal.accountName) ||
      cleanString(proposal.contactName) ||
      cleanString(snapshot.clinic.name.value);

    await executor.execute(
      `INSERT INTO proposal_render_archive
        (id, clinic_id, proposal_id, contact_id, deal_id, client_account_profile_id,
         artifact_type, status, proposal_reference, proposal_name, client_name,
         package_name, public_url, print_url, snapshot_hash, snapshot_version,
         source_proposal_version, template_version_id, template_content_hash,
         page_count, content_fingerprint, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [
        uuidv4(),
        clinicId,
        proposal.id,
        proposal.contactId,
        proposal.dealId,
        proposal.clientAccountProfileId,
        artifactType,
        snapshot.proposal.reference,
        proposal.proposalName,
        clientName,
        proposal.packageName || snapshot.selectedPackage.name || null,
        proposalUrl,
        printUrl,
        snapshot.snapshotHash,
        snapshotVersion,
        snapshot.sourceProposalVersion || null,
        proposal.templateVersionId,
        proposal.templateContentHash,
        snapshot.pageCount,
        contentFingerprint,
        userId,
      ],
    );
  }

  async createProposalShare(clinicId: string, userId: string, proposalId: string): Promise<ProposalShareResponse> {
    const proposal = await this.getProposal(clinicId, proposalId);
    if (proposal.status === "archived") throw ApiError.notFound("Proposal not found");
    if (!isProposalPubliclyVisible(proposal.status, proposal.expiresAt)) {
      throw ApiError.badRequest("Only active client-facing proposals can be shared");
    }
    if (isProposalV5Proposal(proposal)) {
      if (proposal.v5Snapshot && proposal.proposalUrl) {
        return {
          proposalId,
          proposalUrl: proposal.proposalUrl,
          createdAt: proposal.v5SnapshotFrozenAt || proposal.sentAt || new Date().toISOString(),
        };
      }
      throw ApiError.badRequest("V5 proposals are shared when they are sent so the frozen proposal version is attached.");
    }

    const rawToken = generateResetToken();
    const tokenHash = hashToken(rawToken);
    const proposalUrl = buildProposalPublicUrl(config.frontendUrl, rawToken);
    const createdAt = new Date().toISOString();

    await pool.execute(
      `UPDATE proposal
       SET public_token_hash = ?,
           proposal_url = ?,
           public_link_created_at = CURRENT_TIMESTAMP,
           updated_by = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL`,
      [tokenHash, proposalUrl, userId, proposalId, clinicId],
    );

    await this.logProposalActivity({
      clinicId,
      userId,
      contactId: proposal.contactId,
      clientAccountProfileId: proposal.clientAccountProfileId,
      proposalId,
      action: "proposal_link_created",
      title: proposal.proposalName,
      status: proposal.status,
      changes: { proposalUrl },
    });
    await logAuditEvent({
      clinicId,
      userId,
      action: "PROPOSAL_LINK_CREATED",
      entityType: "proposal",
      entityId: proposalId,
      changes: { proposalUrl },
    });

    return { proposalId, proposalUrl, createdAt };
  }

  async markProposalSent(
    clinicId: string,
    userId: string,
    proposalId: string,
    data: ProposalSendDTO,
  ): Promise<ProposalResponse> {
    const proposal = await this.getProposal(clinicId, proposalId);
    if (proposal.status === "archived") throw ApiError.notFound("Proposal not found");
    if (isFinalProposalStatus(proposal.status)) {
      throw ApiError.badRequest(`This ${proposal.status.replace(/_/g, " ")} proposal cannot be marked sent.`);
    }
    if (!isProposalPubliclyVisible("sent", proposal.expiresAt)) {
      throw ApiError.badRequest("Extend the proposal expiry before marking it sent");
    }

    const recipientEmail = cleanString(data.recipientEmail) || proposal.contactEmail || null;
    const recipientName = cleanString(data.recipientName) || proposal.contactName || proposal.accountName || proposal.clientAccountName || null;
    if (!recipientEmail && !recipientName) {
      throw ApiError.badRequest("Record a recipient email or name before marking the proposal sent");
    }
    const v5FreezeRecordExists = Boolean(
      proposal.v5Snapshot ||
      proposal.v5SnapshotHash ||
      proposal.v5SnapshotVersion ||
      proposal.v5SnapshotFrozenAt
    );
    if (isProposalV5Proposal(proposal) && v5FreezeRecordExists) {
      throw ApiError.conflict("This V5 proposal version has already been frozen. Open the frozen preview or create a new proposal version before resending.");
    }
    const templateBinding = await this.assertProposalTemplateVersionSendable(clinicId, proposal);
    const approvedPackage = await this.resolveRecommendedPackage(clinicId, proposal.recommendedPackageId);
    this.assertClientReadyProposal({
      ...proposal,
      status: "sent",
      contactName: proposal.contactName,
      approvedPackagePriceCents: approvedPackage?.priceCents ?? null,
      approvedPackageSetupFeeCents: approvedPackage?.setupFeeCents ?? null,
      approvedPackageBillingFrequency: approvedPackage?.billingFrequency ?? null,
    });

    const sendMethod = cleanString(data.sendMethod) || "manual_email";
    const sendNote =
      cleanString(data.sendNote) ||
      "Manual send logged: proposal link was copied or sent outside Mission Control and recorded here.";
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");

    if (isProposalV5Proposal(proposal)) {
      const nowIso = new Date().toISOString();
      const rawToken = proposal.proposalUrl ? null : generateResetToken();
      const tokenHash = rawToken ? hashToken(rawToken) : null;
      const proposalUrl = proposal.proposalUrl || buildProposalPublicUrl(config.frontendUrl, rawToken as string);
      const v5ProposalForSnapshot: ProposalResponse = {
        ...proposal,
        templateId: templateBinding.templateId,
        templateVersionId: templateBinding.versionId,
        templateVersionNumber: templateBinding.versionNumber,
        templateContentHash: templateBinding.contentHash,
        status: "sent",
        sentAt: nowIso,
        sentToEmail: recipientEmail,
        sentToName: recipientName,
        sendMethod,
        sendNote,
        sentBy: userId,
        proposalUrl,
      };
      let v5Snapshot: ProposalV5Snapshot;
      try {
        v5Snapshot = buildProposalV5Snapshot({
          proposal: v5ProposalForSnapshot,
          packageRecord: approvedPackage,
          generatedAt: nowIso,
          sourceProposalVersion: `${proposal.id}:${proposal.updatedAt}:${nowIso}`,
          acceptanceUrl: buildAcceptanceUrl(proposalUrl),
          questionUrl: `mailto:hello@clinicgrower.co.uk?subject=${encodeURIComponent(`Question about ${proposal.proposalName}`)}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Proposal V5 snapshot could not be created";
        throw ApiError.badRequest(message);
      }
      const serializedV5Snapshot = serializeProposalV5Snapshot(v5Snapshot);
      if (!serializedV5Snapshot) {
        throw ApiError.badRequest("Proposal V5 snapshot could not be serialized");
      }

      await this.withTransaction(async (connection) => {
        const [sendResult]: any = await connection.execute(
          `UPDATE proposal
           SET status = 'sent',
               sent_at = COALESCE(sent_at, ?),
               sent_to_email = ?,
               sent_to_name = ?,
               send_method = ?,
               send_note = ?,
               sent_by = ?,
               template_id = ?,
               template_version_id = ?,
               template_version_number = ?,
               template_content_hash = ?,
               public_token_hash = COALESCE(public_token_hash, ?),
               proposal_url = COALESCE(proposal_url, ?),
               public_link_created_at = COALESCE(public_link_created_at, CURRENT_TIMESTAMP),
               v5_snapshot = ?,
               v5_snapshot_hash = ?,
               v5_snapshot_version = ?,
               v5_snapshot_frozen_at = ?,
               updated_by = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?
             AND clinic_id = ?
             AND deleted_at IS NULL
             AND status = ?
             AND v5_snapshot IS NULL`,
          [
            now,
            recipientEmail,
            recipientName,
            sendMethod,
            sendNote,
            userId,
            templateBinding.templateId,
            templateBinding.versionId,
            templateBinding.versionNumber,
            templateBinding.contentHash,
            tokenHash,
            proposalUrl,
            serializedV5Snapshot,
            v5Snapshot.snapshotHash,
            proposalV5SnapshotVersion,
            now,
            userId,
            proposalId,
            clinicId,
            proposal.status,
          ],
        );
        if (Number(sendResult.affectedRows || 0) !== 1) {
          throw ApiError.conflict("Proposal changed while it was being marked sent.");
        }
        await this.ensureProposalV5PrintArchive(
          connection,
          clinicId,
          userId,
          v5ProposalForSnapshot,
          v5Snapshot,
          proposalUrl,
        );
      });

      const updated = await this.getProposal(clinicId, proposalId);
      await this.logProposalActivity({
        clinicId,
        userId,
        contactId: updated.contactId,
        clientAccountProfileId: updated.clientAccountProfileId,
        proposalId,
        action: "proposal_sent",
        title: updated.proposalName,
        status: "sent",
        previousStatus: proposal.status,
        changes: {
          previousStatus: proposal.status,
          status: "sent",
          sentAt: updated.sentAt,
          recipientEmail,
          recipientName,
          sendMethod,
          proposalUrl: updated.proposalUrl,
          manualFallback: sendMethod === "manual_email",
          v5SnapshotVersion: updated.v5SnapshotVersion,
        },
      });
      await logAuditEvent({
        clinicId,
        userId,
        action: "PROPOSAL_SENT_LOGGED",
        entityType: "proposal",
        entityId: proposalId,
        changes: {
          previousStatus: proposal.status,
          status: "sent",
          sentAt: updated.sentAt,
          recipientEmail,
          recipientName,
          sendMethod,
          manualFallback: sendMethod === "manual_email",
          v5SnapshotVersion: updated.v5SnapshotVersion,
        },
      });
      await this.syncProposalFollowUpTask(clinicId, userId, updated);
      await this.syncRelatedDealStage(clinicId, userId, updated);

      return updated;
    }

    const [sendResult]: any = await pool.execute(
      `UPDATE proposal
       SET status = 'sent',
           sent_at = COALESCE(sent_at, ?),
           sent_to_email = ?,
           sent_to_name = ?,
           send_method = ?,
           send_note = ?,
           sent_by = ?,
           updated_by = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
         AND status = ?`,
      [
        now,
        recipientEmail,
        recipientName,
        sendMethod,
        sendNote,
        userId,
        userId,
        proposalId,
        clinicId,
        proposal.status,
      ],
    );
    if (Number(sendResult.affectedRows || 0) !== 1) {
      throw ApiError.conflict("Proposal changed while it was being marked sent.");
    }

    let updated = await this.getProposal(clinicId, proposalId);
    if (!updated.proposalUrl) {
      await this.createProposalShare(clinicId, userId, proposalId);
      updated = await this.getProposal(clinicId, proposalId);
    }
    await this.logProposalActivity({
      clinicId,
      userId,
      contactId: updated.contactId,
      clientAccountProfileId: updated.clientAccountProfileId,
      proposalId,
      action: "proposal_sent",
      title: updated.proposalName,
      status: "sent",
      previousStatus: proposal.status,
      changes: {
        previousStatus: proposal.status,
        status: "sent",
        sentAt: updated.sentAt,
        recipientEmail,
        recipientName,
        sendMethod,
        proposalUrl: updated.proposalUrl,
        manualFallback: sendMethod === "manual_email",
      },
    });
    await logAuditEvent({
      clinicId,
      userId,
      action: "PROPOSAL_SENT_LOGGED",
      entityType: "proposal",
      entityId: proposalId,
      changes: {
        previousStatus: proposal.status,
        status: "sent",
        sentAt: updated.sentAt,
        recipientEmail,
        recipientName,
        sendMethod,
        manualFallback: sendMethod === "manual_email",
      },
    });
    await this.syncProposalFollowUpTask(clinicId, userId, updated);
    await this.syncRelatedDealStage(clinicId, userId, updated);

    return updated;
  }

  async getSharedProposal(rawToken: string): Promise<ProposalPublicPreviewResponse> {
    const token = cleanString(rawToken);
    if (!token || token.length < 20) throw ApiError.notFound("Proposal link not found");
    const tokenHash = hashToken(token);
    const publicStatusPlaceholders = proposalPublicStatuses.map(() => "?").join(", ");

    const selectSharedProposal = `${proposalSelectSql()}
       WHERE p.public_token_hash = ?
         AND p.deleted_at IS NULL
         AND p.status IN (${publicStatusPlaceholders})
         AND (p.expires_at IS NULL OR p.expires_at > CURRENT_TIMESTAMP)
       LIMIT 1`;
    const sharedProposalParams = [tokenHash, ...proposalPublicStatuses];
    const [rows]: any = await pool.execute(
      selectSharedProposal,
      sharedProposalParams,
    );
    if (rows.length === 0) throw ApiError.notFound("Proposal link not found");

    const viewStatusPlaceholders = proposalViewTransitionStatuses.map(() => "?").join(", ");
    const [viewResult]: any = await pool.execute(
      `UPDATE proposal
       SET status = 'viewed',
           viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP),
           public_last_accessed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?
         AND public_token_hash = ?
         AND deleted_at IS NULL
         AND status IN (${viewStatusPlaceholders})
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [
        rows[0].id,
        rows[0].clinicId,
        tokenHash,
        ...proposalViewTransitionStatuses,
      ],
    );

    if (viewResult.affectedRows === 0) {
      await pool.execute(
        `UPDATE proposal
         SET public_last_accessed_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND clinic_id = ?
           AND public_token_hash = ?
           AND deleted_at IS NULL
           AND status IN (${publicStatusPlaceholders})
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [
          rows[0].id,
          rows[0].clinicId,
          tokenHash,
          ...proposalPublicStatuses,
        ],
      );
    }

    const [refreshedRows]: any = await pool.execute(
      selectSharedProposal,
      sharedProposalParams,
    );
    if (refreshedRows.length === 0) throw ApiError.notFound("Proposal link not found");

    const internalProposal = await this.hydrateSelectedProofAssets(
      refreshedRows[0].clinicId,
      mapProposal(refreshedRows[0]),
    );
    if (!isProposalPubliclyVisible(internalProposal.status, internalProposal.expiresAt)) {
      throw ApiError.notFound("Proposal link not found");
    }

    if (viewResult.affectedRows > 0) {
      await this.logProposalActivity({
        clinicId: refreshedRows[0].clinicId,
        userId: null,
        contactId: internalProposal.contactId,
        clientAccountProfileId: internalProposal.clientAccountProfileId,
        proposalId: internalProposal.id,
        action: "proposal_viewed",
        title: internalProposal.proposalName,
        status: "viewed",
        previousStatus: rows[0].status,
        changes: {
          previousStatus: rows[0].status,
          status: "viewed",
          viewedAt: internalProposal.viewedAt,
        },
      });
      await logAuditEvent({
        clinicId: refreshedRows[0].clinicId,
        userId: null,
        action: "PROPOSAL_VIEWED",
        entityType: "proposal",
        entityId: internalProposal.id,
        changes: {
          previousStatus: rows[0].status,
          status: "viewed",
          viewedAt: internalProposal.viewedAt,
        },
      });
    }

    const proposal = mapProposalPublicResponse(internalProposal);
    const packageRecord = mapProposalPublicPackage(await this.getProposalPreviewPackage(
      refreshedRows[0].clinicId,
      internalProposal.recommendedPackageId,
      internalProposal.packageName,
    ));

    const acceptanceUrl = buildAcceptanceUrl(internalProposal.proposalUrl);

    return {
      proposal,
      packageRecord,
      acceptance: mapPublicAcceptanceSummary(internalProposal),
      acceptanceUrl,
      acceptanceQrCodeDataUrl: await buildAcceptanceQrCodeDataUrl(acceptanceUrl),
    };
  }

  async acceptSharedProposal(
    rawToken: string,
    data: ProposalPublicAcceptanceDTO,
    context: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<ProposalPublicPreviewResponse> {
    const token = cleanString(rawToken);
    if (!token || token.length < 20) throw ApiError.notFound("Proposal link not found");
    const tokenHash = hashToken(token);
    const publicStatusPlaceholders = proposalPublicStatuses.map(() => "?").join(", ");

    const [rows]: any = await pool.execute(
      `${proposalSelectSql()}
       WHERE p.public_token_hash = ?
         AND p.deleted_at IS NULL
         AND p.status IN (${publicStatusPlaceholders})
         AND (p.expires_at IS NULL OR p.expires_at > CURRENT_TIMESTAMP)
       LIMIT 1`,
      [tokenHash, ...proposalPublicStatuses],
    );
    if (rows.length === 0) throw ApiError.notFound("Proposal link not found");

    const proposal = await this.hydrateSelectedProofAssets(
      rows[0].clinicId,
      mapProposal(rows[0]),
    );
    if (!isProposalPubliclyVisible(proposal.status, proposal.expiresAt)) {
      throw ApiError.notFound("Proposal link not found");
    }
    if (proposal.acceptanceRecord || ["accepted", "won"].includes(proposal.status)) {
      return this.getSharedProposal(token);
    }
    assertPublicProposalV5Acceptable(proposal);

    const acceptedAt = new Date().toISOString();
    const fullName = cleanString(data.fullName);
    const email = cleanString(data.email);
    const legalCompanyName = cleanString(data.legalCompanyName);
    const billingEmail = cleanString(data.billingEmail);
    const confirmationText = cleanString(data.signatureConfirmation);
    if (!fullName || !email || !legalCompanyName || !billingEmail || !confirmationText) {
      throw ApiError.badRequest("Acceptance details are incomplete.");
    }
    if (confirmationText.toLowerCase() !== fullName.toLowerCase()) {
      throw ApiError.badRequest("Signature confirmation must match the full name.");
    }

    const actingUserId = await this.resolvePublicAcceptanceActorUserId(
      rows[0].clinicId,
      proposal,
    );
    const evidence = {
      proposalId: proposal.id,
      proposalName: proposal.proposalName,
      acceptedByName: fullName,
      acceptedByEmail: email,
      legalCompanyName,
      billingEmail,
      preferredStartDate: data.preferredStartDate ? toMysqlDateOnly(data.preferredStartDate) : null,
      agreementAccepted: data.agreementAccepted === true,
      confirmationText,
      acceptedAt,
      acceptanceSource: "public_proposal_link",
      ipAddress: cleanString(context.ipAddress),
      userAgent: cleanString(context.userAgent),
    };

    await this.updateProposalStatus(
      rows[0].clinicId,
      actingUserId,
      proposal.id,
      {
        status: "accepted",
        reason: "Client accepted from proposal link",
        acceptedByName: fullName,
        acceptedByEmail: email,
        acceptedAt,
        legalCompanyName,
        billingEmail,
        preferredStartDate: data.preferredStartDate || null,
        agreementAccepted: true,
        confirmationText,
        acceptanceSource: "public_proposal_link",
        acceptedIpAddress: context.ipAddress || null,
        acceptedUserAgent: context.userAgent || null,
        evidenceSha256: hashAcceptanceEvidence(evidence),
      },
      { canManageAllClientAccounts: true },
    );

    return this.getSharedProposal(token);
  }

  async recordSharedProposalEvent(
    rawToken: string,
    data: ProposalPublicEventDTO,
    _context: { ipAddress?: string | null; userAgent?: string | null } = {},
  ) {
    const token = cleanString(rawToken);
    if (!token || token.length < 20) throw ApiError.notFound("Proposal link not found");
    const eventType = cleanString(data.eventType);
    if (!eventType) throw ApiError.badRequest("Proposal event type is required");

    const tokenHash = hashToken(token);
    const publicStatusPlaceholders = proposalPublicStatuses.map(() => "?").join(", ");
    const [rows]: any = await pool.execute(
      `${proposalSelectSql()}
       WHERE p.public_token_hash = ?
         AND p.deleted_at IS NULL
         AND p.status IN (${publicStatusPlaceholders})
         AND (p.expires_at IS NULL OR p.expires_at > CURRENT_TIMESTAMP)
       LIMIT 1`,
      [tokenHash, ...proposalPublicStatuses],
    );
    if (rows.length === 0) throw ApiError.notFound("Proposal link not found");

    const proposal = mapProposal(rows[0]);
    await pool.execute(
      `UPDATE proposal
       SET public_last_accessed_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?`,
      [proposal.id, rows[0].clinicId],
    );
    await logAuditEvent({
      clinicId: rows[0].clinicId,
      userId: null,
      action: "PROPOSAL_PUBLIC_EVENT",
      entityType: "proposal",
      entityId: proposal.id,
      changes: {
        eventType,
        sectionKey: cleanString(data.sectionKey),
      },
    });

    return { recorded: true };
  }

  async getProposalSourceData(
    clinicId: string,
    query: ProposalSourceDataQuery,
    access: ProposalLinkAccess,
  ): Promise<ProposalSourceDataResponse> {
    let contactId = cleanString(query.contactId);
    const dealId = cleanString(query.dealId);
    const clientAccountProfileId = cleanString(query.clientAccountProfileId);
    let deal: any = null;

    if (dealId) {
      const [dealRows]: any = await pool.execute(
        `SELECT d.id,
                d.contact_id as contactId,
                d.title,
                d.value as value,
                d.treatment,
                ps.name as stageName
         FROM deal d
         LEFT JOIN pipeline_stage ps
           ON ps.id = d.pipeline_stage_id
          AND ps.clinic_id = d.clinic_id
          AND ps.deleted_at IS NULL
         WHERE d.id = ?
           AND d.clinic_id = ?
           AND d.deleted_at IS NULL
         LIMIT 1`,
        [dealId, clinicId],
      );
      if (dealRows.length === 0) throw ApiError.notFound("Deal not found");
      deal = dealRows[0];
      if (contactId && contactId !== deal.contactId) {
        throw ApiError.badRequest("Proposal source contact must match the linked deal contact");
      }
      contactId = deal.contactId;
    }

    const contact = contactId ? await this.getProposalContactSource(clinicId, contactId) : null;
    const clientAccount = clientAccountProfileId
      ? await this.getProposalClientAccountSource(clinicId, clientAccountProfileId, access)
      : null;

    if (!contact && !deal && !clientAccount) {
      throw ApiError.badRequest("Provide a contact, deal or client account to pull proposal data");
    }

    const accountName = clientAccount?.clientName || contact?.accountName || contactFullName(contact) || deal?.title || "Prospect";
    const contactName = actualPersonName(contact) || "Decision-maker name required";
    const greetingName = actualPersonName(contact)?.split(/\s+/)[0] || "there";
    const location = contact ? formatLocation(contact) : null;
    const categories = mergeScoreCategories(contact, clientAccount);
    const gaps = scoreGaps(categories);
    const overall =
      numberOrNull(contact?.growthScoreOverall) ??
      numberOrNull(clientAccount?.growthScoreOverall);
    const growthScoreRecommendation =
      cleanString(contact?.growthScoreRecommendedPackage) ||
      cleanString(clientAccount?.growthScoreRecommendedPackage);
    const explicitRecommendation =
      growthScoreRecommendation ||
      cleanString(clientAccount?.recommendedNextPackage) ||
      cleanString(contact?.recommendedPackage) ||
      cleanString(contact?.packageInterest) ||
      cleanString(deal?.treatment);
    const packageRecord = await this.findRecommendedPackageByName(clinicId, explicitRecommendation);
    const packageName = packageRecord?.name || explicitRecommendation || null;
    const gapSummary =
      cleanString(contact?.growthScoreGapSummary) ||
      cleanString(clientAccount?.growthScoreGapSummary);
    const auditStatus = cleanString(contact?.auditStatus);
    const auditFollowUpDueAt = toIso(contact?.auditFollowUpDueAt);
    const currentPackage = cleanString(clientAccount?.currentPackage);
    const dealValueCents = valueToCents(deal?.value);
    const packageValueCents = packageRecord?.priceCents ?? null;

    const diagnosisLines = [
      overall !== null ? `Overall Growth Score: ${Math.round(overall)} / 100.` : null,
      gapSummary ? `Growth Score summary: ${gapSummary}` : null,
      gaps.length
        ? `Priority gaps: ${gaps.map((gap) => `${gap.label} (${Math.round(Number(gap.score))}/100)`).join(", ")}.`
        : null,
      auditStatus ? `Audit status: ${formatAuditStatus(auditStatus)}.` : null,
      auditFollowUpDueAt ? `Audit follow-up due: ${auditFollowUpDueAt.slice(0, 10)}.` : null,
      currentPackage ? `Current package: ${currentPackage}.` : null,
      location ? `Location: ${location}.` : null,
      contact?.website ? `Website: ${contact.website}.` : null,
    ].filter(Boolean).join("\n");

    const suggested: ProposalSourceDataResponse["suggested"] = {
      proposalName: `${accountName} - ${packageName || "Growth Plan"} proposal`,
      templateKey: "clinicgrower_v5",
      packageName,
      recommendedPackageId: packageRecord?.id || null,
      valueCents: packageValueCents ?? dealValueCents,
      monthlyFeeCents: packageRecord?.billingFrequency === "monthly" ? packageValueCents : null,
      setupFeeCents: packageRecord?.setupFeeCents ?? null,
      currency: packageRecord?.currency || "GBP",
      adSpendNote: packageName && /growth engine|market leader/i.test(packageName)
        ? "Ad spend is managed separately and agreed before campaign launch."
        : null,
      sectionContent: {
        executiveSummary: `This proposal brings together what we understand about ${accountName}, the priority growth gaps identified so far and the ClinicGrower programme recommended as the next step.`,
        personalIntroduction: `Hi ${greetingName}, thanks again for taking the time to talk through where ${accountName} is now and what you want growth to look like. I have pulled this proposal together around the main opportunities we discussed: improving local visibility, tightening the enquiry journey, making tracking clearer, and giving the team a practical plan for turning more of the right enquiries into booked consultations.`,
        introVideoTitle: "A short message from ClinicGrower",
        introVideoUrl: "https://vimeo.com/1008757315?fl=pl&fe=sh",
        primaryGoal: packageName ? `Move forward with ${packageName}.` : "Improve patient acquisition and conversion.",
        currentPosition: auditStatus ? `Audit status: ${formatAuditStatus(auditStatus)}.` : currentPackage ? `Current package: ${currentPackage}.` : null,
        availableCapacity: null,
        priorityTreatments: cleanString(contact?.packageInterest) || cleanString(deal?.treatment) || null,
        targetArea: location,
        desiredOutcome: "Create a controlled route to more measurable, booked patient growth.",
        growthScoreOverall: overall,
        visibilityScore: categories.websiteVisibility ?? categories.seo ?? categories.gbp,
        conversionScore: categories.conversion,
        trackingScore: categories.tracking,
        leadHandlingScore: categories.leadHandling ?? categories.responseSpeed,
        salesConversionScore: categories.treatmentPerformance,
        retentionScore: categories.revenueLeakage,
        biggestRisk: gaps[0] ? `${gaps[0].label} is currently one of the lowest-scoring areas.` : gapSummary || null,
        biggestOpportunity: growthScoreRecommendation ? `The strongest next opportunity is aligned to ${growthScoreRecommendation}.` : packageName ? `The strongest next opportunity is aligned to ${packageName}.` : null,
        firstRecommendedFix: gaps[0] ? `Start by improving ${gaps[0].label.toLowerCase()} before scaling further activity.` : null,
        diagnosis: diagnosisLines || null,
        recommendedPlan: packageRecord?.proposalWording || (packageName ? `Recommended next package: ${packageName}.` : null),
        strategyPoints: [
          "Capture high-intent demand from search, maps and paid channels.",
          "Improve the path from enquiry to booked consultation.",
          "Track calls, forms and WhatsApp enquiries through to real outcomes.",
          "Use the Growth Score gaps to decide what should be fixed first.",
          "Scale only once the key foundations are measurable and stable.",
        ],
        includedFeatures: packageRecord?.includedFeatures || [],
        successMetrics: [
          "Qualified enquiries | Current monthly count and target required before sending | Lead tracking and call tracking",
          "Booked consultations | Current booking baseline and target required before sending | Booking and CRM data",
          "Lead-to-booked conversion rate | Target percentage required before sending | Lead and booking data",
          "Cost per booked patient | Viable target cost required before sending | Ads and CRM data",
          "Response time | Under 10 minutes where practical | Call and lead data",
        ],
        clinicGrowerResponsibilities: [
          "Deliver the agreed scope and raise blockers quickly.",
          "Track agreed conversion events and report on the patient journey.",
          "Optimise based on reliable data, lead quality and booked outcomes.",
          "Provide reporting, recommendations and next actions.",
        ],
        clientResponsibilities: [
          "Provide access, approvals and required assets promptly.",
          "Respond to enquiries quickly and maintain appointment capacity.",
          "Share accurate booking, sales and treatment outcome data where available.",
          "Pay advertising spend directly and follow agreed clinical compliance rules.",
        ],
        timeline: "Confirm proposal fit and decision owner.\nAgree package, start date and commercial terms.\nMove accepted work into delivery onboarding and internal tasks.",
        termsSummary: "Initial term, renewal structure, payment terms, ad spend arrangements, account ownership, client responsibilities, data/privacy and performance disclaimers are confirmed as part of acceptance.",
        investmentNotes: packageName
          ? `Recommended package: ${packageName}${packageValueCents !== null ? ` at ${packageValueCents / 100} ${packageRecord?.currency || "GBP"}` : ""}.`
          : null,
        nextSteps: auditStatus === "audit_completed"
          ? "Send proposal follow-up and confirm the implementation start date."
          : "Review the recommendation, confirm fit and agree the next sales follow-up.",
      },
    };

    return {
      links: {
        contactId: contact?.id || contactId || null,
        dealId: deal?.id || dealId || null,
        clientAccountProfileId: clientAccount?.id || clientAccountProfileId || null,
      },
      contact: {
        id: contact?.id || null,
        name: contactName,
        email: contact?.email || null,
        phone: contact?.phone || null,
        roleTitle: contact?.roleTitle || null,
        accountName: contact?.accountName || null,
        website: contact?.website || null,
        location,
        source: contact?.source || null,
      },
      deal: {
        id: deal?.id || null,
        title: deal?.title || null,
        stageName: deal?.stageName || null,
        packageName: deal?.treatment || null,
        valueCents: dealValueCents,
      },
      clientAccount: {
        id: clientAccount?.id || null,
        name: clientAccount?.clientName || null,
        currentPackage: currentPackage || null,
        recommendedNextPackage: cleanString(clientAccount?.recommendedNextPackage),
        upsellOpportunity: cleanString(clientAccount?.upsellOpportunity),
      },
      growthScore: {
        overall,
        categories,
        gaps,
        recommendedPackage: growthScoreRecommendation,
        gapSummary,
        updatedAt: toIso(contact?.growthScoreUpdatedAt || clientAccount?.growthScoreUpdatedAt),
      },
      audit: {
        status: auditStatus,
        followUpDueAt: auditFollowUpDueAt,
        updatedAt: toIso(contact?.auditStatusUpdatedAt),
      },
      recommendedPackage: {
        id: packageRecord?.id || null,
        name: packageRecord?.name || null,
        priceCents: packageValueCents,
        setupFeeCents: packageRecord?.setupFeeCents ?? null,
        currency: packageRecord?.currency || null,
        billingFrequency: packageRecord?.billingFrequency || null,
        includedFeatures: packageRecord?.includedFeatures || [],
        proposalWording: packageRecord?.proposalWording || null,
      },
      suggested,
    };
  }

  async createProposal(
    clinicId: string,
    userId: string,
    data: ProposalMutationDTO,
    access: ProposalLinkAccess,
  ): Promise<ProposalResponse> {
    const links = await this.resolveProposalLinks(clinicId, data, access);
    const proposalName = cleanString(data.proposalName);
    if (!proposalName) throw ApiError.badRequest("Proposal name is required");

    const status = data.status || "draft";
    this.validateStatusRequirements(status, data.followUpAt);
    this.assertV5TerminalProposalHasFrozenSnapshot(
      cleanString(data.templateKey) || "clinicgrower_v5",
      status,
      null,
    );
    if (status === "lost" && (!cleanString(data.lostReason) || !cleanString(data.objectionType))) {
      throw ApiError.badRequest("Lost reason and objection type are required when marking a proposal lost");
    }
    const templateKey = cleanString(data.templateKey) || "clinicgrower_v5";
    const templateBinding = await this.resolveTemplateVersionForProposal(clinicId, templateKey, data.templateVersionId);
    const recommendedPackage = await this.resolveRecommendedPackage(clinicId, data.recommendedPackageId);
    const packageName = cleanString(data.packageName) || recommendedPackage?.name || null;
    const valueCents = data.valueCents ?? recommendedPackage?.priceCents ?? null;
    const monthlyFeeCents = data.monthlyFeeCents ?? (recommendedPackage?.billingFrequency === "monthly" ? recommendedPackage?.priceCents : null);
    const setupFeeCents = data.setupFeeCents ?? recommendedPackage?.setupFeeCents ?? null;
    const selectedProofAssets = await this.validateProofAssetIds(clinicId, data.sectionContent);
    const candidateSectionContent = data.sectionContent
      ? { ...data.sectionContent, proofAssets: selectedProofAssets }
      : data.sectionContent || null;
    this.assertClientReadyProposal({
      status,
      contactId: links.contactId,
      contactName: links.contactName,
      accountName: links.accountName,
      clientAccountName: links.clientAccountName,
      recommendedPackageId: recommendedPackage?.id || cleanString(data.recommendedPackageId),
      packageName,
      approvedPackagePriceCents: recommendedPackage?.priceCents ?? null,
      approvedPackageSetupFeeCents: recommendedPackage?.setupFeeCents ?? null,
      approvedPackageBillingFrequency: recommendedPackage?.billingFrequency ?? null,
      valueCents,
      monthlyFeeCents,
      setupFeeCents,
      adSpendNote: cleanString(data.adSpendNote),
      vatStatus: cleanString(data.vatStatus),
      minimumTermMonths: data.minimumTermMonths ?? null,
      noticePeriodDays: data.noticePeriodDays ?? null,
      startDate: toMysqlDateOnly(data.startDate),
      expiresAt: toMysqlDateTime(data.expiresAt),
      sectionContent: candidateSectionContent,
    });
    await this.validateRelatedDealOutcome(clinicId, {
      dealId: links.dealId,
      status,
      valueCents,
    });
    const id = uuidv4();
    const timestamps = this.getStatusTimestamps(status, data);
    const draftSavedAt = status === "draft" ? new Date().toISOString().slice(0, 19).replace("T", " ") : null;

    const values: any[] = [
      id,
      clinicId,
      links.contactId,
      links.dealId,
      links.clientAccountProfileId,
      proposalName,
      templateBinding.templateId,
      templateKey,
      templateBinding.versionId,
      templateBinding.versionNumber,
      templateBinding.contentHash,
      packageName,
      recommendedPackage?.id || null,
      cleanString(data.ownerId) || userId,
      status,
      centsToValue(valueCents),
      monthlyFeeCents,
      setupFeeCents,
      (cleanString(data.currency) || "GBP").toUpperCase(),
      cleanString(data.adSpendNote),
      cleanString(data.vatStatus),
      data.minimumTermMonths ?? null,
      data.noticePeriodDays ?? null,
      toMysqlDateOnly(data.startDate),
      toMysqlDateTime(data.followUpAt),
      timestamps.readyAt ?? null,
      timestamps.sentAt ?? null,
      timestamps.viewedAt ?? null,
      timestamps.acceptedAt ?? null,
      cleanString(data.acceptedReason),
      timestamps.wonAt ?? null,
      cleanString(data.wonReason),
      timestamps.lostAt ?? null,
      cleanString(data.lostReason),
      cleanString(data.objectionType),
      toMysqlDateTime(data.expiresAt),
      cleanString(data.proposalUrl),
      cleanString(data.notes),
      serializeCommercialItems(data.addOns) ?? null,
      serializeCommercialItems(data.discounts) ?? null,
      cleanString(data.internalMarginNote),
      serializeSectionContent(data.sectionContent) ?? null,
      draftSavedAt,
      userId,
      userId,
    ];

    const insertSql = `INSERT INTO proposal
        (id, clinic_id, contact_id, deal_id, client_account_profile_id, proposal_name,
         template_id, template_key, template_version_id, template_version_number, template_content_hash,
         package_name, recommended_package_id, owner_id, status, value,
         monthly_fee_cents, setup_fee_cents, currency, ad_spend_note, vat_status,
         minimum_term_months, notice_period_days, start_date, follow_up_at, ready_at,
         sent_at, viewed_at, accepted_at, accepted_reason, won_at, won_reason, lost_at, lost_reason, objection_type, expires_at, proposal_url,
         notes, add_ons, discounts, internal_margin_note, section_content, draft_saved_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const mutate = async (executor: QueryExecutor) => {
      await executor.execute(insertSql, values);
    };
    const recordCreated = async (executor: QueryExecutor | null, created: ProposalResponse) => {
      await this.logProposalActivity({
        clinicId,
        userId,
        contactId: created.contactId,
        clientAccountProfileId: created.clientAccountProfileId,
        proposalId: id,
        action: "proposal_created",
        title: proposalName,
        status,
        changes: {
          contactId: links.contactId,
          dealId: links.dealId,
          clientAccountProfileId: links.clientAccountProfileId,
          templateId: templateBinding.templateId,
          templateKey,
          templateVersionId: templateBinding.versionId,
          templateVersionNumber: templateBinding.versionNumber,
          templateContentHash: templateBinding.contentHash,
          packageName,
          recommendedPackageId: recommendedPackage?.id || null,
          monthlyFeeCents,
          setupFeeCents,
          adSpendNote: cleanString(data.adSpendNote),
          vatStatus: cleanString(data.vatStatus),
          minimumTermMonths: data.minimumTermMonths ?? null,
          noticePeriodDays: data.noticePeriodDays ?? null,
          startDate: toMysqlDateOnly(data.startDate),
          addOns: data.addOns || [],
          discounts: data.discounts || [],
          ownerId: cleanString(data.ownerId) || userId,
          followUpAt: toMysqlDateTime(data.followUpAt),
          acceptedReason: cleanString(data.acceptedReason),
          wonReason: cleanString(data.wonReason),
          lostReason: cleanString(data.lostReason),
          objectionType: cleanString(data.objectionType),
        },
      }, executor || undefined);
      const auditPayload = {
        clinicId,
        userId,
        action: "PROPOSAL_CREATED",
        entityType: "proposal",
        entityId: id,
        changes: {
          ...data,
          contactId: links.contactId,
          dealId: links.dealId,
          clientAccountProfileId: links.clientAccountProfileId,
        },
      };
      if (executor) {
        await insertAuditEvent(executor, auditPayload);
      } else {
        await logAuditEvent(auditPayload);
      }
    };

    if (["accepted", "won"].includes(status)) {
      return this.persistAcceptedProposalMutation({
        clinicId,
        userId,
        proposalId: id,
        dealId: links.dealId,
        data,
        mutate,
        recordMutation: (executor, created) => recordCreated(executor, created),
      });
    }
    if (status === "lost") {
      return this.persistLostProposalMutation({
        clinicId,
        userId,
        proposalId: id,
        dealId: links.dealId,
        data,
        mutate,
        recordMutation: (executor, created) => recordCreated(executor, created),
      });
    }

    await mutate(pool);
    const created = await this.refreshProposalCoreData(clinicId, id);
    await recordCreated(null, created);
    await this.syncProposalFollowUpTask(clinicId, userId, created);
    await this.syncRelatedDealStage(clinicId, userId, created);

    return created;
  }

  async updateProposal(
    clinicId: string,
    userId: string,
    proposalId: string,
    data: ProposalMutationDTO,
    access: ProposalLinkAccess,
  ): Promise<ProposalResponse> {
    const existing = await this.getProposal(clinicId, proposalId);
    this.assertAcceptedProposalCanBeMutated(existing, data);
    const linkData = {
      contactId: data.contactId === undefined ? existing.contactId : data.contactId,
      dealId: data.dealId === undefined ? existing.dealId : data.dealId,
      clientAccountProfileId: data.clientAccountProfileId === undefined ? existing.clientAccountProfileId : data.clientAccountProfileId,
    };
    const links = await this.resolveProposalLinks(clinicId, linkData, access, {
      existingClientAccountProfileId: existing.clientAccountProfileId,
      existingContactId: existing.contactId,
      existingDealId: existing.dealId,
    });
    const status = data.status || existing.status;
    validateProposalStatusTransition(existing.status, status);
    const candidateTemplateKey = Object.prototype.hasOwnProperty.call(data, "templateKey")
      ? cleanString(data.templateKey) || "clinicgrower_v5"
      : existing.templateKey;
    const templateBinding = (Object.prototype.hasOwnProperty.call(data, "templateKey")
      || Object.prototype.hasOwnProperty.call(data, "templateVersionId")
      || !existing.templateVersionId)
      ? await this.resolveTemplateVersionForProposal(clinicId, candidateTemplateKey, data.templateVersionId || null)
      : {
          templateId: existing.templateId || "",
          versionId: existing.templateVersionId,
          versionNumber: existing.templateVersionNumber || 0,
          contentHash: existing.templateContentHash || "",
          status: "published" as ProposalTemplateVersionStatus,
        };
    this.assertV5TerminalProposalHasFrozenSnapshot(candidateTemplateKey, status, existing);
    const followUpAt = data.followUpAt === undefined ? existing.followUpAt : data.followUpAt;
    this.validateStatusRequirements(status, followUpAt);
    const lostReason = data.lostReason === undefined ? existing.lostReason : data.lostReason;
    const objectionType = data.objectionType === undefined ? existing.objectionType : data.objectionType;
    if (status === "lost" && (!cleanString(lostReason) || !cleanString(objectionType))) {
      throw ApiError.badRequest("Lost reason and objection type are required when marking a proposal lost");
    }
    const recommendedPackage = Object.prototype.hasOwnProperty.call(data, "recommendedPackageId")
      ? await this.resolveRecommendedPackage(clinicId, data.recommendedPackageId)
      : null;
    const candidateRecommendedPackageId = Object.prototype.hasOwnProperty.call(data, "recommendedPackageId")
      ? recommendedPackage?.id || cleanString(data.recommendedPackageId)
      : existing.recommendedPackageId;
    const outcomeValueCents = Object.prototype.hasOwnProperty.call(data, "valueCents")
      ? data.valueCents
      : recommendedPackage?.priceCents ?? existing.valueCents;
    const candidatePackageName = Object.prototype.hasOwnProperty.call(data, "packageName")
      ? cleanString(data.packageName) || recommendedPackage?.name || null
      : recommendedPackage?.name || existing.packageName;
    const comparisonPackage = recommendedPackage || (candidateRecommendedPackageId
      ? await this.resolveRecommendedPackage(clinicId, candidateRecommendedPackageId)
      : null);
    const candidateMonthlyFeeCents = Object.prototype.hasOwnProperty.call(data, "monthlyFeeCents")
      ? data.monthlyFeeCents ?? null
      : recommendedPackage?.billingFrequency === "monthly" && recommendedPackage?.priceCents !== null && recommendedPackage?.priceCents !== undefined
        ? recommendedPackage.priceCents
        : existing.monthlyFeeCents;
    const candidateSetupFeeCents = Object.prototype.hasOwnProperty.call(data, "setupFeeCents")
      ? data.setupFeeCents ?? null
      : recommendedPackage?.setupFeeCents !== null && recommendedPackage?.setupFeeCents !== undefined
        ? recommendedPackage.setupFeeCents
        : existing.setupFeeCents;
    const candidateVatStatus = Object.prototype.hasOwnProperty.call(data, "vatStatus")
      ? cleanString(data.vatStatus)
      : existing.vatStatus;
    const candidateMinimumTermMonths = Object.prototype.hasOwnProperty.call(data, "minimumTermMonths")
      ? data.minimumTermMonths ?? null
      : existing.minimumTermMonths;
    const candidateNoticePeriodDays = Object.prototype.hasOwnProperty.call(data, "noticePeriodDays")
      ? data.noticePeriodDays ?? null
      : existing.noticePeriodDays;
    const candidateStartDate = Object.prototype.hasOwnProperty.call(data, "startDate")
      ? toMysqlDateOnly(data.startDate)
      : existing.startDate;
    const candidateExpiresAt = Object.prototype.hasOwnProperty.call(data, "expiresAt")
      ? toMysqlDateTime(data.expiresAt)
      : existing.expiresAt;
    const candidateSectionContentSource = Object.prototype.hasOwnProperty.call(data, "sectionContent")
      ? data.sectionContent || null
      : existing.sectionContent;
    const selectedProofAssets = await this.validateProofAssetIds(clinicId, candidateSectionContentSource);
    const candidateSectionContent = candidateSectionContentSource
      ? { ...candidateSectionContentSource, proofAssets: selectedProofAssets }
      : candidateSectionContentSource;
    this.assertClientReadyProposal({
      status,
      contactId: links.contactId,
      contactName: links.contactName,
      accountName: links.accountName,
      clientAccountName: links.clientAccountName,
      recommendedPackageId: candidateRecommendedPackageId,
      packageName: candidatePackageName,
      approvedPackagePriceCents: comparisonPackage?.priceCents ?? null,
      approvedPackageSetupFeeCents: comparisonPackage?.setupFeeCents ?? null,
      approvedPackageBillingFrequency: comparisonPackage?.billingFrequency ?? null,
      valueCents: outcomeValueCents ?? null,
      monthlyFeeCents: candidateMonthlyFeeCents,
      setupFeeCents: candidateSetupFeeCents,
      adSpendNote: Object.prototype.hasOwnProperty.call(data, "adSpendNote") ? cleanString(data.adSpendNote) : existing.adSpendNote,
      vatStatus: candidateVatStatus,
      minimumTermMonths: candidateMinimumTermMonths,
      noticePeriodDays: candidateNoticePeriodDays,
      startDate: candidateStartDate,
      expiresAt: candidateExpiresAt,
      sectionContent: candidateSectionContent,
    });
    await this.validateRelatedDealOutcome(clinicId, {
      dealId: links.dealId,
      status,
      valueCents: outcomeValueCents,
    });

    const fields: string[] = [];
    const values: any[] = [];
    const add = (column: string, value: unknown) => {
      fields.push(`${column} = ?`);
      values.push(value);
    };

    add("contact_id", links.contactId);
    add("deal_id", links.dealId);
    add("client_account_profile_id", links.clientAccountProfileId);
    if (Object.prototype.hasOwnProperty.call(data, "proposalName")) add("proposal_name", cleanString(data.proposalName));
    if (
      Object.prototype.hasOwnProperty.call(data, "templateKey")
      || Object.prototype.hasOwnProperty.call(data, "templateVersionId")
      || !existing.templateVersionId
    ) {
      add("template_id", templateBinding.templateId);
      add("template_key", candidateTemplateKey);
      add("template_version_id", templateBinding.versionId);
      add("template_version_number", templateBinding.versionNumber);
      add("template_content_hash", templateBinding.contentHash);
    }
    if (Object.prototype.hasOwnProperty.call(data, "recommendedPackageId")) add("recommended_package_id", recommendedPackage?.id || null);
    if (Object.prototype.hasOwnProperty.call(data, "packageName")) {
      add("package_name", cleanString(data.packageName) || recommendedPackage?.name || null);
    } else if (recommendedPackage) {
      add("package_name", recommendedPackage.name);
    }
    if (Object.prototype.hasOwnProperty.call(data, "ownerId")) add("owner_id", cleanString(data.ownerId));
    if (Object.prototype.hasOwnProperty.call(data, "status")) add("status", status);
    if (Object.prototype.hasOwnProperty.call(data, "valueCents")) {
      add("value", centsToValue(data.valueCents));
    } else if (recommendedPackage?.priceCents !== null && recommendedPackage?.priceCents !== undefined) {
      add("value", centsToValue(recommendedPackage.priceCents));
    }
    if (Object.prototype.hasOwnProperty.call(data, "monthlyFeeCents")) {
      add("monthly_fee_cents", data.monthlyFeeCents ?? null);
    } else if (recommendedPackage?.billingFrequency === "monthly" && recommendedPackage?.priceCents !== null && recommendedPackage?.priceCents !== undefined) {
      add("monthly_fee_cents", recommendedPackage.priceCents);
    }
    if (Object.prototype.hasOwnProperty.call(data, "setupFeeCents")) {
      add("setup_fee_cents", data.setupFeeCents ?? null);
    } else if (recommendedPackage?.setupFeeCents !== null && recommendedPackage?.setupFeeCents !== undefined) {
      add("setup_fee_cents", recommendedPackage.setupFeeCents);
    }
    if (Object.prototype.hasOwnProperty.call(data, "currency")) add("currency", (cleanString(data.currency) || "GBP").toUpperCase());
    if (Object.prototype.hasOwnProperty.call(data, "adSpendNote")) add("ad_spend_note", cleanString(data.adSpendNote));
    if (Object.prototype.hasOwnProperty.call(data, "vatStatus")) add("vat_status", cleanString(data.vatStatus));
    if (Object.prototype.hasOwnProperty.call(data, "minimumTermMonths")) add("minimum_term_months", data.minimumTermMonths ?? null);
    if (Object.prototype.hasOwnProperty.call(data, "noticePeriodDays")) add("notice_period_days", data.noticePeriodDays ?? null);
    if (Object.prototype.hasOwnProperty.call(data, "startDate")) add("start_date", toMysqlDateOnly(data.startDate));
    if (Object.prototype.hasOwnProperty.call(data, "followUpAt")) add("follow_up_at", toMysqlDateTime(data.followUpAt));
    if (Object.prototype.hasOwnProperty.call(data, "acceptedReason")) add("accepted_reason", cleanString(data.acceptedReason));
    if (Object.prototype.hasOwnProperty.call(data, "wonReason")) add("won_reason", cleanString(data.wonReason));
    if (Object.prototype.hasOwnProperty.call(data, "lostReason")) add("lost_reason", cleanString(data.lostReason));
    if (Object.prototype.hasOwnProperty.call(data, "objectionType")) add("objection_type", cleanString(data.objectionType));
    if (Object.prototype.hasOwnProperty.call(data, "proposalUrl")) add("proposal_url", cleanString(data.proposalUrl));
    if (Object.prototype.hasOwnProperty.call(data, "notes")) add("notes", cleanString(data.notes));
    if (Object.prototype.hasOwnProperty.call(data, "addOns")) add("add_ons", serializeCommercialItems(data.addOns) ?? null);
    if (Object.prototype.hasOwnProperty.call(data, "discounts")) add("discounts", serializeCommercialItems(data.discounts) ?? null);
    if (Object.prototype.hasOwnProperty.call(data, "internalMarginNote")) add("internal_margin_note", cleanString(data.internalMarginNote));
    if (Object.prototype.hasOwnProperty.call(data, "sectionContent")) add("section_content", serializeSectionContent(data.sectionContent) ?? null);
    if (status === "draft") add("draft_saved_at", new Date().toISOString().slice(0, 19).replace("T", " "));

    const statusTimestamps = this.getStatusTimestamps(status, data, existing);
    for (const [column, value] of Object.entries(statusTimestamps)) {
      if (value !== undefined) add(column.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value);
    }

    add("updated_by", userId);
    values.push(proposalId, clinicId, existing.status);
    const updateSql = `UPDATE proposal
       SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
         AND status = ?`;
    const mutate = async (executor: QueryExecutor) => {
      const [result]: any = await executor.execute(updateSql, values);
      if (Number(result.affectedRows || 0) !== 1) {
        throw ApiError.conflict("Proposal changed while this update was in progress.");
      }
    };

    if (["accepted", "won"].includes(status)) {
      return this.persistAcceptedProposalMutation({
        clinicId,
        userId,
        proposalId,
        dealId: links.dealId,
        data,
        mutate,
        recordMutation: (executor, updated) => this.recordProposalUpdate(
          executor,
          clinicId,
          userId,
          proposalId,
          existing,
          updated,
          data,
        ),
      });
    }
    if (status === "lost") {
      return this.persistLostProposalMutation({
        clinicId,
        userId,
        proposalId,
        dealId: links.dealId,
        data,
        mutate,
        recordMutation: (executor, updated) => this.recordProposalUpdate(
          executor,
          clinicId,
          userId,
          proposalId,
          existing,
          updated,
          data,
        ),
        previousProposal: existing,
      });
    }

    await mutate(pool);
    const updated = await this.refreshProposalCoreData(clinicId, proposalId);
    await this.recordProposalUpdate(null, clinicId, userId, proposalId, existing, updated, data);
    await this.syncProposalFollowUpTask(clinicId, userId, updated);
    await this.syncRelatedDealStage(clinicId, userId, updated, existing);

    return updated;
  }

  async updateProposalStatus(
    clinicId: string,
    userId: string,
    proposalId: string,
    data: ProposalStatusUpdateDTO,
    access: ProposalLinkAccess,
  ): Promise<ProposalResponse> {
    const status = data.status;
    const reason = cleanString(data.reason);
    const payload: ProposalMutationDTO = { status };

    if (status === "follow_up_due") {
      payload.followUpAt = data.followUpAt || null;
    }

    if (status === "accepted") {
      payload.acceptedReason = reason;
      if (data.acceptedByName !== undefined) payload.acceptedByName = data.acceptedByName;
      if (data.acceptedByEmail !== undefined) payload.acceptedByEmail = data.acceptedByEmail;
      if (data.acceptedAt !== undefined) payload.acceptedAt = data.acceptedAt;
      if (data.legalCompanyName !== undefined) payload.legalCompanyName = data.legalCompanyName;
      if (data.billingEmail !== undefined) payload.billingEmail = data.billingEmail;
      if (data.preferredStartDate !== undefined) payload.preferredStartDate = data.preferredStartDate;
      if (data.agreementAccepted !== undefined) payload.agreementAccepted = data.agreementAccepted;
      if (data.confirmationText !== undefined) payload.confirmationText = data.confirmationText;
      if (data.acceptanceSource !== undefined) payload.acceptanceSource = data.acceptanceSource;
      if (data.acceptedIpAddress !== undefined) payload.acceptedIpAddress = data.acceptedIpAddress;
      if (data.acceptedUserAgent !== undefined) payload.acceptedUserAgent = data.acceptedUserAgent;
      if (data.evidenceSha256 !== undefined) payload.evidenceSha256 = data.evidenceSha256;
      if (data.paymentTerms !== undefined) payload.paymentTerms = data.paymentTerms;
    }

    if (status === "won") {
      payload.wonReason = reason;
      if (data.acceptedByName !== undefined) payload.acceptedByName = data.acceptedByName;
      if (data.acceptedByEmail !== undefined) payload.acceptedByEmail = data.acceptedByEmail;
      if (data.acceptedAt !== undefined) payload.acceptedAt = data.acceptedAt;
      if (data.legalCompanyName !== undefined) payload.legalCompanyName = data.legalCompanyName;
      if (data.billingEmail !== undefined) payload.billingEmail = data.billingEmail;
      if (data.preferredStartDate !== undefined) payload.preferredStartDate = data.preferredStartDate;
      if (data.agreementAccepted !== undefined) payload.agreementAccepted = data.agreementAccepted;
      if (data.confirmationText !== undefined) payload.confirmationText = data.confirmationText;
      if (data.acceptanceSource !== undefined) payload.acceptanceSource = data.acceptanceSource;
      if (data.acceptedIpAddress !== undefined) payload.acceptedIpAddress = data.acceptedIpAddress;
      if (data.acceptedUserAgent !== undefined) payload.acceptedUserAgent = data.acceptedUserAgent;
      if (data.evidenceSha256 !== undefined) payload.evidenceSha256 = data.evidenceSha256;
      if (data.paymentTerms !== undefined) payload.paymentTerms = data.paymentTerms;
    }

    if (status === "lost") {
      if (!reason) throw ApiError.badRequest("Reason is required when marking a proposal lost");
      if (!cleanString(data.objectionType)) throw ApiError.badRequest("Objection type is required when marking a proposal lost");
      payload.lostReason = reason;
      payload.objectionType = data.objectionType || null;
    }

    return this.updateProposal(clinicId, userId, proposalId, payload, access);
  }

  async archiveProposal(clinicId: string, userId: string, proposalId: string): Promise<void> {
    const existing = await this.getProposal(clinicId, proposalId);
    const [archiveResult]: any = await pool.execute(
      `UPDATE proposal
       SET status = 'archived',
           deleted_at = CURRENT_TIMESTAMP,
           updated_by = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
         AND status = ?`,
      [userId, proposalId, clinicId, existing.status],
    );
    if (Number(archiveResult.affectedRows || 0) !== 1) {
      throw ApiError.conflict("Proposal changed while it was being archived.");
    }
    await this.syncProposalFollowUpTask(
      clinicId,
      userId,
      { ...existing, status: "archived" },
    );
    await this.logProposalActivity({
      clinicId,
      userId,
      contactId: existing.contactId,
      clientAccountProfileId: existing.clientAccountProfileId,
      proposalId,
      action: "proposal_archived",
      title: existing.proposalName,
      status: "archived",
      previousStatus: existing.status,
    });
    await logAuditEvent({
      clinicId,
      userId,
      action: "PROPOSAL_ARCHIVED",
      entityType: "proposal",
      entityId: proposalId,
      changes: { previousStatus: existing.status },
    });
  }

  private async withTransaction<T>(work: (connection: PoolConnection) => Promise<T>) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private templateVersionSelectSql() {
    return `SELECT v.id,
                   v.clinic_id as clinicId,
                   v.template_id as templateId,
                   v.template_key as templateKey,
                   v.version_number as versionNumber,
                   v.content,
                   v.content_hash as contentHash,
                   v.status,
                   v.source_version_id as sourceVersionId,
                   v.created_by as createdBy,
                   creator.first_name as createdByFirstName,
                   creator.last_name as createdByLastName,
                   creator.email as createdByEmail,
                   v.submitted_by as submittedBy,
                   v.approved_by as approvedBy,
                   v.rejected_by as rejectedBy,
                   v.published_by as publishedBy,
                   v.created_at as createdAt,
                   v.updated_at as updatedAt,
                   v.submitted_at as submittedAt,
                   v.approved_at as approvedAt,
                   v.rejected_at as rejectedAt,
                   v.published_at as publishedAt,
                   v.superseded_at as supersededAt,
                   v.rejection_reason as rejectionReason,
                   v.change_summary as changeSummary
            FROM proposal_template_version v
            LEFT JOIN user creator
              ON creator.id = v.created_by`;
  }

  private async getProposalTemplate(
    clinicId: string,
    templateId: string,
    executor: QueryExecutor = pool,
  ): Promise<ProposalTemplateResponse> {
    const [rows]: any = await executor.execute(
      `SELECT id,
              template_key as templateKey,
              name,
              description,
              package_name as packageName,
              default_sections as defaultSections,
              default_roadmap as defaultRoadmap,
              default_terms as defaultTerms,
              default_success_metrics as defaultSuccessMetrics,
              sort_order as sortOrder,
              is_active as isActive,
              created_at as createdAt,
              updated_at as updatedAt
       FROM proposal_template
       WHERE id = ?
         AND clinic_id = ?
       LIMIT 1`,
      [templateId, clinicId],
    );
    if (rows.length === 0) throw ApiError.notFound("Proposal template not found");
    return { ...mapProposalTemplate(rows[0]), activeVersion: await this.getActiveTemplateVersion(clinicId, templateId, executor) };
  }

  private async getActiveTemplateVersion(
    clinicId: string,
    templateId: string,
    executor: QueryExecutor = pool,
  ): Promise<ProposalTemplateVersionSummary | null> {
    const [rows]: any = await executor.execute(
      `${this.templateVersionSelectSql()}
       WHERE v.clinic_id = ?
         AND v.template_id = ?
         AND v.status = 'published'
       ORDER BY v.published_at DESC, v.version_number DESC
       LIMIT 1`,
      [clinicId, templateId],
    );
    return rows[0] ? mapProposalTemplateVersionSummary(rows[0]) : null;
  }

  private async getTemplateVersionById(
    clinicId: string,
    versionId: string,
    executor: QueryExecutor = pool,
  ): Promise<ProposalTemplateVersionResponse> {
    const [rows]: any = await executor.execute(
      `${this.templateVersionSelectSql()}
       WHERE v.id = ?
         AND v.clinic_id = ?
       LIMIT 1`,
      [versionId, clinicId],
    );
    if (rows.length === 0) throw ApiError.notFound("Template version not found");
    return mapProposalTemplateVersion(rows[0]);
  }

  private async getLatestTemplateSourceVersion(
    clinicId: string,
    templateId: string,
  ): Promise<ProposalTemplateVersionResponse | null> {
    const [rows]: any = await pool.execute(
      `${this.templateVersionSelectSql()}
       WHERE v.clinic_id = ?
         AND v.template_id = ?
         AND v.status IN ('published', 'approved', 'rejected', 'draft')
       ORDER BY CASE v.status WHEN 'published' THEN 0 WHEN 'approved' THEN 1 WHEN 'rejected' THEN 2 ELSE 3 END,
                v.version_number DESC
       LIMIT 1`,
      [clinicId, templateId],
    );
    return rows[0] ? mapProposalTemplateVersion(rows[0]) : null;
  }

  private async nextTemplateVersionNumber(clinicId: string, templateKey: string) {
    const [rows]: any = await pool.execute(
      `SELECT COALESCE(MAX(version_number), 0) + 1 as nextVersion
       FROM proposal_template_version
       WHERE clinic_id = ?
         AND template_key = ?`,
      [clinicId, templateKey],
    );
    return Number(rows[0]?.nextVersion || 1);
  }

  private async insertTemplateVersion(
    executor: QueryExecutor,
    input: {
      clinicId: string;
      templateId: string;
      templateKey: string;
      versionNumber: number;
      content: ProposalTemplateContent;
      status: ProposalTemplateVersionStatus;
      userId: string | null;
      sourceVersionId: string | null;
      changeSummary: string | null;
    },
  ) {
    const id = uuidv4();
    const contentHash = hashTemplateContent(input.content);
    const lifecycleColumns = input.status === "published"
      ? ", submitted_by, approved_by, published_by, submitted_at, approved_at, published_at"
      : "";
    const lifecyclePlaceholders = input.status === "published"
      ? ", ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP"
      : "";
    const lifecycleValues = input.status === "published"
      ? [input.userId, input.userId, input.userId]
      : [];
    await executor.execute(
      `INSERT INTO proposal_template_version
        (id, clinic_id, template_id, template_key, version_number, content, content_hash,
         status, source_version_id, created_by, change_summary${lifecycleColumns})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${lifecyclePlaceholders})`,
      [
        id,
        input.clinicId,
        input.templateId,
        input.templateKey,
        input.versionNumber,
        JSON.stringify(input.content),
        contentHash,
        input.status,
        input.sourceVersionId,
        input.userId,
        input.changeSummary,
        ...lifecycleValues,
      ],
    );
    return id;
  }

  private async transitionTemplateVersion(
    clinicId: string,
    userId: string,
    templateId: string,
    versionId: string,
    action: "submit" | "approve" | "reject",
    rejectionReason: string | null = null,
  ) {
    const existing = await this.getTemplateVersionById(clinicId, versionId);
    if (existing.templateId !== templateId) throw ApiError.notFound("Template version not found");
    const transitions: Record<typeof action, { from: ProposalTemplateVersionStatus[]; to: ProposalTemplateVersionStatus; sql: string; audit: string }> = {
      submit: {
        from: ["draft"],
        to: "in_review",
        sql: "status = 'in_review', submitted_by = ?, submitted_at = CURRENT_TIMESTAMP",
        audit: "PROPOSAL_TEMPLATE_VERSION_SUBMITTED",
      },
      approve: {
        from: ["in_review"],
        to: "approved",
        sql: "status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP",
        audit: "PROPOSAL_TEMPLATE_VERSION_APPROVED",
      },
      reject: {
        from: ["in_review"],
        to: "rejected",
        sql: "status = 'rejected', rejected_by = ?, rejected_at = CURRENT_TIMESTAMP, rejection_reason = ?",
        audit: "PROPOSAL_TEMPLATE_VERSION_REJECTED",
      },
    };
    const transition = transitions[action];
    if (!transition.from.includes(existing.status)) {
      throw ApiError.conflict(`Template version cannot move from ${existing.status} using ${action}`);
    }
    const values = action === "reject"
      ? [userId, rejectionReason, versionId, clinicId, templateId, existing.status]
      : [userId, versionId, clinicId, templateId, existing.status];
    const [result]: any = await pool.execute(
      `UPDATE proposal_template_version
       SET ${transition.sql},
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?
         AND template_id = ?
         AND status = ?`,
      values,
    );
    if (Number(result.affectedRows || 0) !== 1) throw ApiError.conflict("Template version changed while updating status");
    await this.logTemplateAudit(clinicId, userId, transition.audit, versionId, {
      templateId,
      versionNumber: existing.versionNumber,
      previousStatus: existing.status,
      status: transition.to,
      rejectionReason,
    });
    return this.getTemplateVersionById(clinicId, versionId);
  }

  private async syncTemplateLibraryFromVersion(
    executor: QueryExecutor,
    versionId: string,
    clinicId: string,
  ) {
    const version = await this.getTemplateVersionById(clinicId, versionId, executor);
    const content = version.content;
    await executor.execute(
      `UPDATE proposal_template
       SET name = ?,
           description = ?,
           default_sections = ?,
           default_roadmap = ?,
           default_success_metrics = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?`,
      [
        cleanString(content.name),
        cleanString(content.description),
        JSON.stringify(content.defaultSections || {}),
        JSON.stringify(content.defaultRoadmap || []),
        JSON.stringify(content.defaultSuccessMetrics || []),
        version.templateId,
        clinicId,
      ],
    );
  }

  private async logTemplateAudit(
    clinicId: string,
    userId: string,
    action: string,
    entityId: string,
    changes: Record<string, unknown>,
  ) {
    await logAuditEvent({
      clinicId,
      userId,
      action,
      entityType: "proposal_template_version",
      entityId,
      changes,
    });
  }

  private async resolveTemplateVersionForProposal(
    clinicId: string,
    templateKey: string,
    requestedVersionId?: string | null,
  ): Promise<{ templateId: string; versionId: string; versionNumber: number; contentHash: string; status: ProposalTemplateVersionStatus }> {
    const cleanTemplateKey = cleanString(templateKey) || "clinicgrower_v5";
    const query = requestedVersionId
      ? `${this.templateVersionSelectSql()}
         WHERE v.clinic_id = ?
           AND v.id = ?
           AND v.template_key = ?
         LIMIT 1`
      : `${this.templateVersionSelectSql()}
         WHERE v.clinic_id = ?
           AND v.template_key = ?
           AND v.status = 'published'
         ORDER BY v.published_at DESC, v.version_number DESC
         LIMIT 1`;
    const params = requestedVersionId
      ? [clinicId, requestedVersionId, cleanTemplateKey]
      : [clinicId, cleanTemplateKey];
    const [rows]: any = await pool.execute(query, params);
    if (rows.length === 0) {
      throw ApiError.badRequest("Select an approved published proposal template version before using this template.");
    }
    const version = mapProposalTemplateVersion(rows[0]);
    if (version.status !== "published") {
      throw ApiError.conflict("Proposal template version is not published and cannot be used for a client proposal.");
    }
    return {
      templateId: version.templateId,
      versionId: version.id,
      versionNumber: version.versionNumber,
      contentHash: version.contentHash,
      status: version.status,
    };
  }

  private async assertProposalTemplateVersionSendable(
    clinicId: string,
    proposal: ProposalResponse,
  ): Promise<{ templateId: string; versionId: string; versionNumber: number; contentHash: string; status: ProposalTemplateVersionStatus }> {
    const binding = proposal.templateVersionId
      ? await this.resolveTemplateVersionForProposal(clinicId, proposal.templateKey, proposal.templateVersionId)
      : await this.resolveTemplateVersionForProposal(clinicId, proposal.templateKey, null);
    if (proposal.templateVersionId && proposal.templateContentHash && binding.contentHash !== proposal.templateContentHash) {
      throw ApiError.conflict("Proposal template version hash has changed. Create a fresh proposal version before sending.");
    }
    if (proposal.templateVersionId && proposal.templateVersionNumber !== null && binding.versionNumber !== proposal.templateVersionNumber) {
      throw ApiError.conflict("Proposal template version number does not match the saved proposal version.");
    }
    return binding;
  }

  private async refreshProposalCoreData(
    clinicId: string,
    proposalId: string,
    executor: QueryExecutor = pool,
    currentProposal?: ProposalResponse,
  ) {
    const proposal = currentProposal || await this.getProposal(clinicId, proposalId, executor);
    const coreData = buildProposalCoreData(proposal);
    await executor.execute(
      `UPDATE proposal
       SET core_data = ?
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL`,
      [serializeProposalCoreData(coreData) ?? null, proposalId, clinicId],
    );
    return { ...proposal, coreData };
  }

  private assertAcceptedProposalCanBeMutated(
    existing: ProposalResponse,
    data: ProposalMutationDTO,
  ) {
    if (existing.acceptanceRecord) {
      const requestedStatus = data.status || existing.status;
      if (existing.status === "accepted" && requestedStatus === "won") {
        const allowedKeys = new Set([
          "status",
          "wonReason",
          "acceptedByName",
          "acceptedByEmail",
          "acceptedAt",
          "paymentTerms",
        ]);
        const unexpected = Object.keys(data).filter((key) => !allowedKeys.has(key));
        if (unexpected.length === 0) return;
      }

      throw ApiError.conflict(
        "This proposal has been accepted and its accepted version is locked. Create a new proposal version for further changes.",
      );
    }

    const clientVisibleLockedStatuses: ProposalStatus[] = ["sent", "viewed", "follow_up_due", "accepted", "won"];
    if (clientVisibleLockedStatuses.includes(existing.status)) {
      const allowedKeys = new Set([
        "status",
        "followUpAt",
        "viewedAt",
        "acceptedReason",
        "acceptedByName",
        "acceptedByEmail",
        "acceptedAt",
        "legalCompanyName",
        "billingEmail",
        "preferredStartDate",
        "agreementAccepted",
        "confirmationText",
        "acceptanceSource",
        "acceptedIpAddress",
        "acceptedUserAgent",
        "evidenceSha256",
        "paymentTerms",
        "wonAt",
        "wonReason",
        "lostAt",
        "lostReason",
        "objectionType",
      ]);
      const unexpected = Object.keys(data).filter((key) => !allowedKeys.has(key));
      if (unexpected.length > 0) {
        throw ApiError.conflict(
          "This proposal has already been sent or viewed. Create a new proposal version before changing package, price, scope or client-facing copy.",
        );
      }
    }
  }

  private assertV5TerminalProposalHasFrozenSnapshot(
    templateKey: string | null | undefined,
    status: ProposalStatus,
    existing: ProposalResponse | null,
  ) {
    if (!isProposalV5Proposal({ templateKey: templateKey || "" })) return;
    if (!["accepted", "won"].includes(status)) return;
    if (
      existing?.v5Snapshot &&
      existing.v5SnapshotHash &&
      existing.v5SnapshotVersion &&
      existing.v5SnapshotFrozenAt
    ) {
      return;
    }
    throw ApiError.conflict("This V5 proposal must be sent and frozen before it can be accepted or won.");
  }

  private collectClientReadyIssues(input: Parameters<ProposalsService["assertClientReadyProposal"]>[0]) {
    try {
      this.assertClientReadyProposal(input);
      return [];
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 400) {
        const details = error.details as { issues?: unknown } | undefined;
        if (Array.isArray(details?.issues)) return details.issues.map((issue) => String(issue));
        return [error.message];
      }
      throw error;
    }
  }

  private async persistAcceptedProposalMutation(input: {
    clinicId: string;
    userId: string;
    proposalId: string;
    dealId: string | null;
    data: ProposalMutationDTO;
    mutate: (executor: QueryExecutor) => Promise<void>;
    recordMutation: (executor: QueryExecutor, proposal: ProposalResponse) => Promise<void>;
  }) {
    const finalizeMutation = async (executor: QueryExecutor) => {
      await input.mutate(executor);
      if (input.dealId) {
        await executor.execute(
          `UPDATE proposal p
           JOIN deal d
             ON d.id = p.deal_id
            AND d.clinic_id = p.clinic_id
            AND d.deleted_at IS NULL
           SET p.client_account_profile_id = COALESCE(p.client_account_profile_id, d.client_account_profile_id),
               p.updated_at = CURRENT_TIMESTAMP
           WHERE p.id = ?
             AND p.clinic_id = ?
             AND p.deleted_at IS NULL`,
          [input.proposalId, input.clinicId],
        );
      }
      let proposal = await this.getProposal(input.clinicId, input.proposalId, executor);
      proposal = await this.refreshProposalCoreData(input.clinicId, input.proposalId, executor, proposal);
      await input.recordMutation(executor, proposal);
      await this.syncProposalFollowUpTask(input.clinicId, input.userId, proposal, executor);
      await this.ensureAcceptedProposalSnapshot(
        input.clinicId,
        input.userId,
        proposal,
        input.data,
        executor,
      );
      return proposal;
    };

    if (!input.dealId) {
      await this.withTransaction(finalizeMutation);
      return this.getProposal(input.clinicId, input.proposalId);
    }

    await clientAccountsService.convertWonDealToClient(
      input.clinicId,
      input.userId,
      { dealId: input.dealId },
      { role: null },
      {},
      {
        beforeConversion: async (connection) => {
          const proposal = await finalizeMutation(connection);
          await this.moveAcceptedProposalDeal(
            connection,
            input.clinicId,
            input.userId,
            proposal,
          );
        },
        afterConversion: async (connection) => {
          const proposal = await this.getProposal(input.clinicId, input.proposalId, connection);
          const [eventRows]: any = await connection.execute(
            `SELECT id, idempotency_key as idempotencyKey, payload
             FROM proposal_commercial_event
             WHERE clinic_id = ? AND proposal_id = ? AND event_type = 'proposal_accepted'
             ORDER BY created_at DESC
             LIMIT 1`,
            [input.clinicId, input.proposalId],
          );
          if (eventRows[0]) {
            const eventPayload = typeof eventRows[0].payload === "string"
              ? JSON.parse(eventRows[0].payload)
              : eventRows[0].payload;
            await this.ensureClickUpDeliveryProvision(
              connection,
              input.clinicId,
              proposal,
              eventRows[0].id,
              eventRows[0].idempotencyKey,
              eventPayload,
            );
          }
        },
      },
    );
    return this.getProposal(input.clinicId, input.proposalId);
  }

  private async persistLostProposalMutation(input: {
    clinicId: string;
    userId: string;
    proposalId: string;
    dealId: string | null;
    data: ProposalMutationDTO;
    mutate: (executor: QueryExecutor) => Promise<void>;
    recordMutation: (executor: QueryExecutor, proposal: ProposalResponse) => Promise<void>;
    previousProposal?: ProposalResponse;
  }) {
    return this.withTransaction(async (connection) => {
      await input.mutate(connection);
      const proposal = await this.getProposal(input.clinicId, input.proposalId, connection);
      await input.recordMutation(connection, proposal);
      await this.syncProposalFollowUpTask(input.clinicId, input.userId, proposal, connection);
      await this.syncLostProposalRelations(
        connection,
        input.clinicId,
        input.userId,
        proposal,
        input.previousProposal,
      );
      return proposal;
    });
  }

  private async syncLostProposalRelations(
    executor: QueryExecutor,
    clinicId: string,
    userId: string,
    proposal: ProposalResponse,
    previousProposal?: ProposalResponse,
  ) {
    let deal: {
      id: string;
      pipelineId: string;
      stageId: string | null;
      stageName: string | null;
      status: string;
      contactId: string;
      clientAccountProfileId: string | null;
    } | null = null;

    if (proposal.dealId) {
      const [dealRows]: any = await executor.execute(
        `SELECT d.id,
                d.pipeline_id as pipelineId,
                d.pipeline_stage_id as stageId,
                COALESCE(ps.name, d.stage) as stageName,
                d.status,
                d.contact_id as contactId,
                d.client_account_profile_id as clientAccountProfileId
         FROM deal d
         LEFT JOIN pipeline_stage ps
           ON ps.id = d.pipeline_stage_id
          AND ps.clinic_id = d.clinic_id
          AND ps.deleted_at IS NULL
         WHERE d.id = ?
           AND d.clinic_id = ?
           AND d.deleted_at IS NULL
         LIMIT 1
         FOR UPDATE`,
        [proposal.dealId, clinicId],
      );
      deal = dealRows[0] || null;
      if (!deal) throw ApiError.notFound("Linked opportunity not found");
    }

    const contactId = proposal.contactId || deal?.contactId || null;
    if (contactId) {
      await executor.execute(
        `UPDATE contact
         SET lost_reason = ?,
             objection_type = ?,
             lead_status = CASE
               WHEN lead_status IN ('client', 'converted')
                 OR ? IS NOT NULL
                 OR LOWER(COALESCE(status, '')) = 'client'
               THEN 'converted'
               ELSE 'lost'
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND clinic_id = ?
           AND deleted_at IS NULL`,
        [
          proposal.lostReason,
          proposal.objectionType,
          deal?.clientAccountProfileId || proposal.clientAccountProfileId,
          contactId,
          clinicId,
        ],
      );
    }
    if (!proposal.dealId || !deal) return;

    const [stageRows]: any = await executor.execute(
      `SELECT id, name
       FROM pipeline_stage
       WHERE clinic_id = ?
         AND pipeline_id = ?
         AND kind = 'lost'
         AND deleted_at IS NULL
       ORDER BY position ASC
       LIMIT 1`,
      [clinicId, deal.pipelineId],
    );
    const targetStage = stageRows[0];
    if (!targetStage) {
      throw ApiError.badRequest("The linked opportunity pipeline does not have a Lost stage.");
    }
    if (deal.stageId === targetStage.id && deal.status === "lost") {
      await executor.execute(
        `UPDATE deal
         SET sold_at = NULL,
             lost_at = COALESCE(lost_at, ?),
             lost_reason = ?,
             objection_type = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND clinic_id = ?
           AND pipeline_stage_id = ?
           AND status = 'lost'
           AND deleted_at IS NULL`,
        [
          toMysqlDateTime(proposal.lostAt),
          proposal.lostReason,
          proposal.objectionType,
          proposal.dealId,
          clinicId,
          targetStage.id,
        ],
      );
      return;
    }

    const moved = await movePipelineDealStage(
      clinicId,
      proposal.dealId,
      {
        stageId: targetStage.id,
        stageName: targetStage.name,
        status: "lost",
        soldAt: null,
        lostAt: toMysqlDateTime(proposal.lostAt),
        lostReason: proposal.lostReason,
        objectionType: proposal.objectionType,
      },
      deal.stageId,
      executor,
    );
    if (moved !== 1) {
      throw ApiError.conflict("Opportunity moved while this proposal was being marked lost.");
    }

    const movementId = uuidv4();
    await insertPipelineDealMovement({
      id: movementId,
      clinicId,
      dealId: proposal.dealId,
      pipelineId: deal.pipelineId,
      fromStageId: deal.stageId,
      toStageId: targetStage.id,
      fromStage: deal.stageName,
      toStage: targetStage.name,
      movedBy: userId,
      metadata: {
        source: "proposal",
        proposalId: proposal.id,
        previousProposalStatus: previousProposal?.status || null,
        proposalStatus: proposal.status,
        reason: proposal.lostReason,
        objectionType: proposal.objectionType,
      },
    }, executor);
    await insertTimelineActivity(executor, {
      clinicId,
      contactId: deal.contactId,
      type: "StatusChange",
      userId,
      metadata: buildTimelineMetadata({
        action: phase1TimelineActions.leadStageChanged,
        source: "pipeline",
        recordId: proposal.dealId,
        changes: {
          fromStage: deal.stageName,
          toStage: targetStage.name,
          proposalId: proposal.id,
          lostReason: proposal.lostReason,
          objectionType: proposal.objectionType,
        },
      }),
    });
    await insertAuditEvent(executor, {
      clinicId,
      userId,
      action: "PIPELINE_DEAL_MOVED",
      entityType: "deal",
      entityId: proposal.dealId,
      changes: {
        fromStage: deal.stageName,
        toStage: targetStage.name,
        movementId,
        proposalId: proposal.id,
        lostReason: proposal.lostReason,
        objectionType: proposal.objectionType,
      },
    });
    await insertAuditEvent(executor, {
      clinicId,
      userId,
      action: "PROPOSAL_SYNCED_DEAL_STAGE",
      entityType: "deal",
      entityId: proposal.dealId,
      changes: {
        proposalId: proposal.id,
        previousStage: deal.stageName,
        nextStage: targetStage.name,
        previousStatus: deal.status,
        nextStatus: "lost",
        reason: proposal.lostReason,
        objectionType: proposal.objectionType,
      },
    });
  }

  private async moveAcceptedProposalDeal(
    executor: QueryExecutor,
    clinicId: string,
    userId: string,
    proposal: ProposalResponse,
  ) {
    if (!proposal.dealId) return;
    const [dealRows]: any = await executor.execute(
      `SELECT d.id,
              d.pipeline_id as pipelineId,
              d.pipeline_stage_id as stageId,
              COALESCE(ps.name, d.stage) as stageName,
              d.status,
              d.contact_id as contactId
       FROM deal d
       LEFT JOIN pipeline_stage ps
         ON ps.id = d.pipeline_stage_id
        AND ps.clinic_id = d.clinic_id
        AND ps.deleted_at IS NULL
       WHERE d.id = ?
         AND d.clinic_id = ?
         AND d.deleted_at IS NULL
       LIMIT 1
       FOR UPDATE`,
      [proposal.dealId, clinicId],
    );
    const deal = dealRows[0];
    if (!deal) throw ApiError.notFound("Linked opportunity not found");

    const [stageRows]: any = await executor.execute(
      `SELECT id, name
       FROM pipeline_stage
       WHERE clinic_id = ?
         AND pipeline_id = ?
         AND kind = 'won'
         AND deleted_at IS NULL
       ORDER BY position ASC
       LIMIT 1`,
      [clinicId, deal.pipelineId],
    );
    const targetStage = stageRows[0];
    if (!targetStage) {
      throw ApiError.badRequest("The linked opportunity pipeline does not have a Won stage.");
    }
    if (deal.stageId === targetStage.id && deal.status === "won") return;

    const moved = await movePipelineDealStage(
      clinicId,
      proposal.dealId,
      {
        stageId: targetStage.id,
        stageName: targetStage.name,
        status: "won",
        ...(proposal.valueCents !== null ? { value: centsToValue(proposal.valueCents) } : {}),
        soldAt: toMysqlDateTime(proposal.wonAt || proposal.acceptedAt),
        lostAt: null,
        lostReason: null,
        objectionType: null,
      },
      deal.stageId,
      executor,
    );
    if (moved !== 1) {
      throw ApiError.conflict("Opportunity moved while this proposal was being accepted.");
    }

    const movementId = uuidv4();
    await insertPipelineDealMovement({
      id: movementId,
      clinicId,
      dealId: proposal.dealId,
      pipelineId: deal.pipelineId,
      fromStageId: deal.stageId || null,
      toStageId: targetStage.id,
      fromStage: deal.stageName || null,
      toStage: targetStage.name,
      movedBy: userId,
      metadata: {
        source: "proposal",
        proposalId: proposal.id,
        proposalStatus: proposal.status,
        reason: proposal.wonReason || proposal.acceptedReason || null,
      },
    }, executor);
    await insertTimelineActivity(executor, {
      clinicId,
      contactId: deal.contactId,
      type: "StatusChange",
      userId,
      metadata: buildTimelineMetadata({
        action: phase1TimelineActions.leadStageChanged,
        source: "pipeline",
        recordId: proposal.dealId,
        changes: {
          fromStage: deal.stageName || null,
          toStage: targetStage.name,
          proposalId: proposal.id,
        },
      }),
    });
    await insertAuditEvent(executor, {
      clinicId,
      userId,
      action: "PIPELINE_DEAL_MOVED",
      entityType: "deal",
      entityId: proposal.dealId,
      changes: {
        fromStage: deal.stageName || null,
        toStage: targetStage.name,
        movementId,
        proposalId: proposal.id,
      },
    });
    await insertAuditEvent(executor, {
      clinicId,
      userId,
      action: "PROPOSAL_SYNCED_DEAL_STAGE",
      entityType: "deal",
      entityId: proposal.dealId,
      changes: {
        proposalId: proposal.id,
        previousStage: deal.stageName || null,
        nextStage: targetStage.name,
        previousStatus: deal.status,
        nextStatus: "won",
        reason: proposal.wonReason || proposal.acceptedReason || null,
      },
    });
  }

  private async recordProposalUpdate(
    executor: QueryExecutor | null,
    clinicId: string,
    userId: string,
    proposalId: string,
    existing: ProposalResponse,
    updated: ProposalResponse,
    data: ProposalMutationDTO,
  ) {
    if (existing.status !== updated.status) {
      await this.logProposalActivity({
        clinicId,
        userId,
        contactId: updated.contactId,
        clientAccountProfileId: updated.clientAccountProfileId,
        proposalId,
        action: "proposal_status_changed",
        title: updated.proposalName,
        status: updated.status,
        previousStatus: existing.status,
        changes: {
          previousStatus: existing.status,
          status: updated.status,
          followUpAt: updated.followUpAt,
          acceptedReason: updated.acceptedReason,
          wonReason: updated.wonReason,
          lostReason: updated.lostReason,
          objectionType: updated.objectionType,
        },
      }, executor || undefined);
    } else {
      await this.logProposalActivity({
        clinicId,
        userId,
        contactId: updated.contactId,
        clientAccountProfileId: updated.clientAccountProfileId,
        proposalId,
        action: "proposal_updated",
        title: updated.proposalName,
        status: updated.status,
        changes: data as Record<string, unknown>,
      }, executor || undefined);
    }
    const auditPayload = {
      clinicId,
      userId,
      action: existing.status !== updated.status ? "PROPOSAL_STATUS_CHANGED" : "PROPOSAL_UPDATED",
      entityType: "proposal",
      entityId: proposalId,
      changes: this.buildProposalAuditChanges(existing, updated, data),
    };
    if (executor) {
      await insertAuditEvent(executor, auditPayload);
    } else {
      await logAuditEvent(auditPayload);
    }
  }

  private async resolveProposalLinks(
    clinicId: string,
    data: ProposalMutationDTO,
    access: ProposalLinkAccess,
    existingLinks: {
      existingClientAccountProfileId?: string | null;
      existingContactId?: string | null;
      existingDealId?: string | null;
    } = {},
  ) {
    let contactId = cleanString(data.contactId);
    let resolvedContactName: string | null = null;
    let resolvedAccountName: string | null = null;
    let resolvedClientAccountName: string | null = null;
    const dealId = cleanString(data.dealId);
    const clientAccountProfileId = cleanString(data.clientAccountProfileId);

    if (!contactId && !dealId && !clientAccountProfileId) {
      throw ApiError.badRequest("Proposal must link to a lead/contact, deal, or client account");
    }

    if (dealId) {
      const [dealRows]: any = await pool.execute(
        `SELECT id, contact_id as contactId
         FROM deal
         WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [dealId, clinicId],
      );
      if (dealRows.length === 0) throw ApiError.notFound("Deal not found");
      if (contactId && contactId !== dealRows[0].contactId) {
        throw ApiError.badRequest("Proposal contact must match the linked deal contact");
      }
      contactId = dealRows[0].contactId;
    }

    if (contactId) {
      const [contactRows]: any = await pool.execute(
        `SELECT id,
                first_name as firstName,
                last_name as lastName,
                account_name as accountName
         FROM contact
         WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [contactId, clinicId],
      );
      if (contactRows.length === 0) throw ApiError.notFound("Contact not found");
      resolvedContactName = [contactRows[0].firstName, contactRows[0].lastName].filter(Boolean).join(" ").trim() || null;
      resolvedAccountName = cleanString(contactRows[0].accountName);
    }

    if (clientAccountProfileId) {
      const [accountRows]: any = await pool.execute(
        `SELECT cap.id, cap.clinic_id as clientClinicId, c.name as clientAccountName
         FROM client_account_profile cap
         JOIN clinic c
           ON c.id = cap.clinic_id
          AND c.deleted_at IS NULL
         WHERE cap.id = ?
         LIMIT 1`,
        [clientAccountProfileId],
      );
      if (accountRows.length === 0) throw ApiError.notFound("Client account not found");
      const preservesExistingLink =
        clientAccountProfileId === existingLinks.existingClientAccountProfileId &&
        contactId === existingLinks.existingContactId &&
        dealId === existingLinks.existingDealId;
      if (
        accountRows[0].clientClinicId !== clinicId &&
        !access.canManageAllClientAccounts &&
        !preservesExistingLink
      ) {
        throw ApiError.forbidden("Client account is not available to this workspace");
      }
      resolvedClientAccountName = cleanString(accountRows[0].clientAccountName);
    }

    if (data.ownerId) await this.ensureActiveOwner(clinicId, String(data.ownerId));

    return { contactId, contactName: resolvedContactName, dealId, clientAccountProfileId, accountName: resolvedAccountName, clientAccountName: resolvedClientAccountName };
  }

  private buildProposalAuditChanges(
    existing: ProposalResponse,
    updated: ProposalResponse,
    data: ProposalMutationDTO,
  ) {
    const trackedFields: Array<keyof ProposalResponse & keyof ProposalMutationDTO> = [
      "contactId",
      "dealId",
      "clientAccountProfileId",
      "proposalName",
      "templateKey",
      "packageName",
      "recommendedPackageId",
      "ownerId",
      "status",
      "valueCents",
      "monthlyFeeCents",
      "setupFeeCents",
      "currency",
      "adSpendNote",
      "vatStatus",
      "minimumTermMonths",
      "noticePeriodDays",
      "startDate",
      "followUpAt",
      "acceptedReason",
      "wonReason",
      "lostReason",
      "objectionType",
      "proposalUrl",
      "notes",
      "addOns",
      "discounts",
      "internalMarginNote",
      "sectionContent",
    ];
    const changes: Record<string, { before: unknown; after: unknown }> = {};

    for (const field of trackedFields) {
      const requested = Object.prototype.hasOwnProperty.call(data, field);
      const changed = JSON.stringify(existing[field]) !== JSON.stringify(updated[field]);
      if (!requested && !changed) continue;
      changes[field] = {
        before: existing[field] ?? null,
        after: updated[field] ?? null,
      };
    }

    return changes;
  }

  private async getProposalContactSource(clinicId: string, contactId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              first_name as firstName,
              last_name as lastName,
              email,
              phone,
              role_title as roleTitle,
              account_name as accountName,
              website,
              city,
              state,
              country,
              source,
              package_interest as packageInterest,
              recommended_package as recommendedPackage,
              treatment_interests as treatmentInterests,
              growth_score_overall as growthScoreOverall,
              growth_score_categories as growthScoreCategories,
              growth_score_website_visibility as growthScoreWebsiteVisibility,
              growth_score_seo as growthScoreSeo,
              growth_score_gbp as growthScoreGbp,
              growth_score_tracking as growthScoreTracking,
              growth_score_conversion as growthScoreConversion,
              growth_score_lead_handling as growthScoreLeadHandling,
              growth_score_response_speed as growthScoreResponseSpeed,
              growth_score_enquiry_visibility as growthScoreEnquiryVisibility,
              growth_score_treatment_performance as growthScoreTreatmentPerformance,
              growth_score_revenue_leakage as growthScoreRevenueLeakage,
              growth_score_growth_opportunity as growthScoreGrowthOpportunity,
              growth_score_recommended_package as growthScoreRecommendedPackage,
              growth_score_gap_summary as growthScoreGapSummary,
              growth_score_updated_at as growthScoreUpdatedAt,
              audit_status as auditStatus,
              audit_follow_up_due_at as auditFollowUpDueAt,
              audit_status_updated_at as auditStatusUpdatedAt
       FROM contact
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [contactId, clinicId],
    );
    if (rows.length === 0) throw ApiError.notFound("Contact not found");
    return rows[0];
  }

  private async getProposalClientAccountSource(
    clinicId: string,
    clientAccountProfileId: string,
    access: ProposalLinkAccess,
  ) {
    const [rows]: any = await pool.execute(
      `SELECT cap.id,
              cap.clinic_id as clientClinicId,
              c.name as clientName,
              c.email as clientEmail,
              c.phone as clientPhone,
              c.city,
              c.state,
              c.country,
              cap.current_package as currentPackage,
              cap.recommended_next_package as recommendedNextPackage,
              cap.upsell_opportunity as upsellOpportunity,
              cap.growth_score_overall as growthScoreOverall,
              cap.growth_score_categories as growthScoreCategories,
              cap.growth_score_website_visibility as growthScoreWebsiteVisibility,
              cap.growth_score_seo as growthScoreSeo,
              cap.growth_score_gbp as growthScoreGbp,
              cap.growth_score_tracking as growthScoreTracking,
              cap.growth_score_conversion as growthScoreConversion,
              cap.growth_score_lead_handling as growthScoreLeadHandling,
              cap.growth_score_response_speed as growthScoreResponseSpeed,
              cap.growth_score_enquiry_visibility as growthScoreEnquiryVisibility,
              cap.growth_score_treatment_performance as growthScoreTreatmentPerformance,
              cap.growth_score_revenue_leakage as growthScoreRevenueLeakage,
              cap.growth_score_growth_opportunity as growthScoreGrowthOpportunity,
              cap.growth_score_recommended_package as growthScoreRecommendedPackage,
              cap.growth_score_gap_summary as growthScoreGapSummary,
              cap.growth_score_updated_at as growthScoreUpdatedAt
       FROM client_account_profile cap
       JOIN clinic c
         ON c.id = cap.clinic_id
        AND c.deleted_at IS NULL
       WHERE cap.id = ?
       LIMIT 1`,
      [clientAccountProfileId],
    );
    if (rows.length === 0) throw ApiError.notFound("Client account not found");
    if (rows[0].clientClinicId !== clinicId && !access.canManageAllClientAccounts) {
      throw ApiError.forbidden("Client account is not available to this workspace");
    }
    return rows[0];
  }

  private async findRecommendedPackageByName(clinicId: string, packageName: string | null) {
    const cleanPackageName = cleanString(packageName);
    if (!cleanPackageName) return null;
    const [rows]: any = await pool.execute(
      `SELECT id,
              name,
              price_cents as priceCents,
              setup_fee_cents as setupFeeCents,
              currency,
              billing_frequency as billingFrequency,
              included_features as includedFeatures,
              proposal_wording as proposalWording
       FROM growth_package
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         AND status <> 'archived'
         AND (LOWER(name) = LOWER(?) OR LOWER(?) LIKE CONCAT('%', LOWER(name), '%'))
       ORDER BY
         CASE WHEN LOWER(name) = LOWER(?) THEN 0 ELSE 1 END,
         sort_order ASC,
         name ASC
       LIMIT 1`,
      [clinicId, cleanPackageName, cleanPackageName, cleanPackageName],
    );
    if (rows.length === 0) return null;
    return {
      id: rows[0].id,
      name: rows[0].name,
      priceCents: rows[0].priceCents === null || rows[0].priceCents === undefined ? null : Number(rows[0].priceCents),
      setupFeeCents: rows[0].setupFeeCents === null || rows[0].setupFeeCents === undefined ? null : Number(rows[0].setupFeeCents),
      currency: rows[0].currency || "GBP",
      billingFrequency: rows[0].billingFrequency || null,
      includedFeatures: parseJsonArray(rows[0].includedFeatures),
      proposalWording: rows[0].proposalWording || null,
    };
  }

  private async getProposalPreviewPackage(
    clinicId: string,
    recommendedPackageId: string | null | undefined,
    packageName: string | null | undefined,
  ) {
    const cleanPackageId = cleanString(recommendedPackageId);
    const cleanPackageName = cleanString(packageName);
    if (!cleanPackageId && !cleanPackageName) return null;

    const values: any[] = [clinicId];
    const matchSql = cleanPackageId
      ? "id = ?"
      : "LOWER(name) = LOWER(?)";
    values.push(cleanPackageId || cleanPackageName);

    const [rows]: any = await pool.execute(
      `SELECT id,
              name,
              price_cents as priceCents,
              setup_fee_cents as setupFeeCents,
              currency,
              billing_frequency as billingFrequency,
              included_features as includedFeatures,
              proposal_wording as proposalWording
       FROM growth_package
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         AND status <> 'archived'
         AND ${matchSql}
       LIMIT 1`,
      values,
    );
    if (rows.length === 0) return null;

    return {
      id: rows[0].id,
      name: rows[0].name,
      priceCents: rows[0].priceCents === null || rows[0].priceCents === undefined ? null : Number(rows[0].priceCents),
      setupFeeCents: rows[0].setupFeeCents === null || rows[0].setupFeeCents === undefined ? null : Number(rows[0].setupFeeCents),
      currency: rows[0].currency || "GBP",
      billingFrequency: rows[0].billingFrequency || null,
      includedFeatures: parseJsonArray(rows[0].includedFeatures),
      proposalWording: rows[0].proposalWording || null,
    };
  }

  private async ensureActiveOwner(clinicId: string, userId: string) {
    const [rows]: any = await pool.execute(
      `SELECT u.id
       FROM user u
       JOIN clinic_membership cm
         ON cm.user_id = u.id
        AND cm.clinic_id = ?
        AND cm.status = 'active'
       WHERE u.id = ?
         AND u.deleted_at IS NULL
         AND u.status = 'active'
         AND u.is_active = 1
       LIMIT 1`,
      [clinicId, userId],
    );
    if (rows.length === 0) {
      throw ApiError.badRequest("Proposal owner must be an active member of this workspace");
    }
  }

  private async resolveRecommendedPackage(clinicId: string, packageId: unknown) {
    const cleanPackageId = cleanString(packageId);
    if (!cleanPackageId) return null;
    const [rows]: any = await pool.execute(
      `SELECT id,
              name,
              price_cents as priceCents,
              setup_fee_cents as setupFeeCents,
              billing_frequency as billingFrequency,
              currency,
              included_features as includedFeatures,
              proposal_wording as proposalWording,
              catalogue_version as catalogueVersion,
              commercial_notes as commercialNotes
       FROM growth_package
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
         AND status <> 'archived'
       LIMIT 1`,
      [cleanPackageId, clinicId],
    );
    if (rows.length === 0) throw ApiError.badRequest("Recommended package must be available to this workspace");
    const row = rows[0];
    return {
      id: row.id as string,
      name: row.name as string,
      priceCents: numberOrNull(row.priceCents),
      setupFeeCents: numberOrNull(row.setupFeeCents),
      billingFrequency: row.billingFrequency,
      currency: row.currency || "GBP",
      includedFeatures: parseJsonArray(row.includedFeatures),
      internalNotes: null,
      proposalWording: row.proposalWording || null,
      sortOrder: 0,
      status: "active" as const,
      isDefault: false,
      catalogueVersion: row.catalogueVersion || null,
      commercialNotes: parseJsonObject(row.commercialNotes),
      createdAt: "",
      updatedAt: "",
    };
  }

  private async validateProofAssetIds(clinicId: string, sectionContent: ProposalSectionContent | null | undefined): Promise<ProposalProofAssetResponse[]> {
    const ids = parseProofAssetIds(sectionContent);
    if (ids.length === 0) return [];
    const uniqueIds = [...new Set(ids)];
    const placeholders = uniqueIds.map(() => "?").join(", ");
    const [rows]: any = await pool.execute(
      `SELECT id,
              type,
              title,
              copy,
              media_url as mediaUrl,
              sector_tags as sectorTags,
              sort_order as sortOrder,
              is_active as isActive,
              created_at as createdAt,
              updated_at as updatedAt
       FROM proposal_proof_asset
       WHERE clinic_id = ?
         AND id IN (${placeholders})
         AND is_active = 1
         AND deleted_at IS NULL`,
      [clinicId, ...uniqueIds],
    );
    if (rows.length !== uniqueIds.length) {
      throw ApiError.badRequest("Selected proof assets must be active and available to this workspace");
    }
    const assetsById = new Map(rows.map((row: any) => [row.id, mapProposalProofAsset(row)]));
    return ids
      .map((id) => assetsById.get(id))
      .filter(Boolean) as ProposalProofAssetResponse[];
  }

  private async hydrateSelectedProofAssets(
    clinicId: string,
    proposal: ProposalResponse,
    executor: QueryExecutor = pool,
  ): Promise<ProposalResponse> {
    const sectionContent = proposal.sectionContent;
    const ids = parseProofAssetIds(sectionContent);
    if (ids.length === 0) return proposal;
    const uniqueIds = [...new Set(ids)];
    const placeholders = uniqueIds.map(() => "?").join(", ");
    const [rows]: any = await executor.execute(
      `SELECT id,
              type,
              title,
              copy,
              media_url as mediaUrl,
              sector_tags as sectorTags,
              sort_order as sortOrder,
              is_active as isActive,
              created_at as createdAt,
              updated_at as updatedAt
       FROM proposal_proof_asset
       WHERE clinic_id = ?
         AND id IN (${placeholders})
         AND is_active = 1
         AND deleted_at IS NULL`,
      [clinicId, ...uniqueIds],
    );
    const assetsById = new Map(rows.map((row: any) => [row.id, mapProposalProofAsset(row)]));
    const selectedAssets = ids
      .map((id) => assetsById.get(id))
      .filter(Boolean) as ProposalProofAssetResponse[];

    return {
      ...proposal,
      sectionContent: {
        ...(sectionContent || {}),
        proofAssetIds: ids,
        proofAssets: selectedAssets,
      },
    };
  }

  private async syncProposalFollowUpTask(
    clinicId: string,
    userId: string,
    proposal: ProposalResponse,
    executor: QueryExecutor = pool,
  ) {
    const templateKey = `proposal_follow_up:${proposal.id}`;
    const shouldComplete = !proposal.followUpAt || isFinalProposalStatus(proposal.status);

    if (shouldComplete) {
      await executor.execute(
        `UPDATE task
         SET status = 'completed',
             completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE clinic_id = ?
           AND is_internal = 1
           AND template_key = ?
           AND status <> 'completed'
           AND archived_at IS NULL
           AND deleted_at IS NULL`,
        [clinicId, templateKey],
      );
      return;
    }

    const dueDate = toMysqlDateOnly(proposal.followUpAt);
    const ownerName = proposal.ownerName || "Unassigned";
    const contactNameValue = proposal.contactName || proposal.accountName || proposal.clientAccountName || proposal.proposalName;
    const title = `Follow up proposal: ${proposal.proposalName}`;
    const description = [
      `Proposal status: ${proposal.status.replace(/_/g, " ")}`,
      proposal.proposalUrl ? `Proposal link: ${proposal.proposalUrl}` : "",
      proposal.contactEmail ? `Recipient email: ${proposal.contactEmail}` : "",
    ].filter(Boolean).join("\n");

    const [existingRows]: any = await executor.execute(
      `SELECT id
       FROM task
       WHERE clinic_id = ?
         AND is_internal = 1
         AND template_key = ?
         AND archived_at IS NULL
         AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId, templateKey],
    );

    if (existingRows.length > 0) {
      await executor.execute(
        `UPDATE task
         SET title = ?,
             description = ?,
             priority = 'high',
             status = 'pending',
             category = 'proposal_follow_up',
             board_key = 'sales',
             service_type = 'strategy',
             client_account_profile_id = ?,
             contact_id = ?,
             contact_name = ?,
             due_label = 'Proposal follow-up',
             due_date = ?,
             assigned_to = ?,
             assigned_user_id = ?,
             completed_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND clinic_id = ?
           AND is_internal = 1
           AND deleted_at IS NULL`,
        [
          title,
          description || null,
          proposal.clientAccountProfileId,
          proposal.contactId,
          contactNameValue,
          dueDate,
          ownerName,
          proposal.ownerId,
          existingRows[0].id,
          clinicId,
        ],
      );
      return;
    }

    await executor.execute(
      `INSERT INTO task
        (id, clinic_id, is_internal, title, description, priority, status, category, board_key, service_type,
         client_account_profile_id, contact_id, contact_name, due_label, due_date, assigned_to, assigned_user_id, template_key, created_by)
       VALUES (?, ?, 1, ?, ?, 'high', 'pending', 'proposal_follow_up', 'sales', 'strategy', ?, ?, ?, 'Proposal follow-up', ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        clinicId,
        title,
        description || null,
        proposal.clientAccountProfileId,
        proposal.contactId,
        contactNameValue,
        dueDate,
        ownerName,
        proposal.ownerId,
        templateKey,
        userId,
      ],
    );
  }

  private async syncRelatedDealStage(
    clinicId: string,
    userId: string,
    proposal: ProposalResponse,
    previousProposal?: ProposalResponse,
  ) {
    if (!proposal.dealId || !["sent", "viewed", "follow_up_due"].includes(proposal.status)) return;
    const linkedDealId = proposal.dealId;

    await this.withTransaction(async (connection) => {
      const [dealRows]: any = await connection.execute(
        `SELECT id,
                pipeline_id as pipelineId,
                pipeline_stage_id as stageId,
                stage as stageName,
                status,
                contact_id as contactId,
                (
                  SELECT position
                  FROM pipeline_stage current_stage
                  WHERE current_stage.id = deal.pipeline_stage_id
                    AND current_stage.clinic_id = deal.clinic_id
                    AND current_stage.deleted_at IS NULL
                  LIMIT 1
                ) as stagePosition
         FROM deal
         WHERE id = ?
           AND clinic_id = ?
           AND deleted_at IS NULL
         LIMIT 1
         FOR UPDATE`,
        [linkedDealId, clinicId],
      );
      if (dealRows.length === 0) return;

      const deal = dealRows[0];
      if (deal.status === "won" || deal.status === "lost") return;

      const targetStageNames =
        proposal.status === "follow_up_due"
          ? ["Follow-up Needed", "Follow-Up Needed", "Proposal Sent"]
          : ["Proposal Sent", "Proposal"];
      const [stageRows]: any = await connection.execute(
        `SELECT id,
                name,
                kind,
                position,
                (
                  SELECT MIN(terminal_stage.position)
                  FROM pipeline_stage terminal_stage
                  WHERE terminal_stage.clinic_id = pipeline_stage.clinic_id
                    AND terminal_stage.pipeline_id = pipeline_stage.pipeline_id
                    AND terminal_stage.kind IN ('won', 'lost')
                    AND terminal_stage.deleted_at IS NULL
                ) as earliestTerminalPosition
         FROM pipeline_stage
         WHERE clinic_id = ?
           AND pipeline_id = ?
           AND deleted_at IS NULL
           AND kind = 'open'
         ORDER BY position ASC`,
        [clinicId, deal.pipelineId],
      );
      if (stageRows.length === 0) return;

      const targetStage = this.selectProposalOpenStage(stageRows, proposal.status, targetStageNames);
      if (!targetStage) return;
      if (
        deal.stagePosition !== null &&
        deal.stagePosition !== undefined &&
        Number(targetStage.position) <= Number(deal.stagePosition)
      ) {
        return;
      }
      if (deal.stageId === targetStage.id && deal.status === "open") return;

      const [moveResult]: any = await connection.execute(
        `UPDATE deal
         SET pipeline_stage_id = ?,
             stage = ?,
             status = 'open',
             stage_changed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND clinic_id = ?
           AND pipeline_stage_id <=> ?
           AND status = ?
           AND deleted_at IS NULL`,
        [
          targetStage.id,
          targetStage.name,
          linkedDealId,
          clinicId,
          deal.stageId,
          deal.status,
        ],
      );
      if (Number(moveResult.affectedRows || 0) !== 1) {
        throw ApiError.conflict("Opportunity moved while this proposal stage was being synchronized.");
      }

      await insertPipelineDealMovement({
        id: uuidv4(),
        clinicId,
        dealId: linkedDealId,
        pipelineId: deal.pipelineId,
        fromStageId: deal.stageId || null,
        toStageId: targetStage.id,
        fromStage: deal.stageName || null,
        toStage: targetStage.name,
        movedBy: userId,
        metadata: {
          source: "proposal",
          proposalId: proposal.id,
          previousProposalStatus: previousProposal?.status || null,
          proposalStatus: proposal.status,
        },
      }, connection);
      await insertAuditEvent(connection, {
        clinicId,
        userId,
        action: "PROPOSAL_SYNCED_DEAL_STAGE",
        entityType: "deal",
        entityId: linkedDealId,
        changes: {
          proposalId: proposal.id,
          previousStage: deal.stageName || null,
          nextStage: targetStage.name,
          previousStatus: deal.status,
          nextStatus: "open",
        },
      });
    });
  }

  private selectProposalOpenStage(
    stages: Array<{
      id: string;
      name: string;
      kind: string;
      position: number;
      earliestTerminalPosition?: number | null;
    }>,
    status: ProposalStatus,
    exactNames: string[],
  ) {
    if (stages.length === 0) return null;
    const earliestTerminalPosition = stages
      .map((stage) => Number(stage.earliestTerminalPosition))
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0];
    const eligibleStages = earliestTerminalPosition === undefined
      ? stages
      : stages.filter((stage) => Number(stage.position) < earliestTerminalPosition);
    if (eligibleStages.length === 0) return null;

    const exact = new Set(exactNames.map((name) => name.toLowerCase()));
    const exactMatches = eligibleStages.filter((stage) => exact.has(stage.name.toLowerCase()));
    if (exactMatches.length > 0) return exactMatches[exactMatches.length - 1];

    const semanticPattern = status === "follow_up_due"
      ? /(follow[\s_-]*up|decision|pending|review|negotiat)/i
      : /(proposal|quote|estimate|commercial|offer|decision|contract|review)/i;
    const semanticMatches = eligibleStages.filter((stage) => semanticPattern.test(stage.name));
    if (semanticMatches.length > 0) return semanticMatches[semanticMatches.length - 1];

    // Pipelines may use fully custom labels. In that case, the last configured
    // open stage is the safest default proposal stage before won/lost.
    return eligibleStages[eligibleStages.length - 1];
  }

  private async validateRelatedDealOutcome(
    clinicId: string,
    outcome: {
      dealId: string | null;
      status: ProposalStatus;
      valueCents: number | null | undefined;
    },
  ) {
    if (!outcome.dealId || !["accepted", "won", "lost"].includes(outcome.status)) return;

    const targetKind = outcome.status === "lost" ? "lost" : "won";
    const [rows]: any = await pool.execute(
      `SELECT d.value,
              d.treatment,
              EXISTS (
                SELECT 1
                FROM pipeline_stage ps
                WHERE ps.clinic_id = d.clinic_id
                  AND ps.pipeline_id = d.pipeline_id
                  AND ps.kind = ?
                  AND ps.deleted_at IS NULL
              ) as hasTargetStage
       FROM deal d
       WHERE d.id = ?
         AND d.clinic_id = ?
         AND d.deleted_at IS NULL
       LIMIT 1`,
      [targetKind, outcome.dealId, clinicId],
    );
    if (rows.length === 0) throw ApiError.notFound("Linked opportunity not found");
    if (!Boolean(rows[0].hasTargetStage)) {
      throw ApiError.badRequest(
        `The linked opportunity pipeline does not have a ${targetKind === "won" ? "Won" : "Lost"} stage.`,
      );
    }
    if (targetKind !== "won") return;

    const effectiveValueCents = outcome.valueCents ?? Math.round(Number(rows[0].value || 0) * 100);
    if (!effectiveValueCents || effectiveValueCents <= 0) {
      throw ApiError.badRequest("A positive proposal or opportunity value is required before accepting the proposal.");
    }
    if (!cleanString(rows[0].treatment)) {
      throw ApiError.badRequest("Service / Package is required on the linked opportunity before accepting the proposal.");
    }
  }

  private async resolvePublicAcceptanceActorUserId(
    clinicId: string,
    proposal: ProposalResponse,
  ) {
    const candidates = [proposal.ownerId, proposal.createdBy, proposal.updatedBy]
      .map((value) => cleanString(value))
      .filter(Boolean) as string[];

    if (candidates.length) {
      const placeholders = candidates.map(() => "?").join(", ");
      const [candidateRows]: any = await pool.execute(
        `SELECT id
         FROM user
         WHERE clinic_id = ?
           AND id IN (${placeholders})
           AND deleted_at IS NULL
           AND COALESCE(is_active, 1) = 1
         LIMIT 1`,
        [clinicId, ...candidates],
      );
      if (candidateRows[0]?.id) return candidateRows[0].id as string;
    }

    const [rows]: any = await pool.execute(
      `SELECT id
       FROM user
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         AND COALESCE(is_active, 1) = 1
       ORDER BY FIELD(role, 'SUPER_ADMIN', 'ADMIN', 'SALES') DESC,
                created_at ASC
       LIMIT 1`,
      [clinicId],
    );
    if (!rows[0]?.id) {
      throw ApiError.badRequest("This proposal cannot be accepted until the workspace has an active internal owner.");
    }
    return rows[0].id as string;
  }

  private async ensureAcceptedProposalSnapshot(
    clinicId: string,
    userId: string,
    proposal: ProposalResponse,
    data: ProposalMutationDTO = {},
    executor: QueryExecutor = pool,
  ) {
    if (!["accepted", "won"].includes(proposal.status)) return;

    const clientAccountProfileId = await this.resolveAcceptanceClientAccountProfileId(
      clinicId,
      proposal,
      executor,
    );
    const priorAcceptance = proposal.acceptanceRecord;
    if (priorAcceptance) {
      await executor.execute(
        `UPDATE proposal_acceptance_record
         SET acceptance_status = ?,
             client_account_profile_id = COALESCE(?, client_account_profile_id),
             updated_at = CURRENT_TIMESTAMP
         WHERE proposal_id = ?
           AND clinic_id = ?
           AND deleted_at IS NULL`,
        [
          proposal.status === "won" ? "won" : priorAcceptance.acceptanceStatus,
          clientAccountProfileId,
          proposal.id,
          clinicId,
        ],
      );
      await this.ensureProposalCommercialAcceptanceEvent(
        executor,
        clinicId,
        userId,
        proposal,
        priorAcceptance.id,
      );
      return;
    }
    const acceptedByName = cleanString(data.acceptedByName);
    const acceptedByEmail = cleanString(data.acceptedByEmail);
    if (!acceptedByName || !acceptedByEmail) {
      throw ApiError.badRequest(
        "Accepted by name and email are required the first time a proposal is accepted.",
      );
    }
    const acceptedAt =
      toMysqlDateTime(data.acceptedAt) ||
      toMysqlDateTime(proposal.acceptedAt) ||
      toMysqlDateTime(proposal.wonAt) ||
      new Date().toISOString().slice(0, 19).replace("T", " ");
    const paymentTerms =
      cleanString(data.paymentTerms) ||
      "Monthly fees payable monthly in advance. Setup fee due before project kickoff unless otherwise agreed.";
    const legalCompanyName = cleanString(data.legalCompanyName);
    const billingEmail = cleanString(data.billingEmail);
    const preferredStartDate = toMysqlDateOnly(data.preferredStartDate);
    const agreementAccepted = data.agreementAccepted === true;
    const confirmationText = cleanString(data.confirmationText);
    const acceptanceSource = cleanString(data.acceptanceSource) || "internal";
    const acceptedIpAddress = cleanString(data.acceptedIpAddress);
    const acceptedUserAgent = cleanString(data.acceptedUserAgent);
    const evidenceSha256 = cleanString(data.evidenceSha256);
    const sectionContent = proposal.sectionContent || {};
    const coreData = proposal.coreData || buildProposalCoreData(proposal);
    const scope = {
      packageName: proposal.packageName,
      includedFeatures: Array.isArray(sectionContent.includedFeatures) ? sectionContent.includedFeatures : [],
      recommendedPlan: sectionContent.recommendedPlan || null,
      timeline: sectionContent.timeline || null,
      nextSteps: sectionContent.nextSteps || null,
      addOns: proposal.addOns,
      discounts: proposal.discounts,
    };
    const commercialSnapshot = {
      packageName: proposal.packageName,
      recommendedPackageId: proposal.recommendedPackageId,
      monthlyFeeCents: proposal.monthlyFeeCents,
      setupFeeCents: proposal.setupFeeCents,
      adSpendNote: proposal.adSpendNote,
      vatStatus: proposal.vatStatus,
      currency: proposal.currency,
      paymentTerms,
      startDate: proposal.startDate,
      minimumTermMonths: proposal.minimumTermMonths,
      noticePeriodDays: proposal.noticePeriodDays,
      valueCents: proposal.valueCents,
    };
    const proposalSnapshot = {
      id: proposal.id,
      proposalName: proposal.proposalName,
      templateKey: proposal.templateKey,
      status: proposal.status,
      proposalUrl: proposal.proposalUrl,
      contactId: proposal.contactId,
      dealId: proposal.dealId,
      clientAccountProfileId,
      contactName: proposal.contactName,
      contactEmail: proposal.contactEmail,
      accountName: proposal.accountName,
      clientAccountName: proposal.clientAccountName,
      sectionContent,
      notes: proposal.notes,
      acceptedReason: proposal.acceptedReason,
      wonReason: proposal.wonReason,
      legalCompanyName,
      billingEmail,
      preferredStartDate,
      agreementAccepted,
      confirmationText,
      acceptanceSource,
      evidenceSha256,
      coreData,
      v5SnapshotHash: proposal.v5SnapshotHash,
      v5SnapshotVersion: proposal.v5SnapshotVersion,
      capturedAt: new Date().toISOString(),
    };

    const id = uuidv4();
    await executor.execute(
      `INSERT INTO proposal_acceptance_record
        (id, clinic_id, proposal_id, contact_id, deal_id, client_account_profile_id,
         accepted_by_name, accepted_by_email, legal_company_name, billing_email,
         preferred_start_date, agreement_accepted, confirmation_text, acceptance_source,
         accepted_ip_address, accepted_user_agent, evidence_sha256, locked_at,
         accepted_at, acceptance_status,
         package_name, recommended_package_id, monthly_fee_cents, setup_fee_cents,
         currency, payment_terms, start_date, minimum_term_months, notice_period_days,
         scope, commercial_snapshot, proposal_snapshot, core_data_snapshot,
         v5_snapshot, v5_snapshot_hash, v5_snapshot_version, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         client_account_profile_id = COALESCE(VALUES(client_account_profile_id), client_account_profile_id),
         acceptance_status = VALUES(acceptance_status),
         deleted_at = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        clinicId,
        proposal.id,
        proposal.contactId,
        proposal.dealId,
        clientAccountProfileId,
        acceptedByName,
        acceptedByEmail,
        legalCompanyName,
        billingEmail,
        preferredStartDate,
        agreementAccepted ? 1 : 0,
        confirmationText,
        acceptanceSource,
        acceptedIpAddress,
        acceptedUserAgent,
        evidenceSha256,
        acceptedAt,
        acceptedAt,
        proposal.status === "won" ? "won" : "accepted",
        proposal.packageName,
        proposal.recommendedPackageId,
        proposal.monthlyFeeCents,
        proposal.setupFeeCents,
        proposal.currency || "GBP",
        paymentTerms,
        toMysqlDateOnly(proposal.startDate),
        proposal.minimumTermMonths,
        proposal.noticePeriodDays,
        JSON.stringify(scope),
        JSON.stringify(commercialSnapshot),
        JSON.stringify(proposalSnapshot),
        serializeProposalCoreData(coreData),
        serializeProposalV5Snapshot(proposal.v5Snapshot),
        proposal.v5SnapshotHash,
        proposal.v5SnapshotVersion,
        userId,
      ],
    );
    const [persistedRows]: any = await executor.execute(
      `SELECT id
       FROM proposal_acceptance_record
       WHERE proposal_id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [proposal.id, clinicId],
    );
    const persistedId = persistedRows[0]?.id;
    if (!persistedId) throw ApiError.internal("Proposal acceptance record was not saved");

    await this.logProposalActivity({
      clinicId,
      userId,
      contactId: proposal.contactId,
      clientAccountProfileId: proposal.clientAccountProfileId,
      proposalId: proposal.id,
      action: "proposal_acceptance_record_saved",
      title: proposal.proposalName,
      status: proposal.status,
      changes: {
        acceptedByName,
        acceptedByEmail,
        acceptedAt,
        clientAccountProfileId,
        packageName: proposal.packageName,
        monthlyFeeCents: proposal.monthlyFeeCents,
        setupFeeCents: proposal.setupFeeCents,
        legalCompanyName,
        billingEmail,
        preferredStartDate,
        acceptanceSource,
        agreementAccepted,
        evidenceSha256,
      },
    }, executor === pool ? undefined : executor);
    const auditPayload = {
      clinicId,
      userId,
      action: "PROPOSAL_ACCEPTANCE_RECORD_SAVED",
      entityType: "proposal_acceptance_record",
      entityId: persistedId,
      changes: {
        proposalId: proposal.id,
        acceptedByName,
        acceptedByEmail,
        acceptedAt,
        clientAccountProfileId,
        packageName: proposal.packageName,
        monthlyFeeCents: proposal.monthlyFeeCents,
        setupFeeCents: proposal.setupFeeCents,
        legalCompanyName,
        billingEmail,
        preferredStartDate,
        acceptanceSource,
        agreementAccepted,
        evidenceSha256,
      },
    };
    if (executor === pool) {
      await logAuditEvent(auditPayload);
    } else {
      await insertAuditEvent(executor, auditPayload);
    }

    await this.ensureProposalCommercialAcceptanceEvent(
      executor,
      clinicId,
      userId,
      proposal,
      persistedId,
    );
  }

  private async ensureProposalCommercialAcceptanceEvent(
    executor: QueryExecutor,
    clinicId: string,
    userId: string | null,
    proposal: ProposalResponse,
    acceptanceRecordId: string,
  ) {
    if (!["accepted", "won"].includes(proposal.status)) return;
    const [acceptanceRows]: any = await executor.execute(
      `SELECT accepted_by_name as acceptedByName,
              accepted_by_email as acceptedByEmail,
              legal_company_name as legalCompanyName,
              billing_email as billingEmail,
              preferred_start_date as preferredStartDate,
              accepted_at as acceptedAt,
              acceptance_status as acceptanceStatus
       FROM proposal_acceptance_record
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [acceptanceRecordId, clinicId],
    );
    const acceptanceRow = acceptanceRows[0] || {};
    const idempotencyKey = `proposal_accepted:${proposal.id}:${proposal.v5SnapshotHash || acceptanceRecordId}`;
    const eventId = uuidv4();
    const selectedPackage = proposal.v5Snapshot?.selectedPackage || null;
    const proposalReference = proposal.v5Snapshot?.proposal?.reference || proposal.sectionContent?.proposalReference || null;
    const payload = {
      schemaVersion: "proposal_commercial_event_v1",
      eventType: "proposal_accepted",
      idempotencyKey,
      proposal: {
        id: proposal.id,
        reference: proposalReference,
        name: proposal.proposalName,
        status: proposal.status,
        templateKey: proposal.templateKey,
        frozenSnapshotHash: proposal.v5SnapshotHash,
        frozenSnapshotVersion: proposal.v5SnapshotVersion,
        proposalUrl: proposal.proposalUrl,
      },
      acceptance: {
        id: acceptanceRecordId,
        acceptedAt: toIso(acceptanceRow.acceptedAt) || proposal.acceptedAt || proposal.wonAt,
        acceptedByName: acceptanceRow.acceptedByName || proposal.acceptanceRecord?.acceptedByName || proposal.contactName,
        acceptedByEmail: acceptanceRow.acceptedByEmail || proposal.acceptanceRecord?.acceptedByEmail || proposal.contactEmail,
        legalCompanyName: acceptanceRow.legalCompanyName || proposal.acceptanceRecord?.legalCompanyName || null,
        billingEmail: acceptanceRow.billingEmail || proposal.acceptanceRecord?.billingEmail || null,
        preferredStartDate: toMysqlDateOnly(acceptanceRow.preferredStartDate) || proposal.acceptanceRecord?.preferredStartDate || proposal.startDate,
        status: acceptanceRow.acceptanceStatus || (proposal.status === "won" ? "won" : "accepted"),
      },
      commercial: {
        packageId: proposal.recommendedPackageId,
        packageName: selectedPackage?.name || proposal.packageName,
        monthlyFeeCents: selectedPackage?.monthlyFeeCents ?? proposal.monthlyFeeCents,
        setupFeeCents: selectedPackage?.setupFeeCents ?? proposal.setupFeeCents,
        currency: selectedPackage?.currency || proposal.currency || "GBP",
        billingFrequency: selectedPackage?.billingFrequency || null,
        vatStatus: selectedPackage?.vatStatus || proposal.vatStatus,
        mediaSpendRule: selectedPackage?.mediaSpendRule || proposal.adSpendNote,
        minimumTermMonths: selectedPackage?.minimumTermMonths ?? proposal.minimumTermMonths,
        noticePeriodDays: selectedPackage?.noticePeriodDays ?? proposal.noticePeriodDays,
        proposedStartDate: proposal.startDate,
      },
      links: {
        contactId: proposal.contactId,
        dealId: proposal.dealId,
        clientAccountProfileId: proposal.clientAccountProfileId,
      },
      targetConsumers: ["cg_058", "quickbooks", "onboarding", "clickup_delivery"],
    };
    await executor.execute(
      `INSERT INTO proposal_commercial_event
        (id, clinic_id, proposal_id, acceptance_record_id, event_type,
         idempotency_key, status, target_consumers, payload, created_by)
       VALUES (?, ?, ?, ?, 'proposal_accepted', ?, 'pending', ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         acceptance_record_id = COALESCE(acceptance_record_id, VALUES(acceptance_record_id)),
         updated_at = CURRENT_TIMESTAMP`,
      [
        eventId,
        clinicId,
        proposal.id,
        acceptanceRecordId,
        idempotencyKey,
        JSON.stringify(payload.targetConsumers),
        JSON.stringify(payload),
        userId,
      ],
    );
    const [eventRows]: any = await executor.execute(
      `SELECT id
       FROM proposal_commercial_event
       WHERE clinic_id = ? AND idempotency_key = ?
       LIMIT 1`,
      [clinicId, idempotencyKey],
    );
    if (!eventRows[0]) throw ApiError.internal("Proposal commercial event was not saved.");
    await quickBooksService.stageCommercialDraft(
      {
        clinicId,
        eventId: eventRows[0].id,
        proposalId: proposal.id,
        clientAccountProfileId: proposal.clientAccountProfileId,
        idempotencyKey,
        payload: {
          legalCompanyName: payload.acceptance.legalCompanyName,
          billingEmail: payload.acceptance.billingEmail,
          packageId: payload.commercial.packageId,
          packageName: payload.commercial.packageName,
          monthlyFeeCents: payload.commercial.monthlyFeeCents,
          setupFeeCents: payload.commercial.setupFeeCents,
          currency: payload.commercial.currency,
          billingFrequency: payload.commercial.billingFrequency,
          vatStatus: payload.commercial.vatStatus,
          minimumTermMonths: payload.commercial.minimumTermMonths,
          noticePeriodDays: payload.commercial.noticePeriodDays,
          proposedStartDate: payload.commercial.proposedStartDate,
        },
      },
      executor,
    );
    await this.ensureClickUpDeliveryProvision(executor, clinicId, proposal, eventRows[0].id, idempotencyKey, payload);
  }

  private async ensureClickUpDeliveryProvision(
    executor: QueryExecutor,
    clinicId: string,
    proposal: ProposalResponse,
    eventId: string,
    idempotencyKey: string,
    payload: any,
  ) {
    if (!proposal.clientAccountProfileId) return;
    await stageClickUpDeliveryProvision(
      {
        clinicId,
        clientAccountProfileId: proposal.clientAccountProfileId,
        proposalId: proposal.id,
        eventId,
        idempotencyKey,
        payload: {
          packageId: payload.commercial?.packageId || null,
          packageName: payload.commercial?.packageName || null,
          proposedStartDate: payload.commercial?.proposedStartDate || null,
          proposalUrl: payload.proposal?.proposalUrl || null,
          proposalReference: payload.proposal?.reference || null,
          contactId: payload.links?.contactId || null,
          dealId: payload.links?.dealId || null,
        },
      },
      executor,
    );
  }

  private async resolveAcceptanceClientAccountProfileId(
    clinicId: string,
    proposal: ProposalResponse,
    executor: QueryExecutor = pool,
  ) {
    if (proposal.clientAccountProfileId) return proposal.clientAccountProfileId;
    if (!proposal.contactId) return null;

    const [rows]: any = await executor.execute(
      `SELECT client_account_profile_id as clientAccountProfileId
       FROM client_account_contact
       WHERE clinic_id = ?
         AND contact_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [clinicId, proposal.contactId],
    );

    return rows[0]?.clientAccountProfileId || null;
  }

  private validateStatusRequirements(status: ProposalStatus, followUpAt: unknown) {
    if (status === "follow_up_due" && !followUpAt) {
      throw ApiError.badRequest("followUpAt is required when proposal status is follow_up_due");
    }
  }

  private assertClientReadyProposal(input: {
    status: ProposalStatus;
    contactId?: string | null;
    contactName?: string | null;
    accountName?: string | null;
    clientAccountName?: string | null;
    recommendedPackageId?: string | null;
    packageName?: string | null;
    approvedPackagePriceCents?: number | null;
    approvedPackageSetupFeeCents?: number | null;
    approvedPackageBillingFrequency?: string | null;
    valueCents?: number | null;
    monthlyFeeCents?: number | null;
    setupFeeCents?: number | null;
    adSpendNote?: string | null;
    vatStatus?: string | null;
    minimumTermMonths?: number | null;
    noticePeriodDays?: number | null;
    startDate?: string | null;
    expiresAt?: string | null;
    sectionContent?: ProposalSectionContent | null;
  }) {
    if (!["ready", "sent", "viewed", "accepted", "won"].includes(input.status)) return;

    const issues: string[] = [];
    const section = input.sectionContent || {};
    const scopeItems = Array.isArray(section.scopeItems) ? section.scopeItems : [];
    const successMetrics = Array.isArray(section.successMetrics) ? section.successMetrics : [];
    const proofAssetIds = Array.isArray(section.proofAssetIds) ? section.proofAssetIds : [];
    const proofAssets = Array.isArray(section.proofAssets) ? section.proofAssets : [];
    const clinicTypeVariant = getProposalClinicTypeVariant(section.clinicTypeVariant);

    if (!hasText(input.contactId)) issues.push("link an actual decision-maker/contact");
    if (!hasText(input.contactName)) issues.push("complete the decision-maker's actual name");
    if (!hasText(input.accountName) && !hasText(input.clientAccountName)) issues.push("complete the clinic/account name");
    if (!hasText(input.recommendedPackageId)) issues.push("link the proposal to an approved package catalogue record");
    if (!hasText(input.packageName)) issues.push("select the approved package/programme");
    if (!hasText(input.approvedPackageBillingFrequency)) issues.push("complete billing frequency on the approved package catalogue record");
    if (input.monthlyFeeCents == null && input.valueCents == null) issues.push("complete the programme fee");
    if (input.setupFeeCents === null || input.setupFeeCents === undefined) issues.push("complete the setup fee, even if it is zero");
    if (!hasText(input.adSpendNote)) issues.push("show advertising spend separately from the ClinicGrower fee");
    if (!hasText(input.vatStatus)) issues.push("complete VAT status");
    if (!input.minimumTermMonths) issues.push("complete minimum term");
    if (!input.noticePeriodDays) issues.push("complete notice period");
    if (!hasText(input.startDate)) issues.push("complete start date");
    if (!hasText(input.expiresAt)) issues.push("complete proposal expiry");
    if (!clinicTypeVariant) issues.push("select one approved clinic type variant");
    if (cleanString(section.clinicTypeAssetVersion) !== proposalClinicTypeAssetVersion) {
      issues.push("refresh the selected clinic type variant so the saved asset version is current");
    }
    if (hasText(section.heroImageUrl) && !hasText(section.heroImageAlt)) {
      issues.push("add descriptive alt text for the selected clinic-type hero image");
    }

    const visibleEvidenceStates = new Set<ProposalDataState>(["known", "working_diagnosis", "provisional"]);
    const acceptedSectorImageStatuses = new Set(["approved"]);
    const requiredV5Fields: Array<[keyof ProposalSectionContent, string]> = [
      ["discoverySource", "discovery source"],
      ["customerWording", "customer wording captured from discovery"],
      ["evidenceConfidenceState", "evidence confidence state"],
      ["activeConstraintId", "active constraint"],
      ["activeConstraintConfidenceState", "active-constraint confidence state"],
      ["economicUnit", "economic unit"],
      ["clinicConfirmedContribution", "confirmed contribution per economic unit"],
      ["contributionEvidenceSourceDate", "contribution evidence source/date"],
      ["contributionConfirmationState", "contribution confirmation state"],
      ["selectedMediaSpend", "selected media spend used in the commercial model"],
      ["paybackState", "payback confirmation state"],
      ["liveDataStatus", "ClinicGrower OS live-data status"],
      ["sectorImageApprovalStatus", "sector image status"],
      ["sectorImageProvenance", "sector image provenance"],
    ];
    for (const [field, label] of requiredV5Fields) {
      if (!hasText(section[field])) issues.push(`complete ${label}`);
    }
    if (hasText(section.evidenceConfidenceState) && !visibleEvidenceStates.has(normalizeProposalDataState(section.evidenceConfidenceState))) {
      issues.push("set evidence confidence to Known, Working diagnosis or Provisional");
    }
    if (hasText(section.activeConstraintConfidenceState) && !visibleEvidenceStates.has(normalizeProposalDataState(section.activeConstraintConfidenceState))) {
      issues.push("set active-constraint confidence to Known, Working diagnosis or Provisional");
    }
    if (hasText(section.contributionConfirmationState) && normalizeProposalDataState(section.contributionConfirmationState) !== "known") {
      issues.push("confirm contribution per economic unit before the commercial case can be sent");
    }
    if (hasText(section.paybackState) && normalizeProposalDataState(section.paybackState) !== "known") {
      issues.push("confirm payback assumptions before the commercial case can be sent");
    }
    if (hasText(section.liveDataStatus) && section.liveDataStatus !== "live_connected" && !hasText(section.knownDataLimitations)) {
      issues.push("explain live-data limitations when ClinicGrower OS is not fully connected");
    }
    if (hasText(section.sectorImageApprovalStatus) && !acceptedSectorImageStatuses.has(String(section.sectorImageApprovalStatus))) {
      issues.push("use the current V5 sector imagery with provenance recorded");
    }
    const sectorImages = Array.isArray(section.sectorImages) ? section.sectorImages : [];
    const requiredSectorImageSlots: ProposalSectorImage["slot"][] = ["cover", "journey", "proof", "close"];
    const savedSectorImageSlots = new Set<ProposalSectorImage["slot"]>(sectorImages.map((image) => image.slot));
    const uniqueSectorImageUrls = new Set(sectorImages.map((image) => cleanString(image.url)).filter(Boolean));
    const hasIncompleteSectorImage = sectorImages.some((image) => (
      !requiredSectorImageSlots.includes(image.slot) ||
      !hasText(image.imageId) ||
      !hasText(image.url) ||
      !hasText(image.cropPosition) ||
      !hasText(image.licence) ||
      !hasText(image.provenance) ||
      image.approvalStatus !== "approved"
    ));
    if (
      sectorImages.length !== 4 ||
      savedSectorImageSlots.size !== 4 ||
      requiredSectorImageSlots.some((slot) => !savedSectorImageSlots.has(slot)) ||
      uniqueSectorImageUrls.size !== 4 ||
      hasIncompleteSectorImage
    ) {
      issues.push("save four unique approved sector images with cover, journey, proof and close slots, crop position, licence and provenance");
    }

    const expectedProgrammeFee = input.approvedPackageBillingFrequency === "monthly"
      ? input.approvedPackagePriceCents ?? null
      : input.approvedPackagePriceCents ?? null;
    const actualProgrammeFee = input.approvedPackageBillingFrequency === "monthly"
      ? input.monthlyFeeCents ?? null
      : input.valueCents ?? null;
    const commercialChanged = (
      (expectedProgrammeFee !== null && expectedProgrammeFee !== undefined && actualProgrammeFee !== expectedProgrammeFee) ||
      (input.approvedPackageSetupFeeCents !== null && input.approvedPackageSetupFeeCents !== undefined && input.setupFeeCents !== input.approvedPackageSetupFeeCents)
    );
    if (commercialChanged && (!hasText(section.commercialChangeReason) || section.commercialApprovalStatus !== "approved")) {
      issues.push("record a reason and approved internal approval status for any custom price or setup fee change");
    }

    const requiredSectionFields: Array<[keyof ProposalSectionContent, string]> = [
      ["proposalReference", "proposal reference"],
      ["proposalDate", "proposal date"],
      ["personalIntroduction", "personal note"],
      ["primaryGoal", "clinic growth target"],
      ["clinicTypeAndLocations", "clinic type and locations"],
      ["currentPosition", "current situation"],
      ["currentMarketingSpend", "current marketing spend or not-currently-measured note"],
      ["currentWebsiteCrmBookingSetup", "current website, CRM and booking setup"],
      ["problemsDiscussed", "specific problems discussed during discovery"],
      ["whyActNow", "why the clinic wants to act now"],
      ["currentlyUnmeasured", "what is currently unmeasured"],
      ["availableCapacity", "available capacity"],
      ["priorityTreatments", "priority treatments"],
      ["targetArea", "clinic type/location or target area"],
      ["desiredOutcome", "desired outcome"],
      ["biggestRisk", "specific problem discussed"],
      ["biggestOpportunity", "commercial opportunity"],
      ["firstRecommendedFix", "first recommended fix"],
      ["currentMonthlyEnquiries", "current monthly enquiries or not-currently-measured note"],
      ["currentMonthlyBookedPatients", "current monthly bookings or not-currently-measured note"],
      ["currentBookingRate", "current booking-rate assumption"],
      ["attendanceRate", "attendance-rate assumption"],
      ["consultationToTreatmentConversionRate", "consultation-to-treatment conversion assumption"],
      ["averageTreatmentValue", "treatment or patient value"],
      ["availableCommercialCapacity", "commercial/appointment capacity"],
      ["currentAcquisitionCost", "current acquisition cost"],
      ["commercialDataSource", "commercial data source and assumptions"],
      ["recommendedPlan", "recommended ClinicGrower OS plan"],
    ];
    for (const [field, label] of requiredSectionFields) {
      if (!hasText(section[field])) issues.push(`complete ${label}`);
    }

    if (!scopeItems.length) {
      issues.push("add approved package scope rows");
    } else {
      const incompleteScope = scopeItems.some((item) => (
        !hasText(item.category) ||
        !hasText(item.title) ||
        !hasText(item.clientDescription) ||
        !hasText(item.frequency) ||
        !hasText(item.quantityLimit) ||
        !hasText(item.treatmentsAndLocations) ||
        !hasText(item.dependencies) ||
        !hasText(item.clientResponsibilities) ||
        !hasText(item.exclusions) ||
        !hasText(item.thirdPartyCosts) ||
        !hasText(item.deliveryType) ||
        !hasText(item.inclusionStatus)
      ));
      if (incompleteScope) {
        issues.push("complete category, description, frequency, quantity/limit, treatments/locations, dependencies, responsibilities, exclusions, third-party costs and inclusion status on every scope row");
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
        issues.push("replace vague scope wording such as as required, agreed in roadmap, confirmed separately or to be agreed");
      }
      const unapprovedCustomScope = scopeItems.some((item) => (
        item.isCustom &&
        (!hasText(item.changeReason) || item.approvalStatus !== "approved")
      ));
      if (unapprovedCustomScope) {
        issues.push("record a reason and approved internal approval status for every custom scope change");
      }
    }

    if (!successMetrics.length) {
      issues.push("complete success measures with metric, target and measurement source");
    } else if (successMetrics.some(isIncompleteSuccessMetric)) {
      issues.push("replace placeholder success measures with specific metric, target and source rows");
    }

    if (!proofAssetIds.length && !proofAssets.length) {
      issues.push("select relevant proof or credibility assets");
    } else {
      const selectedProofAssets = proofAssets as ProposalProofAssetResponse[];
      const clinicSegments = inferClinicSegmentsFromSection(section);
      const mismatchedClinicProof = clinicTypeVariant
        ? selectedProofAssets.some((asset) => (
          ["case_study", "testimonial", "testimonial_video", "performance_result"].includes(asset.type) &&
          !proofMatchesClinicVariant(asset, clinicTypeVariant)
        ))
        : false;
      const matchedCaseStudy = selectedProofAssets.some((asset) => (
        asset.type === "case_study" &&
        proofMatchesClinicSegments(asset, clinicSegments) &&
        (!clinicTypeVariant || proofMatchesClinicVariant(asset, clinicTypeVariant))
      ));
      const permissionedTestimonial = selectedProofAssets.some((asset) => (
        (asset.type === "testimonial" || asset.type === "testimonial_video") &&
        proofHasPermission(asset) &&
        (!clinicTypeVariant || proofMatchesClinicVariant(asset, clinicTypeVariant))
      ));
      const productScreenshot = selectedProofAssets.some((asset) => (
        asset.type === "product_screenshot" &&
        Boolean(asset.mediaUrl) &&
        proofAssetText(asset).includes("clinicgrower os")
      ));
      const contextualResult = selectedProofAssets.some((asset) => (
        asset.type === "performance_result" &&
        proofHasResultContext(asset)
      ));
      const invalidDrTanjaAsset = selectedProofAssets.some((asset) => (
        proofIsDrTanja(asset) &&
        !proofHasVerifiedImage(asset)
      ));
      const resultMissingContext = selectedProofAssets.some((asset) => !proofHasResultContext(asset));

      if (!matchedCaseStudy) issues.push("select one verified case study matched to the prospect clinic type");
      if (!permissionedTestimonial) issues.push("select a named testimonial/testimonial video with permission recorded");
      if (!productScreenshot) issues.push("select at least one real ClinicGrower OS product screenshot");
      if (!contextualResult) issues.push("select a performance result with timeframe and delivery context");
      if (resultMissingContext) issues.push("add timeframe and delivery context to every performance-result proof asset");
      if (invalidDrTanjaAsset) issues.push("use the verified Dr Tanja image for Dr Tanja proof");
      if (mismatchedClinicProof) {
        issues.push(`remove proof assets that do not match ${clinicTypeVariant ? proposalClinicTypeVariants[clinicTypeVariant].label : "the selected clinic type"}`);
      }
    }

    if (issues.length) {
      const shown = issues.slice(0, 8).join("; ");
      const suffix = issues.length > 8 ? `; plus ${issues.length - 8} more` : "";
      throw ApiError.badRequest(`Proposal is not ready for client use: ${shown}${suffix}.`, { issues });
    }
  }

  private getStatusTimestamps(status: ProposalStatus, data: ProposalMutationDTO, existing?: ProposalResponse) {
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    return {
      readyAt: Object.prototype.hasOwnProperty.call(data, "readyAt") ? toMysqlDateTime(data.readyAt) : (status === "ready" && !existing?.readyAt ? now : undefined),
      sentAt: Object.prototype.hasOwnProperty.call(data, "sentAt") ? toMysqlDateTime(data.sentAt) : (status === "sent" && !existing?.sentAt ? now : undefined),
      viewedAt: Object.prototype.hasOwnProperty.call(data, "viewedAt") ? toMysqlDateTime(data.viewedAt) : (status === "viewed" && !existing?.viewedAt ? now : undefined),
      acceptedAt: Object.prototype.hasOwnProperty.call(data, "acceptedAt") ? toMysqlDateTime(data.acceptedAt) : (status === "accepted" && !existing?.acceptedAt ? now : undefined),
      wonAt: Object.prototype.hasOwnProperty.call(data, "wonAt") ? toMysqlDateTime(data.wonAt) : (status === "won" && !existing?.wonAt ? now : undefined),
      lostAt: Object.prototype.hasOwnProperty.call(data, "lostAt") ? toMysqlDateTime(data.lostAt) : (status === "lost" && !existing?.lostAt ? now : undefined),
      expiresAt: Object.prototype.hasOwnProperty.call(data, "expiresAt") ? toMysqlDateTime(data.expiresAt) : undefined,
    };
  }

  private async logProposalActivity(input: {
    clinicId: string;
    userId: string | null;
    contactId: string | null;
    clientAccountProfileId?: string | null;
    proposalId: string;
    action: string;
    title: string;
    status: ProposalStatus;
    previousStatus?: ProposalStatus;
    changes?: Record<string, unknown>;
  }, executor?: QueryExecutor) {
    let contactId = input.contactId;
    if (!contactId && input.clientAccountProfileId) {
      const [rows]: any = await (executor || pool).execute(
        `SELECT contact_id as contactId
         FROM client_account_contact
         WHERE clinic_id = ?
           AND client_account_profile_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [input.clinicId, input.clientAccountProfileId],
      );
      contactId = rows[0]?.contactId || null;
    }
    if (!contactId) return;
    const metadata = buildTimelineMetadata({
      action: input.action,
      source: "proposal",
      recordId: input.proposalId,
      title: input.title,
      status: input.status,
      previousStatus: input.previousStatus || null,
      ...(input.changes ? { changes: input.changes } : {}),
    });

    const payload = {
      clinicId: input.clinicId,
      contactId,
      type: "StatusChange",
      userId: input.userId,
      metadata,
    } as const;
    if (executor) {
      await insertTimelineActivity(executor, payload);
    } else {
      await logTimelineActivity(payload);
    }
  }
}

export const proposalsService = new ProposalsService();
