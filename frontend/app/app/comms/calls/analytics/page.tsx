"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Info } from "lucide-react";
import {
  AlertBanner,
  CardSkeleton,
  PageHeader,
  StatCardSkeleton,
  TableSkeleton,
} from "@/components/ui";
import { CallAnalyticsKPIs } from "@/components/calls/call-analytics-stats";
import { CallTeamPerformance } from "@/components/calls/call-team-performance";
import { CallPeakHours } from "@/components/calls/call-peak-hours";
import { CallDateRangeFilter } from "@/components/calls/call-date-range-filter";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  CallLogRecord,
  CallSummaryRecord,
  StaffCallMetricRecord,
} from "@/lib/api-types";

export default function CallAnalyticsPage() {
  const { session } = useAuth();
  const [calls, setCalls] = useState<CallLogRecord[]>([]);
  const [summary, setSummary] = useState<CallSummaryRecord | null>(null);
  const [staffMetrics, setStaffMetrics] = useState<StaffCallMetricRecord[]>([]);
  const [loadedToken, setLoadedToken] = useState<string | null>(null);
  const [loadedRange, setLoadedRange] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const rangeKey = `${startDate}:${endDate}`;
  const filters = useMemo(
    () => ({
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    }),
    [endDate, startDate],
  );
  const isLoading = Boolean(
    session?.token &&
      (loadedToken !== session.token || loadedRange !== rangeKey),
  );

  useEffect(() => {
    if (!session?.token) return;

    let isMounted = true;
    Promise.all([
      api.calls.list(session.token, filters),
      api.calls.summary(session.token, filters),
      api.calls.staffMetrics(session.token, filters),
    ])
      .then(([callRecords, callSummary, staff]) => {
        if (!isMounted) return;
        setCalls(callRecords);
        setSummary(callSummary);
        setStaffMetrics(staff);
        setError("");
      })
      .catch((err) => {
        if (!isMounted) return;
        setCalls([]);
        setSummary(null);
        setStaffMetrics([]);
        setError(
          err instanceof Error ? err.message : "Unable to load call analytics.",
        );
      })
      .finally(() => {
        if (isMounted) {
          setLoadedToken(session.token);
          setLoadedRange(rangeKey);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [filters, rangeKey, session?.token]);

  const averageDurationSeconds = useMemo(() => {
    const connectedCalls = calls.filter((call) => call.outcome === "connected");
    if (connectedCalls.length === 0) return 0;

    return (
      connectedCalls.reduce((sum, call) => sum + call.duration, 0) /
      connectedCalls.length
    );
  }, [calls]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Call Analytics"
        subtitle="Performance trends, team metrics, and peak hours."
        icon={BarChart3}
        iconColor="text-[#6E6AE8]"
        iconBg="bg-[rgba(110,106,232,0.08)]"
      />

      <CallDateRangeFilter
        startDate={startDate}
        endDate={endDate}
        isLoading={isLoading}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onClear={() => {
          setStartDate("");
          setEndDate("");
        }}
      />

      {error && (
        <AlertBanner
          icon={AlertTriangle}
          title="Call analytics could not be loaded"
          description={error}
          variant="warning"
        />
      )}

      {isLoading ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <StatCardSkeleton key={index} />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CardSkeleton lines={6} />
            <CardSkeleton lines={6} />
          </div>
          <TableSkeleton rows={5} columns={7} />
        </>
      ) : (
        <>
          {calls.length === 0 && (
            <AlertBanner
              icon={Info}
              title="No calls in selected range"
              description="Adjust the date range to include more call activity."
              variant="info"
            />
          )}
          <CallAnalyticsKPIs
            summary={summary}
            averageDurationSeconds={averageDurationSeconds}
          />
          <CallPeakHours calls={calls} />
          <CallTeamPerformance metrics={staffMetrics} />
        </>
      )}
    </div>
  );
}
