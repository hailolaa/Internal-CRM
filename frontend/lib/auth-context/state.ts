import { getStoredAuthSession } from "@/lib/api-client";
import { createSession } from "@/lib/auth-session";
import type { AuthState } from "./types";

export const emptyAuthState: AuthState = {
  user: null,
  session: null,
  isLoading: false,
};

export function createLoadedAuthState(
  user: AuthState["user"],
  token: string,
  rememberMe?: boolean,
): AuthState {
  if (!user) return emptyAuthState;

  return {
    user,
    session: createSession(user, token, rememberMe),
    isLoading: false,
  };
}

export function readInitialAuthState(): AuthState {
  const stored = getStoredAuthSession();

  if (!stored) return emptyAuthState;

  if (stored.refreshToken) {
    return { ...emptyAuthState, isLoading: true };
  }

  return createLoadedAuthState(stored.user, stored.token, stored.rememberMe);
}
