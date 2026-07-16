import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { userCanManageAllClientAccounts } from "../../middleware/authorize.js";
import type {
  GrowthScoreCategories,
  GrowthScoreSnapshotListQuery,
  GrowthScoreSnapshotListResponse,
  GrowthScoreSnapshotPayload,
  GrowthScoreSnapshotRecord,
} from "./growth-scores.types.js";

const emptyCategories: GrowthScoreCategories = {
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

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeScore(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(100, Math.max(0, numeric));
}

function normalizeCategories(value: unknown): GrowthScoreCategories {
  const raw = value && typeof value === "object" ? value as Partial<GrowthScoreCategories> : {};
  return {
    websiteVisibility: normalizeScore(raw.websiteVisibility),
    seo: normalizeScore(raw.seo),
    gbp: normalizeScore(raw.gbp),
    tracking: normalizeScore(raw.tracking),
    conversion: normalizeScore(raw.conversion),
    leadHandling: normalizeScore(raw.leadHandling),
    responseSpeed: normalizeScore(raw.responseSpeed),
    enquiryVisibility: normalizeScore(raw.enquiryVisibility),
    treatmentPerformance: normalizeScore(raw.treatmentPerformance),
    revenueLeakage: normalizeScore(raw.revenueLeakage),
    growthOpportunity: normalizeScore(raw.growthOpportunity),
  };
}

function hasCategoryScore(categories: GrowthScoreCategories) {
  return Object.values(categories).some((value) => value !== null && value !== undefined);
}

function toDateOnly(value: unknown) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function toDateTime(value: unknown) {
  const parsed = value ? new Date(String(value)) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function toIso(value: unknown) {
  if (!value) return null;
  return new Date(String(value)).toISOString();
}

function parseCategories(value: unknown, row: any): GrowthScoreCategories {
  let parsed: Record<string, unknown> = {};
  if (value) {
    try {
      parsed = typeof value === "object" ? value as Record<string, unknown> : JSON.parse(String(value));
    } catch {
      parsed = {};
    }
  }

  const score = (columnValue: unknown, key: keyof GrowthScoreCategories) =>
    normalizeScore(columnValue ?? parsed[key]);

  return {
    websiteVisibility: score(row.websiteVisibilityScore, "websiteVisibility"),
    seo: score(row.seoScore, "seo"),
    gbp: score(row.gbpScore, "gbp"),
    tracking: score(row.trackingScore, "tracking"),
    conversion: score(row.conversionScore, "conversion"),
    leadHandling: score(row.leadHandlingScore, "leadHandling"),
    responseSpeed: score(row.responseSpeedScore, "responseSpeed"),
    enquiryVisibility: score(row.enquiryVisibilityScore, "enquiryVisibility"),
    treatmentPerformance: score(row.treatmentPerformanceScore, "treatmentPerformance"),
    revenueLeakage: score(row.revenueLeakageScore, "revenueLeakage"),
    growthOpportunity: score(row.growthOpportunityScore, "growthOpportunity"),
  };
}

function mapSnapshot(row: any): GrowthScoreSnapshotRecord {
  return {
    id: row.id,
    clinicId: row.clinicId,
    contactId: row.contactId || null,
    clientAccountProfileId: row.clientAccountProfileId || null,
    auditId: row.auditId || null,
    snapshotDate: String(row.snapshotDate).slice(0, 10),
    scoredAt: new Date(row.scoredAt).toISOString(),
    overallScore: normalizeScore(row.overallScore),
    categoryScores: parseCategories(row.categoryScores, row),
    recommendedPackage: row.recommendedPackage || null,
    gapSummary: row.gapSummary || null,
    source: row.source || "manual",
    notes: row.notes || null,
    createdBy: row.createdBy || null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export class GrowthScoresService {
  async listSnapshots(
    authClinicId: string,
    userId: string,
    query: GrowthScoreSnapshotListQuery,
  ): Promise<GrowthScoreSnapshotListResponse> {
    const targetClinicId = await this.resolveTargetClinicId(authClinicId, userId, query);
    const clauses = ["clinic_id = ?"];
    const values: any[] = [targetClinicId];

    if (query.contactId) {
      clauses.push("contact_id = ?");
      values.push(query.contactId);
    }
    if (query.clientAccountProfileId) {
      clauses.push("client_account_profile_id = ?");
      values.push(query.clientAccountProfileId);
    }
    if (query.auditId) {
      clauses.push("audit_id = ?");
      values.push(query.auditId);
    }

    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const [rows]: any = await pool.execute(
      `SELECT ${this.snapshotSelectFields()}
       FROM growth_score_snapshot
       WHERE ${clauses.join(" AND ")}
       ORDER BY snapshot_date DESC, scored_at DESC, created_at DESC
       LIMIT ${limit}`,
      values,
    );

    const snapshots = rows.map(mapSnapshot);
    return {
      current: snapshots[0] || null,
      previous: snapshots.slice(1),
      snapshots,
    };
  }

  async createSnapshot(
    authClinicId: string,
    userId: string,
    data: GrowthScoreSnapshotPayload,
  ): Promise<GrowthScoreSnapshotRecord> {
    const contactId = cleanString(data.contactId);
    const clientAccountProfileId = cleanString(data.clientAccountProfileId);
    const auditId = cleanString(data.auditId);
    if (!contactId && !clientAccountProfileId && !auditId) {
      throw ApiError.badRequest("Snapshot must be linked to a lead/contact, client account, or audit");
    }

    const target: { contactId?: string; clientAccountProfileId?: string; auditId?: string } = {};
    if (contactId) target.contactId = contactId;
    if (clientAccountProfileId) target.clientAccountProfileId = clientAccountProfileId;
    if (auditId) target.auditId = auditId;
    const targetClinicId = await this.resolveTargetClinicId(authClinicId, userId, target);
    const categories = normalizeCategories(data.categoryScores || data.categories || emptyCategories);
    const overallScore = normalizeScore(data.overallScore ?? data.overall);
    if (overallScore === null && !hasCategoryScore(categories)) {
      throw ApiError.badRequest("Snapshot must include an overall score or at least one category score");
    }

    const id = uuidv4();
    const snapshotDate = toDateOnly(data.snapshotDate || data.scoredAt);
    const scoredAt = toDateTime(data.scoredAt || data.snapshotDate);
    const recommendedPackage = cleanString(data.recommendedPackage);
    const gapSummary = cleanString(data.gapSummary);
    const source = cleanString(data.source) || "manual";
    const notes = cleanString(data.notes);

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `INSERT INTO growth_score_snapshot
          (id, clinic_id, contact_id, client_account_profile_id, audit_id, snapshot_date, scored_at,
           overall_score, category_scores, website_visibility_score, seo_score, gbp_score, tracking_score,
           conversion_score, lead_handling_score, response_speed_score, enquiry_visibility_score,
           treatment_performance_score, revenue_leakage_score, growth_opportunity_score,
           recommended_package, gap_summary, source, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          targetClinicId,
          contactId,
          clientAccountProfileId,
          auditId,
          snapshotDate,
          scoredAt,
          overallScore,
          JSON.stringify(categories),
          categories.websiteVisibility,
          categories.seo,
          categories.gbp,
          categories.tracking,
          categories.conversion,
          categories.leadHandling,
          categories.responseSpeed,
          categories.enquiryVisibility,
          categories.treatmentPerformance,
          categories.revenueLeakage,
          categories.growthOpportunity,
          recommendedPackage,
          gapSummary,
          source,
          notes,
          userId,
        ],
      );

      if (contactId) {
        await this.updateContactCurrentScore(connection, targetClinicId, contactId, {
          overallScore,
          categories,
          recommendedPackage,
          gapSummary,
          scoredAt,
        });
      }

      if (clientAccountProfileId) {
        await this.updateClientAccountCurrentScore(connection, targetClinicId, clientAccountProfileId, {
          overallScore,
          categories,
          recommendedPackage,
          gapSummary,
          scoredAt,
        });
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await logAuditEvent({
      clinicId: targetClinicId,
      userId,
      action: "GROWTH_SCORE_SNAPSHOT_CREATED",
      entityType: "growth_score_snapshot",
      entityId: id,
      changes: {
        contactId,
        clientAccountProfileId,
        auditId,
        snapshotDate,
        overallScore,
        categoryScores: categories,
        recommendedPackage,
      },
    });

    return this.getSnapshotById(targetClinicId, id);
  }

  private async resolveTargetClinicId(
    authClinicId: string,
    userId: string,
    target: { contactId?: string; clientAccountProfileId?: string; auditId?: string },
  ) {
    if (target.contactId) {
      const [rows]: any = await pool.execute(
        `SELECT clinic_id as clinicId
         FROM contact
         WHERE id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [target.contactId],
      );
      const clinicId = rows[0]?.clinicId;
      if (!clinicId) throw ApiError.notFound("Lead/contact not found");
      if (clinicId !== authClinicId) throw ApiError.forbidden("Lead/contact is not available to this workspace");
      return clinicId as string;
    }

    if (target.clientAccountProfileId) {
      const [rows]: any = await pool.execute(
        `SELECT clinic_id as clinicId
         FROM client_account_profile
         WHERE id = ?
         LIMIT 1`,
        [target.clientAccountProfileId],
      );
      const clinicId = rows[0]?.clinicId;
      if (!clinicId) throw ApiError.notFound("Client account profile not found");
      if (clinicId === authClinicId) return clinicId as string;
      if (await userCanManageAllClientAccounts(userId, authClinicId)) return clinicId as string;
      throw ApiError.forbidden("Client account is not available to this workspace");
    }

    return authClinicId;
  }

  private async getSnapshotById(clinicId: string, snapshotId: string) {
    const [rows]: any = await pool.execute(
      `SELECT ${this.snapshotSelectFields()}
       FROM growth_score_snapshot
       WHERE id = ? AND clinic_id = ?
       LIMIT 1`,
      [snapshotId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Growth Score snapshot not found");
    return mapSnapshot(rows[0]);
  }

  private async updateContactCurrentScore(connection: any, clinicId: string, contactId: string, score: {
    overallScore: number | null;
    categories: GrowthScoreCategories;
    recommendedPackage: string | null;
    gapSummary: string | null;
    scoredAt: string;
  }) {
    const [result]: any = await connection.execute(
      `UPDATE contact
       SET growth_score_overall = ?,
           growth_score_categories = ?,
           growth_score_website_visibility = ?,
           growth_score_seo = ?,
           growth_score_gbp = ?,
           growth_score_tracking = ?,
           growth_score_conversion = ?,
           growth_score_lead_handling = ?,
           growth_score_response_speed = ?,
           growth_score_enquiry_visibility = ?,
           growth_score_treatment_performance = ?,
           growth_score_revenue_leakage = ?,
           growth_score_growth_opportunity = ?,
           growth_score_recommended_package = ?,
           recommended_package = COALESCE(recommended_package, ?),
           growth_score_gap_summary = ?,
           growth_score_updated_at = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [
        score.overallScore,
        JSON.stringify(score.categories),
        score.categories.websiteVisibility,
        score.categories.seo,
        score.categories.gbp,
        score.categories.tracking,
        score.categories.conversion,
        score.categories.leadHandling,
        score.categories.responseSpeed,
        score.categories.enquiryVisibility,
        score.categories.treatmentPerformance,
        score.categories.revenueLeakage,
        score.categories.growthOpportunity,
        score.recommendedPackage,
        score.recommendedPackage,
        score.gapSummary,
        score.scoredAt,
        contactId,
        clinicId,
      ],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Lead/contact not found");
  }

  private async updateClientAccountCurrentScore(connection: any, clinicId: string, profileId: string, score: {
    overallScore: number | null;
    categories: GrowthScoreCategories;
    recommendedPackage: string | null;
    gapSummary: string | null;
    scoredAt: string;
  }) {
    const [result]: any = await connection.execute(
      `UPDATE client_account_profile
       SET growth_score_overall = ?,
           growth_score_categories = ?,
           growth_score_website_visibility = ?,
           growth_score_seo = ?,
           growth_score_gbp = ?,
           growth_score_tracking = ?,
           growth_score_conversion = ?,
           growth_score_lead_handling = ?,
           growth_score_response_speed = ?,
           growth_score_enquiry_visibility = ?,
           growth_score_treatment_performance = ?,
           growth_score_revenue_leakage = ?,
           growth_score_growth_opportunity = ?,
           growth_score_recommended_package = ?,
           recommended_next_package = COALESCE(recommended_next_package, ?),
           growth_score_gap_summary = ?,
           growth_score_updated_at = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ?`,
      [
        score.overallScore,
        JSON.stringify(score.categories),
        score.categories.websiteVisibility,
        score.categories.seo,
        score.categories.gbp,
        score.categories.tracking,
        score.categories.conversion,
        score.categories.leadHandling,
        score.categories.responseSpeed,
        score.categories.enquiryVisibility,
        score.categories.treatmentPerformance,
        score.categories.revenueLeakage,
        score.categories.growthOpportunity,
        score.recommendedPackage,
        score.recommendedPackage,
        score.gapSummary,
        score.scoredAt,
        profileId,
        clinicId,
      ],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Client account profile not found");
  }

  private snapshotSelectFields() {
    return `id,
            clinic_id as clinicId,
            contact_id as contactId,
            client_account_profile_id as clientAccountProfileId,
            audit_id as auditId,
            snapshot_date as snapshotDate,
            scored_at as scoredAt,
            overall_score as overallScore,
            category_scores as categoryScores,
            website_visibility_score as websiteVisibilityScore,
            seo_score as seoScore,
            gbp_score as gbpScore,
            tracking_score as trackingScore,
            conversion_score as conversionScore,
            lead_handling_score as leadHandlingScore,
            response_speed_score as responseSpeedScore,
            enquiry_visibility_score as enquiryVisibilityScore,
            treatment_performance_score as treatmentPerformanceScore,
            revenue_leakage_score as revenueLeakageScore,
            growth_opportunity_score as growthOpportunityScore,
            recommended_package as recommendedPackage,
            gap_summary as gapSummary,
            source,
            notes,
            created_by as createdBy,
            created_at as createdAt`;
  }
}

export const growthScoresService = new GrowthScoresService();
