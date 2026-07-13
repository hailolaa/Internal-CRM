"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  ClipboardList,
  Edit3,
  ExternalLink,
  FileText,
  Globe,
  ListChecks,
  Mail,
  MapPin,
  Phone,
  ScrollText,
  ShieldCheck,
  Target,
  UserRoundCheck,
} from "lucide-react";
import { AlertBanner, Badge, Card, PageHeader, SkeletonLine } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  ClientAccountServiceRecord,
  ClientAccountSummaryRecord,
  InternalTaskRecord,
} from "@/lib/api-types";

function formatLabel(value: string | null | undefined) {
  if (!value) return "Not set";
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

function personName(person: ClientAccountSummaryRecord["accountManager"]) {
  if (!person) return "Unassigned";
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email || "Unassigned";
}

function serviceBadge(status: string) {
  if (status === "active") return <Badge variant="success">Active</Badge>;
  if (status === "onboarding") return <Badge variant="info">Onboarding</Badge>;
  if (status === "paused") return <Badge variant="warning">Paused</Badge>;
  return <Badge variant="neutral">{formatLabel(status)}</Badge>;
}

function accountLocation(account: ClientAccountSummaryRecord) {
  return [account.address, account.city, account.state, account.postalCode, account.country]
    .filter(Boolean)
    .join(", ");
}

export default function ClientAccountDetailPage() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get("id") || "";
  const { session } = useAuth();
  const token = session?.token;
  const [account, setAccount] = useState<ClientAccountSummaryRecord | null>(null);
  const [services, setServices] = useState<ClientAccountServiceRecord[]>([]);
  const [tasks, setTasks] = useState<InternalTaskRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!token) return;

    let mounted = true;

    async function loadRecord() {
      setIsLoading(true);
      setLoadError("");

      const [accountResult, serviceResult] = await Promise.allSettled([
        api.clientAccounts.list(token!),
        api.clientAccounts.listServices(token!, {
          includeArchived: false,
          includeAllClinics: true,
        }),
      ]);

      if (!mounted) return;

      if (accountResult.status === "rejected") {
        setLoadError(
          accountResult.reason instanceof Error
            ? accountResult.reason.message
            : "Client account could not be loaded.",
        );
        setIsLoading(false);
        return;
      }

      const selected =
        accountResult.value.find((item) => item.clinicId === accountId || item.id === accountId) || null;
      setAccount(selected);

      const serviceRows =
        serviceResult.status === "fulfilled"
          ? serviceResult.value.filter((service) =>
              selected
                ? service.clinicId === selected.clinicId ||
                  (selected.id && service.clientAccountProfileId === selected.id)
                : false,
            )
          : [];
      setServices(serviceRows);

      if (selected?.id) {
        try {
          const taskRows = await api.internalTasks.list(token!, {
            clientAccountProfileId: selected.id,
            includeArchived: false,
          });
          if (mounted) setTasks(taskRows);
        } catch {
          if (mounted) setTasks([]);
        }
      } else {
        setTasks([]);
      }

      if (!selected) setLoadError("Client account was not found.");
      setIsLoading(false);
    }

    void loadRecord();

    return () => {
      mounted = false;
    };
  }, [accountId, token]);

  const openTasks = useMemo(
    () => tasks.filter((task) => task.status !== "completed"),
    [tasks],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLine className="h-10 w-72" />
        <div className="grid gap-6 lg:grid-cols-3">
          <SkeletonLine className="h-56 lg:col-span-2" />
          <SkeletonLine className="h-56" />
        </div>
      </div>
    );
  }

  if (loadError || !account) {
    return (
      <div className="space-y-6">
        <Link href="/app/ops/client-accounts" className="btn-secondary inline-flex text-sm">
          <ArrowLeft className="h-4 w-4" />
          Back to client accounts
        </Link>
        <AlertBanner
          title="Client account could not be loaded"
          description={loadError || "The backend did not return this account."}
          variant="warning"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={account.clinicName}
        subtitle="Client account master record for ownership, package, delivery work and related CRM activity."
        icon={BriefcaseBusiness}
        iconColor="text-[#5e8a8d]"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/app/ops/client-accounts" className="btn-secondary text-sm">
              <ArrowLeft className="h-4 w-4" />
              Accounts
            </Link>
            <Link href="/app/ops/client-accounts/package" className="btn-secondary text-sm">
              <Edit3 className="h-4 w-4" />
              Edit Package
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-6">
          <Card padding="p-5 sm:p-6">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { label: "Website", value: account.website || "Not recorded", icon: Globe },
                { label: "Location", value: accountLocation(account) || "Not recorded", icon: MapPin },
                { label: "Type", value: formatLabel(account.accountType || account.clientStatus), icon: ShieldCheck },
                { label: "Owner", value: personName(account.accountManager), icon: UserRoundCheck },
                { label: "Email", value: account.email || "Not recorded", icon: Mail },
                { label: "Phone", value: account.phone || "Not recorded", icon: Phone },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#5e8a8d]">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#151f21]">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#151f21]">Services & Package</h2>
                <p className="text-sm text-[#7A746A]">
                  {account.currentPackage || "No current package set"}
                </p>
              </div>
              <Link href="/app/ops/client-accounts/services/new" className="btn-secondary text-sm">
                <ExternalLink className="h-4 w-4" />
                New Service
              </Link>
            </div>
            <div className="mt-5 space-y-3">
              {services.map((service) => (
                <div key={service.id} className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#151f21]">{service.name}</p>
                      <p className="text-xs text-[#7A746A]">
                        {formatLabel(service.serviceType)} - Renewal {formatDate(service.renewalDate)}
                      </p>
                    </div>
                    {serviceBadge(service.status)}
                  </div>
                </div>
              ))}
              {services.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#E7E1DA] p-6 text-center text-sm text-[#7A746A]">
                  No service plans linked yet.
                </div>
              )}
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#151f21]">Related Tasks</h2>
                <p className="text-sm text-[#7A746A]">
                  {openTasks.length} open, {account.overdueTaskCount} overdue
                </p>
              </div>
              <Link href="/app/crm/tasks/new" className="btn-secondary text-sm">
                <ListChecks className="h-4 w-4" />
                Add Task
              </Link>
            </div>
            <div className="mt-5 space-y-3">
              {tasks.slice(0, 8).map((task) => (
                <div key={task.id} className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#151f21]">{task.title}</p>
                      <p className="text-xs text-[#7A746A]">
                        {formatLabel(task.priority)} priority - Due {formatDate(task.dueDate)}
                      </p>
                    </div>
                    <Badge variant={task.status === "completed" ? "success" : task.isOverdue ? "error" : "info"}>
                      {task.isOverdue ? "Overdue" : formatLabel(task.status)}
                    </Badge>
                  </div>
                </div>
              ))}
              {tasks.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#E7E1DA] p-6 text-center text-sm text-[#7A746A]">
                  No internal tasks linked yet.
                </div>
              )}
            </div>
          </Card>
        </main>

        <aside className="space-y-6">
          <Card padding="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-[#151f21]">Account Health</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#7A746A]">Client status</span>
                <Badge variant="info">{formatLabel(account.clientStatus)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#7A746A]">Health</span>
                <Badge variant={account.healthStatus === "healthy" ? "success" : "warning"}>
                  {formatLabel(account.healthStatus)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#7A746A]">Contract</span>
                <Badge variant={account.contractStatus === "active" ? "success" : "info"}>
                  {formatLabel(account.contractStatus)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#7A746A]">Renewal</span>
                <span className="text-sm font-semibold text-[#151f21]">{formatDate(account.renewalDate)}</span>
              </div>
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-[#151f21]">Notes</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#6F6A66]">
              {account.keyNotes || "No account notes recorded."}
            </p>
          </Card>

          <Card padding="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-[#151f21]">Related Records</h2>
            <div className="mt-4 grid gap-2">
              {[
                { label: "Related Leads", href: `/app/leads?account=${encodeURIComponent(account.clinicName)}`, icon: Target },
                { label: "Deals / Pipeline", href: "/app/crm/pipeline", icon: ClipboardList },
                { label: "Notes", href: "/app/ops/client-accounts/package", icon: FileText },
                { label: "Tasks", href: "/app/crm/tasks", icon: ListChecks },
                { label: "Audits", href: "/app/settings/security", icon: ScrollText },
                { label: "Proposals", href: "/app/proposals", icon: FileText },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center justify-between rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-4 py-3 text-sm font-semibold text-[#151f21] transition hover:bg-[#F2EFEA]"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[#5e8a8d]" />
                      {item.label}
                    </span>
                    <ExternalLink className="h-4 w-4 text-[#7A746A]" />
                  </Link>
                );
              })}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
