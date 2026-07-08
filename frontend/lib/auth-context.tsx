"use client";

export type { Session } from "@/lib/auth-session";
export type { AuthUser } from "@/lib/types";
export { PermissionGate, RoleGate } from "./auth-context/gates";
export { useAuth, useAuthSafe } from "./auth-context/hooks";
export { AuthProvider } from "./auth-context/provider";
