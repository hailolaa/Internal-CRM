"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarClock,
  CircleDollarSign,
  Layers3,
  Plus,
  RefreshCw,
  UserRoundCheck,
  Wrench,
} from "lucide-react";
import {
  Badge,
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
import { useToast } from "@/lib/toast-context";
import { isDashboardActiveProjectStatus } from "@/lib/dashboard-cards";
import { DashboardReturnLink } from "@/components/dashboard-return-link";
import type {
  ClientAccountContractStatus,
  ClientAccountServiceRecord,
  ClientAccountServiceStatus,
  ClientAccountServiceType,
  ClientAccountServiceUpdatePayload,
} from "@/lib/api-types";

type EditableServiceStatus = Exclude<ClientAccountServiceStatus, "archived">;

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
const SERVICE_STATUSES: EditableServiceStatus[] = ["onboarding", "active", "paused", "ended"];
const CONTRACT_STATUSES: ClientAccountContractStatus[] = ["active", "trial", "pending", "paused", "cancelled", "expired"];

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
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function renewalBadge(value?: string | null) {
  const days = daysUntil(value);
  if (days === null) return <Badge variant="neutral">No renewal</Badge>;
  if (days < 0) return <Badge variant="error">Overdue</Badge>;
  if (days <= 45) return <Badge variant="warning">{days}d</Badge>;
  return <Badge variant="success">{days}d</Badge>;
}

function personName(person: ClientAccountServiceRecord["owner"]) {
  if (!person) return "Unassigned";
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email;
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

export default function ServicesPage() {
  const searchParams = useSearchParams();
  const requestedStatus = searchParams.get("status");
  const requestedView = searchParams.get("view");
  const { session } = useAuth();
  const { addToast } = useToast();
  const token = session?.token;
  const [services, setServices] = useState<ClientAccountServiceRecord[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  const loadServices = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const rows = await api.clientAccounts.listServices(token, { includeArchived: false });
      setServices(rows);
      setStatusMessage("");
    } catch (error) {
      console.error("Failed to load service plans", error);
      setServices([]);
      setStatusMessage(error instanceof Error ? error.message : "Service plans could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadServices(), 0);
    return () => window.clearTimeout(timer);
  }, [loadServices]);

  const filteredServices = useMemo(() => {
    const search = query.trim().toLowerCase();
    return services.filter((service) => {
      const statusMatches = requestedView === "active-project"
        ? isDashboardActiveProjectStatus(service.status)
        : !requestedStatus || service.status === requestedStatus;
      const searchMatches =
        !search ||
        [service.name, service.serviceType, service.status, service.contractStatus, personName(service.owner)]
          .some((value) => String(value).toLowerCase().includes(search));

      return statusMatches && searchMatches;
    });
  }, [query, requestedStatus, requestedView, services]);

  const activeServices = services.filter((service) => service.status === "active");
  const monthlyValue = activeServices.reduce((sum, service) => sum + Number(service.recurringValue || 0), 0);
  const renewalsDue = services.filter((service) => {
    const days = daysUntil(service.renewalDate);
    return days !== null && days >= 0 && days <= 45;
  }).length;
  const ownedServices = services.filter((service) => service.owner).length;

  const updateService = async (service: ClientAccountServiceRecord, payload: ClientAccountServiceUpdatePayload) => {
    if (!token) return;
    try {
      const updated = await api.clientAccounts.updateService(token, service.id, payload);
      setServices((current) => current.map((item) => (item.id === service.id ? updated : item)));
      addToast("Service plan updated.", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Could not update service plan.", "error");
    }
  };

  const archiveService = async (service: ClientAccountServiceRecord) => {
    if (!token || !window.confirm(`Archive ${service.name}?`)) return;
    try {
      await api.clientAccounts.archiveService(token, service.id);
      setServices((current) => current.filter((item) => item.id !== service.id));
      addToast("Service plan archived.", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Could not archive service plan.", "error");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        subtitle="Review value, ownership, renewals and live delivery status in one place."
        icon={Wrench}
        iconColor="text-[#5e8a8d]"
        right={
          <div className="flex items-center gap-2">
            <Link href="/app/ops/client-accounts/services/new/" className="inline-flex items-center gap-2 rounded-full bg-[#5e8a8d] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#507b7e]">
              <Plus className="h-4 w-4" />New service
            </Link>
            <button type="button" aria-label="Refresh services" title="Refresh services" onClick={() => void loadServices()} disabled={isLoading || !token} className="inline-flex items-center rounded-full border border-[rgba(21,31,33,0.08)] bg-[#FFFCF9] p-2.5 text-[#151f21] transition-colors hover:bg-[#eaedeb] disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        }
      />

      <DashboardReturnLink visible={searchParams.get("from") === "dashboard"} />

      {statusMessage && <div className="rounded-2xl border border-[rgba(154,85,36,0.14)] bg-[rgba(154,85,36,0.05)] px-4 py-3 text-sm text-[#8a4b22]">{statusMessage}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 [&>div]:!p-5">
        {isLoading ? Array.from({ length: 4 }, (_, index) => <StatCardSkeleton key={index} />) : (
          <>
            <StatCard label="Active services" value={String(activeServices.length)} sub={`${services.length} total plans`} icon={Layers3} color="teal" />
            <StatCard label="Monthly value" value={formatMoney(monthlyValue, activeServices[0]?.currency || "GBP")} sub="Active recurring value" icon={CircleDollarSign} color="green" />
            <StatCard label="Renewals due" value={String(renewalsDue)} sub="Within the next 45 days" icon={CalendarClock} color={renewalsDue ? "amber" : "teal"} />
            <StatCard label="Assigned owner" value={`${ownedServices}/${services.length}`} sub="Plans with clear ownership" icon={UserRoundCheck} color="violet" />
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5e8a8d]">Delivery setup</p><h2 className="mt-1 text-xl font-semibold text-[#151f21]">Service plans</h2><p className="mt-1 text-sm text-[#7A746A]">Update statuses directly or open a new service plan.</p></div>
        <div className="w-full sm:max-w-md"><SearchInput placeholder="Search service plans..." value={query} onChange={setQuery} /></div>
      </div>

      <DataTable headers={[{ label: "Service" }, { label: "Owner" }, { label: "Value" }, { label: "Renewal" }, { label: "Status" }, { label: "Contract" }, { label: "", className: "text-right" }]}>
        {isLoading && Array.from({ length: 4 }, (_, index) => <TableRowSkeleton key={index} columns={7} />)}
        {!isLoading && filteredServices.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-[#5e8a8d]">{query ? "No service plans match that search." : "No live service plans are set up yet."}</td></tr>}
        {!isLoading && filteredServices.map((service) => (
          <TableRow key={service.id}>
            <TableCell><div><p className="font-semibold text-[#151f21]">{service.name}</p><p className="text-xs text-[#7A746A]">{serviceLabel(service.serviceType)}</p></div></TableCell>
            <TableCell><span className="text-sm text-[#151f21]">{personName(service.owner)}</span></TableCell>
            <TableCell><span className="font-semibold text-[#151f21]">{formatMoney(service.recurringValue, service.currency)}</span></TableCell>
            <TableCell><div className="space-y-1">{renewalBadge(service.renewalDate)}<p className="text-xs text-[#7A746A]">{formatDate(service.renewalDate)}</p></div></TableCell>
            <TableCell><select value={service.status} onChange={(event) => void updateService(service, { status: event.target.value as EditableServiceStatus })} className="rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-xs font-semibold text-[#151f21]">{SERVICE_STATUSES.map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}</select></TableCell>
            <TableCell><select value={service.contractStatus} onChange={(event) => void updateService(service, { contractStatus: event.target.value as ClientAccountContractStatus })} className="rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-xs font-semibold text-[#151f21]">{CONTRACT_STATUSES.map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}</select></TableCell>
            <TableCell className="text-right"><button type="button" onClick={() => void archiveService(service)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#9a5524] hover:underline"><Archive className="h-3.5 w-3.5" />Archive</button></TableCell>
          </TableRow>
        ))}
      </DataTable>
    </div>
  );
}
