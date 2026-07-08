"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, PoundSterling, TrendingUp, Users } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui";
import { DataTable, TableCell, TableRow } from "@/components/ui/tables";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  DashboardSummaryRecord,
  RevenueByChannelRecord,
  RevenueByTreatmentRecord,
} from "@/lib/api-types";

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

export default function FinancialsPage() {
  const { session } = useAuth();
  const [summary, setSummary] = useState<DashboardSummaryRecord | null>(null);
  const [channelRevenue, setChannelRevenue] =
    useState<RevenueByChannelRecord | null>(null);
  const [treatmentRevenue, setTreatmentRevenue] =
    useState<RevenueByTreatmentRecord | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadFinancials() {
      try {
        const [summaryRecord, channelRecord, treatmentRecord] =
          await Promise.all([
            api.reports.dashboardSummary(session!.token),
            api.reports.revenueByChannel(session!.token),
            api.reports.revenueByTreatment(session!.token),
          ]);

        if (!cancelled) {
          setSummary(summaryRecord);
          setChannelRevenue(channelRecord);
          setTreatmentRevenue(treatmentRecord);
          setStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load financials", error);
        if (!cancelled) {
          setStatusMessage("Financial data could not be loaded.");
        }
      }
    }

    loadFinancials();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const topChannels = useMemo(
    () => channelRevenue?.bySource.slice(0, 8) || [],
    [channelRevenue],
  );
  const topTreatments = useMemo(
    () => treatmentRevenue?.byTreatment.slice(0, 8) || [],
    [treatmentRevenue],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financials"
        subtitle="Revenue, spend, ROAS, and treatment value."
        icon={PoundSterling}
        iconColor="text-[#A07840]"
      />

      {statusMessage && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(summary?.financials.totalRevenue || 0)}
          change={`${(summary?.financials.roas || 0).toFixed(1)}x ROAS`}
          trend="up"
          icon={PoundSterling}
          color="green"
        />
        <StatCard
          label="Ad Spend"
          value={formatCurrency(summary?.financials.spend || 0)}
          change="Tracked"
          trend="up"
          icon={BarChart3}
          color="blue"
        />
        <StatCard
          label="Cost Per Lead"
          value={formatCurrency(summary?.financials.costPerLead || 0)}
          change="Blended"
          trend="up"
          icon={TrendingUp}
          color="teal"
        />
        <StatCard
          label="Sold Treatments"
          value={formatNumber(summary?.cards.soldTreatments || 0)}
          change={`${summary?.cards.consults || 0} consults`}
          trend="up"
          icon={Users}
          color="violet"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DataTable
          headers={[
            { label: "Channel" },
            { label: "Spend" },
            { label: "Revenue" },
            { label: "ROAS" },
            { label: "CPL" },
          ]}
        >
          {topChannels.map((row) => (
            <TableRow key={`${row.source}-${row.channel}-${row.campaign}`}>
              <TableCell className="font-medium">
                {row.source || row.channel || "Unknown"}
              </TableCell>
              <TableCell>{formatCurrency(row.spend)}</TableCell>
              <TableCell className="font-medium text-[#5A8A6A]">
                {formatCurrency(row.revenue)}
              </TableCell>
              <TableCell>{row.roas.toFixed(1)}x</TableCell>
              <TableCell>{formatCurrency(row.costPerLead)}</TableCell>
            </TableRow>
          ))}
        </DataTable>

        <DataTable
          headers={[
            { label: "Treatment" },
            { label: "Sold" },
            { label: "Revenue" },
            { label: "Avg. Value" },
            { label: "Margin" },
          ]}
        >
          {topTreatments.map((row) => (
            <TableRow key={`${row.treatment}-${row.category}`}>
              <TableCell className="font-medium">{row.treatment}</TableCell>
              <TableCell>{row.soldTreatments}</TableCell>
              <TableCell className="font-medium text-[#5A8A6A]">
                {formatCurrency(row.revenue)}
              </TableCell>
              <TableCell>{formatCurrency(row.averageRevenue)}</TableCell>
              <TableCell>{Math.round(row.marginPercent)}%</TableCell>
            </TableRow>
          ))}
        </DataTable>
      </div>
    </div>
  );
}
