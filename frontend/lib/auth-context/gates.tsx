"use client";

import type { ReactNode } from "react";
import type { UserRole } from "@/lib/types";
import { useAuth } from "./hooks";

export function PermissionGate({
  permission,
  fallback,
  children,
}: {
  permission: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) {
    return fallback ? <>{fallback}</> : null;
  }
  return <>{children}</>;
}

export function RoleGate({
  roles,
  fallback,
  children,
}: {
  roles: UserRole[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (!user || (!roles.includes(user.role) && user.role !== "SUPER_ADMIN")) {
    return fallback ? <>{fallback}</> : null;
  }
  return <>{children}</>;
}
