import crypto from "crypto";
import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { hashToken } from "../../utils/helpers.js";
import { logAuditEvent } from "../../utils/audit.js";
import { ApiKeyResponse, CreateApiKeyDTO, UpdateApiKeyDTO } from "./api-keys.types.js";

type ApiKeyPurpose = ApiKeyResponse["purpose"];

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function generateApiKey() {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const key = `cg_live_${rawToken}`;
  return {
    key,
    keyPrefix: key.slice(0, 16),
    keyHash: hashToken(key),
  };
}

function toResponse(row: any): ApiKeyResponse {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    purpose: row.purpose || "general",
    sourceKey: row.sourceKey || null,
    sourceLabel: row.sourceLabel || null,
    defaultSource: row.defaultSource || null,
    initialStageName: row.initialStageName || null,
    ownerUserId: row.ownerUserId || null,
    ownerName: [row.ownerFirstName, row.ownerLastName].filter(Boolean).join(" ").trim() || row.ownerEmail || null,
    followUpEnabled: row.followUpEnabled === undefined ? true : Boolean(row.followUpEnabled),
    status: row.revokedAt ? "revoked" : "active",
    createdAt: new Date(row.createdAt).toISOString(),
    lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : null,
    revokedAt: row.revokedAt ? new Date(row.revokedAt).toISOString() : null,
    rotatedAt: row.rotatedAt ? new Date(row.rotatedAt).toISOString() : null,
  };
}

export class ApiKeysService {
  // List API keys while keeping the hashed secret private
  async listApiKeys(clinicId: string): Promise<ApiKeyResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT
          ak.id,
          ak.name,
          ak.key_prefix as keyPrefix,
          ak.purpose,
          ak.source_key as sourceKey,
          ak.source_label as sourceLabel,
          ak.default_source as defaultSource,
          ak.initial_stage_name as initialStageName,
          ak.owner_user_id as ownerUserId,
          ak.follow_up_enabled as followUpEnabled,
          ak.last_used_at as lastUsedAt,
          ak.revoked_at as revokedAt,
          ak.rotated_at as rotatedAt,
          ak.created_at as createdAt,
          owner.first_name as ownerFirstName,
          owner.last_name as ownerLastName,
          owner.email as ownerEmail
       FROM api_key ak
       LEFT JOIN user owner
         ON owner.id = ak.owner_user_id
        AND owner.clinic_id = ak.clinic_id
        AND owner.deleted_at IS NULL
       WHERE ak.clinic_id = ?
       ORDER BY ak.created_at DESC`,
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
    const name = cleanString(data.name);
    if (!name) throw ApiError.badRequest("API key name is required");

    const id = uuidv4();
    const generated = generateApiKey();
    const purpose = this.resolvePurpose(data.purpose);
    const sourceKey = this.resolveSourceKey(data, purpose);
    const sourceLabel = cleanString(data.sourceLabel) || (purpose === "landing_page_lead_capture" ? name : null);
    const defaultSource = cleanString(data.defaultSource) || sourceKey;
    const initialStageName = cleanString(data.initialStageName);
    const ownerUserId = cleanString(data.ownerUserId);
    const followUpEnabled = data.followUpEnabled !== false;

    if (ownerUserId) {
      await this.ensureActiveUserInWorkspace(clinicId, ownerUserId);
    }

    await pool.execute(
      `INSERT INTO api_key
        (id, clinic_id, name, key_prefix, key_hash, purpose, source_key, source_label,
         default_source, initial_stage_name, owner_user_id, follow_up_enabled, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        name,
        generated.keyPrefix,
        generated.keyHash,
        purpose,
        sourceKey,
        sourceLabel,
        defaultSource,
        initialStageName,
        ownerUserId,
        followUpEnabled ? 1 : 0,
        userId,
      ],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "API_KEY_CREATED",
      entityType: "api_key",
      entityId: id,
      changes: { name, purpose, sourceKey, defaultSource, initialStageName, ownerUserId, followUpEnabled },
    });

    return {
      id,
      name,
      keyPrefix: generated.keyPrefix,
      key: generated.key,
      purpose,
      sourceKey,
      sourceLabel,
      defaultSource,
      initialStageName,
      ownerUserId,
      ownerName: null,
      followUpEnabled,
      status: "active",
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      revokedAt: null,
      rotatedAt: null,
    };
  }

  // Update display metadata for an active key
  async updateApiKey(
    clinicId: string,
    userId: string,
    apiKeyId: string,
    data: UpdateApiKeyDTO,
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      const name = cleanString(data.name);
      if (!name) throw ApiError.badRequest("API key name is required");
      fields.push("name = ?");
      values.push(name);
    }

    if (data.sourceLabel !== undefined) {
      fields.push("source_label = ?");
      values.push(cleanString(data.sourceLabel));
    }

    if (data.defaultSource !== undefined) {
      fields.push("default_source = ?");
      values.push(cleanString(data.defaultSource));
    }

    if (data.initialStageName !== undefined) {
      fields.push("initial_stage_name = ?");
      values.push(cleanString(data.initialStageName));
    }

    if (data.ownerUserId !== undefined) {
      const ownerUserId = cleanString(data.ownerUserId);
      if (ownerUserId) await this.ensureActiveUserInWorkspace(clinicId, ownerUserId);
      fields.push("owner_user_id = ?");
      values.push(ownerUserId);
    }

    if (data.followUpEnabled !== undefined) {
      fields.push("follow_up_enabled = ?");
      values.push(data.followUpEnabled ? 1 : 0);
    }

    if (fields.length === 0) return;

    const [result]: any = await pool.execute(
      `UPDATE api_key
       SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND revoked_at IS NULL`,
      [...values, apiKeyId, clinicId],
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

  async rotateApiKey(clinicId: string, userId: string, apiKeyId: string): Promise<ApiKeyResponse> {
    const generated = generateApiKey();

    const [result]: any = await pool.execute(
      `UPDATE api_key
       SET key_prefix = ?,
           key_hash = ?,
           last_used_at = NULL,
           rotated_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND revoked_at IS NULL`,
      [generated.keyPrefix, generated.keyHash, apiKeyId, clinicId],
    );

    if (result.affectedRows === 0) {
      throw ApiError.notFound("API key not found");
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "API_KEY_ROTATED",
      entityType: "api_key",
      entityId: apiKeyId,
      changes: { keyPrefix: generated.keyPrefix },
    });

    const [rows]: any = await pool.execute(
      `SELECT
          ak.id,
          ak.name,
          ak.key_prefix as keyPrefix,
          ak.purpose,
          ak.source_key as sourceKey,
          ak.source_label as sourceLabel,
          ak.default_source as defaultSource,
          ak.initial_stage_name as initialStageName,
          ak.owner_user_id as ownerUserId,
          ak.follow_up_enabled as followUpEnabled,
          ak.last_used_at as lastUsedAt,
          ak.revoked_at as revokedAt,
          ak.rotated_at as rotatedAt,
          ak.created_at as createdAt,
          owner.first_name as ownerFirstName,
          owner.last_name as ownerLastName,
          owner.email as ownerEmail
       FROM api_key ak
       LEFT JOIN user owner
         ON owner.id = ak.owner_user_id
        AND owner.clinic_id = ak.clinic_id
        AND owner.deleted_at IS NULL
       WHERE ak.id = ? AND ak.clinic_id = ?
       LIMIT 1`,
      [apiKeyId, clinicId],
    );

    return {
      ...toResponse(rows[0]),
      key: generated.key,
      keyPrefix: generated.keyPrefix,
    };
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

  private resolvePurpose(value: unknown): ApiKeyPurpose {
    if (value === "landing_page_lead_capture") return "landing_page_lead_capture";
    return "general";
  }

  private resolveSourceKey(data: CreateApiKeyDTO, purpose: ApiKeyPurpose) {
    if (purpose !== "landing_page_lead_capture") return cleanString(data.sourceKey);
    const explicit = cleanString(data.sourceKey) || cleanString(data.defaultSource) || cleanString(data.name);
    const sourceKey = explicit ? slugify(explicit) : null;
    if (!sourceKey) throw ApiError.badRequest("Landing-page API keys require a source key");
    return sourceKey;
  }

  private async ensureActiveUserInWorkspace(clinicId: string, userId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM user
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
         AND is_active = 1
       LIMIT 1`,
      [userId, clinicId],
    );
    if (!rows[0]) throw ApiError.badRequest("Owner user must belong to this workspace");
  }
}

export const apiKeysService = new ApiKeysService();
