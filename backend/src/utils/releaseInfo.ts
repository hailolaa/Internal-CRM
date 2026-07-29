import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type ReleaseManifest = {
  releaseId?: string;
  environment?: string;
  createdAt?: string;
  repository?: {
    revision?: string;
    branch?: string;
  };
  pairedRevisions?: {
    clinicOsFrontend?: string | null;
    clinicOsBackend?: string | null;
  };
  database?: {
    baseSchema?: {
      path?: string;
      sha256?: string;
    };
    migrations?: Array<{
      path?: string;
      sha256?: string;
    }>;
  };
  rollback?: {
    previousReleaseId?: string | null;
    previousMissionControlRevision?: string | null;
    databaseBackup?: string | null;
  };
  signature?: {
    algorithm?: string;
    keyId?: string;
    value?: string;
  } | null;
};

function readManifest() {
  const candidates = [
    process.env.RELEASE_MANIFEST_PATH,
    path.resolve(process.cwd(), "release/current-release.json"),
    path.resolve(process.cwd(), "../release/current-release.json"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const raw = readFileSync(candidate, "utf8");
    const manifest = JSON.parse(raw) as ReleaseManifest;
    return {
      manifest,
      path: candidate,
      sha256: crypto.createHash("sha256").update(raw).digest("hex"),
    };
  }

  return null;
}

export function getReleaseInfo() {
  const manifest = readManifest();

  if (manifest) {
    return {
      source: "manifest",
      releaseId: manifest.manifest.releaseId || null,
      environment: manifest.manifest.environment || process.env.NODE_ENV || "development",
      createdAt: manifest.manifest.createdAt || null,
      manifestPath: manifest.path,
      manifestSha256: manifest.sha256,
      missionControl: {
        revision: manifest.manifest.repository?.revision || null,
        branch: manifest.manifest.repository?.branch || null,
      },
      pairedRevisions: {
        clinicOsFrontend: manifest.manifest.pairedRevisions?.clinicOsFrontend || null,
        clinicOsBackend: manifest.manifest.pairedRevisions?.clinicOsBackend || null,
      },
      database: {
        baseSchemaSha256: manifest.manifest.database?.baseSchema?.sha256 || null,
        migrationCount: manifest.manifest.database?.migrations?.length || 0,
      },
      rollback: {
        previousReleaseId: manifest.manifest.rollback?.previousReleaseId || null,
        previousMissionControlRevision: manifest.manifest.rollback?.previousMissionControlRevision || null,
        databaseBackup: manifest.manifest.rollback?.databaseBackup || null,
      },
      signature: {
        present: Boolean(manifest.manifest.signature?.value),
        algorithm: manifest.manifest.signature?.algorithm || null,
        keyId: manifest.manifest.signature?.keyId || null,
      },
    };
  }

  return {
    source: "environment",
    releaseId: process.env.RELEASE_ID || process.env.RELEASE_VERSION || null,
    environment: process.env.NODE_ENV || "development",
    createdAt: process.env.RELEASE_CREATED_AT || null,
    manifestPath: process.env.RELEASE_MANIFEST_PATH || null,
    manifestSha256: process.env.RELEASE_MANIFEST_SHA256 || null,
    missionControl: {
      revision: process.env.RELEASE_COMMIT_SHA || process.env.GITHUB_SHA || null,
      branch: process.env.RELEASE_BRANCH || null,
    },
    pairedRevisions: {
      clinicOsFrontend: process.env.CLINIC_OS_FRONTEND_REVISION || null,
      clinicOsBackend: process.env.CLINIC_OS_BACKEND_REVISION || null,
    },
    database: {
      baseSchemaSha256: process.env.RELEASE_DB_SCHEMA_SHA256 || null,
      migrationCount: process.env.RELEASE_MIGRATION_COUNT
        ? Number(process.env.RELEASE_MIGRATION_COUNT)
        : null,
    },
    rollback: {
      previousReleaseId: process.env.PREVIOUS_RELEASE_ID || null,
      previousMissionControlRevision: process.env.PREVIOUS_MISSION_CONTROL_REVISION || null,
      databaseBackup: process.env.RELEASE_DATABASE_BACKUP || null,
    },
    signature: {
      present: Boolean(process.env.RELEASE_MANIFEST_SIGNATURE),
      algorithm: process.env.RELEASE_MANIFEST_SIGNATURE ? "hmac-sha256" : null,
      keyId: process.env.RELEASE_MANIFEST_KEY_ID || null,
    },
  };
}
