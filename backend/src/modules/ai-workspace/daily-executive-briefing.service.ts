import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { logAuditEvent } from "../../utils/audit.js";
import { v4 as uuidv4 } from "uuid";
import type { GenerateDailyExecutiveBriefingDTO } from "./ai-workspace.types.js";

const AGENT_KEY = "daily_executive_briefing";
const AGENT_NAME = "Daily Executive Briefing";
const DATA_CONTRACT = "daily_executive_brief_v1";

type BriefStatus = "ok" | "attention" | "data_gap";
type FreshnessState = "current" | "stale" | "missing" | "unavailable";

type BriefItem = {
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  sourceUrl: string;
  clientName?: string | null;
  sourceId?: string | null;
  dueAt?: string | null;
};

type BriefSection = {
  key: string;
  title: string;
  status: BriefStatus;
  count: number;
  source: {
    table: string;
    description: string;
    url: string;
  };
  freshness: {
    checkedAt: string;
    latestRecordAt: string | null;
    state: FreshnessState;
  };
  items: BriefItem[];
};

function dateOnly(value?: string) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function iso(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function compact(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function sectionFreshness(checkedAt: string, latestRecordAt: unknown): BriefSection["freshness"] {
  const latest = iso(latestRecordAt);
  if (!latest) return { checkedAt, latestRecordAt: null, state: "missing" };

  const ageMs = Date.now() - new Date(latest).getTime();
  return {
    checkedAt,
    latestRecordAt: latest,
    state: ageMs > 36 * 60 * 60 * 1000 ? "stale" : "current",
  };
}

function source(table: string, description: string, url: string): BriefSection["source"] {
  return { table, description, url };
}

function item(row: any, fallbackTitle: string, detail: string, severity: BriefItem["severity"], sourceUrl: string): BriefItem {
  return {
    title: compact(row.title || row.name || row.clientName || row.proposalName, fallbackTitle),
    detail,
    severity,
    sourceUrl,
    clientName: row.clientName || null,
    sourceId: row.id || null,
    dueAt: iso(row.dueAt || row.dateTime || row.followUpAt || row.expectedCloseDate),
  };
}

async function latestTimestamp(clinicId: string, tableName: string) {
  const [rows]: any = await pool.execute(
    `SELECT MAX(COALESCE(updated_at, created_at)) as latestRecordAt FROM ${tableName} WHERE clinic_id = ?`,
    [clinicId],
  );
  return rows[0]?.latestRecordAt || null;
}

async function safeSection(
  clinicId: string,
  checkedAt: string,
  key: string,
  title: string,
  sectionSource: BriefSection["source"],
  loader: () => Promise<{ items: BriefItem[]; latestRecordAt?: unknown; status?: BriefStatus }>,
): Promise<BriefSection> {
  try {
    const result = await loader();
    const items = result.items;
    return {
      key,
      title,
      status: result.status || (items.length > 0 ? "attention" : "ok"),
      count: items.length,
      source: sectionSource,
      freshness: sectionFreshness(checkedAt, result.latestRecordAt),
      items,
    };
  } catch {
    return {
      key,
      title,
      status: "data_gap",
      count: 0,
      source: sectionSource,
      freshness: { checkedAt, latestRecordAt: null, state: "unavailable" },
      items: [
        {
          title: "Data source unavailable",
          detail: `${sectionSource.description} could not be read for the daily briefing.`,
          severity: "warning",
          sourceUrl: sectionSource.url,
        },
      ],
    };
  }
}

function highestValueActions(sections: BriefSection[]) {
  return sections
    .flatMap((section) =>
      section.items.map((entry) => ({
        title: entry.title,
        reason: entry.detail,
        section: section.key,
        sourceUrl: entry.sourceUrl,
        requiresHumanApproval: true,
        severityRank: entry.severity === "critical" ? 3 : entry.severity === "warning" ? 2 : 1,
      })),
    )
    .sort((a, b) => b.severityRank - a.severityRank)
    .slice(0, 3)
    .map(({ severityRank: _severityRank, ...entry }) => entry);
}

function parseOutput(value: unknown) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

export class DailyExecutiveBriefingService {
  async generateDailyBriefing(clinicId: string, userId: string | null, options: GenerateDailyExecutiveBriefingDTO = {}) {
    const briefDate = dateOnly(options.briefDate);
    const existing = await this.findExistingBriefing(clinicId, briefDate);
    if (existing) return { ...existing.output, id: existing.id, duplicate: true };

    const output = await this.buildBriefing(clinicId, briefDate);
    const id = uuidv4();

    await pool.execute(
      `INSERT INTO ai_run
        (id, clinic_id, project_id, agent_name, agent_key, task, input, output, status, tokens, created_by)
       VALUES (?, ?, NULL, ?, ?, ?, ?, CAST(? AS JSON), 'success', 0, ?)`,
      [
        id,
        clinicId,
        AGENT_NAME,
        AGENT_KEY,
        `Daily executive briefing for ${briefDate}`,
        JSON.stringify({ briefDate, dataContract: DATA_CONTRACT }),
        JSON.stringify(output),
        userId,
      ],
    );

    await logAuditEvent({
      clinicId,
      userId: userId || undefined,
      action: "DAILY_EXECUTIVE_BRIEFING_GENERATED",
      entityType: "ai_run",
      entityId: id,
      changes: { agentKey: AGENT_KEY, briefDate },
    });

    return { ...output, id, duplicate: false };
  }

  async generateForActiveClinics(options: GenerateDailyExecutiveBriefingDTO = {}) {
    const [rows]: any = await pool.execute("SELECT id FROM clinic WHERE deleted_at IS NULL ORDER BY id");
    let generatedCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;

    for (const row of rows) {
      try {
        const result = await this.generateDailyBriefing(row.id, null, options);
        if (result.duplicate) duplicateCount += 1;
        else generatedCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    return { clinicsChecked: rows.length, generatedCount, duplicateCount, failedCount };
  }

  private async findExistingBriefing(clinicId: string, briefDate: string) {
    const [rows]: any = await pool.execute(
      `SELECT id, output
       FROM ai_run
       WHERE clinic_id = ?
         AND agent_key = ?
         AND deleted_at IS NULL
         AND JSON_UNQUOTE(JSON_EXTRACT(output, '$.briefDate')) = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [clinicId, AGENT_KEY, briefDate],
    );
    const row = rows[0];
    return row ? { id: row.id as string, output: parseOutput(row.output) } : null;
  }

  private async buildBriefing(clinicId: string, briefDate: string) {
    const checkedAt = new Date().toISOString();
    const sections = [
      await this.activeClientsSection(clinicId, checkedAt),
      await this.cashAndAgedDebtSection(clinicId, checkedAt),
      await this.leadsSlaFollowUpsSection(clinicId, checkedAt),
      await this.todaysMeetingsSection(clinicId, checkedAt, briefDate),
      await this.overdueBuyerCommitmentsSection(clinicId, checkedAt, briefDate),
      await this.proposalBlockersSection(clinicId, checkedAt),
      await this.undatedOpportunitiesSection(clinicId, checkedAt),
      await this.atRiskClientsSection(clinicId, checkedAt),
      await this.campaignDataHealthSection(clinicId, checkedAt),
      await this.overdueDeliveryQaSection(clinicId, checkedAt, briefDate),
      await this.staffBlockersWorkloadSection(clinicId, checkedAt),
      await this.releasesBlockersSection(clinicId, checkedAt),
      await this.maxDecisionsSection(clinicId, checkedAt),
    ];

    return {
      dataContract: DATA_CONTRACT,
      generatedAt: checkedAt,
      briefDate,
      weekday: new Date(`${briefDate}T12:00:00.000Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" }),
      delivery: {
        channel: config.executiveBriefing.deliveryChannel,
        targetConfigured: Boolean(config.executiveBriefing.deliveryTarget),
      },
      sections,
      highestValueActions: highestValueActions(sections),
      actionPolicy: {
        readOnlyBrief: true,
        consequentialActionsRequireHumanApproval: true,
      },
    };
  }

  private activeClientsSection(clinicId: string, checkedAt: string) {
    return safeSection(
      clinicId,
      checkedAt,
      "active_clients",
      "All active clients",
      source("client_account_profile", "Active client account profiles", "/app/ops/client-accounts"),
      async () => {
        const [rows]: any = await pool.execute(
          `SELECT cap.id, c.name as clientName, cap.client_status as clientStatus, cap.health_status as healthStatus,
                  cap.updated_at as latestRecordAt
           FROM client_account_profile cap
           INNER JOIN clinic c ON c.id = cap.clinic_id
           WHERE cap.clinic_id = ? AND cap.client_status IN ('active', 'onboarding', 'at_risk')
           ORDER BY FIELD(cap.health_status, 'critical', 'at_risk', 'attention_needed', 'healthy'), c.name
           LIMIT 20`,
          [clinicId],
        );
        if (rows.length === 0) {
          return {
            status: "data_gap" as BriefStatus,
            latestRecordAt: await latestTimestamp(clinicId, "client_account_profile"),
            items: [
              {
                title: "No active client account profile found",
                detail: "The brief cannot prove all active clients are covered until the account register is populated.",
                severity: "warning",
                sourceUrl: "/app/ops/client-accounts",
              },
            ],
          };
        }
        return {
          status: rows.some((row: any) => ["critical", "at_risk", "attention_needed"].includes(row.healthStatus)) ? "attention" as BriefStatus : "ok" as BriefStatus,
          latestRecordAt: rows[0]?.latestRecordAt,
          items: rows.map((row: any) =>
            item(row, "Active client", `${row.clientStatus} client with health ${row.healthStatus}.`, row.healthStatus === "critical" ? "critical" : "info", "/app/ops/client-accounts"),
          ),
        };
      },
    );
  }

  private cashAndAgedDebtSection(clinicId: string, checkedAt: string) {
    return safeSection(
      clinicId,
      checkedAt,
      "cash_aged_debt",
      "Cash and aged debt",
      source("client_account_profile", "Client account payment and invoice state", "/app/ops/client-accounts"),
      async () => {
        const [rows]: any = await pool.execute(
          `SELECT cap.id, c.name as clientName, cap.payment_status as paymentStatus,
                  cap.invoice_status as invoiceStatus, cap.payment_notes as paymentNotes, cap.updated_at as latestRecordAt
           FROM client_account_profile cap
           INNER JOIN clinic c ON c.id = cap.clinic_id
           WHERE cap.clinic_id = ?
             AND (
               cap.payment_status IN ('overdue', 'failed', 'action_required')
               OR cap.invoice_status IN ('overdue', 'disputed', 'action_required')
             )
           ORDER BY cap.updated_at DESC
           LIMIT 10`,
          [clinicId],
        );
        return {
          latestRecordAt: await latestTimestamp(clinicId, "client_account_profile"),
          items: rows.map((row: any) =>
            item(row, "Cash issue", `Payment ${row.paymentStatus || "unknown"}, invoice ${row.invoiceStatus || "unknown"}. ${compact(row.paymentNotes, "")}`, "critical", "/app/ops/client-accounts"),
          ),
        };
      },
    );
  }

  private leadsSlaFollowUpsSection(clinicId: string, checkedAt: string) {
    return safeSection(
      clinicId,
      checkedAt,
      "new_leads_sla_followups",
      "New leads, SLA and follow-ups",
      source("contact", "Lead records and response SLA fields", "/app/leads"),
      async () => {
        const [rows]: any = await pool.execute(
          `SELECT id, CONCAT_WS(' ', first_name, last_name) as title, source, lead_status as leadStatus,
                  sla_deadline_at as dueAt, sla_breached_at as slaBreachedAt, updated_at as latestRecordAt
           FROM contact
           WHERE clinic_id = ?
             AND deleted_at IS NULL
             AND status = 'lead'
             AND (
               lead_status = 'new'
               OR (first_response_at IS NULL AND sla_deadline_at IS NOT NULL AND sla_deadline_at < NOW())
             )
           ORDER BY sla_deadline_at ASC, updated_at DESC
           LIMIT 10`,
          [clinicId],
        );
        return {
          latestRecordAt: await latestTimestamp(clinicId, "contact"),
          items: rows.map((row: any) =>
            item(row, "Lead needs response", `Lead status ${row.leadStatus}; source ${row.source || "unknown"}.`, row.slaBreachedAt ? "critical" : "warning", "/app/leads"),
          ),
        };
      },
    );
  }

  private todaysMeetingsSection(clinicId: string, checkedAt: string, briefDate: string) {
    return safeSection(
      clinicId,
      checkedAt,
      "todays_meetings",
      "Today's meetings",
      source("appointment", "Scheduled appointments and consultation meetings", "/app/calendar"),
      async () => {
        const [rows]: any = await pool.execute(
          `SELECT a.id, a.date_time as dateTime, a.status, a.appointment_type as appointmentType,
                  CONCAT_WS(' ', ct.first_name, ct.last_name) as title, a.updated_at as latestRecordAt
           FROM appointment a
           INNER JOIN contact ct ON ct.id = a.contact_id
           WHERE a.clinic_id = ? AND a.deleted_at IS NULL AND DATE(a.date_time) = ?
           ORDER BY a.date_time ASC
           LIMIT 20`,
          [clinicId, briefDate],
        );
        return {
          latestRecordAt: await latestTimestamp(clinicId, "appointment"),
          items: rows.map((row: any) =>
            item(row, "Meeting", `${row.appointmentType || "appointment"} is ${row.status}.`, "info", "/app/calendar"),
          ),
        };
      },
    );
  }

  private overdueBuyerCommitmentsSection(clinicId: string, checkedAt: string, briefDate: string) {
    return this.taskSection(clinicId, checkedAt, briefDate, "overdue_buyer_commitments", "Overdue buyer commitments", "buyer_commitment", "/app/crm/tasks");
  }

  private proposalBlockersSection(clinicId: string, checkedAt: string) {
    return safeSection(
      clinicId,
      checkedAt,
      "proposal_blockers",
      "Proposal blockers",
      source("proposal", "Draft and follow-up proposal states", "/app/crm/proposals"),
      async () => {
        const [rows]: any = await pool.execute(
          `SELECT id, proposal_name as title, status, follow_up_at as followUpAt, updated_at as latestRecordAt
           FROM proposal
           WHERE clinic_id = ?
             AND deleted_at IS NULL
             AND status IN ('draft', 'ready', 'follow_up_due')
           ORDER BY FIELD(status, 'follow_up_due', 'ready', 'draft'), updated_at DESC
           LIMIT 10`,
          [clinicId],
        );
        return {
          latestRecordAt: await latestTimestamp(clinicId, "proposal"),
          items: rows.map((row: any) =>
            item(row, "Proposal blocker", `Proposal is currently ${row.status}.`, row.status === "follow_up_due" ? "critical" : "warning", "/app/crm/proposals"),
          ),
        };
      },
    );
  }

  private undatedOpportunitiesSection(clinicId: string, checkedAt: string) {
    return safeSection(
      clinicId,
      checkedAt,
      "undated_opportunities",
      "Undated opportunities",
      source("deal", "Open pipeline opportunities", "/app/crm/pipeline"),
      async () => {
        const [rows]: any = await pool.execute(
          `SELECT id, title, value, stage, source, updated_at as latestRecordAt
           FROM deal
           WHERE clinic_id = ?
             AND deleted_at IS NULL
             AND status = 'open'
             AND expected_close_date IS NULL
           ORDER BY COALESCE(value, 0) DESC, updated_at DESC
           LIMIT 10`,
          [clinicId],
        );
        return {
          latestRecordAt: await latestTimestamp(clinicId, "deal"),
          items: rows.map((row: any) =>
            item(row, "Opportunity missing date", `${row.stage || "Open"} opportunity has no expected close date.`, "warning", "/app/crm/pipeline"),
          ),
        };
      },
    );
  }

  private atRiskClientsSection(clinicId: string, checkedAt: string) {
    return safeSection(
      clinicId,
      checkedAt,
      "at_risk_clients",
      "At-risk clients",
      source("client_account_profile", "Client account risk fields", "/app/ops/client-accounts"),
      async () => {
        const [rows]: any = await pool.execute(
          `SELECT cap.id, c.name as clientName, cap.health_status as healthStatus,
                  cap.churn_risk as churnRisk, cap.key_notes as keyNotes, cap.updated_at as latestRecordAt
           FROM client_account_profile cap
           INNER JOIN clinic c ON c.id = cap.clinic_id
           WHERE cap.clinic_id = ?
             AND (cap.health_status IN ('at_risk', 'critical') OR cap.churn_risk IN ('high', 'critical'))
           ORDER BY FIELD(cap.churn_risk, 'critical', 'high', 'medium', 'low'), cap.updated_at DESC
           LIMIT 10`,
          [clinicId],
        );
        return {
          latestRecordAt: await latestTimestamp(clinicId, "client_account_profile"),
          items: rows.map((row: any) =>
            item(row, "Client risk", `Health ${row.healthStatus}; churn risk ${row.churnRisk}. ${compact(row.keyNotes, "")}`, row.churnRisk === "critical" || row.healthStatus === "critical" ? "critical" : "warning", "/app/ops/client-accounts"),
          ),
        };
      },
    );
  }

  private campaignDataHealthSection(clinicId: string, checkedAt: string) {
    return safeSection(
      clinicId,
      checkedAt,
      "campaign_data_health_incidents",
      "Campaign and data-health incidents",
      source("analytics_freshness_alert", "Open analytics freshness alerts", "/app/integrations/fleet-sync"),
      async () => {
        const [rows]: any = await pool.execute(
          `SELECT id, message as title, observed_lag_minutes as observedLagMinutes,
                  threshold_minutes as thresholdMinutes, updated_at as latestRecordAt
           FROM analytics_freshness_alert
           WHERE clinic_id = ? AND status = 'open'
           ORDER BY opened_at DESC
           LIMIT 10`,
          [clinicId],
        );
        return {
          latestRecordAt: await latestTimestamp(clinicId, "analytics_freshness_alert"),
          items: rows.map((row: any) =>
            item(row, "Data-health incident", `Observed lag ${row.observedLagMinutes || 0} minutes against ${row.thresholdMinutes} minute threshold.`, "warning", "/app/integrations/fleet-sync"),
          ),
        };
      },
    );
  }

  private overdueDeliveryQaSection(clinicId: string, checkedAt: string, briefDate: string) {
    return this.taskSection(clinicId, checkedAt, briefDate, "overdue_delivery_qa", "Overdue delivery and QA", "delivery_qa", "/app/ops/workspace");
  }

  private staffBlockersWorkloadSection(clinicId: string, checkedAt: string) {
    return safeSection(
      clinicId,
      checkedAt,
      "staff_blockers_workload",
      "Staff blockers and workload",
      source("task", "Open internal tasks grouped by owner", "/app/ops/workspace"),
      async () => {
        const [rows]: any = await pool.execute(
          `SELECT assigned_to as title, COUNT(*) as taskCount, MAX(updated_at) as latestRecordAt
           FROM task
           WHERE clinic_id = ?
             AND is_internal = 1
             AND status = 'pending'
             AND archived_at IS NULL
           GROUP BY assigned_to
           HAVING COUNT(*) >= 5 OR assigned_to IS NULL
           ORDER BY COUNT(*) DESC
           LIMIT 10`,
          [clinicId],
        );
        return {
          latestRecordAt: await latestTimestamp(clinicId, "task"),
          items: rows.map((row: any) => ({
            title: compact(row.title, "Unassigned workload"),
            detail: `${Number(row.taskCount || 0)} open internal tasks need workload review.`,
            severity: Number(row.taskCount || 0) >= 8 ? "critical" : "warning",
            sourceUrl: "/app/ops/workspace",
          })),
        };
      },
    );
  }

  private releasesBlockersSection(clinicId: string, checkedAt: string) {
    return this.taskSection(clinicId, checkedAt, undefined, "releases_blockers", "Releases and blockers", "release_blocker", "/app/ops/workspace");
  }

  private maxDecisionsSection(clinicId: string, checkedAt: string) {
    return this.taskSection(clinicId, checkedAt, undefined, "max_decisions", "Decisions only Max can make", "max_decision", "/app/ops/workspace");
  }

  private taskSection(clinicId: string, checkedAt: string, briefDate: string | undefined, key: string, title: string, category: string, sourceUrl: string) {
    return safeSection(
      clinicId,
      checkedAt,
      key,
      title,
      source("task", `${title} task category`, sourceUrl),
      async () => {
        const dueClause = briefDate ? "AND (due_date IS NULL OR due_date <= ?)" : "";
        const values = briefDate ? [clinicId, category, briefDate] : [clinicId, category];
        const [rows]: any = await pool.execute(
          `SELECT id, title, description, priority, due_date as dueAt, assigned_to as assignedTo,
                  updated_at as latestRecordAt
           FROM task
           WHERE clinic_id = ?
             AND is_internal = 1
             AND category = ?
             AND status = 'pending'
             AND archived_at IS NULL
             ${dueClause}
           ORDER BY FIELD(priority, 'high', 'medium', 'low'), due_date ASC, updated_at DESC
           LIMIT 10`,
          values,
        );
        return {
          latestRecordAt: await latestTimestamp(clinicId, "task"),
          items: rows.map((row: any) =>
            item(row, title, `${row.priority} priority. ${compact(row.description, "")}`, row.priority === "high" ? "critical" : "warning", sourceUrl),
          ),
        };
      },
    );
  }
}

export const dailyExecutiveBriefingService = new DailyExecutiveBriefingService();
