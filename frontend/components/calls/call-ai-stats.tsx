"use client";

import { StatCard } from "@/components/ui";
import { Brain, TrendingUp, AlertTriangle, Target } from "lucide-react";
import type { CallLogRecord, CallSummaryRecord } from "@/lib/api-types";

export function CallAIStats({
  calls = [],
  summary,
}: {
  calls?: CallLogRecord[];
  summary?: CallSummaryRecord | null;
}) {
  const scoredCalls = calls.filter((call) => call.qualityScore !== null);
  const averageScore =
    scoredCalls.length > 0
      ? Math.round(
          scoredCalls.reduce((sum, call) => sum + (call.qualityScore ?? 0), 0) /
            scoredCalls.length,
        )
      : 0;
  const coachingFlags = calls.filter(
    (call) =>
      call.qualityScore !== null &&
      call.qualityScore < 70 &&
      (call.aiSummary || call.transcript),
  ).length;
  const bookingRate = Math.round(summary?.callToBookingRate ?? 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="AI Score (Avg)"
        value={scoredCalls.length > 0 ? `${averageScore}/100` : "—"}
        sub={`${scoredCalls.length} scored calls`}
        icon={Brain}
        color="violet"
      />
      <StatCard
        label="Calls Analysed"
        value={String(scoredCalls.length)}
        sub="Live quality scores"
        icon={Target}
        color="teal"
      />
      <StatCard
        label="Coaching Flags"
        value={String(coachingFlags)}
        sub="Needs attention"
        icon={AlertTriangle}
        color="amber"
      />
      <StatCard
        label="Booking Rate"
        value={`${bookingRate}%`}
        sub={`${summary?.bookedConsults ?? 0} booked`}
        icon={TrendingUp}
        color="green"
      />
    </div>
  );
}
