import { describe, expect, it } from "vitest";
import {
  FREELANCER_REPORT_QA_STATUS_LABELS,
  FREELANCER_REPORT_WORK_TYPE_LABELS,
  formatReworkRate,
  getFreelancerReportReviewState,
  getFreelancerReportWorkTypeBreakdown,
  getMissingFreelancerReportWorkTypes,
} from "./freelancer-report-qa";
import type { FreelancerReportRecord, FreelancerReportSummaryRecord } from "./api-types";

describe("freelancer report QA helpers", () => {
  it("tracks the required CG-161 work types", () => {
    expect(Object.keys(FREELANCER_REPORT_WORK_TYPE_LABELS).sort()).toEqual([
      "design_video",
      "gbp",
      "ppc",
      "reporting",
      "seo",
      "wordpress_development",
    ]);
  });

  it("uses the visible QA states required by the operating repair", () => {
    expect(FREELANCER_REPORT_QA_STATUS_LABELS.awaiting_evidence).toBe(
      "Awaiting evidence",
    );
    expect(FREELANCER_REPORT_QA_STATUS_LABELS.awaiting_qa).toBe("Awaiting QA");
    expect(FREELANCER_REPORT_QA_STATUS_LABELS.failed_qa).toBe("Failed QA");
  });

  it("summarises missing coverage and rework without hiding rejected reports", () => {
    const summary: FreelancerReportSummaryRecord = {
      total: 4,
      awaitingEvidence: 1,
      awaitingQa: 1,
      accepted: 1,
      failedQa: 1,
      rejected: 0,
      reworkRate: 0.5,
      workTypesCovered: ["ppc", "seo"],
    };

    expect(formatReworkRate(summary)).toBe("50%");
    expect(getMissingFreelancerReportWorkTypes(summary)).toEqual([
      "gbp",
      "wordpress_development",
      "design_video",
      "reporting",
    ]);
  });

  it("breaks report coverage down by work type and high-risk review state", () => {
    const baseReport: FreelancerReportRecord = {
      id: "report-1",
      workType: "ppc",
      sourceEventId: "ppc-1",
      reportTitle: "PPC report",
      accountLabel: "Google Ads",
      reportingPeriodStart: "2026-09-01",
      reportingPeriodEnd: "2026-09-07",
      metrics: [],
      evidence: [],
      risks: [],
      recommendedActions: [],
      sourceLinks: ["https://example.com/report"],
      qaStatus: "accepted",
      qaNotes: null,
      highRiskChange: false,
      reviewerId: "reviewer-1",
      verificationDate: "2026-09-08",
      needsRework: false,
      createdAt: "2026-09-08T09:00:00.000Z",
      updatedAt: "2026-09-08T09:00:00.000Z",
    };

    const breakdown = getFreelancerReportWorkTypeBreakdown([
      baseReport,
      {
        ...baseReport,
        id: "report-2",
        qaStatus: "failed_qa",
        highRiskChange: true,
        needsRework: true,
      },
    ]);

    expect(breakdown.find((item) => item.workType === "ppc")).toEqual({
      workType: "ppc",
      total: 2,
      accepted: 1,
      blocked: 1,
      highRisk: 1,
    });
    expect(getFreelancerReportReviewState(baseReport)).toBe("Verified");
    expect(getFreelancerReportReviewState({ ...baseReport, qaStatus: "awaiting_evidence" })).toBe(
      "Evidence missing",
    );
    expect(getFreelancerReportReviewState({ ...baseReport, reviewerId: null, qaStatus: "awaiting_qa" })).toBe(
      "Reviewer needed",
    );
  });
});
