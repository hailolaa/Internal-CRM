import type {
  MissedCallRecoveryRecord,
  MissedCallRecoveryState,
  MissedCallSlaStatus,
} from "@/lib/api-types";

export const missedCallRecoveryStateLabels: Record<MissedCallRecoveryState, string> = {
  attempted: "Attempted",
  contacted: "Contacted",
  booked: "Booked",
  closed_no_response: "Closed no response",
};

export const missedCallSlaStatusLabels: Record<MissedCallSlaStatus, string> = {
  due: "Due",
  due_soon: "Due soon",
  overdue: "Overdue",
  completed_within_sla: "Completed within SLA",
  completed_after_sla: "Completed after SLA",
};

export const missedCallRecoveryTransitions: Record<MissedCallRecoveryState, MissedCallRecoveryState[]> = {
  attempted: ["contacted", "booked", "closed_no_response"],
  contacted: ["booked", "closed_no_response"],
  booked: [],
  closed_no_response: [],
};

export function isMissedCallRecoveryTerminal(state: MissedCallRecoveryState) {
  return state === "booked" || state === "closed_no_response";
}

export function groupMissedCallRecoveries(records: MissedCallRecoveryRecord[]) {
  return {
    pending: records.filter((record) => record.state === "attempted" && record.slaStatus !== "overdue"),
    dueSoon: records.filter((record) => record.state === "attempted" && record.slaStatus === "due_soon"),
    overdue: records.filter((record) => !isMissedCallRecoveryTerminal(record.state) && record.slaStatus === "overdue"),
    contacted: records.filter((record) => record.state === "contacted"),
    booked: records.filter((record) => record.state === "booked"),
    closedNoResponse: records.filter((record) => record.state === "closed_no_response"),
    voicemail: records.filter((record) => record.missedCallState === "voicemail" || Boolean(record.voicemailState)),
  };
}

export function formatMissedCallTimestamp(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
