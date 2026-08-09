import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { decryptProviderCredential, encryptProviderCredential } from "../../utils/provider-credentials.js";
import type {
  QuickBooksAuditContext,
  QuickBooksClientCustomerMappingRecord,
  QuickBooksConnectionStatus,
  QuickBooksCustomerRecord,
  SaveQuickBooksClientCustomerMappingPayload,
} from "./quickbooks.types.js";

type QuickBooksOAuthState = {
  purpose: "quickbooks";
  provider: "quickbooks";
  clinicId: string;
  userId: string;
};

type StoredQuickBooksConfig = {
  oauthConnected?: boolean;
  environment?: string;
  realmId?: string;
  companyName?: string | null;
  connectedEmail?: string | null;
  connectedAt?: string;
  tokenExpiresAt?: string | null;
  encryptedAccessToken?: string;
  encryptedRefreshToken?: string;
  lastError?: string | null;
};

const integrationType = "quickbooks";
const integrationName = "QuickBooks";

function parseStoredConfig(value: unknown): StoredQuickBooksConfig {
  if (!value) return {};
  if (typeof value === "object") return value as StoredQuickBooksConfig;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function toIso(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function assertResponseObject(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, any> : {};
}

function mapCustomer(raw: any): QuickBooksCustomerRecord {
  const primaryEmail = raw?.PrimaryEmailAddr?.Address ? String(raw.PrimaryEmailAddr.Address) : null;
  return {
    id: String(raw?.Id || ""),
    displayName: String(raw?.DisplayName || raw?.FullyQualifiedName || raw?.CompanyName || "Unnamed QuickBooks customer"),
    companyName: raw?.CompanyName ? String(raw.CompanyName) : null,
    email: primaryEmail,
    active: raw?.Active !== false,
  };
}

function mapMapping(row: any): QuickBooksClientCustomerMappingRecord {
  return {
    id: row.id,
    clientAccountProfileId: row.clientAccountProfileId,
    clientClinicId: row.clientClinicId,
    clientName: row.clientName,
    quickbooksCustomerId: row.quickbooksCustomerId,
    quickbooksCustomerName: row.quickbooksCustomerName,
    quickbooksCompanyName: row.quickbooksCompanyName || null,
    quickbooksEmail: row.quickbooksEmail || null,
    realmId: row.realmId || null,
    mappingStatus: row.mappingStatus || "active",
    mappingSource: row.mappingSource || "manual",
    lastCheckedAt: toIso(row.lastCheckedAt),
    lastError: row.lastError || null,
    updatedAt: toIso(row.updatedAt) || new Date().toISOString(),
  };
}

export class QuickBooksService {
  private tokenCache = new Map<string, { token: string; expiresAt: number }>();

  private get redirectUri() {
    return `${config.apiPublicUrl.replace(/\/$/, "")}/quickbooks/oauth/callback`;
  }

  private get apiBaseUrl() {
    return config.quickbooks.environment === "production"
      ? config.quickbooks.productionApiBaseUrl
      : config.quickbooks.sandboxApiBaseUrl;
  }

  private assertConfigured() {
    if (!config.quickbooks.oauthEnabled) {
      throw ApiError.serviceUnavailable("QuickBooks OAuth is not enabled.");
    }
    if (!config.quickbooks.clientId || !config.quickbooks.clientSecret) {
      throw ApiError.serviceUnavailable("QuickBooks OAuth credentials are not configured.");
    }
  }

  async getStatus(clinicId: string): Promise<QuickBooksConnectionStatus> {
    const integration = await this.getIntegration(clinicId);
    const stored = parseStoredConfig(integration?.config);
    return {
      connected: Boolean(integration?.isActive && stored.oauthConnected && stored.encryptedRefreshToken && stored.realmId),
      enabled: config.quickbooks.oauthEnabled,
      environment: config.quickbooks.environment,
      realmId: stored.realmId || null,
      companyName: stored.companyName || null,
      connectedEmail: stored.connectedEmail || null,
      connectedAt: stored.connectedAt || null,
      tokenExpiresAt: stored.tokenExpiresAt || null,
      lastSync: toIso(integration?.lastSync),
      lastError: stored.lastError || null,
    };
  }

  getAuthorizationUrl(clinicId: string, userId: string) {
    this.assertConfigured();
    const state = jwt.sign(
      { purpose: "quickbooks", provider: "quickbooks", clinicId, userId } satisfies QuickBooksOAuthState,
      config.jwt.secret,
      { expiresIn: "20m" },
    );
    const params = new URLSearchParams({
      client_id: config.quickbooks.clientId,
      response_type: "code",
      scope: config.quickbooks.scopes.join(" "),
      redirect_uri: this.redirectUri,
      state,
    });
    return `${config.quickbooks.authorizeUrl}?${params.toString()}`;
  }

  async completeOAuth(code: string, state: string, realmId: string, context: QuickBooksAuditContext = {}) {
    this.assertConfigured();
    const statePayload = this.decodeState(state);
    if (!statePayload?.clinicId || !statePayload.userId) {
      throw ApiError.badRequest("Invalid QuickBooks OAuth state.");
    }
    const token = await this.exchangeCode(code);
    const expiresAt = new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString();
    const storedConfig: StoredQuickBooksConfig = {
      oauthConnected: true,
      environment: config.quickbooks.environment,
      realmId,
      connectedEmail: null,
      connectedAt: new Date().toISOString(),
      tokenExpiresAt: expiresAt,
      encryptedAccessToken: encryptProviderCredential(String(token.access_token || "")),
      lastError: null,
    };
    if (token.refresh_token) {
      storedConfig.encryptedRefreshToken = encryptProviderCredential(String(token.refresh_token));
    }

    try {
      const companyName = await this.fetchCompanyName(String(token.access_token || ""), realmId);
      storedConfig.companyName = companyName;
    } catch (error) {
      storedConfig.companyName = null;
      storedConfig.lastError = error instanceof Error ? error.message : "QuickBooks company details could not be loaded.";
    }

    const integrationId = await this.upsertIntegration(statePayload.clinicId, storedConfig);
    this.tokenCache.set(statePayload.clinicId, { token: String(token.access_token || ""), expiresAt: new Date(expiresAt).getTime() });
    await logAuditEvent({
      clinicId: statePayload.clinicId,
      userId: statePayload.userId,
      action: "QUICKBOOKS_CONNECTED",
      entityType: "integration",
      entityId: integrationId,
      changes: { realmId, environment: config.quickbooks.environment, companyName: storedConfig.companyName },
      ...context,
    });
    return this.getStatus(statePayload.clinicId);
  }

  async revoke(clinicId: string, userId: string, context: QuickBooksAuditContext = {}) {
    const integration = await this.getIntegration(clinicId);
    if (!integration) return this.getStatus(clinicId);
    const stored = parseStoredConfig(integration.config);
    await pool.execute(
      `UPDATE integration
       SET is_active = 0,
           config = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ?`,
      [
        JSON.stringify({
          ...stored,
          oauthConnected: false,
          encryptedAccessToken: undefined,
          encryptedRefreshToken: undefined,
          tokenExpiresAt: null,
        }),
        integration.id,
        clinicId,
      ],
    );
    this.tokenCache.delete(clinicId);
    await logAuditEvent({
      clinicId,
      userId,
      action: "QUICKBOOKS_REVOKED",
      entityType: "integration",
      entityId: integration.id,
      changes: { realmId: stored.realmId || null },
      ...context,
    });
    return this.getStatus(clinicId);
  }

  async listCustomers(clinicId: string, search?: string): Promise<QuickBooksCustomerRecord[]> {
    const status = await this.getStatus(clinicId);
    if (!status.connected || !status.realmId) {
      throw ApiError.serviceUnavailable("QuickBooks is not connected.");
    }
    const accessToken = await this.getAccessToken(clinicId);
    const pageSize = Math.min(Math.max(config.quickbooks.customerPageSize, 1), 100);
    const cleanedSearch = cleanString(search);
    const escapedSearch = cleanedSearch?.replace(/'/g, "\\'");
    const where = escapedSearch ? ` WHERE DisplayName LIKE '%${escapedSearch}%'` : "";
    const query = `SELECT * FROM Customer${where} STARTPOSITION 1 MAXRESULTS ${pageSize}`;
    const url = `${this.apiBaseUrl}/v3/company/${encodeURIComponent(status.realmId)}/query?query=${encodeURIComponent(query)}&minorversion=75`;
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = assertResponseObject(await response.json().catch(() => ({})));
      if (!response.ok) {
        throw new Error(payload.Fault?.Error?.[0]?.Message || `QuickBooks customers request failed with ${response.status}`);
      }
      return (payload.QueryResponse?.Customer || []).map(mapCustomer).filter((customer: QuickBooksCustomerRecord) => customer.id);
    } catch (error) {
      await this.recordError(clinicId, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async getCustomerById(clinicId: string, realmId: string, customerId: string): Promise<QuickBooksCustomerRecord | null> {
    const accessToken = await this.getAccessToken(clinicId);
    const escapedId = customerId.replace(/'/g, "\\'");
    const query = `SELECT * FROM Customer WHERE Id = '${escapedId}' STARTPOSITION 1 MAXRESULTS 1`;
    const url = `${this.apiBaseUrl}/v3/company/${encodeURIComponent(realmId)}/query?query=${encodeURIComponent(query)}&minorversion=75`;
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = assertResponseObject(await response.json().catch(() => ({})));
      if (!response.ok) {
        throw new Error(payload.Fault?.Error?.[0]?.Message || `QuickBooks customer validation failed with ${response.status}`);
      }
      const customer = (payload.QueryResponse?.Customer || [])
        .map(mapCustomer)
        .find((item: QuickBooksCustomerRecord) => item.id === customerId);
      return customer?.active ? customer : null;
    } catch (error) {
      await this.recordError(clinicId, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getClientMapping(clinicId: string, clientAccountProfileId: string) {
    await this.ensureClientProfileAvailable(clinicId, clientAccountProfileId);
    const [rows]: any = await pool.execute(
      `SELECT ${this.mappingColumns()}
       FROM quickbooks_client_customer_mapping m
       JOIN client_account_profile cap ON cap.id = m.client_account_profile_id
       JOIN clinic client ON client.id = cap.clinic_id
       WHERE m.clinic_id = ?
         AND m.client_account_profile_id = ?
         AND m.deleted_at IS NULL
       LIMIT 1`,
      [clinicId, clientAccountProfileId],
    );
    return rows[0] ? mapMapping(rows[0]) : null;
  }

  async saveClientMapping(
    clinicId: string,
    userId: string,
    clientAccountProfileId: string,
    data: SaveQuickBooksClientCustomerMappingPayload,
    context: QuickBooksAuditContext = {},
  ) {
    await this.ensureClientProfileAvailable(clinicId, clientAccountProfileId);
    const status = await this.getStatus(clinicId);
    if (!status.connected || !status.realmId) {
      throw ApiError.serviceUnavailable("QuickBooks must be connected before customer mapping. Manual invoice and payment fields remain usable.");
    }
    const quickbooksCustomerId = data.quickbooksCustomerId.trim();
    const verifiedCustomer = await this.getCustomerById(clinicId, status.realmId, quickbooksCustomerId);
    if (!verifiedCustomer) {
      throw ApiError.badRequest("QuickBooks customer could not be found or is inactive.");
    }
    await this.ensureCustomerNotMappedElsewhere(clinicId, clientAccountProfileId, status.realmId, quickbooksCustomerId);
    const mappingId = uuidv4();
    await pool.execute(
      `INSERT INTO quickbooks_client_customer_mapping
        (id, clinic_id, client_account_profile_id, quickbooks_customer_id, quickbooks_customer_name,
         quickbooks_company_name, quickbooks_email, realm_id, mapping_status, mapping_source,
         last_checked_at, last_error, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, NULL, ?, ?)
       ON DUPLICATE KEY UPDATE
         quickbooks_customer_id = VALUES(quickbooks_customer_id),
         quickbooks_customer_name = VALUES(quickbooks_customer_name),
         quickbooks_company_name = VALUES(quickbooks_company_name),
         quickbooks_email = VALUES(quickbooks_email),
         realm_id = VALUES(realm_id),
         mapping_status = VALUES(mapping_status),
         mapping_source = VALUES(mapping_source),
         last_checked_at = CURRENT_TIMESTAMP,
         last_error = NULL,
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP,
         deleted_at = NULL`,
      [
        mappingId,
        clinicId,
        clientAccountProfileId,
        verifiedCustomer.id,
        verifiedCustomer.displayName,
        verifiedCustomer.companyName,
        verifiedCustomer.email,
        status.realmId,
        data.mappingStatus || "active",
        data.mappingSource || "quickbooks_lookup",
        userId,
        userId,
      ],
    );
    await logAuditEvent({
      clinicId,
      userId,
      action: "QUICKBOOKS_CLIENT_CUSTOMER_MAPPED",
      entityType: "client_account_profile",
      entityId: clientAccountProfileId,
      changes: {
        quickbooksCustomerId: verifiedCustomer.id,
        quickbooksCustomerName: verifiedCustomer.displayName,
      },
      ...context,
    });
    return this.getClientMapping(clinicId, clientAccountProfileId);
  }

  async deleteClientMapping(clinicId: string, userId: string, clientAccountProfileId: string, context: QuickBooksAuditContext = {}) {
    await this.ensureClientProfileAvailable(clinicId, clientAccountProfileId);
    await pool.execute(
      `UPDATE quickbooks_client_customer_mapping
       SET mapping_status = 'archived',
           deleted_at = CURRENT_TIMESTAMP,
           updated_by = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ? AND client_account_profile_id = ? AND deleted_at IS NULL`,
      [userId, clinicId, clientAccountProfileId],
    );
    await logAuditEvent({
      clinicId,
      userId,
      action: "QUICKBOOKS_CLIENT_CUSTOMER_UNMAPPED",
      entityType: "client_account_profile",
      entityId: clientAccountProfileId,
      changes: {},
      ...context,
    });
    return null;
  }

  private decodeState(state: string): QuickBooksOAuthState {
    try {
      const payload = jwt.verify(state, config.jwt.secret) as QuickBooksOAuthState;
      if (payload?.purpose === "quickbooks" && payload.provider === "quickbooks") return payload;
    } catch {
      // Fall through to the standard API error.
    }
    throw ApiError.badRequest("Invalid QuickBooks OAuth state.");
  }

  private async exchangeCode(code: string) {
    const auth = Buffer.from(`${config.quickbooks.clientId}:${config.quickbooks.clientSecret}`).toString("base64");
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri,
    });
    const response = await fetch(config.quickbooks.tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const payload = assertResponseObject(await response.json().catch(() => ({})));
    if (!response.ok) {
      throw ApiError.badRequest(payload.error_description || payload.error || "QuickBooks authorization failed.");
    }
    if (!payload.access_token || !payload.refresh_token) {
      throw ApiError.badRequest("QuickBooks did not return refreshable OAuth tokens.");
    }
    return payload;
  }

  private async refreshAccessToken(clinicId: string, integration: any, stored: StoredQuickBooksConfig) {
    const refreshToken = decryptProviderCredential(stored.encryptedRefreshToken);
    if (!refreshToken) throw ApiError.serviceUnavailable("QuickBooks refresh token is not available.");
    const auth = Buffer.from(`${config.quickbooks.clientId}:${config.quickbooks.clientSecret}`).toString("base64");
    const response = await fetch(config.quickbooks.tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    const payload = assertResponseObject(await response.json().catch(() => ({})));
    if (!response.ok || !payload.access_token) {
      throw ApiError.serviceUnavailable(payload.error_description || payload.error || "QuickBooks token refresh failed.");
    }
    const expiresAt = new Date(Date.now() + Number(payload.expires_in || 3600) * 1000).toISOString();
    const nextConfig = {
      ...stored,
      encryptedAccessToken: encryptProviderCredential(String(payload.access_token)),
      encryptedRefreshToken: payload.refresh_token
        ? encryptProviderCredential(String(payload.refresh_token))
        : stored.encryptedRefreshToken,
      tokenExpiresAt: expiresAt,
      lastError: null,
    };
    await pool.execute(
      "UPDATE integration SET config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ?",
      [JSON.stringify(nextConfig), integration.id, clinicId],
    );
    this.tokenCache.set(clinicId, { token: String(payload.access_token), expiresAt: new Date(expiresAt).getTime() });
    return String(payload.access_token);
  }

  private async getAccessToken(clinicId: string) {
    this.assertConfigured();
    const cached = this.tokenCache.get(clinicId);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const integration = await this.getIntegration(clinicId);
    const stored = parseStoredConfig(integration?.config);
    if (!integration?.isActive || !stored.oauthConnected) throw ApiError.serviceUnavailable("QuickBooks is not connected.");
    const currentAccessToken = decryptProviderCredential(stored.encryptedAccessToken);
    const currentExpiry = stored.tokenExpiresAt ? new Date(stored.tokenExpiresAt).getTime() : 0;
    if (currentAccessToken && currentExpiry > Date.now() + 60_000) {
      this.tokenCache.set(clinicId, { token: currentAccessToken, expiresAt: currentExpiry });
      return currentAccessToken;
    }
    return this.refreshAccessToken(clinicId, integration, stored);
  }

  private async fetchCompanyName(accessToken: string, realmId: string) {
    const url = `${this.apiBaseUrl}/v3/company/${encodeURIComponent(realmId)}/companyinfo/${encodeURIComponent(realmId)}?minorversion=75`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = assertResponseObject(await response.json().catch(() => ({})));
    if (!response.ok) {
      throw new Error(payload.Fault?.Error?.[0]?.Message || "QuickBooks company details could not be loaded.");
    }
    return payload.CompanyInfo?.CompanyName ? String(payload.CompanyInfo.CompanyName) : null;
  }

  private async upsertIntegration(clinicId: string, storedConfig: StoredQuickBooksConfig) {
    const integrationId = uuidv4();
    await pool.execute(
      `INSERT INTO integration (id, clinic_id, name, type, config, is_active, last_sync)
       VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         type = VALUES(type),
         config = VALUES(config),
         is_active = 1,
         last_sync = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP,
         deleted_at = NULL`,
      [integrationId, clinicId, integrationName, integrationType, JSON.stringify(storedConfig)],
    );
    const integration = await this.getIntegration(clinicId);
    return integration?.id || integrationId;
  }

  private async recordError(clinicId: string, message: string) {
    const integration = await this.getIntegration(clinicId);
    if (!integration) return;
    const stored = parseStoredConfig(integration.config);
    await pool.execute(
      "UPDATE integration SET config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ?",
      [JSON.stringify({ ...stored, lastError: message.slice(0, 500) }), integration.id, clinicId],
    );
  }

  private async getIntegration(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              config,
              is_active as isActive,
              last_sync as lastSync
       FROM integration
       WHERE clinic_id = ?
         AND name = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId, integrationName],
    );
    return rows[0] || null;
  }

  private mappingColumns() {
    return `m.id,
            m.client_account_profile_id as clientAccountProfileId,
            cap.clinic_id as clientClinicId,
            client.name as clientName,
            m.quickbooks_customer_id as quickbooksCustomerId,
            m.quickbooks_customer_name as quickbooksCustomerName,
            m.quickbooks_company_name as quickbooksCompanyName,
            m.quickbooks_email as quickbooksEmail,
            m.realm_id as realmId,
            m.mapping_status as mappingStatus,
            m.mapping_source as mappingSource,
            m.last_checked_at as lastCheckedAt,
            m.last_error as lastError,
            m.updated_at as updatedAt`;
  }

  private async ensureClientProfileAvailable(clinicId: string, profileId: string) {
    const [rows]: any = await pool.execute(
      `SELECT cap.id
       FROM client_account_profile cap
       LEFT JOIN client_account_contact cac
         ON cac.client_account_profile_id = cap.id
        AND cac.clinic_id = ?
       LEFT JOIN task t
         ON t.client_account_profile_id = cap.id
        AND t.clinic_id = ?
        AND t.deleted_at IS NULL
       LEFT JOIN deal d
         ON d.client_account_profile_id = cap.id
        AND d.clinic_id = ?
        AND d.deleted_at IS NULL
       WHERE cap.id = ?
         AND (cap.clinic_id = ? OR cac.id IS NOT NULL OR t.id IS NOT NULL OR d.id IS NOT NULL)
       LIMIT 1`,
      [clinicId, clinicId, clinicId, profileId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Client account was not found for this workspace.");
  }

  private async ensureCustomerNotMappedElsewhere(
    clinicId: string,
    clientAccountProfileId: string,
    realmId: string | null,
    quickbooksCustomerId: string,
  ) {
    const [rows]: any = await pool.execute(
      `SELECT client_account_profile_id as clientAccountProfileId
       FROM quickbooks_client_customer_mapping
       WHERE clinic_id = ?
         AND quickbooks_customer_id = ?
         AND COALESCE(realm_id, '') = COALESCE(?, '')
         AND client_account_profile_id <> ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId, quickbooksCustomerId, realmId || null, clientAccountProfileId],
    );
    if (rows[0]) {
      throw ApiError.conflict("This QuickBooks customer is already mapped to another Mission Control client.");
    }
  }
}

export const quickBooksService = new QuickBooksService();
