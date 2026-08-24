"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { api } from "@/lib/api-client";
import type { BenchmarkSummaryRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { AlertBanner, SkeletonLine } from "@/components/ui";
import { Card } from "@/components/ui/cards";

function formatMetric(value: number, unit: "percent" | "minutes" | "currency") {
  if (unit === "percent") return `${value}%`;
  if (unit === "minutes") return `${value} min`;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function toneClass(tone: "success" | "warning" | "neutral") {
  if (tone === "success") return "border-[#B9E2D1] bg-[#F1FAF5] text-[#23674F]";
  if (tone === "warning") return "border-[#EBD3A3] bg-[#FFF8EC] text-[#8A6428]";
  return "border-black/[0.08] bg-[#F7F4F0] text-[#625F5A]";
}

function StatusPill({ children, tone = "neutral" }: { children: string; tone?: "success" | "warning" | "neutral" }) {
  return (
    <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[11px] font-bold uppercase tracking-[0.08em] ${toneClass(tone)}`}>
      {children}
    </span>
  );
}

export default function BenchmarkingPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [report, setReport] = useState<BenchmarkSummaryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError("");
      setReport(await api.reports.benchmarkAdvanced(token));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Benchmark report could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadReport(), 0);
    return () => window.clearTimeout(timer);
  }, [loadReport]);

  const cohortMetrics = useMemo(
    () => report?.metrics.filter((metric) => metric.cohort?.available).length || 0,
    [report],
  );

  return (
    <main className="min-h-screen bg-[#F6F1EA] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315f62]">Governed benchmarking</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#151f21]">Advanced benchmark reports</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#625F5A]">
              Cohort comparisons are anonymized before display. When the peer cohort is too small, the report keeps
              estimated benchmark wording instead of exposing unstable or identifiable comparisons.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadReport()}
            disabled={loading || !token}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#315f62] px-4 text-sm font-semibold text-white hover:bg-[#264f51] disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error ? <AlertBanner variant="error" title="Benchmark report unavailable" description={error} /> : null}

        {loading ? (
          <Card className="space-y-3">
            <SkeletonLine className="h-6 w-56" />
            <SkeletonLine className="h-4 w-full" />
            <SkeletonLine className="h-4 w-3/4" />
          </Card>
        ) : report ? (
          <>
            <section className="grid gap-3 md:grid-cols-3">
              <Card className="space-y-2" padding="p-5">
                <div className="flex items-center gap-2 text-[#315f62]">
                  <ShieldCheck className="h-5 w-5" />
                  <p className="text-xs font-bold uppercase tracking-[0.12em]">Governance</p>
                </div>
                <p className="text-sm text-[#625F5A]">{report.governance?.notes || report.safeWording}</p>
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone="success">{report.governance?.accessControl || "reports:read"}</StatusPill>
                  <StatusPill>{report.governance?.clinicIdentitiesExposed === false ? "No clinic IDs exposed" : "Guarded"}</StatusPill>
                </div>
              </Card>
              <Card className="space-y-2" padding="p-5">
                <div className="flex items-center gap-2 text-[#315f62]">
                  <BarChart3 className="h-5 w-5" />
                  <p className="text-xs font-bold uppercase tracking-[0.12em]">Cohort coverage</p>
                </div>
                <p className="text-3xl font-semibold text-[#151f21]">{cohortMetrics}/{report.metrics.length}</p>
                <p className="text-sm text-[#625F5A]">Metrics currently above the anonymization threshold.</p>
              </Card>
              <Card className="space-y-2" padding="p-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#315f62]">Current sample</p>
                <p className="text-sm text-[#625F5A]">
                  {report.counts.leads} leads / {report.counts.calls} calls / {report.counts.consults} consults
                </p>
                <StatusPill tone="warning">{report.cohortStatus.replaceAll("_", " ")}</StatusPill>
              </Card>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              {report.metrics.map((metric) => {
                const cohortAvailable = Boolean(metric.cohort?.available);
                const positiveGap = metric.gapToAverage >= 0;
                return (
                  <Card key={metric.key} className="space-y-4" padding="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-[#151f21]">{metric.label}</h2>
                        <p className="mt-1 text-sm text-[#625F5A]">{metric.wording}</p>
                      </div>
                      <StatusPill tone={cohortAvailable ? "success" : "warning"}>
                        {cohortAvailable ? "Anonymized cohort" : "Estimated"}
                      </StatusPill>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-black/[0.06] bg-white p-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#7A746A]">Clinic</p>
                        <p className="mt-2 text-2xl font-semibold text-[#151f21]">{formatMetric(metric.value, metric.unit)}</p>
                      </div>
                      <div className="rounded-2xl border border-black/[0.06] bg-white p-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#7A746A]">Benchmark</p>
                        <p className="mt-2 text-2xl font-semibold text-[#151f21]">{formatMetric(metric.benchmarkAverage, metric.unit)}</p>
                      </div>
                      <div className="rounded-2xl border border-black/[0.06] bg-white p-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#7A746A]">Gap</p>
                        <p className={`mt-2 flex items-center gap-1 text-2xl font-semibold ${positiveGap ? "text-[#23674F]" : "text-[#9A4B39]"}`}>
                          {positiveGap ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                          {formatMetric(Math.abs(metric.gapToAverage), metric.unit)}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#E7E1DA] bg-[#FAF8F5] p-3 text-sm text-[#625F5A]">
                      {cohortAvailable
                        ? `Cohort size: ${metric.cohort?.clinicCount} anonymized peer clinics.`
                        : metric.cohort?.suppressedReason || "Cohort comparison is not available yet."}
                    </div>
                    {metric.insight ? (
                      <p className="text-sm font-medium leading-6 text-[#315f62]">{metric.insight}</p>
                    ) : null}
                  </Card>
                );
              })}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
