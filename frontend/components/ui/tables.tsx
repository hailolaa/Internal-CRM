"use client";

import { MoreHorizontal } from "lucide-react";

// ============================================================
// DataTable — reusable table wrapper with brand palette
// ============================================================
export function DataTable({
  headers,
  children,
  className = "",
}: {
  headers: { label: string; className?: string }[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{
        backgroundColor: "#FFFCF9",
        border: "1px solid rgba(21,31,33,0.06)",
        borderRadius: "24px",
        boxShadow: "0 1px 6px rgba(21,31,33,0.03)",
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr
              style={{
                borderBottom: "1px solid rgba(21,31,33,0.05)",
                backgroundColor: "#eaedeb",
              }}
            >
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={`text-left text-[11px] uppercase tracking-widest font-semibold px-6 py-4 ${h.className || ""}`}
                  style={{ color: "#5e8a8d" }}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// TableRow — consistent row styling
// ============================================================
export function TableRow({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={`transition-colors duration-150 ${onClick ? "cursor-pointer" : ""} ${className}`}
      style={{ borderBottom: "1px solid rgba(21,31,33,0.04)" }}
      onMouseOver={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor =
          "rgba(96,180,175,0.03)";
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
      }}
    >
      {children}
    </tr>
  );
}

// ============================================================
// TableCell — consistent cell styling
// ============================================================
export function TableCell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-6 py-4 ${className}`} style={{ color: "#151f21" }}>
      {children}
    </td>
  );
}

// ============================================================
// TableFooter — pagination / info footer
// ============================================================
export function TableFooter({
  showing,
  total,
  onPrevious,
  onNext,
}: {
  showing: number;
  total: number;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  return (
    <div
      className="px-6 py-4 flex items-center justify-between text-sm"
      style={{ borderTop: "1px solid rgba(21,31,33,0.05)", color: "#5e8a8d" }}
    >
      <span className="text-[13px]">
        Showing {showing} of {total.toLocaleString()}
      </span>
      <div className="flex gap-2">
        <button
          onClick={onPrevious}
          className="px-4 py-1.5 rounded-xl text-[13px] font-medium transition-all duration-150 text-[#151f21]"
          style={{
            border: "1px solid rgba(21,31,33,0.08)",
            backgroundColor: "#FFFCF9",
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "#eaedeb";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "#FFFCF9";
          }}
        >
          Previous
        </button>
        <button
          onClick={onNext}
          className="px-4 py-1.5 rounded-xl text-[13px] font-medium transition-all duration-150 text-[#151f21]"
          style={{
            border: "1px solid rgba(21,31,33,0.08)",
            backgroundColor: "#FFFCF9",
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "#eaedeb";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "#FFFCF9";
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ============================================================
// MoreButton — three-dot menu button
// ============================================================
export function MoreButton({
  onClick,
  label = "More options",
}: {
  onClick?: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="p-1.5 rounded-xl transition-colors duration-150"
      onMouseOver={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = "#eaedeb";
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
      }}
    >
      <MoreHorizontal className="w-4 h-4 text-[#5e8a8d]" />
    </button>
  );
}
