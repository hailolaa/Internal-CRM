export interface EnvironmentBannerContent {
  label: string;
  description: string;
}

function normalizeEnvironment(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleEnvironment(value: string) {
  return value
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getEnvironmentBannerContent(environment: string | null | undefined): EnvironmentBannerContent | null {
  const normalized = normalizeEnvironment(environment);
  if (!normalized || normalized === "production") return null;

  const label = normalized === "staging" ? "STAGING" : titleEnvironment(normalized).toUpperCase();
  const friendlyName = normalized === "staging" ? "Staging" : titleEnvironment(normalized);

  return {
    label,
    description: `${friendlyName} environment - not production data.`,
  };
}
