import type { UserRole } from "@/lib/types";

const ADMIN_PERMISSIONS = [
  "contacts:read",
  "contacts:write",
  "contacts:delete",
  "appointments:read",
  "appointments:write",
  "appointments:delete",
  "reports:read",
  "reports:write",
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
  "internal_tasks:read",
  "internal_tasks:write",
  "internal_notes:read",
  "internal_notes:write",
  "client_accounts:read",
  "client_accounts:write",
  "proposals:read",
  "proposals:write",
  "marketing:read",
  "marketing:write",
  "audit:read",
  "sensitive:read",
  "sops:read",
  "sops:write",
  "strategy_logs:read",
  "strategy_logs:write",
  "webhooks:read",
  "webhooks:write",
] as const;

const SALES_PERMISSIONS = [
  "contacts:read",
  "contacts:write",
  "calls:read",
  "calls:write",
  "events:read",
  "events:write",
  "internal_tasks:read",
  "internal_tasks:write",
  "client_accounts:read",
  "proposals:read",
  "proposals:write",
  "marketing:read",
  "sops:read",
] as const;

const DELIVERY_PERMISSIONS = [
  "contacts:read",
  "calls:read",
  "events:read",
  "events:write",
  "reports:read",
  "internal_tasks:read",
  "internal_tasks:write",
  "internal_notes:read",
  "internal_notes:write",
  "client_accounts:read",
  "client_accounts:write",
  "proposals:read",
  "sops:read",
  "strategy_logs:read",
  "strategy_logs:write",
] as const;

const FINANCE_PERMISSIONS = [
  "contacts:read",
  "reports:read",
  "reports:write",
  "billing:read",
  "billing:write",
  "internal_tasks:read",
  "client_accounts:read",
  "proposals:read",
  "audit:read",
  "sensitive:read",
] as const;

const VIEWER_PERMISSIONS = [
  "contacts:read",
  "reports:read",
  "calls:read",
  "events:read",
  "internal_tasks:read",
  "client_accounts:read",
  "proposals:read",
  "marketing:read",
  "sops:read",
  "strategy_logs:read",
] as const;

/**
 * Canonical role-to-permission map for frontend-only permission checks.
 *
 * The backend remains the authority for protected data. Legacy clinic role
 * names are mapped to Mission Control roles until the schema/API rename pass.
 */
export const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly string[]>> = {
  SUPER_ADMIN: ["*"],
  ADMIN: ADMIN_PERMISSIONS,
  SALES: SALES_PERMISSIONS,
  DELIVERY: DELIVERY_PERMISSIONS,
  FINANCE: FINANCE_PERMISSIONS,
  INTERNAL_VIEWER: VIEWER_PERMISSIONS,
  READ_ONLY: VIEWER_PERMISSIONS,
  CLINIC_ADMIN: ADMIN_PERMISSIONS,
  MANAGER: ADMIN_PERMISSIONS,
  CLINICIAN: DELIVERY_PERMISSIONS,
  RECEPTIONIST: SALES_PERMISSIONS,
  AGENCY_ANALYST: VIEWER_PERMISSIONS,
};

/**
 * Converts backend role aliases into the frontend role union.
 */
export function normaliseUserRole(role: string): UserRole {
  const normalized = role.toUpperCase();
  if (normalized === "CLINIC_ADMIN" || normalized === "MANAGER") return "ADMIN";
  if (normalized === "STAFF" || normalized === "RECEPTIONIST") return "SALES";
  if (normalized === "PRACTITIONER" || normalized === "CLINICIAN") return "DELIVERY";
  if (normalized === "READ_ONLY" || normalized === "AGENCY" || normalized === "ANALYST" || normalized === "AGENCY_ANALYST") {
    return "INTERNAL_VIEWER";
  }
  if (
    normalized === "SUPER_ADMIN" ||
    normalized === "ADMIN" ||
    normalized === "SALES" ||
    normalized === "DELIVERY" ||
    normalized === "FINANCE" ||
    normalized === "INTERNAL_VIEWER"
  ) {
    return normalized;
  }

  return "SALES";
}

export const ROLE_LABELS: Readonly<Record<string, string>> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  CLINIC_ADMIN: "Admin",
  MANAGER: "Admin",
  SALES: "Sales",
  RECEPTIONIST: "Sales",
  STAFF: "Sales",
  DELIVERY: "Delivery / Team Member",
  CLINICIAN: "Delivery / Team Member",
  PRACTITIONER: "Delivery / Team Member",
  FINANCE: "Finance",
  INTERNAL_VIEWER: "Internal Viewer",
  READ_ONLY: "Internal Viewer",
  AGENCY: "Internal Viewer",
  ANALYST: "Internal Viewer",
  AGENCY_ANALYST: "Internal Viewer",
};

export function getRoleLabel(role: string | null | undefined): string {
  if (!role) return "Team Member";
  return ROLE_LABELS[role.toUpperCase()] || role;
}

export const TEAM_ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin" },
  { value: "SALES", label: "Sales" },
  { value: "DELIVERY", label: "Delivery / Team Member" },
  { value: "FINANCE", label: "Finance" },
  { value: "READ_ONLY", label: "Internal Viewer" },
] as const;

/**
 * Returns a mutable permissions array so consumers can safely attach it to
 * session/user objects without sharing the readonly source constants.
 */
export function getPermissionsForRole(role: UserRole): string[] {
  return [...ROLE_PERMISSIONS[normaliseUserRole(role)]];
}
