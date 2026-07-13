"use client";

import {
  BriefcaseBusiness,
  CheckSquare,
  FolderKanban,
  Shield,
  Users,
  Wrench,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { SubNav } from "@/components/sub-nav";

const DELIVERY_NAV = [
  { label: "Client Accounts", href: "/app/ops/client-accounts", icon: BriefcaseBusiness },
  { label: "Services", href: "/app/ops/services", icon: Wrench },
  { label: "Delivery Work", href: "/app/ops/delivery", icon: FolderKanban },
  { label: "Internal Tasks", href: "/app/crm/tasks", icon: CheckSquare },
];

const TEAM_ADMIN_NAV = [
  { label: "Team Members", href: "/app/ops/team", icon: Users },
  { label: "Roles & Permissions", href: "/app/ops/roles", icon: Shield },
];

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const items =
    pathname.startsWith("/app/ops/team") || pathname.startsWith("/app/ops/roles")
      ? TEAM_ADMIN_NAV
      : DELIVERY_NAV;

  return (
    <div>
      <SubNav items={items} />
      {children}
    </div>
  );
}
