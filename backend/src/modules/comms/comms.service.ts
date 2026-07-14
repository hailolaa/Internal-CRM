import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { buildTimelineMetadata, logTimelineActivity } from "../../utils/activity.js";
import { logAuditEvent } from "../../utils/audit.js";

function formatName(firstName: string | null, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || null;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type InboxArchiveFilter = "false" | "true" | "only" | "with" | undefined;

export class CommsService {
  // Build a lightweight unified inbox from existing email and SMS records
  async listInbox(
    clinicId: string,
    options: { archived?: InboxArchiveFilter } = {},
  ) {
    const [rows]: any = await pool.execute(
      `SELECT *
       FROM (
         SELECT e.id, e.contact_id as contactId,
                CONCAT(c.first_name, ' ', c.last_name) as contact,
                'email' as channel,
                COALESCE(e.body, e.subject, '') as preview,
                e.direction, e.status, e.created_at as createdAt
         FROM email e
         JOIN contact c ON c.id = e.contact_id
         WHERE e.clinic_id = ? AND e.deleted_at IS NULL
         UNION ALL
         SELECT s.id, s.contact_id as contactId,
                CONCAT(c.first_name, ' ', c.last_name) as contact,
                'sms' as channel,
                s.message as preview,
                s.direction, s.status, s.created_at as createdAt
         FROM sms s
         JOIN contact c ON c.id = s.contact_id
         WHERE s.clinic_id = ? AND s.deleted_at IS NULL
         UNION ALL
         SELECT wm.id, wm.contact_id as contactId,
                CONCAT(c.first_name, ' ', c.last_name) as contact,
                'whatsapp' as channel,
                wm.body as preview,
                wm.direction, wm.status, wm.created_at as createdAt
         FROM whatsapp_message wm
         JOIN contact c ON c.id = wm.contact_id
         WHERE wm.clinic_id = ? AND wm.deleted_at IS NULL
       ) inbox
       ORDER BY createdAt DESC
       LIMIT 100`,
      [clinicId, clinicId, clinicId],
    );

    const contactIds = Array.from(
      new Set<string>(
        rows
          .map((row: any) => row.contactId)
          .filter((contactId: unknown): contactId is string => Boolean(contactId)),
      ),
    );
    const stateByContactId = await this.getConversationStates(clinicId, contactIds);

    const conversations = new Map<string, any>();
    for (const row of rows) {
      const state = stateByContactId.get(row.contactId);
      const existing = conversations.get(row.contactId);
      const isUnread = row.direction === "inbound" && row.status !== "read";

      if (!existing) {
        const contact = row.contact?.trim() || "Unknown";
        conversations.set(row.contactId, {
          id: row.contactId,
          contactId: row.contactId,
          contact,
          channel: row.channel,
          preview: row.preview,
          time: new Date(row.createdAt).toISOString(),
          unread: isUnread,
          starred: Boolean(state?.starred),
          archived: Boolean(state?.archivedAt),
          attachmentsSupported: false,
          avatar: initials(contact),
        });
      } else if (isUnread) {
        existing.unread = true;
      }
    }

    const archiveFilter = options.archived || "false";
    return Array.from(conversations.values()).filter((conversation) => {
      if (archiveFilter === "with") return true;
      if (archiveFilter === "true" || archiveFilter === "only") {
        return conversation.archived;
      }
      return !conversation.archived;
    });
  }

  // Return the full thread for one contact so the inbox detail view can render real history.
  async getConversation(clinicId: string, contactId: string) {
    const [contactRows]: any = await pool.execute(
      `SELECT c.id,
              c.first_name as firstName,
              c.last_name as lastName,
              c.email,
              c.phone,
              c.status,
              c.source,
              c.created_at as createdAt,
              c.updated_at as updatedAt
       FROM contact c
       WHERE c.id = ?
         AND c.clinic_id = ?
         AND c.deleted_at IS NULL
       LIMIT 1`,
      [contactId, clinicId],
    );

    if (!contactRows[0]) {
      return null;
    }

    const contact = contactRows[0];

    const [messageRows]: any = await pool.execute(
      `SELECT m.id,
              m.channel,
              m.kind,
              m.direction,
              m.status,
              m.subject,
              m.body,
              m.createdAt,
              m.senderName,
              m.senderId,
              m.isInternal
       FROM (
         SELECT e.id,
                'email' as channel,
                'message' as kind,
                e.direction,
                e.status,
                e.subject,
                e.body,
                e.created_at as createdAt,
                TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) as senderName,
                e.user_id as senderId,
                0 as isInternal
         FROM email e
         LEFT JOIN user u ON u.id = e.user_id AND u.deleted_at IS NULL
         WHERE e.clinic_id = ?
           AND e.contact_id = ?
           AND e.deleted_at IS NULL

         UNION ALL

         SELECT s.id,
                'sms' as channel,
                'message' as kind,
                s.direction,
                s.status,
                NULL as subject,
                s.message as body,
                s.created_at as createdAt,
                TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) as senderName,
                s.user_id as senderId,
                0 as isInternal
         FROM sms s
         LEFT JOIN user u ON u.id = s.user_id AND u.deleted_at IS NULL
         WHERE s.clinic_id = ?
           AND s.contact_id = ?
           AND s.deleted_at IS NULL

         UNION ALL

         SELECT wm.id,
                'whatsapp' as channel,
                'message' as kind,
                wm.direction,
                wm.status,
                NULL as subject,
                wm.body as body,
                wm.created_at as createdAt,
                TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) as senderName,
                wm.user_id as senderId,
                0 as isInternal
         FROM whatsapp_message wm
         LEFT JOIN user u ON u.id = wm.user_id AND u.deleted_at IS NULL
         WHERE wm.clinic_id = ?
           AND wm.contact_id = ?
           AND wm.deleted_at IS NULL

         UNION ALL

         SELECT a.id,
                'note' as channel,
                'note' as kind,
                'internal' as direction,
                'visible' as status,
                NULL as subject,
                a.metadata as body,
                a.created_at as createdAt,
                TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) as senderName,
                a.user_id as senderId,
                1 as isInternal
         FROM activity a
         LEFT JOIN user u ON u.id = a.user_id AND u.deleted_at IS NULL
         WHERE a.clinic_id = ?
           AND a.contact_id = ?
           AND a.deleted_at IS NULL
           AND a.type = 'Note'
       ) m
       ORDER BY m.createdAt ASC`,
      [clinicId, contactId, clinicId, contactId, clinicId, contactId, clinicId, contactId],
    );

    const messages = messageRows
      .filter((row: any) => row.kind === "message")
      .map((row: any) => ({
        id: row.id,
        channel: row.channel,
        direction: row.direction || null,
        status: row.status || null,
        subject: row.subject || null,
        body: row.body || "",
        timestamp: new Date(row.createdAt).toISOString(),
        sender: row.senderName || (row.direction === "inbound" ? formatName(contact.firstName, contact.lastName) : "Clinic"),
        senderId: row.senderId || null,
        isInternal: false,
      }));

    const internalNotes = messageRows
      .filter((row: any) => row.kind === "note")
      .map((row: any) => {
        let noteText: string | null = null;
        try {
          const metadata = row.body ? JSON.parse(row.body) : null;
          noteText = metadata?.content || metadata?.note || metadata?.message || metadata?.notes || metadata?.title || metadata?.action || null;
        } catch {
          noteText = null;
        }

        return {
          id: row.id,
          channel: row.channel,
          direction: row.direction,
          status: row.status,
          body: noteText || "Internal note",
          timestamp: new Date(row.createdAt).toISOString(),
          sender: row.senderName || "Clinic",
          senderId: row.senderId || null,
          isInternal: true,
        };
      });

    return {
      contact: {
        id: contact.id,
        name: formatName(contact.firstName, contact.lastName) || contact.email || contact.phone || "Unknown",
        firstName: contact.firstName || null,
        lastName: contact.lastName || null,
        email: contact.email || null,
        phone: contact.phone || null,
        status: contact.status || null,
        source: contact.source || null,
        createdAt: new Date(contact.createdAt).toISOString(),
        updatedAt: new Date(contact.updatedAt).toISOString(),
      },
      messages,
      internalNotes,
      counts: {
        messages: messages.length,
        internalNotes: internalNotes.length,
      },
    };
  }

  // Persist an outbound inbox reply as an email or SMS record for the contact.
  async sendMessage(
    clinicId: string,
    userId: string,
    contactId: string,
    data: { channel?: "email" | "sms"; body: string; subject?: string | null },
  ) {
    const [contactRows]: any = await pool.execute(
      `SELECT id, first_name as firstName, last_name as lastName, email, phone
       FROM contact
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [contactId, clinicId],
    );

    const contact = contactRows[0];
    if (!contact) throw ApiError.notFound("Conversation not found");

    const channel = data.channel === "sms" ? "sms" : "email";
    const id = uuidv4();
    const body = data.body.trim();
    const now = new Date().toISOString();

    if (channel === "sms") {
      await pool.execute(
        `INSERT INTO sms (id, clinic_id, contact_id, user_id, message, direction, status)
         VALUES (?, ?, ?, ?, ?, 'outbound', 'sent')`,
        [id, clinicId, contactId, userId || null, body],
      );
    } else {
      await pool.execute(
        `INSERT INTO email (id, clinic_id, contact_id, user_id, subject, body, direction, status)
         VALUES (?, ?, ?, ?, ?, ?, 'outbound', 'sent')`,
        [id, clinicId, contactId, userId || null, data.subject || null, body],
      );
    }

    await logTimelineActivity({
      clinicId,
      contactId,
      userId,
      type: channel === "sms" ? "SMS" : "Email",
      metadata: buildTimelineMetadata({
        action: "inbox.reply_sent",
        source: "contact",
        recordId: id,
        changes: { channel },
      }),
    });

    await logAuditEvent({
      clinicId,
      userId,
      action: "INBOX_MESSAGE_SENT",
      entityType: channel,
      entityId: id,
      changes: { contactId, channel },
    });

    return {
      id,
      channel,
      direction: "outbound",
      status: "sent",
      subject: channel === "email" ? data.subject || null : null,
      body,
      timestamp: now,
      sender: "Clinic",
      senderId: userId || null,
      isInternal: false,
    };
  }

  async markAllRead(clinicId: string, userId: string) {
    await pool.execute(
      `UPDATE email
       SET status = 'read',
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND direction = 'inbound'
         AND deleted_at IS NULL
         AND (status IS NULL OR status <> 'read')`,
      [clinicId],
    );

    await pool.execute(
      `UPDATE sms
       SET status = 'read',
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND direction = 'inbound'
         AND deleted_at IS NULL
         AND (status IS NULL OR status <> 'read')`,
      [clinicId],
    );

    await pool.execute(
      `UPDATE whatsapp_message
       SET status = 'read',
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND direction = 'inbound'
         AND deleted_at IS NULL
         AND status IN ('received', 'human_required')`,
      [clinicId],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "INBOX_MARK_ALL_READ",
      entityType: "comms_conversation",
      entityId: clinicId,
      changes: { unread: false },
    });

    return { unread: false };
  }

  async updateReadState(
    clinicId: string,
    userId: string,
    contactId: string,
    unread: boolean,
  ) {
    await this.ensureConversationContact(clinicId, contactId);
    const status = unread ? "unread" : "read";

    await pool.execute(
      `UPDATE email
       SET status = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND contact_id = ?
         AND direction = 'inbound'
         AND deleted_at IS NULL`,
      [status, clinicId, contactId],
    );

    await pool.execute(
      `UPDATE sms
       SET status = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND contact_id = ?
         AND direction = 'inbound'
         AND deleted_at IS NULL`,
      [status, clinicId, contactId],
    );

    await pool.execute(
      `UPDATE whatsapp_message
       SET status = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND contact_id = ?
         AND direction = 'inbound'
         AND deleted_at IS NULL`,
      [unread ? "received" : "read", clinicId, contactId],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: unread ? "INBOX_MARK_UNREAD" : "INBOX_MARK_READ",
      entityType: "comms_conversation",
      entityId: contactId,
      changes: { unread },
    });

    return this.getInboxConversation(clinicId, contactId);
  }

  async updateStarState(
    clinicId: string,
    userId: string,
    contactId: string,
    starred: boolean,
  ) {
    await this.ensureConversationContact(clinicId, contactId);
    await this.upsertConversationState(clinicId, userId, contactId, { starred });

    await logAuditEvent({
      clinicId,
      userId,
      action: starred ? "INBOX_CONVERSATION_STARRED" : "INBOX_CONVERSATION_UNSTARRED",
      entityType: "comms_conversation",
      entityId: contactId,
      changes: { starred },
    });

    return this.getInboxConversation(clinicId, contactId, { archived: "with" });
  }

  async updateArchiveState(
    clinicId: string,
    userId: string,
    contactId: string,
    archived: boolean,
  ) {
    await this.ensureConversationContact(clinicId, contactId);
    await this.upsertConversationState(clinicId, userId, contactId, { archived });

    await logAuditEvent({
      clinicId,
      userId,
      action: archived ? "INBOX_CONVERSATION_ARCHIVED" : "INBOX_CONVERSATION_UNARCHIVED",
      entityType: "comms_conversation",
      entityId: contactId,
      changes: { archived },
    });

    return this.getInboxConversation(clinicId, contactId, { archived: "with" });
  }

  private async ensureConversationContact(clinicId: string, contactId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM contact
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [contactId, clinicId],
    );

    if (!rows[0]) throw ApiError.notFound("Conversation not found");
  }

  private async getInboxConversation(
    clinicId: string,
    contactId: string,
    options: { archived?: InboxArchiveFilter } = {},
  ) {
    const conversations = await this.listInbox(clinicId, {
      archived: options.archived || "with",
    });
    const conversation = conversations.find((row: any) => row.contactId === contactId);
    if (!conversation) throw ApiError.notFound("Conversation not found");
    return conversation;
  }

  private async getConversationStates(clinicId: string, contactIds: string[]) {
    const states = new Map<string, { starred: number; archivedAt: string | null }>();
    if (contactIds.length === 0) return states;

    const placeholders = contactIds.map(() => "?").join(", ");
    const [rows]: any = await pool.execute(
      `SELECT contact_id as contactId,
              starred,
              archived_at as archivedAt
       FROM comms_conversation_state
       WHERE clinic_id = ?
         AND contact_id IN (${placeholders})`,
      [clinicId, ...contactIds],
    );

    for (const row of rows) {
      states.set(row.contactId, {
        starred: Number(row.starred || 0),
        archivedAt: row.archivedAt || null,
      });
    }

    return states;
  }

  private async upsertConversationState(
    clinicId: string,
    userId: string,
    contactId: string,
    changes: { starred?: boolean; archived?: boolean },
  ) {
    const id = uuidv4();
    const starredValue = changes.starred === undefined ? 0 : changes.starred ? 1 : 0;
    const archivedSql =
      changes.archived === undefined
        ? "NULL"
        : changes.archived
          ? "CURRENT_TIMESTAMP"
          : "NULL";

    const updateParts = ["updated_by = VALUES(updated_by)"];
    if (changes.starred !== undefined) updateParts.push("starred = VALUES(starred)");
    if (changes.archived !== undefined) updateParts.push(`archived_at = ${archivedSql}`);

    await pool.execute(
      `INSERT INTO comms_conversation_state
        (id, clinic_id, contact_id, starred, archived_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ${archivedSql}, ?, ?)
       ON DUPLICATE KEY UPDATE
         ${updateParts.join(", ")},
         updated_at = CURRENT_TIMESTAMP`,
      [id, clinicId, contactId, starredValue, userId || null, userId || null],
    );
  }
}

export const commsService = new CommsService();
