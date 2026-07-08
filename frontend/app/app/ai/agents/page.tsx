"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  MessageSquare,
  BarChart3,
  PoundSterling,
  Newspaper,
} from "lucide-react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { AiProjectRecord, AiRunRecord } from "@/lib/api-types";

const insights = [
  {
    key: "growth-brief",
    name: "Weekly Growth Brief",
    description:
      "Your weekly performance digest — wins, risks, insights, and revenue opportunities surfaced automatically.",
    outcome: "Revenue trends, campaign performance, missed opportunities",
    icon: Newspaper,
    href: "/app/ai/growth-brief",
  },
  {
    key: "campaign-analyst",
    name: "Campaign Analysis",
    description:
      "Input your ad spend and revenue data. Get actionable recommendations on where to scale and where to cut.",
    outcome:
      "Budget shift recommendations, underperforming campaigns, projected uplift",
    icon: Brain,
    href: "/app/ai/campaign-analyst",
  },
  {
    key: "sales-assistant",
    name: "Conversion Tracking",
    description:
      "Follow-up strategies, cold lead flags, and conversion predictions for your active pipeline.",
    outcome:
      "Personalised follow-up messages, cold lead alerts, booking probability",
    icon: MessageSquare,
    href: "/app/ai/sales-assistant",
  },
  {
    key: "show-rate",
    name: "Missed Opportunity Tracking",
    description:
      "Predict no-shows before they happen. Trigger reminders and enforce deposit policies automatically.",
    outcome: "No-show predictions, reminder sequences, deposit enforcement",
    icon: BarChart3,
    href: "/app/ai/show-rate",
  },
  {
    key: "ltv-optimiser",
    name: "ROI Reporting",
    description:
      "High-value patient segments, rebooking timing gaps, cross-sell opportunities, and under-monetised categories.",
    outcome: "LTV analysis, rebooking gaps, cross-sell revenue opportunities",
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
  const { session } = useAuth();
  const [projects, setProjects] = useState<AiProjectRecord[]>([]);
  const [runs, setRuns] = useState<AiRunRecord[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadAiWorkspace() {
      try {
        const [projectRows, runRows] = await Promise.all([
          api.ai.listProjects(session!.token),
          api.ai.listRuns(session!.token),
        ]);

        if (!cancelled) {
          setProjects(projectRows);
          setRuns(runRows);
          setStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load AI workspace", error);
        if (!cancelled) {
          setStatusMessage("AI workspace history could not be loaded.");
        }
      }
    }

    loadAiWorkspace();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const projectByType = useMemo(() => {
    const lookup = new Map<string, AiProjectRecord>();
    projects.forEach((project) => lookup.set(project.type, project));
    return lookup;
  }, [projects]);

  const recentRuns = runs.slice(0, 5);

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1
          className="text-2xl md:text-3xl font-bold"
          style={{ color: "#252421", letterSpacing: "-0.03em" }}
        >
          AI Growth Insights
        </h1>
        <p className="mt-2" style={{ color: "#7A746A" }}>
          The Growth Group&apos;s intelligence layer — surfacing revenue opportunities,
          campaign gaps, and growth signals across your clinic.
        </p>
      </div>

      {statusMessage && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      <div
        className="rounded-2xl p-5 md:p-8"
        style={{
          background:
            "linear-gradient(135deg, rgba(125, 143, 122, 0.06) 0%, rgba(168, 181, 162, 0.08) 100%)",
          border: "1px solid rgba(125, 143, 122, 0.2)",
        }}
      >
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: "rgba(125, 143, 122, 0.1)",
              border: "1px solid rgba(125, 143, 122, 0.2)",
            }}
          >
            <Brain className="w-8 h-8 text-[#7D8F7A]" />
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-xl font-bold mb-1" style={{ color: "#252421" }}>
              Built on The Growth Group&apos;s growth methodology
            </h2>
            <p className="text-sm" style={{ color: "#7A746A" }}>
              Each module surfaces specific insights — missed leads, slow
              response times, conversion bottlenecks, and revenue opportunities.
              This is your clinic&apos;s intelligence layer, not a DIY toolkit.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {insights.map((insight) => {
          const Icon = insight.icon;
          const project = projectByType.get(insight.key);
          return (
            <div
              key={insight.key}
              className="relative overflow-hidden rounded-2xl p-5 md:p-6 transition-all hover:scale-[1.01]"
              style={{
                backgroundColor: "#FFFCF9",
                border: "1px solid #E5DED6",
                boxShadow: "0 2px 12px rgba(37, 36, 33, 0.05)",
              }}
            >
              <div className="flex items-start gap-4 mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: "rgba(125, 143, 122, 0.1)",
                    border: "1px solid rgba(125, 143, 122, 0.2)",
                  }}
                >
                  <Icon className="w-6 h-6 text-[#7D8F7A]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3
                      className="font-bold text-lg"
                      style={{ color: "#252421" }}
                    >
                      {insight.name}
                    </h3>
                    <span
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: "rgba(90, 138, 106, 0.1)",
                        color: "#5A8A6A",
                        border: "1px solid rgba(90, 138, 106, 0.2)",
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5A8A6A] animate-pulse" />{" "}
                      {project?.status || "Ready"}
                    </span>
                  </div>
                  {project && (
                    <p className="mt-1 text-xs" style={{ color: "#7A746A" }}>
                      {project.runsCount} runs · updated{" "}
                      {formatDate(project.updatedAt)}
                    </p>
                  )}
                </div>
              </div>

              <p className="text-sm mb-4" style={{ color: "#7A746A" }}>
                {insight.description}
              </p>

              <div className="mb-5">
                <p
                  className="text-xs uppercase tracking-wider mb-1"
                  style={{ color: "#A8A39B" }}
                >
                  What you get
                </p>
                <p className="text-sm" style={{ color: "#252421" }}>
                  {insight.outcome}
                </p>
              </div>

              <Link
                href={insight.href}
                className="w-full font-medium py-2.5 md:py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-sm md:text-base"
                style={{ backgroundColor: "#3A3834", color: "#FFFCF9" }}
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
          backgroundColor: "#FFFCF9",
          border: "1px solid #E5DED6",
          boxShadow: "0 2px 12px rgba(37, 36, 33, 0.05)",
        }}
      >
        <h2 className="font-bold mb-4" style={{ color: "#252421" }}>
          Recent AI Runs
        </h2>
        <div className="space-y-3">
          {recentRuns.length ? (
            recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl p-3"
                style={{ backgroundColor: "#F7F5F2" }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: "#252421" }}>
                    {run.agentName}
                  </p>
                  <p className="text-xs" style={{ color: "#7A746A" }}>
                    {run.task}
                  </p>
                </div>
                <div className="text-xs text-right" style={{ color: "#7A746A" }}>
                  <p>{run.status}</p>
                  <p>{formatDate(run.createdAt)}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm" style={{ color: "#7A746A" }}>
              AI run history will appear here after modules generate insights.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
