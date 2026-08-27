export type QuickBooksMappingStatus = "active" | "needs_review" | "archived";
export type QuickBooksMappingSource = "manual" | "quickbooks_lookup";

export interface QuickBooksAuditContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface QuickBooksConnectionStatus {
  connected: boolean;
  enabled: boolean;
  environment: "sandbox" | "production" | string;
  realmId: string | null;
  companyName: string | null;
  connectedEmail: string | null;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
  lastSync: string | null;
  lastError: string | null;
}

export interface QuickBooksOAuthStartRecord {
  authorizeUrl: string;
}

export interface QuickBooksCustomerRecord {
  id: string;
  displayName: string;
  companyName: string | null;
  email: string | null;
  active: boolean;
}

export interface QuickBooksClientCustomerMappingRecord {
  id: string;
  clientAccountProfileId: string;
  clientClinicId: string;
  clientName: string;
  quickbooksCustomerId: string;
  quickbooksCustomerName: string;
  quickbooksCompanyName: string | null;
  quickbooksEmail: string | null;
  realmId: string | null;
  mappingStatus: QuickBooksMappingStatus;
  mappingSource: QuickBooksMappingSource;
  lastCheckedAt: string | null;
  lastError: string | null;
  updatedAt: string;
}

export interface SaveQuickBooksClientCustomerMappingPayload {
  quickbooksCustomerId: string;
  quickbooksCustomerName: string;
  quickbooksCompanyName?: string | null;
  quickbooksEmail?: string | null;
  mappingStatus?: QuickBooksMappingStatus;
  mappingSource?: QuickBooksMappingSource;
}

export interface QuickBooksCommercialDraftRecord {
  id: string;
  eventId: string;
  proposalId: string;
  clientAccountProfileId: string | null;
  idempotencyKey: string;
  customerAction: "create_or_link";
  invoiceAction: "create_draft";
  status: "pending" | "processing" | "processed" | "failed" | "ignored";
  payload: Record<string, unknown>;
  quickBooksCustomerId: string | null;
  quickBooksInvoiceId: string | null;
  failureReason: string | null;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
}

export interface StageQuickBooksCommercialDraftPayload {
  clinicId: string;
  eventId: string;
  proposalId: string;
  clientAccountProfileId?: string | null;
  idempotencyKey: string;
  payload: Record<string, unknown>;
}

export interface QuickBooksCommercialAdapter {
  ensureCustomer(input: { idempotencyKey: string; payload: Record<string, unknown> }): Promise<{ id: string }>;
  createDraftInvoice(input: {
    idempotencyKey: string;
    customerId: string;
    payload: Record<string, unknown>;
  }): Promise<{ id: string }>;
}
