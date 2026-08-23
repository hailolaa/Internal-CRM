export type CommercialContractStatus = "draft" | "sent" | "active" | "notice_given" | "renewal_pending" | "renewed" | "ended" | "cancelled";
export type CommercialContractChangeType = "initial" | "change_order" | "renewal";
export type CommercialContractAlertType = "notice_due" | "renewal_due" | "state_blocked";

export interface CommercialContract {
  id: string;
  clinicId: string;
  clientAccountProfileId: string | null;
  contractKey: string;
  status: CommercialContractStatus;
  currentVersion: number;
  startDate: string | null;
  endDate: string | null;
  renewalDate: string | null;
  noticePeriodDays: number;
  terms: Record<string, unknown>;
}

export interface CommercialContractVersion {
  id: string;
  clinicId: string;
  contractId: string;
  version: number;
  changeType: CommercialContractChangeType;
  status: "draft" | "approved" | "superseded";
  effectiveDate: string | null;
  summary: string;
  terms: Record<string, unknown>;
}

export interface CommercialContractAlert {
  id: string;
  clinicId: string;
  contractId: string;
  alertType: CommercialContractAlertType;
  status: "open" | "resolved";
  dueDate: string | null;
  message: string;
}
