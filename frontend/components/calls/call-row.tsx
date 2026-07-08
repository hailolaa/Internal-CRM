"use client";

import { Clock, Headphones } from "lucide-react";
import type { CallRecord } from "@/lib/call-data";
import { formatCallDuration } from "@/lib/call-data";
import {
  CallOutcomeBadge,
  CallDispositionBadge,
  CallDirectionIcon,
} from "./call-badges";

export function CallRow({
  call,
  isSelected,
  onClick,
  onPlayRecording,
}: {
  call: CallRecord;
  isSelected: boolean;
  onClick: () => void;
  onPlayRecording?: (call: CallRecord) => void;
}) {
  return (
    <tr
      onClick={onClick}
      className="transition-colors cursor-pointer"
      style={{
        borderBottom: "1px solid #EDE8E2",
        backgroundColor: isSelected
          ? "rgba(125, 143, 122, 0.06)"
          : "transparent",
      }}
      onMouseOver={(e) => {
        if (!isSelected)
          (e.currentTarget as HTMLElement).style.backgroundColor = "#F7F5F2";
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = isSelected
          ? "rgba(125, 143, 122, 0.06)"
          : "transparent";
      }}
    >
      {/* Contact */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 text-[#FFFCF9]"
            style={{ background: "linear-gradient(135deg, #3A3834, #7D8F7A)" }}
          >
            {call.contactAvatar}
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: "#FFFCF9",
                border: "1px solid #E5DED6",
              }}
            >
              <CallDirectionIcon direction={call.direction} size="sm" />
            </div>
          </div>
          <div className="min-w-0">
            <p
              className="font-medium text-sm truncate"
              style={{ color: "#252421" }}
            >
              {call.contactName}
            </p>
            <p className="text-xs" style={{ color: "#A8A39B" }}>
              {call.phone}
            </p>
          </div>
        </div>
      </td>

      {/* Direction */}
      <td className="px-5 py-4 hidden md:table-cell">
        <span
          className={`text-xs font-medium ${call.direction === "inbound" ? "text-[#4A7A8A]" : "text-[#7D8F7A]"}`}
        >
          {call.direction === "inbound" ? "Inbound" : "Outbound"}
        </span>
      </td>

      {/* Outcome */}
      <td className="px-5 py-4">
        <CallOutcomeBadge outcome={call.outcome} />
      </td>

      {/* Disposition */}
      <td className="px-5 py-4 hidden lg:table-cell">
        <CallDispositionBadge disposition={call.disposition} />
      </td>

      {/* Duration */}
      <td className="px-5 py-4 hidden md:table-cell">
        <span
          className="text-sm flex items-center gap-1"
          style={{ color: "#7A746A" }}
        >
          <Clock className="w-3 h-3" />
          {formatCallDuration(call.duration)}
        </span>
      </td>

      {/* Treatment */}
      <td className="px-5 py-4 hidden lg:table-cell">
        <span className="text-sm" style={{ color: "#7A746A" }}>
          {call.treatment}
        </span>
      </td>

      {/* Assigned */}
      <td className="px-5 py-4 hidden xl:table-cell">
        <span className="text-sm" style={{ color: "#7A746A" }}>
          {call.assignedTo}
        </span>
      </td>

      {/* Recording */}
      <td className="px-5 py-4 hidden md:table-cell">
        {call.recordingUrl ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlayRecording?.(call);
            }}
            className="p-1.5 rounded-lg transition-colors"
            style={{
              backgroundColor: "rgba(90, 138, 106, 0.08)",
              border: "1px solid rgba(90, 138, 106, 0.2)",
            }}
            title="Play recording"
          >
            <Headphones className="w-3.5 h-3.5 text-[#5A8A6A]" />
          </button>
        ) : (
          <span className="text-xs" style={{ color: "#DAD2C8" }}>
            —
          </span>
        )}
      </td>

      {/* Time */}
      <td className="px-5 py-4">
        <span className="text-xs" style={{ color: "#A8A39B" }}>
          {call.createdAt}
        </span>
      </td>
    </tr>
  );
}
