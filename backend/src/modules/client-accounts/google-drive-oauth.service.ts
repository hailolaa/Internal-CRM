import crypto from "crypto";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { roleMatchesAllowedRoles } from "../../utils/roles.js";
import { decideGoogleOAuthAccess } from "../auth/google-oauth-access.js";

type DriveOAuthState = {
  purpose: "google_drive";
  provider: "google";
  clinicId: string;
  userId: string;
};

type StoredDriveConfig = {
  oauthConnected?: boolean;
  connectedEmail?: string;
  connectedAt?: string;
  tokenExpiresAt?: string | null;
  grantedScopes?: string[];
  encryptedAccessToken?: string;
  encryptedRefreshToken?: string;
};

export type GoogleDriveFolderItem = {
  id: string;
  name: string;
  webViewLink: string;
  parentId: string | null;
  modifiedTime: string | null;
};

export type GoogleDriveFileItem = GoogleDriveFolderItem & {
  mimeType: string;
  size: number | null;
};

export type GoogleDriveFolderBrowser = {
  currentFolder: GoogleDriveFolderItem;
  folders: GoogleDriveFolderItem[];
  files: GoogleDriveFileItem[];
};

function parseStoredConfig(value: unknown): StoredDriveConfig {
  if (!value) return {};
  if (typeof value === "object") return value as StoredDriveConfig;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function encryptToken(value: string) {
  const key = crypto.createHash("sha256").update(config.jwt.secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "enc:v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

function decryptToken(value: unknown) {
  const raw = typeof value === "string" ? value : "";
  if (!raw.startsWith("enc:v1:")) return raw || null;
  const [, , ivValue, tagValue, encryptedValue] = raw.split(":");
  if (!ivValue || !tagValue || !encryptedValue) return null;
  try {
    const key = crypto.createHash("sha256").update(config.jwt.secret).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export class GoogleDriveOAuthService {
  private readonly integrationType = "google_drive";
  private readonly integrationName = "Google Drive";
  private tokenCache = new Map<string, { token: string; expiresAt: number }>();

  private get redirectUri() {
    return `${config.oauthCallbackBaseUrl.replace(/\/$/, "")}/oauth/google/callback`;
  }

  private assertConfigured() {
    if (!config.googleDrive.databaseOAuthEnabled) {
      throw ApiError.serviceUnavailable("Google Drive workspace OAuth is not enabled.");
    }
    if (!config.oauth.google.clientId || !config.oauth.google.clientSecret) {
      throw ApiError.serviceUnavailable("Google Drive OAuth credentials are not configured.");
    }
  }

  getAuthorizationUrl(clinicId: string, userId: string) {
    this.assertConfigured();
    const state = jwt.sign(
      { purpose: "google_drive", provider: "google", clinicId, userId } satisfies DriveOAuthState,
      config.jwt.secret,
      { expiresIn: "20m" },
    );
    const params = new URLSearchParams({
      client_id: config.oauth.google.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: ["openid", "email", "profile", ...config.googleDrive.scopes].join(" "),
      state,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    });
    if (config.oauth.google.allowedDomains.length === 1) {
      params.set("hd", config.oauth.google.allowedDomains[0]!);
    }
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  isDriveOAuthState(state: string) {
    if (!state) return false;
    try {
      // This only selects the correct error/redirect flow. completeOAuth performs
      // the cryptographic verification before reading or acting on the payload.
      const payload = jwt.decode(state) as Partial<DriveOAuthState> | null;
      return Boolean(payload && payload.purpose === "google_drive" && payload.provider === "google");
    } catch {
      return false;
    }
  }

  async completeOAuth(
    code: string,
    state: string,
    audit: { ipAddress: string | null; userAgent: string | null },
  ) {
    this.assertConfigured();
    if (!code) throw ApiError.badRequest("Google did not return an authorization code.");
    let statePayload: DriveOAuthState;
    try {
      statePayload = jwt.verify(state, config.jwt.secret) as DriveOAuthState;
    } catch {
      throw ApiError.badRequest("Google Drive connection session expired. Return to Integrations and try again.");
    }
    if (
      statePayload.purpose !== "google_drive" ||
      statePayload.provider !== "google" ||
      !statePayload.clinicId ||
      !statePayload.userId
    ) {
      throw ApiError.badRequest("Google Drive OAuth state is invalid.");
    }

    const [userRows]: any = await pool.execute(
      `SELECT u.email, COALESCE(cm.role, u.role) as role
       FROM user u
       INNER JOIN clinic_membership cm ON cm.user_id = u.id
       WHERE u.id = ? AND cm.clinic_id = ? AND cm.status = 'active'
         AND u.deleted_at IS NULL
       LIMIT 1`,
      [statePayload.userId, statePayload.clinicId],
    );
    if (!userRows[0]) throw ApiError.forbidden("The initiating CRM membership is no longer active.");
    if (!roleMatchesAllowedRoles(String(userRows[0].role || ""), ["SUPER_ADMIN", "ADMIN"])) {
      throw ApiError.forbidden("Only an Admin can connect the Google Drive integration.");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.oauth.google.clientId,
        client_secret: config.oauth.google.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: this.redirectUri,
      }),
    });
    const tokenPayload: any = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      throw ApiError.badRequest(tokenPayload.error_description || tokenPayload.error || "Google Drive authorization failed.");
    }

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
    });
    const profile: any = await profileResponse.json().catch(() => ({}));
    if (!profileResponse.ok || !profile.email || profile.email_verified !== true) {
      throw ApiError.forbidden("Google did not return a verified Workspace email.");
    }
    const email = String(profile.email).trim().toLowerCase();
    if (decideGoogleOAuthAccess(email, true, config.oauth.google.allowedDomains) === "reject") {
      throw ApiError.forbidden("Use a permitted leapdigital.online Google Workspace account.");
    }
    const existing = await this.getIntegration(statePayload.clinicId);
    const existingConfig = parseStoredConfig(existing?.config);
    const refreshToken = tokenPayload.refresh_token || decryptToken(existingConfig.encryptedRefreshToken);
    if (!refreshToken) {
      throw ApiError.badRequest("Google did not issue offline Drive access. Reconnect and approve access.");
    }
    const connectedAt = new Date().toISOString();
    const expiresAt = tokenPayload.expires_in
      ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000).toISOString()
      : null;
    const storedConfig: StoredDriveConfig = {
      oauthConnected: true,
      connectedEmail: email,
      connectedAt,
      tokenExpiresAt: expiresAt,
      grantedScopes: typeof tokenPayload.scope === "string"
        ? tokenPayload.scope.split(/\s+/).filter(Boolean)
        : config.googleDrive.scopes,
      encryptedAccessToken: encryptToken(String(tokenPayload.access_token)),
      encryptedRefreshToken: encryptToken(String(refreshToken)),
    };
    const integrationId = existing?.id || uuidv4();

    await pool.execute(
      `INSERT INTO integration
        (id, clinic_id, name, type, config, is_active, setup_status, health_status,
         missing_permissions, oauth_authorize_url)
       VALUES (?, ?, ?, ?, ?, 1, 'ready', 'healthy', ?, NULL)
       ON DUPLICATE KEY UPDATE
         type = VALUES(type), config = VALUES(config), is_active = 1,
         setup_status = 'ready', health_status = 'healthy', missing_permissions = VALUES(missing_permissions),
         oauth_authorize_url = NULL, updated_at = CURRENT_TIMESTAMP`,
      [integrationId, statePayload.clinicId, this.integrationName, this.integrationType, JSON.stringify(storedConfig), JSON.stringify([])],
    );
    this.tokenCache.set(statePayload.clinicId, {
      token: String(tokenPayload.access_token),
      expiresAt: expiresAt ? new Date(expiresAt).getTime() : Date.now() + 3_600_000,
    });
    await logAuditEvent({
      clinicId: statePayload.clinicId,
      userId: statePayload.userId,
      action: "GOOGLE_DRIVE_OAUTH_CONNECTED",
      entityType: "integration",
      entityId: integrationId,
      changes: { connectedEmail: email, scopes: storedConfig.grantedScopes },
      ...audit,
    });
  }

  async getStatus(clinicId: string) {
    const integration = await this.getIntegration(clinicId);
    const stored = parseStoredConfig(integration?.config);
    const hasFullAccess = Boolean(stored.grantedScopes?.includes("https://www.googleapis.com/auth/drive"));
    return {
      connected: Boolean(integration?.isActive && stored.oauthConnected && stored.encryptedRefreshToken),
      accessLevel: hasFullAccess ? "full" : "limited",
      connectedEmail: stored.connectedEmail || null,
      connectedAt: stored.connectedAt || null,
      tokenExpiresAt: stored.tokenExpiresAt || null,
      validationEnabled: config.googleDrive.validationEnabled,
    };
  }

  async getAccessToken(clinicId: string) {
    this.assertConfigured();
    const cached = this.tokenCache.get(clinicId);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

    const integration = await this.getIntegration(clinicId);
    const stored = parseStoredConfig(integration?.config);
    if (!integration?.isActive || !stored.oauthConnected) {
      throw ApiError.serviceUnavailable("Connect Google Drive on the Integrations page before saving Drive links.");
    }
    const currentAccessToken = decryptToken(stored.encryptedAccessToken);
    const currentExpiry = stored.tokenExpiresAt ? new Date(stored.tokenExpiresAt).getTime() : 0;
    if (currentAccessToken && currentExpiry > Date.now() + 60_000) {
      this.tokenCache.set(clinicId, { token: currentAccessToken, expiresAt: currentExpiry });
      return currentAccessToken;
    }
    const refreshToken = decryptToken(stored.encryptedRefreshToken);
    if (!refreshToken) throw ApiError.serviceUnavailable("Reconnect Google Drive to restore offline access.");

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.oauth.google.clientId,
        client_secret: config.oauth.google.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw ApiError.serviceUnavailable(payload.error_description || payload.error || "Google Drive access could not be refreshed.");
    }
    const token = String(payload.access_token);
    const expiresAt = new Date(Date.now() + Number(payload.expires_in || 3600) * 1000).toISOString();
    const next = { ...stored, encryptedAccessToken: encryptToken(token), tokenExpiresAt: expiresAt };
    await pool.execute(
      `UPDATE integration SET config = ?, health_status = 'healthy', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [JSON.stringify(next), integration.id, clinicId],
    );
    this.tokenCache.set(clinicId, { token, expiresAt: new Date(expiresAt).getTime() });
    return token;
  }

  async listFolders(clinicId: string, parentId = "root"): Promise<GoogleDriveFolderBrowser> {
    const accessToken = await this.getAccessToken(clinicId);
    const fields = "id,name,mimeType,webViewLink,parents,modifiedTime";
    let currentFolder: GoogleDriveFolderItem = {
      id: "root",
      name: "My Drive",
      webViewLink: "https://drive.google.com/drive/my-drive",
      parentId: null,
      modifiedTime: null,
    };

    if (parentId !== "root") {
      const currentResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(parentId)}?${new URLSearchParams({ fields, supportsAllDrives: "true" }).toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
      );
      const currentPayload: any = await currentResponse.json().catch(() => ({}));
      if (!currentResponse.ok) {
        throw ApiError.badRequest(currentPayload.error?.message || "This Google Drive folder could not be opened.");
      }
      if (currentPayload.mimeType && currentPayload.mimeType !== "application/vnd.google-apps.folder") {
        throw ApiError.badRequest("The selected Google Drive item is not a folder.");
      }
      currentFolder = this.toFolderItem(currentPayload);
    }

    const params = new URLSearchParams({
      q: `'${parentId}' in parents and trashed = false`,
      fields: `files(${fields},size)`,
      orderBy: "name_natural",
      pageSize: "100",
      spaces: "drive",
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
    });
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw ApiError.badRequest(payload.error?.message || "Google Drive folders could not be loaded.");
    }

    const items = Array.isArray(payload.files) ? payload.files : [];
    return {
      currentFolder,
      folders: items
        .filter((item: any) => item.mimeType === "application/vnd.google-apps.folder")
        .map((item: any) => this.toFolderItem(item)),
      files: items
        .filter((item: any) => item.mimeType !== "application/vnd.google-apps.folder")
        .map((item: any) => this.toFileItem(item)),
    };
  }

  async createFolder(clinicId: string, name: string, parentId = "root"): Promise<GoogleDriveFolderItem> {
    const accessToken = await this.getAccessToken(clinicId);
    const params = new URLSearchParams({
      fields: "id,name,webViewLink,parents,modifiedTime",
      supportsAllDrives: "true",
    });
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.id) {
      throw ApiError.badRequest(payload.error?.message || "The Google Drive folder could not be created.");
    }
    return this.toFolderItem(payload);
  }

  async uploadFile(clinicId: string, file: { name: string; mimeType: string; buffer: Buffer }, parentId = "root") {
    const accessToken = await this.getAccessToken(clinicId);
    const boundary = `clinic-grower-${crypto.randomBytes(12).toString("hex")}`;
    const metadata = JSON.stringify({ name: file.name, parents: [parentId] });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: ${file.mimeType || "application/octet-stream"}\r\n\r\n`),
      file.buffer,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const params = new URLSearchParams({
      uploadType: "multipart",
      fields: "id,name,mimeType,webViewLink,parents,modifiedTime,size",
      supportsAllDrives: "true",
    });
    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files?${params.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.id) {
      throw ApiError.badRequest(payload.error?.message || "The file could not be uploaded to Google Drive.");
    }
    return this.toFileItem(payload);
  }

  async renameFile(clinicId: string, fileId: string, name: string) {
    const accessToken = await this.getAccessToken(clinicId);
    const params = new URLSearchParams({
      fields: "id,name,mimeType,webViewLink,parents,modifiedTime,size",
      supportsAllDrives: "true",
    });
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params.toString()}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.id) {
      throw ApiError.badRequest(payload.error?.message || "The Google Drive file could not be renamed.");
    }
    return this.toFileItem(payload);
  }

  async deleteFile(clinicId: string, fileId: string) {
    const accessToken = await this.getAccessToken(clinicId);
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trashed: true }),
      },
    );
    if (!response.ok) {
      const payload: any = await response.json().catch(() => ({}));
      throw ApiError.badRequest(payload.error?.message || "The Google Drive file could not be moved to trash.");
    }
  }

  async downloadFile(clinicId: string, fileId: string) {
    const accessToken = await this.getAccessToken(clinicId);
    const metadataResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
    );
    const metadata: any = await metadataResponse.json().catch(() => ({}));
    if (!metadataResponse.ok || !metadata.id) {
      throw ApiError.badRequest(metadata.error?.message || "The Google Drive file could not be opened.");
    }
    if (metadata.size && Number(metadata.size) > 100 * 1024 * 1024) {
      throw ApiError.badRequest("Files larger than 100 MB must be downloaded directly from Google Drive.");
    }

    const isGoogleFile = String(metadata.mimeType || "").startsWith("application/vnd.google-apps.");
    const contentType = isGoogleFile ? "application/pdf" : String(metadata.mimeType || "application/octet-stream");
    const fileName = isGoogleFile && !String(metadata.name).toLowerCase().endsWith(".pdf")
      ? `${metadata.name}.pdf`
      : String(metadata.name || "download");
    const downloadUrl = isGoogleFile
      ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?${new URLSearchParams({ mimeType: contentType }).toString()}`
      : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
    const response = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: contentType },
    });
    if (!response.ok) {
      const payload: any = await response.json().catch(() => ({}));
      throw ApiError.badRequest(payload.error?.message || "The Google Drive file could not be downloaded.");
    }
    return { fileName, contentType, buffer: Buffer.from(await response.arrayBuffer()) };
  }

  async isItemWithinFolder(clinicId: string, itemId: string, rootFolderId: string) {
    if (itemId === rootFolderId) return true;
    const accessToken = await this.getAccessToken(clinicId);
    const visited = new Set<string>();
    let pending = [itemId];

    for (let depth = 0; depth < 50 && pending.length > 0; depth += 1) {
      const currentId = pending.shift()!;
      if (currentId === rootFolderId) return true;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(currentId)}?fields=id,parents,trashed&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
      );
      const payload: any = await response.json().catch(() => ({}));
      if (!response.ok || payload.trashed) return false;
      pending = [...pending, ...(Array.isArray(payload.parents) ? payload.parents.map(String) : [])];
    }
    return false;
  }

  private toFolderItem(value: any): GoogleDriveFolderItem {
    const id = String(value?.id || "");
    return {
      id,
      name: String(value?.name || "Untitled folder"),
      webViewLink: String(value?.webViewLink || `https://drive.google.com/drive/folders/${id}`),
      parentId: Array.isArray(value?.parents) && value.parents[0] ? String(value.parents[0]) : null,
      modifiedTime: value?.modifiedTime ? String(value.modifiedTime) : null,
    };
  }

  private toFileItem(value: any): GoogleDriveFileItem {
    const item = this.toFolderItem(value);
    return {
      ...item,
      mimeType: String(value?.mimeType || "application/octet-stream"),
      size: value?.size === undefined || value?.size === null ? null : Number(value.size),
    };
  }

  private async getIntegration(clinicId: string): Promise<{ id: string; config: unknown; isActive: boolean } | null> {
    const [rows]: any = await pool.execute(
      `SELECT id, config, is_active as isActive
       FROM integration
       WHERE clinic_id = ? AND type = ? AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId, this.integrationType],
    );
    return rows[0] || null;
  }
}

export const googleDriveOAuthService = new GoogleDriveOAuthService();
