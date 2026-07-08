"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PoundSterling,
  TrendingUp,
  Users,
  ArrowUpRight,
  Calendar,
  Repeat,
  ShoppingBag,
  Target,
} from "lucide-react";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  AiLtvOptimiserOutput,
  AiRunRecord,
  DashboardSummaryRecord,
  RevenueByTreatmentRecord,
} from "@/lib/api-types";

const LTV_OPTIMISER_AGENT_KEY = "ltv_optimiser";

function isLtvOutput(value: unknown): value is AiLtvOptimiserOutput {
  if (!value || typeof value !== "object") return false;
  const output = value as Partial<AiLtvOptimiserOutput>;
  return Boolean(
    output.summary &&
      Array.isArray(output.patientRecommendations) &&
      Array.isArray(output.categoryPotential) &&
      Array.isArray(output.underMonetised),
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRunDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function LTVOptimiserPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [summary, setSummary] = useState<DashboardSummaryRecord | null>(null);
  const [treatmentRevenue, setTreatmentRevenue] =
    useState<RevenueByTreatmentRecord | null>(null);
  const [runs, setRuns] = useState<AiRunRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const authToken = token;

    async function loadLtvData() {
      try {
        const [summaryRecord, treatmentRecord, runRows] = await Promise.all([
          api.reports.dashboardSummary(authToken),
          api.reports.revenueByTreatment(authToken),
          api.ai.listRuns(authToken, { agentKey: LTV_OPTIMISER_AGENT_KEY }),
        ]);

        if (!cancelled) {
          setSummary(summaryRecord);
          setTreatmentRevenue(treatmentRecord);
          setRuns(runRows);
          setStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load ROI reporting data", error);
        if (!cancelled) {
          setSummary(null);
          setTreatmentRevenue(null);
          setRuns([]);
          setStatusMessage(
            error instanceof Error
              ? error.message
              : "Unable to load live ROI reporting data.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadLtvData();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const liveSegments = useMemo(() => {
    if (!treatmentRevenue?.byTreatment.length) return [];

    return treatmentRevenue.byTreatment.slice(0, 4).map((treatment, index) => ({
      name: treatment.treatment,
      patients: treatment.soldTreatments,
      avgSpend: formatCurrency(treatment.averageRevenue),
      ltv: formatCurrency(treatment.revenue),
      trend: treatment.isHighTicket ? "+High ticket" : "+Tracked",
      visitFreq: treatment.category,
      color: index % 2 === 0 ? "text-[#5A8A6A]" : "text-[#7D8F7A]",
    }));
  }, [treatmentRevenue]);
  const ltvRuns = useMemo(
    () => runs.filter((run) => run.agentKey === LTV_OPTIMISER_AGENT_KEY),
    [runs],
  );
  const ltvOutput = ltvRuns.find((run) => isLtvOutput(run.output))
    ?.output as AiLtvOptimiserOutput | undefined;

  const handleGenerate = async () => {
    if (!token || isGenerating) return;

    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const generated = await api.ai.generateLtvOptimiser(token);
      setRuns((current) => [
        {
          id: generated.id,
          projectId: null,
          agentName: "LTV Optimiser",
          agentKey: generated.agentKey,
          task: "Generated LTV optimiser recommendations",
          input: null,
          output: generated.output,
          status: generated.status,
          tokens: 0,
          createdAt: generated.createdAt,
        },
        ...current.filter((run) => run.id !== generated.id),
      ]);
      setStatusMessage("LTV recommendations generated and saved to AI history.");
    } catch (error) {
      console.error("Failed to generate LTV recommendations", error);
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate LTV recommendations.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="ROI Reporting"
        subtitle="High-value segments, rebooking timing, cross-sell opportunities, and under-monetised categories."
        icon={PoundSterling}
        iconColor="text-[#5A8A6A]"
        iconBg="bg-[rgba(90,138,106,0.1)]"
        right={
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!token || isGenerating}
            className="btn-primary disabled:opacity-50"
          >
            <Target className="w-4 h-4" />
            {isGenerating ? "Generating..." : "Generate Recommendations"}
          </button>
        }
      />

      {statusMessage && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Avg. LTV"
          value={
            treatmentRevenue?.totals.soldTreatments
              ? formatCurrency(
                  treatmentRevenue.totals.revenue /
                    treatmentRevenue.totals.soldTreatments,
                )
              : isLoading
                ? "Loading"
                : "N/A"
          }
          change={summary ? "Live revenue" : undefined}
          trend="up"
          icon={PoundSterling}
          color="teal"
        />
        <StatCard
          label="Repeat Rate"
          value={
            summary
              ? `${Math.round(
                  (summary.cards.activeTreatmentPlans /
                    Math.max(summary.cards.soldTreatments, 1)) *
                    100,
                )}%`
              : isLoading
                ? "Loading"
                : "N/A"
          }
          change={summary ? "Active plans" : undefined}
          trend="up"
          icon={Repeat}
          color="blue"
        />
        <StatCard
          label="Cross-sell Rate"
          value={
            treatmentRevenue
              ? `${Math.min(treatmentRevenue.byTreatment.length * 6, 100)}%`
              : isLoading
                ? "Loading"
                : "N/A"
          }
          sub={treatmentRevenue ? "Derived from treatment mix" : undefined}
          icon={ShoppingBag}
          color="violet"
        />
        <StatCard
          label="Revenue Opportunity"
          value={
            summary
              ? formatCurrency(summary.financials.openDealValue)
              : isLoading
                ? "Loading"
                : "N/A"
          }
          sub={summary ? "Open deal value" : undefined}
          icon={Target}
          color="rose"
        />
      </div>

      {/* Patient Segments */}
      <Card>
        <h2
          className="font-semibold mb-4 flex items-center gap-2"
          style={{ color: "#252421" }}
        >
          <Users className="w-5 h-5 text-[#5A8A6A]" /> High-Value Patient
          Segments
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-32 rounded-xl bg-[rgba(90,138,106,0.08)] animate-pulse"
              />
            ))}
          </div>
        ) : liveSegments.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveSegments.map((seg) => (
            <div
              key={seg.name}
              className="p-4 rounded-xl"
              style={{
                backgroundColor: "#F7F5F2",
                border: "1px solid #E5DED6",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium" style={{ color: "#252421" }}>
                  {seg.name}
                </span>
                <span
                  className={`text-xs font-medium ${seg.trend.startsWith("+") ? "text-[#5A8A6A]" : "text-[#8A4A4A]"}`}
                >
                  {seg.trend}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs" style={{ color: "#7A746A" }}>
                    Patients
                  </p>
                  <p className="font-semibold" style={{ color: "#252421" }}>
                    {seg.patients}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "#7A746A" }}>
                    Avg Spend
                  </p>
                  <p className="font-semibold" style={{ color: "#252421" }}>
                    {seg.avgSpend}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "#7A746A" }}>
                    LTV
                  </p>
                  <p className={`font-semibold ${seg.color}`}>{seg.ltv}</p>
                </div>
              </div>
              <p className="text-xs mt-2" style={{ color: "#7A746A" }}>
                Visit frequency: {seg.visitFreq}
              </p>
            </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm" style={{ color: "#7A746A" }}>
            No live treatment revenue segments found.
          </div>
        )}
      </Card>

      {/* Cross-sell */}
      <Card>
        <h2
          className="font-semibold mb-4 flex items-center gap-2"
          style={{ color: "#252421" }}
        >
          <ArrowUpRight className="w-5 h-5 text-[#7D8F7A]" /> Cross-Sell
          Opportunities
        </h2>
        {ltvOutput?.patientRecommendations.length ? (
          <div className="space-y-3">
            {ltvOutput.patientRecommendations
              .filter((item) => item.recommendationType === "cross_sell")
              .slice(0, 5)
              .map((item) => (
                <div
                  key={`${item.contactId}-${item.treatment}`}
                  className="rounded-xl border border-[#EDE8E2] p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-[#252421]">{item.contactName}</p>
                    <span className="text-xs font-medium text-[#7D8F7A]">
                      {item.urgency}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#7A746A]">
                    {item.recommendedAction}
                  </p>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm leading-relaxed" style={{ color: "#7A746A" }}>
            Generate recommendations to see patient-level cross-sell actions.
          </p>
        )}
      </Card>

      {/* Rebooking Timing */}
      <Card>
        <h2
          className="font-semibold mb-4 flex items-center gap-2"
          style={{ color: "#252421" }}
        >
          <Calendar className="w-5 h-5 text-[#A07840]" /> Rebooking Timing
          Improvements
        </h2>
        {ltvOutput ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#EDE8E2] p-3">
                <p className="text-xs text-[#7A746A]">High urgency</p>
                <p className="text-2xl font-semibold text-[#252421]">
                  {ltvOutput.rebookingTiming.highUrgency}
                </p>
              </div>
              <div className="rounded-xl border border-[#EDE8E2] p-3">
                <p className="text-xs text-[#7A746A]">Medium urgency</p>
                <p className="text-2xl font-semibold text-[#252421]">
                  {ltvOutput.rebookingTiming.mediumUrgency}
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#7A746A" }}>
              {ltvOutput.rebookingTiming.action}
            </p>
          </div>
        ) : (
          <p className="text-sm leading-relaxed" style={{ color: "#7A746A" }}>
            Generate recommendations to see rebooking timing intelligence.
          </p>
        )}
      </Card>

      {/* Under-monetised */}
      <Card>
        <h2
          className="font-semibold mb-4 flex items-center gap-2"
          style={{ color: "#252421" }}
        >
          <TrendingUp className="w-5 h-5 text-[#8A4A4A]" /> Under-Monetised
          Categories
        </h2>
        {ltvOutput?.underMonetised.length ? (
          <div className="space-y-3">
            {ltvOutput.underMonetised.slice(0, 5).map((item) => (
              <div
                key={item.treatment}
                className="rounded-xl border border-[#EDE8E2] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-[#252421]">{item.treatment}</p>
                  <span className="text-sm font-semibold text-[#5A8A6A]">
                    {formatCurrency(item.potentialRevenue)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#7A746A]">{item.action}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-relaxed" style={{ color: "#7A746A" }}>
            Generate recommendations to see under-monetised category potential.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold mb-4" style={{ color: "#252421" }}>
          ROI Reporting History
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-14 rounded-xl bg-[rgba(90,138,106,0.08)] animate-pulse"
              />
            ))}
          </div>
        ) : ltvRuns.length ? (
          <div className="space-y-2">
            {ltvRuns.slice(0, 8).map((run) => (
              <div
                key={run.id}
                className="rounded-xl p-3 text-sm"
                style={{ border: "1px solid #EDE8E2" }}
              >
                <p className="font-medium" style={{ color: "#252421" }}>
                  {run.task}
                </p>
                <p className="text-xs" style={{ color: "#7A746A" }}>
                  {formatRunDate(run.createdAt)} | {run.status} |{" "}
                  {run.tokens.toLocaleString()} tokens
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm" style={{ color: "#7A746A" }}>
            No live ROI Reporting run history found.
          </div>
        )}
      </Card>
    </div>
  );
}
