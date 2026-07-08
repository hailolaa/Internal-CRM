"use client";

import { Card } from "@/components/ui";
import { Users } from "lucide-react";
import type { StaffCallMetricRecord } from "@/lib/api-types";

export function CallAIAgentLeaderboard({
  metrics,
}: {
  metrics?: StaffCallMetricRecord[];
}) {
  const agentMetrics =
    metrics?.map((agent) => ({
      name: agent.userName || "Unassigned",
      calls: agent.totalCalls,
      bookingRate: `${Math.round(agent.bookingRate)}%`,
      connectedCalls: agent.connectedCalls,
      missedCalls: agent.missedCalls,
      scoredCalls: agent.scoredCalls ?? 0,
      averageQualityScore: agent.averageQualityScore,
      coachingFlags: agent.coachingFlags ?? 0,
    })) ?? [];

  return (
    <Card>
      <h2 className="font-semibold mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-blue-400" /> Agent Call Metrics
      </h2>
      <div className="space-y-5">
        {agentMetrics.map((agent, i) => (
          <div key={agent.name}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </div>
                <div>
                  <p className="font-medium text-sm">{agent.name}</p>
                  <p className="text-xs text-gray-500">
                    {agent.calls} calls | {agent.bookingRate} booking rate
                  </p>
                </div>
              </div>
              <span className="text-sm font-semibold text-violet-400">
                {agent.averageQualityScore === null || agent.averageQualityScore === undefined
                  ? "-"
                  : `${agent.averageQualityScore}/100`}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {agent.connectedCalls} connected | {agent.scoredCalls} scored | {agent.coachingFlags} coaching flags | {agent.missedCalls} missed
            </p>
          </div>
        ))}
        {agentMetrics.length === 0 && (
          <p className="text-sm text-gray-500">No agent call metrics loaded yet.</p>
        )}
      </div>
    </Card>
  );
}
