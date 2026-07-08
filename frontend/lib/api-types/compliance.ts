export interface ComplianceDocumentRecord {
  id: string;
  title: string;
  status: "complete" | "action_required" | "expiring_soon";
  lastUpdated: string;
  dueDate: string | null;
  category: "gdpr" | "clinical" | "training" | "insurance" | "regulatory";
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  hasFile: boolean;
}

export interface ComplianceSettingsRecord {
  retentionPeriod: string;
  toggles: Record<string, boolean>;
}

export interface ComplianceDocumentFileRecord {
  documentId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  updatedAt: string;
}

export type DataAccessRequestType =
  | "access"
  | "erasure"
  | "rectification"
  | "portability"
  | "restriction";

export type DataAccessRequestStatus =
  | "received"
  | "verifying_identity"
  | "in_progress"
  | "completed"
  | "rejected"
  | "cancelled";

export interface DataAccessRequestRecord {
  id: string;
  requesterName: string;
  requesterEmail: string | null;
  requesterPhone: string | null;
  requestType: DataAccessRequestType;
  status: DataAccessRequestStatus;
  dueDate: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
