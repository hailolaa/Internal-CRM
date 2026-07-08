"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calendar, RefreshCw, Users } from "lucide-react";
import { DataTable, TableCell, TableRow } from "@/components/ui/tables";
import { DataProvenanceBadge, ProvenanceSummary } from "@/components/ui";
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
  RevenueLeakDetailRecord,
} from "@/lib/api-types";
import type { StatCardData } from "@/lib/types";

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function NoshowsReportPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [dateRange, setDateRange] = useState<string>(REPORT_DATE_RANGES[0]);
  const reportParams = useMemo(
    () => getReportDateRangeParams(dateRange),
    [dateRange],
  );
  const {
    exportCsv: exportNoShowsCsv,
    exportStatus,
    isExporting,
  } = useReportCsvExport({
    params: reportParams,
    token,
    type: "no-shows",
  });
  const [summary, setSummary] = useState<DashboardSummaryRecord | null>(null);
  const [leakDetails, setLeakDetails] = useState<RevenueLeakDetailRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const authToken = token;

    async function loadNoShowsReport() {
      setIsLoading(true);
      try {
        const [summaryRecord, detailsRecord] = await Promise.all([
          api.reports.dashboardSummary(authToken, reportParams),
          api.reports.revenueLeakDetails(authToken, reportParams),
        ]);

        if (!cancelled) {
          setSummary(summaryRecord);
          setLeakDetails(detailsRecord.items.noShows || []);
          setLoadError("");
        }
      } catch (error) {
        console.error("Failed to load no-shows report", error);
        if (!cancelled) {
          setSummary(null);
          setLeakDetails([]);
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load live no-shows report.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadNoShowsReport();

    return () => {
      cancelled = true;
    };
  }, [reportParams, token]);

  const liveMetrics = useMemo<StatCardData[]>(() => {
    if (!summary) {
      return [
        {
          label: "No-show Rate",
          value: isLoading ? "Loading" : "N/A",
          icon: AlertTriangle,
          color: "green",
        },
        {
          label: "Appointments",
          value: isLoading ? "Loading" : "N/A",
          icon: Calendar,
          color: "amber",
        },
        {
          label: "Recovery Queue",
          value: isLoading ? "Loading" : "N/A",
          icon: RefreshCw,
          color: "green",
        },
        {
          label: "Active Plans",
          value: isLoading ? "Loading" : "N/A",
          icon: Users,
          color: "green",
        },
      ];
    }

    return [
      {
        label: "No-show Rate",
        value: `${percent(summary.cards.noShows, summary.cards.appointments)}%`,
        change: `${summary.cards.noShows} no-shows`,
        trend: "up",
        icon: AlertTriangle,
        color: "green",
      },
      {
        label: "Appointments",
        value: `${summary.cards.appointments}`,
        change: `${summary.cards.attendedConsults} attended`,
        trend: "up",
        icon: Calendar,
        color: "amber",
      },
      {
        label: "Recovery Queue",
        value: `${leakDetails.length}`,
        change: "Live risks",
        trend: "up",
        icon: RefreshCw,
        color: "green",
      },
      {
        label: "Active Plans",
        value: `${summary.cards.activeTreatmentPlans}`,
        change: "Retention base",
        trend: "up",
        icon: Users,
        color: "green",
      },
    ];
  }, [isLoading, summary, leakDetails.length]);

  return (
    <ReportPageTemplate
      title="No-shows & Retention"
      subtitle="Analyze appointment attendance and client retention rates."
      metrics={liveMetrics}
      dateRanges={[...REPORT_DATE_RANGES]}
      selectedDateRange={dateRange}
      onDateRangeChange={setDateRange}
      exportDisabled={!token || isLoading}
      exportLabel="Export CSV"
      isExporting={isExporting}
      onExport={() => void exportNoShowsCsv()}
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

      {loadError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <ProvenanceSummary
        items={[
          {
            label: "Attendance",
            value: summary ? "exact" : "unknown",
          },
          {
            label: "Risk value",
            value: leakDetails.length ? "estimated" : "unknown",
          },
          {
            label: "Recovery records",
            value: leakDetails.length ? "live" : "unknown",
          },
        ]}
      />

      <DataTable
        headers={[
          { label: "Contact" },
          { label: "Treatment" },
          { label: "Occurred" },
          { label: "Risk" },
          { label: "Next Action" },
          { label: "Status" },
        ]}
      >
        {(leakDetails.length ? leakDetails : []).map((detail) => (
          <TableRow key={detail.id}>
            <TableCell>
              <div>
                <p className="font-medium text-[#111111]">
                  {detail.contactName}
                </p>
                <p className="text-xs text-[#6B7280]">
                  {detail.contactPhone || "No phone"}
                </p>
              </div>
            </TableCell>
            <TableCell className="text-sm text-[#111111]">
              {detail.treatment || "Unknown"}
            </TableCell>
            <TableCell className="text-sm text-[#6B7280]">
              {formatDate(detail.occurredAt)}
            </TableCell>
            <TableCell className="text-sm font-medium text-[#A07840]">
              <div className="flex flex-wrap items-center gap-2">
                <span>{formatCurrency(detail.estimatedRisk)}</span>
                <DataProvenanceBadge value={detail.riskLabel} />
              </div>
            </TableCell>
            <TableCell className="text-sm text-[#111111]">
              {detail.nextAction}
            </TableCell>
            <TableCell>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                {detail.status}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </DataTable>

      {!leakDetails.length && (
        <div
          className="rounded-[24px] p-8 text-center"
          style={{
            backgroundColor: "#FFFCF9",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{
              backgroundColor: "rgba(110,106,232,0.08)",
              border: "1px solid rgba(110,106,232,0.12)",
            }}
          >
            <AlertTriangle className="w-7 h-7 text-[#6E6AE8]" />
          </div>
          <h2
            className="text-lg font-semibold mb-2"
            style={{ color: "#111111" }}
          >
            No no-show risks found
          </h2>
          <p
            className="text-sm max-w-md mx-auto leading-relaxed"
            style={{ color: "#6B7280" }}
          >
            Live no-show recovery opportunities will appear here when they are
            detected.
          </p>
        </div>
      )}
    </ReportPageTemplate>
  );
}
