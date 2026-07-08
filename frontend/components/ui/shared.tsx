"use client";

import { Plus, CheckCircle } from "lucide-react";

// ============================================================
// StepProgress — horizontal step indicator bar
// ============================================================
export function StepProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="flex gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            backgroundColor:
              current >= i + 1 ? "#60b4af" : "rgba(21,31,33,0.06)",
          }}
          className="flex-1 h-1 rounded-full"
        />
      ))}
    </div>
  );
}

// ============================================================
// StepDots — numbered step dots (for signup/onboarding)
// ============================================================
export function StepDots({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        return (
          <div key={step} className="flex items-center gap-2">
            <div
              style={
                current >= step
                  ? { backgroundColor: "#60b4af", color: "#ffffff" }
                  : { backgroundColor: "rgba(21,31,33,0.06)", color: "#5e8a8d" }
              }
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
            >
              {current > step ? <CheckCircle className="w-5 h-5" /> : step}
            </div>
            {step < total && (
              <div
                style={{
                  backgroundColor:
                    current > step ? "#60b4af" : "rgba(21,31,33,0.06)",
                }}
                className="w-16 h-0.5"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// DashedAddButton — "Add new" dashed border button
// ============================================================
export function DashedAddButton({
  label,
  sublabel,
  onClick,
  className = "",
  minHeight,
}: {
  label: string;
  sublabel?: string;
  onClick?: () => void;
  className?: string;
  minHeight?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{ borderColor: "rgba(21,31,33,0.12)", color: "#5e8a8d" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#60b4af";
        (e.currentTarget as HTMLButtonElement).style.color = "#60b4af";
        (e.currentTarget as HTMLButtonElement).style.backgroundColor =
          "rgba(96,180,175,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor =
          "rgba(21,31,33,0.12)";
        (e.currentTarget as HTMLButtonElement).style.color = "#5e8a8d";
        (e.currentTarget as HTMLButtonElement).style.backgroundColor =
          "transparent";
      }}
      className={`w-full border-2 border-dashed rounded-xl transition-all flex flex-col items-center justify-center gap-1 ${minHeight || "py-4"} ${className}`}
    >
      <Plus className="w-4 h-4" />
      <span className="text-sm">{label}</span>
      {sublabel && (
        <span className="text-xs" style={{ color: "#5e8a8d" }}>
          {sublabel}
        </span>
      )}
    </button>
  );
}

// ============================================================
// DashedAddCard — larger "Add new" card with icon
// ============================================================
export function DashedAddCard({
  label,
  sublabel,
  onClick,
  minHeight = "min-h-[200px]",
}: {
  label: string;
  sublabel?: string;
  onClick?: () => void;
  minHeight?: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{ borderColor: "rgba(21,31,33,0.12)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#60b4af";
        (e.currentTarget as HTMLDivElement).style.backgroundColor =
          "rgba(96,180,175,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor =
          "rgba(21,31,33,0.12)";
        (e.currentTarget as HTMLDivElement).style.backgroundColor =
          "transparent";
      }}
      className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${minHeight}`}
    >
      <div
        className="icon-container-lg mb-3"
        style={{ backgroundColor: "rgba(96,180,175,0.08)" }}
      >
        <Plus className="w-6 h-6" style={{ color: "#60b4af" }} />
      </div>
      <p className="font-medium" style={{ color: "#151f21" }}>
        {label}
      </p>
      {sublabel && (
        <p className="text-xs mt-1" style={{ color: "#5e8a8d" }}>
          {sublabel}
        </p>
      )}
    </div>
  );
}

// ============================================================
// InfoRow — key-value display row
// ============================================================
export function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string | React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: "#5e8a8d" }}>{label}</span>
      <span
        className={valueColor || ""}
        style={!valueColor ? { color: "#151f21" } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

// ============================================================
// DetailGrid — grid of label/value pairs
// ============================================================
export function DetailGrid({
  items,
  columns = 2,
}: {
  items: {
    label: string;
    value: string | React.ReactNode;
    valueColor?: string;
  }[];
  columns?: 2 | 3 | 4;
}) {
  const colClass =
    columns === 2
      ? "grid-cols-2"
      : columns === 3
        ? "grid-cols-3"
        : "grid-cols-4";

  return (
    <div className={`grid ${colClass} gap-3 text-sm`}>
      {items.map((item) => (
        <div key={typeof item.label === "string" ? item.label : ""}>
          <p className="text-xs" style={{ color: "#5e8a8d" }}>
            {item.label}
          </p>
          <p
            className={`font-semibold ${item.valueColor || ""}`}
            style={!item.valueColor ? { color: "#151f21" } : undefined}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
