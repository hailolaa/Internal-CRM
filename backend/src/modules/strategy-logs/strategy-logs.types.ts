export interface StrategyLogResponse {
  id: string;
  clinicId: string;
  clientAccountProfileId: string;
  logMonth: string; // YYYY-MM
  logType: "strategy" | "meeting";
  meetingNotes: string | null;
  seoPlan: string | null;
  ppcPlan: string | null;
  landingPagePlan: string | null;
  kpiNotes: string | null;
  decisions: string | null;
  nextActions: string | null;
  ownerId: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStrategyLogDTO {
  clientAccountProfileId: string;
  logMonth: string; // e.g. YYYY-MM or YYYY-MM-DD
  logType?: "strategy" | "meeting";
  meetingNotes?: string | null;
  seoPlan?: string | null;
  ppcPlan?: string | null;
  landingPagePlan?: string | null;
  kpiNotes?: string | null;
  decisions?: string | null;
  nextActions?: string | null;
  ownerId?: string | null;
}

export interface UpdateStrategyLogDTO {
  logMonth?: string;
  logType?: "strategy" | "meeting";
  meetingNotes?: string | null;
  seoPlan?: string | null;
  ppcPlan?: string | null;
  landingPagePlan?: string | null;
  kpiNotes?: string | null;
  decisions?: string | null;
  nextActions?: string | null;
  ownerId?: string | null;
}

export interface StrategyLogListQuery {
  clientAccountProfileId?: string;
  logMonth?: string; // YYYY-MM
  ownerId?: string;
  logType?: "strategy" | "meeting";
  includeArchived?: string | boolean;
}
