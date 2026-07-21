import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { buildTimelineMetadata, logTimelineActivity } from "../../utils/activity.js";
import type {
  ProposalLinkAccess,
  ProposalListQuery,
  ProposalMutationDTO,
  ProposalResponse,
  ProposalSectionContent,
  ProposalSourceDataQuery,
  ProposalSourceDataResponse,
  ProposalStatus,
} from "./proposals.types.js";

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
    currency: row.currency || "GBP",
    followUpAt: toIso(row.followUpAt),
    readyAt: toIso(row.readyAt),
    sentAt: toIso(row.sentAt),
    viewedAt: toIso(row.viewedAt),
    acceptedAt: toIso(row.acceptedAt),
    wonAt: toIso(row.wonAt),
    lostAt: toIso(row.lostAt),
    expiresAt: toIso(row.expiresAt),
    proposalUrl: row.proposalUrl || null,
    notes: row.notes || null,
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
  };
}

function proposalSelectSql() {
  return `SELECT p.id,
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
                 p.currency,
                 p.follow_up_at as followUpAt,
                 p.ready_at as readyAt,
                 p.sent_at as sentAt,
                 p.viewed_at as viewedAt,
                 p.accepted_at as acceptedAt,
                 p.won_at as wonAt,
                 p.lost_at as lostAt,
                 p.expires_at as expiresAt,
                 p.proposal_url as proposalUrl,
                 p.notes,
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
                 owner.email as ownerEmail
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
           AND owner.deleted_at IS NULL`;
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

    const limit = Math.min(250, Math.max(1, Number(query.limit) || 100));
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

  async getProposal(clinicId: string, proposalId: string): Promise<ProposalResponse> {
    const [rows]: any = await pool.execute(
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
    const categories = mapScoreCategories(contact || clientAccount || {});
    const gaps = scoreGaps(categories);
    const overall = numberOrNull((contact || clientAccount)?.growthScoreOverall);
    const growthScoreRecommendation = cleanString((contact || clientAccount)?.growthScoreRecommendedPackage);
    const explicitRecommendation =
      growthScoreRecommendation ||
      cleanString(clientAccount?.recommendedNextPackage) ||
      cleanString(contact?.recommendedPackage) ||
      cleanString(contact?.packageInterest) ||
      cleanString(deal?.treatment);
    const packageRecord = await this.findRecommendedPackageByName(clinicId, explicitRecommendation);
    const packageName = packageRecord?.name || explicitRecommendation || null;
    const gapSummary = cleanString((contact || clientAccount)?.growthScoreGapSummary);
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
      currency: packageRecord?.currency || "GBP",
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
        updatedAt: toIso((contact || clientAccount)?.growthScoreUpdatedAt),
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
        currency: packageRecord?.currency || null,
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
    const recommendedPackage = await this.resolveRecommendedPackage(clinicId, data.recommendedPackageId);
    const packageName = cleanString(data.packageName) || recommendedPackage?.name || null;
    const valueCents = data.valueCents ?? recommendedPackage?.priceCents ?? null;
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
      (cleanString(data.currency) || "GBP").toUpperCase(),
      toMysqlDateTime(data.followUpAt),
      timestamps.readyAt ?? null,
      timestamps.sentAt ?? null,
      timestamps.viewedAt ?? null,
      timestamps.acceptedAt ?? null,
      timestamps.wonAt ?? null,
      timestamps.lostAt ?? null,
      toMysqlDateTime(data.expiresAt),
      cleanString(data.proposalUrl),
      cleanString(data.notes),
      serializeSectionContent(data.sectionContent),
      draftSavedAt,
      userId,
      userId,
    ];

    await pool.execute(
      `INSERT INTO proposal
        (id, clinic_id, contact_id, deal_id, client_account_profile_id, proposal_name,
         template_key, package_name, recommended_package_id, owner_id, status, value, currency, follow_up_at, ready_at,
         sent_at, viewed_at, accepted_at, won_at, lost_at, expires_at, proposal_url,
         notes, section_content, draft_saved_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values,
    );

    await this.logProposalActivity({
      clinicId,
      userId,
      contactId: links.contactId,
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
        ownerId: cleanString(data.ownerId) || userId,
        followUpAt: toMysqlDateTime(data.followUpAt),
      },
    });
    await logAuditEvent({
      clinicId,
      userId,
      action: "PROPOSAL_CREATED",
      entityType: "proposal",
      entityId: id,
      changes: { ...data, contactId: links.contactId, dealId: links.dealId, clientAccountProfileId: links.clientAccountProfileId },
    });

    return this.getProposal(clinicId, id);
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
    const links = await this.resolveProposalLinks(clinicId, linkData, access);
    const status = data.status || existing.status;
    const followUpAt = data.followUpAt === undefined ? existing.followUpAt : data.followUpAt;
    this.validateStatusRequirements(status, followUpAt);
    const recommendedPackage = Object.prototype.hasOwnProperty.call(data, "recommendedPackageId")
      ? await this.resolveRecommendedPackage(clinicId, data.recommendedPackageId)
      : null;

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
    if (Object.prototype.hasOwnProperty.call(data, "currency")) add("currency", (cleanString(data.currency) || "GBP").toUpperCase());
    if (Object.prototype.hasOwnProperty.call(data, "followUpAt")) add("follow_up_at", toMysqlDateTime(data.followUpAt));
    if (Object.prototype.hasOwnProperty.call(data, "proposalUrl")) add("proposal_url", cleanString(data.proposalUrl));
    if (Object.prototype.hasOwnProperty.call(data, "notes")) add("notes", cleanString(data.notes));
    if (Object.prototype.hasOwnProperty.call(data, "sectionContent")) add("section_content", serializeSectionContent(data.sectionContent));
    if (status === "draft") add("draft_saved_at", new Date().toISOString().slice(0, 19).replace("T", " "));

    const statusTimestamps = this.getStatusTimestamps(status, data, existing);
    for (const [column, value] of Object.entries(statusTimestamps)) {
      if (value !== undefined) add(column.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value);
    }

    add("updated_by", userId);
    values.push(proposalId, clinicId);
    await pool.execute(
      `UPDATE proposal
       SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );

    const updated = await this.getProposal(clinicId, proposalId);
    if (existing.status !== updated.status) {
      await this.logProposalActivity({
        clinicId,
        userId,
        contactId: updated.contactId,
        proposalId,
        action: "proposal_status_changed",
        title: updated.proposalName,
        status: updated.status,
        previousStatus: existing.status,
        changes: {
          previousStatus: existing.status,
          status: updated.status,
          followUpAt: updated.followUpAt,
        },
      });
    } else {
      await this.logProposalActivity({
        clinicId,
        userId,
        contactId: updated.contactId,
        proposalId,
        action: "proposal_updated",
        title: updated.proposalName,
        status: updated.status,
        changes: data as Record<string, unknown>,
      });
    }
    await logAuditEvent({
      clinicId,
      userId,
      action: existing.status !== updated.status ? "PROPOSAL_STATUS_CHANGED" : "PROPOSAL_UPDATED",
      entityType: "proposal",
      entityId: proposalId,
      changes: { before: { status: existing.status }, after: data },
    });

    return updated;
  }

  async archiveProposal(clinicId: string, userId: string, proposalId: string): Promise<void> {
    const existing = await this.getProposal(clinicId, proposalId);
    await pool.execute(
      `UPDATE proposal
       SET status = 'archived', deleted_at = CURRENT_TIMESTAMP, updated_by = ?
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [userId, proposalId, clinicId],
    );
    await this.logProposalActivity({
      clinicId,
      userId,
      contactId: existing.contactId,
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

  private async resolveProposalLinks(clinicId: string, data: ProposalMutationDTO, access: ProposalLinkAccess) {
    let contactId = cleanString(data.contactId);
    const dealId = cleanString(data.dealId);
    const clientAccountProfileId = cleanString(data.clientAccountProfileId);

    if (!contactId && !dealId) {
      throw ApiError.badRequest("Proposal must link to a lead/contact or deal so activity can appear on the record timeline");
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
      if (accountRows[0].clientClinicId !== clinicId && !access.canManageAllClientAccounts) {
        throw ApiError.forbidden("Client account is not available to this workspace");
      }
    }

    if (data.ownerId) await this.ensureActiveOwner(String(data.ownerId));

    return { contactId, dealId, clientAccountProfileId };
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
              currency,
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
      currency: rows[0].currency || "GBP",
      includedFeatures: parseJsonArray(rows[0].includedFeatures),
      proposalWording: rows[0].proposalWording || null,
    };
  }

  private async ensureActiveOwner(userId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM user
       WHERE id = ?
         AND deleted_at IS NULL
         AND status = 'active'
         AND is_active = 1
       LIMIT 1`,
      [userId],
    );
    if (rows.length === 0) throw ApiError.badRequest("Proposal owner must be an active internal user");
  }

  private async resolveRecommendedPackage(clinicId: string, packageId: unknown) {
    const cleanPackageId = cleanString(packageId);
    if (!cleanPackageId) return null;
    const [rows]: any = await pool.execute(
      `SELECT id,
              name,
              price_cents as priceCents,
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
    return rows[0] as { id: string; name: string; priceCents: number | null; currency: string };
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
    userId: string;
    contactId: string | null;
    proposalId: string;
    action: string;
    title: string;
    status: ProposalStatus;
    previousStatus?: ProposalStatus;
    changes?: Record<string, unknown>;
  }) {
    if (!input.contactId) return;
    const metadata = buildTimelineMetadata({
      action: input.action,
      source: "proposal",
      recordId: input.proposalId,
      title: input.title,
      status: input.status,
      previousStatus: input.previousStatus || null,
      ...(input.changes ? { changes: input.changes } : {}),
    });

    await logTimelineActivity({
      clinicId: input.clinicId,
      contactId: input.contactId,
      type: "StatusChange",
      userId: input.userId,
      metadata,
    });
  }
}

export const proposalsService = new ProposalsService();
