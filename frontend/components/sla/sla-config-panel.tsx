"use client";

import { AlertTriangle, CheckCircle, Clock, Settings } from "lucide-react";
import { Card } from "@/components/ui";
import type { SlaSummaryRecord } from "@/lib/api-types";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function SLAConfigPanel({
  summary,
}: {
  summary: SlaSummaryRecord | null;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-5">
        <h2
          className="font-semibold flex items-center gap-2"
          style={{ color: "#111111" }}
        >
          <Settings className="w-5 h-5 text-[#6E6AE8]" /> SLA Configuration
        </h2>
        <span
          className="rounded-full px-3 py-1 text-xs font-medium"
          style={{
            backgroundColor: "rgba(110,106,232,0.08)",
            color: "#6E6AE8",
            border: "1px solid rgba(110,106,232,0.18)",
          }}
        >
          Live backend rules
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#111111]">
            <Clock className="h-4 w-4 text-[#6E6AE8]" />
            Target response
          </div>
          <div className="text-2xl font-bold text-[#111111]">
            {summary ? `${summary.targetMinutes} min` : "—"}
          </div>
          <p className="mt-1 text-xs text-[#6B7280]">
            Applied to active first-response lead queue.
          </p>
        </div>

        <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#111111]">
            <AlertTriangle className="h-4 w-4 text-[#A07840]" />
            Active risk
          </div>
          <div className="text-2xl font-bold text-[#111111]">
            {summary ? summary.atRiskLeadCount + summary.breachedLeadCount : "—"}
          </div>
          <p className="mt-1 text-xs text-[#6B7280]">
            At-risk and breached leads currently open.
          </p>
        </div>

        <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#111111]">
            <CheckCircle className="h-4 w-4 text-[#5A8A6A]" />
            Revenue risk model
          </div>
          <div className="text-2xl font-bold text-[#111111]">
            {summary ? formatMoney(summary.estimatedRevenueRisk) : "—"}
          </div>
          <p className="mt-1 text-xs text-[#6B7280]">
            Marked as {summary?.riskLabel ?? "estimated"} by the backend.
          </p>
        </div>
      </div>
    </Card>
  );
}
