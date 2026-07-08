export type InsightSeverity = "low" | "medium" | "high" | "critical";
export type InsightStatus = "open" | "in_progress" | "resolved" | "archived";

export interface InsightListQuery {
  status?: InsightStatus | "all";
  severity?: InsightSeverity | "all";
  type?: string;
}

export interface InsightResponse {
  id: string;
  type: string;
  severity: InsightSeverity;
  title: string;
  summary: string | null;
  recommendedAction: string | null;
  sourceType: string | null;
  sourceId: string | null;
  sourceContactId: string | null;
  actionTaskId: string | null;
  status: InsightStatus;
  assignedTo: string | null;
  assignedToName: string | null;
  dueDate: string | null;
  generatedFrom: string | null;
  dedupeKey: string | null;
  metadata: Record<string, unknown> | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateInsightsResult {
  generatedCount: number;
  existingCount: number;
  insights: InsightResponse[];
}

export interface UpdateInsightStatusDTO {
  status: InsightStatus;
}

export interface AssignInsightDTO {
  assignedTo?: string | null;
  dueDate?: string | null;
}

export interface CreateInsightTaskDTO {
  assignedTo?: string | null;
  dueDate?: string | null;
}

export interface CreateInsightTaskResult {
  taskId: string;
  insight: InsightResponse;
  existing: boolean;
}
