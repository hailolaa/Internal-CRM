import type { AuditWorkflowStatus } from "../crm";

export type PipelineStageKind = "open" | "won" | "lost";
export type PipelineDealStatus = "open" | "won" | "lost";

export interface PipelineStageRecord {
  id: string;
  pipelineId: string;
  name: string;
  color: string;
  position: number;
  kind: PipelineStageKind;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStagePayload {
  name: string;
  color?: string;
  position?: number;
  kind?: PipelineStageKind;
}

export interface PipelineDealRecord {
  id: string;
  pipelineId: string;
  stageId: string | null;
  stageName: string | null;
  stageKind: PipelineStageKind;
  title: string;
  valueCents: number;
  probability: number;
  expectedCloseDate: string | null;
  ownerId: string | null;
  ownerName: string | null;
  nextFollowUpDate: string | null;
  priority: "low" | "medium" | "high" | null;
  contactId: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAvatar: string;
  source: string | null;
  treatment: string | null;
  status: PipelineDealStatus;
  daysInStage: number;
  stageChangedAt: string | null;
  bookedAt: string | null;
  soldAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  objectionType: string | null;
  auditStatus: AuditWorkflowStatus | null;
  auditAssignedTo: string | null;
  auditFollowUpDueAt: string | null;
  auditStatusUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineDealListResult {
  deals: PipelineDealRecord[];
  summary: {
    averageDealValueCents: number;
    dealsCount: number;
    totalValueCents: number;
  };
}

export interface PipelineDealPayload {
  contactId: string;
  stageId?: string | null;
  title?: string | null;
  valueCents?: number | null;
  source?: string | null;
  treatment?: string | null;
  probability?: number | null;
  expectedCloseDate?: string | null;
  ownerId?: string | null;
  auditStatus?: AuditWorkflowStatus | null;
  auditAssignedTo?: string | null;
  auditFollowUpDueAt?: string | null;
  auditStatusUpdatedAt?: string | null;
}

export type PipelineDealUpdatePayload = Partial<
  Omit<PipelineDealPayload, "contactId" | "stageId">
> & {
  status?: PipelineDealStatus;
};

export interface PipelineDealMovePayload {
  stageId: string;
  valueCents?: number | null;
  bookedAt?: string | null;
  soldAt?: string | null;
  lostAt?: string | null;
  lostReason?: string | null;
  objectionType?: string | null;
  notes?: string | null;
}
