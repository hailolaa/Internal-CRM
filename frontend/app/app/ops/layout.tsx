"use client";

import { usePathname } from "next/navigation";
import { SubNav } from "@/components/sub-nav";
import { ADMIN_NAV, CLIENT_DELIVERY_NAV, OPERATIONS_NAV } from "@/lib/section-nav";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const items =
    pathname.startsWith("/app/ops/team") || pathname.startsWith("/app/ops/roles")
      ? ADMIN_NAV
      : pathname.startsWith("/app/ops/automations") || pathname.startsWith("/app/ops/sops")
        ? OPERATIONS_NAV
        : CLIENT_DELIVERY_NAV;

  return (
    <div>
      <SubNav items={items} />
      {children}
    </div>
  );
}
