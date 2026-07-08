"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CreditCard,
  Loader2,
  MessageSquare,
  Send,
} from "lucide-react";
import { PageHeader, Card, AlertBanner } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  AiRunRecord,
  AiShowRateAction,
  AiShowRateGenerateResult,
  AiShowRateOutput,
  AiShowRateRiskRow,
} from "@/lib/api-types";

const SHOW_RATE_AGENT_KEY = "show_rate";

function formatRunDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatAppointmentDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMoneyFromCents(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function isShowRateOutput(value: unknown): value is AiShowRateOutput {
  if (!value || typeof value !== "object") return false;
  const output = value as Partial<AiShowRateOutput>;
  return Boolean(output.summary && Array.isArray(output.riskRows));
}

function getPredictionOutput(run: AiRunRecord | null) {
  return isShowRateOutput(run?.output) ? run.output : null;
}

function toRunRecord(result: AiShowRateGenerateResult): AiRunRecord {
  return {
    id: result.id,
    projectId: null,
    agentName: "Missed Opportunity",
    agentKey: result.agentKey,
    task: "Generated no-show predictions",
    input: JSON.stringify(result.input ?? null),
    output: result.output,
    status: result.status,
    tokens: 0,
    createdAt: result.createdAt,
  };
}

function getRunSummary(run: AiRunRecord) {
  const output = getPredictionOutput(run);
  if (!output) return run.task;

  return `${output.summary.highRisk} high-risk / ${output.summary.totalAppointments} appointments scored`;
}

function riskBadgeClass(level: AiShowRateRiskRow["riskLevel"]) {
  if (level === "high") return "bg-red-50 text-red-700 border-red-200";
  if (level === "medium") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

export default function ShowRatePage() {
  const { session } = useAuth();
  const token = session?.token;
  const [runs, setRuns] = useState<AiRunRecord[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showRateRuns = useMemo(
    () => runs.filter((run) => run.agentKey === SHOW_RATE_AGENT_KEY),
    [runs],
  );
  const latestRun = showRateRuns[0] ?? null;
  const predictionOutput = getPredictionOutput(latestRun);
  const riskRows = predictionOutput?.riskRows ?? [];
  const summary = predictionOutput?.summary;

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const authToken = token;

    async function loadRuns() {
      setIsHistoryLoading(true);
      try {
        const rows = await api.ai.listRuns(authToken, { agentKey: SHOW_RATE_AGENT_KEY });
        if (!cancelled) {
          setRuns(rows);
          setErrorMessage(null);
        }
      } catch (error) {
        console.error("Failed to load show-rate history", error);
        if (!cancelled) {
          setRuns([]);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load Missed Opportunity history.",
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

  const handleRefreshPredictions = async () => {
    if (!token) return;

    setIsGenerating(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const generated = await api.ai.generateShowRatePredictions(token);
      setRuns((current) => [
        toRunRecord(generated),
        ...current.filter((run) => run.id !== generated.id),
      ]);
      setStatusMessage("No-show predictions refreshed and saved to AI history.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to refresh no-show predictions.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAction = async (row: AiShowRateRiskRow, action: AiShowRateAction) => {
    if (!token) return;

    if (action.type === "send_reminder") {
      setStatusMessage(
        action.unavailableReason ||
          "Reminder sending is not available for this AI module yet.",
      );
      return;
    }

    if (action.type !== "request_deposit" || !action.payload) return;

    setActionLoadingId(`${row.appointmentId}:${action.type}`);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const checkout = await api.deposits.createSession(token, {
        contactId: action.payload.contactId,
        contactName: action.payload.contactName || row.contactName,
        appointmentId: action.payload.appointmentId || row.appointmentId,
        treatment: action.payload.treatment || row.treatment || "Appointment deposit",
        depositAmount: action.payload.depositAmount,
        successUrl: `${window.location.origin}/app/deposits/?success=true&appointmentId=${encodeURIComponent(row.appointmentId)}`,
        cancelUrl: `${window.location.origin}/app/ai/show-rate?depositCanceled=true`,
      });

      if (checkout.url) {
        window.location.assign(checkout.url);
        return;
      }

      setStatusMessage("Deposit request was created.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to request deposit.",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Missed Opportunity Tracking"
          subtitle="Predict no-shows, trigger supported actions, and enforce deposit policies."
          icon={BarChart3}
          iconColor="text-[#A07840]"
          iconBg="bg-[rgba(160,120,64,0.1)]"
        />
        <button
          type="button"
          onClick={handleRefreshPredictions}
          disabled={isGenerating || !token}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 sm:w-auto"
          style={{
            backgroundColor: "rgba(160, 120, 64, 0.08)",
            color: "#A07840",
            border: "1px solid rgba(160, 120, 64, 0.2)",
          }}
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Refresh Predictions
        </button>
      </div>

      {statusMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <AlertBanner
          icon={AlertTriangle}
          title="Show-rate prediction action failed"
          description={errorMessage}
          variant="warning"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "#252421" }}>
            <Calendar className="w-4 h-4 text-[#A07840]" /> Upcoming Risk
          </h3>
          <p className="text-3xl font-semibold" style={{ color: "#252421" }}>
            {summary ? summary.highRisk : "-"}
          </p>
          <p className="text-sm mt-1" style={{ color: "#7A746A" }}>
            High-risk appointments from {summary?.totalAppointments ?? 0} scored.
          </p>
        </Card>

        <Card>
          <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "#252421" }}>
            <MessageSquare className="w-4 h-4 text-[#A07840]" /> Reminder Actions
          </h3>
          <p className="text-3xl font-semibold" style={{ color: "#252421" }}>
            {summary ? summary.reminderRecommended : "-"}
          </p>
          <p className="text-sm mt-1" style={{ color: "#7A746A" }}>
            Recommendations shown; sending remains unavailable until a reminder endpoint exists.
          </p>
        </Card>

        <Card>
          <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "#252421" }}>
            <CreditCard className="w-4 h-4 text-[#A07840]" /> Deposit Enforcement
          </h3>
          <p className="text-3xl font-semibold" style={{ color: "#252421" }}>
            {summary ? summary.depositRecommended : "-"}
          </p>
          <p className="text-sm mt-1" style={{ color: "#7A746A" }}>
            Deposit request actions use the live deposit payment session endpoint.
          </p>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold" style={{ color: "#252421" }}>
            No-show Risk Predictions
          </h3>
          {latestRun && (
            <span className="text-xs" style={{ color: "#7A746A" }}>
              Last generated {formatRunDate(latestRun.createdAt)}
            </span>
          )}
        </div>

        {isHistoryLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 rounded-xl bg-[rgba(160,120,64,0.08)] animate-pulse" />
            ))}
          </div>
        ) : riskRows.length ? (
          <div className="space-y-3">
            {riskRows.map((row) => (
              <div key={row.appointmentId} className="rounded-xl border border-[#EDE8E2] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium" style={{ color: "#252421" }}>{row.contactName}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${riskBadgeClass(row.riskLevel)}`}>
                        {row.riskScore}% {row.riskLevel} risk
                      </span>
                    </div>
                    <p className="mt-1 text-sm" style={{ color: "#7A746A" }}>
                      {formatAppointmentDate(row.appointmentDate)} | {row.treatment || "Appointment"} | {formatMoneyFromCents(row.valueCents)}
                    </p>
                    <p className="mt-2 text-xs" style={{ color: "#7A746A" }}>
                      {row.reasons.length ? row.reasons.join(" | ") : "No major risk signals found."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.recommendedActions.map((action) => {
                      const loadingKey = `${row.appointmentId}:${action.type}`;
                      return (
                        <button
                          key={action.type}
                          type="button"
                          onClick={() => void handleAction(row, action)}
                          disabled={actionLoadingId === loadingKey}
                          className="rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-60"
                          style={{
                            backgroundColor: action.supported ? "rgba(160, 120, 64, 0.08)" : "rgba(0,0,0,0.04)",
                            color: action.supported ? "#A07840" : "#7A746A",
                            border: action.supported ? "1px solid rgba(160, 120, 64, 0.2)" : "1px solid rgba(0,0,0,0.08)",
                          }}
                        >
                          {actionLoadingId === loadingKey ? "Working..." : action.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-sm" style={{ color: "#7A746A" }}>
            No generated no-show predictions yet. Refresh predictions to score upcoming appointments.
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold mb-4" style={{ color: "#252421" }}>
          Missed Opportunity History
        </h3>
        {isHistoryLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 rounded-xl bg-[rgba(160,120,64,0.08)] animate-pulse" />
            ))}
          </div>
        ) : showRateRuns.length ? (
          <div className="space-y-2">
            {showRateRuns.slice(0, 8).map((run) => (
              <div key={run.id} className="rounded-xl p-3 text-sm" style={{ border: "1px solid #EDE8E2" }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium" style={{ color: "#252421" }}>
                      {getRunSummary(run)}
                    </p>
                    <p className="text-xs" style={{ color: "#7A746A" }}>
                      {formatRunDate(run.createdAt)} | {run.status} | {run.tokens.toLocaleString()} tokens
                    </p>
                  </div>
                  <span
                    className="text-xs px-2 py-1 rounded-full capitalize"
                    style={{
                      backgroundColor: "rgba(160, 120, 64, 0.08)",
                      color: "#A07840",
                    }}
                  >
                    {run.agentName}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-sm" style={{ color: "#7A746A" }}>
            No live Missed Opportunity run history found.
          </div>
        )}
      </Card>
    </div>
  );
}
