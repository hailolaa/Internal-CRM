import type { AuthUser } from "@/lib/types";

export type { AuthUser };

export interface Clinic {
  id: string;
  name: string;
  plan: "Starter" | "Growth" | "Scale" | "Enterprise";
  status: "active" | "trial" | "suspended";
  maxUsers: number;
  currentUsers: number;
  location: string;
}

export interface TenantContextValue {
  clinic: Clinic;
  user: AuthUser;
  allClinics: Clinic[];
  switchClinic: (clinicId: string) => Promise<boolean>;
  isSwitchingClinic: boolean;
  hasPermission: (permission: string) => boolean;
  isAuthenticated: boolean;
}
