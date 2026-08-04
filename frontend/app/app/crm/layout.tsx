"use client";

import { usePathname } from "next/navigation";
import { SubNav } from "@/components/sub-nav";
import { OPERATIONS_NAV, SALES_NAV } from "@/lib/section-nav";

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const items = pathname.startsWith("/app/crm/tasks") ? OPERATIONS_NAV : SALES_NAV;

  return (
    <div>
      <SubNav items={items} />
      {children}
    </div>
  );
}
