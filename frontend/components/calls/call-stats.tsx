"use client";

import { Card, StatCard } from "@/components/ui";
import {
  Phone,
  TrendingUp,
  Clock,
  Target,
  PhoneIncoming,
  PhoneOutgoing,
  BarChart3,
} from "lucide-react";
import type { CallRecord } from "@/lib/call-data";
import { getCallStats } from "@/lib/call-data";

export function CallStatsGrid({ calls }: { calls: CallRecord[] }) {
  const stats = getCallStats(calls);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Total Calls"
        value={String(stats.total)}
        sub={`${stats.inbound} in · ${stats.outbound} out`}
        icon={Phone}
        color="teal"
      />
      <StatCard
        label="Connect Rate"
        value={`${stats.connectRate}%`}
        sub={`${stats.connected} connected`}
        icon={TrendingUp}
        color="green"
      />
      <StatCard
        label="Booking Rate"
        value={`${stats.bookingRate}%`}
        sub={`${stats.booked} booked from calls`}
        icon={Target}
        color="violet"
      />
      <StatCard
        label="Avg Duration"
        value={`${Math.floor(stats.avgDuration / 60)}:${(stats.avgDuration % 60).toString().padStart(2, "0")}`}
        sub="Connected calls"
        icon={Clock}
        color="blue"
      />
    </div>
  );
}

export function CallBreakdownCard({ calls }: { calls: CallRecord[] }) {
  const stats = getCallStats(calls);

  const outcomes = [
    {
      label: "Connected",
      count: calls.filter((c) => c.outcome === "connected").length,
      color: "#5A8A6A",
    },
    {
      label: "No Answer",
      count: calls.filter((c) => c.outcome === "no_answer").length,
      color: "#A07840",
    },
    {
      label: "Voicemail",
      count: calls.filter((c) => c.outcome === "voicemail").length,
      color: "#4A6A8A",
    },
    {
      label: "Busy",
      count: calls.filter((c) => c.outcome === "busy").length,
      color: "#A8A39B",
    },
  ].filter((o) => o.count > 0);

  const dispositions = [
    {
      label: "Booked",
      count: calls.filter((c) => c.disposition === "booked").length,
      color: "#5A8A6A",
    },
    {
      label: "Callback",
      count: calls.filter((c) => c.disposition === "callback_requested").length,
      color: "#7D8F7A",
    },
    {
      label: "Info Given",
      count: calls.filter((c) => c.disposition === "info_given").length,
      color: "#4A6A8A",
    },
    {
      label: "Follow Up",
      count: calls.filter((c) => c.disposition === "follow_up_needed").length,
      color: "#A07840",
    },
    {
      label: "Not Interested",
      count: calls.filter((c) => c.disposition === "not_interested").length,
      color: "#8A4A4A",
    },
  ].filter((d) => d.count > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <h3
          className="font-semibold mb-4 flex items-center gap-2"
          style={{ color: "#252421" }}
        >
          <BarChart3 className="w-4 h-4 text-[#7D8F7A]" /> Outcome Breakdown
        </h3>
        <div className="space-y-3">
          {outcomes.map((o) => (
            <div key={o.label}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span style={{ color: "#5F5A52" }}>{o.label}</span>
                <span style={{ color: "#252421" }}>{o.count}</span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: "#E5DED6" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${stats.total > 0 ? (o.count / stats.total) * 100 : 0}%`,
                    backgroundColor: o.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div
          className="mt-5 pt-4 flex items-center gap-6"
          style={{ borderTop: "1px solid #E5DED6" }}
        >
          <div className="flex items-center gap-2">
            <PhoneIncoming className="w-4 h-4 text-[#4A7A8A]" />
            <span className="text-sm" style={{ color: "#7A746A" }}>
              Inbound:{" "}
              <span className="font-medium" style={{ color: "#252421" }}>
                {stats.inbound}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <PhoneOutgoing className="w-4 h-4 text-[#7D8F7A]" />
            <span className="text-sm" style={{ color: "#7A746A" }}>
              Outbound:{" "}
              <span className="font-medium" style={{ color: "#252421" }}>
                {stats.outbound}
              </span>
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <h3
          className="font-semibold mb-4 flex items-center gap-2"
          style={{ color: "#252421" }}
        >
          <Target className="w-4 h-4 text-[#7D8F7A]" /> Disposition Summary
        </h3>
        <div className="space-y-3">
          {dispositions.map((d) => (
            <div
              key={d.label}
              className="flex items-center justify-between p-3 rounded-xl"
              style={{
                backgroundColor: "#F7F5F2",
                border: "1px solid #E5DED6",
              }}
            >
              <span className="text-sm font-medium" style={{ color: d.color }}>
                {d.label}
              </span>
              <span className="text-sm font-bold" style={{ color: "#252421" }}>
                {d.count}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
