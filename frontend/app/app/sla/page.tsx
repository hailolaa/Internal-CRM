"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  Timer,
  Settings,
  TrendingDown,
} from "lucide-react";
import { PageHeader, StatCard, AlertBanner, StatCardSkeleton } from "@/components/ui";
import { SLALeadTable } from "@/components/sla/sla-lead-table";
import { SLABreachLog } from "@/components/sla/sla-breach-log";
import { SLAConfigPanel } from "@/components/sla/sla-config-panel";
import { api } from "@/lib/api-client";
import type {
  SlaBreachRecord,
  SlaLeadRecord,
  SlaSummaryRecord,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

function formatDuration(minutes: number) {
  const roundedMinutes = Math.max(0, Math.round(minutes));
  if (roundedMinutes < 60) return `${roundedMinutes} min`;

  const hours = Math.floor(roundedMinutes / 60);
  const mins = roundedMinutes % 60;
  if (hours < 24) return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours} hr` : `${days}d`;
}

export default function SLAPage() {
  const { session } = useAuth();
  const [showConfig, setShowConfig] = useState(false);
  const [summary, setSummary] = useState<SlaSummaryRecord | null>(null);
  const [leads, setLeads] = useState<SlaLeadRecord[]>([]);
  const [breaches, setBreaches] = useState<SlaBreachRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadSlaData = useCallback(
    async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
      if (!session?.token) return;

      if (showLoading) setIsLoading(true);

      try {
        const [summaryResult, leadResult, breachResult] = await Promise.allSettled([
          api.sla.getSummary(session.token),
          api.sla.listLeads(session.token),
          api.sla.listBreaches(session.token),
        ]);

        setSummary(summaryResult.status === "fulfilled" ? summaryResult.value : null);
        setLeads(leadResult.status === "fulfilled" ? leadResult.value : []);
        setBreaches(
          breachResult.status === "fulfilled" ? breachResult.value : [],
        );

        const failedSources = [
          summaryResult.status === "rejected" ? "SLA summary" : "",
          leadResult.status === "rejected" ? "lead queue" : "",
          breachResult.status === "rejected" ? "breach log" : "",
        ].filter(Boolean);

        setLoadError(
          failedSources.length > 0
            ? `Some live SLA data could not be loaded: ${failedSources.join(", ")}.`
            : "",
        );
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [session?.token],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSlaData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadSlaData]);

  const liveStats = useMemo(() => {
    return [
      {
        label: "Avg Speed-to-Lead",
        value: summary ? `${Math.round(summary.averageResponseMinutes)} min` : "—",
        change: summary ? "Live" : "No live summary",
        trend: "up" as const,
        icon: Timer,
        color: "teal" as const,
      },
      {
        label: "SLA Compliance",
        value: summary ? `${Math.round(summary.complianceRate)}%` : "—",
        change: summary ? "Live" : "No live summary",
        trend: "up" as const,
        icon: CheckCircle,
        color: "green" as const,
      },
      {
        label: "Active Breaches",
        value: summary ? String(summary.breachedLeadCount) : "—",
        change: summary ? `${summary.atRiskLeadCount} at risk` : "No live summary",
        trend: "up" as const,
        icon: AlertTriangle,
        color: "amber" as const,
      },
      {
        label: "Avg Overdue Time",
        value: summary ? formatDuration(summary.averageBreachMinutes) : "—",
        change: summary
          ? `£${summary.estimatedRevenueRisk.toLocaleString("en-GB")} risk`
          : "No live summary",
        trend: "up" as const,
        icon: TrendingDown,
        color: "rose" as const,
      },
    ];
  }, [summary]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="SLA / Speed-to-Lead"
        subtitle="Response time tracking, breach monitoring, and SLA compliance."
        icon={Clock}
        iconColor="text-[#6E6AE8]"
        iconBg="bg-[rgba(110,106,232,0.08)]"
        right={
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="btn-secondary text-sm"
          >
            <Settings className="w-4 h-4" /> SLA Config
          </button>
        }
      />

      {!isLoading && summary && summary.atRiskLeadCount > 0 && (
        <AlertBanner
          icon={AlertTriangle}
          title={`${summary.atRiskLeadCount} leads are approaching SLA breach`}
          description={`Target response time is ${summary.targetMinutes} minutes.`}
          variant="warning"
        />
      )}

      {loadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading
          ? Array.from({ length: 4 }, (_, index) => (
              <StatCardSkeleton key={index} />
            ))
          : liveStats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {showConfig && <SLAConfigPanel summary={summary} />}

      <SLALeadTable
        leads={leads}
        isLoading={isLoading}
        onLeadResolved={() => loadSlaData({ showLoading: false })}
      />

      <SLABreachLog breaches={breaches} isLoading={isLoading} />
    </div>
  );
}
