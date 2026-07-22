import type { pipelineDealStatuses, pipelineStageKinds } from "./pipeline.constants.js";
import type { AuditWorkflowStatus } from "../audit-workflow/audit-workflow.constants.js";

export type PipelineStageKind = typeof pipelineStageKinds[number];
export type PipelineDealStatus = typeof pipelineDealStatuses[number];

export interface PipelineStageResponse {
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

export interface CreatePipelineStageDTO {
  name: string;
  color?: string;
  position?: number;
  kind?: PipelineStageKind;
}

export type UpdatePipelineStageDTO = Partial<CreatePipelineStageDTO> & {
  isLocked?: boolean;
};

export interface PipelineDealResponse {
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

export interface PipelineDealListResponse {
  deals: PipelineDealResponse[];
  summary: {
    averageDealValueCents: number;
    dealsCount: number;
    totalValueCents: number;
  };
}

export interface CreatePipelineDealDTO {
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

export interface UpdatePipelineDealDTO extends Partial<Omit<CreatePipelineDealDTO, "contactId" | "stageId">> {
  status?: PipelineDealStatus;
}

export interface MovePipelineDealDTO {
  stageId: string;
  valueCents?: number | null;
  bookedAt?: string | null;
  soldAt?: string | null;
  lostAt?: string | null;
  lostReason?: string | null;
  objectionType?: string | null;
  notes?: string | null;
}
