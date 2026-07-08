"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  BellRing,
  CheckCircle,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  PlayCircle,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  AlertBanner,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  DataProvenanceBadge,
  ConfidenceIndicator,
  ProvenanceSummary,
} from "@/components/ui";
import { SearchInput } from "@/components/ui/forms";
import { DetailGrid } from "@/components/ui/shared";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import type {
  InsightRecord,
  InsightSeverity,
  InsightStatus,
  TeamMember,
} from "@/lib/api-types";

type StatusFilter = InsightStatus | "all";
type SeverityFilter = InsightSeverity | "all";

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "archived", label: "Archived" },
];

const severityOptions: { value: SeverityFilter; label: string }[] = [
  { value: "all", label: "All severity" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const severityStyles: Record<
  InsightSeverity,
  { variant: "error" | "warning" | "info" | "neutral"; color: string }
> = {
  critical: { variant: "error", color: "#9a5524" },
  high: { variant: "warning", color: "#b7672e" },
  medium: { variant: "info", color: "#5e8a8d" },
  low: { variant: "neutral", color: "#5e8a8d" },
};

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatLabel(value: string | null) {
  if (!value) return "Unlinked";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function sourceHref(insight: InsightRecord) {
  const type = insight.sourceType?.toLowerCase() ?? "";
  if (type.includes("call")) return "/app/comms/calls";
  if (type.includes("appointment") || type.includes("booking")) {
    return "/app/crm/calendar";
  }
  if (type.includes("form")) return "/app/crm/forms/submissions";
  if (type.includes("message") || type.includes("email") || type.includes("sms")) {
    return "/app/comms/inbox";
  }
  if (insight.sourceContactId) return "/app/crm/contacts";
  if (type.includes("campaign") || type.includes("source")) {
    return "/app/marketing/attribution";
  }
  return "/app/revenue";
}

function metadataValue(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return value.toLocaleString("en-GB");
  return null;
}

function metadataPath(
  metadata: Record<string, unknown> | null,
  path: string[],
) {
  let current: unknown = metadata;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" && current.trim() ? current : null;
}

function memberName(member: TeamMember) {
  return (
    [member.firstName, member.lastName].filter(Boolean).join(" ").trim() ||
    member.email
  );
}

export default function AlertInboxPage() {
  const { session } = useAuth();
  const { addToast } = useToast();
  const [alerts, setAlerts] = useState<InsightRecord[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const selected = alerts.find((alert) => alert.id === selectedId) ?? alerts[0];
  const selectedGenerationProvider = metadataPath(selected?.metadata ?? null, [
    "generation",
    "provider",
  ]);
  const selectedFallbackReason = metadataPath(selected?.metadata ?? null, [
    "generation",
    "fallbackReason",
  ]);
  const assignableMembers = useMemo(
    () =>
      members.filter(
        (member) => !member.isInvitation && member.status === "active",
      ),
    [members],
  );

  const applyAlertRows = useCallback((rows: InsightRecord[]) => {
    setAlerts(rows);
    setSelectedId((current) =>
      current && rows.some((row) => row.id === current)
        ? current
        : rows[0]?.id ?? null,
    );
  }, []);

  const loadAlerts = async () => {
    if (!session?.token) return;
    setIsLoading(true);
    try {
      const rows = await api.insights.list(session.token, {
        status,
        severity,
      });
      applyAlertRows(rows);
      setLoadError(null);
    } catch (error) {
      console.error("Failed to load alert inbox", error);
      setLoadError(
        error instanceof Error ? error.message : "Unable to load alert inbox.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    api.insights
      .list(session.token, { status, severity })
      .then((rows) => {
        if (cancelled) return;
        applyAlertRows(rows);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to load alert inbox", error);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load alert inbox.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyAlertRows, session?.token, status, severity]);

  useEffect(() => {
    if (!session?.token) return;

    api.team
      .getMembers(session.token)
      .then(setMembers)
      .catch((error) => {
        console.error("Failed to load team members for alert assignment", error);
      });
  }, [session?.token]);

  const filteredAlerts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return alerts;
    return alerts.filter((alert) =>
      [
        alert.title,
        alert.summary,
        alert.recommendedAction,
        alert.type,
        alert.sourceType,
        alert.assignedToName,
        metadataValue(alert.metadata, "contactName"),
        metadataValue(alert.metadata, "treatment"),
        metadataValue(alert.metadata, "source"),
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [alerts, searchQuery]);

  const stats = useMemo(() => {
    const active = alerts.filter((alert) =>
      ["open", "in_progress"].includes(alert.status),
    );
    return {
      active: active.length,
      critical: active.filter((alert) => alert.severity === "critical").length,
      high: active.filter((alert) => alert.severity === "high").length,
      tasked: alerts.filter((alert) => alert.actionTaskId).length,
    };
  }, [alerts]);

  const updateSelectedAlert = (updated: InsightRecord) => {
    setAlerts((current) =>
      current.map((alert) => (alert.id === updated.id ? updated : alert)),
    );
    setSelectedId(updated.id);
  };

  const handleGenerate = async () => {
    if (!session?.token) return;
    setIsGenerating(true);
    try {
      const result = await api.insights.generate(session.token);
      setAlerts(result.insights);
      setSelectedId(result.insights[0]?.id ?? null);
      addToast(
        `${result.generatedCount} generated, ${result.existingCount} already open`,
        "success",
      );
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Could not generate alerts",
        "error",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStatus = async (alert: InsightRecord, nextStatus: InsightStatus) => {
    if (!session?.token) return;
    setIsMutating(true);
    try {
      await api.insights.updateStatus(session.token, alert.id, nextStatus);
      updateSelectedAlert({
        ...alert,
        status: nextStatus,
        resolvedAt:
          nextStatus === "resolved" ? new Date().toISOString() : alert.resolvedAt,
      });
      addToast(`Alert marked ${formatLabel(nextStatus).toLowerCase()}.`);
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Could not update alert",
        "error",
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleCreateTask = async (alert: InsightRecord) => {
    if (!session?.token) return;
    setIsMutating(true);
    try {
      const result = await api.insights.createTask(session.token, alert.id);
      updateSelectedAlert(result.insight);
      addToast(result.existing ? "Linked task already exists." : "Action task created.");
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Could not create task",
        "error",
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleAssign = async (alert: InsightRecord, assignedTo: string) => {
    if (!session?.token) return;
    setIsMutating(true);
    try {
      await api.insights.assign(session.token, alert.id, {
        assignedTo: assignedTo || null,
      });
      const member = assignableMembers.find((row) => row.id === assignedTo);
      updateSelectedAlert({
        ...alert,
        assignedTo: assignedTo || null,
        assignedToName: member ? memberName(member) : null,
      });
      addToast("Alert owner updated.");
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Could not assign alert",
        "error",
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleDueDate = async (alert: InsightRecord, dueDate: string) => {
    if (!session?.token) return;
    setIsMutating(true);
    try {
      await api.insights.assign(session.token, alert.id, {
        dueDate: dueDate || null,
      });
      updateSelectedAlert({ ...alert, dueDate: dueDate || null });
      addToast("Alert due date updated.");
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Could not update due date",
        "error",
      );
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alert Inbox"
        subtitle="Review revenue risks, AI insights, and follow-up actions."
        icon={BellRing}
        right={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadAlerts}
              className="btn-secondary w-fit"
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={handleGenerate}
              className="btn-primary w-fit"
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Generate
            </button>
          </div>
        }
      />

      {loadError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Alert inbox could not load"
          description={loadError}
          variant="error"
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Active alerts" value={String(stats.active)} icon={BellRing} color="blue" />
        <StatCard label="Critical" value={String(stats.critical)} icon={AlertTriangle} color="red" />
        <StatCard label="High priority" value={String(stats.high)} icon={PlayCircle} color="amber" />
        <StatCard label="Linked tasks" value={String(stats.tasked)} icon={ClipboardCheck} color="green" />
      </div>

      <div className="flex flex-col xl:flex-row gap-4">
        <div className="xl:w-[44%] space-y-3">
          <Card padding="p-4">
            <div className="space-y-3">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search alerts, contacts, treatments..."
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as StatusFilter)}
                  className="w-full rounded-2xl border border-[rgba(21,31,33,0.08)] bg-[#FFFCF9] px-3 py-2.5 text-sm text-[#151f21] outline-none"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={severity}
                  onChange={(event) =>
                    setSeverity(event.target.value as SeverityFilter)
                  }
                  className="w-full rounded-2xl border border-[rgba(21,31,33,0.08)] bg-[#FFFCF9] px-3 py-2.5 text-sm text-[#151f21] outline-none"
                >
                  {severityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <div className="space-y-2">
            {isLoading ? (
              <Card padding="p-5">
                <div className="flex items-center gap-3 text-sm text-[#5e8a8d]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading alert inbox...
                </div>
              </Card>
            ) : filteredAlerts.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No alerts found"
                description="Try a different filter or generate fresh revenue leakage insights."
              />
            ) : (
              filteredAlerts.map((alert) => {
                const isSelected = selected?.id === alert.id;
                const severityStyle = severityStyles[alert.severity];
                return (
                  <button
                    key={alert.id}
                    onClick={() => setSelectedId(alert.id)}
                    className="block w-full text-left"
                  >
                    <Card
                      padding="p-4"
                      className={
                        isSelected
                          ? "ring-2 ring-[rgba(96,180,175,0.18)]"
                          : ""
                      }
                      hover
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl"
                          style={{
                            backgroundColor: "rgba(183,103,46,0.08)",
                            color: severityStyle.color,
                          }}
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={severityStyle.variant}>
                              {formatLabel(alert.severity)}
                            </Badge>
                            <Badge
                              variant={
                                alert.status === "resolved"
                                  ? "success"
                                  : alert.status === "archived"
                                    ? "neutral"
                                    : "info"
                              }
                            >
                              {formatLabel(alert.status)}
                            </Badge>
                          </div>
                          <h2 className="mt-2 line-clamp-2 text-sm font-semibold text-[#151f21]">
                            {alert.title}
                          </h2>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#5e8a8d]">
                            {alert.summary || alert.recommendedAction || "No summary available."}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#5e8a8d]">
                            <span>{formatLabel(alert.type)}</span>
                            <span>Due {formatDate(alert.dueDate)}</span>
                            <span>{alert.assignedToName || "Unassigned"}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="xl:flex-1">
          {selected ? (
            <Card className="sticky top-5" padding="p-5 sm:p-6">
              <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={severityStyles[selected.severity].variant}>
                        {formatLabel(selected.severity)}
                      </Badge>
                      <Badge
                        variant={
                          selected.status === "resolved"
                            ? "success"
                            : selected.status === "archived"
                              ? "neutral"
                              : "info"
                        }
                      >
                        {formatLabel(selected.status)}
                      </Badge>
                    </div>
                    <h2 className="mt-3 text-xl font-bold tracking-tight text-[#151f21]">
                      {selected.title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[#5e8a8d]">
                      {selected.summary || "No summary has been recorded for this alert."}
                    </p>
                  </div>
                </div>

                {selected.recommendedAction && (
                  <AlertBanner
                    icon={Sparkles}
                    title="Recommended next action"
                    description={selected.recommendedAction}
                    variant="info"
                  />
                )}

                <ProvenanceSummary
                  items={[
                    {
                      label: "Alert source",
                      value: selected.generatedFrom ? "live" : "unknown",
                    },
                    {
                      label: "Risk value",
                      value: metadataValue(selected.metadata, "estimatedRisk")
                        ? "estimated"
                        : "unknown",
                    },
                    {
                      label: "AI generation",
                      value: selectedFallbackReason
                        ? "fallback"
                        : selectedGenerationProvider || "unknown",
                    },
                  ]}
                />

                <DetailGrid
                  columns={2}
                  items={[
                    { label: "Generated from", value: formatLabel(selected.generatedFrom) },
                    { label: "Source type", value: formatLabel(selected.sourceType) },
                    { label: "Contact", value: metadataValue(selected.metadata, "contactName") || selected.sourceContactId || "Unlinked" },
                    { label: "Treatment", value: metadataValue(selected.metadata, "treatment") || "Not set" },
                    { label: "Source", value: metadataValue(selected.metadata, "source") || "Not set" },
                    { label: "Risk", value: metadataValue(selected.metadata, "estimatedRisk") || "Not estimated" },
                    { label: "Created", value: formatDateTime(selected.createdAt) },
                    { label: "Resolved", value: selected.resolvedAt ? formatDateTime(selected.resolvedAt) : "Not resolved" },
                  ]}
                />

                <div
                  className="grid gap-3 rounded-2xl p-4 sm:grid-cols-[1fr_auto]"
                  style={{
                    backgroundColor: "#eaedeb",
                    border: "1px solid rgba(21,31,33,0.05)",
                  }}
                >
                  <div>
                    <p className="text-sm font-semibold text-[#151f21]">
                      Data confidence
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#5e8a8d]">
                      {selectedFallbackReason
                        ? `Generated with fallback logic: ${selectedFallbackReason}.`
                        : selectedGenerationProvider
                          ? `Generated through ${selectedGenerationProvider}.`
                          : "Generation source is not recorded yet."}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <DataProvenanceBadge
                      value={
                        selectedFallbackReason
                          ? "fallback"
                          : selectedGenerationProvider || "unknown"
                      }
                      size="sm"
                    />
                    <ConfidenceIndicator
                      value={
                        selectedFallbackReason
                          ? "fallback"
                          : selectedGenerationProvider || "unknown"
                      }
                      compact
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-[#5e8a8d]">
                    Owner
                    <select
                      value={selected.assignedTo || ""}
                      onChange={(event) => handleAssign(selected, event.target.value)}
                      disabled={isMutating}
                      className="mt-1.5 w-full rounded-2xl border border-[rgba(21,31,33,0.08)] bg-[#FFFCF9] px-3 py-2.5 text-sm text-[#151f21] outline-none"
                    >
                      <option value="">Unassigned</option>
                      {assignableMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {memberName(member)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-[#5e8a8d]">
                    Due date
                    <input
                      type="date"
                      value={selected.dueDate || ""}
                      onChange={(event) => handleDueDate(selected, event.target.value)}
                      disabled={isMutating}
                      className="mt-1.5 w-full rounded-2xl border border-[rgba(21,31,33,0.08)] bg-[#FFFCF9] px-3 py-2.5 text-sm text-[#151f21] outline-none"
                    />
                  </label>
                </div>

                <div
                  className="rounded-2xl p-4"
                  style={{
                    backgroundColor: "#eaedeb",
                    border: "1px solid rgba(21,31,33,0.05)",
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#151f21]">
                        Linked evidence
                      </p>
                      <p className="mt-1 text-xs text-[#5e8a8d]">
                        {selected.sourceId
                          ? `${formatLabel(selected.sourceType)} ${selected.sourceId}`
                          : "No source record ID was stored for this alert."}
                      </p>
                    </div>
                    <Link href={sourceHref(selected)} className="btn-secondary w-fit">
                      <ExternalLink className="w-4 h-4" />
                      Open source
                    </Link>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selected.actionTaskId ? (
                    <Link href="/app/crm/tasks" className="btn-primary w-fit">
                      <ClipboardCheck className="w-4 h-4" />
                      View linked task
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleCreateTask(selected)}
                      disabled={isMutating}
                      className="btn-primary w-fit"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      Create task
                    </button>
                  )}
                  {selected.status === "open" && (
                    <button
                      onClick={() => handleStatus(selected, "in_progress")}
                      disabled={isMutating}
                      className="btn-secondary w-fit"
                    >
                      <UserRound className="w-4 h-4" />
                      Start
                    </button>
                  )}
                  {selected.status !== "resolved" && (
                    <button
                      onClick={() => handleStatus(selected, "resolved")}
                      disabled={isMutating}
                      className="btn-secondary w-fit"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Resolve
                    </button>
                  )}
                  {selected.status !== "archived" && (
                    <button
                      onClick={() => handleStatus(selected, "archived")}
                      disabled={isMutating}
                      className="btn-secondary w-fit"
                    >
                      <Archive className="w-4 h-4" />
                      Archive
                    </button>
                  )}
                </div>

                {selected.actionTaskId && (
                  <AlertBanner
                    icon={CheckCircle}
                    title="Action task linked"
                    description={`Task ID: ${selected.actionTaskId}`}
                    variant="success"
                    action={
                      <Link href="/app/crm/tasks" className="btn-secondary w-fit">
                        <ExternalLink className="w-4 h-4" />
                        Tasks
                      </Link>
                    }
                  />
                )}
              </div>
            </Card>
          ) : (
            <EmptyState
              icon={XCircle}
              title="Select an alert"
              description="Choose an alert from the inbox to review evidence, assign ownership, create a task, or resolve it."
            />
          )}
        </div>
      </div>
    </div>
  );
}
