import pool from "../../config/database.js";
import { logAuditEvent } from "../../utils/audit.js";
import { ApiError } from "../../utils/ApiError.js";
import { generateResetToken, hashToken } from "../../utils/helpers.js";
import { pipelineDealsService } from "../pipeline/pipeline.deals.service.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Reporting provenance values indicate how a metric was derived:
 * - 'exact'     : direct from transactional data (appointments, deposits, contacts)
 * - 'manual'    : entered by an operator (manual spend, manual consult entries)
 * - 'connector' : imported by a configured marketing connector
 * - 'estimated' : derived or estimated (leadValue, treatment plan totals)
 * - 'unknown'   : no supporting data available
 *
 * We add conservative provenance annotations alongside numeric metrics so
 * the frontend can explain metric reliability without changing existing
 * response shapes.
 */

function parseJson(value: unknown, fallback: unknown) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

const reportSelectFields = `
  id,
  name,
  type,
  description,
  filters,
  data,
  workflow_status as workflowStatus,
  internal_notes as internalNotes,
  client_commentary as clientCommentary,
  ai_draft_summary as aiDraftSummary,
  approved_by as approvedBy,
  approved_at as approvedAt,
  published_at as publishedAt,
  created_at as createdAt,
  updated_at as updatedAt
`;

type ReportWorkflowStatus = "draft" | "in_review" | "approved" | "published";
type ReportExportType = "revenue" | "attribution" | "pipeline" | "operational" | "no-shows";
type ReportExportFormat = "csv";

interface ReportExportRow {
  reportType: ReportExportType;
  section: string;
  metric: string;
  label: string;
  value: string | number;
  currency?: string | null;
  provenance?: string | null;
  source?: string | null;
  campaign?: string | null;
  treatment?: string | null;
  contactId?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  nextAction?: string | null;
  occurredAt?: string | null;
  reason?: string | null;
  recordId?: string | null;
  status?: string | null;
  startDate: string;
  endDate: string;
}

function toNullableIso(value: unknown) {
  return value ? new Date(value as string | number | Date).toISOString() : null;
}

function mapReportRow(row: any, options: { publicView?: boolean; includeInternalNotes?: boolean } = {}) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description,
    filters: parseJson(row.filters, {}),
    data: parseJson(row.data, {}),
    workflowStatus: row.workflowStatus || "draft",
    internalNotes:
      options.publicView || options.includeInternalNotes === false
        ? null
        : row.internalNotes || null,
    clientCommentary: row.clientCommentary || null,
    aiDraftSummary: row.aiDraftSummary || null,
    approvedBy: row.approvedBy || null,
    approvedAt: toNullableIso(row.approvedAt),
    publishedAt: toNullableIso(row.publishedAt),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export interface DashboardDateRange {
  startDate: string;
  endDate: string;
}

export interface DashboardQueryResult<T> {
  range: DashboardDateRange;
  data: T;
}

function toDateOnly(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function defaultDateOnly(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function getDateRange(query: { startDate?: string; endDate?: string } = {}): DashboardDateRange {
  return {
    startDate: toDateOnly(query.startDate) || defaultDateOnly(-30),
    endDate: toDateOnly(query.endDate) || defaultDateOnly(0),
  };
}

function getMonthDateRange(month?: string): DashboardDateRange & { month: string } {
  const candidate = typeof month === "string" && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
  const [yearText, monthText] = candidate.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const startDate = `${candidate}-01`;
  const endDate = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);

  return { month: candidate, startDate, endDate };
}

function addMonths(year: number, monthIndex: number, offset: number) {
  return new Date(Date.UTC(year, monthIndex + offset, 1));
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function buildMonthlyTrendRanges(query: { startDate?: string; endDate?: string } = {}) {
  const range = getDateRange(query);
  const start = new Date(`${range.startDate}T00:00:00.000Z`);
  const end = new Date(`${range.endDate}T00:00:00.000Z`);
  const startMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  const months: Array<DashboardDateRange & { month: string }> = [];
  let cursor = startMonth;
  while (cursor <= endMonth && months.length < 12) {
    const key = monthKey(cursor);
    const [yearText, monthText] = key.split("-");
    const year = Number(yearText);
    const monthNumber = Number(monthText);
    months.push({
      month: key,
      startDate: `${key}-01`,
      endDate: new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10),
    });
    cursor = addMonths(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1);
  }

  if (months.length === 0) {
    const fallback = getMonthDateRange(range.endDate.slice(0, 7));
    months.push(fallback);
  }

  return { range, months };
}

function buildDateRangeClause(column: string, range: DashboardDateRange) {
  return {
    sql: ` AND ${column} >= ? AND ${column} < DATE_ADD(?, INTERVAL 1 DAY)`,
    values: [range.startDate, range.endDate],
  };
}

function buildSpendOverlapClause(range: DashboardDateRange) {
  return {
    sql: ` AND (COALESCE(mse.start_date, DATE(mse.created_at)) <= ?
                AND COALESCE(mse.end_date, COALESCE(mse.start_date, DATE(mse.created_at))) >= ?)` ,
    values: [range.endDate, range.startDate],
  };
}

function buildCreatedRangeClause(alias: string, range: DashboardDateRange) {
  return buildDateRangeClause(`${alias}.created_at`, range);
}

function sumNumber(rows: Array<Record<string, any>>, key: string) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function divideMetric(numerator: number, denominator: number) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(2)) : 0;
}

function groupByKey<T extends Record<string, any>>(rows: T[], key: string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const groupKey = String(row[key] || "Unknown");
    const bucket = map.get(groupKey) || [];
    bucket.push(row);
    map.set(groupKey, bucket);
  }
  return map;
}

function toIsoDate(value: unknown) {
  return value ? new Date(value as string | number | Date).toISOString() : null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    currency: "GBP",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: ReportExportRow[]) {
  const headers: Array<keyof ReportExportRow> = [
    "reportType",
    "section",
    "metric",
    "label",
    "value",
    "currency",
    "provenance",
    "source",
    "campaign",
    "treatment",
    "contactId",
    "contactName",
    "contactPhone",
    "occurredAt",
    "status",
    "reason",
    "nextAction",
    "recordId",
    "startDate",
    "endDate",
  ];

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

function money(value: unknown) {
  return Number(Number(value || 0).toFixed(2));
}

function exportFilename(type: ReportExportType, range: DashboardDateRange) {
  return `phase1-${type}-report-${range.startDate}-to-${range.endDate}.csv`;
}

function buildMonthlyReportSections(payload: {
  funnel: Awaited<ReturnType<ReportsService["getDashboardFunnel"]>>;
  leaks: Awaited<ReturnType<ReportsService["getRevenueLeaks"]>>;
  opportunities: Awaited<ReturnType<ReportsService["getTopOpportunities"]>>;
  summary: Awaited<ReturnType<ReportsService["getDashboardSummary"]>>;
}) {
  const { funnel, leaks, opportunities, summary } = payload;
  const revenue = summary.financials.totalRevenue;
  const spend = summary.financials.spend;
  const roas = summary.financials.roas;
  const totalLeakage = leaks.totalEstimatedRisk;
  const topLeak = [...leaks.items].sort((left, right) => right.estimatedRisk - left.estimatedRisk)[0];
  const topOpportunity = opportunities.deals[0];
  const attendedRate = funnel.conversionRates.bookedToAttendedRate;
  const soldRate = funnel.conversionRates.attendedToSoldRate;

  const highlights = [
    `${summary.cards.leads} leads and ${summary.cards.bookedConsults} booked consults were recorded in the period.`,
    `${formatCurrency(revenue)} revenue was tracked against ${formatCurrency(spend)} spend, giving ${roas.toFixed(2)}x ROAS.`,
    `${summary.cards.attendedConsults} attended consults and ${summary.cards.soldTreatments} sold treatments were recorded.`,
  ];

  const risks = [
    topLeak
      ? `${topLeak.label} is the largest tracked leakage category, with ${topLeak.count} records and ${formatCurrency(topLeak.estimatedRisk)} estimated risk.`
      : "No major leakage category was detected in the tracked data.",
    attendedRate > 0 && attendedRate < 70
      ? `Booked-to-attended conversion is ${attendedRate.toFixed(1)}%, so no-show and confirmation discipline need review.`
      : "Booked-to-attended conversion is not currently the main pressure point.",
    soldRate > 0 && soldRate < 45
      ? `Attended-to-sold conversion is ${soldRate.toFixed(1)}%, which points to consult close-rate follow-up.`
      : "Attended-to-sold conversion is not currently the main pressure point.",
  ];

  const recommendations = [
    topLeak
      ? `Prioritise the ${topLeak.label.toLowerCase()} follow-up workflow before scaling spend.`
      : "Keep monitoring leakage while improving attribution coverage.",
    topOpportunity
      ? `Review ${topOpportunity.title} because it is the highest-value open opportunity in the current report.`
      : "Create or update open opportunities so the team can track the next revenue moves.",
    "Use the Monthly Action Plan to assign owners and due dates for the highest-risk items.",
  ];

  return {
    executiveSummary:
      totalLeakage > 0
        ? `This month shows ${formatCurrency(revenue)} tracked revenue and ${formatCurrency(totalLeakage)} estimated leakage. The strongest next move is to reduce ${topLeak?.label.toLowerCase() || "revenue leakage"} while protecting consult conversion.`
        : `This month shows ${formatCurrency(revenue)} tracked revenue with no major leakage detected in the current data. The next move is to tighten attribution and keep action-plan follow-up current.`,
    highlights,
    risks,
    recommendations,
  };
}

function getPersonName(row: any, firstNameKey = "firstName", lastNameKey = "lastName") {
  const name = [row[firstNameKey], row[lastNameKey]].filter(Boolean).join(" ").trim();
  return name || row.email || row.phone || "Unknown contact";
}

function buildLeadHref(contactId: string | null) {
  return contactId ? `/app/leads?contactId=${encodeURIComponent(contactId)}` : null;
}

function buildEntityHref(entityType: string, entityId: string | null) {
  if (!entityId) return null;
  const encodedId = encodeURIComponent(entityId);
  const routes: Record<string, string> = {
    appointment: `/app/appointments?id=${encodedId}`,
    consult: `/app/consults?id=${encodedId}`,
    deal: `/app/pipeline?dealId=${encodedId}`,
    deposit: `/app/deposits?id=${encodedId}`,
    treatmentPlan: `/app/treatment-plans?id=${encodedId}`,
  };

  return routes[entityType] || null;
}

function classifyAttributionLabel(label: unknown) {
  if (!label) return 'unknown';
  const text = String(label).toLowerCase();
  if (text.startsWith('connector:')) return 'connector';
  if (text.includes('manual') || text.includes('review') || text.includes('confirmed')) return 'manual';
  if (text.includes('estimate') || text.includes('estimated') || text.includes('auto') || text.includes('approx')) return 'estimated';
  return 'unknown';
}

function combineProvenance(values: string[]) {
  if (values.includes("connector")) return "connector";
  if (values.includes("manual")) return "manual";
  if (values.includes("estimated")) return "estimated";
  if (values.includes("exact")) return "exact";
  return "unknown";
}

export class ReportsService {
  // List saved report snapshots for the current clinic
  async listReports(clinicId: string, options: { includeInternalNotes?: boolean } = {}) {
    const [rows]: any = await pool.execute(
      `SELECT ${reportSelectFields}
       FROM report
       WHERE clinic_id = ? AND deleted_at IS NULL
       ORDER BY updated_at DESC`,
      [clinicId],
    );

    return rows.map((row: any) => mapReportRow(row, options));
  }

  async getReport(clinicId: string, reportId: string, options: { includeInternalNotes?: boolean } = {}) {
    const [rows]: any = await pool.execute(
      `SELECT ${reportSelectFields}
       FROM report
       WHERE clinic_id = ?
         AND id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId, reportId],
    );

    if (!rows[0]) throw ApiError.notFound("Report not found");
    return mapReportRow(rows[0], options);
  }

  async createReportShare(clinicId: string, userId: string, reportId: string) {
    await this.getReport(clinicId, reportId);

    const rawToken = generateResetToken();
    const tokenHash = hashToken(rawToken);
    const shareId = uuidv4();

    await pool.execute(
      `INSERT INTO report_share
        (id, clinic_id, report_id, token_hash, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [shareId, clinicId, reportId, tokenHash, userId],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "REPORT_SHARE_CREATED",
      entityType: "report",
      entityId: reportId,
      changes: { shareId },
    });

    return {
      id: shareId,
      reportId,
      token: rawToken,
      createdAt: new Date().toISOString(),
    };
  }

  async getSharedReport(token: string) {
    const tokenHash = hashToken(token);
    const [rows]: any = await pool.execute(
      `SELECT r.id,
              r.name,
              r.type,
              r.description,
              r.filters,
              r.data,
              r.workflow_status as workflowStatus,
              r.client_commentary as clientCommentary,
              r.ai_draft_summary as aiDraftSummary,
              r.approved_by as approvedBy,
              r.approved_at as approvedAt,
              r.published_at as publishedAt,
              r.created_at as createdAt,
              r.updated_at as updatedAt,
              rs.id as shareId,
              rs.clinic_id as clinicId
       FROM report_share rs
       JOIN report r
         ON r.id = rs.report_id
        AND r.clinic_id = rs.clinic_id
        AND r.deleted_at IS NULL
       WHERE rs.token_hash = ?
         AND rs.revoked_at IS NULL
         AND rs.deleted_at IS NULL
         AND (rs.expires_at IS NULL OR rs.expires_at > CURRENT_TIMESTAMP)
       LIMIT 1`,
      [tokenHash],
    );

    if (!rows[0]) throw ApiError.notFound("Shared report not found");

    await pool.execute(
      `UPDATE report_share
       SET last_accessed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [rows[0].shareId],
    );

    return mapReportRow(rows[0], { publicView: true });
  }

  async updateReportWorkflow(
    clinicId: string,
    userId: string,
    reportId: string,
    payload: {
      workflowStatus?: ReportWorkflowStatus;
      internalNotes?: string | null;
      clientCommentary?: string | null;
      aiDraftSummary?: string | null;
    },
  ) {
    const existing = await this.getReport(clinicId, reportId);
    const assignments: string[] = [];
    const values: any[] = [];

    if (Object.prototype.hasOwnProperty.call(payload, "workflowStatus")) {
      assignments.push("workflow_status = ?");
      values.push(payload.workflowStatus);

      if (payload.workflowStatus === "approved") {
        assignments.push("approved_by = ?", "approved_at = CURRENT_TIMESTAMP");
        values.push(userId);
      }

      if (payload.workflowStatus === "published") {
        assignments.push("published_at = CURRENT_TIMESTAMP");
        if (!existing.approvedAt) {
          assignments.push("approved_by = ?", "approved_at = CURRENT_TIMESTAMP");
          values.push(userId);
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(payload, "internalNotes")) {
      assignments.push("internal_notes = ?");
      values.push(payload.internalNotes || null);
    }

    if (Object.prototype.hasOwnProperty.call(payload, "clientCommentary")) {
      assignments.push("client_commentary = ?");
      values.push(payload.clientCommentary || null);
    }

    if (Object.prototype.hasOwnProperty.call(payload, "aiDraftSummary")) {
      assignments.push("ai_draft_summary = ?");
      values.push(payload.aiDraftSummary || null);
    }

    if (assignments.length > 0) {
      await pool.execute(
        `UPDATE report
         SET ${assignments.join(", ")},
             updated_at = CURRENT_TIMESTAMP
         WHERE clinic_id = ?
           AND id = ?
           AND deleted_at IS NULL`,
        [...values, clinicId, reportId],
      );

      await logAuditEvent({
        clinicId,
        userId,
        action: "REPORT_WORKFLOW_UPDATED",
        entityType: "report",
        entityId: reportId,
        changes: payload,
      });
    }

    return this.getReport(clinicId, reportId);
  }

  async getDashboardSummary(clinicId: string, query: { startDate?: string; endDate?: string } = {}) {
    const range = getDateRange(query);
    const dateFilter = buildDateRangeClause("{column}", range);
    const spendFilter = buildSpendOverlapClause(range);

    const [leadRows, activityRows, callRows, appointmentRows, consultRows, spendRows, depositRows, planRows, dealRows]: any[] = await Promise.all([
      pool.execute(
        `SELECT COUNT(*) as leads, COALESCE(SUM(value), 0) as leadValue
         FROM contact c
         WHERE c.clinic_id = ?
           AND c.deleted_at IS NULL${dateFilter.sql.replaceAll("{column}", "c.created_at")}`,
        [clinicId, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT COUNT(*) as activities
         FROM activity a
         WHERE a.clinic_id = ?
           AND a.deleted_at IS NULL${dateFilter.sql.replaceAll("{column}", "a.timestamp")}`,
        [clinicId, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT COUNT(*) as totalCalls,
                SUM(CASE WHEN cl.missed_call = 1 THEN 1 ELSE 0 END) as missedCalls
         FROM \` call \` cl
         WHERE cl.clinic_id = ?
           AND cl.deleted_at IS NULL${dateFilter.sql.replaceAll("{column}", "cl.created_at")}`,
        [clinicId, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT COUNT(*) as appointments,
                SUM(CASE WHEN a.status = 'Completed' THEN 1 ELSE 0 END) as attendedConsults,
                SUM(CASE WHEN a.status = 'NoShow' THEN 1 ELSE 0 END) as noShows
         FROM appointment a
         WHERE a.clinic_id = ?
           AND a.deleted_at IS NULL${dateFilter.sql.replaceAll("{column}", "a.date_time")}`,
        [clinicId, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT COUNT(*) as consults,
                SUM(CASE WHEN mce.outcome = 'Treatment Booked' THEN 1 ELSE 0 END) as bookedConsults,
                SUM(CASE WHEN mce.outcome = 'Treatment Booked' THEN 1 ELSE 0 END) as soldTreatments,
                COALESCE(SUM(CASE WHEN mce.outcome = 'Treatment Booked' THEN mce.revenue ELSE 0 END), 0) as revenue
         FROM manual_consult_entry mce
         WHERE mce.clinic_id = ?
           AND mce.deleted_at IS NULL${dateFilter.sql.replaceAll("{column}", "mce.consult_date")}`,
        [clinicId, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT COUNT(*) as spendEntries,
                COALESCE(SUM(mse.amount), 0) as spend
         FROM manual_spend_entry mse
         WHERE mse.clinic_id = ?
           AND mse.deleted_at IS NULL${spendFilter.sql}`,
        [clinicId, ...spendFilter.values],
      ),
      pool.execute(
        `SELECT COUNT(*) as depositsPaid,
                COALESCE(SUM(deposit_amount), 0) as depositRevenue
         FROM deposit_record dr
         WHERE dr.clinic_id = ?
           AND dr.deleted_at IS NULL
           AND dr.deposit_paid = 1${dateFilter.sql.replaceAll("{column}", "COALESCE(dr.paid_date, dr.created_at)")}`,
        [clinicId, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT COUNT(*) as activeTreatmentPlans,
                COALESCE(SUM(total_value), 0) as treatmentPlanValue
         FROM treatment_plan tp
         WHERE tp.clinic_id = ?
           AND tp.deleted_at IS NULL
           AND tp.status <> 'archived'${dateFilter.sql.replaceAll("{column}", "tp.created_at")}`,
        [clinicId, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT COUNT(*) as openDeals,
                COALESCE(SUM(value), 0) as openDealValue,
                COALESCE(SUM(CASE WHEN status = 'won' THEN value ELSE 0 END), 0) as wonDealValue
         FROM deal d
         WHERE d.clinic_id = ?
           AND d.deleted_at IS NULL${dateFilter.sql.replaceAll("{column}", "d.created_at")}`,
        [clinicId, ...dateFilter.values],
      ),
    ]);

    const leadRow = leadRows[0]?.[0] || {};
    const activityRow = activityRows[0]?.[0] || {};
    const callRow = callRows[0]?.[0] || {};
    const appointmentRow = appointmentRows[0]?.[0] || {};
    const consultRow = consultRows[0]?.[0] || {};
    const spendRow = spendRows[0]?.[0] || {};
    const depositRow = depositRows[0]?.[0] || {};
    const planRow = planRows[0]?.[0] || {};
    const dealRow = dealRows[0]?.[0] || {};

    const leads = Number(leadRow.leads || 0);
    const consultRevenue = Number(consultRow.revenue || 0);
    const depositRevenue = Number(depositRow.depositRevenue || 0);
    const totalRevenue = consultRevenue + depositRevenue + Number(dealRow.wonDealValue || 0);
    const spend = Number(spendRow.spend || 0);
    // Determine spend provenance from manual spend attribution labels overlapping the date range
    const [spendLabelRows]: any = await pool.execute(
      `SELECT COUNT(*) as spendCount,
              SUM(CASE WHEN attribution_label LIKE 'connector:%' THEN 1 ELSE 0 END) as connectorCount,
              SUM(CASE WHEN attribution_label LIKE '%estimate%' OR attribution_label LIKE '%auto%' OR attribution_label LIKE '%approx%' THEN 1 ELSE 0 END) as estimatedCount
       FROM manual_spend_entry mse
       WHERE mse.clinic_id = ?
         AND mse.deleted_at IS NULL${spendFilter.sql}`,
      [clinicId, ...spendFilter.values],
    );
    const spendCount = Number(spendLabelRows[0]?.spendCount || 0);
    const connectorSpendCount = Number(spendLabelRows[0]?.connectorCount || 0);
    const estimatedSpendCount = Number(spendLabelRows[0]?.estimatedCount || 0);
    const manualSpendCount = Math.max(0, spendCount - connectorSpendCount - estimatedSpendCount);
    const spendProvenanceComputed = combineProvenance([
      ...(connectorSpendCount > 0 ? ["connector"] : []),
      ...(manualSpendCount > 0 ? ["manual"] : []),
      ...(estimatedSpendCount > 0 ? ["estimated"] : []),
      ...(spend > 0 && spendCount === 0 ? ["manual"] : []),
    ]);

    // Provenance: classify metrics as 'exact' | 'manual' | 'estimated' | 'unknown'
    const consultRevenueProvenance = consultRevenue > 0 ? 'manual' : 'unknown';
    const depositRevenueProvenance = depositRevenue > 0 ? 'exact' : 'unknown';
    const spendProvenance = spendProvenanceComputed;
    const leadValueProvenance = Number(leadRow.leadValue || 0) > 0 ? 'estimated' : 'unknown';

    return {
      range,
      cards: {
        leads,
        activities: Number(activityRow.activities || 0),
        totalCalls: Number(callRow.totalCalls || 0),
        missedCalls: Number(callRow.missedCalls || 0),
        appointments: Number(appointmentRow.appointments || 0),
        noShows: Number(appointmentRow.noShows || 0),
        consults: Number(consultRow.consults || 0),
        bookedConsults: Number(consultRow.bookedConsults || 0),
        attendedConsults: Number(appointmentRow.attendedConsults || 0),
        soldTreatments: Number(consultRow.soldTreatments || 0),
        activeTreatmentPlans: Number(planRow.activeTreatmentPlans || 0),
        openDeals: Number(dealRow.openDeals || 0),
        depositsPaid: Number(depositRow.depositsPaid || 0),
      },
      financials: {
        leadValue: Number(leadRow.leadValue || 0),
        leadValueProvenance,
        treatmentPlanValue: Number(planRow.treatmentPlanValue || 0),
        openDealValue: Number(dealRow.openDealValue || 0),
        wonDealValue: Number(dealRow.wonDealValue || 0),
        consultRevenue,
        consultRevenueProvenance,
        depositRevenue,
        depositRevenueProvenance,
        totalRevenue,
        spend,
        spendProvenance,
        roas: divideMetric(totalRevenue, spend),
        costPerLead: divideMetric(spend, leads),
        costPerBookedConsult: divideMetric(spend, Number(consultRow.bookedConsults || 0)),
        costPerAttendedConsult: divideMetric(spend, Number(appointmentRow.attendedConsults || 0)),
        costPerSoldTreatment: divideMetric(spend, Number(consultRow.soldTreatments || 0)),
      },
      emptyState:
        leads === 0 &&
        Number(callRow.totalCalls || 0) === 0 &&
        Number(appointmentRow.appointments || 0) === 0 &&
        Number(consultRow.consults || 0) === 0 &&
        spend === 0 &&
        Number(dealRow.openDeals || 0) === 0,
    };
  }

  async getDashboardFunnel(clinicId: string, query: { startDate?: string; endDate?: string } = {}) {
    const range = getDateRange(query);
    const dateFilter = buildDateRangeClause("{column}", range);

    const [leadRows, contactRows, bookedRows, attendedRows, soldRows]: any[] = await Promise.all([
      pool.execute(
        `SELECT COUNT(*) as leads
         FROM contact c
         WHERE c.clinic_id = ?
           AND c.deleted_at IS NULL${dateFilter.sql.replaceAll("{column}", "c.created_at")}`,
        [clinicId, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT COUNT(*) as contactedLeads
         FROM contact c
         WHERE c.clinic_id = ?
           AND c.deleted_at IS NULL
           AND c.first_response_at IS NOT NULL${dateFilter.sql.replaceAll("{column}", "c.created_at")}`,
        [clinicId, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT COUNT(*) as bookedConsults
         FROM appointment a
         WHERE a.clinic_id = ?
           AND a.deleted_at IS NULL
           AND a.status IN ('Scheduled', 'Completed', 'NoShow')${dateFilter.sql.replaceAll("{column}", "a.date_time")}`,
        [clinicId, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT COUNT(*) as attendedConsults
         FROM appointment a
         WHERE a.clinic_id = ?
           AND a.deleted_at IS NULL
           AND a.status = 'Completed'${dateFilter.sql.replaceAll("{column}", "a.date_time")}`,
        [clinicId, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT COUNT(*) as soldTreatments
         FROM manual_consult_entry mce
         WHERE mce.clinic_id = ?
           AND mce.deleted_at IS NULL
           AND mce.outcome = 'Treatment Booked'${dateFilter.sql.replaceAll("{column}", "mce.consult_date")}`,
        [clinicId, ...dateFilter.values],
      ),
    ]);

    const leads = Number(leadRows[0]?.[0]?.leads || 0);
    const contactedLeads = Number(contactRows[0]?.[0]?.contactedLeads || 0);
    const bookedConsults = Number(bookedRows[0]?.[0]?.bookedConsults || 0);
    const attendedConsults = Number(attendedRows[0]?.[0]?.attendedConsults || 0);
    const soldTreatments = Number(soldRows[0]?.[0]?.soldTreatments || 0);

    return {
      range,
      funnel: [
        { key: "leads", label: "Leads", count: leads, rate: 100 },
        { key: "contactedLeads", label: "Contacted Leads", count: contactedLeads, rate: divideMetric(contactedLeads * 100, leads) },
        { key: "bookedConsults", label: "Booked Consults", count: bookedConsults, rate: divideMetric(bookedConsults * 100, leads) },
        { key: "attendedConsults", label: "Attended Consults", count: attendedConsults, rate: divideMetric(attendedConsults * 100, bookedConsults) },
        { key: "soldTreatments", label: "Sold Treatments", count: soldTreatments, rate: divideMetric(soldTreatments * 100, attendedConsults) },
      ],
      provenance: {
        leads: leads > 0 ? 'exact' : 'unknown',
        contactedLeads: contactedLeads > 0 ? 'exact' : 'unknown',
        bookedConsults: bookedConsults > 0 ? 'exact' : 'unknown',
        attendedConsults: attendedConsults > 0 ? 'exact' : 'unknown',
        soldTreatments: soldTreatments > 0 ? 'manual' : 'unknown',
      },
      conversionRates: {
        leadToContactRate: divideMetric(contactedLeads * 100, leads),
        leadToBookedRate: divideMetric(bookedConsults * 100, leads),
        bookedToAttendedRate: divideMetric(attendedConsults * 100, bookedConsults),
        attendedToSoldRate: divideMetric(soldTreatments * 100, attendedConsults),
      },
      emptyState: leads === 0,
    };
  }

  async getRevenueByChannel(clinicId: string, query: { startDate?: string; endDate?: string } = {}) {
    const range = getDateRange(query);
    const spendFilter = buildSpendOverlapClause(range);
    const [rows]: any = await pool.execute(
      `SELECT mse.id, mse.source, mse.channel, mse.campaign, mse.amount, mse.period,
              mse.start_date as startDate, mse.end_date as endDate,
              mse.attribution_label as attributionLabel, mse.notes
       FROM manual_spend_entry mse
       WHERE mse.clinic_id = ?
         AND mse.deleted_at IS NULL${spendFilter.sql}
       ORDER BY mse.created_at DESC`,
      [clinicId, ...spendFilter.values],
    );

    const entries = await Promise.all(rows.map(async (entry: any) => {
      const source = entry.source;
      const dateFilter = buildDateRangeClause("{column}", range);
      const [leadRows]: any = await pool.execute(
        `SELECT COUNT(*) as leads
         FROM contact c
         WHERE c.clinic_id = ?
           AND c.deleted_at IS NULL
           AND (c.source = ? OR ? IS NULL)${dateFilter.sql.replaceAll("{column}", "c.created_at")}`,
        [clinicId, source, source, ...dateFilter.values],
      );
      const [appointmentRows]: any = await pool.execute(
        `SELECT
            SUM(CASE WHEN a.status IN ('Scheduled', 'Completed', 'NoShow') THEN 1 ELSE 0 END) as bookedConsults,
            SUM(CASE WHEN a.status = 'Completed' THEN 1 ELSE 0 END) as attendedConsults
         FROM appointment a
         JOIN contact c ON c.id = a.contact_id
         WHERE a.clinic_id = ?
           AND a.deleted_at IS NULL
           AND (c.source = ? OR ? IS NULL)${dateFilter.sql.replaceAll("{column}", "a.date_time")}`,
        [clinicId, source, source, ...dateFilter.values],
      );
      const [consultRows]: any = await pool.execute(
        `SELECT COUNT(*) as soldTreatments,
                COALESCE(SUM(revenue), 0) as revenue
         FROM manual_consult_entry mce
         LEFT JOIN contact c ON c.id = mce.contact_id
         WHERE mce.clinic_id = ?
           AND mce.deleted_at IS NULL
           AND mce.outcome IN ('sold', 'treatment_booked', 'Treatment Booked')
           AND (c.source = ? OR ? IS NULL OR mce.contact_id IS NULL)${dateFilter.sql.replaceAll("{column}", "mce.consult_date")}`,
        [clinicId, source, source, ...dateFilter.values],
      );

      const spend = Number(entry.amount || 0);
      const leads = Number(leadRows[0]?.leads || 0);
      const bookedConsults = Number(appointmentRows[0]?.bookedConsults || 0);
      const attendedConsults = Number(appointmentRows[0]?.attendedConsults || 0);
      const soldTreatments = Number(consultRows[0]?.soldTreatments || 0);
      const revenue = Number(consultRows[0]?.revenue || 0);

      // Determine provenance from attribution label where present
      const labelProv = classifyAttributionLabel(entry.attributionLabel);
      const spendProv = labelProv === 'unknown' ? (spend > 0 && (leads > 0 || bookedConsults > 0 || revenue > 0) ? 'manual' : (spend > 0 ? 'estimated' : 'unknown')) : labelProv;
      const revenueProv = revenue > 0 ? 'manual' : 'unknown';

      return {
        source: entry.source,
        channel: entry.channel || entry.source,
        campaign: entry.campaign,
        period: entry.period,
        spend,
        leads,
        bookedConsults,
        attendedConsults,
        soldTreatments,
        revenue,
        roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : 0,
        costPerLead: divideMetric(spend, leads),
        costPerBookedConsult: divideMetric(spend, bookedConsults),
        costPerAttendedConsult: divideMetric(spend, attendedConsults),
        costPerSoldTreatment: divideMetric(spend, soldTreatments),
        attribution: entry.attributionLabel || "manual_or_estimated",
        provenance: {
          spend: spendProv,
          revenue: revenueProv,
          leads: leads > 0 ? 'exact' : 'unknown',
        },
      };
    }));

    const bySourceMap = new Map<string, any>();
    for (const row of entries) {
      const key = String(row.source || "Unknown");
      const current = bySourceMap.get(key) || {
        source: row.source,
        channel: row.channel,
        spend: 0,
        leads: 0,
        bookedConsults: 0,
        attendedConsults: 0,
        soldTreatments: 0,
        revenue: 0,
        attribution: row.attribution,
        provenance: {
          spend: row.provenance?.spend || "unknown",
          revenue: row.provenance?.revenue || "unknown",
          leads: row.provenance?.leads || "unknown",
        },
      };

      current.spend += Number(row.spend || 0);
      current.leads += Number(row.leads || 0);
      current.bookedConsults += Number(row.bookedConsults || 0);
      current.attendedConsults += Number(row.attendedConsults || 0);
      current.soldTreatments += Number(row.soldTreatments || 0);
      current.revenue += Number(row.revenue || 0);
      current.roas = current.spend > 0 ? Number((current.revenue / current.spend).toFixed(2)) : 0;
      current.costPerLead = divideMetric(current.spend, current.leads);
      current.costPerBookedConsult = divideMetric(current.spend, current.bookedConsults);
      current.costPerAttendedConsult = divideMetric(current.spend, current.attendedConsults);
      current.costPerSoldTreatment = divideMetric(current.spend, current.soldTreatments);
      current.provenance = {
        spend: combineProvenance([
          current.provenance?.spend || "unknown",
          row.provenance?.spend || "unknown",
        ]),
        revenue: combineProvenance([
          current.provenance?.revenue || "unknown",
          row.provenance?.revenue || "unknown",
        ]),
        leads: combineProvenance([
          current.provenance?.leads || "unknown",
          row.provenance?.leads || "unknown",
        ]),
      };
      bySourceMap.set(key, current);
    }

    const bySource = [...bySourceMap.values()].sort((left, right) => Number(right.revenue || 0) - Number(left.revenue || 0));
    const totalSpend = sumNumber(entries, "spend");
    const totalRevenue = sumNumber(entries, "revenue");
    const sourceProvs = bySource.map((s: any) => s.provenance?.spend || 'unknown');
    const totalsSpendProv = combineProvenance(sourceProvs);
    const sourceRevenueProvs = bySource.map((s: any) => s.provenance?.revenue || 'unknown');
    const totalsRevenueProv = combineProvenance(sourceRevenueProvs);

    return {
      range,
      totals: {
        spend: totalSpend,
        revenue: totalRevenue,
        roas: totalSpend > 0 ? Number((totalRevenue / totalSpend).toFixed(2)) : 0,
        costPerLead: divideMetric(totalSpend, sumNumber(entries, "leads")),
        costPerBookedConsult: divideMetric(totalSpend, sumNumber(entries, "bookedConsults")),
        costPerAttendedConsult: divideMetric(totalSpend, sumNumber(entries, "attendedConsults")),
        costPerSoldTreatment: divideMetric(totalSpend, sumNumber(entries, "soldTreatments")),
        provenance: {
          spend: totalsSpendProv,
          revenue: totalsRevenueProv,
        },
      },
      bySource,
      byCampaign: entries,
      emptyState: entries.length === 0,
    };
  }

  async getRevenueByTreatment(clinicId: string, query: { startDate?: string; endDate?: string } = {}) {
    const range = getDateRange(query);
    const dateFilter = buildDateRangeClause("{column}", range);
    const [rows]: any = await pool.execute(
      `SELECT COALESCE(mce.treatment, 'Unknown') as treatment,
              COALESCE(tc.category, 'Other') as category,
              COUNT(*) as soldTreatments,
              COALESCE(SUM(mce.revenue), 0) as revenue,
              COALESCE(AVG(mce.revenue), 0) as averageRevenue,
              COALESCE(tc.average_value_cents, 0) as averageValueCents,
              COALESCE(tc.margin_percent, 0) as marginPercent,
              COALESCE(tc.is_high_ticket, 0) as isHighTicket
       FROM manual_consult_entry mce
       LEFT JOIN treatment_catalog tc
         ON tc.clinic_id = mce.clinic_id
        AND tc.deleted_at IS NULL
        AND tc.name = mce.treatment
       WHERE mce.clinic_id = ?
         AND mce.deleted_at IS NULL
         AND mce.outcome = 'Treatment Booked'${dateFilter.sql.replaceAll("{column}", "mce.consult_date")}
       GROUP BY COALESCE(mce.treatment, 'Unknown'), COALESCE(tc.category, 'Other'), tc.average_value_cents, tc.margin_percent, tc.is_high_ticket
       ORDER BY revenue DESC, soldTreatments DESC, treatment ASC`,
      [clinicId, ...dateFilter.values],
    );

    const byTreatment = rows.map((row: any) => ({
      treatment: row.treatment,
      category: row.category,
      soldTreatments: Number(row.soldTreatments || 0),
      revenue: Number(row.revenue || 0),
      averageRevenue: Number(row.averageRevenue || 0),
      averageValueCents: Number(row.averageValueCents || 0),
      marginPercent: Number(row.marginPercent || 0),
      isHighTicket: Boolean(row.isHighTicket),
      provenance: {
        soldTreatments: Number(row.soldTreatments || 0) > 0 ? 'manual' : 'unknown',
        revenue: Number(row.revenue || 0) > 0 ? 'manual' : 'unknown',
      },
    }));

    return {
      range,
      totals: {
        soldTreatments: sumNumber(byTreatment, "soldTreatments"),
        revenue: sumNumber(byTreatment, "revenue"),
        provenance: {
          revenue: sumNumber(byTreatment, "revenue") > 0 ? 'manual' : 'unknown',
        },
      },
      byTreatment,
      emptyState: byTreatment.length === 0,
    };
  }

  async getTreatmentPerformanceDetail(
    clinicId: string,
    treatmentName: string,
    query: { startDate?: string; endDate?: string } = {},
  ) {
    const treatment = treatmentName.trim();
    if (!treatment) throw ApiError.badRequest("Treatment name is required");

    const range = getDateRange(query);
    const dateFilter = buildDateRangeClause("{column}", range);
    const spendFilter = buildSpendOverlapClause(range);
    const treatmentValue = treatment.toLowerCase();
    const treatmentMatchSql = "LOWER(TRIM(COALESCE({column}, ''))) = ?";
    const treatmentMatchValue = [treatmentValue];

    const [catalogRows, leadRows, appointmentRows, consultRows, planRows, depositRows, dealRows]: any[] = await Promise.all([
      pool.execute(
        `SELECT id, name, description, category, duration_minutes as durationMinutes,
                price_cents as priceCents, average_value_cents as averageValueCents,
                margin_percent as marginPercent, priority, is_high_ticket as isHighTicket,
                status
         FROM treatment_catalog
         WHERE clinic_id = ?
           AND deleted_at IS NULL
           AND ${treatmentMatchSql.replace("{column}", "name")}
         LIMIT 1`,
        [clinicId, ...treatmentMatchValue],
      ),
      pool.execute(
        `SELECT c.id, c.first_name as firstName, c.last_name as lastName, c.email, c.phone,
                c.source, c.status, c.value, c.treatment_interests as treatmentInterests,
                c.created_at as createdAt
         FROM contact c
         WHERE c.clinic_id = ?
           AND c.deleted_at IS NULL
           AND JSON_CONTAINS(COALESCE(c.treatment_interests, JSON_ARRAY()), JSON_QUOTE(?))
           ${dateFilter.sql.replaceAll("{column}", "c.created_at")}
         ORDER BY c.created_at DESC
         LIMIT 100`,
        [clinicId, treatment, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT a.id, a.contact_id as contactId, a.date_time as dateTime, a.status,
                a.treatment, a.value, a.no_show_reason as noShowReason,
                c.first_name as firstName, c.last_name as lastName, c.email, c.phone, c.source
         FROM appointment a
         LEFT JOIN contact c
           ON c.id = a.contact_id
          AND c.clinic_id = a.clinic_id
          AND c.deleted_at IS NULL
         WHERE a.clinic_id = ?
           AND a.deleted_at IS NULL
           AND ${treatmentMatchSql.replace("{column}", "a.treatment")}
           ${dateFilter.sql.replaceAll("{column}", "a.date_time")}
         ORDER BY a.date_time DESC
         LIMIT 100`,
        [clinicId, ...treatmentMatchValue, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT mce.id, mce.contact_id as contactId, mce.appointment_id as appointmentId,
                mce.patient_name as patientName, mce.treatment, mce.outcome, mce.revenue,
                mce.consult_date as consultDate, mce.deposit_status as depositStatus,
                mce.lost_reason as lostReason, mce.notes,
                c.first_name as firstName, c.last_name as lastName, c.email, c.phone, c.source
         FROM manual_consult_entry mce
         LEFT JOIN contact c
           ON c.id = mce.contact_id
          AND c.clinic_id = mce.clinic_id
          AND c.deleted_at IS NULL
         WHERE mce.clinic_id = ?
           AND mce.deleted_at IS NULL
           AND ${treatmentMatchSql.replace("{column}", "mce.treatment")}
           ${dateFilter.sql.replaceAll("{column}", "mce.consult_date")}
         ORDER BY mce.consult_date DESC, mce.created_at DESC
         LIMIT 100`,
        [clinicId, ...treatmentMatchValue, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT tp.id, tp.contact_name as contactName, tp.treatment, tp.total_value as totalValue,
                tp.paid, tp.outstanding, tp.status, tp.sessions,
                tp.sessions_completed as sessionsCompleted, tp.created_at as createdAt,
                tp.next_session as nextSession, tp.practitioner
         FROM treatment_plan tp
         WHERE tp.clinic_id = ?
           AND tp.deleted_at IS NULL
           AND tp.status <> 'archived'
           AND ${treatmentMatchSql.replace("{column}", "tp.treatment")}
           ${dateFilter.sql.replaceAll("{column}", "tp.created_at")}
         ORDER BY tp.created_at DESC
         LIMIT 100`,
        [clinicId, ...treatmentMatchValue, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT dr.id, dr.contact_id as contactId, dr.appointment_id as appointmentId,
                dr.contact_name as contactName, dr.treatment, dr.appointment_date as appointmentDate,
                dr.deposit_amount as depositAmount, dr.deposit_paid as depositPaid,
                dr.paid_date as paidDate, dr.payment_status as paymentStatus,
                dr.status, dr.method, dr.practitioner,
                c.first_name as firstName, c.last_name as lastName, c.email, c.phone, c.source
         FROM deposit_record dr
         LEFT JOIN contact c
           ON c.id = dr.contact_id
          AND c.clinic_id = dr.clinic_id
          AND c.deleted_at IS NULL
         WHERE dr.clinic_id = ?
           AND dr.deleted_at IS NULL
           AND ${treatmentMatchSql.replace("{column}", "dr.treatment")}
           ${dateFilter.sql.replaceAll("{column}", "COALESCE(dr.paid_date, dr.appointment_date, dr.created_at)")}
         ORDER BY COALESCE(dr.paid_date, dr.appointment_date, dr.created_at) DESC
         LIMIT 100`,
        [clinicId, ...treatmentMatchValue, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT d.id, d.contact_id as contactId, d.title, d.value, d.probability,
                d.stage, d.status, d.source, d.treatment, d.booked_at as bookedAt,
                d.sold_at as soldAt, d.lost_at as lostAt, d.lost_reason as lostReason,
                d.created_at as createdAt, d.updated_at as updatedAt,
                c.first_name as firstName, c.last_name as lastName, c.email, c.phone,
                COALESCE(d.source, c.source) as resolvedSource
         FROM deal d
         JOIN contact c
           ON c.id = d.contact_id
          AND c.clinic_id = d.clinic_id
          AND c.deleted_at IS NULL
         WHERE d.clinic_id = ?
           AND d.deleted_at IS NULL
           AND ${treatmentMatchSql.replace("{column}", "d.treatment")}
           ${dateFilter.sql.replaceAll("{column}", "d.created_at")}
         ORDER BY d.updated_at DESC
         LIMIT 100`,
        [clinicId, ...treatmentMatchValue, ...dateFilter.values],
      ),
    ]);

    const catalog = catalogRows[0]?.[0] || null;
    const leads = leadRows[0].map((row: any) => ({
      id: row.id,
      contactId: row.id,
      name: getPersonName(row),
      email: row.email || null,
      phone: row.phone || null,
      source: row.source || "Unknown source",
      status: row.status || null,
      estimatedValue: Number(row.value || 0),
      createdAt: toIsoDate(row.createdAt),
      href: buildLeadHref(row.id),
    }));
    const appointments = appointmentRows[0].map((row: any) => ({
      id: row.id,
      contactId: row.contactId || null,
      contactName: getPersonName(row),
      source: row.source || "Unknown source",
      status: row.status || "Scheduled",
      value: Number(row.value || 0),
      dateTime: toIsoDate(row.dateTime),
      noShowReason: row.noShowReason || null,
      href: buildEntityHref("appointment", row.id),
      leadHref: buildLeadHref(row.contactId || null),
    }));
    const consults = consultRows[0].map((row: any) => ({
      id: row.id,
      contactId: row.contactId || null,
      appointmentId: row.appointmentId || null,
      contactName: row.patientName || getPersonName(row),
      source: row.source || "Unknown source",
      outcome: row.outcome || "Unknown",
      revenue: Number(row.revenue || 0),
      consultDate: toIsoDate(row.consultDate),
      depositStatus: row.depositStatus || null,
      lostReason: row.lostReason || null,
      notes: row.notes || null,
      href: buildEntityHref("consult", row.id),
      appointmentHref: buildEntityHref("appointment", row.appointmentId || null),
      leadHref: buildLeadHref(row.contactId || null),
    }));
    const treatmentPlans = planRows[0].map((row: any) => ({
      id: row.id,
      contactName: row.contactName || "Unknown contact",
      totalValue: Number(row.totalValue || 0),
      paid: Number(row.paid || 0),
      outstanding: Number(row.outstanding || 0),
      status: row.status || null,
      sessions: Number(row.sessions || 0),
      sessionsCompleted: Number(row.sessionsCompleted || 0),
      createdAt: toIsoDate(row.createdAt),
      nextSession: toIsoDate(row.nextSession),
      practitioner: row.practitioner || null,
      href: buildEntityHref("treatmentPlan", row.id),
    }));
    const deposits = depositRows[0].map((row: any) => ({
      id: row.id,
      contactId: row.contactId || null,
      appointmentId: row.appointmentId || null,
      contactName: row.contactName || getPersonName(row),
      source: row.source || "Unknown source",
      depositAmount: Number(row.depositAmount || 0),
      depositPaid: !!row.depositPaid,
      paidDate: toIsoDate(row.paidDate),
      appointmentDate: toIsoDate(row.appointmentDate),
      paymentStatus: row.paymentStatus || row.status || null,
      method: row.method || null,
      practitioner: row.practitioner || null,
      href: buildEntityHref("deposit", row.id),
      appointmentHref: buildEntityHref("appointment", row.appointmentId || null),
      leadHref: buildLeadHref(row.contactId || null),
    }));
    const deals = dealRows[0].map((row: any) => ({
      id: row.id,
      contactId: row.contactId,
      title: row.title,
      contactName: getPersonName(row),
      source: row.resolvedSource || "Unknown source",
      value: Number(row.value || 0),
      probability: Number(row.probability || 0),
      stage: row.stage || null,
      status: row.status || null,
      bookedAt: toIsoDate(row.bookedAt),
      soldAt: toIsoDate(row.soldAt),
      lostAt: toIsoDate(row.lostAt),
      lostReason: row.lostReason || null,
      createdAt: toIsoDate(row.createdAt),
      href: buildEntityHref("deal", row.id),
      leadHref: buildLeadHref(row.contactId),
    }));

    const sourceKeys = Array.from(new Set([
      ...leads.map((item: any) => item.source),
      ...appointments.map((item: any) => item.source),
      ...consults.map((item: any) => item.source),
      ...deposits.map((item: any) => item.source),
      ...deals.map((item: any) => item.source),
    ].filter((source) => source && source !== "Unknown source")));

    const [spendRows]: any = sourceKeys.length > 0
      ? await pool.execute(
        `SELECT source, channel, campaign, amount, attribution_label as attributionLabel,
                start_date as startDate, end_date as endDate
         FROM manual_spend_entry mse
         WHERE mse.clinic_id = ?
           AND mse.deleted_at IS NULL
           AND mse.source IN (${sourceKeys.map(() => "?").join(",")})${spendFilter.sql}
         ORDER BY mse.created_at DESC`,
        [clinicId, ...sourceKeys, ...spendFilter.values],
      )
      : [[]];

    const sourceMap = new Map<string, any>();
    const ensureSource = (source: string) => {
      const key = source || "Unknown source";
      const current = sourceMap.get(key) || {
        source: key,
        leads: 0,
        consults: 0,
        bookedConsults: 0,
        attendedConsults: 0,
        treatmentPlans: 0,
        bookedRevenue: 0,
        completedRevenue: 0,
        spend: 0,
        campaigns: new Set<string>(),
      };
      sourceMap.set(key, current);
      return current;
    };

    for (const lead of leads) ensureSource(lead.source).leads += 1;
    for (const appointment of appointments) {
      const source = ensureSource(appointment.source);
      if (["Scheduled", "Completed", "NoShow"].includes(appointment.status)) source.bookedConsults += 1;
      if (appointment.status === "Completed") source.attendedConsults += 1;
    }
    for (const consult of consults) {
      const source = ensureSource(consult.source);
      source.consults += 1;
      if (["Treatment Booked", "sold", "treatment_booked"].includes(consult.outcome)) {
        source.bookedRevenue += consult.revenue;
      }
    }
    for (const deposit of deposits) {
      if (deposit.depositPaid) ensureSource(deposit.source).completedRevenue += deposit.depositAmount;
    }
    for (const spend of spendRows) {
      const source = ensureSource(spend.source || "Unknown source");
      source.spend += Number(spend.amount || 0);
      if (spend.campaign) source.campaigns.add(spend.campaign);
    }

    const bookedConsults = appointments.filter((item: any) => ["Scheduled", "Completed", "NoShow"].includes(item.status)).length;
    const attendedConsults = appointments.filter((item: any) => item.status === "Completed").length;
    const soldTreatments = consults.filter((item: any) => ["Treatment Booked", "sold", "treatment_booked"].includes(item.outcome)).length;
    const bookedRevenue = consults.reduce((sum: number, item: any) =>
      ["Treatment Booked", "sold", "treatment_booked"].includes(item.outcome) ? sum + item.revenue : sum,
    0);
    const completedRevenue = deposits.reduce((sum: number, item: any) => item.depositPaid ? sum + item.depositAmount : sum, 0) +
      treatmentPlans.reduce((sum: number, item: any) => sum + item.paid, 0);
    const treatmentPlanValue = treatmentPlans.reduce((sum: number, item: any) => sum + item.totalValue, 0);
    const openDealValue = deals
      .filter((item: any) => item.status === "open")
      .reduce((sum: number, item: any) => sum + item.value, 0);
    const totalSpend = spendRows.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
    const totalRevenue = bookedRevenue + completedRevenue;

    const monthlyTrend = await Promise.all(buildMonthlyTrendRanges(query).months.map(async (monthRange) => {
      const monthFilter = buildDateRangeClause("{column}", monthRange);
      const [monthLeadRows, monthAppointmentRows, monthConsultRows, monthDepositRows]: any[] = await Promise.all([
        pool.execute(
          `SELECT COUNT(*) as leads
           FROM contact c
           WHERE c.clinic_id = ?
             AND c.deleted_at IS NULL
             AND JSON_CONTAINS(COALESCE(c.treatment_interests, JSON_ARRAY()), JSON_QUOTE(?))
             ${monthFilter.sql.replaceAll("{column}", "c.created_at")}`,
          [clinicId, treatment, ...monthFilter.values],
        ),
        pool.execute(
          `SELECT COUNT(*) as bookedConsults,
                  SUM(CASE WHEN a.status = 'Completed' THEN 1 ELSE 0 END) as attendedConsults
           FROM appointment a
           WHERE a.clinic_id = ?
             AND a.deleted_at IS NULL
             AND ${treatmentMatchSql.replace("{column}", "a.treatment")}
             ${monthFilter.sql.replaceAll("{column}", "a.date_time")}`,
          [clinicId, ...treatmentMatchValue, ...monthFilter.values],
        ),
        pool.execute(
          `SELECT COUNT(*) as consults,
                  SUM(CASE WHEN outcome IN ('Treatment Booked', 'sold', 'treatment_booked') THEN 1 ELSE 0 END) as soldTreatments,
                  COALESCE(SUM(CASE WHEN outcome IN ('Treatment Booked', 'sold', 'treatment_booked') THEN revenue ELSE 0 END), 0) as bookedRevenue
           FROM manual_consult_entry mce
           WHERE mce.clinic_id = ?
             AND mce.deleted_at IS NULL
             AND ${treatmentMatchSql.replace("{column}", "mce.treatment")}
             ${monthFilter.sql.replaceAll("{column}", "mce.consult_date")}`,
          [clinicId, ...treatmentMatchValue, ...monthFilter.values],
        ),
        pool.execute(
          `SELECT COALESCE(SUM(CASE WHEN deposit_paid = 1 THEN deposit_amount ELSE 0 END), 0) as completedRevenue
           FROM deposit_record dr
           WHERE dr.clinic_id = ?
             AND dr.deleted_at IS NULL
             AND ${treatmentMatchSql.replace("{column}", "dr.treatment")}
             ${monthFilter.sql.replaceAll("{column}", "COALESCE(dr.paid_date, dr.appointment_date, dr.created_at)")}`,
          [clinicId, ...treatmentMatchValue, ...monthFilter.values],
        ),
      ]);

      return {
        month: monthRange.month,
        leads: Number(monthLeadRows[0]?.[0]?.leads || 0),
        bookedConsults: Number(monthAppointmentRows[0]?.[0]?.bookedConsults || 0),
        attendedConsults: Number(monthAppointmentRows[0]?.[0]?.attendedConsults || 0),
        consults: Number(monthConsultRows[0]?.[0]?.consults || 0),
        soldTreatments: Number(monthConsultRows[0]?.[0]?.soldTreatments || 0),
        bookedRevenue: Number(monthConsultRows[0]?.[0]?.bookedRevenue || 0),
        completedRevenue: Number(monthDepositRows[0]?.[0]?.completedRevenue || 0),
      };
    }));

    const sourceMix = [...sourceMap.values()]
      .map((item) => ({
        ...item,
        campaigns: [...item.campaigns],
        roi: divideMetric(item.bookedRevenue + item.completedRevenue, item.spend),
        provenance: {
          leads: item.leads > 0 ? "exact" : "unknown",
          revenue: item.bookedRevenue > 0 ? "manual" : item.completedRevenue > 0 ? "exact" : "unknown",
          spend: item.spend > 0 ? "manual" : "unknown",
        },
      }))
      .sort((left, right) => (right.bookedRevenue + right.completedRevenue) - (left.bookedRevenue + left.completedRevenue));

    return {
      range,
      treatment: {
        id: catalog?.id || null,
        name: catalog?.name || treatment,
        category: catalog?.category || "Other",
        description: catalog?.description || null,
        status: catalog?.status || "unknown",
        averageValueCents: Number(catalog?.averageValueCents || 0),
        priceCents: Number(catalog?.priceCents || 0),
        marginPercent: Number(catalog?.marginPercent || 0),
        isHighTicket: Boolean(catalog?.isHighTicket),
      },
      kpis: {
        leads: leads.length,
        consults: consults.length,
        bookedConsults,
        attendedConsults,
        soldTreatments,
        treatmentPlans: treatmentPlans.length,
        bookedRevenue,
        completedRevenue,
        treatmentPlanValue,
        openDealValue,
        totalRevenue,
        averageValue: divideMetric(totalRevenue, Math.max(soldTreatments, 1)),
        conversionRate: divideMetric(soldTreatments * 100, attendedConsults),
        spend: totalSpend,
        roi: divideMetric(totalRevenue, totalSpend),
        provenance: {
          leads: leads.length > 0 ? "exact" : "unknown",
          consults: consults.length > 0 ? "manual" : "unknown",
          bookedConsults: bookedConsults > 0 ? "exact" : "unknown",
          attendedConsults: attendedConsults > 0 ? "exact" : "unknown",
          bookedRevenue: bookedRevenue > 0 ? "manual" : "unknown",
          completedRevenue: completedRevenue > 0 ? "exact" : "unknown",
          treatmentPlanValue: treatmentPlanValue > 0 ? "estimated" : "unknown",
          spend: totalSpend > 0 ? "manual" : "unknown",
          roi: totalSpend > 0 && totalRevenue > 0 ? "manual" : "unknown",
        },
      },
      sections: {
        sourceMix,
        campaigns: spendRows.map((row: any) => ({
          source: row.source || "Unknown source",
          channel: row.channel || row.source || "Unknown channel",
          campaign: row.campaign || "Unassigned campaign",
          spend: Number(row.amount || 0),
          attributionLabel: row.attributionLabel || null,
          startDate: row.startDate ? new Date(row.startDate).toISOString().slice(0, 10) : null,
          endDate: row.endDate ? new Date(row.endDate).toISOString().slice(0, 10) : null,
          provenance: {
            spend: classifyAttributionLabel(row.attributionLabel) === "unknown" ? "manual" : classifyAttributionLabel(row.attributionLabel),
          },
        })),
        monthlyTrend,
      },
      records: {
        leads,
        appointments,
        consults,
        treatmentPlans,
        deposits,
        deals,
      },
      emptyState:
        leads.length === 0 &&
        appointments.length === 0 &&
        consults.length === 0 &&
        treatmentPlans.length === 0 &&
        deposits.length === 0 &&
        deals.length === 0,
    };
  }

  async getRevenueLeaks(clinicId: string, query: { startDate?: string; endDate?: string } = {}) {
    const range = getDateRange(query);
    const dateFilter = buildDateRangeClause("{column}", range);

    const [missedCallRows, slaRows, noShowRows, conversionRows]: any[] = await Promise.all([
      pool.execute(
        `SELECT COUNT(*) as count,
                COALESCE(SUM(COALESCE(c.value, 0)), 0) as estimatedRisk
         FROM \` call \` cl
         JOIN contact c ON c.id = cl.contact_id
         WHERE cl.clinic_id = ?
           AND cl.deleted_at IS NULL
           AND cl.missed_call = 1${dateFilter.sql.replaceAll("{column}", "cl.created_at")}`,
        [clinicId, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT COUNT(*) as count,
                COALESCE(SUM(value), 0) as estimatedRisk
         FROM contact c
         WHERE c.clinic_id = ?
           AND c.deleted_at IS NULL
           AND c.first_response_at IS NULL
           AND c.sla_breached_at IS NOT NULL${dateFilter.sql.replaceAll("{column}", "c.created_at")}`,
        [clinicId, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT COUNT(*) as count,
                COALESCE(SUM(value), 0) as estimatedRisk
         FROM appointment a
         WHERE a.clinic_id = ?
           AND a.deleted_at IS NULL
           AND a.status = 'NoShow'${dateFilter.sql.replaceAll("{column}", "a.date_time")}`,
        [clinicId, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT COUNT(*) as count,
                COALESCE(SUM(c.value), 0) as estimatedRisk
         FROM contact c
         LEFT JOIN manual_consult_entry mce
           ON mce.contact_id = c.id
          AND mce.clinic_id = c.clinic_id
          AND mce.deleted_at IS NULL
          AND mce.outcome = 'Treatment Booked'
         WHERE c.clinic_id = ?
           AND c.deleted_at IS NULL
           AND c.value > 0
           AND mce.id IS NULL${dateFilter.sql.replaceAll("{column}", "c.created_at")}`,
        [clinicId, ...dateFilter.values],
      ),
    ]);

    const items = [
      {
        key: "missedCalls",
        label: "Missed call risk",
        count: Number(missedCallRows[0]?.[0]?.count || 0),
        estimatedRisk: Number(missedCallRows[0]?.[0]?.estimatedRisk || 0),
      },
      {
        key: "slaBreaches",
        label: "SLA breach risk",
        count: Number(slaRows[0]?.[0]?.count || 0),
        estimatedRisk: Number(slaRows[0]?.[0]?.estimatedRisk || 0),
      },
      {
        key: "noShows",
        label: "No-show risk",
        count: Number(noShowRows[0]?.[0]?.count || 0),
        estimatedRisk: Number(noShowRows[0]?.[0]?.estimatedRisk || 0),
      },
      {
        key: "lowConsultConversion",
        label: "Low consult conversion opportunity",
        count: Number(conversionRows[0]?.[0]?.count || 0),
        estimatedRisk: Number(conversionRows[0]?.[0]?.estimatedRisk || 0),
        provenance: {
          estimatedRisk: Number(conversionRows[0]?.[0]?.estimatedRisk || 0) > 0 ? 'estimated' : 'unknown',
          count: Number(conversionRows[0]?.[0]?.count || 0) > 0 ? 'estimated' : 'unknown',
        },
      },
    ];

    return {
      range,
      items,
      totalEstimatedRisk: items.reduce((sum, item) => sum + item.estimatedRisk, 0),
      emptyState: items.every((item) => item.count === 0),
    };
  }

  async getRevenueLeakDetails(clinicId: string, query: { startDate?: string; endDate?: string } = {}) {
    const range = getDateRange(query);
    const dateFilter = buildDateRangeClause("{column}", range);
    const limit = 8;

    const [missedCallRows, slaRows, noShowRows, conversionRows]: any[] = await Promise.all([
      pool.execute(
        `SELECT cl.id,
                cl.contact_id as contactId,
                cl.source,
                cl.direction,
                cl.call_status as callStatus,
                cl.missed_recovery_status as missedRecoveryStatus,
                cl.created_at as occurredAt,
                COALESCE(c.value, 0) as estimatedRisk,
                c.first_name as firstName,
                c.last_name as lastName,
                c.email,
                c.phone,
                JSON_UNQUOTE(JSON_EXTRACT(c.treatment_interests, '$[0]')) as treatment,
                CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as ownerName
         FROM \` call \` cl
         JOIN contact c
           ON c.id = cl.contact_id
          AND c.clinic_id = cl.clinic_id
          AND c.deleted_at IS NULL
         LEFT JOIN user u
           ON u.id = cl.user_id
         WHERE cl.clinic_id = ?
           AND cl.deleted_at IS NULL
           AND cl.missed_call = 1${dateFilter.sql.replaceAll("{column}", "cl.created_at")}
         ORDER BY cl.created_at DESC
         LIMIT ${limit}`,
        [clinicId, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT c.id,
                c.id as contactId,
                c.source,
                c.value as estimatedRisk,
                c.first_name as firstName,
                c.last_name as lastName,
                c.email,
                c.phone,
                JSON_UNQUOTE(JSON_EXTRACT(c.treatment_interests, '$[0]')) as treatment,
                c.created_at as createdAt,
                c.sla_deadline_at as slaDeadlineAt,
                c.sla_breached_at as occurredAt,
                c.sla_target_minutes as slaTargetMinutes,
                TIMESTAMPDIFF(MINUTE, c.sla_deadline_at, COALESCE(c.sla_breached_at, NOW())) as breachMinutes,
                CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as ownerName
         FROM contact c
         LEFT JOIN user u
           ON u.id = c.first_response_by
         WHERE c.clinic_id = ?
           AND c.deleted_at IS NULL
           AND c.first_response_at IS NULL
           AND c.sla_breached_at IS NOT NULL${dateFilter.sql.replaceAll("{column}", "c.created_at")}
         ORDER BY c.sla_breached_at DESC, c.created_at DESC
         LIMIT ${limit}`,
        [clinicId, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT a.id,
                a.contact_id as contactId,
                a.treatment,
                a.value as appointmentValue,
                a.date_time as occurredAt,
                a.no_show_reason as reason,
                COALESCE(c.value, 0) as contactValue,
                c.source,
                c.first_name as firstName,
                c.last_name as lastName,
                c.email,
                c.phone,
                CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as ownerName
         FROM appointment a
         JOIN contact c
           ON c.id = a.contact_id
          AND c.clinic_id = a.clinic_id
          AND c.deleted_at IS NULL
         LEFT JOIN user u
           ON u.id = a.clinician_id
         WHERE a.clinic_id = ?
           AND a.deleted_at IS NULL
           AND a.status = 'NoShow'${dateFilter.sql.replaceAll("{column}", "a.date_time")}
         ORDER BY a.date_time DESC
         LIMIT ${limit}`,
        [clinicId, ...dateFilter.values],
      ),
      pool.execute(
        `SELECT c.id,
                c.id as contactId,
                c.source,
                c.value as estimatedRisk,
                c.first_name as firstName,
                c.last_name as lastName,
                c.email,
                c.phone,
                JSON_UNQUOTE(JSON_EXTRACT(c.treatment_interests, '$[0]')) as treatment,
                c.created_at as occurredAt,
                c.status,
                CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as ownerName
         FROM contact c
         LEFT JOIN manual_consult_entry mce
           ON mce.contact_id = c.id
          AND mce.clinic_id = c.clinic_id
          AND mce.deleted_at IS NULL
          AND mce.outcome = 'Treatment Booked'
         LEFT JOIN user u
           ON u.id = c.first_response_by
         WHERE c.clinic_id = ?
           AND c.deleted_at IS NULL
           AND c.value > 0
           AND mce.id IS NULL${dateFilter.sql.replaceAll("{column}", "c.created_at")}
         ORDER BY c.value DESC, c.created_at DESC
         LIMIT ${limit}`,
        [clinicId, ...dateFilter.values],
      ),
    ]);

    const missedCalls = await Promise.all(missedCallRows[0].map(async (row: any) => ({
      id: `missedCalls:${row.id}`,
      leakKey: "missedCalls",
      sourceType: "call",
      sourceId: row.id,
      contactId: row.contactId,
      contactName: getPersonName(row),
      contactPhone: row.phone || null,
      source: row.source || "Call log",
      treatment: row.treatment || "Consultation",
      ownerName: row.ownerName?.trim() || "Unassigned",
      occurredAt: toIsoDate(row.occurredAt),
      estimatedRisk: Number(row.estimatedRisk || 0),
      riskLabel: "estimated",
      status: row.missedRecoveryStatus || row.callStatus || "missed",
      reason: "Inbound call was missed before a booked consult was confirmed.",
      nextAction: "Call back, log the outcome, and assign a follow-up owner.",
      context: await this.getLeakRecordContext(clinicId, {
        contactId: row.contactId,
        dedupeKey: `revenue-leak:missedCalls:call:${row.id}`,
        email: row.email,
        leakKey: "missedCalls",
        phone: row.phone,
        sourceId: row.id,
        sourceType: "call",
      }),
    })));

    const slaBreaches = await Promise.all(slaRows[0].map(async (row: any) => ({
      id: `slaBreaches:${row.id}`,
      leakKey: "slaBreaches",
      sourceType: "contact",
      sourceId: row.id,
      contactId: row.contactId,
      contactName: getPersonName(row),
      contactPhone: row.phone || null,
      source: row.source || "Unknown source",
      treatment: row.treatment || "Consultation",
      ownerName: row.ownerName?.trim() || "Unassigned",
      occurredAt: toIsoDate(row.occurredAt),
      estimatedRisk: Number(row.estimatedRisk || 0),
      riskLabel: "estimated",
      status: "breached",
      reason: `${Math.max(Number(row.breachMinutes || 0), 0)} minutes past SLA target.`,
      nextAction: "Contact the lead and review ownership for similar new enquiries.",
      context: await this.getLeakRecordContext(clinicId, {
        contactId: row.contactId,
        dedupeKey: `revenue-leak:slaBreaches:contact:${row.id}`,
        email: row.email,
        leakKey: "slaBreaches",
        phone: row.phone,
        sourceId: row.id,
        sourceType: "contact",
      }),
    })));

    const noShows = await Promise.all(noShowRows[0].map(async (row: any) => ({
      id: `noShows:${row.id}`,
      leakKey: "noShows",
      sourceType: "appointment",
      sourceId: row.id,
      contactId: row.contactId,
      contactName: getPersonName(row),
      contactPhone: row.phone || null,
      source: row.source || "Unknown source",
      treatment: row.treatment || "Consultation",
      ownerName: row.ownerName?.trim() || "Clinic user",
      occurredAt: toIsoDate(row.occurredAt),
      estimatedRisk: Number(row.appointmentValue || row.contactValue || 0),
      riskLabel: "estimated",
      status: "no_show",
      reason: row.reason || "No-show reason not recorded.",
      nextAction: "Rebook the consult and add no-show prevention follow-up.",
      context: await this.getLeakRecordContext(clinicId, {
        contactId: row.contactId,
        dedupeKey: `revenue-leak:noShows:appointment:${row.id}`,
        email: row.email,
        leakKey: "noShows",
        phone: row.phone,
        sourceId: row.id,
        sourceType: "appointment",
      }),
    })));

    const lowConsultConversion = await Promise.all(conversionRows[0].map(async (row: any) => ({
      id: `lowConsultConversion:${row.id}`,
      leakKey: "lowConsultConversion",
      sourceType: "contact",
      sourceId: row.id,
      contactId: row.contactId,
      contactName: getPersonName(row),
      contactPhone: row.phone || null,
      source: row.source || "Unknown source",
      treatment: row.treatment || "Consultation",
      ownerName: row.ownerName?.trim() || "Unassigned",
      occurredAt: toIsoDate(row.occurredAt),
      estimatedRisk: Number(row.estimatedRisk || 0),
      riskLabel: "estimated",
      status: row.status || "open",
      reason: "No sold treatment has been recorded for this valued enquiry.",
      nextAction: "Check consult outcome, lost reason, and next follow-up step.",
      context: await this.getLeakRecordContext(clinicId, {
        contactId: row.contactId,
        dedupeKey: `revenue-leak:lowConsultConversion:contact:${row.id}`,
        email: row.email,
        leakKey: "lowConsultConversion",
        phone: row.phone,
        sourceId: row.id,
        sourceType: "contact",
      }),
    })));

    const items = {
      missedCalls,
      slaBreaches,
      noShows,
      lowConsultConversion,
    };

    return {
      range,
      items,
      counts: {
        missedCalls: missedCalls.length,
        slaBreaches: slaBreaches.length,
        noShows: noShows.length,
        lowConsultConversion: lowConsultConversion.length,
      },
      emptyState: Object.values(items).every((records) => records.length === 0),
    };
  }

  async getTopOpportunities(clinicId: string, query: { startDate?: string; endDate?: string } = {}) {
    const range = getDateRange(query);
    const deals = await pipelineDealsService.listDeals(clinicId);
    const topDeals = deals.deals
      .filter((deal) => {
        if (!query.startDate && !query.endDate) return deal.status === "open";
        const createdAt = toDateOnly(deal.createdAt);
        if (!createdAt) return false;
        return createdAt >= range.startDate && createdAt <= range.endDate && deal.status === "open";
      })
      .sort((left, right) => Number(right.valueCents || 0) - Number(left.valueCents || 0))
      .slice(0, 10)
      .map((deal) => ({
        ...deal,
        priorityScore: Math.round((deal.valueCents || 0) * (deal.probability / 100)),
      }));

    return {
      range,
      summary: deals.summary,
      deals: topDeals,
      emptyState: topDeals.length === 0,
    };
  }

  async getMonthlyTrend(clinicId: string, query: { startDate?: string; endDate?: string } = {}) {
    const { range, months } = buildMonthlyTrendRanges(query);
    const items = await Promise.all(months.map(async (monthRange) => {
      const [summary, leaks] = await Promise.all([
        this.getDashboardSummary(clinicId, monthRange),
        this.getRevenueLeaks(clinicId, monthRange),
      ]);

      const bookedConsults = Number(summary.cards.bookedConsults || 0);
      const attendedConsults = Number(summary.cards.attendedConsults || 0);
      const soldTreatments = Number(summary.cards.soldTreatments || 0);

      return {
        month: monthRange.month,
        range: {
          startDate: monthRange.startDate,
          endDate: monthRange.endDate,
        },
        leads: Number(summary.cards.leads || 0),
        bookedConsults,
        attendedConsults,
        soldTreatments,
        conversionRate: divideMetric(soldTreatments * 100, attendedConsults),
        estimatedRevenue: Number(summary.financials.leadValue || 0),
        treatmentRevenue: Number(summary.financials.consultRevenue || 0),
        totalRevenue: Number(summary.financials.totalRevenue || 0),
        spend: Number(summary.financials.spend || 0),
        roas: Number(summary.financials.roas || 0),
        cpl: Number(summary.financials.costPerLead || 0),
        costPerBookedConsult: Number(summary.financials.costPerBookedConsult || 0),
        missedOpportunities: leaks.items.reduce((sum, item) => sum + Number(item.count || 0), 0),
        estimatedRisk: Number(leaks.totalEstimatedRisk || 0),
        provenance: {
          estimatedRevenue: summary.financials.leadValueProvenance || "unknown",
          treatmentRevenue: summary.financials.consultRevenueProvenance || "unknown",
          spend: summary.financials.spendProvenance || "unknown",
          estimatedRisk: Number(leaks.totalEstimatedRisk || 0) > 0 ? "estimated" : "unknown",
        },
      };
    }));

    return {
      range,
      items,
      emptyState: items.every((item) =>
        item.leads === 0 &&
        item.bookedConsults === 0 &&
        item.attendedConsults === 0 &&
        item.soldTreatments === 0 &&
        item.totalRevenue === 0 &&
        item.spend === 0 &&
        item.missedOpportunities === 0,
      ),
    };
  }

  async getRiskOpportunitySections(clinicId: string, query: { startDate?: string; endDate?: string } = {}) {
    const [leakDetails, opportunities] = await Promise.all([
      this.getRevenueLeakDetails(clinicId, query),
      this.getTopOpportunities(clinicId, query),
    ]);

    const risks = Object.values(leakDetails.items)
      .flat()
      .sort((left: any, right: any) => Number(right.estimatedRisk || 0) - Number(left.estimatedRisk || 0))
      .slice(0, 10)
      .map((risk: any) => ({
        id: risk.id,
        type: risk.leakKey,
        title: risk.label || risk.reason || "Revenue risk",
        contactId: risk.contactId || null,
        contactName: risk.contactName || "Unknown contact",
        sourceType: risk.sourceType,
        sourceId: risk.sourceId,
        source: risk.source || "Unknown source",
        treatment: risk.treatment || "Consultation",
        ownerName: risk.ownerName || "Unassigned",
        occurredAt: risk.occurredAt || null,
        estimatedRisk: Number(risk.estimatedRisk || 0),
        riskLabel: risk.riskLabel || "estimated",
        status: risk.status || "open",
        reason: risk.reason,
        nextAction: risk.nextAction,
        context: risk.context,
      }));

    const opportunityItems = opportunities.deals.map((deal: any) => ({
      id: deal.id,
      type: "pipeline_deal",
      title: deal.title,
      contactId: deal.contactId || null,
      contactName: deal.contactName || "Unknown contact",
      source: deal.source || "Unknown source",
      treatment: deal.treatment || "Consultation",
      stageId: deal.stageId,
      stageName: deal.stageName,
      valueCents: Number(deal.valueCents || 0),
      value: Number(deal.valueCents || 0) / 100,
      probability: Number(deal.probability || 0),
      priorityScore: Number(deal.priorityScore || 0),
      status: deal.status,
      nextAction: "Review owner, next step and close plan for this opportunity.",
      createdAt: deal.createdAt,
      updatedAt: deal.updatedAt,
    }));

    return {
      range: leakDetails.range,
      risks,
      opportunities: opportunityItems,
      counts: {
        risks: risks.length,
        opportunities: opportunityItems.length,
      },
      emptyState: risks.length === 0 && opportunityItems.length === 0,
    };
  }

  async exportPhase1Report(
    clinicId: string,
    input: {
      format?: string;
      startDate?: string;
      endDate?: string;
      type: string;
    },
  ) {
    const type = input.type as ReportExportType;
    const format = (input.format || "csv") as ReportExportFormat;

    const supportedTypes: ReportExportType[] = ["revenue", "attribution", "pipeline", "operational", "no-shows"];

    if (!supportedTypes.includes(type)) {
      throw ApiError.notImplemented("This report export type is not integrated yet.", {
        supportedTypes,
      });
    }

    if (format !== "csv") {
      throw ApiError.notImplemented("Only CSV report exports are currently supported by the backend.", {
        supportedFormats: ["csv"],
        note: "PDF/print exports are handled by the frontend for generated monthly reports.",
      });
    }

    const range = getDateRange(input);
    const rows: ReportExportRow[] = [];
    const base = {
      reportType: type,
      startDate: range.startDate,
      endDate: range.endDate,
    };

    if (type === "revenue") {
      const [summary, revenueByTreatment, monthlyTrend] = await Promise.all([
        this.getDashboardSummary(clinicId, range),
        this.getRevenueByTreatment(clinicId, range),
        this.getMonthlyTrend(clinicId, range),
      ]);

      for (const [metric, value] of Object.entries(summary.cards)) {
        rows.push({
          ...base,
          section: "summary_cards",
          metric,
          label: metric,
          value: Number(value || 0),
          provenance: Number(value || 0) > 0 ? "exact" : "unknown",
        });
      }

      for (const [metric, value] of Object.entries(summary.financials)) {
        if (typeof value === "object") continue;
        const isMoney = /revenue|spend|cost|value/i.test(metric);
        rows.push({
          ...base,
          section: "financials",
          metric,
          label: metric,
          value: isMoney ? money(value) : Number(value || 0),
          currency: isMoney ? "GBP" : null,
          provenance: (summary.financials as any)[`${metric}Provenance`] || null,
        });
      }

      for (const item of revenueByTreatment.byTreatment) {
        rows.push({
          ...base,
          section: "revenue_by_treatment",
          metric: "revenue",
          label: item.treatment,
          value: money(item.revenue),
          currency: "GBP",
          provenance: item.provenance?.revenue || null,
          treatment: item.treatment,
        });
        rows.push({
          ...base,
          section: "revenue_by_treatment",
          metric: "soldTreatments",
          label: item.treatment,
          value: Number(item.soldTreatments || 0),
          provenance: item.provenance?.soldTreatments || null,
          treatment: item.treatment,
        });
      }

      for (const item of monthlyTrend.items) {
        rows.push({
          ...base,
          section: "monthly_trend",
          metric: "totalRevenue",
          label: item.month,
          value: money(item.totalRevenue),
          currency: "GBP",
          provenance: item.provenance?.treatmentRevenue || null,
        });
        rows.push({
          ...base,
          section: "monthly_trend",
          metric: "roas",
          label: item.month,
          value: Number(item.roas || 0),
        });
      }
    }

    if (type === "attribution") {
      const attribution = await this.getRevenueByChannel(clinicId, range);

      for (const item of attribution.bySource) {
        rows.push({
          ...base,
          section: "source_performance",
          metric: "revenue",
          label: item.source || "Unknown source",
          value: money(item.revenue),
          currency: "GBP",
          provenance: item.provenance?.revenue || null,
          source: item.source || null,
        });
        rows.push({
          ...base,
          section: "source_performance",
          metric: "spend",
          label: item.source || "Unknown source",
          value: money(item.spend),
          currency: "GBP",
          provenance: item.provenance?.spend || null,
          source: item.source || null,
        });
        rows.push({
          ...base,
          section: "source_performance",
          metric: "leads",
          label: item.source || "Unknown source",
          value: Number(item.leads || 0),
          provenance: item.provenance?.leads || null,
          source: item.source || null,
        });
      }

      for (const item of attribution.byCampaign) {
        rows.push({
          ...base,
          section: "campaign_performance",
          metric: "roas",
          label: item.campaign || item.source || "Unknown campaign",
          value: Number(item.roas || 0),
          provenance: item.attribution || null,
          source: item.source || null,
          campaign: item.campaign || null,
        });
        rows.push({
          ...base,
          section: "campaign_performance",
          metric: "costPerBookedConsult",
          label: item.campaign || item.source || "Unknown campaign",
          value: money(item.costPerBookedConsult),
          currency: "GBP",
          provenance: item.provenance?.spend || null,
          source: item.source || null,
          campaign: item.campaign || null,
        });
      }
    }

    if (type === "pipeline") {
      const opportunities = await this.getTopOpportunities(clinicId, range);

      for (const deal of opportunities.deals) {
        rows.push({
          ...base,
          section: "open_opportunities",
          metric: "value",
          label: deal.title,
          value: money(Number(deal.valueCents || 0) / 100),
          currency: "GBP",
          provenance: "exact",
          source: deal.source || null,
          treatment: deal.treatment || null,
          contactId: deal.contactId || null,
          recordId: deal.id,
        });
        rows.push({
          ...base,
          section: "open_opportunities",
          metric: "priorityScore",
          label: deal.title,
          value: Number(deal.priorityScore || 0),
          provenance: "estimated",
          recordId: deal.id,
        });
      }
    }

    if (type === "operational") {
      const [funnel, leaks, riskOpportunitySections] = await Promise.all([
        this.getDashboardFunnel(clinicId, range),
        this.getRevenueLeaks(clinicId, range),
        this.getRiskOpportunitySections(clinicId, range),
      ]);

      for (const item of funnel.funnel) {
        rows.push({
          ...base,
          section: "funnel",
          metric: item.key,
          label: item.label,
          value: Number(item.count || 0),
          provenance: (funnel.provenance as any)[item.key] || null,
        });
        rows.push({
          ...base,
          section: "funnel",
          metric: `${item.key}Rate`,
          label: item.label,
          value: Number(item.rate || 0),
          provenance: (funnel.provenance as any)[item.key] || null,
        });
      }

      for (const item of leaks.items) {
        rows.push({
          ...base,
          section: "leakage",
          metric: "count",
          label: item.label,
          value: Number(item.count || 0),
          provenance: item.provenance?.count || null,
        });
        rows.push({
          ...base,
          section: "leakage",
          metric: "estimatedRisk",
          label: item.label,
          value: money(item.estimatedRisk),
          currency: "GBP",
          provenance: item.provenance?.estimatedRisk || "estimated",
        });
      }

      for (const risk of riskOpportunitySections.risks) {
        rows.push({
          ...base,
          section: "top_risks",
          metric: "estimatedRisk",
          label: risk.title,
          value: money(risk.estimatedRisk),
          currency: "GBP",
          provenance: risk.riskLabel || "estimated",
          source: risk.source || null,
          treatment: risk.treatment || null,
          contactId: risk.contactId || null,
          recordId: risk.sourceId || risk.id,
        });
      }
    }

    if (type === "no-shows") {
      const details = await this.getRevenueLeakDetails(clinicId, range);

      for (const item of details.items.noShows) {
        rows.push({
          ...base,
          section: "no_show_recovery_queue",
          metric: "estimatedRisk",
          label: item.contactName,
          value: money(item.estimatedRisk),
          currency: "GBP",
          provenance: item.riskLabel || "estimated",
          source: item.source || null,
          treatment: item.treatment || null,
          contactId: item.contactId || null,
          contactName: item.contactName || null,
          contactPhone: item.contactPhone || null,
          occurredAt: item.occurredAt || null,
          status: item.status || null,
          reason: item.reason || null,
          nextAction: item.nextAction || null,
          recordId: item.sourceId || item.id,
        });
      }
    }

    if (rows.length === 0) {
      rows.push({
        ...base,
        section: "empty_state",
        metric: "empty",
        label: "No backend records matched this report export and date range",
        value: "",
        provenance: "unknown",
      });
    }

    return {
      content: toCsv(rows),
      contentType: "text/csv; charset=utf-8",
      filename: exportFilename(type, range),
      metadata: {
        format,
        range,
        rowCount: rows.length,
        type,
      },
    };
  }

  async generateMonthlyReport(clinicId: string, userId: string, month?: string) {
    const range = getMonthDateRange(month);
    const query = { startDate: range.startDate, endDate: range.endDate };
    const [summary, funnel, revenueByChannel, revenueByTreatment, leaks, opportunities] = await Promise.all([
      this.getDashboardSummary(clinicId, query),
      this.getDashboardFunnel(clinicId, query),
      this.getRevenueByChannel(clinicId, query),
      this.getRevenueByTreatment(clinicId, query),
      this.getRevenueLeaks(clinicId, query),
      this.getTopOpportunities(clinicId, query),
    ]);

    const data = {
      generatedAt: new Date().toISOString(),
      month: range.month,
      range: {
        startDate: range.startDate,
        endDate: range.endDate,
      },
      sections: buildMonthlyReportSections({ funnel, leaks, opportunities, summary }),
      metrics: {
        summary,
        funnel,
        revenueByChannel,
        revenueByTreatment,
        leaks,
        opportunities,
      },
    };
    const filters = { month: range.month, startDate: range.startDate, endDate: range.endDate };
    const name = `Monthly Performance Report - ${range.month}`;
    const description = "Generated monthly performance report with executive summary, risks and recommended actions.";

    const [existingRows]: any = await pool.execute(
      `SELECT id
       FROM report
       WHERE clinic_id = ?
         AND type = 'monthly_performance'
         AND deleted_at IS NULL
         AND JSON_UNQUOTE(JSON_EXTRACT(filters, '$.month')) = ?
       LIMIT 1`,
      [clinicId, range.month],
    );
    const existingId = existingRows[0]?.id;
    const reportId = existingId || uuidv4();

    if (existingId) {
      await pool.execute(
        `UPDATE report
         SET name = ?,
             description = ?,
             filters = CAST(? AS JSON),
             data = CAST(? AS JSON),
             updated_at = CURRENT_TIMESTAMP
         WHERE clinic_id = ?
           AND id = ?`,
        [name, description, JSON.stringify(filters), JSON.stringify(data), clinicId, reportId],
      );
    } else {
      await pool.execute(
        `INSERT INTO report
          (id, clinic_id, name, type, description, filters, data, created_by)
         VALUES (?, ?, ?, 'monthly_performance', ?, CAST(? AS JSON), CAST(? AS JSON), ?)`,
        [reportId, clinicId, name, description, JSON.stringify(filters), JSON.stringify(data), userId],
      );
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: existingId ? "REPORT_REGENERATED" : "REPORT_GENERATED",
      entityType: "report",
      entityId: reportId,
      changes: { month: range.month, type: "monthly_performance" },
    });

    const [rows]: any = await pool.execute(
      `SELECT ${reportSelectFields}
       FROM report
       WHERE clinic_id = ?
         AND id = ?
         AND deleted_at IS NULL`,
      [clinicId, reportId],
    );
    const row = rows[0];

    return mapReportRow(row);
  }

  private async getLeakRecordContext(
    clinicId: string,
    input: {
      contactId: string | null;
      dedupeKey: string;
      email?: string | null;
      leakKey: string;
      phone?: string | null;
      sourceId: string;
      sourceType: string;
    },
  ) {
    const emptyCounts = {
      actionTaskId: null,
      actionTaskStatus: null,
      contactActivityCount: 0,
      insightId: null,
      insightStatus: null,
      latestAppointmentId: null,
      latestCallId: null,
      latestFormSubmissionId: null,
      leadHref: buildLeadHref(input.contactId),
      linkedAppointmentCount: 0,
      linkedCallCount: 0,
      linkedFormSubmissionCount: 0,
      linkedMessageCount: 0,
      monthlyActionPlanItemId: null,
      monthlyActionPlanItemStatus: null,
    };

    if (!input.contactId) return emptyCounts;

    const formMatchClauses: string[] = [];
    const formValues: any[] = [clinicId];

    if (input.email) {
      formMatchClauses.push("LOWER(JSON_UNQUOTE(JSON_EXTRACT(fs.submitted_data, '$.email'))) = LOWER(?)");
      formValues.push(input.email);
    }

    if (input.phone) {
      formMatchClauses.push("JSON_UNQUOTE(JSON_EXTRACT(fs.submitted_data, '$.phone')) = ?");
      formValues.push(input.phone);
    }

    const formQuery = formMatchClauses.length > 0
      ? pool.execute(
        `SELECT COUNT(*) as count,
                MAX(fs.submitted_at) as latestAt,
                SUBSTRING_INDEX(GROUP_CONCAT(fs.id ORDER BY fs.submitted_at DESC), ',', 1) as latestId
         FROM form_submission fs
         WHERE fs.clinic_id = ?
           AND fs.deleted_at IS NULL
           AND (${formMatchClauses.join(" OR ")})`,
        formValues,
      )
      : Promise.resolve([[{ count: 0, latestId: null }], []]);

    const [activityRows, callRows, appointmentRows, formRows, messageRows, insightRows]: any[] = await Promise.all([
      pool.execute(
        `SELECT COUNT(*) as count
         FROM activity a
         WHERE a.clinic_id = ?
           AND a.contact_id = ?
           AND a.deleted_at IS NULL`,
        [clinicId, input.contactId],
      ),
      pool.execute(
        `SELECT COUNT(*) as count,
                MAX(cl.created_at) as latestAt,
                SUBSTRING_INDEX(GROUP_CONCAT(cl.id ORDER BY cl.created_at DESC), ',', 1) as latestId
         FROM \` call \` cl
         WHERE cl.clinic_id = ?
           AND cl.contact_id = ?
           AND cl.deleted_at IS NULL`,
        [clinicId, input.contactId],
      ),
      pool.execute(
        `SELECT COUNT(*) as count,
                MAX(a.date_time) as latestAt,
                SUBSTRING_INDEX(GROUP_CONCAT(a.id ORDER BY a.date_time DESC), ',', 1) as latestId
         FROM appointment a
         WHERE a.clinic_id = ?
           AND a.contact_id = ?
           AND a.deleted_at IS NULL`,
        [clinicId, input.contactId],
      ),
      formQuery,
      pool.execute(
        `SELECT SUM(count) as count
         FROM (
           SELECT COUNT(*) as count
           FROM email e
           WHERE e.clinic_id = ?
             AND e.contact_id = ?
             AND e.deleted_at IS NULL
           UNION ALL
           SELECT COUNT(*) as count
           FROM sms s
           WHERE s.clinic_id = ?
             AND s.contact_id = ?
             AND s.deleted_at IS NULL
         ) messages`,
        [clinicId, input.contactId, clinicId, input.contactId],
      ),
      pool.execute(
        `SELECT i.id,
                i.status,
                i.action_task_id as actionTaskId,
                t.status as actionTaskStatus,
                mapi.id as monthlyActionPlanItemId,
                mapi.status as monthlyActionPlanItemStatus
         FROM insight i
         LEFT JOIN task t
           ON t.id = i.action_task_id
          AND t.clinic_id = i.clinic_id
          AND t.deleted_at IS NULL
         LEFT JOIN monthly_action_plan_item mapi
           ON mapi.insight_id = i.id
          AND mapi.clinic_id = i.clinic_id
          AND mapi.deleted_at IS NULL
         WHERE i.clinic_id = ?
           AND i.deleted_at IS NULL
           AND (
             i.dedupe_key = ?
             OR (i.source_type = ? AND i.source_id = ?)
             OR (i.source_contact_id = ? AND i.type = ?)
           )
         ORDER BY FIELD(i.status, 'open', 'in_progress', 'resolved', 'archived'),
                  i.created_at DESC
         LIMIT 1`,
        [clinicId, input.dedupeKey, input.sourceType, input.sourceId, input.contactId, input.leakKey],
      ),
    ]);

    const insight = insightRows[0]?.[0] || {};

    return {
      actionTaskId: insight.actionTaskId || null,
      actionTaskStatus: insight.actionTaskStatus || null,
      contactActivityCount: Number(activityRows[0]?.[0]?.count || 0),
      insightId: insight.id || null,
      insightStatus: insight.status || null,
      latestAppointmentId: appointmentRows[0]?.[0]?.latestId || null,
      latestCallId: callRows[0]?.[0]?.latestId || null,
      latestFormSubmissionId: formRows[0]?.[0]?.latestId || null,
      leadHref: buildLeadHref(input.contactId),
      linkedAppointmentCount: Number(appointmentRows[0]?.[0]?.count || 0),
      linkedCallCount: Number(callRows[0]?.[0]?.count || 0),
      linkedFormSubmissionCount: Number(formRows[0]?.[0]?.count || 0),
      linkedMessageCount: Number(messageRows[0]?.[0]?.count || 0),
      monthlyActionPlanItemId: insight.monthlyActionPlanItemId || null,
      monthlyActionPlanItemStatus: insight.monthlyActionPlanItemStatus || null,
    };
  }

  // List dashboard definitions with layout and widget JSON decoded
  async listDashboards(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id, name, description, layout, widgets, created_at as createdAt, updated_at as updatedAt
       FROM dashboard
       WHERE clinic_id = ? AND deleted_at IS NULL
       ORDER BY updated_at DESC`,
      [clinicId],
    );

    return rows.map((row: any) => ({
      ...row,
      layout: parseJson(row.layout, {}),
      widgets: parseJson(row.widgets, []),
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));
  }
}

export const reportsService = new ReportsService();
