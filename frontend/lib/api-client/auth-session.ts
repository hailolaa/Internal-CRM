import { getPermissionsForRole, normaliseUserRole } from "@/lib/roles";
import type {
  BackendAuthResponse,
  BackendAuthUser,
  StoredAuthSession,
} from "@/lib/api-types";
import type { AuthUser } from "@/lib/types";

const AUTH_STORAGE_KEY = "clinic_grower_auth";

export function toAuthUser(user: BackendAuthUser): AuthUser {
  const role = normaliseUserRole(user.role);
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return {
    id: user.id,
    name: name || user.email,
    email: user.email,
    role,
    clinicId: user.clinicId,
    clinicName: user.clinicName ?? undefined,
    permissions: getPermissionsForRole(role),
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    avatar: `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase(),
  };
}

export function toStoredSession(
  auth: BackendAuthResponse,
  rememberMe = false,
): StoredAuthSession {
  return {
    user: toAuthUser(auth.user),
    clinics: auth.clinics,
    token: auth.tokens.token,
    refreshToken: auth.tokens.refreshToken,
    expiresIn: auth.tokens.expiresIn,
    requires2FA: auth.tokens.requires2FA,
    rememberMe,
  };
}

export function saveAuthSession(session: StoredAuthSession) {
  if (typeof window === "undefined") return;

  const storage = session.rememberMe
    ? window.localStorage
    : window.sessionStorage;
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));

  const otherStorage = session.rememberMe
    ? window.sessionStorage
    : window.localStorage;
  otherStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function refreshStoredAuthSession(
  refreshSession: (
    refreshToken: string,
    rememberMe?: boolean,
  ) => Promise<StoredAuthSession>,
) {
  const stored = getStoredAuthSession();
  if (!stored?.refreshToken) return null;

  try {
    return await refreshSession(stored.refreshToken, stored.rememberMe);
  } catch {
    clearStoredAuthSession();
    return null;
  }
}

export function storeAuthSession(
  user: BackendAuthUser,
  token: string,
  refreshToken?: string,
  rememberMe = false,
  requires2FA = false,
) {
  const session = toStoredSession(
    {
      user,
      tokens: {
        token,
        refreshToken,
        requires2FA,
      },
    },
    rememberMe,
  );
  saveAuthSession(session);
  return session;
}

export function getStoredAuthSession() {
  if (typeof window === "undefined") return null;

  const raw =
    window.localStorage.getItem(AUTH_STORAGE_KEY) ||
    window.sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredAuthSession;
  } catch {
    clearStoredAuthSession();
    return null;
  }
}

export function clearStoredAuthSession() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
}
