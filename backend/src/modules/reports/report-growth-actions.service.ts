import { createHash } from "node:crypto";
import { aiWorkspaceService } from "../ai-workspace/ai-workspace.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { reportsService } from "./reports.service.js";

type ReportActionSourceSection = "risks" | "recommendations";
type ReportActionExceptionType = "tracking_exception" | "client_risk" | "delivery_exception" | "kpi_exception";

interface ReportActionSource {
  section: ReportActionSourceSection;
  index: number;
  text: string;
}

interface QueuedReportAction {
  id: string;
  title: string;
  status: string;
  duplicate: boolean;
  exceptionType: ReportActionExceptionType;
  sourceEvidence: {
    reportId: string;
    reportName: string;
    reportMonth: string | null;
    section: ReportActionSourceSection;
    index: number;
    excerpt: string;
  };
}

function parseStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|;/)
      .map((item) => item.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function collectActionSources(report: any): ReportActionSource[] {
  const sections = report?.data?.sections && typeof report.data.sections === "object" ? report.data.sections : {};
  const candidates: ReportActionSource[] = [];

  for (const section of ["risks", "recommendations"] as const) {
    const lines = [
      ...parseStringList(sections[section]),
      ...parseStringList(report?.data?.[section]),
    ];
    lines.forEach((text, index) => {
      const normalized = text.replace(/\s+/g, " ").trim();
      if (normalized) {
        candidates.push({ section, index, text: normalized.slice(0, 1000) });
      }
    });
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.section}:${candidate.text.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function classifyException(text: string): ReportActionExceptionType {
  const haystack = text.toLowerCase();
  if (/\b(attribution|tracking|utm|source|campaign|conversion tag|analytics|ga4|gbp)\b/.test(haystack)) {
    return "tracking_exception";
  }
  if (/\b(client|retention|churn|risk|complaint|sla|missed call|no-show|no show|response)\b/.test(haystack)) {
    return "client_risk";
  }
  if (/\b(delivery|owner|workflow|follow-up|follow up|task|handover|blocked|overdue)\b/.test(haystack)) {
    return "delivery_exception";
  }
  return "kpi_exception";
}

function actionPriority(exceptionType: ReportActionExceptionType) {
  if (exceptionType === "client_risk" || exceptionType === "tracking_exception") return "high";
  return "normal";
}

function reportMonth(report: any) {
  const month = report?.filters?.month || report?.data?.month || report?.data?.period?.month || null;
  return month ? String(month) : null;
}

function actionTitle(source: ReportActionSource) {
  const prefix = source.section === "risks" ? "Review report risk" : "Create growth action";
  const title = `${prefix}: ${source.text}`;
  return title.length > 180 ? `${title.slice(0, 177)}...` : title;
}

function hashSource(reportId: string, source: ReportActionSource) {
  return createHash("sha256")
    .update(`${reportId}:${source.section}:${source.index}:${source.text}`)
    .digest("hex")
    .slice(0, 24);
}

function buildPayload(report: any, source: ReportActionSource, exceptionType: ReportActionExceptionType) {
  const month = reportMonth(report);
  const evidence = {
    reportId: report.id,
    reportName: report.name,
    reportMonth: month,
    section: source.section,
    index: source.index,
    excerpt: source.text,
    generatedAt: report?.data?.generatedAt || null,
  };

  return {
    dataContract: "ops_manager_report_action_v1",
    exceptionType,
    sourceEvidence: evidence,
    taskDraft: {
      title: actionTitle(source),
      description: `Source evidence: ${source.text}`,
      priority: actionPriority(exceptionType),
      category: "Ops Manager",
      source: "monthly_report",
      sourceRecordId: report.id,
    },
    clickUp: {
      action: "create_assigned_growth_task",
      requiresHumanApproval: true,
      requiresClickUpMapping: true,
    },
  };
}

export class ReportGrowthActionsService {
  async queueGrowthActionsFromReport(clinicId: string, userId: string, reportId: string) {
    const report = await reportsService.getReport(clinicId, reportId, { includeInternalNotes: true });
    const sources = collectActionSources(report);

    if (sources.length === 0) {
      throw ApiError.badRequest("Report does not contain risks or recommendations to review");
    }

    const actions: QueuedReportAction[] = [];
    let queuedCount = 0;
    let existingCount = 0;

    for (const source of sources.slice(0, 12)) {
      const exceptionType = classifyException(source.text);
      const payload = buildPayload(report, source, exceptionType);
      const queued = await aiWorkspaceService.queueActionApproval(clinicId, userId, {
        sourceType: "monthly_report",
        sourceRecordId: report.id,
        actionType: "create_growth_task",
        title: actionTitle(source),
        summary: `Ops Manager proposed a reviewed growth action from ${source.section} in ${report.name}.`,
        proposedPayload: payload,
        idempotencyKey: `ops-manager:monthly-report:${report.id}:${hashSource(report.id, source)}`,
      });
      const duplicate = Boolean((queued as { duplicate?: boolean }).duplicate);
      if (duplicate) existingCount += 1;
      else queuedCount += 1;

      actions.push({
        id: queued.id,
        title: queued.title,
        status: queued.status,
        duplicate,
        exceptionType,
        sourceEvidence: payload.sourceEvidence,
      });
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "OPS_MANAGER_REPORT_ACTIONS_QUEUED",
      entityType: "report",
      entityId: report.id,
      changes: { reportId: report.id, queuedCount, existingCount },
    });

    return {
      reportId: report.id,
      reportName: report.name,
      reportMonth: reportMonth(report),
      queuedCount,
      existingCount,
      actions,
    };
  }
}

export const reportGrowthActionsService = new ReportGrowthActionsService();
