import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { config } from "../../config/index.js";
import logger from "../../utils/logger.js";
import { reportsService } from "../reports/reports.service.js";
import {
  CreateAiProjectDTO,
  CreateAiRunDTO,
  DateRangeDTO,
  GenerateCampaignAnalystDTO,
  GenerateCompetitorInsightsDTO,
  GenerateGrowthBriefDTO,
  GenerateSalesAssistantDTO,
  UpdateAiProjectDTO,
} from "./ai-workspace.types.js";

function parseOutput(value: unknown) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
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

function pickGrowthBriefRange(data: GenerateGrowthBriefDTO = {}) {
  return {
    startDate: toDateOnly(data.startDate) || defaultDateOnly(-30),
    endDate: toDateOnly(data.endDate) || defaultDateOnly(0),
  };
}

function pickDateRange(data: DateRangeDTO = {}) {
  return {
    startDate: toDateOnly(data.startDate) || defaultDateOnly(-30),
    endDate: toDateOnly(data.endDate) || defaultDateOnly(30),
  };
}

function stringifyInput(value: unknown) {
  return JSON.stringify(value);
}

function centsFromPounds(value: unknown) {
  return Math.round(Number(value || 0) * 100);
}

function money(value: number) {
  return `GBP ${Math.round(value).toLocaleString("en-GB")}`;
}

function compactText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
  } catch {
    return [];
  }
}

function extractOpenAIText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;

  return (payload?.output || [])
    .flatMap((item: any) => item.content || [])
    .map((content: any) => content.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function parseGrowthBriefOutput(text: string) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") return null;

  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  const recommendations = Array.isArray(parsed.recommendations)
    ? parsed.recommendations
      .filter((item: unknown) => typeof item === "string" && item.trim())
      .slice(0, 8)
    : [];
  const risks = Array.isArray(parsed.risks)
    ? parsed.risks
      .filter((item: unknown) => typeof item === "string" && item.trim())
      .slice(0, 8)
    : [];
  const opportunities = Array.isArray(parsed.opportunities)
    ? parsed.opportunities
      .filter((item: unknown) => typeof item === "string" && item.trim())
      .slice(0, 8)
    : [];
  const confidence = typeof parsed.confidence === "string" && ["low", "medium", "high"].includes(parsed.confidence)
    ? parsed.confidence
    : "medium";

  if (!summary || recommendations.length === 0) return null;

  return {
    summary,
    recommendations,
    risks,
    opportunities,
    confidence,
  };
}

function hasUsableGrowthBriefData(input: any) {
  const summary = input?.metrics?.summary;
  const cards = summary?.cards || {};
  const financials = summary?.financials || {};
  const leaks = input?.metrics?.leaks || {};
  const risks = input?.metrics?.riskOpportunitySections?.risks || [];
  const opportunities = input?.metrics?.riskOpportunitySections?.opportunities || [];

  return [
    cards.leads,
    cards.bookedConsults,
    cards.attendedConsults,
    cards.soldTreatments,
    financials.totalRevenue,
    financials.spend,
    leaks.totalEstimatedRisk,
    risks.length,
    opportunities.length,
  ].some((value) => Number(value || 0) > 0);
}

function deterministicGeneratorProvenance(workflow: string) {
  return {
    workflow,
    provider: "deterministic",
    clinicScoped: true,
    openAiRequired: false,
    mockData: false,
  };
}

export class AiWorkspaceService {
  // List AI projects with run counts for the project dashboard
  async listProjects(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT ap.id, ap.title, ap.type, ap.status, ap.updated_at as updatedAt,
              COUNT(ar.id) as runsCount
       FROM ai_project ap
       LEFT JOIN ai_run ar ON ar.project_id = ap.id AND ar.deleted_at IS NULL
       WHERE ap.clinic_id = ? AND ap.deleted_at IS NULL
       GROUP BY ap.id
       ORDER BY ap.updated_at DESC`,
      [clinicId],
    );

    return rows.map((row: any) => ({
      ...row,
      runsCount: Number(row.runsCount),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));
  }

  // Create an AI project container for later agent runs
  async createProject(clinicId: string, userId: string, data: CreateAiProjectDTO) {
    const id = uuidv4();
    await pool.execute(
      "INSERT INTO ai_project (id, clinic_id, title, type, status, created_by) VALUES (?, ?, ?, ?, ?, ?)",
      [id, clinicId, data.title, data.type, data.status || "draft", userId],
    );
    await logAuditEvent({ clinicId, userId, action: "AI_PROJECT_CREATED", entityType: "ai_project", entityId: id, changes: { title: data.title, type: data.type } });
    return id;
  }

  // Update project metadata or lifecycle status
  async updateProject(clinicId: string, userId: string, projectId: string, data: UpdateAiProjectDTO) {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) { fields.push("title = ?"); values.push(data.title); }
    if (data.type !== undefined) { fields.push("type = ?"); values.push(data.type); }
    if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }

    if (fields.length === 0) return;
    values.push(projectId, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE ai_project SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );
    if (result.affectedRows === 0) throw ApiError.notFound("AI project not found");
    await logAuditEvent({ clinicId, userId, action: "AI_PROJECT_UPDATED", entityType: "ai_project", entityId: projectId, changes: { ...data } });
  }

  // List agent run history across the clinic
  async listRuns(clinicId: string, filters: { agentKey?: string } = {}) {
    const where = ["clinic_id = ?", "deleted_at IS NULL"];
    const values: any[] = [clinicId];

    if (filters.agentKey) {
      where.push("agent_key = ?");
      values.push(filters.agentKey);
    }

    const [rows]: any = await pool.execute(
      `SELECT id, project_id as projectId, agent_name as agentName, agent_key as agentKey,
              task, input, output, status, tokens, created_at as createdAt
       FROM ai_run
       WHERE ${where.join(" AND ")}
       ORDER BY created_at DESC`,
      values,
    );

    return rows.map((row: any) => ({
      ...row,
      input: parseOutput(row.input) || row.input,
      output: parseOutput(row.output),
      tokens: Number(row.tokens),
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  }

  // Persist a completed or failed AI run snapshot
  async createRun(clinicId: string, userId: string, data: CreateAiRunDTO) {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO ai_run
        (id, clinic_id, project_id, agent_name, agent_key, task, input, output, status, tokens, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        data.projectId || null,
        data.agentName,
        data.agentKey,
        data.task,
        data.input || null,
        JSON.stringify(data.output || null),
        data.status || "success",
        data.tokens || 0,
        userId,
      ],
    );
    await logAuditEvent({ clinicId, userId, action: "AI_RUN_CREATED", entityType: "ai_run", entityId: id, changes: { agentKey: data.agentKey, task: data.task } });
    return id;
  }

  private async saveGeneratedRun(
    clinicId: string,
    userId: string,
    data: {
      agentName: string;
      agentKey: string;
      task: string;
      input: unknown;
      output: unknown;
      auditAction: string;
    },
  ) {
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    await pool.execute(
      `INSERT INTO ai_run
        (id, clinic_id, agent_name, agent_key, task, input, output, status, tokens, created_by)
       VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), 'success', 0, ?)`,
      [
        id,
        clinicId,
        data.agentName,
        data.agentKey,
        data.task,
        stringifyInput(data.input),
        JSON.stringify(data.output),
        userId,
      ],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: data.auditAction,
      entityType: "ai_run",
      entityId: id,
      changes: { agentKey: data.agentKey, task: data.task },
    });

    return {
      id,
      agentKey: data.agentKey,
      status: "success" as const,
      input: data.input,
      output: data.output,
      createdAt,
    };
  }

  async generateShowRate(clinicId: string, userId: string, data: DateRangeDTO = {}) {
    const range = pickDateRange(data);
    const [rows]: any = await pool.execute(
      `SELECT a.id as appointmentId,
              a.contact_id as contactId,
              NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), '') as contactName,
              c.email as contactEmail,
              c.phone as contactPhone,
              a.date_time as appointmentDate,
              a.treatment,
              a.value,
              a.duration_minutes as durationMinutes,
              COUNT(prior.id) as priorAppointments,
              SUM(CASE WHEN prior.status = 'NoShow' THEN 1 ELSE 0 END) as priorNoShows,
              dr.id as depositId,
              dr.deposit_amount as depositAmount,
              dr.deposit_paid as depositPaid,
              dr.deposit_requested as depositRequested,
              dr.status as depositStatus,
              dr.reminder_sent as reminderSent
       FROM appointment a
       JOIN contact c ON c.id = a.contact_id AND c.clinic_id = a.clinic_id AND c.deleted_at IS NULL
       LEFT JOIN appointment prior
         ON prior.contact_id = a.contact_id
        AND prior.clinic_id = a.clinic_id
        AND prior.deleted_at IS NULL
        AND prior.date_time < a.date_time
       LEFT JOIN deposit_record dr
         ON dr.appointment_id = a.id
        AND dr.clinic_id = a.clinic_id
        AND dr.deleted_at IS NULL
       WHERE a.clinic_id = ?
         AND a.deleted_at IS NULL
         AND a.status = 'Scheduled'
         AND a.date_time >= ?
         AND a.date_time < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY a.id, dr.id
       ORDER BY a.date_time ASC
       LIMIT 50`,
      [clinicId, range.startDate, range.endDate],
    );

    const riskRows = rows.map((row: any) => {
      const valueCents = centsFromPounds(row.value);
      const priorNoShows = Number(row.priorNoShows || 0);
      const depositPaid = Boolean(row.depositPaid);
      const depositRequested = Boolean(row.depositRequested || row.depositId);
      const reminderSent = Boolean(row.reminderSent);
      const daysUntil = Math.ceil((new Date(row.appointmentDate).getTime() - Date.now()) / 86400000);
      const riskScore = Math.min(100, Math.max(5,
        priorNoShows * 35 +
        (depositPaid ? -15 : 20) +
        (reminderSent ? -10 : 10) +
        (valueCents >= 100000 ? 15 : 0) +
        (daysUntil <= 2 ? 15 : 0),
      ));
      const riskLevel = riskScore >= 65 ? "high" : riskScore >= 35 ? "medium" : "low";
      const reasons = [
        priorNoShows > 0 ? `${priorNoShows} prior no-show${priorNoShows === 1 ? "" : "s"} recorded` : null,
        depositPaid ? null : "Deposit is not marked as paid",
        reminderSent ? null : "No reminder is marked as sent",
        valueCents >= 100000 ? "High-value appointment" : null,
        daysUntil <= 2 ? "Appointment is within the next 48 hours" : null,
      ].filter((item): item is string => Boolean(item));

      return {
        appointmentId: row.appointmentId,
        contactId: row.contactId,
        contactName: row.contactName || row.contactEmail || "Unknown contact",
        contactEmail: row.contactEmail || null,
        contactPhone: row.contactPhone || null,
        appointmentDate: new Date(row.appointmentDate).toISOString(),
        treatment: row.treatment || null,
        valueCents,
        durationMinutes: Number(row.durationMinutes || 0),
        priorAppointments: Number(row.priorAppointments || 0),
        priorNoShows,
        deposit: row.depositId ? {
          id: row.depositId,
          amount: Number(row.depositAmount || 0),
          paid: depositPaid,
          requested: depositRequested,
          status: row.depositStatus || null,
        } : null,
        reminderSent,
        riskScore,
        riskLevel,
        reasons: reasons.length ? reasons : ["No major risk signals in current records"],
        recommendedActions: [
          {
            type: "request_deposit",
            label: depositPaid ? "Deposit already paid" : "Request deposit",
            supported: !depositPaid,
            unavailableReason: depositPaid ? "Deposit is already marked as paid." : undefined,
            payload: depositPaid ? undefined : {
              contactId: row.contactId,
              contactName: row.contactName || row.contactEmail || "Unknown contact",
              appointmentId: row.appointmentId,
              treatment: row.treatment || "Appointment deposit",
              depositAmount: Math.max(25, Math.round(Number(row.value || 0) * 0.1)),
            },
          },
          {
            type: "send_reminder",
            label: reminderSent ? "Reminder already sent" : "Send reminder",
            supported: false,
            unavailableReason: "Automated reminder sending is not wired for this AI module yet.",
          },
        ],
      };
    });

    const output = {
      provenance: deterministicGeneratorProvenance("show_rate"),
      summary: {
        totalAppointments: riskRows.length,
        highRisk: riskRows.filter((row: any) => row.riskLevel === "high").length,
        mediumRisk: riskRows.filter((row: any) => row.riskLevel === "medium").length,
        lowRisk: riskRows.filter((row: any) => row.riskLevel === "low").length,
        depositRecommended: riskRows.filter((row: any) => row.recommendedActions.some((action: any) => action.type === "request_deposit" && action.supported)).length,
        reminderRecommended: riskRows.filter((row: any) => !row.reminderSent).length,
      },
      riskRows,
      supportedActions: {
        requestDeposit: true,
        sendReminder: false,
      },
      unavailableActions: [
        { type: "send_reminder", reason: "Automated reminder sending is not wired for this AI module yet." },
      ],
    };

    return this.saveGeneratedRun(clinicId, userId, {
      agentName: "Missed Opportunity",
      agentKey: "show_rate",
      task: "Generated no-show predictions",
      input: { range, dataContract: "phase1_show_rate_v1" },
      output,
      auditAction: "AI_SHOW_RATE_GENERATED",
    });
  }

  async generateSalesAssistant(clinicId: string, userId: string, data: GenerateSalesAssistantDTO = {}) {
    let lead = null;
    if (data.contactId) {
      const [rows]: any = await pool.execute(
        `SELECT id, first_name as firstName, last_name as lastName, email, phone, source, status, value, treatment_interests as treatmentInterests
         FROM contact
         WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [data.contactId, clinicId],
      );
      lead = rows[0] || null;
    }

    const name = compactText(
      data.leadName,
      lead ? compactText(`${lead.firstName || ""} ${lead.lastName || ""}`, lead.email || lead.phone || "Lead") : "Lead",
    );
    const treatmentFromContact = parseJsonArray(lead?.treatmentInterests)[0] || "";
    const treatment = compactText(data.treatment, treatmentFromContact || "requested treatment");
    const context = compactText(data.context, "No additional context supplied.");
    const valueCents = centsFromPounds(lead?.value);
    const hasContactDetails = Boolean(lead?.email || lead?.phone);
    const coldLeadScore = Math.min(100, Math.max(10, (hasContactDetails ? 20 : 45) + (valueCents > 0 ? -10 : 10) + (context.length > 80 ? -5 : 10)));
    const conversionProbability = Math.max(5, 100 - coldLeadScore);
    const urgency = conversionProbability >= 70 ? "high" : conversionProbability >= 40 ? "medium" : "low";
    const followUpBody = `Hi ${name}, thanks for your interest in ${treatment}. The next best step is to book a short consultation so we can confirm suitability, answer questions, and outline the right plan.`;

    const output = {
      provenance: deterministicGeneratorProvenance("sales_assistant"),
      recommendation: conversionProbability >= 60
        ? "Prioritise a same-day consult invitation and remove friction from booking."
        : "Warm the lead with a concise value-led follow-up before asking for a booking.",
      summary: `${name} is scored as ${urgency} urgency for ${treatment}.`,
      lead: {
        contactId: lead?.id || data.contactId || null,
        name,
        treatment,
        email: lead?.email || null,
        phone: lead?.phone || null,
        source: lead?.source || null,
        status: lead?.status || null,
        valueCents,
      },
      scores: {
        coldLeadScore,
        conversionProbability,
        urgency,
        reasons: [
          hasContactDetails ? "Contact details are available" : "Contact details are incomplete",
          valueCents > 0 ? "Lead has an estimated value" : "Lead value is not recorded",
          context !== "No additional context supplied." ? "Manual context was provided" : "No manual context was provided",
        ],
      },
      recommendations: [
        {
          id: "copy_follow_up",
          type: "follow_up",
          title: "Send a consult booking follow-up",
          body: followUpBody,
          priority: urgency,
          supported: true,
          payload: { channel: lead?.phone ? "sms" : "email", body: followUpBody },
        },
        {
          id: "create_task",
          type: "task",
          title: "Create sales follow-up task",
          body: "Task creation from this AI module is not wired yet; copy the recommendation into the task workflow.",
          priority: "medium",
          supported: false,
          unavailableReason: "Direct task creation is not wired for this AI module yet.",
        },
      ],
      followUps: [
        {
          channel: lead?.phone ? "sms" : "email",
          subject: lead?.phone ? undefined : `Next step for ${treatment}`,
          body: followUpBody,
          supported: true,
          action: "copy",
        },
      ],
      supportedActions: {
        copyFollowUp: true,
        sendMessage: false,
        createTask: false,
      },
      unavailableActions: [
        { type: "sendMessage", reason: "Direct message sending is not wired for this AI module yet." },
        { type: "createTask", reason: "Direct task creation is not wired for this AI module yet." },
      ],
    };

    return this.saveGeneratedRun(clinicId, userId, {
      agentName: "Conversion Tracking",
      agentKey: "sales_assistant",
      task: `Generated conversion recommendations for ${name}`,
      input: { ...data, dataContract: "phase1_sales_assistant_v1" },
      output,
      auditAction: "AI_SALES_ASSISTANT_GENERATED",
    });
  }

  async generateCampaignAnalyst(clinicId: string, userId: string, data: GenerateCampaignAnalystDTO = {}) {
    const [spendRows]: any = await pool.execute(
      `SELECT source, campaign, COALESCE(SUM(amount), 0) as spend
       FROM manual_spend_entry
       WHERE clinic_id = ? AND deleted_at IS NULL
       GROUP BY source, campaign
       ORDER BY spend DESC
       LIMIT 10`,
      [clinicId],
    );
    const googleSpend = Number(data.googleSpend || spendRows.filter((row: any) => String(row.source || "").includes("google")).reduce((sum: number, row: any) => sum + Number(row.spend || 0), 0));
    const metaSpend = Number(data.metaSpend || spendRows.filter((row: any) => String(row.source || "").includes("meta") || String(row.source || "").includes("facebook")).reduce((sum: number, row: any) => sum + Number(row.spend || 0), 0));
    const spend = googleSpend + metaSpend || spendRows.reduce((sum: number, row: any) => sum + Number(row.spend || 0), 0);
    const leads = Number(data.leads || 0);
    const bookings = Number(data.bookings || 0);
    const revenue = Number(data.revenue || 0);
    const roas = spend > 0 ? revenue / spend : 0;
    const bookingRate = leads > 0 ? (bookings / leads) * 100 : 0;

    const output = {
      provenance: deterministicGeneratorProvenance("campaign_analyst"),
      underperforming: [
        {
          name: bookingRate > 0 && bookingRate < 25 ? "Lead to booking conversion" : "Attribution completeness",
          issue: bookingRate > 0 && bookingRate < 25
            ? `${bookingRate.toFixed(1)}% of leads are becoming bookings.`
            : "Campaign-level booking and revenue attribution is incomplete in the current inputs.",
          action: "Review source tagging, follow-up speed, and campaign-to-consult tracking before scaling spend.",
        },
      ],
      highROI: roas >= 2 ? [
        {
          name: "Blended paid media",
          roas: `${roas.toFixed(2)}x`,
          recommendation: "Protect this budget while testing small increases on the best-qualified lead source.",
        },
      ] : [],
      budgetShifts: [
        {
          from: metaSpend > googleSpend ? "Meta Ads" : "Lower-confidence campaign",
          to: googleSpend >= metaSpend ? "Google Ads / high-intent search" : "Best converting campaign",
          amount: spend > 0 ? money(spend * 0.1) : "GBP 0",
          reason: "Shift only a small test budget until campaign revenue attribution is stronger.",
        },
      ],
      projectedUplift: spend > 0
        ? `${money(Math.max(0, revenue * 0.08))} potential monthly uplift from cleaner attribution and conversion fixes.`
        : "Add spend and revenue inputs to calculate projected uplift.",
      landingPageIssues: [
        "Confirm every paid campaign lands on a treatment-specific page.",
        "Make booking calls-to-action and deposit expectations visible above the fold.",
      ],
      metrics: {
        googleSpend,
        metaSpend,
        spend,
        leads,
        bookings,
        revenue,
        roas,
        bookingRate,
      },
    };

    return this.saveGeneratedRun(clinicId, userId, {
      agentName: "Campaign Analyst",
      agentKey: "campaign_analyst",
      task: "Generated campaign-analysis recommendations",
      input: { ...data, dataContract: "phase1_campaign_analyst_v1" },
      output,
      auditAction: "AI_CAMPAIGN_ANALYST_GENERATED",
    });
  }

  async generateLtvOptimiser(clinicId: string, userId: string, data: DateRangeDTO = {}) {
    const range = pickDateRange(data);
    const [treatmentRows]: any = await pool.execute(
      `SELECT treatment,
              COUNT(*) as soldTreatments,
              COALESCE(SUM(revenue), 0) as revenue
       FROM manual_consult_entry
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         AND outcome = 'Treatment Booked'
         AND consult_date >= ?
         AND consult_date < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY treatment
       ORDER BY revenue DESC
       LIMIT 20`,
      [clinicId, range.startDate, range.endDate],
    );
    const [patientRows]: any = await pool.execute(
      `SELECT c.id as contactId,
              NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), '') as contactName,
              COALESCE(MAX(a.treatment), JSON_UNQUOTE(JSON_EXTRACT(c.treatment_interests, '$[0]')), 'Treatment') as treatment,
              COALESCE(MAX(c.value), 0) as value,
              SUM(CASE WHEN a.status = 'Completed' THEN 1 ELSE 0 END) as completedAppointments,
              SUM(CASE WHEN a.status = 'Scheduled' THEN 1 ELSE 0 END) as upcomingAppointments
       FROM contact c
       LEFT JOIN appointment a
         ON a.contact_id = c.id
        AND a.clinic_id = c.clinic_id
        AND a.deleted_at IS NULL
       WHERE c.clinic_id = ?
         AND c.deleted_at IS NULL
       GROUP BY c.id
       ORDER BY value DESC, upcomingAppointments DESC
       LIMIT 10`,
      [clinicId],
    );
    const totalTreatmentRevenue = treatmentRows.reduce((sum: number, row: any) => sum + Number(row.revenue || 0), 0);
    const totalSoldTreatments = treatmentRows.reduce((sum: number, row: any) => sum + Number(row.soldTreatments || 0), 0);
    const averageLtv = totalSoldTreatments > 0 ? totalTreatmentRevenue / totalSoldTreatments : 0;
    const categoryPotential = treatmentRows.map((row: any) => {
      const soldTreatments = Number(row.soldTreatments || 0);
      const revenue = Number(row.revenue || 0);
      const averageRevenue = soldTreatments > 0 ? revenue / soldTreatments : 0;
      return {
        treatment: row.treatment || "Unknown treatment",
        category: "tracked treatment",
        soldTreatments,
        revenue,
        averageRevenue,
        potentialRevenue: Math.round(Math.max(0, averageRevenue * Math.max(1, 5 - soldTreatments))),
        priority: soldTreatments < 3 ? "high" : soldTreatments < 6 ? "medium" : "low",
        action: soldTreatments < 3 ? "Build a reactivation or cross-sell prompt for this treatment." : "Protect conversion and rebooking follow-up.",
      };
    });
    const patientRecommendations = patientRows.map((row: any) => {
      const completedAppointments = Number(row.completedAppointments || 0);
      const upcomingAppointments = Number(row.upcomingAppointments || 0);
      const urgency = completedAppointments > 0 && upcomingAppointments === 0 ? "high" : upcomingAppointments > 0 ? "medium" : "low";
      return {
        contactId: row.contactId,
        contactName: row.contactName || "Unknown contact",
        treatment: row.treatment || "Treatment",
        valueCents: centsFromPounds(row.value),
        completedAppointments,
        upcomingAppointments,
        recommendationType: completedAppointments > 0 ? "rebooking" : "cross_sell",
        urgency,
        reason: completedAppointments > 0 ? "Completed treatment activity exists without enough future bookings." : "Lead value exists but treatment history is light.",
        recommendedAction: completedAppointments > 0 ? "Invite the patient to rebook or review maintenance timing." : "Offer the next logical treatment consultation.",
      };
    });
    const highUrgency = patientRecommendations.filter((row: any) => row.urgency === "high").length;
    const mediumUrgency = patientRecommendations.filter((row: any) => row.urgency === "medium").length;

    const output = {
      provenance: deterministicGeneratorProvenance("ltv_optimiser"),
      summary: {
        averageLtv,
        repeatProxyRate: patientRecommendations.length > 0 ? ((highUrgency + mediumUrgency) / patientRecommendations.length) * 100 : 0,
        openDealValue: 0,
        totalTreatmentRevenue,
        totalPatientRecommendations: patientRecommendations.length,
        underMonetisedCategories: categoryPotential.filter((row: any) => row.priority !== "low").length,
      },
      patientRecommendations,
      categoryPotential,
      underMonetised: categoryPotential.filter((row: any) => row.priority !== "low"),
      rebookingTiming: {
        highUrgency,
        mediumUrgency,
        action: "Prioritise high-urgency rebooking prompts before broad campaign spend.",
      },
    };

    return this.saveGeneratedRun(clinicId, userId, {
      agentName: "LTV Optimiser",
      agentKey: "ltv_optimiser",
      task: "Generated LTV optimiser recommendations",
      input: { range, dataContract: "phase1_ltv_optimiser_v1" },
      output,
      auditAction: "AI_LTV_OPTIMISER_GENERATED",
    });
  }

  async generateCompetitorInsights(clinicId: string, userId: string, data: GenerateCompetitorInsightsDTO = {}) {
    const competitorIds = Array.isArray(data.competitorIds) ? data.competitorIds : [];
    const values: any[] = [clinicId];
    let idClause = "";
    if (competitorIds.length > 0) {
      idClause = ` AND id IN (${competitorIds.map(() => "?").join(",")})`;
      values.push(...competitorIds);
    }
    const [rows]: any = await pool.execute(
      `SELECT id, name, url, key_treatments as keyTreatments, price_position as pricePosition,
              offer, messaging_angle as messagingAngle, ad_presence as adPresence,
              seo_strength as seoStrength, rating, reviews
       FROM competitor
       WHERE clinic_id = ?
         AND deleted_at IS NULL${idClause}
       ORDER BY reviews DESC, rating DESC
       LIMIT 50`,
      values,
    );
    const allTreatments = rows.flatMap((row: any) => parseJsonArray(row.keyTreatments));
    const commonTreatments = Array.from(new Set(allTreatments)).slice(0, 8);
    const premiumCompetitors = rows.filter((row: any) => row.pricePosition === "Premium").length;
    const strongSeo = rows.filter((row: any) => row.seoStrength === "Strong").length;
    const offerCompetitors = rows.filter((row: any) => compactText(row.offer).length > 0).length;

    const output = {
      provenance: deterministicGeneratorProvenance("competitor_insights"),
      summary: rows.length > 0
        ? `${rows.length} competitor${rows.length === 1 ? "" : "s"} analysed from stored clinic market records.`
        : "No competitor records were available for analysis.",
      marketPosition: {
        competitors: rows.length,
        premiumCompetitors,
        strongSeo,
        offerCompetitors,
        commonTreatments,
      },
      insights: rows.map((row: any) => {
        const threatLevel = row.seoStrength === "Strong" || Number(row.reviews || 0) >= 100 ? "high" : row.pricePosition === "Premium" || Number(row.rating || 0) >= 4.5 ? "medium" : "low";
        return {
          competitorId: row.id,
          name: row.name,
          position: row.pricePosition || "Mid-range",
          threatLevel,
          finding: `${row.name} has ${row.seoStrength || "unknown"} SEO strength${row.offer ? " and an active offer" : ""}.`,
          action: threatLevel === "high"
            ? "Review treatment-page SEO, proof points, and consult offer positioning against this competitor."
            : "Monitor messaging and keep The Growth Group Internal CRM reporting updated with offer changes.",
        };
      }),
      opportunities: [
        {
          title: "Clarify treatment differentiation",
          body: commonTreatments.length
            ? `Common competitor treatments include ${commonTreatments.slice(0, 3).join(", ")}; strengthen proof and offer clarity on these pages.`
            : "Add key treatments to competitor records to identify overlap.",
          priority: commonTreatments.length ? "high" : "medium",
        },
        {
          title: "Track offers and SEO",
          body: "Keep competitor offer, rating, review, ad presence, and SEO fields fresh before each campaign review.",
          priority: "medium",
        },
      ],
      actions: [
        "Update competitor records after market checks.",
        "Compare strongest competitor treatments with current campaign landing pages.",
        compactText(data.notes) ? "Review the supplied notes alongside stored competitor records." : "Add notes for local market nuances when generating the next insight.",
      ],
      unavailableActions: [
        { type: "web_scrape", reason: "Live competitor scraping is not wired; output uses stored competitor records only." },
      ],
    };

    return this.saveGeneratedRun(clinicId, userId, {
      agentName: "Competitor Insights",
      agentKey: "competitor_insights",
      task: `Generated competitor insights for ${rows.length} competitors`,
      input: { ...data, dataContract: "phase1_competitor_insights_v1" },
      output,
      auditAction: "AI_COMPETITOR_INSIGHTS_GENERATED",
    });
  }

  async generateGrowthBrief(clinicId: string, userId: string, data: GenerateGrowthBriefDTO = {}) {
    if (!config.openai.insightsEnabled) {
      throw ApiError.serviceUnavailable("Growth Brief generation is unavailable because OpenAI insights are disabled.", {
        code: "openai_disabled",
        action: "Set OPENAI_INSIGHTS_ENABLED=true and configure OPENAI_API_KEY to enable live Growth Brief generation.",
      });
    }

    if (!config.openai.apiKey) {
      throw ApiError.serviceUnavailable("Growth Brief generation is unavailable because OpenAI is not configured.", {
        code: "missing_openai_api_key",
        action: "Configure OPENAI_API_KEY before enabling live Growth Brief generation.",
      });
    }

    const range = pickGrowthBriefRange(data);
    const [
      summary,
      funnel,
      revenueByChannel,
      revenueByTreatment,
      leaks,
      monthlyTrend,
      riskOpportunitySections,
    ] = await Promise.all([
      reportsService.getDashboardSummary(clinicId, range),
      reportsService.getDashboardFunnel(clinicId, range),
      reportsService.getRevenueByChannel(clinicId, range),
      reportsService.getRevenueByTreatment(clinicId, range),
      reportsService.getRevenueLeaks(clinicId, range),
      reportsService.getMonthlyTrend(clinicId, range),
      reportsService.getRiskOpportunitySections(clinicId, range),
    ]);

    const input = {
      generatedAt: new Date().toISOString(),
      range,
      dataContract: "phase1_growth_brief_v1",
      provenance: {
        source: "clinic_scoped_backend_reports",
        clinicScoped: true,
        mockData: false,
        includes: ["revenue", "leads", "consults", "sla/leakage", "calls", "attribution", "retention/proxy"],
      },
      metrics: {
        summary,
        funnel,
        revenueByChannel,
        revenueByTreatment,
        leaks,
        monthlyTrend,
        riskOpportunitySections,
        retention: {
          note: "Phase 1 retention inputs are represented by repeat activity, active plans, deposits and revenue proxies where available in backend reporting.",
          provenance: "exact_or_estimated_from_phase1_records",
        },
      },
    };

    if (!hasUsableGrowthBriefData(input)) {
      throw ApiError.badRequest("Growth Brief unavailable because no usable Phase 1 clinic data exists for the selected date range.", {
        code: "insufficient_growth_brief_data",
        action: "Add or import leads, calls, consults, revenue, spend or leakage records, then generate the brief again.",
        range,
      });
    }

    let payload: any;
    let outputText = "";

    try {
      const response = await fetch(config.openai.apiUrl, {
        method: "POST",
        signal: AbortSignal.timeout(config.openai.timeoutMs),
        headers: {
          Authorization: `Bearer ${config.openai.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.openai.deepAuditModel,
          instructions: [
            "You are The Growth Group's commercial performance analyst.",
            "Generate a Phase 1 Growth Brief for a clinic owner using only the provided backend data.",
            "Do not invent facts, records, values, patients, campaigns, treatments or recommendations.",
            "If a metric is manual, estimated or unknown, say so plainly.",
            "Keep recommendations specific, commercially useful and action-oriented.",
          ].join(" "),
          input: stringifyInput(input),
          text: {
            format: {
              type: "json_schema",
              name: "growth_brief",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["summary", "recommendations", "risks", "opportunities", "confidence"],
                properties: {
                  summary: { type: "string" },
                  recommendations: {
                    type: "array",
                    items: { type: "string" },
                  },
                  risks: {
                    type: "array",
                    items: { type: "string" },
                  },
                  opportunities: {
                    type: "array",
                    items: { type: "string" },
                  },
                  confidence: {
                    type: "string",
                    enum: ["low", "medium", "high"],
                  },
                },
              },
            },
          },
          max_output_tokens: 2500,
        }),
      });

      const responseText = await response.text();
      try {
        payload = responseText ? JSON.parse(responseText) : undefined;
      } catch {
        payload = undefined;
      }

      if (!response.ok) {
        logger.warn("OpenAI Growth Brief generation failed", {
          response: payload || responseText,
          status: response.status,
        });
        throw ApiError.serviceUnavailable("Growth Brief generation failed at the AI provider.", {
          code: `openai_http_${response.status}`,
          action: "Check OpenAI configuration, billing, model access and request logs before trying again.",
        });
      }

      outputText = payload ? extractOpenAIText(payload) : "";
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.warn("OpenAI Growth Brief generation threw", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw ApiError.serviceUnavailable("Growth Brief generation failed before a usable AI response was returned.", {
        code: "openai_request_failed",
        action: "Check OPENAI_API_KEY, OPENAI_API_URL, network access and timeout settings.",
      });
    }

    const generated = outputText ? parseGrowthBriefOutput(outputText) : null;
    if (!generated) {
      throw ApiError.serviceUnavailable("Growth Brief generation returned no usable output.", {
        code: "openai_empty_or_invalid_response",
        action: "Retry generation or review the OpenAI response format.",
      });
    }

    const output = {
      ...generated,
      generatedAt: new Date().toISOString(),
      range,
      provenance: {
        provider: "openai",
        model: config.openai.deepAuditModel,
        responseId: payload?.id || null,
        source: "clinic_scoped_backend_reports",
        mockData: false,
        dataContract: input.dataContract,
      },
    };

    const id = uuidv4();
    await pool.execute(
      `INSERT INTO ai_run
        (id, clinic_id, agent_name, agent_key, task, input, output, status, tokens, created_by)
       VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), 'success', ?, ?)`,
      [
        id,
        clinicId,
        "Growth Brief",
        "growth_brief",
        "Generate Phase 1 Growth Brief",
        stringifyInput(input),
        JSON.stringify(output),
        Number(payload?.usage?.total_tokens || payload?.usage?.totalTokens || 0),
        userId,
      ],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "AI_GROWTH_BRIEF_GENERATED",
      entityType: "ai_run",
      entityId: id,
      changes: { range, model: config.openai.deepAuditModel, responseId: payload?.id || null },
    });

    return {
      id,
      agentKey: "growth_brief",
      status: "success",
      input,
      output,
      createdAt: new Date().toISOString(),
    };
  }
}

export const aiWorkspaceService = new AiWorkspaceService();
