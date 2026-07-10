"use client";

import { CheckCircle, CircleHelp, FilePenLine, Gauge, UploadCloud } from "lucide-react";
import { Badge } from "./badges";

export type ProvenanceValue =
  | "exact"
  | "manual"
  | "connector"
  | "estimated"
  | "imported"
  | "fallback"
  | "live"
  | "unknown"
  | string
  | null
  | undefined;

const PROVENANCE_CONFIG: Record<
  string,
  {
    label: string;
    description: string;
    confidence: number;
    variant: "success" | "warning" | "info" | "neutral" | "error";
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  exact: {
    label: "Verified",
    description: "Directly calculated from live workspace records.",
    confidence: 95,
    variant: "success",
    icon: CheckCircle,
  },
  live: {
    label: "Live",
    description: "Loaded from the live backend for this workspace.",
    confidence: 90,
    variant: "success",
    icon: CheckCircle,
  },
  manual: {
    label: "Manual",
    description: "Entered or reviewed manually by the team.",
    confidence: 75,
    variant: "info",
    icon: FilePenLine,
  },
  connector: {
    label: "Connector",
    description: "Imported through a configured marketing connector.",
    confidence: 82,
    variant: "success",
    icon: UploadCloud,
  },
  imported: {
    label: "Imported",
    description: "Imported from a platform export or external feed.",
    confidence: 70,
    variant: "info",
    icon: UploadCloud,
  },
  estimated: {
    label: "Estimated",
    description: "Modelled from available activity and value assumptions.",
    confidence: 55,
    variant: "warning",
    icon: Gauge,
  },
  fallback: {
    label: "Fallback",
    description: "Displayed from fallback/sample data while live data is unavailable.",
    confidence: 30,
    variant: "error",
    icon: CircleHelp,
  },
  unknown: {
    label: "Unknown",
    description: "No clear source information is available yet.",
    confidence: 20,
    variant: "neutral",
    icon: CircleHelp,
  },
};

export function normaliseProvenance(value: ProvenanceValue) {
  const key = String(value || "unknown")
    .toLowerCase()
    .replace(/[_\s-]+/g, "_");

  if (key.includes("manual")) return "manual";
  if (key.includes("connector")) return "connector";
  if (key.includes("import")) return "imported";
  if (key.includes("estimate")) return "estimated";
  if (key.includes("fallback") || key.includes("sample")) return "fallback";
  if (key.includes("exact") || key.includes("verified")) return "exact";
  if (key.includes("live") || key.includes("api")) return "live";
  return PROVENANCE_CONFIG[key] ? key : "unknown";
}

export function provenanceConfig(value: ProvenanceValue) {
  return PROVENANCE_CONFIG[normaliseProvenance(value)];
}

export function DataProvenanceBadge({
  value,
  label,
  size = "xs",
}: {
  value: ProvenanceValue;
  label?: string;
  size?: "xs" | "sm";
}) {
  const config = provenanceConfig(value);
  return (
    <span title={config.description}>
      <Badge variant={config.variant} icon={config.icon} size={size}>
        {label || config.label}
      </Badge>
    </span>
  );
}

export function ConfidenceIndicator({
  value,
  compact = false,
}: {
  value: ProvenanceValue;
  compact?: boolean;
}) {
  const config = provenanceConfig(value);

  return (
    <div className={compact ? "min-w-[112px]" : "w-full"}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[#5e8a8d]">
          Confidence
        </span>
        <span className="text-[11px] font-semibold text-[#151f21]">
          {config.confidence}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(21,31,33,0.06)]">
        <div
          className="h-full rounded-full bg-[#60b4af]"
          style={{ width: `${config.confidence}%` }}
        />
      </div>
    </div>
  );
}

export function ProvenanceSummary({
  items,
}: {
  items: { label: string; value: ProvenanceValue }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9] px-3 py-2"
        >
          <span className="text-[11px] font-medium text-[#5e8a8d]">
            {item.label}
          </span>
          <DataProvenanceBadge value={item.value} />
        </div>
      ))}
    </div>
  );
}
