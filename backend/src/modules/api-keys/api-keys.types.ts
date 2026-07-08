export interface ApiKeyResponse {
  id: string;
  name: string;
  keyPrefix: string;
  key?: string;
  status: "active" | "revoked";
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface CreateApiKeyDTO {
  name: string;
}

export interface UpdateApiKeyDTO {
  name?: string;
}
