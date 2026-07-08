"use client";

import Link from "next/link";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { StatCard } from "@/components/ui";
import { FilterTabs } from "@/components/ui/forms";
import { downloadCsv, rowsFromTables } from "@/lib/client-download";
import type { StatCardData } from "@/lib/types";

// ============================================================
// ReportPageTemplate - eliminates duplication across report pages
// ============================================================
export function ReportPageTemplate({
  title,
  subtitle,
  metrics,
  dateRanges = ["Last 30 days", "Last 7 days", "Last 90 days", "This year"],
  selectedDateRange,
  showRefresh = false,
  showExport = true,
  exportDisabled = false,
  exportLabel = "Export",
  isExporting = false,
  onRefresh,
  onDateRangeChange,
  onExport,
  filterTabs,
  children,
}: {
  title: string;
  subtitle: string;
  metrics?: StatCardData[];
  dateRanges?: string[];
  selectedDateRange?: string;
  showRefresh?: boolean;
  showExport?: boolean;
  exportDisabled?: boolean;
  exportLabel?: string;
  isExporting?: boolean;
  onRefresh?: () => void;
  onDateRangeChange?: (range: string) => void;
  onExport?: () => void;
  filterTabs?: string[];
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeFilter, setActiveFilter] = useState(
    filterTabs?.[0]?.toLowerCase() ?? "",
  );

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
      return;
    }
    window.location.reload();
  };

  const handleExport = () => {
    if (exportDisabled || isExporting) return;

    if (onExport) {
      onExport();
      return;
    }

    const rows = contentRef.current ? rowsFromTables(contentRef.current) : [];
    if (rows.length > 0) {
      downloadCsv(
        `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`,
        rows,
      );
    }
  };

  return (
    <div className="space-y-6">
      <div
        data-gsap-reveal
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-gray-400 mt-1">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedDateRange ?? dateRanges[0]}
            onChange={(event) => onDateRangeChange?.(event.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm"
          >
            {dateRanges.map((range) => (
              <option key={range}>{range}</option>
            ))}
          </select>
          {showRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              aria-label={`Refresh ${title}`}
              className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          {showExport && (
            <button
              type="button"
              onClick={handleExport}
              disabled={exportDisabled || isExporting}
              aria-label={`${exportLabel} for ${title}`}
              title={
                exportDisabled
                  ? "Report export is available after this report finishes loading."
                  : `${exportLabel} for ${title}`
              }
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg flex items-center gap-2 hover:bg-white/10 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isExporting ? "Exporting..." : exportLabel}
            </button>
          )}
        </div>
      </div>

      {metrics && (
        <div data-gsap-reveal className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metrics.map((m) => (
            <StatCard key={m.label} {...m} />
          ))}
        </div>
      )}

      {filterTabs && (
        <FilterTabs
          tabs={filterTabs}
          active={activeFilter || filterTabs[0].toLowerCase()}
          onChange={setActiveFilter}
        />
      )}

      <div ref={contentRef} data-gsap-output>
        {children}
      </div>
    </div>
  );
}

// ============================================================
// SourceTable - reusable source/attribution table
// ============================================================
export function SourceTable({
  title,
  rightLabel,
  rightHref,
  onRightClick,
  data,
}: {
  title: string;
  rightLabel?: string;
  rightHref?: string;
  onRightClick?: () => void;
  data: {
    source: string;
    leads: number;
    qualified?: number;
    booked?: number;
    conversion: string;
    trend?: string;
  }[];
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold">{title}</h3>
        {rightLabel && rightHref && (
          <Link
            href={rightHref}
            className="text-sm text-teal-400 hover:text-teal-300"
          >
            {rightLabel}
          </Link>
        )}
        {rightLabel && !rightHref && onRightClick && (
          <button
            type="button"
            onClick={onRightClick}
            className="text-sm text-teal-400 hover:text-teal-300"
          >
            {rightLabel}
          </button>
        )}
        {rightLabel && !rightHref && !onRightClick && (
          <span className="text-sm text-gray-500">{rightLabel}</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-xs text-gray-500 font-medium py-3">
                Source
              </th>
              <th className="text-left text-xs text-gray-500 font-medium py-3">
                Leads
              </th>
              {data[0]?.qualified !== undefined && (
                <th className="text-left text-xs text-gray-500 font-medium py-3">
                  Qualified
                </th>
              )}
              {data[0]?.booked !== undefined && (
                <th className="text-left text-xs text-gray-500 font-medium py-3">
                  Booked
                </th>
              )}
              <th className="text-left text-xs text-gray-500 font-medium py-3">
                Conv.
              </th>
              {data[0]?.trend !== undefined && (
                <th className="text-left text-xs text-gray-500 font-medium py-3">
                  Trend
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.length ? (
              data.map((row) => (
                <tr key={row.source} className="border-b border-white/5">
                  <td className="py-3 font-medium">{row.source}</td>
                  <td className="py-3 text-gray-400">{row.leads}</td>
                  {row.qualified !== undefined && (
                    <td className="py-3 text-gray-400">{row.qualified}</td>
                  )}
                  {row.booked !== undefined && (
                    <td className="py-3 text-gray-400">{row.booked}</td>
                  )}
                  <td className="py-3 text-teal-400 font-medium">
                    {row.conversion}
                  </td>
                  {row.trend !== undefined && (
                    <td className="py-3">
                      <span
                        className={`text-xs ${
                          row.trend.startsWith("+")
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {row.trend}
                      </span>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-sm text-gray-500"
                >
                  No live rows are available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// BreakdownBars - reusable bar chart breakdown
// ============================================================
export function BreakdownBars({
  title,
  rightLabel,
  data,
}: {
  title: string;
  rightLabel?: string;
  data: {
    label: string;
    value: number;
    detail?: string;
    detailValue?: string;
    color?: string;
  }[];
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold">{title}</h3>
        {rightLabel && (
          <span className="text-sm text-gray-500">{rightLabel}</span>
        )}
      </div>
      <div className="space-y-4">
        {data.length ? (
          data.map((item) => (
            <div key={item.label}>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-300">{item.label}</span>
                <div className="flex items-center gap-3">
                  {item.detail && (
                    <span className="text-gray-500">{item.detail}</span>
                  )}
                  {item.detailValue && (
                    <span className="text-teal-400 font-medium">
                      {item.detailValue}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    item.color || "bg-gradient-to-r from-teal-500 to-cyan-500"
                  } rounded-full transition-all`}
                  style={{ width: `${item.value}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-white/10 p-5 text-center text-sm text-gray-500">
            No live breakdown data is available.
          </div>
        )}
      </div>
    </div>
  );
}
