import {
  BriefcaseBusiness,
  CheckSquare,
  ClipboardList,
  FolderKanban,
  Settings,
  Shield,
  Target,
  Users,
} from "lucide-react";
import type { NavItem, NavSection } from "@/lib/types";

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    colorClass: "text-[#7A746A]/60",
    items: [
      { label: "Mission Control", href: "/app", icon: ClipboardList },
    ],
  },
  {
    title: "Sales",
    colorClass: "text-[#7D8F7A]/60",
    items: [
      { label: "Prospect List", href: "/app/leads", icon: Users },
      { label: "Sales Pipeline", href: "/app/crm/pipeline", icon: Target },
      { label: "Contacts", href: "/app/crm/contacts", icon: Users },
    ],
  },
  {
    title: "Clients & Delivery",
    colorClass: "text-[#7A746A]/60",
    items: [
      {
        label: "Client Accounts",
        href: "/app/ops/client-accounts",
        icon: BriefcaseBusiness,
      },
      { label: "Delivery Work", href: "/app/ops/delivery", icon: FolderKanban },
      { label: "Internal Tasks", href: "/app/crm/tasks", icon: CheckSquare },
    ],
  },
  {
    title: "Team & Admin",
    colorClass: "text-[#7A746A]/60",
    items: [
      { label: "Team Members", href: "/app/ops/team", icon: Users },
      { label: "Roles & Permissions", href: "/app/ops/roles", icon: Shield },
    ],
  },
];

export const BOTTOM_NAV: NavItem[] = [
  { label: "Settings", href: "/app/settings", icon: Settings },
];
