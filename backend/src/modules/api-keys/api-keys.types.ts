export interface ApiKeyResponse {
  id: string;
  name: string;
  keyPrefix: string;
  key?: string;
  purpose: "general" | "landing_page_lead_capture";
  sourceKey: string | null;
  sourceLabel: string | null;
  defaultSource: string | null;
  initialStageName: string | null;
  ownerUserId: string | null;
  ownerName?: string | null;
  followUpEnabled: boolean;
  status: "active" | "revoked";
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  rotatedAt: string | null;
}

export interface CreateApiKeyDTO {
  name: string;
  purpose?: "general" | "landing_page_lead_capture";
  sourceKey?: string | null;
  sourceLabel?: string | null;
  defaultSource?: string | null;
  initialStageName?: string | null;
  ownerUserId?: string | null;
  followUpEnabled?: boolean;
}

export interface UpdateApiKeyDTO {
  name?: string;
  sourceLabel?: string | null;
  defaultSource?: string | null;
  initialStageName?: string | null;
  ownerUserId?: string | null;
  followUpEnabled?: boolean;
}
