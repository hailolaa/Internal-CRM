// ============================================================
// Benchmarking — data
// ============================================================

export const BENCHMARKS = [
  {
    metric: "Speed to Lead",
    yours: "2.4 hrs",
    industry: "8 mins",
    percentile: 32,
    status: "below" as const,
    insight:
      "Clinics converting above 28% respond within 5 minutes. You're losing leads to slower response.",
  },
  {
    metric: "Booking Rate",
    yours: "27.4%",
    industry: "32%",
    percentile: 41,
    status: "below" as const,
    insight:
      "Top quartile clinics book 35%+ of leads. Your follow-up sequence needs tightening.",
  },
  {
    metric: "Show Rate",
    yours: "82%",
    industry: "85%",
    percentile: 55,
    status: "average" as const,
    insight:
      "Deposit enforcement and 2-hour reminders push show rates above 90%.",
  },
  {
    metric: "Consult Conversion",
    yours: "68%",
    industry: "62%",
    percentile: 72,
    status: "above" as const,
    insight:
      "You're outperforming on consult conversion. Your practitioners are closing well.",
  },
  {
    metric: "Cost Per Booking",
    yours: "£34.20",
    industry: "£42",
    percentile: 78,
    status: "above" as const,
    insight: "Your CPB is well below average. Strong campaign efficiency.",
  },
  {
    metric: "Revenue Per Patient",
    yours: "£680",
    industry: "£520",
    percentile: 81,
    status: "above" as const,
    insight:
      "Your average patient value is 31% above industry. Strong upselling.",
  },
  {
    metric: "Repeat Visit Rate",
    yours: "67%",
    industry: "58%",
    percentile: 74,
    status: "above" as const,
    insight: "Good retention. Automated rebooking could push this above 75%.",
  },
  {
    metric: "Botox Booking Conv.",
    yours: "31%",
    industry: "29%",
    percentile: 62,
    status: "average" as const,
    insight:
      "Slightly above average. Test urgency-based CTAs to improve further.",
  },
  {
    metric: "Filler ROI",
    yours: "6.8x",
    industry: "5.2x",
    percentile: 79,
    status: "above" as const,
    insight:
      "Strong filler ROI. Consider increasing budget allocation to filler campaigns.",
  },
] as const;

export type BenchmarkStatus = "above" | "below" | "average";
