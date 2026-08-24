"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, BarChart3, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { api } from "@/lib/api-client";
import type { GrowthScorePortfolio, GrowthScorePortfolioRow } from "@/lib/api-types";
import {
  type GrowthScoreTone,
  growthScoreDeltaLabel,
  growthScoreTone,
  sortPortfolioRows,
  summarizeGrowthScorePortfolio,
} from "@/lib/growth-score-portfolio";
import { useAuth } from "@/lib/auth-context";
import { AlertBanner, SkeletonLine } from "@/components/ui";

function toneClass(tone: GrowthScoreTone) {
  if (tone === "success") return "border-[#B9E2D1] bg-[#F1FAF5] text-[#23674F]";
  if (tone === "danger") return "border-[#F0C9BF] bg-[#FFF4F1] text-[#9A4B39]";
  if (tone === "warning") return "border-[#EBD3A3] bg-[#FFF8EC] text-[#8A6428]";
  return "border-black/[0.08] bg-[#F7F4F0] text-[#625F5A]";
}

function MetricTile({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: GrowthScoreTone }) {
  return (
    <div className={`rounded-2xl border p-3.5 ${toneClass(tone)}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function formatScore(value: number | null | undefined) {
  return value === null || value === undefined ? "Not scored" : value.toFixed(1);
}

export default function GrowthScorePortfolioPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [portfolio, setPortfolio] = useState<GrowthScorePortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPortfolio = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError("");
      setPortfolio(await api.growthScores.getPortfolio(token));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Growth Score portfolio could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => {
      void loadPortfolio();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPortfolio, token]);

  const summary = useMemo(() => (portfolio ? summarizeGrowthScorePortfolio(portfolio) : null), [portfolio]);
  const rows = useMemo(() => sortPortfolioRows(portfolio?.clients ?? []), [portfolio]);

  if (loading) {
    return (
      <main className="mx-auto max-w-[1320px] space-y-4 pb-12">
        <SkeletonLine className="h-10 w-1/3" />
        <SkeletonLine className="h-48 w-full" />
        <SkeletonLine className="h-72 w-full" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1320px] space-y-4 pb-12">
      <Link href="/app/reports/overview" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-[#625FC7] hover:bg-[#EDEBFF]">
        <ArrowLeft className="h-4 w-4" /> Back to reports
      </Link>

      <header className="overflow-hidden rounded-3xl border border-black/[0.06] bg-[#FFFCF9] shadow-[0_14px_44px_rgba(49,45,90,0.07)]">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center">
          <div className="flex min-w-0 gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F1FAF5] text-[#23674F]">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#23674F]">Growth Score portfolio</p>
              <h1 className="mt-1.5 text-2xl font-semibold text-[#171615] sm:text-3xl">Outcome Feedback & Score Trends</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6C6761]">
                Review client-level score movement, captured outcome feedback and portfolio trends over time.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile label="Clients" value={summary?.clients ?? 0} />
            <MetricTile label="Avg score" value={formatScore(summary?.averageScore)} tone={growthScoreTone(summary?.averageScore)} />
            <MetricTile label="Improving" value={summary?.improving ?? 0} tone="success" />
            <MetricTile label="Declining" value={summary?.declining ?? 0} tone={(summary?.declining ?? 0) > 0 ? "danger" : "neutral"} />
          </div>
        </div>
      </header>

      {error && <AlertBanner variant="error" title="Could not load Growth Score portfolio" description={error} />}

      <section className="grid gap-3 md:grid-cols-4">
        <MetricTile label="Scored clients" value={summary?.clientsWithScores ?? 0} tone="success" />
        <MetricTile label="Needs score" value={summary?.needsScore ?? 0} tone={(summary?.needsScore ?? 0) > 0 ? "warning" : "neutral"} />
        <MetricTile label="Feedback items" value={summary?.feedbackItems ?? 0} />
        <div className="rounded-2xl border border-black/[0.08] bg-white p-3.5 text-[#171615]">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6C6761]">Scope</p>
          <p className="mt-2 text-lg font-semibold">{portfolio?.scope === "all_clients" ? "All managed clients" : "Current workspace"}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-black/[0.06] bg-white p-4 shadow-[0_14px_44px_rgba(49,45,90,0.06)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6C6761]">Trend</p>
            <h2 className="text-xl font-semibold text-[#171615]">Portfolio average over time</h2>
          </div>
          <button
            type="button"
            onClick={() => void loadPortfolio()}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-black/[0.08] px-3 text-sm font-semibold text-[#171615] hover:bg-[#F7F4F0]"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
        {portfolio?.trends.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {portfolio.trends.map((trend) => (
              <div key={trend.snapshotDate} className="rounded-2xl border border-black/[0.08] bg-[#FFFCF9] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A8580]">{trend.snapshotDate}</p>
                <p className="mt-2 text-2xl font-semibold text-[#171615]">{formatScore(trend.averageScore)}</p>
                <p className="mt-1 text-sm text-[#6C6761]">{trend.scoredClients} scored client{trend.scoredClients === 1 ? "" : "s"}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No trend history yet" description="Add at least two Growth Score snapshots to show portfolio movement." />
        )}
      </section>

      <section className="rounded-3xl border border-black/[0.06] bg-white p-4 shadow-[0_14px_44px_rgba(49,45,90,0.06)]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6C6761]">Drill-down</p>
          <h2 className="text-xl font-semibold text-[#171615]">Client score movement</h2>
          <p className="mt-1 text-sm leading-6 text-[#6C6761]">Lowest scores and declining accounts appear first so the next review is obvious.</p>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="No client accounts found" description="Create client account profiles and Growth Score snapshots before portfolio views can be shown." />
        ) : (
          <div className="mt-4 grid gap-3">
            {rows.map((row) => (
              <PortfolioRow key={row.clientAccountProfileId} row={row} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function PortfolioRow({ row }: { row: GrowthScorePortfolioRow }) {
  const tone = growthScoreTone(row.currentScore);
  const DirectionIcon = (row.scoreDelta ?? 0) < 0 ? TrendingDown : TrendingUp;

  return (
    <article className="rounded-2xl border border-black/[0.08] bg-[#FFFCF9] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 text-base font-semibold text-[#171615]">{row.clientName}</h3>
            <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[11px] font-bold uppercase tracking-[0.08em] ${toneClass(tone)}`}>
              {formatScore(row.currentScore)}
            </span>
            {row.scoreDelta !== null && (
              <span className={`inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-bold uppercase tracking-[0.08em] ${toneClass(row.scoreDelta < 0 ? "danger" : row.scoreDelta > 0 ? "success" : "neutral")}`}>
                <DirectionIcon className="h-3.5 w-3.5" /> {growthScoreDeltaLabel(row.scoreDelta)}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[#6C6761]">{row.currentPackage || "No package set"} · {row.clientStatus.replace(/_/g, " ")}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A8580]">
            Snapshot {row.currentSnapshotDate || "not recorded"} · Recommended {row.recommendedPackage || "not set"}
          </p>
        </div>
        <div className="grid gap-2 text-sm text-[#4D4945] sm:grid-cols-3 lg:min-w-[440px]">
          <MiniMetric label="Previous" value={formatScore(row.previousScore)} />
          <MiniMetric label="Feedback" value={row.feedbackCount} />
          <MiniMetric label="Last outcome" value={row.lastOutcomeType ? row.lastOutcomeType.replace(/_/g, " ") : "None"} />
        </div>
      </div>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A8580]">{label}</p>
      <p className="mt-1 break-words font-semibold text-[#171615]">{value}</p>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-black/[0.14] bg-[#FFFCF9] p-6 text-center">
      <Activity className="mx-auto h-8 w-8 text-[#8A8580]" />
      <h3 className="mt-3 text-base font-semibold text-[#171615]">{title}</h3>
      <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-[#6C6761]">{description}</p>
    </div>
  );
}
