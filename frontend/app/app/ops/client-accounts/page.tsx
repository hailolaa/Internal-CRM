"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarClock,
  CircleDollarSign,
  Layers3,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  AlertBanner,
  Badge,
  Card,
  DataTable,
  PageHeader,
  ProgressBar,
  SearchInput,
  StatCard,
  StatCardSkeleton,
  TableCell,
  TableRow,
  TableRowSkeleton,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { DashboardReturnLink } from "@/components/dashboard-return-link";
import type {
  ClientAccountContractStatus,
  ClientAccountProfileRecord,
  ClientAccountServiceRecord,
  ClientAccountServiceType,
  ClientAccountSummaryRecord,
  InternalTaskRecord,
} from "@/lib/api-types";

const SERVICE_TYPES: Array<{ value: ClientAccountServiceType; label: string }> = [
  { value: "ppc", label: "PPC" },
  { value: "seo", label: "SEO" },
  { value: "gbp", label: "GBP" },
  { value: "website", label: "Website" },
  { value: "landing_pages", label: "Landing Pages" },
  { value: "cro", label: "CRO" },
  { value: "strategy", label: "Strategy" },
  { value: "other", label: "Other" },
];

function formatLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function accountPersonName(
  person: ClientAccountProfileRecord["accountManager"],
) {
  if (!person) return "Unassigned";
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email || "Unassigned";
}

function serviceLabel(type: ClientAccountServiceType | string) {
  return SERVICE_TYPES.find((service) => service.value === type)?.label || formatLabel(type);
}

function formatMoney(value: number | null | undefined, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function packageName(activeServiceCount: number, monthlyValue: number) {
  if (activeServiceCount >= 5 || monthlyValue >= 4000) return "Scale";
  if (activeServiceCount >= 3 || monthlyValue >= 2200) return "Growth";
  if (activeServiceCount >= 1 || monthlyValue > 0) return "Starter";
  return "Unpackaged";
}

function contractBadge(status: ClientAccountContractStatus | string) {
  if (status === "active") return <Badge variant="success">Active</Badge>;
  if (status === "trial" || status === "pending") {
    return <Badge variant="info">{formatLabel(status)}</Badge>;
  }
  if (status === "paused") return <Badge variant="warning">Paused</Badge>;
  return <Badge variant="error">{formatLabel(status)}</Badge>;
}

function renewalBadge(value?: string | null) {
  const days = daysUntil(value);
  if (days === null) return <Badge variant="neutral">No renewal</Badge>;
  if (days < 0) return <Badge variant="error">Overdue</Badge>;
  if (days <= 45) return <Badge variant="warning">{days}d</Badge>;
  return <Badge variant="success">{days}d</Badge>;
}

function taskDueBadge(task?: InternalTaskRecord | null) {
  if (!task) return <Badge variant="neutral">No open task</Badge>;
  if (!task.dueDate) return <Badge variant="neutral">No due date</Badge>;
  const days = daysUntil(task.dueDate);
  if (days === null) return <Badge variant="neutral">No due date</Badge>;
  if (days < 0) return <Badge variant="error">Overdue</Badge>;
  if (days === 0) return <Badge variant="warning">Today</Badge>;
  if (days <= 7) return <Badge variant="warning">{days}d</Badge>;
  return <Badge variant="success">{days}d</Badge>;
}

export default function ClientAccountsPage() {
  const searchParams = useSearchParams();
  const requestedContractStatus = searchParams.get("contractStatus");
  const { session } = useAuth();
  const token = session?.token;
  const [accounts, setAccounts] = useState<ClientAccountSummaryRecord[]>([]);
  const [profile, setProfile] = useState<ClientAccountProfileRecord | null>(null);
  const [services, setServices] = useState<ClientAccountServiceRecord[]>([]);
  const [tasks, setTasks] = useState<InternalTaskRecord[]>([]);
  const [accountQuery, setAccountQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  const loadData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [accountRows, profileRow, serviceRows, taskRows] = await Promise.all([
        api.clientAccounts.list(token),
        api.clientAccounts.getProfile(token),
        api.clientAccounts.listServices(token, { includeArchived: false }),
        api.internalTasks.list(token, { includeArchived: false, completed: false }),
      ]);
      setAccounts(accountRows);
      setProfile(profileRow);
      setServices(serviceRows);
      setTasks(taskRows);
      setStatusMessage("");
    } catch (error) {
      console.error("Failed to load client package data", error);
      setAccounts([]);
      setProfile(null);
      setServices([]);
      setTasks([]);
      setStatusMessage(
        error instanceof Error
          ? `Client package data could not load: ${error.message}`
          : "Client package data could not load.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const hasLoadedData = !isLoading && !statusMessage;
  const activeServices = services.filter((service) => service.status === "active");
  const activeMonthlyValue = activeServices.reduce(
    (sum, service) => sum + Number(service.recurringValue || 0),
    0,
  );
  const soonRenewals = services.filter((service) => {
    const days = daysUntil(service.renewalDate);
    return days !== null && days >= 0 && days <= 45;
  });
  const packageTier = packageName(activeServices.length, activeMonthlyValue);
  const nextOpenTaskByClient = useMemo(() => {
    const map = new Map<string, InternalTaskRecord>();
    tasks
      .filter((task) => task.status !== "completed" && task.clientAccountProfileId)
      .sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return a.createdAt.localeCompare(b.createdAt);
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      })
      .forEach((task) => {
        if (task.clientAccountProfileId && !map.has(task.clientAccountProfileId)) {
          map.set(task.clientAccountProfileId, task);
        }
      });
    return map;
  }, [tasks]);

  const filteredAccounts = useMemo(() => {
    const search = accountQuery.trim().toLowerCase();
    return accounts.filter((account) => {
      const statusMatches =
        requestedContractStatus !== "open" ||
        ["active", "trial", "pending"].includes(account.contractStatus);
      const searchMatches =
        !search ||
        [
          account.clinicName,
          account.contractStatus,
          account.healthStatus,
          account.churnRisk,
          accountPersonName(account.accountManager),
          account.activeServices.join(" "),
        ].some((value) => value.toLowerCase().includes(search));

      return statusMatches && searchMatches;
    });
  }, [accounts, accountQuery, requestedContractStatus]);


  return (
    <div className="flex flex-col gap-6">
      <div className="order-1 space-y-3">
        <PageHeader
          title="Client Accounts"
          subtitle="See every client relationship clearly, then manage package and delivery details when needed."
          icon={BriefcaseBusiness}
          iconColor="text-[#5e8a8d]"
          right={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/app/ops/client-accounts/package/"
                className="inline-flex items-center gap-2 rounded-full border border-[rgba(21,31,33,0.08)] bg-[#FFFCF9] px-4 py-2 text-sm font-semibold text-[#315f62] transition-colors hover:bg-[#eaedeb]"
              >
                <ShieldCheck className="h-4 w-4" />
                Package profile
              </Link>
              <Link
                href="/app/ops/client-accounts/services/new/"
                className="inline-flex items-center gap-2 rounded-full bg-[#e4efed] px-4 py-2 text-sm font-semibold text-[#315f62] transition-colors hover:bg-[#d8e9e6]"
              >
                <Plus className="h-4 w-4" />
                New service
              </Link>
              <Link
                href="/app/ops/client-accounts/new/"
                className="inline-flex items-center gap-2 rounded-full bg-[#5e8a8d] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#507b7e]"
              >
                <Plus className="h-4 w-4" />
                Add client
              </Link>
              <button
                type="button"
                aria-label="Refresh client accounts"
                title="Refresh client accounts"
                onClick={() => void loadData()}
                disabled={isLoading || !token}
                className="inline-flex items-center rounded-full border border-[rgba(21,31,33,0.08)] bg-[#FFFCF9] p-2.5 text-[#151f21] transition-colors hover:bg-[#eaedeb] disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          }
        />
        <DashboardReturnLink visible={searchParams.get("from") === "dashboard"} />
      </div>

      {statusMessage && (
        <div className="order-2">
          <AlertBanner
            icon={AlertTriangle}
            title="Client account data notice"
            description={statusMessage}
            variant="error"
          />
        </div>
      )}

      <div className="order-3 grid grid-cols-2 gap-3 lg:grid-cols-4 [&>div]:!p-5">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Package Tier"
              value={hasLoadedData ? packageTier : "N/A"}
              sub={hasLoadedData ? `${activeServices.length} active services` : "Live data unavailable"}
              icon={Layers3}
              color="violet"
            />
            <StatCard
              label="Monthly Value"
              value={hasLoadedData ? formatMoney(activeMonthlyValue, activeServices[0]?.currency || "GBP") : "N/A"}
              sub="Recurring services"
              icon={CircleDollarSign}
              color="green"
            />
            <StatCard
              label="Renewal Risk"
              value={hasLoadedData ? String(soonRenewals.length) : "N/A"}
              sub={profile?.renewalDate ? formatDate(profile.renewalDate) : "No profile renewal"}
              icon={CalendarClock}
              color={soonRenewals.length ? "amber" : "teal"}
            />
            <StatCard
              label="Contract"
              value={profile?.contractStatus ? formatLabel(profile.contractStatus) : "N/A"}
              sub={`Health: ${profile ? formatLabel(profile.healthStatus) : "N/A"}`}
              icon={ShieldCheck}
              color={profile?.contractStatus === "active" ? "green" : "amber"}
            />
          </>
        )}
      </div>




      <Card className="order-4" padding="p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5e8a8d]">Portfolio</p>
            <h2 className="mt-1 text-xl font-semibold text-[#151f21]">Client accounts</h2>
            <p className="mt-1 text-sm text-[#7A746A]">Start here to understand ownership, risk and next actions.</p>
          </div>
          <Badge variant="info">
            {isLoading ? "Loading" : `${filteredAccounts.length} accounts`}
          </Badge>
        </div>
        <div className="mb-4">
          <SearchInput
            placeholder="Search clients, managers or statuses..."
            value={accountQuery}
            onChange={setAccountQuery}
          />
        </div>
        <DataTable
          headers={[
            { label: "Client" },
            { label: "Manager" },
            { label: "Services" },
            { label: "Contract" },
            { label: "Renewal" },
            { label: "Next Task" },
            { label: "Action Plan" },
          ]}
        >
          {isLoading &&
            Array.from({ length: 3 }, (_, index) => (
              <TableRowSkeleton key={`account-loading-${index}`} columns={7} />
            ))}
          {!isLoading && filteredAccounts.length === 0 && (
            <tr>
              <td colSpan={7} className="px-6 py-10 text-center text-sm text-[#5e8a8d]">
                {accountQuery
                  ? "No client accounts match that search."
                  : "No client accounts are available for this user."}
              </td>
            </tr>
          )}
          {!isLoading && filteredAccounts.map((account) => {
            const nextTask = account.id ? nextOpenTaskByClient.get(account.id) : null;
            return (
            <TableRow key={account.clinicId}>
              <TableCell>
                <div>
                  <p className="font-semibold text-[#151f21]">
                    <Link href={`/app/ops/client-accounts/detail?id=${encodeURIComponent(account.clinicId)}`} className="transition-colors hover:text-[#315f62] hover:underline">
                      {account.clinicName}
                    </Link>
                  </p>
                  <p className="text-xs text-[#7A746A]">
                    {formatLabel(account.healthStatus)} - {formatLabel(account.churnRisk)} risk
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-[#151f21]">
                  {accountPersonName(account.accountManager)}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {account.activeServices.slice(0, 4).map((service) => (
                    <Badge key={service} variant="neutral" size="xs">
                      {serviceLabel(service)}
                    </Badge>
                  ))}
                  {account.activeServices.length === 0 && (
                    <Badge variant="warning" size="xs">
                      None
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{contractBadge(account.contractStatus)}</TableCell>
              <TableCell>
                <div className="space-y-1">
                  {renewalBadge(account.renewalDate)}
                  <p className="text-xs text-[#7A746A]">
                    {formatDate(account.renewalDate)}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  {taskDueBadge(nextTask)}
                  {nextTask ? (
                    <Link
                      href={`/app/crm/tasks?taskId=${nextTask.id}`}
                      className="block max-w-[180px] truncate text-xs font-medium text-[#315f62] hover:underline"
                    >
                      {nextTask.title}
                    </Link>
                  ) : (
                    <p className="text-xs text-[#7A746A]">No follow-up task</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="min-w-[120px]">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs text-[#7A746A]">
                      {account.actionPlanStatus
                        ? formatLabel(account.actionPlanStatus)
                        : "No plan"}
                    </span>
                    <span className="text-xs font-semibold text-[#151f21]">
                      {account.actionPlanProgressPercent}%
                    </span>
                  </div>
                  <ProgressBar
                    value={account.actionPlanProgressPercent}
                    max={100}
                    color={
                      account.actionPlanHighPriorityOpenItems > 0
                        ? "#b7672e"
                        : "#60b4af"
                    }
                  />
                </div>
              </TableCell>
            </TableRow>
            );
          })}
        </DataTable>
      </Card>
    </div>
  );
}
