import { v4 as uuidv4 } from "uuid";
import type { PoolConnection } from "mysql2/promise";
import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { insertAuditEvent } from "../../utils/audit.js";
import { encryptProviderCredential } from "../../utils/provider-credentials.js";
import { generateResetToken, hashToken } from "../../utils/helpers.js";
import type {
  ClickUpAccessContext,
  ClickUpAuditContext,
  ClickUpClientMappingResponse,
  ClickUpConnectionResponse,
  CompleteClickUpOAuthDTO,
  SaveClickUpClientMappingDTO,
  SaveClickUpTaskMappingDTO,
  ClickUpTaskMappingResponse,
  StartClickUpOAuthResponse,
} from "./clickup.types.js";

const OAUTH_STATE_TTL_MINUTES = 20;

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);

  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toIsoString(value: unknown) {
  if (!value) return null;
  return new Date(String(value)).toISOString();
}

function encodeState(payload: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeState(rawState: string) {
  try {
    const parsed = JSON.parse(Buffer.from(rawState, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function nullableExternalKey(value: string | null | undefined) {
  return value ? value.trim() : "";
}

function mapConnection(row: any): ClickUpConnectionResponse {
  return {
    id: row.id,
    workspaceId: row.workspaceId || null,
    workspaceName: row.workspaceName || null,
    status: row.status,
    scopes: parseJsonArray(row.scopes),
    connectedBy: row.connectedBy || null,
    connectedAt: toIsoString(row.connectedAt),
    revokedAt: toIsoString(row.revokedAt),
    lastCheckedAt: toIsoString(row.lastCheckedAt),
    lastError: row.lastError || null,
    tokenStored: Boolean(row.encryptedAccessToken),
    refreshTokenStored: Boolean(row.encryptedRefreshToken),
    tokenExpiresAt: toIsoString(row.tokenExpiresAt),
    updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
  };
}

function mapClientMapping(row: any): ClickUpClientMappingResponse {
  return {
    id: row.id,
    clientAccountProfileId: row.clientAccountProfileId,
    clientClinicId: row.clientClinicId,
    clientName: row.clientName,
    connectionId: row.connectionId || null,
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName || null,
    spaceId: row.spaceId || null,
    folderId: row.folderId || null,
    listId: row.listId || null,
    deliveryRootTaskId: row.deliveryRootTaskId || null,
    deliveryUrl: row.deliveryUrl || null,
    mappingStatus: row.mappingStatus,
    mappingSource: row.mappingSource,
    deterministic: true,
    updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
  };
}

function mapTaskMapping(row: any): ClickUpTaskMappingResponse {
  return {
    id: row.id,
    clientAccountProfileId: row.clientAccountProfileId,
    internalTaskId: row.internalTaskId || null,
    connectionId: row.connectionId || null,
    workspaceId: row.workspaceId,
    clickupTaskId: row.clickupTaskId,
    clickupListId: row.clickupListId || null,
    clickupUrl: row.clickupUrl || null,
    syncDirection: row.syncDirection,
    mappingStatus: row.mappingStatus,
    updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
  };
}

export class ClickUpService {
  async getStatus(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              workspace_id as workspaceId,
              workspace_name as workspaceName,
              status,
              scopes,
              connected_by as connectedBy,
              connected_at as connectedAt,
              revoked_at as revokedAt,
              last_checked_at as lastCheckedAt,
              last_error as lastError,
              encrypted_access_token as encryptedAccessToken,
              encrypted_refresh_token as encryptedRefreshToken,
              token_expires_at as tokenExpiresAt,
              updated_at as updatedAt
       FROM clickup_connection
       WHERE clinic_id = ?
       ORDER BY FIELD(status, 'connected', 'pending', 'error', 'revoked'), updated_at DESC
       LIMIT 10`,
      [clinicId],
    );

    const [mappingRows]: any = await pool.execute(
      `SELECT
          (SELECT COUNT(*) FROM clickup_client_mapping WHERE clinic_id = ? AND mapping_status = 'active') as clientMappingCount,
          (SELECT COUNT(*) FROM clickup_task_mapping WHERE clinic_id = ? AND mapping_status = 'active') as taskMappingCount`,
      [clinicId, clinicId],
    );

    return {
      oauthConfigured: Boolean(config.clickup.clientId && config.clickup.clientSecret),
      connections: rows.map(mapConnection),
      clientMappingCount: Number(mappingRows[0]?.clientMappingCount || 0),
      taskMappingCount: Number(mappingRows[0]?.taskMappingCount || 0),
    };
  }

  async startOAuth(clinicId: string, userId: string, auditContext: ClickUpAuditContext = {}): Promise<StartClickUpOAuthResponse> {
    if (!config.clickup.clientId || !config.clickup.clientSecret) {
      throw ApiError.serviceUnavailable("ClickUp OAuth requires CLICKUP_CLIENT_ID and CLICKUP_CLIENT_SECRET.");
    }

    const nonce = generateResetToken();
    const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MINUTES * 60 * 1000);
    const state = encodeState({
      clinicId,
      userId,
      nonce,
      exp: expiresAt.toISOString(),
    });
    const stateHash = hashToken(state);
    const connectionId = uuidv4();

    await pool.execute(
      `INSERT INTO clickup_connection
        (id, clinic_id, status, oauth_state_hash, oauth_started_at, connected_by)
       VALUES (?, ?, 'pending', ?, CURRENT_TIMESTAMP, ?)`,
      [connectionId, clinicId, stateHash, userId],
    );

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: "CLICKUP_OAUTH_STARTED",
      entityType: "clickup_connection",
      entityId: connectionId,
      changes: { stateExpiresAt: expiresAt.toISOString() },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    const redirectUri = this.oauthRedirectUri();
    const url = new URL(config.clickup.appAuthUrl);
    url.searchParams.set("client_id", config.clickup.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);

    return {
      authorizeUrl: url.toString(),
      stateExpiresAt: expiresAt.toISOString(),
    };
  }

  async completeOAuth(data: CompleteClickUpOAuthDTO, auditContext: ClickUpAuditContext = {}) {
    if (!config.clickup.clientId || !config.clickup.clientSecret) {
      throw ApiError.serviceUnavailable("ClickUp OAuth requires CLICKUP_CLIENT_ID and CLICKUP_CLIENT_SECRET.");
    }

    const statePayload = decodeState(data.state);
    const clinicId = cleanString(statePayload?.clinicId);
    const userId = cleanString(statePayload?.userId);
    const expiresAt = cleanString(statePayload?.exp);
    if (!clinicId || !userId || !expiresAt || Date.parse(expiresAt) < Date.now()) {
      throw ApiError.badRequest("ClickUp OAuth state is invalid or expired.");
    }

    const stateHash = hashToken(data.state);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [pendingRows]: any = await connection.execute(
        `SELECT id
         FROM clickup_connection
         WHERE clinic_id = ?
           AND oauth_state_hash = ?
           AND status = 'pending'
         ORDER BY oauth_started_at DESC
         LIMIT 1
         FOR UPDATE`,
        [clinicId, stateHash],
      );
      const pending = pendingRows[0];
      if (!pending) {
        throw ApiError.badRequest("ClickUp OAuth state could not be matched.");
      }

      const token = await this.exchangeCodeForToken(data.code);
      const workspaces = await this.fetchAuthorizedWorkspaces(token.accessToken);
      const selectedWorkspace = this.selectWorkspace(workspaces, data.workspaceId || null);

      await connection.execute(
        `UPDATE clickup_connection
         SET workspace_id = ?,
             workspace_name = ?,
             status = 'connected',
             encrypted_access_token = ?,
             encrypted_refresh_token = ?,
             token_expires_at = ?,
             scopes = ?,
             oauth_state_hash = NULL,
             connected_at = CURRENT_TIMESTAMP,
             connected_by = ?,
             revoked_by = NULL,
             revoked_at = NULL,
             last_checked_at = CURRENT_TIMESTAMP,
             last_error = NULL
         WHERE id = ?`,
        [
          selectedWorkspace.id,
          selectedWorkspace.name,
          encryptProviderCredential(token.accessToken),
          token.refreshToken ? encryptProviderCredential(token.refreshToken) : null,
          token.expiresAt,
          JSON.stringify(token.scopes),
          userId,
          pending.id,
        ],
      );

      await insertAuditEvent(connection, {
        clinicId,
        userId,
        action: "CLICKUP_CONNECTED",
        entityType: "clickup_connection",
        entityId: pending.id,
        changes: {
          workspaceId: selectedWorkspace.id,
          workspaceName: selectedWorkspace.name,
          scopes: token.scopes,
        },
        ipAddress: auditContext.ipAddress || null,
        userAgent: auditContext.userAgent || null,
      });

      await connection.commit();
      return this.getConnectionById(pending.id);
    } catch (error) {
      await connection.rollback();
      if (error instanceof ApiError) throw error;
      throw ApiError.serviceUnavailable(error instanceof Error ? error.message : "ClickUp OAuth failed.");
    } finally {
      connection.release();
    }
  }

  async revoke(clinicId: string, userId: string, auditContext: ClickUpAuditContext = {}) {
    const [rows]: any = await pool.execute(
      `SELECT id, workspace_id as workspaceId, workspace_name as workspaceName
       FROM clickup_connection
       WHERE clinic_id = ?
         AND status IN ('pending', 'connected', 'error')
       ORDER BY updated_at DESC
       LIMIT 1`,
      [clinicId],
    );
    const connection = rows[0];
    if (!connection) throw ApiError.notFound("ClickUp connection not found.");

    await pool.execute(
      `UPDATE clickup_connection
       SET status = 'revoked',
           encrypted_access_token = NULL,
           encrypted_refresh_token = NULL,
           token_expires_at = NULL,
           oauth_state_hash = NULL,
           revoked_by = ?,
           revoked_at = CURRENT_TIMESTAMP,
           last_error = NULL
       WHERE id = ?
         AND clinic_id = ?`,
      [userId, connection.id, clinicId],
    );

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: "CLICKUP_REVOKED",
      entityType: "clickup_connection",
      entityId: connection.id,
      changes: {
        workspaceId: connection.workspaceId,
        workspaceName: connection.workspaceName,
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getConnectionById(connection.id);
  }

  async getClientMapping(
    clinicId: string,
    clientAccountProfileId: string,
    access: ClickUpAccessContext,
  ) {
    await this.ensureClientAccountProfileAvailable(clinicId, clientAccountProfileId, access);
    const [rows]: any = await pool.execute(
      this.clientMappingSelectSql("m.client_account_profile_id = ?"),
      [clinicId, clientAccountProfileId],
    );
    return rows[0] ? mapClientMapping(rows[0]) : null;
  }

  async saveClientMapping(
    clinicId: string,
    userId: string,
    clientAccountProfileId: string,
    data: SaveClickUpClientMappingDTO,
    access: ClickUpAccessContext,
    auditContext: ClickUpAuditContext = {},
  ) {
    this.ensureDeterministicClientStructure(data);
    const clientAccount = await this.ensureClientAccountProfileAvailable(clinicId, clientAccountProfileId, access);
    await this.ensureConnectionAvailable(clinicId, data.connectionId || null, data.workspaceId);
    await this.ensureExternalClientStructureUnused(clinicId, clientAccountProfileId, data);

    const existing = await this.getClientMapping(clinicId, clientAccountProfileId, access);
    const mappingId = existing?.id || uuidv4();
    const mappingStatus = data.mappingStatus || "active";
    const mappingSource = data.mappingSource || "manual";

    await pool.execute(
      `INSERT INTO clickup_client_mapping
        (id, clinic_id, client_account_profile_id, connection_id, workspace_id, space_id, folder_id, list_id,
         delivery_root_task_id, delivery_url, mapping_status, mapping_source, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         connection_id = VALUES(connection_id),
         workspace_id = VALUES(workspace_id),
         space_id = VALUES(space_id),
         folder_id = VALUES(folder_id),
         list_id = VALUES(list_id),
         delivery_root_task_id = VALUES(delivery_root_task_id),
         delivery_url = VALUES(delivery_url),
         mapping_status = VALUES(mapping_status),
         mapping_source = VALUES(mapping_source),
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      [
        mappingId,
        clinicId,
        clientAccountProfileId,
        data.connectionId || null,
        data.workspaceId,
        data.spaceId || null,
        data.folderId || null,
        data.listId || null,
        data.deliveryRootTaskId || null,
        data.deliveryUrl || null,
        mappingStatus,
        mappingSource,
        userId,
        userId,
      ],
    );

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: existing ? "CLICKUP_CLIENT_MAPPING_UPDATED" : "CLICKUP_CLIENT_MAPPING_CREATED",
      entityType: "clickup_client_mapping",
      entityId: mappingId,
      changes: {
        clientAccountProfileId,
        clientClinicId: clientAccount.clientClinicId,
        workspaceId: data.workspaceId,
        spaceId: data.spaceId || null,
        folderId: data.folderId || null,
        listId: data.listId || null,
        deliveryRootTaskId: data.deliveryRootTaskId || null,
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getClientMapping(clinicId, clientAccountProfileId, access);
  }

  async deleteClientMapping(
    clinicId: string,
    userId: string,
    clientAccountProfileId: string,
    access: ClickUpAccessContext,
    auditContext: ClickUpAuditContext = {},
  ) {
    await this.ensureClientAccountProfileAvailable(clinicId, clientAccountProfileId, access);
    const existing = await this.getClientMapping(clinicId, clientAccountProfileId, access);
    if (!existing) throw ApiError.notFound("ClickUp client mapping not found.");

    await pool.execute(
      `DELETE FROM clickup_client_mapping
       WHERE clinic_id = ?
         AND client_account_profile_id = ?`,
      [clinicId, clientAccountProfileId],
    );

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: "CLICKUP_CLIENT_MAPPING_REMOVED",
      entityType: "clickup_client_mapping",
      entityId: existing.id,
      changes: { clientAccountProfileId, workspaceId: existing.workspaceId },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return { removed: true };
  }

  async saveTaskMapping(
    clinicId: string,
    userId: string,
    data: SaveClickUpTaskMappingDTO,
    access: ClickUpAccessContext,
    auditContext: ClickUpAuditContext = {},
  ) {
    await this.ensureClientAccountProfileAvailable(clinicId, data.clientAccountProfileId, access);
    await this.ensureConnectionAvailable(clinicId, data.connectionId || null, data.workspaceId);
    if (data.internalTaskId) {
      await this.ensureTaskBelongsToClient(clinicId, data.clientAccountProfileId, data.internalTaskId);
    }
    await this.ensureClickUpTaskUnused(clinicId, data.clientAccountProfileId, data.workspaceId, data.clickupTaskId);

    const [existingRows]: any = await pool.execute(
      `SELECT id
       FROM clickup_task_mapping
       WHERE clinic_id = ?
         AND workspace_id = ?
         AND clickup_task_id = ?
       LIMIT 1`,
      [clinicId, data.workspaceId, data.clickupTaskId],
    );
    const mappingId = existingRows[0]?.id || uuidv4();

    await pool.execute(
      `INSERT INTO clickup_task_mapping
        (id, clinic_id, client_account_profile_id, internal_task_id, connection_id, workspace_id,
         clickup_task_id, clickup_list_id, clickup_url, sync_direction, mapping_status, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         client_account_profile_id = VALUES(client_account_profile_id),
         internal_task_id = VALUES(internal_task_id),
         connection_id = VALUES(connection_id),
         clickup_list_id = VALUES(clickup_list_id),
         clickup_url = VALUES(clickup_url),
         sync_direction = VALUES(sync_direction),
         mapping_status = VALUES(mapping_status),
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      [
        mappingId,
        clinicId,
        data.clientAccountProfileId,
        data.internalTaskId || null,
        data.connectionId || null,
        data.workspaceId,
        data.clickupTaskId,
        data.clickupListId || null,
        data.clickupUrl || null,
        data.syncDirection || "manual",
        data.mappingStatus || "active",
        userId,
        userId,
      ],
    );

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: "CLICKUP_TASK_MAPPING_SAVED",
      entityType: "clickup_task_mapping",
      entityId: mappingId,
      changes: {
        clientAccountProfileId: data.clientAccountProfileId,
        internalTaskId: data.internalTaskId || null,
        workspaceId: data.workspaceId,
        clickupTaskId: data.clickupTaskId,
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getTaskMappingById(mappingId);
  }

  async listTaskMappings(
    clinicId: string,
    clientAccountProfileId: string,
    access: ClickUpAccessContext,
  ) {
    await this.ensureClientAccountProfileAvailable(clinicId, clientAccountProfileId, access);
    const [rows]: any = await pool.execute(
      `SELECT id,
              client_account_profile_id as clientAccountProfileId,
              internal_task_id as internalTaskId,
              connection_id as connectionId,
              workspace_id as workspaceId,
              clickup_task_id as clickupTaskId,
              clickup_list_id as clickupListId,
              clickup_url as clickupUrl,
              sync_direction as syncDirection,
              mapping_status as mappingStatus,
              updated_at as updatedAt
       FROM clickup_task_mapping
       WHERE clinic_id = ?
         AND client_account_profile_id = ?
       ORDER BY updated_at DESC
       LIMIT 200`,
      [clinicId, clientAccountProfileId],
    );
    return rows.map(mapTaskMapping);
  }

  private oauthRedirectUri() {
    return `${config.apiPublicUrl.replace(/\/+$/, "")}/clickup/oauth/callback`;
  }

  private async exchangeCodeForToken(code: string) {
    const response = await fetch(`${config.clickup.apiBaseUrl.replace(/\/+$/, "")}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.clickup.clientId,
        client_secret: config.clickup.clientSecret,
        code,
      }),
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw ApiError.serviceUnavailable(payload.err || payload.error || "ClickUp OAuth token exchange failed.");
    }

    const expiresInSeconds = Number(payload.expires_in || 0);
    return {
      accessToken: String(payload.access_token),
      refreshToken: cleanString(payload.refresh_token),
      expiresAt: expiresInSeconds > 0
        ? new Date(Date.now() + expiresInSeconds * 1000).toISOString().slice(0, 19).replace("T", " ")
        : null,
      scopes: Array.isArray(payload.scope)
        ? payload.scope.map(String)
        : cleanString(payload.scope)?.split(/[,\s]+/).filter(Boolean) || [],
    };
  }

  private async fetchAuthorizedWorkspaces(accessToken: string) {
    const response = await fetch(`${config.clickup.apiBaseUrl.replace(/\/+$/, "")}/team`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(payload.teams)) {
      throw ApiError.serviceUnavailable(payload.err || payload.error || "ClickUp workspace lookup failed.");
    }

    return payload.teams.map((team: any) => ({
      id: String(team.id),
      name: String(team.name || team.id),
    }));
  }

  private selectWorkspace(
    workspaces: Array<{ id: string; name: string }>,
    requestedWorkspaceId: string | null,
  ): { id: string; name: string } {
    if (workspaces.length === 0) {
      throw ApiError.serviceUnavailable("ClickUp OAuth did not return an authorised workspace.");
    }

    if (requestedWorkspaceId) {
      const match = workspaces.find((workspace) => workspace.id === requestedWorkspaceId);
      if (!match) throw ApiError.forbidden("Selected ClickUp workspace was not authorised by this OAuth connection.");
      return match;
    }

    if (workspaces.length > 1) {
      throw ApiError.badRequest("ClickUp returned multiple workspaces. Select the approved workspace ID before completing setup.");
    }

    return workspaces[0]!;
  }

  private async getConnectionById(connectionId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              workspace_id as workspaceId,
              workspace_name as workspaceName,
              status,
              scopes,
              connected_by as connectedBy,
              connected_at as connectedAt,
              revoked_at as revokedAt,
              last_checked_at as lastCheckedAt,
              last_error as lastError,
              encrypted_access_token as encryptedAccessToken,
              encrypted_refresh_token as encryptedRefreshToken,
              token_expires_at as tokenExpiresAt,
              updated_at as updatedAt
       FROM clickup_connection
       WHERE id = ?
       LIMIT 1`,
      [connectionId],
    );
    if (!rows[0]) throw ApiError.notFound("ClickUp connection not found.");
    return mapConnection(rows[0]);
  }

  private async ensureConnectionAvailable(clinicId: string, connectionId: string | null, workspaceId: string) {
    if (!connectionId) return;
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM clickup_connection
       WHERE id = ?
         AND clinic_id = ?
         AND workspace_id = ?
         AND status = 'connected'
       LIMIT 1`,
      [connectionId, clinicId, workspaceId],
    );
    if (!rows[0]) {
      throw ApiError.forbidden("ClickUp connection is not available to this workspace.");
    }
  }

  private async ensureClientAccountProfileAvailable(
    sourceClinicId: string,
    clientAccountProfileId: string,
    access: ClickUpAccessContext,
  ) {
    const [rows]: any = await pool.execute(
      `SELECT cap.id,
              cap.clinic_id as clientClinicId,
              c.name as clientName
       FROM client_account_profile cap
       JOIN clinic c
         ON c.id = cap.clinic_id
        AND c.deleted_at IS NULL
       WHERE cap.id = ?
       LIMIT 1`,
      [clientAccountProfileId],
    );
    const profile = rows[0];
    if (!profile) throw ApiError.notFound("Client account not found.");
    if (profile.clientClinicId === sourceClinicId || access.canManageAllClientAccounts) {
      return profile as { id: string; clientClinicId: string; clientName: string };
    }
    throw ApiError.forbidden("Client account is not available to this workspace.");
  }

  private async ensureExternalClientStructureUnused(
    clinicId: string,
    clientAccountProfileId: string,
    data: SaveClickUpClientMappingDTO,
  ) {
    const [rows]: any = await pool.execute(
      `SELECT id, client_account_profile_id as clientAccountProfileId
       FROM clickup_client_mapping
       WHERE clinic_id = ?
         AND workspace_id = ?
         AND COALESCE(space_id, '') = ?
         AND COALESCE(folder_id, '') = ?
         AND COALESCE(list_id, '') = ?
         AND COALESCE(delivery_root_task_id, '') = ?
         AND client_account_profile_id <> ?
         AND mapping_status <> 'archived'
       LIMIT 1`,
      [
        clinicId,
        data.workspaceId,
        nullableExternalKey(data.spaceId),
        nullableExternalKey(data.folderId),
        nullableExternalKey(data.listId),
        nullableExternalKey(data.deliveryRootTaskId),
        clientAccountProfileId,
      ],
    );

    if (rows[0]) {
      throw ApiError.conflict("That ClickUp delivery structure is already mapped to another client account.");
    }
  }

  private ensureDeterministicClientStructure(data: SaveClickUpClientMappingDTO) {
    if (data.spaceId || data.folderId || data.listId || data.deliveryRootTaskId) return;
    throw ApiError.badRequest("A ClickUp space, folder, list, or delivery task ID is required for deterministic client mapping.");
  }

  private async ensureTaskBelongsToClient(clinicId: string, clientAccountProfileId: string, taskId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM task
       WHERE id = ?
         AND clinic_id = ?
         AND client_account_profile_id = ?
         AND is_internal = 1
         AND deleted_at IS NULL
       LIMIT 1`,
      [taskId, clinicId, clientAccountProfileId],
    );
    if (!rows[0]) {
      throw ApiError.forbidden("Internal task is not available to this client account.");
    }
  }

  private async ensureClickUpTaskUnused(
    clinicId: string,
    clientAccountProfileId: string,
    workspaceId: string,
    clickupTaskId: string,
  ) {
    const [rows]: any = await pool.execute(
      `SELECT id, client_account_profile_id as clientAccountProfileId
       FROM clickup_task_mapping
       WHERE clinic_id = ?
         AND workspace_id = ?
         AND clickup_task_id = ?
         AND client_account_profile_id <> ?
         AND mapping_status <> 'archived'
       LIMIT 1`,
      [clinicId, workspaceId, clickupTaskId, clientAccountProfileId],
    );
    if (rows[0]) {
      throw ApiError.conflict("That ClickUp task is already mapped to another client account.");
    }
  }

  private async getTaskMappingById(mappingId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              client_account_profile_id as clientAccountProfileId,
              internal_task_id as internalTaskId,
              connection_id as connectionId,
              workspace_id as workspaceId,
              clickup_task_id as clickupTaskId,
              clickup_list_id as clickupListId,
              clickup_url as clickupUrl,
              sync_direction as syncDirection,
              mapping_status as mappingStatus,
              updated_at as updatedAt
       FROM clickup_task_mapping
       WHERE id = ?
       LIMIT 1`,
      [mappingId],
    );
    if (!rows[0]) throw ApiError.notFound("ClickUp task mapping not found.");
    return mapTaskMapping(rows[0]);
  }

  private clientMappingSelectSql(where: string) {
    return `SELECT m.id,
                   m.client_account_profile_id as clientAccountProfileId,
                   cap.clinic_id as clientClinicId,
                   c.name as clientName,
                   m.connection_id as connectionId,
                   m.workspace_id as workspaceId,
                   cc.workspace_name as workspaceName,
                   m.space_id as spaceId,
                   m.folder_id as folderId,
                   m.list_id as listId,
                   m.delivery_root_task_id as deliveryRootTaskId,
                   m.delivery_url as deliveryUrl,
                   m.mapping_status as mappingStatus,
                   m.mapping_source as mappingSource,
                   m.updated_at as updatedAt
            FROM clickup_client_mapping m
            JOIN client_account_profile cap
              ON cap.id = m.client_account_profile_id
            JOIN clinic c
              ON c.id = cap.clinic_id
             AND c.deleted_at IS NULL
            LEFT JOIN clickup_connection cc
              ON cc.id = m.connection_id
            WHERE m.clinic_id = ?
              AND ${where}
            LIMIT 1`;
  }
}

export const clickUpService = new ClickUpService();
