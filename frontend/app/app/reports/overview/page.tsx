"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  Users,
  Calendar,
  PoundSterling,
  Target,
  Clock,
} from "lucide-react";
import { DataProvenanceBadge, ProvenanceSummary, StatCard } from "@/components/ui";
import { ReportPageTemplate } from "@/components/templates/report-page";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useReportCsvExport } from "@/hooks/use-report-csv-export";
import {
  REPORT_DATE_RANGES,
  getReportDateRangeParams,
} from "@/lib/report-date-ranges";
import type {
  DashboardSummaryRecord,
  RevenueByChannelRecord,
  RevenueByTreatmentRecord,
} from "@/lib/api-types";
import type { StatCardData } from "@/lib/types";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export default function ReportsOverviewPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [dateRange, setDateRange] = useState<string>(REPORT_DATE_RANGES[0]);
  const reportParams = useMemo(
    () => getReportDateRangeParams(dateRange),
    [dateRange],
  );
  const {
    exportCsv: exportOperationalCsv,
    exportStatus,
    isExporting,
  } = useReportCsvExport({
    params: reportParams,
    token,
    type: "operational",
  });
  const [summary, setSummary] = useState<DashboardSummaryRecord | null>(null);
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

    async function loadReportsOverview() {
      setIsLoading(true);
      try {
        const [summaryRecord, channelRecord, treatmentRecord] =
          await Promise.all([
            api.reports.dashboardSummary(authToken, reportParams),
            api.reports.revenueByChannel(authToken, reportParams),
            api.reports.revenueByTreatment(authToken, reportParams),
          ]);

        if (!cancelled) {
          setSummary(summaryRecord);
          setChannelRevenue(channelRecord);
          setTreatmentRevenue(treatmentRecord);
          setLoadError("");
        }
      } catch (error) {
        console.error("Failed to load reports overview", error);
        if (!cancelled) {
          setSummary(null);
          setChannelRevenue(null);
          setTreatmentRevenue(null);
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load live reports overview.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadReportsOverview();

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
          label: "Bookings",
          value: isLoading ? "Loading" : "N/A",
          icon: Calendar,
          color: "green",
        },
        {
          label: "Revenue",
          value: isLoading ? "Loading" : "N/A",
          icon: PoundSterling,
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

    const conversionRate = percent(
      summary.cards.bookedConsults,
      summary.cards.leads,
    );

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
        label: "Bookings",
        value: formatNumber(summary.cards.appointments),
        change: `${summary.cards.noShows} no-shows`,
        trend: "up",
        icon: Calendar,
        color: "green",
      },
      {
        label: "Revenue",
        value: formatCurrency(summary.financials.totalRevenue),
        change: `${summary.financials.roas.toFixed(1)}x ROAS`,
        trend: "up",
        icon: PoundSterling,
        color: "teal",
      },
      {
        label: "Conversion Rate",
        value: `${conversionRate}%`,
        change: "Booked consults",
        trend: "up",
        icon: TrendingUp,
        color: "violet",
      },
    ];
  }, [isLoading, summary]);

  const liveLeadSources = useMemo(() => {
    if (!channelRevenue?.bySource.length) return [];

    const totalLeads = channelRevenue.bySource.reduce(
      (sum, source) => sum + source.leads,
      0,
    );

    return channelRevenue.bySource.slice(0, 5).map((source, index) => {
      const value = percent(source.leads, totalLeads);
      const label = source.source || source.channel || "Unknown";
      const colors = [
        "bg-[#4A6A8A]",
        "bg-[#6E6AE8]",
        "bg-[#5A8A6A]",
        "bg-[#A07840]",
        "bg-[#6B7280]",
      ];

      return {
        label,
        value,
        detail: `${formatNumber(source.leads)} leads`,
        detailValue: `${value}%`,
        color: colors[index] || "bg-[#6B7280]",
        provenance: source.provenance || {
          leads: source.leads > 0 ? "exact" : "unknown",
          revenue: source.revenue > 0 ? "manual" : "unknown",
        },
      };
    });
  }, [channelRevenue]);

  const liveTreatments = useMemo(() => {
    if (!treatmentRevenue?.byTreatment.length) return [];

    const totalTreatments = treatmentRevenue.byTreatment.reduce(
      (sum, treatment) => sum + treatment.soldTreatments,
      0,
    );

    return treatmentRevenue.byTreatment.slice(0, 5).map((treatment, index) => {
      const value = percent(treatment.soldTreatments, totalTreatments);
      const colors = [
        "bg-[#6E6AE8]",
        "bg-[#8A4A4A]",
        "bg-[#5A8A6A]",
        "bg-[#A07840]",
        "bg-[#6B7280]",
      ];

      return {
        label: treatment.treatment,
        value,
        detail: `${formatNumber(treatment.soldTreatments)} bookings`,
        detailValue: formatCurrency(treatment.revenue),
        color: colors[index] || "bg-[#6B7280]",
        provenance: treatment.provenance || {
          soldTreatments: treatment.soldTreatments > 0 ? "manual" : "unknown",
          revenue: treatment.revenue > 0 ? "manual" : "unknown",
        },
      };
    });
  }, [treatmentRevenue]);

  return (
    <ReportPageTemplate
      title="Reports Overview"
      subtitle="Key performance metrics at a glance."
      metrics={liveMetrics}
      dateRanges={[...REPORT_DATE_RANGES]}
      selectedDateRange={dateRange}
      onDateRangeChange={setDateRange}
      exportDisabled={!token || isLoading}
      exportLabel="Export CSV"
      isExporting={isExporting}
      onExport={() => void exportOperationalCsv()}
      showExport
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

      <ProvenanceSummary
        items={[
          {
            label: "Lead counts",
            value: summary ? "exact" : "unknown",
          },
          {
            label: "Spend",
            value: channelRevenue?.totals.provenance?.spend || "unknown",
          },
          {
            label: "Treatment revenue",
            value: treatmentRevenue?.totals.provenance?.revenue || "unknown",
          },
        ]}
      />

      {loadError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          className="rounded-[24px] p-6"
          style={{
            backgroundColor: "#FFFCF9",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
          }}
        >
          <h3 className="font-semibold mb-4" style={{ color: "#111111" }}>
            Leads by Source
          </h3>
          <div className="space-y-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-12 rounded-xl bg-[rgba(110,106,232,0.08)] animate-pulse"
                />
              ))
            ) : liveLeadSources.length ? (
              liveLeadSources.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-2">
                  <span style={{ color: "#6B7280" }}>{item.label}</span>
                  <div className="flex items-center gap-3">
                    <span style={{ color: "#6B7280" }}>{item.detail}</span>
                    <span style={{ color: "#6E6AE8", fontWeight: 500 }}>
                      {item.detailValue}
                    </span>
                    <DataProvenanceBadge value={item.provenance.leads} />
                  </div>
                </div>
                <div
                  className="h-2.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: "rgba(0,0,0,0.06)" }}
                >
                  <div
                    className={`h-full ${item.color} rounded-full`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
              ))
            ) : (
              <div className="py-8 text-center text-sm text-[#6B7280]">
                No live source data found.
              </div>
            )}
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
          <h3 className="font-semibold mb-4" style={{ color: "#111111" }}>
            Bookings by Treatment
          </h3>
          <div className="space-y-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-12 rounded-xl bg-[rgba(110,106,232,0.08)] animate-pulse"
                />
              ))
            ) : liveTreatments.length ? (
              liveTreatments.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-2">
                  <span style={{ color: "#6B7280" }}>{item.label}</span>
                  <div className="flex items-center gap-3">
                    <span style={{ color: "#6B7280" }}>{item.detail}</span>
                    <span style={{ color: "#6E6AE8", fontWeight: 500 }}>
                      {item.detailValue}
                    </span>
                    <DataProvenanceBadge value={item.provenance.revenue} />
                  </div>
                </div>
                <div
                  className="h-2.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: "rgba(0,0,0,0.06)" }}
                >
                  <div
                    className={`h-full ${item.color} rounded-full`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
              ))
            ) : (
              <div className="py-8 text-center text-sm text-[#6B7280]">
                No live treatment data found.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Avg. CPL"
          value={
            summary
              ? formatCurrency(summary.financials.costPerLead)
              : isLoading
                ? "Loading"
                : "N/A"
          }
          change={summary ? "Live" : undefined}
          trend="up"
          icon={Target}
          color="teal"
        />
        <StatCard
          label="Avg. Response Time"
          value={
            summary
              ? `${summary.cards.activities} activities`
              : isLoading
                ? "Loading"
                : "N/A"
          }
          change={summary ? "Activity count" : undefined}
          trend="up"
          icon={Clock}
          color="teal"
        />
        <StatCard
          label="No-show Rate"
          value={
            summary
              ? `${percent(summary.cards.noShows, summary.cards.appointments)}%`
              : isLoading
                ? "Loading"
                : "N/A"
          }
          change={summary ? "Live appointments" : undefined}
          trend="up"
          icon={Calendar}
          color="green"
        />
        <StatCard
          label="Repeat Clients"
          value={
            summary
              ? formatNumber(summary.cards.activeTreatmentPlans)
              : isLoading
                ? "Loading"
                : "N/A"
          }
          change={summary ? "Active plans" : undefined}
          trend="up"
          icon={Users}
          color="green"
        />
      </div>
    </ReportPageTemplate>
  );
}
