import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { emailService } from "../../services/email.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import {
  CreateMessageTemplateDTO,
  MESSAGE_TEMPLATE_CHANNELS,
  MESSAGE_TEMPLATE_PLACEHOLDERS,
  MESSAGE_TEMPLATE_STATUSES,
  MessageTemplateFilters,
  MessageTemplateResponse,
  RenderMessageTemplateVariables,
  TestSendMessageTemplateDTO,
  TestSendMessageTemplateResponse,
  UpdateMessageTemplateDTO,
} from "./message-templates.types.js";

function normalizeTemplateRow(row: any): MessageTemplateResponse {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel,
    subject: row.subject ?? null,
    body: row.body,
    status: row.status,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    availablePlaceholders: MESSAGE_TEMPLATE_PLACEHOLDERS,
  };
}

function normalizeRenderedValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function bodyToHtml(body: string) {
  return escapeHtml(body).replace(/\r?\n/g, "<br>");
}

function normalizeVariables(variables: RenderMessageTemplateVariables | undefined): RenderMessageTemplateVariables {
  const normalized: RenderMessageTemplateVariables = {};
  Object.entries(variables || {}).forEach(([key, value]) => {
    const normalizedKey = key.trim().toLowerCase();
    if (!normalizedKey) return;
    normalized[normalizedKey] = value;
  });
  return normalized;
}

export function extractMessageTemplateVariables(...inputs: Array<string | null | undefined>) {
  const keys = new Set<string>();
  inputs.filter(Boolean).forEach((input) => {
    for (const match of String(input).matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)) {
      keys.add(String(match[1]).toLowerCase());
    }
  });
  return [...keys].sort();
}

function getMissingTemplateVariables(requiredVariables: string[], variables: RenderMessageTemplateVariables) {
  return requiredVariables.filter((key) => {
    const value = variables[key];
    return value === null || value === undefined || String(value).trim() === "";
  });
}

function validateRecipient(channel: "email" | "sms", recipient: string) {
  const trimmed = recipient.trim();
  if (channel === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw ApiError.badRequest("Enter a valid email recipient");
    }
    return trimmed.toLowerCase();
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    throw ApiError.badRequest("Enter a valid SMS recipient phone number");
  }
  return trimmed;
}

export function renderMessageTemplateText(input: string, variables: RenderMessageTemplateVariables) {
  return input.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, rawKey) => {
    const key = String(rawKey).toLowerCase();
    const value = variables[key] ?? variables[String(rawKey)] ?? variables[key.replace(/\s+/g, "_")];
    return normalizeRenderedValue(value);
  });
}

export function validateRenderedTemplateBody(body: string) {
  if (!body.trim()) {
    throw ApiError.badRequest("Template body cannot be empty after rendering");
  }
}

export class MessageTemplatesService {
  // List reusable communication templates
  async listTemplates(clinicId: string, filters: MessageTemplateFilters = {}) {
    const whereClauses = ["clinic_id = ?", "deleted_at IS NULL"];
    const values: any[] = [clinicId];

    if (filters.channel) {
      whereClauses.push("channel = ?");
      values.push(filters.channel);
    }

    if (filters.status) {
      whereClauses.push("status = ?");
      values.push(filters.status);
    }

    const [rows]: any = await pool.execute(
      `SELECT id, name, channel, subject, body, status, created_at as createdAt, updated_at as updatedAt
       FROM message_template
       WHERE ${whereClauses.join(" AND ")}
       ORDER BY updated_at DESC`,
      values,
    );
    return rows.map((row: any) => normalizeTemplateRow(row));
  }

  // Fetch one template for editing or flow usage.
  async getTemplate(clinicId: string, templateId: string): Promise<MessageTemplateResponse> {
    const [rows]: any = await pool.execute(
      `SELECT id, name, channel, subject, body, status, created_at as createdAt, updated_at as updatedAt
       FROM message_template
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [templateId, clinicId],
    );

    if (!rows[0]) {
      throw ApiError.notFound("Message template not found");
    }

    return normalizeTemplateRow(rows[0]);
  }

  // Create a template for email or SMS.
  async createTemplate(clinicId: string, userId: string, data: CreateMessageTemplateDTO): Promise<MessageTemplateResponse> {
    const id = uuidv4();
    const channel = data.channel || "email";
    const status = data.status || "draft";
    const name = data.name.trim();
    const subject = data.subject?.trim() || null;
    const body = data.body.trim();

    if (!MESSAGE_TEMPLATE_CHANNELS.includes(channel)) {
      throw ApiError.badRequest("Unsupported template channel");
    }

    if (!MESSAGE_TEMPLATE_STATUSES.includes(status)) {
      throw ApiError.badRequest("Unsupported template status");
    }

    if (!data.body || !data.body.trim()) {
      throw ApiError.badRequest("Template body is required");
    }

    await pool.execute(
      `INSERT INTO message_template (id, clinic_id, name, channel, subject, body, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, clinicId, name, channel, subject, body, status, userId],
    );
    await logAuditEvent({ clinicId, userId, action: "MESSAGE_TEMPLATE_CREATED", entityType: "message_template", entityId: id, changes: { name, channel, status } });

    return this.getTemplate(clinicId, id);
  }

  // Update template content or lifecycle status
  async updateTemplate(clinicId: string, userId: string, templateId: string, data: UpdateMessageTemplateDTO): Promise<MessageTemplateResponse> {
    const fields: string[] = [];
    const values: any[] = [];
    ["name", "channel", "subject", "body", "status"].forEach((key) => {
      const value = (data as any)[key];
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(key === "body" ? String(value).trim() : value || null);
      }
    });

    if (fields.length === 0) {
      return this.getTemplate(clinicId, templateId);
    }

    if (data.channel && !MESSAGE_TEMPLATE_CHANNELS.includes(data.channel)) {
      throw ApiError.badRequest("Unsupported template channel");
    }

    if (data.status && !MESSAGE_TEMPLATE_STATUSES.includes(data.status)) {
      throw ApiError.badRequest("Unsupported template status");
    }

    if (data.body !== undefined && !String(data.body).trim()) {
      throw ApiError.badRequest("Template body is required");
    }

    values.push(templateId, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE message_template SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Message template not found");
    await logAuditEvent({ clinicId, userId, action: "MESSAGE_TEMPLATE_UPDATED", entityType: "message_template", entityId: templateId, changes: { ...data } });

    return this.getTemplate(clinicId, templateId);
  }

  // Mark a template as archived without deleting it.
  async archiveTemplate(clinicId: string, userId: string, templateId: string): Promise<MessageTemplateResponse> {
    const [result]: any = await pool.execute(
      "UPDATE message_template SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL",
      [templateId, clinicId],
    );

    if (result.affectedRows === 0) throw ApiError.notFound("Message template not found");

    await logAuditEvent({ clinicId, userId, action: "MESSAGE_TEMPLATE_ARCHIVED", entityType: "message_template", entityId: templateId });
    return this.getTemplate(clinicId, templateId);
  }

  // Soft delete a template
  async deleteTemplate(clinicId: string, userId: string, templateId: string): Promise<void> {
    const [result]: any = await pool.execute(
      "UPDATE message_template SET deleted_at = CURRENT_TIMESTAMP, status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL",
      [templateId, clinicId],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Message template not found");
    await logAuditEvent({ clinicId, userId, action: "MESSAGE_TEMPLATE_DELETED", entityType: "message_template", entityId: templateId });
  }

  // Prepare an active template for send-time rendering.
  async renderTemplate(clinicId: string, templateId: string, variables: RenderMessageTemplateVariables) {
    const template = await this.getTemplate(clinicId, templateId);
    if (template.status !== "active") {
      throw ApiError.badRequest("Only active templates can be used in flows");
    }

    const subject = template.subject ? renderMessageTemplateText(template.subject, variables) : null;
    const body = renderMessageTemplateText(template.body, variables);

    validateRenderedTemplateBody(body);

    return {
      template,
      subject,
      body,
      availablePlaceholders: MESSAGE_TEMPLATE_PLACEHOLDERS,
    };
  }

  async testSendTemplate(
    clinicId: string,
    userId: string,
    templateId: string,
    data: TestSendMessageTemplateDTO,
  ): Promise<TestSendMessageTemplateResponse> {
    const template = await this.getTemplate(clinicId, templateId);
    if (template.status === "archived") {
      throw ApiError.badRequest("Archived templates cannot be test sent");
    }

    const channel = data.channel || template.channel;
    if (channel !== template.channel) {
      throw ApiError.badRequest("Test send channel must match the template channel");
    }

    const recipient = validateRecipient(channel, data.recipient);
    const variables = normalizeVariables(data.variables);
    const requiredVariables = extractMessageTemplateVariables(template.subject, template.body);
    const missingVariables = getMissingTemplateVariables(requiredVariables, variables);
    if (missingVariables.length > 0) {
      throw ApiError.badRequest(`Missing template variables: ${missingVariables.join(", ")}`, { missingVariables });
    }

    const subject = template.subject ? renderMessageTemplateText(template.subject, variables) : null;
    const body = renderMessageTemplateText(template.body, variables);
    validateRenderedTemplateBody(body);

    const messageId = uuidv4();
    const result: TestSendMessageTemplateResponse = {
      templateId,
      channel,
      recipient,
      deliveryStatus: channel === "email" ? "sent" : "queued",
      messageId,
      subject: channel === "email" ? subject || template.name : null,
      missingVariables: [],
      renderedBody: body,
    };

    try {
      if (channel === "email") {
        const sendResponse = await emailService.sendTransactionalEmail({
          to: [{ email: recipient }],
          subject: result.subject || template.name,
          htmlContent: bodyToHtml(body),
          textContent: body,
          tags: ["message-template-test"],
        });
        result.messageId = sendResponse?.messageId || messageId;
      }

      await logAuditEvent({
        clinicId,
        userId,
        action: "MESSAGE_TEMPLATE_TEST_SEND",
        entityType: "message_template",
        entityId: templateId,
        changes: {
          channel,
          recipient,
          deliveryStatus: result.deliveryStatus,
          providerMessageId: result.messageId,
        },
      });

      return result;
    } catch (error) {
      await logAuditEvent({
        clinicId,
        userId,
        action: "MESSAGE_TEMPLATE_TEST_SEND_FAILED",
        entityType: "message_template",
        entityId: templateId,
        changes: {
          channel,
          recipient,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }
}

export const messageTemplatesService = new MessageTemplatesService();
