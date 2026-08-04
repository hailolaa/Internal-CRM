"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  CalendarRange,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import {
  AiGenerationProvenance,
  coerceAiRunProvenance,
  PageHeader,
  Card,
  AlertBanner,
} from "@/components/ui";
import { FormField } from "@/components/ui/forms";
import { useFormFields } from "@/hooks";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  getAiModulePageAccess,
  loadOptionalPageResource,
} from "@/lib/ai-page-access";
import type {
  AiCampaignAnalystOutput,
  AiRunRecord,
  RevenueByChannelRecord,
} from "@/lib/api-types";
import {
  isValidDateRange,
  recentDateRange,
  summariseCampaignMetrics,
  validateCampaignManualInputs,
} from "@/lib/ai-module-truth";

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
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const { fields, updateField } = useFormFields({
    googleSpend: "",
    metaSpend: "",
    leads: "",
    bookings: "",
    revenue: "",
  });
  const defaultRange = useMemo(() => recentDateRange(30), []);

  const [runs, setRuns] = useState<AiRunRecord[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "manual">("live");
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [liveReport, setLiveReport] =
    useState<RevenueByChannelRecord | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const campaignRuns = useMemo(
    () => runs.filter((run) => run.agentKey === CAMPAIGN_ANALYST_AGENT_KEY),
    [runs],
  );
  const reportRuns = useMemo(
    () => campaignRuns.filter((run) => isAnalysisOutput(run.output)),
    [campaignRuns],
  );
  const selectedRun =
    reportRuns.find((run) => run.id === selectedRunId) ?? reportRuns[0];
  const output = selectedRun?.output as AiCampaignAnalystOutput | undefined;
  const liveMetrics = useMemo(
    () => liveReport?.bySource || [],
    [liveReport],
  );
  const liveTotals = useMemo(
    () => summariseCampaignMetrics(liveMetrics, "all"),
    [liveMetrics],
  );
  const manualValidation = useMemo(
    () => validateCampaignManualInputs(fields),
    [fields],
  );
  const rangeIsValid = isValidDateRange(startDate, endDate);
  const access = getAiModulePageAccess(hasPermission, "marketing:read", {
    generationPermissions: ["reports:read"],
  });
  const generationPermissionMessage = !access.canReadSource
    ? "Marketing read access is required to generate Campaign Analysis."
    : !access.canReadHistory
      ? "Reports read access is required to load inputs and generate Campaign Analysis."
      : !access.canWriteReports
        ? "Reports write access is required to generate and save Campaign Analysis."
        : null;
  const hasLiveInputs =
    liveTotals.googleSpend > 0 ||
    liveTotals.metaSpend > 0 ||
    liveTotals.leads > 0 ||
    liveTotals.bookings > 0 ||
    liveTotals.revenue > 0;
  const canGenerate = Boolean(
    token &&
      access.canGenerate &&
      rangeIsValid &&
      (mode === "live"
        ? !isMetricsLoading && !metricsError && hasLiveInputs
        : manualValidation.values),
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
            agentKey: CAMPAIGN_ANALYST_AGENT_KEY,
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
          "Saved Campaign Analysis history requires Reports read access.",
        );
      } else {
        console.error("Failed to load campaign analysis history", result.error);
        setHistoryNotice(
          "Saved Campaign Analysis history could not be loaded. Live or manual inputs remain independent.",
        );
      }

      setIsHistoryLoading(false);
    }

    void loadRuns();

    return () => {
      cancelled = true;
    };
  }, [access.canReadHistory, token]);

  useEffect(() => {
    if (!token || !rangeIsValid) return;

    let cancelled = false;
    const authToken = token;

    async function loadLiveMetrics() {
      queueMicrotask(() => {
        if (!cancelled) {
          setLiveReport(null);
          setIsMetricsLoading(access.canReadHistory);
        }
      });
      const result = await loadOptionalPageResource(
        access.canReadHistory,
        () =>
          api.reports.revenueByChannel(authToken, { startDate, endDate }),
      );
      if (cancelled) return;

      if (result.status === "loaded") {
        setLiveReport(result.data);
        setMetricsError(null);
      } else if (result.status === "skipped") {
        setLiveReport(null);
        setMetricsError(
          "Live campaign inputs require Reports read access. Manual fields remain visible, but the backend also requires Reports read access to generate either mode.",
        );
      } else {
        console.error(
          "Failed to load campaign metrics for AI analyst",
          result.error,
        );
        setLiveReport(null);
        setMetricsError(
          result.error instanceof Error
            ? result.error.message
            : "Unable to load tracked campaign data for this range.",
        );
      }

      setIsMetricsLoading(false);
    }

    void loadLiveMetrics();

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

  const handleRun = async () => {
    if (!token || !access.canGenerate || isGenerating) return;
    setShowValidation(true);
    if (!canGenerate) return;

    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const payload =
        mode === "manual"
          ? {
              ...manualValidation.values!,
              startDate,
              endDate,
              inputMode: mode,
            }
          : {
              startDate,
              endDate,
              inputMode: mode,
            };
      const generated = await api.ai.generateCampaignAnalyst(token, {
        ...payload,
      });

      setRuns((current) => [
        {
          id: generated.id,
          projectId: null,
          agentName: "Campaign Analyst",
          agentKey: generated.agentKey,
          task: "Generated campaign-analysis recommendations",
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
        text: `${mode === "live" ? "Live" : "Manual"} campaign analysis generated and saved to history.`,
      });
    } catch (error) {
      console.error("Failed to generate campaign analysis", error);
      setStatusMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to generate campaign analysis.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaign Analysis"
        subtitle="Analyse a dated live reporting range or a complete manual snapshot. OpenAI is optional; deterministic rules remain available."
        icon={Brain}
        iconColor="text-[#4A9A95]"
        iconBg="bg-[rgba(96,180,175,0.1)]"
      />

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-semibold" style={{ color: "#151F21" }}>
                Analysis inputs
              </h2>
              <p className="mt-1 text-sm text-[#5E6E70]">
                Choose one source mode. Values are never mixed between modes.
              </p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 rounded-xl border border-[#E5E7EB] bg-[#FAF9F7] p-1">
            {(["live", "manual"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value);
                  setShowValidation(false);
                  setStatusMessage(null);
                }}
                aria-pressed={mode === value}
                className={[
                  "min-h-10 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  mode === value
                    ? "bg-white text-[#151F21] shadow-sm"
                    : "text-[#5E6E70]",
                ].join(" ")}
              >
                {value === "live" ? "Live reporting" : "Manual snapshot"}
              </button>
            ))}
          </div>

          <div className="mb-4 rounded-xl border border-[#E5E7EB] p-4">
            <div className="mb-3 flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-[#4A9A95]" />
              <p className="text-sm font-semibold text-[#151F21]">
                Reporting range
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
                    setMetricsError(null);
                    setIsMetricsLoading(
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
                    setMetricsError(null);
                    setIsMetricsLoading(
                      isValidDateRange(startDate, nextEndDate),
                    );
                  }}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-[#151F21]"
                />
              </label>
            </div>
            {!rangeIsValid && (
              <p className="mt-2 text-xs text-red-700">
                Choose a valid start date on or before the end date.
              </p>
            )}
          </div>

          {mode === "live" ? (
            <>
              {metricsError && (
                <AlertBanner
                  icon={AlertTriangle}
                  title="Live campaign inputs could not be loaded"
                  description={metricsError}
                  variant="warning"
                />
              )}
              <div className="mb-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <div className="rounded-xl bg-[#FAF9F7] px-3 py-2">
                  <p className="text-xs text-[#5E6E70]">Google spend</p>
                  <p className="font-semibold text-[#151F21]">
                    {isMetricsLoading
                      ? "Loading"
                      : `£${Math.round(liveTotals.googleSpend).toLocaleString()}`}
                  </p>
                </div>
                <div className="rounded-xl bg-[#FAF9F7] px-3 py-2">
                  <p className="text-xs text-[#5E6E70]">Meta spend</p>
                  <p className="font-semibold text-[#151F21]">
                    {isMetricsLoading
                      ? "Loading"
                      : `£${Math.round(liveTotals.metaSpend).toLocaleString()}`}
                  </p>
                </div>
                <div className="rounded-xl bg-[#FAF9F7] px-3 py-2">
                  <p className="text-xs text-[#5E6E70]">Leads / bookings</p>
                  <p className="font-semibold text-[#151F21]">
                    {isMetricsLoading
                      ? "Loading"
                      : `${liveTotals.leads} / ${liveTotals.bookings}`}
                  </p>
                </div>
                <div className="rounded-xl bg-[#FAF9F7] px-3 py-2">
                  <p className="text-xs text-[#5E6E70]">Attributed revenue</p>
                  <p className="font-semibold text-[#151F21]">
                    {isMetricsLoading
                      ? "Loading"
                      : `£${Math.round(liveTotals.revenue).toLocaleString()}`}
                  </p>
                </div>
              </div>
              <p className="mb-4 text-xs leading-relaxed text-[#5E6E70]">
                Live mode uses only Google and Meta rows returned by the
                workspace-scoped revenue-by-channel report for this range.
                Spend entries spanning a wider period are allocated by
                inclusive calendar days.
                {liveReport?.spendAllocation?.proratedRows
                  ? ` ${liveReport.spendAllocation.proratedRows} overlapping spend row${liveReport.spendAllocation.proratedRows === 1 ? " was" : "s were"} prorated.`
                  : ""}
                {liveTotals.excludedRows > 0
                  ? ` ${liveTotals.excludedRows} other-channel row${liveTotals.excludedRows === 1 ? " was" : "s were"} excluded (£${Math.round(liveTotals.otherSpend).toLocaleString()} spend).`
                  : ""}
              </p>
              {!isMetricsLoading && !metricsError && !hasLiveInputs && (
                <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  No Google or Meta spend, leads, bookings, or attributed
                  revenue were found in this range.
                </p>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-[#5E6E70]">
                Manual mode requires all five fields. These values are saved in
                the run input and are not described as live integration data.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FormField
                    label="Google Ads Spend (£)"
                    value={fields.googleSpend}
                    onChange={updateField("googleSpend")}
                    placeholder="2400"
                    type="number"
                  />
                  {showValidation && manualValidation.errors.googleSpend && (
                    <p className="mt-1 text-xs text-red-700">
                      {manualValidation.errors.googleSpend}
                    </p>
                  )}
                </div>
                <div>
                  <FormField
                    label="Meta Ads Spend (£)"
                    value={fields.metaSpend}
                    onChange={updateField("metaSpend")}
                    placeholder="1800"
                    type="number"
                  />
                  {showValidation && manualValidation.errors.metaSpend && (
                    <p className="mt-1 text-xs text-red-700">
                      {manualValidation.errors.metaSpend}
                    </p>
                  )}
                </div>
                <div>
                  <FormField
                    label="Total Leads"
                    value={fields.leads}
                    onChange={updateField("leads")}
                    placeholder="156"
                    type="number"
                  />
                  {showValidation && manualValidation.errors.leads && (
                    <p className="mt-1 text-xs text-red-700">
                      {manualValidation.errors.leads}
                    </p>
                  )}
                </div>
                <div>
                  <FormField
                    label="Bookings"
                    value={fields.bookings}
                    onChange={updateField("bookings")}
                    placeholder="42"
                    type="number"
                  />
                  {showValidation && manualValidation.errors.bookings && (
                    <p className="mt-1 text-xs text-red-700">
                      {manualValidation.errors.bookings}
                    </p>
                  )}
                </div>
              </div>
              <FormField
                label="Revenue Generated (£)"
                value={fields.revenue}
                onChange={updateField("revenue")}
                placeholder="28600"
                type="number"
              />
              {showValidation && manualValidation.errors.revenue && (
                <p className="-mt-3 text-xs text-red-700">
                  {manualValidation.errors.revenue}
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={handleRun}
            disabled={!canGenerate || isGenerating}
            title={generationPermissionMessage || undefined}
            className="w-full mt-4 bg-[#9A5524] text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors hover:bg-[#151F21] disabled:opacity-50"
            style={{
              border: "1px solid rgba(154,85,36, 0.25)",
            }}
          >
            <Brain className="w-4 h-4" />
            {isGenerating
              ? "Generating..."
              : `Generate ${mode === "live" ? "live" : "manual"} analysis`}
          </button>
        </Card>

        {/* Output Panel */}
        <div className="space-y-4">
          {isHistoryLoading && (
            <Card className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-14 rounded-xl bg-[rgba(96,180,175,0.08)] animate-pulse"
                />
              ))}
            </Card>
          )}

          {!isHistoryLoading && !output && (
            <Card className="text-center py-8">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-20 text-[#8A9A9C]" />
              <p style={{ color: "#5E6E70" }}>
                No saved Campaign Analysis output was found in this
                workspace run history.
              </p>
            </Card>
          )}

          {!isHistoryLoading && output && (
            <>
              {selectedRun && (
                <Card>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5E6E70]">
                        Selected report
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-[#151F21]">
                        Campaign Analyst Report
                      </h2>
                    </div>
                    <div className="rounded-full border border-[#E5E7EB] bg-[#FAF9F7] px-3 py-1 text-xs font-medium text-[#5E6E70]">
                      {formatRunDate(selectedRun.createdAt)} · {selectedRun.status}
                    </div>
                  </div>
                  <div className="mt-3">
                    <AiGenerationProvenance
                      provenance={coerceAiRunProvenance(selectedRun)}
                      generatedAt={selectedRun.createdAt}
                    />
                  </div>
                </Card>
              )}

              <AlertBanner
                icon={ArrowUpRight}
                title="Modelled opportunity — not a forecast"
                description={output.projectedUplift}
                variant="success"
              />

              <Card>
                <h3
                  className="font-semibold mb-3 flex items-center gap-2"
                  style={{ color: "#151F21" }}
                >
                  <TrendingDown className="w-4 h-4 text-[#B42318]" />{" "}
                  Underperforming
                </h3>
                <div className="space-y-3">
                  {output.underperforming.length ? output.underperforming.map((item, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl"
                      style={{
                        backgroundColor: "rgba(180,35,24, 0.05)",
                        border: "1px solid rgba(180,35,24, 0.15)",
                      }}
                    >
                      <p
                        className="font-medium text-sm"
                        style={{ color: "#151F21" }}
                      >
                        {item.name}
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "#B42318" }}
                      >
                        {item.issue}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "#5E6E70" }}>
                        → {item.action}
                      </p>
                    </div>
                  )) : (
                    <p className="text-sm text-[#5E6E70]">
                      This run returned no underperformance findings.
                    </p>
                  )}
                </div>
              </Card>

              {(output.budgetShifts ?? []).length > 0 && (
                <Card>
                  <h3
                    className="font-semibold mb-3 flex items-center gap-2"
                    style={{ color: "#151F21" }}
                  >
                    <ArrowUpRight className="w-4 h-4 text-[#9A5524]" /> Budget
                    Shifts
                  </h3>
                  <div className="space-y-3">
                    {(output.budgetShifts ?? []).map((shift, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-[#E5E7EB] bg-[#FAF9F7] p-3 text-sm"
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className="font-medium text-[#151F21]">
                            {shift.from} → {shift.to}
                          </p>
                          <span className="font-semibold text-[#9A5524]">
                            {shift.amount}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#5E6E70]">
                          {shift.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card>
                <h3
                  className="font-semibold mb-3 flex items-center gap-2"
                  style={{ color: "#151F21" }}
                >
                  <TrendingUp className="w-4 h-4 text-[#315F5C]" /> Scale These
                </h3>
                <div className="space-y-3">
                  {output.highROI.length ? output.highROI.map((item, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl"
                      style={{
                        backgroundColor: "rgba(96,180,175, 0.05)",
                        border: "1px solid rgba(96,180,175, 0.15)",
                      }}
                    >
                      <div className="flex justify-between">
                        <p
                          className="font-medium text-sm"
                          style={{ color: "#151F21" }}
                        >
                          {item.name}
                        </p>
                        <span className="font-bold text-sm text-[#315F5C]">
                          {item.roas}
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: "#5E6E70" }}>
                        → {item.recommendation}
                      </p>
                    </div>
                  )) : (
                    <p className="text-sm text-[#5E6E70]">
                      No high-ROI item was supported by this run&apos;s inputs.
                    </p>
                  )}
                </div>
              </Card>

              <Card>
                <h3
                  className="font-semibold mb-3 flex items-center gap-2"
                  style={{ color: "#151F21" }}
                >
                  <AlertTriangle className="w-4 h-4 text-[#9A5524]" /> Landing
                  Page Issues
                </h3>
                <ul className="space-y-2">
                  {output.landingPageIssues.length ? output.landingPageIssues.map((issue, i) => (
                    <li
                      key={i}
                      className="text-sm flex items-start gap-2"
                      style={{ color: "#5E6E70" }}
                    >
                      <span className="text-[#9A5524] mt-0.5">•</span> {issue}
                    </li>
                  )) : (
                    <li className="text-sm text-[#5E6E70]">
                      This run returned no landing-page findings.
                    </li>
                  )}
                </ul>
              </Card>
            </>
          )}

          {!isHistoryLoading && campaignRuns.length > 0 && (
            <Card>
              <h3 className="font-semibold mb-3" style={{ color: "#151F21" }}>
                Campaign Analyst History
              </h3>
              <div className="space-y-2">
                {campaignRuns.slice(0, 5).map((run) => (
                  <button
                    type="button"
                    key={run.id}
                    onClick={() => {
                      if (isAnalysisOutput(run.output)) {
                        setSelectedRunId(run.id);
                      }
                    }}
                    disabled={!isAnalysisOutput(run.output)}
                    className="w-full rounded-xl p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      border:
                        run.id === selectedRun?.id
                          ? "1px solid rgba(96,180,175, 0.45)"
                          : "1px solid #E5E7EB",
                      backgroundColor:
                        run.id === selectedRun?.id
                          ? "rgba(96,180,175, 0.08)"
                          : "transparent",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium" style={{ color: "#151F21" }}>
                          {run.task}
                        </p>
                        <p className="text-xs" style={{ color: "#5E6E70" }}>
                          {formatRunDate(run.createdAt)} · {run.status} ·{" "}
                          {run.tokens.toLocaleString()} tokens
                        </p>
                        {isAnalysisOutput(run.output) && (
                          <div className="mt-2">
                            <AiGenerationProvenance
                              compact
                              provenance={coerceAiRunProvenance(run)}
                              generatedAt={run.createdAt}
                            />
                          </div>
                        )}
                      </div>
                      {run.id === selectedRun?.id && (
                        <span className="rounded-full bg-[rgba(96,180,175,0.12)] px-2 py-1 text-xs font-semibold text-[#151F21]">
                          Viewing
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
