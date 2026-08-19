"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquare,
  PhoneMissed,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { PageHeader, AlertBanner, EmptyState, SkeletonLine } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { MissedCallRecoveryRecord, MissedCallRecoveryState } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import {
  formatMissedCallTimestamp,
  groupMissedCallRecoveries,
  missedCallRecoveryStateLabels,
  missedCallRecoveryTransitions,
  missedCallSlaStatusLabels,
} from "@/lib/missed-call-recovery";

const filterTabs = [
  { key: "active", label: "Active" },
  { key: "overdue", label: "Overdue" },
  { key: "voicemail", label: "Voicemail" },
  { key: "contacted", label: "Contacted" },
  { key: "booked", label: "Booked" },
  { key: "closed", label: "Closed" },
] as const;

type FilterKey = (typeof filterTabs)[number]["key"];

function slaTone(status: MissedCallRecoveryRecord["slaStatus"]) {
  switch (status) {
    case "overdue":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "due_soon":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "completed_within_sla":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "completed_after_sla":
      return "border-orange-200 bg-orange-50 text-orange-700";
    default:
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }
}

function stateTone(state: MissedCallRecoveryState) {
  switch (state) {
    case "booked":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "closed_no_response":
      return "bg-stone-100 text-stone-700 border-stone-200";
    case "contacted":
      return "bg-cyan-50 text-cyan-700 border-cyan-200";
    default:
      return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

export default function MissedCallRecoveryPage() {
  const { session, hasPermission } = useAuth();
  const [records, setRecords] = useState<MissedCallRecoveryRecord[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("active");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const canWrite = hasPermission("calls:write");
  const token = session?.token || "";

  const loadQueue = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setLoadError("");
    try {
      const response = await api.missedCallRecovery.list(token);
      setRecords(response.records);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Missed-call recovery could not be loaded.");
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadQueue();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadQueue]);

  const grouped = useMemo(() => groupMissedCallRecoveries(records), [records]);
  const visibleRecords = useMemo(() => {
    switch (activeFilter) {
      case "overdue":
        return grouped.overdue;
      case "voicemail":
        return grouped.voicemail;
      case "contacted":
        return grouped.contacted;
      case "booked":
        return grouped.booked;
      case "closed":
        return grouped.closedNoResponse;
      default:
        return records.filter((record) => record.state === "attempted" || record.state === "contacted");
    }
  }, [activeFilter, grouped, records]);

  const updateState = useCallback(
    async (record: MissedCallRecoveryRecord, state: MissedCallRecoveryState) => {
      if (!token) return;
      setActionId(`${record.id}:${state}`);
      setActionError("");
      setActionMessage("");
      try {
        const updated = await api.missedCallRecovery.updateState(token, record.id, state);
        setRecords((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setActionMessage(`Recovery marked ${missedCallRecoveryStateLabels[state].toLowerCase()}.`);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Recovery state could not be updated.");
      } finally {
        setActionId(null);
      }
    },
    [token],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Missed-call recovery"
        subtitle="Work eligible ClinicGrower missed-call recovery events before the callback SLA expires."
        icon={PhoneMissed}
        iconColor="text-[#2F7D78]"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/app/comms/calls" className="btn-secondary text-sm">
              Call Intelligence
            </Link>
            <button onClick={loadQueue} disabled={isLoading} className="btn-secondary text-sm">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QueueStat label="Active" value={String(grouped.pending.length + grouped.contacted.length)} icon={Clock3} tone="cyan" />
        <QueueStat label="Overdue" value={String(grouped.overdue.length)} icon={AlertTriangle} tone="rose" />
        <QueueStat label="Voicemail" value={String(grouped.voicemail.length)} icon={MessageSquare} tone="amber" />
        <QueueStat label="Booked" value={String(grouped.booked.length)} icon={CheckCircle2} tone="emerald" />
      </div>

      {loadError && (
        <AlertBanner
          variant="warning"
          title="Missed-call recovery could not be loaded"
          description={loadError}
        />
      )}
      {actionError && <AlertBanner variant="error" title="Recovery update failed" description={actionError} />}
      {actionMessage && <AlertBanner variant="success" title="Recovery updated" description={actionMessage} />}

      <div className="flex flex-wrap gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
              activeFilter === tab.key
                ? "border-[#2F7D78] bg-[#DFF1EF] text-[#0C2A30]"
                : "border-[#E5DED6] bg-white text-[#5e8a8d] hover:border-[#b9cfcb]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-3xl border border-[#E5DED6] bg-[#FFFCF9]">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, index) => <SkeletonLine key={index} className="h-24 w-full" />)}
          </div>
        ) : visibleRecords.length > 0 ? (
          <div className="divide-y divide-[#EDE8E2]">
            {visibleRecords.map((record) => (
              <article key={record.id} className="p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${stateTone(record.state)}`}>
                        {missedCallRecoveryStateLabels[record.state]}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${slaTone(record.slaStatus)}`}>
                        {missedCallSlaStatusLabels[record.slaStatus]}
                      </span>
                      {record.missedCallState === "voicemail" || record.voicemailState ? (
                        <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">
                          Voicemail eligible
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-3 text-lg font-bold text-[#151f21]">
                      {record.contactName}
                    </h2>
                    <div className="mt-2 grid gap-2 text-sm text-[#5e8a8d] md:grid-cols-2 xl:grid-cols-4">
                      <span><strong className="text-[#151f21]">Client:</strong> {record.clientName}</span>
                      <span><strong className="text-[#151f21]">Owner:</strong> {record.ownerLabel}</span>
                      <span><strong className="text-[#151f21]">SLA:</strong> {formatMissedCallTimestamp(record.recoverySlaTargetAt)}</span>
                      <span><strong className="text-[#151f21]">Source:</strong> {record.source || "ClinicGrower"}</span>
                      <span className="md:col-span-2 xl:col-span-4">
                        <strong className="text-[#151f21]">Call:</strong> {record.providerCallSid || record.clinicGrowerCallId}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                      <Link
                        href={`/app/crm/contacts/detail?id=${encodeURIComponent(record.contactId)}&from=missed-call-recovery`}
                        className="inline-flex items-center gap-1 rounded-xl border border-[#E5DED6] bg-white px-3 py-2 text-[#151f21] hover:border-[#b9cfcb]"
                      >
                        <UserRound className="h-3.5 w-3.5" /> Contact
                      </Link>
                      {record.clientClinicId && (
                        <Link
                          href={`/app/ops/client-accounts/detail?id=${encodeURIComponent(record.clientClinicId)}&from=missed-call-recovery`}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#E5DED6] bg-white px-3 py-2 text-[#151f21] hover:border-[#b9cfcb]"
                        >
                          Client <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      {record.taskId && (
                        <Link
                          href={`/app/crm/tasks/detail?id=${encodeURIComponent(record.taskId)}&from=missed-call-recovery`}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#E5DED6] bg-white px-3 py-2 text-[#151f21] hover:border-[#b9cfcb]"
                        >
                          Task <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:max-w-[360px] xl:justify-end">
                    {canWrite ? (
                      missedCallRecoveryTransitions[record.state].map((state) => (
                        <button
                          key={state}
                          onClick={() => updateState(record, state)}
                          disabled={Boolean(actionId)}
                          className="rounded-xl bg-[#151f21] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0C2A30] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actionId === `${record.id}:${state}` ? (
                            <span className="inline-flex items-center gap-1">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving
                            </span>
                          ) : (
                            <>Mark {missedCallRecoveryStateLabels[state].toLowerCase()}</>
                          )}
                        </button>
                      ))
                    ) : (
                      <span className="rounded-xl border border-[#E5DED6] bg-white px-3 py-2 text-sm font-semibold text-[#5e8a8d]">
                        Read-only
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={PhoneMissed}
            title="No missed-call recovery items in this view"
            description="Eligible ClinicGrower missed calls will appear here once the signed event is accepted and mapped."
          />
        )}
      </section>
    </div>
  );
}

function QueueStat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  tone: "cyan" | "rose" | "amber" | "emerald";
}) {
  const tones = {
    cyan: "border-cyan-100 bg-cyan-50 text-cyan-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em]">{label}</p>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}
