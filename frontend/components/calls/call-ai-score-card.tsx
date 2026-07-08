"use client";

import { Card } from "@/components/ui";
import { Brain } from "lucide-react";
import type { CallAiBreakdownRecord, CallLogRecord } from "@/lib/api-types";

const categoryLabels: Record<CallAiBreakdownRecord["categoryType"], string> = {
  sentiment: "Sentiment",
  booking_intent: "Booking Intent",
  treatment: "Treatment",
  outcome: "Outcome",
};

export function CallAIScoreCard({
  calls = [],
  breakdowns = [],
}: {
  calls?: CallLogRecord[];
  breakdowns?: CallAiBreakdownRecord[];
}) {
  const scoredCalls = calls.filter((call) => call.qualityScore !== null);
  const scores = scoredCalls.map((call) => call.qualityScore ?? 0);
  const averageScore =
    scoredCalls.length > 0
      ? Math.round(
          scores.reduce((sum, score) => sum + score, 0) / scoredCalls.length,
        )
      : null;
  const highest = scores.length ? Math.max(...scores) : null;
  const lowest = scores.length ? Math.min(...scores) : null;
  const lowScoreCount = scoredCalls.filter((call) => (call.qualityScore ?? 0) < 70).length;
  const pct = averageScore ?? 0;

  return (
    <Card>
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold flex items-center gap-2">
          <Brain className="w-5 h-5 text-violet-400" /> AI Call Scores
        </h2>
        <div className="text-right">
          <span className="text-2xl font-bold text-violet-400">
            {averageScore === null ? "-" : averageScore}
          </span>
          <span className="text-gray-500 text-sm">/100</span>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>Average persisted quality score</span>
          <span>{averageScore === null ? "No scored calls" : `${pct}%`}</span>
        </div>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <ScoreStat label="Scored" value={String(scoredCalls.length)} />
        <ScoreStat label="Highest" value={highest === null ? "-" : String(highest)} />
        <ScoreStat label="Below 70" value={String(lowScoreCount)} />
      </div>

      {lowest !== null && (
        <p className="text-sm text-gray-500 mb-4">
          Lowest live quality score: <span className="font-medium text-gray-300">{lowest}/100</span>
        </p>
      )}

      <div className="space-y-3">
        {breakdowns.slice(0, 8).map((breakdown) => (
          <div
            key={`${breakdown.categoryType}:${breakdown.categoryKey}`}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  {categoryLabels[breakdown.categoryType]}
                </p>
                <p className="text-sm font-medium text-gray-200">{breakdown.label}</p>
              </div>
              <span className="text-sm font-semibold text-violet-400">
                {breakdown.averageQualityScore === null
                  ? "-"
                  : `${breakdown.averageQualityScore}/100`}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {breakdown.calls} calls | {breakdown.scoredCalls} scored | {breakdown.coachingFlags} flags
            </p>
          </div>
        ))}
        {breakdowns.length === 0 && (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-gray-500">
            No AI score breakdowns match the selected range.
          </p>
        )}
      </div>
    </Card>
  );
}

function ScoreStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-100">{value}</p>
    </div>
  );
}
