export type DepositDeliveryChannel = "email" | "sms" | null;

export interface DepositDeliveryResult {
  attempted: boolean;
  channel: DepositDeliveryChannel;
  status: "accepted" | "pending" | "unavailable" | "failed";
  provider: "brevo" | "twilio" | null;
  providerStatus: string | null;
  messageId: string | null;
  providerMessageId: string | null;
  acceptedAt: string | null;
  reason: string | null;
  fallback: "copy_link" | null;
}

export interface DepositDeliveryCapability {
  email: {
    available: boolean;
    provider: "brevo" | null;
    reason: string | null;
  };
  sms: {
    available: boolean;
    provider: "twilio" | null;
    reason: string | null;
  };
  preferredChannel: DepositDeliveryChannel;
}

export interface DepositRecordResponse {
  id: string;
  contact: string;
  treatment: string;
  appointmentDate: string | null;
  depositAmount: number;
  depositPaid: boolean;
  paidDate: string | null;
  method: string | null;
  showedUp: boolean | null;
  practitioner: string | null;
  status: "requested" | "paid" | "failed" | "unpaid" | "waived" | "refunded";
  reminderSent: boolean;
  depositRequested: boolean;
  requestDelivery?: DepositDeliveryResult | null;
  reminderDelivery?: DepositDeliveryResult | null;
  deliveryCapability?: DepositDeliveryCapability;
}

export interface DepositPaymentSessionResponse {
  depositId: string;
  sessionId: string;
  url: string | null;
  status: "requested" | "paid" | "failed" | "unpaid" | "waived" | "refunded";
  delivery?: DepositDeliveryResult;
}
