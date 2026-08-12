import type { ProposalV5EvidenceState, ProposalV5Snapshot } from "./proposalV5Types";

export interface ProposalV5BreakEvenCalculation {
  canCalculate: boolean;
  state: ProposalV5EvidenceState;
  monthlyFeeCents: number | null;
  mediaSpendCents: number | null;
  relevantMonthlyInvestmentCents: number | null;
  contributionCents: number | null;
  recurringBreakEvenUnits: number | null;
  firstMonthBreakEvenUnits: number | null;
  missingFields: string[];
}

export function calculateProposalV5BreakEven(snapshot: ProposalV5Snapshot): ProposalV5BreakEvenCalculation {
  const missingFields: string[] = [];
  const monthlyFeeCents = snapshot.selectedPackage.monthlyFeeCents;
  const setupFeeCents = snapshot.selectedPackage.setupFeeCents || 0;
  const mediaSpendCents = snapshot.economics.selectedMediaSpend.value;
  const contributionCents = snapshot.economics.contribution.value;

  if (monthlyFeeCents === null || monthlyFeeCents <= 0) missingFields.push("selectedPackage.monthlyFeeCents");
  if (mediaSpendCents === null || mediaSpendCents < 0) missingFields.push("economics.selectedMediaSpend.value");
  if (contributionCents === null || contributionCents <= 0) missingFields.push("economics.contribution.value");
  if (snapshot.economics.contribution.state !== "known") missingFields.push("economics.contribution.state");
  if (snapshot.economics.selectedMediaSpend.state !== "known") missingFields.push("economics.selectedMediaSpend.state");

  const relevantMonthlyInvestmentCents =
    monthlyFeeCents !== null && monthlyFeeCents > 0 && mediaSpendCents !== null && mediaSpendCents >= 0
      ? monthlyFeeCents + mediaSpendCents
      : null;
  const canCalculate = missingFields.length === 0 && relevantMonthlyInvestmentCents !== null && contributionCents !== null;

  return {
    canCalculate,
    state: canCalculate ? "known" : "to_confirm",
    monthlyFeeCents,
    mediaSpendCents,
    relevantMonthlyInvestmentCents,
    contributionCents,
    recurringBreakEvenUnits: canCalculate ? Math.ceil(relevantMonthlyInvestmentCents / contributionCents) : null,
    firstMonthBreakEvenUnits: canCalculate
      ? Math.ceil((relevantMonthlyInvestmentCents + setupFeeCents) / contributionCents)
      : null,
    missingFields,
  };
}

export function formatProposalV5Money(cents: number | null) {
  if (cents === null) return "\u00a3 ______";
  const amount = cents / 100;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
