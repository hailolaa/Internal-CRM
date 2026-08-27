import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import type { PoolConnection } from "mysql2/promise";
import { createHash } from "node:crypto";
import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { decryptProviderCredential, encryptProviderCredential } from "../../utils/provider-credentials.js";
import type {
  QuickBooksAuditContext,
  QuickBooksClientCustomerMappingRecord,
  QuickBooksCommercialAdapter,
  QuickBooksCommercialDraftRecord,
  QuickBooksConnectionStatus,
  QuickBooksCustomerRecord,
  SaveQuickBooksClientCustomerMappingPayload,
  StageQuickBooksCommercialDraftPayload,
} from "./quickbooks.types.js";

type QuickBooksOAuthState = {
  purpose: "quickbooks";
  provider: "quickbooks";
  clinicId: string;
  userId: string;
};

type QueryExecutor = Pick<PoolConnection, "execute">;

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

  async stageCommercialDraft(
    input: StageQuickBooksCommercialDraftPayload,
    executor: QueryExecutor = pool,
  ): Promise<QuickBooksCommercialDraftRecord> {
    const id = uuidv4();
    await executor.execute(
      `INSERT INTO quickbooks_commercial_draft
        (id, clinic_id, event_id, proposal_id, client_account_profile_id,
         idempotency_key, customer_action, invoice_action, status, payload)
       VALUES (?, ?, ?, ?, ?, ?, 'create_or_link', 'create_draft', 'pending', ?)
       ON DUPLICATE KEY UPDATE
         client_account_profile_id = COALESCE(client_account_profile_id, VALUES(client_account_profile_id)),
         payload = VALUES(payload),
         updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        input.clinicId,
        input.eventId,
        input.proposalId,
        input.clientAccountProfileId || null,
        input.idempotencyKey,
        JSON.stringify(input.payload),
      ],
    );
    const [rows]: any = await executor.execute(
      `SELECT id, event_id as eventId, proposal_id as proposalId,
              client_account_profile_id as clientAccountProfileId,
              idempotency_key as idempotencyKey,
              customer_action as customerAction, invoice_action as invoiceAction,
              status, payload,
              quickbooks_customer_id as quickBooksCustomerId,
              quickbooks_invoice_id as quickBooksInvoiceId,
              failure_reason as failureReason,
              attempt_count as attemptCount,
              next_attempt_at as nextAttemptAt,
              last_attempt_at as lastAttemptAt
       FROM quickbooks_commercial_draft
       WHERE clinic_id = ? AND idempotency_key = ?
       LIMIT 1`,
      [input.clinicId, input.idempotencyKey],
    );
    if (!rows[0]) throw ApiError.internal("QuickBooks commercial draft could not be staged.");
    return {
      ...rows[0],
      payload: typeof rows[0].payload === "string" ? JSON.parse(rows[0].payload) : rows[0].payload,
    };
  }

  async processCommercialDraft(
    input: { clinicId: string; draftId: string; userId?: string | null },
    adapter?: QuickBooksCommercialAdapter,
  ): Promise<QuickBooksCommercialDraftRecord> {
    const [claim]: any = await pool.execute(
      `UPDATE quickbooks_commercial_draft
       SET status = 'processing', failure_reason = NULL,
           attempt_count = attempt_count + 1, last_attempt_at = CURRENT_TIMESTAMP,
           next_attempt_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ?
         AND status IN ('pending', 'failed')
         AND attempt_count < 5`,
      [input.draftId, input.clinicId],
    );
    if (claim.affectedRows !== 1) return this.getCommercialDraft(input.clinicId, input.draftId);

    let draft = await this.getCommercialDraft(input.clinicId, input.draftId);
    try {
      const provider = adapter || await this.createCommercialAdapter(input.clinicId);
      if (!draft.quickBooksCustomerId) {
        const customer = await provider.ensureCustomer({
          idempotencyKey: `${draft.idempotencyKey}:customer`,
          payload: draft.payload,
        });
        await pool.execute(
          `UPDATE quickbooks_commercial_draft
           SET quickbooks_customer_id = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND clinic_id = ? AND status = 'processing'`,
          [customer.id, draft.id, input.clinicId],
        );
        draft = await this.getCommercialDraft(input.clinicId, input.draftId);
      }
      if (!draft.quickBooksInvoiceId) {
        const invoice = await provider.createDraftInvoice({
          idempotencyKey: `${draft.idempotencyKey}:invoice`,
          customerId: draft.quickBooksCustomerId as string,
          payload: draft.payload,
        });
        await pool.execute(
          `UPDATE quickbooks_commercial_draft
           SET quickbooks_invoice_id = ?, status = 'processed', processed_at = CURRENT_TIMESTAMP,
               failure_reason = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND clinic_id = ? AND status = 'processing'`,
          [invoice.id, draft.id, input.clinicId],
        );
      }
      const processed = await this.getCommercialDraft(input.clinicId, input.draftId);
      if (input.userId) {
        await logAuditEvent({
          clinicId: input.clinicId,
          userId: input.userId,
          action: "QUICKBOOKS_COMMERCIAL_DRAFT_PROCESSED",
          entityType: "quickbooks_commercial_draft",
          entityId: draft.id,
          changes: {
            proposalId: draft.proposalId,
            quickBooksCustomerId: processed.quickBooksCustomerId,
            quickBooksInvoiceId: processed.quickBooksInvoiceId,
          },
        });
      }
      return processed;
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
      await pool.execute(
        `UPDATE quickbooks_commercial_draft
         SET status = 'failed', failure_reason = ?,
             next_attempt_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND clinic_id = ? AND status = 'processing'`,
        [message, draft.id, input.clinicId],
      );
      throw error;
    }
  }

  async processCommercialDraftBatch(
    options: { limit?: number; staleAfterMinutes?: number } = {},
    adapterFactory?: (clinicId: string) => Promise<QuickBooksCommercialAdapter>,
  ) {
    const limit = Math.min(Math.max(options.limit || 25, 1), 100);
    const staleAfterMinutes = Math.min(Math.max(options.staleAfterMinutes || 30, 5), 1440);
    const [staleResult]: any = await pool.execute(
      `UPDATE quickbooks_commercial_draft
       SET status = 'failed',
           failure_reason = 'Recovered stale processing claim.',
           next_attempt_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE status = 'processing'
         AND updated_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ${staleAfterMinutes} MINUTE)`,
    );
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId
       FROM quickbooks_commercial_draft
       WHERE status IN ('pending', 'failed')
         AND attempt_count < 5
         AND (next_attempt_at IS NULL OR next_attempt_at <= CURRENT_TIMESTAMP)
       ORDER BY created_at ASC
       LIMIT ${limit}`,
    );
    let processed = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        const adapter = adapterFactory ? await adapterFactory(row.clinicId) : undefined;
        const result = await this.processCommercialDraft({ clinicId: row.clinicId, draftId: row.id }, adapter);
        if (result.status === "processed") processed += 1;
      } catch {
        failed += 1;
      }
    }
    return {
      recoveredStale: Number(staleResult.affectedRows || 0),
      attempted: rows.length,
      processed,
      failed,
    };
  }

  private async getCommercialDraft(clinicId: string, draftId: string): Promise<QuickBooksCommercialDraftRecord> {
    const [rows]: any = await pool.execute(
      `SELECT id, event_id as eventId, proposal_id as proposalId,
              client_account_profile_id as clientAccountProfileId,
              idempotency_key as idempotencyKey,
              customer_action as customerAction, invoice_action as invoiceAction,
              status, payload,
              quickbooks_customer_id as quickBooksCustomerId,
              quickbooks_invoice_id as quickBooksInvoiceId,
              failure_reason as failureReason,
              attempt_count as attemptCount,
              next_attempt_at as nextAttemptAt,
              last_attempt_at as lastAttemptAt
       FROM quickbooks_commercial_draft
       WHERE id = ? AND clinic_id = ?
       LIMIT 1`,
      [draftId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("QuickBooks commercial draft was not found.");
    return {
      ...rows[0],
      payload: typeof rows[0].payload === "string" ? JSON.parse(rows[0].payload) : rows[0].payload,
    };
  }

  private async createCommercialAdapter(clinicId: string): Promise<QuickBooksCommercialAdapter> {
    const status = await this.getStatus(clinicId);
    if (!status.connected || !status.realmId) throw ApiError.serviceUnavailable("QuickBooks is not connected.");
    if (!config.quickbooks.defaultItemId) {
      throw ApiError.serviceUnavailable("QuickBooks default invoice item is not configured.");
    }
    const accessToken = await this.getAccessToken(clinicId);
    const post = async (resource: "customer" | "invoice", idempotencyKey: string, body: Record<string, unknown>) => {
      const requestId = createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 36);
      const url = `${this.apiBaseUrl}/v3/company/${encodeURIComponent(status.realmId as string)}/${resource}?minorversion=75&requestid=${requestId}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = assertResponseObject(await response.json().catch(() => ({})));
      if (!response.ok) throw new Error(result.Fault?.Error?.[0]?.Message || `QuickBooks ${resource} request failed with ${response.status}`);
      const id = result[resource === "customer" ? "Customer" : "Invoice"]?.Id;
      if (!id) throw new Error(`QuickBooks ${resource} response did not include an ID.`);
      return { id: String(id) };
    };
    return {
      ensureCustomer: ({ idempotencyKey, payload }) => post("customer", idempotencyKey, {
        DisplayName: payload.legalCompanyName || payload.billingEmail,
        CompanyName: payload.legalCompanyName || undefined,
        PrimaryEmailAddr: payload.billingEmail ? { Address: payload.billingEmail } : undefined,
      }),
      createDraftInvoice: ({ idempotencyKey, customerId, payload }) => {
        const amount = (Number(payload.monthlyFeeCents || 0) + Number(payload.setupFeeCents || 0)) / 100;
        return post("invoice", idempotencyKey, {
          CustomerRef: { value: customerId },
          PrivateNote: `Mission Control proposal ${payload.packageName || "accepted package"}`,
          Line: [{
            Amount: amount,
            DetailType: "SalesItemLineDetail",
            Description: payload.packageName || "ClinicGrower service",
            SalesItemLineDetail: { ItemRef: { value: config.quickbooks.defaultItemId } },
          }],
        });
      },
    };
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
