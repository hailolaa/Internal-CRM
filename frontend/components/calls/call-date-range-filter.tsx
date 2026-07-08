"use client";

import { CalendarDays, X } from "lucide-react";

export function CallDateRangeFilter({
  startDate,
  endDate,
  isLoading = false,
  onStartDateChange,
  onEndDateChange,
  onClear,
}: {
  startDate: string;
  endDate: string;
  isLoading?: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[rgba(0,0,0,0.08)] bg-white px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-2 text-sm font-medium text-[#111111]">
        <CalendarDays className="h-4 w-4 text-[#6E6AE8]" />
        Date range
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="text-xs font-medium text-[#6B7280]">
          From
          <input
            type="date"
            value={startDate}
            disabled={isLoading}
            onChange={(event) => onStartDateChange(event.target.value)}
            className="mt-1 block h-9 rounded-md border border-[rgba(0,0,0,0.12)] bg-white px-3 text-sm text-[#111111] disabled:opacity-60"
          />
        </label>
        <label className="text-xs font-medium text-[#6B7280]">
          To
          <input
            type="date"
            value={endDate}
            disabled={isLoading}
            onChange={(event) => onEndDateChange(event.target.value)}
            className="mt-1 block h-9 rounded-md border border-[rgba(0,0,0,0.12)] bg-white px-3 text-sm text-[#111111] disabled:opacity-60"
          />
        </label>
        <button
          type="button"
          onClick={onClear}
          disabled={isLoading || (!startDate && !endDate)}
          className="inline-flex h-9 items-center justify-center rounded-md border border-[rgba(0,0,0,0.12)] px-3 text-sm font-medium text-[#111111] hover:bg-[rgba(0,0,0,0.04)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Clear call date range"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
