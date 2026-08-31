import { describe, expect, it } from "vitest";
import { buildPhase2ClientMetrics, clientLocationLabel } from "./phase2-client-metrics";
import type {
  ClientAccountSummaryRecord,
  FinanceRevenueViewRecord,
  RevenueRiskModelReportRecord,
} from "@/lib/api-types";

function account(overrides: Partial<ClientAccountSummaryRecord>): ClientAccountSummaryRecord {
  return {
    id: "profile-1",
    clinicId: "clinic-1",
    clinicName: "Demo Clinic",
    email: null,
    phone: null,
    website: null,
    address: null,
    city: "Bristol",
    state: null,
    postalCode: null,
    country: "UK",
    accountManager: null,
    activeServices: [],
    onboardingStatus: "completed",
    healthStatus: "healthy",
    clientStatus: "active",
    currentPackage: "Clinic Growth",
    monthlyPrice: 1995,
    setupFee: null,
    currency: "GBP",
    recommendedNextPackage: null,
    upsellOpportunity: null,
    growthScore: {
      overall: null,
      categories: {
        websiteVisibility: null,
        seo: null,
        gbp: null,
        tracking: null,
        conversion: null,
        leadHandling: null,
        responseSpeed: null,
        enquiryVisibility: null,
        treatmentPerformance: null,
        revenueLeakage: null,
        growthOpportunity: null,
      },
      recommendedPackage: null,
      gapSummary: null,
      updatedAt: null,
    },
    growthScoreOverall: null,
    growthScoreCategories: {
      websiteVisibility: null,
      seo: null,
      gbp: null,
      tracking: null,
      conversion: null,
      leadHandling: null,
      responseSpeed: null,
      enquiryVisibility: null,
      treatmentPerformance: null,
      revenueLeakage: null,
      growthOpportunity: null,
    },
    growthScoreRecommendedPackage: null,
    growthScoreGapSummary: null,
    growthScoreUpdatedAt: null,
    churnRisk: "low",
    lastContactAt: null,
    lastReportAt: null,
    lastLoomAt: null,
    renewalDate: null,
    contractStatus: "active",
    contractStartDate: null,
    noticeDate: null,
    paymentStatus: "paid",
    invoiceStatus: "paid",
    paymentNotes: null,
    keyNotes: null,
    googleDriveFolderId: null,
    googleDriveFolderUrl: null,
    googleDriveFolderName: null,
    googleDriveFolderAccessStatus: "not_checked",
    googleDriveFolderError: null,
    googleDriveFolderCheckedAt: null,
    upsellPrompts: [],
    openIssueCount: 0,
    overdueIssueCount: 0,
    missingDocumentCount: 0,
    missingAccessCount: 0,
    updatedAt: null,
    activeServiceCount: 1,
    renewalRiskCount: 0,
    pendingTaskCount: 0,
    overdueTaskCount: 0,
    qaTaskCount: 0,
    missedTaskCount: 0,
    escalatedTaskCount: 0,
    lastStrategyLogAt: null,
    actionPlanId: null,
    actionPlanMonth: null,
    actionPlanStatus: null,
    actionPlanTotalItems: 0,
    actionPlanCompletedItems: 0,
    actionPlanOpenItems: 0,
    actionPlanHighPriorityOpenItems: 0,
    actionPlanProgressPercent: 0,
    actionPlanLastUpdatedAt: null,
    ...overrides,
  };
}

const revenueView: FinanceRevenueViewRecord = {
  periods: [
    {
      clientAccountProfileId: "profile-1",
      periodMonth: "2026-08-01",
      currency: "GBP",
      mrrCents: 199500,
      recognizedRevenueCents: 199500,
      costCents: 70000,
      marginCents: 129500,
      marginPercent: 64.91,
    },
    {
      clientAccountProfileId: "profile-2",
      periodMonth: "2026-08-01",
      currency: "GBP",
      mrrCents: 349500,
      recognizedRevenueCents: 349500,
      costCents: 210000,
      marginCents: 139500,
      marginPercent: 39.91,
    },
  ],
  movements: [
    {
      clientAccountProfileId: "profile-1",
      periodMonth: "2026-08-01",
      previousMrrCents: 99500,
      currentMrrCents: 199500,
      movementCents: 100000,
      category: "expansion",
    },
  ],
  totals: {
    currency: "GBP",
    mrrCents: 549000,
    recognizedRevenueCents: 549000,
    costCents: 280000,
    marginCents: 269000,
    marginPercent: 49,
  },
};

const riskReport: RevenueRiskModelReportRecord = {
  model: {
    name: "revenue_risk_v1",
    type: "deterministic_weighted_rules",
    version: 1,
    trainedFrom: "client_revenue_periods_and_account_risk_signals",
    explainability: "per_prediction_weighted_reasons",
  },
  fromMonth: "2026-06-01",
  toMonth: "2026-08-01",
  predictions: [
    {
      clientAccountProfileId: "profile-2",
      periodMonth: "2026-08-01",
      currency: "GBP",
      riskScore: 72,
      riskLevel: "high",
      predictedRevenueAtRiskCents: 1048500,
      currentMrrCents: 349500,
      marginPercent: 39.91,
      explanations: ["Client health is marked at risk."],
      recommendedActions: ["Review account owner plan"],
    },
  ],
  backtest: {
    fromMonth: "2026-06-01",
    toMonth: "2026-08-01",
    validationRows: 2,
    truePositive: 1,
    trueNegative: 1,
    falsePositive: 0,
    falseNegative: 0,
    accuracy: 1,
    threshold: 0.6,
    meetsThreshold: true,
    status: "validated",
  },
};

describe("buildPhase2ClientMetrics", () => {
  it("groups retention, profit and current MRR by client location with drill-down links", () => {
    const metrics = buildPhase2ClientMetrics({
      accounts: [
        account({ id: "profile-1", clinicId: "clinic-1", clinicName: "Bristol Dental", city: "Bristol", country: "UK" }),
        account({ id: "profile-2", clinicId: "clinic-2", clinicName: "London Skin", city: "London", country: "UK", churnRisk: "medium" }),
      ],
      revenueView,
      riskReport,
    });

    expect(metrics.currentMrrCents).toBe(549000);
    expect(metrics.marginCents).toBe(269000);
    expect(metrics.retentionRiskCount).toBe(1);
    expect(metrics.locationRows).toEqual([
      expect.objectContaining({
        label: "London, UK",
        clientCount: 1,
        currentMrrCents: 349500,
        retentionRiskCount: 1,
        href: "/app/ops/client-accounts?search=London%2C%20UK&from=dashboard",
      }),
      expect.objectContaining({
        label: "Bristol, UK",
        clientCount: 1,
        currentMrrCents: 199500,
        retentionRiskCount: 0,
      }),
    ]);
    expect(metrics.clientRows[0]).toEqual(expect.objectContaining({
      clinicName: "London Skin",
      retentionRisk: "high",
      source: "Finance movement",
    }));
    expect(metrics.sourceLabel).toBe("Finance movement, client services and account health");
  });

  it("falls back to client account profile values when finance movement is unavailable", () => {
    const metrics = buildPhase2ClientMetrics({
      accounts: [account({ monthlyPrice: 995, city: null, country: null, address: "Main Street" })],
      revenueView: null,
      riskReport: null,
    });

    expect(clientLocationLabel({ address: null, city: null, state: null, country: null })).toBe("Location not set");
    expect(metrics.clientRows[0]?.locationLabel).toBe("Main Street");
    expect(metrics.currentMrrCents).toBe(99500);
    expect(metrics.sourceLabel).toBe("Client account profile fallback");
    expect(metrics.locationRows[0]).toEqual(expect.objectContaining({
      label: "Main Street",
      currentMrrCents: 99500,
      href: "/app/ops/client-accounts?search=Main%20Street&from=dashboard",
    }));
  });
});
