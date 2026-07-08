import type { AuthUser } from "@/lib/types";

export interface BackendAuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  clinicId: string;
  clinicName?: string | null;
  emailVerifiedAt?: string | null;
}

export interface BackendClinicMembership {
  id: string;
  name: string;
  plan: string | null;
  status: string;
  role: string;
  location: string | null;
  isPrimary: boolean;
}

export interface BackendAuthResponse {
  user: BackendAuthUser;
  clinics?: BackendClinicMembership[];
  tokens: {
    token: string;
    refreshToken?: string;
    expiresIn?: string;
    requires2FA?: boolean;
  };
}

export interface BackendCurrentSessionResponse {
  user: BackendAuthUser;
  clinics?: BackendClinicMembership[];
}

export interface StoredAuthSession {
  user: AuthUser;
  clinics?: BackendClinicMembership[];
  token: string;
  refreshToken?: string;
  expiresIn?: string;
  requires2FA?: boolean;
  rememberMe?: boolean;
}

export type AuthSessionResponse = StoredAuthSession;

export interface BackendSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  revoked: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  current: boolean;
}

export interface BackendSecurityEvent {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface RegisterClinicPayload {
  clinicName: string;
  adminEmail: string;
  adminPassword: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
}

export interface TwoFactorEnableResult {
  backupCodes: string[];
}
