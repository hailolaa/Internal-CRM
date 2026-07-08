export interface TaskResponse {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  status: "pending" | "completed";
  category: string | null;
  contactId?: string | null;
  contact: string | null;
  due: string | null;
  dueDate: string | null;
  assignedTo: string | null;
  isInternal?: boolean;
  boardKey?: string | null;
  serviceType?: InternalTaskServiceType | null;
  clientAccountProfileId?: string | null;
  clientAccountServiceId?: string | null;
  assignedUserId?: string | null;
  proofReference?: string | null;
  workflowMonth?: string | null;
  templateKey?: string | null;
  recurrenceRule?: Record<string, unknown> | null;
  completedAt?: string | null;
  archivedAt?: string | null;
  isOverdue?: boolean;
  needsQa?: boolean;
  qaChecklist?: Record<string, unknown> | null;
  approvalStatus?: InternalTaskApprovalStatus;
  reviewerUserId?: string | null;
  completionProofReference?: string | null;
  missedTask?: boolean;
  escalationFlag?: boolean;
  freelancerTeamScore?: number | null;
  qaUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InternalTaskServiceType = "ppc" | "seo" | "gbp" | "website" | "landing_pages" | "cro" | "strategy" | "other";
export type InternalTaskBoardKey = InternalTaskServiceType | "delivery" | "operations";
export type InternalTaskApprovalStatus = "not_required" | "pending" | "approved" | "rejected" | "needs_changes";

export interface CreateTaskDTO {
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  status?: "pending" | "completed";
  category?: string;
  contactId?: string | null;
  contact?: string;
  due?: string;
  dueDate?: string;
  assignedTo?: string;
}

export type UpdateTaskDTO = Partial<CreateTaskDTO>;

export interface InternalTaskListQuery {
  boardKey?: string;
  serviceType?: InternalTaskServiceType;
  clientAccountProfileId?: string;
  clientAccountServiceId?: string;
  assignedUserId?: string;
  status?: "pending" | "completed";
  overdue?: string | boolean;
  completed?: string | boolean;
  needsQa?: string | boolean;
  approvalStatus?: InternalTaskApprovalStatus;
  missedTask?: string | boolean;
  escalationFlag?: string | boolean;
  includeArchived?: string | boolean;
  workflowMonth?: string;
}

export interface CreateInternalTaskDTO extends CreateTaskDTO {
  boardKey: string;
  serviceType?: InternalTaskServiceType;
  clientAccountProfileId?: string;
  clientAccountServiceId?: string;
  assignedUserId?: string;
  proofReference?: string;
  workflowMonth?: string;
  templateKey?: string;
  recurrenceRule?: Record<string, unknown>;
}

export type UpdateInternalTaskDTO = Partial<CreateInternalTaskDTO>;

export interface UpdateInternalTaskQaDTO {
  needsQa?: boolean;
  qaChecklist?: Record<string, unknown> | null;
  approvalStatus?: InternalTaskApprovalStatus;
  reviewerUserId?: string | null;
  completionProofReference?: string | null;
  missedTask?: boolean;
  escalationFlag?: boolean;
  freelancerTeamScore?: number | string | null;
}
