"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarClock,
  CircleDollarSign,
  Download,
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
import { saveBlobDownload } from "@/lib/download";
import {
  getClientNextBestAction,
  nextBestActionBadgeClass,
} from "@/lib/next-best-action";
import {
  getClientAccountDrilldownView,
  matchesClientAccountDrilldown,
  type ClientAccountDrilldownView,
} from "@/lib/operations-drilldowns";
import type {
  ClientAccountContractStatus,
  ClientAccountProfileRecord,
  ClientAccountServiceRecord,
  ClientAccountSummaryRecord,
  InternalTaskRecord,
} from "@/lib/api-types";

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

function formatMoney(value: number | null | undefined, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function contractBadge(status: ClientAccountContractStatus | string) {
  if (status === "active") return <Badge variant="success">Active</Badge>;
  if (status === "trial" || status === "pending") {
    return <Badge variant="info">{formatLabel(status)}</Badge>;
  }
  if (status === "paused") return <Badge variant="warning">Paused</Badge>;
  return <Badge variant="error">{formatLabel(status)}</Badge>;
}

function paymentBadge(status: string) {
  if (status === "paid") return <Badge variant="success">Paid</Badge>;
  if (status === "pending" || status === "not_started") return <Badge variant="info">{formatLabel(status)}</Badge>;
  if (status === "overdue" || status === "failed") return <Badge variant="error">{formatLabel(status)}</Badge>;
  return <Badge variant="neutral">{formatLabel(status)}</Badge>;
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

const clientAccountDrilldownLabels: Record<
  ClientAccountDrilldownView,
  string
> = {
  onboarding: "onboarding clients",
  "missing-access": "clients missing access",
  "missing-files": "clients missing file links",
};

export default function ClientAccountsPage() {
  const searchParams = useSearchParams();
  const requestedContractStatus = searchParams.get("contractStatus");
  const requestedSearch = searchParams.get("search") || "";
  const requestedView = getClientAccountDrilldownView(searchParams.get("view"));
  const { session } = useAuth();
  const token = session?.token;
  const [accounts, setAccounts] = useState<ClientAccountSummaryRecord[]>([]);
  const [profile, setProfile] = useState<ClientAccountProfileRecord | null>(null);
  const [services, setServices] = useState<ClientAccountServiceRecord[]>([]);
  const [tasks, setTasks] = useState<InternalTaskRecord[]>([]);
  const [accountQuery, setAccountQuery] = useState(requestedSearch);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [isExporting, setIsExporting] = useState(false);

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

  const handleExport = useCallback(async () => {
    if (!token || isExporting) return;

    setIsExporting(true);
    setStatusMessage("");
    try {
      const result = await api.clientAccounts.exportCsv(token, {
        search: accountQuery,
        contractStatus:
          requestedContractStatus && requestedContractStatus !== "open"
            ? (requestedContractStatus as ClientAccountContractStatus)
            : undefined,
      });
      saveBlobDownload(result.blob, result.fileName);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Client account export could not download.",
      );
    } finally {
      setIsExporting(false);
    }
  }, [accountQuery, isExporting, requestedContractStatus, token]);

  const hasLoadedData = !isLoading && !statusMessage;
  const activeServices = services.filter((service) => service.status === "active");
  const totalMrr = accounts.reduce((sum, account) => sum + Number(account.monthlyPrice || 0), 0);
  const totalSetupFees = accounts.reduce((sum, account) => sum + Number(account.setupFee || 0), 0);
  const paymentIssues = accounts.filter((account) => ["overdue", "failed"].includes(account.paymentStatus) || account.invoiceStatus === "overdue");
  const soonRenewals = services.filter((service) => {
    const days = daysUntil(service.renewalDate);
    return days !== null && days >= 0 && days <= 45;
  });
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
      const viewMatches = matchesClientAccountDrilldown(
        account,
        requestedView,
      );
      const searchMatches =
        !search ||
        [
          account.clinicName,
          account.contractStatus,
          account.paymentStatus,
          account.invoiceStatus,
          account.healthStatus,
          account.churnRisk,
          account.currentPackage || "",
          account.recommendedNextPackage || "",
          account.upsellOpportunity || "",
          account.address || "",
          account.city || "",
          account.state || "",
          account.postalCode || "",
          account.country || "",
          account.upsellPrompts.map((prompt) => `${prompt.toPackage} ${prompt.reason}`).join(" "),
          account.openIssueCount ? `${account.openIssueCount} open issues` : "",
          accountPersonName(account.accountManager),
          account.activeServices.join(" "),
        ].some((value) => value.toLowerCase().includes(search));

      return statusMatches && viewMatches && searchMatches;
    });
  }, [
    accounts,
    accountQuery,
    requestedContractStatus,
    requestedView,
  ]);


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
                onClick={handleExport}
                disabled={isExporting || !token}
                className="inline-flex items-center gap-2 rounded-full border border-[rgba(21,31,33,0.08)] bg-[#FFFCF9] px-4 py-2 text-sm font-semibold text-[#315f62] transition-colors hover:bg-[#eaedeb] disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {isExporting ? "Exporting" : "Export CSV"}
              </button>
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
              label="Active Clients"
              value={hasLoadedData ? String(accounts.filter((account) => account.clientStatus === "active").length) : "N/A"}
              sub={hasLoadedData ? `${activeServices.length} active services` : "Live data unavailable"}
              icon={Layers3}
              color="violet"
            />
            <StatCard
              label="Total MRR"
              value={hasLoadedData ? formatMoney(totalMrr, accounts[0]?.currency || "GBP") : "N/A"}
              sub="Client record monthly price"
              icon={CircleDollarSign}
              color="green"
            />
            <StatCard
              label="Setup Fees"
              value={hasLoadedData ? formatMoney(totalSetupFees, accounts[0]?.currency || "GBP") : "N/A"}
              sub="One-off setup tracked manually"
              icon={CalendarClock}
              color="teal"
            />
            <StatCard
              label="Payment Issues"
              value={hasLoadedData ? String(paymentIssues.length) : "N/A"}
              sub={profile?.renewalDate ? `Next renewal: ${formatDate(profile.renewalDate)}` : `${soonRenewals.length} renewals due soon`}
              icon={ShieldCheck}
              color={paymentIssues.length ? "amber" : "green"}
            />
          </>
        )}
      </div>




      <Card className="order-4" padding="p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5e8a8d]">Portfolio</p>
            <h2 className="mt-1 text-xl font-semibold text-[#151f21]">Client accounts</h2>
            <p className="mt-1 text-sm text-[#7A746A]">
              {requestedView
                ? `Showing ${clientAccountDrilldownLabels[requestedView]} from the active/open account population.`
                : "Start here to understand ownership, risk and next actions."}
            </p>
            {requestedView ? (
              <Link
                href="/app/ops/client-accounts"
                className="mt-2 inline-flex text-sm font-semibold text-[#315f62] hover:underline"
              >
                Clear dashboard filter
              </Link>
            ) : null}
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
            { label: "Package / MRR" },
            { label: "Next Action" },
            { label: "Payment" },
            { label: "Contract" },
            { label: "Renewal / Notice" },
            { label: "Next Task" },
          ]}
        >
          {isLoading &&
            Array.from({ length: 3 }, (_, index) => (
              <TableRowSkeleton key={`account-loading-${index}`} columns={8} />
            ))}
          {!isLoading && filteredAccounts.length === 0 && (
            <tr>
              <td colSpan={8} className="px-6 py-10 text-center text-sm text-[#5e8a8d]">
                {accountQuery
                  ? "No client accounts match that search."
                  : requestedView
                    ? `No ${clientAccountDrilldownLabels[requestedView]} were found.`
                  : "No client accounts are available for this user."}
              </td>
            </tr>
          )}
          {!isLoading && filteredAccounts.map((account) => {
            const nextTask = account.id ? nextOpenTaskByClient.get(account.id) : null;
            const accountHref = `/app/ops/client-accounts/detail?id=${encodeURIComponent(account.clinicId)}`;
            const nextBestAction = getClientNextBestAction({
              churnRisk: account.churnRisk,
              contractStatus: account.contractStatus,
              currentPackage: account.currentPackage,
              googleDriveFolderAccessStatus: account.googleDriveFolderAccessStatus,
              googleDriveFolderId: account.googleDriveFolderId,
              healthStatus: account.healthStatus,
              href: accountHref,
              nextTaskTitle: nextTask?.title,
              onboardingStatus: account.onboardingStatus,
              overdueTaskCount: account.overdueTaskCount,
              recommendedNextPackage: account.recommendedNextPackage,
              renewalDate: account.renewalDate,
              upsellOpportunity: account.upsellOpportunity || account.upsellPrompts[0]?.reason,
            });
            return (
            <TableRow key={account.clinicId}>
              <TableCell>
                <div>
                  <p className="font-semibold text-[#151f21]">
                    <Link href={accountHref} className="transition-colors hover:text-[#315f62] hover:underline">
                      {account.clinicName}
                    </Link>
                  </p>
                  <p className="text-xs text-[#7A746A]">
                    {formatLabel(account.clientStatus)} · {formatLabel(account.healthStatus)} · {formatLabel(account.churnRisk)} risk
                  </p>
                  {account.openIssueCount > 0 ? (
                    <p className="mt-1 text-xs font-medium text-amber-700">
                      {account.openIssueCount} open issue{account.openIssueCount === 1 ? "" : "s"}
                      {account.overdueIssueCount > 0 ? `, ${account.overdueIssueCount} overdue` : ""}
                    </p>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-[#151f21]">
                  {accountPersonName(account.accountManager)}
                </span>
              </TableCell>
              <TableCell>
                <div className="min-w-[180px] space-y-1">
                  <p className="text-sm font-semibold text-[#151f21]">
                    {account.currentPackage || "No current package"}
                  </p>
                  <p className="text-xs text-[#7A746A]">
                    MRR: {account.monthlyPrice === null || account.monthlyPrice === undefined ? "Not set" : formatMoney(account.monthlyPrice, account.currency)}
                  </p>
                  <p className="text-xs text-[#7A746A]">
                    Setup: {account.setupFee === null || account.setupFee === undefined ? "Not set" : formatMoney(account.setupFee, account.currency)}
                  </p>
                  {account.recommendedNextPackage ? (
                    <p className="max-w-[220px] truncate text-xs font-medium text-[#315f62]">
                      Next: {account.recommendedNextPackage}
                    </p>
                  ) : null}
                  {account.upsellPrompts.length > 0 ? (
                    <p className="max-w-[220px] truncate text-xs font-medium text-amber-700">
                      Prompt: {account.upsellPrompts[0].toPackage}
                    </p>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <div className="max-w-[220px] space-y-1">
                  <Link
                    href={nextBestAction.href || accountHref}
                    title={nextBestAction.detail}
                    className={`inline-flex max-w-full truncate rounded-full border px-2.5 py-1 text-xs font-semibold hover:underline ${nextBestActionBadgeClass(nextBestAction.urgency)}`}
                  >
                    {nextBestAction.label}
                  </Link>
                  <p className="truncate text-xs text-[#7A746A]">
                    {nextBestAction.detail}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  {paymentBadge(account.paymentStatus)}
                  <p className="text-xs text-[#7A746A]">
                    Invoice: {formatLabel(account.invoiceStatus)}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  {contractBadge(account.contractStatus)}
                  <p className="text-xs text-[#7A746A]">
                    Start: {formatDate(account.contractStartDate)}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  {renewalBadge(account.renewalDate)}
                  <p className="text-xs text-[#7A746A]">
                    Renewal: {formatDate(account.renewalDate)}
                  </p>
                  <p className="text-xs text-[#7A746A]">
                    Notice: {formatDate(account.noticeDate)}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  {taskDueBadge(nextTask)}
                  {nextTask ? (
                    <Link
                      href={`/app/crm/tasks/detail?id=${nextTask.id}&from=delivery`}
                      className="block max-w-[180px] truncate text-xs font-medium text-[#315f62] hover:underline"
                    >
                      {nextTask.title}
                    </Link>
                  ) : (
                    <p className="text-xs text-[#7A746A]">No follow-up task</p>
                  )}
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
