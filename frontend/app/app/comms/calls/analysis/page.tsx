"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Brain, Info } from "lucide-react";
import {
  AlertBanner,
  CardSkeleton,
  PageHeader,
  StatCardSkeleton,
} from "@/components/ui";
import { CallAIStats } from "@/components/calls/call-ai-stats";
import { CallAIScoreCard } from "@/components/calls/call-ai-score-card";
import { CallAICoachingFlags } from "@/components/calls/call-ai-coaching-flags";
import { CallAIAgentLeaderboard } from "@/components/calls/call-ai-agent-leaderboard";
import { CallDateRangeFilter } from "@/components/calls/call-date-range-filter";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  CallAiBreakdownRecord,
  CallLogRecord,
  CallSummaryRecord,
  StaffCallMetricRecord,
} from "@/lib/api-types";

export default function CallAnalysisPage() {
  const { session } = useAuth();
  const [calls, setCalls] = useState<CallLogRecord[]>([]);
  const [summary, setSummary] = useState<CallSummaryRecord | null>(null);
  const [staffMetrics, setStaffMetrics] = useState<StaffCallMetricRecord[]>([]);
  const [breakdowns, setBreakdowns] = useState<CallAiBreakdownRecord[]>([]);
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
      api.calls.aiBreakdowns(session.token, filters),
    ])
      .then(([callRecords, callSummary, staff, aiBreakdowns]) => {
        if (!isMounted) return;
        setCalls(callRecords);
        setSummary(callSummary);
        setStaffMetrics(staff);
        setBreakdowns(aiBreakdowns);
        setError("");
      })
      .catch((err) => {
        if (!isMounted) return;
        setCalls([]);
        setSummary(null);
        setStaffMetrics([]);
        setBreakdowns([]);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load AI call analysis.",
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Call Analysis"
        subtitle="Scoring, coaching flags, and agent performance - no transcription required."
        icon={Brain}
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
          title="AI call analysis could not be loaded"
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CardSkeleton lines={6} />
            <CardSkeleton lines={6} />
          </div>
          <CardSkeleton lines={5} />
        </>
      ) : (
        <>
          {calls.length === 0 && (
            <AlertBanner
              icon={Info}
              title="No calls in selected range"
              description="Adjust the date range to include more AI call activity."
              variant="info"
            />
          )}
          <CallAIStats calls={calls} summary={summary} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CallAIScoreCard calls={calls} breakdowns={breakdowns} />
            <CallAIAgentLeaderboard metrics={staffMetrics} />
          </div>

          <CallAICoachingFlags calls={calls} />
        </>
      )}
    </div>
  );
}
