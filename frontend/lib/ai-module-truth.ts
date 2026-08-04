import type {
  AiRunRecord,
  CampaignMetricRecord,
  DashboardSummaryRecord,
} from "@/lib/api-types";

export type CampaignManualField =
  | "googleSpend"
  | "metaSpend"
  | "leads"
  | "bookings"
  | "revenue";

export type CampaignManualFields = Record<CampaignManualField, string>;

export interface CampaignManualValues {
  googleSpend: number;
  metaSpend: number;
  leads: number;
  bookings: number;
  revenue: number;
}

export interface CampaignValidationResult {
  errors: Partial<Record<CampaignManualField, string>>;
  values: CampaignManualValues | null;
}

export function validateCampaignManualInputs(
  fields: CampaignManualFields,
): CampaignValidationResult {
  const errors: CampaignValidationResult["errors"] = {};
  const values = {} as CampaignManualValues;

  (Object.keys(fields) as CampaignManualField[]).forEach((field) => {
    const raw = fields[field].trim();
    const label =
      field === "googleSpend"
        ? "Google spend"
        : field === "metaSpend"
          ? "Meta spend"
          : field.charAt(0).toUpperCase() + field.slice(1);

    if (!raw) {
      errors[field] = `${label} is required in Manual mode.`;
      return;
    }

    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      errors[field] = `${label} must be zero or more.`;
      return;
    }

    if ((field === "leads" || field === "bookings") && !Number.isInteger(value)) {
      errors[field] = `${label} must be a whole number.`;
      return;
    }

    values[field] = value;
  });

  if (
    !errors.googleSpend &&
    !errors.metaSpend &&
    Number(fields.googleSpend) + Number(fields.metaSpend) <= 0
  ) {
    errors.googleSpend = "Enter spend for at least one paid channel.";
  }

  if (
    !errors.leads &&
    !errors.bookings &&
    Number(fields.bookings) > Number(fields.leads)
  ) {
    errors.bookings = "Bookings cannot exceed leads.";
  }

  return {
    errors,
    values: Object.keys(errors).length === 0 ? values : null,
  };
}

export type SupportedCampaignChannel = "google" | "meta" | "other";

const googlePaidCampaignKeys = new Set([
  "google",
  "google_ad",
  "google_ads",
  "google_adwords",
  "google_paid_search",
  "google_ppc",
  "googleads",
]);
const metaPaidCampaignKeys = new Set([
  "facebook",
  "facebook_ads",
  "instagram",
  "instagram_ads",
  "meta",
  "meta_ads",
]);

export type CampaignMetricLike = Pick<
  CampaignMetricRecord,
  | "bookedConsults"
  | "channel"
  | "leads"
  | "revenue"
  | "source"
  | "spend"
> & {
  period?: string;
};

export function campaignMetricChannel(
  metric: Pick<CampaignMetricLike, "channel" | "source">,
): SupportedCampaignChannel {
  const keys = [metric.source, metric.channel].map((value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, ""),
  );

  if (keys.some((key) => googlePaidCampaignKeys.has(key))) return "google";
  if (keys.some((key) => metaPaidCampaignKeys.has(key))) {
    return "meta";
  }
  return "other";
}

export function campaignPeriods(metrics: CampaignMetricRecord[]) {
  return Array.from(
    new Set(metrics.map((metric) => metric.period.trim()).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, "en-GB"));
}

export function summariseCampaignMetrics(
  metrics: CampaignMetricLike[],
  period: string,
) {
  const selected =
    period === "all"
      ? metrics
      : metrics.filter((metric) => metric.period === period);

  return selected.reduce(
    (totals, metric) => {
      const channel = campaignMetricChannel(metric);
      const spend = Number(metric.spend || 0);

      if (channel === "other") {
        totals.otherSpend += spend;
        totals.excludedRows += 1;
        return totals;
      }

      if (channel === "google") totals.googleSpend += spend;
      if (channel === "meta") totals.metaSpend += spend;
      totals.leads += Number(metric.leads || 0);
      totals.bookings += Number(metric.bookedConsults || 0);
      totals.revenue += Number(metric.revenue || 0);
      totals.includedRows += 1;
      return totals;
    },
    {
      bookings: 0,
      excludedRows: 0,
      googleSpend: 0,
      includedRows: 0,
      leads: 0,
      metaSpend: 0,
      otherSpend: 0,
      revenue: 0,
    },
  );
}

function toLocalDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateWithDayOffset(now: Date, offset: number) {
  const value = new Date(now);
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + offset);
  return toLocalDateOnly(value);
}

export function recentDateRange(days: number, now: Date = new Date()) {
  return {
    startDate: dateWithDayOffset(now, -(Math.max(1, days) - 1)),
    endDate: dateWithDayOffset(now, 0),
  };
}

export function upcomingDateRange(days: number, now: Date = new Date()) {
  return {
    startDate: dateWithDayOffset(now, 0),
    endDate: dateWithDayOffset(now, Math.max(1, days) - 1),
  };
}

export function isValidDateRange(startDate: string, endDate: string) {
  if (!startDate || !endDate) return false;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return (
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    start.getTime() <= end.getTime()
  );
}

export const CURRENT_LTV_DATA_CONTRACT = "phase1_ltv_optimiser_v3";

export function isCurrentLtvRun(run: AiRunRecord) {
  if (!run.input || typeof run.input !== "object") return false;
  return (
    (run.input as { dataContract?: unknown }).dataContract ===
    CURRENT_LTV_DATA_CONTRACT
  );
}

export function countOtherLtvFollowUps(
  recommendations: Array<{ urgency: "high" | "medium" | "low" }>,
) {
  return recommendations.filter(
    (recommendation) =>
      recommendation.urgency === "medium" ||
      recommendation.urgency === "low",
  ).length;
}

export const REVENUE_SCENARIOS = [
  {
    id: "downside",
    label: "Downside",
    monthlyChange: -0.1,
    description: "Revenue and lead volume fall 10% each month.",
  },
  {
    id: "steady",
    label: "Steady",
    monthlyChange: 0,
    description: "The normalised baseline holds for all three months.",
  },
  {
    id: "planning-upside",
    label: "Planning upside",
    monthlyChange: 0.1,
    description: "Revenue and lead volume rise 10% each month.",
  },
] as const;

export type RevenueScenarioId = (typeof REVENUE_SCENARIOS)[number]["id"];

function inclusiveDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function buildRevenueScenarioPreview(
  summary: DashboardSummaryRecord | null,
  scenarioId: RevenueScenarioId,
  now: Date = new Date(),
) {
  if (!summary || summary.emptyState || summary.financials.totalRevenue <= 0) {
    return null;
  }

  const scenario =
    REVENUE_SCENARIOS.find((item) => item.id === scenarioId) ||
    REVENUE_SCENARIOS[1];
  const coverageDays = inclusiveDays(
    summary.range.startDate,
    summary.range.endDate,
  );
  if (coverageDays <= 0) return null;

  const baselineMonthlyRevenue =
    (summary.financials.totalRevenue / coverageDays) * 30;
  const baselineMonthlyLeads = (summary.cards.leads / coverageDays) * 30;
  const bookingRate =
    summary.cards.leads > 0
      ? summary.cards.bookedConsults / summary.cards.leads
      : null;

  const months = [1, 2, 3].map((offset) => {
    const date = new Date(now);
    date.setMonth(date.getMonth() + offset);
    const factor = Math.pow(1 + scenario.monthlyChange, offset);
    const leads = baselineMonthlyLeads * factor;

    return {
      bookings: bookingRate === null ? null : Math.round(leads * bookingRate),
      label: new Intl.DateTimeFormat("en-GB", {
        month: "short",
        year: "numeric",
      }).format(date),
      leads: Math.round(leads),
      revenue: baselineMonthlyRevenue * factor,
    };
  });

  return {
    baselineMonthlyLeads,
    baselineMonthlyRevenue,
    bookingRate,
    coverageDays,
    months,
    scenario,
    totalRevenue: months.reduce((total, month) => total + month.revenue, 0),
  };
}

export type InsightFreshness = "current" | "stale" | "unknown";

interface CompetitorFreshnessRecord {
  id: string;
  updatedAt?: string | null;
}

function runCompetitorIds(run: AiRunRecord | null) {
  if (!run?.input || typeof run.input !== "object") return null;
  const ids = (run.input as { competitorIds?: unknown }).competitorIds;
  return Array.isArray(ids) && ids.every((item) => typeof item === "string")
    ? [...ids].sort()
    : null;
}

export function competitorInsightFreshness(
  competitors: CompetitorFreshnessRecord[],
  run: AiRunRecord | null,
): InsightFreshness {
  if (!run) return "unknown";

  const savedIds = runCompetitorIds(run);
  const currentIds = competitors.map((competitor) => competitor.id).sort();
  if (
    savedIds &&
    (savedIds.length !== currentIds.length ||
      savedIds.some((id, index) => id !== currentIds[index]))
  ) {
    return "stale";
  }

  const generatedAt = new Date(run.createdAt).getTime();
  if (!Number.isFinite(generatedAt)) return "unknown";

  let hasUnknownDate = false;
  for (const competitor of competitors) {
    if (!competitor.updatedAt) {
      hasUnknownDate = true;
      continue;
    }
    const updatedAt = new Date(competitor.updatedAt).getTime();
    if (!Number.isFinite(updatedAt)) {
      hasUnknownDate = true;
      continue;
    }
    if (updatedAt > generatedAt) return "stale";
  }

  if (!savedIds || hasUnknownDate) return "unknown";
  return "current";
}

export function competitorRecordFreshness(
  updatedAt?: string | null,
  now: Date = new Date(),
) {
  if (!updatedAt) return { label: "Review date not recorded", stale: null };
  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) {
    return { label: "Review date not recorded", stale: null };
  }

  const elapsedDays = Math.max(
    0,
    Math.floor((now.getTime() - timestamp) / 86_400_000),
  );
  if (elapsedDays === 0) return { label: "Reviewed today", stale: false };
  if (elapsedDays > 30) {
    return {
      label: `Review is ${elapsedDays} days old`,
      stale: true,
    };
  }
  return {
    label: `Reviewed ${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`,
    stale: false,
  };
}
