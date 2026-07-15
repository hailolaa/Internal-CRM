"use client";

import { BriefcaseBusiness, CheckSquare, FolderKanban, Wrench } from "lucide-react";
import { usePathname } from "next/navigation";
import { SubNav } from "@/components/sub-nav";
import { SALES_NAV } from "@/lib/section-nav";

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
