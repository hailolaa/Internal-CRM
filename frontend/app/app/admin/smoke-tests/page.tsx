"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BellRing,
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Database,
  FileText,
  FlaskConical,
  Mail,
  MapPin,
  Phone,
  Plug,
  RefreshCw,
  ShieldCheck,
  Users,
  Webhook,
  XCircle,
  Zap,
} from "lucide-react";
import {
  AlertBanner,
  Badge,
  Card,
  DataTable,
  PageHeader,
  ProgressBar,
  StatCard,
  TableCell,
  TableRow,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { publicEnv } from "@/lib/env";
import { useTenant } from "@/lib/tenant-context";
import { useToast } from "@/lib/toast-context";

type SmokeStatus = "idle" | "running" | "passed" | "failed" | "skipped";
type SmokeGroup =
  | "Platform"
  | "Tenant"
  | "CRM"
  | "Revenue"
  | "Communication"
  | "Automation"
  | "Developer";

type SmokeCheck = {
  id: string;
  group: SmokeGroup;
  label: string;
  description: string;
  icon: typeof FlaskConical;
  requiresAuth?: boolean;
  run: (token?: string) => Promise<{ count?: number; detail: string }>;
};

type SmokeResult = Omit<SmokeCheck, "run"> & {
  status: SmokeStatus;
  durationMs?: number;
  count?: number;
  detail?: string;
  error?: string;
};

function formatDateTime(value?: string | null) {
  if (!value) return "Not run yet";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not run yet";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Smoke check failed";
}

function statusBadge(status: SmokeStatus) {
  if (status === "passed") return <Badge variant="success">Pass</Badge>;
  if (status === "running") return <Badge variant="info">Running</Badge>;
  if (status === "failed") return <Badge variant="error">Fail</Badge>;
  if (status === "skipped") return <Badge variant="neutral">Skipped</Badge>;
  return <Badge variant="neutral">Idle</Badge>;
}

function groupBadge(group: SmokeGroup) {
  const variants: Record<SmokeGroup, "success" | "warning" | "info" | "neutral"> =
    {
      Platform: "info",
      Tenant: "success",
      CRM: "neutral",
      Revenue: "success",
      Communication: "info",
      Automation: "warning",
      Developer: "neutral",
    };

  return (
    <Badge variant={variants[group]} size="xs">
      {group}
    </Badge>
  );
}

async function timedRun(check: SmokeCheck, token?: string): Promise<SmokeResult> {
  if (check.requiresAuth && !token) {
    return {
      ...check,
      status: "skipped",
      detail: "Sign in required before this check can run.",
      durationMs: 0,
    };
  }

  const startedAt = performance.now();

  try {
    const result = await check.run(token);
    return {
      ...check,
      status: "passed",
      count: result.count,
      detail: result.detail,
      durationMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    return {
      ...check,
      status: "failed",
      error: getErrorMessage(error),
      durationMs: Math.round(performance.now() - startedAt),
    };
  }
}

export default function SmokeTestsPage() {
  const { session, user } = useAuth();
  const tenant = useTenant();
  const { addToast } = useToast();
  const token = session?.token;
  const [results, setResults] = useState<SmokeResult[]>([]);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const checks = useMemo<SmokeCheck[]>(
    () => [
      {
        id: "health-live",
        group: "Platform",
        label: "API live",
        description: "Confirms the public API process is responding.",
        icon: Activity,
        run: async () => {
          const health = await api.health.live();
          if (!health.ok) throw new Error("API live check returned not ok.");
          return {
            detail: `${health.service} online in ${health.environment}`,
            count: Math.round(health.uptimeSeconds || 0),
          };
        },
      },
      {
        id: "health-ready",
        group: "Platform",
        label: "API ready",
        description: "Confirms database/config readiness.",
        icon: Database,
        run: async () => {
          const health = await api.health.ready();
          if (!health.ok) throw new Error("API readiness check returned not ok.");
          const issues = health.config?.issues?.length || 0;
          const warnings = health.config?.warnings?.length || 0;
          return {
            detail: `Database ${health.database?.ok ? "ready" : "unknown"} (${health.database?.latencyMs ?? 0}ms), ${issues} config issues, ${warnings} warnings`,
            count: health.database?.latencyMs ?? 0,
          };
        },
      },
      {
        id: "auth-clinics",
        group: "Tenant",
        label: "Clinic memberships",
        description: "Checks authenticated tenant membership lookup.",
        icon: Building2,
        requiresAuth: true,
        run: async (authToken) => {
          const clinics = await api.auth.getClinics(authToken!);
          return {
            detail: `${clinics.length} clinic membership${clinics.length === 1 ? "" : "s"} visible`,
            count: clinics.length,
          };
        },
      },
      {
        id: "locations",
        group: "Tenant",
        label: "Locations",
        description: "Checks clinic location configuration access.",
        icon: MapPin,
        requiresAuth: true,
        run: async (authToken) => {
          const locations = await api.locations.list(authToken!);
          return {
            detail: `${locations.filter((location) => location.status === "active").length} active locations`,
            count: locations.length,
          };
        },
      },
      {
        id: "integrations",
        group: "Tenant",
        label: "Integrations",
        description: "Checks configured marketing/comms integrations.",
        icon: Plug,
        requiresAuth: true,
        run: async (authToken) => {
          const integrations = await api.integrations.list(authToken!);
          return {
            detail: `${integrations.filter((integration) => integration.isActive).length} active integrations`,
            count: integrations.length,
          };
        },
      },
      {
        id: "contacts",
        group: "CRM",
        label: "Contacts",
        description: "Checks CRM contact list access.",
        icon: Users,
        requiresAuth: true,
        run: async (authToken) => {
          const contacts = await api.contacts.list(authToken!, {
            page: 1,
            pageSize: 20,
          });
          return {
            detail: `${contacts.contacts.length} loaded from ${contacts.pagination.total} contacts`,
            count: contacts.pagination.total,
          };
        },
      },
      {
        id: "forms",
        group: "CRM",
        label: "Forms",
        description: "Checks lead capture forms.",
        icon: FileText,
        requiresAuth: true,
        run: async (authToken) => {
          const forms = await api.forms.list(authToken!);
          return {
            detail: `${forms.filter((form) => form.status === "active").length} active forms`,
            count: forms.length,
          };
        },
      },
      {
        id: "reports-summary",
        group: "Revenue",
        label: "Revenue summary",
        description: "Checks dashboard summary metrics.",
        icon: BarChart3,
        requiresAuth: true,
        run: async (authToken) => {
          const summary = await api.reports.dashboardSummary(authToken!);
          return {
            detail: `${summary.cards.leads} leads, ${summary.financials.totalRevenue.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })} revenue`,
            count: summary.cards.leads,
          };
        },
      },
      {
        id: "revenue-channel",
        group: "Revenue",
        label: "Channel attribution",
        description: "Checks revenue-by-channel reporting.",
        icon: ShieldCheck,
        requiresAuth: true,
        run: async (authToken) => {
          const revenue = await api.reports.revenueByChannel(authToken!);
          return {
            detail: `${revenue.bySource.length} sources, ${revenue.byCampaign.length} campaigns`,
            count: revenue.bySource.length,
          };
        },
      },
      {
        id: "calls",
        group: "Communication",
        label: "Call summary",
        description: "Checks call intelligence summary.",
        icon: Phone,
        requiresAuth: true,
        run: async (authToken) => {
          const calls = await api.calls.summary(authToken!);
          return {
            detail: `${calls.totalCalls} calls, ${calls.missedCalls} missed`,
            count: calls.totalCalls,
          };
        },
      },
      {
        id: "templates",
        group: "Communication",
        label: "Message templates",
        description: "Checks outbound comms template access.",
        icon: Mail,
        requiresAuth: true,
        run: async (authToken) => {
          const templates = await api.messageTemplates.list(authToken!);
          return {
            detail: `${templates.filter((template) => template.status === "active").length} active templates`,
            count: templates.length,
          };
        },
      },
      {
        id: "automations",
        group: "Automation",
        label: "Automations",
        description: "Checks automation engine configuration.",
        icon: Zap,
        requiresAuth: true,
        run: async (authToken) => {
          const automations = await api.automations.list(authToken!);
          return {
            detail: `${automations.filter((automation) => automation.isEnabled).length} enabled workflows`,
            count: automations.length,
          };
        },
      },
      {
        id: "insights",
        group: "Automation",
        label: "Alert inbox",
        description: "Checks AI insight and alert retrieval.",
        icon: BellRing,
        requiresAuth: true,
        run: async (authToken) => {
          const insights = await api.insights.list(authToken!, { status: "all" });
          return {
            detail: `${insights.filter((insight) => insight.status === "open").length} open alerts`,
            count: insights.length,
          };
        },
      },
      {
        id: "webhooks",
        group: "Developer",
        label: "Webhooks",
        description: "Checks webhook endpoint configuration.",
        icon: Webhook,
        requiresAuth: true,
        run: async (authToken) => {
          const webhooks = await api.webhooks.listEndpoints(authToken!);
          return {
            detail: `${webhooks.filter((webhook) => webhook.isActive).length} active endpoints`,
            count: webhooks.length,
          };
        },
      },
      {
        id: "billing",
        group: "Developer",
        label: "Billing status",
        description: "Checks subscription and usage scope.",
        icon: CreditCard,
        requiresAuth: true,
        run: async (authToken) => {
          const billing = await api.billing.getStatus(authToken!);
          return {
            detail: `${billing.subscriptionPlan || "Unknown plan"} / ${billing.subscriptionStatus || "unknown status"}`,
            count: billing.usage.contacts,
          };
        },
      },
    ],
    [],
  );

  const runSmokeTests = useCallback(async () => {
    setIsRunning(true);
    setResults(
      checks.map((check) => ({
        ...check,
        status: check.requiresAuth && !token ? "skipped" : "running",
      })),
    );

    const nextResults = await Promise.all(
      checks.map((check) => timedRun(check, token)),
    );

    setResults(nextResults);
    setLastRunAt(new Date().toISOString());
    setIsRunning(false);
  }, [checks, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runSmokeTests();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [runSmokeTests]);

  const displayedResults: SmokeResult[] = results.length
    ? results
    : checks.map((check) => ({
        ...check,
        status: "idle",
      }));

  const passed = results.filter((result) => result.status === "passed").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const skipped = results.filter((result) => result.status === "skipped").length;
  const runnableTotal = checks.filter((check) => !check.requiresAuth || token).length;
  const completedTotal = passed + failed;
  const passRate = runnableTotal ? Math.round((passed / runnableTotal) * 100) : 0;
  const averageLatency =
    completedTotal > 0
      ? Math.round(
          results
            .filter((result) => result.status !== "skipped")
            .reduce((sum, result) => sum + (result.durationMs || 0), 0) /
            completedTotal,
        )
      : 0;

  const groupSummary = useMemo(
    () =>
      Array.from(new Set(checks.map((check) => check.group))).map((group) => {
        const groupResults = displayedResults.filter(
          (result) => result.group === group,
        );
        const groupPassed = groupResults.filter(
          (result) => result.status === "passed",
        ).length;
        const groupFailed = groupResults.filter(
          (result) => result.status === "failed",
        ).length;

        return {
          group,
          total: groupResults.length,
          passed: groupPassed,
          failed: groupFailed,
          status:
            groupFailed > 0
              ? "failed"
              : groupPassed === groupResults.length
                ? "passed"
                : "idle",
        };
      }),
    [checks, displayedResults],
  );

  const reportText = useMemo(
    () =>
      [
        "Integration Smoke Test Centre",
        `Run: ${lastRunAt || "Not run yet"}`,
        `User: ${user?.email || "Signed out"}`,
        `Clinic: ${tenant.clinic.name} (${tenant.clinic.id})`,
        `API: ${publicEnv.apiBaseUrl}`,
        `Result: ${passed}/${runnableTotal} passed, ${failed} failed, ${skipped} skipped`,
        ...displayedResults.map(
          (result) =>
            `- [${result.status}] ${result.group} / ${result.label}: ${result.error || result.detail || "No detail"} (${result.durationMs ?? 0}ms)`,
        ),
      ].join("\n"),
    [
      displayedResults,
      failed,
      lastRunAt,
      passed,
      runnableTotal,
      skipped,
      tenant.clinic.id,
      tenant.clinic.name,
      user?.email,
    ],
  );

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      addToast("Smoke test report copied.", "success");
    } catch {
      addToast("Unable to copy smoke test report.", "error");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integration Smoke Tests"
        subtitle="Run read-only checks across live frontend-to-backend integrations."
        icon={FlaskConical}
        iconColor="text-[#5e8a8d]"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyReport}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-[#151f21] bg-[#FFFCF9] border border-[rgba(21,31,33,0.08)] hover:bg-[#eaedeb] transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy report
            </button>
            <button
              type="button"
              onClick={() => void runSmokeTests()}
              disabled={isRunning}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-[#5e8a8d] border border-[#5e8a8d] disabled:opacity-60 hover:bg-[#507b7e] transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRunning ? "animate-spin" : ""}`}
              />
              Run all
            </button>
          </div>
        }
      />

      {!token && (
        <AlertBanner
          icon={AlertTriangle}
          title="Signed-in session required for module checks"
          description="Platform health checks can run without auth. Tenant, CRM, reports, comms, automation, and developer checks need an active session."
          variant="warning"
        />
      )}

      <AlertBanner
        icon={FlaskConical}
        title="Read-only smoke coverage"
        description="These checks hit live read endpoints only. Write workflows, vendor OAuth handshakes, webhook deliveries, and deliberate cross-tenant denial probes are not exercised by this backend smoke page yet."
        variant="info"
      />

      {failed > 0 && (
        <AlertBanner
          icon={XCircle}
          title="One or more smoke checks failed"
          description="Copy the report and review the failed endpoint details before deploying further changes."
          variant="error"
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Pass Rate"
          value={`${passRate}%`}
          sub={`${passed}/${runnableTotal} checks passing`}
          icon={CheckCircle2}
          color={failed > 0 ? "amber" : "green"}
        />
        <StatCard
          label="Failures"
          value={String(failed)}
          sub={`${skipped} skipped`}
          icon={failed > 0 ? XCircle : ShieldCheck}
          color={failed > 0 ? "red" : "blue"}
        />
        <StatCard
          label="Avg Latency"
          value={`${averageLatency}ms`}
          sub="Read endpoint average"
          icon={Clock}
          color="teal"
        />
        <StatCard
          label="Last Run"
          value={lastRunAt ? formatDateTime(lastRunAt) : "Pending"}
          sub={tenant.clinic.name}
          icon={FlaskConical}
          color="violet"
        />
      </div>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
          <div>
            <h2 className="font-semibold text-[#151f21]">Run Coverage</h2>
            <p className="text-sm text-[#5e8a8d] mt-1">
              Grouped by the integration surface most likely to break after a
              deploy.
            </p>
          </div>
          <Badge variant={isRunning ? "info" : failed > 0 ? "warning" : "success"}>
            {isRunning ? "Running" : `${completedTotal} completed`}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {groupSummary.map((group) => (
            <div
              key={group.group}
              className="p-4 rounded-2xl bg-[#F7F5F2] border border-[#EDE8E2]"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                {groupBadge(group.group)}
                {statusBadge(group.status as SmokeStatus)}
              </div>
              <p className="text-lg font-bold text-[#151f21]">
                {group.passed}/{group.total}
              </p>
              <div className="mt-3">
                <ProgressBar
                  value={
                    group.total ? Math.round((group.passed / group.total) * 100) : 0
                  }
                  max={100}
                  color={group.failed > 0 ? "#b7672e" : "#60b4af"}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <DataTable
        headers={[
          { label: "Check" },
          { label: "Group" },
          { label: "Status" },
          { label: "Detail" },
          { label: "Latency", className: "text-right" },
        ]}
      >
        {displayedResults.map((result) => {
          const Icon = result.icon;
          return (
            <TableRow key={result.id}>
              <TableCell>
                <div className="flex items-start gap-3 min-w-[220px]">
                  <div className="w-10 h-10 rounded-xl bg-[#eaedeb] border border-[#d8ddda] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-[#5e8a8d]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#151f21]">{result.label}</p>
                    <p className="text-xs text-[#7A746A] mt-1 max-w-xs">
                      {result.description}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>{groupBadge(result.group)}</TableCell>
              <TableCell>{statusBadge(result.status)}</TableCell>
              <TableCell>
                <div className="max-w-lg">
                  <p
                    className={`text-sm ${
                      result.status === "failed"
                        ? "text-[#9a5524] font-semibold"
                        : "text-[#151f21]"
                    }`}
                  >
                    {result.error || result.detail || "Waiting to run"}
                  </p>
                  {result.count !== undefined && (
                    <p className="text-xs text-[#7A746A] mt-1">
                      Count: {result.count.toLocaleString()}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <span className="font-semibold text-[#151f21]">
                  {result.durationMs !== undefined ? `${result.durationMs}ms` : "-"}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </DataTable>
    </div>
  );
}
