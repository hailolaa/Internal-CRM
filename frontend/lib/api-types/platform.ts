export interface HealthStatus {
  ok: boolean;
  service: string;
  environment: string;
  uptimeSeconds: number;
  startedAt?: string;
  database?: {
    ok: boolean;
    latencyMs?: number;
    error?: string;
  };
  config?: {
    frontendUrl: string;
    apiPublicUrl: string;
    oauthCallbackBaseUrl: string;
    corsOrigins: string[];
    emailProvider: string;
    issues: string[];
    warnings: string[];
  };
  requestId?: string;
}
