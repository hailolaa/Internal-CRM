import type { BenchmarkSummaryRecord, ReputationSummaryRecord } from "@/lib/api-types";

export const REQUIRED_PIPELINE_STAGE_LABELS = [
  "New Enquiry",
  "Contacted",
  "Qualified",
  "Discovery Call Booked",
  "Proposal Sent",
  "Follow-Up Needed",
  "Won",
  "Lost",
] as const;

export function benchmarkHasSafeLowDataWording(summary: BenchmarkSummaryRecord) {
  return summary.metrics.some((metric) =>
    metric.enoughData === false &&
    metric.benchmarkSource === "estimated" &&
    /not enough data|internal comparison|estimated/i.test(`${metric.wording} ${summary.safeWording}`),
  );
}

export function benchmarkUsesEstimatedInternalWording(summary: BenchmarkSummaryRecord) {
  return /estimated|internal|available data/i.test(`${summary.safeWording} ${summary.cohortStatus}`);
}

export function reputationUsesManualFallback(summary: ReputationSummaryRecord) {
  return summary.manualReviewReceivedCount >= 0 &&
    summary.googleReviewSyncConnected === false &&
    summary.wording.some((item) => /manual|not connected/i.test(item));
}

export function replySuggestionIsAdvisory(reply: { advisory?: boolean; source?: string; suggestion?: string }) {
  return reply.advisory === true &&
    reply.source === "fallback" &&
    Boolean(reply.suggestion?.trim());
}

export function pipelineHasRequiredStageLabels(labels: string[]) {
  return REQUIRED_PIPELINE_STAGE_LABELS.every((label) => labels.includes(label));
}
