"use client";

import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  FolderKanban,
  ListChecks,
  MonitorCog,
  Plus,
  Search,
  Target,
  TrendingUp,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertBanner,
  PageHeader,
  SkeletonLine,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  ClientAccountServiceRecord,
  ClientAccountServiceType,
  ClientAccountSummaryRecord,
  InternalTaskRecord,
} from "@/lib/api-types";

type WorkViewKey =
  | "website"
  | "seo"
  | "ads"
  | "onboarding"
  | "tracking"
  | "reports"
  | "fixes";

type WorkViewDefinition = {
  key: WorkViewKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  serviceTypes?: ClientAccountServiceType[];
  keywords: string[];
};

const WORK_VIEWS: WorkViewDefinition[] = [
  {
    key: "website",
    label: "Website Builds",
    description: "New sites, landing pages, launch tasks, and build QA.",
    icon: MonitorCog,
    serviceTypes: ["website", "landing_pages"],
    keywords: ["website", "site", "landing page", "launch", "web build"],
  },
  {
    key: "seo",
    label: "SEO",
    description: "SEO retainers, audits, content, technical fixes, and GBP work.",
    icon: TrendingUp,
    serviceTypes: ["seo", "gbp"],
    keywords: ["seo", "gbp", "content", "ranking", "technical audit"],
  },
  {
    key: "ads",
    label: "Ads",
    description: "Google Ads, Meta Ads, campaign setup, optimisation, and QA.",
    icon: Target,
    serviceTypes: ["ppc"],
    keywords: ["ads", "ppc", "google ads", "meta", "campaign", "ad account"],
  },
  {
    key: "onboarding",
    label: "Onboarding",
    description: "Kickoff, access, intake, implementation setup, and first-week work.",
    icon: BriefcaseBusiness,
    keywords: ["onboarding", "kickoff", "intake", "access", "setup"],
  },
  {
    key: "tracking",
    label: "Tracking",
    description: "GA4, tags, pixels, conversion tracking, forms, and attribution setup.",
    icon: BarChart3,
    keywords: ["tracking", "ga4", "tag", "pixel", "conversion", "attribution", "form"],
  },
  {
    key: "reports",
    label: "Reports",
    description: "Monthly reports, KPI notes, client updates, and performance reviews.",
    icon: ListChecks,
    keywords: ["report", "reporting", "kpi", "monthly update", "review"],
  },
  {
    key: "fixes",
    label: "Fixes",
    description: "Bug fixes, client requests, corrections, urgent updates, and QA changes.",
    icon: Wrench,
    keywords: ["fix", "bug", "issue", "request", "change", "qa", "urgent"],
  },
];

function formatLabel(value: string | null | undefined) {
  if (!value) return "General";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

function daysFromToday(value?: string | null) {
  const date = parseDate(value);
  if (!date) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.ceil((target.getTime() - start.getTime()) / 86400000);
}

function includesKeyword(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function taskSearchText(task: InternalTaskRecord) {
  return [
    task.title,
    task.description,
    task.category,
    task.boardKey,
    task.serviceType,
    task.contact,
    task.assignedTo,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function serviceSearchText(service: ClientAccountServiceRecord) {
  return [
    service.name,
    service.serviceType,
    service.status,
    service.contractStatus,
    service.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function taskMatchesView(task: InternalTaskRecord, view: WorkViewDefinition) {
  if (view.serviceTypes?.includes(task.serviceType as ClientAccountServiceType)) {
    return true;
  }
  return includesKeyword(taskSearchText(task), view.keywords);
}

function serviceMatchesView(
  service: ClientAccountServiceRecord,
  view: WorkViewDefinition,
) {
  if (view.serviceTypes?.includes(service.serviceType)) return true;
  if (view.key === "onboarding" && service.status === "onboarding") return true;
  return includesKeyword(serviceSearchText(service), view.keywords);
}

function isTaskOverdue(task: InternalTaskRecord) {
  if (task.status === "completed") return false;
  if (task.isOverdue) return true;
  const days = daysFromToday(task.dueDate);
  return days !== null && days < 0;
}

function isDueSoon(task: InternalTaskRecord) {
  if (task.status === "completed") return false;
  const days = daysFromToday(task.dueDate);
  return days !== null && days >= 0 && days <= 7;
}

function isActiveService(service: ClientAccountServiceRecord) {
  return service.status === "active" || service.status === "onboarding";
}

export default function DeliveryWorkPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [tasks, setTasks] = useState<InternalTaskRecord[]>([]);
  const [services, setServices] = useState<ClientAccountServiceRecord[]>([]);
  const [clientAccounts, setClientAccounts] = useState<ClientAccountSummaryRecord[]>([]);
  const [activeView, setActiveView] = useState<WorkViewKey>("website");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    setIsLoading(true);

    Promise.allSettled([
      api.internalTasks.list(token, { includeArchived: false }),
      api.clientAccounts.listServices(token, { includeArchived: false }),
      api.clientAccounts.list(token),
    ])
      .then(([taskResult, serviceResult, accountResult]) => {
        if (!isMounted) return;

        setTasks(taskResult.status === "fulfilled" ? taskResult.value : []);
        setServices(serviceResult.status === "fulfilled" ? serviceResult.value : []);
        setClientAccounts(
          accountResult.status === "fulfilled" ? accountResult.value : [],
        );

        const failedSources = [
          taskResult.status === "rejected" ? "internal tasks" : "",
          serviceResult.status === "rejected" ? "client services" : "",
          accountResult.status === "rejected" ? "client accounts" : "",
        ].filter(Boolean);

        setLoadError(
          failedSources.length
            ? `Some delivery data could not be loaded: ${failedSources.join(", ")}.`
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

  const serviceById = useMemo(() => {
    return new Map(services.map((service) => [service.id, service]));
  }, [services]);

  const viewSummaries = useMemo(() => {
    return WORK_VIEWS.map((view) => {
      const viewTasks = tasks.filter((task) => taskMatchesView(task, view));
      const viewServices = services.filter((service) =>
        serviceMatchesView(service, view),
      );
      return {
        ...view,
        openTasks: viewTasks.filter((task) => task.status === "pending").length,
        overdueTasks: viewTasks.filter(isTaskOverdue).length,
        dueSoonTasks: viewTasks.filter(isDueSoon).length,
        activeServices: viewServices.filter(isActiveService).length,
      };
    });
  }, [services, tasks]);

  const activeDefinition =
    WORK_VIEWS.find((view) => view.key === activeView) || WORK_VIEWS[0];
  const query = searchQuery.trim().toLowerCase();

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => taskMatchesView(task, activeDefinition))
      .filter((task) => {
        if (!query) return true;
        const linkedService = task.clientAccountServiceId
          ? serviceById.get(task.clientAccountServiceId)
          : null;
        const clientName = task.clientAccountProfileId
          ? clientNameByProfileId.get(task.clientAccountProfileId)
          : "";
        return [
          taskSearchText(task),
          linkedService?.name || "",
          clientName || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        if (isTaskOverdue(a) !== isTaskOverdue(b)) return isTaskOverdue(a) ? -1 : 1;
        if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
        return (parseDate(a.dueDate)?.getTime() || 0) - (parseDate(b.dueDate)?.getTime() || 0);
      });
  }, [activeDefinition, clientNameByProfileId, query, serviceById, tasks]);

  const filteredServices = useMemo(() => {
    return services
      .filter((service) => serviceMatchesView(service, activeDefinition))
      .filter((service) => {
        if (!query) return true;
        const clientName =
          clientNameByProfileId.get(service.clientAccountProfileId) || "";
        return `${serviceSearchText(service)} ${clientName}`
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "onboarding" ? -1 : 1;
        return (parseDate(a.renewalDate)?.getTime() || 0) - (parseDate(b.renewalDate)?.getTime() || 0);
      });
  }, [activeDefinition, clientNameByProfileId, query, services]);

  const openTasks = filteredTasks.filter((task) => task.status === "pending");
  const completedTasks = filteredTasks.filter((task) => task.status === "completed");
  const overdueCount = filteredTasks.filter(isTaskOverdue).length;
  const dueSoonCount = filteredTasks.filter(isDueSoon).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery Work"
        subtitle="Internal project views for website builds, SEO, ads, onboarding, tracking, reports, and fixes."
        icon={FolderKanban}
        right={
          <Link
            href="/app/crm/tasks/new"
            className="flex items-center gap-2 rounded-[14px] bg-[#6E6AE8] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#5A56D4]"
          >
            <Plus className="h-4 w-4" />
            Add Task
          </Link>
        }
      />

      {loadError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Delivery work loaded with gaps"
          description={loadError}
          variant="warning"
        />
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
        {isLoading
          ? Array.from({ length: 7 }, (_, index) => (
              <div
                key={index}
                className="rounded-[18px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9] p-4"
              >
                <SkeletonLine className="mb-3 h-5 w-2/3" />
                <SkeletonLine className="h-8 w-1/2" />
              </div>
            ))
          : viewSummaries.map((view) => {
              const Icon = view.icon;
              const isActive = activeView === view.key;
              return (
                <button
                  key={view.key}
                  onClick={() => setActiveView(view.key)}
                  className={`rounded-[18px] border p-4 text-left transition-colors ${
                    isActive
                      ? "border-[rgba(96,180,175,0.35)] bg-[rgba(96,180,175,0.08)]"
                      : "border-[rgba(21,31,33,0.06)] bg-[#FFFCF9] hover:border-[rgba(96,180,175,0.22)]"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Icon className="h-4 w-4 text-[#5e8a8d]" />
                    {view.overdueTasks > 0 && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {view.overdueTasks} overdue
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-[#151f21]">{view.label}</p>
                  <p className="mt-1 text-xs text-[#5e8a8d]">
                    {view.openTasks} open - {view.activeServices} projects
                  </p>
                </button>
              );
            })}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#151f21]">
            {activeDefinition.label}
          </h2>
          <p className="text-sm text-[#5e8a8d]">{activeDefinition.description}</p>
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e8a8d]" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search client, service, or task..."
            className="w-full rounded-[14px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9] py-2.5 pl-10 pr-4 text-sm text-[#151f21] placeholder:text-[#5e8a8d] focus:border-[rgba(96,180,175,0.35)] focus:outline-none focus:ring-2 focus:ring-[rgba(96,180,175,0.10)]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Open Work", value: openTasks.length, icon: ListChecks },
          { label: "Active Projects", value: filteredServices.filter(isActiveService).length, icon: BriefcaseBusiness },
          { label: "Overdue", value: overdueCount, icon: AlertCircle },
          { label: "Due Soon", value: dueSoonCount, icon: CalendarClock },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[18px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9] p-4"
            style={{ boxShadow: "0 1px 6px rgba(21,31,33,0.03)" }}
          >
            <div className="mb-2 flex items-center gap-2 text-[#5e8a8d]">
              <stat.icon className="h-4 w-4" />
              <span className="text-sm">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-[#151f21]">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section
          className="rounded-[24px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9]"
          style={{ boxShadow: "0 1px 6px rgba(21,31,33,0.03)" }}
        >
          <div className="flex items-center justify-between border-b border-[rgba(21,31,33,0.05)] px-5 py-4">
            <div>
              <h3 className="font-semibold text-[#151f21]">Projects & Services</h3>
              <p className="text-sm text-[#5e8a8d]">Client work linked to this view</p>
            </div>
            <Link
              href="/app/ops/client-accounts"
              className="text-sm font-medium text-[#5e8a8d] hover:text-[#151f21]"
            >
              Clients
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
              filteredServices.map((service) => (
                <Link
                  key={service.id}
                  href={`/app/ops/client-accounts?serviceId=${service.id}`}
                  className="block p-5 hover:bg-[rgba(96,180,175,0.03)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-[#151f21]">{service.name}</span>
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
            {!isLoading && filteredServices.length === 0 && (
              <p className="p-5 text-sm text-[#5e8a8d]">
                No client services match this delivery view yet.
              </p>
            )}
          </div>
        </section>

        <section
          className="rounded-[24px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9]"
          style={{ boxShadow: "0 1px 6px rgba(21,31,33,0.03)" }}
        >
          <div className="flex items-center justify-between border-b border-[rgba(21,31,33,0.05)] px-5 py-4">
            <div>
              <h3 className="font-semibold text-[#151f21]">Open Work</h3>
              <p className="text-sm text-[#5e8a8d]">Tasks grouped into this delivery lane</p>
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
              openTasks.map((task) => {
                const linkedService = task.clientAccountServiceId
                  ? serviceById.get(task.clientAccountServiceId)
                  : null;
                const clientName = task.clientAccountProfileId
                  ? clientNameByProfileId.get(task.clientAccountProfileId)
                  : null;
                return (
                  <Link
                    key={task.id}
                    href={`/app/crm/tasks?taskId=${task.id}`}
                    className="block p-5 hover:bg-[rgba(96,180,175,0.03)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-[#151f21]">{task.title}</span>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          isTaskOverdue(task)
                            ? "bg-red-500/10 text-red-600"
                            : "bg-[rgba(96,180,175,0.08)] text-[#5e8a8d]"
                        }`}
                      >
                        {isTaskOverdue(task) ? "Overdue" : task.priority}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[#5e8a8d]">
                      <span>{task.assignedTo || "Unassigned"}</span>
                      {clientName && <span>{clientName}</span>}
                      {linkedService && <span>{linkedService.name}</span>}
                      <span>Due {formatDate(task.dueDate)}</span>
                    </div>
                  </Link>
                );
              })}
            {!isLoading && openTasks.length === 0 && (
              <p className="p-5 text-sm text-[#5e8a8d]">
                No open tasks match this delivery view.
              </p>
            )}
          </div>
        </section>
      </div>

      {completedTasks.length > 0 && (
        <section
          className="rounded-[24px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9]"
          style={{ boxShadow: "0 1px 6px rgba(21,31,33,0.03)" }}
        >
          <div className="flex items-center gap-2 border-b border-[rgba(21,31,33,0.05)] px-5 py-4">
            <CheckCircle2 className="h-4 w-4 text-[#60b4af]" />
            <h3 className="font-semibold text-[#151f21]">Recently Completed</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
            {completedTasks.slice(0, 6).map((task) => (
              <Link
                key={task.id}
                href={`/app/crm/tasks?taskId=${task.id}`}
                className="rounded-[16px] border border-[rgba(21,31,33,0.06)] bg-[#FAF8F5] p-4 hover:border-[rgba(96,180,175,0.25)]"
              >
                <p className="font-medium text-[#151f21]">{task.title}</p>
                <p className="mt-1 text-sm text-[#5e8a8d]">
                  {task.assignedTo || "Unassigned"} - {formatLabel(task.category || "Delivery")}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
