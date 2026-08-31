import type { AiChatGuardrailStatus } from "./ai-workspace.types.js";

export const AI_PROMPT_SAFETY_POLICY_VERSION = "cg-093.prompt-safety.v1";

export const AI_TONE_GUIDE = [
  "Direct, calm and operational.",
  "Use plain English and avoid hype.",
  "Separate known facts from suggested next steps.",
  "Ask for human review before client-facing or commercial action.",
] as const;

export const AI_LEGAL_RED_LINES = [
  "Do not make clinical, legal, tax or financial advice claims.",
  "Do not guarantee growth, revenue, patient outcomes or advertising performance.",
  "Do not expose secrets, tokens, credentials, raw provider payloads or private keys.",
  "Do not generate client-facing commitments without human approval.",
] as const;

export const AI_SAFETY_GUARDRAILS = [
  "Read-only by default.",
  "Human approval is required before sends, deletes, refunds, charges, approvals, publishing or data mutation.",
  "Cite Mission Control source areas when answering from CRM data.",
  "Free Audit and audit-only contexts must stay outside-in and must not reveal a verified Growth Score or connected-data answer.",
] as const;

const WRITE_INTENT_PATTERN =
  /\b(send|email|sms|whatsapp|message|delete|remove|update|edit|change|capture|refund|charge|approve|publish|commit|create)\b/i;
const SECRET_INTENT_PATTERN = /\b(password|secret|api key|token|credential|private key|bearer)\b/i;
const UNSUPPORTED_CONTEXT_PATTERN =
  /\b(client|lead|prospect|task|overdue|proposal|appointment|call|sla|pipeline|revenue|follow.?up|risk|summary|status)\b/i;
const FREE_AUDIT_CONTEXT_PATTERN = /\b(free audit|audit-only|free-tier|free tier|outside-in)\b/i;
const CONNECTED_DATA_PATTERN =
  /\b(growth score|verified score|connected data|crm data|provider data|revenue|pipeline|client record|patient record)\b/i;

export interface AiPolicyDecision {
  body: string;
  guardrailStatus: AiChatGuardrailStatus;
  citations: Array<{ label: string; source: string }>;
}

export function classifyAssistantPolicy(message: string): AiPolicyDecision | null {
  if (SECRET_INTENT_PATTERN.test(message)) {
    return {
      guardrailStatus: "refused",
      body: "I cannot show or retrieve secrets, tokens or credentials. Ask an admin to check the approved secret store and rotation record.",
      citations: [{ label: "Security guardrail", source: AI_PROMPT_SAFETY_POLICY_VERSION }],
    };
  }

  if (FREE_AUDIT_CONTEXT_PATTERN.test(message) && CONNECTED_DATA_PATTERN.test(message)) {
    return {
      guardrailStatus: "refused",
      body: "Free Audit and audit-only contexts are outside-in only. I cannot provide verified Growth Score or connected-data answers unless the clinic has the approved diagnostic/data access.",
      citations: [{ label: "Free Audit guardrail", source: AI_PROMPT_SAFETY_POLICY_VERSION }],
    };
  }

  if (WRITE_INTENT_PATTERN.test(message)) {
    return {
      guardrailStatus: "escalated",
      body: "I can summarise the situation, but I cannot perform write actions directly. Queue the proposed action for human approval before anything is changed or sent.",
      citations: [{ label: "Human approval workflow", source: "ai_action_approval" }],
    };
  }

  if (!UNSUPPORTED_CONTEXT_PATTERN.test(message)) {
    return {
      guardrailStatus: "escalated",
      body: "I do not have enough Mission Control context to answer that safely. Please ask about clients, leads, proposals, appointments, tasks, calls, SLA or pipeline status, or escalate to the relevant owner.",
      citations: [{ label: "Assistant scope", source: "mission_control_read_model" }],
    };
  }

  return null;
}
