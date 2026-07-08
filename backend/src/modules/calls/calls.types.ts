export interface TwilioCallWebhookPayload {
  AccountSid: string | undefined;
  AnsweredBy: string | undefined;
  CallDuration: string | undefined;
  CallSid: string | undefined;
  CallStatus: string | undefined;
  Direction: string | undefined;
  Duration: string | undefined;
  EndTime: string | undefined;
  From: string | undefined;
  StartTime: string | undefined;
  To: string | undefined;
}

export interface TwilioRecordingWebhookPayload {
  AccountSid: string | undefined;
  CallSid: string | undefined;
  RecordingDuration: string | undefined;
  RecordingSid: string | undefined;
  RecordingStatus: string | undefined;
  RecordingUrl: string | undefined;
}

export interface TwilioWebhookResult {
  callId: string | null;
  clinicId: string | null;
  created: boolean;
  matched: boolean;
}

export type CallConsentMethod = "verbal" | "recorded_prompt" | "written" | "implied" | "unknown";
export type RecordingDeletionRequestStatus = "requested" | "approved" | "completed" | "rejected" | "cancelled";

export type CallCommercialOutcome =
  | "booked_consult"
  | "asked_for_prices"
  | "not_suitable"
  | "missed_no_answer"
  | "follow_up_required"
  | "existing_patient"
  | "spam"
  | "lost";

export type CallBookingIntent = "none" | "low" | "medium" | "high" | "booked";
export type CallSentiment = "positive" | "neutral" | "negative" | "unknown";

export interface CreateCallDTO {
  contactId: string;
  direction?: "inbound" | "outbound";
  duration?: number | null;
  commercialOutcome?: CallCommercialOutcome | null;
  notes?: string | null;
  source?: string | null;
  treatmentMentioned?: string | null;
  createdAt?: string | null;
}

export interface UpdateCallDTO {
  assignedUserId?: string | null;
  aiSummary?: string | null;
  bookingIntent?: CallBookingIntent | null;
  commercialOutcome?: CallCommercialOutcome | null;
  contactId?: string | null;
  consentCaptured?: boolean | null;
  consentMethod?: CallConsentMethod | null;
  consentTimestamp?: string | null;
  missedRecoveryStatus?: string | null;
  notes?: string | null;
  qualityScore?: number | null;
  retentionDeadline?: string | null;
  sentiment?: CallSentiment | null;
  source?: string | null;
  transcript?: string | null;
  treatmentMentioned?: string | null;
}

export interface CreateRecordingDeletionRequestDTO {
  reason?: string | null;
}

export interface UpdateRecordingDeletionRequestDTO {
  reason?: string | null;
  status: RecordingDeletionRequestStatus;
}
