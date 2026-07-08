"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MessageSquare,
  Send,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { FormField } from "@/components/ui/forms";
import { useFormFields, useClipboard } from "@/hooks";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  AiRunRecord,
  AiSalesAssistantFollowUp,
  AiSalesAssistantOutput,
} from "@/lib/api-types";

const SALES_ASSISTANT_AGENT_KEY = "sales_assistant";

function getSalesAssistantOutput(run: AiRunRecord | null) {
  const output = run?.output;
  if (!output || typeof output !== "object") return null;

  const maybeOutput = output as Partial<AiSalesAssistantOutput>;
  if (
    typeof maybeOutput.recommendation === "string" &&
    typeof maybeOutput.summary === "string" &&
    maybeOutput.scores &&
    Array.isArray(maybeOutput.followUps)
  ) {
    return maybeOutput as AiSalesAssistantOutput;
  }

  return null;
}

function formatRunDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function SalesAssistantPage() {
  const { session } = useAuth();
  const token = session?.token;
  const { fields, updateField } = useFormFields({
    leadName: "",
    treatment: "",
    context: "",
  });
  const { copied, copy } = useClipboard();
  const [runs, setRuns] = useState<AiRunRecord[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const salesRuns = useMemo(
    () => runs.filter((run) => run.agentKey === SALES_ASSISTANT_AGENT_KEY),
    [runs],
  );
  const latestRun = salesRuns[0] ?? null;
  const output = useMemo(() => getSalesAssistantOutput(latestRun), [latestRun]);
  const primaryFollowUp = output?.followUps[0] ?? null;
  const canGenerate = Boolean(
    token && (fields.leadName.trim() || fields.context.trim()),
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const authToken = token;

    async function loadRuns() {
      setIsHistoryLoading(true);
      try {
        const rows = await api.ai.listRuns(authToken, {
          agentKey: SALES_ASSISTANT_AGENT_KEY,
        });
        if (!cancelled) {
          setRuns(rows);
          setStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load sales assistant history", error);
        if (!cancelled) {
          setRuns([]);
          setStatusMessage({
            tone: "error",
            text:
              error instanceof Error
                ? error.message
                : "Unable to load Conversion Tracking history.",
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

  const handleRun = async () => {
    if (!token || isGenerating) return;

    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const generated = await api.ai.generateSalesAssistant(token, {
        leadName: fields.leadName.trim() || undefined,
        treatment: fields.treatment.trim() || undefined,
        context: fields.context.trim() || undefined,
      });

      setRuns((current) => [
        {
          id: generated.id,
          projectId: null,
          agentName: "Conversion Tracking",
          agentKey: generated.agentKey,
          task: `Generated conversion recommendations for ${fields.leadName.trim() || "lead"}`,
          input: null,
          output: generated.output,
          status: generated.status,
          tokens: 0,
          createdAt: generated.createdAt,
        },
        ...current.filter((run) => run.id !== generated.id),
      ]);
      setStatusMessage({
        tone: "success",
        text: "Conversion recommendation generated and saved to AI history.",
      });
    } catch (error) {
      console.error("Failed to generate sales assistant recommendation", error);
      setStatusMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to generate a Conversion Tracking recommendation.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyFollowUp = (followUp: AiSalesAssistantFollowUp) => {
    const text = followUp.subject
      ? `${followUp.subject}\n\n${followUp.body}`
      : followUp.body;
    copy(text);
  };

  const handleUnsupportedAction = (message: string) => {
    setStatusMessage({
      tone: "info",
      text: message,
    });
  };

  const statusClasses =
    statusMessage?.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : statusMessage?.tone === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversion Tracking"
        subtitle="Follow-up messages, cold lead flags, and conversion predictions."
        icon={MessageSquare}
        iconColor="text-[#5A8A6A]"
        iconBg="bg-[rgba(90,138,106,0.1)]"
      />

      {statusMessage && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${statusClasses}`}>
          {statusMessage.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold mb-4" style={{ color: "#252421" }}>
              Generate Follow-up
            </h2>
            <div className="space-y-4">
              <FormField
                label="Lead Name"
                value={fields.leadName}
                onChange={updateField("leadName")}
                placeholder="e.g. Sarah Johnson"
              />
              <FormField
                label="Treatment Interest"
                value={fields.treatment}
                onChange={updateField("treatment")}
                type="select"
                options={[
                  { value: "Botox", label: "Botox" },
                  { value: "Lip Filler", label: "Lip Filler" },
                  { value: "Dermal Filler", label: "Dermal Filler" },
                  { value: "Skin Treatment", label: "Skin Treatment" },
                ]}
              />
              <FormField
                label="Context (optional)"
                value={fields.context}
                onChange={updateField("context")}
                type="textarea"
                rows={3}
                placeholder="e.g. Had consultation last week, asked about pricing..."
              />
            </div>
            <button
              type="button"
              onClick={handleRun}
              disabled={!canGenerate || isGenerating}
              className="w-full mt-4 font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              style={{
                backgroundColor: "rgba(90, 138, 106, 0.1)",
                color: "#5A8A6A",
                border: "1px solid rgba(90, 138, 106, 0.2)",
              }}
            >
              <Send className="w-4 h-4" />
              {isGenerating ? "Generating..." : "Generate Follow-up"}
            </button>
          </Card>

          {/* Cold Leads */}
          <Card>
            <h3
              className="font-semibold mb-3 flex items-center gap-2"
              style={{ color: "#252421" }}
            >
              <AlertTriangle className="w-4 h-4 text-[#A07840]" /> Cold Lead
              Flags
            </h3>
            {output ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "#7A746A" }}>
                    Cold score
                  </span>
                  <span className="text-2xl font-semibold text-[#252421]">
                    {output.scores.coldLeadScore}
                  </span>
                </div>
                <span
                  className={[
                    "inline-flex rounded-full border px-2 py-1 text-xs font-medium",
                    output.scores.urgency === "high"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : output.scores.urgency === "medium"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700",
                  ].join(" ")}
                >
                  {output.scores.urgency} urgency
                </span>
                <div className="space-y-2">
                  {output.scores.reasons.slice(0, 4).map((reason) => (
                    <p key={reason} className="text-sm" style={{ color: "#5F5A52" }}>
                      {reason}
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed" style={{ color: "#7A746A" }}>
                Generate a recommendation to see cold-lead scoring from live
                Sales Assistant output.
              </p>
            )}
          </Card>
        </div>

        {/* Output Panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold" style={{ color: "#252421" }}>
                AI Recommendation
              </h2>
              {primaryFollowUp && (
                <button
                  type="button"
                  aria-label="Copy recommendation to clipboard"
                  onClick={() => copyFollowUp(primaryFollowUp)}
                  className="p-2 rounded-lg transition-colors hover:bg-[#F7F5F2]"
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 text-[#5A8A6A]" />
                  ) : (
                    <Copy className="w-4 h-4 text-[#A8A39B]" />
                  )}
                </button>
              )}
            </div>
            {isHistoryLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-12 rounded-xl bg-[rgba(90,138,106,0.08)] animate-pulse"
                  />
                ))}
              </div>
            ) : output ? (
              <div className="space-y-5">
                <p className="text-sm leading-relaxed" style={{ color: "#3A3834" }}>
                  {output.summary}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {output.followUps.map((followUp) => (
                    <div
                      key={followUp.channel}
                      className="rounded-xl border border-[#EDE8E2] p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase text-[#7A746A]">
                          {followUp.channel}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyFollowUp(followUp)}
                          className="rounded-lg p-1.5 hover:bg-[#F7F5F2]"
                          aria-label={`Copy ${followUp.channel} follow-up`}
                        >
                          <Copy className="w-4 h-4 text-[#A8A39B]" />
                        </button>
                      </div>
                      {followUp.subject && (
                        <p className="mb-2 text-sm font-medium text-[#252421]">
                          {followUp.subject}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#5F5A52]">
                        {followUp.body}
                      </p>
                    </div>
                  ))}
                </div>
                {output.unavailableActions.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    {output.unavailableActions[0].reason}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16" style={{ color: "#A8A39B" }}>
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No saved Conversion Tracking recommendation found.</p>
              </div>
            )}
          </Card>

          {/* Conversion Predictions */}
          <Card>
            <h3
              className="font-semibold mb-4 flex items-center gap-2"
              style={{ color: "#252421" }}
            >
              <Zap className="w-4 h-4 text-[#7D8F7A]" /> Conversion Predictions
            </h3>
            {output ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-[#EDE8E2] p-3">
                  <p className="text-xs text-[#7A746A]">Conversion</p>
                  <p className="text-2xl font-semibold text-[#252421]">
                    {output.scores.conversionProbability}%
                  </p>
                </div>
                <div className="rounded-xl border border-[#EDE8E2] p-3">
                  <p className="text-xs text-[#7A746A]">Treatment</p>
                  <p className="text-sm font-medium text-[#252421]">
                    {output.lead.treatment}
                  </p>
                </div>
                <div className="rounded-xl border border-[#EDE8E2] p-3">
                  <p className="text-xs text-[#7A746A]">Next action</p>
                  <button
                    type="button"
                    onClick={() =>
                      handleUnsupportedAction(
                        "Direct send/create actions are unavailable for Sales Assistant in Phase 1. Copy the follow-up and send it from Communications.",
                      )
                    }
                    className="mt-1 text-left text-sm font-medium text-[#5A8A6A]"
                  >
                    Copy and send from inbox
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed" style={{ color: "#7A746A" }}>
                Generate a recommendation to see conversion prediction and
                next-best-action output.
              </p>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold mb-3" style={{ color: "#252421" }}>
              Conversion Tracking History
            </h3>
            {isHistoryLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-12 rounded-xl bg-[rgba(90,138,106,0.08)] animate-pulse"
                  />
                ))}
              </div>
            ) : salesRuns.length ? (
              <div className="space-y-2">
                {salesRuns.slice(0, 5).map((run) => (
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
              <p className="text-sm text-center py-6" style={{ color: "#7A746A" }}>
                No live Conversion Tracking run history found.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
