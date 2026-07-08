export type DepositStatus = "requested" | "paid" | "failed" | "refunded" | "waived" | "unpaid";

export interface CreateDepositDTO {
  contact: string;
  contactId?: string | null;
  appointmentId?: string | null;
  consultId?: string | null;
  treatmentId?: string | null;
  practitionerId?: string | null;
  treatment: string;
  appointmentDate?: string;
  depositAmount?: number;
  depositPaid?: boolean;
  paidDate?: string;
  method?: string;
  showedUp?: boolean | null;
  practitioner?: string;
  status?: DepositStatus;
}

export interface CreateDepositPaymentSessionDTO {
  contactId?: string | null;
  contactName?: string | null;
  appointmentId?: string | null;
  consultId?: string | null;
  treatmentId?: string | null;
  practitionerId?: string | null;
  treatment: string;
  depositAmount: number;
  successUrl?: string;
  cancelUrl?: string;
}

export interface DepositPaymentSessionResponse {
  depositId: string;
  sessionId: string;
  url: string | null;
  status: DepositStatus;
}

export interface UpdateDepositDTO extends Partial<CreateDepositDTO> {
  reminderSent?: boolean;
  depositRequested?: boolean;
}

export interface DepositStripeEventPayload {
  eventType: string;
  depositId: string;
  status: DepositStatus;
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripePaymentLinkId?: string | null;
  providerResponse?: Record<string, unknown> | null;
  providerError?: string | null;
}

