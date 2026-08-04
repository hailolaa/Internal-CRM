"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Newspaper,
  Calendar,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  Lightbulb,
  Target,
} from "lucide-react";
import {
  AiGenerationProvenance,
  coerceAiRunProvenance,
  PageHeader,
  Card,
} from "@/components/ui";
import { FilterTabs } from "@/components/ui/forms";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  getAiModulePageAccess,
  loadOptionalPageResource,
} from "@/lib/ai-page-access";
import type {
  AiGenerationProvenance as AiGenerationProvenanceRecord,
  AiRunRecord,
} from "@/lib/api-types";
import {
  isValidDateRange,
  recentDateRange,
} from "@/lib/ai-module-truth";

const GROWTH_BRIEF_AGENT_KEY = "growth_brief";

type StatusTone = "info" | "success" | "error";

interface PageStatus {
  tone: StatusTone;
  message: string;
}

interface GrowthBriefOutput {
  summary: string;
  recommendations: string[];
  risks: string[];
  opportunities: string[];
  confidence: "low" | "medium" | "high";
  generatedAt?: string;
  range?: {
    startDate?: string;
    endDate?: string;
  };
  provenance?: (AiGenerationProvenanceRecord & {
    source?: string;
    dataContract?: string;
  }) | null;
}

interface GrowthBriefInput {
  dataContract?: string;
  provenance?: {
    source?: string;
    clinicScoped?: boolean;
    mockData?: boolean;
    includes?: string[];
  };
  metrics?: {
    summary?: {
      cards?: {
        leads?: number;
        bookedConsults?: number;
        attendedConsults?: number;
        soldTreatments?: number;
      };
      financials?: {
        totalRevenue?: number;
        spend?: number;
        roas?: number;
        costPerLead?: number;
      };
    };
    leaks?: {
      totalEstimatedRisk?: number;
    };
  };
}

interface BriefItem {
  id: string;
  category: "insight" | "risk" | "opportunity";
  title: string;
  detail: string;
}

const CATEGORY_CONFIG: Record<
  BriefItem["category"],
  {
    icon: typeof Lightbulb;
    iconColor: string;
    bg: string;
    borderLeft: string;
    label: string;
    labelBg: string;
    labelText: string;
  }
> = {
  insight: {
    icon: Lightbulb,
    iconColor: "text-[#9A5524]",
    bg: "bg-[#FFFBEB]",
    borderLeft: "border-l-[#9A5524]",
    label: "Insight",
    labelBg: "bg-[#FFFBEB]",
    labelText: "text-[#9A5524]",
  },
  risk: {
    icon: AlertTriangle,
    iconColor: "text-[#B42318]",
    bg: "bg-[#FEF2F2]",
    borderLeft: "border-l-[#B42318]",
    label: "Risk",
    labelBg: "bg-[#FEF2F2]",
    labelText: "text-[#B42318]",
  },
  opportunity: {
    icon: Target,
    iconColor: "text-[#4A9A95]",
    bg: "bg-[rgba(96,180,175,0.06)]",
    borderLeft: "border-l-[#60B4AF]",
    label: "Opportunity",
    labelBg: "bg-[rgba(96,180,175,0.08)]",
    labelText: "text-[#151F21]",
  },
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isGrowthBriefOutput(value: unknown): value is GrowthBriefOutput {
  if (!value || typeof value !== "object") return false;

  const output = value as Partial<GrowthBriefOutput>;
  return (
    typeof output.summary === "string" &&
    isStringArray(output.recommendations) &&
    isStringArray(output.risks) &&
    isStringArray(output.opportunities) &&
    ["low", "medium", "high"].includes(String(output.confidence))
  );
}

function getGrowthBriefOutput(run?: AiRunRecord) {
  return run && isGrowthBriefOutput(run.output) ? run.output : null;
}

function getGrowthBriefInput(run?: AiRunRecord) {
  const input = run?.input;
  if (!input || typeof input !== "object") return null;

  return input as GrowthBriefInput;
}

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

function metricNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatRunDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateOnly(value?: string) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getBriefPeriod(output: GrowthBriefOutput | null, run?: AiRunRecord) {
  const startDate = formatDateOnly(output?.range?.startDate);
  const endDate = formatDateOnly(output?.range?.endDate);

  if (startDate && endDate) return `${startDate} to ${endDate}`;
  if (output?.generatedAt) return `Generated ${formatRunDate(output.generatedAt)}`;
  if (run?.createdAt) return `Generated ${formatRunDate(run.createdAt)}`;
  return "Live Growth Brief";
}

function getRunHeadline(run: AiRunRecord) {
  const output = getGrowthBriefOutput(run);
  if (output?.summary) return output.summary;

  return run.task;
}

function buildBriefItems(output: GrowthBriefOutput | null): BriefItem[] {
  if (!output) return [];

  return [
    ...output.recommendations.map((detail, index) => ({
      id: `recommendation-${index}`,
      category: "insight" as const,
      title: "Recommendation",
      detail,
    })),
    ...output.risks.map((detail, index) => ({
      id: `risk-${index}`,
      category: "risk" as const,
      title: "Risk",
      detail,
    })),
    ...output.opportunities.map((detail, index) => ({
      id: `opportunity-${index}`,
      category: "opportunity" as const,
      title: "Opportunity",
      detail,
    })),
  ];
}

function buildKpis(input: GrowthBriefInput | null) {
  const cards = input?.metrics?.summary?.cards || {};
  const financials = input?.metrics?.summary?.financials || {};
  const estimatedRisk = metricNumber(input?.metrics?.leaks?.totalEstimatedRisk);
  const numberValue = (value: unknown) => {
    const metric = metricNumber(value);
    return metric === null ? "Not recorded" : formatNumber(metric);
  };
  const currencyValue = (value: unknown) => {
    const metric = metricNumber(value);
    return metric === null ? "Not recorded" : formatCurrency(metric);
  };

  return [
    {
      label: "Leads",
      value: numberValue(cards.leads),
      detail: cards.leads === undefined ? "Unavailable in saved input" : "Saved report metric",
    },
    {
      label: "Booked consults",
      value: numberValue(cards.bookedConsults),
      detail:
        cards.bookedConsults === undefined
          ? "Unavailable in saved input"
          : "Saved report metric",
    },
    {
      label: "Won opportunities",
      value: numberValue(cards.soldTreatments),
      detail:
        cards.soldTreatments === undefined
          ? "Unavailable in saved input"
          : "Saved report metric",
    },
    {
      label: "Revenue",
      value: currencyValue(financials.totalRevenue),
      detail:
        financials.totalRevenue === undefined
          ? "Unavailable in saved input"
          : "Saved report metric",
    },
    {
      label: "Ad spend",
      value: currencyValue(financials.spend),
      detail:
        financials.spend === undefined
          ? "Unavailable in saved input"
          : "Saved report metric",
    },
    {
      label: "Estimated risk",
      value:
        estimatedRisk === null ? "Not recorded" : formatCurrency(estimatedRisk),
      detail:
        estimatedRisk === null
          ? "Unavailable in saved input"
          : "Estimated leakage metric",
    },
  ];
}

function statusClasses(tone: StatusTone) {
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (tone === "error") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-[rgba(96,180,175,0.2)] bg-[rgba(96,180,175,0.06)] text-[#5E6E70]";
}

export default function AIGrowthBriefPage() {
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const defaultRange = useMemo(() => recentDateRange(30), []);
  const [activeFilter, setActiveFilter] = useState("all");
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [runs, setRuns] = useState<AiRunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<PageStatus | null>(null);
  const rangeIsValid = isValidDateRange(startDate, endDate);
  const access = getAiModulePageAccess(hasPermission, "reports:read");
  const generationPermissionMessage = !access.canReadSource
    ? "Reports read access is required to build a brief from Mission Control reporting data."
    : !access.canWriteReports
      ? "Reports write access is required to generate and save a Growth Brief."
      : null;

  const visibleRuns = useMemo(() => (token ? runs : []), [runs, token]);
  const selectedRun = useMemo(() => {
    if (selectedRunId) {
      return (
        visibleRuns.find((run) => run.id === selectedRunId) || visibleRuns[0]
      );
    }

    return visibleRuns[0];
  }, [selectedRunId, visibleRuns]);

  const selectedOutput = getGrowthBriefOutput(selectedRun);
  const selectedInput = getGrowthBriefInput(selectedRun);
  const kpis = useMemo(() => buildKpis(selectedInput), [selectedInput]);
  const briefItems = useMemo(
    () => buildBriefItems(selectedOutput),
    [selectedOutput],
  );
  const filtered = briefItems.filter(
    (item) => activeFilter === "all" || item.category === activeFilter,
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const authToken = token;

    async function loadRuns() {
      queueMicrotask(() => {
        if (!cancelled) {
          setRuns([]);
          setIsHistoryLoading(access.canReadHistory);
        }
      });
      const result = await loadOptionalPageResource(
        access.canReadHistory,
        () =>
          api.ai.listRuns(authToken, {
            agentKey: GROWTH_BRIEF_AGENT_KEY,
          }),
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
          "Saved Growth Brief history requires Reports read access.",
        );
      } else {
        console.error("Failed to load growth brief run history", result.error);
        setHistoryNotice(
          "Saved Growth Brief history could not be loaded. This does not remove any existing runs.",
        );
      }

      setIsHistoryLoading(false);
    }

    void loadRuns();

    return () => {
      cancelled = true;
    };
  }, [access.canReadHistory, token]);

  const handleRefreshBrief = async () => {
    if (!token || !access.canGenerate || isGenerating) return;

    const authToken = token;
    setIsGenerating(true);
    setStatus({
      tone: "info",
      message: "Generating a live Growth Brief from Mission Control data...",
    });

    try {
      if (!rangeIsValid) {
        setStatus({
          tone: "error",
          message: "Choose a valid start date on or before the end date.",
        });
        return;
      }

      const generated = await api.ai.generateGrowthBrief(authToken, {
        startDate,
        endDate,
      });
      setRuns((current) => [
        {
          id: generated.id,
          projectId: null,
          agentName: "Weekly Growth Brief",
          agentKey: generated.agentKey,
          task: "Generated Mission Control Growth Brief",
          input: generated.input,
          output: generated.output,
          status: generated.status,
          tokens: 0,
          createdAt: generated.createdAt,
        },
        ...current.filter((run) => run.id !== generated.id),
      ]);
      setSelectedRunId(generated.id);
      setStatus({
        tone: "success",
        message: "OpenAI Growth Brief generated and saved successfully.",
      });
    } catch (error) {
      console.error("Failed to generate growth brief", error);
      setStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to generate Growth Brief.",
      });
    } finally {
      setIsGenerating(false);
      setIsHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Growth Brief"
        subtitle="Generate an OpenAI-written internal brief from Mission Control reporting data for a range you choose."
        icon={Newspaper}
        iconColor="text-[#4A9A95]"
        right={
          <button
            type="button"
            onClick={handleRefreshBrief}
            disabled={
              !token ||
              !access.canGenerate ||
              isGenerating ||
              !rangeIsValid
            }
            title={generationPermissionMessage || undefined}
            aria-label="Generate growth brief"
            className="btn-secondary text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`}
            />
            {isGenerating ? "Generating..." : "Generate Brief"}
          </button>
        }
      />

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-semibold text-[#151F21]">Reporting range</h2>
            <p className="mt-1 text-sm text-[#5E6E70]">
              The selected dates are saved with the run and define every metric
              sent to OpenAI.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm text-[#5E6E70]">
              Start date
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-[#151F21]"
              />
            </label>
            <label className="text-sm text-[#5E6E70]">
              End date
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-[#151F21]"
              />
            </label>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => {
                const range = recentDateRange(days);
                setStartDate(range.startDate);
                setEndDate(range.endDate);
              }}
              className="min-h-9 rounded-lg border border-[#E5E7EB] bg-[#FAF9F7] px-3 text-xs font-semibold text-[#5E6E70] hover:bg-white"
            >
              Last {days} days
            </button>
          ))}
        </div>
        {!rangeIsValid && (
          <p className="mt-3 text-sm text-red-700">
            Choose a valid start date on or before the end date.
          </p>
        )}
      </Card>

      {status && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${statusClasses(
            status.tone,
          )}`}
        >
          {status.message}
        </div>
      )}

      {generationPermissionMessage && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAF9F7] px-4 py-3 text-sm text-[#5E6E70]">
          {generationPermissionMessage}
        </div>
      )}

      {historyNotice && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {historyNotice}
        </div>
      )}

      {isHistoryLoading ? (
        <Card className="space-y-4">
          <div className="h-5 w-40 rounded bg-[rgba(96,180,175,0.08)] animate-pulse" />
          <div className="h-8 w-3/4 rounded bg-[rgba(96,180,175,0.08)] animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 rounded bg-[rgba(96,180,175,0.08)] animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-[rgba(96,180,175,0.08)] animate-pulse" />
          </div>
        </Card>
      ) : selectedOutput ? (
        <>
          <div
            className="rounded-2xl p-5 md:p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(96,180,175, 0.08) 0%, rgba(212,145,78, 0.08) 100%)",
              border: "1px solid rgba(96,180,175, 0.2)",
            }}
          >
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#4A9A95]" />
                <span className="text-xs font-semibold text-[#151F21]">
                  {getBriefPeriod(selectedOutput, selectedRun)}
                </span>
              </div>
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold capitalize text-[#5E6E70]">
                AI self-assessment: {selectedOutput.confidence}
              </span>
            </div>
            <h2
              className="text-lg md:text-xl font-bold mb-3"
              style={{ color: "#151F21" }}
            >
              Latest Growth Brief
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "#5E6E70" }}>
              {selectedOutput.summary}
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] p-4"
              >
                <p className="text-xs font-medium text-[#5E6E70]">
                  {kpi.label}
                </p>
                <p className="mt-1 text-lg font-semibold text-[#151F21]">
                  {kpi.value}
                </p>
                <p className="mt-1 text-xs text-[#5E6E70]">{kpi.detail}</p>
              </div>
            ))}
          </div>

          <FilterTabs
            tabs={["All", "Insight", "Risk", "Opportunity"]}
            active={activeFilter}
            onChange={setActiveFilter}
          />

          <div className="space-y-3">
            {filtered.length ? (
              filtered.map((item) => {
                const cfg = CATEGORY_CONFIG[item.category];
                const Icon = cfg.icon;
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border-l-4 ${cfg.borderLeft} overflow-hidden`}
                    style={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E5E7EB",
                      boxShadow: "0 2px 8px rgba(21, 31, 33, 0.04)",
                    }}
                  >
                    <div
                      className={`border-l-4 ${cfg.borderLeft} rounded-2xl`}
                      style={{ backgroundColor: "#FFFFFF" }}
                    >
                      <div className="p-5">
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}
                          >
                            <Icon className={`w-5 h-5 ${cfg.iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span
                                className="font-semibold text-sm"
                                style={{ color: "#151F21" }}
                              >
                                {item.title}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.labelBg} ${cfg.labelText}`}
                              >
                                {cfg.label}
                              </span>
                            </div>
                            <p
                              className="text-sm leading-relaxed"
                              style={{ color: "#5E6E70" }}
                            >
                              {item.detail}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <Card className="text-center py-8">
                <p className="text-sm" style={{ color: "#5E6E70" }}>
                  No items found for this Growth Brief filter.
                </p>
              </Card>
            )}
          </div>

          <Card>
            <h3 className="font-semibold mb-3" style={{ color: "#151F21" }}>
              Evidence & Provenance
            </h3>
            <AiGenerationProvenance
              provenance={coerceAiRunProvenance(selectedRun)}
              generatedAt={
                selectedOutput.generatedAt || selectedRun?.createdAt || null
              }
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div
                className="rounded-xl border border-[#E5E7EB] p-3"
                style={{ backgroundColor: "#FAF9F7" }}
              >
                <p className="text-xs font-medium text-[#5E6E70]">Data source</p>
                <p className="mt-1 text-[#151F21]">
                  {selectedInput?.provenance?.source ||
                    selectedOutput.provenance?.source ||
                    "Not recorded"}
                </p>
              </div>
              <div
                className="rounded-xl border border-[#E5E7EB] p-3"
                style={{ backgroundColor: "#FAF9F7" }}
              >
                <p className="text-xs font-medium text-[#5E6E70]">Scope</p>
                <p className="mt-1 text-[#151F21]">
                  {selectedInput?.provenance?.clinicScoped === true
                    ? "Workspace-scoped"
                    : selectedInput?.provenance?.clinicScoped === false
                      ? "Not workspace-scoped"
                      : "Not recorded"}
                </p>
              </div>
              <div
                className="rounded-xl border border-[#E5E7EB] p-3"
                style={{ backgroundColor: "#FAF9F7" }}
              >
                <p className="text-xs font-medium text-[#5E6E70]">Mock data</p>
                <p className="mt-1 text-[#151F21]">
                  {selectedInput?.provenance?.mockData === true ||
                  selectedOutput.provenance?.mockData === true
                    ? "Yes"
                    : selectedInput?.provenance?.mockData === false ||
                        selectedOutput.provenance?.mockData === false
                      ? "No"
                      : "Not recorded"}
                </p>
              </div>
            </div>
            {selectedInput?.provenance?.includes?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedInput.provenance.includes.map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-[rgba(96,180,175,0.08)] px-2.5 py-1 text-xs font-medium text-[#5E6E70]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="mt-4 text-xs leading-relaxed text-[#5E6E70]">
              This advisory output is generated by OpenAI from the saved input
              snapshot. Review it against the underlying reports before making
              operational or budget decisions.
            </p>
          </Card>
        </>
      ) : (
        <Card className="text-center py-10">
          <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-20 text-[#8A9A9C]" />
          <h2 className="font-semibold mb-2" style={{ color: "#151F21" }}>
            No live Growth Brief found
          </h2>
          <p className="mx-auto max-w-xl text-sm" style={{ color: "#5E6E70" }}>
            {access.canGenerate
              ? "Generate a brief to create a saved OpenAI run, then it will appear here and in the history below."
              : "No Growth Brief is available with the current report permissions."}
          </p>
        </Card>
      )}

      {/* Previous briefs */}
      <Card>
        <h3
          className="font-semibold mb-4 flex items-center gap-2"
          style={{ color: "#151F21" }}
        >
          <Calendar className="w-5 h-5 text-[#8A9A9C]" /> Previous Briefs
        </h3>
        <div className="space-y-2">
          {isHistoryLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-16 rounded-xl bg-[rgba(96,180,175,0.08)] animate-pulse"
              />
            ))
          ) : runs.length ? (
            runs.map((run) => (
              <button
                key={run.id}
                onClick={() => setSelectedRunId(run.id)}
                aria-label={`View brief: ${getRunHeadline(run)}`}
                className="w-full flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer group text-left hover:bg-[#FAF9F7]"
                style={{ border: "1px solid #E5E7EB" }}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: "#151F21" }}
                  >
                    {getRunHeadline(run)}
                  </p>
                  <p className="text-xs" style={{ color: "#5E6E70" }}>
                    {formatRunDate(run.createdAt)} | {run.status} |{" "}
                    {run.tokens.toLocaleString()} tokens
                  </p>
                </div>
                <ChevronRight
                  className="w-4 h-4 flex-shrink-0 transition-colors"
                  style={{ color: "#8A9A9C" }}
                />
              </button>
            ))
          ) : (
            <div
              className="rounded-xl p-4 text-sm text-center"
              style={{ border: "1px solid #E5E7EB", color: "#5E6E70" }}
            >
              {access.canReadHistory
                ? "No live Growth Brief run history found."
                : "Growth Brief history is unavailable without Reports read access."}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
