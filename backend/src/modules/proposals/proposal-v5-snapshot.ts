import { createHash } from "node:crypto";
import type { PackageRecord } from "../packages/packages.types.js";
import type {
  ProposalDataState,
  ProposalProofAssetResponse,
  ProposalResponse,
  ProposalScopeItem,
  ProposalSectorImage,
  ProposalSectionContent,
  ProposalV5ClinicTypeId,
  ProposalV5Image,
  ProposalV5ImageSlot,
  ProposalV5Package,
  ProposalV5ProofAsset,
  ProposalV5PublicSnapshot,
  ProposalV5ScopeLine,
  ProposalV5Snapshot,
  ProposalV5Stated,
} from "./proposals.types.js";

export const proposalV5SnapshotVersion = "proposal_v5_2026_08_11";
export const proposalV5TemplateKey = "clinicgrower_v5";

const websiteSourceBase = "/brand/proposal/website-source";
const v5ReferenceBase = "/brand/proposal/v5-reference";

const clinicGrowerOsOverviewImage = `${websiteSourceBase}/clinicgrower-os-video-thumbnail.jpg`;
const clinicGrowerOsProductImage = `${websiteSourceBase}/clinicgrower-os-demo-thumbnail.jpg`;
const clinicGrowerAboutImage = `${websiteSourceBase}/clinicgrower-about.webp`;
const clinicGrowerVideoImage = `${websiteSourceBase}/clinicgrower-videography.webp`;

const proposalV5PageOrder = [
  { id: "V5Page01Cover", pageNumber: 1, theme: "dark" },
  { id: "V5Page02EvidenceQuestions", pageNumber: 2, theme: "light" },
  { id: "V5Page03EvidenceTrail", pageNumber: 3, theme: "dark" },
  { id: "V5Page04CommercialDiagnosis", pageNumber: 4, theme: "light" },
  { id: "V5Page05PartnerProposition", pageNumber: 5, theme: "dark" },
  { id: "V5Page06SystemsFit", pageNumber: 6, theme: "light" },
  { id: "V5Page07DemandProgression", pageNumber: 7, theme: "light" },
  { id: "V5Page08ResponseOwnership", pageNumber: 8, theme: "dark" },
  { id: "V5Page09PostBooking", pageNumber: 9, theme: "light" },
  { id: "V5Page10CommercialAccountability", pageNumber: 10, theme: "light" },
  { id: "V5Page11OSCapability", pageNumber: 11, theme: "dark" },
  { id: "V5Page12BreakEven", pageNumber: 12, theme: "light" },
  { id: "V5Page13Implementation", pageNumber: 13, theme: "light" },
  { id: "V5Page14OperatingRhythm", pageNumber: 14, theme: "light" },
  { id: "V5Page15ScopeMatrix", pageNumber: 15, theme: "light" },
  { id: "V5Page16Responsibilities", pageNumber: 16, theme: "light" },
  { id: "V5Page17Proof", pageNumber: 17, theme: "light" },
  { id: "V5Page18Investment", pageNumber: 18, theme: "dark" },
  { id: "V5Page19Close", pageNumber: 19, theme: "dark" },
] as const satisfies ReadonlyArray<ProposalV5Snapshot["pages"][number]>;

type ClinicVariant = {
  id: ProposalV5ClinicTypeId;
  label: string;
  shortLabel: string;
  economicUnit: string;
  journeyStages: string[];
  clinicalBoundary: string;
  demandQuestion: string;
  progressionQuestion: string;
  postBookingContinuation: string;
  operatingRhythmMorning: string;
  operatingRhythmMonthly: string;
  proofTags: string[];
  directory: string | null;
  coverFile: string;
  journeyFile: string;
  proofFile: string;
  closeFile: string;
  osScreenFile: string;
};

const proposalV5ClinicTypeVariants: Record<ProposalV5ClinicTypeId, ClinicVariant> = {
  general: {
    id: "general",
    label: "General ClinicGrower",
    shortLabel: "General",
    economicUnit: "confirmed patient value unit",
    journeyStages: ["Visibility", "Enquiry", "Response", "Booking", "Consultation", "Treatment", "Revenue", "Retention"],
    clinicalBoundary: "ClinicGrower OS supports commercial visibility and accountability. Clinical advice, suitability and patient care remain with the clinic team.",
    demandQuestion: "Are the right patients finding the priority services?",
    progressionQuestion: "Do enquiries become attended consultations and recorded value?",
    postBookingContinuation: "response, booking, attendance, follow-up and recorded value",
    operatingRhythmMorning: "The team sees overdue responses, follow-up and priority actions.",
    operatingRhythmMonthly: "The owner reviews progression, recorded value, capacity and commercial sense.",
    proofTags: ["clinic", "general", "clinicgrower os"],
    directory: null,
    coverFile: clinicGrowerOsOverviewImage,
    journeyFile: clinicGrowerAboutImage,
    proofFile: clinicGrowerVideoImage,
    closeFile: clinicGrowerOsProductImage,
    osScreenFile: clinicGrowerOsProductImage,
  },
  aesthetic_clinic: {
    id: "aesthetic_clinic",
    label: "Aesthetic Clinics",
    shortLabel: "Aesthetics",
    economicUnit: "completed injectable treatment",
    journeyStages: ["Treatment search", "Phone, WhatsApp or form enquiry", "First response", "Consultation", "Attendance", "Treatment plan", "Follow-up", "Treatment and repeat"],
    clinicalBoundary: "ClinicGrower OS can show enquiry, booking and treatment-plan visibility where connected. Treatment suitability, prescribing, consent and clinical decisions remain with the clinic.",
    demandQuestion: "Are the right patients finding the priority treatments?",
    progressionQuestion: "Do treatment enquiries become attended consultations and plans?",
    postBookingContinuation: "consultation, attendance, treatment plan, follow-up, treatment and repeat value",
    operatingRhythmMorning: "Reception and treatment coordinator sees overdue responses, follow-up and priority actions.",
    operatingRhythmMonthly: "The owner reviews treatment-plan conversion and recorded treatment value, capacity and commercial sense.",
    proofTags: ["aesthetic", "aesthetics", "skin", "injectable", "laser"],
    directory: "aesthetic_clinics",
    coverFile: "p01-img02-1672x941.png",
    journeyFile: "p06-img01-1122x1402.png",
    proofFile: "p10-img01-1122x1402.png",
    closeFile: "p13-img01-1672x941.png",
    osScreenFile: "p07-img01-1440x662.png",
  },
  dental_clinic: {
    id: "dental_clinic",
    label: "Dental Practices",
    shortLabel: "Dental",
    economicUnit: "accepted implant case",
    journeyStages: ["Treatment search", "Patient enquiry", "First response", "Treatment-coordinator review", "Consultation", "Treatment plan", "Coordinator follow-up", "Accepted case"],
    clinicalBoundary: "ClinicGrower OS can show private dental enquiry and treatment-plan progression where connected. Diagnosis, consent and clinical treatment planning remain with the dental team.",
    demandQuestion: "Are implant and aligner patients finding the practice?",
    progressionQuestion: "Do enquiries become attended consultations and accepted cases?",
    postBookingContinuation: "coordinator review, consultation, treatment plan, follow-up and accepted case value",
    operatingRhythmMorning: "Reception and treatment coordinator sees overdue responses, follow-up and priority actions.",
    operatingRhythmMonthly: "The owner reviews treatment-plan acceptance and accepted case value, capacity and commercial sense.",
    proofTags: ["dental", "dentist", "implant", "invisalign", "smile"],
    directory: "dental_practices",
    coverFile: "p01-img02-1672x941.png",
    journeyFile: "p06-img01-1009x1559.png",
    proofFile: "p10-img01-1122x1402.png",
    closeFile: "p13-img01-1672x941.png",
    osScreenFile: "p07-img01-1440x662.png",
  },
  cosmetic_surgery_clinic: {
    id: "cosmetic_surgery_clinic",
    label: "Cosmetic Surgery Clinics",
    shortLabel: "Cosmetic Surgery",
    economicUnit: "booked rhinoplasty procedure",
    journeyStages: ["Procedure research", "Patient enquiry", "Suitability review", "Consultation", "Attendance", "Surgical plan", "Coordinator follow-up", "Deposit and booking"],
    clinicalBoundary: "ClinicGrower OS can show commercial pathway visibility where connected. Surgical suitability, consent, clinical risk and procedure decisions remain with the surgical team.",
    demandQuestion: "Does procedure research build the trust required to enquire?",
    progressionQuestion: "Do suitable enquiries become attended consultations and deposits?",
    postBookingContinuation: "suitability review, consultation, surgical plan, follow-up, deposit and booked procedure value",
    operatingRhythmMorning: "Patient adviser and surgical coordinator sees overdue responses, follow-up and priority actions.",
    operatingRhythmMonthly: "The owner reviews deposit conversion and booked procedure value, capacity and commercial sense.",
    proofTags: ["surgery", "surgeon", "procedure", "cosmetic surgery"],
    directory: "cosmetic_surgery_clinics",
    coverFile: "p01-img02-1672x941.png",
    journeyFile: "p06-img01-1122x1402.png",
    proofFile: "p10-img01-1122x1402.png",
    closeFile: "p13-img01-1672x941.png",
    osScreenFile: "p07-img01-1440x660.png",
  },
  dermatology_clinic: {
    id: "dermatology_clinic",
    label: "Dermatology Clinics",
    shortLabel: "Dermatology",
    economicUnit: "attended new-patient appointment",
    journeyStages: ["Condition search", "Service page", "Patient enquiry", "Private appointment", "Attendance", "Diagnosis", "Care pathway", "Recorded value"],
    clinicalBoundary: "ClinicGrower OS can show condition-led enquiry and appointment visibility where connected. Diagnosis, clinical advice and care-pathway decisions remain with the dermatology team.",
    demandQuestion: "Can patients see the relevant private route quickly?",
    progressionQuestion: "Does condition-led demand become an attended appointment?",
    postBookingContinuation: "private appointment, attendance, diagnosis, care pathway and recorded patient value",
    operatingRhythmMorning: "Patient services and clinic coordinator sees overdue responses, follow-up and priority actions.",
    operatingRhythmMonthly: "The owner reviews care-pathway conversion and recorded patient value, capacity and commercial sense.",
    proofTags: ["dermatology", "skin", "acne", "mole", "eczema"],
    directory: "dermatology_clinics",
    coverFile: "p01-img02-1672x941.png",
    journeyFile: "p06-img01-1005x1559.png",
    proofFile: "p10-img01-1122x1402.png",
    closeFile: "p13-img01-1672x941.png",
    osScreenFile: "p07-img01-1440x662.png",
  },
  hair_transplant_clinic: {
    id: "hair_transplant_clinic",
    label: "Hair Transplant Clinics",
    shortLabel: "Hair Transplant",
    economicUnit: "booked FUE procedure",
    journeyStages: ["Procedure research", "Candidate enquiry", "Suitability review", "Assessment", "Attendance", "Procedure plan", "Adviser follow-up", "Deposit and booking"],
    clinicalBoundary: "ClinicGrower OS can show enquiry, assessment and deposit visibility where connected. Hair restoration suitability, clinical advice and procedure planning remain with the clinic.",
    demandQuestion: "Does long-form research build enough authority to enquire?",
    progressionQuestion: "Do suitable candidates become attended assessments and deposits?",
    postBookingContinuation: "assessment, attendance, procedure plan, adviser follow-up, deposit and booked procedure value",
    operatingRhythmMorning: "Patient adviser and procedure coordinator sees overdue responses, follow-up and priority actions.",
    operatingRhythmMonthly: "The owner reviews deposit conversion and booked procedure value, capacity and commercial sense.",
    proofTags: ["hair", "hair transplant", "hair restoration", "fue"],
    directory: "hair_transplant_clinics",
    coverFile: "p01-img02-1672x941.png",
    journeyFile: "p06-img01-996x1545.png",
    proofFile: "p10-img01-1122x1402.png",
    closeFile: "p13-img01-1672x941.png",
    osScreenFile: "p07-img01-1440x662.png",
  },
  wellness_clinic: {
    id: "wellness_clinic",
    label: "Wellness Clinics",
    shortLabel: "Wellness",
    economicUnit: "weight-management programme enrolment",
    journeyStages: ["Goal or condition", "Programme page", "Client enquiry", "Discovery call", "Consultation", "Recommendation", "Programme start", "Renewal"],
    clinicalBoundary: "ClinicGrower OS can show commercial programme visibility where connected. Health advice, prescribing, clinical suitability and programme decisions remain with the clinic.",
    demandQuestion: "Do the right people understand who each programme is for?",
    progressionQuestion: "Does interest become a consultation, enrolment and renewal?",
    postBookingContinuation: "discovery, consultation, recommendation, programme start, renewal and recurring value",
    operatingRhythmMorning: "Client care and programme coordinator sees overdue responses, follow-up and priority actions.",
    operatingRhythmMonthly: "The owner reviews programme uptake and recurring client value, capacity and commercial sense.",
    proofTags: ["wellness", "longevity", "health optimisation", "functional", "wellbeing"],
    directory: "wellness_clinics",
    coverFile: "p01-img02-1672x941.png",
    journeyFile: "p06-img01-1007x1562.png",
    proofFile: "p10-img01-1122x1402.png",
    closeFile: "p13-img01-1672x941.png",
    osScreenFile: "p07-img01-1440x662.png",
  },
  private_gp_medical_clinic: {
    id: "private_gp_medical_clinic",
    label: "Private GP & Medical Clinics",
    shortLabel: "Private GP",
    economicUnit: "attended private GP appointment",
    journeyStages: ["Service search", "Service page", "Online booking or patient enquiry", "Confirmation", "Consultation", "Test or referral", "Follow-up", "Completed service"],
    clinicalBoundary: "ClinicGrower OS can show private medical enquiry and appointment visibility where connected. Clinical advice, diagnosis, triage and treatment decisions remain with the medical team.",
    demandQuestion: "Can patients see the right private service and route to book?",
    progressionQuestion: "Does patient need become a confirmed, attended appointment?",
    postBookingContinuation: "confirmation, consultation, test or referral, follow-up and attributable service-line value",
    operatingRhythmMorning: "Patient services and medical secretary sees overdue responses, follow-up and priority actions.",
    operatingRhythmMonthly: "The owner reviews available clinician capacity and attributable service-line value, capacity and commercial sense.",
    proofTags: ["private gp", "medical", "doctor", "health check", "screening"],
    directory: "private_gp_medical_clinics",
    coverFile: "p01-img02-1600x900.png",
    journeyFile: "p06-img01-1120x1738.png",
    proofFile: "p10-img01-1120x1400.png",
    closeFile: "p13-img01-1600x900.png",
    osScreenFile: "p07-img01-1440x662.png",
  },
  medical_spa: {
    id: "medical_spa",
    label: "Medical Spas",
    shortLabel: "Medical Spa",
    economicUnit: "accepted skin-rejuvenation treatment plan",
    journeyStages: ["Treatment discovery", "Treatment page", "Patient enquiry", "Consultation", "Attendance", "Treatment plan", "Membership or nurture", "Repeat value"],
    clinicalBoundary: "ClinicGrower OS can show treatment-plan and repeat-booking visibility where connected. Clinical suitability, consent and care decisions remain with the clinic.",
    demandQuestion: "Is the premium medical-aesthetic offer clear enough to choose?",
    progressionQuestion: "Does treatment interest become a plan, repeat visit or membership?",
    postBookingContinuation: "consultation, attendance, treatment plan, membership or nurture, repeat and recurring value",
    operatingRhythmMorning: "Patient concierge and treatment coordinator sees overdue responses, follow-up and priority actions.",
    operatingRhythmMonthly: "The owner reviews treatment-plan conversion and treatment and recurring value, capacity and commercial sense.",
    proofTags: ["medical spa", "medspa", "spa", "aesthetic", "skin", "laser"],
    directory: "medical_spas",
    coverFile: "p01-img02-1600x900.png",
    journeyFile: "p06-img01-1120x1738.png",
    proofFile: "p10-img01-1120x1400.png",
    closeFile: "p13-img01-1600x900.png",
    osScreenFile: "p07-img01-1440x662.png",
  },
};

type PackageScopeSource = Partial<ProposalScopeItem & ProposalV5ScopeLine> & {
  sortOrder?: number | string | null;
  clientDescription?: string | null;
  dependencies?: string | null;
  clientResponsibilities?: string | null;
  exclusions?: string | null;
};

export interface BuildProposalV5SnapshotInput {
  proposal: ProposalResponse;
  packageRecord?: Partial<PackageRecord> | null;
  generatedAt?: string;
  sourceProposalVersion?: string;
  acceptanceUrl?: string | null;
  questionUrl?: string | null;
}

function cleanString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function normalizeDate(value: unknown): string | null {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  const date = new Date(cleaned);
  return Number.isNaN(date.getTime()) ? cleaned : date.toISOString();
}

function normalizeState(value: unknown): ProposalDataState {
  if (value === "known" || value === "confirmed_on_call") return "known";
  if (value === "working_diagnosis" || value === "provisional" || value === "to_confirm") return value;
  return "to_confirm";
}

function stated<T>(
  value: T | null,
  state: unknown,
  source: string | null = null,
  sourceDate: string | null = null,
  customerWording: string | null = null,
): ProposalV5Stated<T> {
  return {
    value,
    state: normalizeState(state),
    source,
    sourceDate,
    customerWording,
  };
}

function splitLines(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) return value.map((item) => cleanString(item)).filter((item): item is string => Boolean(item));
  const cleaned = cleanString(value);
  if (!cleaned) return [];
  return cleaned
    .split(/\r?\n|;/)
    .map((item) => cleanString(item))
    .filter((item): item is string => Boolean(item));
}

function parseMoney(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) : null;
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  const match = cleaned.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export function hashProposalV5Snapshot(value: Omit<ProposalV5Snapshot, "snapshotHash"> | ProposalV5Snapshot): string {
  const unsigned = { ...(value as ProposalV5Snapshot), snapshotHash: "" };
  return createHash("sha256").update(stableStringify(unsigned)).digest("hex");
}

function v5Asset(variant: ClinicVariant, filename: string) {
  if (!variant.directory) return filename;
  return `${v5ReferenceBase}/${variant.directory}/${filename}`;
}

function v5Image(
  variant: ClinicVariant,
  slot: ProposalV5ImageSlot,
  id: string,
  filename: string,
  alt: string,
): ProposalV5Image {
  return {
    slot,
    imageId: id,
    url: v5Asset(variant, filename),
    alt,
    cropPosition: "center center",
    licence: variant.directory ? "ClinicGrower V5 reference asset pack" : "ClinicGrower website source asset",
    provenance: variant.directory ? "ClinicGrower final V5 proposal PDFs" : "ClinicGrower website source",
    approvalStatus: "approved",
  };
}

function variantAssetPack(variant: ClinicVariant) {
  return {
    cover: v5Image(variant, "cover", `${variant.id}-cover`, variant.coverFile, `${variant.shortLabel} proposal cover image`),
    journey: v5Image(variant, "journey", `${variant.id}-journey`, variant.journeyFile, `${variant.shortLabel} clinic systems and journey image`),
    proof: v5Image(variant, "proof", `${variant.id}-proof`, variant.proofFile, `${variant.shortLabel} clinical care and commercial boundary image`),
    close: v5Image(variant, "close", `${variant.id}-planning`, variant.closeFile, `${variant.shortLabel} 90-day planning image`),
  } satisfies Record<ProposalV5ImageSlot, ProposalV5Image>;
}

function normaliseClinicType(value: unknown): ProposalV5ClinicTypeId {
  const normalized = cleanString(value)?.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "general";
  const aliases: Record<string, ProposalV5ClinicTypeId> = {
    aesthetic_clinics: "aesthetic_clinic",
    aesthetics: "aesthetic_clinic",
    dental_practice: "dental_clinic",
    dental_practices: "dental_clinic",
    cosmetic_surgery: "cosmetic_surgery_clinic",
    cosmetic_surgery_clinics: "cosmetic_surgery_clinic",
    dermatology: "dermatology_clinic",
    dermatology_clinics: "dermatology_clinic",
    hair_transplant: "hair_transplant_clinic",
    hair_transplant_clinics: "hair_transplant_clinic",
    wellness: "wellness_clinic",
    wellness_clinics: "wellness_clinic",
    private_gp: "private_gp_medical_clinic",
    private_gp_medical: "private_gp_medical_clinic",
    private_gp_medical_clinics: "private_gp_medical_clinic",
    medical_spas: "medical_spa",
  };
  if (Object.prototype.hasOwnProperty.call(proposalV5ClinicTypeVariants, normalized)) {
    return normalized as ProposalV5ClinicTypeId;
  }
  return aliases[normalized] || "general";
}

function proofMetadataValue(tags: string[], key: string): string | null {
  const canonicalKey = key.trim().toLowerCase().replace(/[_\s]+/g, "-");
  const matchingTag = tags.find((tag) => {
    const separatorIndex = tag.indexOf(":");
    if (separatorIndex < 0) return false;
    const tagKey = tag.slice(0, separatorIndex).trim().toLowerCase().replace(/[_\s]+/g, "-");
    return tagKey === canonicalKey;
  });
  if (!matchingTag) return null;
  return cleanString(matchingTag.slice(matchingTag.indexOf(":") + 1));
}

function mapProof(asset: ProposalProofAssetResponse): ProposalV5ProofAsset {
  const sectorTags = asset.sectorTags || [];
  return {
    id: asset.id,
    type: asset.type,
    title: cleanString(asset.title),
    copy: cleanString(asset.copy),
    mediaUrl: cleanString(asset.mediaUrl),
    sectorTags,
    state: normalizeState(proofMetadataValue(sectorTags, "state")),
    proofMode: proofMetadataValue(sectorTags, "proof-mode"),
    proofScope: proofMetadataValue(sectorTags, "proof-scope"),
    source: proofMetadataValue(sectorTags, "source"),
    timeframe: proofMetadataValue(sectorTags, "timeframe"),
    disclaimer: proofMetadataValue(sectorTags, "disclaimer"),
  };
}

function mapSectorImage(
  slot: ProposalV5ImageSlot,
  image: Partial<ProposalSectorImage> | null | undefined,
  fallback: ProposalV5Image,
): ProposalV5Image {
  return {
    slot,
    imageId: cleanString(image?.imageId) || fallback.imageId,
    url: cleanString(image?.url) || fallback.url,
    alt: fallback.alt,
    cropPosition: cleanString(image?.cropPosition) || fallback.cropPosition,
    licence: cleanString(image?.licence) || fallback.licence,
    provenance: cleanString(image?.provenance) || fallback.provenance,
    approvalStatus: image?.approvalStatus || fallback.approvalStatus,
  };
}

function normalizeInclusionStatus(value: unknown): ProposalV5ScopeLine["inclusionStatus"] {
  return value === "included" || value === "excluded" ? value : null;
}

function normalizeDeliveryType(value: unknown): ProposalV5ScopeLine["deliveryType"] {
  return value === "recurring" || value === "one_off" ? value : null;
}

function normalizeApprovalStatus(value: unknown): ProposalV5ScopeLine["approvalStatus"] {
  if (value === "not_required" || value === "pending" || value === "approved" || value === "rejected") return value;
  return null;
}

function scopeSortOrder(item: PackageScopeSource) {
  const parsed = Number(item.sortOrder);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapScopeLine(item: PackageScopeSource): ProposalV5ScopeLine {
  return {
    category: cleanString(item.category),
    title: cleanString(item.title),
    description: cleanString(item.description) || cleanString(item.clientDescription),
    quantityLimit: cleanString(item.quantityLimit),
    frequency: cleanString(item.frequency),
    treatmentsAndLocations: cleanString(item.treatmentsAndLocations),
    dependency: cleanString(item.dependency) || cleanString(item.dependencies),
    owner: cleanString(item.owner) || cleanString(item.clientResponsibilities),
    exclusion: cleanString(item.exclusion) || cleanString(item.exclusions),
    thirdPartyCosts: cleanString(item.thirdPartyCosts),
    inclusionStatus: normalizeInclusionStatus(item.inclusionStatus),
    deliveryType: normalizeDeliveryType(item.deliveryType),
    isOptionalAddOn: Boolean(item.isOptionalAddOn),
    approvalStatus: normalizeApprovalStatus(item.approvalStatus),
  };
}

function getPackageScope(packageRecord: Partial<PackageRecord> | null | undefined) {
  const notes = packageRecord?.commercialNotes;
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) return [];
  const scopeItems = (notes as { v5ScopeItems?: unknown }).v5ScopeItems;
  if (!Array.isArray(scopeItems)) return [];
  return scopeItems
    .filter((item): item is PackageScopeSource => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    .sort((left, right) => scopeSortOrder(left) - scopeSortOrder(right))
    .map(mapScopeLine)
    .filter((item) => Boolean(item.title));
}

function resolveScope(packageRecord: Partial<PackageRecord> | null | undefined, proposalScopeItems: ProposalScopeItem[] | null | undefined) {
  const packageScope = getPackageScope(packageRecord);
  if (packageScope.length) return packageScope;
  return (proposalScopeItems || [])
    .slice()
    .sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0))
    .map(mapScopeLine)
    .filter((item) => Boolean(item.title));
}

function buildPackageSnapshot(
  proposal: ProposalResponse,
  packageRecord: Partial<PackageRecord> | null | undefined,
): ProposalV5Package {
  return {
    id: packageRecord?.id || proposal.recommendedPackageId,
    catalogueVersion: packageRecord?.catalogueVersion || null,
    name: packageRecord?.name || proposal.packageName || null,
    monthlyFeeCents: proposal.monthlyFeeCents ?? (packageRecord?.billingFrequency === "monthly" ? packageRecord?.priceCents ?? null : null),
    setupFeeCents: proposal.setupFeeCents ?? packageRecord?.setupFeeCents ?? null,
    currency: proposal.currency || packageRecord?.currency || "GBP",
    billingFrequency: packageRecord?.billingFrequency || null,
    vatStatus: proposal.vatStatus || null,
    mediaSpendRule: proposal.adSpendNote || null,
    minimumTermMonths: proposal.minimumTermMonths || null,
    noticePeriodDays: proposal.noticePeriodDays || null,
  };
}

function evidenceStateCopy(state: ProposalDataState) {
  if (state === "known") return "known";
  if (state === "working_diagnosis") return "working diagnosis";
  if (state === "provisional") return "provisional";
  return "to confirm";
}

function buildNarrative(input: {
  clinicTypeLabel: string;
  priorityServices: string[];
  currentSystems: string | null;
  currentSystemsState: ProposalDataState;
}): ProposalV5Snapshot["narrative"] {
  const clinicType = input.clinicTypeLabel.toLowerCase();
  const primaryService = input.priorityServices[0] || "";
  const servicesText = input.priorityServices.slice(0, 2).join(" and ");

  return {
    partnerProposition: {
      eyebrow: "Why ClinicGrower owns both",
      headline: "One partner should own demand and patient progression.",
      lede:
        "ClinicGrower can manage agreed website improvements, paid media and SEO, while ClinicGrower OS follows the supported journey through enquiry, response, booking, attendance, follow-up and recorded value where connected.",
      founderLabel: "Max Sharpe - founder and managing director",
      videoCtaLabel: "Meet Max, founder",
      credentialStatement: "Aesthetics Awards: Highly Commended 2025 - Finalist 2026, Best Service or Solution Provider",
      footerNote: "Product evidence remains source, connection and permission dependent.",
    },
    systemsFit: {
      eyebrow: "Fits your clinic",
      headline: `Fits your current systems. Configured for ${clinicType}.`,
      lede: "Keep working clinical systems. Add the commercial layer around one priority journey.",
      panels: [
        {
          label: "01 - Keep",
          title: "Keep the systems your team needs for care.",
          text: input.currentSystems ? `${input.currentSystems} (${evidenceStateCopy(input.currentSystemsState)}).` : "",
        },
        {
          label: "02 - Connect",
          title: "Connect supported demand and progression evidence.",
          text: "Supported sources are confirmed and mapped before final scope is issued.",
        },
        {
          label: "03 - Configure",
          title: primaryService ? `Build around ${primaryService} first.` : "",
          text: "Start with one service journey, one response standard and one accountable operating rhythm.",
        },
      ],
      imageCaption: "Sector-specific journey, language, priorities and commercial unit.",
      closeStatement: "Keep what works. Make the commercial hand-offs visible. Fix the first verified constraint.",
      footerNote: "Private and confidential.",
    },
    osCapability: {
      eyebrow: "The complete operating layer",
      headline: "One Growth Operating System - useful when evidence is connected.",
      lede: "Visibility depends on supported sources, permissions, data quality and scope.",
      availableTitle: "One commercial operating layer",
      availableItems: [
        "Demand, enquiries and pipeline",
        "Response, overdue actions and ownership",
        "Attribution and recorded value where supported",
      ],
      dependentTitle: "Live clinic evidence",
      dependentItems: [
        "Current, permitted source data",
        "Supported diary, PMS, CRM or accounts",
        "Accurate status and human review",
      ],
      capabilities: [
        { title: "Morning Brief", text: "Daily exceptions." },
        { title: "Max + AI", text: "Developing capability; human review is required." },
        { title: "Audit trail", text: "Source, time, owner and action." },
        { title: "Human ownership", text: "AI does not replace clinical judgement or a named process owner." },
      ],
      closeStatement: "Complete product. Honest boundaries. Human-reviewed decisions a clinic owner can defend.",
      footerNote: "Availability depends on agreed scope, supported connections, permissions and data quality.",
    },
    implementation: {
      eyebrow: "Your first 90 days",
      headline: "A controlled implementation - with a decision at every checkpoint.",
      lede: "First establish the truth. Then fix the first verified constraint before asking the clinic to scale.",
      checkpoints: [
        {
          label: "Days 1-14",
          title: "Establish the baseline",
          text: primaryService ? `Connect agreed sources, confirm capacity and baseline ${primaryService}.` : "",
        },
        { label: "Day 30", title: "Fix the first leak", text: "Act on the first verified demand or progression constraint." },
        { label: "Day 60", title: "Decide what earns more effort", text: "Review demand, response, bookings, attendance and recorded value." },
        { label: "Day 90", title: "Scale, hold or change route", text: "Decide against the evidence, capacity and clinic economics." },
      ],
      imageCaption: servicesText ? `Built around ${servicesText}, real capacity and the first verified constraint.` : "",
      decisionTitle: "Day 90 decision",
      decisionText: "Scale, hold or change the route.",
      footerNote: "Private and confidential.",
    },
    responsibilities: {
      providerLabel: "ClinicGrower owns",
      providerTitle: "Delivery of the accepted scope.",
      clientTitle: "Access, approvals and clinic-side decisions.",
      lede: "The proposal is only decision-ready when the delivery owner, clinic owner and access dependencies are visible before price.",
      transitionLabel: "Before price",
      transitionText: "The scope is clear. The responsibilities are clear. The investment can now be judged against evidence.",
    },
  };
}

function proofReadinessMissingFields(snapshot: Pick<ProposalV5Snapshot, "clinic" | "proof">) {
  const missing: string[] = [];
  if (!snapshot.clinic.clinicType) missing.push("clinic.clinicType");
  if (!snapshot.clinic.proofTags.length) missing.push("clinic.proofTags");

  const selectedProof = snapshot.proof.filter((asset) => Boolean(asset.title || asset.copy || asset.mediaUrl));
  if (!selectedProof.length) return [...missing, "proof.selected"];

  const proofText = (asset: ProposalV5ProofAsset) =>
    `${asset.title || ""} ${asset.copy || ""} ${asset.sectorTags.join(" ")} ${asset.source || ""} ${asset.timeframe || ""} ${asset.disclaimer || ""}`.toLowerCase();
  const normaliseTag = (value: string | null | undefined) => String(value || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  const proofTagParts = (asset: ProposalV5ProofAsset) =>
    asset.sectorTags.flatMap((tag) => {
      const raw = String(tag || "").trim().toLowerCase();
      const [key, ...rest] = raw.split(":");
      return [raw, key, rest.join(":")].filter(Boolean);
    }).filter((tag): tag is string => Boolean(tag));
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
  const proofIsCommon = (asset: ProposalV5ProofAsset) => {
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
  };
  const proofMatchesClinic = (asset: ProposalV5ProofAsset) => {
    if (proofIsCommon(asset)) return true;
    const allowedTags = new Set(snapshot.clinic.proofTags.map(normaliseTag).filter(Boolean));
    if (allowedTags.size === 0) return false;
    return proofTagParts(asset).some((tag) => {
      const [key] = tag.split(":");
      return allowedTags.has(normaliseTag(key)) ||
        [...allowedTags].some((allowedTag) => normaliseTag(tag).includes(allowedTag));
    });
  };
  const requiresClinicMatch = (asset: ProposalV5ProofAsset) =>
    ["case_study", "testimonial", "testimonial_video", "performance_result"].includes(String(asset.type || ""));
  const hasPermission = (asset: ProposalV5ProofAsset) => {
    const text = proofText(asset);
    return text.includes("permission") || text.includes("approved") || text.includes("consent");
  };
  const hasResultContext = (asset: ProposalV5ProofAsset) => {
    if (asset.type !== "performance_result") return true;
    return /\b(week|month|quarter|year|day|within|over|from|between|20\d{2}|delivery context|timeframe|documented delivery period)\b/.test(proofText(asset));
  };
  const hasVerifiedDrTanjaImage = (asset: ProposalV5ProofAsset) => {
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
  };

  const mismatchedClinicProof = selectedProof.some((asset) => requiresClinicMatch(asset) && !proofMatchesClinic(asset));
  const matchedCaseStudy = selectedProof.some((asset) => asset.type === "case_study" && proofMatchesClinic(asset));
  const permissionedTestimonial = selectedProof.some((asset) =>
    (asset.type === "testimonial" || asset.type === "testimonial_video") &&
    hasPermission(asset) &&
    proofMatchesClinic(asset),
  );
  const productScreenshot = selectedProof.some((asset) =>
    asset.type === "product_screenshot" &&
    Boolean(asset.mediaUrl) &&
    proofText(asset).includes("clinicgrower os"),
  );
  const contextualResult = selectedProof.some((asset) => asset.type === "performance_result" && hasResultContext(asset));
  const resultMissingContext = selectedProof.some((asset) => !hasResultContext(asset));
  const invalidDrTanjaImage = selectedProof.some((asset) => !hasVerifiedDrTanjaImage(asset));

  if (!matchedCaseStudy) missing.push("proof.case_study");
  if (!permissionedTestimonial) missing.push("proof.testimonial_or_video");
  if (!productScreenshot) missing.push("proof.product_screenshot_media");
  if (!contextualResult) missing.push("proof.performance_result_context");
  if (resultMissingContext) missing.push("proof.performance_result_context_all");
  if (invalidDrTanjaImage) missing.push("proof.dr_tanja_verified_image");
  if (mismatchedClinicProof) missing.push("proof.clinic_type_match");

  return missing;
}

export function isProposalV5Proposal(_proposal: Pick<ProposalResponse, "templateKey"> | null | undefined) {
  return true;
}

export function buildProposalV5Snapshot(input: BuildProposalV5SnapshotInput): ProposalV5Snapshot {
  const { proposal, packageRecord = null } = input;
  const section: ProposalSectionContent = proposal.sectionContent || {};
  const clinicType = normaliseClinicType(section.clinicTypeVariant);
  const clinicVariant = proposalV5ClinicTypeVariants[clinicType];
  const variantImages = variantAssetPack(clinicVariant);
  const savedImages = Array.isArray(section.sectorImages) ? section.sectorImages : [];
  const savedImageBySlot = new Map(savedImages.map((image) => [image.slot, image]));
  const generatedAt = normalizeDate(input.generatedAt || new Date().toISOString()) as string;
  const sourceProposalVersion = input.sourceProposalVersion || proposal.coreData?.immutableVersion || `${proposal.id}:${proposal.updatedAt || generatedAt}`;
  const proposalReference = cleanString(section.proposalReference) || "";
  const selectedPackage = buildPackageSnapshot(proposal, packageRecord);
  const priorityServices = splitLines(section.priorityTreatments);
  const scope = resolveScope(packageRecord, section.scopeItems || []);
  const proof = (section.proofAssets || []).filter((asset) => asset.isActive !== false).map(mapProof);
  const contribution = parseMoney(section.clinicConfirmedContribution);
  const selectedMediaSpend = parseMoney(section.selectedMediaSpend || section.recommendedAdSpend || proposal.adSpendNote);
  const setupFee = selectedPackage.setupFeeCents || 0;
  const monthlyFee = selectedPackage.monthlyFeeCents || proposal.valueCents || 0;
  const canCalculateBreakEven =
    contribution !== null &&
    contribution > 0 &&
    selectedMediaSpend !== null &&
    normalizeState(section.contributionConfirmationState) === "known" &&
    normalizeState(section.paybackState) === "known";

  const imagePack = {
    cover: mapSectorImage("cover", savedImageBySlot.get("cover"), variantImages.cover),
    journey: mapSectorImage("journey", savedImageBySlot.get("journey"), variantImages.journey),
    proof: mapSectorImage("proof", savedImageBySlot.get("proof"), variantImages.proof),
    close: mapSectorImage("close", savedImageBySlot.get("close"), variantImages.close),
  };

  const unsignedSnapshot: ProposalV5Snapshot = {
    schemaVersion: "proposal_v5",
    generatedAt,
    sourceProposalVersion,
    snapshotHash: "",
    pageCount: 19,
    pages: [...proposalV5PageOrder],
    proposal: {
      reference: proposalReference,
    },
    lifecycle: {
      status: proposal.status,
      createdAt: normalizeDate(proposal.createdAt),
      issuedAt: normalizeDate(proposal.sentAt || proposal.readyAt),
      expiresAt: normalizeDate(proposal.expiresAt),
      proposedStartDate: normalizeDate(proposal.startDate),
    },
    recipient: {
      name: stated(proposal.contactName || null, proposal.contactName ? "known" : "to_confirm"),
      email: stated(proposal.contactEmail || null, proposal.contactEmail ? "known" : "to_confirm"),
      authorisedDecisionMaker: stated(proposal.contactName || null, proposal.contactName ? "known" : "to_confirm"),
    },
    clinic: {
      name: stated(proposal.clientAccountName || proposal.accountName || null, proposal.clientAccountName || proposal.accountName ? "known" : "to_confirm"),
      location: stated(section.clinicTypeAndLocations || null, section.clinicTypeAndLocations ? "working_diagnosis" : "to_confirm"),
      clinicType: clinicVariant.id,
      typeLabel: clinicVariant.label,
      typeShortLabel: clinicVariant.shortLabel,
      proofTags: clinicVariant.proofTags,
      priorityServices: stated(priorityServices, section.priorityTreatments ? "working_diagnosis" : "to_confirm"),
    },
    selectedPackage,
    commercial: {
      monthlyFeeCents: selectedPackage.monthlyFeeCents,
      setupFeeCents: selectedPackage.setupFeeCents,
      mediaSpend: stated(selectedMediaSpend, section.paybackState, section.commercialDataSource || null),
      vatStatus: selectedPackage.vatStatus,
      mediaSpendRule: selectedPackage.mediaSpendRule,
      billingFrequency: selectedPackage.billingFrequency,
      minimumTermMonths: selectedPackage.minimumTermMonths,
      noticePeriodDays: selectedPackage.noticePeriodDays,
      proposedStartDate: normalizeDate(proposal.startDate),
      expiresAt: normalizeDate(proposal.expiresAt),
    },
    discovery: {
      source: section.discoverySource || null,
      customerWording: stated(section.customerWording || null, section.evidenceConfidenceState, section.discoverySource || null, null, section.customerWording || null),
      goal: stated(section.primaryGoal || null, section.evidenceConfidenceState, section.discoverySource || null),
      whyNow: stated(section.whyActNow || null, section.evidenceConfidenceState, section.discoverySource || null),
      workingDiagnosis: stated(section.diagnosis || section.biggestRisk || null, section.evidenceConfidenceState, section.discoverySource || null),
      currentSystems: stated(section.currentWebsiteCrmBookingSetup || null, section.evidenceConfidenceState, section.discoverySource || null),
    },
    journey: {
      stages: clinicVariant.journeyStages,
      activeConstraint: stated(section.activeConstraintId || null, section.activeConstraintConfidenceState, section.discoverySource || null),
      diagnosedLeaks: stated(splitLines(section.problemsDiscussed || section.currentlyUnmeasured), section.evidenceConfidenceState, section.discoverySource || null),
      demandQuestion: clinicVariant.demandQuestion,
      progressionQuestion: clinicVariant.progressionQuestion,
      postBookingContinuation: clinicVariant.postBookingContinuation,
      clinicalBoundary: clinicVariant.clinicalBoundary,
    },
    operatingRhythm: {
      morning: clinicVariant.operatingRhythmMorning,
      weekly: "ClinicGrower and the clinic review demand, response, bookings and attendance.",
      monthly: clinicVariant.operatingRhythmMonthly,
      beforeSpend: "Choose demand, progression or neither.",
    },
    economics: {
      economicUnit: section.economicUnit || clinicVariant.economicUnit,
      contribution: stated(contribution, section.contributionConfirmationState, section.contributionEvidenceSourceDate || null),
      contributionEvidenceSourceDate: section.contributionEvidenceSourceDate || null,
      capacity: stated(parseMoney(section.availableCommercialCapacity || section.availableCapacity), section.paybackState, section.commercialDataSource || null),
      selectedMediaSpend: stated(selectedMediaSpend, section.paybackState, section.commercialDataSource || null),
      recurringBreakEvenUnits: canCalculateBreakEven && contribution ? Math.ceil((monthlyFee + selectedMediaSpend) / contribution) : null,
      firstMonthBreakEvenUnits: canCalculateBreakEven && contribution ? Math.ceil((monthlyFee + selectedMediaSpend + setupFee) / contribution) : null,
    },
    readiness: {
      breakEven: {
        canDisplayValues: false,
        state: "to_confirm",
        missingFields: [],
      },
    },
    narrative: buildNarrative({
      clinicTypeLabel: clinicVariant.label,
      priorityServices,
      currentSystems: section.currentWebsiteCrmBookingSetup || null,
      currentSystemsState: normalizeState(section.evidenceConfidenceState),
    }),
    kpis: splitLines(section.successMetrics).map((metric) => {
      const parts = metric.split("|").map((part) => cleanString(part));
      const name = parts[0] || metric;
      const baseline = parts[1] || null;
      const source = parts[2] || null;
      return {
        name,
        baseline: stated(baseline, baseline ? "working_diagnosis" : "to_confirm"),
        cadence: null,
        source,
      };
    }),
    scope,
    proof,
    assets: {
      sectorImages: imagePack,
      osScreens: [
        v5Image(clinicVariant, "journey", `${clinicVariant.id}-os-screen`, clinicVariant.osScreenFile, `ClinicGrower OS view for ${clinicVariant.shortLabel}`),
      ],
      founderVideoThumbnail: {
        ...v5Image(clinicVariant, "proof", `${clinicVariant.id}-founder-video`, "p05-img02-2400x1350.png", "Max Sharpe founder video thumbnail"),
        url: cleanString(section.introVideoThumbnailUrl) || v5Image(clinicVariant, "proof", `${clinicVariant.id}-founder-video`, "p05-img02-2400x1350.png", "Max Sharpe founder video thumbnail").url,
      },
      postBookingScreenshot: v5Image(clinicVariant, "journey", `${clinicVariant.id}-post-booking-screen`, "p09-img01-1440x742.png", `${clinicVariant.shortLabel} post-booking pipeline demonstration`),
      implementationImage: imagePack.close,
    },
    links: {
      onlineProposalUrl: proposal.proposalUrl,
      acceptUrl: input.acceptanceUrl || null,
      questionUrl: input.questionUrl || null,
      videoUrl: section.introVideoUrl || section.fallbackVideoUrl || null,
      videoThumbnailUrl: cleanString(section.introVideoThumbnailUrl) || v5Image(clinicVariant, "proof", `${clinicVariant.id}-founder-video`, "p05-img02-2400x1350.png", "Max Sharpe founder video thumbnail").url,
    },
    acceptance: {
      canAccept: Boolean(input.acceptanceUrl && selectedPackage.name && proposal.expiresAt),
      lockedSnapshotHash: proposal.acceptanceRecord?.evidenceSha256 || null,
    },
  };

  const proofMissing = proofReadinessMissingFields(unsignedSnapshot);
  const breakEvenMissing = [
    ...(contribution === null || contribution <= 0 ? ["economics.contribution.value"] : []),
    ...(selectedMediaSpend === null || selectedMediaSpend < 0 ? ["economics.selectedMediaSpend.value"] : []),
    ...(normalizeState(section.contributionConfirmationState) !== "known" ? ["economics.contribution.state"] : []),
    ...(normalizeState(section.paybackState) !== "known" ? ["economics.selectedMediaSpend.state"] : []),
    ...proofMissing,
  ];
  const canDisplayBreakEvenValues = canCalculateBreakEven && proofMissing.length === 0;
  const snapshot: ProposalV5Snapshot = {
    ...unsignedSnapshot,
    readiness: {
      breakEven: {
        canDisplayValues: canDisplayBreakEvenValues,
        state: canDisplayBreakEvenValues ? "known" : "to_confirm",
        missingFields: breakEvenMissing,
      },
    },
  };

  const snapshotWithHash = {
    ...snapshot,
    snapshotHash: hashProposalV5Snapshot(snapshot),
  };
  assertProposalV5SnapshotReady(snapshotWithHash);
  return snapshotWithHash;
}

export function assertProposalV5SnapshotReady(snapshot: ProposalV5Snapshot) {
  const issues: string[] = [];
  if (snapshot.schemaVersion !== "proposal_v5") issues.push("schemaVersion");
  if (snapshot.pageCount !== 19) issues.push("pageCount");
  if (snapshot.pages.length !== 19) issues.push("pages");
  snapshot.pages.forEach((page, index) => {
    if (page.pageNumber !== index + 1) issues.push(`pages.${index}.pageNumber`);
  });
  if (!snapshot.snapshotHash || snapshot.snapshotHash !== hashProposalV5Snapshot(snapshot)) issues.push("snapshotHash");
  if (!snapshot.proposal?.reference) issues.push("proposal.reference");
  if (!snapshot.selectedPackage.name) issues.push("selectedPackage.name");
  if (!snapshot.commercial.billingFrequency) issues.push("commercial.billingFrequency");
  if (snapshot.commercial.monthlyFeeCents === null) issues.push("commercial.monthlyFeeCents");
  if (snapshot.commercial.setupFeeCents === null) issues.push("commercial.setupFeeCents");
  if (!snapshot.commercial.vatStatus) issues.push("commercial.vatStatus");
  if (!snapshot.commercial.minimumTermMonths) issues.push("commercial.minimumTermMonths");
  if (!snapshot.commercial.noticePeriodDays) issues.push("commercial.noticePeriodDays");
  if (!snapshot.commercial.proposedStartDate) issues.push("commercial.proposedStartDate");
  if (!snapshot.commercial.expiresAt) issues.push("commercial.expiresAt");
  if (!snapshot.scope.length) issues.push("scope");
  if (!snapshot.proof.length) issues.push("proof");
  for (const slot of ["cover", "journey", "proof", "close"] as const) {
    if (!snapshot.assets.sectorImages[slot]?.url) issues.push(`assets.sectorImages.${slot}.url`);
  }
  if (issues.length > 0) {
    throw new Error(`Proposal V5 snapshot is not ready: ${issues.join(", ")}`);
  }
}

export function parseProposalV5Snapshot(value: unknown): ProposalV5Snapshot | null {
  if (!value) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object") return null;
    const snapshot = parsed as ProposalV5Snapshot;
    if (snapshot.schemaVersion !== "proposal_v5" || snapshot.pageCount !== 19) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export function serializeProposalV5Snapshot(snapshot: ProposalV5Snapshot | null | undefined) {
  if (snapshot === undefined) return undefined;
  if (!snapshot) return null;
  assertProposalV5SnapshotReady(snapshot);
  return JSON.stringify(snapshot);
}

export function sanitizeProposalV5SnapshotForPublic(snapshot: ProposalV5Snapshot | null | undefined): ProposalV5PublicSnapshot | null {
  if (!snapshot) return null;
  const publicSnapshot = JSON.parse(JSON.stringify(snapshot)) as Record<string, any>;
  delete publicSnapshot.snapshotHash;
  delete publicSnapshot.sourceProposalVersion;
  if (publicSnapshot.selectedPackage) {
    delete publicSnapshot.selectedPackage.id;
    delete publicSnapshot.selectedPackage.catalogueVersion;
  }
  if (Array.isArray(publicSnapshot.proof)) {
    for (const proof of publicSnapshot.proof) {
      delete proof.id;
      if (Array.isArray(proof.sectorTags)) {
        proof.sectorTags = proof.sectorTags.filter((tag: unknown) => typeof tag === "string" && !tag.includes(":"));
      }
    }
  }
  if (publicSnapshot.assets?.sectorImages) {
    for (const image of Object.values(publicSnapshot.assets.sectorImages) as Record<string, unknown>[]) {
      delete image.imageId;
    }
  }
  if (Array.isArray(publicSnapshot.assets?.osScreens)) {
    for (const image of publicSnapshot.assets.osScreens as Record<string, unknown>[]) {
      delete image.imageId;
    }
  }
  for (const key of ["founderVideoThumbnail", "postBookingScreenshot", "implementationImage"]) {
    const image = publicSnapshot.assets?.[key];
    if (image && typeof image === "object") {
      delete image.imageId;
    }
  }
  if (publicSnapshot.acceptance) {
    delete publicSnapshot.acceptance.lockedSnapshotHash;
  }
  return publicSnapshot as ProposalV5PublicSnapshot;
}
