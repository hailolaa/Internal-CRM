"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import type { ReactNode } from "react";

// ============================================================
// Card — warm ivory card with premium shadow
// ============================================================
export function Card({
  children,
  className = "",
  hover = false,
  padding = "p-5 sm:p-6 md:p-7 lg:p-8",
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: string;
}) {
  return (
    <div
      data-gsap-reveal
      className={`${padding} ${hover ? "transition-all duration-300 hover:border-[rgba(96,180,175,0.18)]" : ""} ${className}`}
      style={{
        backgroundColor: "#FFFCF9",
        border: "1px solid rgba(21,31,33,0.06)",
        borderRadius: "24px",
        boxShadow: hover
          ? "0 1px 4px rgba(21,31,33,0.03)"
          : "0 1px 6px rgba(21,31,33,0.03)",
      }}
      onMouseEnter={
        hover
          ? (e) => {
              e.currentTarget.style.boxShadow =
                "0 4px 20px rgba(21,31,33,0.06)";
            }
          : undefined
      }
      onMouseLeave={
        hover
          ? (e) => {
              e.currentTarget.style.boxShadow = "0 1px 4px rgba(21,31,33,0.03)";
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

// ============================================================
// DarkCard — stone variant
// ============================================================
export function DarkCard({
  children,
  className = "",
  padding = "p-5 sm:p-6 md:p-7 lg:p-8",
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <div
      data-gsap-reveal
      className={`${padding} ${className}`}
      style={{
        backgroundColor: "#eaedeb",
        border: "1px solid rgba(21,31,33,0.05)",
        borderRadius: "24px",
      }}
    >
      {children}
    </div>
  );
}

// ============================================================
// StatCard — KPI metric display with brand colours
// ============================================================

const STAT_COLORS: Record<
  string,
  { text: string; bg: string; border: string; tailwindText: string }
> = {
  violet: {
    text: "#60b4af",
    bg: "rgba(96, 180, 175, 0.08)",
    border: "rgba(96, 180, 175, 0.12)",
    tailwindText: "text-[#60b4af]",
  },
  indigo: {
    text: "#60b4af",
    bg: "rgba(96, 180, 175, 0.08)",
    border: "rgba(96, 180, 175, 0.12)",
    tailwindText: "text-[#60b4af]",
  },
  teal: {
    text: "#5e8a8d",
    bg: "rgba(94, 138, 141, 0.08)",
    border: "rgba(94, 138, 141, 0.12)",
    tailwindText: "text-[#5e8a8d]",
  },
  blue: {
    text: "#5e8a8d",
    bg: "rgba(94, 138, 141, 0.08)",
    border: "rgba(94, 138, 141, 0.12)",
    tailwindText: "text-[#5e8a8d]",
  },
  green: {
    text: "#60b4af",
    bg: "rgba(96, 180, 175, 0.08)",
    border: "rgba(96, 180, 175, 0.12)",
    tailwindText: "text-[#60b4af]",
  },
  emerald: {
    text: "#60b4af",
    bg: "rgba(96, 180, 175, 0.06)",
    border: "rgba(96, 180, 175, 0.10)",
    tailwindText: "text-[#60b4af]",
  },
  amber: {
    text: "#b7672e",
    bg: "rgba(183, 103, 46, 0.08)",
    border: "rgba(183, 103, 46, 0.12)",
    tailwindText: "text-[#b7672e]",
  },
  red: {
    text: "#9a5524",
    bg: "rgba(154, 85, 36, 0.06)",
    border: "rgba(154, 85, 36, 0.10)",
    tailwindText: "text-[#9a5524]",
  },
  rose: {
    text: "#9a5524",
    bg: "rgba(154, 85, 36, 0.06)",
    border: "rgba(154, 85, 36, 0.10)",
    tailwindText: "text-[#9a5524]",
  },
  cyan: {
    text: "#5e8a8d",
    bg: "rgba(94, 138, 141, 0.08)",
    border: "rgba(94, 138, 141, 0.12)",
    tailwindText: "text-[#5e8a8d]",
  },
  purple: {
    text: "#60b4af",
    bg: "rgba(96, 180, 175, 0.08)",
    border: "rgba(96, 180, 175, 0.12)",
    tailwindText: "text-[#60b4af]",
  },
};

export function StatCard({
  label,
  value,
  change,
  trend,
  sub,
  icon: Icon,
  color = "violet",
}: {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down";
  sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
}) {
  const c = STAT_COLORS[color] || STAT_COLORS.violet;

  return (
    <div
      data-gsap-metric
      className="p-5 sm:p-6 md:p-7 transition-all duration-300"
      style={{
        backgroundColor: "#FFFCF9",
        border: "1px solid rgba(21,31,33,0.06)",
        borderRadius: "24px",
        boxShadow: "0 1px 4px rgba(21,31,33,0.03)",
      }}
    >
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        {Icon ? (
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: c.bg }}
          >
            <Icon
              className={`w-4 h-4 sm:w-[18px] sm:h-[18px] ${c.tailwindText}`}
            />
          </div>
        ) : (
          <span
            className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "#5e8a8d" }}
          >
            {label}
          </span>
        )}
        {change && (
          <span
            className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              color:
                trend === "up"
                  ? "#60b4af"
                  : trend === "down"
                    ? "#9a5524"
                    : "#5e8a8d",
              backgroundColor:
                trend === "up"
                  ? "rgba(96,180,175,0.08)"
                  : trend === "down"
                    ? "rgba(154,85,36,0.06)"
                    : "transparent",
            }}
          >
            {trend === "up" && <TrendingUp className="w-3 h-3" />}
            {trend === "down" && <TrendingDown className="w-3 h-3" />}
            {change}
          </span>
        )}
      </div>
      <p
        className="text-2xl sm:text-3xl md:text-[2rem] font-bold tracking-tight"
        style={{ color: "#151f21" }}
      >
        {value}
      </p>
      {Icon && (
        <p
          className="text-[11px] sm:text-xs mt-1.5 font-medium"
          style={{ color: "#5e8a8d" }}
        >
          {label}
        </p>
      )}
      {sub && (
        <p className="text-[11px] sm:text-xs mt-1" style={{ color: "#A8A39B" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ============================================================
// SectionHeader — consistent section titles
// ============================================================
export function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = "text-[#60b4af]",
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className={`w-5 h-5 ${iconColor}`} />}
        <h2
          className="font-semibold tracking-tight"
          style={{ color: "#151f21" }}
        >
          {title}
        </h2>
        {subtitle && (
          <span className="text-xs font-medium" style={{ color: "#5e8a8d" }}>
            {subtitle}
          </span>
        )}
      </div>
      {right}
    </div>
  );
}
