"use client";

import { SubNav } from "@/components/sub-nav";
import { ADMIN_NAV } from "@/lib/section-nav";

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SubNav items={ADMIN_NAV} />
      {children}
    </div>
  );
}
