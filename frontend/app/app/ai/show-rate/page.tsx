"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clipboard,
  CreditCard,
  ExternalLink,
  Loader2,
  MessageSquare,
  Send,
} from "lucide-react";
import {
  AiGenerationProvenance,
  coerceAiRunProvenance,
  PageHeader,
  Card,
  AlertBanner,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  getAiModulePageAccess,
  loadOptionalPageResource,
} from "@/lib/ai-page-access";
import type {
  AiRunRecord,
  AiShowRateAction,
  AiShowRateGenerateResult,
  AiShowRateOutput,
  AiShowRateRiskRow,
} from "@/lib/api-types";
import { upcomingDateRange } from "@/lib/ai-module-truth";
import { describeDepositDelivery } from "@/lib/deposits/deposit-delivery";

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
    agentName: "Call & Meeting Risk",
    agentKey: result.agentKey,
    task: "Generated call and meeting follow-up scores",
    input: result.input ?? null,
    output: result.output,
    status: result.status,
    tokens: 0,
    createdAt: result.createdAt,
  };
}

function getRunSummary(run: AiRunRecord) {
  const output = getPredictionOutput(run);
  if (!output) return run.task;

  return `${output.summary.highRisk} high-priority / ${output.summary.totalAppointments} calls or meetings scored`;
}

function riskBadgeClass(
  level: NonNullable<AiShowRateRiskRow["appointmentRiskSignal"]>,
) {
  if (level === "high") return "bg-red-50 text-red-700 border-red-200";
  if (level === "medium") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

export default function ShowRatePage() {
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const [runs, setRuns] = useState<AiRunRecord[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [depositLinks, setDepositLinks] = useState<Record<string, string>>({});
  const [copiedAppointmentId, setCopiedAppointmentId] = useState<string | null>(
    null,
  );
  const [windowDays, setWindowDays] = useState<7 | 30 | 60>(30);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    tone: "success" | "info";
    text: string;
  } | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showRateRuns = useMemo(
    () => runs.filter((run) => run.agentKey === SHOW_RATE_AGENT_KEY),
    [runs],
  );
  const selectedRun =
    showRateRuns.find((run) => run.id === selectedRunId) ??
    showRateRuns[0] ??
    null;
  const predictionOutput = getPredictionOutput(selectedRun);
  const riskRows = predictionOutput?.riskRows ?? [];
  const summary = predictionOutput?.summary;
  const access = getAiModulePageAccess(hasPermission, "appointments:read");
  const generationPermissionMessage = !access.canReadSource
    ? "Scheduling read access is required to calculate upcoming follow-up scores."
    : !access.canWriteReports
      ? "Reports write access is required to generate and save follow-up scores."
      : null;

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const authToken = token;

    async function loadHistory() {
      queueMicrotask(() => {
        if (!cancelled) setIsHistoryLoading(access.canReadHistory);
      });
      const result = await loadOptionalPageResource(
        access.canReadHistory,
        () => api.ai.listRuns(authToken, { agentKey: SHOW_RATE_AGENT_KEY }),
      );
      if (cancelled) return;

      if (result.status === "loaded") {
        setRuns(result.data);
        setHistoryNotice(null);
      } else if (result.status === "skipped") {
        setRuns([]);
        setHistoryNotice(
          "Saved scoring history requires Reports read access. You can still generate a current result with scheduling read and Reports write access.",
        );
      } else {
        console.error("Failed to load show-rate history", result.error);
        setRuns([]);
        setHistoryNotice(
          "Saved follow-up scoring history could not be loaded. Generating a current result remains available.",
        );
      }

      setIsHistoryLoading(false);
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [access.canReadHistory, token]);

  const handleRefreshPredictions = async () => {
    if (!token || !access.canGenerate) return;

    setIsGenerating(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const range = upcomingDateRange(windowDays);
      const generated = await api.ai.generateShowRatePredictions(token, range);
      setRuns((current) => [
        toRunRecord(generated),
        ...current.filter((run) => run.id !== generated.id),
      ]);
      setSelectedRunId(generated.id);
      setStatusMessage({
        tone: "success",
        text: access.canReadHistory
          ? `Rules-based follow-up scores generated for the next ${windowDays} days and saved to history.`
          : `Rules-based follow-up scores generated for the next ${windowDays} days and saved. This result is available now; reopening saved history requires Reports read access.`,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate follow-up scores.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAction = async (row: AiShowRateRiskRow, action: AiShowRateAction) => {
    if (!token) return;
    if (!action.supported) return;

    if (action.type === "send_reminder") {
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
        treatment: action.payload.treatment || row.treatment || "Call booking",
        depositAmount: action.payload.depositAmount,
        successUrl: `${window.location.origin}/deposit-payment/success/`,
        cancelUrl: `${window.location.origin}/deposit-payment/cancelled/`,
      });

      if (checkout.url) {
        setDepositLinks((current) => ({
          ...current,
          [row.appointmentId]: checkout.url!,
        }));
      }

      const feedback = describeDepositDelivery(checkout.delivery, {
        hasPaymentLink: Boolean(checkout.url),
        kind: "request",
      });
      if (feedback.tone === "error") {
        setErrorMessage(
          `${feedback.title}${feedback.detail ? `: ${feedback.detail}` : ""}`,
        );
      } else {
        setStatusMessage({
          tone: feedback.tone,
          text: `${feedback.title}${feedback.detail ? ` — ${feedback.detail}` : ""}`,
        });
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create the follow-up link.",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCopyDepositLink = async (
    appointmentId: string,
    contactName: string,
  ) => {
    const paymentUrl = depositLinks[appointmentId];
    if (!paymentUrl) return;
    setErrorMessage(null);
    try {
      await navigator.clipboard.writeText(paymentUrl);
      setCopiedAppointmentId(appointmentId);
      setStatusMessage({
        tone: "success",
        text: `Payment link copied for ${contactName}.`,
      });
      window.setTimeout(
        () =>
          setCopiedAppointmentId((current) =>
            current === appointmentId ? null : current,
          ),
        1800,
      );
    } catch {
      setErrorMessage(
        "The payment link could not be copied. Open it and copy the address from your browser.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Call & Meeting Risk"
          subtitle="Apply rules-based scoring to scheduled calls or meetings and surface supported follow-up actions."
          icon={BarChart3}
          iconColor="text-[#9A5524]"
          iconBg="bg-[rgba(183,103,46,0.1)]"
        />
        <button
          type="button"
          onClick={handleRefreshPredictions}
          disabled={isGenerating || !token || !access.canGenerate}
          title={generationPermissionMessage || undefined}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#9A5524] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#151F21] disabled:opacity-60 sm:w-auto"
          style={{
            border: "1px solid rgba(154,85,36, 0.25)",
          }}
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Generate Scores
        </button>
      </div>

      {generationPermissionMessage && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {generationPermissionMessage}
        </div>
      )}

      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className={[
            "rounded-2xl border px-4 py-3 text-sm",
            statusMessage.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700",
          ].join(" ")}
        >
          {statusMessage.text}
        </div>
      )}

      {errorMessage && (
        <AlertBanner
          icon={AlertTriangle}
          title="Follow-up action failed"
          description={errorMessage}
          variant="warning"
        />
      )}

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-[#151F21]">Upcoming window</h2>
            <p className="mt-1 text-sm text-[#5E6E70]">
              The selected date range is saved with each scoring run.
            </p>
          </div>
          <div className="grid grid-cols-3 rounded-xl border border-[#E5E7EB] bg-[#FAF9F7] p-1">
            {([7, 30, 60] as const).map((days) => (
              <button
                key={days}
                type="button"
                aria-pressed={windowDays === days}
                onClick={() => setWindowDays(days)}
                className={[
                  "min-h-10 rounded-lg px-3 text-sm font-semibold",
                  windowDays === days
                    ? "bg-white text-[#151F21] shadow-sm"
                    : "text-[#5E6E70]",
                ].join(" ")}
              >
                {days} days
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "#151F21" }}>
            <Calendar className="w-4 h-4 text-[#9A5524]" /> High priority
          </h3>
          <p className="text-3xl font-semibold" style={{ color: "#151F21" }}>
            {summary ? summary.highRisk : "-"}
          </p>
          <p className="text-sm mt-1" style={{ color: "#5E6E70" }}>
            High-priority rules scores from {summary?.totalAppointments ?? 0}{" "}
            calls or meetings.
          </p>
        </Card>

        <Card>
          <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "#151F21" }}>
            <MessageSquare className="w-4 h-4 text-[#9A5524]" /> Reminder Actions
          </h3>
          <p className="text-3xl font-semibold" style={{ color: "#151F21" }}>
            {summary ? summary.reminderRecommended : "-"}
          </p>
          <p className="text-sm mt-1" style={{ color: "#5E6E70" }}>
            Recommendations only; automated reminder sending is unavailable.
          </p>
        </Card>

        <Card>
          <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "#151F21" }}>
            <CreditCard className="w-4 h-4 text-[#9A5524]" /> Follow-up links
          </h3>
          <p className="text-3xl font-semibold" style={{ color: "#151F21" }}>
            {summary ? summary.depositRecommended : "-"}
          </p>
          <p className="text-sm mt-1" style={{ color: "#5E6E70" }}>
            Supported buttons send a request or create a shareable payment
            link without leaving this workspace.
          </p>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold" style={{ color: "#151F21" }}>
            Call and meeting follow-up scores
          </h3>
          {selectedRun && (
            <span className="text-xs" style={{ color: "#5E6E70" }}>
              Selected run {formatRunDate(selectedRun.createdAt)}
            </span>
          )}
        </div>

        {selectedRun && predictionOutput && (
          <div className="mb-4">
            <AiGenerationProvenance
              provenance={coerceAiRunProvenance(selectedRun)}
              generatedAt={selectedRun.createdAt}
            />
          </div>
        )}

        {isHistoryLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 rounded-xl bg-[rgba(183,103,46,0.08)] animate-pulse" />
            ))}
          </div>
        ) : riskRows.length ? (
          <div className="space-y-3">
            {riskRows.map((row) => {
              const appointmentRiskSignal =
                row.appointmentRiskSignal ?? row.riskLevel;
              const priorityScore = row.priorityScore ?? row.riskScore;

              return (
              <div key={row.appointmentId} className="rounded-xl border border-[#E5E7EB] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium" style={{ color: "#151F21" }}>{row.contactName}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${riskBadgeClass(appointmentRiskSignal)}`}>
                        {priorityScore} / 100 · {appointmentRiskSignal} priority
                      </span>
                    </div>
                    <p className="mt-1 text-sm" style={{ color: "#5E6E70" }}>
                      {formatAppointmentDate(row.appointmentDate)} | {row.treatment || "Scheduled item"} | {formatMoneyFromCents(row.valueCents)}
                    </p>
                    <p className="mt-2 text-xs" style={{ color: "#5E6E70" }}>
                      {row.reasons.length ? row.reasons.join(" | ") : "No scoring signals found."}
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
                          disabled={
                            !action.supported ||
                            actionLoadingId === loadingKey
                          }
                          title={
                            action.supported
                              ? undefined
                              : action.unavailableReason ||
                                "This action is unavailable."
                          }
                          className="rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-60"
                          style={{
                            backgroundColor: action.supported ? "rgba(183,103,46, 0.08)" : "rgba(21,31,33,0.04)",
                            color: action.supported ? "#9A5524" : "#5E6E70",
                            border: action.supported ? "1px solid rgba(183,103,46, 0.2)" : "1px solid rgba(21,31,33,0.08)",
                          }}
                        >
                          {actionLoadingId === loadingKey ? "Working..." : action.label}
                        </button>
                      );
                    })}
                    {depositLinks[row.appointmentId] && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyDepositLink(
                              row.appointmentId,
                              row.contactName,
                            )
                          }
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-medium text-[#315F5C]"
                        >
                          {copiedAppointmentId === row.appointmentId ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <Clipboard className="h-3.5 w-3.5" />
                          )}
                          {copiedAppointmentId === row.appointmentId
                            ? "Copied"
                            : "Copy payment link"}
                        </button>
                        <a
                          href={depositLinks[row.appointmentId]}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-medium text-[#5E6E70]"
                        >
                          Open checkout
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="py-10 text-center text-sm" style={{ color: "#5E6E70" }}>
            {selectedRun
              ? "This run completed successfully but found no scheduled calls or meetings in its saved date range."
              : "No saved scoring run yet. Generate scores to review upcoming calls and meetings."}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold mb-4" style={{ color: "#151F21" }}>
          Follow-up Scoring History
        </h3>
        {historyNotice && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
            {historyNotice}
          </div>
        )}
        {isHistoryLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 rounded-xl bg-[rgba(183,103,46,0.08)] animate-pulse" />
            ))}
          </div>
        ) : showRateRuns.length ? (
          <div className="space-y-2">
            {showRateRuns.slice(0, 8).map((run) => {
              return (
              <button
                type="button"
                onClick={() => setSelectedRunId(run.id)}
                key={run.id}
                className={[
                  "w-full rounded-xl border p-3 text-left text-sm",
                  run.id === selectedRun?.id
                    ? "border-[rgba(183,103,46,0.35)] bg-[rgba(183,103,46,0.06)]"
                    : "border-[#E5E7EB]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium" style={{ color: "#151F21" }}>
                      {getRunSummary(run)}
                    </p>
                    <p className="text-xs" style={{ color: "#5E6E70" }}>
                      {formatRunDate(run.createdAt)} | {run.status} | {run.tokens.toLocaleString()} tokens
                    </p>
                  </div>
                  {run.id === selectedRun?.id && (
                    <span
                      className="text-xs px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: "rgba(183,103,46, 0.08)",
                        color: "#9A5524",
                      }}
                    >
                      Viewing
                    </span>
                  )}
                </div>
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
          <div className="py-10 text-center text-sm" style={{ color: "#5E6E70" }}>
            No saved follow-up scoring history found.
          </div>
        )}
      </Card>
    </div>
  );
}
