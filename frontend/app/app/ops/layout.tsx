"use client";

import {
  BookOpen,
  BriefcaseBusiness,
  ClipboardList,
  FolderKanban,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import { SubNav } from "@/components/sub-nav";

const OPS_NAV = [
  { label: "Dashboard", href: "/app", icon: ClipboardList },
  { label: "Client Accounts", href: "/app/ops/client-accounts", icon: BriefcaseBusiness },
  { label: "Delivery Work", href: "/app/ops/delivery", icon: FolderKanban },
  { label: "Team", href: "/app/ops/team", icon: Users },
  { label: "Automations", href: "/app/ops/automations", icon: Zap },
  { label: "Roles", href: "/app/ops/roles", icon: Shield },
  { label: "SOPs", href: "/app/ops/sops", icon: BookOpen },
];

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SubNav items={OPS_NAV} />
      {children}
    </div>
  );
}
