import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import type {
  AiChatGuardrailStatus,
  AiChatMessageRecord,
  AiChatSessionDetail,
  AiChatSessionRecord,
  CreateAiChatSessionDTO,
} from "./ai-workspace.types.js";

type AssistantSummary = {
  clients: number;
  leads: number;
  openTasks: number;
  overdueTasks: number;
  proposals: number;
  sentProposals: number;
  scheduledAppointments: number;
  missedCalls: number;
};

const WRITE_INTENT_PATTERN =
  /\b(send|email|sms|whatsapp|message|delete|remove|update|edit|change|capture|refund|charge|approve|publish|commit|create)\b/i;
const SECRET_INTENT_PATTERN = /\b(password|secret|api key|token|credential|private key|bearer)\b/i;
const SUPPORTED_CONTEXT_PATTERN =
  /\b(client|lead|prospect|task|overdue|proposal|appointment|call|sla|pipeline|revenue|follow.?up|risk|summary|status)\b/i;

function parseJsonValue(value: unknown) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function titleFromMessage(message: string) {
  const title = message.trim().replace(/\s+/g, " ").slice(0, 80);
  return title || "Mission Control chat";
}

function mapSession(row: any): AiChatSessionRecord {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    createdBy: row.createdBy || null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    messageCount: Number(row.messageCount || 0),
  };
}

function mapMessage(row: any): AiChatMessageRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role,
    body: row.body,
    guardrailStatus: row.guardrailStatus || null,
    citations: parseJsonValue(row.citations),
    createdBy: row.createdBy || null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

async function readSummary(clinicId: string): Promise<AssistantSummary> {
  const [[contactRows], [taskRows], [proposalRows], [appointmentRows], [callRows]]: any[] = await Promise.all([
    pool.execute(
      `SELECT
          SUM(CASE WHEN status IN ('lead', 'New') OR lead_status IN ('new','contacted','qualified') THEN 1 ELSE 0 END) as leads
       FROM contact
       WHERE clinic_id = ? AND deleted_at IS NULL`,
      [clinicId],
    ),
    pool.execute(
      `SELECT
          COUNT(*) as openTasks,
          SUM(CASE WHEN due_date < CURRENT_DATE AND status NOT IN ('completed','done') THEN 1 ELSE 0 END) as overdueTasks
       FROM task
       WHERE clinic_id = ? AND deleted_at IS NULL AND archived_at IS NULL`,
      [clinicId],
    ),
    pool.execute(
      `SELECT COUNT(*) as proposals,
              SUM(CASE WHEN status IN ('sent','viewed','accepted') THEN 1 ELSE 0 END) as sentProposals
       FROM proposal
       WHERE clinic_id = ? AND deleted_at IS NULL`,
      [clinicId],
    ),
    pool.execute(
      `SELECT COUNT(*) as scheduledAppointments
       FROM appointment
       WHERE clinic_id = ? AND deleted_at IS NULL AND status = 'Scheduled'`,
      [clinicId],
    ),
    pool.execute(
      `SELECT COUNT(*) as missedCalls
       FROM missed_call_recovery
       WHERE clinic_id = ? AND recovery_state = 'attempted'`,
      [clinicId],
    ),
  ]);

  const [clientRows]: any = await pool.execute(
    "SELECT COUNT(*) as clients FROM client_account_profile WHERE clinic_id = ? AND client_status = 'active'",
    [clinicId],
  );

  return {
    clients: Number(clientRows[0]?.clients || 0),
    leads: Number(contactRows[0]?.leads || 0),
    openTasks: Number(taskRows[0]?.openTasks || 0),
    overdueTasks: Number(taskRows[0]?.overdueTasks || 0),
    proposals: Number(proposalRows[0]?.proposals || 0),
    sentProposals: Number(proposalRows[0]?.sentProposals || 0),
    scheduledAppointments: Number(appointmentRows[0]?.scheduledAppointments || 0),
    missedCalls: Number(callRows[0]?.missedCalls || 0),
  };
}

function buildAssistantResponse(message: string, summary: AssistantSummary): {
  body: string;
  guardrailStatus: AiChatGuardrailStatus;
  citations: Array<{ label: string; source: string }>;
} {
  if (SECRET_INTENT_PATTERN.test(message)) {
    return {
      guardrailStatus: "refused",
      body: "I cannot show or retrieve secrets, tokens or credentials. Ask an admin to check the approved secret store and rotation record.",
      citations: [{ label: "Security guardrail", source: "assistant_policy" }],
    };
  }

  if (WRITE_INTENT_PATTERN.test(message)) {
    return {
      guardrailStatus: "escalated",
      body: "I can summarise the situation, but I cannot perform write actions directly. Queue the proposed action for human approval before anything is changed or sent.",
      citations: [{ label: "Human approval workflow", source: "ai_action_approval" }],
    };
  }

  if (!SUPPORTED_CONTEXT_PATTERN.test(message)) {
    return {
      guardrailStatus: "escalated",
      body: "I do not have enough Mission Control context to answer that safely. Please ask about clients, leads, proposals, appointments, tasks, calls, SLA or pipeline status, or escalate to the relevant owner.",
      citations: [{ label: "Assistant scope", source: "mission_control_read_model" }],
    };
  }

  return {
    guardrailStatus: "answered",
    body: [
      `Current Mission Control summary: ${summary.clients} active client account${summary.clients === 1 ? "" : "s"}, ${summary.leads} active lead/prospect record${summary.leads === 1 ? "" : "s"}, ${summary.openTasks} open task${summary.openTasks === 1 ? "" : "s"} and ${summary.overdueTasks} overdue task${summary.overdueTasks === 1 ? "" : "s"}.`,
      `There are ${summary.proposals} proposal record${summary.proposals === 1 ? "" : "s"} with ${summary.sentProposals} sent/viewed/accepted, ${summary.scheduledAppointments} scheduled appointment${summary.scheduledAppointments === 1 ? "" : "s"} and ${summary.missedCalls} open missed-call recover${summary.missedCalls === 1 ? "y" : "ies"}.`,
      "Use this as a read-only operating summary; check the linked CRM views before making decisions.",
    ].join(" "),
    citations: [
      { label: "Contacts", source: "contact" },
      { label: "Client accounts", source: "client_account_profile" },
      { label: "Tasks", source: "task" },
      { label: "Proposals", source: "proposal" },
      { label: "Appointments", source: "appointment" },
      { label: "Missed-call recovery", source: "missed_call_recovery" },
    ],
  };
}

export class AiChatAssistantService {
  async listSessions(clinicId: string): Promise<AiChatSessionRecord[]> {
    const [rows]: any = await pool.execute(
      `SELECT s.id, s.title, s.status, s.created_by as createdBy,
              s.created_at as createdAt, s.updated_at as updatedAt,
              COUNT(m.id) as messageCount
       FROM ai_chat_session s
       LEFT JOIN ai_chat_message m ON m.session_id = s.id AND m.clinic_id = s.clinic_id
       WHERE s.clinic_id = ?
       GROUP BY s.id
       ORDER BY s.updated_at DESC
       LIMIT 50`,
      [clinicId],
    );
    return rows.map(mapSession);
  }

  async getSession(clinicId: string, sessionId: string): Promise<AiChatSessionDetail> {
    const [sessionRows]: any = await pool.execute(
      `SELECT s.id, s.title, s.status, s.created_by as createdBy,
              s.created_at as createdAt, s.updated_at as updatedAt,
              COUNT(m.id) as messageCount
       FROM ai_chat_session s
       LEFT JOIN ai_chat_message m ON m.session_id = s.id AND m.clinic_id = s.clinic_id
       WHERE s.id = ? AND s.clinic_id = ?
       GROUP BY s.id`,
      [sessionId, clinicId],
    );
    if (!sessionRows[0]) throw ApiError.notFound("AI chat session not found");

    const [messageRows]: any = await pool.execute(
      `SELECT id, session_id as sessionId, role, body, guardrail_status as guardrailStatus,
              citations, created_by as createdBy, created_at as createdAt
       FROM ai_chat_message
       WHERE session_id = ? AND clinic_id = ?
       ORDER BY message_index ASC, created_at ASC, id ASC`,
      [sessionId, clinicId],
    );

    return {
      ...mapSession(sessionRows[0]),
      messages: messageRows.map(mapMessage),
    };
  }

  async createSession(clinicId: string, userId: string, data: CreateAiChatSessionDTO): Promise<AiChatSessionDetail> {
    const sessionId = uuidv4();
    await pool.execute(
      `INSERT INTO ai_chat_session (id, clinic_id, title, created_by)
       VALUES (?, ?, ?, ?)`,
      [sessionId, clinicId, titleFromMessage(data.message), userId],
    );
    await this.addMessage(clinicId, userId, sessionId, data.message);
    await logAuditEvent({
      clinicId,
      userId,
      action: "AI_CHAT_SESSION_CREATED",
      entityType: "ai_chat_session",
      entityId: sessionId,
      changes: { title: titleFromMessage(data.message) },
    });
    return this.getSession(clinicId, sessionId);
  }

  async addMessage(clinicId: string, userId: string, sessionId: string, message: string): Promise<AiChatSessionDetail> {
    const [sessionRows]: any = await pool.execute(
      "SELECT id FROM ai_chat_session WHERE id = ? AND clinic_id = ?",
      [sessionId, clinicId],
    );
    if (!sessionRows[0]) throw ApiError.notFound("AI chat session not found");

    const [countRows]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM ai_chat_message WHERE session_id = ? AND clinic_id = ?",
      [sessionId, clinicId],
    );
    const nextMessageIndex = Number(countRows[0]?.count || 0);
    const summary = await readSummary(clinicId);
    const response = buildAssistantResponse(message, summary);
    await pool.execute(
      `INSERT INTO ai_chat_message
        (id, clinic_id, session_id, role, body, message_index, created_by)
       VALUES (?, ?, ?, 'user', ?, ?, ?)`,
      [uuidv4(), clinicId, sessionId, message, nextMessageIndex, userId],
    );
    await pool.execute(
      `INSERT INTO ai_chat_message
        (id, clinic_id, session_id, role, body, guardrail_status, citations, message_index, created_by)
       VALUES (?, ?, ?, 'assistant', ?, ?, CAST(? AS JSON), ?, ?)`,
      [uuidv4(), clinicId, sessionId, response.body, response.guardrailStatus, JSON.stringify(response.citations), nextMessageIndex + 1, userId],
    );
    await pool.execute(
      "UPDATE ai_chat_session SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ?",
      [sessionId, clinicId],
    );
    await logAuditEvent({
      clinicId,
      userId,
      action: "AI_CHAT_MESSAGE_ADDED",
      entityType: "ai_chat_session",
      entityId: sessionId,
      changes: { guardrailStatus: response.guardrailStatus, citationCount: response.citations.length },
    });

    return this.getSession(clinicId, sessionId);
  }
}

export const aiChatAssistantService = new AiChatAssistantService();
