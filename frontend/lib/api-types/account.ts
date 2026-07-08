export interface ClinicProfile {
  id: string;
  name: string;
  email: string;
  website: string | null;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  timezone: string;
  subscriptionPlan: string;
}

export interface UpdateClinicProfilePayload {
  name?: string;
  email?: string;
  website?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  timezone?: string;
}

export interface UserPreferences {
  userId: string;
  theme: string;
  language: string;
  notificationsEnabled: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
}

export interface SecuritySettings {
  userId: string;
  twoFactorEnabled: boolean;
  twoFactorVerified: boolean;
}

export interface BillingStatus {
  subscriptionPlan: string;
  subscriptionStatus: string;
  planExpiresAt: string | null;
  hasStripeSubscription: boolean;
  usage: {
    teamMembers: number;
    maxUsers: number;
    locations: number;
    contacts: number;
  };
}

export interface BillingCheckoutSession {
  clientSecret: string | null;
  sessionId: string;
  url: string | null;
}

export interface BillingCheckoutSessionStatus {
  id: string;
  paymentStatus: string | null;
  status: string | null;
  subscriptionId: string | null;
}

export interface Integration {
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
  dataFreshness?: ConnectorDataFreshness;
  config: Record<string, unknown> | null;
}

export type MarketingConnectorType =
  | "google_ads"
  | "meta"
  | "google_business_profile"
  | "ga4"
  | "seo";

export type ConnectorSetupStatus =
  | "not_configured"
  | "needs_oauth"
  | "missing_permissions"
  | "ready";

export type ConnectorHealthStatus = "unknown" | "healthy" | "warning" | "error";

export type ConnectorSyncStatus = "never" | "running" | "success" | "failed";

export interface ConnectorDataFreshness {
  status: "fresh" | "stale" | "never_synced";
  ageHours: number | null;
}

export interface ConnectorStatusRecord {
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
  dataFreshness: ConnectorDataFreshness;
  manualFallbackAvailable: boolean;
  supportedMetrics: string[];
}

export interface ConnectorConfigFieldRecord {
  key: string;
  label: string;
  required: boolean;
  placeholder?: string;
}

export interface ConnectorDefinitionRecord {
  type: MarketingConnectorType;
  name: string;
  oauthProvider: "google" | "meta" | null;
  oauthSupported: boolean;
  requiredScopes: string[];
  configFields: ConnectorConfigFieldRecord[];
  supportedMetrics: string[];
  manualFallbackAvailable: boolean;
}

export interface ConnectorOAuthStartRecord {
  type: MarketingConnectorType;
  authorizeUrl: string;
  state: string;
  setupStatus: ConnectorSetupStatus;
}

export interface ConnectorAccountChoiceRecord {
  id: string;
  label: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ConnectorSetupPayload {
  config?: Record<string, unknown>;
  oauthAuthorizeUrl?: string | null;
  missingPermissions?: string[];
  isActive?: boolean;
}

export interface ConnectorMetricRowPayload {
  metricDate: string;
  metricName: string;
  metricValue: number;
  campaign?: string | null;
  locationLabel?: string | null;
  unit?: string | null;
  rawPayload?: Record<string, unknown> | null;
}

export interface ConnectorSyncPayload {
  rows?: ConnectorMetricRowPayload[];
  errorMessage?: string | null;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  key?: string;
  status: "active" | "revoked";
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}
