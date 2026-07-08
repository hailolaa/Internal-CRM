"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  Check,
  ChevronDown,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import {
  DataTable,
  FilterTabs,
  PageHeader,
  StatCard,
  StatCardSkeleton,
  TableCell,
  TableRow,
  TableRowSkeleton,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import type { TreatmentPlanRecord } from "@/lib/api-types";

type RetentionStatus = "Overdue" | "Due Soon" | "Lapsed";
type RetentionPriority = "High" | "Medium" | "Low";

interface RetentionRow {
  id: string;
  contactId: string | null;
  name: string;
  treatment: string;
  lastDate: string;
  dueDate: string;
  trigger: string;
  status: RetentionStatus;
  priority: RetentionPriority;
  priorityReason: string;
  daysUntil: number | null;
  daysSince: number;
  sessionsLabel: string;
  totalSpend: number;
  rebookingValue: number;
  smsReady: boolean;
  emailReady: boolean;
  practitioner: string | null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((a.getTime() - b.getTime()) / 86400000);
}

function patientHref(row: Pick<RetentionRow, "contactId" | "name">) {
  return row.contactId
    ? `/app/crm/contacts/detail?id=${encodeURIComponent(row.contactId)}`
    : `/app/crm/contacts?search=${encodeURIComponent(row.name)}`;
}

function calendarHref(row: RetentionRow) {
  const params = new URLSearchParams({
    patient: row.name,
    treatment: row.treatment,
  });
  if (row.contactId) params.set("contactId", row.contactId);
  return `/app/crm/calendar/new?${params.toString()}`;
}

function inboxHref(row: RetentionRow) {
  return `/app/comms/inbox?search=${encodeURIComponent(row.name)}`;
}

function templateHref(row: RetentionRow) {
  return `/app/comms/templates?patient=${encodeURIComponent(row.name)}&treatment=${encodeURIComponent(row.treatment)}`;
}

function getPriority(
  status: RetentionStatus,
  daysUntil: number | null,
  daysSince: number,
  value: number,
): { priority: RetentionPriority; reason: string } {
  if (status === "Lapsed") {
    if (value >= 1000 || daysSince >= 180) {
      return { priority: "High", reason: "High-value or long-lapsed patient" };
    }
    return { priority: "Medium", reason: "No visit recorded in 90+ days" };
  }

  if ((daysUntil ?? 0) < 0 || value >= 1000) {
    return { priority: "High", reason: "Overdue or high-value rebooking" };
  }

  if ((daysUntil ?? 0) <= 7) {
    return { priority: "Medium", reason: "Due within the next 7 days" };
  }

  return { priority: "Low", reason: "Due later this month" };
}

function StatusBadge({ status }: { status: RetentionStatus }) {
  const styles =
    status === "Overdue" || status === "Lapsed"
      ? { bg: "rgba(138, 74, 74, 0.08)", text: "#8A4A4A" }
      : { bg: "rgba(160, 120, 64, 0.08)", text: "#A07840" };

  return (
    <span
      className="inline-flex rounded px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: styles.bg, color: styles.text }}
    >
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: RetentionPriority }) {
  const styles =
    priority === "High"
      ? { bg: "rgba(138, 74, 74, 0.08)", text: "#8A4A4A" }
      : priority === "Medium"
        ? { bg: "rgba(160, 120, 64, 0.08)", text: "#A07840" }
        : { bg: "rgba(90, 138, 106, 0.08)", text: "#5A8A6A" };

  return (
    <span
      className="inline-flex rounded px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: styles.bg, color: styles.text }}
    >
      {priority}
    </span>
  );
}

function ReadinessPill({
  ready,
  readyLabel,
  missingLabel,
}: {
  ready: boolean;
  readyLabel: string;
  missingLabel: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
      style={{
        backgroundColor: ready
          ? "rgba(90, 138, 106, 0.08)"
          : "rgba(160, 120, 64, 0.08)",
        color: ready ? "#5A8A6A" : "#A07840",
        border: ready
          ? "1px solid rgba(90, 138, 106, 0.16)"
          : "1px solid rgba(160, 120, 64, 0.16)",
      }}
    >
      {ready ? <Check className="h-3 w-3" /> : null}
      {ready ? readyLabel : missingLabel}
    </span>
  );
}

function SummaryStrip({
  overdue,
  dueThisWeek,
  rebookingValue,
  actionsReady,
}: {
  overdue: number;
  dueThisWeek: number;
  rebookingValue: number;
  actionsReady: number;
}) {
  const items = [
    { label: "Overdue", value: String(overdue) },
    { label: "Due this week", value: String(dueThisWeek) },
    { label: "Rebooking value", value: formatCurrency(rebookingValue) },
    { label: "Actions ready", value: String(actionsReady) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg px-4 py-3"
          style={{
            backgroundColor: "#FFFCF9",
            border: "1px solid rgba(21,31,33,0.06)",
            boxShadow: "0 1px 6px rgba(21,31,33,0.03)",
          }}
        >
          <p className="text-xs font-medium uppercase text-[#7A746A]">
            {item.label}
          </p>
          <p className="mt-1 text-xl font-semibold text-[#151f21]">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function RetentionActions({
  row,
  colSpan,
  onDismiss,
}: {
  row: RetentionRow;
  colSpan: number;
  onDismiss: (row: RetentionRow) => void;
}) {
  return (
    <tr style={{ borderBottom: "1px solid rgba(21,31,33,0.04)" }}>
      <td colSpan={colSpan} className="px-6 py-4">
        <div
          className="flex flex-col gap-4 rounded-lg px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
          style={{
            backgroundColor: "#FBFAF8",
            border: "1px solid rgba(21,31,33,0.06)",
          }}
        >
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase text-[#9A948C]">
                Why this appears
              </p>
              <p className="mt-1 font-medium text-[#151f21]">{row.trigger}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-[#9A948C]">
                Priority
              </p>
              <p className="mt-1 font-medium text-[#151f21]">
                {row.priorityReason}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-[#9A948C]">
                Communication readiness
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <ReadinessPill
                  ready={row.smsReady}
                  readyLabel="SMS cadence active"
                  missingLabel="Needs SMS setup"
                />
                <ReadinessPill
                  ready={row.emailReady}
                  readyLabel="Owner assigned"
                  missingLabel="Needs owner"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={patientHref(row)}
              className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-[#151f21] transition-colors hover:bg-[rgba(21,31,33,0.05)]"
              style={{ border: "1px solid rgba(21,31,33,0.08)" }}
            >
              <UserRound className="h-4 w-4" />
              Open contact
            </Link>
            <Link
              href={calendarHref(row)}
              className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-[#151f21] transition-colors hover:bg-[rgba(21,31,33,0.05)]"
              style={{ border: "1px solid rgba(21,31,33,0.08)" }}
            >
              <CalendarPlus className="h-4 w-4" />
              Book
            </Link>
            <Link
              href={inboxHref(row)}
              className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-[#151f21] transition-colors hover:bg-[rgba(21,31,33,0.05)]"
              style={{ border: "1px solid rgba(21,31,33,0.08)" }}
            >
              <MessageSquare className="h-4 w-4" />
              SMS
            </Link>
            <Link
              href={templateHref(row)}
              className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-[#151f21] transition-colors hover:bg-[rgba(21,31,33,0.05)]"
              style={{ border: "1px solid rgba(21,31,33,0.08)" }}
            >
              <Mail className="h-4 w-4" />
              Email
            </Link>
            <button
              type="button"
              onClick={() => onDismiss(row)}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: "#5A8A6A" }}
            >
              <Check className="h-4 w-4" />
              Dismiss for now
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function RetentionPage() {
  const { session } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState("rebooking queue");
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [dismissedRows, setDismissedRows] = useState<Set<string>>(
    () => new Set(),
  );
  const [plans, setPlans] = useState<TreatmentPlanRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;
    const token = session.token;

    async function loadRetention() {
      try {
        const rows = await api.treatmentPlans.list(token);
        if (!cancelled) {
          setPlans(
            [...rows].sort(
              (a, b) =>
                new Date(b.nextSession || b.createdAt).getTime() -
                new Date(a.nextSession || a.createdAt).getTime(),
            ),
          );
          setLoadError("");
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load retention data from the backend.",
          );
          setPlans([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadRetention();

    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  const rebookingQueue = useMemo(() => {
    const now = new Date();
    return plans
      .filter((plan) => plan.nextSession)
      .map((plan): RetentionRow => {
        const nextSession = new Date(plan.nextSession!);
        const daysUntil = daysBetween(nextSession, now);
        const status = daysUntil < 0 ? "Overdue" : "Due Soon";
        const rebookingValue = plan.outstanding || plan.totalValue || plan.paid;
        const { priority, reason } = getPriority(
          status,
          daysUntil,
          Math.max(0, daysBetween(now, nextSession)),
          rebookingValue,
        );

        return {
          id: `rebooking:${plan.id}`,
          contactId: plan.contactId || null,
          name: plan.contact,
          treatment: plan.treatment,
          lastDate: formatDate(plan.createdAt),
          dueDate: formatDate(plan.nextSession),
          trigger:
            daysUntil < 0
              ? `${plan.treatment} session was due ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? "" : "s"} ago.`
              : `${plan.treatment} session is due in ${daysUntil} day${daysUntil === 1 ? "" : "s"}.`,
          status,
          priority,
          priorityReason: reason,
          daysUntil,
          daysSince: Math.max(0, daysBetween(now, nextSession)),
          sessionsLabel: `${plan.sessionsCompleted}/${plan.sessions}`,
          totalSpend: plan.paid || plan.totalValue,
          rebookingValue,
          smsReady: plan.sessionsCompleted > 0,
          emailReady: Boolean(plan.practitioner),
          practitioner: plan.practitioner,
        };
      })
      .filter((patient) => patient.status === "Overdue" || (patient.daysUntil ?? 0) <= 30)
      .filter((patient) => !dismissedRows.has(patient.id))
      .sort((a, b) => {
        const priorityWeight = { High: 0, Medium: 1, Low: 2 };
        return (
          priorityWeight[a.priority] - priorityWeight[b.priority] ||
          (a.daysUntil ?? 0) - (b.daysUntil ?? 0)
        );
      })
      .slice(0, 50);
  }, [dismissedRows, plans]);

  const lapsedPatients = useMemo(() => {
    const now = new Date();
    return plans
      .map((plan): RetentionRow => {
        const referenceDate = new Date(plan.nextSession || plan.createdAt);
        const daysSince = Math.max(0, daysBetween(now, referenceDate));
        const value = plan.paid || plan.totalValue;
        const { priority, reason } = getPriority("Lapsed", null, daysSince, value);

        return {
          id: `lapsed:${plan.id}`,
          contactId: plan.contactId || null,
          name: plan.contact,
          treatment: plan.treatment,
          lastDate: formatDate(plan.createdAt),
          dueDate: "No future booking",
          trigger: `No completed or scheduled visit found for ${daysSince} days.`,
          status: "Lapsed",
          priority,
          priorityReason: reason,
          daysUntil: null,
          daysSince,
          sessionsLabel: `${plan.sessionsCompleted || plan.sessions}`,
          totalSpend: value,
          rebookingValue: value,
          smsReady: plan.sessionsCompleted > 0,
          emailReady: Boolean(plan.practitioner),
          practitioner: plan.practitioner,
        };
      })
      .filter((patient) => patient.daysSince >= 90)
      .filter((patient) => !dismissedRows.has(patient.id))
      .sort((a, b) => b.daysSince - a.daysSince || b.totalSpend - a.totalSpend)
      .slice(0, 50);
  }, [dismissedRows, plans]);

  const activeRows = activeTab === "rebooking queue" ? rebookingQueue : lapsedPatients;
  const filteredRows = activeRows.filter((row) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "overdue") return row.status === "Overdue";
    if (activeFilter === "due this week") {
      return row.daysUntil !== null && row.daysUntil >= 0 && row.daysUntil <= 7;
    }
    if (activeFilter === "due this month") {
      return row.daysUntil !== null && row.daysUntil >= 0 && row.daysUntil <= 30;
    }
    if (activeFilter === "high value") return row.rebookingValue >= 1000;
    if (activeFilter === "sms ready") return row.smsReady;
    if (activeFilter === "email ready") return row.emailReady;
    return true;
  });

  const overdueCount = rebookingQueue.filter((row) => row.status === "Overdue").length;
  const dueThisWeekCount = rebookingQueue.filter(
    (row) => row.daysUntil !== null && row.daysUntil >= 0 && row.daysUntil <= 7,
  ).length;
  const rebookingValue = rebookingQueue.reduce(
    (total, row) => total + row.rebookingValue,
    0,
  );
  const actionsReady = rebookingQueue.filter(
    (row) => row.smsReady || row.emailReady,
  ).length;
  const revenueAtRisk = lapsedPatients.reduce(
    (total, patient) => total + patient.totalSpend,
    0,
  );
  const plansWithNextSession = plans.filter((plan) => plan.nextSession).length;
  const rebookingRate =
    plans.length > 0 ? Math.round((plansWithNextSession / plans.length) * 100) : 0;
  const filterTabs =
    activeTab === "rebooking queue"
      ? ["All", "Overdue", "Due This Week", "Due This Month", "High Value", "SMS Ready", "Email Ready"]
      : ["All", "High Value", "SMS Ready", "Email Ready"];

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setActiveFilter("all");
    setExpandedRowId(null);
  };

  const toggleRow = (rowId: string) => {
    setExpandedRowId((current) => (current === rowId ? null : rowId));
  };

  const dismissRow = (row: RetentionRow) => {
    setDismissedRows((current) => new Set(current).add(row.id));
    setExpandedRowId((current) => (current === row.id ? null : current));
    addToast(`${row.name} dismissed from this retention queue.`, "success");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Retention Engine"
        subtitle="Rebooking reminders and lapsed patient recovery."
        icon={RefreshCw}
        iconColor="text-[#5A8A6A]"
        iconBg="bg-[rgba(90,138,106,0.1)]"
      />

      {loadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Backend retention data could not be loaded. {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }, (_, index) => <StatCardSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              label="Rebooking Rate"
              value={plans.length ? `${rebookingRate}%` : "—"}
              change={plans.length ? "Live treatment plans" : "No live plans"}
              trend="up"
              color="green"
            />
            <StatCard
              label="Due for Rebooking"
              value={String(rebookingQueue.length)}
              sub="Overdue or due within 30 days"
              color="amber"
            />
            <StatCard
              label="Lapsed Patients"
              value={String(lapsedPatients.length)}
              sub="No visit in 90+ days"
              color="red"
            />
            <StatCard
              label="Revenue at Risk"
              value={formatCurrency(revenueAtRisk)}
              sub="From lapsed patients"
              color="red"
            />
          </>
        )}
      </div>

      {!isLoading && (
        <SummaryStrip
          overdue={overdueCount}
          dueThisWeek={dueThisWeekCount}
          rebookingValue={rebookingValue}
          actionsReady={actionsReady}
        />
      )}

      <div className="space-y-3">
        <FilterTabs
          tabs={["Rebooking Queue", "Lapsed Patients"]}
          active={activeTab}
          onChange={handleTabChange}
        />
        <FilterTabs tabs={filterTabs} active={activeFilter} onChange={setActiveFilter} />
      </div>

      <DataTable
        headers={[
          { label: "Patient" },
          { label: activeTab === "rebooking queue" ? "Treatment" : "Last Visit" },
          { label: "Trigger" },
          { label: "Priority" },
          { label: "Readiness" },
          { label: "Actions", className: "text-right" },
        ]}
      >
        {isLoading &&
          Array.from({ length: 5 }, (_, index) => (
            <TableRowSkeleton key={index} columns={6} />
          ))}
        {!isLoading && filteredRows.length === 0 && (
          <tr>
            <td colSpan={6} className="px-6 py-10 text-center text-sm text-[#7A746A]">
              {activeTab === "rebooking queue"
                ? "No patients match this rebooking view. Patients appear here when their next session is overdue or due within 30 days."
                : "No lapsed patients match this view. Patients appear here when they pass 90 days without a future session."}
            </td>
          </tr>
        )}
        {!isLoading &&
          filteredRows.map((row) => {
            const isExpanded = expandedRowId === row.id;
            return (
              <Fragment key={row.id}>
                <TableRow onClick={() => toggleRow(row.id)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(90,138,106,0.1)] text-sm font-semibold text-[#5A8A6A]">
                        {row.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div>
                        <Link
                          href={patientHref(row)}
                          className="font-medium text-[#151f21] hover:text-[#5A8A6A]"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {row.name}
                        </Link>
                        <div className="text-xs text-[#A8A39B]">
                          {formatCurrency(row.rebookingValue)} value
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-[#7A746A]">{row.treatment}</div>
                    <div className="text-xs text-[#A8A39B]">
                      {activeTab === "rebooking queue"
                        ? `${row.sessionsLabel} sessions`
                        : row.lastDate}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-[#151f21]">{row.trigger}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <StatusBadge status={row.status} />
                      <span className="text-xs text-[#7A746A]">{row.dueDate}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={row.priority} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <ReadinessPill
                        ready={row.smsReady}
                        readyLabel="SMS ready"
                        missingLabel="SMS setup"
                      />
                      <ReadinessPill
                        ready={row.emailReady}
                        readyLabel="Owner set"
                        missingLabel="No owner"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleRow(row.id);
                      }}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[rgba(90,138,106,0.12)]"
                      style={{
                        backgroundColor: "rgba(90,138,106,0.08)",
                        color: "#5A8A6A",
                        border: "1px solid rgba(90,138,106,0.18)",
                      }}
                    >
                      Actions
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <RetentionActions
                    row={row}
                    colSpan={6}
                    onDismiss={dismissRow}
                  />
                )}
              </Fragment>
            );
          })}
      </DataTable>

      {!isLoading && (
        <div className="flex items-center gap-2 text-xs text-[#7A746A]">
          <Search className="h-3.5 w-3.5" />
          Contact actions open the contact record when a treatment plan can be
          matched to a CRM contact; otherwise they fall back to CRM search.
        </div>
      )}
    </div>
  );
}
