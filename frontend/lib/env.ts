const DEFAULT_LOGO_URL =
  "/brand/clinic-grower-logo-inline.png";
const DEFAULT_APP_URL = process.env.NODE_ENV === "production"
  ? "https://crm.clinicgrower.co.uk"
  : "http://localhost:3000";
const DEFAULT_API_BASE_URL = process.env.NODE_ENV === "production"
  ? "https://crm.clinicgrower.co.uk/api"
  : "http://localhost:3000";

function readPublicLogoUrl(value: string | undefined, fallback: string) {
  const candidate = value?.trim();
  if (!candidate) return fallback;
  if (candidate.startsWith("/")) return candidate;

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function readApiBaseUrl(value: string | undefined, fallback: string) {
  const candidate = value?.trim();
  if (!candidate) return fallback;

  try {
    const url = new URL(candidate);
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

function readPublicConfigValue(value: string | undefined) {
  return value?.trim() || "";
}

export const publicEnv = {
  logoUrl: readPublicLogoUrl(
    process.env.NEXT_PUBLIC_LOGO_URL,
    DEFAULT_LOGO_URL,
  ),
  apiBaseUrl: readApiBaseUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL,
    DEFAULT_API_BASE_URL,
  ),
  appUrl: readApiBaseUrl(
    process.env.NEXT_PUBLIC_APP_URL,
    DEFAULT_APP_URL,
  ),
  stripePublishableKey: readPublicConfigValue(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  ),
  observabilityClientEndpoint: readPublicConfigValue(
    process.env.NEXT_PUBLIC_OBSERVABILITY_CLIENT_ENDPOINT,
  ),
  observabilityServiceName: readPublicConfigValue(
    process.env.NEXT_PUBLIC_OBSERVABILITY_SERVICE_NAME,
  ) || "mission-control-frontend",
  releaseId: readPublicConfigValue(
    process.env.NEXT_PUBLIC_RELEASE_ID || process.env.RELEASE_ID || process.env.RELEASE_VERSION,
  ),
  releaseEnvironment: readPublicConfigValue(
    process.env.NEXT_PUBLIC_RELEASE_ENVIRONMENT || process.env.NODE_ENV,
  ) || "development",
  releaseCommitSha: readPublicConfigValue(
    process.env.NEXT_PUBLIC_RELEASE_COMMIT_SHA || process.env.RELEASE_COMMIT_SHA || process.env.GITHUB_SHA,
  ),
} as const;
