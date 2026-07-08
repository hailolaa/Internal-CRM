"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  Users,
  Calendar,
  PoundSterling,
  ArrowUpRight,
} from "lucide-react";
import {
  ReportPageTemplate,
  BreakdownBars,
  SourceTable,
} from "@/components/templates/report-page";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useReportCsvExport } from "@/hooks/use-report-csv-export";
import {
  REPORT_DATE_RANGES,
  getReportDateRangeParams,
} from "@/lib/report-date-ranges";
import type {
  DashboardFunnelRecord,
  DashboardSummaryRecord,
  RevenueByChannelRecord,
  RevenueByTreatmentRecord,
} from "@/lib/api-types";
import type { StatCardData } from "@/lib/types";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export default function LeadsReportPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [dateRange, setDateRange] = useState<string>(REPORT_DATE_RANGES[0]);
  const reportParams = useMemo(
    () => getReportDateRangeParams(dateRange),
    [dateRange],
  );
  const {
    exportCsv: exportAttributionCsv,
    exportStatus,
    isExporting,
  } = useReportCsvExport({
    params: reportParams,
    token,
    type: "attribution",
  });
  const [summary, setSummary] = useState<DashboardSummaryRecord | null>(null);
  const [funnel, setFunnel] = useState<DashboardFunnelRecord | null>(null);
  const [channelRevenue, setChannelRevenue] =
    useState<RevenueByChannelRecord | null>(null);
  const [treatmentRevenue, setTreatmentRevenue] =
    useState<RevenueByTreatmentRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const authToken = token;

    async function loadLeadsReport() {
      setIsLoading(true);
      try {
        const [summaryRecord, funnelRecord, channelRecord, treatmentRecord] =
          await Promise.all([
            api.reports.dashboardSummary(authToken, reportParams),
            api.reports.dashboardFunnel(authToken, reportParams),
            api.reports.revenueByChannel(authToken, reportParams),
            api.reports.revenueByTreatment(authToken, reportParams),
          ]);

        if (!cancelled) {
          setSummary(summaryRecord);
          setFunnel(funnelRecord);
          setChannelRevenue(channelRecord);
          setTreatmentRevenue(treatmentRecord);
          setLoadError("");
        }
      } catch (error) {
        console.error("Failed to load leads report", error);
        if (!cancelled) {
          setSummary(null);
          setFunnel(null);
          setChannelRevenue(null);
          setTreatmentRevenue(null);
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load live leads report.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadLeadsReport();

    return () => {
      cancelled = true;
    };
  }, [reportParams, token]);

  const liveMetrics = useMemo<StatCardData[]>(() => {
    if (!summary) {
      return [
        {
          label: "Total Leads",
          value: isLoading ? "Loading" : "N/A",
          icon: Users,
          color: "blue",
        },
        {
          label: "Qualified Leads",
          value: isLoading ? "Loading" : "N/A",
          icon: PoundSterling,
          color: "green",
        },
        {
          label: "Bookings",
          value: isLoading ? "Loading" : "N/A",
          icon: Calendar,
          color: "teal",
        },
        {
          label: "Conversion Rate",
          value: isLoading ? "Loading" : "N/A",
          icon: TrendingUp,
          color: "violet",
        },
      ];
    }

    return [
      {
        label: "Total Leads",
        value: formatNumber(summary.cards.leads),
        change: "Live",
        trend: "up",
        icon: Users,
        color: "blue",
      },
      {
        label: "Qualified Leads",
        value: formatNumber(summary.cards.consults),
        change: `${summary.cards.bookedConsults} booked`,
        trend: "up",
        icon: PoundSterling,
        color: "green",
      },
      {
        label: "Bookings",
        value: formatNumber(summary.cards.appointments),
        change: `${summary.cards.attendedConsults} attended`,
        trend: "up",
        icon: Calendar,
        color: "teal",
      },
      {
        label: "Conversion Rate",
        value: `${percent(summary.cards.bookedConsults, summary.cards.leads)}%`,
        change: "Lead to booked",
        trend: "up",
        icon: TrendingUp,
        color: "violet",
      },
    ];
  }, [isLoading, summary]);

  const liveLeadsBySource = useMemo(() => {
    if (!channelRevenue?.bySource.length) return [];

    return channelRevenue.bySource.slice(0, 8).map((source) => ({
      source: source.source || source.channel || "Unknown",
      leads: source.leads,
      qualified: source.attendedConsults,
      booked: source.bookedConsults,
      conversion: `${percent(source.bookedConsults, source.leads)}%`,
      trend: `${source.roas.toFixed(1)}x`,
    }));
  }, [channelRevenue]);

  const liveLeadsByTreatment = useMemo(() => {
    if (!treatmentRevenue?.byTreatment.length) return [];

    const totalSold = treatmentRevenue.byTreatment.reduce(
      (sum, treatment) => sum + treatment.soldTreatments,
      0,
    );

    return treatmentRevenue.byTreatment.slice(0, 6).map((treatment) => {
      const value = percent(treatment.soldTreatments, totalSold);
      return {
        label: treatment.treatment,
        value,
        detail: `${formatNumber(treatment.soldTreatments)} sold`,
        detailValue: `${value}%`,
      };
    });
  }, [treatmentRevenue]);

  const liveFunnelSteps = useMemo(() => {
    if (!funnel?.funnel.length) return [];

    const colors = [
      "bg-[rgba(74,106,138,0.12)]",
      "bg-[rgba(110,106,232,0.08)]",
      "bg-[rgba(160,120,64,0.08)]",
      "bg-[rgba(90,138,106,0.08)]",
    ];
    const textColors = [
      "text-[#4A6A8A]",
      "text-[#6E6AE8]",
      "text-[#A07840]",
      "text-[#5A8A6A]",
    ];

    return funnel.funnel.map((step, index) => ({
      label: step.label,
      value: formatNumber(step.count),
      color: colors[index] || "bg-[rgba(0,0,0,0.06)]",
      textColor: textColors[index] || "text-[#6B7280]",
      margin: index ? `mx-${Math.min(index * 4, 12)}` : "",
      pct: index ? `${Math.round(step.rate)}%` : undefined,
    }));
  }, [funnel]);

  return (
    <ReportPageTemplate
      title="Leads & Bookings Report"
      subtitle="Detailed analysis of lead generation and conversion."
      metrics={liveMetrics}
      dateRanges={[...REPORT_DATE_RANGES]}
      selectedDateRange={dateRange}
      onDateRangeChange={setDateRange}
      exportDisabled={!token || isLoading}
      exportLabel="Export CSV"
      isExporting={isExporting}
      onExport={() => void exportAttributionCsv()}
    >
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
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SourceTable
            title="Leads by Source"
            rightLabel={isLoading ? "Loading" : undefined}
            data={liveLeadsBySource}
          />
        </div>
        <BreakdownBars title="Leads by Treatment" data={liveLeadsByTreatment} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          className="rounded-[24px] p-6"
          style={{
            backgroundColor: "#FFFCF9",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
          }}
        >
          <h3 className="font-semibold mb-6" style={{ color: "#111111" }}>
            Weekly Performance
          </h3>
          <div
            className="rounded-[18px] p-5 text-sm leading-relaxed"
            style={{
              backgroundColor: "#FAF8F5",
              border: "1px solid rgba(0,0,0,0.06)",
              color: "#6B7280",
            }}
          >
            Weekly lead and booking trend data is unavailable because the
            current backend report endpoint does not expose weekly buckets.
          </div>
        </div>

        <div
          className="rounded-[24px] p-6"
          style={{
            backgroundColor: "#FFFCF9",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
          }}
        >
          <h3 className="font-semibold mb-6" style={{ color: "#111111" }}>
            Conversion Funnel
          </h3>
          <div className="space-y-4">
            {liveFunnelSteps.length ? (
              liveFunnelSteps.map((step, i) => (
              <div key={step.label}>
                {i > 0 && (
                  <div className="flex justify-center my-2">
                    <ArrowUpRight
                      className="w-5 h-5 rotate-90"
                      style={{ color: "#6B7280" }}
                    />
                  </div>
                )}
                <div
                  className={`h-12 ${step.color} rounded-[24px] flex items-center px-4 ${step.margin}`}
                >
                  <span className="font-medium" style={{ color: "#111111" }}>
                    {step.label}
                  </span>
                  <span className={`ml-auto ${step.textColor} font-bold`}>
                    {step.value}
                  </span>
                  {step.pct && (
                    <span className="ml-2 text-xs" style={{ color: "#6B7280" }}>
                      {step.pct}
                    </span>
                  )}
                </div>
              </div>
              ))
            ) : (
              <div
                className="rounded-[18px] p-5 text-sm leading-relaxed"
                style={{
                  backgroundColor: "#FAF8F5",
                  border: "1px solid rgba(0,0,0,0.06)",
                  color: "#6B7280",
                }}
              >
                {isLoading
                  ? "Loading live funnel data..."
                  : "No live funnel data is available."}
              </div>
            )}
          </div>
        </div>
      </div>
    </ReportPageTemplate>
  );
}
