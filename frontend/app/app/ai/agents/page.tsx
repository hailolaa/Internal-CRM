"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Brain,
  MessageSquare,
  BarChart3,
  CircleHelp,
  PoundSterling,
  Newspaper,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { AiRunRecord } from "@/lib/api-types";
import {
  AiGenerationProvenance,
  coerceAiRunProvenance,
} from "@/components/ui";

const insights = [
  {
    key: "growth-brief",
    agentKey: "growth_brief",
    name: "Weekly Growth Brief",
    description:
      "Generate an OpenAI-written brief from Mission Control reporting metrics for a chosen date range.",
    method: "OpenAI required",
    action: "Generates a saved brief",
    requiredPermissions: ["reports:read", "reports:write"],
    outcome: "Reporting summary, risks, opportunities, and recommendations",
    icon: Newspaper,
    href: "/app/ai/growth-brief",
  },
  {
    key: "campaign-analyst",
    agentKey: "campaign_analyst",
    name: "Campaign Analysis",
    description:
      "Analyse complete manual inputs or tracked Google and Meta campaign rows.",
    method: "OpenAI optional · rules fallback",
    action: "Generates a saved analysis",
    requiredPermissions: ["marketing:read", "reports:read", "reports:write"],
    outcome:
      "Attribution gaps, budget tests, and clearly labelled modelled uplift",
    icon: Brain,
    href: "/app/ai/campaign-analyst",
  },
  {
    key: "sales-assistant",
    agentKey: "sales_assistant",
    name: "Sales Assistant",
    description:
      "Create copy-ready follow-up suggestions for a selected CRM contact.",
    method: "Rules-based",
    action: "Copy only · no direct send",
    requiredPermissions: ["contacts:read", "reports:write"],
    outcome:
      "Readiness heuristic, reasons, and contact-linked SMS or email copy",
    icon: MessageSquare,
    href: "/app/ai/sales-assistant",
  },
  {
    key: "show-rate",
    agentKey: "show_rate",
    name: "Call & Meeting Risk",
    description:
      "Apply rules-based scoring to scheduled calls or meetings and open supported follow-up actions.",
    method: "Rules-based",
    action: "Deposits supported · reminders unavailable",
    requiredPermissions: ["appointments:read", "reports:write"],
    outcome: "Follow-up priority signals, reasons, and next-step prompts",
    icon: BarChart3,
    href: "/app/ai/show-rate",
  },
  {
    key: "ltv-optimiser",
    agentKey: "ltv_optimiser",
    name: "Revenue & Rebooking Opportunities",
    description:
      "Review service revenue, rebooking coverage and deterministic follow-up suggestions.",
    method: "Rules-based",
    action: "Generates a saved opportunity list",
    requiredPermissions: ["appointments:read", "reports:read", "reports:write"],
    outcome: "Revenue per won item, pipeline value and follow-up proxies",
    icon: PoundSterling,
    href: "/app/ai/ltv-optimiser",
  },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AIGrowthInsightsPage() {
  const { hasPermission, session } = useAuth();
  const [runs, setRuns] = useState<AiRunRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const token = session?.token;
  const canReadHistory = hasPermission("reports:read");

  useEffect(() => {
    if (!token || !canReadHistory) return;

    let cancelled = false;

    async function loadAiWorkspace() {
      setIsLoading(true);
      try {
        const runRows = await api.ai.listRuns(token!);

        if (!cancelled) {
          setRuns(runRows);
          setStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load AI workspace", error);
        if (!cancelled) {
          setStatusMessage({
            tone: "error",
            text: "Analysis run history could not be loaded.",
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadAiWorkspace();

    return () => {
      cancelled = true;
    };
  }, [canReadHistory, token]);

  const recentRuns = useMemo(() => runs.slice(0, 5), [runs]);

  const handleDeleteRun = async (run: AiRunRecord) => {
    if (!token || !hasPermission("reports:write") || deletingRunId) return;
    if (
      !window.confirm(
        `Delete "${run.task}" from run history and redact its saved input and output?`,
      )
    ) {
      return;
    }

    setDeletingRunId(run.id);
    setStatusMessage(null);
    try {
      await api.ai.deleteRun(token, run.id);
      setRuns((current) => current.filter((item) => item.id !== run.id));
      setStatusMessage({
        tone: "success",
        text: "Run removed from history and its saved content was redacted.",
      });
    } catch (error) {
      setStatusMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "The saved run could not be deleted.",
      });
    } finally {
      setDeletingRunId(null);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1
          className="text-2xl md:text-3xl font-bold"
          style={{ color: "#151F21", letterSpacing: "-0.03em" }}
        >
          Growth Intelligence
        </h1>
        <p className="mt-2" style={{ color: "#5E6E70" }}>
          Choose a module by its real method and supported action. Every saved
          output below comes from this workspace&apos;s backend run history.
        </p>
      </div>

      {statusMessage && (
        <div
          className={[
            "rounded-2xl border px-4 py-3 text-sm",
            statusMessage.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : statusMessage.tone === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-amber-200 bg-amber-50 text-amber-700",
          ].join(" ")}
        >
          {statusMessage.text}
        </div>
      )}

      <div
        className="rounded-2xl p-5 md:p-8"
        style={{
          background:
            "linear-gradient(135deg, rgba(96,180,175, 0.08) 0%, rgba(212,145,78, 0.08) 100%)",
          border: "1px solid rgba(96,180,175, 0.2)",
        }}
      >
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: "rgba(96,180,175, 0.1)",
              border: "1px solid rgba(96,180,175, 0.2)",
            }}
          >
            <Brain className="w-8 h-8 text-[#4A9A95]" />
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-xl font-bold mb-1" style={{ color: "#151F21" }}>
              Built on ClinicGrower&apos;s growth methodology
            </h2>
            <p className="text-sm" style={{ color: "#5E6E70" }}>
              Some modules call OpenAI; others apply fixed Mission Control rules. Each
              card states which method it uses and what the page can actually
              do before you open it.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {insights.map((insight) => {
          const Icon = insight.icon;
          const latestRun = runs.find(
            (run) => run.agentKey === insight.agentKey,
          );
          const isAvailable = insight.requiredPermissions.every((permission) =>
            hasPermission(permission),
          );
          return (
            <div
              key={insight.key}
              className="relative overflow-hidden rounded-2xl p-5 md:p-6 transition-all hover:scale-[1.01]"
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E7EB",
                boxShadow: "0 2px 12px rgba(21, 31, 33, 0.05)",
              }}
            >
              <div className="flex items-start gap-4 mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: "rgba(96,180,175, 0.1)",
                    border: "1px solid rgba(96,180,175, 0.2)",
                  }}
                >
                  <Icon className="w-6 h-6 text-[#4A9A95]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3
                      className="font-bold text-lg"
                      style={{ color: "#151F21" }}
                    >
                      {insight.name}
                    </h3>
                    <span
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: isAvailable
                          ? "rgba(96,180,175, 0.1)"
                          : "#FAF9F7",
                        color: isAvailable ? "#315F5C" : "#5E6E70",
                        border: isAvailable
                          ? "1px solid rgba(96,180,175,0.2)"
                          : "1px solid #E5E7EB",
                      }}
                    >
                      {isAvailable ? (
                        <BadgeCheck className="h-3 w-3" />
                      ) : (
                        <CircleHelp className="h-3 w-3" />
                      )}
                      {isAvailable ? "Accessible" : "Permission required"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "#5E6E70" }}>
                    {!canReadHistory
                      ? "Run history unavailable for this role"
                      : latestRun
                        ? `Last run ${formatDate(latestRun.createdAt)}`
                        : "No saved run yet"}
                  </p>
                </div>
              </div>

              <p className="text-sm mb-4" style={{ color: "#5E6E70" }}>
                {insight.description}
              </p>

              <div className="mb-5 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#E5E7EB] bg-[#FAF9F7] px-2.5 py-1 text-xs font-semibold text-[#5E6E70]">
                    {insight.method}
                  </span>
                  <span className="rounded-full border border-[rgba(96,180,175,0.2)] bg-[rgba(96,180,175,0.08)] px-2.5 py-1 text-xs font-semibold text-[#315F5C]">
                    {insight.action}
                  </span>
                </div>
                <p
                  className="text-xs uppercase tracking-wider mb-1"
                  style={{ color: "#5E6E70" }}
                >
                  What you get
                </p>
                <p className="text-sm" style={{ color: "#151F21" }}>
                  {insight.outcome}
                </p>
              </div>

              <Link
                href={insight.href}
                className="w-full font-medium py-2.5 md:py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-sm md:text-base"
                style={{ backgroundColor: "#151F21", color: "#FFFFFF" }}
              >
                Open <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          );
        })}
      </div>

      <div
        className="rounded-2xl p-5 md:p-6"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E5E7EB",
          boxShadow: "0 2px 12px rgba(21, 31, 33, 0.05)",
        }}
      >
        <h2 className="font-bold mb-4" style={{ color: "#151F21" }}>
          Recent analysis runs
        </h2>
        <div className="space-y-3">
          {!canReadHistory ? (
            <p className="text-sm" style={{ color: "#5E6E70" }}>
              Run history is hidden because this role does not have Reports
              read access.
            </p>
          ) : isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-xl bg-[rgba(96,180,175,0.08)]"
              />
            ))
          ) : recentRuns.length ? (
            recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl p-3"
                style={{ backgroundColor: "#FAF9F7" }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: "#151F21" }}>
                    {run.agentName}
                  </p>
                  <p className="text-xs" style={{ color: "#5E6E70" }}>
                    {run.task}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div
                    className="text-xs text-right"
                    style={{ color: "#5E6E70" }}
                  >
                    <p>{run.status}</p>
                    <p>{formatDate(run.createdAt)}</p>
                  </div>
                  {hasPermission("reports:write") && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteRun(run)}
                      disabled={deletingRunId === run.id}
                      aria-label={`Delete run: ${run.task}`}
                      title="Delete this run and redact its saved content"
                      className="rounded-lg border border-[#E5E7EB] bg-white p-2 text-[#5E6E70] hover:text-[#B42318] disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="basis-full">
                  <AiGenerationProvenance
                    compact
                    provenance={coerceAiRunProvenance(run)}
                    generatedAt={run.createdAt}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm" style={{ color: "#5E6E70" }}>
              No saved analysis runs were returned for this workspace.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
