import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { buildTimelineMetadata, logTimelineActivity } from "../../utils/activity.js";
import { logAuditEvent } from "../../utils/audit.js";
import logger from "../../utils/logger.js";
import { cleanString, normalizePhone } from "../contacts/contacts.normalizers.js";
import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import type {
  WhatsAppAiSettingsDTO,
  WhatsAppApproveDTO,
  WhatsAppDraftDTO,
  WhatsAppInboundDTO,
  WhatsAppManualSendDTO,
  WhatsAppRetryDTO,
} from "./whatsapp-ai.types.js";

const defaultGuardrails = [
  "Do not make clinical, legal, financial or guaranteed outcome claims.",
  "Do not discuss sensitive personal details over WhatsApp.",
  "Ask one clear next-step question when more context is needed.",
  "Route opt-outs, complaints and low-confidence cases to a human.",
];

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
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

function toIso(value: unknown) {
  return value ? new Date(value as string).toISOString() : null;
}

function toMysqlDateTime(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

function normalizeTime(value: unknown, fallback: string) {
  const cleaned = cleanString(value);
  if (!cleaned) return fallback;
  const match = cleaned.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  return match ? `${match[1]}:${match[2]}:${match[3] || "00"}` : fallback;
}

function isWithinBusinessHours(settings: any, date = new Date()) {
  if (!settings.businessHoursEnabled) return true;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: settings.timezone || "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const current = formatter.format(date);
  const start = String(settings.businessHoursStart || "09:00:00").slice(0, 5);
  const end = String(settings.businessHoursEnd || "17:30:00").slice(0, 5);
  return current >= start && current <= end;
}

function detectGuardrail(body: string) {
  const text = body.toLowerCase();
  if (/\b(stop|unsubscribe|opt out|do not contact|don't contact|remove me)\b/.test(text)) {
    return { reason: "opt_out", confidence: 0.99 };
  }
  if (/\b(complaint|angry|lawyer|solicitor|legal|refund|chargeback|gdpr|delete my data)\b/.test(text)) {
    return { reason: "sensitive_request", confidence: 0.92 };
  }
  if (/\b(diagnosis|medical|medicine|prescription|patient|symptom|clinical|emergency)\b/.test(text)) {
    return { reason: "sensitive_request", confidence: 0.9 };
  }
  return null;
}

function confidenceFor(body: string) {
  const text = body.trim();
  let confidence = 0.78;
  if (text.length < 12) confidence -= 0.2;
  if (text.includes("?")) confidence += 0.05;
  if (/\b(price|cost|package|website|seo|ads|tracking|report|call|book)\b/i.test(text)) confidence += 0.08;
  if (/\b(not sure|maybe|confused|urgent|asap)\b/i.test(text)) confidence -= 0.08;
  return Math.max(0.2, Math.min(0.95, Number(confidence.toFixed(2))));
}

function chooseDraftVariant(variants: string[], seed: string) {
  const hash = crypto.createHash("sha256").update(seed).digest();
  return variants[(hash[0] ?? 0) % variants.length];
}

function deterministicDraft(input: {
  contactName: string;
  accountName?: string | null;
  inboundBody: string;
  tone: string;
}) {
  const body = input.inboundBody.toLowerCase();
  const greeting = input.contactName && input.contactName !== "there" ? `Hi ${input.contactName},` : "Hi,";
  const seed = `${input.contactName}|${input.accountName || ""}|${input.inboundBody}|${Date.now().toString().slice(0, 10)}`;
  if (/\b(price|cost|package|proposal)\b/.test(body)) {
    return chooseDraftVariant([
      `${greeting} thanks for reaching out. I can help with package options, but the best next step is a quick discovery call so we can understand your goals and recommend the right route. Would you like us to send a couple of available times?`,
      `${greeting} happy to help with package options. To point you toward the right fit, could we first book a short discovery call and learn what you want to improve?`,
      `${greeting} thanks for asking. We can walk you through the options, but it is best to understand your goals first. Would you like me to arrange a quick call?`,
    ], seed);
  }
  if (/\b(book|call|meeting|available|schedule)\b/.test(body)) {
    return chooseDraftVariant([
      `${greeting} absolutely. We can get a discovery call arranged. What day or time usually works best for you?`,
      `${greeting} yes, we can help set that up. Do you have a preferred day or time for a quick discovery call?`,
      `${greeting} sure. Send over a couple of times that work for you and we will help get the call arranged.`,
    ], seed);
  }
  if (/\b(website|seo|ads|tracking|report)\b/.test(body)) {
    return chooseDraftVariant([
      `${greeting} thanks for the message. That sounds like something our team can review with you. Could you share your website and the main outcome you want help with first?`,
      `${greeting} thanks, that is in our wheelhouse. Could you send your website and tell us whether SEO, ads, tracking, or reporting is the priority right now?`,
      `${greeting} we can take a look. Please share your website and the result you most want to improve, and we will route this to the right person.`,
    ], seed);
  }
  return chooseDraftVariant([
    `${greeting} thanks for messaging. I can help route this to the right person. Could you share a little more about what you need help with?`,
    `${greeting} thanks for reaching out. Could you send a bit more context so we can point you to the right next step?`,
    `${greeting} appreciate the message. What are you looking for help with at the moment?`,
  ], seed);
}

function extractOpenAIText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  return (payload?.output || [])
    .flatMap((item: any) => item.content || [])
    .map((content: any) => content.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function mapSettings(row: any) {
  return {
    id: row.id,
    clinicId: row.clinicId,
    autoSendEnabled: Boolean(row.autoSendEnabled),
    businessHoursEnabled: Boolean(row.businessHoursEnabled),
    businessHoursStart: String(row.businessHoursStart || "09:00:00"),
    businessHoursEnd: String(row.businessHoursEnd || "17:30:00"),
    timezone: row.timezone || "Europe/London",
    approvedTone: row.approvedTone || "Warm, concise, helpful and professional. No clinical claims or guarantees.",
    guardrails: parseJsonArray(row.guardrails).length ? parseJsonArray(row.guardrails) : defaultGuardrails,
    confidenceThreshold: Number(row.confidenceThreshold || 0.72),
    humanHandoffUserId: row.humanHandoffUserId || null,
    maxAutoSendRetries: Number(row.maxAutoSendRetries || 2),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function mapMessage(row: any) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    contactId: row.contactId,
    direction: row.direction,
    body: row.body,
    status: row.status,
    providerMessageId: row.providerMessageId || null,
    idempotencyKey: row.idempotencyKey || null,
    failureReason: row.failureReason || null,
    metadata: parseJsonObject(row.metadata),
    receivedAt: toIso(row.receivedAt),
    sentAt: toIso(row.sentAt),
    createdAt: toIso(row.createdAt),
  };
}

function isDuplicateKeyError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  return code === "ER_DUP_ENTRY" || code === "ER_DUP_KEY";
}

function isRetrySafeFailure(message: any) {
  if (!message || message.status !== "failed") return false;
  const metadata = parseJsonObject(message.metadata);
  return metadata?.retrySafe !== false;
}

function idempotencyLockName(idempotencyKey: string) {
  return `whatsapp:${crypto.createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 48)}`;
}

const inFlightReplySends = new Set<string>();

function mapReply(row: any) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    contactId: row.contactId,
    inboundMessageId: row.inboundMessageId,
    responsibleUserId: row.responsibleUserId || null,
    approvedByUserId: row.approvedByUserId || null,
    outboundMessageId: row.outboundMessageId || null,
    draftBody: row.draftBody || null,
    finalBody: row.finalBody || null,
    aiOutput: parseJsonObject(row.aiOutput),
    confidence: Number(row.confidence || 0),
    provider: row.provider,
    model: row.model || null,
    status: row.status,
    guardrailReason: row.guardrailReason || null,
    autoSendAllowed: Boolean(row.autoSendAllowed),
    autoSendAttempted: Boolean(row.autoSendAttempted),
    sendAttempts: Number(row.sendAttempts || 0),
    failureReason: row.failureReason || null,
    approvedAt: toIso(row.approvedAt),
    sentAt: toIso(row.sentAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export class WhatsAppAiService {
  async getSettings(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, auto_send_enabled as autoSendEnabled,
              business_hours_enabled as businessHoursEnabled,
              business_hours_start as businessHoursStart,
              business_hours_end as businessHoursEnd,
              timezone, approved_tone as approvedTone, guardrails,
              confidence_threshold as confidenceThreshold,
              human_handoff_user_id as humanHandoffUserId,
              max_auto_send_retries as maxAutoSendRetries,
              created_at as createdAt, updated_at as updatedAt
       FROM whatsapp_ai_setting
       WHERE clinic_id = ?
       LIMIT 1`,
      [clinicId],
    );

    if (rows[0]) return mapSettings(rows[0]);

    return {
      id: null,
      clinicId,
      autoSendEnabled: false,
      businessHoursEnabled: true,
      businessHoursStart: "09:00:00",
      businessHoursEnd: "17:30:00",
      timezone: "Europe/London",
      approvedTone: "Warm, concise, helpful and professional. No clinical claims or guarantees.",
      guardrails: defaultGuardrails,
      confidenceThreshold: 0.72,
      humanHandoffUserId: null,
      maxAutoSendRetries: 2,
      createdAt: null,
      updatedAt: null,
    };
  }

  async updateSettings(clinicId: string, userId: string, data: WhatsAppAiSettingsDTO) {
    const current = await this.getSettings(clinicId);
    const id = current.id || uuidv4();
    const next = {
      autoSendEnabled: data.autoSendEnabled ?? current.autoSendEnabled,
      businessHoursEnabled: data.businessHoursEnabled ?? current.businessHoursEnabled,
      businessHoursStart: normalizeTime(data.businessHoursStart, current.businessHoursStart),
      businessHoursEnd: normalizeTime(data.businessHoursEnd, current.businessHoursEnd),
      timezone: cleanString(data.timezone) || current.timezone,
      approvedTone: cleanString(data.approvedTone) || current.approvedTone,
      guardrails: Array.isArray(data.guardrails) && data.guardrails.length > 0 ? data.guardrails : current.guardrails,
      confidenceThreshold: data.confidenceThreshold ?? current.confidenceThreshold,
      humanHandoffUserId: data.humanHandoffUserId === undefined ? current.humanHandoffUserId : data.humanHandoffUserId || null,
      maxAutoSendRetries: data.maxAutoSendRetries ?? current.maxAutoSendRetries,
    };

    await pool.execute(
      `INSERT INTO whatsapp_ai_setting
        (id, clinic_id, auto_send_enabled, business_hours_enabled, business_hours_start, business_hours_end,
         timezone, approved_tone, guardrails, confidence_threshold, human_handoff_user_id,
         max_auto_send_retries, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         auto_send_enabled = VALUES(auto_send_enabled),
         business_hours_enabled = VALUES(business_hours_enabled),
         business_hours_start = VALUES(business_hours_start),
         business_hours_end = VALUES(business_hours_end),
         timezone = VALUES(timezone),
         approved_tone = VALUES(approved_tone),
         guardrails = VALUES(guardrails),
         confidence_threshold = VALUES(confidence_threshold),
         human_handoff_user_id = VALUES(human_handoff_user_id),
         max_auto_send_retries = VALUES(max_auto_send_retries),
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        clinicId,
        next.autoSendEnabled ? 1 : 0,
        next.businessHoursEnabled ? 1 : 0,
        next.businessHoursStart,
        next.businessHoursEnd,
        next.timezone,
        next.approvedTone,
        JSON.stringify(next.guardrails),
        next.confidenceThreshold,
        next.humanHandoffUserId,
        next.maxAutoSendRetries,
        userId || null,
        userId || null,
      ],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "WHATSAPP_AI_SETTINGS_UPDATED",
      entityType: "whatsapp_ai_setting",
      entityId: id,
      changes: { ...next },
    });

    return this.getSettings(clinicId);
  }

  async ingestInbound(clinicId: string, userId: string | null, data: WhatsAppInboundDTO) {
    const phone = normalizePhone(data.from);
    const body = cleanString(data.body);
    const providerMessageId = cleanString(data.providerMessageId);
    if (!phone) throw ApiError.badRequest("Inbound WhatsApp sender is required");
    if (!body) throw ApiError.badRequest("Inbound WhatsApp message body is required");

    const lockConnection = providerMessageId ? await pool.getConnection() : null;
    const lockName = providerMessageId
      ? idempotencyLockName(`whatsapp-inbound:${clinicId}:${providerMessageId}`)
      : "";
    let lockAcquired = false;

    try {
      if (lockConnection && lockName) {
        const [lockRows]: any = await lockConnection.execute("SELECT GET_LOCK(?, 10) as acquired", [lockName]);
        lockAcquired = Number(lockRows[0]?.acquired || 0) === 1;
        if (!lockAcquired) {
          throw ApiError.serviceUnavailable("WhatsApp inbound message is already being processed; please try again");
        }
      }

      const existing = providerMessageId
        ? await this.findMessageByProviderId(clinicId, providerMessageId)
        : null;
      if (existing) return { message: existing, aiReply: await this.getReplyByInboundMessage(clinicId, existing.id) };

      const contact = await this.findOrCreateContact(clinicId, userId, phone, data);
      const conversation = await this.ensureConversation(clinicId, contact.id, phone, userId);
      const messageId = uuidv4();
      const receivedAt = toMysqlDateTime(data.receivedAt) || new Date().toISOString().slice(0, 19).replace("T", " ");

      try {
        await pool.execute(
          `INSERT INTO whatsapp_message
            (id, clinic_id, conversation_id, contact_id, direction, body, status, provider_message_id, metadata, received_at)
           VALUES (?, ?, ?, ?, 'inbound', ?, 'received', ?, ?, ?)`,
          [
            messageId,
            clinicId,
            conversation.id,
            contact.id,
            body,
            providerMessageId || null,
            JSON.stringify({ source: "whatsapp_inbound", from: data.from }),
            receivedAt,
          ],
        );
      } catch (error) {
        if (!providerMessageId || !isDuplicateKeyError(error)) throw error;
        const existingAfterDuplicate = await this.findMessageByProviderId(clinicId, providerMessageId);
        if (existingAfterDuplicate) {
          return {
            message: existingAfterDuplicate,
            aiReply: await this.getReplyByInboundMessage(clinicId, existingAfterDuplicate.id),
          };
        }
        throw error;
      }

      await this.touchConversation(conversation.id, "open", receivedAt);

      await logTimelineActivity({
        clinicId,
        contactId: contact.id,
        userId: userId || undefined,
        type: "SMS",
        metadata: buildTimelineMetadata({
          action: "whatsapp.inbound_received",
          source: "contact",
          recordId: messageId,
          changes: { providerMessageId: providerMessageId || null },
        }),
      });
      await logAuditEvent({
        clinicId,
        userId,
        action: "WHATSAPP_INBOUND_RECEIVED",
        entityType: "whatsapp_message",
        entityId: messageId,
        changes: { contactId: contact.id, conversationId: conversation.id },
      });

      const aiReply = await this.createDraft(clinicId, userId, { inboundMessageId: messageId });
      return { message: await this.getMessage(clinicId, messageId), aiReply };
    } finally {
      if (lockConnection) {
        if (lockAcquired && lockName) {
          await lockConnection.execute("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => undefined);
        }
        lockConnection.release();
      }
    }
  }

  async createDraft(clinicId: string, userId: string | null, data: WhatsAppDraftDTO) {
    const inbound = await this.getInboundContext(clinicId, data.inboundMessageId);
    const existing = await this.getReplyByInboundMessage(clinicId, inbound.message.id);
    if (existing) return existing;

    const settings = await this.getSettings(clinicId);
    const guardrail = detectGuardrail(inbound.message.body);
    const confidence = guardrail ? guardrail.confidence : confidenceFor(inbound.message.body);
    const withinHours = isWithinBusinessHours(settings);
    const lowConfidence = confidence < settings.confidenceThreshold;
    const humanRequired = Boolean(guardrail || lowConfidence || !withinHours);
    const guardrailReason = guardrail?.reason || (lowConfidence ? "low_confidence" : !withinHours ? "outside_business_hours" : null);

    const generated = humanRequired && guardrail?.reason === "opt_out"
      ? {
          provider: "deterministic",
          model: null,
          body: "Understood. We will stop WhatsApp follow-up and have a team member review this request.",
          aiOutput: { classification: "opt_out", handoffRequired: true },
        }
      : await this.generateReplyWithFallback(inbound, settings);

    const replyId = uuidv4();
    const draftBody = cleanString(generated.body) || deterministicDraft({
      contactName: inbound.contact.firstName || inbound.contact.name || "there",
      accountName: inbound.contact.accountName,
      inboundBody: inbound.message.body,
      tone: settings.approvedTone,
    });
    const aiOutput = generated.aiOutput && typeof generated.aiOutput === "object" ? generated.aiOutput : {};
    const autoSendAllowed = Boolean(settings.autoSendEnabled && !humanRequired && withinHours && confidence >= settings.confidenceThreshold);
    const status = humanRequired ? "human_required" : autoSendAllowed ? "drafted" : "needs_approval";
    await pool.execute(
      `INSERT INTO whatsapp_ai_reply
        (id, clinic_id, conversation_id, contact_id, inbound_message_id, responsible_user_id,
         drafted_by_user_id, draft_body, ai_output, confidence, provider, model, status,
         guardrail_reason, auto_send_allowed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        replyId,
        clinicId,
        inbound.conversation.id,
        inbound.contact.id,
        inbound.message.id,
        settings.humanHandoffUserId || null,
        userId || null,
        draftBody,
        JSON.stringify({
          ...aiOutput,
          guardrails: Array.isArray(settings.guardrails) ? settings.guardrails : defaultGuardrails,
          businessHours: { withinHours, timezone: settings.timezone || "Europe/London" },
        }),
        confidence,
        generated.provider || "deterministic",
        generated.model || null,
        status,
        guardrailReason || null,
        autoSendAllowed ? 1 : 0,
      ],
    );

    await this.touchConversation(inbound.conversation.id, humanRequired ? "human_required" : "open");
    await logAuditEvent({
      clinicId,
      userId,
      action: "WHATSAPP_AI_REPLY_DRAFTED",
      entityType: "whatsapp_ai_reply",
      entityId: replyId,
      changes: { status, confidence, guardrailReason, autoSendAllowed },
    });

    let reply = await this.getReply(clinicId, replyId);
    if (autoSendAllowed) {
      reply = await this.sendReply(clinicId, userId, replyId, { body: draftBody || null, sendNow: true }, true);
    }
    return reply;
  }

  async approveReply(clinicId: string, userId: string, replyId: string, data: WhatsAppApproveDTO) {
    const reply = await this.getReply(clinicId, replyId);
    if (reply.status === "sent" || reply.status === "auto_sent") return reply;
    const finalBody = cleanString(data.body) || reply.draftBody;
    if (!finalBody) throw ApiError.badRequest("Reply body is required before approval");

    const [approvalResult]: any = await pool.execute(
      `UPDATE whatsapp_ai_reply
       SET approved_by_user_id = ?, final_body = ?, status = ?,
           approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
         AND status IN ('needs_approval', 'human_required', 'failed')
         AND outbound_message_id IS NULL`,
      [userId, finalBody, data.sendNow === false ? "needs_approval" : "drafted", replyId, clinicId],
    );
    if (Number(approvalResult.affectedRows || 0) === 0) {
      return this.getReply(clinicId, replyId);
    }
    await logAuditEvent({
      clinicId,
      userId,
      action: "WHATSAPP_AI_REPLY_APPROVED",
      entityType: "whatsapp_ai_reply",
      entityId: replyId,
      changes: { sendNow: data.sendNow !== false },
    });

    if (data.sendNow === false) return this.getReply(clinicId, replyId);
    return this.sendReply(clinicId, userId, replyId, { body: finalBody, sendNow: true }, false);
  }

  async retryReply(clinicId: string, userId: string, replyId: string, data: WhatsAppRetryDTO = {}) {
    const reply = await this.getReply(clinicId, replyId);
    const settings = await this.getSettings(clinicId);
    if (reply.status !== "failed") throw ApiError.badRequest("Only failed WhatsApp replies can be retried");
    if (reply.sendAttempts >= settings.maxAutoSendRetries + 1) {
      throw ApiError.badRequest("Maximum WhatsApp retry attempts reached");
    }
    return this.sendReply(clinicId, userId, replyId, { body: data.body || reply.finalBody || reply.draftBody, sendNow: true }, false);
  }

  async sendManualMessage(clinicId: string, userId: string | null, contactId: string, data: WhatsAppManualSendDTO) {
    const body = cleanString(data.body);
    if (!body) throw ApiError.badRequest("WhatsApp message body is required");

    const [contactRows]: any = await pool.execute(
      `SELECT id, phone
       FROM contact
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [contactId, clinicId],
    );
    const contact = contactRows[0];
    if (!contact) throw ApiError.notFound("Contact not found");

    const phone = normalizePhone(contact.phone);
    if (!phone) throw ApiError.badRequest("Contact must have a WhatsApp-capable phone number");

    const conversation = await this.ensureConversation(clinicId, contactId, phone, userId);
    const idempotencyKey = cleanString(data.idempotencyKey) || `whatsapp-manual:${uuidv4()}`;

    return this.sendWhatsAppMessage({
      clinicId,
      conversationId: conversation.id,
      contactId,
      userId,
      body,
      idempotencyKey,
      timelineAction: "whatsapp.manual_message_sent",
    });
  }

  async listConversation(clinicId: string, contactId: string) {
    const [conversationRows]: any = await pool.execute(
      `SELECT id, contact_id as contactId, whatsapp_number as whatsappNumber, owner_user_id as ownerUserId,
              status, last_message_at as lastMessageAt, created_at as createdAt, updated_at as updatedAt
       FROM whatsapp_conversation
       WHERE clinic_id = ? AND contact_id = ? AND deleted_at IS NULL
       ORDER BY last_message_at DESC, created_at DESC
       LIMIT 1`,
      [clinicId, contactId],
    );
    const conversation = conversationRows[0];
    if (!conversation) return null;

    const [messageRows]: any = await pool.execute(
      `SELECT id, conversation_id as conversationId, contact_id as contactId, direction, body, status,
              provider_message_id as providerMessageId, idempotency_key as idempotencyKey,
              failure_reason as failureReason, metadata, received_at as receivedAt, sent_at as sentAt,
              created_at as createdAt
       FROM whatsapp_message
       WHERE clinic_id = ? AND conversation_id = ? AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [clinicId, conversation.id],
    );
    const [replyRows]: any = await pool.execute(
      `SELECT id, conversation_id as conversationId, contact_id as contactId, inbound_message_id as inboundMessageId,
              responsible_user_id as responsibleUserId, approved_by_user_id as approvedByUserId,
              outbound_message_id as outboundMessageId, draft_body as draftBody, final_body as finalBody,
              ai_output as aiOutput, confidence, provider, model, status, guardrail_reason as guardrailReason,
              auto_send_allowed as autoSendAllowed, auto_send_attempted as autoSendAttempted,
              send_attempts as sendAttempts, failure_reason as failureReason,
              approved_at as approvedAt, sent_at as sentAt, created_at as createdAt, updated_at as updatedAt
       FROM whatsapp_ai_reply
       WHERE clinic_id = ? AND conversation_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [clinicId, conversation.id],
    );

    return {
      conversation: {
        ...conversation,
        lastMessageAt: toIso(conversation.lastMessageAt),
        createdAt: toIso(conversation.createdAt),
        updatedAt: toIso(conversation.updatedAt),
      },
      messages: messageRows.map(mapMessage),
      aiReplies: replyRows.map(mapReply),
    };
  }

  private async sendReply(
    clinicId: string,
    userId: string | null,
    replyId: string,
    data: { body?: string | null; sendNow: boolean },
    autoSend: boolean,
  ) {
    const reply = await this.getReply(clinicId, replyId);
    const body = cleanString(data.body) || reply.finalBody || reply.draftBody;
    if (!body) throw ApiError.badRequest("Reply body is required");

    const sendKey = `${clinicId}:${replyId}`;
    if (inFlightReplySends.has(sendKey)) {
      return this.getReply(clinicId, replyId);
    }
    inFlightReplySends.add(sendKey);

    try {
    const existingOutbound = await this.findMessageByIdempotencyKey(clinicId, `whatsapp-ai-reply:${replyId}`);
    if (existingOutbound?.status === "sent") {
      await pool.execute(
        `UPDATE whatsapp_ai_reply
         SET outbound_message_id = ?, status = ?, sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND clinic_id = ?`,
        [existingOutbound.id, autoSend ? "auto_sent" : "sent", replyId, clinicId],
      );
      return this.getReply(clinicId, replyId);
    }
    if (existingOutbound?.status === "queued") {
      return this.getReply(clinicId, replyId);
    }
    if (existingOutbound?.status === "failed" && !isRetrySafeFailure(existingOutbound)) {
      throw ApiError.badRequest("Previous WhatsApp provider result is unknown; review manually before retrying");
    }

    await pool.execute(
      `UPDATE whatsapp_ai_reply
       SET auto_send_attempted = ?, send_attempts = send_attempts + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ?`,
      [autoSend ? 1 : reply.autoSendAttempted ? 1 : 0, replyId, clinicId],
    );

    try {
      const outbound = await this.sendWhatsAppMessage({
        clinicId,
        conversationId: reply.conversationId,
        contactId: reply.contactId,
        userId,
        replyId,
        body,
      });
      await pool.execute(
        `UPDATE whatsapp_ai_reply
         SET outbound_message_id = ?, final_body = ?, status = ?, sent_at = CURRENT_TIMESTAMP,
             failure_reason = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND clinic_id = ?`,
        [outbound.id, body, autoSend ? "auto_sent" : "sent", replyId, clinicId],
      );
      await logAuditEvent({
        clinicId,
        userId,
        action: autoSend ? "WHATSAPP_AI_REPLY_AUTO_SENT" : "WHATSAPP_AI_REPLY_SENT",
        entityType: "whatsapp_ai_reply",
        entityId: replyId,
        changes: { outboundMessageId: outbound.id },
      });
      return this.getReply(clinicId, replyId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "WhatsApp send failed";
      await pool.execute(
        `UPDATE whatsapp_ai_reply
         SET status = 'failed', failure_reason = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND clinic_id = ?`,
        [message, replyId, clinicId],
      );
      await logAuditEvent({
        clinicId,
        userId,
        action: "WHATSAPP_AI_REPLY_SEND_FAILED",
        entityType: "whatsapp_ai_reply",
        entityId: replyId,
        changes: { message },
      });
      return this.getReply(clinicId, replyId);
    }
    } finally {
      inFlightReplySends.delete(sendKey);
    }
  }

  private async sendWhatsAppMessage(input: {
    clinicId: string;
    conversationId: string;
    contactId: string;
    userId: string | null;
    replyId?: string;
    idempotencyKey?: string;
    timelineAction?: string;
    body: string;
  }) {
    const idempotencyKey = input.idempotencyKey || `whatsapp-ai-reply:${input.replyId}`;
    const lockName = idempotencyLockName(idempotencyKey);
    const connection = await pool.getConnection();
    let lockAcquired = false;
    let messageId = "";
    let status: "sent" | "failed" = "sent";
    let failureReason: string | null = null;

    try {
      const [lockRows]: any = await connection.execute("SELECT GET_LOCK(?, 10) as acquired", [lockName]);
      lockAcquired = Number(lockRows[0]?.acquired || 0) === 1;
      if (!lockAcquired) {
        throw ApiError.serviceUnavailable("WhatsApp send is already being processed; please try again");
      }

      const [existingRows]: any = await connection.execute(
        `SELECT id, conversation_id as conversationId, contact_id as contactId, direction, body, status,
                provider_message_id as providerMessageId, idempotency_key as idempotencyKey,
                failure_reason as failureReason, metadata, received_at as receivedAt, sent_at as sentAt,
                created_at as createdAt
         FROM whatsapp_message
         WHERE clinic_id = ? AND idempotency_key = ? AND deleted_at IS NULL
         LIMIT 1`,
        [input.clinicId, idempotencyKey],
      );
      const existing = existingRows[0] ? mapMessage(existingRows[0]) : null;
      if (existing?.status === "sent") return existing;
      if (existing?.status === "queued") return existing;
      if (existing?.status === "failed" && !isRetrySafeFailure(existing)) {
        throw ApiError.badRequest("Previous WhatsApp provider result is unknown; review manually before retrying");
      }

      const [conversationRows]: any = await connection.execute(
        `SELECT whatsapp_number as whatsappNumber FROM whatsapp_conversation WHERE id = ? AND clinic_id = ? LIMIT 1`,
        [input.conversationId, input.clinicId],
      );
      const to = conversationRows[0]?.whatsappNumber;
      if (!to) throw ApiError.badRequest("WhatsApp conversation number is missing");
      if (config.whatsapp.provider === "meta" && (!config.whatsapp.accessToken || !config.whatsapp.phoneNumberId)) {
        throw ApiError.serviceUnavailable("WhatsApp provider is not configured");
      }

      messageId = existing?.id || uuidv4();
      if (!existing) {
        try {
          await connection.execute(
            `INSERT INTO whatsapp_message
              (id, clinic_id, conversation_id, contact_id, user_id, direction, body, status,
               provider_message_id, idempotency_key, metadata)
             VALUES (?, ?, ?, ?, ?, 'outbound', ?, 'queued', NULL, ?, ?)`,
            [
              messageId,
              input.clinicId,
              input.conversationId,
              input.contactId,
              input.userId || null,
              input.body,
              idempotencyKey,
              JSON.stringify({
                provider: config.whatsapp.provider,
                reservedAt: new Date().toISOString(),
                retrySafe: true,
              }),
            ],
          );
        } catch (error) {
          if (!isDuplicateKeyError(error)) throw error;
          const [duplicateRows]: any = await connection.execute(
            `SELECT id, conversation_id as conversationId, contact_id as contactId, direction, body, status,
                    provider_message_id as providerMessageId, idempotency_key as idempotencyKey,
                    failure_reason as failureReason, metadata, received_at as receivedAt, sent_at as sentAt,
                    created_at as createdAt
             FROM whatsapp_message
             WHERE clinic_id = ? AND idempotency_key = ? AND deleted_at IS NULL
             LIMIT 1`,
            [input.clinicId, idempotencyKey],
          );
          if (duplicateRows[0]) return mapMessage(duplicateRows[0]);
          throw error;
        }
      } else {
        await connection.execute(
          `UPDATE whatsapp_message
           SET user_id = ?, body = ?, status = 'queued', failure_reason = NULL,
               metadata = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND clinic_id = ? AND status = 'failed'`,
          [
            input.userId || null,
            input.body,
            JSON.stringify({
              ...(parseJsonObject(existing.metadata) || {}),
              provider: config.whatsapp.provider,
              retryQueuedAt: new Date().toISOString(),
              retrySafe: true,
            }),
            messageId,
            input.clinicId,
          ],
        );
      }

      let providerMessageId = `log:${messageId}`;
      let providerResponse: Record<string, unknown> = { provider: "log", skippedExternalSend: true };
      let retrySafe = true;

      if (config.whatsapp.provider === "meta") {
        try {
          const response = await fetch(
            `https://graph.facebook.com/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}/messages`,
            {
              method: "POST",
              signal: AbortSignal.timeout(config.openai.timeoutMs),
              headers: {
                Authorization: `Bearer ${config.whatsapp.accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to,
                type: "text",
                text: { preview_url: false, body: input.body },
              }),
            },
          );
          const payload: any = await response.json().catch(() => ({}));
          providerResponse = payload;
          if (!response.ok) {
            status = "failed";
            failureReason = payload.error?.message || `WhatsApp provider failed with ${response.status}`;
            retrySafe = true;
          } else {
            providerMessageId = payload.messages?.[0]?.id || providerMessageId;
          }
        } catch (error) {
          status = "failed";
          retrySafe = false;
          failureReason = error instanceof Error ? error.message : "WhatsApp provider result is unknown";
          providerResponse = {
            provider: "meta",
            providerAttempted: true,
            providerResultUnknown: true,
            error: failureReason,
          };
        }
      }

      await connection.execute(
        `UPDATE whatsapp_message
         SET user_id = ?, body = ?, status = ?, provider_message_id = ?, failure_reason = ?,
             metadata = ?, sent_at = CASE WHEN ? = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND clinic_id = ?`,
        [
          input.userId || null,
          input.body,
          status,
          status === "sent" ? providerMessageId : null,
          failureReason,
          JSON.stringify({
            ...providerResponse,
            retrySafe,
            provider: config.whatsapp.provider,
            idempotencyKey,
          }),
          status,
          messageId,
          input.clinicId,
        ],
      );
    } finally {
      if (lockAcquired) {
        await connection.execute("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => undefined);
      }
      connection.release();
    }

    await this.touchConversation(input.conversationId, status === "sent" ? "open" : "human_required");
    await logTimelineActivity({
      clinicId: input.clinicId,
      contactId: input.contactId,
      userId: input.userId || undefined,
      type: "SMS",
        metadata: buildTimelineMetadata({
        action: input.timelineAction || "whatsapp.reply_sent",
        source: "contact",
        recordId: messageId,
        changes: { status, provider: config.whatsapp.provider },
      }),
    });

    if (status === "failed") throw ApiError.serviceUnavailable(failureReason || "WhatsApp provider failed");
    return this.getMessage(input.clinicId, messageId);
  }

  private async generateReplyWithFallback(inbound: any, settings: any) {
    const fallbackBody = deterministicDraft({
      contactName: inbound.contact.firstName || inbound.contact.name || "there",
      accountName: inbound.contact.accountName,
      inboundBody: inbound.message.body,
      tone: settings.approvedTone,
    });

    if (!config.openai.insightsEnabled || !config.openai.apiKey) {
      return {
        provider: "deterministic",
        model: null,
        body: fallbackBody,
        aiOutput: { fallback: true, reason: "openai_not_configured" },
      };
    }

    try {
      const response = await fetch(config.openai.apiUrl, {
        method: "POST",
        signal: AbortSignal.timeout(config.openai.timeoutMs),
        headers: {
          Authorization: `Bearer ${config.openai.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.openai.defaultModel,
          input: [
            {
              role: "system",
              content: `You draft short WhatsApp replies for ClinicGrower internal sales. Tone: ${settings.approvedTone}. Guardrails: ${settings.guardrails.join(" ")}`,
            },
            {
              role: "user",
              content: `Lead/contact: ${inbound.contact.name}. Account: ${inbound.contact.accountName || "unknown"}. Latest inbound WhatsApp message: ${inbound.message.body}. Draft one concise reply only.`,
            },
          ],
        }),
      });
      const payload: any = await response.json().catch(() => ({}));
      const text = extractOpenAIText(payload);
      if (!response.ok || !text) throw new Error(payload.error?.message || "OpenAI reply generation failed");
      return {
        provider: "openai",
        model: config.openai.defaultModel,
        body: text.slice(0, 1600),
        aiOutput: { responseId: payload.id || null },
      };
    } catch (error) {
      logger.warn("WhatsApp AI reply generation fell back to deterministic draft", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        provider: "deterministic",
        model: null,
        body: fallbackBody,
        aiOutput: { fallback: true, reason: error instanceof Error ? error.message : "openai_failed" },
      };
    }
  }

  private async findOrCreateContact(clinicId: string, userId: string | null, phone: string, data: WhatsAppInboundDTO) {
    if (data.contactId) {
      const [rows]: any = await pool.execute(
        `SELECT id, account_name as accountName, first_name as firstName, last_name as lastName, phone
         FROM contact WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL LIMIT 1`,
        [data.contactId, clinicId],
      );
      if (rows[0]) return this.normalizeContact(rows[0]);
    }

    const [rows]: any = await pool.execute(
      `SELECT id, account_name as accountName, first_name as firstName, last_name as lastName, phone
       FROM contact
       WHERE clinic_id = ? AND deleted_at IS NULL
         AND REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '') = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
      [clinicId, phone],
    );
    if (rows[0]) return this.normalizeContact(rows[0]);

    if (!data.createLeadIfMissing) {
      throw ApiError.notFound("No lead/contact matched this WhatsApp number");
    }

    const id = uuidv4();
    await pool.execute(
      `INSERT INTO contact
        (id, clinic_id, account_name, first_name, last_name, phone, status, lead_status, source, whatsapp_permission, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'lead', 'new', 'whatsapp', 1, ?)`,
      [
        id,
        clinicId,
        cleanString(data.accountName),
        cleanString(data.firstName) || "WhatsApp",
        cleanString(data.lastName) || "Lead",
        phone,
        "Created from inbound WhatsApp message.",
      ],
    );
    await logAuditEvent({
      clinicId,
      userId,
      action: "WHATSAPP_LEAD_CREATED",
      entityType: "contact",
      entityId: id,
      changes: { phone },
    });
    return this.normalizeContact({ id, accountName: data.accountName || null, firstName: data.firstName || "WhatsApp", lastName: data.lastName || "Lead", phone });
  }

  private normalizeContact(row: any) {
    const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.accountName || "WhatsApp lead";
    return {
      id: row.id,
      accountName: row.accountName || null,
      firstName: row.firstName || null,
      lastName: row.lastName || null,
      name,
      phone: row.phone || null,
    };
  }

  private async ensureConversation(clinicId: string, contactId: string, phone: string, userId: string | null) {
    const [existingRows]: any = await pool.execute(
      `SELECT id, contact_id as contactId, whatsapp_number as whatsappNumber, status
       FROM whatsapp_conversation
       WHERE clinic_id = ? AND contact_id = ? AND whatsapp_number = ? AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId, contactId, phone],
    );
    if (existingRows[0]) return existingRows[0];

    const id = uuidv4();
    await pool.execute(
      `INSERT INTO whatsapp_conversation (id, clinic_id, contact_id, whatsapp_number, owner_user_id, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      [id, clinicId, contactId, phone, userId || null],
    );
    return { id, contactId, whatsappNumber: phone, status: "open" };
  }

  private async touchConversation(conversationId: string, status?: string, at?: string | null) {
    await pool.execute(
      `UPDATE whatsapp_conversation
       SET status = COALESCE(?, status),
           last_message_at = COALESCE(?, last_message_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status || null, at || null, conversationId],
    );
  }

  private async getInboundContext(clinicId: string, inboundMessageId: string) {
    const [rows]: any = await pool.execute(
      `SELECT wm.id as messageId, wm.body, wm.conversation_id as conversationId, wm.contact_id as contactId,
              wc.whatsapp_number as whatsappNumber, wc.status as conversationStatus,
              c.id as id, c.account_name as accountName, c.first_name as firstName, c.last_name as lastName, c.phone
       FROM whatsapp_message wm
       JOIN whatsapp_conversation wc ON wc.id = wm.conversation_id
       JOIN contact c ON c.id = wm.contact_id
       WHERE wm.id = ? AND wm.clinic_id = ? AND wm.direction = 'inbound' AND wm.deleted_at IS NULL
       LIMIT 1`,
      [inboundMessageId, clinicId],
    );
    const row = rows[0];
    if (!row) throw ApiError.notFound("Inbound WhatsApp message not found");
    return {
      message: { id: row.messageId, body: row.body, contactId: row.contactId },
      conversation: { id: row.conversationId, whatsappNumber: row.whatsappNumber, status: row.conversationStatus },
      contact: this.normalizeContact(row),
    };
  }

  private async getMessage(clinicId: string, messageId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id, conversation_id as conversationId, contact_id as contactId, direction, body, status,
              provider_message_id as providerMessageId, idempotency_key as idempotencyKey,
              failure_reason as failureReason, metadata, received_at as receivedAt, sent_at as sentAt,
              created_at as createdAt
       FROM whatsapp_message
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [messageId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("WhatsApp message not found");
    return mapMessage(rows[0]);
  }

  private async getReply(clinicId: string, replyId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id, conversation_id as conversationId, contact_id as contactId, inbound_message_id as inboundMessageId,
              responsible_user_id as responsibleUserId, approved_by_user_id as approvedByUserId,
              outbound_message_id as outboundMessageId, draft_body as draftBody, final_body as finalBody,
              ai_output as aiOutput, confidence, provider, model, status, guardrail_reason as guardrailReason,
              auto_send_allowed as autoSendAllowed, auto_send_attempted as autoSendAttempted,
              send_attempts as sendAttempts, failure_reason as failureReason,
              approved_at as approvedAt, sent_at as sentAt, created_at as createdAt, updated_at as updatedAt
       FROM whatsapp_ai_reply
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [replyId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("WhatsApp AI reply not found");
    return mapReply(rows[0]);
  }

  private async getReplyByInboundMessage(clinicId: string, inboundMessageId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id FROM whatsapp_ai_reply WHERE clinic_id = ? AND inbound_message_id = ? AND deleted_at IS NULL LIMIT 1`,
      [clinicId, inboundMessageId],
    );
    return rows[0] ? this.getReply(clinicId, rows[0].id) : null;
  }

  private async findMessageByProviderId(clinicId: string, providerMessageId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id FROM whatsapp_message WHERE clinic_id = ? AND provider_message_id = ? AND deleted_at IS NULL LIMIT 1`,
      [clinicId, providerMessageId],
    );
    return rows[0] ? this.getMessage(clinicId, rows[0].id) : null;
  }

  private async findMessageByIdempotencyKey(clinicId: string, idempotencyKey: string) {
    const [rows]: any = await pool.execute(
      `SELECT id FROM whatsapp_message WHERE clinic_id = ? AND idempotency_key = ? AND deleted_at IS NULL LIMIT 1`,
      [clinicId, idempotencyKey],
    );
    return rows[0] ? this.getMessage(clinicId, rows[0].id) : null;
  }
}

export const whatsappAiService = new WhatsAppAiService();
