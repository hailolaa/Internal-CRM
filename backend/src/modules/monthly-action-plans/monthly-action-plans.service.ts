import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import {
  GenerateMonthlyActionPlanDTO,
  GenerateMonthlyActionPlanResult,
  MonthlyActionPlanItemPriority,
  MonthlyActionPlanItemResponse,
  MonthlyActionPlanListQuery,
  MonthlyActionPlanResponse,
  MonthlyActionPlanSummary,
  UpdateMonthlyActionPlanItemStatusDTO,
  UpdateMonthlyActionPlanStatusDTO,
} from "./monthly-action-plans.types.js";

type PlanSource = {
  taskId: string | null;
  insightId: string | null;
  sourceType: string | null;
  sourceId: string | null;
  title: string;
  recommendedAction: string | null;
  priority: MonthlyActionPlanItemPriority;
  status: "planned" | "in_progress" | "completed";
  sortOrder: number;
};

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function normalizeMonth(value?: string | null) {
  const month = value || currentMonthKey();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw ApiError.badRequest("Month must use YYYY-MM format");
  }
  return `${month}-01`;
}

function toMonthKey(value: unknown) {
  if (!value) return currentMonthKey();
  return String(value).slice(0, 7);
}

function toIso(value: unknown) {
  return new Date(value as any).toISOString();
}

function toDateOnly(value: unknown) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function mapPriorityFromSeverity(severity: string): MonthlyActionPlanItemPriority {
  if (severity === "critical" || severity === "high") return "high";
  if (severity === "low") return "low";
  return "medium";
}

function priorityRank(priority: string) {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function sourceKey(source: PlanSource) {
  if (source.insightId) return `insight:${source.insightId}`;
  if (source.taskId) return `task:${source.taskId}`;
  if (source.sourceType && source.sourceId) return `${source.sourceType}:${source.sourceId}`;
  return `manual:${source.title.toLowerCase()}`;
}

export class MonthlyActionPlansService {
  async getPlan(clinicId: string, query: MonthlyActionPlanListQuery): Promise<MonthlyActionPlanResponse | null> {
    const planMonth = normalizeMonth(query.month);
    const plan = await this.findPlan(clinicId, planMonth);
    if (!plan) return null;
    return this.getPlanById(clinicId, plan.id);
  }

  async generatePlan(
    clinicId: string,
    userId: string,
    data: GenerateMonthlyActionPlanDTO = {},
  ): Promise<GenerateMonthlyActionPlanResult> {
    const planMonth = normalizeMonth(data.month);
    const plan = await this.ensurePlan(clinicId, userId, planMonth);
    const sources = await this.collectPlanSources(clinicId);
    let generatedCount = 0;
    let existingCount = 0;

    for (const source of sources) {
      const exists = await this.planItemExists(clinicId, plan.id, source);
      if (exists) {
        existingCount += 1;
        continue;
      }

      await pool.execute(
        `INSERT INTO monthly_action_plan_item
          (id, plan_id, clinic_id, task_id, insight_id, source_type, source_id,
           title, recommended_action, priority, status, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          plan.id,
          clinicId,
          source.taskId,
          source.insightId,
          source.sourceType,
          source.sourceId,
          source.title,
          source.recommendedAction,
          source.priority,
          source.status,
          source.sortOrder,
        ],
      );
      generatedCount += 1;
    }

    const title = this.buildPlanTitle(planMonth);
    const summary = this.buildPlanSummary(generatedCount, existingCount, sources.length);
    await pool.execute(
      `UPDATE monthly_action_plan
       SET status = CASE WHEN status = 'draft' THEN 'active' ELSE status END,
           title = ?,
           summary = ?,
           focus_metric = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [title, summary, "Revenue leakage action completion", plan.id, clinicId],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "MONTHLY_ACTION_PLAN_GENERATED",
      entityType: "monthly_action_plan",
      entityId: plan.id,
      changes: { planMonth: toMonthKey(planMonth), generatedCount, existingCount },
    });

    return {
      plan: await this.getPlanById(clinicId, plan.id),
      generatedCount,
      existingCount,
    };
  }

  async updatePlanStatus(
    clinicId: string,
    userId: string,
    planId: string,
    data: UpdateMonthlyActionPlanStatusDTO,
  ): Promise<void> {
    const [result]: any = await pool.execute(
      `UPDATE monthly_action_plan
       SET status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [data.status, planId, clinicId],
    );

    if (result.affectedRows === 0) throw ApiError.notFound("Monthly action plan not found");
    await logAuditEvent({
      clinicId,
      userId,
      action: "MONTHLY_ACTION_PLAN_STATUS_UPDATED",
      entityType: "monthly_action_plan",
      entityId: planId,
      changes: { status: data.status },
    });
  }

  async updateItemStatus(
    clinicId: string,
    userId: string,
    planId: string,
    itemId: string,
    data: UpdateMonthlyActionPlanItemStatusDTO,
  ): Promise<void> {
    const [result]: any = await pool.execute(
      `UPDATE monthly_action_plan_item
       SET status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND plan_id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [data.status, itemId, planId, clinicId],
    );

    if (result.affectedRows === 0) throw ApiError.notFound("Monthly action plan item not found");

    if (data.status === "completed") {
      await pool.execute(
        `UPDATE task t
         JOIN monthly_action_plan_item i ON i.task_id = t.id
         SET t.status = 'completed', t.completed_at = CURRENT_TIMESTAMP, t.updated_at = CURRENT_TIMESTAMP
         WHERE i.id = ? AND i.plan_id = ? AND i.clinic_id = ? AND t.clinic_id = ? AND t.is_internal = 0 AND t.deleted_at IS NULL`,
        [itemId, planId, clinicId, clinicId],
      );
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "MONTHLY_ACTION_PLAN_ITEM_STATUS_UPDATED",
      entityType: "monthly_action_plan_item",
      entityId: itemId,
      changes: { planId, status: data.status },
    });
  }

  private async ensurePlan(clinicId: string, userId: string, planMonth: string) {
    const existing = await this.findPlan(clinicId, planMonth);
    if (existing) return existing;

    const id = uuidv4();
    await pool.execute(
      `INSERT INTO monthly_action_plan
        (id, clinic_id, plan_month, status, title, summary, focus_metric, created_by)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        planMonth,
        this.buildPlanTitle(planMonth),
        "Generated from current revenue leakage insights and open action tasks.",
        "Revenue leakage action completion",
        userId,
      ],
    );

    return { id };
  }

  private async findPlan(clinicId: string, planMonth: string): Promise<{ id: string } | null> {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM monthly_action_plan
       WHERE clinic_id = ? AND plan_month = ? AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [clinicId, planMonth],
    );

    return rows[0] || null;
  }

  private async getPlanById(clinicId: string, planId: string): Promise<MonthlyActionPlanResponse> {
    const [plans]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, DATE_FORMAT(plan_month, '%Y-%m-%d') as planMonth,
              status, title, summary, focus_metric as focusMetric,
              created_at as createdAt, updated_at as updatedAt
       FROM monthly_action_plan
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [planId, clinicId],
    );

    if (plans.length === 0) throw ApiError.notFound("Monthly action plan not found");
    const items = await this.listPlanItems(clinicId, planId);
    return this.mapPlan(plans[0], items);
  }

  private async listPlanItems(clinicId: string, planId: string): Promise<MonthlyActionPlanItemResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT i.id, i.plan_id as planId, i.task_id as taskId, i.insight_id as insightId,
              i.source_type as sourceType, i.source_id as sourceId,
              i.title, i.recommended_action as recommendedAction,
              i.priority, i.status, i.sort_order as sortOrder,
              t.title as taskTitle, t.status as taskStatus, DATE_FORMAT(t.due_date, '%Y-%m-%d') as taskDueDate,
              ins.title as insightTitle, ins.severity as insightSeverity, ins.status as insightStatus,
              i.created_at as createdAt, i.updated_at as updatedAt
       FROM monthly_action_plan_item i
       LEFT JOIN task t ON t.id = i.task_id AND t.clinic_id = i.clinic_id AND t.deleted_at IS NULL
       LEFT JOIN insight ins ON ins.id = i.insight_id AND ins.clinic_id = i.clinic_id AND ins.deleted_at IS NULL
       WHERE i.plan_id = ? AND i.clinic_id = ? AND i.deleted_at IS NULL
       ORDER BY i.status = 'completed' ASC, i.sort_order ASC, i.priority DESC, i.created_at ASC`,
      [planId, clinicId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      planId: row.planId,
      taskId: row.taskId || null,
      insightId: row.insightId || null,
      sourceType: row.sourceType || null,
      sourceId: row.sourceId || null,
      title: row.title,
      recommendedAction: row.recommendedAction || null,
      priority: row.priority,
      status: row.taskStatus === "completed" && row.status !== "skipped" ? "completed" : row.status,
      sortOrder: Number(row.sortOrder || 0),
      taskTitle: row.taskTitle || null,
      taskStatus: row.taskStatus || null,
      taskDueDate: row.taskDueDate || null,
      insightTitle: row.insightTitle || null,
      insightSeverity: row.insightSeverity || null,
      insightStatus: row.insightStatus || null,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    }));
  }

  private mapPlan(row: any, items: MonthlyActionPlanItemResponse[]): MonthlyActionPlanResponse {
    const stats: MonthlyActionPlanSummary = {
      totalItems: items.length,
      completedItems: items.filter((item) => item.status === "completed").length,
      activeItems: items.filter((item) => item.status !== "completed" && item.status !== "skipped").length,
      highPriorityItems: items.filter((item) => item.priority === "high" && item.status !== "completed" && item.status !== "skipped").length,
    };

    return {
      id: row.id,
      clinicId: row.clinicId,
      planMonth: toMonthKey(row.planMonth),
      status: row.status,
      title: row.title,
      summary: row.summary || null,
      focusMetric: row.focusMetric || null,
      items,
      stats,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private async collectPlanSources(clinicId: string): Promise<PlanSource[]> {
    const insightSources = await this.collectInsightSources(clinicId);
    const taskSources = await this.collectTaskSources(clinicId);
    const sources = [...insightSources, ...taskSources];
    const seen = new Set<string>();

    return sources
      .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.sortOrder - b.sortOrder)
      .filter((source, index) => {
        const key = sourceKey(source);
        if (seen.has(key)) return false;
        seen.add(key);
        source.sortOrder = index + 1;
        return true;
      });
  }

  private async collectInsightSources(clinicId: string): Promise<PlanSource[]> {
    const [rows]: any = await pool.execute(
      `SELECT i.id, i.title, i.recommended_action as recommendedAction,
              i.severity, i.status, i.source_type as sourceType, i.source_id as sourceId,
              i.action_task_id as actionTaskId,
              t.status as taskStatus
       FROM insight i
       LEFT JOIN task t ON t.id = i.action_task_id AND t.clinic_id = i.clinic_id AND t.deleted_at IS NULL
       WHERE i.clinic_id = ?
         AND i.status IN ('open', 'in_progress')
         AND i.deleted_at IS NULL
       ORDER BY FIELD(i.severity, 'critical', 'high', 'medium', 'low'), i.created_at DESC
       LIMIT 50`,
      [clinicId],
    );

    return rows.map((row: any, index: number) => ({
      taskId: row.actionTaskId || null,
      insightId: row.id,
      sourceType: row.sourceType || "insight",
      sourceId: row.sourceId || row.id,
      title: row.title,
      recommendedAction: row.recommendedAction || null,
      priority: mapPriorityFromSeverity(row.severity),
      status: row.taskStatus === "completed" ? "completed" : row.status === "in_progress" ? "in_progress" : "planned",
      sortOrder: index + 1,
    }));
  }

  private async collectTaskSources(clinicId: string): Promise<PlanSource[]> {
    const [rows]: any = await pool.execute(
      `SELECT t.id, t.title, t.description, t.priority, t.status, t.category,
              DATE_FORMAT(t.due_date, '%Y-%m-%d') as dueDate
       FROM task t
       LEFT JOIN insight i ON i.action_task_id = t.id AND i.clinic_id = t.clinic_id AND i.deleted_at IS NULL
       WHERE t.clinic_id = ?
         AND t.is_internal = 0
         AND t.deleted_at IS NULL
         AND t.status <> 'completed'
         AND i.id IS NULL
         AND (
           LOWER(COALESCE(t.category, '')) REGEXP 'revenue|leak|follow|consult|sla|show|conversion|insight|action'
           OR LOWER(t.title) REGEXP 'revenue|leak|follow|consult|sla|show|conversion|insight|action'
           OR LOWER(COALESCE(t.description, '')) REGEXP 'revenue|leak|follow|consult|sla|show|conversion|insight|action'
         )
       ORDER BY FIELD(t.priority, 'high', 'medium', 'low'), t.due_date IS NULL ASC, t.due_date ASC, t.created_at DESC
       LIMIT 50`,
      [clinicId],
    );

    return rows.map((row: any, index: number) => ({
      taskId: row.id,
      insightId: null,
      sourceType: "task",
      sourceId: row.id,
      title: row.title,
      recommendedAction: row.description || null,
      priority: row.priority,
      status: row.status === "completed" ? "completed" : "planned",
      sortOrder: index + 101,
    }));
  }

  private async planItemExists(clinicId: string, planId: string, source: PlanSource): Promise<boolean> {
    const conditions = ["plan_id = ?", "clinic_id = ?", "deleted_at IS NULL"];
    const values: any[] = [planId, clinicId];

    if (source.insightId) {
      conditions.push("insight_id = ?");
      values.push(source.insightId);
    } else if (source.taskId) {
      conditions.push("task_id = ?");
      values.push(source.taskId);
    } else if (source.sourceType && source.sourceId) {
      conditions.push("source_type = ?", "source_id = ?");
      values.push(source.sourceType, source.sourceId);
    } else {
      conditions.push("title = ?");
      values.push(source.title);
    }

    const [rows]: any = await pool.execute(
      `SELECT id FROM monthly_action_plan_item WHERE ${conditions.join(" AND ")} LIMIT 1`,
      values,
    );
    return rows.length > 0;
  }

  private buildPlanTitle(planMonth: string) {
    const date = new Date(`${planMonth.slice(0, 10)}T00:00:00.000Z`);
    return `${date.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })} Action Plan`;
  }

  private buildPlanSummary(generatedCount: number, existingCount: number, totalSourceCount: number) {
    if (totalSourceCount === 0) return "No active revenue leakage insights or action tasks were found for this month.";
    if (generatedCount === 0) return `${existingCount} existing action plan items are already tracking the current commercial signals.`;
    return `${generatedCount} new action plan items were generated from current commercial signals.`;
  }
}

export const monthlyActionPlansService = new MonthlyActionPlansService();
