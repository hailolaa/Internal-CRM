"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Newspaper,
  Calendar,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  Lightbulb,
  Target,
} from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { FilterTabs } from "@/components/ui/forms";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { AiRunRecord } from "@/lib/api-types";

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
  provenance?: {
    provider?: string;
    model?: string;
    source?: string;
    mockData?: boolean;
    dataContract?: string;
  };
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
    iconColor: "text-[#A07840]",
    bg: "bg-[#FFFBEB]",
    borderLeft: "border-l-[#A07840]",
    label: "Insight",
    labelBg: "bg-[#FFFBEB]",
    labelText: "text-[#A07840]",
  },
  risk: {
    icon: AlertTriangle,
    iconColor: "text-[#8A4A4A]",
    bg: "bg-[#FEF2F2]",
    borderLeft: "border-l-[#8A4A4A]",
    label: "Risk",
    labelBg: "bg-[#FEF2F2]",
    labelText: "text-[#8A4A4A]",
  },
  opportunity: {
    icon: Target,
    iconColor: "text-[#7D8F7A]",
    bg: "bg-[rgba(125,143,122,0.06)]",
    borderLeft: "border-l-[#7D8F7A]",
    label: "Opportunity",
    labelBg: "bg-[rgba(125,143,122,0.08)]",
    labelText: "text-[#7D8F7A]",
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
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
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

  return [
    {
      label: "Leads",
      value: formatNumber(metricNumber(cards.leads)),
      detail: "Clinic-scoped",
    },
    {
      label: "Booked consults",
      value: formatNumber(metricNumber(cards.bookedConsults)),
      detail: "Backend report",
    },
    {
      label: "Sold treatments",
      value: formatNumber(metricNumber(cards.soldTreatments)),
      detail: "Backend report",
    },
    {
      label: "Revenue",
      value: formatCurrency(metricNumber(financials.totalRevenue)),
      detail: "Live financials",
    },
    {
      label: "Ad spend",
      value: formatCurrency(metricNumber(financials.spend)),
      detail: "Tracked/manual",
    },
    {
      label: "Estimated risk",
      value: formatCurrency(estimatedRisk),
      detail: "Leakage model",
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

  return "border-[rgba(125,143,122,0.2)] bg-[rgba(125,143,122,0.06)] text-[#5F5A52]";
}

export default function AIGrowthBriefPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [activeFilter, setActiveFilter] = useState("all");
  const [runs, setRuns] = useState<AiRunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<PageStatus | null>(null);

  const loadGrowthBriefRuns = useCallback(async (authToken: string) => {
    const rows = await api.ai.listRuns(authToken, {
      agentKey: GROWTH_BRIEF_AGENT_KEY,
    });
    setRuns(rows);
    return rows;
  }, []);

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
      setIsHistoryLoading(true);
      try {
        const rows = await api.ai.listRuns(authToken, {
          agentKey: GROWTH_BRIEF_AGENT_KEY,
        });
        if (!cancelled) {
          setRuns(rows);
          setStatus(null);
        }
      } catch (error) {
        console.error("Failed to load growth brief run history", error);
        if (!cancelled) {
          setRuns([]);
          setStatus({
            tone: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unable to load Growth Brief history.",
          });
        }
      } finally {
        if (!cancelled) setIsHistoryLoading(false);
      }
    }

    loadRuns();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleRefreshBrief = async () => {
    if (!token || isGenerating) return;

    const authToken = token;
    setIsGenerating(true);
    setStatus({
      tone: "info",
      message: "Generating a live Growth Brief from backend clinic data...",
    });

    try {
      const generated = await api.ai.generateGrowthBrief(authToken);
      const rows = await loadGrowthBriefRuns(authToken);
      setSelectedRunId(generated.id || rows[0]?.id || null);
      setStatus({
        tone: "success",
        message: "Growth Brief generated successfully.",
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
        title="Weekly Growth Brief"
        subtitle="Generate a live clinic performance digest from backend AI runs."
        icon={Newspaper}
        iconColor="text-[#7D8F7A]"
        right={
          <button
            type="button"
            onClick={handleRefreshBrief}
            disabled={!token || isGenerating}
            aria-label="Generate growth brief"
            className="btn-secondary text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`}
            />
            {isGenerating ? "Generating..." : "Refresh Brief"}
          </button>
        }
      />

      {status && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${statusClasses(
            status.tone,
          )}`}
        >
          {status.message}
        </div>
      )}

      {isHistoryLoading ? (
        <Card className="space-y-4">
          <div className="h-5 w-40 rounded bg-[rgba(125,143,122,0.08)] animate-pulse" />
          <div className="h-8 w-3/4 rounded bg-[rgba(125,143,122,0.08)] animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 rounded bg-[rgba(125,143,122,0.08)] animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-[rgba(125,143,122,0.08)] animate-pulse" />
          </div>
        </Card>
      ) : selectedOutput ? (
        <>
          <div
            className="rounded-2xl p-5 md:p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(125, 143, 122, 0.06) 0%, rgba(168, 181, 162, 0.08) 100%)",
              border: "1px solid rgba(125, 143, 122, 0.2)",
            }}
          >
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#7D8F7A]" />
                <span className="text-xs font-semibold text-[#7D8F7A]">
                  {getBriefPeriod(selectedOutput, selectedRun)}
                </span>
              </div>
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold capitalize text-[#5F5A52]">
                {selectedOutput.confidence} confidence
              </span>
            </div>
            <h2
              className="text-lg md:text-xl font-bold mb-3"
              style={{ color: "#252421" }}
            >
              Latest Growth Brief
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "#5F5A52" }}>
              {selectedOutput.summary}
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-2xl border border-[#EDE8E2] bg-[#FFFCF9] p-4"
              >
                <p className="text-xs font-medium text-[#7A746A]">
                  {kpi.label}
                </p>
                <p className="mt-1 text-lg font-semibold text-[#252421]">
                  {kpi.value}
                </p>
                <p className="mt-1 text-xs text-[#A8A39B]">{kpi.detail}</p>
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
                      backgroundColor: "#FFFCF9",
                      border: "1px solid #E5DED6",
                      boxShadow: "0 2px 8px rgba(37, 36, 33, 0.04)",
                    }}
                  >
                    <div
                      className={`border-l-4 ${cfg.borderLeft} rounded-2xl`}
                      style={{ backgroundColor: "#FFFCF9" }}
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
                                style={{ color: "#252421" }}
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
                              style={{ color: "#5F5A52" }}
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
                <p className="text-sm" style={{ color: "#7A746A" }}>
                  No items found for this Growth Brief filter.
                </p>
              </Card>
            )}
          </div>

          <Card>
            <h3 className="font-semibold mb-3" style={{ color: "#252421" }}>
              Evidence & Provenance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div
                className="rounded-xl border border-[#EDE8E2] p-3"
                style={{ backgroundColor: "#FAF8F5" }}
              >
                <p className="text-xs font-medium text-[#7A746A]">Data source</p>
                <p className="mt-1 text-[#252421]">
                  {selectedInput?.provenance?.source ||
                    selectedOutput.provenance?.source ||
                    "Backend AI run"}
                </p>
              </div>
              <div
                className="rounded-xl border border-[#EDE8E2] p-3"
                style={{ backgroundColor: "#FAF8F5" }}
              >
                <p className="text-xs font-medium text-[#7A746A]">Provider</p>
                <p className="mt-1 text-[#252421]">
                  {selectedOutput.provenance?.provider
                    ? `${selectedOutput.provenance.provider}${selectedOutput.provenance.model ? ` / ${selectedOutput.provenance.model}` : ""}`
                    : "Recorded backend run"}
                </p>
              </div>
              <div
                className="rounded-xl border border-[#EDE8E2] p-3"
                style={{ backgroundColor: "#FAF8F5" }}
              >
                <p className="text-xs font-medium text-[#7A746A]">Scope</p>
                <p className="mt-1 text-[#252421]">
                  {selectedInput?.provenance?.clinicScoped === false
                    ? "Scope unavailable"
                    : "Clinic-scoped"}
                </p>
              </div>
              <div
                className="rounded-xl border border-[#EDE8E2] p-3"
                style={{ backgroundColor: "#FAF8F5" }}
              >
                <p className="text-xs font-medium text-[#7A746A]">Mock data</p>
                <p className="mt-1 text-[#252421]">
                  {selectedInput?.provenance?.mockData ||
                  selectedOutput.provenance?.mockData
                    ? "Yes"
                    : "No"}
                </p>
              </div>
            </div>
            {selectedInput?.provenance?.includes?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedInput.provenance.includes.map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-[rgba(125,143,122,0.08)] px-2.5 py-1 text-xs font-medium text-[#5F5A52]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="mt-4 text-xs leading-relaxed text-[#7A746A]">
              Advisory output is generated from the saved backend AI run and
              should be reviewed before making operational or budget decisions.
            </p>
          </Card>
        </>
      ) : (
        <Card className="text-center py-10">
          <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-20 text-[#A8A39B]" />
          <h2 className="font-semibold mb-2" style={{ color: "#252421" }}>
            No live Growth Brief found
          </h2>
          <p className="mx-auto max-w-xl text-sm" style={{ color: "#7A746A" }}>
            Generate a brief to create a backend AI run, then it will appear
            here and in the history below.
          </p>
        </Card>
      )}

      {/* Previous briefs */}
      <Card>
        <h3
          className="font-semibold mb-4 flex items-center gap-2"
          style={{ color: "#252421" }}
        >
          <Calendar className="w-5 h-5 text-[#A8A39B]" /> Previous Briefs
        </h3>
        <div className="space-y-2">
          {isHistoryLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-16 rounded-xl bg-[rgba(125,143,122,0.08)] animate-pulse"
              />
            ))
          ) : runs.length ? (
            runs.map((run) => (
              <button
                key={run.id}
                onClick={() => setSelectedRunId(run.id)}
                aria-label={`View brief: ${getRunHeadline(run)}`}
                className="w-full flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer group text-left hover:bg-[#F7F5F2]"
                style={{ border: "1px solid #EDE8E2" }}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: "#252421" }}
                  >
                    {getRunHeadline(run)}
                  </p>
                  <p className="text-xs" style={{ color: "#7A746A" }}>
                    {formatRunDate(run.createdAt)} | {run.status} |{" "}
                    {run.tokens.toLocaleString()} tokens
                  </p>
                </div>
                <ChevronRight
                  className="w-4 h-4 flex-shrink-0 transition-colors"
                  style={{ color: "#A8A39B" }}
                />
              </button>
            ))
          ) : (
            <div
              className="rounded-xl p-4 text-sm text-center"
              style={{ border: "1px solid #EDE8E2", color: "#7A746A" }}
            >
              No live Growth Brief run history found.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
