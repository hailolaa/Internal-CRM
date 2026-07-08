"use client";

import { AlertTriangle, User, Clock } from "lucide-react";
import { Card, CardSkeleton } from "@/components/ui";
import type { SlaBreachRecord } from "@/lib/api-types";

interface Breach {
  id: string;
  leadName: string;
  source: string;
  treatment: string;
  slaTarget: number;
  actualTime: string;
  breachBy: string;
  assignedTo: string;
  date: string;
  reason: string;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  return `${Math.floor(minutes / 60)} hr ${Math.round(minutes % 60)} min`;
}

function mapBreach(record: SlaBreachRecord): Breach {
  return {
    id: record.id,
    leadName: record.leadName,
    source: record.source,
    treatment: record.treatment,
    slaTarget: record.slaTargetMinutes,
    actualTime: formatMinutes(record.actualMinutes),
    breachBy: formatMinutes(record.breachMinutes),
    assignedTo: record.assignedTo,
    date: formatDateTime(record.breachedAt),
    reason: record.reason,
  };
}

export function SLABreachLog({
  breaches: liveBreaches,
  isLoading = false,
}: {
  breaches?: SlaBreachRecord[];
  isLoading?: boolean;
}) {
  const displayBreaches = liveBreaches ? liveBreaches.map(mapBreach) : [];

  return (
    <Card padding="p-0">
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
      >
        <h2
          className="font-semibold flex items-center gap-2"
          style={{ color: "#111111" }}
        >
          <AlertTriangle className="w-5 h-5 text-[#8A4A4A]" /> Breach Log
        </h2>
        <span className="text-xs" style={{ color: "#6B7280" }}>
          Last 7 days
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: "rgba(0,0,0,0.04)" }}>
        {isLoading &&
          Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="px-6 py-4">
              <CardSkeleton lines={3} className="rounded-xl p-4" />
            </div>
          ))}
        {!isLoading && displayBreaches.length === 0 && (
          <div className="px-6 py-10 text-center text-sm" style={{ color: "#6B7280" }}>
            No live SLA breaches have been recorded in the last 7 days.
          </div>
        )}
        {!isLoading && displayBreaches.map((breach) => (
          <div key={breach.id} className="px-6 py-4">
            <div className="flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: "rgba(138,74,74,0.08)",
                  border: "1px solid rgba(138,74,74,0.15)",
                }}
              >
                <Clock className="w-5 h-5 text-[#8A4A4A]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <span
                    className="font-medium text-sm"
                    style={{ color: "#111111" }}
                  >
                    {breach.leadName}
                  </span>
                  <span className="text-xs" style={{ color: "#6B7280" }}>
                    {breach.source} · {breach.treatment}
                  </span>
                  <span className="text-xs" style={{ color: "#6B7280" }}>
                    {breach.date}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm mb-2">
                  <div>
                    <span style={{ color: "#6B7280" }}>Target: </span>
                    <span style={{ color: "#111111" }}>
                      {breach.slaTarget} min
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#6B7280" }}>Actual: </span>
                    <span className="font-medium" style={{ color: "#8A4A4A" }}>
                      {breach.actualTime}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#6B7280" }}>Over by: </span>
                    <span className="font-bold" style={{ color: "#8A4A4A" }}>
                      {breach.breachBy}
                    </span>
                  </div>
                </div>
                <div
                  className="flex items-center gap-4 text-xs"
                  style={{ color: "#6B7280" }}
                >
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" /> {breach.assignedTo}
                  </span>
                  <span>Reason: {breach.reason}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
