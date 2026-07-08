"use client";

import { Card } from "@/components/ui";
import {
  Lightbulb,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import type { CallLogRecord } from "@/lib/api-types";

interface CoachingFlag {
  id: string;
  type: "strength" | "improvement" | "critical";
  title: string;
  detail: string;
  callRef: string;
  agent: string;
}

const typeConfig = {
  critical: {
    icon: AlertTriangle,
    bg: "bg-red-500/5 border-red-500/20",
    iconColor: "text-red-400",
    label: "Critical",
    labelColor: "bg-red-500/10 text-red-400",
  },
  improvement: {
    icon: Lightbulb,
    bg: "bg-amber-500/5 border-amber-500/20",
    iconColor: "text-amber-400",
    label: "Improve",
    labelColor: "bg-amber-500/10 text-amber-400",
  },
  strength: {
    icon: CheckCircle,
    bg: "bg-green-500/5 border-green-500/20",
    iconColor: "text-green-400",
    label: "Strength",
    labelColor: "bg-green-500/10 text-green-400",
  },
};

function buildFlags(calls: CallLogRecord[]): CoachingFlag[] {
  const analysedCalls = calls.filter(
    (call) => call.qualityScore !== null || call.aiSummary || call.transcript,
  );

  if (analysedCalls.length === 0) return [];

  return analysedCalls
    .slice()
    .sort((a, b) => (a.qualityScore ?? 100) - (b.qualityScore ?? 100))
    .slice(0, 6)
    .map((call) => {
      const score = call.qualityScore ?? 70;
      const type: CoachingFlag["type"] =
        score < 60 ? "critical" : score < 75 ? "improvement" : "strength";
      const title =
        type === "critical"
          ? "Call quality needs review"
          : type === "improvement"
            ? "Coaching opportunity"
            : "Strong call handling";

      return {
        id: call.id,
        type,
        title,
        detail:
          call.aiSummary ||
          call.notes ||
          `Booking intent: ${call.bookingIntent}. Sentiment: ${call.sentiment}.`,
        callRef: `Call with ${call.contactName}`,
        agent: call.assignedTo || "Unassigned",
      };
    });
}

export function CallAICoachingFlags({ calls = [] }: { calls?: CallLogRecord[] }) {
  const flags = buildFlags(calls);

  return (
    <Card padding="p-0">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-400" /> Coaching Flags
        </h2>
        <span className="text-xs text-gray-500">
          {flags.length} live flags
        </span>
      </div>
      <div className="divide-y divide-white/5">
        {flags.map((flag) => {
          const config = typeConfig[flag.type];
          const Icon = config.icon;
          return (
            <div
              key={flag.id}
              className={`px-6 py-4 border-l-2 ${flag.type === "critical" ? "border-l-red-500" : flag.type === "improvement" ? "border-l-amber-500" : "border-l-green-500"}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bg.split(" ")[0]}`}
                >
                  <Icon className={`w-4 h-4 ${config.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-sm">{flag.title}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${config.labelColor}`}
                    >
                      {config.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{flag.detail}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{flag.callRef}</span>
                    <span>·</span>
                    <span>{flag.agent}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {flags.length === 0 && (
          <div className="px-6 py-8 text-sm text-gray-500">
            No analysed calls have live coaching flags yet. Generate AI intelligence
            on calls with transcripts or summaries to populate this section.
          </div>
        )}
      </div>
    </Card>
  );
}
