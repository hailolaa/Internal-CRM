export type GoogleOAuthAccessDecision = "existing" | "auto_provision" | "reject";

export function getEmailDomain(email: string) {
  const normalized = email.trim().toLowerCase();
  const separator = normalized.lastIndexOf("@");

  if (separator <= 0 || separator === normalized.length - 1) return "";
  return normalized.slice(separator + 1);
}

export function decideGoogleOAuthAccess(
  email: string,
  userExists: boolean,
  allowedDomains: readonly string[],
): GoogleOAuthAccessDecision {
  const normalizedDomains = allowedDomains
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  if (normalizedDomains.length === 0) {
    return userExists ? "existing" : "reject";
  }

  const domain = getEmailDomain(email);
  if (!domain || !normalizedDomains.includes(domain)) return "reject";

  return userExists ? "existing" : "auto_provision";
}
