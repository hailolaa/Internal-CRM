"use client";

import { StatCard } from "@/components/ui";
import {
  Phone,
  TrendingUp,
  Clock,
  Target,
} from "lucide-react";
import type { CallSummaryRecord } from "@/lib/api-types";

export function CallAnalyticsKPIs({
  summary,
  averageDurationSeconds = 0,
}: {
  summary?: CallSummaryRecord | null;
  averageDurationSeconds?: number;
}) {
  const totalCalls = summary?.totalCalls ?? 0;
  const connectedCalls = summary?.connectedCalls ?? 0;
  const connectRate =
    totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0;
  const bookingRate = Math.round(summary?.callToBookingRate ?? 0);
  const minutes = Math.floor(averageDurationSeconds / 60);
  const seconds = Math.round(averageDurationSeconds % 60)
    .toString()
    .padStart(2, "0");

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Total Calls"
        value={String(totalCalls)}
        sub={`${summary?.inboundCalls ?? 0} inbound`}
        icon={Phone}
        color="teal"
      />
      <StatCard
        label="Connect Rate"
        value={`${connectRate}%`}
        sub={`${connectedCalls} connected`}
        icon={TrendingUp}
        color="green"
      />
      <StatCard
        label="Avg Duration"
        value={`${minutes}:${seconds}`}
        sub="Connected calls"
        icon={Clock}
        color="blue"
      />
      <StatCard
        label="Booking Rate"
        value={`${bookingRate}%`}
        sub={`${summary?.bookedConsults ?? 0} booked`}
        icon={Target}
        color="violet"
      />
    </div>
  );
}
