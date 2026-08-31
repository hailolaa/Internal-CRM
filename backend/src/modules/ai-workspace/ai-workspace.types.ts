export interface CreateAiProjectDTO {
  title: string;
  type: string;
  status?: "active" | "draft" | "completed" | "archived";
}

export type UpdateAiProjectDTO = Partial<CreateAiProjectDTO>;

export interface CreateAiRunDTO {
  projectId?: string;
  agentName: string;
  agentKey: string;
  task: string;
  input?: string;
  output?: unknown;
  status?: "success" | "error" | "running";
  tokens?: number;
}

export interface GenerateGrowthBriefDTO {
  startDate?: string;
  endDate?: string;
}

export type DateRangeDTO = GenerateGrowthBriefDTO;

export interface GenerateSalesAssistantDTO {
  contactId?: string;
  leadName?: string;
  treatment?: string;
  context?: string;
}

export interface GenerateCampaignAnalystDTO {
  googleSpend?: number;
  metaSpend?: number;
  leads?: number;
  bookings?: number;
  revenue?: number;
}

export interface GenerateCompetitorInsightsDTO {
  competitorIds?: string[];
  notes?: string;
}

export type AiActionApprovalStatus = "pending" | "approved" | "rejected" | "committed";
export type AiActionApprovalEventType = "queued" | "edited" | "approved" | "rejected" | "committed";

export interface AiActionApprovalRecord {
  id: string;
  sourceType: string;
  sourceRecordId: string | null;
  actionType: string;
  title: string;
  summary: string | null;
  proposedPayload: unknown;
  reviewedPayload: unknown | null;
  status: AiActionApprovalStatus;
  idempotencyKey: string;
  contentHash: string;
  committedPayloadHash: string | null;
  reviewNote: string | null;
  rejectionReason: string | null;
  createdBy: string | null;
  reviewedBy: string | null;
  committedBy: string | null;
  reviewedAt: string | null;
  committedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiActionApprovalEventRecord {
  id: string;
  approvalId: string;
  eventType: AiActionApprovalEventType;
  actorUserId: string | null;
  beforeStatus: string | null;
  afterStatus: string;
  changes: unknown | null;
  createdAt: string;
}

export interface CreateAiActionApprovalDTO {
  sourceType: string;
  sourceRecordId?: string | null;
  actionType: string;
  title: string;
  summary?: string | null;
  proposedPayload: unknown;
  idempotencyKey: string;
}

export interface UpdateAiActionApprovalDTO {
  title?: string;
  summary?: string | null;
  reviewedPayload?: unknown;
  reviewNote?: string | null;
}

export interface ReviewAiActionApprovalDTO {
  reviewNote?: string | null;
  reviewedPayload?: unknown;
}

export interface RejectAiActionApprovalDTO {
  rejectionReason: string;
}

export type AiChatGuardrailStatus = "answered" | "escalated" | "refused";

export interface AiChatMessageRecord {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  body: string;
  guardrailStatus: AiChatGuardrailStatus | null;
  citations: unknown | null;
  createdBy: string | null;
  createdAt: string;
}

export interface AiChatSessionRecord {
  id: string;
  title: string;
  status: "open" | "archived";
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface AiChatSessionDetail extends AiChatSessionRecord {
  messages: AiChatMessageRecord[];
}

export interface CreateAiChatSessionDTO {
  message: string;
}

export interface AddAiChatMessageDTO {
  message: string;
}
