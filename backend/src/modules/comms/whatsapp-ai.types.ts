export interface WhatsAppAiSettingsDTO {
  autoSendEnabled?: boolean;
  businessHoursEnabled?: boolean;
  businessHoursStart?: string;
  businessHoursEnd?: string;
  timezone?: string;
  approvedTone?: string;
  guardrails?: string[];
  confidenceThreshold?: number;
  humanHandoffUserId?: string | null;
  maxAutoSendRetries?: number;
}

export interface WhatsAppInboundDTO {
  clinicId?: string;
  providerMessageId?: string | null;
  from: string;
  body: string;
  receivedAt?: string | null;
  contactId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  accountName?: string | null;
  createLeadIfMissing?: boolean;
}

export interface WhatsAppDraftDTO {
  inboundMessageId: string;
}

export interface WhatsAppApproveDTO {
  body?: string | null;
  sendNow?: boolean;
}

export interface WhatsAppRetryDTO {
  body?: string | null;
}

export interface WhatsAppManualSendDTO {
  body: string;
  idempotencyKey?: string | null;
}

export type WhatsAppAiReplyStatus =
  | "drafted"
  | "needs_approval"
  | "auto_sent"
  | "sent"
  | "human_required"
  | "failed"
  | "discarded";
