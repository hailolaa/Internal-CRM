// ============================================================
// Call Tracking mock data — Module 7
// No Twilio integration — manual logging + recording playback
// ============================================================

export type CallDirection = "inbound" | "outbound";
export type CallOutcome =
  | "connected"
  | "no_answer"
  | "voicemail"
  | "busy"
  | "cancelled";
export type CallDisposition =
  | "booked"
  | "callback_requested"
  | "not_interested"
  | "wrong_number"
  | "info_given"
  | "follow_up_needed"
  | "none";

export interface CallRecord {
  id: string;
  contactId: string;
  contactName: string;
  contactAvatar: string;
  phone: string;
  direction: CallDirection;
  missedCall?: boolean;
  outcome: CallOutcome;
  commercialOutcome?: string | null;
  disposition: CallDisposition;
  duration: number; // seconds
  notes: string;
  transcript?: string;
  aiSummary?: string;
  sentiment?: string;
  bookingIntent?: string;
  qualityScore?: number | null;
  summaryGeneratedAt?: string | null;
  assignedTo: string;
  recordingUrl: string | null;
  treatment: string;
  source: string;
  createdAt: string; // relative time label
  timestamp: string; // ISO-ish for sorting
}

export const CALL_RECORDS: CallRecord[] = [
  {
    id: "c1",
    contactId: "1",
    contactName: "Sarah Johnson",
    contactAvatar: "SJ",
    phone: "07700 900123",
    direction: "outbound",
    outcome: "connected",
    disposition: "booked",
    duration: 247,
    notes:
      "Booked Botox consultation for Thursday 2pm. Very keen, first-time patient.",
    assignedTo: "Dr. Sarah Smith",
    recordingUrl: "#",
    treatment: "Botox",
    source: "Google Ads",
    createdAt: "12 mins ago",
    timestamp: "2026-02-24T09:12:00",
  },
  {
    id: "c2",
    contactId: "2",
    contactName: "Emma Wilson",
    contactAvatar: "EW",
    phone: "07700 900456",
    direction: "inbound",
    outcome: "connected",
    disposition: "info_given",
    duration: 183,
    notes:
      "Asked about lip filler pricing and availability. Sent follow-up email with treatment guide.",
    assignedTo: "Emma Johnson",
    recordingUrl: "#",
    treatment: "Lip Filler",
    source: "Instagram",
    createdAt: "1 hour ago",
    timestamp: "2026-02-24T08:15:00",
  },
  {
    id: "c3",
    contactId: "3",
    contactName: "Sophie Brown",
    contactAvatar: "SB",
    phone: "07700 900789",
    direction: "outbound",
    outcome: "voicemail",
    disposition: "callback_requested",
    duration: 0,
    notes:
      "Left voicemail — rebooking reminder for skin treatment. Requested callback.",
    assignedTo: "Sophie Brown",
    recordingUrl: null,
    treatment: "Skin Treatment",
    source: "Referral",
    createdAt: "2 hours ago",
    timestamp: "2026-02-24T07:30:00",
  },
  {
    id: "c4",
    contactId: "4",
    contactName: "Charlotte Davis",
    contactAvatar: "CD",
    phone: "07700 900012",
    direction: "inbound",
    outcome: "connected",
    disposition: "follow_up_needed",
    duration: 312,
    notes:
      "Interested in dermal filler but wants to discuss with partner first. Follow up Friday.",
    assignedTo: "Dr. Sarah Smith",
    recordingUrl: "#",
    treatment: "Dermal Filler",
    source: "Google Ads",
    createdAt: "3 hours ago",
    timestamp: "2026-02-24T06:45:00",
  },
  {
    id: "c5",
    contactId: "5",
    contactName: "Olivia Taylor",
    contactAvatar: "OT",
    phone: "07700 900345",
    direction: "outbound",
    outcome: "no_answer",
    disposition: "none",
    duration: 0,
    notes: "No answer — third attempt. Will try SMS next.",
    assignedTo: "Emma Johnson",
    recordingUrl: null,
    treatment: "Consultation",
    source: "Website",
    createdAt: "4 hours ago",
    timestamp: "2026-02-24T05:30:00",
  },
  {
    id: "c6",
    contactId: "6",
    contactName: "Amelia Roberts",
    contactAvatar: "AR",
    phone: "07700 900678",
    direction: "inbound",
    outcome: "connected",
    disposition: "booked",
    duration: 198,
    notes:
      "Booked consultation for Monday 10am. Referred by Sophie Brown — VIP treatment.",
    assignedTo: "Dr. Sarah Smith",
    recordingUrl: "#",
    treatment: "Botox",
    source: "Referral",
    createdAt: "Yesterday",
    timestamp: "2026-02-23T16:00:00",
  },
  {
    id: "c7",
    contactId: "7",
    contactName: "Mia Roberts",
    contactAvatar: "MR",
    phone: "07700 900901",
    direction: "outbound",
    outcome: "connected",
    disposition: "not_interested",
    duration: 67,
    notes: "No longer interested — found another clinic. Polite decline.",
    assignedTo: "Sophie Brown",
    recordingUrl: "#",
    treatment: "Lip Filler",
    source: "Meta Ads",
    createdAt: "Yesterday",
    timestamp: "2026-02-23T14:30:00",
  },
  {
    id: "c8",
    contactId: "8",
    contactName: "Grace Lee",
    contactAvatar: "GL",
    phone: "07700 900111",
    direction: "outbound",
    outcome: "busy",
    disposition: "none",
    duration: 0,
    notes: "Line busy. Will retry in 30 minutes.",
    assignedTo: "Emma Johnson",
    recordingUrl: null,
    treatment: "Anti-wrinkle",
    source: "Instagram",
    createdAt: "Yesterday",
    timestamp: "2026-02-23T11:15:00",
  },
];

// ============================================================
// Derived stats helper
// ============================================================
export function getCallStats(calls: CallRecord[]) {
  const total = calls.length;
  const connected = calls.filter((c) => c.outcome === "connected").length;
  const booked = calls.filter((c) => c.disposition === "booked").length;
  const totalDuration = calls.reduce((acc, c) => acc + c.duration, 0);
  const avgDuration = connected > 0 ? Math.round(totalDuration / connected) : 0;
  const inbound = calls.filter((c) => c.direction === "inbound").length;
  const outbound = calls.filter((c) => c.direction === "outbound").length;
  const connectRate = total > 0 ? Math.round((connected / total) * 100) : 0;
  const bookingRate =
    connected > 0 ? Math.round((booked / connected) * 100) : 0;

  return {
    total,
    connected,
    booked,
    totalDuration,
    avgDuration,
    inbound,
    outbound,
    connectRate,
    bookingRate,
  };
}

// ============================================================
// Display helpers
// ============================================================
export function formatCallDuration(seconds: number): string {
  if (seconds === 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export const OUTCOME_CONFIG: Record<
  CallOutcome,
  { label: string; color: string }
> = {
  connected: { label: "Connected", color: "bg-green-500/10 text-green-400" },
  no_answer: { label: "No Answer", color: "bg-amber-500/10 text-amber-400" },
  voicemail: { label: "Voicemail", color: "bg-blue-500/10 text-blue-400" },
  busy: { label: "Busy", color: "bg-gray-500/10 text-gray-400" },
  cancelled: { label: "Cancelled", color: "bg-red-500/10 text-red-400" },
};

export const DISPOSITION_CONFIG: Record<
  CallDisposition,
  { label: string; color: string }
> = {
  booked: { label: "Booked", color: "bg-teal-500/10 text-teal-400" },
  callback_requested: {
    label: "Callback",
    color: "bg-violet-500/10 text-violet-400",
  },
  not_interested: {
    label: "Not Interested",
    color: "bg-red-500/10 text-red-400",
  },
  wrong_number: {
    label: "Wrong Number",
    color: "bg-gray-500/10 text-gray-400",
  },
  info_given: { label: "Info Given", color: "bg-blue-500/10 text-blue-400" },
  follow_up_needed: {
    label: "Follow Up",
    color: "bg-amber-500/10 text-amber-400",
  },
  none: { label: "—", color: "bg-gray-500/10 text-gray-500" },
};

export const DIRECTION_CONFIG: Record<
  CallDirection,
  { label: string; color: string }
> = {
  inbound: { label: "Inbound", color: "text-cyan-400" },
  outbound: { label: "Outbound", color: "text-violet-400" },
};
