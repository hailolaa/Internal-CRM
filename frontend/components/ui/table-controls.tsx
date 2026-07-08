"use client";

import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { SortDirection } from "@/hooks/use-table";

// ============================================================
// SortableHeader — clickable column header with sort indicator
// ============================================================
export function SortableHeader({
  label,
  sortKey,
  direction,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: string;
  direction: SortDirection;
  onSort: (key: string) => void;
  className?: string;
}) {
  return (
    <th
      className={`text-left text-[11px] uppercase tracking-wider font-bold px-5 py-3.5 cursor-pointer select-none transition-colors group ${className}`}
      style={{ color: "#5e8a8d", backgroundColor: "#eaedeb" }}
      onClick={() => onSort(sortKey)}
      onMouseOver={(e) => {
        (e.currentTarget as HTMLElement).style.color = "#60b4af";
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLElement).style.color = "#5e8a8d";
      }}
    >
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        <span className="flex-shrink-0">
          {direction === "asc" ? (
            <ArrowUp className="w-3 h-3 text-[#60b4af]" />
          ) : direction === "desc" ? (
            <ArrowDown className="w-3 h-3 text-[#60b4af]" />
          ) : (
            <ArrowUpDown className="w-3 h-3 text-[#d8ddda] group-hover:text-[#5e8a8d] transition-colors" />
          )}
        </span>
      </div>
    </th>
  );
}

// ============================================================
// PaginationControls — Previous/Next with page info
// ============================================================
export function PaginationControls({
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  totalItems,
  onPrevious,
  onNext,
  onGoToPage,
  hasPrevPage,
  hasNextPage,
}: {
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  totalItems: number;
  onPrevious: () => void;
  onNext: () => void;
  onGoToPage?: (page: number) => void;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}) {
  const pageNumbers: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (currentPage > 3) pageNumbers.push("...");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pageNumbers.push(i);
    }
    if (currentPage < totalPages - 2) pageNumbers.push("...");
    pageNumbers.push(totalPages);
  }

  return (
    <div
      className="px-5 py-3 flex items-center justify-between text-sm"
      style={{ borderTop: "1px solid #d8ddda", color: "#5e8a8d" }}
    >
      <span>
        Showing {startIndex}–{endIndex} of {totalItems.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={onPrevious}
          disabled={!hasPrevPage}
          className="px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-[#151f21] hover:bg-[#eaedeb]"
          style={{ border: "1px solid #d8ddda" }}
        >
          Previous
        </button>

        {onGoToPage && totalPages > 1 && (
          <div className="flex items-center gap-1 mx-1">
            {pageNumbers.map((page, i) =>
              page === "..." ? (
                <span
                  key={`dots-${i}`}
                  className="px-1"
                  style={{ color: "#A8A39B" }}
                >
                  …
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => onGoToPage(page)}
                  className="w-8 h-8 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    backgroundColor:
                      page === currentPage
                        ? "rgba(96, 180, 175, 0.1)"
                        : "transparent",
                    color: page === currentPage ? "#151f21" : "#5e8a8d",
                    border:
                      page === currentPage
                        ? "1px solid rgba(96, 180, 175, 0.25)"
                        : "1px solid transparent",
                  }}
                >
                  {page}
                </button>
              ),
            )}
          </div>
        )}

        <button
          onClick={onNext}
          disabled={!hasNextPage}
          className="px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-[#151f21] hover:bg-[#eaedeb]"
          style={{ border: "1px solid #d8ddda" }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ============================================================
// ValidatedInput — form input with inline error display
// ============================================================
export function ValidatedInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder = "",
  type = "text",
  required = false,
  icon: Icon,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | null;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "number" | "password" | "url";
  required?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const hasError = !!error;

  return (
    <div className={className}>
      <label
        className="block text-sm font-medium mb-1.5"
        style={{ color: "#151f21" }}
      >
        {label}
        {required && <span className="text-[#9a5524] ml-0.5">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <Icon
            className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${hasError ? "text-[#9a5524]" : "text-[#A8A39B]"}`}
          />
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          required={required}
          className={`w-full bg-white rounded-xl px-4 py-3 text-sm text-[#151f21] outline-none transition-all placeholder:text-[#A8A39B] ${Icon ? "pl-11" : ""}`}
          style={{
            border: `1px solid ${hasError ? "rgba(154,85,36,0.3)" : "#d8ddda"}`,
            boxShadow: hasError
              ? "0 0 0 3px rgba(154, 85, 36, 0.1)"
              : "0 1px 3px rgba(21, 31, 33, 0.04)",
          }}
          onFocus={(e) => {
            if (!hasError) {
              e.currentTarget.style.borderColor = "#60b4af";
              e.currentTarget.style.boxShadow =
                "0 0 0 3px rgba(96, 180, 175, 0.12)";
            }
          }}
          onBlurCapture={(e) => {
            if (!hasError) {
              e.currentTarget.style.borderColor = "#d8ddda";
              e.currentTarget.style.boxShadow =
                "0 1px 3px rgba(21, 31, 33, 0.04)";
            }
          }}
        />
      </div>
      {hasError && (
        <p className="text-xs text-[#9a5524] mt-1.5 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-[#9a5524] flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
