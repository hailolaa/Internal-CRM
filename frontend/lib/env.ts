const DEFAULT_LOGO_URL =
  "https://eu.chat-img.sintra.ai/57e4b3da-c2ee-48f8-956d-828adc30d734/0588879f-1cbe-4b7a-8b40-812b6a74b739/Copy_20of_20Copy_20of_20Clinic-Grower-Logo-Trademark-Light-Centralised-NO-slogan-withBG.png";
const DEFAULT_APP_URL = process.env.NODE_ENV === "production"
  ? "https://crm.clinicgrower.co.uk"
  : "http://localhost:3000";
const DEFAULT_API_BASE_URL = process.env.NODE_ENV === "production"
  ? "https://crm.clinicgrower.co.uk/api"
  : "http://localhost:3000";

function readPublicHttpsUrl(value: string | undefined, fallback: string) {
  const candidate = value?.trim();
  if (!candidate) return fallback;

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
  logoUrl: readPublicHttpsUrl(
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
} as const;
