"use client";

import { BarChart3, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { SubNav } from "@/components/sub-nav";

const REPORTS_NAV = [
  { label: "Overview", href: "/app/reports/overview", icon: BarChart3 },
  { label: "Leads & Bookings", href: "/app/reports/leads", icon: Users },
  { label: "Ads & ROI", href: "/app/reports/ads", icon: TrendingUp },
  { label: "No-shows", href: "/app/reports/noshows", icon: AlertTriangle },
];

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <SubNav items={REPORTS_NAV} />
      {children}
    </div>
  );
}
