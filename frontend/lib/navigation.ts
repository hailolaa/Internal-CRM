import {
  BriefcaseBusiness,
  AlertTriangle,
  CheckSquare,
  ClipboardList,
  FolderKanban,
  FileText,
  Inbox,
  Package,
  Plug,
  Settings,
  Shield,
  Target,
  Users,
  Wrench,
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
      { label: "Proposals", href: "/app/crm/proposals/preview", icon: FileText },
      { label: "Contacts", href: "/app/crm/contacts", icon: Users },
      { label: "Duplicate Review", href: "/app/crm/contacts/duplicates", icon: AlertTriangle },
      { label: "Inbox", href: "/app/comms/inbox", icon: Inbox },
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
      { label: "Services", href: "/app/ops/services", icon: Wrench },
      { label: "Delivery Work", href: "/app/ops/delivery", icon: FolderKanban },
      { label: "Internal Tasks", href: "/app/crm/tasks", icon: CheckSquare },
    ],
  },
  {
    title: "Team & Admin",
    colorClass: "text-[#7A746A]/60",
    items: [
      { label: "Team Members", href: "/app/ops/team", icon: Users },
      { label: "Integrations", href: "/app/integrations", icon: Plug },
      { label: "Roles & Permissions", href: "/app/ops/roles", icon: Shield },
      { label: "Packages", href: "/app/settings/packages", icon: Package },
    ],
  },
];

export const BOTTOM_NAV: NavItem[] = [
  { label: "Settings", href: "/app/settings", icon: Settings },
];
