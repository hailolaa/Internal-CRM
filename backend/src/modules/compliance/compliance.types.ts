export interface ComplianceDocumentResponse {
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

export interface ComplianceSettingsResponse {
  retentionPeriod: string;
  toggles: Record<string, boolean>;
}

export interface CreateComplianceDocumentDTO {
  title: string;
  status?: "complete" | "action_required" | "expiring_soon";
  category?: "gdpr" | "clinical" | "training" | "insurance" | "regulatory";
  dueDate?: string | null;
}

export type UpdateComplianceDocumentDTO = Partial<CreateComplianceDocumentDTO>;

export interface UpdateComplianceSettingsDTO {
  retentionPeriod?: string;
  toggles?: Record<string, boolean>;
}

export interface ComplianceDocumentFileDTO {
  fileName: string;
  mimeType: string;
  sizeBytes?: number | null;
  dataUrl: string;
}

export interface ComplianceDocumentFileResponse {
  documentId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  updatedAt: string;
}

export type DataAccessRequestType = "access" | "erasure" | "rectification" | "portability" | "restriction";
export type DataAccessRequestStatus = "received" | "verifying_identity" | "in_progress" | "completed" | "rejected" | "cancelled";

export interface CreateDataAccessRequestDTO {
  requesterName: string;
  requesterEmail?: string | null;
  requesterPhone?: string | null;
  requestType: DataAccessRequestType;
  dueDate?: string | null;
  notes?: string | null;
}

export interface UpdateDataAccessRequestDTO {
  status?: DataAccessRequestStatus;
  dueDate?: string | null;
  notes?: string | null;
}
