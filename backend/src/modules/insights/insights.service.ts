import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { reportsService } from "../reports/reports.service.js";
import { tasksService } from "../tasks/tasks.service.js";
import { openAIInsightsService } from "../../services/openai-insights.service.js";
import type {
  AssignInsightDTO,
  CreateInsightTaskDTO,
  CreateInsightTaskResult,
  GenerateInsightsResult,
  InsightListQuery,
  InsightResponse,
  InsightSeverity,
  UpdateInsightStatusDTO,
} from "./insights.types.js";
import type { CreateTaskDTO } from "../tasks/tasks.types.js";

function parseJson(value: unknown) {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, unknown>;

  try {
    return JSON.parse(String(value)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toIsoDateTime(value: unknown) {
  return value ? new Date(value as string | number | Date).toISOString() : null;
}

function toDateOnly(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function dueDateForSeverity(severity: InsightSeverity) {
  const days =
    severity === "critical" ? 1 :
      severity === "high" ? 2 :
        severity === "medium" ? 5 : 7;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function severityForRisk(estimatedRisk: number): InsightSeverity {
  if (estimatedRisk >= 5000) return "critical";
  if (estimatedRisk >= 1500) return "high";
  if (estimatedRisk > 0) return "medium";
  return "low";
}

function titleForLeak(leakKey: string) {
  const titles: Record<string, string> = {
    lowConsultConversion: "Valued enquiry has no sold treatment recorded",
    missedCalls: "Missed call needs revenue recovery",
    noShows: "No-show consult needs rebooking",
    slaBreaches: "Speed-to-lead breach needs follow-up",
  };

  return titles[leakKey] || "Revenue leak needs review";
}

function mapInsight(row: any): InsightResponse {
  const assignedToName = [row.assignedFirstName, row.assignedLastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    summary: row.summary || null,
    recommendedAction: row.recommendedAction || null,
    sourceType: row.sourceType || null,
    sourceId: row.sourceId || null,
    sourceContactId: row.sourceContactId || null,
    actionTaskId: row.actionTaskId || null,
    status: row.status,
    assignedTo: row.assignedTo || null,
    assignedToName: assignedToName || row.assignedEmail || null,
    dueDate: toDateOnly(row.dueDate),
    generatedFrom: row.generatedFrom || null,
    dedupeKey: row.dedupeKey || null,
    metadata: parseJson(row.metadata),
    resolvedAt: toIsoDateTime(row.resolvedAt),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export class InsightsService {
  async listInsights(clinicId: string, query: InsightListQuery = {}): Promise<InsightResponse[]> {
    const conditions = ["i.clinic_id = ?", "i.deleted_at IS NULL"];
    const values: any[] = [clinicId];

    if (query.status && query.status !== "all") {
      conditions.push("i.status = ?");
      values.push(query.status);
    } else if (!query.status) {
      conditions.push("i.status IN ('open', 'in_progress')");
    }

    if (query.severity && query.severity !== "all") {
      conditions.push("i.severity = ?");
      values.push(query.severity);
    }

    if (query.type) {
      conditions.push("i.type = ?");
      values.push(query.type);
    }

    const [rows]: any = await pool.execute(
      `SELECT i.id, i.type, i.severity, i.title, i.summary,
              i.recommended_action as recommendedAction,
              i.source_type as sourceType,
              i.source_id as sourceId,
              i.source_contact_id as sourceContactId,
              i.action_task_id as actionTaskId,
              i.status,
              i.assigned_to as assignedTo,
              i.due_date as dueDate,
              i.generated_from as generatedFrom,
              i.dedupe_key as dedupeKey,
              i.metadata,
              i.resolved_at as resolvedAt,
              i.created_at as createdAt,
              i.updated_at as updatedAt,
              u.first_name as assignedFirstName,
              u.last_name as assignedLastName,
              u.email as assignedEmail
       FROM insight i
       LEFT JOIN user u
         ON u.id = i.assigned_to
        AND u.clinic_id = i.clinic_id
        AND u.deleted_at IS NULL
       WHERE ${conditions.join(" AND ")}
       ORDER BY FIELD(i.severity, 'critical', 'high', 'medium', 'low'),
                i.due_date IS NULL ASC,
                i.due_date ASC,
                i.created_at DESC
       LIMIT 100`,
      values,
    );

    return rows.map(mapInsight);
  }

  async generateFromRevenueLeaks(clinicId: string, userId: string): Promise<GenerateInsightsResult> {
    const leakDetails = await reportsService.getRevenueLeakDetails(clinicId);
    const records = Object.values(leakDetails.items).flat();
    const enrichment = await openAIInsightsService.generateRevenueLeakInsights(records.map((record) => ({
      contactName: record.contactName,
      dedupeKey: `revenue-leak:${record.leakKey}:${record.sourceType}:${record.sourceId}`,
      estimatedRisk: Number(record.estimatedRisk || 0),
      leakKey: record.leakKey,
      nextAction: record.nextAction,
      occurredAt: record.occurredAt,
      ownerName: record.ownerName,
      reason: record.reason,
      source: record.source,
      treatment: record.treatment,
    })));
    let generatedCount = 0;
    let existingCount = 0;

    for (const record of records) {
      const dedupeKey = `revenue-leak:${record.leakKey}:${record.sourceType}:${record.sourceId}`;
      const [existingRows]: any = await pool.execute(
        `SELECT id
         FROM insight
         WHERE clinic_id = ?
           AND dedupe_key = ?
           AND status IN ('open', 'in_progress')
           AND deleted_at IS NULL
         LIMIT 1`,
        [clinicId, dedupeKey],
      );

      if (existingRows[0]) {
        existingCount += 1;
        continue;
      }

      const enriched = enrichment.enrichments.get(dedupeKey);
      const severity = enriched?.severity || severityForRisk(Number(record.estimatedRisk || 0));
      const generationProvider = enriched ? enrichment.provider : "deterministic";
      const id = uuidv4();
      await pool.execute(
        `INSERT INTO insight
          (id, clinic_id, type, severity, title, summary, recommended_action,
           source_type, source_id, source_contact_id, status, due_date,
           generated_from, dedupe_key, metadata, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`,
        [
          id,
          clinicId,
          record.leakKey,
          severity,
          enriched?.title || titleForLeak(record.leakKey),
          enriched?.summary || record.reason,
          enriched?.recommendedAction || record.nextAction,
          record.sourceType,
          record.sourceId,
          record.contactId || null,
          dueDateForSeverity(severity),
          "revenue_leakage",
          dedupeKey,
          JSON.stringify({
            contactName: record.contactName,
            source: record.source,
            treatment: record.treatment,
            estimatedRisk: record.estimatedRisk,
            occurredAt: record.occurredAt,
            generation: {
              fallbackReason: enriched ? null : enrichment.fallbackReason || "missing_ai_enrichment",
              model: enriched ? enrichment.model : null,
              provider: generationProvider,
              responseId: enriched ? enrichment.responseId : null,
            },
          }),
          userId,
        ],
      );
      generatedCount += 1;
    }

    if (generatedCount > 0) {
      await logAuditEvent({
        clinicId,
        userId,
        action: "INSIGHTS_GENERATED",
        entityType: "insight",
        entityId: null,
        changes: {
          generatedCount,
          existingCount,
          provider: enrichment.provider,
          source: "revenue_leakage",
        },
      });
    }

    return {
      generatedCount,
      existingCount,
      insights: await this.listInsights(clinicId),
    };
  }

  async updateInsightStatus(
    clinicId: string,
    userId: string,
    insightId: string,
    data: UpdateInsightStatusDTO,
  ): Promise<void> {
    const [result]: any = await pool.execute(
      `UPDATE insight
       SET status = ?,
           resolved_at = CASE WHEN ? = 'resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL`,
      [data.status, data.status, insightId, clinicId],
    );

    if (result.affectedRows === 0) throw ApiError.notFound("Insight not found");
    await logAuditEvent({ clinicId, userId, action: "INSIGHT_STATUS_UPDATED", entityType: "insight", entityId: insightId, changes: { ...data } });
  }

  async assignInsight(
    clinicId: string,
    userId: string,
    insightId: string,
    data: AssignInsightDTO,
  ): Promise<void> {
    if (data.assignedTo) {
      await this.ensureActiveUserInClinic(clinicId, data.assignedTo);
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (Object.prototype.hasOwnProperty.call(data, "assignedTo")) {
      fields.push("assigned_to = ?");
      values.push(data.assignedTo || null);
    }

    if (Object.prototype.hasOwnProperty.call(data, "dueDate")) {
      fields.push("due_date = ?");
      values.push(toDateOnly(data.dueDate));
    }

    if (fields.length === 0) return;

    values.push(insightId, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE insight
       SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL`,
      values,
    );

    if (result.affectedRows === 0) throw ApiError.notFound("Insight not found");
    await logAuditEvent({ clinicId, userId, action: "INSIGHT_ASSIGNED", entityType: "insight", entityId: insightId, changes: { ...data } });
  }

  async createActionTask(
    clinicId: string,
    userId: string,
    insightId: string,
    data: CreateInsightTaskDTO = {},
  ): Promise<CreateInsightTaskResult> {
    const insight = await this.getInsightForUpdate(clinicId, insightId);
    if (insight.actionTaskId) {
      const linkedTaskExists = await this.taskExists(clinicId, insight.actionTaskId);
      if (linkedTaskExists) {
        return {
          taskId: insight.actionTaskId,
          insight: await this.getInsight(clinicId, insightId),
          existing: true,
        };
      }
    }

    const taskPayload: CreateTaskDTO = {
      title: insight.title,
      description: [
        insight.summary,
        insight.recommendedAction ? `Recommended action: ${insight.recommendedAction}` : null,
      ].filter(Boolean).join("\n\n"),
      priority: insight.severity === "critical" || insight.severity === "high" ? "high" : insight.severity === "low" ? "low" : "medium",
      status: "pending",
      category: "Revenue insight",
      due: "Insight action",
    };
    const contactName = this.readMetadataString(insight.metadata, "contactName");
    const dueDate = toDateOnly(data.dueDate) || insight.dueDate;
    const assignedTo = data.assignedTo || insight.assignedToName;
    if (contactName) taskPayload.contact = contactName;
    if (dueDate) taskPayload.dueDate = dueDate;
    if (assignedTo) taskPayload.assignedTo = assignedTo;

    const taskId = await tasksService.createTask(clinicId, userId, taskPayload);

    await pool.execute(
      `UPDATE insight
       SET action_task_id = ?,
           status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL`,
      [taskId, insightId, clinicId],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "INSIGHT_ACTION_TASK_CREATED",
      entityType: "insight",
      entityId: insightId,
      changes: { taskId },
    });

    return {
      taskId,
      insight: await this.getInsight(clinicId, insightId),
      existing: false,
    };
  }

  private async ensureActiveUserInClinic(clinicId: string, userId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM user
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
         AND status = 'active'
         AND is_active = 1
       LIMIT 1`,
      [userId, clinicId],
    );

    if (!rows[0]) throw ApiError.badRequest("Assigned user does not belong to this clinic");
  }

  private async getInsight(clinicId: string, insightId: string) {
    const [rows]: any = await pool.execute(
      `SELECT i.id, i.type, i.severity, i.title, i.summary,
              i.recommended_action as recommendedAction,
              i.source_type as sourceType,
              i.source_id as sourceId,
              i.source_contact_id as sourceContactId,
              i.action_task_id as actionTaskId,
              i.status,
              i.assigned_to as assignedTo,
              i.due_date as dueDate,
              i.generated_from as generatedFrom,
              i.dedupe_key as dedupeKey,
              i.metadata,
              i.resolved_at as resolvedAt,
              i.created_at as createdAt,
              i.updated_at as updatedAt,
              u.first_name as assignedFirstName,
              u.last_name as assignedLastName,
              u.email as assignedEmail
       FROM insight i
       LEFT JOIN user u
         ON u.id = i.assigned_to
        AND u.clinic_id = i.clinic_id
        AND u.deleted_at IS NULL
       WHERE i.id = ?
         AND i.clinic_id = ?
         AND i.deleted_at IS NULL
       LIMIT 1`,
      [insightId, clinicId],
    );

    if (!rows[0]) throw ApiError.notFound("Insight not found");
    return mapInsight(rows[0]);
  }

  private async getInsightForUpdate(clinicId: string, insightId: string) {
    return this.getInsight(clinicId, insightId);
  }

  private async taskExists(clinicId: string, taskId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM task
       WHERE id = ?
         AND clinic_id = ?
         AND is_internal = 0
         AND deleted_at IS NULL
       LIMIT 1`,
      [taskId, clinicId],
    );

    return rows.length > 0;
  }

  private readMetadataString(metadata: Record<string, unknown> | null, key: string) {
    const value = metadata?.[key];
    return typeof value === "string" && value.trim() ? value : undefined;
  }
}

export const insightsService = new InsightsService();
