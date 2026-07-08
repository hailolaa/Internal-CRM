"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import RevenueHero from "@/components/revenue/RevenueHero";
import RevenueKPISection, {
  type RevenueKPI,
} from "@/components/revenue/RevenueKPISection";
import CallIntelligencePanel, {
  type CallMetric,
} from "@/components/revenue/CallIntelligencePanel";
import RevenueAIInsightPanel, {
  type RevenueInsightItem,
} from "@/components/revenue/RevenueAIInsightPanel";
import { ProvenanceSummary } from "@/components/ui";
import { api } from "@/lib/api-client";
import type {
  CallSummaryRecord,
  DashboardFunnelRecord,
  DashboardSummaryRecord,
  InsightRecord,
  RevenueLeaksRecord,
  TopOpportunitiesRecord,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { useReportCsvExport } from "@/hooks/use-report-csv-export";

const DATE_RANGES = ["This Month", "Last Month", "Last 90 Days", "YTD"] as const;
type DateRangeLabel = (typeof DATE_RANGES)[number];

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getDateRange(label: DateRangeLabel) {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  if (label === "Last Month") {
    startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
    endDate.setDate(0);
  }

  if (label === "Last 90 Days") {
    startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 89);
  }

  if (label === "YTD") {
    startDate = new Date(endDate.getFullYear(), 0, 1);
  }

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function buildKpis(
  summary: DashboardSummaryRecord | null,
  funnel: DashboardFunnelRecord | null,
): RevenueKPI[] {
  const financials = summary?.financials;
  const cards = summary?.cards;
  const pipelineValue =
    Number(financials?.treatmentPlanValue || 0) +
    Number(financials?.openDealValue || 0);
  const leadToBookedRate =
    funnel?.conversionRates.leadToBookedRate ??
    percent(Number(cards?.bookedConsults || 0), Number(cards?.leads || 0));

  return [
    {
      label: "Total Revenue",
      value: formatMoney(Number(financials?.totalRevenue || 0)),
      support: `${formatMoney(Number(financials?.consultRevenue || 0))} consults · ${formatMoney(Number(financials?.depositRevenue || 0))} deposits`,
      trend: `${Number(financials?.roas || 0).toFixed(2)}x ROAS`,
      trendUp: Number(financials?.roas || 0) >= 1,
    },
    {
      label: "Pipeline Value",
      value: formatMoney(pipelineValue),
      support: `${Number(cards?.activeTreatmentPlans || 0)} active plans · ${Number(cards?.openDeals || 0)} open deals`,
      trend: `${formatMoney(Number(financials?.wonDealValue || 0))} won`,
      trendUp: true,
    },
    {
      label: "Booked Consultations",
      value: String(Number(cards?.bookedConsults || 0)),
      support: `${Number(cards?.attendedConsults || 0)} attended · ${Number(cards?.soldTreatments || 0)} sold`,
      trend: `${Number(cards?.consults || 0)} consults`,
      trendUp: true,
    },
    {
      label: "Lead-to-Booking Rate",
      value: `${Math.round(leadToBookedRate)}%`,
      support: `${Number(cards?.leads || 0)} leads tracked`,
      trend: `${Math.round(funnel?.conversionRates.attendedToSoldRate || 0)}% sold`,
      trendUp: leadToBookedRate > 0,
    },
  ];
}

function buildCallMetrics(
  summary: DashboardSummaryRecord | null,
  callSummary: CallSummaryRecord | null,
): CallMetric[] {
  const totalCalls =
    Number(callSummary?.totalCalls || 0) || Number(summary?.cards.totalCalls || 0);
  const missedCalls =
    Number(callSummary?.missedCalls || 0) || Number(summary?.cards.missedCalls || 0);
  const bookedConsults =
    Number(callSummary?.bookedConsults || 0) ||
    Number(summary?.cards.bookedConsults || 0);
  const bookingRate =
    Number(callSummary?.callToBookingRate || 0) ||
    percent(bookedConsults, totalCalls);

  return [
    {
      label: "Total Calls",
      value: String(totalCalls),
      explanation: "Calls tracked for the selected clinic and reporting range.",
      status: totalCalls > 0 ? "Tracked" : "No Calls",
      statusOk: totalCalls > 0,
    },
    {
      label: "Bookings from Calls",
      value: String(bookedConsults),
      explanation: "Calls that resulted in a confirmed consultation booking.",
      status: bookedConsults > 0 ? "Converting" : "No Bookings",
      statusOk: bookedConsults > 0,
    },
    {
      label: "Missed Calls",
      value: String(missedCalls),
      explanation: "Inbound calls that went unanswered and may need recovery.",
      status: missedCalls > 0 ? "Needs Attention" : "Clear",
      statusOk: missedCalls === 0,
    },
    {
      label: "Call-to-Booking Rate",
      value: `${Math.round(bookingRate)}%`,
      explanation: "Share of calls converting into booked consultations.",
      status: bookingRate > 0 ? "Tracked" : "No Conversion",
      statusOk: bookingRate > 0,
    },
  ];
}

function buildCallInsight(leaks: RevenueLeaksRecord | null) {
  const missedCallLeak = leaks?.items.find((item) => item.key === "missedCalls");
  if (missedCallLeak && missedCallLeak.count > 0) {
    return `${missedCallLeak.count} missed calls carry ${formatMoney(missedCallLeak.estimatedRisk)} estimated recovery risk in this range.`;
  }

  const topLeak = leaks?.items
    .filter((item) => item.count > 0)
    .sort((left, right) => right.estimatedRisk - left.estimatedRisk)[0];

  if (topLeak) {
    return `${topLeak.label} is the clearest recovery opportunity, with ${formatMoney(topLeak.estimatedRisk)} estimated risk.`;
  }

  return "No live call leakage is currently flagged for the selected range.";
}

function buildMissedCallsSourceHref(range: {
  startDate: string;
  endDate: string;
}) {
  const params = new URLSearchParams({
    filter: "no-answer",
    missed: "1",
    startDate: range.startDate,
    endDate: range.endDate,
  });

  return `/app/comms/calls?${params.toString()}`;
}

function metadataPath(
  metadata: Record<string, unknown> | null,
  path: string[],
) {
  let current: unknown = metadata;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return "";
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" ? current : "";
}

function formatInsightProvenance(insight: InsightRecord) {
  const provider = insightGenerationProvider(insight);
  const model = metadataPath(insight.metadata, ["generation", "model"]);
  const fallbackReason = metadataPath(insight.metadata, [
    "generation",
    "fallbackReason",
  ]);

  if (provider === "openai") {
    return `OpenAI generated${model ? ` · ${model}` : ""}`;
  }

  if (provider === "deterministic") {
    return fallbackReason
      ? `Rule-based fallback · ${fallbackReason.replace(/_/g, " ")}`
      : "Rule-based fallback";
  }

  return "Stored revenue insight";
}

function insightGenerationProvider(insight: InsightRecord) {
  return metadataPath(insight.metadata, ["generation", "provider"]);
}

function insightCreatedTime(insight: InsightRecord) {
  return new Date(insight.createdAt).getTime() || 0;
}

function isRevenueInsight(insight: InsightRecord) {
  return (
    insight.sourceType === "revenue_leakage" ||
    insight.generatedFrom === "revenue_leakage" ||
    insight.type.toLowerCase().includes("revenue")
  );
}

function insightAccent(insight: InsightRecord) {
  return insight.severity === "critical" || insight.severity === "high"
    ? "#C2785A"
    : "#6E6AE8";
}

function summariseGenerationProviders(insights: InsightRecord[]) {
  const revenueInsights = insights.filter(isRevenueInsight);
  const openAiCount = revenueInsights.filter(
    (insight) =>
      metadataPath(insight.metadata, ["generation", "provider"]) === "openai",
  ).length;
  const fallbackCount = revenueInsights.filter(
    (insight) =>
      metadataPath(insight.metadata, ["generation", "provider"]) ===
      "deterministic",
  ).length;

  if (openAiCount > 0) {
    return `${openAiCount} OpenAI generated, ${fallbackCount} rule-based fallback.`;
  }

  if (fallbackCount > 0) {
    return `${fallbackCount} rule-based fallback; OpenAI generation was not used.`;
  }

  return "No provider metadata was returned.";
}

function buildInsightCards({
  leaks,
  opportunities,
  insights,
}: {
  leaks: RevenueLeaksRecord | null;
  opportunities: TopOpportunitiesRecord | null;
  insights: InsightRecord[];
}): RevenueInsightItem[] {
  const cards: RevenueInsightItem[] = [];
  const topDeal = opportunities?.deals?.[0];
  const topLeak = leaks?.items
    .filter((item) => item.count > 0)
    .sort((left, right) => right.estimatedRisk - left.estimatedRisk)[0];
  const revenueInsights = insights
    .filter(
      (insight) =>
        insight.status !== "resolved" &&
        isRevenueInsight(insight),
    )
    .sort((left, right) => {
      const leftOpenAi = insightGenerationProvider(left) === "openai" ? 1 : 0;
      const rightOpenAi = insightGenerationProvider(right) === "openai" ? 1 : 0;
      if (leftOpenAi !== rightOpenAi) return rightOpenAi - leftOpenAi;
      return insightCreatedTime(right) - insightCreatedTime(left);
    });
  const openAiInsights = revenueInsights.filter(
    (insight) => insightGenerationProvider(insight) === "openai",
  );

  if (openAiInsights.length > 0) {
    return openAiInsights.slice(0, 3).map((insight) => ({
      label: insight.title,
      body: insight.recommendedAction || insight.summary || insight.title,
      accent: insightAccent(insight),
      provenance: formatInsightProvenance(insight),
    }));
  }

  if (topDeal) {
    cards.push({
      label: "Best Opportunity",
      body: `${topDeal.contactName} has ${formatMoney(topDeal.valueCents / 100)} in open opportunity value for ${topDeal.treatment || topDeal.title}.`,
      accent: "#6E6AE8",
      provenance: "Live opportunity data",
    });
  }

  if (topLeak) {
    cards.push({
      label: "Revenue Leak",
      body: `${topLeak.label} has ${topLeak.count} tracked issue${topLeak.count === 1 ? "" : "s"} and ${formatMoney(topLeak.estimatedRisk)} estimated risk.`,
      accent: "#C2785A",
      provenance: "Live revenue leakage data",
    });
  }

  if (revenueInsights[0]) {
    cards.push({
      label: "Next Action",
      body:
        revenueInsights[0].recommendedAction ||
        revenueInsights[0].summary ||
        revenueInsights[0].title,
      accent: insightAccent(revenueInsights[0]),
      provenance: formatInsightProvenance(revenueInsights[0]),
    });
  }

  return cards.slice(0, 3);
}

export default function RevenuePage() {
  const { session } = useAuth();
  const token = session?.token;
  const [selectedRange, setSelectedRange] =
    useState<DateRangeLabel>("This Month");
  const [summary, setSummary] = useState<DashboardSummaryRecord | null>(null);
  const [funnel, setFunnel] = useState<DashboardFunnelRecord | null>(null);
  const [leaks, setLeaks] = useState<RevenueLeaksRecord | null>(null);
  const [opportunities, setOpportunities] =
    useState<TopOpportunitiesRecord | null>(null);
  const [callSummary, setCallSummary] = useState<CallSummaryRecord | null>(null);
  const [insights, setInsights] = useState<InsightRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [generationMessage, setGenerationMessage] = useState("");
  const [generationTone, setGenerationTone] =
    useState<"error" | "neutral" | "success">("neutral");

  const range = useMemo(() => getDateRange(selectedRange), [selectedRange]);
  const {
    exportCsv: exportRevenueCsv,
    exportStatus,
    isExporting,
  } = useReportCsvExport({
    token,
    type: "revenue",
    params: range,
  });

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    Promise.all([
      api.reports.dashboardSummary(token, range),
      api.reports.dashboardFunnel(token, range),
      api.reports.revenueLeaks(token, range),
      api.reports.topOpportunities(token, range),
      api.calls.summary(token),
      api.insights.list(token, { status: "all" }),
    ])
      .then(
        ([
          nextSummary,
          nextFunnel,
          nextLeaks,
          nextOpportunities,
          nextCallSummary,
          nextInsights,
        ]) => {
          if (!isMounted) return;
          setLoadError("");
          setSummary(nextSummary);
          setFunnel(nextFunnel);
          setLeaks(nextLeaks);
          setOpportunities(nextOpportunities);
          setCallSummary(nextCallSummary);
          setInsights(nextInsights);
        },
      )
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Unable to load revenue data from the backend.",
        );
        setSummary(null);
        setFunnel(null);
        setLeaks(null);
        setOpportunities(null);
        setCallSummary(null);
        setInsights([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [range, token]);

  const kpis = useMemo(() => buildKpis(summary, funnel), [funnel, summary]);
  const callMetrics = useMemo(
    () => buildCallMetrics(summary, callSummary),
    [callSummary, summary],
  );
  const callInsight = useMemo(() => buildCallInsight(leaks), [leaks]);
  const revenueInsights = useMemo(
    () => buildInsightCards({ leaks, opportunities, insights }),
    [insights, leaks, opportunities],
  );
  const missedCallsSourceHref = useMemo(
    () => buildMissedCallsSourceHref(range),
    [range],
  );

  const handleGenerateInsights = useCallback(async () => {
    if (!token) return;

    setIsGeneratingInsights(true);
    setGenerationMessage("");
    setGenerationTone("neutral");

    try {
      const result = await api.insights.generate(token);
      setInsights(result.insights);
      setGenerationTone("success");
      setGenerationMessage(
        `${result.generatedCount} revenue insight${result.generatedCount === 1 ? "" : "s"} generated. ${result.existingCount} already open. ${summariseGenerationProviders(result.insights)}`,
      );
    } catch (error) {
      setGenerationTone("error");
      setGenerationMessage(
        error instanceof Error
          ? error.message
          : "Could not generate revenue insights.",
      );
    } finally {
      setIsGeneratingInsights(false);
    }
  }, [token]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1">
          <RevenueHero />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:pt-2">
          <label htmlFor="revenue-date-range" className="sr-only">
            Revenue date range
          </label>
          <select
            id="revenue-date-range"
            name="revenue-date-range"
            value={selectedRange}
            onChange={(event) => {
              setIsLoading(true);
              setSelectedRange(event.target.value as DateRangeLabel);
            }}
            className="bg-white border border-[#E5DED6] rounded-xl px-4 py-2 text-sm text-[#252421] outline-none focus:border-[#6E6AE8]"
            style={{ boxShadow: "0 1px 3px rgba(37, 36, 33, 0.04)" }}
          >
            {DATE_RANGES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void exportRevenueCsv()}
            disabled={!token || isExporting}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E5DED6] bg-white px-4 py-2 text-sm font-medium text-[#252421] transition-colors hover:bg-[#F7F5F2] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ boxShadow: "0 1px 3px rgba(37, 36, 33, 0.04)" }}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>

      {exportStatus && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            exportStatus.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : exportStatus.tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {exportStatus.message}
        </div>
      )}

      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Backend revenue data could not be loaded. {loadError}
        </div>
      )}

      <ProvenanceSummary
        items={[
          {
            label: "Revenue",
            value:
              summary?.financials.totalRevenue && !loadError
                ? summary.financials.consultRevenueProvenance || "live"
                : "unknown",
          },
          {
            label: "Deposits",
            value:
              summary?.financials.depositRevenue && !loadError
                ? summary.financials.depositRevenueProvenance || "exact"
                : "unknown",
          },
          {
            label: "Spend",
            value:
              summary?.financials.spend && !loadError
                ? summary.financials.spendProvenance || "manual"
                : "unknown",
          },
          {
            label: "Leaks",
            value:
              leaks && !loadError && !leaks.emptyState ? "estimated" : "unknown",
          },
        ]}
      />

      <RevenueKPISection kpis={kpis} isLoading={isLoading} />

      <CallIntelligencePanel
        metrics={callMetrics}
        insight={callInsight}
        sourceDescription={`Source: call log no-answer calls from ${range.startDate} to ${range.endDate}.`}
        sourceHref={missedCallsSourceHref}
        sourceLabel="View no-answer calls"
        isLoading={isLoading}
      />

      <RevenueAIInsightPanel
        insights={revenueInsights}
        generationMessage={generationMessage}
        generationTone={generationTone}
        isGenerating={isGeneratingInsights}
        isLoading={isLoading}
        onGenerate={handleGenerateInsights}
      />
    </div>
  );
}
