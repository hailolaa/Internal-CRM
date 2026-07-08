import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { hashToken } from "../../utils/helpers.js";
import { logAuditEvent } from "../../utils/audit.js";
import { CreateWebhookEndpointDTO, UpdateWebhookEndpointDTO, WebhookEndpointResponse } from "./webhooks.types.js";

function parseEvents(value: unknown) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return [];
  }
}

export class WebhooksService {
  // List configured outbound webhook endpoints
  async listEndpoints(clinicId: string): Promise<WebhookEndpointResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT id, url, description, events, is_active as isActive,
              created_at as createdAt, updated_at as updatedAt
       FROM webhook_endpoint
       WHERE clinic_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [clinicId],
    );
    return rows.map((row: any) => ({
      ...row,
      events: parseEvents(row.events),
      isActive: !!row.isActive,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));
  }

  // Create a webhook endpoint and store only the secret hash
  async createEndpoint(clinicId: string, userId: string, data: CreateWebhookEndpointDTO): Promise<string> {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO webhook_endpoint (id, clinic_id, url, description, events, secret_hash, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        data.url,
        data.description || null,
        JSON.stringify(data.events),
        data.secret ? hashToken(data.secret) : null,
        data.isActive === false ? 0 : 1,
        userId,
      ],
    );
    await logAuditEvent({ clinicId, userId, action: "WEBHOOK_ENDPOINT_CREATED", entityType: "webhook_endpoint", entityId: id, changes: { url: data.url, events: data.events } });
    return id;
  }

  // Update webhook metadata, events, active state, or signing secret
  async updateEndpoint(clinicId: string, userId: string, endpointId: string, data: UpdateWebhookEndpointDTO): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.url !== undefined) { fields.push("url = ?"); values.push(data.url); }
    if (data.description !== undefined) { fields.push("description = ?"); values.push(data.description || null); }
    if (data.events !== undefined) { fields.push("events = ?"); values.push(JSON.stringify(data.events)); }
    if (data.secret !== undefined) { fields.push("secret_hash = ?"); values.push(hashToken(data.secret)); }
    if (data.isActive !== undefined) { fields.push("is_active = ?"); values.push(data.isActive ? 1 : 0); }

    if (fields.length === 0) return;
    values.push(endpointId, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE webhook_endpoint SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Webhook endpoint not found");
    await logAuditEvent({ clinicId, userId, action: "WEBHOOK_ENDPOINT_UPDATED", entityType: "webhook_endpoint", entityId: endpointId, changes: { ...data, secret: data.secret ? "[updated]" : undefined } });
  }

  // Soft delete a webhook endpoint
  async deleteEndpoint(clinicId: string, userId: string, endpointId: string): Promise<void> {
    const [result]: any = await pool.execute(
      "UPDATE webhook_endpoint SET deleted_at = CURRENT_TIMESTAMP, is_active = 0 WHERE id = ? AND clinic_id = ?",
      [endpointId, clinicId],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Webhook endpoint not found");
    await logAuditEvent({ clinicId, userId, action: "WEBHOOK_ENDPOINT_DELETED", entityType: "webhook_endpoint", entityId: endpointId });
  }
}

export const webhooksService = new WebhooksService();
