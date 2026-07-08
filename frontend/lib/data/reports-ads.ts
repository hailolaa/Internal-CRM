// ============================================================
// Reports: Ads & ROI — data
// ============================================================

import { PoundSterling, Target, Users, TrendingUp } from "lucide-react";
import type { StatCardData } from "@/lib/types";

export const ADS_METRICS: StatCardData[] = [
  {
    label: "Total Ad Spend",
    value: "£4,234",
    change: "+8%",
    trend: "up",
    icon: PoundSterling,
    color: "blue",
  },
  {
    label: "Total Leads",
    value: "156",
    change: "+12%",
    trend: "up",
    icon: Users,
    color: "green",
  },
  {
    label: "Cost Per Lead",
    value: "£27.14",
    change: "-5%",
    trend: "up",
    icon: Target,
    color: "teal",
  },
  {
    label: "ROAS",
    value: "3.2x",
    change: "+0.4x",
    trend: "up",
    icon: TrendingUp,
    color: "violet",
  },
];

export const ADS_CAMPAIGNS = [
  {
    name: "Botox January Promo",
    platform: "Google Ads",
    spend: "£1,234",
    impressions: "45,678",
    clicks: "1,234",
    ctr: "2.7%",
    leads: 45,
    cpl: "£27.42",
    roas: "3.2x",
    status: "active",
  },
  {
    name: "Lip Filler Instagram",
    platform: "Meta Ads",
    spend: "£856",
    impressions: "32,456",
    clicks: "987",
    ctr: "3.0%",
    leads: 34,
    cpl: "£25.18",
    roas: "2.9x",
    status: "active",
  },
  {
    name: "Brand Awareness",
    platform: "Meta Ads",
    spend: "£567",
    impressions: "89,234",
    clicks: "456",
    ctr: "0.5%",
    leads: 12,
    cpl: "£47.25",
    roas: "1.4x",
    status: "active",
  },
  {
    name: "Dermal Filler Search",
    platform: "Google Ads",
    spend: "£789",
    impressions: "23,456",
    clicks: "678",
    ctr: "2.9%",
    leads: 28,
    cpl: "£28.18",
    roas: "2.8x",
    status: "paused",
  },
  {
    name: "Retargeting",
    platform: "Meta Ads",
    spend: "£456",
    impressions: "12,345",
    clicks: "234",
    ctr: "1.9%",
    leads: 18,
    cpl: "£25.33",
    roas: "3.6x",
    status: "active",
  },
  {
    name: "Local Search",
    platform: "Google Ads",
    spend: "£332",
    impressions: "8,765",
    clicks: "198",
    ctr: "2.3%",
    leads: 19,
    cpl: "£17.47",
    roas: "4.1x",
    status: "active",
  },
] as const;

export const PLATFORM_BREAKDOWN = [
  {
    platform: "Google Ads",
    spend: "£2,355",
    leads: 92,
    cpl: "£25.60",
    roas: "3.4x",
    percentage: 56,
    emoji: "🎯",
    color: "bg-[rgba(74,106,138,0.08)]",
  },
  {
    platform: "Meta Ads",
    spend: "£1,879",
    leads: 64,
    cpl: "£29.36",
    roas: "2.6x",
    percentage: 44,
    emoji: "📱",
    color: "bg-[rgba(110,106,232,0.08)]",
  },
] as const;

export const TOP_KEYWORDS = [
  {
    keyword: "botox near me",
    clicks: 234,
    cpc: "£2.45",
    conversions: 12,
    cpa: "£47.67",
  },
  {
    keyword: "lip filler london",
    clicks: 189,
    cpc: "£3.12",
    conversions: 8,
    cpa: "£73.71",
  },
  {
    keyword: "aesthetics clinic",
    clicks: 156,
    cpc: "£1.89",
    conversions: 6,
    cpa: "£49.14",
  },
  {
    keyword: "anti wrinkle treatment",
    clicks: 134,
    cpc: "£2.67",
    conversions: 5,
    cpa: "£71.54",
  },
  {
    keyword: "dermal filler",
    clicks: 98,
    cpc: "£2.98",
    conversions: 4,
    cpa: "£73.01",
  },
] as const;
