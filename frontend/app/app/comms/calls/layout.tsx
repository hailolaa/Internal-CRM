"use client";

import { Phone, BarChart3, Shield, Brain } from "lucide-react";
import { SubNav } from "@/components/sub-nav";

const CALLS_NAV = [
  { label: "Call Log", href: "/app/comms/calls", icon: Phone },
  { label: "Analytics", href: "/app/comms/calls/analytics", icon: BarChart3 },
  { label: "AI Analysis", href: "/app/comms/calls/analysis", icon: Brain },
  { label: "Compliance", href: "/app/comms/calls/compliance", icon: Shield },
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
