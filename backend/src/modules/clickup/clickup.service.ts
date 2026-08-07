import { v4 as uuidv4 } from "uuid";
import type { PoolConnection } from "mysql2/promise";
import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { insertAuditEvent } from "../../utils/audit.js";
import { decryptProviderCredential, encryptProviderCredential } from "../../utils/provider-credentials.js";
import { generateResetToken, hashToken } from "../../utils/helpers.js";
import type {
  ClickUpAccessContext,
  ClickUpAuditContext,
  ClickUpCategoryKey,
  ClickUpCategoryMappingResponse,
  ClickUpClientMappingResponse,
  ClickUpConnectionResponse,
  CompleteClickUpOAuthDTO,
  CreateClickUpTaskDTO,
  SaveClickUpCategoryMappingDTO,
  SaveClickUpClientMappingDTO,
  SaveClickUpPriorityMappingDTO,
  SaveClickUpTaskMappingDTO,
  ClickUpPriorityMappingResponse,
  ClickUpTaskMappingResponse,
  StartClickUpOAuthResponse,
  CreateClickUpTaskResult,
  FailedTaskMapping,
} from "./clickup.types.js";

const OAUTH_STATE_TTL_MINUTES = 20;
const CATEGORY_KEYS: ClickUpCategoryKey[] = ["development", "seo", "gmb_local_seo", "ppc", "managerial", "reporting", "account_control"];

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

function mapCategoryMapping(row: any): ClickUpCategoryMappingResponse {
  return {
    id: row.id,
    clientAccountProfileId: row.clientAccountProfileId,
    connectionId: row.connectionId || null,
    workspaceId: row.workspaceId,
    spaceId: row.spaceId,
    categoryKey: row.categoryKey,
    folderId: row.folderId || null,
    listId: row.listId,
    defaultAssigneeIds: parseJsonArray(row.defaultAssigneeIds),
    mappingStatus: row.mappingStatus,
    mappingSource: row.mappingSource,
    updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
  };
}

function mapPriorityMapping(row: any): ClickUpPriorityMappingResponse {
  return {
    id: row.id,
    missionControlPriority: row.missionControlPriority,
    clickupPriority: Number(row.clickupPriority) as 1 | 2 | 3 | 4,
    updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
  };
}

function uniqueStrings(values: unknown[] | undefined) {
  return [...new Set((values || []).map(String).map((value) => value.trim()).filter(Boolean))];
}

function extractClickUpMembers(payload: any) {
  const candidates = [
    payload?.members,
    payload?.users,
    payload?.team?.members,
    payload?.team?.users,
    payload?.data?.members,
    payload?.data?.users,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
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
      apiTokenConfigured: Boolean(config.clickup.apiToken && config.clickup.teamId),
      connections: rows.map(mapConnection),
      clientMappingCount: Number(mappingRows[0]?.clientMappingCount || 0),
      taskMappingCount: Number(mappingRows[0]?.taskMappingCount || 0),
    };
  }

  async connectConfiguredApiToken(clinicId: string, userId: string, auditContext: ClickUpAuditContext = {}) {
    if (!config.clickup.apiToken || !config.clickup.teamId) {
      throw ApiError.serviceUnavailable("ClickUp API token connection requires CLICKUP_API_TOKEN and CLICKUP_TEAM_ID.");
    }

    const workspaces = await this.fetchAuthorizedWorkspaces(config.clickup.apiToken, "personal_token");
    const selectedWorkspace = this.selectWorkspace(workspaces, config.clickup.teamId);
    const connectionId = uuidv4();

    await pool.execute(
      `INSERT INTO clickup_connection
        (id, clinic_id, workspace_id, workspace_name, status, encrypted_access_token,
         encrypted_refresh_token, token_expires_at, scopes, oauth_state_hash,
         connected_at, connected_by, revoked_by, revoked_at, last_checked_at, last_error)
       VALUES (?, ?, ?, ?, 'connected', ?, NULL, NULL, ?, NULL, CURRENT_TIMESTAMP, ?, NULL, NULL, CURRENT_TIMESTAMP, NULL)
       ON DUPLICATE KEY UPDATE
         workspace_name = VALUES(workspace_name),
         status = 'connected',
         encrypted_access_token = VALUES(encrypted_access_token),
         encrypted_refresh_token = NULL,
         token_expires_at = NULL,
         scopes = VALUES(scopes),
         oauth_state_hash = NULL,
         connected_at = CURRENT_TIMESTAMP,
         connected_by = VALUES(connected_by),
         revoked_by = NULL,
         revoked_at = NULL,
         last_checked_at = CURRENT_TIMESTAMP,
         last_error = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [
        connectionId,
        clinicId,
        selectedWorkspace.id,
        selectedWorkspace.name,
        encryptProviderCredential(config.clickup.apiToken),
        JSON.stringify(["personal_api_token"]),
        userId,
      ],
    );

    const [rows]: any = await pool.execute(
      `SELECT id
       FROM clickup_connection
       WHERE clinic_id = ?
         AND workspace_id = ?
         AND status = 'connected'
       ORDER BY updated_at DESC
       LIMIT 1`,
      [clinicId, selectedWorkspace.id],
    );
    const savedConnectionId = rows[0]?.id || connectionId;

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: "CLICKUP_API_TOKEN_CONNECTED",
      entityType: "clickup_connection",
      entityId: savedConnectionId,
      changes: {
        workspaceId: selectedWorkspace.id,
        workspaceName: selectedWorkspace.name,
        authMode: "personal_api_token",
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return this.getConnectionById(savedConnectionId);
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
      const workspaces = await this.fetchAuthorizedWorkspaces(token.accessToken, "oauth");
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

  async listRemoteWorkspaces(clinicId: string) {
    const connection = await this.getActiveConnection(clinicId);
    return this.fetchAuthorizedWorkspaces(connection.accessToken, connection.authMode);
  }

  async listRemoteSpaces(clinicId: string, workspaceId?: string | null) {
    const connection = await this.getActiveConnection(clinicId, workspaceId || null);
    const payload = await this.clickUpRequest(connection, `/team/${encodeURIComponent(connection.workspaceId)}/space?archived=false`);
    return Array.isArray(payload.spaces)
      ? payload.spaces.map((space: any) => ({ id: String(space.id), name: String(space.name || space.id) }))
      : [];
  }

  async listRemoteFolders(clinicId: string, spaceId: string, workspaceId?: string | null) {
    const connection = await this.getActiveConnection(clinicId, workspaceId || null);
    const payload = await this.clickUpRequest(connection, `/space/${encodeURIComponent(spaceId)}/folder?archived=false`);
    return Array.isArray(payload.folders)
      ? payload.folders.map((folder: any) => ({ id: String(folder.id), name: String(folder.name || folder.id), hidden: Boolean(folder.hidden) }))
      : [];
  }

  async listRemoteLists(clinicId: string, data: { spaceId?: string | null; folderId?: string | null; workspaceId?: string | null }) {
    const connection = await this.getActiveConnection(clinicId, data.workspaceId || null);
    const path = data.folderId
      ? `/folder/${encodeURIComponent(data.folderId)}/list?archived=false`
      : `/space/${encodeURIComponent(String(data.spaceId || ""))}/list?archived=false`;
    if (!data.folderId && !data.spaceId) throw ApiError.badRequest("A ClickUp folder or space is required to load lists.");
    const payload = await this.clickUpRequest(connection, path);
    return Array.isArray(payload.lists)
      ? payload.lists.map((list: any) => ({
          id: String(list.id),
          name: String(list.name || list.id),
          folderId: list.folder?.id ? String(list.folder.id) : data.folderId || null,
          spaceId: list.space?.id ? String(list.space.id) : data.spaceId || null,
        }))
      : [];
  }

  async listRemoteMembers(clinicId: string, workspaceId?: string | null) {
    const connection = await this.getActiveConnection(clinicId, workspaceId || null);
    let payload: any = null;
    try {
      payload = await this.clickUpRequest(connection, `/team/${encodeURIComponent(connection.workspaceId)}/user`);
    } catch (err: any) {
      // Try workspace list fallback (includes members when requested)
      try {
        const workspaces = await this.fetchAuthorizedWorkspaces(connection.accessToken, connection.authMode, true);
        const workspace = workspaces.find((item: any) => item.id === connection.workspaceId);
        if (workspace) payload = { members: workspace.members || [] };
      } catch (err2: any) {
        // As a last resort try reading the team object directly and extracting members
        try {
          const teamPayload = await this.clickUpRequest(connection, `/team/${encodeURIComponent(connection.workspaceId)}`);
          if (teamPayload) payload = { members: extractClickUpMembers(teamPayload) };
        } catch (err3: any) {
          payload = null;
          // record last error on the connection for observability, but do not throw to callers
          try {
            await pool.execute(
              `UPDATE clickup_connection SET last_error = ?, last_checked_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [String(err3?.message || err2?.message || err?.message || "ClickUp member lookup failed"), connection.id],
            );
          } catch {
            // ignore DB write failures
          }
        }
      }
    }

    return extractClickUpMembers(payload).map((record: any) => {
      const member = record?.user || record || {};
      return {
        id: String(member.id || ""),
        username: String(member.username || member.email || member.id || ""),
        email: member.email ? String(member.email) : null,
      };
    });
  }

  async listCategoryMappings(
    clinicId: string,
    clientAccountProfileId: string,
    access: ClickUpAccessContext,
  ): Promise<ClickUpCategoryMappingResponse[]> {
    await this.ensureClientAccountProfileAvailable(clinicId, clientAccountProfileId, access);
    const [rows]: any = await pool.execute(
      `SELECT id,
              client_account_profile_id as clientAccountProfileId,
              connection_id as connectionId,
              workspace_id as workspaceId,
              space_id as spaceId,
              category_key as categoryKey,
              folder_id as folderId,
              list_id as listId,
              default_assignee_ids as defaultAssigneeIds,
              mapping_status as mappingStatus,
              mapping_source as mappingSource,
              updated_at as updatedAt
       FROM clickup_category_mapping
       WHERE clinic_id = ?
         AND client_account_profile_id = ?
       ORDER BY FIELD(category_key, 'development', 'seo', 'gmb_local_seo', 'ppc', 'managerial', 'reporting', 'account_control')`,
      [clinicId, clientAccountProfileId],
    );
    return rows.map(mapCategoryMapping);
  }

  async saveCategoryMapping(
    clinicId: string,
    userId: string,
    clientAccountProfileId: string,
    data: SaveClickUpCategoryMappingDTO,
    access: ClickUpAccessContext,
    auditContext: ClickUpAuditContext = {},
  ) {
    if (!CATEGORY_KEYS.includes(data.categoryKey)) throw ApiError.badRequest("Work category is not supported.");
    await this.ensureClientAccountProfileAvailable(clinicId, clientAccountProfileId, access);
    await this.ensureConnectionAvailable(clinicId, data.connectionId || null, data.workspaceId);
    const existing = (await this.listCategoryMappings(clinicId, clientAccountProfileId, access))
      .find((mapping) => mapping.categoryKey === data.categoryKey);
    const mappingId = existing?.id || uuidv4();

    await pool.execute(
      `INSERT INTO clickup_category_mapping
        (id, clinic_id, client_account_profile_id, connection_id, workspace_id, space_id,
         category_key, folder_id, list_id, default_assignee_ids, mapping_status, mapping_source, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         connection_id = VALUES(connection_id),
         workspace_id = VALUES(workspace_id),
         space_id = VALUES(space_id),
         folder_id = VALUES(folder_id),
         list_id = VALUES(list_id),
         default_assignee_ids = VALUES(default_assignee_ids),
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
        data.spaceId,
        data.categoryKey,
        data.folderId || null,
        data.listId,
        JSON.stringify(uniqueStrings(data.defaultAssigneeIds)),
        data.mappingStatus || "active",
        data.mappingSource || "manual",
        userId,
        userId,
      ],
    );

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: existing ? "CLICKUP_CATEGORY_MAPPING_UPDATED" : "CLICKUP_CATEGORY_MAPPING_CREATED",
      entityType: "clickup_category_mapping",
      entityId: mappingId,
      changes: {
        clientAccountProfileId,
        categoryKey: data.categoryKey,
        workspaceId: data.workspaceId,
        spaceId: data.spaceId,
        folderId: data.folderId || null,
        listId: data.listId,
        assigneeCount: uniqueStrings(data.defaultAssigneeIds).length,
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return (await this.listCategoryMappings(clinicId, clientAccountProfileId, access))
      .find((mapping) => mapping.categoryKey === data.categoryKey)!;
  }

  async listPriorityMappings(clinicId: string): Promise<ClickUpPriorityMappingResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT id,
              mission_control_priority as missionControlPriority,
              clickup_priority as clickupPriority,
              updated_at as updatedAt
       FROM clickup_priority_mapping
       WHERE clinic_id = ?
       ORDER BY FIELD(mission_control_priority, 'low', 'medium', 'high', 'urgent')`,
      [clinicId],
    );
    return rows.map(mapPriorityMapping);
  }

  async savePriorityMapping(
    clinicId: string,
    userId: string,
    data: SaveClickUpPriorityMappingDTO,
    auditContext: ClickUpAuditContext = {},
  ) {
    const mappingId = uuidv4();
    await pool.execute(
      `INSERT INTO clickup_priority_mapping
        (id, clinic_id, mission_control_priority, clickup_priority, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         clickup_priority = VALUES(clickup_priority),
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      [mappingId, clinicId, data.missionControlPriority, data.clickupPriority, userId, userId],
    );

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: "CLICKUP_PRIORITY_MAPPING_SAVED",
      entityType: "clickup_priority_mapping",
      entityId: data.missionControlPriority,
      changes: { missionControlPriority: data.missionControlPriority, clickupPriority: data.clickupPriority },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return (await this.listPriorityMappings(clinicId))
      .find((mapping) => mapping.missionControlPriority === data.missionControlPriority)!;
  }

  async createClickUpTask(
    clinicId: string,
    userId: string,
    data: CreateClickUpTaskDTO,
    files: Express.Multer.File[] = [],
    access: ClickUpAccessContext,
    auditContext: ClickUpAuditContext = {},
  ) {
    const task = await this.getInternalTaskForClickUp(clinicId, data.internalTaskId);
    if (!task.clientAccountProfileId) {
      throw ApiError.badRequest("This task must be linked to a client account before it can be sent to ClickUp.");
    }
    await this.ensureClientAccountProfileAvailable(clinicId, task.clientAccountProfileId, access);

    const existing = await this.getTaskMappingByInternalTask(clinicId, data.internalTaskId);
    if (existing?.mappingStatus === "active") {
      throw ApiError.conflict("This Mission Control task already has a ClickUp task link.");
    }

    const categoryMapping = await this.getActiveCategoryMapping(clinicId, task.clientAccountProfileId, data.categoryKey);
    const connection = await this.getActiveConnection(clinicId, categoryMapping.workspaceId);
    const priorityMapping = await this.getClickUpPriority(clinicId, data.priority);
    const assigneeIds = uniqueStrings(data.assigneeIds?.length ? data.assigneeIds : categoryMapping.defaultAssigneeIds);
    if (assigneeIds.length === 0) {
      throw ApiError.badRequest("This ClickUp category does not have assignees configured. Add assignees in settings before creating the task.");
    }

    const pendingMappingId = uuidv4();
    const pendingClickupTaskId = this.pendingClickUpTaskId(data.internalTaskId);
    const mapping = await this.saveTaskMapping(
      clinicId,
      userId,
      {
        clientAccountProfileId: task.clientAccountProfileId,
        internalTaskId: data.internalTaskId,
        connectionId: connection.id,
        workspaceId: categoryMapping.workspaceId,
        clickupTaskId: pendingClickupTaskId,
        clickupListId: categoryMapping.listId,
        clickupUrl: null,
        syncDirection: "mission_control_to_clickup",
        mappingStatus: "needs_review",
      },
      access,
      auditContext,
    );

    const description = this.composeClickUpDescription(data.description || task.description || "", data.links || [], data.internalTaskId);
    const dueDate = data.dueDate || task.dueDate || null;
    const payload: Record<string, unknown> = {
      name: data.title.trim(),
      description,
      priority: priorityMapping,
      assignees: assigneeIds.map((id) => Number.isFinite(Number(id)) ? Number(id) : id),
    };
    if (dueDate) payload.due_date = new Date(`${dueDate}T12:00:00.000Z`).getTime();

    const createdTask = await this.clickUpRequest(
      connection,
      `/list/${encodeURIComponent(categoryMapping.listId)}/task`,
      { method: "POST", body: JSON.stringify(payload) },
    );
    const clickupTaskId = String(createdTask.id || "");
    if (!clickupTaskId) throw ApiError.serviceUnavailable("ClickUp did not return a task ID.");
    const clickupUrl = cleanString(createdTask.url) || `https://app.clickup.com/t/${clickupTaskId}`;

    await this.recoverTaskMappingAfterCreation(clinicId, data.internalTaskId, clickupTaskId, clickupUrl);

    const attachmentErrors: string[] = [];
    for (const file of files.slice(0, 5)) {
      try {
        await this.uploadClickUpAttachment(connection, clickupTaskId, file);
      } catch (err) {
        attachmentErrors.push(file.originalname);
      }
    }

    const updatedMapping = await this.saveTaskMapping(
      clinicId,
      userId,
      {
        clientAccountProfileId: task.clientAccountProfileId,
        internalTaskId: data.internalTaskId,
        connectionId: connection.id,
        workspaceId: categoryMapping.workspaceId,
        clickupTaskId,
        clickupListId: categoryMapping.listId,
        clickupUrl,
        syncDirection: "mission_control_to_clickup",
        mappingStatus: "active",
      },
      access,
      auditContext,
    );

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: "CLICKUP_TASK_CREATED",
      entityType: "task",
      entityId: data.internalTaskId,
      changes: {
        clickupTaskId,
        clickupUrl,
        categoryKey: data.categoryKey,
        listId: categoryMapping.listId,
        attachmentCount: files.length,
        attachmentErrors,
      },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return { mapping: updatedMapping, attachmentErrors };
  }

  async listFailedTaskMappings(clinicId: string): Promise<FailedTaskMapping[]> {
    const [rows] = await pool.execute<any[]>(
      `SELECT m.id, m.internal_task_id, m.client_account_profile_id,
              m.clickup_list_id, m.updated_at,
              t.title as internal_task_title,
              p.clinic_id as client_clinic_id,
              c.name as client_name
       FROM clickup_task_mapping m
       LEFT JOIN task t ON m.internal_task_id = t.id
       LEFT JOIN client_account_profile p ON m.client_account_profile_id = p.id
       LEFT JOIN clinic c ON p.clinic_id = c.id
       WHERE m.clinic_id = ? AND m.mapping_status = 'needs_review'
       ORDER BY m.updated_at DESC`,
      [clinicId]
    );

    return rows.map((row) => ({
      id: row.id,
      internalTaskId: row.internal_task_id,
      internalTaskTitle: row.internal_task_title || "Unknown Task",
      clientAccountProfileId: row.client_account_profile_id,
      clientClinicId: row.client_clinic_id || clinicId,
      clientName: row.client_name || "Unknown Client",
      clickupListId: row.clickup_list_id,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    }));
  }

  async replayTaskMapping(
    clinicId: string,
    mappingId: string,
    userId: string,
    access: ClickUpAccessContext,
    auditContext: ClickUpAuditContext = {}
  ): Promise<{ mapping: ClickUpTaskMappingResponse; message: string }> {
    const [chkRows]: any = await pool.execute('SELECT id FROM clickup_task_mapping WHERE id = ? AND clinic_id = ?', [mappingId, clinicId]);
    if (!chkRows[0]) throw ApiError.notFound("Task mapping not found.");
    
    const mapping = await this.getTaskMappingById(mappingId);
    if (mapping.mappingStatus !== "needs_review") {
      throw ApiError.badRequest("Only tasks in needs_review status can be replayed.");
    }

    const connection = await this.getActiveConnection(clinicId, mapping.workspaceId);
    
    if (!mapping.clickupTaskId.startsWith("pending:")) {
      const updated = await this.saveTaskMapping(
        clinicId,
        userId,
        {
          clientAccountProfileId: mapping.clientAccountProfileId,
          internalTaskId: mapping.internalTaskId!,
          connectionId: mapping.connectionId,
          workspaceId: mapping.workspaceId,
          clickupTaskId: mapping.clickupTaskId,
          clickupListId: mapping.clickupListId,
          clickupUrl: mapping.clickupUrl,
          syncDirection: "mission_control_to_clickup",
          mappingStatus: "active",
        },
        access,
        auditContext
      );
      return { mapping: updated, message: "Task was already created in ClickUp; mapping activated." };
    }

    if (!mapping.clickupListId || !mapping.internalTaskId) {
      throw ApiError.badRequest("Mapping is missing list ID or internal task ID required for replay.");
    }

    const tasks = await this.clickUpRequest(
      connection,
      `/list/${encodeURIComponent(mapping.clickupListId)}/task?include_closed=true`,
      { method: "GET" }
    );

    const match = (tasks.tasks || []).find((t: any) => 
      t.description && t.description.includes(`[Mission Control Task ID: ${mapping.internalTaskId}]`)
    );

    if (match) {
      const clickupTaskId = String(match.id);
      const clickupUrl = cleanString(match.url) || `https://app.clickup.com/t/${clickupTaskId}`;
      const updated = await this.saveTaskMapping(
        clinicId,
        userId,
        {
          clientAccountProfileId: mapping.clientAccountProfileId,
          internalTaskId: mapping.internalTaskId,
          connectionId: mapping.connectionId,
          workspaceId: mapping.workspaceId,
          clickupTaskId,
          clickupListId: mapping.clickupListId,
          clickupUrl,
          syncDirection: "mission_control_to_clickup",
          mappingStatus: "active",
        },
        access,
        auditContext
      );
      return { mapping: updated, message: "Found existing ClickUp task and successfully linked it." };
    }
    
    await pool.execute('DELETE FROM clickup_task_mapping WHERE id = ?', [mapping.id]);
    
    const [taskRows] = await pool.execute<any[]>(
      'SELECT title, priority, description, due_date FROM task WHERE id = ?',
      [mapping.internalTaskId]
    );
    if (!taskRows.length) throw ApiError.notFound("Internal task not found.");
    const task = taskRows[0];
    
    const [catRows] = await pool.execute<any[]>(
      'SELECT category_key FROM clickup_category_mapping WHERE clinic_id = ? AND client_account_profile_id = ? AND list_id = ?',
      [clinicId, mapping.clientAccountProfileId, mapping.clickupListId]
    );
    if (!catRows.length) throw ApiError.badRequest("Cannot replay: category mapping for this list no longer exists.");
    const categoryKey = catRows[0].category_key as ClickUpCategoryKey;
    
    const dueDateStr = task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : null;
    
    const result = await this.createClickUpTask(
      clinicId,
      userId,
      {
        internalTaskId: mapping.internalTaskId,
        categoryKey,
        title: task.title,
        priority: task.priority,
        description: task.description,
        dueDate: dueDateStr || null,
      } as CreateClickUpTaskDTO,
      [], // No attachments on replay
      access,
      auditContext
    );
    
    return { mapping: result.mapping, message: "Task was successfully recreated in ClickUp. Please upload any attachments manually." };
  }

  async dismissTaskMapping(
    clinicId: string,
    mappingId: string,
    userId: string,
    auditContext: ClickUpAuditContext = {}
  ): Promise<{ success: boolean }> {
    const [chkRows]: any = await pool.execute('SELECT id FROM clickup_task_mapping WHERE id = ? AND clinic_id = ?', [mappingId, clinicId]);
    if (!chkRows[0]) throw ApiError.notFound("Task mapping not found.");
    
    const mapping = await this.getTaskMappingById(mappingId);
    if (mapping.mappingStatus !== "needs_review") {
      throw ApiError.badRequest("Only tasks in needs_review status can be dismissed.");
    }

    await pool.execute(
      `UPDATE clickup_task_mapping
       SET mapping_status = 'archived',
           updated_by = ?
       WHERE id = ?`,
      [userId, mappingId]
    );

    await insertAuditEvent(pool, {
      clinicId,
      userId,
      action: "CLICKUP_TASK_MAPPING_DISMISSED",
      entityType: "clickup_task_mapping",
      entityId: mappingId,
      changes: { mappingStatus: "archived" },
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    });

    return { success: true };
  }

  private async recoverTaskMappingAfterCreation(
    clinicId: string,
    internalTaskId: string,
    clickupTaskId: string,
    clickupUrl: string,
  ) {
    await pool.execute(
      `UPDATE clickup_task_mapping
       SET clickup_task_id = ?,
           clickup_url = ?
       WHERE clinic_id = ?
         AND internal_task_id = ?`,
      [clickupTaskId, clickupUrl, clinicId, internalTaskId],
    );
  }

  private pendingClickUpTaskId(internalTaskId: string) {
    return `pending:${internalTaskId}`;
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

  private async fetchAuthorizedWorkspaces(accessToken: string, authMode: "oauth" | "personal_token", includeMembers = false) {
    const response = await fetch(`${config.clickup.apiBaseUrl.replace(/\/+$/, "")}/team`, {
      headers: { Authorization: authMode === "oauth" ? `Bearer ${accessToken}` : accessToken },
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(payload.teams)) {
      throw ApiError.serviceUnavailable(payload.err || payload.error || "ClickUp workspace lookup failed.");
    }

    return payload.teams.map((team: any) => ({
      id: String(team.id),
      name: String(team.name || team.id),
      members: includeMembers ? extractClickUpMembers(team) : [],
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

  private async getActiveConnection(clinicId: string, workspaceId?: string | null) {
    const values: any[] = [clinicId];
    const workspaceClause = workspaceId ? "AND workspace_id = ?" : "";
    if (workspaceId) values.push(workspaceId);
    const [rows]: any = await pool.execute(
      `SELECT id,
              workspace_id as workspaceId,
              workspace_name as workspaceName,
              encrypted_access_token as encryptedAccessToken,
              scopes
       FROM clickup_connection
       WHERE clinic_id = ?
         AND status = 'connected'
         ${workspaceClause}
       ORDER BY updated_at DESC
       LIMIT 1`,
      values,
    );
    const row = rows[0];
    if (!row) throw ApiError.badRequest("ClickUp is not connected for this workspace. Connect it in Integrations first.");
    const accessToken = decryptProviderCredential(row.encryptedAccessToken);
    if (!accessToken) throw ApiError.serviceUnavailable("ClickUp credentials could not be read. Reconnect ClickUp before creating tasks.");
    const scopes = parseJsonArray(row.scopes);
    return {
      id: row.id as string,
      workspaceId: row.workspaceId as string,
      workspaceName: row.workspaceName as string | null,
      accessToken,
      authMode: scopes.includes("personal_api_token") ? "personal_token" as const : "oauth" as const,
    };
  }

  private async clickUpRequest(
    connection: { accessToken: string; authMode: "oauth" | "personal_token" },
    path: string,
    init: RequestInit = {},
  ) {
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", connection.authMode === "oauth" ? `Bearer ${connection.accessToken}` : connection.accessToken);
    if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(`${config.clickup.apiBaseUrl.replace(/\/+$/, "")}${path}`, {
      ...init,
      headers,
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.err || payload.error || payload.message || `ClickUp API request failed with status ${response.status}.`;
      throw ApiError.serviceUnavailable(String(message));
    }
    return payload;
  }

  private async uploadClickUpAttachment(
    connection: { accessToken: string; authMode: "oauth" | "personal_token" },
    clickupTaskId: string,
    file: Express.Multer.File,
  ) {
    const body = new FormData();
    const bytes = new Uint8Array(file.buffer.byteLength);
    bytes.set(file.buffer);
    const blob = new Blob([bytes], { type: file.mimetype || "application/octet-stream" });
    body.set("attachment", blob, file.originalname);
    await this.clickUpRequest(connection, `/task/${encodeURIComponent(clickupTaskId)}/attachment`, {
      method: "POST",
      body,
    });
  }

  private async getActiveCategoryMapping(
    clinicId: string,
    clientAccountProfileId: string,
    categoryKey: ClickUpCategoryKey,
  ) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              client_account_profile_id as clientAccountProfileId,
              connection_id as connectionId,
              workspace_id as workspaceId,
              space_id as spaceId,
              category_key as categoryKey,
              folder_id as folderId,
              list_id as listId,
              default_assignee_ids as defaultAssigneeIds,
              mapping_status as mappingStatus,
              mapping_source as mappingSource,
              updated_at as updatedAt
       FROM clickup_category_mapping
       WHERE clinic_id = ?
         AND client_account_profile_id = ?
         AND category_key = ?
         AND mapping_status = 'active'
       LIMIT 1`,
      [clinicId, clientAccountProfileId, categoryKey],
    );
    if (!rows[0]) {
      throw ApiError.badRequest(`ClickUp mapping is missing for ${categoryKey.replaceAll("_", " ")}. Configure the client/category mapping before creating the task.`);
    }
    return mapCategoryMapping(rows[0]);
  }

  private async getClickUpPriority(clinicId: string, missionControlPriority: string) {
    const [rows]: any = await pool.execute(
      `SELECT clickup_priority as clickupPriority
       FROM clickup_priority_mapping
       WHERE clinic_id = ?
         AND mission_control_priority = ?
       LIMIT 1`,
      [clinicId, missionControlPriority],
    );
    if (!rows[0]) {
      throw ApiError.badRequest(`ClickUp priority mapping is missing for ${missionControlPriority}. Configure priority mappings before creating the task.`);
    }
    return Number(rows[0].clickupPriority);
  }

  private async getTaskMappingByInternalTask(clinicId: string, internalTaskId: string) {
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
         AND internal_task_id = ?
       LIMIT 1`,
      [clinicId, internalTaskId],
    );
    return rows[0] ? mapTaskMapping(rows[0]) : null;
  }

  private async getInternalTaskForClickUp(clinicId: string, taskId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              title,
              description,
              priority,
              DATE_FORMAT(due_date, '%Y-%m-%d') as dueDate,
              client_account_profile_id as clientAccountProfileId
       FROM task
       WHERE id = ?
         AND clinic_id = ?
         AND is_internal = 1
         AND deleted_at IS NULL
         AND archived_at IS NULL
       LIMIT 1`,
      [taskId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Internal task not found.");
    return rows[0] as {
      id: string;
      title: string;
      description: string | null;
      priority: string;
      dueDate: string | null;
      clientAccountProfileId: string | null;
    };
  }

  private composeClickUpDescription(description: string, links: Array<{ label?: string | null; url: string }>, internalTaskId?: string) {
    const cleanLinks = links
      .map((link) => ({ label: cleanString(link.label) || "Relevant link", url: cleanString(link.url) }))
      .filter((link): link is { label: string; url: string } => Boolean(link.url));
    
    const parts = [description];
    
    if (cleanLinks.length > 0) {
      parts.push("", "Relevant links:", ...cleanLinks.map((link) => `- ${link.label}: ${link.url}`));
    }
    
    if (internalTaskId) {
      parts.push("", `[Mission Control Task ID: ${internalTaskId}]`);
    }
    
    return parts.join("\n").trim();
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

