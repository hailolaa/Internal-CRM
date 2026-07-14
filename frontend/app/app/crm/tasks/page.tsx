"use client";

import {
  Plus,
  Search,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Filter,
  Archive,
  AlertTriangle,
  BriefcaseBusiness,
  CheckSquare,
  Link2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import type {
  ClientAccountServiceRecord,
  ClientAccountServiceType,
  ClientAccountSummaryRecord,
  InternalTaskRecord,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { AlertBanner, PageHeader, SkeletonLine } from "@/components/ui";

type TaskRow = {
  id: string;
  title: string;
  description: string;
  contactId: string | null;
  contact: string | null;
  due: string;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  status: "pending" | "completed";
  category: string;
  boardKey: string;
  serviceType: ClientAccountServiceType | null;
  clientAccountProfileId: string | null;
  clientAccountServiceId: string | null;
  assignedTo: string | null;
  needsQa: boolean;
  approvalStatus: InternalTaskRecord["approvalStatus"];
  isOverdue: boolean;
  updatedAt: string;
};

type PriorityFilter = "all" | TaskRow["priority"];
type DueFilter = "all" | "overdue" | "today" | "no-date";
type WorkFilter =
  | "all"
  | "delivery"
  | "operations"
  | "website"
  | "seo"
  | "ppc"
  | "strategy"
  | "needs-qa"
  | "unlinked";

const priorityColors: Record<string, string> = {
  high: "bg-red-500/10 text-red-400 border-red-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-[rgba(0,0,0,0.04)] text-[#6B7280] border-[rgba(0,0,0,0.06)]",
};

const workFilters: Array<{ value: WorkFilter; label: string }> = [
  { value: "all", label: "All work" },
  { value: "delivery", label: "Delivery" },
  { value: "operations", label: "Operations" },
  { value: "website", label: "Website" },
  { value: "seo", label: "SEO" },
  { value: "ppc", label: "Ads" },
  { value: "strategy", label: "Strategy" },
  { value: "needs-qa", label: "Needs QA" },
  { value: "unlinked", label: "Unlinked" },
];

const dueFilterValues: DueFilter[] = ["all", "overdue", "today", "no-date"];
const workFilterValues = workFilters.map((filter) => filter.value);

function getInitialDueFilter(value: string | null): DueFilter {
  return dueFilterValues.includes(value as DueFilter) ? value as DueFilter : "all";
}

function getInitialWorkFilter(value: string | null): WorkFilter {
  return workFilterValues.includes(value as WorkFilter) ? value as WorkFilter : "all";
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "General";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDue(record: InternalTaskRecord) {
  if (record.due) return record.due;
  if (!record.dueDate) return "No due date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(record.dueDate));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isDueToday(dueDate: string | null) {
  if (!dueDate) return false;
  return (
    startOfDay(new Date(dueDate)).getTime() ===
    startOfDay(new Date()).getTime()
  );
}

function isOverdue(task: TaskRow) {
  if (task.isOverdue) return true;
  if (!task.dueDate || task.status === "completed") return false;
  return (
    startOfDay(new Date(task.dueDate)).getTime() <
    startOfDay(new Date()).getTime()
  );
}

function toTaskRow(record: InternalTaskRecord): TaskRow {
  return {
    id: record.id,
    title: record.title,
    description: record.description || "",
    contactId: record.contactId || null,
    contact: record.contact,
    due: formatDue(record),
    dueDate: record.dueDate,
    priority: record.priority,
    status: record.status,
    category: record.category || "Delivery",
    boardKey: record.boardKey || "delivery",
    serviceType: record.serviceType || null,
    clientAccountProfileId: record.clientAccountProfileId || null,
    clientAccountServiceId: record.clientAccountServiceId || null,
    assignedTo: record.assignedTo,
    needsQa: Boolean(record.needsQa),
    approvalStatus: record.approvalStatus || "not_required",
    isOverdue: Boolean(record.isOverdue),
    updatedAt: record.updatedAt,
  };
}

export default function TasksPage() {
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const requestedTaskId = searchParams.get("taskId");
  const requestedClientAccountProfileId = searchParams.get("clientAccountProfileId");
  const requestedDueFilter = searchParams.get("due");
  const requestedWorkFilter = searchParams.get("work");
  const token = session?.token;
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [clientAccounts, setClientAccounts] = useState<ClientAccountSummaryRecord[]>([]);
  const [services, setServices] = useState<ClientAccountServiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>(() => getInitialDueFilter(requestedDueFilter));
  const [workFilter, setWorkFilter] = useState<WorkFilter>(() => getInitialWorkFilter(requestedWorkFilter));
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const taskRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const clientNameById = useMemo(() => {
    return new Map(
      clientAccounts
        .filter((account) => account.id)
        .map((account) => [account.id as string, account.clinicName]),
    );
  }, [clientAccounts]);
  const clientAccountByProfileId = useMemo(() => {
    return new Map(
      clientAccounts
        .filter((account) => account.id)
        .map((account) => [account.id as string, account]),
    );
  }, [clientAccounts]);
  const serviceById = useMemo(() => {
    return new Map(services.map((service) => [service.id, service]));
  }, [services]);
  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const overdueCount = tasks.filter(isOverdue).length;
  const clientLinkedCount = tasks.filter((task) => task.clientAccountProfileId).length;
  const qaCount = tasks.filter(
    (task) => task.needsQa || task.approvalStatus === "pending",
  ).length;

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    setIsLoading(true);
    Promise.allSettled([
      api.internalTasks.list(token, {
        includeArchived: false,
        clientAccountProfileId: requestedClientAccountProfileId || undefined,
      }),
      api.clientAccounts.list(token),
      api.clientAccounts.listServices(token, { includeArchived: true }),
    ])
      .then(([taskResult, accountResult, serviceResult]) => {
        if (!isMounted) return;
        if (taskResult.status === "rejected") throw taskResult.reason;

        setTasks(taskResult.value.map(toTaskRow));
        setClientAccounts(
          accountResult.status === "fulfilled" ? accountResult.value : [],
        );
        setServices(
          serviceResult.status === "fulfilled" ? serviceResult.value : [],
        );
        setLoadError(
          accountResult.status === "rejected" ||
            serviceResult.status === "rejected"
            ? "Tasks loaded, but client/service names could not be loaded."
            : "",
        );
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Unable to load internal delivery tasks from the backend.",
        );
        setTasks([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [requestedClientAccountProfileId, token]);

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      const clientName = task.clientAccountProfileId
        ? clientNameById.get(task.clientAccountProfileId)
        : "";
      const service = task.clientAccountServiceId
        ? serviceById.get(task.clientAccountServiceId)
        : null;
      const matchesSearch =
        !query ||
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.category.toLowerCase().includes(query) ||
        task.boardKey.toLowerCase().includes(query) ||
        task.contact?.toLowerCase().includes(query) ||
        clientName?.toLowerCase().includes(query) ||
        service?.name.toLowerCase().includes(query);
      const matchesPriority =
        priorityFilter === "all" || task.priority === priorityFilter;
      const matchesDue =
        dueFilter === "all" ||
        (dueFilter === "overdue" && isOverdue(task)) ||
        (dueFilter === "today" && isDueToday(task.dueDate)) ||
        (dueFilter === "no-date" && !task.dueDate);
      const matchesWork =
        workFilter === "all" ||
        task.boardKey === workFilter ||
        task.serviceType === workFilter ||
        (workFilter === "needs-qa" &&
          (task.needsQa || task.approvalStatus === "pending")) ||
        (workFilter === "unlinked" &&
          !task.contactId &&
          !task.clientAccountProfileId &&
          !task.clientAccountServiceId);

      return matchesSearch && matchesPriority && matchesDue && matchesWork;
    });
  }, [
    clientNameById,
    dueFilter,
    priorityFilter,
    searchQuery,
    serviceById,
    tasks,
    workFilter,
  ]);

  useEffect(() => {
    setDueFilter(getInitialDueFilter(requestedDueFilter));
  }, [requestedDueFilter]);

  useEffect(() => {
    setWorkFilter(getInitialWorkFilter(requestedWorkFilter));
  }, [requestedWorkFilter]);

  useEffect(() => {
    if (!requestedTaskId || isLoading) return;

    const scrollTimer = window.setTimeout(() => {
      const matchingTask = tasks.find((task) => task.id === requestedTaskId);
      if (!matchingTask) {
        setActionError("The linked task was not found in this workspace.");
        return;
      }

      setActionError("");
      setSearchQuery("");
      setPriorityFilter("all");
      setDueFilter("all");
      setWorkFilter("all");

      taskRefs.current[requestedTaskId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);

    return () => window.clearTimeout(scrollTimer);
  }, [isLoading, requestedTaskId, tasks]);

  const toggleTaskStatus = async (task: TaskRow) => {
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    setUpdatingTaskId(task.id);
    setActionMessage("");
    setActionError("");
    setTasks((prev) =>
      prev.map((item) =>
        item.id === task.id ? { ...item, status: nextStatus } : item,
      ),
    );

    if (!token) return;

    try {
      await api.internalTasks.update(token, task.id, { status: nextStatus });
      setActionMessage(
        `${task.title} marked as ${
          nextStatus === "completed" ? "completed" : "open"
        }.`,
      );
    } catch (error) {
      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, status: task.status } : item,
        ),
      );
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to update internal task status.",
      );
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const archiveTask = async (task: TaskRow) => {
    if (!token) return;

    setUpdatingTaskId(task.id);
    setActionMessage("");
    setActionError("");

    try {
      await api.internalTasks.archive(token, task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setActionMessage(`${task.title} archived.`);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to archive task.",
      );
    } finally {
      setUpdatingTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Internal Tasks"
        subtitle="Track sales hand-offs, delivery work, QA, fixes, and client deadlines."
        icon={CheckSquare}
        right={
          <Link
            href="/app/crm/tasks/new"
            className="bg-[#6E6AE8] hover:bg-[#5A56D4] text-white font-medium px-4 py-2.5 rounded-[14px] flex items-center gap-2 w-fit transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Task
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div
          className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-4"
          style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
        >
          <p className="text-2xl font-bold text-[#111111]">{pendingCount}</p>
          <p className="text-sm text-[#6B7280]">Open Work</p>
        </div>
        <div
          className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-4"
          style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
        >
          <p className="text-2xl font-bold text-red-400">{overdueCount}</p>
          <p className="text-sm text-[#6B7280]">Overdue</p>
        </div>
        <div
          className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-4"
          style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
        >
          <p className="text-2xl font-bold text-[#6E6AE8]">
            {clientLinkedCount}
          </p>
          <p className="text-sm text-[#6B7280]">Client Linked</p>
        </div>
        <div
          className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-4"
          style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
        >
          <p className="text-2xl font-bold text-amber-400">{qaCount}</p>
          <p className="text-sm text-[#6B7280]">Needs QA</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Search work, prospect, client, or service..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[14px] pl-10 pr-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[rgba(110,106,232,0.4)] focus:ring-2 focus:ring-[rgba(110,106,232,0.08)] transition-all"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="flex items-center gap-2 px-3 py-2.5 bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[14px] text-sm text-[#111111]">
            <Filter className="w-4 h-4 text-[#6B7280]" />
            <select
              aria-label="Filter by work type"
              value={workFilter}
              onChange={(event) => setWorkFilter(event.target.value as WorkFilter)}
              className="bg-transparent text-sm focus:outline-none"
            >
              {workFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 px-3 py-2.5 bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[14px] text-sm text-[#111111]">
            <Filter className="w-4 h-4 text-[#6B7280]" />
            <select
              aria-label="Filter by priority"
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value as PriorityFilter)
              }
              className="bg-transparent text-sm focus:outline-none"
            >
              <option value="all">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="flex items-center gap-2 px-3 py-2.5 bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[14px] text-sm text-[#111111]">
            <Clock className="w-4 h-4 text-[#6B7280]" />
            <select
              aria-label="Filter by due date"
              value={dueFilter}
              onChange={(event) => setDueFilter(event.target.value as DueFilter)}
              className="bg-transparent text-sm focus:outline-none"
            >
              <option value="all">All due dates</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="no-date">No due date</option>
            </select>
          </label>
        </div>
      </div>

      {loadError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Internal task data could not be fully loaded"
          description={loadError}
          variant="warning"
        />
      )}

      {actionMessage && (
        <AlertBanner title={actionMessage} variant="success" />
      )}

      {actionError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Task action failed"
          description={actionError}
          variant="error"
        />
      )}

      <div
        className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] divide-y divide-[rgba(0,0,0,0.04)]"
        style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
      >
        {isLoading &&
          Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="p-4">
              <SkeletonLine className="h-5 w-1/3 mb-3" />
              <SkeletonLine className="h-4 w-2/3" />
            </div>
          ))}
        {!isLoading &&
          filteredTasks.map((task) => {
            const clientAccount = task.clientAccountProfileId
              ? clientAccountByProfileId.get(task.clientAccountProfileId)
              : null;
            const clientName = clientAccount?.clinicName || null;
            const service = task.clientAccountServiceId
              ? serviceById.get(task.clientAccountServiceId)
              : null;

            return (
              <div
                key={task.id}
                ref={(element) => {
                  taskRefs.current[task.id] = element;
                }}
                className={`p-4 hover:bg-[rgba(110,106,232,0.03)] transition-colors ${
                  task.status === "completed" ? "opacity-60" : ""
                } ${
                  requestedTaskId === task.id
                    ? "bg-[rgba(110,106,232,0.08)] ring-1 ring-inset ring-[rgba(110,106,232,0.35)]"
                    : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => toggleTaskStatus(task)}
                    disabled={updatingTaskId === task.id}
                    aria-label={
                      task.status === "completed"
                        ? `Reopen ${task.title}`
                        : `Complete ${task.title}`
                    }
                    className="mt-0.5 flex-shrink-0 disabled:opacity-50"
                  >
                    {task.status === "completed" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-[#6B7280] hover:text-[#6E6AE8] transition-colors" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3
                        className={`font-medium text-[#111111] ${task.status === "completed" ? "line-through text-[#6B7280]" : ""}`}
                      >
                        {task.title}
                      </h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${priorityColors[task.priority]}`}
                      >
                        {task.priority}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(0,0,0,0.04)] text-[#6B7280]">
                        {formatLabel(task.boardKey)}
                      </span>
                      {task.serviceType && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(110,106,232,0.08)] text-[#5A56D4]">
                          {formatLabel(task.serviceType)}
                        </span>
                      )}
                      {(task.needsQa || task.approvalStatus === "pending") && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700">
                          QA
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-sm text-[#6B7280] mb-2">
                        {task.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B7280]">
                      {task.contact &&
                        (task.contactId ? (
                          <Link
                            href={`/app/crm/contacts/detail?id=${task.contactId}`}
                            className="flex items-center gap-1 rounded-full bg-[rgba(110,106,232,0.08)] px-2 py-1 text-[#5A56D4] hover:bg-[rgba(110,106,232,0.14)]"
                          >
                            <UserRound className="w-3 h-3" />
                            Prospect: {task.contact}
                          </Link>
                        ) : (
                          <span className="flex items-center gap-1">
                            <UserRound className="w-3 h-3" />
                            Prospect: {task.contact}
                          </span>
                        ))}
                      {task.clientAccountProfileId && (
                        <Link
                          href={clientAccount ? `/app/ops/client-accounts/detail?id=${clientAccount.clinicId}` : `/app/ops/client-accounts?clientAccountProfileId=${task.clientAccountProfileId}`}
                          className="flex items-center gap-1 rounded-full bg-[rgba(0,0,0,0.04)] px-2 py-1 text-[#111111] hover:bg-[rgba(0,0,0,0.07)]"
                        >
                          <BriefcaseBusiness className="w-3 h-3" />
                          Client: {clientName || "Linked account"}
                        </Link>
                      )}
                      {service && (
                        <Link
                          href={`/app/ops/client-accounts?serviceId=${service.id}`}
                          className="flex items-center gap-1 rounded-full bg-[rgba(0,0,0,0.04)] px-2 py-1 text-[#111111] hover:bg-[rgba(0,0,0,0.07)]"
                        >
                          <Link2 className="w-3 h-3" />
                          Service: {service.name}
                        </Link>
                      )}
                      {task.assignedTo && <span>Owner: {task.assignedTo}</span>}
                      <span
                        className={`flex items-center gap-1 ${isOverdue(task) ? "text-red-400" : ""}`}
                      >
                        {isOverdue(task) && <AlertCircle className="w-3 h-3" />}
                        <Clock className="w-3 h-3" />
                        {task.due}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => void archiveTask(task)}
                    disabled={updatingTaskId === task.id}
                    aria-label={`Archive ${task.title}`}
                    className="rounded-lg p-2 text-[#6B7280] hover:bg-[rgba(0,0,0,0.04)] hover:text-[#111111] disabled:opacity-50"
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        {!isLoading && filteredTasks.length === 0 && (
          <div className="p-8 text-sm text-[#6B7280]">
            No internal delivery tasks match the current filters.
          </div>
        )}
        <div className="p-4">
          <Link
            href="/app/crm/tasks/new"
            className="w-full py-3 border border-dashed border-[rgba(0,0,0,0.10)] rounded-[14px] text-sm text-[#6B7280] hover:border-[rgba(110,106,232,0.3)] hover:text-[#6E6AE8] transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add internal task
          </Link>
        </div>
      </div>
    </div>
  );
}
