"use client";

import { Phone } from "lucide-react";
import { SubNav } from "@/components/sub-nav";

const CALLS_NAV = [
  { label: "Call Log", href: "/app/comms/calls", icon: Phone },
];

export default function CallsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <SubNav items={CALLS_NAV} />
      {children}
    </div>
  );
}
