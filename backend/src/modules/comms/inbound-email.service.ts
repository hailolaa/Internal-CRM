import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import { buildTimelineMetadata, logTimelineActivity } from "../../utils/activity.js";
import { logAuditEvent } from "../../utils/audit.js";

interface ParsedAddress {
  email: string;
  name: string | null;
}

interface ParsedInboundEmail {
  providerMessageId: string | null;
  inReplyTo: string | null;
  references: string[];
  from: ParsedAddress;
  to: ParsedAddress[];
  subject: string | null;
  body: string;
  receivedAt: Date;
}

function cleanString(value: unknown) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function normalizeEmail(value: unknown) {
  return cleanString(value)?.toLowerCase() || null;
}

function normalizeMessageId(value: unknown) {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  return cleaned.replace(/^<|>$/g, "").trim() || null;
}

function parseMessageIds(value: unknown) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map(normalizeMessageId).filter(Boolean))) as string[];
  }
  const raw = cleanString(value);
  if (!raw) return [];
  const bracketed = Array.from(raw.matchAll(/<([^>]+)>/g), (match) => normalizeMessageId(match[1])).filter(Boolean);
  const values = bracketed.length > 0 ? bracketed : raw.split(/\s+/).map(normalizeMessageId).filter(Boolean);
  return Array.from(new Set(values)) as string[];
}

function parseAddress(value: unknown): ParsedAddress | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    return parseAddress(value[0]);
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const email = normalizeEmail(record.email || record.address || record.Email || record.Address);
    if (!email) return null;
    return {
      email,
      name: cleanString(record.name || record.Name || record.displayName || record.DisplayName),
    };
  }

  const raw = String(value).trim();
  const match = raw.match(/^\s*(?:"?([^"<]*)"?)?\s*<([^>]+)>\s*$/);
  if (match?.[2]) {
    return {
      email: normalizeEmail(match[2]) || "",
      name: cleanString(match[1]),
    };
  }

  const emailMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = normalizeEmail(emailMatch?.[0] || raw);
  if (!email) return null;
  return { email, name: null };
}

function parseAddressList(value: unknown): ParsedAddress[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(parseAddress).filter(Boolean) as ParsedAddress[];
  }

  return String(value)
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map(parseAddress)
    .filter(Boolean) as ParsedAddress[];
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitName(name: string | null, email: string) {
  const fallback = email.split("@")[0]?.replace(/[._-]+/g, " ") || "Email";
  const cleaned = cleanString(name) || fallback;
  const [firstName, ...rest] = cleaned.split(/\s+/);
  return {
    firstName: firstName || "Email",
    lastName: rest.join(" ") || null,
  };
}

function parseDate(value: unknown) {
  const parsed = value ? new Date(String(value)) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function parseInboundPayload(body: Record<string, unknown>): ParsedInboundEmail {
  const from = parseAddress(
    body.from ||
      body.From ||
      body.sender ||
      body.Sender ||
      body.envelopeSender ||
      body.envelope_sender,
  );
  const to = parseAddressList(
    body.to ||
      body.To ||
      body.Recipients ||
      body.recipients ||
      body.recipient ||
      body.Recipient ||
      body.envelopeTo ||
      body.envelope_to,
  );

  if (!from?.email) throw ApiError.badRequest("Inbound email sender is required");
  if (to.length === 0) throw ApiError.badRequest("Inbound email recipient is required");

  const textBody = cleanString(
    body.text ||
      body.Text ||
      body.textBody ||
      body.TextBody ||
      body.RawTextBody ||
      body.ExtractedMarkdownMessage ||
      body["text/plain"],
  );
  const htmlBody = cleanString(
    body.html ||
      body.Html ||
      body.htmlBody ||
      body.HtmlBody ||
      body.RawHtmlBody ||
      body["text/html"],
  );
  const bodyText = textBody || (htmlBody ? stripHtml(htmlBody) : "");
  if (!bodyText) throw ApiError.badRequest("Inbound email body is required");

  return {
    providerMessageId: normalizeMessageId(
      body.providerMessageId ||
        body.messageId ||
        body.MessageId ||
        body.MessageID ||
        body["message-id"] ||
        body.MessageID,
    ),
    inReplyTo: normalizeMessageId(body.inReplyTo || body.InReplyTo || body["in-reply-to"]),
    references: parseMessageIds(body.references || body.References),
    from,
    to,
    subject: cleanString(body.subject || body.Subject),
    body: bodyText,
    receivedAt: parseDate(body.receivedAt || body.SentAtDate || body.date || body.Date || body.timestamp || body.Timestamp),
  };
}

function mysqlDate(value: Date) {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

export class InboundEmailService {
  resolveWorkspaceId(payload: ParsedInboundEmail, workspaceMap: Record<string, string>, defaultWorkspaceId: string) {
    for (const recipient of payload.to) {
      const mapped = workspaceMap[recipient.email] || workspaceMap[recipient.email.toLowerCase()];
      if (mapped) return mapped;
    }

    if (defaultWorkspaceId) return defaultWorkspaceId;
    throw ApiError.forbidden("Inbound email recipient is not mapped to an internal workspace");
  }

  parsePayload(body: Record<string, unknown>) {
    return parseInboundPayload(body);
  }

  parsePayloads(body: Record<string, unknown>) {
    if (Array.isArray(body.items)) {
      return body.items.map((item) => parseInboundPayload(item as Record<string, unknown>));
    }

    return [parseInboundPayload(body)];
  }

  async ingest(
    clinicId: string,
    payload: ParsedInboundEmail,
  ) {
    const firstRecipient = payload.to[0]!;
    if (payload.providerMessageId) {
      const [existingRows]: any = await pool.execute(
        `SELECT id, contact_id as contactId, COALESCE(thread_id, id) as threadId
         FROM email
         WHERE clinic_id = ?
           AND provider_message_id = ?
           AND deleted_at IS NULL
         LIMIT 1`,
        [clinicId, payload.providerMessageId],
      );
      if (existingRows[0]) {
        return {
          emailId: existingRows[0].id,
          contactId: existingRows[0].contactId,
          threadId: existingRows[0].threadId,
          duplicate: true,
        };
      }
    }

    const contactId = await this.findOrCreateContact(clinicId, payload.from);
    const emailId = uuidv4();
    const threadId = await this.resolveThreadId(clinicId, contactId, payload);
    const receivedAt = mysqlDate(payload.receivedAt);

    try {
      await pool.execute(
        `INSERT INTO email
          (id, provider_message_id, thread_id, in_reply_to, reference_ids,
           clinic_id, contact_id, user_id, from_email, to_email,
           subject, body, direction, status, received_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 'inbound', 'unread', ?, ?, ?)`,
        [
          emailId,
          payload.providerMessageId,
          threadId,
          payload.inReplyTo,
          JSON.stringify(payload.references),
          clinicId,
          contactId,
          payload.from.email,
          firstRecipient.email,
          payload.subject,
          payload.body,
          receivedAt,
          receivedAt,
          receivedAt,
        ],
      );
    } catch (error) {
      if ((error as { code?: string }).code !== "ER_DUP_ENTRY" || !payload.providerMessageId) throw error;
      const [duplicateRows]: any = await pool.execute(
        `SELECT id, contact_id as contactId, COALESCE(thread_id, id) as threadId
         FROM email
         WHERE clinic_id = ? AND provider_message_id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [clinicId, payload.providerMessageId],
      );
      if (!duplicateRows[0]) throw error;
      return {
        emailId: duplicateRows[0].id,
        contactId: duplicateRows[0].contactId,
        threadId: duplicateRows[0].threadId,
        duplicate: true,
      };
    }

    await logTimelineActivity({
      clinicId,
      contactId,
      type: "Email",
      timestamp: payload.receivedAt,
      metadata: buildTimelineMetadata({
        action: "inbound_email_received",
        source: "contact",
        recordId: emailId,
        title: payload.subject || "Inbound email received",
        status: "unread",
        changes: {
          from: payload.from.email,
          to: firstRecipient.email,
          subject: payload.subject,
          providerMessageId: payload.providerMessageId,
          threadId,
          inReplyTo: payload.inReplyTo,
        },
      }),
    });

    await logAuditEvent({
      clinicId,
      userId: null,
      action: "INBOUND_EMAIL_RECEIVED",
      entityType: "email",
      entityId: emailId,
      changes: {
        contactId,
        from: payload.from.email,
        to: firstRecipient.email,
        providerMessageId: payload.providerMessageId,
        threadId,
        inReplyTo: payload.inReplyTo,
      },
    });

    return {
      emailId,
      contactId,
      threadId,
      duplicate: false,
    };
  }

  async handleDeliveryEvent(body: Record<string, unknown>) {
    const providerMessageId = normalizeMessageId(
      body.providerMessageId || body.messageId || body["message-id"] || body["message_id"],
    );
    if (!providerMessageId) throw ApiError.badRequest("Email delivery event message ID is required");

    const event = (cleanString(body.event || body.type || body.Event) || "").toLowerCase().replace(/[\s-]+/g, "_");
    const bounceEvents = new Set(["bounce", "bounced", "hard_bounce", "soft_bounce", "blocked", "invalid"]);
    if (!bounceEvents.has(event)) {
      return { providerMessageId, ignored: true, duplicate: false };
    }

    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, contact_id as contactId, status
       FROM email
       WHERE provider_message_id = ?
         AND direction = 'outbound'
         AND deleted_at IS NULL
       LIMIT 1`,
      [providerMessageId],
    );
    const email = rows[0];
    if (!email) throw ApiError.notFound("Outbound email delivery record not found");
    if (email.status === "bounced") {
      return { emailId: email.id, providerMessageId, ignored: false, duplicate: true };
    }

    const reason = cleanString(body.reason || body.description || body.message || body.response) || event;
    await pool.execute(
      `UPDATE email
       SET status = 'bounced', bounced_at = CURRENT_TIMESTAMP, bounce_reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ?`,
      [reason.slice(0, 1000), email.id, email.clinicId],
    );

    await logTimelineActivity({
      clinicId: email.clinicId,
      contactId: email.contactId,
      type: "Email",
      metadata: buildTimelineMetadata({
        action: "outbound_email_bounced",
        source: "contact",
        recordId: email.id,
        status: "bounced",
        changes: { providerMessageId, reason },
      }),
    });
    await logAuditEvent({
      clinicId: email.clinicId,
      userId: null,
      action: "OUTBOUND_EMAIL_BOUNCED",
      entityType: "email",
      entityId: email.id,
      changes: { contactId: email.contactId, providerMessageId, reason },
    });

    return { emailId: email.id, providerMessageId, ignored: false, duplicate: false };
  }

  private async resolveThreadId(
    clinicId: string,
    contactId: string,
    payload: ParsedInboundEmail,
  ) {
    const replyIds = Array.from(new Set([payload.inReplyTo, ...payload.references].filter(Boolean))) as string[];
    if (replyIds.length > 0) {
      const placeholders = replyIds.map(() => "?").join(", ");
      const [rows]: any = await pool.execute(
        `SELECT COALESCE(thread_id, id) as threadId
         FROM email
         WHERE clinic_id = ?
           AND provider_message_id IN (${placeholders})
           AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        [clinicId, ...replyIds],
      );
      if (rows[0]?.threadId) return rows[0].threadId as string;
    }

    const normalizedSubject = (payload.subject || "").replace(/^\s*(re|fw|fwd):\s*/i, "").trim();
    if (normalizedSubject) {
      const [rows]: any = await pool.execute(
        `SELECT COALESCE(thread_id, id) as threadId
         FROM email
         WHERE clinic_id = ?
           AND contact_id = ?
           AND LOWER(TRIM(REGEXP_REPLACE(COALESCE(subject, ''), '^(re|fw|fwd):[[:space:]]*', ''))) = LOWER(?)
           AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        [clinicId, contactId, normalizedSubject],
      );
      if (rows[0]?.threadId) return rows[0].threadId as string;
    }

    return uuidv4();
  }

  private async findOrCreateContact(clinicId: string, from: ParsedAddress) {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM contact
       WHERE clinic_id = ?
         AND LOWER(TRIM(email)) = ?
         AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
      [clinicId, from.email],
    );

    if (rows[0]) return rows[0].id as string;

    const contactId = uuidv4();
    const { firstName, lastName } = splitName(from.name, from.email);
    await pool.execute(
      `INSERT INTO contact
        (id, clinic_id, first_name, last_name, email, communication_permissions,
         email_permission, status, lead_status, source, tags, treatment_interests,
         notes, last_contact_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, 'lead', 'new', 'email', ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        contactId,
        clinicId,
        firstName,
        lastName,
        from.email,
        JSON.stringify({ email: true, sms: false, whatsapp: false, phone: false }),
        JSON.stringify(["email-inbound"]),
        JSON.stringify([]),
        "Created automatically from inbound email.",
      ],
    );

    await logTimelineActivity({
      clinicId,
      contactId,
      type: "Note",
      metadata: buildTimelineMetadata({
        action: "lead_created_from_inbound_email",
        source: "contact",
        recordId: contactId,
        title: "Lead created from inbound email",
        changes: { from: from.email },
      }),
    });

    return contactId;
  }
}

export const inboundEmailService = new InboundEmailService();
