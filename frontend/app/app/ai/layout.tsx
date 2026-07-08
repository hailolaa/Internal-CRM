"use client";

import {
  Brain,
  MessageSquare,
  BarChart3,
  PoundSterling,
  Newspaper,
} from "lucide-react";
import { SubNav } from "@/components/sub-nav";
import type { SubNavItem } from "@/components/sub-nav";

const AI_TOOLS_NAV: SubNavItem[] = [
  { label: "Growth Brief", href: "/app/ai/growth-brief", icon: Newspaper },
  { label: "Campaign Analysis", href: "/app/ai/campaign-analyst", icon: Brain },
  {
    label: "Conversion Tracking",
    href: "/app/ai/sales-assistant",
    icon: MessageSquare,
  },
  { label: "Missed Opportunity", href: "/app/ai/show-rate", icon: BarChart3 },
  {
    label: "ROI Reporting",
    href: "/app/ai/ltv-optimiser",
    icon: PoundSterling,
  },
];

export default function AILayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SubNav items={AI_TOOLS_NAV} />
      {children}
    </div>
  );
}
