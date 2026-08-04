"use client";

import { SubNav } from "@/components/sub-nav";
import { COMMUNICATIONS_NAV } from "@/lib/section-nav";

export default function CommsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <SubNav items={COMMUNICATIONS_NAV} />
      {children}
    </div>
  );
}
