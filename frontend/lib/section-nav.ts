import { Inbox, Target, Users } from "lucide-react";
import type { SubNavItem } from "@/components/sub-nav";

export const SALES_NAV: SubNavItem[] = [
  { label: "Prospect List", href: "/app/leads", icon: Users },
  { label: "Sales Pipeline", href: "/app/crm/pipeline", icon: Target },
  { label: "Contacts", href: "/app/crm/contacts", icon: Users },
  { label: "Inbox", href: "/app/comms/inbox", icon: Inbox },
];
