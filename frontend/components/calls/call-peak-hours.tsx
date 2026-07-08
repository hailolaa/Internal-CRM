"use client";

import { Card } from "@/components/ui";
import { Clock, BarChart3 } from "lucide-react";
import type { CallLogRecord } from "@/lib/api-types";

function buildHourlyData(calls: CallLogRecord[]) {
  const counts = new Map<string, number>();
  calls.forEach((call) => {
    const date = new Date(call.timestamp || call.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const hour = `${date.getHours().toString().padStart(2, "0")}:00`;
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  });

  const max = Math.max(...counts.values(), 1);
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, calls]) => ({
      hour,
      calls,
      bar: Math.max(8, Math.round((calls / max) * 100)),
    }));
}

function buildDayData(calls: CallLogRecord[]) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const counts = days.map((day) => ({ day, calls: 0, color: "bg-[#6E6AE8]" }));
  calls.forEach((call) => {
    const date = new Date(call.timestamp || call.createdAt);
    if (Number.isNaN(date.getTime())) return;
    counts[date.getDay()].calls += 1;
  });

  return counts.slice(1).concat(counts[0]).map((day) => ({
    ...day,
    color:
      day.day === "Sat" || day.day === "Sun"
        ? "bg-[#6E6AE8]/50"
        : "bg-[#6E6AE8]",
  }));
}

export function CallPeakHours({ calls = [] }: { calls?: CallLogRecord[] }) {
  const peakHours = buildHourlyData(calls);
  const dayBreakdown = buildDayData(calls);
  const maxCalls = Math.max(...dayBreakdown.map((d) => d.calls), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Hourly distribution */}
      <Card>
        <h3 className="font-semibold text-[#111111] mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" /> Peak Call Hours
        </h3>
        <div className="space-y-2">
          {peakHours.map((h) => (
            <div key={h.hour} className="flex items-center gap-3">
              <span className="text-xs text-[#6B7280] w-12 font-mono">
                {h.hour}
              </span>
              <div className="flex-1 h-5 bg-[rgba(0,0,0,0.04)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#6E6AE8] to-[#9B8FEF] rounded-full"
                  style={{ width: `${h.bar}%` }}
                />
              </div>
              <span className="text-xs text-[#6B7280] w-8 text-right">
                {h.calls}
              </span>
            </div>
          ))}
          {peakHours.length === 0 && (
            <p className="text-sm text-[#6B7280]">No call timing data loaded yet.</p>
          )}
        </div>
      </Card>

      {/* Day of week */}
      <Card>
        <h3 className="font-semibold text-[#111111] mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#6E6AE8]" /> Calls by Day
        </h3>
        <div className="flex items-end gap-3 h-48">
          {dayBreakdown.map((d) => (
            <div
              key={d.day}
              className="flex-1 flex flex-col items-center gap-2"
            >
              <span className="text-xs text-[#6B7280] font-medium">
                {d.calls}
              </span>
              <div
                className="w-full bg-[rgba(0,0,0,0.04)] rounded-t-lg overflow-hidden"
                style={{ height: "100%" }}
              >
                <div
                  className={`w-full ${d.color} rounded-t-lg mt-auto`}
                  style={{
                    height: `${(d.calls / maxCalls) * 100}%`,
                    marginTop: `${100 - (d.calls / maxCalls) * 100}%`,
                  }}
                />
              </div>
              <span className="text-xs text-[#6B7280]">{d.day}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
