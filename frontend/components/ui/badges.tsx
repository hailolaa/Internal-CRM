"use client";

import { Lock } from "lucide-react";

// ============================================================
// Badge — status / label badge
// ============================================================
export function Badge({
  children,
  variant = "neutral",
  icon: Icon,
  size = "sm",
}: {
  children: React.ReactNode;
  variant?:
    | "success"
    | "warning"
    | "error"
    | "info"
    | "neutral"
    | "premium"
    | "coming-soon";
  icon?: React.ComponentType<{ className?: string }>;
  size?: "xs" | "sm";
}) {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    success: {
      bg: "rgba(96,180,175,0.08)",
      text: "#60b4af",
      border: "rgba(96,180,175,0.2)",
    },
    warning: {
      bg: "rgba(183,103,46,0.08)",
      text: "#b7672e",
      border: "rgba(183,103,46,0.2)",
    },
    error: {
      bg: "rgba(154,85,36,0.08)",
      text: "#9a5524",
      border: "rgba(154,85,36,0.2)",
    },
    info: {
      bg: "rgba(94,138,141,0.08)",
      text: "#5e8a8d",
      border: "rgba(94,138,141,0.2)",
    },
    neutral: { bg: "#eaedeb", text: "#5e8a8d", border: "#d8ddda" },
    premium: { bg: "#eaedeb", text: "#151f21", border: "#d8ddda" },
    "coming-soon": {
      bg: "rgba(183,103,46,0.08)",
      text: "#b7672e",
      border: "rgba(183,103,46,0.2)",
    },
  };

  const s = styles[variant];
  const sizeStyles =
    size === "xs" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${sizeStyles}`}
      style={{
        backgroundColor: s.bg,
        color: s.text,
        border: `1px solid ${s.border}`,
      }}
    >
      {Icon && <Icon className={size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"} />}
      {children}
    </span>
  );
}

// ============================================================
// StatusBadge — pre-configured status badges
// ============================================================
export function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    {
      variant: "success" | "warning" | "error" | "info" | "neutral";
      label: string;
    }
  > = {
    active: { variant: "success", label: "Active" },
    connected: { variant: "success", label: "Connected" },
    confirmed: { variant: "success", label: "Confirmed" },
    complete: { variant: "success", label: "Complete" },
    completed: { variant: "success", label: "Completed" },
    new: { variant: "info", label: "New" },
    pending: { variant: "warning", label: "Pending" },
    contacted: { variant: "warning", label: "Contacted" },
    scheduled: { variant: "info", label: "Scheduled" },
    paused: { variant: "neutral", label: "Paused" },
    draft: { variant: "neutral", label: "Draft" },
    expired: { variant: "neutral", label: "Expired" },
    invited: { variant: "info", label: "Invited" },
    error: { variant: "error", label: "Error" },
    booked: { variant: "success", label: "Booked" },
    action_required: { variant: "error", label: "Action Required" },
    expiring_soon: { variant: "warning", label: "Expiring Soon" },
    coming: { variant: "neutral", label: "Coming Soon" },
    available: { variant: "info", label: "Available" },
  };

  const c = config[status.toLowerCase()] || {
    variant: "neutral" as const,
    label: status,
  };

  return <Badge variant={c.variant}>{c.label}</Badge>;
}

// ============================================================
// PhaseBadge — phase lock indicator
// ============================================================
export function PhaseBadge({
  phase,
  color = "purple",
}: {
  phase: string;
  color?: "purple" | "amber";
}) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
      style={{
        backgroundColor: "#eaedeb",
        color: "#151f21",
        border: "1px solid #d8ddda",
      }}
    >
      <Lock className="w-3 h-3" /> {phase}
    </div>
  );
}
