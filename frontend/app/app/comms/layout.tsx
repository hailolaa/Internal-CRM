"use client";

import { Inbox, Mail, Zap, Phone } from "lucide-react";
import { SubNav } from "@/components/sub-nav";

const COMMS_NAV = [
  { label: "Inbox", href: "/app/comms/inbox", icon: Inbox },
  { label: "Calls", href: "/app/comms/calls", icon: Phone },
  { label: "Templates", href: "/app/comms/templates", icon: Mail },
  { label: "Sequences", href: "/app/comms/sequences", icon: Zap },
];

export default function CommsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <SubNav items={COMMS_NAV} />
      {children}
    </div>
  );
}
