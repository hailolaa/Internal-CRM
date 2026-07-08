export type CallCommercialOutcome =
  | "booked_consult"
  | "asked_for_prices"
  | "not_suitable"
  | "missed_no_answer"
  | "follow_up_required"
  | "existing_patient"
  | "spam"
  | "lost";

export type CallSentiment = "positive" | "neutral" | "negative" | "unknown";
export type CallBookingIntent = "none" | "low" | "medium" | "high" | "booked";

export interface MessageTemplateRecord {
  id: string;
  name: string;
  channel: "email" | "sms" | "whatsapp";
  subject: string | null;
  body: string;
  status: "draft" | "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface MessageTemplateTestSendPayload {
  recipient: string;
  channel?: "email" | "sms" | "whatsapp";
  variables?: Record<string, string>;
}

export interface MessageTemplateTestSendResult {
  templateId: string;
  channel: "email" | "sms" | "whatsapp";
  recipient: string;
  deliveryStatus: "sent" | "queued" | "failed";
  messageId: string | null;
  subject: string | null;
  missingVariables: string[];
  renderedBody: string;
}

export interface SequenceRecord {
  id: string;
  name: string;
  triggerLabel: string;
  steps: unknown[];
  status: "active" | "paused" | "draft" | "archived";
  enrolledCount: number;
  completedCount: number;
  activeEnrollmentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceEnrollmentRecord {
  id: string;
  sequenceId: string;
  contactId: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  status: "active" | "completed" | "unenrolled" | "failed";
  currentStepIndex: number;
  nextStepAt: string | null;
  sendOnWeekends: boolean;
  timezone: string;
  lastError: string | null;
  unenrolledAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface InboxConversationRecord {
  id: string;
  contactId?: string;
  contact: string;
  channel: string;
  preview: string;
  time: string;
  unread: boolean;
  starred: boolean;
  archived?: boolean;
  attachmentsSupported?: boolean;
  avatar: string;
}

export interface InboxThreadMessageRecord {
  id: string;
  channel: string;
  direction: string | null;
  status: string | null;
  subject?: string | null;
  body: string;
  timestamp: string;
  sender: string;
  senderId: string | null;
  isInternal: boolean;
}

export interface InboxThreadRecord {
  contact: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    status: string | null;
    source: string | null;
    createdAt: string;
    updatedAt: string;
  };
  messages: InboxThreadMessageRecord[];
  internalNotes: InboxThreadMessageRecord[];
  counts: {
    messages: number;
    internalNotes: number;
  };
}

export interface CallLogRecord {
  id: string;
  contactId: string;
  contactName: string;
  contactAvatar: string;
  phone: string;
  direction: "inbound" | "outbound";
  callStatus?: string | null;
  missedCall?: boolean;
  outcome: "connected" | "no_answer" | "voicemail" | "busy" | "cancelled";
  commercialOutcome: CallCommercialOutcome | null;
  disposition:
    | "booked"
    | "callback_requested"
    | "not_interested"
    | "wrong_number"
    | "info_given"
    | "follow_up_needed"
    | "none";
  duration: number;
  notes: string;
  transcript: string;
  aiSummary: string;
  sentiment: CallSentiment;
  bookingIntent: CallBookingIntent;
  treatmentMentioned: string;
  qualityScore: number | null;
  summaryGeneratedAt: string | null;
  assignedTo: string;
  recordingUrl: string | null;
  recordingDuration?: number | null;
  recordingStatus?: string | null;
  recordingSource?: string | null;
  consentCaptured: boolean;
  consentMethod: "verbal" | "recorded_prompt" | "written" | "implied" | "unknown" | null;
  consentTimestamp: string | null;
  retentionDeadline: string | null;
  recordingDeletionRequest: RecordingDeletionRequestRecord | null;
  treatment: string;
  source: string;
  createdAt: string;
  timestamp: string;
}

export interface RecordingDeletionRequestRecord {
  id: string;
  callId: string;
  status: "requested" | "approved" | "completed" | "rejected" | "cancelled";
  reason: string | null;
  requestedAt: string;
  resolvedAt?: string | null;
}

export interface CallListParams {
  missedOnly?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface CallCreatePayload {
  contactId: string;
  direction?: "inbound" | "outbound";
  duration?: number | null;
  commercialOutcome?: CallCommercialOutcome | null;
  notes?: string | null;
  source?: string | null;
  treatmentMentioned?: string | null;
  createdAt?: string | null;
}

export interface CallUpdatePayload {
  assignedUserId?: string | null;
  aiSummary?: string | null;
  bookingIntent?: CallBookingIntent | null;
  commercialOutcome?: CallCommercialOutcome | null;
  contactId?: string | null;
  missedRecoveryStatus?: string | null;
  notes?: string | null;
  qualityScore?: number | null;
  sentiment?: CallSentiment | null;
  source?: string | null;
  transcript?: string | null;
  treatmentMentioned?: string | null;
  consentCaptured?: boolean | null;
  consentMethod?: CallLogRecord["consentMethod"];
  consentTimestamp?: string | null;
  retentionDeadline?: string | null;
}

export interface CallSummaryRecord {
  totalCalls: number;
  inboundCalls: number;
  missedCalls: number;
  connectedCalls: number;
  bookedConsults: number;
  callToBookingRate: number;
}

export interface StaffCallMetricRecord {
  userId: string | null;
  userName: string;
  totalCalls: number;
  connectedCalls: number;
  bookedConsults: number;
  missedCalls: number;
  averageDurationSeconds?: number | null;
  scoredCalls?: number;
  averageQualityScore?: number | null;
  coachingFlags?: number;
  bookingRate: number;
}

export interface CallAiBreakdownRecord {
  categoryType: "sentiment" | "booking_intent" | "treatment" | "outcome";
  categoryKey: string;
  label: string;
  calls: number;
  scoredCalls: number;
  averageQualityScore: number | null;
  coachingFlags: number;
}
