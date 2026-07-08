import type { AuthUser, UserRole } from "@/lib/types";

export function hasUserPermission(user: AuthUser | null, permission: string) {
  if (!user) return false;
  if (user.permissions.includes("*")) return true;
  return user.permissions.includes(permission);
}

export function hasUserRole(user: AuthUser | null, role: UserRole) {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN") return true;
  return user.role === role;
}
