"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Layers3,
  Loader2,
  Plus,
  RefreshCw,
  Save,
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
import { useToast } from "@/lib/toast-context";
import type {
  ClientAccountChurnRisk,
  ClientAccountContractStatus,
  ClientAccountCreatePayload,
  ClientAccountHealthStatus,
  ClientAccountOnboardingStatus,
  ClientAccountProfilePayload,
  ClientAccountProfileRecord,
  ClientAccountServicePayload,
  ClientAccountServiceRecord,
  ClientAccountServiceStatus,
  ClientAccountServiceType,
  ClientAccountServiceUpdatePayload,
  ClientAccountSummaryRecord,
  TeamMember,
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

const SERVICE_STATUSES: EditableServiceStatus[] = [
  "onboarding",
  "active",
  "paused",
  "ended",
];

const CONTRACT_STATUSES: ClientAccountContractStatus[] = [
  "active",
  "trial",
  "pending",
  "paused",
  "cancelled",
  "expired",
];

const HEALTH_STATUSES: ClientAccountHealthStatus[] = [
  "healthy",
  "attention_needed",
  "at_risk",
  "critical",
];

const CHURN_RISKS: ClientAccountChurnRisk[] = [
  "low",
  "medium",
  "high",
  "critical",
];

const ONBOARDING_STATUSES: ClientAccountOnboardingStatus[] = [
  "not_started",
  "in_progress",
  "completed",
  "paused",
];

const todayIso = new Date().toISOString().slice(0, 10);

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

function personName(
  person?:
    | TeamMember
    | ClientAccountServiceRecord["owner"]
    | ClientAccountProfileRecord["accountManager"]
    | null,
) {
  if (!person) return "Unassigned";
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email;
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

function toProfilePayload(profile: ClientAccountProfileRecord): ClientAccountProfilePayload {
  return {
    accountManagerId: profile.accountManager?.id || null,
    activeServices: profile.activeServices,
    onboardingStatus: profile.onboardingStatus,
    healthStatus: profile.healthStatus,
    churnRisk: profile.churnRisk,
    renewalDate: profile.renewalDate,
    contractStatus: profile.contractStatus,
    keyNotes: profile.keyNotes,
  };
}

const emptyServiceForm: ClientAccountServicePayload = {
  serviceType: "ppc",
  name: "Google Ads Management",
  status: "onboarding",
  startDate: todayIso,
  renewalDate: "",
  endDate: "",
  ownerId: null,
  recurringValue: "",
  currency: "GBP",
  contractStatus: "pending",
  notes: "",
};

const emptyAccountForm: ClientAccountCreatePayload = {
  name: "",
  email: "",
  phone: "",
  website: "",
  clientStatus: "onboarding",
  onboardingStatus: "in_progress",
  healthStatus: "attention_needed",
  contractStatus: "pending",
  churnRisk: "low",
  currentPackage: "",
  activeServices: [],
  keyNotes: "",
};

export default function ClientAccountsPage() {
  const { session } = useAuth();
  const { addToast } = useToast();
  const token = session?.token;
  const [accounts, setAccounts] = useState<ClientAccountSummaryRecord[]>([]);
  const [profile, setProfile] = useState<ClientAccountProfileRecord | null>(null);
  const [profileDraft, setProfileDraft] =
    useState<ClientAccountProfilePayload | null>(null);
  const [services, setServices] = useState<ClientAccountServiceRecord[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [accountForm, setAccountForm] =
    useState<ClientAccountCreatePayload>(emptyAccountForm);
  const [serviceForm, setServiceForm] =
    useState<ClientAccountServicePayload>(emptyServiceForm);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isCreatingService, setIsCreatingService] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const loadData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [accountRows, profileRow, serviceRows, members] = await Promise.all([
        api.clientAccounts.list(token),
        api.clientAccounts.getProfile(token),
        api.clientAccounts.listServices(token, { includeArchived: false }),
        api.team.getMembers(token),
      ]);
      setAccounts(accountRows);
      setProfile(profileRow);
      setProfileDraft(toProfilePayload(profileRow));
      setServices(serviceRows);
      setTeamMembers(members.filter((member) => !member.isInvitation));
      setStatusMessage("");
    } catch (error) {
      console.error("Failed to load client package data", error);
      setAccounts([]);
      setProfile(null);
      setProfileDraft(null);
      setServices([]);
      setTeamMembers([]);
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
  const serviceCoverage = Math.round((activeServices.length / SERVICE_TYPES.length) * 100);

  const filteredAccounts = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return accounts;
    return accounts.filter((account) =>
      [
        account.clinicName,
        account.contractStatus,
        account.healthStatus,
        account.churnRisk,
        accountPersonName(account.accountManager),
        account.activeServices.join(" "),
      ].some((value) => value.toLowerCase().includes(search)),
    );
  }, [accounts, query]);

  const filteredServices = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return services;
    return services.filter((service) =>
      [
        service.name,
        service.serviceType,
        service.status,
        service.contractStatus,
        personName(service.owner),
      ].some((value) => String(value).toLowerCase().includes(search)),
    );
  }, [query, services]);

  const updateProfileDraft = <K extends keyof ClientAccountProfilePayload>(
    key: K,
    value: ClientAccountProfilePayload[K],
  ) => {
    setProfileDraft((current) => ({
      ...(current || {}),
      [key]: value,
    }));
  };

  const toggleProfileService = (serviceType: ClientAccountServiceType) => {
    const current = profileDraft?.activeServices || [];
    const next = current.includes(serviceType)
      ? current.filter((service) => service !== serviceType)
      : [...current, serviceType];
    updateProfileDraft("activeServices", next);
  };

  const toggleAccountService = (serviceType: ClientAccountServiceType) => {
    const current = accountForm.activeServices || [];
    setAccountForm((form) => ({
      ...form,
      activeServices: current.includes(serviceType)
        ? current.filter((service) => service !== serviceType)
        : [...current, serviceType],
    }));
  };

  const saveProfile = async () => {
    if (!token || !profileDraft) return;
    setIsSavingProfile(true);
    try {
      const updated = await api.clientAccounts.updateProfile(token, profileDraft);
      setProfile(updated);
      setProfileDraft(toProfilePayload(updated));
      addToast("Client package profile updated.", "success");
      void loadData();
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Could not update package profile.",
        "error",
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const createAccount = async () => {
    if (!token || !accountForm.name.trim()) return;
    setIsCreatingAccount(true);
    try {
      const created = await api.clientAccounts.create(token, {
        ...accountForm,
        name: accountForm.name.trim(),
        email: accountForm.email || null,
        phone: accountForm.phone || null,
        website: accountForm.website || null,
        currentPackage: accountForm.currentPackage || null,
        keyNotes: accountForm.keyNotes || null,
      });
      setAccounts((current) => [created, ...current]);
      setAccountForm(emptyAccountForm);
      addToast("Client account added.", "success");
      void loadData();
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Could not add client account.",
        "error",
      );
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const createService = async () => {
    if (!token) return;
    setIsCreatingService(true);
    try {
      const created = await api.clientAccounts.createService(token, {
        ...serviceForm,
        ownerId: serviceForm.ownerId || null,
        renewalDate: serviceForm.renewalDate || null,
        endDate: serviceForm.endDate || null,
        recurringValue: serviceForm.recurringValue || null,
        notes: serviceForm.notes || null,
      });
      setServices((current) => [...current, created]);
      setServiceForm(emptyServiceForm);
      addToast("Service plan added.", "success");
      void loadData();
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Could not add service plan.",
        "error",
      );
    } finally {
      setIsCreatingService(false);
    }
  };

  const updateService = async (
    service: ClientAccountServiceRecord,
    payload: ClientAccountServiceUpdatePayload,
  ) => {
    if (!token) return;
    try {
      const updated = await api.clientAccounts.updateService(token, service.id, payload);
      setServices((current) =>
        current.map((item) => (item.id === service.id ? updated : item)),
      );
      addToast("Service plan updated.", "success");
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Could not update service plan.",
        "error",
      );
    }
  };

  const archiveService = async (service: ClientAccountServiceRecord) => {
    if (!token) return;
    if (!window.confirm(`Archive ${service.name}?`)) return;
    try {
      await api.clientAccounts.archiveService(token, service.id);
      setServices((current) => current.filter((item) => item.id !== service.id));
      addToast("Service plan archived.", "success");
      void loadData();
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Could not archive service plan.",
        "error",
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Packages"
        subtitle="Manage package tier, active services, renewals, contracts and ownership."
        icon={BriefcaseBusiness}
        iconColor="text-[#5e8a8d]"
        right={
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={isLoading || !token}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-[#151f21] bg-[#FFFCF9] border border-[rgba(21,31,33,0.08)] hover:bg-[#eaedeb] disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {statusMessage && (
        <AlertBanner
          icon={AlertTriangle}
          title="Client package data notice"
          description={statusMessage}
          variant="error"
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-semibold text-[#151f21] flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#5e8a8d]" />
              Add Client Account
            </h2>
            <p className="mt-1 text-sm text-[#5e8a8d]">
              Create an internal client/account record for delivery and task linking.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void createAccount()}
            disabled={isCreatingAccount || !accountForm.name.trim() || !token}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5e8a8d] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#507b7e] disabled:opacity-60"
          >
            {isCreatingAccount ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Add Account
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={accountForm.name}
            onChange={(event) =>
              setAccountForm((form) => ({ ...form, name: event.target.value }))
            }
            className="rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
            placeholder="Client account name"
          />
          <input
            value={accountForm.email || ""}
            onChange={(event) =>
              setAccountForm((form) => ({ ...form, email: event.target.value }))
            }
            className="rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
            placeholder="Main email"
          />
          <input
            value={accountForm.phone || ""}
            onChange={(event) =>
              setAccountForm((form) => ({ ...form, phone: event.target.value }))
            }
            className="rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
            placeholder="Phone"
          />
          <input
            value={accountForm.website || ""}
            onChange={(event) =>
              setAccountForm((form) => ({ ...form, website: event.target.value }))
            }
            className="rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
            placeholder="Website"
          />
          <select
            value={accountForm.accountManagerId || ""}
            onChange={(event) =>
              setAccountForm((form) => ({
                ...form,
                accountManagerId: event.target.value || null,
              }))
            }
            className="rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
          >
            <option value="">Unassigned manager</option>
            {teamMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {personName(member)}
              </option>
            ))}
          </select>
          <select
            value={accountForm.clientStatus || "onboarding"}
            onChange={(event) =>
              setAccountForm((form) => ({
                ...form,
                clientStatus: event.target.value as ClientAccountCreatePayload["clientStatus"],
              }))
            }
            className="rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
          >
            {["prospect", "onboarding", "active", "paused", "at_risk"].map((status) => (
              <option key={status} value={status}>
                {formatLabel(status)}
              </option>
            ))}
          </select>
          <input
            value={accountForm.currentPackage || ""}
            onChange={(event) =>
              setAccountForm((form) => ({ ...form, currentPackage: event.target.value }))
            }
            className="rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
            placeholder="Current package"
          />
          <input
            value={accountForm.keyNotes || ""}
            onChange={(event) =>
              setAccountForm((form) => ({ ...form, keyNotes: event.target.value }))
            }
            className="rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
            placeholder="Key notes"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {SERVICE_TYPES.map((service) => {
            const selected = accountForm.activeServices?.includes(service.value);
            return (
              <button
                key={service.value}
                type="button"
                onClick={() => toggleAccountService(service.value)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selected
                    ? "border-[rgba(96,180,175,0.25)] bg-[rgba(96,180,175,0.1)] text-[#151f21]"
                    : "border-[#d8ddda] bg-white text-[#5e8a8d]"
                }`}
              >
                {selected && <CheckCircle2 className="w-3 h-3" />}
                {service.label}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)] gap-6">
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div>
              <h2 className="font-semibold text-[#151f21]">
                Package Profile
              </h2>
              <p className="text-sm text-[#5e8a8d] mt-1">
                {isLoading
                  ? "Loading client package and account health..."
                  : profile?.clinicName
                    ? `${profile.clinicName} package and account health.`
                    : "Client package profile is not available yet."}
              </p>
            </div>
            {profile?.contractStatus && contractBadge(profile.contractStatus)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#5e8a8d]">
                Account manager
              </span>
              <select
                value={profileDraft?.accountManagerId || ""}
                disabled={isLoading || !profileDraft}
                onChange={(event) =>
                  updateProfileDraft("accountManagerId", event.target.value || null)
                }
                className="w-full rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {personName(member)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#5e8a8d]">
                Renewal date
              </span>
              <input
                type="date"
                value={profileDraft?.renewalDate || ""}
                disabled={isLoading || !profileDraft}
                onChange={(event) =>
                  updateProfileDraft("renewalDate", event.target.value || null)
                }
                className="w-full rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#5e8a8d]">
                Contract status
              </span>
              <select
                value={profileDraft?.contractStatus || "pending"}
                disabled={isLoading || !profileDraft}
                onChange={(event) =>
                  updateProfileDraft(
                    "contractStatus",
                    event.target.value as ClientAccountContractStatus,
                  )
                }
                className="w-full rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
              >
                {CONTRACT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#5e8a8d]">
                Onboarding
              </span>
              <select
                value={profileDraft?.onboardingStatus || "not_started"}
                disabled={isLoading || !profileDraft}
                onChange={(event) =>
                  updateProfileDraft(
                    "onboardingStatus",
                    event.target.value as ClientAccountOnboardingStatus,
                  )
                }
                className="w-full rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
              >
                {ONBOARDING_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#5e8a8d]">
                Health
              </span>
              <select
                value={profileDraft?.healthStatus || "healthy"}
                disabled={isLoading || !profileDraft}
                onChange={(event) =>
                  updateProfileDraft(
                    "healthStatus",
                    event.target.value as ClientAccountHealthStatus,
                  )
                }
                className="w-full rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
              >
                {HEALTH_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#5e8a8d]">
                Churn risk
              </span>
              <select
                value={profileDraft?.churnRisk || "low"}
                disabled={isLoading || !profileDraft}
                onChange={(event) =>
                  updateProfileDraft(
                    "churnRisk",
                    event.target.value as ClientAccountChurnRisk,
                  )
                }
                className="w-full rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
              >
                {CHURN_RISKS.map((risk) => (
                  <option key={risk} value={risk}>
                    {formatLabel(risk)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#5e8a8d]">
                Package Services
              </p>
              <span className="text-xs font-semibold text-[#151f21]">
                {serviceCoverage}% coverage
              </span>
            </div>
            <ProgressBar value={serviceCoverage} max={100} color="#60b4af" />
            <div className="flex flex-wrap gap-2 mt-4">
              {SERVICE_TYPES.map((service) => {
                const selected = profileDraft?.activeServices?.includes(service.value);
                return (
                  <button
                    key={service.value}
                    type="button"
                    disabled={isLoading || !profileDraft}
                    onClick={() => toggleProfileService(service.value)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      selected
                        ? "bg-[rgba(96,180,175,0.1)] text-[#151f21] border-[rgba(96,180,175,0.25)]"
                        : "bg-white text-[#5e8a8d] border-[#d8ddda]"
                    }`}
                  >
                    {selected && <CheckCircle2 className="w-3 h-3" />}
                    {service.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block mt-5 space-y-1">
            <span className="text-xs font-semibold text-[#5e8a8d]">
              Key notes
            </span>
            <textarea
              value={profileDraft?.keyNotes || ""}
              disabled={isLoading || !profileDraft}
              onChange={(event) => updateProfileDraft("keyNotes", event.target.value)}
              rows={4}
              className="w-full rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
              placeholder="Commercial notes, package context, risks or renewal commitments..."
            />
          </label>

          <div className="flex justify-end mt-5">
            <button
              type="button"
              onClick={() => void saveProfile()}
              disabled={isLoading || isSavingProfile || !profileDraft}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#5e8a8d] disabled:opacity-60 hover:bg-[#507b7e] transition-colors"
            >
              {isSavingProfile ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Package
            </button>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-[#151f21] mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#5e8a8d]" />
            Add Service Plan
          </h2>
          <div className="space-y-3">
            <input
              value={serviceForm.name}
              onChange={(event) =>
                setServiceForm((current) => ({ ...current, name: event.target.value }))
              }
              className="w-full rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
              placeholder="Service name"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={serviceForm.serviceType}
                onChange={(event) =>
                  setServiceForm((current) => ({
                    ...current,
                    serviceType: event.target.value as ClientAccountServiceType,
                  }))
                }
                className="rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
              >
                {SERVICE_TYPES.map((service) => (
                  <option key={service.value} value={service.value}>
                    {service.label}
                  </option>
                ))}
              </select>
              <select
                value={serviceForm.status}
                onChange={(event) =>
                  setServiceForm((current) => ({
                    ...current,
                    status: event.target.value as EditableServiceStatus,
                  }))
                }
                className="rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
              >
                {SERVICE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatLabel(status)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min="0"
                step="50"
                value={String(serviceForm.recurringValue ?? "")}
                onChange={(event) =>
                  setServiceForm((current) => ({
                    ...current,
                    recurringValue: event.target.value,
                  }))
                }
                className="rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
                placeholder="Monthly value"
              />
              <input
                value={serviceForm.currency || "GBP"}
                onChange={(event) =>
                  setServiceForm((current) => ({
                    ...current,
                    currency: event.target.value.toUpperCase(),
                  }))
                }
                className="rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
                maxLength={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={serviceForm.startDate || ""}
                onChange={(event) =>
                  setServiceForm((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
                className="rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
              />
              <input
                type="date"
                value={serviceForm.renewalDate || ""}
                onChange={(event) =>
                  setServiceForm((current) => ({
                    ...current,
                    renewalDate: event.target.value,
                  }))
                }
                className="rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
              />
            </div>
            <select
              value={serviceForm.ownerId || ""}
              onChange={(event) =>
                setServiceForm((current) => ({
                  ...current,
                  ownerId: event.target.value || null,
                }))
              }
              className="w-full rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
            >
              <option value="">Unassigned owner</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {personName(member)}
                </option>
              ))}
            </select>
            <textarea
              value={serviceForm.notes || ""}
              onChange={(event) =>
                setServiceForm((current) => ({ ...current, notes: event.target.value }))
              }
              rows={3}
              className="w-full rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm text-[#151f21]"
              placeholder="Notes"
            />
            <button
              type="button"
              onClick={() => void createService()}
              disabled={isLoading || isCreatingService || !serviceForm.name.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#5e8a8d] disabled:opacity-60 hover:bg-[#507b7e] transition-colors"
            >
              {isCreatingService ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add Service
            </button>
          </div>
        </Card>
      </div>

      <SearchInput
        placeholder="Search clients, services, owners or statuses..."
        value={query}
        onChange={setQuery}
      />

      <DataTable
        headers={[
          { label: "Service" },
          { label: "Owner" },
          { label: "Value" },
          { label: "Renewal" },
          { label: "Status" },
          { label: "Contract" },
          { label: "", className: "text-right" },
        ]}
      >
        {isLoading &&
          Array.from({ length: 4 }, (_, index) => (
            <TableRowSkeleton key={`service-loading-${index}`} columns={7} />
          ))}
        {!isLoading && filteredServices.length === 0 && (
          <tr>
            <td colSpan={7} className="px-6 py-10 text-center text-sm text-[#5e8a8d]">
              {query
                ? "No service plans match that search."
                : "No live service plans are set up for this client account yet."}
            </td>
          </tr>
        )}
        {!isLoading && filteredServices.map((service) => (
          <TableRow key={service.id}>
            <TableCell>
              <div>
                <p className="font-semibold text-[#151f21]">{service.name}</p>
                <p className="text-xs text-[#7A746A]">
                  {serviceLabel(service.serviceType)}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <span className="text-sm text-[#151f21]">{personName(service.owner)}</span>
            </TableCell>
            <TableCell>
              <span className="font-semibold text-[#151f21]">
                {formatMoney(service.recurringValue, service.currency)}
              </span>
            </TableCell>
            <TableCell>
              <div className="space-y-1">
                {renewalBadge(service.renewalDate)}
                <p className="text-xs text-[#7A746A]">{formatDate(service.renewalDate)}</p>
              </div>
            </TableCell>
            <TableCell>
              <select
                value={service.status}
                onChange={(event) =>
                  updateService(service, {
                    status: event.target.value as EditableServiceStatus,
                  })
                }
                className="rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-xs font-semibold text-[#151f21]"
              >
                {SERVICE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatLabel(status)}
                  </option>
                ))}
              </select>
            </TableCell>
            <TableCell>
              <select
                value={service.contractStatus}
                onChange={(event) =>
                  updateService(service, {
                    contractStatus: event.target.value as ClientAccountContractStatus,
                  })
                }
                className="rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-xs font-semibold text-[#151f21]"
              >
                {CONTRACT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatLabel(status)}
                  </option>
                ))}
              </select>
            </TableCell>
            <TableCell className="text-right">
              <button
                type="button"
                onClick={() => void archiveService(service)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#9a5524] hover:underline"
              >
                <Archive className="w-3.5 h-3.5" />
                Archive
              </button>
            </TableCell>
          </TableRow>
        ))}
      </DataTable>

      <Card>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="font-semibold text-[#151f21]">Account Portfolio</h2>
          <Badge variant="info">
            {isLoading ? "Loading" : `${filteredAccounts.length} accounts`}
          </Badge>
        </div>
        <DataTable
          headers={[
            { label: "Client" },
            { label: "Manager" },
            { label: "Services" },
            { label: "Contract" },
            { label: "Renewal" },
            { label: "Action Plan" },
          ]}
        >
          {isLoading &&
            Array.from({ length: 3 }, (_, index) => (
              <TableRowSkeleton key={`account-loading-${index}`} columns={6} />
            ))}
          {!isLoading && filteredAccounts.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-10 text-center text-sm text-[#5e8a8d]">
                {query
                  ? "No client accounts match that search."
                  : "No client accounts are available for this user."}
              </td>
            </tr>
          )}
          {!isLoading && filteredAccounts.map((account) => (
            <TableRow key={account.clinicId}>
              <TableCell>
                <div>
                  <p className="font-semibold text-[#151f21]">
                    {account.clinicName}
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
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
