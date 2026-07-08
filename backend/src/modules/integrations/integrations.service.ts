import pool from "../../config/database.js";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import {
  ConnectIntegrationDTO,
  ConnectorDefinitionResponse,
  ConnectorAccountChoice,
  ConnectorMetricRowDTO,
  ConnectorOAuthCallbackDTO,
  ConnectorOAuthStartDTO,
  ConnectorSelectionDTO,
  ConnectorSetupDTO,
  ConnectorStatusResponse,
  ConnectorSyncDTO,
  IntegrationResponse,
  MarketingConnectorType,
  UpdateIntegrationDTO,
} from "./integrations.types.js";

const CONNECTORS: Record<MarketingConnectorType, {
  name: string;
  supportedMetrics: string[];
  spendSource: string | null;
  oauthProvider: "google" | "meta" | null;
  requiredScopes: string[];
  configFields: { key: string; label: string; required: boolean; placeholder?: string }[];
}> = {
  google_ads: {
    name: "Google Ads",
    supportedMetrics: ["spend", "impressions", "clicks", "conversions", "cost_per_conversion"],
    spendSource: "google_ads",
    oauthProvider: "google",
    requiredScopes: ["https://www.googleapis.com/auth/adwords"],
    configFields: [
      { key: "customerId", label: "Customer ID", required: true, placeholder: "123-456-7890" },
    ],
  },
  meta: {
    name: "Meta Ads",
    supportedMetrics: ["spend", "impressions", "clicks", "leads", "conversions"],
    spendSource: "meta_ads",
    oauthProvider: "meta",
    requiredScopes: ["ads_read", "business_management"],
    configFields: [
      { key: "adAccountId", label: "Ad account ID", required: true, placeholder: "act_123456789" },
      { key: "businessId", label: "Business ID", required: false, placeholder: "Optional" },
    ],
  },
  google_business_profile: {
    name: "Google Business Profile",
    supportedMetrics: ["calls", "website_clicks", "directions", "profile_views", "messages"],
    spendSource: null,
    oauthProvider: "google",
    requiredScopes: ["https://www.googleapis.com/auth/business.manage"],
    configFields: [
      { key: "accountId", label: "GBP account ID", required: false, placeholder: "Optional until OAuth returns accounts" },
      { key: "locationId", label: "GBP location ID", required: false, placeholder: "Optional until OAuth returns locations" },
    ],
  },
  ga4: {
    name: "Google Analytics 4",
    supportedMetrics: ["sessions", "users", "conversions", "engagement_rate", "source_medium"],
    spendSource: null,
    oauthProvider: "google",
    requiredScopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    configFields: [
      { key: "propertyId", label: "GA4 property ID", required: true, placeholder: "123456789" },
    ],
  },
  seo: {
    name: "SEO",
    supportedMetrics: ["organic_clicks", "organic_impressions", "average_position"],
    spendSource: null,
    oauthProvider: "google",
    requiredScopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    configFields: [
      { key: "siteUrl", label: "Site URL", required: true, placeholder: "https://exampleclinic.com" },
    ],
  },
};

const spendMetricNames = new Set(["spend", "cost", "ad_spend"]);

function formatGoogleDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getDefaultSyncDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  return {
    startDate: formatGoogleDate(start),
    endDate: formatGoogleDate(end),
  };
}

function compactCustomerId(value: unknown) {
  return String(value || "").replace(/[^\d]/g, "");
}

function normalizeProviderErrorMessage(
  fallback: string,
  payload: any,
  providerMessage?: string,
) {
  const details = payload?.error?.details || [];
  const googleAdsFailure = details.find((detail: any) => Array.isArray(detail?.errors));
  const googleAdsError = googleAdsFailure?.errors?.find((error: any) => error?.message);
  const streamError = Array.isArray(payload)
    ? payload.find((item) => item?.error?.message || item?.message)
    : null;
  const message = providerMessage ||
    googleAdsError?.message ||
    payload?.error?.message ||
    payload?.message ||
    streamError?.error?.message ||
    streamError?.message ||
    fallback;
  if (/quota exceeded|requests per minute|rate limit/i.test(message)) {
    return "Google API quota was temporarily exceeded. Wait a minute, then retry loading accounts.";
  }
  return message;
}

function parseCachedAccountChoices(value: unknown): ConnectorAccountChoice[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((choice) => choice && typeof choice === "object")
    .map((choice: any) => ({
      id: String(choice.id || ""),
      label: String(choice.label || choice.id || ""),
      description: choice.description ? String(choice.description) : null,
      metadata: choice.metadata && typeof choice.metadata === "object" ? choice.metadata : {},
    }))
    .filter((choice) => choice.id && choice.label);
}

function parseConfig(value: unknown) {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, unknown>;

  try {
    return JSON.parse(String(value)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseStringArray(value: unknown) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function getSetupStatus(
  config: Record<string, unknown>,
  oauthAuthorizeUrl: string | null,
  missingPermissions: string[],
) {
  if (missingPermissions.length > 0) return "missing_permissions";
  if (oauthAuthorizeUrl && !hasOAuthCredentials(config)) return "needs_oauth";
  return "ready";
}

function hasOAuthCredentials(config: Record<string, unknown>) {
  return Boolean(
    config.oauthConnected ||
    config.accessToken ||
    config.refreshToken ||
    config.encryptedAccessToken ||
    config.encryptedRefreshToken
  );
}

function sanitizeConfig(value: unknown) {
  const parsed = parseConfig(value);
  if (!parsed) return null;
  const sensitiveKeys = new Set([
    "accessToken",
    "refreshToken",
    "idToken",
    "encryptedAccessToken",
    "encryptedRefreshToken",
    "encryptedIdToken",
  ]);
  return Object.fromEntries(
    Object.entries(parsed)
      .filter(([key]) => !sensitiveKeys.has(key))
      .map(([key, entry]) => [key, key.toLowerCase().includes("secret") ? "[redacted]" : entry]),
  );
}

function encryptToken(value: string) {
  const key = crypto.createHash("sha256").update(config.jwt.secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "enc:v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

function decryptToken(value: unknown) {
  const raw = typeof value === "string" ? value : "";
  if (!raw.startsWith("enc:v1:")) return raw || null;
  const [, , ivValue, tagValue, encryptedValue] = raw.split(":");
  if (!ivValue || !tagValue || !encryptedValue) return null;
  const key = crypto.createHash("sha256").update(config.jwt.secret).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function parseOAuthState(state: string) {
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    return {
      clinicId: typeof parsed.clinicId === "string" ? parsed.clinicId : "",
      type: typeof parsed.type === "string" ? parsed.type : "",
    };
  } catch {
    return { clinicId: "", type: "" };
  }
}

function getRequiredConfigFields(type: MarketingConnectorType) {
  if (type === "google_business_profile") return ["locationId"];
  return CONNECTORS[type].configFields.filter((field) => field.required).map((field) => field.key);
}

function getConnectorSelectionState(type: MarketingConnectorType, integration?: IntegrationResponse) {
  const connectorConfig = integration?.config || {};
  const requiredFields = getRequiredConfigFields(type);
  const oauthConnected = Boolean(
    connectorConfig.oauthConnected ||
    connectorConfig.encryptedAccessToken ||
    connectorConfig.encryptedRefreshToken
  );
  const selectionRequired = Boolean(
    CONNECTORS[type].oauthProvider &&
    oauthConnected &&
    requiredFields.some((field) => !String(connectorConfig[field] || "").trim())
  );
  return {
    oauthConnected,
    selectionRequired,
    selectedAccountLabel: typeof connectorConfig.selectedAccountLabel === "string"
      ? connectorConfig.selectedAccountLabel
      : null,
    requiredFields,
  };
}

function getDataFreshness(value: unknown) {
  if (!value) return { status: "never_synced" as const, ageHours: null };
  const ageHours = Math.max(0, Math.round((Date.now() - new Date(value as any).getTime()) / 36_000) / 100);
  return {
    status: ageHours <= 48 ? "fresh" as const : "stale" as const,
    ageHours,
  };
}

function normalizeMetricName(value: string) {
  return value.trim().toLowerCase();
}

export class IntegrationsService {
  listConnectorDefinitions(): ConnectorDefinitionResponse[] {
    return Object.entries(CONNECTORS).map(([type, definition]) => ({
      type: type as MarketingConnectorType,
      name: definition.name,
      oauthProvider: definition.oauthProvider,
      oauthSupported: definition.oauthProvider !== null,
      requiredScopes: definition.requiredScopes,
      configFields: definition.configFields,
      supportedMetrics: definition.supportedMetrics,
      manualFallbackAvailable: true,
    }));
  }

  // Return clinic integrations without exposing deleted rows
  async listIntegrations(clinicId: string): Promise<IntegrationResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT id,
              name,
              type,
              config,
              is_active as isActive,
              setup_status as setupStatus,
              health_status as healthStatus,
              last_sync as lastSync,
              last_sync_status as lastSyncStatus,
              last_sync_error as lastSyncError,
              last_sync_started_at as lastSyncStartedAt,
              last_sync_completed_at as lastSyncCompletedAt,
              missing_permissions as missingPermissions,
              oauth_authorize_url as oauthAuthorizeUrl
       FROM integration
       WHERE clinic_id = ? AND deleted_at IS NULL
       ORDER BY name ASC`,
      [clinicId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      isActive: !!row.isActive,
      setupStatus: row.setupStatus || "not_configured",
      healthStatus: row.healthStatus || "unknown",
      lastSync: row.lastSync ? new Date(row.lastSync).toISOString() : null,
      lastSyncStatus: row.lastSyncStatus || "never",
      lastSyncError: row.lastSyncError || null,
      lastSyncStartedAt: row.lastSyncStartedAt ? new Date(row.lastSyncStartedAt).toISOString() : null,
      lastSyncCompletedAt: row.lastSyncCompletedAt ? new Date(row.lastSyncCompletedAt).toISOString() : null,
      missingPermissions: parseStringArray(row.missingPermissions),
      oauthAuthorizeUrl: row.oauthAuthorizeUrl || null,
      dataFreshness: getDataFreshness(row.lastSyncCompletedAt || row.lastSync),
      config: sanitizeConfig(row.config),
    }));
  }

  async listConnectorStatuses(clinicId: string): Promise<ConnectorStatusResponse[]> {
    const integrations = await this.listIntegrations(clinicId);
    const byType = new Map(integrations.map((integration) => [integration.type, integration]));

    return Object.entries(CONNECTORS).map(([type, definition]) => {
      const integration = byType.get(type);
      const selectionState = getConnectorSelectionState(type as MarketingConnectorType, integration);
      const configured = Boolean(
        integration?.isActive &&
        integration?.setupStatus === "ready" &&
        !selectionState.selectionRequired,
      );

      return {
        type: type as MarketingConnectorType,
        name: definition.name,
        integrationId: integration?.id || null,
        configured,
        oauthConnected: selectionState.oauthConnected,
        selectionRequired: selectionState.selectionRequired,
        selectedAccountLabel: selectionState.selectedAccountLabel,
        setupStatus: integration?.setupStatus || "not_configured",
        healthStatus: integration?.healthStatus || "unknown",
        lastSyncStatus: integration?.lastSyncStatus || "never",
        lastSync: integration?.lastSync || null,
        lastSyncError: integration?.lastSyncError || null,
        missingPermissions: integration?.missingPermissions || [],
        oauthAuthorizeUrl: integration?.oauthAuthorizeUrl || null,
        dataFreshness: integration?.dataFreshness || { status: "never_synced", ageHours: null },
        manualFallbackAvailable: true,
        supportedMetrics: definition.supportedMetrics,
      };
    });
  }

  async setupConnector(
    clinicId: string,
    userId: string,
    type: MarketingConnectorType,
    data: ConnectorSetupDTO,
  ) {
    const definition = CONNECTORS[type];
    const missingPermissions = data.missingPermissions || [];
    const config = await this.mergeConnectorSetupConfig(clinicId, type, data);
    const setupStatus = getSetupStatus(config, data.oauthAuthorizeUrl || null, missingPermissions);
    const healthStatus = setupStatus === "ready" ? "healthy" : setupStatus === "missing_permissions" ? "warning" : "unknown";
    const id = await this.upsertConnector(clinicId, type, {
      name: definition.name,
      config,
      isActive: data.isActive !== false,
      setupStatus,
      healthStatus,
      missingPermissions,
      oauthAuthorizeUrl: data.oauthAuthorizeUrl || null,
    });

    await logAuditEvent({
      clinicId,
      userId,
      action: "MARKETING_CONNECTOR_SETUP_UPDATED",
      entityType: "integration",
      entityId: id,
      changes: { type, setupStatus, healthStatus, missingPermissions },
    });

    return this.getConnectorStatus(clinicId, type);
  }

  private async mergeConnectorSetupConfig(
    clinicId: string,
    type: MarketingConnectorType,
    data: ConnectorSetupDTO,
  ) {
    const config = data.config || {};
    if (data.isActive === false) return config;

    try {
      const existing = (await this.getConnectorConfig(clinicId, type)).config;
      return { ...existing, ...config };
    } catch (error) {
      if (error instanceof ApiError) return config;
      throw error;
    }
  }

  async startConnectorOAuth(
    clinicId: string,
    userId: string,
    type: MarketingConnectorType,
    data: ConnectorOAuthStartDTO,
  ) {
    const definition = CONNECTORS[type];
    if (!definition.oauthProvider) {
      throw ApiError.badRequest(`${definition.name} uses manual setup and does not support OAuth in Phase 1`);
    }

    const providerConfig = definition.oauthProvider === "google"
      ? config.oauth.google
      : config.oauth.facebook;
    const clientId =
      providerConfig.clientId ||
      (config.nodeEnv === "production" ? "" : "development-oauth-client");
    if (!clientId) {
      throw ApiError.badRequest(`${definition.name} OAuth client ID is not configured`);
    }

    const state = Buffer.from(
      JSON.stringify({
        clinicId,
        type,
        nonce: uuidv4(),
        createdAt: new Date().toISOString(),
      }),
    ).toString("base64url");
    const redirectUri = `${config.apiPublicUrl.replace(/\/$/, "")}/integrations/connectors/${type}/oauth/callback`;
    const authorizeUrl = this.buildAuthorizeUrl(type, definition.oauthProvider, clientId, redirectUri, state);
    const setupStatus = "needs_oauth";
    let existingConfig: Record<string, unknown> = {};
    try {
      existingConfig = (await this.getConnectorConfig(clinicId, type)).config;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
    const integrationId = await this.upsertConnector(clinicId, type, {
      name: definition.name,
      config: {
        ...existingConfig,
        ...(data.config || {}),
        oauthProvider: definition.oauthProvider,
        oauthState: state,
        oauthStartedAt: new Date().toISOString(),
      },
      isActive: true,
      setupStatus,
      healthStatus: "unknown",
      missingPermissions: definition.requiredScopes,
      oauthAuthorizeUrl: authorizeUrl,
    });

    await logAuditEvent({
      clinicId,
      userId,
      action: "MARKETING_CONNECTOR_OAUTH_STARTED",
      entityType: "integration",
      entityId: integrationId,
      changes: { type, provider: definition.oauthProvider },
    });

    return {
      type,
      authorizeUrl,
      state,
      setupStatus,
    };
  }

  async completeConnectorOAuth(
    clinicId: string,
    userId: string | null,
    type: MarketingConnectorType,
    data: ConnectorOAuthCallbackDTO,
  ) {
    const definition = CONNECTORS[type];
    if (!definition.oauthProvider) {
      throw ApiError.badRequest(`${definition.name} does not support OAuth in Phase 1`);
    }

    const [rows]: any = await pool.execute(
      `SELECT id, config
       FROM integration
       WHERE clinic_id = ?
         AND type = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId, type],
    );
    if (!rows[0]) throw ApiError.notFound("Connector setup not found");

    const existingConfig = parseConfig(rows[0].config) || {};
    if (existingConfig.oauthState && existingConfig.oauthState !== data.state) {
      throw ApiError.badRequest("OAuth state does not match the active setup flow");
    }

    const nextConfig = {
      ...existingConfig,
      oauthConnected: true,
      oauthCompletedAt: new Date().toISOString(),
      authorizationCodeLast4: data.code.slice(-4),
      tokenExchangeStatus: "pending_server_exchange",
    };

    await pool.execute(
      `UPDATE integration
       SET config = ?,
           is_active = 1,
           setup_status = 'ready',
           health_status = 'healthy',
           missing_permissions = ?,
           oauth_authorize_url = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [JSON.stringify(nextConfig), JSON.stringify([]), rows[0].id, clinicId],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "MARKETING_CONNECTOR_OAUTH_COMPLETED",
      entityType: "integration",
      entityId: rows[0].id,
      changes: { type, provider: definition.oauthProvider },
    });

    return this.getConnectorStatus(clinicId, type);
  }

  async completeConnectorOAuthRedirect(type: MarketingConnectorType, data: ConnectorOAuthCallbackDTO) {
    const state = parseOAuthState(data.state);
    if (!state.clinicId || state.type !== type) {
      throw ApiError.badRequest("OAuth state does not match the connector callback");
    }

    return this.completeConnectorOAuthWithExchange(state.clinicId, null, type, data);
  }

  async completeConnectorOAuthWithExchange(
    clinicId: string,
    userId: string | null,
    type: MarketingConnectorType,
    data: ConnectorOAuthCallbackDTO,
  ) {
    const definition = CONNECTORS[type];
    if (!definition.oauthProvider) {
      throw ApiError.badRequest(`${definition.name} does not support OAuth in Phase 1`);
    }

    const [rows]: any = await pool.execute(
      `SELECT id, config
       FROM integration
       WHERE clinic_id = ?
         AND type = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId, type],
    );
    if (!rows[0]) throw ApiError.notFound("Connector setup not found");

    const existingConfig = parseConfig(rows[0].config) || {};
    if (existingConfig.oauthState !== data.state) {
      throw ApiError.badRequest("OAuth state does not match the active setup flow");
    }

    const redirectUri = `${config.apiPublicUrl.replace(/\/$/, "")}/integrations/connectors/${type}/oauth/callback`;
    const tokenPayload = await this.exchangeOAuthCode(type, definition.oauthProvider, data.code, redirectUri);
    const nextConfig = {
      ...existingConfig,
      oauthConnected: true,
      oauthCompletedAt: new Date().toISOString(),
      authorizationCodeLast4: data.code.slice(-4),
      tokenExchangeStatus: "completed",
      tokenType: tokenPayload.token_type || null,
      tokenExpiresAt: tokenPayload.expires_in
        ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000).toISOString()
        : null,
      grantedScopes: typeof tokenPayload.scope === "string"
        ? tokenPayload.scope.split(/\s+/).filter(Boolean)
        : definition.requiredScopes,
      encryptedAccessToken: tokenPayload.access_token ? encryptToken(tokenPayload.access_token) : existingConfig.encryptedAccessToken,
      encryptedRefreshToken: tokenPayload.refresh_token ? encryptToken(tokenPayload.refresh_token) : existingConfig.encryptedRefreshToken,
      encryptedIdToken: tokenPayload.id_token ? encryptToken(tokenPayload.id_token) : existingConfig.encryptedIdToken,
    };

    await pool.execute(
      `UPDATE integration
       SET config = ?,
           is_active = 1,
           setup_status = 'ready',
           health_status = 'healthy',
           missing_permissions = ?,
           oauth_authorize_url = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [JSON.stringify(nextConfig), JSON.stringify([]), rows[0].id, clinicId],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "MARKETING_CONNECTOR_OAUTH_TOKEN_EXCHANGED",
      entityType: "integration",
      entityId: rows[0].id,
      changes: { type, provider: definition.oauthProvider },
    });

    return this.getConnectorStatus(clinicId, type);
  }

  async listConnectorAccountChoices(
    clinicId: string,
    type: MarketingConnectorType,
  ): Promise<ConnectorAccountChoice[]> {
    const definition = CONNECTORS[type];
    if (!definition.oauthProvider) {
      throw ApiError.badRequest(`${definition.name} uses manual setup and does not expose provider account choices`);
    }

    const { config: connectorConfig, integrationId } = await this.getConnectorConfig(clinicId, type);
    const accessToken = await this.getProviderAccessToken(clinicId, type, connectorConfig, integrationId);
    if (!accessToken) {
      throw ApiError.badRequest(`${definition.name} is not OAuth connected yet`);
    }

    const cachedChoices = parseCachedAccountChoices(connectorConfig.accountChoiceCache);
    try {
      let choices: ConnectorAccountChoice[] = [];
      if (type === "google_ads") choices = await this.listGoogleAdsAccounts(accessToken, connectorConfig);
      if (type === "ga4") choices = await this.listGa4Properties(accessToken);
      if (type === "google_business_profile") choices = await this.listGoogleBusinessLocations(accessToken);
      if (type === "meta") choices = await this.listMetaAdAccounts(accessToken);

      if (choices.length > 0) {
        await this.updateConnectorChoiceCache(clinicId, integrationId, connectorConfig, choices);
      }
      return choices;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (cachedChoices.length > 0 && /quota|rate limit|temporarily exceeded/i.test(message)) {
        return cachedChoices;
      }
      throw error;
    }
  }

  async selectConnectorAccount(
    clinicId: string,
    userId: string,
    type: MarketingConnectorType,
    data: ConnectorSelectionDTO,
  ) {
    const choices = await this.listConnectorAccountChoices(clinicId, type);
    const selected = choices.find((choice) => choice.id === data.selectionId);
    if (!selected) {
      throw ApiError.badRequest("Selected provider account is not available for this OAuth connection");
    }

    const { config: connectorConfig, integrationId } = await this.getConnectorConfig(clinicId, type);
    const selectionConfig = this.buildSelectionConfig(type, selected);
    const nextConfig = {
      ...connectorConfig,
      ...selectionConfig,
      selectedAccountId: selected.id,
      selectedAccountLabel: selected.label,
      selectedAccountDescription: selected.description || null,
      selectedAccountMetadata: selected.metadata || {},
      selectedAccountAt: new Date().toISOString(),
    };

    await pool.execute(
      `UPDATE integration
       SET config = ?,
           is_active = 1,
           setup_status = 'ready',
           health_status = 'healthy',
           missing_permissions = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [JSON.stringify(nextConfig), JSON.stringify([]), integrationId, clinicId],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "MARKETING_CONNECTOR_ACCOUNT_SELECTED",
      entityType: "integration",
      entityId: integrationId,
      changes: { type, selectionId: selected.id, label: selected.label },
    });

    return this.getConnectorStatus(clinicId, type);
  }

  async syncConnector(
    clinicId: string,
    userId: string,
    type: MarketingConnectorType,
    data: ConnectorSyncDTO,
  ) {
    const integrationId = await this.ensureConnectorForSync(clinicId, type);
    await pool.execute(
      `UPDATE integration
       SET last_sync_status = 'running',
           health_status = 'unknown',
           last_sync_error = NULL,
           last_sync_started_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [integrationId, clinicId],
    );

    if (data.errorMessage) {
      await pool.execute(
        `UPDATE integration
         SET last_sync_status = 'failed',
             health_status = 'error',
             last_sync_error = ?,
             last_sync_completed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
        [data.errorMessage.slice(0, 500), integrationId, clinicId],
      );
      await this.storeRawPayload({
        clinicId,
        source: `connector:${type}:sync_failed`,
        payload: { errorMessage: data.errorMessage },
        linkedEntityType: "integration",
        linkedEntityId: integrationId,
        status: "failed",
        errorMessage: data.errorMessage,
        createdBy: userId,
      });
      await logAuditEvent({
        clinicId,
        userId,
        action: "MARKETING_CONNECTOR_SYNC_FAILED",
        entityType: "integration",
        entityId: integrationId,
        changes: { type, errorMessage: data.errorMessage },
      });
      return {
        integrationId,
        importedRows: 0,
        spendRowsCreated: 0,
        status: await this.getConnectorStatus(clinicId, type),
      };
    }

    try {
      const rows = data.rows?.length
        ? data.rows
        : await this.fetchVendorMetricRows(clinicId, type, integrationId);

      let importedRows = 0;
      let spendRowsCreated = 0;
      for (const row of rows) {
        const metricId = await this.insertConnectorMetric(clinicId, userId, type, row);
        importedRows += 1;
        const spendCreated = await this.maybeInsertSpendEntry(clinicId, userId, type, row);
        spendRowsCreated += spendCreated ? 1 : 0;

        await this.storeRawPayload({
          clinicId,
          source: `connector:${type}`,
          payload: (row.rawPayload || row) as Record<string, unknown>,
          linkedEntityType: "manual_platform_metric",
          linkedEntityId: metricId,
          status: "processed",
          createdBy: userId,
        });
      }

      await pool.execute(
        `UPDATE integration
         SET last_sync = CURRENT_TIMESTAMP,
             last_sync_status = 'success',
             health_status = 'healthy',
             last_sync_error = NULL,
             last_sync_completed_at = CURRENT_TIMESTAMP,
             setup_status = 'ready',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
        [integrationId, clinicId],
      );

      await logAuditEvent({
        clinicId,
        userId,
        action: "MARKETING_CONNECTOR_SYNC_COMPLETED",
        entityType: "integration",
        entityId: integrationId,
        changes: { type, importedRows, spendRowsCreated },
      });

      return {
        integrationId,
        importedRows,
        spendRowsCreated,
        status: await this.getConnectorStatus(clinicId, type),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : `${CONNECTORS[type].name} sync failed`;
      await this.recordConnectorSyncFailure(clinicId, userId, integrationId, type, message);
      return {
        integrationId,
        importedRows: 0,
        spendRowsCreated: 0,
        status: await this.getConnectorStatus(clinicId, type),
      };
    }
  }

  // Create a placeholder connection or reactivate an existing integration
  async connectIntegration(
    clinicId: string,
    userId: string,
    data: ConnectIntegrationDTO,
  ): Promise<string> {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO integration (id, clinic_id, name, type, config, is_active, last_sync)
       VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         type = VALUES(type),
         config = VALUES(config),
         is_active = 1,
         last_sync = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        clinicId,
        data.name,
        data.type,
        data.config ? JSON.stringify(data.config) : null,
      ],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "INTEGRATION_CONNECTED",
      entityType: "integration",
      entityId: id,
      changes: { name: data.name, type: data.type },
    });

    return id;
  }

  // Update integration fields that the frontend settings screen can manage
  async updateIntegration(
    clinicId: string,
    userId: string,
    integrationId: string,
    data: UpdateIntegrationDTO,
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push("name = ?");
      values.push(data.name);
    }
    if (data.type !== undefined) {
      fields.push("type = ?");
      values.push(data.type);
    }
    if (data.config !== undefined) {
      fields.push("config = ?");
      values.push(JSON.stringify(data.config));
    }
    if (data.isActive !== undefined) {
      fields.push("is_active = ?");
      values.push(data.isActive ? 1 : 0);
      if (data.isActive) {
        fields.push("last_sync = CURRENT_TIMESTAMP");
      }
    }

    if (fields.length === 0) return;
    values.push(integrationId, clinicId);

    const [result]: any = await pool.execute(
      `UPDATE integration
       SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );

    if (result.affectedRows === 0) {
      throw ApiError.notFound("Integration not found");
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "INTEGRATION_UPDATED",
      entityType: "integration",
      entityId: integrationId,
      changes: { ...data },
    });
  }

  private async getConnectorStatus(clinicId: string, type: MarketingConnectorType) {
    const statuses = await this.listConnectorStatuses(clinicId);
    return statuses.find((status) => status.type === type) || null;
  }

  private getMissingConfigFields(type: MarketingConnectorType, values: Record<string, unknown>) {
    return CONNECTORS[type].configFields
      .filter((field) => field.required && !String(values[field.key] || "").trim())
      .map((field) => field.key);
  }

  private buildAuthorizeUrl(
    type: MarketingConnectorType,
    provider: "google" | "meta",
    clientId: string,
    redirectUri: string,
    state: string,
  ) {
    const definition = CONNECTORS[type];
    if (provider === "google") {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: definition.requiredScopes.join(" "),
        access_type: "offline",
        prompt: "consent",
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: definition.requiredScopes.join(","),
      state,
    });
    return `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`;
  }

  private async getConnectorConfig(clinicId: string, type: MarketingConnectorType) {
    const [rows]: any = await pool.execute(
      `SELECT id, config
       FROM integration
       WHERE clinic_id = ?
         AND type = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId, type],
    );
    if (!rows[0]) throw ApiError.notFound("Connector setup not found");
    return {
      integrationId: String(rows[0].id),
      config: parseConfig(rows[0].config) || {},
    };
  }

  private async getProviderAccessToken(
    clinicId: string,
    type: MarketingConnectorType,
    connectorConfig: Record<string, unknown>,
    integrationId: string,
  ) {
    const currentToken = decryptToken(connectorConfig.encryptedAccessToken || connectorConfig.accessToken);
    const expiresAt = typeof connectorConfig.tokenExpiresAt === "string"
      ? new Date(connectorConfig.tokenExpiresAt).getTime()
      : 0;
    if (currentToken && (!expiresAt || expiresAt > Date.now() + 60_000)) {
      return currentToken;
    }

    const refreshToken = decryptToken(connectorConfig.encryptedRefreshToken || connectorConfig.refreshToken);
    if (!refreshToken) return currentToken;

    const definition = CONNECTORS[type];
    if (definition.oauthProvider !== "google") return currentToken;

    const params = new URLSearchParams({
      client_id: config.oauth.google.clientId,
      client_secret: config.oauth.google.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: params.toString(),
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) return currentToken;

    const nextConfig = {
      ...connectorConfig,
      encryptedAccessToken: encryptToken(payload.access_token),
      tokenExpiresAt: payload.expires_in
        ? new Date(Date.now() + Number(payload.expires_in) * 1000).toISOString()
        : connectorConfig.tokenExpiresAt,
    };
    await pool.execute(
      `UPDATE integration
       SET config = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [JSON.stringify(nextConfig), integrationId, clinicId],
    );
    return String(payload.access_token);
  }

  private async listGoogleAdsAccounts(
    accessToken: string,
    connectorConfig: Record<string, unknown>,
  ): Promise<ConnectorAccountChoice[]> {
    if (!config.googleAds.developerToken) {
      throw ApiError.badRequest("Google Ads developer token is not configured");
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": config.googleAds.developerToken,
      Accept: "application/json",
    };
    if (config.googleAds.loginCustomerId) {
      headers["login-customer-id"] = config.googleAds.loginCustomerId;
    }
    const response = await fetch(
      `https://googleads.googleapis.com/${config.googleAds.apiVersion}/customers:listAccessibleCustomers`,
      { headers },
    );
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw ApiError.badRequest(normalizeProviderErrorMessage("Could not list Google Ads accounts", payload));
    }
    const choices = (payload.resourceNames || []).map((resourceName: string) => {
      const id = resourceName.replace("customers/", "");
      return {
        id,
        label: `Google Ads ${id}`,
        description: resourceName,
        metadata: { resourceName },
      };
    });
    const customerClientMetadata = await this.fetchGoogleAdsCustomerClientMetadata(
      headers,
      choices.map((choice: ConnectorAccountChoice) => choice.id),
    );
    const enrichedChoices = await Promise.all(
      choices.map((choice: ConnectorAccountChoice) => {
        const metadata = customerClientMetadata.get(choice.id);
        return metadata?.descriptiveName
          ? this.applyGoogleAdsAccountName(choice, metadata.descriptiveName, { manager: metadata.manager })
          : this.enrichGoogleAdsAccountChoice(headers, choice);
      }),
    );
    return enrichedChoices.map((choice) => this.applyGoogleAdsAccountAlias(choice, connectorConfig));
  }

  private applyGoogleAdsAccountAlias(
    choice: ConnectorAccountChoice,
    connectorConfig: Record<string, unknown>,
  ): ConnectorAccountChoice {
    const aliases = typeof connectorConfig.googleAdsAccountAliases === "object" && connectorConfig.googleAdsAccountAliases
      ? connectorConfig.googleAdsAccountAliases as Record<string, unknown>
      : {};
    const alias = String(aliases[choice.id] || "").trim();
    if (!alias) return choice;

    return {
      ...choice,
      label: alias,
      description: `Google Ads ${choice.id}`,
      metadata: {
        ...(choice.metadata || {}),
        localAlias: true,
      },
    };
  }

  private async fetchGoogleAdsCustomerClientMetadata(
    baseHeaders: Record<string, string>,
    customerIds: string[],
  ): Promise<Map<string, { descriptiveName: string; manager: boolean | null }>> {
    const headers = { ...baseHeaders, "Content-Type": "application/json" };
    const queryCustomers = Array.from(
      new Set([
        config.googleAds.loginCustomerId,
        ...customerIds,
      ].filter(Boolean)),
    );
    const metadata = new Map<string, { descriptiveName: string; manager: boolean | null }>();

    for (const customerId of queryCustomers) {
      let pageToken = "";
      try {
        do {
          const response = await fetch(
            `https://googleads.googleapis.com/${config.googleAds.apiVersion}/customers/${customerId}/googleAds:search`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                query: `
                  SELECT
                    customer_client.client_customer,
                    customer_client.descriptive_name,
                    customer_client.manager,
                    customer_client.hidden,
                    customer_client.status
                  FROM customer_client
                  WHERE customer_client.hidden = false
                `,
                pageSize: 10000,
                ...(pageToken ? { pageToken } : {}),
              }),
            },
          );
          const payload: any = await response.json().catch(() => ({}));
          if (!response.ok) break;

          for (const result of payload.results || []) {
            const customerClient = result.customerClient || result.customer_client || {};
            const id = String(customerClient.clientCustomer || customerClient.client_customer || "")
              .replace("customers/", "")
              .trim();
            const descriptiveName = String(customerClient.descriptiveName || customerClient.descriptive_name || "").trim();
            const manager = typeof customerClient.manager === "boolean" ? customerClient.manager : null;
            if (id && descriptiveName) metadata.set(id, { descriptiveName, manager });
          }
          pageToken = String(payload.nextPageToken || "");
        } while (pageToken);
      } catch {
        continue;
      }
    }

    return metadata;
  }

  private async enrichGoogleAdsAccountChoice(
    baseHeaders: Record<string, string>,
    choice: ConnectorAccountChoice,
  ): Promise<ConnectorAccountChoice> {
    const headerAttempts = [
      { ...baseHeaders, "Content-Type": "application/json" },
      this.withoutGoogleAdsLoginCustomerId({ ...baseHeaders, "Content-Type": "application/json" }),
    ];

    let currentChoice = choice;
    for (const headers of headerAttempts) {
      const enrichedChoice = await this.fetchGoogleAdsAccountName(headers, currentChoice);
      if (enrichedChoice.label !== choice.label) return enrichedChoice;
      currentChoice = enrichedChoice;
    }

    return currentChoice;
  }

  private async fetchGoogleAdsAccountName(
    headers: Record<string, string>,
    choice: ConnectorAccountChoice,
  ): Promise<ConnectorAccountChoice> {
    const lookupMode = headers["login-customer-id"] ? "direct_with_manager" : "direct_without_manager";
    try {
      const response = await fetch(
        `https://googleads.googleapis.com/${config.googleAds.apiVersion}/customers/${choice.id}/googleAds:search`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            query: "SELECT customer.id, customer.descriptive_name, customer.manager FROM customer",
          }),
        },
      );
      const payload: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        return this.withGoogleAdsNameLookupStatus(choice, `${lookupMode}_http_${response.status}`);
      }

      const customer = payload.results?.[0]?.customer || {};
      if (!payload.results?.[0]) {
        return this.withGoogleAdsNameLookupStatus(choice, `${lookupMode}_empty_results`);
      }
      const descriptiveName = String(customer.descriptiveName || customer.descriptive_name || "").trim();
      if (!descriptiveName) {
        return this.withGoogleAdsNameLookupStatus(choice, `${lookupMode}_missing_descriptive_name`);
      }

      const manager = typeof customer.manager === "boolean" ? customer.manager : null;
      return this.applyGoogleAdsAccountName(choice, descriptiveName, { manager });
    } catch {
      return this.withGoogleAdsNameLookupStatus(choice, `${lookupMode}_request_failed`);
    }
  }

  private withGoogleAdsNameLookupStatus(
    choice: ConnectorAccountChoice,
    status: string,
  ): ConnectorAccountChoice {
    const previousStatus = typeof choice.metadata?.nameLookupStatus === "string"
      ? `${choice.metadata.nameLookupStatus};${status}`
      : status;
    return {
      ...choice,
      metadata: {
        ...(choice.metadata || {}),
        nameLookupStatus: previousStatus,
      },
    };
  }

  private withoutGoogleAdsLoginCustomerId(headers: Record<string, string>) {
    const nextHeaders = { ...headers };
    delete nextHeaders["login-customer-id"];
    return nextHeaders;
  }

  private applyGoogleAdsAccountName(
    choice: ConnectorAccountChoice,
    descriptiveName: string,
    metadata: Record<string, unknown> = {},
  ): ConnectorAccountChoice {
    return {
      ...choice,
      label: descriptiveName,
      description: `Google Ads ${choice.id}`,
      metadata: {
        ...(choice.metadata || {}),
        descriptiveName,
        ...metadata,
      },
    };
  }

  private async listGa4Properties(accessToken: string): Promise<ConnectorAccountChoice[]> {
    const accountSummaries: any[] = [];
    let pageToken = "";

    do {
      const params = new URLSearchParams({ pageSize: "200" });
      if (pageToken) params.set("pageToken", pageToken);

      const response = await fetch(`https://analyticsadmin.googleapis.com/v1beta/accountSummaries?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      });
      const payload: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw ApiError.badRequest(normalizeProviderErrorMessage("Could not list GA4 properties", payload));
      }

      accountSummaries.push(...(payload.accountSummaries || []));
      pageToken = String(payload.nextPageToken || "");
    } while (pageToken);

    return accountSummaries.flatMap((account: any) => {
      const properties = Array.isArray(account.propertySummaries)
        ? account.propertySummaries
        : [];

      return properties.map((property: any) => {
        const propertyId = String(property.property || "").replace("properties/", "");
        return {
          id: propertyId,
          label: property.displayName || `GA4 property ${propertyId}`,
          description: account.displayName || account.account || null,
          metadata: {
            account: account.account,
            accountDisplayName: account.displayName,
            property: property.property,
          },
        };
      });
    });
  }

  private async listGoogleBusinessLocations(accessToken: string): Promise<ConnectorAccountChoice[]> {
    const accountsResponse = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    const accountsPayload: any = await accountsResponse.json().catch(() => ({}));
    if (!accountsResponse.ok) {
      throw ApiError.badRequest(
        normalizeProviderErrorMessage("Could not list Google Business Profile accounts", accountsPayload),
      );
    }

    const choices: ConnectorAccountChoice[] = [];
    for (const account of accountsPayload.accounts || []) {
      const accountName = String(account.name || "");
      if (!accountName) continue;
      const locationsResponse = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress`,
        { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
      );
      const locationsPayload: any = await locationsResponse.json().catch(() => ({}));
      if (!locationsResponse.ok) continue;
      for (const location of locationsPayload.locations || []) {
        const locationName = String(location.name || "");
        const accountId = accountName.replace("accounts/", "");
        const locationId = locationName.replace("locations/", "");
        choices.push({
          id: `${accountId}|${locationId}`,
          label: location.title || `GBP location ${locationId}`,
          description: account.accountName || accountName,
          metadata: {
            accountId,
            accountName,
            locationId,
            locationName,
            address: location.storefrontAddress || null,
          },
        });
      }
    }
    return choices;
  }

  private async listMetaAdAccounts(accessToken: string): Promise<ConnectorAccountChoice[]> {
    const params = new URLSearchParams({
      fields: "id,account_id,name,business_name",
      access_token: accessToken,
    });
    const response = await fetch(`https://graph.facebook.com/v20.0/me/adaccounts?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw ApiError.badRequest(payload.error?.message || "Could not list Meta ad accounts");
    }
    return (payload.data || []).map((account: any) => ({
      id: account.id,
      label: account.name || account.id,
      description: account.business_name || null,
      metadata: {
        adAccountId: account.id,
        accountId: account.account_id || null,
        businessName: account.business_name || null,
      },
    }));
  }

  private buildSelectionConfig(type: MarketingConnectorType, selected: ConnectorAccountChoice) {
    if (type === "google_ads") {
      return { customerId: selected.id };
    }
    if (type === "ga4") {
      return { propertyId: selected.id };
    }
    if (type === "google_business_profile") {
      return {
        accountId: String(selected.metadata?.accountId || ""),
        locationId: String(selected.metadata?.locationId || ""),
      };
    }
    if (type === "meta") {
      return {
        adAccountId: String(selected.metadata?.adAccountId || selected.id),
        businessId: String(selected.metadata?.businessId || ""),
      };
    }
    return {};
  }

  private async updateConnectorChoiceCache(
    clinicId: string,
    integrationId: string,
    connectorConfig: Record<string, unknown>,
    choices: ConnectorAccountChoice[],
  ) {
    await pool.execute(
      `UPDATE integration
       SET config = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [
        JSON.stringify({
          ...connectorConfig,
          accountChoiceCache: choices,
          accountChoiceCacheUpdatedAt: new Date().toISOString(),
        }),
        integrationId,
        clinicId,
      ],
    );
  }

  private async exchangeOAuthCode(
    type: MarketingConnectorType,
    provider: "google" | "meta",
    code: string,
    redirectUri: string,
  ) {
    const providerConfig = provider === "google" ? config.oauth.google : config.oauth.facebook;
    if (!providerConfig.clientId || !providerConfig.clientSecret) {
      throw ApiError.badRequest(`${CONNECTORS[type].name} OAuth client credentials are not configured`);
    }

    const tokenUrl = provider === "google"
      ? "https://oauth2.googleapis.com/token"
      : "https://graph.facebook.com/v20.0/oauth/access_token";
    const params = new URLSearchParams({
      code,
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
      redirect_uri: redirectUri,
    });
    if (provider === "google") {
      params.set("grant_type", "authorization_code");
    }

    const requestInit: RequestInit = {
      method: provider === "google" ? "POST" : "GET",
      headers: provider === "google"
        ? { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }
        : { Accept: "application/json" },
    };
    if (provider === "google") {
      requestInit.body = params.toString();
    }
    const response = await fetch(
      provider === "google" ? tokenUrl : `${tokenUrl}?${params.toString()}`,
      requestInit,
    );
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw ApiError.badRequest(
        `${CONNECTORS[type].name} OAuth token exchange failed: ${payload.error_description || payload.error?.message || payload.error || "provider rejected the authorization code"}`,
      );
    }
    return payload;
  }

  private async upsertConnector(
    clinicId: string,
    type: MarketingConnectorType,
    input: {
      name: string;
      config: Record<string, unknown>;
      isActive: boolean;
      setupStatus: string;
      healthStatus: string;
      missingPermissions: string[];
      oauthAuthorizeUrl: string | null;
    },
  ) {
    const [existingRows]: any = await pool.execute(
      `SELECT id
       FROM integration
       WHERE clinic_id = ?
         AND type = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId, type],
    );
    const id = existingRows[0]?.id || uuidv4();

    if (existingRows[0]?.id) {
      await pool.execute(
        `UPDATE integration
         SET name = ?,
             config = ?,
             is_active = ?,
             setup_status = ?,
             health_status = ?,
             missing_permissions = ?,
             oauth_authorize_url = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
        [
          input.name,
          JSON.stringify(input.config),
          input.isActive ? 1 : 0,
          input.setupStatus,
          input.healthStatus,
          JSON.stringify(input.missingPermissions),
          input.oauthAuthorizeUrl,
          id,
          clinicId,
        ],
      );
      return id;
    }

    await pool.execute(
      `INSERT INTO integration
        (id, clinic_id, name, type, config, is_active, setup_status, health_status,
         missing_permissions, oauth_authorize_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        input.name,
        type,
        JSON.stringify(input.config),
        input.isActive ? 1 : 0,
        input.setupStatus,
        input.healthStatus,
        JSON.stringify(input.missingPermissions),
        input.oauthAuthorizeUrl,
      ],
    );
    return id;
  }

  private async ensureConnectorForSync(clinicId: string, type: MarketingConnectorType) {
    const [rows]: any = await pool.execute(
      `SELECT id, setup_status as setupStatus, is_active as isActive
       FROM integration
       WHERE clinic_id = ?
         AND type = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId, type],
    );

    if (!rows[0]) throw ApiError.badRequest(`${CONNECTORS[type].name} connector is not configured`);
    if (!rows[0].isActive) throw ApiError.badRequest(`${CONNECTORS[type].name} connector is inactive`);
    if (rows[0].setupStatus === "missing_permissions") {
      throw ApiError.badRequest(`${CONNECTORS[type].name} connector is missing required permissions`);
    }
    return rows[0].id as string;
  }

  private async fetchVendorMetricRows(
    clinicId: string,
    type: MarketingConnectorType,
    integrationId: string,
  ): Promise<ConnectorMetricRowDTO[]> {
    if (!["google_ads", "ga4", "google_business_profile", "seo"].includes(type)) {
      throw ApiError.badRequest(`${CONNECTORS[type].name} vendor sync is not implemented yet. Manual fallback remains available.`);
    }

    const { config: connectorConfig } = await this.getConnectorConfig(clinicId, type);
    const accessToken = await this.getProviderAccessToken(clinicId, type, connectorConfig, integrationId);
    if (!accessToken) {
      throw ApiError.badRequest(`${CONNECTORS[type].name} is not OAuth connected. Reconnect OAuth before syncing.`);
    }

    if (type === "google_ads") return this.fetchGoogleAdsMetricRows(accessToken, connectorConfig);
    if (type === "ga4") return this.fetchGa4MetricRows(accessToken, connectorConfig);
    if (type === "google_business_profile") return this.fetchGoogleBusinessProfileMetricRows(accessToken, connectorConfig);
    if (type === "seo") return this.fetchSeoMetricRows(accessToken, connectorConfig);
    return [];
  }

  private async recordConnectorSyncFailure(
    clinicId: string,
    userId: string,
    integrationId: string,
    type: MarketingConnectorType,
    errorMessage: string,
  ) {
    await pool.execute(
      `UPDATE integration
       SET last_sync_status = 'failed',
           health_status = 'error',
           last_sync_error = ?,
           last_sync_completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [errorMessage.slice(0, 500), integrationId, clinicId],
    );
    await this.storeRawPayload({
      clinicId,
      source: `connector:${type}:sync_failed`,
      payload: { errorMessage },
      linkedEntityType: "integration",
      linkedEntityId: integrationId,
      status: "failed",
      errorMessage,
      createdBy: userId,
    });
    await logAuditEvent({
      clinicId,
      userId,
      action: "MARKETING_CONNECTOR_SYNC_FAILED",
      entityType: "integration",
      entityId: integrationId,
      changes: { type, errorMessage },
    });
  }

  private async fetchGoogleAdsMetricRows(
    accessToken: string,
    connectorConfig: Record<string, unknown>,
  ): Promise<ConnectorMetricRowDTO[]> {
    if (!config.googleAds.developerToken) {
      throw ApiError.badRequest("Google Ads developer token is not configured");
    }
    const customerId = compactCustomerId(connectorConfig.customerId || connectorConfig.selectedAccountId);
    if (!customerId) {
      throw ApiError.badRequest("Choose a Google Ads account before syncing.");
    }

    const { startDate, endDate } = getDefaultSyncDateRange();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": config.googleAds.developerToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (config.googleAds.loginCustomerId) {
      headers["login-customer-id"] = config.googleAds.loginCustomerId;
    }

    const isManagerAccount = await this.fetchGoogleAdsCustomerManagerStatus(customerId, headers);
    if (isManagerAccount) {
      throw ApiError.badRequest("Selected Google Ads account is a manager account. Choose a client account before syncing campaign metrics.");
    }

    const query = `
      SELECT
        segments.date,
        campaign.name,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    `;
    let { response, payload } = await this.fetchGoogleAdsSearchStream(customerId, headers, query);
    if (!response.ok && headers["login-customer-id"]) {
      ({ response, payload } = await this.fetchGoogleAdsSearchStream(
        customerId,
        this.withoutGoogleAdsLoginCustomerId(headers),
        query,
      ));
    }
    if (!response.ok) {
      throw ApiError.badRequest(normalizeProviderErrorMessage("Google Ads sync failed", payload));
    }

    const streamChunks = Array.isArray(payload) ? payload : [payload];
    const rows: ConnectorMetricRowDTO[] = [];
    for (const chunk of streamChunks) {
      for (const result of chunk.results || []) {
        const metricDate = result.segments?.date || endDate;
        const campaign = result.campaign?.name || "Google Ads";
        const metrics = result.metrics || {};
        const values: Array<[string, number, string]> = [
          ["spend", Number(metrics.costMicros || metrics.cost_micros || 0) / 1_000_000, "gbp"],
          ["impressions", Number(metrics.impressions || 0), "count"],
          ["clicks", Number(metrics.clicks || 0), "count"],
          ["conversions", Number(metrics.conversions || 0), "count"],
        ];
        for (const [metricName, metricValue, unit] of values) {
          rows.push({
            metricDate,
            metricName,
            metricValue,
            campaign,
            unit,
            rawPayload: result,
          });
        }
      }
    }
    return rows;
  }

  private async fetchGoogleAdsCustomerManagerStatus(
    customerId: string,
    baseHeaders: Record<string, string>,
  ): Promise<boolean | null> {
    const headerAttempts = [
      baseHeaders,
      this.withoutGoogleAdsLoginCustomerId(baseHeaders),
    ];
    for (const headers of headerAttempts) {
      try {
        const response = await fetch(
          `https://googleads.googleapis.com/${config.googleAds.apiVersion}/customers/${customerId}/googleAds:search`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              query: "SELECT customer.id, customer.manager FROM customer",
            }),
          },
        );
        const payload: any = await response.json().catch(() => ({}));
        if (!response.ok) continue;
        const customer = payload.results?.[0]?.customer || {};
        if (typeof customer.manager === "boolean") return customer.manager;
      } catch {
        continue;
      }
    }
    return null;
  }

  private async fetchGoogleAdsSearchStream(
    customerId: string,
    headers: Record<string, string>,
    query: string,
  ) {
    const response = await fetch(
      `https://googleads.googleapis.com/${config.googleAds.apiVersion}/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ query }),
      },
    );
    const payload: any = await response.json().catch(() => ({}));
    return { response, payload };
  }

  private async fetchGa4MetricRows(
    accessToken: string,
    connectorConfig: Record<string, unknown>,
  ): Promise<ConnectorMetricRowDTO[]> {
    const propertyId = String(connectorConfig.propertyId || connectorConfig.selectedAccountId || "").trim();
    if (!propertyId) {
      throw ApiError.badRequest("Choose a GA4 property before syncing.");
    }

    const { startDate, endDate } = getDefaultSyncDateRange();
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "date" }, { name: "sessionSourceMedium" }],
          metrics: [
            { name: "sessions" },
            { name: "activeUsers" },
            { name: "conversions" },
            { name: "engagementRate" },
          ],
          limit: 1000,
        }),
      },
    );
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw ApiError.badRequest(payload.error?.message || "GA4 sync failed");
    }

    const metricNames = payload.metricHeaders?.map((header: any) => String(header.name || "")) || [];
    const rows: ConnectorMetricRowDTO[] = [];
    for (const result of payload.rows || []) {
      const rawDate = String(result.dimensionValues?.[0]?.value || endDate);
      const metricDate = rawDate.length === 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate;
      const sourceMedium = String(result.dimensionValues?.[1]?.value || "GA4");
      result.metricValues?.forEach((metric: any, index: number) => {
        const name = metricNames[index] || `metric_${index + 1}`;
        rows.push({
          metricDate,
          metricName: name === "activeUsers" ? "users" : name,
          metricValue: Number(metric.value || 0),
          campaign: sourceMedium,
          unit: name === "engagementRate" ? "ratio" : "count",
          rawPayload: result,
        });
      });
    }
    return rows;
  }

  private async fetchGoogleBusinessProfileMetricRows(
    accessToken: string,
    connectorConfig: Record<string, unknown>,
  ): Promise<ConnectorMetricRowDTO[]> {
    const locationId = String(connectorConfig.locationId || connectorConfig.selectedAccountId || "")
      .split("|")
      .pop()
      ?.replace(/^locations\//, "")
      .trim();
    if (!locationId) {
      throw ApiError.badRequest("Choose a Google Business Profile location before syncing.");
    }

    const { startDate, endDate } = getDefaultSyncDateRange();
    const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
    const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
    const params = new URLSearchParams();
    [
      "CALL_CLICKS",
      "WEBSITE_CLICKS",
      "BUSINESS_DIRECTION_REQUESTS",
      "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
      "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
      "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
      "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
    ].forEach((metric) => params.append("dailyMetrics", metric));
    params.set("dailyRange.start_date.year", String(startYear));
    params.set("dailyRange.start_date.month", String(startMonth));
    params.set("dailyRange.start_date.day", String(startDay));
    params.set("dailyRange.end_date.year", String(endYear));
    params.set("dailyRange.end_date.month", String(endMonth));
    params.set("dailyRange.end_date.day", String(endDay));

    const response = await fetch(
      `https://businessprofileperformance.googleapis.com/v1/locations/${locationId}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
    );
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw ApiError.badRequest(payload.error?.message || "Google Business Profile sync failed");
    }

    const metricMap: Record<string, string> = {
      CALL_CLICKS: "calls",
      WEBSITE_CLICKS: "website_clicks",
      BUSINESS_DIRECTION_REQUESTS: "directions",
      BUSINESS_IMPRESSIONS_DESKTOP_MAPS: "profile_views",
      BUSINESS_IMPRESSIONS_MOBILE_MAPS: "profile_views",
      BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: "profile_views",
      BUSINESS_IMPRESSIONS_MOBILE_SEARCH: "profile_views",
    };
    const rows: ConnectorMetricRowDTO[] = [];
    for (const metricSeries of payload.multiDailyMetricTimeSeries || []) {
      const dailyMetric = metricSeries.dailyMetric || "";
      const metricName = metricMap[dailyMetric] || dailyMetric.toLowerCase();
      const series = metricSeries.timeSeries?.datedValues || metricSeries.dailyMetricTimeSeries?.timeSeries?.datedValues || [];
      for (const value of series) {
        const date = value.date || {};
        const metricDate = [date.year, String(date.month).padStart(2, "0"), String(date.day).padStart(2, "0")].join("-");
        rows.push({
          metricDate,
          metricName,
          metricValue: Number(value.value || 0),
          locationLabel: String(connectorConfig.selectedAccountLabel || connectorConfig.locationId || "Google Business Profile"),
          unit: "count",
          rawPayload: { dailyMetric, value },
        });
      }
    }
    return rows;
  }

  private async fetchSeoMetricRows(
    accessToken: string,
    connectorConfig: Record<string, unknown>,
  ): Promise<ConnectorMetricRowDTO[]> {
    const siteUrl = String(connectorConfig.siteUrl || "").trim();
    if (!siteUrl) {
      throw ApiError.badRequest("Add the SEO site URL before syncing.");
    }

    const { startDate, endDate } = getDefaultSyncDateRange();
    const response = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ["date"],
          rowLimit: 25000,
        }),
      },
    );
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw ApiError.badRequest(
        normalizeProviderErrorMessage("Search Console sync failed", payload),
      );
    }

    const rows: ConnectorMetricRowDTO[] = [];
    for (const result of payload.rows || []) {
      const metricDate = String(result.keys?.[0] || endDate);
      const values: Array<[string, number, string]> = [
        ["organic_clicks", Number(result.clicks || 0), "count"],
        ["organic_impressions", Number(result.impressions || 0), "count"],
        ["average_position", Number(result.position || 0), "rank"],
      ];
      for (const [metricName, metricValue, unit] of values) {
        rows.push({
          metricDate,
          metricName,
          metricValue,
          campaign: siteUrl,
          unit,
          rawPayload: result,
        });
      }
    }

    return rows;
  }

  private async insertConnectorMetric(
    clinicId: string,
    userId: string,
    type: MarketingConnectorType,
    row: ConnectorMetricRowDTO,
  ) {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO manual_platform_metric
        (id, clinic_id, platform, metric_date, campaign, location_label,
         metric_name, metric_value, unit, attribution_label, raw_payload, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        type,
        row.metricDate.slice(0, 10),
        row.campaign || null,
        row.locationLabel || null,
        row.metricName,
        row.metricValue,
        row.unit || null,
        `connector:${type}`,
        row.rawPayload ? JSON.stringify(row.rawPayload) : null,
        `Synced from ${CONNECTORS[type].name}`,
        userId,
      ],
    );
    return id;
  }

  private async maybeInsertSpendEntry(
    clinicId: string,
    userId: string,
    type: MarketingConnectorType,
    row: ConnectorMetricRowDTO,
  ) {
    if (!spendMetricNames.has(normalizeMetricName(row.metricName))) return false;
    const source = CONNECTORS[type].spendSource;
    if (!source) return false;

    const id = uuidv4();
    await pool.execute(
      `INSERT INTO manual_spend_entry
        (id, clinic_id, source, channel, campaign, amount, period, start_date, end_date,
         attribution_label, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'daily', ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        source,
        type,
        row.campaign || `${CONNECTORS[type].name} connector`,
        row.metricValue,
        row.metricDate.slice(0, 10),
        row.metricDate.slice(0, 10),
        `connector:${type}`,
        `Synced from ${CONNECTORS[type].name}`,
        userId,
      ],
    );
    return true;
  }

  private async storeRawPayload(input: {
    clinicId: string;
    source: string;
    payload: Record<string, unknown>;
    createdBy?: string | null;
    linkedEntityId?: string | null;
    linkedEntityType?: string | null;
    sourceEventId?: string | null;
    status?: "received" | "processed" | "failed";
    errorMessage?: string | null;
  }) {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO integration_raw_payload
        (id, clinic_id, source, source_event_id, linked_entity_type, linked_entity_id,
         payload, status, processed_at, error_message, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.clinicId,
        input.source,
        input.sourceEventId || null,
        input.linkedEntityType || null,
        input.linkedEntityId || null,
        JSON.stringify(input.payload || {}),
        input.status || "received",
        input.status && input.status !== "received" ? new Date() : null,
        input.errorMessage ? input.errorMessage.slice(0, 500) : null,
        input.createdBy || null,
      ],
    );
    return id;
  }
}

export const integrationsService = new IntegrationsService();
