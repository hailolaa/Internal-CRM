"use client";

import { Megaphone, Target, Gift, Star } from "lucide-react";
import { SubNav } from "@/components/sub-nav";

const MARKETING_NAV = [
  { label: "Campaigns", href: "/app/marketing/campaigns", icon: Megaphone },
  { label: "Attribution", href: "/app/marketing/attribution", icon: Target },
  { label: "Offers", href: "/app/marketing/offers", icon: Gift },
  { label: "Reviews & GBP", href: "/app/marketing/reviews", icon: Star },
];

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
