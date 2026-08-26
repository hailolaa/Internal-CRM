"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import type { FleetSyncAdministrationResponse, FleetSyncException, FleetSyncHealthRow } from "@/lib/api-types";
import {
  type FleetSyncTone,
  fleetExceptionTone,
  fleetSyncSlaStatusMeta,
  fleetSyncStatusMeta,
  summarizeFleetSyncAdministration,
} from "@/lib/fleet-sync-health";
import { getDataStatePresentation } from "@/lib/data-state";
import { useAuth } from "@/lib/auth-context";
import { AlertBanner, SkeletonLine } from "@/components/ui";

function formatDateTime(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString();
}

function toneClass(tone: FleetSyncTone) {
  if (tone === "success") return "border-[#B9E2D1] bg-[#F1FAF5] text-[#23674F]";
  if (tone === "danger") return "border-[#F0C9BF] bg-[#FFF4F1] text-[#9A4B39]";
  if (tone === "warning") return "border-[#EBD3A3] bg-[#FFF8EC] text-[#8A6428]";
  return "border-black/[0.08] bg-[#F7F4F0] text-[#625F5A]";
}

function StatusPill({ label, tone }: { label: string; tone: FleetSyncTone }) {
  return (
    <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[11px] font-bold uppercase tracking-[0.08em] ${toneClass(tone)}`}>
      {label}
    </span>
  );
}

function DataStatePill({ value }: { value?: string | null }) {
  const presentation = getDataStatePresentation((value || "live").replace(/_/g, "-"));
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
    <span title={presentation.description} className={`inline-flex min-h-7 max-w-full items-center rounded-full border px-2.5 text-[11px] font-bold uppercase tracking-[0.08em] ${tone}`}>
      <span className="truncate">{presentation.label}</span>
    </span>
  );
}

function MetricTile({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: FleetSyncTone }) {
  return (
    <div className={`rounded-2xl border p-3.5 ${toneClass(tone)}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function FleetSyncHealthPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [data, setData] = useState<FleetSyncAdministrationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const summary = useMemo(() => (data ? summarizeFleetSyncAdministration(data) : null), [data]);

  const loadSyncHealth = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError("");
      setData(await api.fleetIngestion.getSyncHealth(token));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sync health could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => {
      void loadSyncHealth();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSyncHealth, token]);

  async function handleExceptionAction(exception: FleetSyncException, action = exception.action) {
    if (!token) return;
    const actionLabel = action.replace(/_/g, " ");
    const reason = action === "acknowledge" || action === "resolve" || action === "dismiss"
      ? window.prompt(`Reason to ${actionLabel} this exception`, `${actionLabel} reviewed from sync health administration.`)
      : "Replayed from sync health administration.";
    if (reason === null) return;
    setActionId(`${exception.id}:${action}`);
    setMessage(null);
    try {
      if (action === "replay" && exception.type === "dead_letter") {
        const replayed = await api.fleetIngestion.replayDeadLetterEvent(token, exception.id);
        setMessage({ type: "success", text: `Dead-letter event replayed. Current state: ${replayed.processingStatus.replace(/_/g, " ")}.` });
      } else if (action === "acknowledge" || action === "resolve" || action === "dismiss") {
        await api.fleetIngestion.administerException(token, exception.type, exception.id, action, reason || `${actionLabel} reviewed from sync health administration.`);
        const resultLabel = action === "acknowledge" ? "acknowledged" : action === "resolve" ? "resolved" : "dismissed";
        setMessage({ type: "success", text: `Exception ${resultLabel}.` });
      }
      await loadSyncHealth();
    } catch (reason) {
      setMessage({ type: "error", text: reason instanceof Error ? reason.message : "Sync health action failed." });
    } finally {
      setActionId(null);
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

  const healthRows = data?.health ?? [];
  const exceptions = data?.exceptions ?? [];

  return (
    <main className="mx-auto max-w-[1320px] space-y-4 pb-12">
      <Link href="/app/integrations" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-[#625FC7] hover:bg-[#EDEBFF]">
        <ArrowLeft className="h-4 w-4" /> Back to integrations
      </Link>

      <header className="overflow-hidden rounded-3xl border border-black/[0.06] bg-[#FFFCF9] shadow-[0_14px_44px_rgba(49,45,90,0.07)]">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center">
          <div className="flex min-w-0 gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F1F7FF] text-[#315F85]">
              <Activity className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#315F85]">Data operations</p>
              <h1 className="mt-1.5 text-2xl font-semibold text-[#171615] sm:text-3xl">Client Sync Health</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6C6761]">
                Monitor connected client feeds, freshness SLAs and replayable ingestion exceptions without exposing provider payloads.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile label="Clients" value={summary?.clients ?? 0} />
            <MetricTile label="Sources" value={summary?.sources ?? 0} />
            <MetricTile label="At risk" value={summary?.atRisk ?? 0} tone={(summary?.atRisk ?? 0) > 0 ? "warning" : "neutral"} />
            <MetricTile label="Breached" value={summary?.breached ?? 0} tone={(summary?.breached ?? 0) > 0 ? "danger" : "success"} />
          </div>
        </div>
      </header>

      {error && <AlertBanner variant="error" title="Could not load sync health" description={error} />}
      {message && (
        <AlertBanner
          variant={message.type === "success" ? "success" : "error"}
          title={message.type === "success" ? "Action complete" : "Action failed"}
          description={message.text}
        />
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <MetricTile label="Healthy sources" value={summary?.healthy ?? 0} tone="success" />
        <MetricTile label="Open exceptions" value={summary?.exceptions ?? 0} tone={(summary?.exceptions ?? 0) > 0 ? "danger" : "success"} />
        <div className="rounded-2xl border border-black/[0.08] bg-white p-3.5 text-[#171615]">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6C6761]">Scope</p>
          <p className="mt-2 text-lg font-semibold">{data?.scope === "all_clients" ? "All managed clients" : "Current workspace"}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-black/[0.06] bg-white p-4 shadow-[0_14px_44px_rgba(49,45,90,0.06)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6C6761]">Per-client feeds</p>
            <h2 className="text-xl font-semibold text-[#171615]">Sync health</h2>
          </div>
          <button
            type="button"
            onClick={() => void loadSyncHealth()}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-black/[0.08] px-3 text-sm font-semibold text-[#171615] hover:bg-[#F7F4F0]"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {healthRows.length === 0 ? (
          <EmptyState title="No configured client feeds" description="Configure a client data source before sync health can be monitored." />
        ) : (
          <div className="mt-4 grid gap-3">
            {healthRows.map((row) => (
              <SyncHealthCard key={row.sourceId} row={row} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-black/[0.06] bg-white p-4 shadow-[0_14px_44px_rgba(49,45,90,0.06)]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6C6761]">Exception administration</p>
          <h2 className="text-xl font-semibold text-[#171615]">Action queue</h2>
          <p className="mt-1 text-sm leading-6 text-[#6C6761]">Replay dead-letter events or resolve freshness and reconciliation exceptions after review.</p>
        </div>

        {exceptions.length === 0 ? (
          <EmptyState title="No open sync exceptions" description="All configured data sources are currently clear of actionable exceptions." icon="success" />
        ) : (
          <div className="mt-4 grid gap-3">
            {exceptions.map((exception) => (
              <ExceptionCard
                key={`${exception.type}:${exception.id}`}
                exception={exception}
                busyAction={actionId?.startsWith(`${exception.id}:`) ? actionId.split(":").pop() || null : null}
                onAction={(action) => void handleExceptionAction(exception, action)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function SyncHealthCard({ row }: { row: FleetSyncHealthRow }) {
  const syncMeta = fleetSyncStatusMeta(row.syncStatus);
  const slaMeta = fleetSyncSlaStatusMeta(row.slaStatus);

  return (
    <article className="rounded-2xl border border-black/[0.08] bg-[#FFFCF9] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 text-base font-semibold text-[#171615]">{row.clinicName}</h3>
            <DataStatePill value={row.sourceDataState} />
            <StatusPill label={syncMeta.label} tone={syncMeta.tone} />
            <StatusPill label={slaMeta.label} tone={slaMeta.tone} />
          </div>
          <p className="mt-1 text-sm text-[#6C6761]">{row.sourceLabel}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A8580]">
            {row.sourceSystem} / {row.sourceKey} / {row.endpointKind.replace(/_/g, " ")}
          </p>
        </div>
        <div className="grid gap-2 text-sm text-[#4D4945] sm:grid-cols-3 lg:min-w-[520px]">
          <MiniMetric label="Last processed" value={formatDateTime(row.lastProcessedEventAt)} />
          <MiniMetric label="Latest success" value={formatDateTime(row.latestSuccessfulSyncAt)} />
          <MiniMetric label="Latest failure" value={formatDateTime(row.latestFailedSyncAt)} />
          <MiniMetric label="Retrying" value={row.retryingCount} />
          <MiniMetric label="Dead letter" value={row.deadLetterCount} />
        </div>
      </div>
      {(row.lastError || row.openFreshnessAlerts > 0 || row.openReconciliationIssues > 0) && (
        <div className="mt-3 rounded-xl border border-[#EBD3A3] bg-[#FFF8EC] p-3 text-sm leading-6 text-[#715321]">
          {row.lastError || `${row.openFreshnessAlerts} freshness and ${row.openReconciliationIssues} reconciliation issue(s) need review.`}
        </div>
      )}
    </article>
  );
}

function ExceptionCard({
  exception,
  busyAction,
  onAction,
}: {
  exception: FleetSyncException;
  busyAction: string | null;
  onAction: (action: FleetSyncException["action"]) => void;
}) {
  const tone = fleetExceptionTone(exception.severity);
  const actions = exception.availableActions.filter((action) => action === "replay" || action === "acknowledge" || action === "resolve" || action === "dismiss");

  return (
    <article className="rounded-2xl border border-black/[0.08] bg-[#FFFCF9] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={exception.severity} tone={tone} />
            {exception.dataState && <DataStatePill value={exception.dataState} />}
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8A8580]">{exception.type.replace(/_/g, " ")}</span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-[#171615]">{exception.title}</h3>
          <p className="mt-1 text-sm text-[#6C6761]">{exception.clinicName}{exception.sourceLabel ? ` · ${exception.sourceLabel}` : ""}</p>
          <p className="mt-2 text-sm leading-6 text-[#4D4945]">{exception.detail}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A8580]">Detected {formatDateTime(exception.detectedAt)}</p>
          {exception.correlationId && <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A8580]">Correlation {exception.correlationId}</p>}
        </div>
        {actions.length > 0 && (
          <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
            {actions.map((action) => {
              const busy = busyAction === action;
              const label = action === "replay" ? "Replay" : action.charAt(0).toUpperCase() + action.slice(1);
              return (
                <button
                  key={action}
                  type="button"
                  disabled={Boolean(busyAction)}
                  onClick={() => onAction(action)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#171615] px-3 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {action === "replay" ? <RotateCcw className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  {busy ? "Working..." : label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A8580]">{label}</p>
      <p className="mt-1 break-words font-semibold text-[#171615]">{value}</p>
    </div>
  );
}

function EmptyState({ title, description, icon = "warning" }: { title: string; description: string; icon?: "warning" | "success" }) {
  const Icon = icon === "success" ? CheckCircle2 : AlertTriangle;
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-black/[0.14] bg-[#FFFCF9] p-6 text-center">
      <Icon className="mx-auto h-8 w-8 text-[#8A8580]" />
      <h3 className="mt-3 text-base font-semibold text-[#171615]">{title}</h3>
      <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-[#6C6761]">{description}</p>
    </div>
  );
}
