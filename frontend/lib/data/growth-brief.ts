// ============================================================
// Growth Brief — data & config
// ============================================================

import {
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Target,
  PoundSterling,
  Users,
  BarChart3,
} from "lucide-react";

export interface BriefItem {
  id: string;
  category: "win" | "risk" | "insight" | "opportunity";
  title: string;
  detail: string;
  metric?: string;
  metricLabel?: string;
}

export const WEEKLY_DIGEST = {
  period: "28 Apr – 4 May 2026",
  headline: "Revenue up 8% WoW — Botox driving growth, filler CPL rising",
  summary:
    "Strong week overall. Botox campaigns outperformed with a 7.8x ROAS. Lip filler CPL crept above target — review Meta audience targeting. Show rate improved 3 points after deposit enforcement on filler bookings. Referral channel continues to convert at 3× paid rate.",
} as const;

export const GROWTH_BRIEF_KPIS = [
  {
    label: "Weekly Revenue",
    value: "£31,200",
    change: "+8%",
    trend: "up" as const,
    icon: PoundSterling,
    color: "teal" as const,
  },
  {
    label: "New Leads",
    value: "42",
    change: "+5",
    trend: "up" as const,
    icon: Users,
    color: "blue" as const,
  },
  {
    label: "Booking Rate",
    value: "29%",
    change: "+2%",
    trend: "up" as const,
    icon: Target,
    color: "green" as const,
  },
  {
    label: "Avg CPL",
    value: "£26.40",
    change: "+£1.80",
    trend: "down" as const,
    icon: BarChart3,
    color: "amber" as const,
  },
] as const;

export const BRIEF_ITEMS: BriefItem[] = [
  {
    id: "1",
    category: "win",
    title: "Botox ROAS hit 7.8× this week",
    detail:
      "Google Search 'Botox near me' campaign generated £18,400 from £2,360 spend. Highest ROAS in 90 days. Conversion rate stable at 31%.",
    metric: "7.8×",
    metricLabel: "ROAS",
  },
  {
    id: "2",
    category: "win",
    title: "Show rate improved to 85%",
    detail:
      "Deposit enforcement on filler bookings pushed show rate from 82% to 85%. Revenue at risk from no-shows dropped by £2,100 this week.",
    metric: "85%",
    metricLabel: "Show Rate",
  },
  {
    id: "3",
    category: "risk",
    title: "Lip filler CPL rising — now £34.20",
    detail:
      "Meta Ads lip filler CPL increased 18% WoW. Broad audience targeting is pulling in lower-intent clicks. Recommend tightening to 25–45 female, 10-mile radius.",
    metric: "£34.20",
    metricLabel: "CPL",
  },
  {
    id: "4",
    category: "risk",
    title: "Response time slipped to 3.1 hrs",
    detail:
      "Average first-response time increased from 2.4 hrs to 3.1 hrs. 4 leads breached SLA this week — 3 during lunch hour gap. Consider staggered breaks or auto-SMS.",
    metric: "3.1 hrs",
    metricLabel: "Avg Response",
  },
  {
    id: "5",
    category: "insight",
    title: "Referral converts at 58% — 3× paid channels",
    detail:
      "Referral channel booked 9 of 15 leads this week. Zero CPL. Current referral incentive is £25 credit — consider increasing to £50 to scale this channel.",
    metric: "58%",
    metricLabel: "Conv. Rate",
  },
  {
    id: "6",
    category: "insight",
    title: "Tuesday 10am is your peak conversion window",
    detail:
      "Leads arriving Tuesday 9–11am convert at 38% vs 24% average. Align ad scheduling and team availability to capture this window.",
    metric: "38%",
    metricLabel: "Peak Conv.",
  },
  {
    id: "7",
    category: "opportunity",
    title: "Skin treatment cross-sell gap",
    detail:
      "Only 28% of Botox patients are offered skin treatments. Clinics in the top quartile cross-sell at 45%+. Estimated revenue uplift: £4,200/month.",
    metric: "£4.2k",
    metricLabel: "Monthly Uplift",
  },
  {
    id: "8",
    category: "opportunity",
    title: "Rebooking timing — £18k annual leakage",
    detail:
      "Botox patients rebook 2.2 weeks late on average. Automated week-11 reminders could recover £18,400/year in accelerated rebookings.",
    metric: "£18.4k",
    metricLabel: "Annual Recovery",
  },
];

export const PREVIOUS_BRIEFS = [
  {
    id: "p1",
    period: "21–27 Apr 2026",
    headline: "Filler campaign launched — early CPL below target",
    status: "viewed",
  },
  {
    id: "p2",
    period: "14–20 Apr 2026",
    headline: "Show rate dipped to 79% — deposit policy recommended",
    status: "viewed",
  },
  {
    id: "p3",
    period: "7–13 Apr 2026",
    headline: "Record week: £34,100 revenue, 48 new leads",
    status: "viewed",
  },
  {
    id: "p4",
    period: "31 Mar – 6 Apr 2026",
    headline: "Google Ads restructure complete — CPL down 12%",
    status: "viewed",
  },
] as const;

export const CATEGORY_CONFIG: Record<
  BriefItem["category"],
  {
    icon: typeof TrendingUp;
    iconColor: string;
    bg: string;
    borderLeft: string;
    label: string;
    labelBg: string;
    labelText: string;
  }
> = {
  win: {
    icon: TrendingUp,
    iconColor: "text-[#5A8A6A]",
    bg: "bg-[#F0FDF4]",
    borderLeft: "border-l-[#5A8A6A]",
    label: "Win",
    labelBg: "bg-[#F0FDF4]",
    labelText: "text-[#5A8A6A]",
  },
  risk: {
    icon: AlertTriangle,
    iconColor: "text-[#8A4A4A]",
    bg: "bg-[#FEF2F2]",
    borderLeft: "border-l-[#8A4A4A]",
    label: "Risk",
    labelBg: "bg-[#FEF2F2]",
    labelText: "text-[#8A4A4A]",
  },
  insight: {
    icon: Lightbulb,
    iconColor: "text-[#A07840]",
    bg: "bg-[#FFFBEB]",
    borderLeft: "border-l-[#A07840]",
    label: "Insight",
    labelBg: "bg-[#FFFBEB]",
    labelText: "text-[#A07840]",
  },
  opportunity: {
    icon: Target,
    iconColor: "text-[#7D8F7A]",
    bg: "bg-[rgba(125,143,122,0.06)]",
    borderLeft: "border-l-[#7D8F7A]",
    label: "Opportunity",
    labelBg: "bg-[rgba(125,143,122,0.08)]",
    labelText: "text-[#7D8F7A]",
  },
};
