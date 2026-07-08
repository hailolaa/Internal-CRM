export type InsightSeverity = "low" | "medium" | "high" | "critical";
export type InsightStatus = "open" | "in_progress" | "resolved" | "archived";

export interface InsightRecord {
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

export interface GenerateInsightsResponse {
  generatedCount: number;
  existingCount: number;
  insights: InsightRecord[];
}

export interface InsightListParams {
  status?: InsightStatus | "all";
  severity?: InsightSeverity | "all";
  type?: string;
}

export interface AssignInsightPayload {
  assignedTo?: string | null;
  dueDate?: string | null;
}

export interface CreateInsightTaskResponse {
  taskId: string;
  insight: InsightRecord;
  existing: boolean;
}
