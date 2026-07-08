import { getPermissionsForRole } from "@/lib/roles";
import type { AuthUser, Clinic } from "./types";

export const MOCK_CLINICS: Clinic[] = [
  {
    id: "cg_ops",
    name: "Clinic Grower Operations",
    plan: "Enterprise",
    status: "active",
    maxUsers: 10,
    currentUsers: 4,
    location: "Remote",
  },
  {
    id: "client_nova_dental",
    name: "Nova Dental Group",
    plan: "Growth",
    status: "active",
    maxUsers: 5,
    currentUsers: 2,
    location: "London",
  },
  {
    id: "client_lumen_skin",
    name: "Lumen Skin Studio",
    plan: "Scale",
    status: "trial",
    maxUsers: 15,
    currentUsers: 8,
    location: "Manchester",
  },
];

export const MOCK_USERS: AuthUser[] = [
  {
    id: "user_001",
    name: "Sarah Smith",
    email: "sarah@clinicgrower.com",
    role: "CLINIC_ADMIN",
    clinicId: "cg_ops",
    permissions: getPermissionsForRole("CLINIC_ADMIN"),
  },
  {
    id: "user_002",
    name: "Emma Johnson",
    email: "emma@clinicgrower.com",
    role: "RECEPTIONIST",
    clinicId: "cg_ops",
    permissions: getPermissionsForRole("RECEPTIONIST"),
  },
  {
    id: "user_003",
    name: "Max Sharpe",
    email: "max@clinicgrower.com",
    role: "SUPER_ADMIN",
    clinicId: "cg_ops",
    permissions: getPermissionsForRole("SUPER_ADMIN"),
  },
];
