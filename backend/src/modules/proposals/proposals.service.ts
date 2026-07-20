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

function mapProposal(row: any): ProposalResponse {
  const ownerName = [row.ownerFirstName, row.ownerLastName].filter(Boolean).join(" ").trim();
  return {
    id: row.id,
    contactId: row.contactId || null,
    dealId: row.dealId || null,
    clientAccountProfileId: row.clientAccountProfileId || null,
    proposalName: row.proposalName,
    packageName: row.packageName || null,
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
                 p.package_name as packageName,
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
    const id = uuidv4();
    const timestamps = this.getStatusTimestamps(status, data);

    const values: any[] = [
      id,
      clinicId,
      links.contactId,
      links.dealId,
      links.clientAccountProfileId,
      proposalName,
      cleanString(data.packageName),
      cleanString(data.ownerId) || userId,
      status,
      centsToValue(data.valueCents),
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
      userId,
      userId,
    ];

    await pool.execute(
      `INSERT INTO proposal
        (id, clinic_id, contact_id, deal_id, client_account_profile_id, proposal_name,
         package_name, owner_id, status, value, currency, follow_up_at, ready_at,
         sent_at, viewed_at, accepted_at, won_at, lost_at, expires_at, proposal_url,
         notes, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        packageName: cleanString(data.packageName),
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
    if (Object.prototype.hasOwnProperty.call(data, "packageName")) add("package_name", cleanString(data.packageName));
    if (Object.prototype.hasOwnProperty.call(data, "ownerId")) add("owner_id", cleanString(data.ownerId));
    if (Object.prototype.hasOwnProperty.call(data, "status")) add("status", status);
    if (Object.prototype.hasOwnProperty.call(data, "valueCents")) add("value", centsToValue(data.valueCents));
    if (Object.prototype.hasOwnProperty.call(data, "currency")) add("currency", (cleanString(data.currency) || "GBP").toUpperCase());
    if (Object.prototype.hasOwnProperty.call(data, "followUpAt")) add("follow_up_at", toMysqlDateTime(data.followUpAt));
    if (Object.prototype.hasOwnProperty.call(data, "proposalUrl")) add("proposal_url", cleanString(data.proposalUrl));
    if (Object.prototype.hasOwnProperty.call(data, "notes")) add("notes", cleanString(data.notes));

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
