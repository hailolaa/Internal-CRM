import type {
  ContactImportBatchResponse,
  ContactResponse,
  ContactTimelineActivity,
  DuplicateCandidateContactSummary,
  DuplicateCandidateResponse,
} from "./contacts.types.js";

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

export function parseJsonObject(value: unknown) {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, unknown>;
  try {
    return JSON.parse(String(value)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseCommunicationPermissions(value: unknown) {
  const parsed = parseJsonObject(value) || {};
  return {
    email: parsed.email === true || parsed.email === 1,
    sms: parsed.sms === true || parsed.sms === 1,
    whatsapp: parsed.whatsapp === true || parsed.whatsapp === 1,
    phone: parsed.phone === true || parsed.phone === 1,
  };
}

function formatIso(value: unknown) {
  return value ? new Date(value as string).toISOString() : null;
}

function formatDate(value: unknown) {
  return value ? new Date(value as string).toISOString().slice(0, 10) : null;
}

function booleanOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  return Boolean(value);
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function mapGrowthScoreCategories(row: any) {
  const parsed = parseJsonObject(row.growthScoreCategories) || {};
  const score = (columnValue: unknown, key: string) => numberOrNull(columnValue ?? parsed[key]);
  return {
    websiteVisibility: score(row.growthScoreWebsiteVisibility, "websiteVisibility"),
    seo: score(row.growthScoreSeo, "seo"),
    gbp: score(row.growthScoreGbp, "gbp"),
    tracking: score(row.growthScoreTracking, "tracking"),
    conversion: score(row.growthScoreConversion, "conversion"),
    leadHandling: score(row.growthScoreLeadHandling, "leadHandling"),
    responseSpeed: score(row.growthScoreResponseSpeed, "responseSpeed"),
    enquiryVisibility: score(row.growthScoreEnquiryVisibility, "enquiryVisibility"),
    treatmentPerformance: score(row.growthScoreTreatmentPerformance, "treatmentPerformance"),
    revenueLeakage: score(row.growthScoreRevenueLeakage, "revenueLeakage"),
    growthOpportunity: score(row.growthScoreGrowthOpportunity, "growthOpportunity"),
  };
}

// Map contact rows into frontend-friendly camelCase response fields
export function mapContact(row: any): ContactResponse {
  const accountName = row.accountName || null;
  const firstName = row.firstName || null;
  const lastName = row.lastName || null;
  const name = [firstName, lastName].filter(Boolean).join(" ") || accountName || row.email || row.phone || "Unknown";
  const emailPermission = booleanOrNull(row.emailPermission);
  const phonePermission = booleanOrNull(row.phonePermission);
  const smsPermission = booleanOrNull(row.smsPermission);
  const whatsappPermission = booleanOrNull(row.whatsappPermission);
  const unsubscribed = booleanOrNull(row.unsubscribed);
  const doNotContact = booleanOrNull(row.doNotContact);
  const storedCommunicationPermissions = parseCommunicationPermissions(row.communicationPermissions);
  const communicationPermissions = {
    email: doNotContact || unsubscribed ? false : emailPermission ?? storedCommunicationPermissions.email,
    sms: doNotContact || unsubscribed ? false : smsPermission ?? storedCommunicationPermissions.sms,
    whatsapp: doNotContact || unsubscribed ? false : whatsappPermission ?? storedCommunicationPermissions.whatsapp,
    phone: doNotContact ? false : phonePermission ?? storedCommunicationPermissions.phone,
  };
  const growthScoreCategories = mapGrowthScoreCategories(row);
  const growthScoreOverall = numberOrNull(row.growthScoreOverall);
  const growthScoreRecommendedPackage = row.growthScoreRecommendedPackage || row.recommendedPackage || null;
  const growthScoreGapSummary = row.growthScoreGapSummary || null;
  const growthScoreUpdatedAt = formatIso(row.growthScoreUpdatedAt);

  return {
    id: row.id,
    accountName,
    role: row.role || null,
    communicationPermissions,
    firstName,
    lastName,
    name,
    email: row.email || null,
    phone: row.phone || null,
    roleTitle: row.roleTitle || null,
    canEmail: communicationPermissions.email,
    canCall: communicationPermissions.phone,
    canWhatsAppMessage: communicationPermissions.whatsapp,
    emailPermission: communicationPermissions.email,
    phonePermission: communicationPermissions.phone,
    smsPermission: communicationPermissions.sms,
    whatsappPermission: communicationPermissions.whatsapp,
    unsubscribed,
    doNotContact,
    permissionSource: row.permissionSource || null,
    optInAt: formatIso(row.optInAt),
    optOutAt: formatIso(row.optOutAt),
    consentUpdatedAt: formatIso(row.consentUpdatedAt),
    website: row.website || null,
    dateOfBirth: formatDate(row.dateOfBirth),
    gender: row.gender || null,
    address: row.address || null,
    city: row.city || null,
    state: row.state || null,
    postalCode: row.postalCode || null,
    country: row.country || null,
    tags: parseJsonArray(row.tags),
    status: row.status || "active",
    leadStatus: row.leadStatus || null,
    lostReason: row.lostReason || null,
    objectionType: row.objectionType || null,
    source: row.source || null,
    firstSource: row.firstSource || null,
    latestSource: row.latestSource || null,
    convertingSource: row.convertingSource || null,
    utmSource: row.utmSource || null,
    utmMedium: row.utmMedium || null,
    utmCampaign: row.utmCampaign || null,
    utmContent: row.utmContent || null,
    utmTerm: row.utmTerm || null,
    landingPage: row.landingPage || null,
    referrer: row.referrer || null,
    formSubmitted: row.formSubmitted || null,
    pageSubmitted: row.pageSubmitted || null,
    ctaClicked: row.ctaClicked || null,
    gclid: row.gclid || null,
    fbclid: row.fbclid || null,
    msclkid: row.msclkid || null,
    ttclid: row.ttclid || null,
    gbraid: row.gbraid || null,
    wbraid: row.wbraid || null,
    value: Number(row.value || 0),
    treatmentInterests: parseJsonArray(row.treatmentInterests),
    packageInterest: row.packageInterest || null,
    recommendedPackage: row.recommendedPackage || null,
    growthScore: {
      overall: growthScoreOverall,
      categories: growthScoreCategories,
      recommendedPackage: growthScoreRecommendedPackage,
      gapSummary: growthScoreGapSummary,
      updatedAt: growthScoreUpdatedAt,
    },
    growthScoreOverall,
    growthScoreCategories,
    growthScoreRecommendedPackage,
    growthScoreGapSummary,
    growthScoreUpdatedAt,
    auditStatus: row.auditStatus || null,
    auditAssignedTo: row.auditAssignedTo || null,
    auditFollowUpDueAt: formatIso(row.auditFollowUpDueAt),
    auditStatusUpdatedAt: formatIso(row.auditStatusUpdatedAt),
    notes: row.notes || null,
    externalId: row.externalId || null,
    importBatchId: row.importBatchId || null,
    lastContactAt: formatIso(row.lastContactAt),
    nextFollowUpAt: formatIso(row.nextFollowUpAt),
    contactAttemptCount: Number(row.contactAttemptCount || 0),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

// Keep duplicate-candidate responses consistent between create and import flows
function mapDuplicateContactSummary(row: any, prefix: string): DuplicateCandidateContactSummary | null {
  const id = row[`${prefix}Id`];
  if (!id) return null;

  const firstName = row[`${prefix}FirstName`] || null;
  const lastName = row[`${prefix}LastName`] || null;
  const email = row[`${prefix}Email`] || null;
  const phone = row[`${prefix}Phone`] || null;
  const name = [firstName, lastName].filter(Boolean).join(" ") || email || phone || "Unknown";

  return {
    id,
    name,
    email,
    phone,
    source: row[`${prefix}Source`] || null,
    status: row[`${prefix}Status`] || "lead",
    createdAt: new Date(row[`${prefix}CreatedAt`]).toISOString(),
  };
}

export function mapDuplicateCandidate(row: any): DuplicateCandidateResponse {
  return {
    id: row.id,
    existingContactId: row.existingContactId || null,
    candidateContactId: row.candidateContactId || null,
    existingContact: mapDuplicateContactSummary(row, "existing"),
    candidateContact: mapDuplicateContactSummary(row, "candidate"),
    matchType: row.matchType,
    score: Number(row.score),
    status: row.status,
    candidateData: parseJsonObject(row.candidateData),
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

// Summarise import batches for the import history screen
export function mapImportBatch(row: any): ContactImportBatchResponse {
  return {
    id: row.id,
    filename: row.filename || null,
    status: row.status,
    totalRows: Number(row.totalRows),
    insertedRows: Number(row.insertedRows),
    updatedRows: Number(row.updatedRows),
    duplicateRows: Number(row.duplicateRows),
    errorRows: Number(row.errorRows),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

// Convert user-facing activity records into the contact timeline shape
export function mapTimelineActivity(row: any): ContactTimelineActivity {
  return {
    id: row.id,
    type: row.type,
    timestamp: new Date(row.timestamp).toISOString(),
    userId: row.userId || null,
    metadata: parseJsonObject(row.metadata),
    createdAt: new Date(row.createdAt).toISOString(),
  };
}
