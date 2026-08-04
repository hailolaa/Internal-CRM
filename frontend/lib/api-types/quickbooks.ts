export interface QuickBooksConnectionStatus {
  connected: boolean;
  enabled: boolean;
  environment: string;
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
  mappingStatus: "active" | "needs_review" | "archived";
  mappingSource: "manual" | "quickbooks_lookup";
  lastCheckedAt: string | null;
  lastError: string | null;
  updatedAt: string;
}

export interface QuickBooksClientCustomerMappingPayload {
  quickbooksCustomerId: string;
  quickbooksCustomerName: string;
  quickbooksCompanyName?: string | null;
  quickbooksEmail?: string | null;
  mappingStatus?: "active" | "needs_review" | "archived";
  mappingSource?: "manual" | "quickbooks_lookup";
}
