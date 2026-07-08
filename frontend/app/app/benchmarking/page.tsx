"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Brain,
  GitCompare,
  PoundSterling,
  Target,
} from "lucide-react";
import { AlertBanner, Card, PageHeader, StatCard } from "@/components/ui";
import { ProgressBar } from "@/components/ui/layout";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  DashboardFunnelRecord,
  DashboardSummaryRecord,
  BenchmarkSummaryRecord,
  SlaSummaryRecord,
  TreatmentPlanRecord,
} from "@/lib/api-types";
import { formatCurrency } from "@/lib/utils";

type BenchmarkStatus = "above" | "below" | "average";

type BenchmarkMetric = {
  metric: string;
  yours: string;
  industry: string;
  percentile: number;
  status: BenchmarkStatus;
  insight: string;
  enoughData?: boolean;
};

function clamp(value: number, min = 5, max = 95) {
  return Math.min(max, Math.max(min, value));
}

function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function percentileHigherIsBetter(value: number, industry: number) {
  if (industry <= 0) return 50;
  return clamp(Math.round(50 + ((value - industry) / industry) * 55));
}

function percentileLowerIsBetter(value: number, industry: number) {
  if (industry <= 0) return 50;
  return clamp(Math.round(50 + ((industry - value) / industry) * 55));
}

function statusFromPercentile(percentile: number): BenchmarkStatus {
  if (percentile >= 65) return "above";
  if (percentile < 45) return "below";
  return "average";
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} mins`;
  return `${(minutes / 60).toFixed(1)} hrs`;
}

export default function BenchmarkingPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [summary, setSummary] = useState<DashboardSummaryRecord | null>(null);
  const [funnel, setFunnel] = useState<DashboardFunnelRecord | null>(null);
  const [sla, setSla] = useState<SlaSummaryRecord | null>(null);
  const [plans, setPlans] = useState<TreatmentPlanRecord[]>([]);
  const [benchmarkSummary, setBenchmarkSummary] =
    useState<BenchmarkSummaryRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    const authToken = token;

    Promise.all([
      api.reports.dashboardSummary(authToken),
      api.reports.dashboardFunnel(authToken),
      api.sla.getSummary(authToken),
      api.treatmentPlans.list(authToken),
      api.reports.benchmarkSummary(authToken),
    ])
      .then(([summaryRecord, funnelRecord, slaRecord, treatmentPlans, benchmarkRecord]) => {
        if (!isMounted) return;
        setSummary(summaryRecord);
        setFunnel(funnelRecord);
        setSla(slaRecord);
        setPlans(treatmentPlans);
        setBenchmarkSummary(benchmarkRecord);
        setError("");
      })
      .catch((err) => {
        if (!isMounted) return;
        setSummary(null);
        setFunnel(null);
        setSla(null);
        setPlans([]);
        setBenchmarkSummary(null);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load live benchmark data.",
        );
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const benchmarks = useMemo<BenchmarkMetric[]>(() => {
    if (!summary || !funnel || !sla) return [];

    if (benchmarkSummary) {
      return benchmarkSummary.metrics.map((metric) => {
        const percentile = metric.unit === "minutes"
          ? percentileLowerIsBetter(metric.value, metric.benchmarkAverage)
          : percentileHigherIsBetter(metric.value, metric.benchmarkAverage);
        const formatValue = (value: number) => {
          if (metric.unit === "currency") return formatCurrency(value);
          if (metric.unit === "minutes") return formatMinutes(value);
          return `${value}%`;
        };
        return {
          metric: metric.label,
          yours: formatValue(metric.value),
          industry: `${formatValue(metric.benchmarkAverage)} avg / ${formatValue(metric.topQuartile)} top quartile`,
          percentile,
          status: metric.enoughData ? statusFromPercentile(percentile) : "average",
          insight: metric.wording,
          enoughData: metric.enoughData,
        };
      });
    }

    const cards = summary?.cards;
    const financials = summary?.financials;
    const speedToLead = sla.averageResponseMinutes;
    const bookingRate =
      funnel.conversionRates.leadToBookedRate ??
      percent(cards?.bookedConsults ?? 0, cards?.leads ?? 0);
    const showRate = percent(
      (cards?.appointments ?? 0) - (cards?.noShows ?? 0),
      cards?.appointments ?? 0,
    );
    const consultConversion =
      funnel.conversionRates.attendedToSoldRate ??
      percent(cards?.soldTreatments ?? 0, cards?.attendedConsults ?? 0);
    const costPerBooking = financials?.costPerBookedConsult ?? 0;
    const revenuePerPatient =
      (cards?.soldTreatments ?? 0) > 0
        ? (financials?.treatmentPlanValue ?? 0) / (cards?.soldTreatments ?? 1)
        : 0;
    const sessions = plans.reduce((total, plan) => total + plan.sessions, 0);
    const completedSessions = plans.reduce(
      (total, plan) => total + plan.sessionsCompleted,
      0,
    );
    const repeatVisitRate = percent(completedSessions, sessions);
    const roas = financials?.roas ?? 0;
    const opportunity = (financials?.openDealValue ?? 0) + sla.estimatedRevenueRisk;

    const rows = [
      {
        metric: "Speed to Lead",
        value: speedToLead,
        yours: formatMinutes(speedToLead),
        industryValue: 8,
        industry: "8 mins",
        percentile: percentileLowerIsBetter(speedToLead, 8),
        insight:
          "Clinics converting above 28% respond within 5 minutes. Use SLA routing when this slips.",
      },
      {
        metric: "Booking Rate",
        value: bookingRate,
        yours: `${bookingRate}%`,
        industryValue: 32,
        industry: "32%",
        percentile: percentileHigherIsBetter(bookingRate, 32),
        insight:
          "Booking rate is pulled from your live lead funnel, not a demo constant.",
      },
      {
        metric: "Show Rate",
        value: showRate,
        yours: `${showRate}%`,
        industryValue: 85,
        industry: "85%",
        percentile: percentileHigherIsBetter(showRate, 85),
        insight:
          "Deposit enforcement and reminder timing are the quickest levers for show rate.",
      },
      {
        metric: "Consult Conversion",
        value: consultConversion,
        yours: `${consultConversion}%`,
        industryValue: 62,
        industry: "62%",
        percentile: percentileHigherIsBetter(consultConversion, 62),
        insight:
          "This compares attended consults to sold treatments from the reporting funnel.",
      },
      {
        metric: "Cost Per Booking",
        value: costPerBooking,
        yours: formatCurrency(costPerBooking),
        industryValue: 42,
        industry: "£42",
        percentile: percentileLowerIsBetter(costPerBooking || 42, 42),
        insight:
          "Lower cost per booking gives you more room to scale profitable campaigns.",
      },
      {
        metric: "Revenue Per Patient",
        value: revenuePerPatient,
        yours: formatCurrency(revenuePerPatient),
        industryValue: 520,
        industry: "£520",
        percentile: percentileHigherIsBetter(revenuePerPatient, 520),
        insight:
          "Treatment plan value is used as the live proxy for patient revenue.",
      },
      {
        metric: "Treatment Completion",
        value: repeatVisitRate,
        yours: `${repeatVisitRate}%`,
        industryValue: 58,
        industry: "58%",
        percentile: percentileHigherIsBetter(repeatVisitRate, 58),
        insight:
          "Completion rate comes from treatment-plan sessions completed against planned sessions.",
      },
      {
        metric: "ROAS",
        value: roas,
        yours: `${roas.toFixed(1)}x`,
        industryValue: 5.2,
        industry: "5.2x",
        percentile: percentileHigherIsBetter(roas, 5.2),
        insight:
          "ROAS is calculated from reported spend and revenue for the selected clinic.",
      },
    ];

    return rows.map((row) => ({
      metric: row.metric,
      yours: row.yours,
      industry: row.industry,
      percentile: row.percentile,
      status: statusFromPercentile(row.percentile),
      insight: row.insight,
      opportunity,
    }));
  }, [benchmarkSummary, funnel, plans, sla, summary]);

  const belowCount = benchmarks.filter((b) => b.status === "below").length;
  const aboveCount = benchmarks.filter((b) => b.status === "above").length;
  const overallScore = benchmarks.length
    ? Math.round(
        benchmarks.reduce((sum, row) => sum + row.percentile, 0) /
          benchmarks.length,
      )
    : null;
  const revenueOpportunity =
    summary && sla
      ? summary.financials.openDealValue + sla.estimatedRevenueRisk
      : null;
  const biggestGap = benchmarks
    .slice()
    .sort((a, b) => a.percentile - b.percentile)[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue Benchmarking"
        subtitle="Compare your clinic against industry averages using live CRM data."
        icon={GitCompare}
        iconColor="text-[#4A6A8A]"
        iconBg="bg-[rgba(74,106,138,0.1)]"
      />

      {error && (
        <AlertBanner
          icon={AlertTriangle}
          title="Benchmark data could not be loaded"
          description={error}
          variant="warning"
        />
      )}

      <AlertBanner
        icon={Brain}
        title="Benchmark source"
        description={benchmarkSummary?.safeWording || "Estimated benchmark. Based on available data. Internal comparison until wider cohort data is available."}
        variant="info"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Overall Score"
          value={overallScore === null ? (isLoading ? "Loading" : "N/A") : `${overallScore}th`}
          sub="percentile"
          icon={Target}
          color="teal"
        />
        <StatCard
          label="Above Average"
          value={String(aboveCount)}
          sub="metrics"
          icon={ArrowUp}
          color="green"
        />
        <StatCard
          label="Below Average"
          value={String(belowCount)}
          sub="metrics"
          icon={ArrowDown}
          color="red"
        />
        <StatCard
          label="Revenue Opportunity"
          value={
            revenueOpportunity === null
              ? isLoading
                ? "Loading"
                : "N/A"
              : formatCurrency(revenueOpportunity)
          }
          sub="open deals + SLA risk"
          icon={PoundSterling}
          color="violet"
        />
      </div>

      {belowCount > 0 && biggestGap && (
        <AlertBanner
          icon={AlertTriangle}
          title={`You are below industry average in ${belowCount} key metrics`}
          description={`${biggestGap.metric} is your biggest gap. ${biggestGap.insight}`}
          variant="error"
        />
      )}

      <Card padding="p-0">
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid #E5DED6" }}
        >
          <h2 className="font-semibold" style={{ color: "#252421" }}>
            You vs Industry Average
          </h2>
          <span className="text-xs text-[#7A746A]">Live clinic metrics</span>
        </div>
        <div className="divide-y" style={{ borderColor: "#EDE8E2" }}>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="px-6 py-4">
                <div className="h-20 rounded-xl bg-[rgba(74,106,138,0.08)] animate-pulse" />
              </div>
            ))
          ) : benchmarks.length ? (
            benchmarks.map((b) => (
              <div key={b.metric} className="px-6 py-4">
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-medium" style={{ color: "#252421" }}>
                        {b.metric}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          backgroundColor:
                            b.status === "above"
                              ? "rgba(90, 138, 106, 0.08)"
                              : b.status === "below"
                                ? "rgba(138, 74, 74, 0.08)"
                                : "rgba(160, 120, 64, 0.08)",
                          color:
                            b.status === "above"
                              ? "#5A8A6A"
                              : b.status === "below"
                                ? "#8A4A4A"
                                : "#A07840",
                        }}
                      >
                        {b.status === "above"
                          ? "Above avg"
                          : b.status === "below"
                            ? "Below avg"
                            : "Average"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                      <div>
                        <span style={{ color: "#7A746A" }}>You: </span>
                        <span
                          className="font-semibold"
                          style={{ color: "#252421" }}
                        >
                          {b.yours}
                        </span>
                      </div>
                      <div>
                      <span style={{ color: "#7A746A" }}>Industry: </span>
                        <span style={{ color: "#7A746A" }}>{b.industry}</span>
                      </div>
                      {b.enoughData === false && (
                        <div>
                          <span className="font-medium text-[#A07840]">
                            Not enough data yet
                          </span>
                        </div>
                      )}
                      <div>
                        <span style={{ color: "#7A746A" }}>Percentile: </span>
                        <span
                          className="font-medium"
                          style={{
                            color:
                              b.percentile >= 70
                                ? "#5A8A6A"
                                : b.percentile >= 45
                                  ? "#A07840"
                                  : "#8A4A4A",
                          }}
                        >
                          {b.percentile}th
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <ProgressBar
                  value={b.percentile}
                  max={100}
                  color={
                    b.percentile >= 70
                      ? "green"
                      : b.percentile >= 45
                        ? "amber"
                        : "red"
                  }
                />
                <div className="flex items-start gap-2 mt-2">
                  <Brain className="w-3.5 h-3.5 text-[#7D8F7A] flex-shrink-0 mt-0.5" />
                  <p className="text-xs" style={{ color: "#7A746A" }}>
                    {b.insight}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-10 text-center text-sm text-[#7A746A]">
              No live benchmark inputs found.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
