"use client";

import { Card } from "@/components/ui";
import { Users } from "lucide-react";
import type { StaffCallMetricRecord } from "@/lib/api-types";

function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "-";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function CallTeamPerformance({
  metrics,
}: {
  metrics?: StaffCallMetricRecord[];
}) {
  const teamData =
    metrics?.map((member) => {
          const connectRate =
            member.totalCalls > 0
              ? Math.round((member.connectedCalls / member.totalCalls) * 100)
              : 0;

          return {
            name: member.userName || "Unassigned",
            calls: member.totalCalls,
            connected: member.connectedCalls,
            booked: member.bookedConsults,
            avgDuration: formatDuration(member.averageDurationSeconds),
            connectRate: `${connectRate}%`,
            bookingRate: `${Math.round(member.bookingRate)}%`,
          };
        }) ?? [];

  return (
    <Card padding="p-0">
      <div className="px-6 py-4 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between">
        <h2 className="font-semibold text-[#111111] flex items-center gap-2">
          <Users className="w-5 h-5 text-[#6E6AE8]" /> Team Performance
        </h2>
        <span className="text-xs text-[#6B7280]">Live backend totals</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(0,0,0,0.06)]">
              <th className="text-left text-xs text-[#6B7280] font-medium px-5 py-3">
                Team Member
              </th>
              <th className="text-left text-xs text-[#6B7280] font-medium px-5 py-3">
                Calls
              </th>
              <th className="text-left text-xs text-[#6B7280] font-medium px-5 py-3">
                Connected
              </th>
              <th className="text-left text-xs text-[#6B7280] font-medium px-5 py-3">
                Booked
              </th>
              <th className="text-left text-xs text-[#6B7280] font-medium px-5 py-3">
                Avg Duration
              </th>
              <th className="text-left text-xs text-[#6B7280] font-medium px-5 py-3">
                Connect %
              </th>
              <th className="text-left text-xs text-[#6B7280] font-medium px-5 py-3">
                Booking %
              </th>
            </tr>
          </thead>
          <tbody>
            {teamData.map((member) => (
              <tr
                key={member.name}
                className="border-b border-[rgba(0,0,0,0.04)] hover:bg-[rgba(110,106,232,0.04)]"
              >
                <td className="px-5 py-4 font-medium text-sm text-[#111111]">
                  {member.name}
                </td>
                <td className="px-5 py-4 text-sm text-[#6B7280]">
                  {member.calls}
                </td>
                <td className="px-5 py-4 text-sm text-[#6B7280]">
                  {member.connected}
                </td>
                <td className="px-5 py-4 text-sm text-[#6E6AE8] font-medium">
                  {member.booked}
                </td>
                <td className="px-5 py-4 text-sm text-[#6B7280]">
                  {member.avgDuration}
                </td>
                <td className="px-5 py-4 text-sm text-emerald-600">
                  {member.connectRate}
                </td>
                <td className="px-5 py-4 text-sm text-[#6E6AE8]">
                  {member.bookingRate}
                </td>
              </tr>
            ))}
            {teamData.length === 0 && (
              <tr>
                <td className="px-5 py-8 text-sm text-[#6B7280]" colSpan={7}>
                  No team call metrics loaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-[rgba(0,0,0,0.06)] text-xs text-[#6B7280]">
        Filtered by selected call date range.
      </div>
    </Card>
  );
}
