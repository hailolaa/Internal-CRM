"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  LineChart,
  PoundSterling,
  Target,
  TrendingDown,
  Users,
} from "lucide-react";
import { AlertBanner, Card, PageHeader, ProgressBar, StatCard } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  DashboardSummaryRecord,
  RevenueByChannelRecord,
  RevenueByTreatmentRecord,
} from "@/lib/api-types";
import { formatCurrency, formatNumber, percentage } from "@/lib/utils";

const SCENARIOS = [
  { label: "Conservative", multiplier: 0.92, color: "amber" },
  { label: "Expected", multiplier: 1.08, color: "teal" },
  { label: "Growth", multiplier: 1.22, color: "violet" },
] as const;

function forecastMonthLabel(offset: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + offset);
  return new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date);
}

export default function AIForecastingPage() {
  const { session } = useAuth();
  const [summary, setSummary] = useState<DashboardSummaryRecord | null>(null);
  const [channelRevenue, setChannelRevenue] =
    useState<RevenueByChannelRecord | null>(null);
  const [treatmentRevenue, setTreatmentRevenue] =
    useState<RevenueByTreatmentRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session?.token) return;

    let isMounted = true;
    Promise.all([
      api.reports.dashboardSummary(session.token),
      api.reports.revenueByChannel(session.token),
      api.reports.revenueByTreatment(session.token),
    ])
      .then(([summaryRecord, channelRecord, treatmentRecord]) => {
        if (!isMounted) return;
        setSummary(summaryRecord);
        setChannelRevenue(channelRecord);
        setTreatmentRevenue(treatmentRecord);
        setError("");
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load forecasting inputs.",
        );
      });

    return () => {
      isMounted = false;
    };
  }, [session?.token]);

  const forecast = useMemo(() => {
    const currentRevenue = summary?.financials.totalRevenue ?? 0;
    const currentLeads = summary?.cards.leads ?? 0;
    const bookedConsults = summary?.cards.bookedConsults ?? 0;
    const conversionRate = percentage(bookedConsults, currentLeads);
    const monthlyGrowth =
      currentRevenue > 0 && summary?.financials.openDealValue
        ? Math.min(summary.financials.openDealValue / currentRevenue, 0.35)
        : 0.08;

    const months = [1, 2, 3].map((offset) => {
      const expectedRevenue = currentRevenue * (1 + monthlyGrowth * offset);
      const expectedLeads = currentLeads * (1 + 0.06 * offset);

      return {
        month: forecastMonthLabel(offset),
        revenue: expectedRevenue,
        leads: Math.round(expectedLeads),
        bookings: Math.round(expectedLeads * (conversionRate / 100)),
      };
    });

    const topChannel = channelRevenue?.bySource
      .slice()
      .sort((a, b) => b.revenue - a.revenue)[0];
    const topTreatment = treatmentRevenue?.byTreatment
      .slice()
      .sort((a, b) => b.revenue - a.revenue)[0];

    return {
      currentRevenue,
      currentLeads,
      conversionRate,
      monthlyGrowth,
      months,
      topChannel,
      topTreatment,
    };
  }, [channelRevenue, summary, treatmentRevenue]);

  const projectedQuarterRevenue = forecast.months.reduce(
    (total, month) => total + month.revenue,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Forecasting"
        subtitle="Revenue projections and growth scenarios from live CRM data."
        icon={Brain}
        iconColor="text-[#6E6AE8]"
        iconBg="bg-[rgba(110,106,232,0.08)]"
      />

      {error && (
        <AlertBanner
          icon={AlertTriangle}
          title="Forecast inputs could not be loaded"
          description={error}
          variant="warning"
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Current Revenue"
          value={formatCurrency(forecast.currentRevenue)}
          sub="Dashboard range"
          icon={PoundSterling}
          color="green"
        />
        <StatCard
          label="90-Day Forecast"
          value={formatCurrency(projectedQuarterRevenue)}
          sub="Expected scenario"
          icon={LineChart}
          color="violet"
        />
        <StatCard
          label="Lead Volume"
          value={formatNumber(forecast.currentLeads)}
          sub={`${forecast.conversionRate}% booking rate`}
          icon={Users}
          color="teal"
        />
        <StatCard
          label="Growth Signal"
          value={`${Math.round(forecast.monthlyGrowth * 100)}%`}
          sub="Monthly projection"
          icon={Target}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2" padding="p-0">
          <div className="px-6 py-4 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between">
            <h2 className="font-semibold text-[#111111] flex items-center gap-2">
              <LineChart className="w-5 h-5 text-[#6E6AE8]" /> 90-Day Forecast
            </h2>
            <span className="text-xs text-[#6B7280]">Live calculation</span>
          </div>
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {forecast.months.map((month, index) => {
              const progress = percentage(month.revenue, projectedQuarterRevenue);

              return (
                <div key={month.month} className="px-6 py-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-[#111111]">
                        {month.month}
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        {formatNumber(month.leads)} leads ·{" "}
                        {formatNumber(month.bookings)} booked consults
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-lg font-bold text-[#151f21]">
                        {formatCurrency(month.revenue)}
                      </p>
                      <p className="text-xs text-[#60b4af]">
                        Month {index + 1}
                      </p>
                    </div>
                  </div>
                  <ProgressBar value={progress} max={100} color="violet" />
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-[#111111] mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#5e8a8d]" /> Budget Scenarios
          </h2>
          <div className="space-y-4">
            {SCENARIOS.map((scenario) => (
              <div
                key={scenario.label}
                className="p-4 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-[#F7F5F2]"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-[#151f21]">
                    {scenario.label}
                  </span>
                  <span className="text-sm font-semibold text-[#5e8a8d]">
                    {formatCurrency(projectedQuarterRevenue * scenario.multiplier)}
                  </span>
                </div>
                <ProgressBar
                  value={Math.min(100, scenario.multiplier * 70)}
                  max={100}
                  color={scenario.color}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <h3 className="font-semibold text-[#111111] mb-2 flex items-center gap-2">
            <Target className="w-4 h-4 text-[#60b4af]" /> Strongest Channel
          </h3>
          <p className="text-2xl font-bold text-[#151f21]">
            {forecast.topChannel?.channel ||
              forecast.topChannel?.source ||
              "No channel data"}
          </p>
          <p className="text-sm text-[#6B7280] mt-1">
            {forecast.topChannel
              ? `${formatCurrency(forecast.topChannel.revenue)} revenue at ${forecast.topChannel.roas.toFixed(1)}x ROAS`
              : "Add campaign revenue to improve channel forecasts."}
          </p>
        </Card>
        <Card>
          <h3 className="font-semibold text-[#111111] mb-2 flex items-center gap-2">
            <PoundSterling className="w-4 h-4 text-[#5e8a8d]" /> Treatment Driver
          </h3>
          <p className="text-2xl font-bold text-[#151f21]">
            {forecast.topTreatment?.treatment || "No treatment data"}
          </p>
          <p className="text-sm text-[#6B7280] mt-1">
            {forecast.topTreatment
              ? `${formatCurrency(forecast.topTreatment.revenue)} revenue across ${forecast.topTreatment.soldTreatments} sold treatments`
              : "Add treatment plan revenue to sharpen projections."}
          </p>
        </Card>
        <Card>
          <h3 className="font-semibold text-[#111111] mb-2 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-[#b7672e]" /> Forecast Risk
          </h3>
          <p className="text-2xl font-bold text-[#151f21]">
            {summary?.cards.missedCalls ?? 0} missed calls
          </p>
          <p className="text-sm text-[#6B7280] mt-1">
            Missed call recovery is the fastest lever to protect forecasted
            bookings.
          </p>
        </Card>
      </div>
    </div>
  );
}
