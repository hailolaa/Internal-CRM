import { v4 as uuidv4 } from "uuid";
import crypto from "node:crypto";
import type { PoolConnection } from "mysql2/promise";
import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { csvRows } from "../../utils/csv.js";
import { buildTimelineMetadata, insertTimelineActivity } from "../../utils/activity.js";
import { insertAuditEvent, logAuditEvent } from "../../utils/audit.js";
import { googleDriveOAuthService } from "./google-drive-oauth.service.js";
import type {
  ClientAccountAuditContext,
  ClientAccountContactAccountLinkResponse,
  ClientAccountAcceptedProposalResponse,
  ClientAccountListQuery,
  ClientAccountLinkedContactResponse,
  ClientAccountLinkedRecordsResponse,
  ClientAccountLinkedTaskResponse,
  ClientAccountAccessItemResponse,
  ClientAccountDocumentLinkResponse,
  ClientAccountProfileResponse,
  ClientAccountServiceListQuery,
  ClientAccountServiceResponse,
  ClientAccountSummaryResponse,
  ClientAccountUpsellPrompt,
  ClientAccessItemType,
  ClientIssueResponse,
  CreateClientAccountDTO,
  CreateClientAccountFromContactDTO,
  CreateClientAccountDriveFolderDTO,
  CreateClientIssueDTO,
  ClientDocumentType,
  ConvertWonDealToClientDTO,
  GrowthScoreCategories,
  InvoiceStatus,
  PaymentStatus,
  RenameClientAccountDriveFileDTO,
  CreateClientAccountServiceDTO,
  UpdateClientAccountAccessItemDTO,
  UpdateClientAccountDocumentLinkDTO,
  UpdateClientAccountDriveFolderDTO,
  UpdateClientIssueDTO,
  UpdateClientAccountServiceDTO,
  UpdateClientAccountProfileDTO,
} from "./client-accounts.types.js";

const DEFAULT_PROFILE = {
  activeServices: [] as string[],
  onboardingStatus: "not_started",
  healthStatus: "attention_needed",
  clientStatus: "prospect",
  currentPackage: null as string | null,
  monthlyPrice: null as number | null,
  setupFee: null as number | null,
  currency: "GBP",
  recommendedNextPackage: null as string | null,
  upsellOpportunity: null as string | null,
  churnRisk: "low",
  lastContactAt: null as string | null,
  lastReportAt: null as string | null,
  lastLoomAt: null as string | null,
  contractStatus: "pending",
  contractStartDate: null as string | null,
  noticeDate: null as string | null,
  paymentStatus: "not_started",
  invoiceStatus: "not_sent",
  paymentNotes: null as string | null,
};

const emptyGrowthScoreCategories = {
  websiteVisibility: null as number | null,
  seo: null as number | null,
  gbp: null as number | null,
  tracking: null as number | null,
  conversion: null as number | null,
  leadHandling: null as number | null,
  responseSpeed: null as number | null,
  enquiryVisibility: null as number | null,
  treatmentPerformance: null as number | null,
  revenueLeakage: null as number | null,
  growthOpportunity: null as number | null,
};

const clientDocumentTypes = [
  { type: "main_client_folder", label: "Main client folder" },
  { type: "audit", label: "Audit" },
  { type: "proposal", label: "Proposal" },
  { type: "contract_admin", label: "Contract/admin" },
  { type: "onboarding", label: "Onboarding" },
  { type: "website_assets", label: "Website/assets" },
  { type: "reports", label: "Reports" },
  { type: "strategy_looms", label: "Strategy/looms" },
  { type: "ads", label: "Ads" },
  { type: "seo_content", label: "SEO/content" },
  { type: "landing_pages", label: "Landing pages" },
] as const satisfies ReadonlyArray<{ type: ClientDocumentType; label: string }>;

const clientAccessItemTypes = [
  { type: "website", label: "Website access" },
  { type: "ga4", label: "GA4" },
  { type: "gsc", label: "Search Console" },
  { type: "gtm", label: "Tag Manager" },
  { type: "google_ads", label: "Google Ads" },
  { type: "gbp", label: "Google Business Profile" },
  { type: "meta", label: "Meta" },
  { type: "brand_assets", label: "Brand assets" },
  { type: "treatment_pricing_info", label: "Treatment/pricing information" },
  { type: "reporting_access", label: "Reporting access" },
] as const satisfies ReadonlyArray<{ type: ClientAccessItemType; label: string }>;

const expectedClientDocumentLinkCount = clientDocumentTypes.length - 1;
const expectedClientAccessItemCount = clientAccessItemTypes.length;

function toClientAccountsCsv(accounts: ClientAccountSummaryResponse[]) {
  const headers = [
    "id",
    "clinicId",
    "clinicName",
    "email",
    "phone",
    "website",
    "city",
    "country",
    "accountManagerId",
    "accountManagerName",
    "accountManagerEmail",
    "clientStatus",
    "onboardingStatus",
    "healthStatus",
    "currentPackage",
    "monthlyPrice",
    "setupFee",
    "currency",
    "recommendedNextPackage",
    "contractStatus",
    "contractStartDate",
    "renewalDate",
    "noticeDate",
    "paymentStatus",
    "invoiceStatus",
    "activeServiceCount",
    "pendingTaskCount",
    "overdueTaskCount",
    "openIssueCount",
    "missingDocumentCount",
    "missingAccessCount",
    "updatedAt",
  ];
  const rows = accounts.map((account) => [
    account.id,
    account.clinicId,
    account.clinicName,
    account.email,
    account.phone,
    account.website,
    account.city,
    account.country,
    account.accountManager?.id || null,
    account.accountManager
      ? [account.accountManager.firstName, account.accountManager.lastName].filter(Boolean).join(" ") || null
      : null,
    account.accountManager?.email || null,
    account.clientStatus,
    account.onboardingStatus,
    account.healthStatus,
    account.currentPackage,
    account.monthlyPrice,
    account.setupFee,
    account.currency,
    account.recommendedNextPackage,
    account.contractStatus,
    account.contractStartDate,
    account.renewalDate,
    account.noticeDate,
    account.paymentStatus,
    account.invoiceStatus,
    account.activeServiceCount,
    account.pendingTaskCount,
    account.overdueTaskCount,
    account.openIssueCount,
    account.missingDocumentCount,
    account.missingAccessCount,
    account.updatedAt,
  ]);

  return csvRows(headers, rows);
}

function parseServices(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);

  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: unknown) {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, unknown>;
  try {
    return JSON.parse(String(value)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeScore(value: unknown) {
  const numericValue = numberOrNull(value);
  if (numericValue === null) return null;
  return Math.min(100, Math.max(0, numericValue));
}

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
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

function mapGrowthScoreSnapshot(row: any) {
  const categories = mapGrowthScoreCategories(row);
  const overall = numberOrNull(row.growthScoreOverall);
  const recommendedPackage = row.growthScoreRecommendedPackage || row.recommendedNextPackage || null;
  const gapSummary = row.growthScoreGapSummary || null;
  const updatedAt = toIsoString(row.growthScoreUpdatedAt);
  return {
    growthScore: {
      overall,
      categories,
      recommendedPackage,
      gapSummary,
      updatedAt,
    },
    growthScoreOverall: overall,
    growthScoreCategories: categories,
    growthScoreRecommendedPackage: recommendedPackage,
    growthScoreGapSummary: gapSummary,
    growthScoreUpdatedAt: updatedAt,
  };
}

function normalizeGrowthScore(data: UpdateClientAccountProfileDTO) {
  const snapshot = data.growthScore && typeof data.growthScore === "object" ? data.growthScore : null;
  const rawCategories = data.growthScoreCategories || snapshot?.categories || {};
  return {
    overall: normalizeScore(data.growthScoreOverall ?? snapshot?.overall),
    categories: {
      websiteVisibility: normalizeScore(rawCategories.websiteVisibility),
      seo: normalizeScore(rawCategories.seo),
      gbp: normalizeScore(rawCategories.gbp),
      tracking: normalizeScore(rawCategories.tracking),
      conversion: normalizeScore(rawCategories.conversion),
      leadHandling: normalizeScore(rawCategories.leadHandling),
      responseSpeed: normalizeScore(rawCategories.responseSpeed),
      enquiryVisibility: normalizeScore(rawCategories.enquiryVisibility),
      treatmentPerformance: normalizeScore(rawCategories.treatmentPerformance),
      revenueLeakage: normalizeScore(rawCategories.revenueLeakage),
      growthOpportunity: normalizeScore(rawCategories.growthOpportunity),
    },
    recommendedPackage: cleanString(data.growthScoreRecommendedPackage ?? snapshot?.recommendedPackage),
    gapSummary: cleanString(data.growthScoreGapSummary ?? snapshot?.gapSummary),
    updatedAt: toDateTimeString(data.growthScoreUpdatedAt ?? snapshot?.updatedAt),
  };
}

function toDateTimeString(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

function toDateString(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function isClosedIssueStatus(value: unknown) {
  return value === "resolved" || value === "closed";
}

function issueSlaStatus(row: any): ClientIssueResponse["slaStatus"] {
  if (isClosedIssueStatus(row.status) || row.resolvedAt) return "resolved";
  const target = row.slaDueAt || row.dueDate;
  if (!target) return "on_track";
  const parsed = new Date(String(target));
  if (Number.isNaN(parsed.getTime())) return "on_track";
  const now = new Date();
  if (parsed.getTime() < now.getTime()) return "overdue";
  if (parsed.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)) return "due_today";
  return "on_track";
}

function shouldAutoEscalateIssue(status: unknown, slaDueAt: unknown) {
  if (isClosedIssueStatus(status) || !slaDueAt) return false;
  const parsed = new Date(String(slaDueAt));
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now();
}

function calculateNoticeDate(value: unknown, months: unknown, noticeDays: unknown) {
  const start = toDateString(value);
  if (!start) return null;
  const date = new Date(`${start}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCMonth(date.getUTCMonth() + Number(months || 0));
  date.setUTCDate(date.getUTCDate() - Number(noticeDays || 0));
  return date.toISOString().slice(0, 10);
}

function toIsoString(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function ownKey<T extends object>(data: T, key: keyof T) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function normalizeServices(services: string[]) {
  return Array.from(new Set(services.map((service) => service.trim()).filter(Boolean)));
}

function normalizePackageName(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreIsWeak(value: number | null | undefined, threshold = 60) {
  return typeof value === "number" && value <= threshold;
}

function scoreIsStrong(value: number | null | undefined, threshold = 70) {
  return typeof value === "number" && value >= threshold;
}

function buildUpsellPrompts(row: {
  currentPackage?: string | null;
  recommendedNextPackage?: string | null;
  growthScoreOverall?: number | null;
  growthScoreCategories?: GrowthScoreCategories;
  growthScoreGapSummary?: string | null;
}): ClientAccountUpsellPrompt[] {
  const current = normalizePackageName(row.currentPackage);
  const recommended = normalizePackageName(row.recommendedNextPackage);
  const categories = row.growthScoreCategories || emptyGrowthScoreCategories;
  const prompts: ClientAccountUpsellPrompt[] = [];

  const addPrompt = (prompt: ClientAccountUpsellPrompt) => {
    if (prompts.some((item) => item.ruleKey === prompt.ruleKey)) return;
    prompts.push(prompt);
  };

  if (
    current.includes("growth diagnostic") &&
    (scoreIsWeak(categories.leadHandling) || scoreIsWeak(categories.responseSpeed) || recommended.includes("lead concierge"))
  ) {
    addPrompt({
      ruleKey: "growth_diagnostic_to_lead_concierge",
      fromPackage: "Growth Diagnostic",
      toPackage: "Lead Concierge",
      reason: "Lead handling or response speed is weak, so Lead Concierge should be reviewed.",
      severity: "high",
    });
  }

  if (
    current.includes("lead concierge") &&
    (
      scoreIsWeak(categories.websiteVisibility) ||
      scoreIsWeak(categories.seo) ||
      scoreIsWeak(categories.gbp) ||
      scoreIsWeak(categories.tracking) ||
      scoreIsWeak(categories.enquiryVisibility) ||
      recommended.includes("performance os")
    )
  ) {
    addPrompt({
      ruleKey: "lead_concierge_to_performance_os",
      fromPackage: "Lead Concierge",
      toPackage: "Performance OS",
      reason: "Visibility, tracking or accountability gaps suggest Performance OS.",
      severity: "medium",
    });
  }

  if (
    current.includes("performance os") &&
    (
      scoreIsWeak(categories.conversion) ||
      scoreIsWeak(categories.revenueLeakage) ||
      scoreIsStrong(categories.growthOpportunity) ||
      recommended.includes("growth engine")
    )
  ) {
    addPrompt({
      ruleKey: "performance_os_to_growth_engine",
      fromPackage: "Performance OS",
      toPackage: "Growth Engine",
      reason: "Conversion, revenue leakage or growth-opportunity signals point to managed growth.",
      severity: "medium",
    });
  }

  if (
    current.includes("growth engine") &&
    (scoreIsStrong(categories.growthOpportunity) || scoreIsStrong(row.growthScoreOverall) || recommended.includes("market leader"))
  ) {
    addPrompt({
      ruleKey: "growth_engine_to_market_leader",
      fromPackage: "Growth Engine",
      toPackage: "Market Leader",
      reason: "High growth opportunity or strong current performance suggests Market Leader should be considered.",
      severity: "medium",
    });
  }

  return prompts;
}

function contactDisplayName(row: any) {
  return [row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
    row.email ||
    row.phone ||
    row.accountName ||
    "Unnamed contact";
}

type GoogleDriveItemKind = "folder" | "file" | "unknown";
type GoogleDriveTokenCache = {
  token: string;
  expiresAt: number;
};

type WonDealConversionTransactionHooks = {
  beforeConversion?: (connection: PoolConnection) => Promise<void>;
  afterConversion?: (connection: PoolConnection) => Promise<void>;
};

type ClientAccountActorContext = {
  role: string | null;
};

function extractGoogleDriveItem(value: string): { id: string; kindHint: GoogleDriveItemKind } {
  const input = value.trim().replace(/^["'<\s]+|[>"'\s]+$/g, "");
  const validDriveId = (candidate: string | null | undefined) =>
    Boolean(candidate && /^[A-Za-z0-9_-]{5,255}$/.test(candidate));

  if (validDriveId(input) && !input.includes(".")) return { id: input, kindHint: "unknown" };

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw ApiError.badRequest("Enter a valid Google Drive item URL or ID.");
  }

  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    (host !== "drive.google.com" && host !== "docs.google.com")
  ) {
    throw ApiError.badRequest("Only HTTPS Google Drive and Google Docs links are supported.");
  }

  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    throw ApiError.badRequest("Google Drive link contains invalid URL encoding.");
  }
  const fileId = path.match(/\/file\/d\/([^/?#]+)/)?.[1];
  const googleEditorId = path.match(
    /\/(?:document|spreadsheets|presentation|forms|drawings)\/(?:u\/\d+\/)?d\/([^/?#]+)/,
  )?.[1];
  const folderId =
    path.match(/\/drive\/(?:u\/\d+\/)?(?:mobile\/)?folders\/([^/?#]+)/)?.[1] ||
    path.match(/\/folders\/([^/?#]+)/)?.[1];
  const driveId =
    folderId ||
    fileId ||
    googleEditorId ||
    url.searchParams.get("id");
  const kindHint: GoogleDriveItemKind = folderId ? "folder" : fileId || googleEditorId ? "file" : "unknown";

  if (!validDriveId(driveId)) {
    throw ApiError.badRequest("Google Drive link must include a valid item ID.");
  }

  return { id: String(driveId), kindHint };
}

export class ClientAccountsService {
  private googleDriveTokenCache: GoogleDriveTokenCache | null = null;

  private canAssignClientAccountOwners(actorContext: ClientAccountActorContext) {
    const role = String(actorContext.role || "").toUpperCase();
    return role === "SUPER_ADMIN" || role === "ADMIN";
  }

  private ensureAccountManagerAssignmentAllowed(actorContext: ClientAccountActorContext) {
    if (!this.canAssignClientAccountOwners(actorContext)) {
      throw ApiError.forbidden("Only an Admin can assign or change an account manager.");
    }
  }

  private ensureIssueOwnerAssignmentAllowed(actorContext: ClientAccountActorContext) {
    if (!this.canAssignClientAccountOwners(actorContext)) {
      throw ApiError.forbidden("Only an Admin can assign or change an issue owner.");
    }
  }

  async listAccounts(
    clinicId: string,
    options: { includeAllClinics: boolean; query?: ClientAccountListQuery },
  ): Promise<ClientAccountSummaryResponse[]> {
    const query = options.query || {};
    const conditions = ["c.deleted_at IS NULL", "cap.id IS NOT NULL"];
    const values: any[] = [];

    if (!options.includeAllClinics) {
      conditions.push("c.id = ?");
      values.push(clinicId);
    }

    if (query.healthStatus && query.healthStatus !== "all") {
      conditions.push("COALESCE(cap.health_status, ?) = ?");
      values.push(DEFAULT_PROFILE.healthStatus, query.healthStatus);
    }

    if (query.churnRisk && query.churnRisk !== "all") {
      conditions.push("COALESCE(cap.churn_risk, ?) = ?");
      values.push(DEFAULT_PROFILE.churnRisk, query.churnRisk);
    }

    if (query.clientStatus && query.clientStatus !== "all") {
      conditions.push("COALESCE(cap.client_status, ?) = ?");
      values.push(DEFAULT_PROFILE.clientStatus, query.clientStatus);
    }

    if (query.contractStatus && query.contractStatus !== "all") {
      conditions.push("COALESCE(cap.contract_status, ?) = ?");
      values.push(DEFAULT_PROFILE.contractStatus, query.contractStatus);
    }

    const search = query.search?.trim();
    if (search) {
      const wildcard = `%${search}%`;
      conditions.push(
        "(c.name LIKE ? OR c.email LIKE ? OR cap.current_package LIKE ? OR cap.payment_status LIKE ? OR cap.invoice_status LIKE ? OR u.email LIKE ? OR CONCAT_WS(' ', u.first_name, u.last_name) LIKE ?)",
      );
      values.push(wildcard, wildcard, wildcard, wildcard, wildcard, wildcard, wildcard);
    }

    const [rows]: any = await pool.execute(
      `SELECT
          c.id as clinicId,
          c.name as clinicName,
          c.email,
          c.phone,
          c.website,
          c.address,
          c.city,
          c.state,
          c.postal_code as postalCode,
          c.country,
          c.updated_at as clinicUpdatedAt,
          cap.id,
          cap.account_manager_id as accountManagerId,
          cap.active_services as activeServices,
          cap.onboarding_status as onboardingStatus,
          cap.health_status as healthStatus,
          cap.client_status as clientStatus,
          cap.current_package as currentPackage,
          cap.monthly_price as monthlyPrice,
          cap.setup_fee as setupFee,
          cap.currency,
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
          cap.growth_score_updated_at as growthScoreUpdatedAt,
          cap.churn_risk as churnRisk,
          cap.last_contact_at as lastContactAt,
          cap.last_report_at as lastReportAt,
          cap.last_loom_at as lastLoomAt,
          cap.renewal_date as renewalDate,
          cap.contract_status as contractStatus,
          cap.contract_start_date as contractStartDate,
          cap.notice_date as noticeDate,
          cap.payment_status as paymentStatus,
          cap.invoice_status as invoiceStatus,
          cap.payment_notes as paymentNotes,
          cap.key_notes as keyNotes,
          cap.google_drive_folder_id as googleDriveFolderId,
          cap.google_drive_folder_url as googleDriveFolderUrl,
          cap.google_drive_folder_name as googleDriveFolderName,
          cap.google_drive_folder_access_status as googleDriveFolderAccessStatus,
          cap.google_drive_folder_error as googleDriveFolderError,
          cap.google_drive_folder_checked_at as googleDriveFolderCheckedAt,
          cap.updated_at as updatedAt,
          u.first_name as accountManagerFirstName,
          u.last_name as accountManagerLastName,
          u.email as accountManagerEmail,
          service_summary.serviceTypes as derivedActiveServices,
          COALESCE(service_summary.activeServiceCount, 0) as activeServiceCount,
          COALESCE(service_summary.renewalRiskCount, 0) as renewalRiskCount,
          COALESCE(task_summary.pendingTaskCount, 0) as pendingTaskCount,
          COALESCE(task_summary.overdueTaskCount, 0) as overdueTaskCount,
          COALESCE(task_summary.qaTaskCount, 0) as qaTaskCount,
          COALESCE(task_summary.missedTaskCount, 0) as missedTaskCount,
          COALESCE(task_summary.escalatedTaskCount, 0) as escalatedTaskCount,
          COALESCE(issue_summary.openIssueCount, 0) as openIssueCount,
          COALESCE(issue_summary.overdueIssueCount, 0) as overdueIssueCount,
          (
            CASE
              WHEN cap.google_drive_folder_url IS NULL
                OR cap.google_drive_folder_url = ''
                OR cap.google_drive_folder_access_status = 'inaccessible'
              THEN 1
              ELSE 0
            END
            + GREATEST(
                0,
                ${expectedClientDocumentLinkCount} - COALESCE(document_summary.availableDocumentCount, 0)
              )
          ) as missingDocumentCount,
          GREATEST(
            0,
            ${expectedClientAccessItemCount} - COALESCE(access_summary.completedAccessCount, 0)
          ) as missingAccessCount,
          strategy_summary.lastStrategyLogAt as lastStrategyLogAt,
          action_plan_summary.actionPlanId as actionPlanId,
          action_plan_summary.actionPlanMonth as actionPlanMonth,
          action_plan_summary.actionPlanStatus as actionPlanStatus,
          COALESCE(action_plan_summary.actionPlanTotalItems, 0) as actionPlanTotalItems,
          COALESCE(action_plan_summary.actionPlanCompletedItems, 0) as actionPlanCompletedItems,
          COALESCE(action_plan_summary.actionPlanOpenItems, 0) as actionPlanOpenItems,
          COALESCE(action_plan_summary.actionPlanHighPriorityOpenItems, 0) as actionPlanHighPriorityOpenItems,
          action_plan_summary.actionPlanLastUpdatedAt as actionPlanLastUpdatedAt
       FROM clinic c
       LEFT JOIN client_account_profile cap ON cap.clinic_id = c.id
       LEFT JOIN user u ON u.id = cap.account_manager_id AND u.deleted_at IS NULL
       LEFT JOIN (
          SELECT
            clinic_id,
            COUNT(*) as activeServiceCount,
            SUM(
              CASE
                WHEN renewal_date IS NOT NULL
                 AND renewal_date <= DATE_ADD(CURDATE(), INTERVAL 45 DAY)
                 AND contract_status IN ('active', 'trial', 'pending')
                THEN 1
                ELSE 0
              END
            ) as renewalRiskCount,
            GROUP_CONCAT(DISTINCT service_type ORDER BY service_type SEPARATOR ',') as serviceTypes
          FROM client_account_service
          WHERE archived_at IS NULL
            AND status <> 'archived'
          GROUP BY clinic_id
       ) service_summary ON service_summary.clinic_id = c.id
       LEFT JOIN (
          SELECT
            COALESCE(t.client_account_profile_id, legacy_cap.id) as clientAccountProfileId,
            SUM(CASE WHEN t.status <> 'completed' THEN 1 ELSE 0 END) as pendingTaskCount,
            SUM(CASE WHEN t.status <> 'completed' AND t.due_date IS NOT NULL AND t.due_date < CURDATE() THEN 1 ELSE 0 END) as overdueTaskCount,
            SUM(CASE WHEN t.needs_qa = 1 OR t.approval_status IN ('pending', 'needs_changes') THEN 1 ELSE 0 END) as qaTaskCount,
            SUM(CASE WHEN t.status <> 'completed' AND t.missed_task = 1 THEN 1 ELSE 0 END) as missedTaskCount,
            SUM(CASE WHEN t.escalation_flag = 1 THEN 1 ELSE 0 END) as escalatedTaskCount
          FROM task t
          LEFT JOIN client_account_profile legacy_cap
            ON t.client_account_profile_id IS NULL
           AND legacy_cap.clinic_id = t.clinic_id
          WHERE t.is_internal = 1
            AND t.deleted_at IS NULL
            AND t.archived_at IS NULL
            AND COALESCE(t.client_account_profile_id, legacy_cap.id) IS NOT NULL
          GROUP BY COALESCE(t.client_account_profile_id, legacy_cap.id)
       ) task_summary ON task_summary.clientAccountProfileId = cap.id
       LEFT JOIN (
          SELECT
            client_account_profile_id,
            COUNT(*) as openIssueCount,
            SUM(CASE WHEN due_date IS NOT NULL AND due_date < CURDATE() THEN 1 ELSE 0 END) as overdueIssueCount
          FROM client_account_issue
          WHERE clinic_id = ?
            AND status NOT IN ('resolved', 'closed')
          GROUP BY client_account_profile_id
       ) issue_summary ON issue_summary.client_account_profile_id = cap.id
       LEFT JOIN (
          SELECT
            client_account_profile_id,
            COUNT(*) as availableDocumentCount
          FROM client_account_document_link
          WHERE clinic_id = ?
            AND drive_url IS NOT NULL
            AND drive_url <> ''
            AND access_status <> 'inaccessible'
          GROUP BY client_account_profile_id
       ) document_summary ON document_summary.client_account_profile_id = cap.id
       LEFT JOIN (
          SELECT
            client_account_profile_id,
            COUNT(*) as completedAccessCount
          FROM client_account_access_item
          WHERE clinic_id = ?
            AND status IN ('received', 'not_needed')
          GROUP BY client_account_profile_id
       ) access_summary ON access_summary.client_account_profile_id = cap.id
       LEFT JOIN (
          SELECT clinic_id, MAX(updated_at) as lastStrategyLogAt
          FROM strategy_log
          WHERE archived_at IS NULL
          GROUP BY clinic_id
       ) strategy_summary ON strategy_summary.clinic_id = c.id
       LEFT JOIN (
          SELECT
            map.clinic_id,
            map.id as actionPlanId,
            DATE_FORMAT(map.plan_month, '%Y-%m') as actionPlanMonth,
            map.status as actionPlanStatus,
            COUNT(item.id) as actionPlanTotalItems,
            SUM(CASE WHEN item.status = 'completed' THEN 1 ELSE 0 END) as actionPlanCompletedItems,
            SUM(CASE WHEN item.status IN ('planned', 'in_progress') THEN 1 ELSE 0 END) as actionPlanOpenItems,
            SUM(CASE WHEN item.priority = 'high' AND item.status IN ('planned', 'in_progress') THEN 1 ELSE 0 END) as actionPlanHighPriorityOpenItems,
            MAX(COALESCE(item.updated_at, map.updated_at)) as actionPlanLastUpdatedAt
          FROM monthly_action_plan map
          LEFT JOIN monthly_action_plan_item item
            ON item.plan_id = map.id
           AND item.clinic_id = map.clinic_id
           AND item.deleted_at IS NULL
          WHERE map.deleted_at IS NULL
            AND map.plan_month = DATE_FORMAT(CURDATE(), '%Y-%m-01')
          GROUP BY map.clinic_id, map.id, map.plan_month, map.status
       ) action_plan_summary ON action_plan_summary.clinic_id = c.id
       WHERE ${conditions.join(" AND ")}
       ORDER BY
         CASE COALESCE(cap.health_status, 'attention_needed')
           WHEN 'critical' THEN 0
           WHEN 'at_risk' THEN 1
           WHEN 'attention_needed' THEN 2
           ELSE 3
         END,
         COALESCE(task_summary.escalatedTaskCount, 0) DESC,
         c.name ASC`,
      [clinicId, clinicId, clinicId, ...values],
    );

    return rows.map((row: any) => this.mapAccountSummaryRow(row));
  }

  async exportAccountsCsv(
    clinicId: string,
    options: { includeAllClinics: boolean; query?: ClientAccountListQuery },
  ): Promise<string> {
    const accounts = await this.listAccounts(clinicId, options);
    return toClientAccountsCsv(accounts);
  }

  async createAccount(
    userId: string,
    data: CreateClientAccountDTO,
    actorContext: ClientAccountActorContext,
    auditContext: ClientAccountAuditContext,
  ): Promise<ClientAccountSummaryResponse> {
    if (data.accountManagerId) {
      this.ensureAccountManagerAssignmentAllowed(actorContext);
      await this.ensureActiveInternalUser(data.accountManagerId);
    }

    const clinicId = uuidv4();
    const profileId = uuidv4();
    const payload = this.normalizeAccountPayload(data);

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await this.insertAccountRows(connection, userId, clinicId, profileId, data);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "CLIENT_ACCOUNT_CREATED",
      entityType: "client_account_profile",
      entityId: profileId,
      changes: payload,
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getAccountSummary(clinicId);
  }

  private async insertAccountRows(
    connection: PoolConnection,
    userId: string,
    clinicId: string,
    profileId: string,
    data: CreateClientAccountDTO,
  ) {
    const payload = this.normalizeAccountPayload(data);

    await connection.execute(
      `INSERT INTO clinic
        (id, name, email, website, phone, address, city, state, postal_code, country,
         timezone, subscription_plan, subscription_status, max_users)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Europe/London', 'professional', 'active', 20)`,
      [
        clinicId,
        payload.name,
        payload.email,
        payload.website,
        payload.phone,
        payload.address,
        payload.city,
        payload.state,
        payload.postalCode,
        payload.country,
      ],
    );

    await connection.execute(
      `INSERT INTO client_account_profile
        (id, clinic_id, account_manager_id, active_services, onboarding_status, health_status,
         client_status, current_package, monthly_price, setup_fee, currency,
         recommended_next_package, upsell_opportunity,
         growth_score_overall, growth_score_categories, growth_score_website_visibility, growth_score_seo, growth_score_gbp,
         growth_score_tracking, growth_score_conversion, growth_score_lead_handling, growth_score_response_speed,
         growth_score_enquiry_visibility, growth_score_treatment_performance, growth_score_revenue_leakage,
         growth_score_growth_opportunity, growth_score_recommended_package, growth_score_gap_summary, growth_score_updated_at,
         churn_risk, last_contact_at, last_report_at, last_loom_at, renewal_date, contract_status, contract_start_date, notice_date,
         payment_status, invoice_status, payment_notes, key_notes,
         created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        profileId,
        clinicId,
        payload.accountManagerId,
        JSON.stringify(payload.activeServices),
        payload.onboardingStatus,
        payload.healthStatus,
        payload.clientStatus,
        payload.currentPackage,
        payload.monthlyPrice,
        payload.setupFee,
        payload.currency,
        payload.recommendedNextPackage,
        payload.upsellOpportunity,
        payload.growthScoreOverall,
        JSON.stringify(payload.growthScoreCategories),
        payload.growthScoreCategories.websiteVisibility,
        payload.growthScoreCategories.seo,
        payload.growthScoreCategories.gbp,
        payload.growthScoreCategories.tracking,
        payload.growthScoreCategories.conversion,
        payload.growthScoreCategories.leadHandling,
        payload.growthScoreCategories.responseSpeed,
        payload.growthScoreCategories.enquiryVisibility,
        payload.growthScoreCategories.treatmentPerformance,
        payload.growthScoreCategories.revenueLeakage,
        payload.growthScoreCategories.growthOpportunity,
        payload.growthScoreRecommendedPackage,
        payload.growthScoreGapSummary,
        payload.growthScoreUpdatedAt,
        payload.churnRisk,
        payload.lastContactAt,
        payload.lastReportAt,
        payload.lastLoomAt,
        payload.renewalDate,
        payload.contractStatus,
        payload.contractStartDate,
        payload.noticeDate,
        payload.paymentStatus,
        payload.invoiceStatus,
        payload.paymentNotes,
        payload.keyNotes,
        userId,
        userId,
      ],
    );
  }

  async createAccountFromContact(
    sourceClinicId: string,
    userId: string,
    data: CreateClientAccountFromContactDTO,
    actorContext: ClientAccountActorContext,
    auditContext: ClientAccountAuditContext,
  ): Promise<ClientAccountSummaryResponse> {
    if (data.accountManagerId) {
      this.ensureAccountManagerAssignmentAllowed(actorContext);
    }

    const [rows]: any = await pool.execute(
      `SELECT id, first_name as firstName, last_name as lastName, email, phone,
              address, city, state, postal_code as postalCode, country, value,
              treatment_interests as treatmentInterests, package_interest as packageInterest,
              recommended_package as recommendedPackage, notes
       FROM contact
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [data.contactId, sourceClinicId],
    );

    if (rows.length === 0) {
      throw ApiError.notFound("Prospect not found");
    }

    const contact = rows[0];
    const existingLinkedAccount = await this.findLinkedClientAccountForContact(sourceClinicId, data.contactId);
    if (existingLinkedAccount?.clinicId) {
      return this.getAccountSummary(existingLinkedAccount.clinicId, sourceClinicId);
    }

    const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
    const treatmentInterests = parseServices(contact.treatmentInterests);
    const recommendedPackage =
      data.currentPackage ||
      contact.recommendedPackage ||
      contact.packageInterest ||
      treatmentInterests[0] ||
      null;

    const account = await this.createAccount(
      userId,
      {
        ...data,
        name: data.accountName || contactName || contact.email || "New Client Account",
        email: contact.email || null,
        phone: contact.phone || null,
        address: contact.address || null,
        city: contact.city || null,
        state: contact.state || null,
        postalCode: contact.postalCode || null,
        country: contact.country || null,
        activeServices: data.activeServices || treatmentInterests,
        clientStatus: data.clientStatus || "onboarding",
        onboardingStatus: data.onboardingStatus || "in_progress",
        currentPackage: recommendedPackage,
        recommendedNextPackage: data.recommendedNextPackage || contact.recommendedPackage || null,
        upsellOpportunity: data.upsellOpportunity || null,
        keyNotes:
          data.keyNotes ||
          [
            contact.notes,
            `Converted from prospect ${contactName || contact.email || data.contactId}.`,
          ]
            .filter(Boolean)
            .join("\n\n"),
      },
      actorContext,
      auditContext,
    );

    const nextNotes = [
      contact.notes,
      `Converted to client account: ${account.clinicName}.`,
    ]
      .filter(Boolean)
      .join("\n\n");

    await pool.execute(
      `UPDATE contact
       SET status = 'active',
           lead_status = 'converted',
           notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [nextNotes, data.contactId, sourceClinicId],
    );

    if (account.id) {
      await this.linkContactRelation(sourceClinicId, account.id, data.contactId, userId);
    }

    await logAuditEvent({
      clinicId: sourceClinicId,
      userId,
      action: "PROSPECT_CONVERTED_TO_CLIENT_ACCOUNT",
      entityType: "contact",
      entityId: data.contactId,
      changes: {
        clientAccountClinicId: account.clinicId,
        clientAccountProfileId: account.id,
        clientAccountName: account.clinicName,
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return account;
  }

  async convertWonDealToClient(
    sourceClinicId: string,
    userId: string,
    data: ConvertWonDealToClientDTO,
    actorContext: ClientAccountActorContext,
    auditContext: ClientAccountAuditContext,
    transactionHooks: WonDealConversionTransactionHooks = {},
  ): Promise<ClientAccountSummaryResponse> {
    if (data.accountManagerId) {
      this.ensureAccountManagerAssignmentAllowed(actorContext);
    }

    const connection = await pool.getConnection();
    let existingClinicId: string | null = null;
    let createdClinicId: string | null = null;
    let createdProfileId: string | null = null;
    let accountPayload: CreateClientAccountDTO | null = null;
    let deal: any = null;

    try {
      await connection.beginTransaction();
      await transactionHooks.beforeConversion?.(connection);

      const [lockedDealRows]: any = await connection.execute(
        `SELECT contact_id as contactId,
                client_account_profile_id as clientAccountProfileId
         FROM deal
         WHERE id = ?
           AND clinic_id = ?
           AND deleted_at IS NULL
         LIMIT 1
         FOR UPDATE`,
        [data.dealId, sourceClinicId],
      );
      const lockedDeal = lockedDealRows[0];
      if (!lockedDeal) throw ApiError.notFound("Won opportunity not found");

      if (lockedDeal.clientAccountProfileId) {
        const [profileRows]: any = await connection.execute(
          `SELECT cap.clinic_id as clinicId,
                  c.name as clinicName
           FROM client_account_profile cap
           JOIN clinic c
             ON c.id = cap.clinic_id
            AND c.deleted_at IS NULL
           WHERE cap.id = ?
           LIMIT 1`,
          [lockedDeal.clientAccountProfileId],
        );
        if (!profileRows[0]?.clinicId) {
          throw ApiError.conflict("Converted client account link is invalid");
        }
        existingClinicId = profileRows[0].clinicId;

        const [existingDealRows]: any = await connection.execute(
          `SELECT d.id,
                  d.contact_id as contactId,
                  d.title,
                  d.treatment,
                  d.source as dealSource,
                  d.owner_id as ownerId,
                  c.first_name as firstName,
                  c.last_name as lastName,
                  c.email,
                  c.source as contactSource
           FROM deal d
           JOIN contact c
             ON c.id = d.contact_id
            AND c.clinic_id = d.clinic_id
            AND c.deleted_at IS NULL
           WHERE d.id = ?
             AND d.clinic_id = ?
             AND d.deleted_at IS NULL
           LIMIT 1`,
          [data.dealId, sourceClinicId],
        );
        deal = existingDealRows[0];
        if (!deal) throw ApiError.notFound("Won opportunity not found");

        await this.createConversionOnboardingTasks(
          sourceClinicId,
          userId,
          {
            id: lockedDeal.clientAccountProfileId,
            clinicName: profileRows[0].clinicName,
          },
          deal,
          connection,
        );
      } else {
        const [lockedContactRows]: any = await connection.execute(
          `SELECT id
           FROM contact
           WHERE id = ?
             AND clinic_id = ?
             AND deleted_at IS NULL
           LIMIT 1
           FOR UPDATE`,
          [lockedDeal.contactId, sourceClinicId],
        );
        if (!lockedContactRows[0]) {
          throw ApiError.notFound("Won opportunity contact not found");
        }

        if (data.accountManagerId) {
          await this.ensureActiveInternalUser(data.accountManagerId, connection);
        }

        const [dealRows]: any = await connection.execute(
          `SELECT d.id,
                  d.contact_id as contactId,
                  d.client_account_profile_id as clientAccountProfileId,
                  d.title,
                  d.value,
                  d.source as dealSource,
                  d.treatment,
                  d.owner_id as ownerId,
                  d.status,
                  d.sold_at as soldAt,
                  d.audit_status as auditStatus,
                  d.audit_assigned_to as auditAssignedTo,
                  d.audit_follow_up_due_at as auditFollowUpDueAt,
                  d.audit_status_updated_at as auditStatusUpdatedAt,
                  ps.kind as stageKind,
                  c.first_name as firstName,
                  c.last_name as lastName,
                  c.email,
                  c.phone,
                  c.website,
                  c.account_name as accountName,
                  c.address,
                  c.city,
                  c.state,
                  c.postal_code as postalCode,
                  c.country,
                  c.source as contactSource,
                  c.value as contactValue,
                  c.treatment_interests as treatmentInterests,
                  c.package_interest as packageInterest,
                  c.recommended_package as recommendedPackage,
                  c.notes,
                  c.growth_score_overall as growthScoreOverall,
                  c.growth_score_categories as growthScoreCategories,
                  c.growth_score_website_visibility as growthScoreWebsiteVisibility,
                  c.growth_score_seo as growthScoreSeo,
                  c.growth_score_gbp as growthScoreGbp,
                  c.growth_score_tracking as growthScoreTracking,
                  c.growth_score_conversion as growthScoreConversion,
                  c.growth_score_lead_handling as growthScoreLeadHandling,
                  c.growth_score_response_speed as growthScoreResponseSpeed,
                  c.growth_score_enquiry_visibility as growthScoreEnquiryVisibility,
                  c.growth_score_treatment_performance as growthScoreTreatmentPerformance,
                  c.growth_score_revenue_leakage as growthScoreRevenueLeakage,
                  c.growth_score_growth_opportunity as growthScoreGrowthOpportunity,
                  c.growth_score_recommended_package as growthScoreRecommendedPackage,
                  c.growth_score_gap_summary as growthScoreGapSummary,
                  c.growth_score_updated_at as growthScoreUpdatedAt,
                  (
                    SELECT par.monthly_fee_cents
                    FROM proposal_acceptance_record par
                    WHERE par.clinic_id = d.clinic_id
                      AND par.deleted_at IS NULL
                      AND (par.deal_id = d.id OR par.contact_id = d.contact_id)
                    ORDER BY par.accepted_at DESC
                    LIMIT 1
                  ) as acceptedMonthlyFeeCents,
                  (
                    SELECT par.setup_fee_cents
                    FROM proposal_acceptance_record par
                    WHERE par.clinic_id = d.clinic_id
                      AND par.deleted_at IS NULL
                      AND (par.deal_id = d.id OR par.contact_id = d.contact_id)
                    ORDER BY par.accepted_at DESC
                    LIMIT 1
                  ) as acceptedSetupFeeCents,
                  (
                    SELECT par.currency
                    FROM proposal_acceptance_record par
                    WHERE par.clinic_id = d.clinic_id
                      AND par.deleted_at IS NULL
                      AND (par.deal_id = d.id OR par.contact_id = d.contact_id)
                    ORDER BY par.accepted_at DESC
                    LIMIT 1
                  ) as acceptedCurrency,
                  (
                    SELECT par.start_date
                    FROM proposal_acceptance_record par
                    WHERE par.clinic_id = d.clinic_id
                      AND par.deleted_at IS NULL
                      AND (par.deal_id = d.id OR par.contact_id = d.contact_id)
                    ORDER BY par.accepted_at DESC
                    LIMIT 1
                  ) as acceptedStartDate,
                  (
                    SELECT par.minimum_term_months
                    FROM proposal_acceptance_record par
                    WHERE par.clinic_id = d.clinic_id
                      AND par.deleted_at IS NULL
                      AND (par.deal_id = d.id OR par.contact_id = d.contact_id)
                    ORDER BY par.accepted_at DESC
                    LIMIT 1
                  ) as acceptedMinimumTermMonths,
                  (
                    SELECT par.notice_period_days
                    FROM proposal_acceptance_record par
                    WHERE par.clinic_id = d.clinic_id
                      AND par.deleted_at IS NULL
                      AND (par.deal_id = d.id OR par.contact_id = d.contact_id)
                    ORDER BY par.accepted_at DESC
                    LIMIT 1
                  ) as acceptedNoticePeriodDays
           FROM deal d
           JOIN contact c
             ON c.id = d.contact_id
            AND c.clinic_id = d.clinic_id
            AND c.deleted_at IS NULL
           LEFT JOIN pipeline_stage ps
             ON ps.id = d.pipeline_stage_id
            AND ps.clinic_id = d.clinic_id
            AND ps.deleted_at IS NULL
           WHERE d.id = ?
             AND d.clinic_id = ?
             AND d.deleted_at IS NULL
           LIMIT 1`,
          [data.dealId, sourceClinicId],
        );

        deal = dealRows[0];
        if (!deal) throw ApiError.notFound("Won opportunity not found");
        if (deal.status !== "won" && deal.stageKind !== "won") {
          throw ApiError.badRequest("Only won opportunities can be converted to client accounts");
        }

        const existingLinkedAccount = await this.findLinkedClientAccountForContact(
          sourceClinicId,
          deal.contactId,
          connection,
        );
        if (existingLinkedAccount?.profileId && existingLinkedAccount?.clinicId) {
          existingClinicId = existingLinkedAccount.clinicId;

          const [dealUpdate]: any = await connection.execute(
            `UPDATE deal
             SET client_account_profile_id = ?,
                 client_converted_at = COALESCE(client_converted_at, CURRENT_TIMESTAMP),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?
               AND clinic_id = ?
               AND client_account_profile_id IS NULL
               AND deleted_at IS NULL`,
            [existingLinkedAccount.profileId, data.dealId, sourceClinicId],
          );
          if (dealUpdate.affectedRows !== 1) {
            throw ApiError.conflict("Won opportunity was already converted");
          }

          await connection.execute(
            `UPDATE proposal
             SET client_account_profile_id = COALESCE(client_account_profile_id, ?),
                 updated_at = CURRENT_TIMESTAMP
             WHERE clinic_id = ?
               AND deleted_at IS NULL
               AND (deal_id = ? OR contact_id = ?)`,
            [existingLinkedAccount.profileId, sourceClinicId, data.dealId, deal.contactId],
          );

          await connection.execute(
            `UPDATE proposal_acceptance_record
             SET client_account_profile_id = COALESCE(client_account_profile_id, ?)
             WHERE clinic_id = ?
               AND (deal_id = ? OR contact_id = ?)`,
            [existingLinkedAccount.profileId, sourceClinicId, data.dealId, deal.contactId],
          );

          await connection.execute(
            `UPDATE growth_score_snapshot
             SET client_account_profile_id = COALESCE(client_account_profile_id, ?)
             WHERE clinic_id = ?
               AND contact_id = ?`,
            [existingLinkedAccount.profileId, sourceClinicId, deal.contactId],
          );

          await connection.execute(
            `UPDATE contact
             SET status = 'active',
                 lead_status = 'converted',
                 account_name = COALESCE(account_name, ?),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?
               AND clinic_id = ?
               AND deleted_at IS NULL`,
            [existingLinkedAccount.clinicName || deal.accountName || null, deal.contactId, sourceClinicId],
          );

          await this.linkContactRelation(
            sourceClinicId,
            existingLinkedAccount.profileId,
            deal.contactId,
            userId,
            connection,
          );

          await this.createConversionOnboardingTasks(
            sourceClinicId,
            userId,
            {
              id: existingLinkedAccount.profileId,
              clinicName: existingLinkedAccount.clinicName || deal.accountName || "Client Account",
            },
            deal,
            connection,
          );
        } else {

        const contactName = [deal.firstName, deal.lastName].filter(Boolean).join(" ").trim();
        const treatmentInterests = parseServices(deal.treatmentInterests);
        const activeServices = (
          data.activeServices?.length
            ? data.activeServices
            : [deal.treatment, deal.packageInterest, ...treatmentInterests].filter(Boolean)
        ).map(String);
        const currentPackage =
          data.currentPackage ||
          deal.treatment ||
          deal.recommendedPackage ||
          deal.packageInterest ||
          treatmentInterests[0] ||
          null;
        const parsedGrowthScoreCategories = parseJsonObject(deal.growthScoreCategories) as
          | Partial<GrowthScoreCategories>
          | null;
        const acceptedMonthlyPrice = deal.acceptedMonthlyFeeCents === null || deal.acceptedMonthlyFeeCents === undefined
          ? null
          : Number(deal.acceptedMonthlyFeeCents) / 100;
        const acceptedSetupFee = deal.acceptedSetupFeeCents === null || deal.acceptedSetupFeeCents === undefined
          ? null
          : Number(deal.acceptedSetupFeeCents) / 100;
        const contractStartDate = data.contractStartDate || toDateString(deal.acceptedStartDate);
        const noticeDate =
          data.noticeDate ||
          calculateNoticeDate(deal.acceptedStartDate, deal.acceptedMinimumTermMonths, deal.acceptedNoticePeriodDays);
        accountPayload = {
          name: data.accountName || deal.accountName || contactName || deal.email || "New Client Account",
          email: deal.email || null,
          phone: deal.phone || null,
          website: deal.website || null,
          address: deal.address || null,
          city: deal.city || null,
          state: deal.state || null,
          postalCode: deal.postalCode || null,
          country: deal.country || null,
          activeServices,
          clientStatus: data.clientStatus || "onboarding",
          onboardingStatus: data.onboardingStatus || "in_progress",
          healthStatus: data.healthStatus || "attention_needed",
          contractStatus: data.contractStatus || "pending",
          currentPackage,
          monthlyPrice: data.monthlyPrice ?? acceptedMonthlyPrice,
          setupFee: data.setupFee ?? acceptedSetupFee,
          currency: data.currency || deal.acceptedCurrency || DEFAULT_PROFILE.currency,
          contractStartDate,
          noticeDate,
          paymentStatus: data.paymentStatus || (acceptedMonthlyPrice !== null ? "pending" : DEFAULT_PROFILE.paymentStatus) as PaymentStatus,
          invoiceStatus: data.invoiceStatus || (acceptedMonthlyPrice !== null ? "not_sent" : DEFAULT_PROFILE.invoiceStatus) as InvoiceStatus,
          paymentNotes: data.paymentNotes || null,
          recommendedNextPackage: data.recommendedNextPackage || deal.recommendedPackage || deal.growthScoreRecommendedPackage || null,
          growthScoreOverall: data.growthScoreOverall ?? deal.growthScoreOverall ?? null,
          growthScoreCategories: data.growthScoreCategories || parsedGrowthScoreCategories,
          growthScoreRecommendedPackage: data.growthScoreRecommendedPackage || deal.growthScoreRecommendedPackage || null,
          growthScoreGapSummary: data.growthScoreGapSummary || deal.growthScoreGapSummary || null,
          growthScoreUpdatedAt: data.growthScoreUpdatedAt || deal.growthScoreUpdatedAt || null,
          keyNotes:
            data.keyNotes ||
            [
              deal.notes,
              `Converted from won opportunity: ${deal.title || data.dealId}.`,
              deal.dealSource || deal.contactSource ? `Original source: ${deal.dealSource || deal.contactSource}.` : null,
            ]
              .filter(Boolean)
              .join("\n\n"),
        };
        if (data.accountManagerId !== undefined) accountPayload.accountManagerId = data.accountManagerId;
        if (data.upsellOpportunity !== undefined) accountPayload.upsellOpportunity = data.upsellOpportunity;
        if (data.renewalDate !== undefined) accountPayload.renewalDate = data.renewalDate;
        if (data.churnRisk !== undefined) accountPayload.churnRisk = data.churnRisk;

        createdClinicId = uuidv4();
        createdProfileId = uuidv4();
        const normalizedAccount = this.normalizeAccountPayload(accountPayload);
        await this.insertAccountRows(connection, userId, createdClinicId, createdProfileId, accountPayload);

        const [dealUpdate]: any = await connection.execute(
          `UPDATE deal
           SET client_account_profile_id = ?,
               client_converted_at = COALESCE(client_converted_at, CURRENT_TIMESTAMP),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?
             AND clinic_id = ?
             AND client_account_profile_id IS NULL
             AND deleted_at IS NULL`,
          [createdProfileId, data.dealId, sourceClinicId],
        );
        if (dealUpdate.affectedRows !== 1) {
          throw ApiError.conflict("Won opportunity was already converted");
        }

        await connection.execute(
          `UPDATE proposal
           SET client_account_profile_id = COALESCE(client_account_profile_id, ?),
               updated_at = CURRENT_TIMESTAMP
           WHERE clinic_id = ?
             AND deleted_at IS NULL
             AND (deal_id = ? OR contact_id = ?)`,
          [createdProfileId, sourceClinicId, data.dealId, deal.contactId],
        );

        await connection.execute(
          `UPDATE proposal_acceptance_record
           SET client_account_profile_id = COALESCE(client_account_profile_id, ?)
           WHERE clinic_id = ?
             AND (deal_id = ? OR contact_id = ?)`,
          [createdProfileId, sourceClinicId, data.dealId, deal.contactId],
        );

        await connection.execute(
          `UPDATE growth_score_snapshot
           SET client_account_profile_id = COALESCE(client_account_profile_id, ?)
           WHERE clinic_id = ?
             AND contact_id = ?`,
          [createdProfileId, sourceClinicId, deal.contactId],
        );

        await connection.execute(
          `UPDATE contact
           SET status = 'active',
               lead_status = 'converted',
               account_name = COALESCE(account_name, ?),
               notes = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?
             AND clinic_id = ?
             AND deleted_at IS NULL`,
          [
            normalizedAccount.name,
            [deal.notes, `Converted to client account from won opportunity: ${normalizedAccount.name}.`].filter(Boolean).join("\n\n"),
            deal.contactId,
            sourceClinicId,
          ],
        );

        await this.linkContactRelation(sourceClinicId, createdProfileId, deal.contactId, userId, connection);

        await this.createConversionOnboardingTasks(
          sourceClinicId,
          userId,
          { id: createdProfileId, clinicName: normalizedAccount.name },
          deal,
          connection,
        );

        await this.insertConversionEvents(connection, {
          sourceClinicId,
          userId,
          data,
          auditContext,
          deal,
          createdClinicId,
          createdProfileId,
          accountPayload,
        });
        }
      }

      await transactionHooks.afterConversion?.(connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    if (existingClinicId) {
      return this.getAccountSummary(existingClinicId, sourceClinicId);
    }
    if (!createdClinicId || !createdProfileId || !accountPayload || !deal) {
      throw ApiError.internal("Client account conversion did not complete");
    }

    return this.getAccountSummary(createdClinicId, sourceClinicId);
  }

  async getProfile(
    clinicId: string,
    workspaceClinicId = clinicId,
  ): Promise<ClientAccountProfileResponse> {
    const [rows]: any = await pool.execute(
      `SELECT
          c.id as clinicId,
          c.name as clinicName,
          c.email,
          c.phone,
          c.website,
          c.address,
          c.city,
          c.state,
          c.postal_code as postalCode,
          c.country,
          cap.id,
          cap.account_manager_id as accountManagerId,
          cap.active_services as activeServices,
          cap.onboarding_status as onboardingStatus,
          cap.health_status as healthStatus,
          cap.client_status as clientStatus,
          cap.current_package as currentPackage,
          cap.monthly_price as monthlyPrice,
          cap.setup_fee as setupFee,
          cap.currency,
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
          cap.growth_score_updated_at as growthScoreUpdatedAt,
          cap.churn_risk as churnRisk,
          cap.last_contact_at as lastContactAt,
          cap.last_report_at as lastReportAt,
          cap.last_loom_at as lastLoomAt,
          cap.renewal_date as renewalDate,
          cap.contract_status as contractStatus,
          cap.contract_start_date as contractStartDate,
          cap.notice_date as noticeDate,
          cap.payment_status as paymentStatus,
          cap.invoice_status as invoiceStatus,
          cap.payment_notes as paymentNotes,
          cap.key_notes as keyNotes,
          cap.google_drive_folder_id as googleDriveFolderId,
          cap.google_drive_folder_url as googleDriveFolderUrl,
          cap.google_drive_folder_name as googleDriveFolderName,
          cap.google_drive_folder_access_status as googleDriveFolderAccessStatus,
          cap.google_drive_folder_error as googleDriveFolderError,
          cap.google_drive_folder_checked_at as googleDriveFolderCheckedAt,
          (
            CASE
              WHEN cap.google_drive_folder_url IS NULL
                OR cap.google_drive_folder_url = ''
                OR cap.google_drive_folder_access_status = 'inaccessible'
              THEN 1
              ELSE 0
            END
            + GREATEST(
                0,
                ${expectedClientDocumentLinkCount} - (
                  SELECT COUNT(*)
                  FROM client_account_document_link cdl
                  WHERE cdl.client_account_profile_id = cap.id
                    AND cdl.clinic_id = ?
                    AND cdl.drive_url IS NOT NULL
                    AND cdl.drive_url <> ''
                    AND cdl.access_status <> 'inaccessible'
                )
              )
          ) as missingDocumentCount,
          GREATEST(
            0,
            ${expectedClientAccessItemCount} - (
              SELECT COUNT(*)
              FROM client_account_access_item cai
              WHERE cai.client_account_profile_id = cap.id
                AND cai.clinic_id = ?
                AND cai.status IN ('received', 'not_needed')
            )
          ) as missingAccessCount,
          (
            SELECT COUNT(*)
            FROM client_account_issue ci
            WHERE ci.client_account_profile_id = cap.id
              AND ci.clinic_id = ?
              AND ci.status NOT IN ('resolved', 'closed')
          ) as openIssueCount,
          (
            SELECT COUNT(*)
            FROM client_account_issue ci
            WHERE ci.client_account_profile_id = cap.id
              AND ci.clinic_id = ?
              AND ci.status NOT IN ('resolved', 'closed')
              AND ci.due_date IS NOT NULL
              AND ci.due_date < CURDATE()
          ) as overdueIssueCount,
          cap.updated_at as updatedAt,
          u.first_name as accountManagerFirstName,
          u.last_name as accountManagerLastName,
          u.email as accountManagerEmail
       FROM clinic c
       LEFT JOIN client_account_profile cap ON cap.clinic_id = c.id
       LEFT JOIN user u ON u.id = cap.account_manager_id AND u.deleted_at IS NULL
       WHERE c.id = ? AND c.deleted_at IS NULL
       LIMIT 1`,
      [workspaceClinicId, workspaceClinicId, workspaceClinicId, workspaceClinicId, clinicId],
    );

    if (rows.length === 0) {
      throw ApiError.notFound("Clinic account not found");
    }

    const row = rows[0];
    const growthScore = mapGrowthScoreSnapshot(row);
    return {
      id: row.id || null,
      clinicId: row.clinicId,
      clinicName: row.clinicName,
      email: row.email || null,
      phone: row.phone || null,
      website: row.website || null,
      address: row.address || null,
      city: row.city || null,
      state: row.state || null,
      postalCode: row.postalCode || null,
      country: row.country || null,
      accountManager: row.accountManagerId
        ? {
            id: row.accountManagerId,
            firstName: row.accountManagerFirstName || null,
            lastName: row.accountManagerLastName || null,
            email: row.accountManagerEmail || null,
          }
        : null,
      activeServices: parseServices(row.activeServices),
      onboardingStatus: row.onboardingStatus || DEFAULT_PROFILE.onboardingStatus,
      healthStatus: row.healthStatus || DEFAULT_PROFILE.healthStatus,
      clientStatus: row.clientStatus || DEFAULT_PROFILE.clientStatus,
      currentPackage: row.currentPackage || DEFAULT_PROFILE.currentPackage,
      monthlyPrice: numberOrNull(row.monthlyPrice),
      setupFee: numberOrNull(row.setupFee),
      currency: row.currency || DEFAULT_PROFILE.currency,
      recommendedNextPackage: row.recommendedNextPackage || DEFAULT_PROFILE.recommendedNextPackage,
      upsellOpportunity: row.upsellOpportunity || DEFAULT_PROFILE.upsellOpportunity,
      ...growthScore,
      churnRisk: row.churnRisk || DEFAULT_PROFILE.churnRisk,
      lastContactAt: toIsoString(row.lastContactAt),
      lastReportAt: toIsoString(row.lastReportAt),
      lastLoomAt: toIsoString(row.lastLoomAt),
      renewalDate: toDateString(row.renewalDate),
      contractStatus: row.contractStatus || DEFAULT_PROFILE.contractStatus,
      contractStartDate: toDateString(row.contractStartDate),
      noticeDate: toDateString(row.noticeDate),
      paymentStatus: row.paymentStatus || DEFAULT_PROFILE.paymentStatus,
      invoiceStatus: row.invoiceStatus || DEFAULT_PROFILE.invoiceStatus,
      paymentNotes: row.paymentNotes || null,
      keyNotes: row.keyNotes || null,
      googleDriveFolderId: row.googleDriveFolderId || null,
      googleDriveFolderUrl: row.googleDriveFolderUrl || null,
      googleDriveFolderName: row.googleDriveFolderName || null,
      googleDriveFolderAccessStatus: row.googleDriveFolderAccessStatus || "not_checked",
      googleDriveFolderError: row.googleDriveFolderError || null,
      googleDriveFolderCheckedAt: toIsoString(row.googleDriveFolderCheckedAt),
      upsellPrompts: buildUpsellPrompts({
        currentPackage: row.currentPackage,
        recommendedNextPackage: row.recommendedNextPackage || growthScore.growthScoreRecommendedPackage,
        growthScoreOverall: growthScore.growthScoreOverall,
        growthScoreCategories: growthScore.growthScoreCategories,
        growthScoreGapSummary: growthScore.growthScoreGapSummary,
      }),
      openIssueCount: Number(row.openIssueCount || 0),
      overdueIssueCount: Number(row.overdueIssueCount || 0),
      missingDocumentCount: Number(row.missingDocumentCount || 0),
      missingAccessCount: Number(row.missingAccessCount || 0),
      updatedAt: toIsoString(row.updatedAt),
    };
  }

  async getLinkedRecords(
    sourceClinicId: string,
    clientClinicId: string,
    access: { canManageAllClientAccounts: boolean } = { canManageAllClientAccounts: false },
  ): Promise<ClientAccountLinkedRecordsResponse> {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);
    const account = await this.getProfile(clientClinicId, sourceClinicId);
    const [contacts, tasks, acceptedProposals] = await Promise.all([
      account.id ? this.listLinkedContacts(sourceClinicId, account.id) : Promise.resolve([]),
      account.id ? this.listLinkedTasks(sourceClinicId, account.id) : Promise.resolve([]),
      account.id ? this.listAcceptedProposals(sourceClinicId, account.id) : Promise.resolve([]),
    ]);
    const openTasks = tasks.filter((task) => task.status !== "completed");
    const completedTasks = tasks.filter((task) => task.status === "completed");

    return {
      account,
      contacts,
      openTasks,
      completedTasks,
      acceptedProposals,
      counts: {
        contacts: contacts.length,
        openTasks: openTasks.length,
        completedTasks: completedTasks.length,
        acceptedProposals: acceptedProposals.length,
      },
    };
  }

  async linkContactToAccount(
    sourceClinicId: string,
    clientClinicId: string,
    contactId: string,
    userId: string,
    access: { canManageAllClientAccounts: boolean },
    auditContext: ClientAccountAuditContext,
  ): Promise<ClientAccountLinkedRecordsResponse> {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);
    const profileId = await this.ensureProfileRow(clientClinicId, userId);
    const account = await this.getProfile(clientClinicId, sourceClinicId);
    const contact = await this.getWorkspaceContact(sourceClinicId, contactId);
    const relationId = await this.linkContactRelation(sourceClinicId, profileId, contactId, userId);

    if (!account.id) {
      throw ApiError.notFound("Client account profile not found");
    }

    await logAuditEvent({
      clinicId: sourceClinicId,
      userId,
      action: "CONTACT_LINKED_TO_CLIENT_ACCOUNT",
      entityType: "contact",
      entityId: contactId,
      changes: {
        relationId,
        clientAccountClinicId: account.clinicId,
        clientAccountProfileId: account.id,
        clientAccountName: account.clinicName,
        previousAccountName: contact.accountName,
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getLinkedRecords(sourceClinicId, clientClinicId, access);
  }

  async unlinkContactFromAccount(
    sourceClinicId: string,
    clientClinicId: string,
    contactId: string,
    userId: string,
    access: { canManageAllClientAccounts: boolean },
    auditContext: ClientAccountAuditContext,
  ): Promise<ClientAccountLinkedRecordsResponse> {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);
    const account = await this.getProfile(clientClinicId, sourceClinicId);
    const contact = await this.getWorkspaceContact(sourceClinicId, contactId);

    if (!account.id) {
      throw ApiError.notFound("Client account profile not found");
    }

    const [result]: any = await pool.execute(
      `DELETE FROM client_account_contact
       WHERE clinic_id = ?
         AND client_account_profile_id = ?
         AND contact_id = ?`,
      [sourceClinicId, account.id, contactId],
    );
    if (result.affectedRows === 0) {
      throw ApiError.badRequest("Contact is not linked to this client account");
    }

    await logAuditEvent({
      clinicId: sourceClinicId,
      userId,
      action: "CONTACT_UNLINKED_FROM_CLIENT_ACCOUNT",
      entityType: "contact",
      entityId: contactId,
      changes: {
        clientAccountClinicId: account.clinicId,
        clientAccountProfileId: account.id,
        clientAccountName: account.clinicName,
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getLinkedRecords(sourceClinicId, clientClinicId, access);
  }

  async updateDriveFolder(
    sourceClinicId: string,
    clientClinicId: string,
    userId: string,
    data: UpdateClientAccountDriveFolderDTO,
    access: { canManageAllClientAccounts: boolean },
    auditContext: ClientAccountAuditContext,
    requireFolder = false,
  ): Promise<ClientAccountProfileResponse> {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);

    const before = await this.getProfile(clientClinicId, sourceClinicId);
    const profileId = before.id || await this.ensureProfileRow(clientClinicId, userId);
    const input = (data.folderId || data.folderUrl || "").trim();
    const displayName = data.displayName?.trim() || null;
    const driveItem = input ? extractGoogleDriveItem(input) : null;
    const accessCheck = driveItem
      ? await this.checkGoogleDriveItemAccess(sourceClinicId, driveItem.id, driveItem.kindHint)
      : null;
    if (requireFolder && accessCheck && accessCheck.itemType !== "folder") {
      throw ApiError.badRequest("The main client Drive link must point to a folder.");
    }
    const folderId = driveItem?.id || null;
    const folderUrl = accessCheck
      ? accessCheck.itemType === "zip"
        ? `https://drive.google.com/file/d/${folderId}/view`
        : `https://drive.google.com/drive/folders/${folderId}`
      : null;
    const driveItemName = accessCheck
      ? displayName ||
        accessCheck.name ||
        (accessCheck.itemType === "zip" ? "Google Drive ZIP archive" : "Google Drive folder")
      : null;

    let previousFolderId = before.googleDriveFolderId;
    let previousFolderUrl = before.googleDriveFolderUrl;
    let previousAccessStatus = before.googleDriveFolderAccessStatus;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [profileRows]: any = await connection.execute(
        `SELECT google_drive_folder_id as folderId,
                google_drive_folder_url as folderUrl,
                google_drive_folder_access_status as accessStatus
         FROM client_account_profile
         WHERE id = ?
           AND clinic_id = ?
         LIMIT 1
         FOR UPDATE`,
        [profileId, clientClinicId],
      );
      if (!profileRows[0]) throw ApiError.notFound("Client account profile not found");
      previousFolderId = profileRows[0].folderId || null;
      previousFolderUrl = profileRows[0].folderUrl || null;
      previousAccessStatus = profileRows[0].accessStatus || "not_checked";

      const [documentCountRows]: any = await connection.execute(
        `SELECT COUNT(*) as count
         FROM client_account_document_link
         WHERE client_account_profile_id = ?`,
        [profileId],
      );
      const hasLinkedDocuments = Number(documentCountRows[0]?.count || 0) > 0;
      if (hasLinkedDocuments && !folderId) {
        throw ApiError.conflict("Remove the client document links before clearing the main Drive folder.");
      }
      if (hasLinkedDocuments && folderId !== previousFolderId) {
        throw ApiError.conflict("Remove the client document links before changing the main Drive folder.");
      }

      await connection.execute(
        `UPDATE client_account_profile
         SET google_drive_folder_id = ?,
             google_drive_folder_url = ?,
             google_drive_folder_name = ?,
             google_drive_folder_access_status = ?,
             google_drive_folder_error = ?,
             google_drive_folder_checked_at = ?,
             updated_by = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND clinic_id = ?`,
        [
          folderId,
          folderUrl,
          driveItemName,
          accessCheck?.status || "not_checked",
          accessCheck?.error || null,
          accessCheck?.checkedAt || null,
          userId,
          profileId,
          clientClinicId,
        ],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    if (!folderId) {
      await logAuditEvent({
        clinicId: clientClinicId,
        userId,
        action: "CLIENT_ACCOUNT_DRIVE_FOLDER_REMOVED",
        entityType: "client_account_profile",
        entityId: profileId,
        changes: {
          googleDriveFolderId: { before: previousFolderId, after: null },
          googleDriveFolderUrl: { before: previousFolderUrl, after: null },
        },
        ipAddress: auditContext.ipAddress || null,
        userAgent: auditContext.userAgent || null,
      });

      return this.getProfile(clientClinicId, sourceClinicId);
    }

    await logAuditEvent({
      clinicId: clientClinicId,
      userId,
      action: "CLIENT_ACCOUNT_DRIVE_FOLDER_UPDATED",
      entityType: "client_account_profile",
      entityId: profileId,
      changes: {
        googleDriveFolderId: { before: previousFolderId, after: folderId },
        googleDriveFolderUrl: { before: previousFolderUrl, after: folderUrl },
        googleDriveFolderAccessStatus: { before: previousAccessStatus, after: accessCheck?.status },
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getProfile(clientClinicId, sourceClinicId);
  }

  async listDocumentLinks(
    sourceClinicId: string,
    clientClinicId: string,
    access: { canManageAllClientAccounts: boolean },
  ): Promise<ClientAccountDocumentLinkResponse[]> {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);
    const account = await this.getProfile(clientClinicId, sourceClinicId);

    const rows = account.id
      ? await this.getClientDocumentRows(sourceClinicId, account.id)
      : [];
    const byType = new Map(rows.map((row: any) => [String(row.documentType), row]));

    return clientDocumentTypes.map((definition) => {
      if (definition.type === "main_client_folder") {
        return {
          documentType: definition.type,
          label: definition.label,
          driveItemId: account.googleDriveFolderId,
          driveUrl: account.googleDriveFolderUrl,
          displayName: account.googleDriveFolderName,
          status: this.documentStatus(account.googleDriveFolderUrl, account.googleDriveFolderAccessStatus),
          accessStatus: account.googleDriveFolderAccessStatus,
          accessError: account.googleDriveFolderError,
          checkedAt: account.googleDriveFolderCheckedAt,
          notes: null,
          updatedAt: account.updatedAt,
        };
      }

      const row = byType.get(definition.type) as any | undefined;
      return {
        documentType: definition.type,
        label: definition.label,
        driveItemId: row?.driveItemId || null,
        driveUrl: row?.driveUrl || null,
        displayName: row?.displayName || null,
        status: this.documentStatus(row?.driveUrl, row?.accessStatus),
        accessStatus: row?.accessStatus || "not_checked",
        accessError: row?.accessError || null,
        checkedAt: toIsoString(row?.checkedAt),
        notes: row?.notes || null,
        updatedAt: toIsoString(row?.updatedAt),
      };
    });
  }

  async updateDocumentLink(
    sourceClinicId: string,
    clientClinicId: string,
    userId: string,
    documentType: ClientDocumentType,
    data: UpdateClientAccountDocumentLinkDTO,
    access: { canManageAllClientAccounts: boolean; canConfigureDrive: boolean },
    auditContext: ClientAccountAuditContext,
  ): Promise<ClientAccountDocumentLinkResponse[]> {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);

    if (documentType === "main_client_folder") {
      if (!access.canConfigureDrive) {
        throw ApiError.forbidden("Only an Admin can change the main client Drive folder.");
      }
      await this.updateDriveFolder(
        sourceClinicId,
        clientClinicId,
        userId,
        {
          folderId: data.driveItemId || null,
          folderUrl: data.driveUrl || null,
          displayName: data.displayName || null,
        },
        access,
        auditContext,
        true,
      );
      return this.listDocumentLinks(sourceClinicId, clientClinicId, access);
    }

    const account = await this.getProfile(clientClinicId, sourceClinicId);
    const profileId = account.id || await this.ensureProfileRow(clientClinicId, userId);
    const input = (data.driveItemId || data.driveUrl || "").trim();

    if (!input) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.execute(
          `SELECT id
           FROM client_account_profile
           WHERE id = ?
             AND clinic_id = ?
           LIMIT 1
           FOR UPDATE`,
          [profileId, clientClinicId],
        );
        await connection.execute(
          `DELETE FROM client_account_document_link
           WHERE clinic_id = ?
             AND client_account_profile_id = ?
             AND document_type = ?`,
          [sourceClinicId, profileId, documentType],
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

      await logAuditEvent({
        clinicId: sourceClinicId,
        userId,
        action: "CLIENT_ACCOUNT_DOCUMENT_LINK_REMOVED",
        entityType: "client_account_document_link",
        entityId: profileId,
        changes: { clientAccountProfileId: profileId, documentType },
        ipAddress: auditContext.ipAddress || null,
        userAgent: auditContext.userAgent || null,
      });

      return this.listDocumentLinks(sourceClinicId, clientClinicId, access);
    }

    const driveItem = extractGoogleDriveItem(input);
    if (!account.googleDriveFolderId) {
      throw ApiError.badRequest("An Admin must select a main Google Drive folder for this client first.");
    }
    if (account.googleDriveFolderUrl?.includes("/file/d/")) {
      throw ApiError.badRequest("The main client Drive link must be a folder before document links can be added.");
    }
    if (!await this.isGoogleDriveItemWithinFolder(
      sourceClinicId,
      driveItem.id,
      account.googleDriveFolderId,
    )) {
      throw ApiError.forbidden("This Google Drive item is outside the selected client folder.");
    }
    const accessCheck = await this.checkGoogleDriveItemAccess(
      sourceClinicId,
      driveItem.id,
      driveItem.kindHint,
      true,
    );
    const driveUrl =
      accessCheck.webViewLink ||
      (accessCheck.itemType === "folder"
        ? `https://drive.google.com/drive/folders/${driveItem.id}`
        : `https://drive.google.com/file/d/${driveItem.id}/view`);
    const displayName =
      data.displayName?.trim() ||
      accessCheck.name ||
      clientDocumentTypes.find((item) => item.type === documentType)?.label ||
      "Google Drive item";

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [lockedProfileRows]: any = await connection.execute(
        `SELECT google_drive_folder_id as folderId,
                google_drive_folder_url as folderUrl
         FROM client_account_profile
         WHERE id = ?
           AND clinic_id = ?
         LIMIT 1
         FOR UPDATE`,
        [profileId, clientClinicId],
      );
      if (!lockedProfileRows[0]) throw ApiError.notFound("Client account profile not found");
      if (lockedProfileRows[0].folderId !== account.googleDriveFolderId) {
        throw ApiError.conflict("The main client Drive folder changed. Check the document link and try again.");
      }
      if (!lockedProfileRows[0].folderId || String(lockedProfileRows[0].folderUrl || "").includes("/file/d/")) {
        throw ApiError.conflict("The main client Drive folder is no longer available.");
      }

      await connection.execute(
        `INSERT INTO client_account_document_link
          (id, clinic_id, client_account_profile_id, document_type, drive_item_id, drive_url,
           display_name, access_status, access_error, checked_at, notes, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           drive_item_id = VALUES(drive_item_id),
           drive_url = VALUES(drive_url),
           display_name = VALUES(display_name),
           access_status = VALUES(access_status),
           access_error = VALUES(access_error),
           checked_at = VALUES(checked_at),
           notes = VALUES(notes),
           updated_by = VALUES(updated_by),
           updated_at = CURRENT_TIMESTAMP`,
        [
          uuidv4(),
          sourceClinicId,
          profileId,
          documentType,
          driveItem.id,
          driveUrl,
          displayName,
          accessCheck.status,
          accessCheck.error,
          accessCheck.checkedAt,
          data.notes?.trim() || null,
          userId,
          userId,
        ],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await logAuditEvent({
      clinicId: sourceClinicId,
      userId,
      action: "CLIENT_ACCOUNT_DOCUMENT_LINK_UPDATED",
      entityType: "client_account_document_link",
      entityId: profileId,
      changes: { clientAccountProfileId: profileId, documentType, driveItemId: driveItem.id, driveUrl },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.listDocumentLinks(sourceClinicId, clientClinicId, access);
  }

  async listAccessItems(
    sourceClinicId: string,
    clientClinicId: string,
    access: { canManageAllClientAccounts: boolean },
  ): Promise<ClientAccountAccessItemResponse[]> {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);
    const account = await this.getProfile(clientClinicId, sourceClinicId);
    const rows = account.id ? await this.getClientAccessRows(sourceClinicId, account.id) : [];
    const byType = new Map(rows.map((row: any) => [String(row.itemType), row]));

    return clientAccessItemTypes.map((definition) => {
      const row = byType.get(definition.type) as any | undefined;
      const status = row?.status || "requested";
      return {
        itemType: definition.type,
        label: definition.label,
        status,
        isMissing: status === "requested",
        notes: row?.notes || null,
        requestedAt: toIsoString(row?.requestedAt),
        receivedAt: toIsoString(row?.receivedAt),
        updatedAt: toIsoString(row?.updatedAt),
      };
    });
  }

  async updateAccessItem(
    sourceClinicId: string,
    clientClinicId: string,
    userId: string,
    itemType: ClientAccessItemType,
    data: UpdateClientAccountAccessItemDTO,
    access: { canManageAllClientAccounts: boolean },
    auditContext: ClientAccountAuditContext,
  ): Promise<ClientAccountAccessItemResponse[]> {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);
    const account = await this.getProfile(clientClinicId, sourceClinicId);
    const profileId = account.id || await this.ensureProfileRow(clientClinicId, userId);
    const status = data.status;
    const nowExpression = "CURRENT_TIMESTAMP";

    await pool.execute(
      `INSERT INTO client_account_access_item
        (id, clinic_id, client_account_profile_id, item_type, status, notes, requested_at, received_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ${status === "requested" ? nowExpression : "NULL"}, ${status === "received" ? nowExpression : "NULL"}, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         notes = VALUES(notes),
         requested_at = CASE WHEN VALUES(status) = 'requested' THEN COALESCE(requested_at, CURRENT_TIMESTAMP) ELSE requested_at END,
         received_at = CASE
           WHEN VALUES(status) = 'received' THEN COALESCE(received_at, CURRENT_TIMESTAMP)
           ELSE NULL
         END,
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      [
        uuidv4(),
        sourceClinicId,
        profileId,
        itemType,
        status,
        data.notes?.trim() || null,
        userId,
      ],
    );

    await logAuditEvent({
      clinicId: sourceClinicId,
      userId,
      action: "CLIENT_ACCOUNT_ACCESS_ITEM_UPDATED",
      entityType: "client_account_access_item",
      entityId: profileId,
      changes: { clientAccountProfileId: profileId, itemType, status, notes: data.notes?.trim() || null },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.listAccessItems(sourceClinicId, clientClinicId, access);
  }

  async listIssues(
    sourceClinicId: string,
    clientClinicId: string,
    access: { canManageAllClientAccounts: boolean },
  ): Promise<ClientIssueResponse[]> {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);
    const account = await this.getProfile(clientClinicId, sourceClinicId);
    if (!account.id) return [];
    const [rows]: any = await pool.execute(
      `SELECT ${this.issueSelectColumns()}
       FROM client_account_issue issue
       LEFT JOIN user owner
         ON owner.id = issue.owner_user_id
        AND owner.deleted_at IS NULL
       LEFT JOIN task linked_task
         ON linked_task.id = issue.task_id
        AND linked_task.deleted_at IS NULL
       WHERE issue.clinic_id = ?
         AND issue.client_account_profile_id = ?
       ORDER BY
         CASE issue.status
           WHEN 'open' THEN 0
           WHEN 'in_progress' THEN 1
           WHEN 'waiting' THEN 2
           WHEN 'resolved' THEN 3
           ELSE 4
         END,
         CASE issue.priority
           WHEN 'critical' THEN 0
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           ELSE 3
         END,
         issue.due_date IS NULL ASC,
         issue.due_date ASC,
         issue.updated_at DESC,
         issue.created_at DESC,
         issue.id ASC`,
      [sourceClinicId, account.id],
    );
    return rows.map((row: any) => this.mapIssueRow(row));
  }

  async createIssue(
    sourceClinicId: string,
    clientClinicId: string,
    userId: string,
    data: CreateClientIssueDTO,
    access: { canManageAllClientAccounts: boolean; actorRole: string | null },
    auditContext: ClientAccountAuditContext,
  ): Promise<ClientIssueResponse[]> {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);
    const account = await this.getProfile(clientClinicId, sourceClinicId);
    const profileId = account.id || await this.ensureProfileRow(clientClinicId, userId);
    const ownerUserId = data.ownerUserId || null;
    const taskId = data.taskId || null;

    if (ownerUserId) {
      this.ensureIssueOwnerAssignmentAllowed({ role: access.actorRole });
      await this.ensureAccountManagerBelongsToClinic(sourceClinicId, ownerUserId);
    }
    if (taskId) await this.ensureIssueTaskBelongsToProfile(sourceClinicId, profileId, taskId);

    const issueId = uuidv4();
    const initialStatus = data.status || "open";
    const slaDueAt = toDateTimeString(data.slaDueAt);
    const escalatedAt = toDateTimeString(data.escalatedAt) || (
      shouldAutoEscalateIssue(initialStatus, slaDueAt) ? toDateTimeString(new Date()) : null
    );
    await pool.execute(
      `INSERT INTO client_account_issue
        (id, clinic_id, client_account_profile_id, task_id, title, priority, status,
         source_channel, owner_user_id, due_date, sla_due_at, escalated_at, resolved_at,
         notes, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        issueId,
        sourceClinicId,
        profileId,
        taskId,
        data.title.trim(),
        data.priority || "medium",
        initialStatus,
        data.sourceChannel || "manual",
        ownerUserId,
        toDateString(data.dueDate),
        slaDueAt,
        escalatedAt,
        isClosedIssueStatus(initialStatus) ? toDateTimeString(new Date()) : null,
        data.notes?.trim() || null,
        userId,
        userId,
      ],
    );

    await logAuditEvent({
      clinicId: sourceClinicId,
      userId,
      action: "CLIENT_ACCOUNT_ISSUE_CREATED",
      entityType: "client_account_issue",
      entityId: issueId,
      changes: { ...data, clientAccountProfileId: profileId, clientClinicId },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.listIssues(sourceClinicId, clientClinicId, access);
  }

  async updateIssue(
    sourceClinicId: string,
    clientClinicId: string,
    issueId: string,
    userId: string,
    data: UpdateClientIssueDTO,
    access: { canManageAllClientAccounts: boolean; actorRole: string | null },
    auditContext: ClientAccountAuditContext,
  ): Promise<ClientIssueResponse[]> {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);
    const account = await this.getProfile(clientClinicId, sourceClinicId);
    if (!account.id) throw ApiError.notFound("Client account profile not found");

    const [existingRows]: any = await pool.execute(
      `SELECT id,
              status,
              sla_due_at as slaDueAt,
              escalated_at as escalatedAt
       FROM client_account_issue
       WHERE id = ?
         AND clinic_id = ?
         AND client_account_profile_id = ?
       LIMIT 1`,
      [issueId, sourceClinicId, account.id],
    );
    if (existingRows.length === 0) throw ApiError.notFound("Client issue not found");
    const existingIssue = existingRows[0];

    const fields: string[] = [];
    const values: any[] = [];
    const changes: Record<string, unknown> = {};
    const add = (column: string, value: unknown, key: string) => {
      fields.push(`${column} = ?`);
      values.push(value);
      changes[key] = value;
    };

    if (ownKey(data, "title")) add("title", data.title?.trim(), "title");
    if (ownKey(data, "priority")) add("priority", data.priority, "priority");
    if (ownKey(data, "status")) {
      add("status", data.status, "status");
      if (isClosedIssueStatus(data.status)) {
        fields.push("resolved_at = COALESCE(resolved_at, CURRENT_TIMESTAMP)");
        changes.resolvedAt = "set_on_resolution";
      } else {
        fields.push("resolved_at = NULL");
        changes.resolvedAt = null;
      }
    }
    if (ownKey(data, "sourceChannel")) add("source_channel", data.sourceChannel || "manual", "sourceChannel");
    if (ownKey(data, "ownerUserId")) {
      this.ensureIssueOwnerAssignmentAllowed({ role: access.actorRole });
      if (data.ownerUserId) await this.ensureAccountManagerBelongsToClinic(sourceClinicId, data.ownerUserId);
      add("owner_user_id", data.ownerUserId || null, "ownerUserId");
    }
    if (ownKey(data, "dueDate")) add("due_date", toDateString(data.dueDate), "dueDate");
    if (ownKey(data, "slaDueAt")) add("sla_due_at", toDateTimeString(data.slaDueAt), "slaDueAt");
    if (ownKey(data, "escalatedAt")) add("escalated_at", toDateTimeString(data.escalatedAt), "escalatedAt");
    if (!ownKey(data, "escalatedAt") && (ownKey(data, "status") || ownKey(data, "slaDueAt"))) {
      const nextStatus = ownKey(data, "status") ? data.status : existingIssue.status;
      const nextSlaDueAt = ownKey(data, "slaDueAt") ? toDateTimeString(data.slaDueAt) : existingIssue.slaDueAt;
      if (!existingIssue.escalatedAt && shouldAutoEscalateIssue(nextStatus, nextSlaDueAt)) {
        fields.push("escalated_at = COALESCE(escalated_at, CURRENT_TIMESTAMP)");
        changes.escalatedAt = "set_on_sla_breach";
      }
    }
    if (ownKey(data, "notes")) add("notes", data.notes?.trim() || null, "notes");
    if (ownKey(data, "taskId")) {
      if (data.taskId) await this.ensureIssueTaskBelongsToProfile(sourceClinicId, account.id, data.taskId);
      add("task_id", data.taskId || null, "taskId");
    }

    if (fields.length === 0) return this.listIssues(sourceClinicId, clientClinicId, access);

    fields.push("updated_by = ?");
    values.push(userId, issueId, sourceClinicId, account.id);
    await pool.execute(
      `UPDATE client_account_issue
       SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?
         AND client_account_profile_id = ?`,
      values,
    );

    await logAuditEvent({
      clinicId: sourceClinicId,
      userId,
      action: "CLIENT_ACCOUNT_ISSUE_UPDATED",
      entityType: "client_account_issue",
      entityId: issueId,
      changes,
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.listIssues(sourceClinicId, clientClinicId, access);
  }

  async listDriveFolders(
    sourceClinicId: string,
    clientClinicId: string,
    parentId: string,
    access: { canManageAllClientAccounts: boolean; canConfigureDrive?: boolean },
  ) {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);
    const resolvedParentId = await this.ensureDriveItemAvailable(
      sourceClinicId,
      clientClinicId,
      parentId || "root",
      Boolean(access.canConfigureDrive),
    );
    return googleDriveOAuthService.listFolders(sourceClinicId, resolvedParentId);
  }

  async createDriveFolder(
    sourceClinicId: string,
    clientClinicId: string,
    userId: string,
    data: CreateClientAccountDriveFolderDTO,
    access: { canManageAllClientAccounts: boolean; canConfigureDrive?: boolean },
    auditContext: ClientAccountAuditContext,
  ) {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);
    const parentId = await this.ensureDriveItemAvailable(
      sourceClinicId,
      clientClinicId,
      data.parentId || "root",
      Boolean(access.canConfigureDrive),
    );
    const folder = await googleDriveOAuthService.createFolder(
      sourceClinicId,
      data.name.trim(),
      parentId,
    );

    await logAuditEvent({
      clinicId: clientClinicId,
      userId,
      action: "CLIENT_ACCOUNT_DRIVE_FOLDER_CREATED",
      entityType: "client_account",
      entityId: clientClinicId,
      changes: {
        folderId: folder.id,
        folderName: folder.name,
        parentId: folder.parentId,
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return folder;
  }

  async uploadDriveFile(
    sourceClinicId: string,
    clientClinicId: string,
    userId: string,
    file: { originalname: string; mimetype: string; buffer: Buffer },
    parentId: string,
    access: { canManageAllClientAccounts: boolean; canConfigureDrive?: boolean },
    auditContext: ClientAccountAuditContext,
  ) {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);
    const resolvedParentId = await this.ensureDriveItemAvailable(
      sourceClinicId,
      clientClinicId,
      parentId || "root",
      Boolean(access.canConfigureDrive),
    );
    const uploaded = await googleDriveOAuthService.uploadFile(
      sourceClinicId,
      { name: file.originalname, mimeType: file.mimetype, buffer: file.buffer },
      resolvedParentId,
    );
    await logAuditEvent({
      clinicId: clientClinicId,
      userId,
      action: "CLIENT_ACCOUNT_DRIVE_FILE_UPLOADED",
      entityType: "client_account",
      entityId: clientClinicId,
      changes: { fileId: uploaded.id, fileName: uploaded.name, parentId: uploaded.parentId },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });
    return uploaded;
  }

  async renameDriveFile(
    sourceClinicId: string,
    clientClinicId: string,
    userId: string,
    fileId: string,
    data: RenameClientAccountDriveFileDTO,
    access: { canManageAllClientAccounts: boolean; canConfigureDrive?: boolean },
    auditContext: ClientAccountAuditContext,
  ) {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);
    await this.ensureDriveItemAvailable(sourceClinicId, clientClinicId, fileId, Boolean(access.canConfigureDrive));
    const renamed = await googleDriveOAuthService.renameFile(sourceClinicId, fileId, data.name.trim());
    await logAuditEvent({
      clinicId: clientClinicId,
      userId,
      action: "CLIENT_ACCOUNT_DRIVE_FILE_RENAMED",
      entityType: "client_account",
      entityId: clientClinicId,
      changes: { fileId, fileName: renamed.name },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });
    return renamed;
  }

  async deleteDriveFile(
    sourceClinicId: string,
    clientClinicId: string,
    userId: string,
    fileId: string,
    access: { canManageAllClientAccounts: boolean; canConfigureDrive?: boolean },
    auditContext: ClientAccountAuditContext,
  ) {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);
    await this.ensureDriveItemAvailable(sourceClinicId, clientClinicId, fileId, Boolean(access.canConfigureDrive));
    await googleDriveOAuthService.deleteFile(sourceClinicId, fileId);
    await logAuditEvent({
      clinicId: clientClinicId,
      userId,
      action: "CLIENT_ACCOUNT_DRIVE_FILE_DELETED",
      entityType: "client_account",
      entityId: clientClinicId,
      changes: { fileId },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });
  }

  async downloadDriveFile(
    sourceClinicId: string,
    clientClinicId: string,
    fileId: string,
    access: { canManageAllClientAccounts: boolean; canConfigureDrive?: boolean },
  ) {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);
    await this.ensureDriveItemAvailable(sourceClinicId, clientClinicId, fileId, Boolean(access.canConfigureDrive));
    return googleDriveOAuthService.downloadFile(sourceClinicId, fileId);
  }

  async updateProfile(
    clinicId: string,
    userId: string,
    data: UpdateClientAccountProfileDTO,
    actorContext: ClientAccountActorContext,
    auditContext: ClientAccountAuditContext,
    options: {
      allowExternalAccountManager?: boolean;
      auditClinicId?: string;
    } = {},
  ): Promise<ClientAccountProfileResponse> {
    if (ownKey(data, "accountManagerId")) {
      this.ensureAccountManagerAssignmentAllowed(actorContext);
      if (data.accountManagerId) {
        if (options.allowExternalAccountManager) {
          await this.ensureActiveInternalUser(data.accountManagerId);
        } else {
          await this.ensureAccountManagerBelongsToClinic(clinicId, data.accountManagerId);
        }
      }
    }

    const before = await this.getProfile(clinicId, options.auditClinicId || clinicId);
    const profileId = before.id || uuidv4();
    const fields: string[] = [];
    const values: any[] = [];
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    const growthScore = normalizeGrowthScore(data);

    const addChange = (field: string, column: string, beforeValue: unknown, afterValue: unknown) => {
      if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) return;
      fields.push(`${column} = ?`);
      values.push(
        afterValue && typeof afterValue === "object"
          ? JSON.stringify(afterValue)
          : afterValue,
      );
      changes[field] = { before: beforeValue, after: afterValue };
    };

    if (ownKey(data, "accountManagerId")) {
      addChange("accountManagerId", "account_manager_id", before.accountManager?.id || null, data.accountManagerId || null);
    }

    if (ownKey(data, "activeServices") && data.activeServices) {
      addChange("activeServices", "active_services", before.activeServices, normalizeServices(data.activeServices));
    }

    if (ownKey(data, "onboardingStatus")) {
      addChange("onboardingStatus", "onboarding_status", before.onboardingStatus, data.onboardingStatus);
    }

    if (ownKey(data, "healthStatus")) {
      addChange("healthStatus", "health_status", before.healthStatus, data.healthStatus);
    }

    if (ownKey(data, "clientStatus")) {
      addChange("clientStatus", "client_status", before.clientStatus, data.clientStatus);
    }

    if (ownKey(data, "currentPackage")) {
      addChange("currentPackage", "current_package", before.currentPackage, data.currentPackage || null);
    }

    if (ownKey(data, "monthlyPrice")) {
      addChange("monthlyPrice", "monthly_price", before.monthlyPrice, this.normalizeMoney(data.monthlyPrice));
    }

    if (ownKey(data, "setupFee")) {
      addChange("setupFee", "setup_fee", before.setupFee, this.normalizeMoney(data.setupFee));
    }

    if (ownKey(data, "currency")) {
      addChange("currency", "currency", before.currency, data.currency?.trim().toUpperCase() || DEFAULT_PROFILE.currency);
    }

    if (ownKey(data, "recommendedNextPackage")) {
      addChange("recommendedNextPackage", "recommended_next_package", before.recommendedNextPackage, data.recommendedNextPackage || null);
    }

    if (ownKey(data, "upsellOpportunity")) {
      addChange("upsellOpportunity", "upsell_opportunity", before.upsellOpportunity, data.upsellOpportunity || null);
    }

    if (ownKey(data, "growthScore") || ownKey(data, "growthScoreOverall")) {
      addChange("growthScoreOverall", "growth_score_overall", before.growthScoreOverall, growthScore.overall);
    }

    if (ownKey(data, "growthScore") || ownKey(data, "growthScoreCategories")) {
      addChange("growthScoreCategories", "growth_score_categories", before.growthScoreCategories, growthScore.categories);
      addChange("growthScoreWebsiteVisibility", "growth_score_website_visibility", before.growthScoreCategories.websiteVisibility, growthScore.categories.websiteVisibility);
      addChange("growthScoreSeo", "growth_score_seo", before.growthScoreCategories.seo, growthScore.categories.seo);
      addChange("growthScoreGbp", "growth_score_gbp", before.growthScoreCategories.gbp, growthScore.categories.gbp);
      addChange("growthScoreTracking", "growth_score_tracking", before.growthScoreCategories.tracking, growthScore.categories.tracking);
      addChange("growthScoreConversion", "growth_score_conversion", before.growthScoreCategories.conversion, growthScore.categories.conversion);
      addChange("growthScoreLeadHandling", "growth_score_lead_handling", before.growthScoreCategories.leadHandling, growthScore.categories.leadHandling);
      addChange("growthScoreResponseSpeed", "growth_score_response_speed", before.growthScoreCategories.responseSpeed, growthScore.categories.responseSpeed);
      addChange("growthScoreEnquiryVisibility", "growth_score_enquiry_visibility", before.growthScoreCategories.enquiryVisibility, growthScore.categories.enquiryVisibility);
      addChange("growthScoreTreatmentPerformance", "growth_score_treatment_performance", before.growthScoreCategories.treatmentPerformance, growthScore.categories.treatmentPerformance);
      addChange("growthScoreRevenueLeakage", "growth_score_revenue_leakage", before.growthScoreCategories.revenueLeakage, growthScore.categories.revenueLeakage);
      addChange("growthScoreGrowthOpportunity", "growth_score_growth_opportunity", before.growthScoreCategories.growthOpportunity, growthScore.categories.growthOpportunity);
    }

    if (ownKey(data, "growthScore") || ownKey(data, "growthScoreRecommendedPackage")) {
      addChange("growthScoreRecommendedPackage", "growth_score_recommended_package", before.growthScoreRecommendedPackage, growthScore.recommendedPackage);
    }

    if (ownKey(data, "growthScore") || ownKey(data, "growthScoreGapSummary")) {
      addChange("growthScoreGapSummary", "growth_score_gap_summary", before.growthScoreGapSummary, growthScore.gapSummary);
    }

    if (ownKey(data, "growthScore") || ownKey(data, "growthScoreUpdatedAt")) {
      addChange("growthScoreUpdatedAt", "growth_score_updated_at", before.growthScoreUpdatedAt, growthScore.updatedAt);
    }

    if (ownKey(data, "churnRisk")) {
      addChange("churnRisk", "churn_risk", before.churnRisk, data.churnRisk);
    }

    if (ownKey(data, "lastContactAt")) {
      addChange("lastContactAt", "last_contact_at", before.lastContactAt, toDateTimeString(data.lastContactAt));
    }

    if (ownKey(data, "lastReportAt")) {
      addChange("lastReportAt", "last_report_at", before.lastReportAt, toDateTimeString(data.lastReportAt));
    }

    if (ownKey(data, "lastLoomAt")) {
      addChange("lastLoomAt", "last_loom_at", before.lastLoomAt, toDateTimeString(data.lastLoomAt));
    }

    if (ownKey(data, "renewalDate")) {
      addChange("renewalDate", "renewal_date", before.renewalDate, toDateString(data.renewalDate));
    }

    if (ownKey(data, "contractStatus")) {
      addChange("contractStatus", "contract_status", before.contractStatus, data.contractStatus);
    }

    if (ownKey(data, "contractStartDate")) {
      addChange("contractStartDate", "contract_start_date", before.contractStartDate, toDateString(data.contractStartDate));
    }

    if (ownKey(data, "noticeDate")) {
      addChange("noticeDate", "notice_date", before.noticeDate, toDateString(data.noticeDate));
    }

    if (ownKey(data, "paymentStatus")) {
      addChange("paymentStatus", "payment_status", before.paymentStatus, data.paymentStatus);
    }

    if (ownKey(data, "invoiceStatus")) {
      addChange("invoiceStatus", "invoice_status", before.invoiceStatus, data.invoiceStatus);
    }

    if (ownKey(data, "paymentNotes")) {
      addChange("paymentNotes", "payment_notes", before.paymentNotes, data.paymentNotes?.trim() || null);
    }

    if (ownKey(data, "keyNotes")) {
      addChange("keyNotes", "key_notes", before.keyNotes, data.keyNotes || null);
    }

    if (fields.length === 0) {
      return before;
    }

    fields.push("updated_by = ?");
    values.push(userId);

    if (before.id) {
      values.push(before.id, clinicId);
      await pool.execute(
        `UPDATE client_account_profile
         SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND clinic_id = ?`,
        values,
      );
    } else {
      await pool.execute(
        `INSERT INTO client_account_profile
          (id, clinic_id, created_by, ${fields.map((field) => field.split(" = ")[0]).join(", ")})
         VALUES (?, ?, ?, ${fields.map(() => "?").join(", ")})`,
        [profileId, clinicId, userId, ...values],
      );
    }

    await logAuditEvent({
      clinicId: options.auditClinicId || clinicId,
      userId,
      action: "CLIENT_ACCOUNT_PROFILE_UPDATED",
      entityType: "client_account_profile",
      entityId: profileId,
      changes,
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getProfile(clinicId, options.auditClinicId || clinicId);
  }

  async getManagedProfile(
    sourceClinicId: string,
    clientClinicId: string,
    access: { canManageAllClientAccounts: boolean },
  ): Promise<ClientAccountProfileResponse> {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);
    return this.getProfile(clientClinicId, sourceClinicId);
  }

  async updateManagedProfile(
    sourceClinicId: string,
    clientClinicId: string,
    userId: string,
    data: UpdateClientAccountProfileDTO,
    access: { canManageAllClientAccounts: boolean; actorRole: string | null },
    auditContext: ClientAccountAuditContext,
  ): Promise<ClientAccountProfileResponse> {
    await this.ensureClientAccountAvailableToWorkspace(sourceClinicId, clientClinicId, access);
    return this.updateProfile(clientClinicId, userId, data, { role: access.actorRole }, auditContext, {
      allowExternalAccountManager: sourceClinicId !== clientClinicId,
      auditClinicId: sourceClinicId,
    });
  }

  async listServices(
    clinicId: string,
    query: ClientAccountServiceListQuery,
    access: { canManageAllClientAccounts: boolean } = { canManageAllClientAccounts: false },
  ): Promise<ClientAccountServiceResponse[]> {
    const conditions = ["1 = 1"];
    const values: any[] = [];

    if (String(query.includeAllClinics) !== "true" || !access.canManageAllClientAccounts) {
      conditions.push("cas.clinic_id = ?");
      values.push(clinicId);
    }

    if (String(query.includeArchived) !== "true") {
      conditions.push("cas.archived_at IS NULL", "cas.status <> 'archived'");
    }

    if (query.status) {
      conditions.push("cas.status = ?");
      values.push(query.status);
    }

    if (query.contractStatus) {
      conditions.push("cas.contract_status = ?");
      values.push(query.contractStatus);
    }

    if (query.renewalFrom) {
      conditions.push("cas.renewal_date >= ?");
      values.push(toDateString(query.renewalFrom));
    }

    if (query.renewalTo) {
      conditions.push("cas.renewal_date <= ?");
      values.push(toDateString(query.renewalTo));
    }

    const [rows]: any = await pool.execute(
      `SELECT ${this.serviceSelectColumns()}
       FROM client_account_service cas
       JOIN client_account_profile cap ON cap.id = cas.client_account_profile_id AND cap.clinic_id = cas.clinic_id
       LEFT JOIN user owner ON owner.id = cas.owner_id AND owner.deleted_at IS NULL
       WHERE ${conditions.join(" AND ")}
       ORDER BY cas.archived_at IS NULL DESC, cas.renewal_date IS NULL ASC, cas.renewal_date ASC, cas.name ASC`,
      values,
    );

    return rows.map((row: any) => this.mapServiceRow(row));
  }

  async createService(
    clinicId: string,
    userId: string,
    data: CreateClientAccountServiceDTO,
    auditContext: ClientAccountAuditContext,
  ): Promise<ClientAccountServiceResponse> {
    if (data.ownerId) {
      await this.ensureAccountManagerBelongsToClinic(clinicId, data.ownerId);
    }

    const profileId = await this.ensureProfileRow(clinicId, userId);
    const serviceId = uuidv4();
    const payload = {
      serviceType: data.serviceType,
      name: data.name.trim(),
      status: data.status || "onboarding",
      startDate: toDateString(data.startDate),
      renewalDate: toDateString(data.renewalDate),
      endDate: toDateString(data.endDate),
      ownerId: data.ownerId || null,
      recurringValue: this.normalizeMoney(data.recurringValue),
      currency: (data.currency || "USD").trim().toUpperCase(),
      contractStatus: data.contractStatus || "pending",
      notes: data.notes || null,
    };

    await pool.execute(
      `INSERT INTO client_account_service
        (id, clinic_id, client_account_profile_id, service_type, name, status, start_date, renewal_date, end_date,
         owner_id, recurring_value, currency, contract_status, notes, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        serviceId,
        clinicId,
        profileId,
        payload.serviceType,
        payload.name,
        payload.status,
        payload.startDate,
        payload.renewalDate,
        payload.endDate,
        payload.ownerId,
        payload.recurringValue,
        payload.currency,
        payload.contractStatus,
        payload.notes,
        userId,
        userId,
      ],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "CLIENT_ACCOUNT_SERVICE_CREATED",
      entityType: "client_account_service",
      entityId: serviceId,
      changes: payload,
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getService(clinicId, serviceId);
  }

  async updateService(
    clinicId: string,
    userId: string,
    serviceId: string,
    data: UpdateClientAccountServiceDTO,
    auditContext: ClientAccountAuditContext,
  ): Promise<ClientAccountServiceResponse> {
    if (ownKey(data, "ownerId") && data.ownerId) {
      await this.ensureAccountManagerBelongsToClinic(clinicId, data.ownerId);
    }

    const before = await this.getService(clinicId, serviceId);
    if (before.archivedAt || before.status === "archived") {
      throw ApiError.badRequest("Archived services cannot be updated");
    }

    const fields: string[] = [];
    const values: any[] = [];
    const changes: Record<string, { before: unknown; after: unknown }> = {};

    const addChange = (field: string, column: string, beforeValue: unknown, afterValue: unknown) => {
      if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) return;
      fields.push(`${column} = ?`);
      values.push(afterValue);
      changes[field] = { before: beforeValue, after: afterValue };
    };

    if (ownKey(data, "serviceType")) {
      addChange("serviceType", "service_type", before.serviceType, data.serviceType);
    }

    if (ownKey(data, "name") && data.name) {
      addChange("name", "name", before.name, data.name.trim());
    }

    if (ownKey(data, "status")) {
      addChange("status", "status", before.status, data.status);
    }

    if (ownKey(data, "startDate")) {
      addChange("startDate", "start_date", before.startDate, toDateString(data.startDate));
    }

    if (ownKey(data, "renewalDate")) {
      addChange("renewalDate", "renewal_date", before.renewalDate, toDateString(data.renewalDate));
    }

    if (ownKey(data, "endDate")) {
      addChange("endDate", "end_date", before.endDate, toDateString(data.endDate));
    }

    if (ownKey(data, "ownerId")) {
      addChange("ownerId", "owner_id", before.owner?.id || null, data.ownerId || null);
    }

    if (ownKey(data, "recurringValue")) {
      addChange("recurringValue", "recurring_value", before.recurringValue, this.normalizeMoney(data.recurringValue));
    }

    if (ownKey(data, "currency") && data.currency) {
      addChange("currency", "currency", before.currency, data.currency.trim().toUpperCase());
    }

    if (ownKey(data, "contractStatus")) {
      addChange("contractStatus", "contract_status", before.contractStatus, data.contractStatus);
    }

    if (ownKey(data, "notes")) {
      addChange("notes", "notes", before.notes, data.notes || null);
    }

    if (fields.length === 0) {
      return before;
    }

    fields.push("updated_by = ?");
    values.push(userId, serviceId, clinicId);

    await pool.execute(
      `UPDATE client_account_service
       SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND archived_at IS NULL`,
      values,
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "CLIENT_ACCOUNT_SERVICE_UPDATED",
      entityType: "client_account_service",
      entityId: serviceId,
      changes,
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getService(clinicId, serviceId);
  }

  async archiveService(
    clinicId: string,
    userId: string,
    serviceId: string,
    auditContext: ClientAccountAuditContext,
  ): Promise<void> {
    const before = await this.getService(clinicId, serviceId);
    if (before.archivedAt || before.status === "archived") {
      return;
    }

    await pool.execute(
      `UPDATE client_account_service
       SET status = 'archived', archived_at = CURRENT_TIMESTAMP, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND archived_at IS NULL`,
      [userId, serviceId, clinicId],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "CLIENT_ACCOUNT_SERVICE_ARCHIVED",
      entityType: "client_account_service",
      entityId: serviceId,
      changes: {
        status: { before: before.status, after: "archived" },
        archivedAt: { before: before.archivedAt, after: "CURRENT_TIMESTAMP" },
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });
  }

  private async getService(clinicId: string, serviceId: string): Promise<ClientAccountServiceResponse> {
    const [rows]: any = await pool.execute(
      `SELECT ${this.serviceSelectColumns()}
       FROM client_account_service cas
       JOIN client_account_profile cap ON cap.id = cas.client_account_profile_id AND cap.clinic_id = cas.clinic_id
       LEFT JOIN user owner ON owner.id = cas.owner_id AND owner.deleted_at IS NULL
       WHERE cas.id = ? AND cas.clinic_id = ?
       LIMIT 1`,
      [serviceId, clinicId],
    );

    if (rows.length === 0) {
      throw ApiError.notFound("Client service not found");
    }

    return this.mapServiceRow(rows[0]);
  }

  private serviceSelectColumns() {
    return `cas.id,
            cas.clinic_id as clinicId,
            cas.client_account_profile_id as clientAccountProfileId,
            cas.service_type as serviceType,
            cas.name,
            cas.status,
            cas.start_date as startDate,
            cas.renewal_date as renewalDate,
            cas.end_date as endDate,
            cas.owner_id as ownerId,
            cas.recurring_value as recurringValue,
            cas.currency,
            cas.contract_status as contractStatus,
            cas.notes,
            cas.archived_at as archivedAt,
            cas.updated_at as updatedAt,
            owner.first_name as ownerFirstName,
            owner.last_name as ownerLastName,
            owner.email as ownerEmail`;
  }

  private issueSelectColumns() {
    return `issue.id,
            issue.client_account_profile_id as clientAccountProfileId,
            issue.task_id as taskId,
            issue.title,
            issue.priority,
            issue.status,
            issue.source_channel as sourceChannel,
            issue.owner_user_id as ownerUserId,
            issue.due_date as dueDate,
            issue.sla_due_at as slaDueAt,
            issue.escalated_at as escalatedAt,
            issue.resolved_at as resolvedAt,
            issue.notes,
            (
              issue.status NOT IN ('resolved', 'closed')
              AND (
                (issue.sla_due_at IS NOT NULL AND issue.sla_due_at < CURRENT_TIMESTAMP)
                OR (issue.sla_due_at IS NULL AND issue.due_date IS NOT NULL AND issue.due_date < CURDATE())
              )
            ) as isOverdue,
            issue.created_at as createdAt,
            issue.updated_at as updatedAt,
            owner.first_name as ownerFirstName,
            owner.last_name as ownerLastName,
            owner.email as ownerEmail,
            linked_task.title as taskTitle,
            linked_task.status as taskStatus,
            linked_task.due_date as taskDueDate`;
  }

  private mapIssueRow(row: any): ClientIssueResponse {
    return {
      id: row.id,
      clientAccountProfileId: row.clientAccountProfileId,
      taskId: row.taskId || null,
      title: row.title,
      priority: row.priority,
      status: row.status,
      sourceChannel: row.sourceChannel || "manual",
      owner: row.ownerUserId
        ? {
            id: row.ownerUserId,
            firstName: row.ownerFirstName || null,
            lastName: row.ownerLastName || null,
            email: row.ownerEmail || null,
          }
        : null,
      dueDate: toDateString(row.dueDate),
      slaDueAt: toIsoString(row.slaDueAt),
      escalatedAt: toIsoString(row.escalatedAt),
      resolvedAt: toIsoString(row.resolvedAt),
      notes: row.notes || null,
      isOverdue: Boolean(row.isOverdue),
      slaStatus: issueSlaStatus(row),
      isEscalated: Boolean(row.escalatedAt),
      task: row.taskId
        ? {
            id: row.taskId,
            title: row.taskTitle || "Linked task",
            status: row.taskStatus || "pending",
            dueDate: toDateString(row.taskDueDate),
          }
        : null,
      createdAt: toIsoString(row.createdAt) || new Date().toISOString(),
      updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
    };
  }

  private mapServiceRow(row: any): ClientAccountServiceResponse {
    return {
      id: row.id,
      clinicId: row.clinicId,
      clientAccountProfileId: row.clientAccountProfileId,
      serviceType: row.serviceType,
      name: row.name,
      status: row.status,
      startDate: toDateString(row.startDate),
      renewalDate: toDateString(row.renewalDate),
      endDate: toDateString(row.endDate),
      owner: row.ownerId
        ? {
            id: row.ownerId,
            firstName: row.ownerFirstName || null,
            lastName: row.ownerLastName || null,
            email: row.ownerEmail || null,
          }
        : null,
      recurringValue: row.recurringValue === null || row.recurringValue === undefined ? null : Number(row.recurringValue),
      currency: row.currency,
      contractStatus: row.contractStatus,
      notes: row.notes || null,
      archivedAt: toIsoString(row.archivedAt),
      updatedAt: toIsoString(row.updatedAt),
    };
  }

  private async getAccountSummary(
    clinicId: string,
    workspaceClinicId = clinicId,
  ): Promise<ClientAccountSummaryResponse> {
    const profile = await this.getProfile(clinicId, workspaceClinicId);
    return {
      ...profile,
      activeServiceCount: 0,
      renewalRiskCount: 0,
      pendingTaskCount: 0,
      overdueTaskCount: 0,
      qaTaskCount: 0,
      missedTaskCount: 0,
      escalatedTaskCount: 0,
      lastStrategyLogAt: null,
      actionPlanId: null,
      actionPlanMonth: null,
      actionPlanStatus: null,
      actionPlanTotalItems: 0,
      actionPlanCompletedItems: 0,
      actionPlanOpenItems: 0,
      actionPlanHighPriorityOpenItems: 0,
      actionPlanProgressPercent: 0,
      actionPlanLastUpdatedAt: null,
    };
  }

  private mapAccountSummaryRow(row: any): ClientAccountSummaryResponse {
    const profileServices = parseServices(row.activeServices);
    const derivedServices = row.derivedActiveServices
      ? String(row.derivedActiveServices).split(",").filter(Boolean)
      : [];
    const growthScore = mapGrowthScoreSnapshot(row);

    return {
      id: row.id || null,
      clinicId: row.clinicId,
      clinicName: row.clinicName,
      email: row.email || null,
      phone: row.phone || null,
      website: row.website || null,
      address: row.address || null,
      city: row.city || null,
      state: row.state || null,
      postalCode: row.postalCode || null,
      country: row.country || null,
      accountManager: row.accountManagerId
        ? {
            id: row.accountManagerId,
            firstName: row.accountManagerFirstName || null,
            lastName: row.accountManagerLastName || null,
            email: row.accountManagerEmail || null,
          }
        : null,
      activeServices: profileServices.length > 0 ? profileServices : derivedServices,
      onboardingStatus: row.onboardingStatus || DEFAULT_PROFILE.onboardingStatus,
      healthStatus: row.healthStatus || DEFAULT_PROFILE.healthStatus,
      clientStatus: row.clientStatus || DEFAULT_PROFILE.clientStatus,
      currentPackage: row.currentPackage || DEFAULT_PROFILE.currentPackage,
      monthlyPrice: numberOrNull(row.monthlyPrice),
      setupFee: numberOrNull(row.setupFee),
      currency: row.currency || DEFAULT_PROFILE.currency,
      recommendedNextPackage: row.recommendedNextPackage || DEFAULT_PROFILE.recommendedNextPackage,
      upsellOpportunity: row.upsellOpportunity || DEFAULT_PROFILE.upsellOpportunity,
      ...growthScore,
      churnRisk: row.churnRisk || DEFAULT_PROFILE.churnRisk,
      lastContactAt: toIsoString(row.lastContactAt),
      lastReportAt: toIsoString(row.lastReportAt),
      lastLoomAt: toIsoString(row.lastLoomAt),
      renewalDate: toDateString(row.renewalDate),
      contractStatus: row.contractStatus || DEFAULT_PROFILE.contractStatus,
      contractStartDate: toDateString(row.contractStartDate),
      noticeDate: toDateString(row.noticeDate),
      paymentStatus: row.paymentStatus || DEFAULT_PROFILE.paymentStatus,
      invoiceStatus: row.invoiceStatus || DEFAULT_PROFILE.invoiceStatus,
      paymentNotes: row.paymentNotes || null,
      keyNotes: row.keyNotes || null,
      googleDriveFolderId: row.googleDriveFolderId || null,
      googleDriveFolderUrl: row.googleDriveFolderUrl || null,
      googleDriveFolderName: row.googleDriveFolderName || null,
      googleDriveFolderAccessStatus: row.googleDriveFolderAccessStatus || "not_checked",
      googleDriveFolderError: row.googleDriveFolderError || null,
      googleDriveFolderCheckedAt: toIsoString(row.googleDriveFolderCheckedAt),
      upsellPrompts: buildUpsellPrompts({
        currentPackage: row.currentPackage,
        recommendedNextPackage: row.recommendedNextPackage || growthScore.growthScoreRecommendedPackage,
        growthScoreOverall: growthScore.growthScoreOverall,
        growthScoreCategories: growthScore.growthScoreCategories,
        growthScoreGapSummary: growthScore.growthScoreGapSummary,
      }),
      openIssueCount: Number(row.openIssueCount || 0),
      overdueIssueCount: Number(row.overdueIssueCount || 0),
      missingDocumentCount: Number(row.missingDocumentCount || 0),
      missingAccessCount: Number(row.missingAccessCount || 0),
      updatedAt: toIsoString(row.updatedAt || row.clinicUpdatedAt),
      activeServiceCount: Number(row.activeServiceCount || 0),
      renewalRiskCount: Number(row.renewalRiskCount || 0),
      pendingTaskCount: Number(row.pendingTaskCount || 0),
      overdueTaskCount: Number(row.overdueTaskCount || 0),
      qaTaskCount: Number(row.qaTaskCount || 0),
      missedTaskCount: Number(row.missedTaskCount || 0),
      escalatedTaskCount: Number(row.escalatedTaskCount || 0),
      lastStrategyLogAt: toIsoString(row.lastStrategyLogAt),
      actionPlanId: row.actionPlanId || null,
      actionPlanMonth: row.actionPlanMonth || null,
      actionPlanStatus: row.actionPlanStatus || null,
      actionPlanTotalItems: Number(row.actionPlanTotalItems || 0),
      actionPlanCompletedItems: Number(row.actionPlanCompletedItems || 0),
      actionPlanOpenItems: Number(row.actionPlanOpenItems || 0),
      actionPlanHighPriorityOpenItems: Number(row.actionPlanHighPriorityOpenItems || 0),
      actionPlanProgressPercent: this.calculatePercent(row.actionPlanCompletedItems, row.actionPlanTotalItems),
      actionPlanLastUpdatedAt: toIsoString(row.actionPlanLastUpdatedAt),
    };
  }

  private calculatePercent(numerator: unknown, denominator: unknown) {
    const total = Number(denominator || 0);
    if (total <= 0) return 0;
    return Math.round((Number(numerator || 0) / total) * 100);
  }

  private documentStatus(
    driveUrl: string | null | undefined,
    accessStatus: "not_checked" | "accessible" | "inaccessible" | null | undefined,
  ): "missing" | "linked" | "not_checked" | "access_problem" {
    if (!driveUrl) return "missing";
    if (accessStatus === "accessible") return "linked";
    if (accessStatus === "inaccessible") return "access_problem";
    return "not_checked";
  }

  private async getClientDocumentRows(sourceClinicId: string, clientAccountProfileId: string) {
    const [rows]: any = await pool.execute(
      `SELECT document_type as documentType,
              drive_item_id as driveItemId,
              drive_url as driveUrl,
              display_name as displayName,
              access_status as accessStatus,
              access_error as accessError,
              checked_at as checkedAt,
              notes,
              updated_at as updatedAt
       FROM client_account_document_link
       WHERE clinic_id = ?
         AND client_account_profile_id = ?`,
      [sourceClinicId, clientAccountProfileId],
    );
    return rows;
  }

  private async getClientAccessRows(sourceClinicId: string, clientAccountProfileId: string) {
    const [rows]: any = await pool.execute(
      `SELECT item_type as itemType,
              status,
              notes,
              requested_at as requestedAt,
              received_at as receivedAt,
              updated_at as updatedAt
       FROM client_account_access_item
       WHERE clinic_id = ?
         AND client_account_profile_id = ?`,
      [sourceClinicId, clientAccountProfileId],
    );
    return rows;
  }

  private async ensureIssueTaskBelongsToProfile(sourceClinicId: string, profileId: string, taskId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM task
       WHERE id = ?
         AND clinic_id = ?
         AND client_account_profile_id = ?
         AND is_internal = 1
         AND status <> 'completed'
         AND deleted_at IS NULL
         AND archived_at IS NULL
       LIMIT 1`,
      [taskId, sourceClinicId, profileId],
    );
    if (rows.length === 0) {
      throw ApiError.badRequest("Linked task must be an open internal task for this client account");
    }
  }

  private normalizeMoney(value: number | string | null | undefined) {
    if (value === null || value === undefined || value === "") return null;
    return Number(value).toFixed(2);
  }

  private normalizeAccountPayload(data: CreateClientAccountDTO) {
    const growthScore = normalizeGrowthScore(data);
    return {
      name: data.name.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      website: data.website?.trim() || null,
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      state: data.state?.trim() || null,
      postalCode: data.postalCode?.trim() || null,
      country: data.country?.trim() || "UK",
      accountManagerId: data.accountManagerId || null,
      activeServices: normalizeServices(data.activeServices || []),
      onboardingStatus: data.onboardingStatus || DEFAULT_PROFILE.onboardingStatus,
      healthStatus: data.healthStatus || DEFAULT_PROFILE.healthStatus,
      clientStatus: data.clientStatus || "onboarding",
      currentPackage: data.currentPackage?.trim() || null,
      monthlyPrice: this.normalizeMoney(data.monthlyPrice),
      setupFee: this.normalizeMoney(data.setupFee),
      currency: data.currency?.trim().toUpperCase() || DEFAULT_PROFILE.currency,
      recommendedNextPackage: data.recommendedNextPackage?.trim() || null,
      upsellOpportunity: data.upsellOpportunity?.trim() || null,
      growthScoreOverall: growthScore.overall,
      growthScoreCategories: growthScore.categories,
      growthScoreRecommendedPackage: growthScore.recommendedPackage,
      growthScoreGapSummary: growthScore.gapSummary,
      growthScoreUpdatedAt: growthScore.updatedAt,
      churnRisk: data.churnRisk || DEFAULT_PROFILE.churnRisk,
      lastContactAt: toDateTimeString(data.lastContactAt),
      lastReportAt: toDateTimeString(data.lastReportAt),
      lastLoomAt: toDateTimeString(data.lastLoomAt),
      renewalDate: toDateString(data.renewalDate),
      contractStatus: data.contractStatus || DEFAULT_PROFILE.contractStatus,
      contractStartDate: toDateString(data.contractStartDate),
      noticeDate: toDateString(data.noticeDate),
      paymentStatus: data.paymentStatus || DEFAULT_PROFILE.paymentStatus,
      invoiceStatus: data.invoiceStatus || DEFAULT_PROFILE.invoiceStatus,
      paymentNotes: data.paymentNotes?.trim() || null,
      keyNotes: data.keyNotes?.trim() || null,
    };
  }

  private async ensureClientAccountAvailableToWorkspace(
    sourceClinicId: string,
    clientClinicId: string,
    access: { canManageAllClientAccounts: boolean },
  ) {
    const [rows]: any = await pool.execute(
      `SELECT c.id
       FROM clinic c
       JOIN client_account_profile cap ON cap.clinic_id = c.id
       WHERE c.id = ?
         AND c.deleted_at IS NULL
       LIMIT 1`,
      [clientClinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Client account not found");

    if (sourceClinicId === clientClinicId) return;
    if (access.canManageAllClientAccounts) return;

    throw ApiError.forbidden("Client account is not available to this workspace");
  }

  private async ensureDriveItemAvailable(
    sourceClinicId: string,
    clientClinicId: string,
    itemId: string,
    canConfigureDrive: boolean,
  ) {
    if (canConfigureDrive) return itemId;
    const profile = await this.getProfile(clientClinicId, sourceClinicId);
    const rootFolderId = profile.googleDriveFolderId;
    if (!rootFolderId) {
      throw ApiError.badRequest("An Admin must select a Google Drive folder for this client first.");
    }
    const resolvedItemId = itemId === "root" ? rootFolderId : itemId;
    if (!await this.isGoogleDriveItemWithinFolder(sourceClinicId, resolvedItemId, rootFolderId)) {
      throw ApiError.forbidden("This Google Drive item is outside the selected client folder.");
    }
    return resolvedItemId;
  }

  private async checkGoogleDriveItemAccess(
    clinicId: string,
    folderId: string,
    kindHint: GoogleDriveItemKind,
    allowAnyFile = false,
  ): Promise<{
    name: string | null;
    itemType: "folder" | "zip" | "file" | null;
    webViewLink: string | null;
    status: "not_checked" | "accessible" | "inaccessible";
    error: string | null;
    checkedAt: string | null;
  }> {
    if (!config.googleDrive.validationEnabled) {
      throw ApiError.serviceUnavailable("Google Drive validation must be enabled before Drive links can be saved.");
    }

    const accessToken = await this.getGoogleDriveAccessToken(clinicId);
    const checkedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,trashed,webViewLink,shortcutDetails&supportsAllDrives=true`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        },
      );
      const payload: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = payload.error?.message || "Google Drive item is inaccessible to the configured account.";
        throw ApiError.badRequest(message);
      }

      if (payload.mimeType === "application/vnd.google-apps.shortcut") {
        throw ApiError.badRequest("Google Drive shortcuts cannot be linked. Select the target folder or file directly.");
      }
      const isFolder = payload.mimeType === "application/vnd.google-apps.folder";
      const isZip =
        ["application/zip", "application/x-zip", "application/x-zip-compressed"].includes(String(payload.mimeType || "")) ||
        (String(payload.mimeType || "") === "application/octet-stream" && String(payload.name || "").toLowerCase().endsWith(".zip")) ||
        String(payload.name || "").toLowerCase().endsWith(".zip");

      if (!allowAnyFile && !isFolder && !isZip) {
        throw ApiError.badRequest("Google Drive link must point to a folder or ZIP file.");
      }

      if (payload.trashed) {
        throw ApiError.badRequest("Google Drive item is in trash and cannot be linked.");
      }

      return {
        name: payload.name || null,
        itemType: isFolder ? "folder" : isZip ? "zip" : "file",
        webViewLink: payload.webViewLink || null,
        status: "accessible",
        error: null,
        checkedAt,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.serviceUnavailable("Google Drive item access could not be checked. Try again or check the Google credentials.");
    }
  }

  private async isGoogleDriveItemWithinFolder(
    clinicId: string,
    itemId: string,
    rootFolderId: string,
  ) {
    if (itemId === rootFolderId) return true;

    const accessToken = await this.getGoogleDriveAccessToken(clinicId);
    const visited = new Set<string>();
    let pending = [itemId];

    for (let depth = 0; depth < 50 && pending.length > 0; depth += 1) {
      const currentId = pending.shift()!;
      if (currentId === rootFolderId) return true;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(currentId)}?fields=id,parents,trashed&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
      );
      const payload: any = await response.json().catch(() => ({}));
      if (!response.ok || payload.trashed) return false;
      pending = [...pending, ...(Array.isArray(payload.parents) ? payload.parents.map(String) : [])];
    }

    return false;
  }

  private async getGoogleDriveAccessToken(clinicId: string) {
    if (config.googleDrive.databaseOAuthEnabled) {
      return googleDriveOAuthService.getAccessToken(clinicId);
    }
    if (
      this.googleDriveTokenCache &&
      this.googleDriveTokenCache.expiresAt > Date.now() + 60_000
    ) {
      return this.googleDriveTokenCache.token;
    }

    const tokenPayload = config.googleDrive.refreshToken
      ? await this.refreshGoogleDriveOAuthToken()
      : await this.fetchGoogleDriveServiceAccountToken();

    this.googleDriveTokenCache = {
      token: tokenPayload.accessToken,
      expiresAt: Date.now() + Math.max(tokenPayload.expiresInSeconds - 60, 60) * 1000,
    };

    return tokenPayload.accessToken;
  }

  private async refreshGoogleDriveOAuthToken() {
    if (!config.oauth.google.clientId || !config.oauth.google.clientSecret) {
      throw ApiError.serviceUnavailable("Google Drive OAuth refresh requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.oauth.google.clientId,
        client_secret: config.oauth.google.clientSecret,
        refresh_token: config.googleDrive.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw ApiError.serviceUnavailable(payload.error_description || payload.error || "Google Drive OAuth token refresh failed.");
    }

    return {
      accessToken: String(payload.access_token),
      expiresInSeconds: Number(payload.expires_in || 3600),
    };
  }

  private async fetchGoogleDriveServiceAccountToken() {
    if (!config.googleDrive.serviceAccountEmail || !config.googleDrive.serviceAccountPrivateKey) {
      throw ApiError.serviceUnavailable("Google Drive validation requires GOOGLE_DRIVE_REFRESH_TOKEN or service-account credentials.");
    }

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const claimSet: Record<string, unknown> = {
      iss: config.googleDrive.serviceAccountEmail,
      scope: config.googleDrive.scopes.join(" "),
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };
    if (config.googleDrive.serviceAccountSubject) {
      claimSet.sub = config.googleDrive.serviceAccountSubject;
    }

    const jwtUnsigned = [
      Buffer.from(JSON.stringify(header)).toString("base64url"),
      Buffer.from(JSON.stringify(claimSet)).toString("base64url"),
    ].join(".");
    const signature = crypto
      .createSign("RSA-SHA256")
      .update(jwtUnsigned)
      .sign(config.googleDrive.serviceAccountPrivateKey, "base64url");
    const assertion = `${jwtUnsigned}.${signature}`;

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw ApiError.serviceUnavailable(payload.error_description || payload.error || "Google Drive service-account token request failed.");
    }

    return {
      accessToken: String(payload.access_token),
      expiresInSeconds: Number(payload.expires_in || 3600),
    };
  }

  async listClientAccountsForContact(
    sourceClinicId: string,
    contactId: string,
  ): Promise<ClientAccountContactAccountLinkResponse[]> {
    await this.getWorkspaceContact(sourceClinicId, contactId);

    const [rows]: any = await pool.execute(
      `SELECT cac.id as relationId,
              cap.id as clientAccountProfileId,
              cap.clinic_id as clientClinicId,
              c.name as clientName,
              cac.created_at as linkedAt
       FROM client_account_contact cac
       JOIN client_account_profile cap
         ON cap.id = cac.client_account_profile_id
       JOIN clinic c
         ON c.id = cap.clinic_id
        AND c.deleted_at IS NULL
       WHERE cac.clinic_id = ?
         AND cac.contact_id = ?
       ORDER BY cac.created_at DESC`,
      [sourceClinicId, contactId],
    );

    return rows.map((row: any) => ({
      relationId: row.relationId,
      clientAccountProfileId: row.clientAccountProfileId,
      clientClinicId: row.clientClinicId,
      clientName: row.clientName,
      linkedAt: toIsoString(row.linkedAt) || new Date().toISOString(),
    }));
  }

  private async listLinkedContacts(sourceClinicId: string, clientAccountProfileId: string): Promise<ClientAccountLinkedContactResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT cac.id as relationId,
              c.id,
              c.account_name as accountName,
              c.contact_role as role,
              c.first_name as firstName,
              c.last_name as lastName,
              c.email,
              c.phone,
              c.role_title as roleTitle,
              c.website,
              c.status,
              c.lead_status as leadStatus,
              c.source,
              c.updated_at as updatedAt
       FROM client_account_contact cac
       JOIN contact c
         ON c.id = cac.contact_id
        AND c.clinic_id = cac.clinic_id
        AND c.deleted_at IS NULL
       WHERE cac.clinic_id = ?
         AND cac.client_account_profile_id = ?
       ORDER BY cac.created_at DESC, c.updated_at DESC
       LIMIT 100`,
      [sourceClinicId, clientAccountProfileId],
    );

    return rows.map((row: any) => ({
      relationId: row.relationId,
      id: row.id,
      name: contactDisplayName(row),
      accountName: row.accountName || null,
      role: row.role || null,
      roleTitle: row.roleTitle || null,
      email: row.email || null,
      phone: row.phone || null,
      website: row.website || null,
      source: row.source || null,
      status: row.status || "lead",
      leadStatus: row.leadStatus || "new",
      updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
    }));
  }

  private async linkContactRelation(
    sourceClinicId: string,
    clientAccountProfileId: string,
    contactId: string,
    userId: string | null,
    executor: Pick<PoolConnection, "execute"> = pool,
  ) {
    const relationId = uuidv4();
    await executor.execute(
      `INSERT IGNORE INTO client_account_contact
        (id, clinic_id, client_account_profile_id, contact_id, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [relationId, sourceClinicId, clientAccountProfileId, contactId, userId],
    );

    const [rows]: any = await executor.execute(
      `SELECT id
       FROM client_account_contact
       WHERE clinic_id = ?
         AND client_account_profile_id = ?
         AND contact_id = ?
       LIMIT 1`,
      [sourceClinicId, clientAccountProfileId, contactId],
    );

    return rows[0]?.id || relationId;
  }

  private async findLinkedClientAccountForContact(
    sourceClinicId: string,
    contactId: string,
    executor: Pick<PoolConnection, "execute"> = pool,
  ): Promise<{ profileId: string; clinicId: string; clinicName: string | null } | null> {
    const [rows]: any = await executor.execute(
      `SELECT cac.client_account_profile_id as profileId,
              cap.clinic_id as clinicId,
              c.name as clinicName
       FROM client_account_contact cac
       JOIN client_account_profile cap
         ON cap.id = cac.client_account_profile_id
       JOIN clinic c
         ON c.id = cap.clinic_id
        AND c.deleted_at IS NULL
       WHERE cac.clinic_id = ?
         AND cac.contact_id = ?
       ORDER BY cac.created_at DESC
       LIMIT 1`,
      [sourceClinicId, contactId],
    );

    return rows[0]
      ? {
          profileId: String(rows[0].profileId),
          clinicId: String(rows[0].clinicId),
          clinicName: rows[0].clinicName ? String(rows[0].clinicName) : null,
        }
      : null;
  }

  private async listLinkedTasks(sourceClinicId: string, clientAccountProfileId: string): Promise<ClientAccountLinkedTaskResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT t.id,
              t.title,
              t.status,
              t.priority,
              t.category,
              t.contact_id as contactId,
              t.contact_name as contact,
              t.due_label as due,
              DATE_FORMAT(t.due_date, '%Y-%m-%d') as dueDate,
              COALESCE(
                NULLIF(t.assigned_to, ''),
                NULLIF(TRIM(CONCAT_WS(' ', assignee.first_name, assignee.last_name)), ''),
                assignee.email
              ) as assignedTo,
              (t.status <> 'completed' AND t.due_date < CURRENT_DATE) as isOverdue,
              t.client_account_profile_id as clientAccountProfileId,
              t.client_account_service_id as clientAccountServiceId,
              t.template_key as templateKey,
              t.updated_at as updatedAt
       FROM task t
       LEFT JOIN user assignee
         ON assignee.id = t.assigned_user_id
        AND assignee.deleted_at IS NULL
        AND assignee.status = 'active'
        AND assignee.is_active = 1
        AND (
          assignee.clinic_id = t.clinic_id
          OR EXISTS (
            SELECT 1
            FROM clinic_membership assignee_membership
            WHERE assignee_membership.user_id = assignee.id
              AND assignee_membership.clinic_id = t.clinic_id
              AND assignee_membership.status = 'active'
          )
        )
       WHERE t.clinic_id = ?
         AND t.is_internal = 1
         AND t.deleted_at IS NULL
         AND t.archived_at IS NULL
         AND t.client_account_profile_id = ?
       ORDER BY t.status ASC, t.due_date IS NULL ASC, t.due_date ASC, t.updated_at DESC
       LIMIT 200`,
      [sourceClinicId, clientAccountProfileId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      category: row.category || null,
      contactId: row.contactId || null,
      contact: row.contact || null,
      due: row.due || null,
      dueDate: row.dueDate || null,
      assignedTo: row.assignedTo || null,
      isOverdue: Boolean(row.isOverdue),
      clientAccountProfileId: row.clientAccountProfileId || null,
      clientAccountServiceId: row.clientAccountServiceId || null,
      templateKey: row.templateKey || null,
      updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
    }));
  }

  private async listAcceptedProposals(
    sourceClinicId: string,
    clientAccountProfileId: string,
  ): Promise<ClientAccountAcceptedProposalResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT par.id as acceptanceId,
              par.proposal_id as proposalId,
              p.proposal_name as proposalName,
              p.status as proposalStatus,
              par.acceptance_status as acceptanceStatus,
              par.accepted_at as acceptedAt,
              par.accepted_by_name as acceptedByName,
              par.accepted_by_email as acceptedByEmail,
              par.legal_company_name as legalCompanyName,
              par.billing_email as billingEmail,
              DATE_FORMAT(par.preferred_start_date, '%Y-%m-%d') as preferredStartDate,
              par.package_name as packageName,
              par.monthly_fee_cents as monthlyFeeCents,
              par.setup_fee_cents as setupFeeCents,
              par.currency,
              par.payment_terms as paymentTerms,
              par.evidence_sha256 as evidenceSha256,
              par.locked_at as lockedAt
       FROM proposal_acceptance_record par
       JOIN proposal p
         ON p.id = par.proposal_id
        AND p.clinic_id = par.clinic_id
        AND p.deleted_at IS NULL
       WHERE par.clinic_id = ?
         AND par.client_account_profile_id = ?
         AND par.deleted_at IS NULL
       ORDER BY par.accepted_at DESC, par.created_at DESC
       LIMIT 50`,
      [sourceClinicId, clientAccountProfileId],
    );

    return rows.map((row: any) => ({
      acceptanceId: row.acceptanceId,
      proposalId: row.proposalId,
      proposalName: row.proposalName || "Accepted proposal",
      proposalStatus: row.proposalStatus || "accepted",
      acceptanceStatus: row.acceptanceStatus || "accepted",
      acceptedAt: toIsoString(row.acceptedAt) || new Date().toISOString(),
      acceptedByName: row.acceptedByName || null,
      acceptedByEmail: row.acceptedByEmail || null,
      legalCompanyName: row.legalCompanyName || null,
      billingEmail: row.billingEmail || null,
      preferredStartDate: row.preferredStartDate || null,
      packageName: row.packageName || null,
      monthlyFeeCents: row.monthlyFeeCents === null || row.monthlyFeeCents === undefined
        ? null
        : Number(row.monthlyFeeCents),
      setupFeeCents: row.setupFeeCents === null || row.setupFeeCents === undefined
        ? null
        : Number(row.setupFeeCents),
      currency: row.currency || "GBP",
      paymentTerms: row.paymentTerms || null,
      evidenceSha256: row.evidenceSha256 || null,
      lockedAt: toIsoString(row.lockedAt),
    }));
  }

  private async getWorkspaceContact(sourceClinicId: string, contactId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              account_name as accountName
       FROM contact
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [contactId, sourceClinicId],
    );

    if (rows.length === 0) {
      throw ApiError.badRequest("Contact must belong to this workspace");
    }

    return {
      id: rows[0].id,
      accountName: rows[0].accountName || null,
    };
  }

  private async insertConversionEvents(
    connection: PoolConnection,
    context: {
      sourceClinicId: string;
      userId: string;
      data: ConvertWonDealToClientDTO;
      auditContext: ClientAccountAuditContext;
      deal: any;
      createdClinicId: string;
      createdProfileId: string;
      accountPayload: CreateClientAccountDTO;
    },
  ) {
    const {
      sourceClinicId,
      userId,
      data,
      auditContext,
      deal,
      createdClinicId,
      createdProfileId,
      accountPayload,
    } = context;
    const normalizedAccount = this.normalizeAccountPayload(accountPayload);

    await insertAuditEvent(connection, {
      clinicId: createdClinicId,
      userId,
      action: "CLIENT_ACCOUNT_CREATED",
      entityType: "client_account_profile",
      entityId: createdProfileId,
      changes: normalizedAccount,
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    await insertTimelineActivity(connection, {
      clinicId: sourceClinicId,
      contactId: deal.contactId,
      userId,
      type: "Note",
      metadata: buildTimelineMetadata({
        action: "won_deal_converted_to_client",
        source: "pipeline",
        recordId: createdProfileId,
        title: "Won opportunity converted to client account",
        changes: {
          dealId: data.dealId,
          clientAccountProfileId: createdProfileId,
          clientAccountClinicId: createdClinicId,
          clientStatus: normalizedAccount.clientStatus,
          onboardingStatus: normalizedAccount.onboardingStatus,
        },
      }),
    });

    await insertAuditEvent(connection, {
      clinicId: sourceClinicId,
      userId,
      action: "WON_DEAL_CONVERTED_TO_CLIENT_ACCOUNT",
      entityType: "deal",
      entityId: data.dealId,
      changes: {
        contactId: deal.contactId,
        clientAccountProfileId: createdProfileId,
        clientAccountClinicId: createdClinicId,
        clientAccountName: normalizedAccount.name,
        dealStatus: deal.status,
        clientStatus: normalizedAccount.clientStatus,
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });
  }

  private async createConversionOnboardingTasks(
    sourceClinicId: string,
    userId: string,
    account: { id: string; clinicName: string },
    deal: any,
    connection: PoolConnection,
  ) {
    const today = new Date();
    const dueDate = (daysFromNow: number) => {
      const date = new Date(today);
      date.setDate(date.getDate() + daysFromNow);
      return date.toISOString().slice(0, 10);
    };
    const contactName = [deal.firstName, deal.lastName].filter(Boolean).join(" ").trim() || deal.email || account.clinicName;
    const baseDescription = [
      `Client account: ${account.clinicName}`,
      `Won opportunity: ${deal.title || deal.id}`,
      deal.treatment ? `Package/service: ${deal.treatment}` : null,
      deal.dealSource || deal.contactSource ? `Original source: ${deal.dealSource || deal.contactSource}` : null,
    ].filter(Boolean).join("\n");
    const checklist = [
      { key: "owner-assignment", title: `Assign client owner: ${account.clinicName}`, due: 0, serviceType: "strategy" },
      { key: "invoice", title: `Raise first invoice: ${account.clinicName}`, due: 0, serviceType: "strategy" },
      { key: "gocardless", title: `Confirm GoCardless setup: ${account.clinicName}`, due: 1, serviceType: "strategy" },
      { key: "onboarding-form", title: `Send onboarding form: ${account.clinicName}`, due: 1, serviceType: "strategy" },
      { key: "drive-folder", title: `Create or link Drive folder: ${account.clinicName}`, due: 1, serviceType: "strategy" },
      { key: "website-access", title: `Collect website access: ${account.clinicName}`, due: 2, serviceType: "website" },
      { key: "ga4", title: `Collect GA4 access: ${account.clinicName}`, due: 2, serviceType: "other" },
      { key: "gsc", title: `Collect Google Search Console access: ${account.clinicName}`, due: 2, serviceType: "seo" },
      { key: "gtm", title: `Collect Google Tag Manager access: ${account.clinicName}`, due: 2, serviceType: "other" },
      { key: "google-ads", title: `Collect Google Ads access: ${account.clinicName}`, due: 3, serviceType: "ppc" },
      { key: "gbp", title: `Collect Google Business Profile access: ${account.clinicName}`, due: 3, serviceType: "gbp" },
      { key: "meta", title: `Collect Meta Business access: ${account.clinicName}`, due: 3, serviceType: "ppc" },
      { key: "brand-assets", title: `Collect brand assets: ${account.clinicName}`, due: 4, serviceType: "website" },
      { key: "treatment-pricing-info", title: `Collect treatment and pricing info: ${account.clinicName}`, due: 4, serviceType: "strategy" },
      { key: "reporting-setup", title: `Set up reporting: ${account.clinicName}`, due: 5, serviceType: "other" },
      { key: "first-review", title: `Book first client review: ${account.clinicName}`, due: 14, serviceType: "strategy" },
    ];
    const [assigneeRows]: any = await connection.execute(
      `SELECT u.id
       FROM user u
       WHERE u.id IN (?, ?)
         AND u.deleted_at IS NULL
         AND u.status = 'active'
         AND u.is_active = 1
         AND (
           u.clinic_id = ?
           OR EXISTS (
             SELECT 1
             FROM clinic_membership cm
             WHERE cm.user_id = u.id
               AND cm.clinic_id = ?
               AND cm.status = 'active'
           )
         )
       ORDER BY CASE WHEN u.id = ? THEN 0 ELSE 1 END
       LIMIT 1`,
      [deal.ownerId || userId, userId, sourceClinicId, sourceClinicId, deal.ownerId || userId],
    );
    const assignedUserId = assigneeRows[0]?.id;
    if (!assignedUserId) {
      throw ApiError.badRequest("Onboarding tasks require an active workspace assignee.");
    }

    for (const item of checklist) {
      const templateKey = `won_client_onboarding:${deal.id}:${item.key}`;
      const description = [
        baseDescription,
        "",
        `Checklist item: ${item.title}`,
        "Created automatically when the won opportunity was converted into a client account.",
      ].join("\n");
      const [existingRows]: any = await connection.execute(
        `SELECT id
         FROM task
         WHERE clinic_id = ?
           AND is_internal = 1
           AND template_key = ?
           AND deleted_at IS NULL
           AND archived_at IS NULL
         LIMIT 1
         FOR UPDATE`,
        [sourceClinicId, templateKey],
      );
      if (existingRows.length > 0) {
        await connection.execute(
          `UPDATE task current_task
           SET description = CASE WHEN description IS NULL OR description = '' THEN ? ELSE description END,
               category = 'client_onboarding',
               board_key = 'delivery',
               service_type = COALESCE(service_type, ?),
               client_account_profile_id = ?,
               contact_id = ?,
               contact_name = CASE WHEN contact_name IS NULL OR contact_name = '' THEN ? ELSE contact_name END,
               due_date = COALESCE(due_date, ?),
               assigned_user_id = CASE
                 WHEN current_task.assigned_user_id IS NOT NULL
                  AND EXISTS (
                    SELECT 1
                    FROM user current_assignee
                    WHERE current_assignee.id = current_task.assigned_user_id
                      AND current_assignee.deleted_at IS NULL
                      AND current_assignee.status = 'active'
                      AND current_assignee.is_active = 1
                      AND (
                        current_assignee.clinic_id = current_task.clinic_id
                        OR EXISTS (
                          SELECT 1
                          FROM clinic_membership current_membership
                          WHERE current_membership.user_id = current_assignee.id
                            AND current_membership.clinic_id = current_task.clinic_id
                            AND current_membership.status = 'active'
                        )
                      )
                  )
                 THEN current_task.assigned_user_id
                 ELSE ?
               END,
               created_by = COALESCE(created_by, ?),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            description,
            item.serviceType,
            account.id,
            deal.contactId,
            contactName,
            dueDate(item.due),
            assignedUserId,
            userId,
            existingRows[0].id,
          ],
        );
        continue;
      }

      await connection.execute(
        `INSERT INTO task
          (id, clinic_id, is_internal, title, description, priority, status, category,
           board_key, service_type, client_account_profile_id, contact_id, contact_name,
           due_label, due_date, assigned_user_id, template_key, created_by)
         VALUES (?, ?, 1, ?, ?, 'high', 'pending', 'client_onboarding',
           'delivery', ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
        [
          uuidv4(),
          sourceClinicId,
          item.title.slice(0, 255),
          description,
          item.serviceType,
          account.id,
          deal.contactId,
          contactName,
          dueDate(item.due),
          assignedUserId,
          templateKey,
          userId,
        ],
      );
    }
  }

  private async ensureProfileRow(clinicId: string, userId: string) {
    const existing = await this.getProfile(clinicId);
    if (existing.id) return existing.id;

    const id = uuidv4();
    await pool.execute(
      `INSERT INTO client_account_profile (id, clinic_id, active_services, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?)`,
      [id, clinicId, JSON.stringify([]), userId, userId],
    );

    return id;
  }

  private async ensureAccountManagerBelongsToClinic(clinicId: string, userId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM user
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
         AND status = 'active'
         AND is_active = 1
       LIMIT 1`,
      [userId, clinicId],
    );

    if (rows.length === 0) {
      throw ApiError.badRequest("Account manager must be an active user in this clinic");
    }
  }

  private async ensureActiveInternalUser(
    userId: string,
    executor: Pick<PoolConnection, "execute"> = pool,
  ) {
    const [rows]: any = await executor.execute(
      `SELECT id
       FROM user
       WHERE id = ?
         AND deleted_at IS NULL
         AND status = 'active'
         AND is_active = 1
       LIMIT 1`,
      [userId],
    );

    if (rows.length === 0) {
      throw ApiError.badRequest("Account manager must be an active internal user");
    }
  }
}

export const clientAccountsService = new ClientAccountsService();
