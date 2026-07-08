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
}

export interface DepositPaymentSessionResponse {
  depositId: string;
  sessionId: string;
  url: string | null;
  status: "requested" | "paid" | "failed" | "unpaid" | "waived" | "refunded";
}
