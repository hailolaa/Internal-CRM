import type {
  FreelancerReportQaStatus,
  FreelancerReportRecord,
  FreelancerReportSummaryRecord,
  FreelancerReportWorkType,
} from "@/lib/api-types";

export const FREELANCER_REPORT_WORK_TYPE_LABELS: Record<
  FreelancerReportWorkType,
  string
> = {
  ppc: "PPC",
  seo: "SEO",
  gbp: "GBP",
  wordpress_development: "Website / WordPress",
  design_video: "Design / Video",
  reporting: "Reporting",
};

export const FREELANCER_REPORT_WORK_TYPES = Object.keys(
  FREELANCER_REPORT_WORK_TYPE_LABELS,
) as FreelancerReportWorkType[];

export const FREELANCER_REPORT_QA_STATUS_LABELS: Record<
  FreelancerReportQaStatus,
  string
> = {
  awaiting_evidence: "Awaiting evidence",
  awaiting_qa: "Awaiting QA",
  accepted: "Accepted",
  failed_qa: "Failed QA",
  rejected: "Rejected",
};

export function getMissingFreelancerReportWorkTypes(
  summary: FreelancerReportSummaryRecord | null,
) {
  const covered = new Set(summary?.workTypesCovered || []);
  return FREELANCER_REPORT_WORK_TYPES.filter((workType) => !covered.has(workType));
}

export function formatReworkRate(summary: FreelancerReportSummaryRecord | null) {
  if (!summary || summary.total === 0) return "0%";
  return `${Math.round(summary.reworkRate * 100)}%`;
}

export function getFreelancerReportWorkTypeBreakdown(
  reports: FreelancerReportRecord[],
) {
  return FREELANCER_REPORT_WORK_TYPES.map((workType) => {
    const workTypeReports = reports.filter((report) => report.workType === workType);
    const accepted = workTypeReports.filter((report) => report.qaStatus === "accepted").length;
    const blocked = workTypeReports.filter((report) =>
      ["awaiting_evidence", "awaiting_qa", "failed_qa", "rejected"].includes(report.qaStatus),
    ).length;

    return {
      workType,
      total: workTypeReports.length,
      accepted,
      blocked,
      highRisk: workTypeReports.filter((report) => report.highRiskChange).length,
    };
  });
}

export function getFreelancerReportReviewState(report: FreelancerReportRecord) {
  if (report.needsRework) return "Needs rework";
  if (report.qaStatus === "accepted") return report.verificationDate ? "Verified" : "Accepted";
  if (report.qaStatus === "awaiting_evidence") return "Evidence missing";
  return report.reviewerId ? "Reviewer assigned" : "Reviewer needed";
}
