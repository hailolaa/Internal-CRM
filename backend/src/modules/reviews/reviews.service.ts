import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";

const defaultTemplate = "Hi {{patient_name}}, thank you for choosing us. If you had a good experience, would you leave us a quick Google review? {{google_review_link}}";
const checklist = [
  ["profile_claimed", "Google Business Profile claimed"],
  ["review_link_added", "Google review link added"],
  ["request_template_ready", "Review request template ready"],
  ["weekly_review_rhythm", "Weekly review request rhythm agreed"],
  ["reply_owner_assigned", "Review reply owner assigned"],
] as const;

function parseConfig(value: unknown) {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function isGoogleSource(source: string | null | undefined) {
  return String(source || "").toLowerCase().includes("google");
}

export class ReviewsService {
  private async ensureReputationSettings(clinicId: string) {
    await pool.execute(
      `INSERT IGNORE INTO reputation_setting (clinic_id, review_request_template)
       VALUES (?, ?)`,
      [clinicId, defaultTemplate],
    );

    for (const [key, label] of checklist) {
      await pool.execute(
        `INSERT IGNORE INTO gbp_checklist_item (id, clinic_id, item_key, label)
         VALUES (?, ?, ?, ?)`,
        [uuidv4(), clinicId, key, label],
      );
    }
  }

  // List clinic reviews with basic contact names
  async listReviews(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT r.id, r.rating, r.comment, r.source, r.status, r.created_at as createdAt,
              c.first_name as firstName, c.last_name as lastName
       FROM review r
       LEFT JOIN contact c ON c.id = r.contact_id
       WHERE r.clinic_id = ? AND r.deleted_at IS NULL
       ORDER BY r.created_at DESC`,
      [clinicId],
    );
    return rows.map((row: any) => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      source: row.source,
      status: row.status,
      author: [row.firstName, row.lastName].filter(Boolean).join(" ") || "Patient",
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  }

  // Update review moderation/reply status where schema allows
  async updateReviewStatus(clinicId: string, userId: string, reviewId: string, status: string): Promise<void> {
    const [result]: any = await pool.execute(
      "UPDATE review SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL",
      [status, reviewId, clinicId],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Review not found");
    await logAuditEvent({ clinicId, userId, action: "REVIEW_UPDATED", entityType: "review", entityId: reviewId, changes: { status } });
  }

  async getReputationSummary(clinicId: string) {
    await this.ensureReputationSettings(clinicId);
    const [settingRows]: any = await pool.execute(
      `SELECT google_review_link as googleReviewLink,
              review_request_template as reviewRequestTemplate,
              manual_review_received_count as manualReviewReceivedCount
       FROM reputation_setting
       WHERE clinic_id = ?
       LIMIT 1`,
      [clinicId],
    );
    const [requestRows]: any = await pool.execute(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent
       FROM review_request
       WHERE clinic_id = ? AND deleted_at IS NULL`,
      [clinicId],
    );
    const [checklistRows]: any = await pool.execute(
      `SELECT id, item_key as itemKey, label, completed
       FROM gbp_checklist_item
       WHERE clinic_id = ?
       ORDER BY created_at ASC`,
      [clinicId],
    );
    const gbpContext = await this.getGbpContext(clinicId);

    const settings = settingRows[0] || {};
    return {
      googleReviewLink: settings.googleReviewLink || "",
      googleReviewManagementUrl: gbpContext.managementUrl,
      reviewRequestTemplate: settings.reviewRequestTemplate || defaultTemplate,
      manualReviewReceivedCount: Number(settings.manualReviewReceivedCount || 0),
      reviewRequestsSentCount: Number(requestRows[0]?.sent || 0),
      reviewRequestsTotalCount: Number(requestRows[0]?.total || 0),
      googleReviewSyncConnected: gbpContext.configured,
      gbpIntegration: {
        configured: gbpContext.configured,
        setupStatus: gbpContext.setupStatus,
        healthStatus: gbpContext.healthStatus,
        directReplyAvailable: gbpContext.directReplyAvailable,
        unavailableReason: gbpContext.unavailableReason,
        missingPermissions: gbpContext.missingPermissions,
        managementUrl: gbpContext.managementUrl,
      },
      wording: [
        "Manual review count",
        gbpContext.configured ? "Google Business Profile connector is configured" : "Google review sync is not connected",
        "Based on manually entered data",
      ],
      checklist: checklistRows.map((row: any) => ({
        id: row.id,
        itemKey: row.itemKey,
        label: row.label,
        completed: Boolean(row.completed),
      })),
    };
  }

  async updateReputationSettings(clinicId: string, userId: string, data: any) {
    await this.ensureReputationSettings(clinicId);
    await pool.execute(
      `UPDATE reputation_setting
       SET google_review_link = COALESCE(?, google_review_link),
           review_request_template = COALESCE(?, review_request_template),
           manual_review_received_count = COALESCE(?, manual_review_received_count),
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?`,
      [
        data.googleReviewLink ?? null,
        data.reviewRequestTemplate ?? null,
        data.manualReviewReceivedCount ?? null,
        clinicId,
      ],
    );
    await logAuditEvent({ clinicId, userId, action: "REPUTATION_SETTINGS_UPDATED", entityType: "reputation_setting", entityId: clinicId, changes: { ...data } });
    return this.getReputationSummary(clinicId);
  }

  async listReviewRequests(clinicId: string) {
    await this.ensureReputationSettings(clinicId);
    const [rows]: any = await pool.execute(
      `SELECT id,
              contact_id as contactId,
              recipient_name as recipientName,
              recipient_phone as recipientPhone,
              recipient_email as recipientEmail,
              status,
              message,
              sent_at as sentAt,
              created_at as createdAt
       FROM review_request
       WHERE clinic_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 200`,
      [clinicId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      contactId: row.contactId,
      recipientName: row.recipientName,
      recipientPhone: row.recipientPhone,
      recipientEmail: row.recipientEmail,
      status: row.status,
      message: row.message,
      sentAt: row.sentAt ? new Date(row.sentAt).toISOString() : null,
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  }

  async createReviewRequest(clinicId: string, userId: string, data: any) {
    await this.ensureReputationSettings(clinicId);
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO review_request
        (id, clinic_id, contact_id, recipient_name, recipient_phone, recipient_email, message, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        data.contactId || null,
        data.recipientName || null,
        data.recipientPhone || null,
        data.recipientEmail || null,
        data.message || null,
        userId,
      ],
    );
    await logAuditEvent({ clinicId, userId, action: "REVIEW_REQUEST_CREATED", entityType: "review_request", entityId: id, changes: { contactId: data.contactId || null } });
    return { id };
  }

  async markReviewRequestSent(clinicId: string, userId: string, id: string) {
    const [result]: any = await pool.execute(
      `UPDATE review_request
       SET status = 'sent', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [id, clinicId],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Review request not found");
    await logAuditEvent({ clinicId, userId, action: "REVIEW_REQUEST_SENT", entityType: "review_request", entityId: id });
  }

  async updateChecklistItem(clinicId: string, userId: string, itemKey: string, completed: boolean) {
    await this.ensureReputationSettings(clinicId);
    const [result]: any = await pool.execute(
      `UPDATE gbp_checklist_item
       SET completed = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ? AND item_key = ?`,
      [completed ? 1 : 0, userId, clinicId, itemKey],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("GBP checklist item not found");
    return this.getReputationSummary(clinicId);
  }

  async suggestReply(_clinicId: string, data: { rating?: number; comment?: string }) {
    const rating = Number(data.rating || 0);
    const comment = String(data.comment || "").trim();
    const tone = rating >= 4 ? "positive" : rating <= 2 ? "concerned" : "balanced";
    return {
      label: "Review reply suggestion",
      advisory: true,
      source: "fallback",
      suggestion: tone === "positive"
        ? "Thank you for the kind review. We are delighted you had a great experience and appreciate you recommending the clinic."
        : `Thank you for the feedback${comment ? " about your experience" : ""}. We are sorry this did not meet expectations. Please contact the clinic team so we can understand what happened and improve.`,
    };
  }

  async getReviewReplyHandoff(clinicId: string, userId: string, reviewId: string) {
    const [reviewRows]: any = await pool.execute(
      `SELECT id, source, status
       FROM review
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [reviewId, clinicId],
    );
    const review = reviewRows[0];
    if (!review) throw ApiError.notFound("Review not found");

    const gbpContext = await this.getGbpContext(clinicId);
    const response = {
      reviewId,
      source: review.source || null,
      directReplyAvailable: false,
      action: "unavailable" as "open_external" | "unavailable",
      externalUrl: null as string | null,
      unavailableReason: "",
      requirements: [
        "Verified Google Business Profile location",
        "OAuth token with https://www.googleapis.com/auth/business.manage",
        "Stored Google account ID, location ID, and review resource name",
      ],
    };

    if (!isGoogleSource(review.source)) {
      response.unavailableReason = "This review source does not support Google Business Profile reply handoff.";
    } else if (gbpContext.managementUrl) {
      response.action = "open_external";
      response.externalUrl = gbpContext.managementUrl;
      response.unavailableReason = "Direct API replies need Google OAuth and stored GBP review resource IDs; opening the configured review management URL instead.";
    } else {
      response.unavailableReason = gbpContext.unavailableReason;
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "REVIEW_REPLY_HANDOFF_REQUESTED",
      entityType: "review",
      entityId: reviewId,
      changes: {
        source: review.source || null,
        action: response.action,
        directReplyAvailable: response.directReplyAvailable,
        externalUrlAvailable: Boolean(response.externalUrl),
        unavailableReason: response.unavailableReason,
      },
    });

    return response;
  }

  private async getGbpContext(clinicId: string) {
    const [settingRows]: any = await pool.execute(
      `SELECT google_review_link as googleReviewLink
       FROM reputation_setting
       WHERE clinic_id = ?
       LIMIT 1`,
      [clinicId],
    );
    const [integrationRows]: any = await pool.execute(
      `SELECT config,
              is_active as isActive,
              setup_status as setupStatus,
              health_status as healthStatus,
              missing_permissions as missingPermissions
       FROM integration
       WHERE clinic_id = ?
         AND type = 'google_business_profile'
         AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId],
    );

    const integration = integrationRows[0] || null;
    const config = parseConfig(integration?.config);
    const missingPermissions = (() => {
      const raw = integration?.missingPermissions;
      if (!raw) return [] as string[];
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    })();
    const managementUrl = firstString(
      config.reviewManagementUrl,
      config.gbpManagementUrl,
      config.profileUrl,
      config.placeUrl,
      settingRows[0]?.googleReviewLink,
    );
    const configured = Boolean(integration?.isActive && integration?.setupStatus === "ready");
    const hasReplyCredentials = configured
      && Boolean(
        config.oauthConnected ||
        config.accessToken ||
        config.refreshToken ||
        config.encryptedAccessToken ||
        config.encryptedRefreshToken
      )
      && Boolean(config.accountId)
      && Boolean(config.locationId)
      && missingPermissions.length === 0;

    return {
      configured,
      setupStatus: integration?.setupStatus || "not_configured",
      healthStatus: integration?.healthStatus || "unknown",
      missingPermissions,
      managementUrl,
      directReplyAvailable: false,
      unavailableReason: hasReplyCredentials
        ? "Direct Google replies also require storing the Google review resource name for each review."
        : "Google Business Profile direct replies require OAuth credentials, business.manage scope, a verified location, and stored Google review resource IDs.",
    };
  }
}

export const reviewsService = new ReviewsService();
