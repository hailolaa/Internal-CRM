"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { PageHeader, Card, AlertBanner } from "@/components/ui";
import { FormField } from "@/components/ui/forms";
import { useFormFields } from "@/hooks";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { AiCampaignAnalystOutput, AiRunRecord } from "@/lib/api-types";

const CAMPAIGN_ANALYST_AGENT_KEY = "campaign_analyst";

function isAnalysisOutput(value: unknown): value is AiCampaignAnalystOutput {
  if (!value || typeof value !== "object") return false;
  const output = value as Partial<AiCampaignAnalystOutput>;
  return (
    Array.isArray(output.underperforming) &&
    Array.isArray(output.highROI) &&
    Array.isArray(output.landingPageIssues) &&
    typeof output.projectedUplift === "string"
  );
}

function formatRunDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function CampaignAnalystPage() {
  const { session } = useAuth();
  const token = session?.token;
  const { fields, updateField } = useFormFields({
    googleSpend: "",
    metaSpend: "",
    leads: "",
    bookings: "",
    revenue: "",
  });

  const [runs, setRuns] = useState<AiRunRecord[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const campaignRuns = useMemo(
    () => runs.filter((run) => run.agentKey === CAMPAIGN_ANALYST_AGENT_KEY),
    [runs],
  );
  const output = campaignRuns.find((run) => isAnalysisOutput(run.output))
    ?.output as AiCampaignAnalystOutput | undefined;
  const canGenerate = Boolean(
    token &&
      [
        fields.googleSpend,
        fields.metaSpend,
        fields.leads,
        fields.bookings,
        fields.revenue,
      ].some((value) => value.trim()),
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const authToken = token;

    async function loadRuns() {
      setIsHistoryLoading(true);
      try {
        const rows = await api.ai.listRuns(authToken, {
          agentKey: CAMPAIGN_ANALYST_AGENT_KEY,
        });
        if (!cancelled) {
          setRuns(rows);
          setStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load campaign analysis history", error);
        if (!cancelled) {
          setRuns([]);
          setStatusMessage(
            error instanceof Error
              ? error.message
              : "Unable to load campaign analysis history.",
          );
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

  const parseNumber = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  };

  const handleRun = async () => {
    if (!token || isGenerating) return;

    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const generated = await api.ai.generateCampaignAnalyst(token, {
        googleSpend: parseNumber(fields.googleSpend),
        metaSpend: parseNumber(fields.metaSpend),
        leads: parseNumber(fields.leads),
        bookings: parseNumber(fields.bookings),
        revenue: parseNumber(fields.revenue),
      });

      setRuns((current) => [
        {
          id: generated.id,
          projectId: null,
          agentName: "Campaign Analyst",
          agentKey: generated.agentKey,
          task: "Generated campaign-analysis recommendations",
          input: null,
          output: generated.output,
          status: generated.status,
          tokens: 0,
          createdAt: generated.createdAt,
        },
        ...current.filter((run) => run.id !== generated.id),
      ]);
      setStatusMessage("Campaign analysis generated and saved to AI history.");
    } catch (error) {
      console.error("Failed to generate campaign analysis", error);
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate campaign analysis.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaign Analysis"
        subtitle="Input your ad spend and revenue data. Get actionable recommendations."
        icon={Brain}
        iconColor="text-[#7D8F7A]"
        iconBg="bg-[rgba(125,143,122,0.1)]"
      />

      {statusMessage && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card>
          <h2 className="font-semibold mb-4" style={{ color: "#252421" }}>
            Campaign Data
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Google Ads Spend (£)"
              value={fields.googleSpend}
              onChange={updateField("googleSpend")}
              placeholder="2400"
              type="number"
            />
            <FormField
              label="Meta Ads Spend (£)"
              value={fields.metaSpend}
              onChange={updateField("metaSpend")}
              placeholder="1800"
              type="number"
            />
            <FormField
              label="Total Leads"
              value={fields.leads}
              onChange={updateField("leads")}
              placeholder="156"
              type="number"
            />
            <FormField
              label="Bookings"
              value={fields.bookings}
              onChange={updateField("bookings")}
              placeholder="42"
              type="number"
            />
          </div>
          <div className="mt-4">
            <FormField
              label="Revenue Generated (£)"
              value={fields.revenue}
              onChange={updateField("revenue")}
              placeholder="28600"
              type="number"
            />
          </div>
          <button
            type="button"
            onClick={handleRun}
            disabled={!canGenerate || isGenerating}
            className="w-full mt-4 font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            style={{
              backgroundColor: "rgba(125, 143, 122, 0.1)",
              color: "#7D8F7A",
              border: "1px solid rgba(125, 143, 122, 0.25)",
            }}
          >
            <Brain className="w-4 h-4" />
            {isGenerating ? "Running..." : "Run AI Analysis"}
          </button>
        </Card>

        {/* Output Panel */}
        <div className="space-y-4">
          {isHistoryLoading && (
            <Card className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-14 rounded-xl bg-[rgba(125,143,122,0.08)] animate-pulse"
                />
              ))}
            </Card>
          )}

          {!isHistoryLoading && !output && (
            <Card className="text-center py-8">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-20 text-[#A8A39B]" />
              <p style={{ color: "#A8A39B" }}>
                No saved Campaign Analyst output found in live AI history.
              </p>
            </Card>
          )}

          {!isHistoryLoading && output && (
            <>
              <AlertBanner
                icon={ArrowUpRight}
                title="Projected Uplift"
                description={output.projectedUplift}
                variant="success"
              />

              <Card>
                <h3
                  className="font-semibold mb-3 flex items-center gap-2"
                  style={{ color: "#252421" }}
                >
                  <TrendingDown className="w-4 h-4 text-[#8A4A4A]" />{" "}
                  Underperforming
                </h3>
                <div className="space-y-3">
                  {output.underperforming.map((item, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl"
                      style={{
                        backgroundColor: "rgba(138, 74, 74, 0.05)",
                        border: "1px solid rgba(138, 74, 74, 0.15)",
                      }}
                    >
                      <p
                        className="font-medium text-sm"
                        style={{ color: "#252421" }}
                      >
                        {item.name}
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "#8A4A4A" }}
                      >
                        {item.issue}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "#7A746A" }}>
                        → {item.action}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <h3
                  className="font-semibold mb-3 flex items-center gap-2"
                  style={{ color: "#252421" }}
                >
                  <TrendingUp className="w-4 h-4 text-[#5A8A6A]" /> Scale These
                </h3>
                <div className="space-y-3">
                  {output.highROI.map((item, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl"
                      style={{
                        backgroundColor: "rgba(90, 138, 106, 0.05)",
                        border: "1px solid rgba(90, 138, 106, 0.15)",
                      }}
                    >
                      <div className="flex justify-between">
                        <p
                          className="font-medium text-sm"
                          style={{ color: "#252421" }}
                        >
                          {item.name}
                        </p>
                        <span className="font-bold text-sm text-[#5A8A6A]">
                          {item.roas}
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: "#7A746A" }}>
                        → {item.recommendation}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <h3
                  className="font-semibold mb-3 flex items-center gap-2"
                  style={{ color: "#252421" }}
                >
                  <AlertTriangle className="w-4 h-4 text-[#A07840]" /> Landing
                  Page Issues
                </h3>
                <ul className="space-y-2">
                  {output.landingPageIssues.map((issue, i) => (
                    <li
                      key={i}
                      className="text-sm flex items-start gap-2"
                      style={{ color: "#7A746A" }}
                    >
                      <span className="text-[#A07840] mt-0.5">•</span> {issue}
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}

          {!isHistoryLoading && campaignRuns.length > 0 && (
            <Card>
              <h3 className="font-semibold mb-3" style={{ color: "#252421" }}>
                Campaign Analyst History
              </h3>
              <div className="space-y-2">
                {campaignRuns.slice(0, 5).map((run) => (
                  <div
                    key={run.id}
                    className="rounded-xl p-3 text-sm"
                    style={{ border: "1px solid #EDE8E2" }}
                  >
                    <p className="font-medium" style={{ color: "#252421" }}>
                      {run.task}
                    </p>
                    <p className="text-xs" style={{ color: "#7A746A" }}>
                      {formatRunDate(run.createdAt)} · {run.status} ·{" "}
                      {run.tokens.toLocaleString()} tokens
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
