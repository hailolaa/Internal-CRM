"use client";

import {
  Plus,
  Search,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Filter,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import type { TaskRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { AlertBanner, SkeletonLine } from "@/components/ui";

type TaskRow = {
  id: string;
  title: string;
  description: string;
  contact: string | null;
  due: string;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  status: "pending" | "completed";
  category: string;
  updatedAt: string;
};

type PriorityFilter = "all" | TaskRow["priority"];
type DueFilter = "all" | "overdue" | "today" | "no-date";

const priorityColors: Record<string, string> = {
  high: "bg-red-500/10 text-red-400 border-red-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-[rgba(0,0,0,0.04)] text-[#6B7280] border-[rgba(0,0,0,0.06)]",
};

function formatDue(record: TaskRecord) {
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
  if (!task.dueDate || task.status === "completed") return false;
  return (
    startOfDay(new Date(task.dueDate)).getTime() <
    startOfDay(new Date()).getTime()
  );
}

function toTaskRow(record: TaskRecord): TaskRow {
  return {
    id: record.id,
    title: record.title,
    description: record.description || "",
    contact: record.contact,
    due: formatDue(record),
    dueDate: record.dueDate,
    priority: record.priority,
    status: record.status,
    category: record.category || "General",
    updatedAt: record.updatedAt,
  };
}

export default function TasksPage() {
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const requestedTaskId = searchParams.get("taskId");
  const token = session?.token;
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const taskRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const overdueCount = tasks.filter(isOverdue).length;
  const dueTodayCount = tasks.filter((task) => isDueToday(task.dueDate)).length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    api.tasks
      .list(token)
      .then((records) => {
        if (!isMounted) return;
        const rows = records.map(toTaskRow);
        setLoadError("");
        setTasks(rows);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Unable to load tasks from the backend.",
        );
        setTasks([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesSearch =
        !query ||
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.category.toLowerCase().includes(query) ||
        task.contact?.toLowerCase().includes(query);
      const matchesPriority =
        priorityFilter === "all" || task.priority === priorityFilter;
      const matchesDue =
        dueFilter === "all" ||
        (dueFilter === "overdue" && isOverdue(task)) ||
        (dueFilter === "today" && isDueToday(task.dueDate)) ||
        (dueFilter === "no-date" && !task.dueDate);

      return matchesSearch && matchesPriority && matchesDue;
    });
  }, [dueFilter, priorityFilter, searchQuery, tasks]);

  useEffect(() => {
    if (!requestedTaskId || isLoading) return;

    const scrollTimer = window.setTimeout(() => {
      const matchingTask = tasks.find((task) => task.id === requestedTaskId);
      if (!matchingTask) {
        setActionError("The linked task was not found in this clinic.");
        return;
      }

      setActionError("");
      setSearchQuery("");
      setPriorityFilter("all");
      setDueFilter("all");

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
      await api.tasks.update(token, task.id, { status: nextStatus });
      setActionMessage(
        `${task.title} marked as ${
          nextStatus === "completed" ? "completed" : "pending"
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
          : "Unable to update task status.",
      );
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const deleteTask = async (task: TaskRow) => {
    if (!token) return;

    setUpdatingTaskId(task.id);
    setActionMessage("");
    setActionError("");

    try {
      await api.tasks.remove(token, task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setActionMessage(`${task.title} deleted.`);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to delete task.",
      );
    } finally {
      setUpdatingTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Tasks</h1>
          <p className="text-[#6B7280] mt-1">
            Stay on top of your to-dos and follow-ups.
          </p>
        </div>
        <Link
          href="/app/crm/tasks/new"
          className="bg-[#6E6AE8] hover:bg-[#5A56D4] text-white font-medium px-4 py-2.5 rounded-[14px] flex items-center gap-2 w-fit transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Task
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div
          className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-4"
          style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
        >
          <p className="text-2xl font-bold text-[#111111]">{pendingCount}</p>
          <p className="text-sm text-[#6B7280]">Pending Tasks</p>
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
          <p className="text-2xl font-bold text-amber-400">{dueTodayCount}</p>
          <p className="text-sm text-[#6B7280]">Due Today</p>
        </div>
        <div
          className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-4"
          style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
        >
          <p className="text-2xl font-bold text-green-400">
            {completedCount}
          </p>
          <p className="text-sm text-[#6B7280]">Completed</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[14px] pl-10 pr-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[rgba(110,106,232,0.4)] focus:ring-2 focus:ring-[rgba(110,106,232,0.08)] transition-all"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
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
          title="Backend tasks could not be loaded"
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
        {!isLoading && filteredTasks.map((task) => (
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
                    ? `Mark ${task.title} as incomplete`
                    : `Mark ${task.title} as complete`
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
                    {task.category}
                  </span>
                </div>
                <p className="text-sm text-[#6B7280] mb-2">
                  {task.description}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-[#6B7280]">
                  {task.contact && (
                    <span className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-[rgba(110,106,232,0.15)]" />
                      {task.contact}
                    </span>
                  )}
                  <span
                    className={`flex items-center gap-1 ${isOverdue(task) ? "text-red-400" : ""}`}
                  >
                    {isOverdue(task) && (
                      <AlertCircle className="w-3 h-3" />
                    )}
                    <Clock className="w-3 h-3" />
                    {task.due}
                  </span>
                </div>
              </div>
              <button
                onClick={() => void deleteTask(task)}
                disabled={updatingTaskId === task.id}
                aria-label={`Delete ${task.title}`}
                className="rounded-lg p-2 text-[#6B7280] hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {!isLoading && filteredTasks.length === 0 && (
          <div className="p-8 text-sm text-[#6B7280]">
            No tasks loaded yet.
          </div>
        )}
        <div className="p-4">
          <Link
            href="/app/crm/tasks/new"
            className="w-full py-3 border border-dashed border-[rgba(0,0,0,0.10)] rounded-[14px] text-sm text-[#6B7280] hover:border-[rgba(110,106,232,0.3)] hover:text-[#6E6AE8] transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add new task
          </Link>
        </div>
      </div>
    </div>
  );
}
