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

export interface ReleaseVersionStatus {
  service: string;
  environment: string;
  release: {
    source: "manifest" | "environment";
    releaseId: string | null;
    environment: string;
    createdAt: string | null;
    manifestPath: string | null;
    manifestSha256: string | null;
    missionControl: {
      revision: string | null;
      branch: string | null;
    };
    pairedRevisions: {
      clinicOsFrontend: string | null;
      clinicOsBackend: string | null;
    };
    database: {
      baseSchemaSha256: string | null;
      migrationCount: number | null;
    };
    rollback: {
      previousReleaseId: string | null;
      previousMissionControlRevision: string | null;
      databaseBackup: string | null;
    };
    deploymentVerification: {
      state: string;
      deployedRevision: string | null;
      verifiedAt: string | null;
      reportPath: string | null;
      requiredChecks: string[];
    };
    signature: {
      present: boolean;
      algorithm: string | null;
      keyId: string | null;
    };
  };
  requestId?: string;
}
