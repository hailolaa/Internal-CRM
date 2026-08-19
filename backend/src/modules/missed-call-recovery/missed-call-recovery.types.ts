export const MISSED_CALL_RECOVERY_EVENT_TYPE = "MISSED_CALL_RECOVERY_REQUIRED" as const;
export const MISSED_CALL_RECOVERY_EVENT_VERSION = 1 as const;
export const CLINICGROWER_SOURCE_SYSTEM = "clinicgrower" as const;
export const MISSED_CALL_RECOVERY_FALLBACK_QUEUE = "Missed Call Recovery queue" as const;

export type MissedCallState = "no_answer" | "busy" | "failed" | "canceled" | "voicemail";
export type MissedCallRecoveryState = "attempted" | "contacted" | "booked" | "closed_no_response";
export type MissedCallSlaStatus = "due" | "due_soon" | "overdue" | "completed_within_sla" | "completed_after_sla";
export type MissedCallEventProcessingStatus =
  | "accepted"
  | "duplicate"
  | "mapping_required"
  | "inactive_mapping"
  | "rejected"
  | "failed";

export interface ClinicGrowerMissedCallEventPayload {
  eventId: string;
  eventType: typeof MISSED_CALL_RECOVERY_EVENT_TYPE;
  eventVersion: number;
  sourceSystem: string;
  clinicId: string;
  tenantId?: string | null;
  callId: string;
  providerCallSid: string;
  direction?: string | null;
  missedCallState: string;
  callerNumber?: string | null;
  trackingNumber?: string | null;
  source?: string | null;
  occurredAt: string;
  recoverySlaTargetAt: string;
  idempotencyKey: string;
  recoveryEligible: boolean;
  recoveryState?: string | null;
  voicemailState?: string | null;
  contactIdentity?: {
    contactId?: string | null;
    leadId?: string | null;
    name?: string | null;
    patientName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
  acknowledgementStatus?: string | null;
  acknowledgementSmsId?: string | null;
  environment?: string | null;
  sourceEnvironment?: string | null;
  tenantType?: string | null;
}

export interface ClinicGrowerMissedCallIntakeResult {
  status: MissedCallEventProcessingStatus;
  retryable: boolean;
  message: string;
  eventId: string;
  recoveryId: string | null;
  taskId: string | null;
  contactId: string | null;
}

export interface MissedCallRecoveryRecord {
  id: string;
  clinicId: string;
  clientAccountProfileId: string;
  clientClinicId: string | null;
  clientName: string;
  contactId: string;
  contactName: string;
  contactPhone: string | null;
  taskId: string | null;
  ownerUserId: string | null;
  ownerLabel: string;
  state: MissedCallRecoveryState;
  slaStatus: MissedCallSlaStatus;
  occurredAt: string;
  recoverySlaTargetAt: string;
  attemptedAt: string | null;
  contactedAt: string | null;
  bookedAt: string | null;
  closedNoResponseAt: string | null;
  completedWithinSla: boolean | null;
  missedCallState: MissedCallState;
  voicemailState: string | null;
  source: string | null;
  trackingNumber: string | null;
  providerCallSid: string;
  clinicGrowerCallId: string;
  acknowledgementStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MissedCallRecoveryListSummary {
  total: number;
  attempted: number;
  contacted: number;
  booked: number;
  closedNoResponse: number;
  dueSoon: number;
  overdue: number;
  voicemail: number;
}

export interface MissedCallRecoveryListResponse {
  records: MissedCallRecoveryRecord[];
  summary: MissedCallRecoveryListSummary;
}

export interface ClinicGrowerClientMappingRecord {
  id: string;
  clinicId: string;
  clientAccountProfileId: string;
  clientClinicId: string | null;
  clientName: string;
  clinicGrowerClinicId: string;
  clinicGrowerClinicName: string | null;
  sourceSystem: string;
  defaultOwnerUserId: string | null;
  ownerName: string | null;
  fallbackQueueLabel: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicGrowerClientMappingPayload {
  clientAccountProfileId: string;
  clinicGrowerClinicId: string;
  clinicGrowerClinicName?: string | null;
  defaultOwnerUserId?: string | null;
  fallbackQueueLabel?: string | null;
  isActive?: boolean;
}
