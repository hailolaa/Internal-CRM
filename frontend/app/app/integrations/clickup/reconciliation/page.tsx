"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type {
  ClickUpIntegrationStatus,
  ClickUpDeliveryProvisionFailure,
  ClickUpReconciliationResponse,
  ClickUpWebhookEventRecord,
  FailedTaskMapping,
} from "@/lib/api-types";
import {
  type ClickUpStatusTone,
  clickUpEventStatusMeta,
  clickUpSyncStatusMeta,
  summarizeClickUpReconciliation,
} from "@/lib/clickup-reconciliation";
import { getDataStatePresentation } from "@/lib/data-state";
import { useAuth } from "@/lib/auth-context";
import { AlertBanner, SkeletonLine } from "@/components/ui";

function formatDateTime(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString();
}

function toneClass(tone: ClickUpStatusTone) {
  if (tone === "success") return "border-[#B9E2D1] bg-[#F1FAF5] text-[#23674F]";
  if (tone === "danger") return "border-[#F0C9BF] bg-[#FFF4F1] text-[#9A4B39]";
  if (tone === "warning") return "border-[#EBD3A3] bg-[#FFF8EC] text-[#8A6428]";
  return "border-black/[0.08] bg-[#F7F4F0] text-[#625F5A]";
}

function StatusPill({ label, tone }: { label: string; tone: ClickUpStatusTone }) {
  return (
    <span className={`inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-bold uppercase tracking-[0.08em] ${toneClass(tone)}`}>
      {label}
    </span>
  );
}

function DataStatePill({ value, label }: { value?: string | null; label?: string | null }) {
  const presentation = getDataStatePresentation(value || "live", label);
  const tone =
    presentation.tone === "live"
      ? "border-[#B9E2D1] bg-[#F1FAF5] text-[#23674F]"
      : presentation.tone === "demo"
        ? "border-[#C9C7FF] bg-[#F1F0FF] text-[#5751B5]"
        : presentation.tone === "info"
          ? "border-[#C9DDF8] bg-[#F1F7FF] text-[#315F85]"
          : presentation.tone === "warning"
            ? "border-[#EBD3A3] bg-[#FFF8EC] text-[#8A6428]"
            : "border-black/[0.08] bg-[#F7F4F0] text-[#625F5A]";

  return (
    <span className={`inline-flex min-h-7 max-w-full items-center rounded-full border px-2.5 text-[11px] font-bold uppercase tracking-[0.08em] ${tone}`}>
      <span className="truncate">{presentation.label}</span>
    </span>
  );
}

function MetricTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: ClickUpStatusTone;
}) {
  return (
    <div className={`rounded-2xl border p-3.5 ${toneClass(tone)}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function ReconciliationPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [data, setData] = useState<ClickUpReconciliationResponse | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<ClickUpIntegrationStatus | null>(null);
  const [deliveryFailures, setDeliveryFailures] = useState<ClickUpDeliveryProvisionFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [runningReconciliation, setRunningReconciliation] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const summary = useMemo(
    () => (data ? summarizeClickUpReconciliation(data) : null),
    [data],
  );

  const loadReconciliation = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError("");
      const [status, reconciliation, provisionFailures] = await Promise.all([
        api.clickup.getStatus(token),
        api.clickup.getReconciliationStatus(token),
        api.clickup.listDeliveryProvisionFailures(token),
      ]);
      setIntegrationStatus(status);
      setData(reconciliation);
      setDeliveryFailures(provisionFailures);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ClickUp sync status could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => {
      void loadReconciliation();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReconciliation, token]);

  async function handleRunReconciliation() {
    if (!token) return;
    setRunningReconciliation(true);
    setMessage(null);
    try {
      const result = await api.clickup.runReconciliation(token);
      setMessage({
        type: "success",
        text: `Reconciliation checked ${result.checked} mapped task${result.checked === 1 ? "" : "s"} and queued ${result.queuedForReview} for review.`,
      });
      await loadReconciliation();
    } catch (reason) {
      setMessage({ type: "error", text: reason instanceof Error ? reason.message : "Reconciliation could not be run." });
    } finally {
      setRunningReconciliation(false);
    }
  }

  async function handleReplay(taskId: string) {
    if (!token) return;
    setReplayingId(taskId);
    setMessage(null);
    try {
      const response = await api.clickup.replayFailedTaskMapping(token, taskId);
      setMessage({ type: "success", text: response.message });
      await loadReconciliation();
    } catch (reason) {
      setMessage({ type: "error", text: reason instanceof Error ? reason.message : "Replay failed." });
    } finally {
      setReplayingId(null);
    }
  }

  async function handleReplayDeadLetter(event: ClickUpWebhookEventRecord) {
    if (!token) return;
    setReplayingId(event.id);
    setMessage(null);
    try {
      const replayed = await api.clickup.replayDeadLetterEvent(token, event.id);
      const meta = clickUpEventStatusMeta(replayed.processingStatus);
      setMessage({ type: "success", text: `Dead-letter event replayed. Current state: ${meta.label}.` });
      await loadReconciliation();
    } catch (reason) {
      setMessage({ type: "error", text: reason instanceof Error ? reason.message : "Dead-letter replay failed." });
    } finally {
      setReplayingId(null);
    }
  }

  async function handleDismiss(taskId: string) {
    if (!token) return;
    setDismissingId(taskId);
    setMessage(null);
    try {
      await api.clickup.dismissFailedTaskMapping(token, taskId);
      setMessage({ type: "success", text: "Task mapping dismissed." });
      await loadReconciliation();
    } catch (reason) {
      setMessage({ type: "error", text: reason instanceof Error ? reason.message : "Dismiss failed." });
    } finally {
      setDismissingId(null);
    }
  }

  async function handleRetryProvision(provisionId: string) {
    if (!token) return;
    setReplayingId(provisionId);
    setMessage(null);
    try {
      await api.clickup.retryDeliveryProvision(token, provisionId);
      setMessage({ type: "success", text: "Delivery provision requeued. The background worker will resume from its saved checkpoint." });
      await loadReconciliation();
    } catch (reason) {
      setMessage({ type: "error", text: reason instanceof Error ? reason.message : "Delivery provision could not be requeued." });
    } finally {
      setReplayingId(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-[1320px] space-y-4 pb-12">
        <SkeletonLine className="h-10 w-1/3" />
        <SkeletonLine className="h-48 w-full" />
        <SkeletonLine className="h-72 w-full" />
      </main>
    );
  }

  const healthRows = data?.syncHealth ?? [];
  const failedMappings = data?.failedTaskMappings ?? [];
  const deadLetterEvents = data?.deadLetterEvents ?? [];
  const webhookConfigured = integrationStatus?.webhookConfigured ?? false;
  const connectedCount = integrationStatus?.connections.filter((connection) => connection.status === "connected").length ?? 0;

  return (
    <main className="mx-auto max-w-[1320px] space-y-4 pb-12">
      <Link href="/app/integrations/clickup" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-[#625FC7] hover:bg-[#EDEBFF]">
        <ArrowLeft className="h-4 w-4" /> Back to ClickUp mappings
      </Link>

      <header className="overflow-hidden rounded-3xl border border-black/[0.06] bg-[#FFFCF9] shadow-[0_14px_44px_rgba(49,45,90,0.07)]">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
          <div className="flex min-w-0 gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF8EC] text-[#8A6428]">
              <Activity className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A6428]">Lifecycle reconciliation</p>
              <h1 className="mt-1.5 text-2xl font-semibold text-[#171615] sm:text-3xl">ClickUp Sync Health</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6C6761]">
                Monitor mapped client sync health, replay controlled failures, and run a scoped reconciliation of known ClickUp task mappings.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricTile label="Mapped clients" value={summary?.clients ?? 0} tone="neutral" />
            <MetricTile label="Healthy" value={summary?.healthy ?? 0} tone="success" />
            <MetricTile label="Needs review" value={summary?.reviewNeeded ?? 0} tone={(summary?.reviewNeeded ?? 0) > 0 ? "warning" : "neutral"} />
            <MetricTile label="Dead letter" value={summary?.deadLetter ?? 0} tone={(summary?.deadLetter ?? 0) > 0 ? "danger" : "neutral"} />
          </div>
        </div>
      </header>

      {error && <AlertBanner variant="error" title="Could not load ClickUp sync status" description={error} />}
      {message && (
        <AlertBanner
          variant={message.type === "success" ? "success" : "error"}
          title={message.type === "success" ? "Action complete" : "Action failed"}
          description={message.text}
        />
      )}
      {!webhookConfigured && (
        <AlertBanner
          icon={AlertTriangle}
          variant="warning"
          title="Webhook signing is not configured"
          description="ClickUp task creation can still work, but inbound lifecycle events require the signed webhook secret before production sync can be fully live."
        />
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-3xl border border-black/[0.06] bg-[#FFFCF9] p-4 shadow-[0_10px_34px_rgba(49,45,90,0.05)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#625F5A]">Connection</p>
          <div className="mt-3 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#31735F]" />
            <p className="text-lg font-semibold text-[#1E1C1A]">{connectedCount} connected</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-[#6C6761]">OAuth/API-token state remains token-safe and server-side.</p>
        </div>
        <div className="rounded-3xl border border-black/[0.06] bg-[#FFFCF9] p-4 shadow-[0_10px_34px_rgba(49,45,90,0.05)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#625F5A]">Webhook</p>
          <div className="mt-3">
            <StatusPill label={webhookConfigured ? "Signed intake ready" : "Configuration needed"} tone={webhookConfigured ? "success" : "warning"} />
          </div>
          <p className="mt-2 text-xs leading-5 text-[#6C6761]">Inbound events are accepted only through the signed provider webhook.</p>
        </div>
        <div className="rounded-3xl border border-black/[0.06] bg-[#FFFCF9] p-4 shadow-[0_10px_34px_rgba(49,45,90,0.05)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#625F5A]">Manual check</p>
          <button
            onClick={handleRunReconciliation}
            disabled={runningReconciliation}
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#171615] px-4 text-sm font-semibold text-white hover:bg-[#302E2B] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${runningReconciliation ? "animate-spin" : ""}`} />
            {runningReconciliation ? "Checking..." : "Run reconciliation"}
          </button>
          <p className="mt-2 text-xs leading-5 text-[#6C6761]">Checks known mapped tasks only, not the whole ClickUp workspace.</p>
        </div>
      </section>

      <DeliveryProvisionIncidents
        failures={deliveryFailures}
        replayingId={replayingId}
        onRetry={handleRetryProvision}
      />

      <section className="rounded-3xl border border-black/[0.06] bg-[#FFFCF9] p-4 shadow-[0_10px_34px_rgba(49,45,90,0.05)] sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#1E1C1A]">Client Sync Health ({healthRows.length})</h2>
            <p className="mt-1 text-sm text-[#6C6761]">Per-client lifecycle sync status for active ClickUp mappings.</p>
          </div>
          <button onClick={loadReconciliation} className="inline-flex items-center gap-2 self-start text-sm font-medium text-[#625FC7] hover:text-[#5A56D4]">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {healthRows.length === 0 ? (
          <EmptyReconciliationState title="No active client mappings" description="Map a client to a ClickUp list before lifecycle sync health can be shown." />
        ) : (
          <div className="grid gap-3">
            {healthRows.map((row) => {
              const meta = clickUpSyncStatusMeta(row.syncStatus);
              return (
                <article key={row.id} className="rounded-2xl border border-black/[0.06] bg-white p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-[#1E1C1A]">{row.clientName}</h3>
                        <DataStatePill value={row.clientDataState} label={row.clientDataStateLabel} />
                        <StatusPill label={meta.label} tone={meta.tone} />
                      </div>
                      <p className="mt-1 text-sm leading-5 text-[#6C6761]">{meta.description}</p>
                      {row.lastError && <p className="mt-2 text-xs leading-5 text-[#9A4B39]">{row.lastError}</p>}
                    </div>
                    <div className="grid gap-2 text-xs text-[#6C6761] sm:grid-cols-3 md:min-w-[420px]">
                      <Info label="Last event" value={formatDateTime(row.lastEventAt)} />
                      <Info label="Processed" value={formatDateTime(row.lastProcessedEventAt)} />
                      <Info label="Reconciled" value={formatDateTime(row.lastReconciledAt)} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ReviewMappings
          tasks={failedMappings}
          replayingId={replayingId}
          dismissingId={dismissingId}
          onReplay={handleReplay}
          onDismiss={handleDismiss}
        />
        <DeadLetterEvents
          events={deadLetterEvents}
          replayingId={replayingId}
          onReplay={handleReplayDeadLetter}
        />
      </section>
    </main>
  );
}

function DeliveryProvisionIncidents({
  failures,
  replayingId,
  onRetry,
}: {
  failures: ClickUpDeliveryProvisionFailure[];
  replayingId: string | null;
  onRetry: (provisionId: string) => void;
}) {
  const exhausted = failures.filter((row) => row.retryState === "exhausted").length;
  const scheduled = failures.filter((row) => row.retryState === "scheduled").length;

  return (
    <section className="overflow-hidden rounded-3xl border border-black/[0.06] bg-[#171615] text-white shadow-[0_16px_44px_rgba(23,22,21,0.14)]">
      <div className="grid gap-4 border-b border-white/10 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="flex gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F2A65A]/15 text-[#F7B978]">
            <Boxes className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#F7B978]">Accepted proposal automation</p>
            <h2 className="mt-1 text-xl font-semibold">Delivery Provision Incidents ({failures.length})</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-white/60">Failures creating ClickUp folders, lists, root tasks, subtasks, or checklists. Requeues resume from the last saved checkpoint.</p>
          </div>
        </div>
        <div className="flex gap-2 text-xs font-semibold">
          <span className="rounded-full border border-[#F7B978]/30 bg-[#F7B978]/10 px-3 py-1.5 text-[#FFD0A0]">{scheduled} scheduled</span>
          <span className="rounded-full border border-[#EF8F7C]/30 bg-[#EF8F7C]/10 px-3 py-1.5 text-[#FFB6A7]">{exhausted} exhausted</span>
        </div>
      </div>

      {failures.length === 0 ? (
        <div className="flex items-center gap-3 p-5 text-sm text-white/70">
          <CheckCircle2 className="h-5 w-5 text-[#80D4AF]" aria-hidden="true" />
          No delivery provisions need attention.
        </div>
      ) : (
        <div className="grid gap-px bg-white/10 lg:grid-cols-2">
          {failures.map((failure) => {
            const isReplaying = replayingId === failure.id;
            const packageLabel = failure.payload?.packageName || failure.payload?.packageId || "Package not recorded";
            const checkpointCount = Number(Boolean(failure.clickUpFolderId)) + Number(Boolean(failure.clickUpListId));
            return (
              <article key={failure.id} className="bg-[#211F1D] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{failure.clientName}</p>
                    <p className="mt-1 truncate text-xs text-white/50">{packageLabel}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${failure.retryState === "exhausted" ? "border-[#EF8F7C]/40 bg-[#EF8F7C]/10 text-[#FFB6A7]" : "border-[#F7B978]/40 bg-[#F7B978]/10 text-[#FFD0A0]"}`}>
                    {failure.retryState}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-[auto_1fr] gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#F7B978]/35 text-sm font-bold text-[#FFD0A0]">
                    {failure.attemptCount}/{failure.maxAttempts}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Checkpoint progress</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                      <span className={`rounded-md px-2 py-1 ${failure.clickUpFolderId ? "bg-[#80D4AF]/15 text-[#A9E8CC]" : "bg-white/5 text-white/40"}`}>Folder</span>
                      <span className={`rounded-md px-2 py-1 ${failure.clickUpListId ? "bg-[#80D4AF]/15 text-[#A9E8CC]" : "bg-white/5 text-white/40"}`}>List</span>
                      <span className="rounded-md bg-white/5 px-2 py-1 text-white/55">{checkpointCount}/2 structure steps</span>
                    </div>
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 text-xs leading-5 text-[#FFB6A7]">{failure.failureReason || "No failure reason recorded."}</p>
                <div className="mt-3 grid gap-1 text-[11px] text-white/45 sm:grid-cols-2">
                  <span>Last attempt: {formatDateTime(failure.lastAttemptAt)}</span>
                  <span>Next retry: {failure.retryState === "exhausted" ? "Manual requeue required" : formatDateTime(failure.nextAttemptAt)}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => onRetry(failure.id)}
                    disabled={isReplaying}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#F7B978] px-3 text-xs font-bold text-[#2A2119] transition hover:bg-[#FFD0A0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD0A0] focus-visible:ring-offset-2 focus-visible:ring-offset-[#211F1D] disabled:opacity-50"
                  >
                    <RotateCcw className={`h-3.5 w-3.5 ${isReplaying ? "animate-spin" : ""}`} aria-hidden="true" />
                    {isReplaying ? "Requeueing..." : "Requeue provision"}
                  </button>
                  {failure.deliveryUrl && (
                    <a href={failure.deliveryUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/15 px-3 text-xs font-semibold text-white/75 hover:bg-white/5">
                      Open checkpoint <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#F7F4F0] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#817B75]">{label}</p>
      <p className="mt-1 font-medium text-[#302D2A]">{value}</p>
    </div>
  );
}

function EmptyReconciliationState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/[0.1] bg-[#F7F4F0] p-8 text-center">
      <CheckCircle2 className="mx-auto h-8 w-8 text-[#31735F]" />
      <h3 className="mt-4 text-sm font-semibold text-[#302D2A]">{title}</h3>
      <p className="mt-1 text-sm text-[#817B75]">{description}</p>
    </div>
  );
}

function ReviewMappings({
  tasks,
  replayingId,
  dismissingId,
  onReplay,
  onDismiss,
}: {
  tasks: FailedTaskMapping[];
  replayingId: string | null;
  dismissingId: string | null;
  onReplay: (taskId: string) => void;
  onDismiss: (taskId: string) => void;
}) {
  return (
    <section className="rounded-3xl border border-black/[0.06] bg-[#FFFCF9] p-4 shadow-[0_10px_34px_rgba(49,45,90,0.05)] sm:p-5">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-[#1E1C1A]">Mappings Needing Review ({tasks.length})</h2>
        <p className="mt-1 text-sm text-[#6C6761]">Outbound task mappings that need replay, dismissal, or a mapping review.</p>
      </div>

      {tasks.length === 0 ? (
        <EmptyReconciliationState title="No task mappings need review" description="Mapped task creation state is clean." />
      ) : (
        <div className="grid gap-3">
          {tasks.map((task) => {
            const isReplaying = replayingId === task.id;
            const isDismissing = dismissingId === task.id;
            const isBusy = isReplaying || isDismissing;

            return (
              <article key={task.id} className="rounded-2xl border border-black/[0.06] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#817B75]">{task.clientName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-[#302D2A]">{task.internalTaskTitle || "Task mapping"}</h3>
                  <DataStatePill value={task.clientDataState} label={task.clientDataStateLabel} />
                </div>
                <p className="mt-2 text-xs text-[#817B75]">Updated {formatDateTime(task.updatedAt)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => onDismiss(task.id)}
                    disabled={isBusy}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-black/[0.1] bg-white px-3 text-xs font-semibold text-[#8A6428] hover:bg-[#FFF8EC] disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {isDismissing ? "Dismissing..." : "Dismiss"}
                  </button>
                  <button
                    onClick={() => onReplay(task.id)}
                    disabled={isBusy}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#171615] px-3 text-xs font-semibold text-white hover:bg-[#302E2B] disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isReplaying ? "animate-spin" : ""}`} />
                    {isReplaying ? "Replaying..." : "Replay"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DeadLetterEvents({
  events,
  replayingId,
  onReplay,
}: {
  events: ClickUpWebhookEventRecord[];
  replayingId: string | null;
  onReplay: (event: ClickUpWebhookEventRecord) => void;
}) {
  return (
    <section className="rounded-3xl border border-black/[0.06] bg-[#FFFCF9] p-4 shadow-[0_10px_34px_rgba(49,45,90,0.05)] sm:p-5">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-[#1E1C1A]">Dead-Letter Events ({events.length})</h2>
        <p className="mt-1 text-sm text-[#6C6761]">Webhook lifecycle events whose safe retries are exhausted.</p>
      </div>

      {events.length === 0 ? (
        <EmptyReconciliationState title="No dead-letter events" description="No lifecycle events currently need controlled replay." />
      ) : (
        <div className="grid gap-3">
          {events.map((event) => {
            const meta = clickUpEventStatusMeta(event.processingStatus);
            const isReplaying = replayingId === event.id;
            return (
              <article key={event.id} className="rounded-2xl border border-black/[0.06] bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#817B75]">{event.clientName || "Mapped client"}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-[#302D2A]">{event.providerEventType}</h3>
                      <DataStatePill value={event.clientDataState} label={event.clientDataStateLabel} />
                    </div>
                  </div>
                  <StatusPill label={meta.label} tone={meta.tone} />
                </div>
                <div className="mt-3 grid gap-2 text-xs text-[#6C6761] sm:grid-cols-2">
                  <Info label="Received" value={formatDateTime(event.receivedAt)} />
                  <Info label="Retries" value={String(event.retryCount)} />
                </div>
                {event.errorMessage && <p className="mt-3 text-xs leading-5 text-[#9A4B39]">{event.errorMessage}</p>}
                <button
                  onClick={() => onReplay(event)}
                  disabled={isReplaying}
                  className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#171615] px-3 text-xs font-semibold text-white hover:bg-[#302E2B] disabled:opacity-50"
                >
                  <RotateCcw className={`h-3.5 w-3.5 ${isReplaying ? "animate-spin" : ""}`} />
                  {isReplaying ? "Replaying..." : "Replay event"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
