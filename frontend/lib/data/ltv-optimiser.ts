// ============================================================
// LTV Optimiser / ROI Reporting — data
// ============================================================

export const LTV_SEGMENTS = [
  {
    name: "VIP Regulars",
    patients: 45,
    avgSpend: "£2,840",
    visitFreq: "Every 12 weeks",
    ltv: "£14,200",
    trend: "+8%",
    color: "text-[#5A8A6A]",
  },
  {
    name: "Botox Loyalists",
    patients: 89,
    avgSpend: "£1,680",
    visitFreq: "Every 14 weeks",
    ltv: "£8,400",
    trend: "+5%",
    color: "text-[#4A6A8A]",
  },
  {
    name: "One-Treatment Visitors",
    patients: 156,
    avgSpend: "£420",
    visitFreq: "Single visit",
    ltv: "£420",
    trend: "-2%",
    color: "text-[#A07840]",
  },
  {
    name: "Lapsed High-Value",
    patients: 34,
    avgSpend: "£1,950",
    visitFreq: "Last visit 90+ days",
    ltv: "£5,850",
    trend: "-12%",
    color: "text-[#8A4A4A]",
  },
] as const;

export const CROSS_SELL_OPPORTUNITIES = [
  {
    from: "Botox",
    to: "Skin Treatment",
    patients: 67,
    conversionRate: "34%",
    avgUplift: "£280",
    reason: "Botox patients who add skin treatments spend 42% more annually",
  },
  {
    from: "Lip Filler",
    to: "Dermal Filler",
    patients: 45,
    conversionRate: "28%",
    avgUplift: "£450",
    reason:
      "Natural progression — 28% of lip filler patients add cheek/jaw filler within 6 months",
  },
  {
    from: "Consultation Only",
    to: "Botox Starter",
    patients: 89,
    conversionRate: "22%",
    avgUplift: "£350",
    reason:
      "Consult-only patients who receive a follow-up within 48h convert at 3× the rate",
  },
  {
    from: "Single Treatment",
    to: "Treatment Package",
    patients: 156,
    conversionRate: "18%",
    avgUplift: "£620",
    reason:
      "Package offers increase retention by 67% and average order value by 45%",
  },
] as const;

export const REBOOKING_INSIGHTS = [
  {
    treatment: "Botox",
    optimalInterval: "12-14 weeks",
    currentAvg: "16.2 weeks",
    gap: "2.2 weeks late",
    revenueImpact: "£18,400/yr lost",
    action: "Send rebooking reminder at week 11",
  },
  {
    treatment: "Lip Filler",
    optimalInterval: "6-9 months",
    currentAvg: "11.3 months",
    gap: "2.3 months late",
    revenueImpact: "£12,600/yr lost",
    action: "Send rebooking reminder at month 5",
  },
  {
    treatment: "Skin Treatments",
    optimalInterval: "4-6 weeks",
    currentAvg: "8.1 weeks",
    gap: "2.1 weeks late",
    revenueImpact: "£8,900/yr lost",
    action: "Auto-book next session at checkout",
  },
] as const;

export const UNDER_MONETISED = [
  {
    category: "Skin Treatments",
    currentRevenue: "£15,800",
    potential: "£28,400",
    gap: "£12,600",
    patients: 47,
    insight:
      "Only 31% of Botox patients are offered skin treatments. Cross-sell at consultation.",
  },
  {
    category: "Treatment Packages",
    currentRevenue: "£8,200",
    potential: "£22,000",
    gap: "£13,800",
    patients: 156,
    insight:
      "67% of single-treatment patients would convert to packages with the right offer.",
  },
  {
    category: "Maintenance Plans",
    currentRevenue: "£4,500",
    potential: "£16,800",
    gap: "£12,300",
    patients: 89,
    insight:
      "Subscription model for Botox could increase LTV by 40% and reduce churn.",
  },
] as const;
