"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, getStoredAuthSession } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { getPermissionsForRole, normaliseUserRole } from "@/lib/roles";
import type { BackendClinicMembership } from "@/lib/api-types";
import type {
  AuthUser,
  Clinic,
  TenantContextValue,
} from "@/lib/tenant-context/types";

export type { AuthUser, Clinic, TenantContextValue };

const TenantContext = createContext<TenantContextValue | null>(null);

const FALLBACK_CLINIC: Clinic = {
  id: "current-clinic",
  name: "Mission Control workspace",
  plan: "Growth",
  status: "active",
  maxUsers: 1,
  currentUsers: 1,
  location: "Internal workspace",
};

const FALLBACK_USER: AuthUser = {
  id: "current-user",
  name: "Signed out",
  email: "",
  role: "SALES",
  clinicId: FALLBACK_CLINIC.id,
  permissions: getPermissionsForRole("SALES"),
};

function toClinicPlan(plan: string | null | undefined): Clinic["plan"] {
  const normalized = String(plan || "").toLowerCase();
  if (normalized.includes("enterprise")) return "Enterprise";
  if (normalized.includes("scale")) return "Scale";
  if (normalized.includes("starter")) return "Starter";
  return "Growth";
}

function toClinicStatus(status: string | null | undefined): Clinic["status"] {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "trial") return "trial";
  if (normalized === "suspended" || normalized === "inactive") {
    return "suspended";
  }
  return "active";
}

function toClinic(membership: BackendClinicMembership): Clinic {
  return {
    id: membership.id,
    name: membership.name,
    plan: toClinicPlan(membership.plan),
    status: toClinicStatus(membership.status),
    maxUsers: 1,
    currentUsers: 1,
    location: membership.location || "Mission Control workspace",
  };
}

function toFallbackClinic(user: AuthUser | null): Clinic {
  if (!user) return FALLBACK_CLINIC;

  return {
    ...FALLBACK_CLINIC,
    id: user.clinicId,
    name: user.clinicName || FALLBACK_CLINIC.name,
  };
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [memberships, setMemberships] = useState<BackendClinicMembership[]>(
    () => getStoredAuthSession()?.clinics || [],
  );
  const [isSwitchingClinic, setIsSwitchingClinic] = useState(false);
  const token = auth.session?.token;

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    api.auth
      .getClinics(token)
      .then((clinics) => {
        if (isMounted) setMemberships(clinics);
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [token]);

  const allClinics = useMemo(() => {
    const clinics = token ? memberships.map(toClinic) : [];
    if (clinics.length > 0) return clinics;
    return [toFallbackClinic(auth.user)];
  }, [auth.user, memberships, token]);

  const clinic =
    allClinics.find((candidate) => candidate.id === auth.user?.clinicId) ||
    allClinics[0] ||
    FALLBACK_CLINIC;

  const user = auth.user || FALLBACK_USER;

  const switchClinic = useCallback(
    async (clinicId: string) => {
      if (!auth.isAuthenticated || clinicId === user.clinicId) return true;

      setIsSwitchingClinic(true);
      try {
        return await auth.switchClinic(clinicId);
      } finally {
        setIsSwitchingClinic(false);
      }
    },
    [auth, user.clinicId],
  );

  const hasPermission = useCallback(
    (permission: string) => auth.hasPermission(permission),
    [auth],
  );

  const value = useMemo<TenantContextValue>(
    () => ({
      clinic,
      user: {
        ...user,
        role: normaliseUserRole(user.role),
      },
      allClinics,
      switchClinic,
      isSwitchingClinic,
      hasPermission,
      isAuthenticated: auth.isAuthenticated,
    }),
    [
      allClinics,
      auth.isAuthenticated,
      clinic,
      hasPermission,
      isSwitchingClinic,
      switchClinic,
      user,
    ],
  );

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}

export function useTenantSafe() {
  return useContext(TenantContext);
}
