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
    title: "Sales",
    colorClass: "text-[#7D8F7A]/60",
    items: [
      { label: "Sales Pipeline", href: "/app/crm/pipeline", icon: Target },
      { label: "Prospect List", href: "/app/leads", icon: Users },
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
    title: "Operations",
    colorClass: "text-[#7A746A]/60",
    items: [
      { label: "Mission Control", href: "/app", icon: ClipboardList },
      { label: "Team Members", href: "/app/ops/team", icon: Users },
    ],
  },
  {
    title: "Admin",
    colorClass: "text-[#7A746A]/60",
    items: [
      { label: "Roles", href: "/app/ops/roles", icon: Shield },
    ],
  },
];

export const BOTTOM_NAV: NavItem[] = [
  { label: "Settings", href: "/app/settings", icon: Settings },
];
