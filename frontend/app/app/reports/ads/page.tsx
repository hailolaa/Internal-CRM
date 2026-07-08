"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable, TableRow, TableCell } from "@/components/ui/tables";
import { ReportPageTemplate } from "@/components/templates/report-page";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useReportCsvExport } from "@/hooks/use-report-csv-export";
import {
  REPORT_DATE_RANGES,
  getReportDateRangeParams,
} from "@/lib/report-date-ranges";
import type { CampaignMetricRecord, RoasMetricsRecord } from "@/lib/api-types";
import type { StatCardData } from "@/lib/types";
import { PoundSterling, Target, TrendingUp, Users } from "lucide-react";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export default function AdsReportPage() {
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
  const [roasMetrics, setRoasMetrics] = useState<RoasMetricsRecord | null>(
    null,
  );
  const [campaignMetrics, setCampaignMetrics] = useState<
    CampaignMetricRecord[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadAdsReport() {
      setIsLoading(true);
      try {
        const [roas, campaigns] = await Promise.all([
          api.reports.roasMetrics(session!.token),
          api.reports.campaignMetrics(session!.token),
        ]);

        if (!cancelled) {
          setRoasMetrics(roas);
          setCampaignMetrics(campaigns);
          setStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load ads report", error);
        if (!cancelled) {
          setRoasMetrics(null);
          setCampaignMetrics([]);
          setStatusMessage(
            error instanceof Error
              ? error.message
              : "Unable to load live ads report data.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadAdsReport();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const liveMetrics = useMemo<StatCardData[]>(() => {
    if (!roasMetrics) return [];

    const leads = roasMetrics.byCampaign.reduce(
      (sum, campaign) => sum + campaign.leads,
      0,
    );

    return [
      {
        label: "Total Ad Spend",
        value: formatCurrency(roasMetrics.spend),
        change: roasMetrics.attribution,
        trend: "up",
        icon: PoundSterling,
        color: "blue",
      },
      {
        label: "Total Leads",
        value: formatNumber(leads),
        change: "Live",
        trend: "up",
        icon: Users,
        color: "green",
      },
      {
        label: "Cost Per Lead",
        value: formatCurrency(roasMetrics.costPerLead),
        change: "Blended",
        trend: "up",
        icon: Target,
        color: "teal",
      },
      {
        label: "ROAS",
        value: `${roasMetrics.roas.toFixed(1)}x`,
        change: formatCurrency(roasMetrics.revenue),
        trend: "up",
        icon: TrendingUp,
        color: "violet",
      },
    ];
  }, [roasMetrics]);

  const livePlatformBreakdown = useMemo(() => {
    if (!campaignMetrics.length) return [];

    const byPlatform = new Map<
      string,
      { spend: number; leads: number; revenue: number; costPerLead: number }
    >();
    campaignMetrics.forEach((campaign) => {
      const platform = campaign.source || campaign.channel || "Unknown";
      const current = byPlatform.get(platform) || {
        spend: 0,
        leads: 0,
        revenue: 0,
        costPerLead: 0,
      };
      current.spend += campaign.spend;
      current.leads += campaign.leads;
      current.revenue += campaign.revenue;
      current.costPerLead = current.leads ? current.spend / current.leads : 0;
      byPlatform.set(platform, current);
    });

    const totalSpend = [...byPlatform.values()].reduce(
      (sum, platform) => sum + platform.spend,
      0,
    );

    return [...byPlatform.entries()].map(([platform, values], index) => ({
      platform,
      spend: formatCurrency(values.spend),
      leads: values.leads,
      cpl: formatCurrency(values.costPerLead),
      roas: `${(values.spend ? values.revenue / values.spend : 0).toFixed(1)}x`,
      percentage: percent(values.spend, totalSpend),
      marker: platform.charAt(0).toUpperCase(),
      color:
        index === 0
          ? "bg-[rgba(74,106,138,0.08)]"
          : "bg-[rgba(110,106,232,0.08)]",
    }));
  }, [campaignMetrics]);

  const liveCampaigns = campaignMetrics;

  return (
    <ReportPageTemplate
      title="Ads & ROI Report"
      subtitle="Track advertising performance and return on investment."
      metrics={liveMetrics.length ? liveMetrics : undefined}
      dateRanges={[...REPORT_DATE_RANGES]}
      selectedDateRange={dateRange}
      onDateRangeChange={setDateRange}
      exportDisabled={!token || isLoading}
      exportLabel="Export CSV"
      isExporting={isExporting}
      onExport={() => void exportAttributionCsv()}
      showRefresh
    >
      {exportStatus && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
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

      {statusMessage && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {statusMessage}
        </div>
      )}

      {isLoading && (
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-[24px] border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] p-6">
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 rounded-[18px] bg-[rgba(90,138,106,0.08)] animate-pulse"
                />
              ))}
            </div>
          </div>
          <div className="rounded-[24px] border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] p-6">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-12 rounded-[14px] bg-[rgba(90,138,106,0.08)] animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div
            className="rounded-[24px] p-6"
            style={{
              backgroundColor: "#FFFCF9",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
            }}
          >
            <h3 className="font-semibold mb-4" style={{ color: "#111111" }}>
              Platform Breakdown
            </h3>
            <div className="space-y-4">
              {livePlatformBreakdown.length ? (
                livePlatformBreakdown.map((platform) => (
                <div
                  key={platform.platform}
                  className="p-4 rounded-[24px]"
                  style={{
                    backgroundColor: "#FAF8F5",
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-[14px] flex items-center justify-center ${platform.color}`}
                      >
                        <span className="text-lg">{platform.marker}</span>
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: "#111111" }}>
                          {platform.platform}
                        </p>
                        <p className="text-xs" style={{ color: "#6B7280" }}>
                          {platform.percentage}% of spend
                        </p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-[#5A8A6A]">
                      {platform.roas}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p style={{ color: "#6B7280" }}>Spend</p>
                      <p className="font-medium" style={{ color: "#111111" }}>
                        {platform.spend}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "#6B7280" }}>Leads</p>
                      <p className="font-medium" style={{ color: "#111111" }}>
                        {platform.leads}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "#6B7280" }}>CPL</p>
                      <p className="font-medium" style={{ color: "#111111" }}>
                        {platform.cpl}
                      </p>
                    </div>
                  </div>
                </div>
                ))
              ) : (
                <div
                  className="rounded-[18px] p-5 text-sm"
                  style={{
                    backgroundColor: "#FAF8F5",
                    border: "1px solid rgba(0,0,0,0.06)",
                    color: "#6B7280",
                  }}
                >
                  {isLoading
                    ? "Loading live platform performance..."
                    : "No live platform performance data is available."}
                </div>
              )}
            </div>
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
            Top Keywords
          </h3>
          <div
            className="rounded-[18px] p-5 text-sm leading-relaxed"
            style={{
              backgroundColor: "#FAF8F5",
              border: "1px solid rgba(0,0,0,0.06)",
              color: "#6B7280",
            }}
          >
            Keyword-level ads data is unavailable because the current backend
            report endpoint does not expose search-term metrics.
          </div>
        </div>
      </div>

      <DataTable
        headers={[
          { label: "Campaign" },
          { label: "Platform" },
          { label: "Spend" },
          { label: "Booked", className: "hidden md:table-cell" },
          { label: "Attended", className: "hidden md:table-cell" },
          { label: "Sold", className: "hidden lg:table-cell" },
          { label: "Leads" },
          { label: "CPL" },
          { label: "ROAS" },
          { label: "Attribution" },
        ]}
      >
        {liveCampaigns.length ? (
          liveCampaigns.map((campaign) => (
            <TableRow key={`${campaign.period}-${campaign.campaign || "unattributed"}`}>
              <TableCell className="font-medium text-[#111111]">
                {campaign.campaign || "Unattributed"}
              </TableCell>
              <TableCell className="text-sm text-[#6B7280]">
                {campaign.source || campaign.channel || "Unknown"}
              </TableCell>
              <TableCell className="text-sm text-[#111111]">
                {formatCurrency(campaign.spend)}
              </TableCell>
              <TableCell className="text-sm text-[#6B7280] hidden md:table-cell">
                {campaign.bookedConsults}
              </TableCell>
              <TableCell className="text-sm text-[#6B7280] hidden md:table-cell">
                {campaign.attendedConsults}
              </TableCell>
              <TableCell className="text-sm text-[#111111] hidden lg:table-cell">
                {campaign.soldTreatments}
              </TableCell>
              <TableCell className="text-sm text-[#111111]">
                {campaign.leads}
              </TableCell>
              <TableCell className="text-[#6E6AE8] font-medium text-sm">
                {formatCurrency(campaign.costPerLead)}
              </TableCell>
              <TableCell className="text-[#5A8A6A] font-medium text-sm">
                {campaign.roas.toFixed(1)}x
              </TableCell>
              <TableCell>
                <span
                  className="text-xs px-2 py-1 rounded-full"
                  style={{
                    backgroundColor: "rgba(90,138,106,0.08)",
                    color: "#5A8A6A",
                    border: "1px solid rgba(90,138,106,0.2)",
                  }}
                >
                  {campaign.attribution}
                </span>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <tr>
            <td
              colSpan={10}
              className="px-6 py-10 text-center text-sm"
              style={{ color: "#6B7280" }}
            >
              {isLoading
                ? "Loading live campaign performance..."
                : "No live campaign performance data is available."}
            </td>
          </tr>
        )}
      </DataTable>
    </ReportPageTemplate>
  );
}
