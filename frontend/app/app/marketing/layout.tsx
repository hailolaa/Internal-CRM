"use client";

import { SubNav } from "@/components/sub-nav";
import { MARKETING_NAV } from "@/lib/section-nav";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <SubNav items={MARKETING_NAV} />
      {children}
    </div>
  );
}
