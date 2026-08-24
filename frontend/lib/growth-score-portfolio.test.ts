import { describe, expect, it } from "vitest";
import type { GrowthScorePortfolioRow } from "@/lib/api-types";
import {
  growthScoreDeltaLabel,
  growthScoreTone,
  sortPortfolioRows,
  summarizeGrowthScorePortfolio,
} from "./growth-score-portfolio";

const rows: GrowthScorePortfolioRow[] = [
  {
    clinicId: "clinic-1",
    clientAccountProfileId: "profile-1",
    clientName: "Bright Dental",
    clientStatus: "active",
    healthStatus: "healthy",
    currentPackage: "Growth Engine",
    currentScore: 82,
    previousScore: 72,
    scoreDelta: 10,
    currentSnapshotDate: "2026-08-01",
    recommendedPackage: "Market Leader",
    feedbackCount: 1,
    lastFeedbackAt: "2026-08-02",
    lastOutcomeType: "improved",
  },
  {
    clinicId: "clinic-2",
    clientAccountProfileId: "profile-2",
    clientName: "Aesthetic Clinic",
    clientStatus: "active",
    healthStatus: "attention_needed",
    currentPackage: "Lead Concierge",
    currentScore: 38,
    previousScore: 45,
    scoreDelta: -7,
    currentSnapshotDate: "2026-08-01",
    recommendedPackage: "Clinic Growth Engine",
    feedbackCount: 1,
    lastFeedbackAt: "2026-08-02",
    lastOutcomeType: "declined",
  },
];

describe("growth score portfolio helpers", () => {
  it("maps score and delta presentation", () => {
    expect(growthScoreTone(75)).toBe("success");
    expect(growthScoreTone(55)).toBe("warning");
    expect(growthScoreTone(30)).toBe("danger");
    expect(growthScoreTone(null)).toBe("neutral");
    expect(growthScoreDeltaLabel(6)).toBe("+6.0");
    expect(growthScoreDeltaLabel(-3.25)).toBe("-3.3");
  });

  it("sorts drill-down rows by lowest score first", () => {
    expect(sortPortfolioRows(rows).map((row) => row.clientName)).toEqual(["Aesthetic Clinic", "Bright Dental"]);
  });

  it("summarizes aggregate feedback and trend state", () => {
    const summary = summarizeGrowthScorePortfolio({
      generatedAt: "2026-08-24T00:00:00.000Z",
      scope: "all_clients",
      aggregate: {
        clients: 2,
        clientsWithScores: 2,
        averageScore: 60,
        improved: 1,
        declined: 1,
        stable: 0,
        feedbackItems: 2,
      },
      trends: [
        { snapshotDate: "2026-07-01", averageScore: 58, scoredClients: 2 },
        { snapshotDate: "2026-08-01", averageScore: 60, scoredClients: 2 },
      ],
      clients: rows,
    });

    expect(summary.improving).toBe(1);
    expect(summary.declining).toBe(1);
    expect(summary.hasTrend).toBe(true);
  });
});
