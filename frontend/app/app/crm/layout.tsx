"use client";

import { BriefcaseBusiness, CheckSquare, FolderKanban, Target, Users, Wrench } from "lucide-react";
import { usePathname } from "next/navigation";
import { SubNav } from "@/components/sub-nav";

const SALES_NAV = [
  { label: "Prospect List", href: "/app/leads", icon: Users },
  { label: "Sales Pipeline", href: "/app/crm/pipeline", icon: Target },
  { label: "Contacts", href: "/app/crm/contacts", icon: Users },
];

const DELIVERY_NAV = [
  { label: "Client Accounts", href: "/app/ops/client-accounts", icon: BriefcaseBusiness },
  { label: "Services", href: "/app/ops/services", icon: Wrench },
  { label: "Delivery Work", href: "/app/ops/delivery", icon: FolderKanban },
  { label: "Internal Tasks", href: "/app/crm/tasks", icon: CheckSquare },
];

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const items = pathname.startsWith("/app/crm/tasks") ? DELIVERY_NAV : SALES_NAV;

  return (
    <div>
      <SubNav items={items} />
      {children}
    </div>
  );
}
