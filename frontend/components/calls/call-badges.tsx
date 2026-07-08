"use client";

import { PhoneIncoming, PhoneOutgoing, Timer } from "lucide-react";
import type {
  CallDirection,
  CallOutcome,
  CallDisposition,
} from "@/lib/call-data";
import {
  formatCallDuration,
} from "@/lib/call-data";

// Warm palette overrides for call badges
const WARM_OUTCOME_CONFIG: Record<
  CallOutcome,
  { label: string; bg: string; text: string; border: string }
> = {
  connected: {
    label: "Connected",
    bg: "rgba(90, 138, 106, 0.08)",
    text: "#5A8A6A",
    border: "rgba(90, 138, 106, 0.2)",
  },
  no_answer: {
    label: "No Answer",
    bg: "rgba(160, 120, 64, 0.08)",
    text: "#A07840",
    border: "rgba(160, 120, 64, 0.2)",
  },
  voicemail: {
    label: "Voicemail",
    bg: "rgba(74, 106, 138, 0.08)",
    text: "#4A6A8A",
    border: "rgba(74, 106, 138, 0.2)",
  },
  busy: { label: "Busy", bg: "#F7F5F2", text: "#7A746A", border: "#E5DED6" },
  cancelled: {
    label: "Cancelled",
    bg: "rgba(138, 74, 74, 0.08)",
    text: "#8A4A4A",
    border: "rgba(138, 74, 74, 0.2)",
  },
};

const WARM_DISPOSITION_CONFIG: Record<
  CallDisposition,
  { label: string; bg: string; text: string; border: string }
> = {
  booked: {
    label: "Booked",
    bg: "rgba(90, 138, 106, 0.08)",
    text: "#5A8A6A",
    border: "rgba(90, 138, 106, 0.2)",
  },
  callback_requested: {
    label: "Callback",
    bg: "rgba(125, 143, 122, 0.08)",
    text: "#7D8F7A",
    border: "rgba(125, 143, 122, 0.2)",
  },
  not_interested: {
    label: "Not Interested",
    bg: "rgba(138, 74, 74, 0.08)",
    text: "#8A4A4A",
    border: "rgba(138, 74, 74, 0.2)",
  },
  wrong_number: {
    label: "Wrong Number",
    bg: "#F7F5F2",
    text: "#7A746A",
    border: "#E5DED6",
  },
  info_given: {
    label: "Info Given",
    bg: "rgba(74, 106, 138, 0.08)",
    text: "#4A6A8A",
    border: "rgba(74, 106, 138, 0.2)",
  },
  follow_up_needed: {
    label: "Follow Up",
    bg: "rgba(160, 120, 64, 0.08)",
    text: "#A07840",
    border: "rgba(160, 120, 64, 0.2)",
  },
  none: { label: "—", bg: "#F7F5F2", text: "#A8A39B", border: "#E5DED6" },
};

const UNKNOWN_BADGE_CONFIG = {
  label: "Unknown",
  bg: "#F7F5F2",
  text: "#7A746A",
  border: "#E5DED6",
};

export function CallDirectionIcon({
  direction,
  size = "md",
}: {
  direction: CallDirection;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const color = direction === "inbound" ? "text-[#4A7A8A]" : "text-[#7D8F7A]";
  const Icon = direction === "inbound" ? PhoneIncoming : PhoneOutgoing;
  return <Icon className={`${sizeClass} ${color}`} />;
}

export function CallDirectionBadge({
  direction,
}: {
  direction: CallDirection;
}) {
  const color = direction === "inbound" ? "text-[#4A7A8A]" : "text-[#7D8F7A]";
  const label = direction === "inbound" ? "Inbound" : "Outbound";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}
    >
      <CallDirectionIcon direction={direction} size="sm" />
      {label}
    </span>
  );
}

export function CallOutcomeBadge({ outcome }: { outcome: CallOutcome }) {
  const config = WARM_OUTCOME_CONFIG[outcome] || UNKNOWN_BADGE_CONFIG;
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{
        backgroundColor: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
      }}
    >
      {config.label}
    </span>
  );
}

export function CallDispositionBadge({
  disposition,
}: {
  disposition: CallDisposition;
}) {
  if (disposition === "none") return null;
  const config = WARM_DISPOSITION_CONFIG[disposition] || UNKNOWN_BADGE_CONFIG;
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{
        backgroundColor: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
      }}
    >
      {config.label}
    </span>
  );
}

export function CallDuration({
  seconds,
  className = "",
}: {
  seconds: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm ${className}`}
      style={{ color: "#7A746A" }}
    >
      <Timer className="w-3.5 h-3.5" />
      {formatCallDuration(seconds)}
    </span>
  );
}

export function CallAvatar({
  initials,
  direction,
}: {
  initials: string;
  direction: CallDirection;
}) {
  return (
    <div
      className="relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 text-[#FFFCF9]"
      style={{ background: "linear-gradient(135deg, #3A3834, #7D8F7A)" }}
    >
      {initials}
      <div
        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
        style={{ backgroundColor: "#FFFCF9", border: "1px solid #E5DED6" }}
      >
        <CallDirectionIcon direction={direction} size="sm" />
      </div>
    </div>
  );
}
