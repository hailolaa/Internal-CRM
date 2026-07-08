import type { UserRole } from "@/lib/types";

/**
 * Canonical role-to-permission map for frontend-only permission checks.
 *
 * The backend remains the authority for protected data. These permissions keep
 * mock contexts, navigation affordances, and client-side gates consistent while
 * the app is running as a static-export frontend.
 */
export const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly string[]>> = {
  SUPER_ADMIN: ["*"],
  CLINIC_ADMIN: [
    "contacts:read",
    "contacts:write",
    "contacts:delete",
    "appointments:read",
    "appointments:write",
    "appointments:delete",
    "reports:read",
    "settings:read",
    "settings:write",
    "team:read",
    "team:write",
    "billing:read",
    "billing:write",
    "calls:read",
    "calls:write",
    "events:read",
    "events:write",
    "marketing:read",
    "marketing:write",
    "audit:read",
    "webhooks:read",
    "webhooks:write",
  ],
  MANAGER: [
    "contacts:read",
    "contacts:write",
    "appointments:read",
    "appointments:write",
    "reports:read",
    "settings:read",
    "team:read",
    "calls:read",
    "calls:write",
    "events:read",
    "events:write",
    "marketing:read",
    "marketing:write",
  ],
  CLINICIAN: [
    "contacts:read",
    "contacts:write",
    "appointments:read",
    "appointments:write",
    "calls:read",
    "calls:write",
    "events:read",
    "reports:read",
  ],
  RECEPTIONIST: [
    "contacts:read",
    "contacts:write",
    "appointments:read",
    "appointments:write",
    "calls:read",
    "calls:write",
  ],
  AGENCY_ANALYST: [
    "contacts:read",
    "appointments:read",
    "reports:read",
    "calls:read",
    "marketing:read",
  ],
};

/**
 * Converts backend role aliases into the frontend role union.
 */
export function normaliseUserRole(role: string): UserRole {
  const normalized = role.toUpperCase();
  if (normalized === "ADMIN") return "CLINIC_ADMIN";
  if (normalized === "MANAGER") return "MANAGER";
  if (normalized === "STAFF") return "RECEPTIONIST";
  if (normalized === "PRACTITIONER") return "CLINICIAN";
  if (normalized === "READ_ONLY" || normalized === "AGENCY" || normalized === "ANALYST" || normalized === "AGENCY_ANALYST") {
    return "AGENCY_ANALYST";
  }
  if (
    normalized === "SUPER_ADMIN" ||
    normalized === "CLINIC_ADMIN" ||
    normalized === "MANAGER" ||
    normalized === "CLINICIAN" ||
    normalized === "RECEPTIONIST" ||
    normalized === "AGENCY_ANALYST"
  ) {
    return normalized;
  }

  return "RECEPTIONIST";
}

export const ROLE_LABELS: Readonly<Record<string, string>> = {
  SUPER_ADMIN: "Super Admin",
  CLINIC_ADMIN: "Owner",
  ADMIN: "Owner",
  MANAGER: "Manager",
  CLINICIAN: "Team Member",
  PRACTITIONER: "Team Member",
  RECEPTIONIST: "Sales Coordinator",
  STAFF: "Sales Coordinator",
  READ_ONLY: "Agency / Analyst",
  AGENCY: "Agency / Analyst",
  ANALYST: "Agency / Analyst",
  AGENCY_ANALYST: "Agency / Analyst",
};

export function getRoleLabel(role: string | null | undefined): string {
  if (!role) return "Team Member";
  return ROLE_LABELS[role.toUpperCase()] || role;
}

export const TEAM_ROLE_OPTIONS = [
  { value: "ADMIN", label: "Owner" },
  { value: "MANAGER", label: "Manager" },
  { value: "STAFF", label: "Sales Coordinator" },
  { value: "READ_ONLY", label: "Agency / Analyst" },
] as const;

/**
 * Returns a mutable permissions array so consumers can safely attach it to
 * session/user objects without sharing the readonly source constants.
 */
export function getPermissionsForRole(role: UserRole): string[] {
  return [...ROLE_PERMISSIONS[role]];
}
