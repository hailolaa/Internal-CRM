import { publicEnv } from "@/lib/env";

export function getOAuthUrl(
  provider: "google" | "facebook" | "apple",
  mode: "login" | "signup" = "login",
  rememberMe = false,
) {
  const path = `auth/oauth/${provider}`;
  const params = new URLSearchParams({
    mode,
    rememberMe: String(rememberMe),
  });
  return `${publicEnv.apiBaseUrl}/${path}?${params.toString()}`;
}
