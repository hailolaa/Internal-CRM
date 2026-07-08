// ============================================================
// Admin page — data
// ============================================================

import { Building2, Users, CreditCard, Activity } from "lucide-react";

export const ADMIN_STATS = [
  {
    label: "Total Clinics",
    value: "1,247",
    change: "+12%",
    icon: Building2,
    color: "teal" as const,
  },
  {
    label: "Active Users",
    value: "3,891",
    change: "+8%",
    icon: Users,
    color: "blue" as const,
  },
  {
    label: "MRR",
    value: "£186,450",
    change: "+15%",
    icon: CreditCard,
    color: "green" as const,
  },
  {
    label: "API Requests",
    value: "2.4M",
    change: "+23%",
    icon: Activity,
    color: "violet" as const,
  },
] as const;

export const RECENT_CLINICS = [
  {
    id: "1",
    name: "Glow Aesthetics",
    plan: "Growth",
    users: 5,
    created: "2 hours ago",
  },
  {
    id: "2",
    name: "Beauty Bar London",
    plan: "Starter",
    users: 2,
    created: "5 hours ago",
  },
  {
    id: "3",
    name: "Skin Deep Clinic",
    plan: "Scale",
    users: 12,
    created: "1 day ago",
  },
] as const;

export const SYSTEM_HEALTH = [
  { label: "API Response Time", value: "45ms" },
  { label: "Database Load", value: "23%" },
  { label: "Uptime (30d)", value: "99.98%" },
] as const;
