import type { GrowthScorePortfolio, GrowthScorePortfolioRow } from "@/lib/api-types";

export type GrowthScoreTone = "success" | "warning" | "danger" | "neutral";

export function growthScoreTone(score: number | null | undefined): GrowthScoreTone {
  if (score === null || score === undefined) return "neutral";
  if (score >= 70) return "success";
  if (score >= 45) return "warning";
  return "danger";
}

export function growthScoreDeltaLabel(delta: number | null | undefined) {
  if (delta === null || delta === undefined) return "No prior score";
  if (delta > 0) return `+${delta.toFixed(1)}`;
  return delta.toFixed(1);
}

export function sortPortfolioRows(rows: GrowthScorePortfolioRow[]) {
  return [...rows].sort((left, right) => {
    const leftAttention = left.currentScore === null ? -1 : left.currentScore;
    const rightAttention = right.currentScore === null ? -1 : right.currentScore;
    return leftAttention - rightAttention || left.clientName.localeCompare(right.clientName);
  });
}

export function summarizeGrowthScorePortfolio(portfolio: GrowthScorePortfolio) {
  const needsScore = portfolio.clients.filter((client) => client.currentScore === null).length;
  const declining = portfolio.clients.filter((client) => (client.scoreDelta ?? 0) < 0 || client.lastOutcomeType === "declined").length;
  const improving = portfolio.clients.filter((client) => (client.scoreDelta ?? 0) > 0 || client.lastOutcomeType === "improved").length;

  return {
    ...portfolio.aggregate,
    needsScore,
    declining,
    improving,
    hasTrend: portfolio.trends.length > 1,
  };
}
