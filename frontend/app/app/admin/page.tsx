"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  CreditCard,
  Server,
  Shield,
  Users,
} from "lucide-react";
import { AlertBanner, Card, PageHeader, StatCard } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  AuditLogEntry,
  BackgroundJobsResponse,
  BillingStatus,
  HealthStatus,
  TeamMember,
} from "@/lib/api-types";

function formatUptime(seconds = 0) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminPage() {
  const { session } = useAuth();
  const [liveHealth, setLiveHealth] = useState<HealthStatus | null>(null);
  const [readyHealth, setReadyHealth] = useState<HealthStatus | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const [jobs, setJobs] = useState<BackgroundJobsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session?.token) return;

    let isMounted = true;
    Promise.all([
      api.health.live(),
      api.health.ready(),
      api.billing.getStatus(session.token),
      api.team.getMembers(session.token),
      api.auditLog.list(session.token, { page: 1, pageSize: 5 }),
      api.backgroundJobs.list(session.token),
    ])
      .then(([live, ready, billingStatus, teamMembers, audit, jobStatus]) => {
        if (!isMounted) return;
        setLiveHealth(live);
        setReadyHealth(ready);
        setBilling(billingStatus);
        setMembers(teamMembers);
        setAuditEntries(audit.entries);
        setJobs(jobStatus);
        setError("");
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(
          err instanceof Error ? err.message : "Unable to load admin status.",
        );
      });

    return () => {
      isMounted = false;
    };
  }, [session?.token]);

  const activeJobs = jobs?.jobs.filter((job) => job.status === "active").length ?? 0;
  const failedRuns = jobs?.jobRuns.filter((run) => run.status === "failed").length ?? 0;
  const activeMembers = members.filter((member) => member.status === "active").length;
  const pendingMembers = members.filter((member) => member.status === "pending").length;

  const systemHealth = useMemo(
    () => [
      {
        label: "API Live",
        value: liveHealth?.ok ? "Online" : "Unknown",
      },
      {
        label: "API Ready",
        value: readyHealth?.ok ? "Ready" : "Not ready",
      },
      {
        label: "Database",
        value: readyHealth?.database?.ok
          ? `${readyHealth.database.latencyMs ?? 0}ms`
          : "Unknown",
      },
      {
        label: "Environment",
        value: readyHealth?.environment || "Unknown",
      },
      {
        label: "Uptime",
        value: formatUptime(liveHealth?.uptimeSeconds),
      },
    ],
    [liveHealth, readyHealth],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Admin"
        subtitle="Tenant health, access, billing, jobs, and audit activity."
        icon={Shield}
        iconColor="text-[#8A4A4A]"
        iconBg="bg-[rgba(138,74,74,0.08)]"
      />

      <AlertBanner
        icon={AlertTriangle}
        title="Admin Access"
        description="You are viewing live operational data for the selected clinic."
        variant="warning"
      />

      {error && (
        <AlertBanner
          icon={AlertTriangle}
          title="Admin data could not be loaded"
          description={error}
          variant="error"
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Team Members"
          value={String(activeMembers)}
          sub={`${pendingMembers} pending`}
          icon={Users}
          color="blue"
        />
        <StatCard
          label="Plan"
          value={billing?.subscriptionPlan || "Unknown"}
          sub={billing?.subscriptionStatus || "No status"}
          icon={CreditCard}
          color="green"
        />
        <StatCard
          label="Active Jobs"
          value={String(activeJobs)}
          sub={`${failedRuns} failed recent runs`}
          icon={Activity}
          color={failedRuns > 0 ? "amber" : "violet"}
        />
        <StatCard
          label="Locations"
          value={String(billing?.usage.locations ?? 0)}
          sub={`${billing?.usage.contacts ?? 0} contacts`}
          icon={Building2}
          color="teal"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-semibold mb-4 flex items-center gap-2 text-[#252421]">
            <Server className="w-5 h-5 text-[#4A6A8A]" /> System Health
          </h2>
          <div className="space-y-4">
            {systemHealth.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between py-3 border-b border-[#EDE8E2]"
              >
                <span className="text-sm text-[#7A746A]">{item.label}</span>
                <span className="text-[#5A8A6A] font-semibold text-sm">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold mb-4 flex items-center gap-2 text-[#252421]">
            <Users className="w-5 h-5 text-[#7D8F7A]" /> Team Access
          </h2>
          <div className="space-y-3">
            {members.slice(0, 5).map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#F7F5F2] border border-[#EDE8E2]"
              >
                <div>
                  <p className="font-medium text-[#252421]">
                    {[member.firstName, member.lastName].filter(Boolean).join(" ") ||
                      member.email}
                  </p>
                  <p className="text-xs text-[#A8A39B]">{member.email}</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-[rgba(125,143,122,0.1)] text-[#7D8F7A] border border-[rgba(125,143,122,0.2)]">
                  {member.role}
                </span>
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-sm text-[#7A746A]">No team members loaded.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-semibold mb-4 flex items-center gap-2 text-[#252421]">
            <Activity className="w-5 h-5 text-[#6E6AE8]" /> Background Jobs
          </h2>
          <div className="space-y-3">
            {jobs?.jobs.slice(0, 5).map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#F7F5F2] border border-[#EDE8E2]"
              >
                <div>
                  <p className="font-medium text-[#252421]">{job.name}</p>
                  <p className="text-xs text-[#A8A39B]">
                    Last run: {formatDate(job.lastRun)}
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#5e8a8d]">
                  {job.status}
                </span>
              </div>
            )) ?? <p className="text-sm text-[#7A746A]">No jobs loaded.</p>}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold mb-4 flex items-center gap-2 text-[#252421]">
            <Shield className="w-5 h-5 text-[#8A4A4A]" /> Recent Audit Events
          </h2>
          <div className="space-y-3">
            {auditEntries.map((entry) => (
              <div
                key={entry.id}
                className="p-3 rounded-xl bg-[#F7F5F2] border border-[#EDE8E2]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-sm text-[#252421]">
                    {entry.action}
                  </p>
                  <span className="text-xs text-[#A8A39B]">
                    {formatDate(entry.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-[#7A746A] mt-1">
                  {entry.userName} · {entry.entityType || "system"}
                </p>
              </div>
            ))}
            {auditEntries.length === 0 && (
              <p className="text-sm text-[#7A746A]">No audit entries loaded.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
