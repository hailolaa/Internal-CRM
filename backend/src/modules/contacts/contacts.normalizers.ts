import type {
  ContactCommunicationPermissions,
  GrowthScoreCategories,
  ContactImportRow,
  ContactMutationDTO,
  NormalizedContactData,
  NormalizedImportContactData,
} from "./contacts.types.js";
import { isAuditWorkflowStatus } from "../audit-workflow/audit-workflow.constants.js";

export function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function normalizeEmail(value: unknown) {
  return cleanString(value)?.toLowerCase() || null;
}

export function normalizePhone(value: unknown) {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  return cleaned.replace(/\D/g, "");
}

export function normalizeWebsiteDomain(value: unknown) {
  const cleaned = cleanString(value)?.toLowerCase();
  if (!cleaned) return null;

  try {
    const url = new URL(cleaned.includes("://") ? cleaned : `https://${cleaned}`);
    return url.hostname.replace(/^www\./, "").replace(/\.$/, "") || null;
  } catch {
    const host = cleaned
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0] || "";

    return host.split("?")[0]?.replace(/\.$/, "") || null;
  }
}

export function normalizeAccountNameForMatch(value: unknown) {
  const cleaned = cleanString(value)?.toLowerCase();
  if (!cleaned) return null;

  const normalized = cleaned
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(ltd|limited|llc|inc|plc|company|co|clinic|practice)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || null;
}

export function hasOwn(data: object, key: string) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

export function hasUsableLeadIdentity(value: {
  accountName?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  website?: unknown;
}) {
  const present = (field: keyof typeof value) =>
    typeof value[field] === "string" && value[field].trim().length > 0;
  const hasName = present("accountName") || present("firstName") || present("lastName");
  const hasContactMethod = present("email") || present("phone");
  return hasName && hasContactMethod;
}

// Keep date-only fields in MySQL DATE format
function normalizeDate(value: unknown) {
  return cleanString(value)?.slice(0, 10) || null;
}

// Store client-provided timestamps as MySQL DATETIME values
function normalizeDateTime(value: unknown) {
  const cleaned = cleanString(value);
  if (!cleaned) return null;

  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return cleaned;

  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

function normalizeMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeBoolean(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  const cleaned = cleanString(value)?.toLowerCase();
  if (!cleaned) return null;
  if (["true", "1", "yes", "y", "on", "allowed"].includes(cleaned)) return true;
  if (["false", "0", "no", "n", "off", "blocked"].includes(cleaned)) return false;
  return null;
}

function normalizeScore(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.min(100, Math.max(0, numericValue));
}

function normalizePermission(value: unknown, alias: unknown) {
  const normalizedValue = normalizeBoolean(value);
  return normalizedValue === null ? normalizeBoolean(alias) : normalizedValue;
}

function normalizeStringList(values: unknown): string[] {
  return Array.isArray(values)
    ? values.map((value) => cleanString(value)).filter(Boolean) as string[]
    : [];
}

function normalizeCommunicationPermissions(
  value: Partial<ContactCommunicationPermissions> | null | undefined,
): ContactCommunicationPermissions {
  return {
    email: value?.email === true,
    sms: value?.sms === true,
    whatsapp: value?.whatsapp === true,
    phone: value?.phone === true,
  };
}

const emptyGrowthScoreCategories: GrowthScoreCategories = {
  websiteVisibility: null,
  seo: null,
  gbp: null,
  tracking: null,
  conversion: null,
  leadHandling: null,
  responseSpeed: null,
  enquiryVisibility: null,
  treatmentPerformance: null,
  revenueLeakage: null,
  growthOpportunity: null,
};

function normalizeGrowthScoreCategories(value: Partial<GrowthScoreCategories> | null | undefined): GrowthScoreCategories {
  return {
    websiteVisibility: normalizeScore(value?.websiteVisibility),
    seo: normalizeScore(value?.seo),
    gbp: normalizeScore(value?.gbp),
    tracking: normalizeScore(value?.tracking),
    conversion: normalizeScore(value?.conversion),
    leadHandling: normalizeScore(value?.leadHandling),
    responseSpeed: normalizeScore(value?.responseSpeed),
    enquiryVisibility: normalizeScore(value?.enquiryVisibility),
    treatmentPerformance: normalizeScore(value?.treatmentPerformance),
    revenueLeakage: normalizeScore(value?.revenueLeakage),
    growthOpportunity: normalizeScore(value?.growthOpportunity),
  };
}

function normalizeGrowthScore(data: Partial<ContactMutationDTO>) {
  const snapshot = data.growthScore && typeof data.growthScore === "object" ? data.growthScore : null;
  const categories = normalizeGrowthScoreCategories(
    data.growthScoreCategories || snapshot?.categories || emptyGrowthScoreCategories,
  );

  return {
    overall: normalizeScore(data.growthScoreOverall ?? snapshot?.overall),
    categories,
    recommendedPackage: cleanString(data.growthScoreRecommendedPackage ?? snapshot?.recommendedPackage),
    gapSummary: cleanString(data.growthScoreGapSummary ?? snapshot?.gapSummary),
    updatedAt: normalizeDateTime(data.growthScoreUpdatedAt ?? snapshot?.updatedAt),
  };
}

function normalizeAuditStatus(value: unknown) {
  const cleaned = cleanString(value);
  return isAuditWorkflowStatus(cleaned) ? cleaned : null;
}

// Normalize manual create/update payloads before database writes and duplicate checks
export function normalizeContactData(data: Partial<ContactMutationDTO>): NormalizedContactData {
  const growthScore = normalizeGrowthScore(data);
  return {
    externalId: cleanString(data.externalId),
    accountName: cleanString(data.accountName),
    role: cleanString(data.role),
    communicationPermissions: normalizeCommunicationPermissions(data.communicationPermissions),
    firstName: cleanString(data.firstName),
    lastName: cleanString(data.lastName),
    email: normalizeEmail(data.email),
    phone: normalizePhone(data.phone),
    roleTitle: cleanString(data.roleTitle),
    canEmail: normalizePermission(data.emailPermission, data.canEmail),
    canCall: normalizePermission(data.phonePermission, data.canCall),
    canWhatsAppMessage: normalizePermission(data.whatsappPermission, data.canWhatsAppMessage),
    emailPermission: normalizePermission(data.emailPermission, data.canEmail),
    phonePermission: normalizePermission(data.phonePermission, data.canCall),
    smsPermission: normalizeBoolean(data.smsPermission),
    whatsappPermission: normalizePermission(data.whatsappPermission, data.canWhatsAppMessage),
    unsubscribed: normalizeBoolean(data.unsubscribed) ?? false,
    doNotContact: normalizeBoolean(data.doNotContact) ?? false,
    permissionSource: cleanString(data.permissionSource),
    optInAt: normalizeDateTime(data.optInAt),
    optOutAt: normalizeDateTime(data.optOutAt),
    consentUpdatedAt: normalizeDateTime(data.consentUpdatedAt),
    website: cleanString(data.website),
    dateOfBirth: normalizeDate(data.dateOfBirth),
    gender: cleanString(data.gender),
    address: cleanString(data.address),
    city: cleanString(data.city),
    state: cleanString(data.state),
    postalCode: cleanString(data.postalCode),
    country: cleanString(data.country),
    tags: normalizeStringList(data.tags),
    status: cleanString(data.status),
    leadStatus: cleanString(data.leadStatus),
    lostReason: cleanString(data.lostReason),
    objectionType: cleanString(data.objectionType),
    source: cleanString(data.source),
    firstSource: cleanString(data.firstSource),
    latestSource: cleanString(data.latestSource),
    convertingSource: cleanString(data.convertingSource),
    utmSource: cleanString(data.utmSource),
    utmMedium: cleanString(data.utmMedium),
    utmCampaign: cleanString(data.utmCampaign),
    utmContent: cleanString(data.utmContent),
    utmTerm: cleanString(data.utmTerm),
    landingPage: cleanString(data.landingPage),
    referrer: cleanString(data.referrer),
    formSubmitted: cleanString(data.formSubmitted),
    pageSubmitted: cleanString(data.pageSubmitted),
    ctaClicked: cleanString(data.ctaClicked),
    gclid: cleanString(data.gclid),
    fbclid: cleanString(data.fbclid),
    msclkid: cleanString(data.msclkid),
    ttclid: cleanString(data.ttclid),
    gbraid: cleanString(data.gbraid),
    wbraid: cleanString(data.wbraid),
    value: normalizeMoney(data.value),
    treatmentInterests: normalizeStringList(data.treatmentInterests),
    packageInterest: cleanString(data.packageInterest),
    recommendedPackage: cleanString(data.recommendedPackage),
    growthScore,
    growthScoreOverall: growthScore.overall,
    growthScoreCategories: growthScore.categories,
    growthScoreRecommendedPackage: growthScore.recommendedPackage,
    growthScoreGapSummary: growthScore.gapSummary,
    growthScoreUpdatedAt: growthScore.updatedAt,
    auditStatus: normalizeAuditStatus(data.auditStatus),
    auditAssignedTo: cleanString(data.auditAssignedTo),
    auditFollowUpDueAt: normalizeDateTime(data.auditFollowUpDueAt),
    auditStatusUpdatedAt: normalizeDateTime(data.auditStatusUpdatedAt),
    notes: cleanString(data.notes),
    lastContactAt: normalizeDateTime(data.lastContactAt),
  };
}

// Import rows share contact normalization but keep import-safe defaults
export function normalizeImportRow(row: ContactImportRow): NormalizedImportContactData {
  const normalized = normalizeContactData({
    ...row,
    status: row.status || "lead",
    leadStatus: row.leadStatus || row.status || "new",
    lostReason: row.lostReason || null,
    objectionType: row.objectionType || null,
    source: row.source || "import",
  });

  return {
    ...normalized,
    status: normalized.status || "lead",
    leadStatus: normalized.leadStatus || "new",
    lostReason: normalized.lostReason,
    objectionType: normalized.objectionType,
    source: normalized.source || "import",
  };
}
