"use client";

import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarClock,
  CheckSquare,
  CircleCheckBig,
  CircleX,
  ClipboardList,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertBanner,
  PageHeader,
  SkeletonLine,
  StatCard,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  ClientAccountServiceRecord,
  ClientAccountSummaryRecord,
  InternalTaskRecord,
  PipelineDealRecord,
  PipelineStageRecord,
} from "@/lib/api-types";

type DeadlineRow = {
  id: string;
  title: string;
  owner: string;
  date: string | null;
  href: string;
  type: "Task" | "Service";
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysFromToday(value?: string | null) {
  const date = parseDate(value);
  if (!date) return null;
  return Math.ceil(
    (startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86400000,
  );
}

function formatDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return "No date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isNewLead(deal: PipelineDealRecord) {
  const stage = (deal.stageName || "").toLowerCase();
  const createdDays = daysFromToday(deal.createdAt);
  return (
    deal.stageKind === "open" &&
    deal.status === "open" &&
    (stage.includes("new") ||
      stage.includes("enquiry") ||
      (createdDays !== null && createdDays >= -7))
  );
}

function isOpenClient(account: ClientAccountSummaryRecord) {
  return ["active", "trial", "pending"].includes(account.contractStatus);
}

function isActiveProject(service: ClientAccountServiceRecord) {
  return service.status === "active" || service.status === "onboarding";
}

function isTaskOverdue(task: InternalTaskRecord) {
  if (task.status === "completed") return false;
  if (task.isOverdue) return true;
  const days = daysFromToday(task.dueDate);
  return days !== null && days < 0;
}

function isUpcomingTask(task: InternalTaskRecord) {
  if (task.status === "completed") return false;
  const days = daysFromToday(task.dueDate);
  return days !== null && days >= 0 && days <= 14;
}

function isUpcomingService(service: ClientAccountServiceRecord) {
  if (!isActiveProject(service)) return false;
  const days = daysFromToday(service.renewalDate);
  return days !== null && days >= 0 && days <= 30;
}

export default function AppPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [deals, setDeals] = useState<PipelineDealRecord[]>([]);
  const [stages, setStages] = useState<PipelineStageRecord[]>([]);
  const [clientAccounts, setClientAccounts] = useState<ClientAccountSummaryRecord[]>([]);
  const [services, setServices] = useState<ClientAccountServiceRecord[]>([]);
  const [tasks, setTasks] = useState<InternalTaskRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    setIsLoading(true);

    Promise.allSettled([
      api.pipelineDeals.list(token),
      api.pipelineStages.list(token),
      api.clientAccounts.list(token),
      api.clientAccounts.listServices(token, { includeArchived: false }),
      api.internalTasks.list(token, { includeArchived: false }),
    ])
      .then(([dealResult, stageResult, accountResult, serviceResult, taskResult]) => {
        if (!isMounted) return;

        setDeals(dealResult.status === "fulfilled" ? dealResult.value.deals : []);
        setStages(stageResult.status === "fulfilled" ? stageResult.value : []);
        setClientAccounts(
          accountResult.status === "fulfilled" ? accountResult.value : [],
        );
        setServices(serviceResult.status === "fulfilled" ? serviceResult.value : []);
        setTasks(taskResult.status === "fulfilled" ? taskResult.value : []);

        const failedSources = [
          dealResult.status === "rejected" ? "sales pipeline" : "",
          stageResult.status === "rejected" ? "pipeline stages" : "",
          accountResult.status === "rejected" ? "client accounts" : "",
          serviceResult.status === "rejected" ? "active projects" : "",
          taskResult.status === "rejected" ? "internal tasks" : "",
        ].filter(Boolean);

        setLoadError(
          failedSources.length
            ? `Some operations data could not be loaded: ${failedSources.join(", ")}.`
            : "",
        );
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const clientNameByProfileId = useMemo(() => {
    return new Map(
      clientAccounts
        .filter((account) => account.id)
        .map((account) => [account.id as string, account.clinicName]),
    );
  }, [clientAccounts]);

  const metrics = useMemo(() => {
    const wonDeals = deals.filter(
      (deal) => deal.status === "won" || deal.stageKind === "won",
    );
    const lostDeals = deals.filter(
      (deal) => deal.status === "lost" || deal.stageKind === "lost",
    );

    return {
      newLeads: deals.filter(isNewLead),
      wonDeals,
      lostDeals,
      openClients: clientAccounts.filter(isOpenClient),
      activeProjects: services.filter(isActiveProject),
      overdueTasks: tasks.filter(isTaskOverdue),
    };
  }, [clientAccounts, deals, services, tasks]);

  const stageRows = useMemo(() => {
    const rows = stages
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((stage) => {
        const stageDeals = deals.filter(
          (deal) =>
            deal.stageId === stage.id ||
            (deal.stageName || "").toLowerCase() === stage.name.toLowerCase(),
        );

        return {
          id: stage.id,
          name: stage.name,
          count: stageDeals.length,
          valueCents: stageDeals.reduce(
            (total, deal) => total + Number(deal.valueCents || 0),
            0,
          ),
        };
      });

    const knownNames = new Set(rows.map((row) => row.name.toLowerCase()));
    const missingRows = deals
      .filter((deal) => deal.stageName && !knownNames.has(deal.stageName.toLowerCase()))
      .reduce<Array<{ id: string; name: string; count: number; valueCents: number }>>(
        (acc, deal) => {
          const name = deal.stageName || "Unassigned";
          const existing = acc.find((row) => row.name === name);
          if (existing) {
            existing.count += 1;
            existing.valueCents += Number(deal.valueCents || 0);
          } else {
            acc.push({
              id: name,
              name,
              count: 1,
              valueCents: Number(deal.valueCents || 0),
            });
          }
          return acc;
        },
        [],
      );

    return [...rows, ...missingRows];
  }, [deals, stages]);

  const upcomingDeadlines = useMemo<DeadlineRow[]>(() => {
    const taskRows = tasks.filter(isUpcomingTask).map((task) => ({
      id: task.id,
      title: task.title,
      owner: task.assignedTo || "Unassigned",
      date: task.dueDate,
      href: `/app/crm/tasks?taskId=${task.id}`,
      type: "Task" as const,
    }));

    const serviceRows = services.filter(isUpcomingService).map((service) => ({
      id: service.id,
      title: service.name,
      owner:
        clientNameByProfileId.get(service.clientAccountProfileId) ||
        "Linked client",
      date: service.renewalDate,
      href: `/app/ops/client-accounts?serviceId=${service.id}`,
      type: "Service" as const,
    }));

    return [...taskRows, ...serviceRows]
      .sort((a, b) => {
        const aTime = parseDate(a.date)?.getTime() || 0;
        const bTime = parseDate(b.date)?.getTime() || 0;
        return aTime - bTime;
      })
      .slice(0, 8);
  }, [clientNameByProfileId, services, tasks]);

  const maxStageCount = Math.max(1, ...stageRows.map((row) => row.count));
  const topActiveProjects = metrics.activeProjects.slice(0, 6);
  const overdueTasks = metrics.overdueTasks.slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mission Control"
        subtitle="Internal sales pipeline, client accounts, delivery work, and task health at a glance."
        icon={ClipboardList}
      />

      {loadError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Operations dashboard loaded with gaps"
          description={loadError}
          variant="warning"
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {isLoading ? (
          Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="rounded-[24px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9] p-6"
            >
              <SkeletonLine className="mb-3 h-4 w-24" />
              <SkeletonLine className="h-8 w-16" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              label="New Prospects"
              value={String(metrics.newLeads.length)}
              sub="new enquiries and recent opportunities"
              icon={Users}
              color="cyan"
            />
            <StatCard
              label="Won"
              value={String(metrics.wonDeals.length)}
              sub={formatMoney(
                metrics.wonDeals.reduce(
                  (total, deal) => total + Number(deal.valueCents || 0),
                  0,
                ),
              )}
              icon={CircleCheckBig}
              color="green"
            />
            <StatCard
              label="Lost"
              value={String(metrics.lostDeals.length)}
              sub="closed lost opportunities"
              icon={CircleX}
              color="rose"
            />
            <StatCard
              label="Open Clients"
              value={String(metrics.openClients.length)}
              sub="active, trial, and pending accounts"
              icon={BriefcaseBusiness}
              color="blue"
            />
            <StatCard
              label="Active Projects"
              value={String(metrics.activeProjects.length)}
              sub="services currently in delivery"
              icon={Target}
              color="purple"
            />
            <StatCard
              label="Overdue Tasks"
              value={String(metrics.overdueTasks.length)}
              sub="open internal tasks past due"
              icon={CheckSquare}
              color="amber"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section
          className="rounded-[24px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9] p-5 xl:col-span-2"
          style={{ boxShadow: "0 1px 6px rgba(21,31,33,0.03)" }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[#151f21]">Prospects by Stage</h2>
              <p className="text-sm text-[#5e8a8d]">
                {deals.length} total sales opportunities
              </p>
            </div>
            <Link
              href="/app/crm/pipeline"
              className="rounded-[14px] border border-[rgba(21,31,33,0.08)] px-3 py-2 text-sm font-medium text-[#151f21] hover:bg-[#eaedeb]"
            >
              Sales Pipeline
            </Link>
          </div>
          <div className="space-y-3">
            {isLoading &&
              Array.from({ length: 6 }, (_, index) => (
                <SkeletonLine key={index} className="h-8 w-full" />
              ))}
            {!isLoading &&
              stageRows.map((stage) => (
                <div key={stage.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-[#151f21]">
                      {stage.name}
                    </span>
                    <span className="text-[#5e8a8d]">
                      {stage.count} - {formatMoney(stage.valueCents)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#eaedeb]">
                    <div
                      className="h-2 rounded-full bg-[#60b4af]"
                      style={{
                        width: `${Math.max(4, (stage.count / maxStageCount) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            {!isLoading && stageRows.length === 0 && (
              <p className="text-sm text-[#5e8a8d]">No pipeline stages loaded.</p>
            )}
          </div>
        </section>

        <section
          className="rounded-[24px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9] p-5"
          style={{ boxShadow: "0 1px 6px rgba(21,31,33,0.03)" }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[#151f21]">Upcoming Deadlines</h2>
              <p className="text-sm text-[#5e8a8d]">Tasks and service renewals</p>
            </div>
            <CalendarClock className="h-5 w-5 text-[#60b4af]" />
          </div>
          <div className="space-y-3">
            {isLoading &&
              Array.from({ length: 5 }, (_, index) => (
                <SkeletonLine key={index} className="h-12 w-full" />
              ))}
            {!isLoading &&
              upcomingDeadlines.map((deadline) => (
                <Link
                  key={`${deadline.type}-${deadline.id}`}
                  href={deadline.href}
                  className="block rounded-[16px] border border-[rgba(21,31,33,0.06)] bg-[#FAF8F5] p-3 hover:border-[rgba(96,180,175,0.25)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-[#151f21]">
                      {deadline.title}
                    </span>
                    <span className="rounded-full bg-[rgba(96,180,175,0.08)] px-2 py-0.5 text-xs text-[#5e8a8d]">
                      {deadline.type}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-[#5e8a8d]">
                    <span>{deadline.owner}</span>
                    <span>{formatDate(deadline.date)}</span>
                  </div>
                </Link>
              ))}
            {!isLoading && upcomingDeadlines.length === 0 && (
              <p className="text-sm text-[#5e8a8d]">No upcoming deadlines found.</p>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section
          className="rounded-[24px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9]"
          style={{ boxShadow: "0 1px 6px rgba(21,31,33,0.03)" }}
        >
          <div className="flex items-center justify-between border-b border-[rgba(21,31,33,0.05)] px-5 py-4">
            <div>
              <h2 className="font-semibold text-[#151f21]">Active Projects</h2>
              <p className="text-sm text-[#5e8a8d]">Open delivery services</p>
            </div>
            <Link
              href="/app/ops/client-accounts"
              className="text-sm font-medium text-[#5e8a8d] hover:text-[#151f21]"
            >
              Client Accounts
            </Link>
          </div>
          <div className="divide-y divide-[rgba(21,31,33,0.05)]">
            {isLoading &&
              Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="p-5">
                  <SkeletonLine className="mb-2 h-5 w-2/3" />
                  <SkeletonLine className="h-4 w-1/2" />
                </div>
              ))}
            {!isLoading &&
              topActiveProjects.map((service) => (
                <Link
                  key={service.id}
                  href={`/app/ops/client-accounts?serviceId=${service.id}`}
                  className="block p-5 hover:bg-[rgba(96,180,175,0.03)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-[#151f21]">
                      {service.name}
                    </span>
                    <span className="rounded-full bg-[rgba(96,180,175,0.08)] px-2 py-1 text-xs font-medium text-[#5e8a8d]">
                      {formatLabel(service.status)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[#5e8a8d]">
                    <span>
                      {clientNameByProfileId.get(service.clientAccountProfileId) ||
                        "Linked client"}
                    </span>
                    <span>{formatLabel(service.serviceType)}</span>
                    <span>Renewal {formatDate(service.renewalDate)}</span>
                  </div>
                </Link>
              ))}
            {!isLoading && topActiveProjects.length === 0 && (
              <p className="p-5 text-sm text-[#5e8a8d]">No active projects found.</p>
            )}
          </div>
        </section>

        <section
          className="rounded-[24px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9]"
          style={{ boxShadow: "0 1px 6px rgba(21,31,33,0.03)" }}
        >
          <div className="flex items-center justify-between border-b border-[rgba(21,31,33,0.05)] px-5 py-4">
            <div>
              <h2 className="font-semibold text-[#151f21]">Overdue Tasks</h2>
              <p className="text-sm text-[#5e8a8d]">Open internal work past due</p>
            </div>
            <Link
              href="/app/crm/tasks"
              className="text-sm font-medium text-[#5e8a8d] hover:text-[#151f21]"
            >
              Tasks
            </Link>
          </div>
          <div className="divide-y divide-[rgba(21,31,33,0.05)]">
            {isLoading &&
              Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="p-5">
                  <SkeletonLine className="mb-2 h-5 w-2/3" />
                  <SkeletonLine className="h-4 w-1/2" />
                </div>
              ))}
            {!isLoading &&
              overdueTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/app/crm/tasks?taskId=${task.id}`}
                  className="block p-5 hover:bg-[rgba(96,180,175,0.03)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-[#151f21]">
                      {task.title}
                    </span>
                    <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700">
                      {task.priority}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[#5e8a8d]">
                    <span>{task.assignedTo || "Unassigned"}</span>
                    <span>{task.boardKey ? formatLabel(task.boardKey) : "Delivery"}</span>
                    <span>Due {formatDate(task.dueDate)}</span>
                  </div>
                </Link>
              ))}
            {!isLoading && overdueTasks.length === 0 && (
              <p className="p-5 text-sm text-[#5e8a8d]">No overdue internal tasks.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
