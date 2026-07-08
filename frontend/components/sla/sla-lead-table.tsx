"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  Check,
  ChevronDown,
  Inbox,
  Loader2,
  UserRound,
} from "lucide-react";
import { Card, TableRowSkeleton } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { SlaLeadRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";

interface Lead {
  id: string;
  name: string;
  source: string;
  treatment: string;
  arrivedAt: string;
  elapsed: string;
  elapsedMins: number;
  slaTarget: number;
  status: "safe" | "warning" | "breached";
  assignedTo: string;
  estimatedValue: number;
}

function getStatusStyles(status: Lead["status"]) {
  switch (status) {
    case "safe":
      return {
        bg: "rgba(90,138,106,0.08)",
        text: "#5A8A6A",
        border: "rgba(90,138,106,0.2)",
        icon: CheckCircle,
        label: "On Track",
      };
    case "warning":
      return {
        bg: "rgba(160,120,64,0.08)",
        text: "#A07840",
        border: "rgba(160,120,64,0.2)",
        icon: AlertTriangle,
        label: "At Risk",
      };
    case "breached":
      return {
        bg: "rgba(138,74,74,0.08)",
        text: "#8A4A4A",
        border: "rgba(138,74,74,0.2)",
        icon: AlertTriangle,
        label: "Breached",
      };
  }
}

function TimerBar({ elapsed, target }: { elapsed: number; target: number }) {
  const pct = Math.min((elapsed / target) * 100, 100);
  const color =
    pct >= 100 ? "bg-[#8A4A4A]" : pct >= 80 ? "bg-[#A07840]" : "bg-[#5A8A6A]";

  return (
    <div
      className="w-24 h-1.5 rounded-full overflow-hidden"
      style={{ backgroundColor: "rgba(0,0,0,0.06)" }}
    >
      <div
        className={`h-full ${color} rounded-full`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function formatLeadTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatElapsed(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  return `${Math.floor(minutes / 60)} hr ${Math.round(minutes % 60)} min`;
}

function mapSlaLead(record: SlaLeadRecord): Lead {
  return {
    id: record.contactId,
    name: record.name,
    source: record.source,
    treatment: record.treatment,
    arrivedAt: formatLeadTime(record.arrivedAt),
    elapsed: formatElapsed(record.elapsedMinutes),
    elapsedMins: record.elapsedMinutes,
    slaTarget: record.slaTargetMinutes,
    status: record.status,
    assignedTo: record.assignedTo,
    estimatedValue: record.estimatedValue,
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function SLALeadTable({
  leads: liveLeads,
  isLoading = false,
  onLeadResolved,
}: {
  leads?: SlaLeadRecord[];
  isLoading?: boolean;
  onLeadResolved?: () => void | Promise<void>;
}) {
  const { session } = useAuth();
  const { addToast } = useToast();
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [resolvedLeadIds, setResolvedLeadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingContactId, setPendingContactId] = useState<string | null>(null);
  const displayLeads = useMemo(
    () =>
      liveLeads
        ? liveLeads
            .map(mapSlaLead)
            .filter((lead) => !resolvedLeadIds.has(lead.id))
        : [],
    [liveLeads, resolvedLeadIds],
  );

  const toggleLead = (leadId: string) => {
    setExpandedLeadId((current) => (current === leadId ? null : leadId));
  };

  const markContacted = async (lead: Lead) => {
    if (!session?.token || pendingContactId) return;

    setPendingContactId(lead.id);
    try {
      await api.contacts.markContacted(session.token, lead.id);
      setResolvedLeadIds((current) => new Set(current).add(lead.id));
      setExpandedLeadId((current) => (current === lead.id ? null : current));
      await onLeadResolved?.();
      addToast(`${lead.name} marked as resolved.`, "success");
    } catch (error) {
      console.error("Failed to mark SLA lead contacted", error);
      addToast(
        error instanceof Error
          ? error.message
          : "Unable to mark this lead as contacted.",
        "error",
      );
    } finally {
      setPendingContactId(null);
    }
  };

  return (
    <Card padding="p-0">
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
      >
        <h2
          className="font-semibold flex items-center gap-2"
          style={{ color: "#111111" }}
        >
          <Clock className="w-5 h-5 text-[#6E6AE8]" /> Live Lead Queue
        </h2>
        <span className="text-xs" style={{ color: "#6B7280" }}>
          {displayLeads.length} active leads
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr
              style={{
                borderBottom: "1px solid rgba(0,0,0,0.06)",
                backgroundColor: "#F7F5F2",
              }}
            >
              <th
                className="text-left text-xs font-medium px-5 py-3"
                style={{ color: "#6B7280" }}
              >
                Lead
              </th>
              <th
                className="text-left text-xs font-medium px-5 py-3"
                style={{ color: "#6B7280" }}
              >
                Source
              </th>
              <th
                className="text-left text-xs font-medium px-5 py-3"
                style={{ color: "#6B7280" }}
              >
                Arrived
              </th>
              <th
                className="text-left text-xs font-medium px-5 py-3"
                style={{ color: "#6B7280" }}
              >
                Elapsed
              </th>
              <th
                className="text-left text-xs font-medium px-5 py-3"
                style={{ color: "#6B7280" }}
              >
                SLA
              </th>
              <th
                className="text-left text-xs font-medium px-5 py-3"
                style={{ color: "#6B7280" }}
              >
                Status
              </th>
              <th
                className="text-left text-xs font-medium px-5 py-3"
                style={{ color: "#6B7280" }}
              >
                Assigned
              </th>
              <th
                className="text-left text-xs font-medium px-5 py-3"
                style={{ color: "#6B7280" }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 5 }, (_, index) => (
                <TableRowSkeleton key={index} columns={8} />
              ))}
            {!isLoading && displayLeads.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-10 text-center text-sm"
                  style={{ color: "#6B7280" }}
                >
                  No live SLA leads are currently waiting for a first response.
                </td>
              </tr>
            )}
            {!isLoading &&
              displayLeads.map((lead) => {
                const s = getStatusStyles(lead.status);
                const StatusIcon = s.icon;
                const isExpanded = expandedLeadId === lead.id;
                const isPending = pendingContactId === lead.id;
                return (
                  <Fragment key={lead.id}>
                    <tr
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onClick={() => toggleLead(lead.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleLead(lead.id);
                        }
                      }}
                      className="cursor-pointer transition-colors hover:bg-[rgba(110,106,232,0.03)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#6E6AE8]"
                      style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}
                    >
                      <td className="px-5 py-4">
                        <div>
                          <p
                            className="font-medium text-sm"
                            style={{ color: "#111111" }}
                          >
                            {lead.name}
                          </p>
                          <p className="text-xs" style={{ color: "#6B7280" }}>
                            {lead.treatment}
                          </p>
                        </div>
                      </td>
                      <td
                        className="px-5 py-4 text-sm"
                        style={{ color: "#6B7280" }}
                      >
                        {lead.source}
                      </td>
                      <td
                        className="px-5 py-4 text-sm"
                        style={{ color: "#6B7280" }}
                      >
                        {lead.arrivedAt}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-medium"
                            style={{ color: s.text }}
                          >
                            {lead.elapsed}
                          </span>
                          <TimerBar
                            elapsed={lead.elapsedMins}
                            target={lead.slaTarget}
                          />
                        </div>
                      </td>
                      <td
                        className="px-5 py-4 text-sm"
                        style={{ color: "#6B7280" }}
                      >
                        {lead.slaTarget} min
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="text-xs px-2 py-1 rounded-full flex items-center gap-1 w-fit"
                          style={{
                            backgroundColor: s.bg,
                            color: s.text,
                            border: `1px solid ${s.border}`,
                          }}
                        >
                          <StatusIcon className="w-3 h-3" /> {s.label}
                        </span>
                      </td>
                      <td
                        className="px-5 py-4 text-sm"
                        style={{ color: "#6B7280" }}
                      >
                        {lead.assignedTo}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleLead(lead.id);
                          }}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[rgba(110,106,232,0.12)]"
                          style={{
                            backgroundColor: "rgba(110,106,232,0.08)",
                            color: "#5C58D8",
                            border: "1px solid rgba(110,106,232,0.2)",
                          }}
                        >
                          Actions
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                        <td colSpan={8} className="px-5 py-4">
                          <div
                            className="flex flex-col gap-4 rounded-lg px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                            style={{
                              backgroundColor: "#FBFAF8",
                              border: "1px solid rgba(0,0,0,0.06)",
                            }}
                          >
                            <div className="grid gap-2 text-sm sm:grid-cols-3">
                              <div>
                                <p
                                  className="text-xs font-medium uppercase"
                                  style={{ color: "#9CA3AF" }}
                                >
                                  Priority
                                </p>
                                <p className="font-medium" style={{ color: s.text }}>
                                  {s.label} after {lead.elapsed}
                                </p>
                              </div>
                              <div>
                                <p
                                  className="text-xs font-medium uppercase"
                                  style={{ color: "#9CA3AF" }}
                                >
                                  Value at risk
                                </p>
                                <p
                                  className="font-medium"
                                  style={{ color: "#111111" }}
                                >
                                  {formatCurrency(lead.estimatedValue)}
                                </p>
                              </div>
                              <div>
                                <p
                                  className="text-xs font-medium uppercase"
                                  style={{ color: "#9CA3AF" }}
                                >
                                  Owner
                                </p>
                                <p
                                  className="font-medium"
                                  style={{ color: "#111111" }}
                                >
                                  {lead.assignedTo}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={`/app/crm/contacts/detail?id=${encodeURIComponent(
                                  lead.id,
                                )}`}
                                className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-[rgba(17,17,17,0.06)]"
                                style={{
                                  color: "#111111",
                                  border: "1px solid rgba(0,0,0,0.08)",
                                  backgroundColor: "#FFFFFF",
                                }}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <UserRound className="h-4 w-4" />
                                Contact record
                              </Link>
                              <Link
                                href="/app/comms/inbox"
                                className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-[rgba(17,17,17,0.06)]"
                                style={{
                                  color: "#111111",
                                  border: "1px solid rgba(0,0,0,0.08)",
                                  backgroundColor: "#FFFFFF",
                                }}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Inbox className="h-4 w-4" />
                                Open inbox
                              </Link>
                              <button
                                type="button"
                                disabled={isPending || !session?.token}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void markContacted(lead);
                                }}
                                className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                                style={{ backgroundColor: "#5A8A6A" }}
                              >
                                {isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                                Mark resolved
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
