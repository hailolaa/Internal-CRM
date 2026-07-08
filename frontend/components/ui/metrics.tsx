"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import type { StatCardData } from "@/lib/types";

// ============================================================
// KPIGrid — renders a responsive grid of stat cards
// ============================================================
export function KPIGrid({
  stats,
  columns = 4,
}: {
  stats: StatCardData[];
  columns?: 2 | 3 | 4;
}) {
  const colClass =
    columns === 2
      ? "grid-cols-2"
      : columns === 3
        ? "grid-cols-1 md:grid-cols-3"
        : "grid-cols-2 lg:grid-cols-4";

  return (
    <div className={`grid ${colClass} gap-3`}>
      {stats.map((stat) => (
        <MetricCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}

// ============================================================
// MetricCard — single KPI display
// ============================================================
export function MetricCard({
  label,
  value,
  change,
  trend,
  sub,
  icon: Icon,
  color = "teal",
}: StatCardData) {
  const colorMap: Record<string, { text: string; bg: string }> = {
    teal: { text: "#5e8a8d", bg: "rgba(94,138,141,0.08)" },
    blue: { text: "#5e8a8d", bg: "rgba(94,138,141,0.08)" },
    violet: { text: "#60b4af", bg: "rgba(96,180,175,0.08)" },
    rose: { text: "#9a5524", bg: "rgba(154,85,36,0.08)" },
    amber: { text: "#b7672e", bg: "rgba(183,103,46,0.08)" },
    green: { text: "#60b4af", bg: "rgba(96,180,175,0.08)" },
    red: { text: "#9a5524", bg: "rgba(154,85,36,0.08)" },
    emerald: { text: "#60b4af", bg: "rgba(96,180,175,0.08)" },
    cyan: { text: "#5e8a8d", bg: "rgba(94,138,141,0.08)" },
    indigo: { text: "#60b4af", bg: "rgba(96,180,175,0.08)" },
    purple: { text: "#60b4af", bg: "rgba(96,180,175,0.08)" },
  };

  const c = colorMap[color || "teal"] || colorMap.teal;

  return (
    <div
      data-gsap-metric
      className="rounded-[24px] p-4"
      style={{
        backgroundColor: "#FFFCF9",
        border: "1px solid rgba(21,31,33,0.06)",
        boxShadow:
          "0 1px 3px rgba(21,31,33,0.04), 0 1px 2px rgba(21,31,33,0.02)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        {Icon ? (
          <div className="icon-container-sm" style={{ backgroundColor: c.bg }}>
            <Icon className="w-4 h-4" style={{ color: c.text }} />
          </div>
        ) : (
          <span className="text-sm" style={{ color: "#5e8a8d" }}>
            {label}
          </span>
        )}
        {change && (
          <span
            className="flex items-center gap-1 text-xs font-medium"
            style={{
              color:
                trend === "up"
                  ? "#60b4af"
                  : trend === "down"
                    ? "#9a5524"
                    : "#5e8a8d",
            }}
          >
            {trend === "up" && <TrendingUp className="w-3 h-3" />}
            {trend === "down" && <TrendingDown className="w-3 h-3" />}
            {change}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold" style={{ color: "#151f21" }}>
        {value}
      </p>
      {Icon && (
        <p className="text-xs mt-0.5" style={{ color: "#5e8a8d" }}>
          {label}
        </p>
      )}
      {sub && (
        <p className="text-xs mt-0.5" style={{ color: "#5e8a8d" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ============================================================
// SimpleStatCard — minimal stat display (no icon)
// ============================================================
export function SimpleStatCard({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string | number;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div
      data-gsap-metric
      className="rounded-[24px] p-4"
      style={{
        backgroundColor: "#FFFCF9",
        border: "1px solid rgba(21,31,33,0.06)",
        boxShadow:
          "0 1px 3px rgba(21,31,33,0.04), 0 1px 2px rgba(21,31,33,0.02)",
      }}
    >
      <p
        className={`text-2xl font-bold ${valueColor || ""}`}
        style={!valueColor ? { color: "#151f21" } : undefined}
      >
        {value}
      </p>
      <p className="text-sm" style={{ color: "#5e8a8d" }}>
        {label}
      </p>
      {sub && (
        <p className="text-xs mt-0.5" style={{ color: "#5e8a8d" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
