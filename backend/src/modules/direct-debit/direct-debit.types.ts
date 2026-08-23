export type DirectDebitProvider = "gocardless" | "stripe" | "manual";
export type DirectDebitMandateStatus =
  | "setup_required"
  | "pending_customer_authorisation"
  | "submitted"
  | "active"
  | "failed"
  | "cancelled"
  | "expired";
export type DirectDebitAlertType = "mandate_failed" | "payment_failed" | "reconciliation_mismatch";

export interface DirectDebitMandate {
  id: string;
  clinicId: string;
  clientAccountProfileId: string | null;
  provider: DirectDebitProvider;
  providerCustomerId: string | null;
  providerMandateId: string | null;
  status: DirectDebitMandateStatus;
  setupReference: string;
  setupUrl: string | null;
  failureReason: string | null;
}

export interface DirectDebitAlert {
  id: string;
  clinicId: string;
  mandateId: string;
  alertType: DirectDebitAlertType;
  status: "open" | "resolved";
  message: string;
}

export interface DirectDebitReconciliationResult {
  id: string;
  clinicId: string;
  provider: DirectDebitProvider;
  checkedCount: number;
  mismatchCount: number;
  result: "passed" | "mismatch" | "failed";
}
