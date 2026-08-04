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
import Link from "next/link";
import {
  AiGenerationProvenance,
  coerceAiRunProvenance,
  PageHeader,
  Card,
  StatCard,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  getAiModulePageAccess,
  loadOptionalPageResource,
} from "@/lib/ai-page-access";
import type {
  AiLtvOptimiserOutput,
  AiRunRecord,
  DashboardSummaryRecord,
  RevenueByTreatmentRecord,
} from "@/lib/api-types";
import {
  countOtherLtvFollowUps,
  isValidDateRange,
  isCurrentLtvRun,
  recentDateRange,
} from "@/lib/ai-module-truth";

const LTV_OPTIMISER_AGENT_KEY = "ltv_optimiser";

type CurrentLtvOutput = AiLtvOptimiserOutput & {
  recommendationSample: NonNullable<
    AiLtvOptimiserOutput["recommendationSample"]
  >;
  summary: AiLtvOptimiserOutput["summary"] & {
    averageRevenuePerSoldTreatment: number;
    rebookingCoverageRate: number;
  };
};

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

function isCurrentLtvOutput(value: unknown): value is CurrentLtvOutput {
  if (!isLtvOutput(value)) return false;
  return Boolean(
    value.recommendationSample?.recommendationsExcludeFutureBookings === true &&
      typeof value.summary.averageRevenuePerSoldTreatment === "number" &&
      typeof value.summary.rebookingCoverageRate === "number",
  );
}

function hasCurrentLtvSemantics(run: AiRunRecord) {
  return isCurrentLtvRun(run) && isCurrentLtvOutput(run.output);
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
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const defaultRange = useMemo(() => recentDateRange(90), []);
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [summary, setSummary] = useState<DashboardSummaryRecord | null>(null);
  const [treatmentRevenue, setTreatmentRevenue] =
    useState<RevenueByTreatmentRecord | null>(null);
  const [runs, setRuns] = useState<AiRunRecord[]>([]);
  const [isLiveDataLoading, setIsLiveDataLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [liveDataNotice, setLiveDataNotice] = useState<string | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const rangeIsValid = isValidDateRange(startDate, endDate);
  const access = getAiModulePageAccess(hasPermission, "appointments:read", {
    generationPermissions: ["reports:read"],
  });
  const generationPermissionMessage = !access.canReadSource
    ? "Scheduling read access is required to build contact rebooking recommendations."
    : !access.canReadHistory
      ? "Reports read access is required to load inputs and generate recommendations."
      : !access.canWriteReports
        ? "Reports write access is required to generate and save recommendations."
        : null;

  useEffect(() => {
    if (!token || !rangeIsValid) return;

    let cancelled = false;
    const authToken = token;

    async function loadLiveData() {
      queueMicrotask(() => {
        if (!cancelled) {
          setSummary(null);
          setTreatmentRevenue(null);
          setIsLiveDataLoading(access.canReadHistory);
        }
      });
      const [summaryResult, treatmentResult] = await Promise.all([
        loadOptionalPageResource(access.canReadHistory, () =>
          api.reports.dashboardSummary(authToken, { startDate, endDate }),
        ),
        loadOptionalPageResource(access.canReadHistory, () =>
          api.reports.revenueByTreatment(authToken, { startDate, endDate }),
        ),
      ]);
      if (cancelled) return;

      setSummary(
        summaryResult.status === "loaded" ? summaryResult.data : null,
      );
      setTreatmentRevenue(
        treatmentResult.status === "loaded" ? treatmentResult.data : null,
      );

      if (
        summaryResult.status === "skipped" ||
        treatmentResult.status === "skipped"
      ) {
        setLiveDataNotice(
          "Revenue cards and service reporting require Reports read access.",
        );
      } else if (
        summaryResult.status === "failed" ||
        treatmentResult.status === "failed"
      ) {
        if (summaryResult.status === "failed") {
          console.error(
            "Failed to load ROI dashboard summary",
            summaryResult.error,
          );
        }
        if (treatmentResult.status === "failed") {
          console.error(
            "Failed to load ROI service revenue",
            treatmentResult.error,
          );
        }
        setLiveDataNotice(
          summaryResult.status === "loaded" ||
            treatmentResult.status === "loaded"
            ? "Some live revenue data could not be loaded; the available report remains visible."
            : "Live revenue and service reporting could not be loaded.",
        );
      } else {
        setLiveDataNotice(null);
      }

      setIsLiveDataLoading(false);
    }

    void loadLiveData();

    return () => {
      cancelled = true;
    };
  }, [
    access.canReadHistory,
    endDate,
    rangeIsValid,
    startDate,
    token,
  ]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const authToken = token;

    async function loadHistory() {
      queueMicrotask(() => {
        if (!cancelled) {
          setRuns([]);
          setIsHistoryLoading(access.canReadHistory);
        }
      });
      const result = await loadOptionalPageResource(
        access.canReadHistory,
        () =>
          api.ai.listRuns(authToken, { agentKey: LTV_OPTIMISER_AGENT_KEY }),
      );
      if (cancelled) return;

      if (result.status === "loaded") {
        setRuns((current) => {
          const loadedIds = new Set(result.data.map((run) => run.id));
          return [
            ...current.filter((run) => !loadedIds.has(run.id)),
            ...result.data,
          ];
        });
        setHistoryNotice(null);
      } else if (result.status === "skipped") {
        setHistoryNotice(
          "Saved recommendation history requires Reports read access.",
        );
      } else {
        console.error("Failed to load ROI recommendation history", result.error);
        setHistoryNotice(
          "Saved recommendation history could not be loaded. Available live reporting is unaffected.",
        );
      }

      setIsHistoryLoading(false);
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [access.canReadHistory, token]);

  const treatmentRows = useMemo(() => {
    if (!treatmentRevenue?.byTreatment.length) return [];

    return treatmentRevenue.byTreatment.slice(0, 4).map((treatment, index) => ({
      name: treatment.treatment,
      soldTreatments: treatment.soldTreatments,
      averageRevenue: formatCurrency(treatment.averageRevenue),
      totalRevenue: formatCurrency(treatment.revenue),
      ticketLabel: treatment.isHighTicket ? "High ticket" : "Tracked",
      category: treatment.category || "Not recorded",
      color: index % 2 === 0 ? "text-[#315F5C]" : "text-[#9A5524]",
    }));
  }, [treatmentRevenue]);
  const ltvRuns = useMemo(
    () => runs.filter((run) => run.agentKey === LTV_OPTIMISER_AGENT_KEY),
    [runs],
  );
  const currentLtvRuns = useMemo(
    () => ltvRuns.filter(hasCurrentLtvSemantics),
    [ltvRuns],
  );
  const selectedRun =
    ltvRuns.find((run) => run.id === selectedRunId) ??
    currentLtvRuns[0] ??
    ltvRuns[0] ??
    null;
  const selectedRunIsCurrent = Boolean(
    selectedRun && hasCurrentLtvSemantics(selectedRun),
  );
  const ltvOutput =
    selectedRunIsCurrent &&
    selectedRun &&
    isCurrentLtvOutput(selectedRun.output)
    ? selectedRun.output
    : undefined;
  const otherFollowUpCount = ltvOutput
    ? countOtherLtvFollowUps(ltvOutput.patientRecommendations)
    : 0;
  const emptyRecommendationMessage =
    selectedRun && !selectedRunIsCurrent
      ? "This legacy or incomplete run is retained for audit history, but its recommendations are hidden because current v3 eligibility and future-booking semantics cannot be confirmed."
      : "Generate recommendations to see rules-based contact follow-up suggestions.";

  const handleGenerate = async () => {
    if (!token || !access.canGenerate || isGenerating) return;
    if (!rangeIsValid) {
      setStatusMessage({
        tone: "error",
        text: "Choose a valid start date on or before the end date.",
      });
      return;
    }

    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const generated = await api.ai.generateLtvOptimiser(token, {
        startDate,
        endDate,
      });
      setRuns((current) => [
        {
          id: generated.id,
          projectId: null,
          agentName: "Revenue & Rebooking Opportunities",
          agentKey: generated.agentKey,
          task: "Generated revenue and rebooking opportunities",
          input: generated.input,
          output: generated.output,
          status: generated.status,
          tokens: 0,
          createdAt: generated.createdAt,
        },
        ...current.filter((run) => run.id !== generated.id),
      ]);
      setSelectedRunId(generated.id);
      setStatusMessage({
        tone: "success",
        text: "Rules-based revenue and rebooking opportunities generated and saved to history.",
      });
    } catch (error) {
      console.error("Failed to generate LTV recommendations", error);
      setStatusMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to generate revenue and rebooking opportunities.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue & Rebooking Opportunities"
        subtitle="Review service revenue, open pipeline value and deterministic follow-up signals for internal account growth."
        icon={PoundSterling}
        iconColor="text-[#315F5C]"
        iconBg="bg-[rgba(96,180,175,0.1)]"
        right={
          <button
            type="button"
            onClick={handleGenerate}
            disabled={
              !token ||
              !access.canGenerate ||
              isGenerating ||
              !rangeIsValid
            }
            title={generationPermissionMessage || undefined}
            className="btn-primary disabled:opacity-50"
          >
            <Target className="w-4 h-4" />
            {isGenerating ? "Generating..." : "Generate Recommendations"}
          </button>
        }
      />

      {statusMessage && (
        <div
          className={[
            "rounded-2xl border px-4 py-3 text-sm",
            statusMessage.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700",
          ].join(" ")}
        >
          {statusMessage.text}
        </div>
      )}

      {generationPermissionMessage && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAF9F7] px-4 py-3 text-sm text-[#5E6E70]">
          {generationPermissionMessage}
        </div>
      )}

      {liveDataNotice && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {liveDataNotice}
        </div>
      )}

      {historyNotice && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {historyNotice}
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-semibold text-[#151F21]">Reporting range</h2>
            <p className="mt-1 text-sm text-[#5E6E70]">
              Live revenue cards and new recommendation runs use these dates.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm text-[#5E6E70]">
              Start date
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(event) => {
                  const nextStartDate = event.target.value;
                  setStartDate(nextStartDate);
                  setIsLiveDataLoading(
                    access.canReadHistory &&
                      isValidDateRange(nextStartDate, endDate),
                  );
                }}
                className="mt-1 min-h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-[#151F21]"
              />
            </label>
            <label className="text-sm text-[#5E6E70]">
              End date
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(event) => {
                  const nextEndDate = event.target.value;
                  setEndDate(nextEndDate);
                  setIsLiveDataLoading(
                    access.canReadHistory &&
                      isValidDateRange(startDate, nextEndDate),
                  );
                }}
                className="mt-1 min-h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-[#151F21]"
              />
            </label>
          </div>
        </div>
        {!rangeIsValid && (
          <p className="mt-3 text-sm text-red-700">
            Choose a valid start date on or before the end date.
          </p>
        )}
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Revenue / won item"
          value={
            treatmentRevenue?.totals.soldTreatments
              ? formatCurrency(
                  treatmentRevenue.totals.revenue /
                    treatmentRevenue.totals.soldTreatments,
                )
              : isLiveDataLoading
                ? "Loading"
                : "N/A"
          }
          change={summary ? "Range total divided by won items" : undefined}
          icon={PoundSterling}
          color="teal"
        />
        <StatCard
          label="Active plans"
          value={
            summary
              ? summary.cards.activeTreatmentPlans.toLocaleString()
              : isLiveDataLoading
                ? "Loading"
                : "N/A"
          }
          change={summary ? "Current live count" : undefined}
          icon={Repeat}
          color="blue"
        />
        <StatCard
          label="Tracked services"
          value={
            treatmentRevenue
              ? treatmentRevenue.byTreatment.length.toLocaleString()
              : isLiveDataLoading
                ? "Loading"
                : "N/A"
          }
          sub={treatmentRevenue ? "Types with revenue in range" : undefined}
          icon={ShoppingBag}
          color="violet"
        />
        <StatCard
          label="Open pipeline value"
          value={
            summary
              ? formatCurrency(summary.financials.openDealValue)
              : isLiveDataLoading
                ? "Loading"
                : "N/A"
          }
          sub={summary ? "Open deal value" : undefined}
          icon={Target}
          color="rose"
        />
      </div>

      {selectedRun && ltvOutput && (
        <Card>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5E6E70]">
                Selected recommendation run
              </p>
              <p className="mt-1 font-semibold text-[#151F21]">
                {formatRunDate(selectedRun.createdAt)}
              </p>
            </div>
            <AiGenerationProvenance
              provenance={coerceAiRunProvenance(selectedRun)}
              generatedAt={selectedRun.createdAt}
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#E5E7EB] bg-[#FAF9F7] p-3">
              <p className="text-xs text-[#5E6E70]">
                Revenue per won item
              </p>
              <p className="mt-1 text-lg font-semibold text-[#151F21]">
                {formatCurrency(
                  ltvOutput.summary.averageRevenuePerSoldTreatment,
                )}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5E7EB] bg-[#FAF9F7] p-3">
              <p className="text-xs text-[#5E6E70]">
                Rebooking coverage proxy
              </p>
              <p className="mt-1 text-lg font-semibold text-[#151F21]">
                {Math.round(ltvOutput.summary.rebookingCoverageRate)}
                %
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[#5E6E70]">
            This run reports revenue per won item and rebooking coverage
            proxies. Rebooking coverage is calculated from{" "}
            {`${ltvOutput.recommendationSample.completedActivityContacts} completed-activity contact${ltvOutput.recommendationSample.completedActivityContacts === 1 ? "" : "s"} within a ${ltvOutput.recommendationSample.sampledContacts}-contact eligible sample`}
            , not the full contact population. Contacts with a
            future booking remain in the coverage calculation but are excluded
            from follow-up recommendations.
          </p>
        </Card>
      )}

      {selectedRun && !selectedRunIsCurrent && (
        <Card>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-800">
              Legacy or incomplete calculation retained for history
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-700">
              This run does not carry the complete v3 eligibility,
              future-booking exclusion, and coverage fields. Its coverage
              proxy, timing counts, contact recommendations, and modelled
              opportunities are hidden so they are not mistaken for a current
              result. Generate a new run to use the current definitions.
            </p>
          </div>
        </Card>
      )}

      {/* Service revenue */}
      <Card>
        <h2
          className="font-semibold mb-4 flex items-center gap-2"
          style={{ color: "#151F21" }}
        >
          <Users className="w-5 h-5 text-[#315F5C]" /> Revenue by tracked
          service
        </h2>
        {isLiveDataLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-32 rounded-xl bg-[rgba(96,180,175,0.08)] animate-pulse"
              />
            ))}
          </div>
        ) : treatmentRows.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {treatmentRows.map((row) => (
            <div
              key={row.name}
              className="p-4 rounded-xl"
              style={{
                backgroundColor: "#FAF9F7",
                border: "1px solid #E5E7EB",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium" style={{ color: "#151F21" }}>
                  {row.name}
                </span>
                <span
                  className="text-xs font-medium text-[#315F5C]"
                >
                  {row.ticketLabel}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs" style={{ color: "#5E6E70" }}>
                    Won items
                  </p>
                  <p className="font-semibold" style={{ color: "#151F21" }}>
                    {row.soldTreatments}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "#5E6E70" }}>
                    Avg revenue
                  </p>
                  <p className="font-semibold" style={{ color: "#151F21" }}>
                    {row.averageRevenue}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "#5E6E70" }}>
                    Total revenue
                  </p>
                  <p className={`font-semibold ${row.color}`}>
                    {row.totalRevenue}
                  </p>
                </div>
              </div>
              <p className="text-xs mt-2" style={{ color: "#5E6E70" }}>
                Service category: {row.category}
              </p>
            </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm" style={{ color: "#5E6E70" }}>
            No service revenue rows were found for this reporting range.
          </div>
        )}
      </Card>

      {/* Contact follow-up */}
      <Card>
        <h2
          className="font-semibold mb-4 flex items-center gap-2"
          style={{ color: "#151F21" }}
        >
          <ArrowUpRight className="w-5 h-5 text-[#4A9A95]" /> Contact
          follow-up suggestions
        </h2>
        {ltvOutput?.patientRecommendations.length ? (
          <div className="space-y-3">
            {ltvOutput.patientRecommendations
              .slice(0, 5)
              .map((item) => (
                <div
                  key={`${item.contactId}-${item.treatment}`}
                  className="rounded-xl border border-[#E5E7EB] p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/app/crm/contacts/detail?id=${encodeURIComponent(item.contactId)}`}
                      className="font-medium text-[#151F21] hover:underline"
                    >
                      {item.contactName}
                    </Link>
                    <span className="text-xs font-medium text-[#9A5524]">
                      {item.recommendationType === "rebooking"
                        ? "Rebooking proxy"
                        : "Service follow-up proxy"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#5E6E70]">
                    {item.recommendedAction}
                  </p>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm leading-relaxed" style={{ color: "#5E6E70" }}>
            {emptyRecommendationMessage}
          </p>
        )}
      </Card>

      {/* Rebooking Timing */}
      <Card>
        <h2
          className="font-semibold mb-4 flex items-center gap-2"
          style={{ color: "#151F21" }}
        >
          <Calendar className="w-5 h-5 text-[#9A5524]" /> Rebooking coverage
          proxy
        </h2>
        {ltvOutput ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#E5E7EB] p-3">
                <p className="text-xs text-[#5E6E70]">
                  No upcoming booking
                </p>
                <p className="text-2xl font-semibold text-[#151F21]">
                  {ltvOutput.rebookingTiming.highUrgency}
                </p>
              </div>
              <div className="rounded-xl border border-[#E5E7EB] p-3">
                <p className="text-xs text-[#5E6E70]">
                  Other follow-up
                </p>
                <p className="text-2xl font-semibold text-[#151F21]">
                  {otherFollowUpCount}
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#5E6E70" }}>
              {ltvOutput.rebookingTiming.action}
            </p>
          </div>
        ) : (
          <p className="text-sm leading-relaxed" style={{ color: "#5E6E70" }}>
            {selectedRun && !selectedRunIsCurrent
              ? "This legacy or incomplete run's timing counts are hidden because current v3 future-booking rules cannot be confirmed."
              : "Generate recommendations to see the deterministic rebooking coverage proxy."}
          </p>
        )}
      </Card>

      {/* Modelled service opportunity */}
      <Card>
        <h2
          className="font-semibold mb-4 flex items-center gap-2"
          style={{ color: "#151F21" }}
        >
          <TrendingUp className="w-5 h-5 text-[#B42318]" /> Modelled service opportunity
          opportunities
        </h2>
        {ltvOutput?.underMonetised.length ? (
          <div className="space-y-3">
            {ltvOutput.underMonetised.slice(0, 5).map((item) => (
              <div
                key={item.treatment}
                className="rounded-xl border border-[#E5E7EB] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-[#151F21]">{item.treatment}</p>
                  <span className="text-sm font-semibold text-[#315F5C]">
                    {formatCurrency(item.potentialRevenue)} modelled proxy
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#5E6E70]">{item.action}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-relaxed" style={{ color: "#5E6E70" }}>
            {selectedRun && !selectedRunIsCurrent
              ? "This legacy or incomplete run's opportunity values are hidden because compatibility with the current v3 calculation cannot be confirmed."
              : "Generate recommendations to see heuristic service opportunity values. These are not measured lifetime value or guaranteed revenue."}
          </p>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold mb-4" style={{ color: "#151F21" }}>
          Revenue & Rebooking History
        </h2>
        {isHistoryLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-14 rounded-xl bg-[rgba(96,180,175,0.08)] animate-pulse"
              />
            ))}
          </div>
        ) : ltvRuns.length ? (
          <div className="space-y-2">
            {ltvRuns.slice(0, 8).map((run) => {
              return (
                <button
                  type="button"
                  onClick={() => setSelectedRunId(run.id)}
                  key={run.id}
                  className={[
                    "w-full rounded-xl border p-3 text-left text-sm",
                    run.id === selectedRun?.id
                      ? "border-[rgba(96,180,175,0.45)] bg-[rgba(96,180,175,0.08)]"
                      : "border-[#E5E7EB]",
                  ].join(" ")}
                >
                  <p className="font-medium" style={{ color: "#151F21" }}>
                    {run.task}
                  </p>
                  <p className="text-xs" style={{ color: "#5E6E70" }}>
                    {formatRunDate(run.createdAt)} | {run.status} |{" "}
                    {run.tokens.toLocaleString()} tokens
                  </p>
                  <p
                    className={[
                      "mt-1 text-xs font-medium",
                      hasCurrentLtvSemantics(run)
                        ? "text-[#315F5C]"
                        : "text-amber-700",
                    ].join(" ")}
                  >
                    {hasCurrentLtvSemantics(run)
                      ? "Current v3 calculation"
                      : "Legacy/incomplete calculation · details hidden"}
                  </p>
                  <div className="mt-2">
                    <AiGenerationProvenance
                      compact
                      provenance={coerceAiRunProvenance(run)}
                      generatedAt={run.createdAt}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-sm" style={{ color: "#5E6E70" }}>
            {access.canReadHistory
              ? "No saved revenue and rebooking runs found."
              : "Recommendation history is unavailable without Reports read access."}
          </div>
        )}
      </Card>
    </div>
  );
}
