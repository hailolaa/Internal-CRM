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
      { label: "Missed Call Recovery", href: "/app/comms/calls/recovery", icon: PhoneCall },
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
      { label: "SOPs", href: "/app/ops/sops", icon: FileText },
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
    title: "Reporting",
    colorClass: "text-[#7A746A]/60",
    items: [
      { label: "Growth Scores", href: "/app/reports/growth-scores", icon: BarChart3, permission: "reports:read" },
      { label: "Lead Reports", href: "/app/reports/leads", icon: Users, permission: "reports:read" },
      { label: "Marketing Spend", href: "/app/reports/ads", icon: CircleDollarSign, permission: "reports:read" },
      { label: "No-show Reports", href: "/app/reports/noshows", icon: PhoneCall, permission: "reports:read" },
    ],
  },
  {
    title: "Admin",
    colorClass: "text-[#7A746A]/60",
    items: [
      { label: "Admin Console", href: "/app/admin", icon: Shield, permission: "settings:read" },
      { label: "Tenant Scope", href: "/app/admin/tenant-scope", icon: Shield, permission: "settings:read" },
      { label: "Smoke Tests", href: "/app/admin/smoke-tests", icon: ClipboardList, permission: "settings:read" },
      { label: "Team Members", href: "/app/ops/team", icon: Users, permission: "team:read" },
      { label: "Integrations", href: "/app/integrations", icon: Plug, permission: "webhooks:read" },
      { label: "Sync Health", href: "/app/integrations/sync-health", icon: Plug, permission: "webhooks:read" },
      { label: "ClickUp Reconciliation", href: "/app/integrations/clickup/reconciliation", icon: CheckSquare, permission: "webhooks:read" },
      { label: "Roles & Permissions", href: "/app/ops/roles", icon: Shield, permission: "team:read" },
      { label: "Packages", href: "/app/settings/packages", icon: Package, permission: "settings:read" },
    ],
  },
];

export const BOTTOM_NAV: NavItem[] = [
  { label: "Settings", href: "/app/settings", icon: Settings, permission: "settings:read" },
];
