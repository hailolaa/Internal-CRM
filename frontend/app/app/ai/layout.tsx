"use client";

import { SubNav } from "@/components/sub-nav";
import { INTELLIGENCE_NAV } from "@/lib/section-nav";

export default function AILayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SubNav items={INTELLIGENCE_NAV} />
      {children}
    </div>
  );
}
