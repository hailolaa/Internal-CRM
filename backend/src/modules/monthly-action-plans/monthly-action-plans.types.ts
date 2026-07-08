export type MonthlyActionPlanStatus = "draft" | "active" | "completed" | "archived";
export type MonthlyActionPlanItemStatus = "planned" | "in_progress" | "completed" | "skipped";
export type MonthlyActionPlanItemPriority = "low" | "medium" | "high";

export interface MonthlyActionPlanItemResponse {
  id: string;
  planId: string;
  taskId: string | null;
  insightId: string | null;
  sourceType: string | null;
  sourceId: string | null;
  title: string;
  recommendedAction: string | null;
  priority: MonthlyActionPlanItemPriority;
  status: MonthlyActionPlanItemStatus;
  sortOrder: number;
  taskTitle: string | null;
  taskStatus: "pending" | "completed" | null;
  taskDueDate: string | null;
  insightTitle: string | null;
  insightSeverity: "low" | "medium" | "high" | "critical" | null;
  insightStatus: "open" | "in_progress" | "resolved" | "archived" | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyActionPlanSummary {
  totalItems: number;
  completedItems: number;
  activeItems: number;
  highPriorityItems: number;
}

export interface MonthlyActionPlanResponse {
  id: string;
  clinicId: string;
  planMonth: string;
  status: MonthlyActionPlanStatus;
  title: string;
  summary: string | null;
  focusMetric: string | null;
  items: MonthlyActionPlanItemResponse[];
  stats: MonthlyActionPlanSummary;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyActionPlanListQuery {
  month?: string;
}

export interface GenerateMonthlyActionPlanDTO {
  month?: string;
}

export interface GenerateMonthlyActionPlanResult {
  plan: MonthlyActionPlanResponse;
  generatedCount: number;
  existingCount: number;
}

export interface UpdateMonthlyActionPlanStatusDTO {
  status: MonthlyActionPlanStatus;
}

export interface UpdateMonthlyActionPlanItemStatusDTO {
  status: MonthlyActionPlanItemStatus;
}
