import { v4 as uuidv4 } from "uuid";
import type { PoolConnection } from "mysql2/promise";
import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { csvRows } from "../../utils/csv.js";
import { insertAuditEvent, logAuditEvent } from "../../utils/audit.js";
import { buildTimelineMetadata, insertTimelineActivity, logTimelineActivity } from "../../utils/activity.js";
import { generateResetToken, hashToken } from "../../utils/helpers.js";
import { clientAccountsService } from "../client-accounts/client-accounts.service.js";
import { phase1TimelineActions } from "../events/phase1-events.js";
import {
  insertPipelineDealMovement,
  movePipelineDealStage,
} from "../pipeline/pipeline.deals.persistence.js";
import {
  buildProposalPublicUrl,
  isProposalPubliclyVisible,
  mapProposalPublicPackage,
  mapProposalPublicResponse,
  proposalViewTransitionStatuses,
} from "./proposals.public.js";
import { proposalPublicStatuses } from "./proposals.types.js";
import type {
  ProposalCommercialItem,
  ProposalLinkAccess,
  ProposalListQuery,
  ProposalPublicPreviewResponse,
  ProposalMutationDTO,
  ProposalResponse,
  ProposalSectionContent,
  ProposalSendDTO,
  ProposalShareResponse,
  ProposalSourceDataQuery,
  ProposalSourceDataResponse,
  ProposalStatus,
  ProposalStatusUpdateDTO,
} from "./proposals.types.js";

type QueryExecutor = Pick<PoolConnection, "execute">;

function cleanString(value: unknown) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
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

function contactFullName(row: any) {
  return [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.email || row.phone || null;
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
    templateKey: row.templateKey || "clinicgrower_standard",
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
                 p.template_key as templateKey,
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
    return mapProposal(rows[0]);
  }

  async createProposalShare(clinicId: string, userId: string, proposalId: string): Promise<ProposalShareResponse> {
    const proposal = await this.getProposal(clinicId, proposalId);
    if (proposal.status === "archived") throw ApiError.notFound("Proposal not found");
    if (!isProposalPubliclyVisible(proposal.status, proposal.expiresAt)) {
      throw ApiError.badRequest("Only active client-facing proposals can be shared");
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

    const sendMethod = cleanString(data.sendMethod) || "manual_email";
    const sendNote =
      cleanString(data.sendNote) ||
      "Manual send fallback: proposal link was copied/sent outside Mission Control and logged here.";
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");

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

    const internalProposal = mapProposal(refreshedRows[0]);
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

    return { proposal, packageRecord };
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
    const contactName = contactFullName(contact) || "Decision maker";
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
      templateKey: overall !== null || auditStatus ? "growth_score_follow_up" : "clinicgrower_standard",
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
        executiveSummary: `Prepared for ${accountName}${contactName ? ` (${contactName})` : ""}. This proposal uses the CRM record, audit status and Growth Score data already held in Mission Control.`,
        diagnosis: diagnosisLines || null,
        recommendedPlan: packageRecord?.proposalWording || (packageName ? `Recommended next package: ${packageName}.` : null),
        includedFeatures: packageRecord?.includedFeatures || [],
        timeline: "Confirm proposal fit and decision owner.\nAgree package, start date and commercial terms.\nMove accepted work into delivery onboarding and internal tasks.",
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
    if (status === "lost" && (!cleanString(data.lostReason) || !cleanString(data.objectionType))) {
      throw ApiError.badRequest("Lost reason and objection type are required when marking a proposal lost");
    }
    const recommendedPackage = await this.resolveRecommendedPackage(clinicId, data.recommendedPackageId);
    const packageName = cleanString(data.packageName) || recommendedPackage?.name || null;
    const valueCents = data.valueCents ?? recommendedPackage?.priceCents ?? null;
    const monthlyFeeCents = data.monthlyFeeCents ?? (recommendedPackage?.billingFrequency === "monthly" ? recommendedPackage?.priceCents : null);
    const setupFeeCents = data.setupFeeCents ?? recommendedPackage?.setupFeeCents ?? null;
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
      cleanString(data.templateKey) || "clinicgrower_standard",
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
         template_key, package_name, recommended_package_id, owner_id, status, value,
         monthly_fee_cents, setup_fee_cents, currency, ad_spend_note, vat_status,
         minimum_term_months, notice_period_days, start_date, follow_up_at, ready_at,
         sent_at, viewed_at, accepted_at, accepted_reason, won_at, won_reason, lost_at, lost_reason, objection_type, expires_at, proposal_url,
         notes, add_ons, discounts, internal_margin_note, section_content, draft_saved_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
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
          templateKey: cleanString(data.templateKey) || "clinicgrower_standard",
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
    const created = await this.getProposal(clinicId, id);
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
    const outcomeValueCents = Object.prototype.hasOwnProperty.call(data, "valueCents")
      ? data.valueCents
      : recommendedPackage?.priceCents ?? existing.valueCents;
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
    if (Object.prototype.hasOwnProperty.call(data, "templateKey")) add("template_key", cleanString(data.templateKey) || "clinicgrower_standard");
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
    const updated = await this.getProposal(clinicId, proposalId);
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
      if (data.paymentTerms !== undefined) payload.paymentTerms = data.paymentTerms;
    }

    if (status === "won") {
      payload.wonReason = reason;
      if (data.acceptedByName !== undefined) payload.acceptedByName = data.acceptedByName;
      if (data.acceptedByEmail !== undefined) payload.acceptedByEmail = data.acceptedByEmail;
      if (data.acceptedAt !== undefined) payload.acceptedAt = data.acceptedAt;
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
      const proposal = await this.getProposal(input.clinicId, input.proposalId, executor);
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
        `SELECT id
         FROM contact
         WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [contactId, clinicId],
      );
      if (contactRows.length === 0) throw ApiError.notFound("Contact not found");
    }

    if (clientAccountProfileId) {
      const [accountRows]: any = await pool.execute(
        `SELECT cap.id, cap.clinic_id as clientClinicId
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
    }

    if (data.ownerId) await this.ensureActiveOwner(clinicId, String(data.ownerId));

    return { contactId, dealId, clientAccountProfileId };
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
              currency
       FROM growth_package
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
         AND status <> 'archived'
       LIMIT 1`,
      [cleanPackageId, clinicId],
    );
    if (rows.length === 0) throw ApiError.badRequest("Recommended package must be available to this workspace");
    return rows[0] as { id: string; name: string; priceCents: number | null; setupFeeCents: number | null; billingFrequency: string | null; currency: string };
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
    // open stage is the safest proposal-stage fallback before won/lost.
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
    const acceptedByName = Object.prototype.hasOwnProperty.call(data, "acceptedByName")
      ? cleanString(data.acceptedByName)
      : cleanString(priorAcceptance?.acceptedByName) ||
        proposal.contactName ||
        proposal.sentToName ||
        proposal.accountName ||
        proposal.clientAccountName;
    const acceptedByEmail = Object.prototype.hasOwnProperty.call(data, "acceptedByEmail")
      ? cleanString(data.acceptedByEmail)
      : cleanString(priorAcceptance?.acceptedByEmail) ||
        proposal.contactEmail ||
        proposal.sentToEmail;
    if (!acceptedByName || !acceptedByEmail) {
      throw ApiError.badRequest(
        "Accepted by name and email are required the first time a proposal is accepted.",
      );
    }
    const acceptedAt =
      toMysqlDateTime(data.acceptedAt) ||
      toMysqlDateTime(priorAcceptance?.acceptedAt) ||
      toMysqlDateTime(proposal.acceptedAt) ||
      toMysqlDateTime(proposal.wonAt) ||
      new Date().toISOString().slice(0, 19).replace("T", " ");
    const paymentTerms =
      cleanString(data.paymentTerms) ||
      cleanString(priorAcceptance?.paymentTerms) ||
      "Monthly fees payable monthly in advance. Setup fee due before project kickoff unless otherwise agreed.";
    const sectionContent = proposal.sectionContent || {};
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
      capturedAt: new Date().toISOString(),
    };

    const id = uuidv4();
    await executor.execute(
      `INSERT INTO proposal_acceptance_record
        (id, clinic_id, proposal_id, contact_id, deal_id, client_account_profile_id,
         accepted_by_name, accepted_by_email, accepted_at, acceptance_status,
         package_name, recommended_package_id, monthly_fee_cents, setup_fee_cents,
         currency, payment_terms, start_date, minimum_term_months, notice_period_days,
         scope, commercial_snapshot, proposal_snapshot, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         contact_id = VALUES(contact_id),
         deal_id = VALUES(deal_id),
         client_account_profile_id = COALESCE(VALUES(client_account_profile_id), client_account_profile_id),
         accepted_by_name = VALUES(accepted_by_name),
         accepted_by_email = VALUES(accepted_by_email),
         accepted_at = VALUES(accepted_at),
         acceptance_status = VALUES(acceptance_status),
         package_name = VALUES(package_name),
         recommended_package_id = VALUES(recommended_package_id),
         monthly_fee_cents = VALUES(monthly_fee_cents),
         setup_fee_cents = VALUES(setup_fee_cents),
         currency = VALUES(currency),
         payment_terms = VALUES(payment_terms),
         start_date = VALUES(start_date),
         minimum_term_months = VALUES(minimum_term_months),
         notice_period_days = VALUES(notice_period_days),
         scope = VALUES(scope),
         commercial_snapshot = VALUES(commercial_snapshot),
         proposal_snapshot = VALUES(proposal_snapshot),
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
      },
    };
    if (executor === pool) {
      await logAuditEvent(auditPayload);
    } else {
      await insertAuditEvent(executor, auditPayload);
    }
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
