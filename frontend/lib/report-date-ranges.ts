import type { DashboardQueryParams } from "@/lib/api-client/reports-ops-api";

export const REPORT_DATE_RANGES = [
  "Last 30 days",
  "Last 7 days",
  "Last 90 days",
  "This year",
] as const;

export type ReportDateRangeLabel = (typeof REPORT_DATE_RANGES)[number];

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getReportDateRangeParams(
  label: string,
): DashboardQueryParams {
  const end = new Date();
  const start = new Date(end);

  if (label === "Last 7 days") {
    start.setDate(end.getDate() - 6);
  } else if (label === "Last 90 days") {
    start.setDate(end.getDate() - 89);
  } else if (label === "This year") {
    start.setMonth(0, 1);
  } else {
    start.setDate(end.getDate() - 29);
  }

  return {
    startDate: dateOnly(start),
    endDate: dateOnly(end),
  };
}
