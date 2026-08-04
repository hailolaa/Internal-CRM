import {
  BriefcaseBusiness,
  BarChart3,
  Bot,
  CheckSquare,
  CircleDollarSign,
  ClipboardList,
  FolderKanban,
  FileText,
  Gift,
  Inbox,
  Megaphone,
  MessageSquareText,
  Package,
  PhoneCall,
  Plug,
  Settings,
  Shield,
  Star,
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
      { label: "Proposals", href: "/app/crm/proposals", icon: FileText },
      { label: "Contacts", href: "/app/crm/contacts", icon: Users },
    ],
  },
  {
    title: "Communications",
    colorClass: "text-[#7A746A]/60",
    items: [
      { label: "Inbox", href: "/app/comms/inbox", icon: Inbox },
      { label: "Call Intelligence", href: "/app/comms/calls", icon: PhoneCall },
      { label: "Templates", href: "/app/comms/templates", icon: MessageSquareText },
      { label: "Sequences", href: "/app/comms/sequences", icon: Bot },
    ],
  },
  {
    title: "Operations",
    colorClass: "text-[#7A746A]/60",
    items: [
      { label: "Automation Engine", href: "/app/ops/automations", icon: Bot },
      { label: "Internal Tasks", href: "/app/crm/tasks", icon: CheckSquare },
      { label: "Delivery Work", href: "/app/ops/delivery", icon: FolderKanban },
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
    ],
  },
  {
    title: "Intelligence",
    colorClass: "text-[#7A746A]/60",
    items: [
      { label: "Growth Brief", href: "/app/ai/growth-brief", icon: BarChart3 },
      { label: "Campaign Analyst", href: "/app/ai/campaign-analyst", icon: Target },
      { label: "Sales Assistant", href: "/app/ai/sales-assistant", icon: Bot },
      { label: "Missed Opportunity", href: "/app/ai/show-rate", icon: PhoneCall },
      { label: "ROI Reporting", href: "/app/ai/ltv-optimiser", icon: CircleDollarSign },
      { label: "AI Agents", href: "/app/ai/agents", icon: Bot },
    ],
  },
  {
    title: "Marketing",
    colorClass: "text-[#7A746A]/60",
    items: [
      { label: "Campaigns", href: "/app/marketing/campaigns", icon: Megaphone },
      { label: "Attribution", href: "/app/marketing/attribution", icon: Target },
      { label: "Offers", href: "/app/marketing/offers", icon: Gift },
      { label: "Review & GBP Signals", href: "/app/marketing/reviews", icon: Star },
    ],
  },
  {
    title: "Team & Admin",
    colorClass: "text-[#7A746A]/60",
    items: [
      { label: "Admin Console", href: "/app/admin", icon: Shield },
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
