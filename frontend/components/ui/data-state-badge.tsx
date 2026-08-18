"use client";

import {
  getDataStatePresentation,
  normaliseDataState,
  type DataStateTone,
} from "@/lib/data-state";

const TONE_STYLES: Record<DataStateTone, { bg: string; border: string; text: string }> = {
  live: { bg: "#E6F4F1", border: "#BFE2DC", text: "#1B6F68" },
  info: { bg: "#E8F2FA", border: "#C6DDEE", text: "#2F647D" },
  warning: { bg: "#FFF4DE", border: "#F1D197", text: "#8A5A12" },
  neutral: { bg: "#ECEFED", border: "#D4DBD8", text: "#526063" },
  demo: { bg: "#FDE8E5", border: "#F2BDB5", text: "#9A3E32" },
};

interface DataStateBadgeProps {
  state?: string | null;
  label?: string | null;
  compact?: boolean;
}

export function DataStateBadge({ state, label, compact = false }: DataStateBadgeProps) {
  const presentation = getDataStatePresentation(state, label);
  const normalized = normaliseDataState(state);
  const style = TONE_STYLES[presentation.tone];

  return (
    <span
      title={presentation.description}
      aria-label={`${presentation.label} data state: ${presentation.description}`}
      data-data-state={normalized}
      className="inline-flex shrink-0 items-center rounded-full border font-bold uppercase tracking-[0.08em]"
      style={{
        backgroundColor: style.bg,
        borderColor: style.border,
        color: style.text,
        fontSize: compact ? 9 : 10,
        lineHeight: compact ? "14px" : "16px",
        padding: compact ? "0 6px" : "1px 8px",
      }}
    >
      {presentation.label}
    </span>
  );
}
