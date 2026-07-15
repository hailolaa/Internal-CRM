"use client";

import { SubNav } from "@/components/sub-nav";
import { SALES_NAV } from "@/lib/section-nav";

export default function CommsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <SubNav items={SALES_NAV} />
      {children}
    </div>
  );
}
