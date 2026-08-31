import {
  AlertTriangle,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CheckSquare,
  CircleDollarSign,
  FileText,
  FolderKanban,
  Gift,
  Inbox,
  Megaphone,
  MessageSquareText,
  Package,
  PhoneCall,
  Plug,
  Shield,
  Star,
  Target,
  Users,
  Wrench,
} from "lucide-react";
import type { SubNavItem } from "@/components/sub-nav";

export const SALES_NAV: SubNavItem[] = [
  { label: "Prospect List", href: "/app/leads", icon: Users },
  { label: "Sales Pipeline", href: "/app/crm/pipeline", icon: Target },
  { label: "Proposals", href: "/app/crm/proposals", icon: FileText },
  { label: "Contacts", href: "/app/crm/contacts", icon: Users },
  { label: "Duplicate Review", href: "/app/crm/contacts/duplicates", icon: AlertTriangle },
];

export const COMMUNICATIONS_NAV: SubNavItem[] = [
  { label: "Inbox", href: "/app/comms/inbox", icon: Inbox },
  { label: "Call Intelligence", href: "/app/comms/calls", icon: PhoneCall },
  { label: "Templates", href: "/app/comms/templates", icon: MessageSquareText },
  { label: "Sequences", href: "/app/comms/sequences", icon: Bot },
];

export const CLIENT_DELIVERY_NAV: SubNavItem[] = [
  { label: "Client Accounts", href: "/app/ops/client-accounts", icon: BriefcaseBusiness },
  { label: "Services", href: "/app/ops/services", icon: Wrench },
  { label: "Delivery Work", href: "/app/ops/delivery", icon: FolderKanban },
  { label: "Internal Tasks", href: "/app/crm/tasks", icon: CheckSquare },
];

export const OPERATIONS_NAV: SubNavItem[] = [
  { label: "Automation Engine", href: "/app/ops/automations", icon: Bot },
  { label: "Internal Tasks", href: "/app/crm/tasks", icon: CheckSquare },
  { label: "SOPs", href: "/app/ops/sops", icon: FileText },
];

export const MARKETING_NAV: SubNavItem[] = [
  { label: "Campaigns", href: "/app/marketing/campaigns", icon: Megaphone },
  { label: "Attribution", href: "/app/marketing/attribution", icon: Target },
  { label: "Offers", href: "/app/marketing/offers", icon: Gift },
  { label: "Review & GBP Signals", href: "/app/marketing/reviews", icon: Star },
];

export const INTELLIGENCE_NAV: SubNavItem[] = [
  { label: "Growth Brief", href: "/app/ai/growth-brief", icon: BarChart3 },
  { label: "Campaign Analyst", href: "/app/ai/campaign-analyst", icon: Target },
  { label: "Sales Assistant", href: "/app/ai/sales-assistant", icon: Bot },
  { label: "Action Approvals", href: "/app/ai/action-approvals", icon: CheckSquare },
  { label: "Missed Opportunity", href: "/app/ai/show-rate", icon: PhoneCall },
  { label: "ROI Reporting", href: "/app/ai/ltv-optimiser", icon: CircleDollarSign },
  { label: "AI Agents", href: "/app/ai/agents", icon: Bot },
];

export const ADMIN_NAV: SubNavItem[] = [
  { label: "Admin Console", href: "/app/admin", icon: Shield },
  { label: "Team Members", href: "/app/ops/team", icon: Users },
  { label: "Roles & Permissions", href: "/app/ops/roles", icon: Shield },
  { label: "Integrations", href: "/app/integrations", icon: Plug },
  { label: "Packages", href: "/app/settings/packages", icon: Package },
];
