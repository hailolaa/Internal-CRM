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
