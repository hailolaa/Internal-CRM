import crypto from "crypto";
import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { hashToken } from "../../utils/helpers.js";
import { logAuditEvent } from "../../utils/audit.js";
import { ApiKeyResponse, CreateApiKeyDTO, UpdateApiKeyDTO } from "./api-keys.types.js";

function toResponse(row: any): ApiKeyResponse {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    status: row.revokedAt ? "revoked" : "active",
    createdAt: new Date(row.createdAt).toISOString(),
    lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : null,
    revokedAt: row.revokedAt ? new Date(row.revokedAt).toISOString() : null,
  };
}

export class ApiKeysService {
  // List API keys while keeping the hashed secret private
  async listApiKeys(clinicId: string): Promise<ApiKeyResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT
          id,
          name,
          key_prefix as keyPrefix,
          last_used_at as lastUsedAt,
          revoked_at as revokedAt,
          created_at as createdAt
       FROM api_key
       WHERE clinic_id = ?
       ORDER BY created_at DESC`,
      [clinicId],
    );

    return rows.map(toResponse);
  }

  // Create a key, store only its hash, and return the raw key once
  async createApiKey(
    clinicId: string,
    userId: string,
    data: CreateApiKeyDTO,
  ): Promise<ApiKeyResponse> {
    const id = uuidv4();
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const key = `cg_live_${rawToken}`;
    const keyPrefix = key.slice(0, 16);

    await pool.execute(
      `INSERT INTO api_key (id, clinic_id, name, key_prefix, key_hash, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, clinicId, data.name, keyPrefix, hashToken(key), userId],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "API_KEY_CREATED",
      entityType: "api_key",
      entityId: id,
      changes: { name: data.name },
    });

    return {
      id,
      name: data.name,
      keyPrefix,
      key,
      status: "active",
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      revokedAt: null,
    };
  }

  // Update display metadata for an active key
  async updateApiKey(
    clinicId: string,
    userId: string,
    apiKeyId: string,
    data: UpdateApiKeyDTO,
  ): Promise<void> {
    if (!data.name) return;

    const [result]: any = await pool.execute(
      `UPDATE api_key
       SET name = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND revoked_at IS NULL`,
      [data.name, apiKeyId, clinicId],
    );

    if (result.affectedRows === 0) {
      throw ApiError.notFound("API key not found");
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "API_KEY_UPDATED",
      entityType: "api_key",
      entityId: apiKeyId,
      changes: { ...data },
    });
  }

  // Revoke a key but keep the row for auditability
  async revokeApiKey(
    clinicId: string,
    userId: string,
    apiKeyId: string,
  ): Promise<void> {
    const [result]: any = await pool.execute(
      `UPDATE api_key
       SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND revoked_at IS NULL`,
      [apiKeyId, clinicId],
    );

    if (result.affectedRows === 0) {
      throw ApiError.notFound("API key not found");
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "API_KEY_REVOKED",
      entityType: "api_key",
      entityId: apiKeyId,
    });
  }
}

export const apiKeysService = new ApiKeysService();
