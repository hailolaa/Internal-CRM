import {
  Activity,
  BookOpen,
  BriefcaseBusiness,
  CheckSquare,
  ClipboardList,
  FolderKanban,
  Inbox,
  Mail,
  Plug,
  Settings,
  Shield,
  Target,
  Users,
  Zap,
} from "lucide-react";
import type { NavItem, NavSection } from "@/lib/types";

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Sales",
    colorClass: "text-[#7D8F7A]/60",
    items: [
      { label: "Sales Pipeline", href: "/app/crm/pipeline", icon: Target },
      { label: "Prospect List", href: "/app/leads", icon: Users },
      { label: "Inbox", href: "/app/comms/inbox", icon: Inbox },
      { label: "Follow-Up Sequences", href: "/app/comms/sequences", icon: Zap },
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
      { label: "Contacts", href: "/app/crm/contacts", icon: Users },
      { label: "Internal Tasks", href: "/app/crm/tasks", icon: CheckSquare },
    ],
  },
  {
    title: "Operations",
    colorClass: "text-[#7A746A]/60",
    items: [
      { label: "Operations Dashboard", href: "/app", icon: ClipboardList },
      { label: "Team Members", href: "/app/ops/team", icon: Users },
      { label: "SOPs", href: "/app/ops/sops", icon: BookOpen },
      { label: "Automation", href: "/app/ops/automations", icon: Zap },
      { label: "Templates", href: "/app/comms/templates", icon: Mail },
    ],
  },
  {
    title: "Admin",
    colorClass: "text-[#7A746A]/60",
    items: [
      { label: "Roles", href: "/app/ops/roles", icon: Shield },
      { label: "Integrations", href: "/app/integrations", icon: Plug },
      { label: "Compliance", href: "/app/settings/compliance", icon: Shield },
      { label: "Pipeline Settings", href: "/app/crm/pipeline/settings", icon: Activity },
    ],
  },
];

export const BOTTOM_NAV: NavItem[] = [
  { label: "Settings", href: "/app/settings", icon: Settings },
];
