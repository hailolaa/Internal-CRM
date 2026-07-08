export interface IntegrationResponse {
  id: string;
  name: string;
  type: string | null;
  isActive: boolean;
  lastSync: string | null;
  setupStatus?: ConnectorSetupStatus;
  healthStatus?: ConnectorHealthStatus;
  lastSyncStatus?: ConnectorSyncStatus;
  lastSyncError?: string | null;
  lastSyncStartedAt?: string | null;
  lastSyncCompletedAt?: string | null;
  missingPermissions?: string[];
  oauthAuthorizeUrl?: string | null;
  dataFreshness?: {
    status: "fresh" | "stale" | "never_synced";
    ageHours: number | null;
  };
  config: Record<string, unknown> | null;
}

export interface UpdateIntegrationDTO {
  name?: string;
  type?: string;
  isActive?: boolean;
  config?: Record<string, unknown>;
}

export interface ConnectIntegrationDTO {
  name: string;
  type: string;
  config?: Record<string, unknown>;
}

export type MarketingConnectorType =
  | "google_ads"
  | "meta"
  | "google_business_profile"
  | "ga4"
  | "seo";

export type ConnectorSetupStatus = "not_configured" | "needs_oauth" | "missing_permissions" | "ready";
export type ConnectorHealthStatus = "unknown" | "healthy" | "warning" | "error";
export type ConnectorSyncStatus = "never" | "running" | "success" | "failed";

export interface ConnectorSetupDTO {
  config?: Record<string, unknown>;
  oauthAuthorizeUrl?: string | null;
  missingPermissions?: string[];
  isActive?: boolean;
}

export interface ConnectorMetricRowDTO {
  metricDate: string;
  metricName: string;
  metricValue: number;
  campaign?: string | null;
  locationLabel?: string | null;
  unit?: string | null;
  rawPayload?: Record<string, unknown> | null;
}

export interface ConnectorSyncDTO {
  rows?: ConnectorMetricRowDTO[];
  errorMessage?: string | null;
}

export interface ConnectorStatusResponse {
  type: MarketingConnectorType;
  name: string;
  integrationId: string | null;
  configured: boolean;
  oauthConnected: boolean;
  selectionRequired: boolean;
  selectedAccountLabel: string | null;
  setupStatus: ConnectorSetupStatus;
  healthStatus: ConnectorHealthStatus;
  lastSyncStatus: ConnectorSyncStatus;
  lastSync: string | null;
  lastSyncError: string | null;
  missingPermissions: string[];
  oauthAuthorizeUrl: string | null;
  dataFreshness: {
    status: "fresh" | "stale" | "never_synced";
    ageHours: number | null;
  };
  manualFallbackAvailable: boolean;
  supportedMetrics: string[];
}

export interface ConnectorConfigField {
  key: string;
  label: string;
  required: boolean;
  placeholder?: string;
}

export interface ConnectorDefinitionResponse {
  type: MarketingConnectorType;
  name: string;
  oauthProvider: "google" | "meta" | null;
  oauthSupported: boolean;
  requiredScopes: string[];
  configFields: ConnectorConfigField[];
  supportedMetrics: string[];
  manualFallbackAvailable: boolean;
}

export interface ConnectorOAuthStartDTO {
  config?: Record<string, unknown>;
}

export interface ConnectorOAuthStartResponse {
  type: MarketingConnectorType;
  authorizeUrl: string;
  state: string;
  setupStatus: ConnectorSetupStatus;
}

export interface ConnectorOAuthCallbackDTO {
  code: string;
  state: string;
}

export interface ConnectorAccountChoice {
  id: string;
  label: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ConnectorSelectionDTO {
  selectionId: string;
}
