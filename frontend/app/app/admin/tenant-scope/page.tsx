"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  Building2,
  CheckCircle2,
  Copy,
  CreditCard,
  Database,
  Phone,
  RefreshCw,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import {
  AlertBanner,
  Badge,
  Card,
  DataTable,
  PageHeader,
  StatCard,
  TableCell,
  TableRow,
  TableRowSkeleton,
} from "@/components/ui";
import { api, getStoredAuthSession } from "@/lib/api-client";
import type { BackendClinicMembership, StoredAuthSession } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { publicEnv } from "@/lib/env";
import { useTenant } from "@/lib/tenant-context";
import { useToast } from "@/lib/toast-context";

type ScopeCheckStatus = "idle" | "checking" | "ok" | "error";

type ScopeCheck = {
  id: string;
  label: string;
  description: string;
  icon: typeof Database;
  status: ScopeCheckStatus;
  count?: number;
  detail?: string;
  error?: string;
};

type ScopeCheckDefinition = Omit<ScopeCheck, "status" | "count" | "detail" | "error"> & {
  run: (token: string) => Promise<{ count?: number; detail?: string }>;
};

function formatDateTime(value?: string | null) {
  if (!value) return "Not recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatToken(value?: string | null) {
  if (!value) return "No token";
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

function mergeClinics(
  liveClinics: BackendClinicMembership[],
  storedSession: StoredAuthSession | null,
) {
  const clinicMap = new Map<string, BackendClinicMembership & { source: string }>();

  storedSession?.clinics?.forEach((clinic) => {
    clinicMap.set(clinic.id, { ...clinic, source: "Stored session" });
  });

  liveClinics.forEach((clinic) => {
    const existing = clinicMap.get(clinic.id);
    clinicMap.set(clinic.id, {
      ...clinic,
      source: existing ? "Stored + live" : "Live API",
    });
  });

  return Array.from(clinicMap.values());
}

function statusBadge(status: ScopeCheckStatus) {
  if (status === "ok") return <Badge variant="success">Scoped</Badge>;
  if (status === "checking") return <Badge variant="info">Checking</Badge>;
  if (status === "error") return <Badge variant="error">Failed</Badge>;
  return <Badge variant="neutral">Idle</Badge>;
}

export default function TenantScopePage() {
  const { session, user } = useAuth();
  const tenant = useTenant();
  const { addToast } = useToast();
  const [storedSession, setStoredSession] = useState<StoredAuthSession | null>(
    null,
  );
  const [liveClinics, setLiveClinics] = useState<BackendClinicMembership[]>([]);
  const [checks, setChecks] = useState<ScopeCheck[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const token = session?.token;

  const checkDefinitions = useMemo<ScopeCheckDefinition[]>(
    () => [
      {
        id: "clinics",
        label: "Clinic Memberships",
        description: "Confirms the signed-in user can only see assigned clinics.",
        icon: Building2,
        run: async (token) => {
          const clinics = await api.auth.getClinics(token);
          return {
            count: clinics.length,
            detail: `${clinics.length} membership${clinics.length === 1 ? "" : "s"} returned`,
          };
        },
      },
      {
        id: "contacts",
        label: "CRM Contacts",
        description: "Checks tenant-filtered contact list access.",
        icon: Users,
        run: async (token) => {
          const contacts = await api.contacts.list(token, { page: 1, pageSize: 20 });
          return {
            count: contacts.pagination.total,
            detail: `${contacts.contacts.length} loaded from ${contacts.pagination.total} total`,
          };
        },
      },
      {
        id: "reports",
        label: "Revenue Reports",
        description: "Checks scoped dashboard summary data.",
        icon: BarChart3,
        run: async (token) => {
          const summary = await api.reports.dashboardSummary(token);
          return {
            count: summary.cards.leads,
            detail: `${summary.cards.leads} leads, ${summary.cards.bookedConsults} bookings, ${summary.cards.soldTreatments} sold`,
          };
        },
      },
      {
        id: "calls",
        label: "Call Metrics",
        description: "Checks scoped call summary access.",
        icon: Phone,
        run: async (token) => {
          const summary = await api.calls.summary(token);
          return {
            count: summary.totalCalls,
            detail: `${summary.totalCalls} calls, ${summary.missedCalls} missed`,
          };
        },
      },
      {
        id: "team",
        label: "Team Access",
        description: "Checks current-clinic team membership visibility.",
        icon: ShieldCheck,
        run: async (token) => {
          const members = await api.team.getMembers(token);
          return {
            count: members.length,
            detail: `${members.filter((member) => member.status === "active").length} active members`,
          };
        },
      },
      {
        id: "billing",
        label: "Billing Scope",
        description: "Checks plan and usage data for the active clinic.",
        icon: CreditCard,
        run: async (token) => {
          const billing = await api.billing.getStatus(token);
          return {
            count: billing.usage.contacts,
            detail: `${billing.subscriptionPlan || "Unknown plan"} / ${billing.subscriptionStatus || "unknown status"}`,
          };
        },
      },
      {
        id: "insights",
        label: "Insight Inbox",
        description: "Checks AI alert visibility for the active clinic.",
        icon: Brain,
        run: async (token) => {
          const insights = await api.insights.list(token, { status: "all" });
          return {
            count: insights.length,
            detail: `${insights.filter((insight) => insight.status === "open").length} open insights`,
          };
        },
      },
    ],
    [],
  );

  const refreshChecks = useCallback(async () => {
    if (!token) return;

    setIsRefreshing(true);
    setLoadError("");
    setChecks(
      checkDefinitions.map((check) => ({
        ...check,
        status: "checking",
      })),
    );

    try {
      try {
        setLiveClinics(await api.auth.getClinics(token));
      } catch (error) {
        setLoadError(getErrorMessage(error));
        setLiveClinics([]);
      }

      const checkResults = await Promise.allSettled(
        checkDefinitions.map((check) => check.run(token)),
      );

      setChecks(
        checkDefinitions.map((check, index) => {
          const result = checkResults[index];
          if (result.status === "fulfilled") {
            return {
              ...check,
              status: "ok",
              count: result.value.count,
              detail: result.value.detail,
            };
          }

          return {
            ...check,
            status: "error",
            error: getErrorMessage(result.reason),
          };
        }),
      );
      setLastCheckedAt(new Date().toISOString());
    } catch (error) {
      setLoadError(getErrorMessage(error));
      setChecks(
        checkDefinitions.map((check) => ({
          ...check,
          status: "error",
          error: "Unable to run tenant scope checks",
        })),
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [checkDefinitions, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStoredSession(getStoredAuthSession());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshChecks();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshChecks]);

  const clinics = useMemo(
    () => mergeClinics(liveClinics, storedSession),
    [liveClinics, storedSession],
  );
  const displayedChecks: ScopeCheck[] = useMemo(
    () =>
      checks.length
        ? checks
        : checkDefinitions.map((check) => ({
            ...check,
            status: "idle",
          })),
    [checkDefinitions, checks],
  );

  const passedChecks = checks.filter((check) => check.status === "ok").length;
  const failedChecks = checks.filter((check) => check.status === "error").length;
  const activeClinicId = user?.clinicId || session?.clinicId || tenant.clinic.id;

  const diagnosticSummary = useMemo(
    () =>
      [
        "Tenant Scope QA",
        `Checked: ${lastCheckedAt || "Not checked"}`,
        `User: ${user?.email || "Unknown"}`,
        `Active clinic: ${tenant.clinic.name} (${activeClinicId})`,
        `Role: ${user?.role || "Unknown"}`,
        `API: ${publicEnv.apiBaseUrl}`,
        `Checks: ${passedChecks} passed / ${failedChecks} failed`,
        ...checks.map(
          (check) =>
            `- ${check.label}: ${check.status}${check.error ? ` (${check.error})` : check.detail ? ` (${check.detail})` : ""}`,
        ),
      ].join("\n"),
    [
      activeClinicId,
      checks,
      failedChecks,
      lastCheckedAt,
      passedChecks,
      tenant.clinic.name,
      user?.email,
      user?.role,
    ],
  );

  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(diagnosticSummary);
      addToast("Tenant scope diagnostics copied.", "success");
    } catch {
      addToast("Unable to copy diagnostics.", "error");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenant Scope QA"
        subtitle="Inspect the active clinic context and verify scoped API reads."
        icon={ShieldCheck}
        iconColor="text-[#5e8a8d]"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyDiagnostics}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-[#151f21] bg-[#FFFCF9] border border-[rgba(21,31,33,0.08)] hover:bg-[#eaedeb] transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
            <button
              type="button"
              onClick={() => void refreshChecks()}
              disabled={isRefreshing || !session?.token}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-[#5e8a8d] border border-[#5e8a8d] disabled:opacity-60 hover:bg-[#507b7e] transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        }
      />

      {loadError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Tenant scope checks could not complete"
          description={loadError}
          variant="error"
        />
      )}

      <AlertBanner
        icon={ShieldCheck}
        title="Read-scope checks only"
        description="This page verifies scoped reads against the live backend for the active session. A deliberate cross-clinic denial probe is not exposed by the backend yet, so cross-tenant negative testing is not integrated here."
        variant="info"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Clinic"
          value={tenant.clinic.name}
          sub={activeClinicId}
          icon={Building2}
          color="teal"
        />
        <StatCard
          label="Scoped Checks"
          value={`${passedChecks}/${checks.length || checkDefinitions.length}`}
          sub={lastCheckedAt ? `Last checked ${formatDateTime(lastCheckedAt)}` : "Not checked yet"}
          icon={CheckCircle2}
          color="green"
        />
        <StatCard
          label="Failures"
          value={String(failedChecks)}
          sub={failedChecks > 0 ? "Review failed endpoints" : "No failures"}
          icon={failedChecks > 0 ? XCircle : ShieldCheck}
          color={failedChecks > 0 ? "amber" : "blue"}
        />
        <StatCard
          label="Clinics"
          value={String(clinics.length)}
          sub="Live or stored memberships"
          icon={Database}
          color="violet"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] gap-6">
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="font-semibold text-[#151f21] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#5e8a8d]" />
              Scoped Endpoint Checks
            </h2>
            <Badge variant={failedChecks > 0 ? "warning" : "success"}>
              {isRefreshing ? "Running" : `${passedChecks} passing`}
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {displayedChecks.map((check) => {
                const Icon = check.icon;
                return (
                  <div
                    key={check.id}
                    className="p-4 rounded-2xl bg-[#F7F5F2] border border-[#EDE8E2]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#eaedeb] border border-[#d8ddda] flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-[#5e8a8d]" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#151f21]">
                            {check.label}
                          </p>
                          <p className="text-xs text-[#5e8a8d] leading-relaxed mt-1">
                            {check.description}
                          </p>
                        </div>
                      </div>
                      {statusBadge(check.status)}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#EDE8E2] pt-3">
                      <span className="text-xs font-medium text-[#7A746A]">
                        {check.error || check.detail || "Waiting for refresh"}
                      </span>
                      {check.count !== undefined && (
                        <span className="text-sm font-bold text-[#151f21]">
                          {check.count.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-[#151f21] mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#7D8F7A]" />
            Current Session
          </h2>
          <div className="space-y-4 text-sm">
            {[
              ["User", user?.email || "Unknown"],
              ["Role", user?.role || "Unknown"],
              ["Session clinic", session?.clinicId || "Unknown"],
              ["User clinic", user?.clinicId || "Unknown"],
              ["Token", formatToken(session?.token)],
              ["Expires", formatDateTime(session?.expiresAt)],
              ["API base", publicEnv.apiBaseUrl],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-start justify-between gap-3 border-b border-[#EDE8E2] pb-3"
              >
                <span className="text-[#7A746A]">{label}</span>
                <span className="font-semibold text-[#151f21] text-right break-all">
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <p className="text-xs uppercase tracking-widest text-[#5e8a8d] font-semibold mb-3">
              Permissions
            </p>
            <div className="flex flex-wrap gap-2">
              {(user?.permissions || []).map((permission) => (
                <Badge key={permission} variant="neutral" size="xs">
                  {permission}
                </Badge>
              ))}
              {(user?.permissions || []).length === 0 && (
                <span className="text-sm text-[#7A746A]">
                  No permissions loaded.
                </span>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="font-semibold text-[#151f21] flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#5e8a8d]" />
            Clinic Memberships
          </h2>
          <Badge variant="info">{clinics.length} detected</Badge>
        </div>
        <DataTable
          headers={[
            { label: "Clinic" },
            { label: "Role" },
            { label: "Plan" },
            { label: "Status" },
            { label: "Source" },
            { label: "Active", className: "text-right" },
          ]}
          className="rounded-2xl"
        >
          {isRefreshing && clinics.length === 0 &&
            Array.from({ length: 3 }, (_, index) => (
              <TableRowSkeleton key={`clinic-loading-${index}`} columns={6} />
            ))}
          {!isRefreshing && clinics.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-10 text-center text-sm text-[#5e8a8d]">
                No live or stored clinic memberships were available for this session.
              </td>
            </tr>
          )}
          {(!isRefreshing || clinics.length > 0) && clinics.map((clinic) => (
            <TableRow key={clinic.id}>
              <TableCell>
                <div>
                  <p className="font-semibold text-[#151f21]">{clinic.name}</p>
                  <p className="text-xs text-[#7A746A] break-all">{clinic.id}</p>
                  {clinic.location && (
                    <p className="text-xs text-[#A8A39B] mt-1">
                      {clinic.location}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="neutral">{clinic.role}</Badge>
              </TableCell>
              <TableCell>
                <span className="text-sm font-medium text-[#151f21]">
                  {clinic.plan || "Unknown"}
                </span>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    String(clinic.status).toLowerCase() === "active"
                      ? "success"
                      : "warning"
                  }
                >
                  {clinic.status}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="text-sm text-[#7A746A]">{clinic.source}</span>
              </TableCell>
              <TableCell className="text-right">
                {clinic.id === activeClinicId ? (
                  <Badge variant="success">Active</Badge>
                ) : clinic.isPrimary ? (
                  <Badge variant="info">Primary</Badge>
                ) : (
                  <Badge variant="neutral">Available</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
