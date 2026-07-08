import type { AuthUser, UserRole } from "@/lib/types";

export interface Session {
  id: string;
  userId: string;
  clinicId: string;
  role: UserRole;
  token: string;
  expiresAt: string;
  createdAt: string;
  lastActivity: string;
  ipAddress: string;
  userAgent: string;
}

function getUserAgent() {
  return typeof navigator !== "undefined"
    ? navigator.userAgent.slice(0, 60)
    : "Server";
}

export function createSession(
  user: AuthUser,
  token: string,
  rememberMe = false,
  now = new Date(),
): Session {
  const expiresAt = new Date(
    now.getTime() + (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000,
  );

  return {
    id: `sess_${now.getTime()}`,
    userId: user.id,
    clinicId: user.clinicId,
    role: user.role,
    token,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
    lastActivity: now.toISOString(),
    ipAddress: "",
    userAgent: getUserAgent(),
  };
}
