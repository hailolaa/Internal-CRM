"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Users,
  CreditCard,
  Shield,
  FileText,
  MapPin,
} from "lucide-react";

const SETTINGS_NAV = [
  { label: "Account Profile", href: "/app/settings/clinic", icon: Building2 },
  { label: "Team", href: "/app/settings/team", icon: Users },
  { label: "Locations", href: "/app/settings/locations", icon: MapPin },
  { label: "Billing & Plans", href: "/app/settings/billing", icon: CreditCard },
  { label: "Security", href: "/app/settings/security", icon: Shield },
  {
    label: "Compliance & Audit",
    href: "/app/settings/compliance",
    icon: FileText,
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // On the settings index page, just render children (the index shows its own cards)
  if (pathname === "/app/settings") {
    return <>{children}</>;
  }

  return (
    <div className="flex gap-8">
      {/* Settings sidebar — desktop only */}
      <aside className="hidden lg:block w-48 flex-shrink-0">
        <nav className="space-y-0.5 sticky top-20">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] px-3 mb-3">
            Settings
          </p>
          {SETTINGS_NAV.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-[rgba(110,106,232,0.08)] text-[#111111]"
                    : "text-[#6B7280] hover:text-[#111111] hover:bg-[rgba(0,0,0,0.03)]"
                }`}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${
                    isActive ? "text-[#6E6AE8]" : "text-[#6B7280]"
                  }`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile: horizontal scroll tabs */}
      <div className="flex-1 min-w-0">
        <div className="lg:hidden flex gap-1 overflow-x-auto pb-1 mb-6 border-b border-[rgba(0,0,0,0.06)]">
          {SETTINGS_NAV.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors flex-shrink-0 ${
                  isActive
                    ? "bg-[rgba(110,106,232,0.08)] text-[#6E6AE8] border border-[rgba(110,106,232,0.15)]"
                    : "text-[#6B7280] hover:text-[#111111] hover:bg-[rgba(0,0,0,0.03)]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
        {children}
      </div>
    </div>
  );
}
