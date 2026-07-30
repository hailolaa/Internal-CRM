export type ProposalSignatureStatus =
  | "requested"
  | "sent"
  | "viewed"
  | "signed"
  | "declined"
  | "expired"
  | "cancelled"
  | "failed";

export interface ProposalSignatureRequestRecord {
  id: string;
  proposalId: string;
  provider: string;
  providerRequestId: string | null;
  status: ProposalSignatureStatus;
  signerName: string | null;
  signerEmail: string | null;
  signatureUrl: string | null;
  idempotencyKey: string;
  requestedAt: string;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  expiredAt: string | null;
  failureReason: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  evidence: ProposalSignatureEvidenceRecord | null;
}

export interface ProposalSignatureEvidenceRecord {
  id: string;
  proposalId: string;
  signatureRequestId: string;
  provider: string;
  providerRequestId: string | null;
  signerName: string;
  signerEmail: string;
  signedAt: string;
  signedPdfUrl: string | null;
  auditCertificateUrl: string | null;
  evidenceSha256: string;
  evidenceJson: Record<string, unknown>;
  createdAt: string;
}

export interface ProposalSignatureCreateDTO {
  signerName?: string | null;
  signerEmail?: string | null;
  idempotencyKey?: string | null;
}

export interface ProposalSignatureWebhookDTO {
  providerRequestId?: string | null;
  providerEventId?: string | null;
  eventType?: string | null;
  status?: string | null;
  signerName?: string | null;
  signerEmail?: string | null;
  signedAt?: string | null;
  signedPdfUrl?: string | null;
  auditCertificateUrl?: string | null;
  evidenceSha256?: string | null;
  evidence?: Record<string, unknown> | null;
}
