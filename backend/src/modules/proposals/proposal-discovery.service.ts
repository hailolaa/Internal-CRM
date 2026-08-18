import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import { buildTimelineMetadata, logTimelineActivity } from "../../utils/activity.js";
import { logAuditEvent } from "../../utils/audit.js";
import { proposalsService } from "./proposals.service.js";
import type {
  ProposalDataState,
  ProposalMutationDTO,
  ProposalSectionContent,
} from "./proposals.types.js";
import type {
  ProposalDiscoveryAnswer,
  ProposalDiscoveryAnswers,
  ProposalDiscoveryConflict,
  ProposalDiscoveryDraftResponse,
  ProposalDiscoveryGuideSection,
  ProposalDiscoveryIssue,
  ProposalDiscoverySectorBehaviour,
  ProposalDiscoverySessionResponse,
  ProposalDiscoveryStartDTO,
  ProposalDiscoveryStatus,
  ProposalDiscoveryUpdateDTO,
} from "./proposal-discovery.types.js";

const validDataStates = new Set<ProposalDataState>(["known", "working_diagnosis", "provisional", "to_confirm"]);
const activeDiscoveryStatuses = ["in_progress", "paused", "completed"] as const;

const sectorBehaviour: ProposalDiscoverySectorBehaviour[] = [
  { clinicType: "aesthetic_clinic", firstJourneyEmphasis: "treatment interest -> response -> consultation -> treatment/repeat", economicUnit: "completed injectable treatment" },
  { clinicType: "dental_clinic", firstJourneyEmphasis: "high-value enquiry -> coordinator -> consultation -> accepted plan", economicUnit: "accepted implant case" },
  { clinicType: "cosmetic_surgery_clinic", firstJourneyEmphasis: "procedure research -> suitability -> consultation -> deposit", economicUnit: "booked rhinoplasty procedure" },
  { clinicType: "dermatology_clinic", firstJourneyEmphasis: "condition search -> private route -> appointment -> care pathway", economicUnit: "attended new-patient appointment" },
  { clinicType: "hair_transplant_clinic", firstJourneyEmphasis: "research -> nurture -> assessment -> deposit", economicUnit: "booked FUE procedure" },
  { clinicType: "wellness_clinic", firstJourneyEmphasis: "education -> discovery -> enrolment -> renewal", economicUnit: "weight-management programme enrolment" },
  { clinicType: "private_gp_medical_clinic", firstJourneyEmphasis: "private access -> booking -> appointment -> attributable value", economicUnit: "attended private GP appointment" },
  { clinicType: "medical_spa", firstJourneyEmphasis: "positioning -> treatment page -> plan -> repeat/membership", economicUnit: "accepted skin-rejuvenation treatment plan" },
];

const discoveryGuide: ProposalDiscoveryGuideSection[] = [
  {
    key: "people",
    title: "People and clinic",
    purpose: "Confirm who owns the decision and what type of clinic/journey this proposal is for.",
    fields: [
      { key: "peopleDecisionMaker", label: "Decision-maker", prompt: "Who owns the commercial decision?", requiredForIssue: true },
      { key: "peopleRole", label: "Role", prompt: "What is their role in the clinic?", requiredForIssue: true },
      { key: "contactDetails", label: "Contact details", prompt: "Confirm best email and phone." },
      { key: "clinicType", label: "Clinic type", prompt: "Select the approved clinic type variant.", requiredForIssue: true },
      { key: "locations", label: "Locations", prompt: "Which clinic locations does this cover?", requiredForIssue: true },
      { key: "teamOwnership", label: "Team ownership", prompt: "Who currently owns enquiries, follow-up and reporting?" },
    ],
  },
  {
    key: "why_now",
    title: "Why now",
    purpose: "Capture the owner wording and urgency without turning it into invented strategy.",
    fields: [
      { key: "whyNowOwnerWording", label: "Owner wording", prompt: "What did they say in their own words?", requiredForIssue: true },
      { key: "commercialObjective", label: "Commercial objective", prompt: "What commercial result are they trying to improve?", requiredForIssue: true },
      { key: "urgency", label: "Urgency", prompt: "Why does this need action now?" },
      { key: "desiredStart", label: "Desired start", prompt: "When would they ideally start?", requiredForIssue: true },
      { key: "decisionProcess", label: "Decision process", prompt: "Who else is involved and what happens next?", requiredForIssue: true },
    ],
  },
  {
    key: "priority_route",
    title: "Priority route",
    purpose: "Choose the first patient/revenue journey to improve before proposing scope.",
    fields: [
      { key: "priorityServices", label: "Priority services", prompt: "Which treatments, procedures, programmes or service lines matter first?", requiredForIssue: true },
      { key: "capacity", label: "Capacity", prompt: "What monthly capacity exists for this route?", requiredForIssue: true },
      { key: "targetLocations", label: "Target locations", prompt: "Which locations or catchments are in scope?", requiredForIssue: true },
      { key: "firstJourney", label: "First journey", prompt: "What is the first journey to improve?", requiredForIssue: true },
    ],
  },
  {
    key: "current_journey",
    title: "Current journey",
    purpose: "Follow the patient and revenue journey from demand to retained value.",
    fields: [
      { key: "currentDemand", label: "Relevant demand", prompt: "What demand is coming in now?", requiredForIssue: true },
      { key: "enquiryHandling", label: "Enquiry handling", prompt: "How are enquiries handled today?", requiredForIssue: true },
      { key: "responseTime", label: "Response time", prompt: "How quickly are enquiries answered?", requiredForIssue: true },
      { key: "booking", label: "Booking", prompt: "What happens between enquiry and booking?", requiredForIssue: true },
      { key: "attendance", label: "Attendance", prompt: "What attendance or no-show picture is known?" },
      { key: "acceptanceEnrolment", label: "Acceptance/enrolment", prompt: "What is known about consult-to-treatment or enrolment?" },
      { key: "followUp", label: "Follow-up", prompt: "Who follows up and how is it recorded?" },
      { key: "recordedValue", label: "Recorded value", prompt: "Where is opportunity, plan, deposit or service value recorded?", requiredForIssue: true },
    ],
  },
  {
    key: "demand_spend",
    title: "Demand and spend",
    purpose: "Understand current acquisition activity and which numbers can be trusted.",
    fields: [
      { key: "channels", label: "Channels", prompt: "Which channels are active?" },
      { key: "currentMediaSpend", label: "Media spend", prompt: "What is the current monthly media spend?", requiredForIssue: true },
      { key: "agencies", label: "Agencies", prompt: "Who currently manages marketing or reporting?" },
      { key: "approximateVolumes", label: "Approximate volumes", prompt: "What enquiries/bookings are known or estimated?" },
      { key: "knownCplCpa", label: "Known CPL/CPA", prompt: "What cost per lead/acquisition is known?" },
      { key: "trustedData", label: "Trusted data", prompt: "Which data is trusted and which is not?", requiredForIssue: true },
    ],
  },
  {
    key: "systems_evidence",
    title: "Systems and evidence",
    purpose: "Identify where ClinicGrower OS can show live data and where it must use demonstration data.",
    fields: [
      { key: "website", label: "Website", prompt: "What website/CMS is in use?", requiredForIssue: true },
      { key: "callTracking", label: "Call tracking", prompt: "Is call tracking present and accessible?" },
      { key: "forms", label: "Forms", prompt: "Where do forms go?" },
      { key: "whatsapp", label: "WhatsApp", prompt: "How does WhatsApp fit the enquiry journey?" },
      { key: "crmPmsDiary", label: "CRM/PMS/diary", prompt: "What CRM, PMS or diary system is used?", requiredForIssue: true },
      { key: "analytics", label: "Analytics", prompt: "What analytics and conversion tracking exists?", requiredForIssue: true },
      { key: "adAccounts", label: "Ad accounts", prompt: "Which ad accounts are active?" },
      { key: "gbp", label: "GBP", prompt: "Is Google Business Profile access available?" },
      { key: "permissions", label: "Permissions", prompt: "What permissions are needed?" },
      { key: "dataLimitations", label: "Data limitations", prompt: "What is not currently measured or connected?", requiredForIssue: true },
    ],
  },
  {
    key: "economics",
    title: "Clinic economics",
    purpose: "Only calculate once contribution, capacity and media are confirmed.",
    fields: [
      { key: "economicUnit", label: "Economic unit", prompt: "What unit should break-even use?", requiredForIssue: true },
      { key: "price", label: "Price/value", prompt: "What headline price or value is relevant?" },
      { key: "confirmedContribution", label: "Confirmed contribution", prompt: "What gross contribution remains after variable delivery costs?", requiredForIssue: true },
      { key: "monthlyCapacity", label: "Monthly capacity", prompt: "How many units can the clinic actually deliver?", requiredForIssue: true },
      { key: "paybackExpectation", label: "Payback expectation", prompt: "How should payback be viewed?", requiredForIssue: true },
      { key: "confirmationSourceDate", label: "Evidence source/date", prompt: "Who confirmed this and when?", requiredForIssue: true },
    ],
  },
  {
    key: "recommendation",
    title: "Recommendation",
    purpose: "Draft the recommendation without silently changing approved package pricing.",
    fields: [
      { key: "workingConstraint", label: "Working constraint", prompt: "What is the first constraint to verify?", requiredForIssue: true },
      { key: "recommendedPackageId", label: "Recommended package", prompt: "Which approved package catalogue record fits?", requiredForIssue: true },
      { key: "scopeBoundary", label: "Scope boundary", prompt: "What is in and out of the first scope?", requiredForIssue: true },
      { key: "selectedMedia", label: "Selected media", prompt: "What media spend is selected or capped?", requiredForIssue: true },
      { key: "setup", label: "Setup", prompt: "What setup applies?", requiredForIssue: true },
      { key: "term", label: "Term", prompt: "What selected term applies?", requiredForIssue: true },
      { key: "proposedStart", label: "Proposed start", prompt: "What start date is proposed?", requiredForIssue: true },
      { key: "stillToConfirm", label: "Still to confirm", prompt: "What remains unresolved?" },
    ],
  },
  {
    key: "proof_governance",
    title: "Proof and governance",
    purpose: "Keep proof, claim caveats, clinical boundary and exclusions safe.",
    fields: [
      { key: "proofMode", label: "Proof mode", prompt: "Same-sector, comparable-sector or cross-sector proof?", requiredForIssue: true },
      { key: "claimCaveats", label: "Claim caveats", prompt: "What must be qualified?", requiredForIssue: true },
      { key: "authorisedApprover", label: "Authorised approver", prompt: "Who can approve?", requiredForIssue: true },
      { key: "clinicalBoundary", label: "Clinical boundary", prompt: "What must remain with the clinic?", requiredForIssue: true },
      { key: "excludedWork", label: "Excluded work", prompt: "What is not included?", requiredForIssue: true },
    ],
  },
  {
    key: "close",
    title: "Close",
    purpose: "Leave the call with a next action and owner.",
    fields: [
      { key: "callOutcome", label: "Call outcome", prompt: "What happened on the call?", requiredForIssue: true },
      { key: "objectionsQuestions", label: "Objections/questions", prompt: "What objections or questions remain?" },
      { key: "nextAction", label: "Next action", prompt: "What happens next?", requiredForIssue: true },
      { key: "nextActionOwner", label: "Owner", prompt: "Who owns the next action?", requiredForIssue: true },
      { key: "nextActionDueDate", label: "Due date", prompt: "When is it due?", requiredForIssue: true },
    ],
  },
];

const fieldLabels = new Map(
  discoveryGuide.flatMap((section) => section.fields.map((field) => [field.key, field.label] as const)),
);

const requiredForIssue = discoveryGuide
  .flatMap((section) => section.fields)
  .filter((field) => field.requiredForIssue)
  .map((field) => field.key);

function cleanString(value: unknown) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function normalizeDataState(value: unknown): ProposalDataState {
  return validDataStates.has(value as ProposalDataState) ? value as ProposalDataState : "to_confirm";
}

function normalizeAnswer(value: unknown): ProposalDiscoveryAnswer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Partial<ProposalDiscoveryAnswer>;
  const approvalStatus: ProposalDiscoveryAnswer["approvalStatus"] = ["not_required", "pending", "approved", "rejected"].includes(String(input.approvalStatus))
    ? input.approvalStatus as NonNullable<ProposalDiscoveryAnswer["approvalStatus"]>
    : null;
  return {
    value: cleanString(input.value),
    state: normalizeDataState(input.state),
    sourceLabel: cleanString(input.sourceLabel),
    sourceAt: cleanString(input.sourceAt),
    evidenceReference: cleanString(input.evidenceReference),
    approvedBy: cleanString(input.approvedBy),
    approvedAt: cleanString(input.approvedAt),
    approvalStatus,
    customerWording: cleanString(input.customerWording),
    notes: cleanString(input.notes),
  };
}

function normalizeAnswers(value: unknown): ProposalDiscoveryAnswers {
  const parsed = parseJsonObject(value);
  if (!parsed) return {};
  return Object.fromEntries(
    Object.entries(parsed)
      .map(([key, answer]) => [key, normalizeAnswer(answer)] as const)
      .filter(([, answer]) => Boolean(answer)),
  ) as ProposalDiscoveryAnswers;
}

function answerValue(answers: ProposalDiscoveryAnswers, key: string) {
  return cleanString(answers[key]?.value);
}

function answerState(answers: ProposalDiscoveryAnswers, key: string) {
  return normalizeDataState(answers[key]?.state);
}

function answerEvidenceReference(answer: ProposalDiscoveryAnswer | undefined) {
  if (!answer) return null;
  return cleanString(answer.evidenceReference)
    || [cleanString(answer.sourceLabel), cleanString(answer.sourceAt)].filter(Boolean).join(" - ")
    || null;
}

function buildSectionFieldMetadata(
  answers: ProposalDiscoveryAnswers,
  mapping: Record<string, string>,
): {
  fieldEvidenceReferences: NonNullable<ProposalSectionContent["fieldEvidenceReferences"]> | null;
  fieldApprovals: NonNullable<ProposalSectionContent["fieldApprovals"]> | null;
} {
  const fieldEvidenceReferences: NonNullable<ProposalSectionContent["fieldEvidenceReferences"]> = {};
  const fieldApprovals: NonNullable<ProposalSectionContent["fieldApprovals"]> = {};

  for (const [fieldKey, answerKey] of Object.entries(mapping)) {
    const answer = answers[answerKey];
    if (!answer) continue;
    const evidenceReference = answerEvidenceReference(answer);
    if (evidenceReference) fieldEvidenceReferences[fieldKey] = evidenceReference;

    const approvedBy = cleanString(answer.approvedBy);
    const approvedAt = cleanString(answer.approvedAt);
    const approvalStatus = answer.approvalStatus || null;
    if (approvedBy || approvedAt || approvalStatus) {
      fieldApprovals[fieldKey] = {
        evidenceReference,
        approvedBy,
        approvedAt,
        approvalStatus,
      };
    }
  }

  return {
    fieldEvidenceReferences: Object.keys(fieldEvidenceReferences).length ? fieldEvidenceReferences : null,
    fieldApprovals: Object.keys(fieldApprovals).length ? fieldApprovals : null,
  };
}

function parseMoneyCents(value: unknown) {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  const numeric = Number(cleaned.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : null;
}

function parseTermMonths(value: unknown) {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();
  if (lower.includes("six")) return 6;
  if (lower.includes("twelve")) return 12;
  const match = lower.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function parseDateOnly(value: unknown) {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  const date = new Date(cleaned);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function toMysqlDateTime(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function toIso(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function containsPotentialPatientIdentifier(text: string | null | undefined) {
  if (!text) return false;
  return /\b(patient|NHS|date of birth|DOB|medical record|MRN|diagnosis for|prescription|test result)\b/i.test(text);
}

function summarizeMissingFields(answers: ProposalDiscoveryAnswers): ProposalDiscoveryIssue[] {
  return requiredForIssue
    .filter((key) => !answerValue(answers, key) || answerState(answers, key) === "to_confirm")
    .map((key) => ({
      fieldKey: key,
      label: fieldLabels.get(key) || key,
      message: "Required before the proposal can be issued. Unknown is allowed during the call, but it must remain visible.",
      severity: "required" as const,
    }));
}

function summarizeConflicts(input: {
  answers: ProposalDiscoveryAnswers;
  freeNotes?: string | null;
  recommendedPackageId?: string | null;
  selectedMediaSpendCents?: number | null;
}) {
  const conflicts: ProposalDiscoveryConflict[] = [];
  const answers = input.answers;
  const contributionState = answerState(answers, "confirmedContribution");
  const paybackState = answerState(answers, "paybackExpectation");
  const selectedMedia = answerValue(answers, "selectedMedia");
  const recommendedPackageId = input.recommendedPackageId || answerValue(answers, "recommendedPackageId");

  if (contributionState !== "known") {
    conflicts.push({
      code: "contribution_not_confirmed",
      message: "Do not calculate break-even until contribution is confirmed by the clinic.",
      severity: "blocking",
    });
  }
  if (paybackState !== "known") {
    conflicts.push({
      code: "payback_not_confirmed",
      message: "Do not present payback or break-even as verified until the payback assumption is confirmed.",
      severity: "blocking",
    });
  }
  if (recommendedPackageId && !answerValue(answers, "scopeBoundary")) {
    conflicts.push({
      code: "package_without_scope_boundary",
      message: "A package is selected but the exact scope boundary is not captured.",
      severity: "blocking",
    });
  }
  if (recommendedPackageId && !selectedMedia && input.selectedMediaSpendCents === null) {
    conflicts.push({
      code: "package_without_media",
      message: "Media spend must be separate from the ClinicGrower fee before issue.",
      severity: "blocking",
    });
  }
  if (!answerValue(answers, "term")) {
    conflicts.push({
      code: "term_missing",
      message: "The selected term must be explicit on the proposal; do not inherit marketing wording.",
      severity: "blocking",
    });
  }
  const combinedText = [
    input.freeNotes,
    ...Object.values(answers).flatMap((answer) => [answer?.value, answer?.customerWording, answer?.notes]),
  ].filter(Boolean).join("\n");
  if (containsPotentialPatientIdentifier(combinedText)) {
    conflicts.push({
      code: "possible_patient_identifiable_data",
      message: "Remove patient-identifiable or unnecessary clinical detail before creating the proposal draft.",
      severity: "blocking",
    });
  }
  return conflicts;
}

function mapSession(row: any): ProposalDiscoverySessionResponse {
  const answers = normalizeAnswers(row.answers);
  const missingFields = parseJsonObject(row.missingFields)?.items as ProposalDiscoveryIssue[] | undefined
    || summarizeMissingFields(answers);
  const conflicts = parseJsonObject(row.conflicts)?.items as ProposalDiscoveryConflict[] | undefined
    || summarizeConflicts({
      answers,
      freeNotes: row.freeNotes || null,
      recommendedPackageId: row.recommendedPackageId || null,
      selectedMediaSpendCents: row.selectedMediaSpendCents === null || row.selectedMediaSpendCents === undefined
        ? null
        : Number(row.selectedMediaSpendCents),
    });

  return {
    id: row.id,
    contactId: row.contactId || null,
    dealId: row.dealId || null,
    clientAccountProfileId: row.clientAccountProfileId || null,
    proposalId: row.proposalId || null,
    status: row.status || "in_progress",
    clinicType: row.clinicType || null,
    recommendedPackageId: row.recommendedPackageId || null,
    activeConstraintId: row.activeConstraintId || null,
    selectedMediaSpendCents: row.selectedMediaSpendCents === null || row.selectedMediaSpendCents === undefined
      ? null
      : Number(row.selectedMediaSpendCents),
    prefillSnapshot: parseJsonObject(row.prefillSnapshot),
    answers,
    freeNotes: row.freeNotes || null,
    missingFields,
    topMissingFields: missingFields.slice(0, 3),
    conflicts,
    callOutcome: row.callOutcome || null,
    nextAction: row.nextAction || null,
    nextActionOwnerId: row.nextActionOwnerId || null,
    nextActionDueAt: toIso(row.nextActionDueAt),
    startedAt: new Date(row.startedAt).toISOString(),
    lastAutosavedAt: toIso(row.lastAutosavedAt),
    completedAt: toIso(row.completedAt),
    createdBy: row.createdBy || null,
    updatedBy: row.updatedBy || null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    guide: discoveryGuide,
    sectorBehaviour,
  };
}

export class ProposalDiscoveryService {
  async startOrResumeSession(
    clinicId: string,
    userId: string,
    data: ProposalDiscoveryStartDTO,
  ): Promise<ProposalDiscoverySessionResponse> {
    const links = await this.assertLinksBelongToWorkspace(clinicId, data);
    const existing = await this.findResumableSession(clinicId, data);
    if (existing) return existing;

    const id = uuidv4();
    const prefillSnapshot = await this.buildPrefillSnapshot(clinicId, links);
    const starterAnswers = this.buildStarterAnswers(prefillSnapshot);
    const missingFields = summarizeMissingFields(starterAnswers);
    const conflicts = summarizeConflicts({ answers: starterAnswers });

    await pool.execute(
      `INSERT INTO proposal_discovery_session
        (id, clinic_id, contact_id, deal_id, client_account_profile_id, proposal_id,
         status, clinic_type, prefill_snapshot, answers, missing_fields, conflicts,
         created_by, updated_by, last_autosaved_at)
       VALUES (?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        id,
        clinicId,
        links.contactId,
        links.dealId,
        links.clientAccountProfileId,
        links.proposalId,
        cleanString(starterAnswers.clinicType?.value),
        JSON.stringify(prefillSnapshot),
        JSON.stringify(starterAnswers),
        JSON.stringify({ items: missingFields }),
        JSON.stringify({ items: conflicts }),
        userId,
        userId,
      ],
    );
    await this.upsertAnswerSources(clinicId, id, starterAnswers, userId);
    await logAuditEvent({
      clinicId,
      userId,
      action: "PROPOSAL_DISCOVERY_SESSION_STARTED",
      entityType: "proposal_discovery_session",
      entityId: id,
      changes: links,
    });

    return this.getSession(clinicId, id);
  }

  async getSession(clinicId: string, sessionId: string): Promise<ProposalDiscoverySessionResponse> {
    const [rows]: any = await pool.execute(
      `${this.sessionSelectSql()} WHERE pds.id = ? AND pds.clinic_id = ? AND pds.deleted_at IS NULL LIMIT 1`,
      [sessionId, clinicId],
    );
    if (rows.length === 0) throw ApiError.notFound("Proposal discovery session not found");
    return mapSession(rows[0]);
  }

  async updateSession(
    clinicId: string,
    userId: string,
    sessionId: string,
    data: ProposalDiscoveryUpdateDTO,
  ): Promise<ProposalDiscoverySessionResponse> {
    const existing = await this.getSession(clinicId, sessionId);
    const answers = {
      ...existing.answers,
      ...normalizeAnswers(data.answers || {}),
    };
    const recommendedPackageId = cleanString(data.recommendedPackageId) || answerValue(answers, "recommendedPackageId") || existing.recommendedPackageId;
    if (recommendedPackageId) await this.assertPackageBelongsToWorkspace(clinicId, recommendedPackageId);

    const selectedMediaSpendCents = data.selectedMediaSpendCents === undefined
      ? existing.selectedMediaSpendCents ?? parseMoneyCents(answerValue(answers, "selectedMedia"))
      : data.selectedMediaSpendCents;
    const freeNotes = data.freeNotes === undefined ? existing.freeNotes : cleanString(data.freeNotes);
    const missingFields = summarizeMissingFields(answers);
    const conflicts = summarizeConflicts({ answers, freeNotes, recommendedPackageId, selectedMediaSpendCents: selectedMediaSpendCents ?? null });
    const status = data.status || existing.status;

    await pool.execute(
      `UPDATE proposal_discovery_session
       SET status = ?,
           clinic_type = ?,
           recommended_package_id = ?,
           active_constraint_id = ?,
           selected_media_spend_cents = ?,
           answers = ?,
           free_notes = ?,
           missing_fields = ?,
           conflicts = ?,
           call_outcome = ?,
           next_action = ?,
           next_action_owner_id = ?,
           next_action_due_at = ?,
           completed_at = CASE WHEN ? IN ('completed','draft_created') AND completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE completed_at END,
           last_autosaved_at = CURRENT_TIMESTAMP,
           updated_by = ?
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL`,
      [
        status,
        cleanString(data.clinicType) || answerValue(answers, "clinicType") || existing.clinicType,
        recommendedPackageId,
        cleanString(data.activeConstraintId) || answerValue(answers, "workingConstraint") || existing.activeConstraintId,
        selectedMediaSpendCents ?? null,
        JSON.stringify(answers),
        freeNotes,
        JSON.stringify({ items: missingFields }),
        JSON.stringify({ items: conflicts }),
        data.callOutcome === undefined ? existing.callOutcome : cleanString(data.callOutcome),
        data.nextAction === undefined ? existing.nextAction : cleanString(data.nextAction),
        data.nextActionOwnerId === undefined ? existing.nextActionOwnerId : cleanString(data.nextActionOwnerId),
        data.nextActionDueAt === undefined ? toMysqlDateTime(existing.nextActionDueAt) : toMysqlDateTime(data.nextActionDueAt),
        status,
        userId,
        sessionId,
        clinicId,
      ],
    );
    await this.upsertAnswerSources(clinicId, sessionId, answers, userId);
    return this.getSession(clinicId, sessionId);
  }

  async generateDraftProposal(
    clinicId: string,
    userId: string,
    sessionId: string,
    access: { canManageAllClientAccounts: boolean },
  ): Promise<ProposalDiscoveryDraftResponse> {
    const session = await this.getSession(clinicId, sessionId);
    const answers = session.answers;
    const recommendedPackageId = session.recommendedPackageId || answerValue(answers, "recommendedPackageId");
    if (!recommendedPackageId) {
      throw ApiError.badRequest("Select an approved package before creating the draft proposal.");
    }
    const selectedPackage = await this.getPackage(clinicId, recommendedPackageId);
    const clinicName = cleanString(
      (session.prefillSnapshot?.contact as any)?.accountName ||
      (session.prefillSnapshot?.account as any)?.name ||
      answerValue(answers, "locations"),
    ) || "Prospective Clinic";
    const sectionContent = this.buildProposalSectionContent(session, selectedPackage);
    const payload: ProposalMutationDTO = {
      contactId: session.contactId,
      dealId: session.dealId,
      clientAccountProfileId: session.clientAccountProfileId,
      proposalName: `Personalised Growth Proposal for ${clinicName}`,
      templateKey: "clinicgrower_v5",
      packageName: selectedPackage.name,
      recommendedPackageId: selectedPackage.id,
      ownerId: userId,
      status: "draft",
      valueCents: selectedPackage.priceCents,
      monthlyFeeCents: selectedPackage.billingFrequency === "monthly" ? selectedPackage.priceCents : null,
      setupFeeCents: selectedPackage.setupFeeCents,
      currency: selectedPackage.currency,
      adSpendNote: answerValue(answers, "selectedMedia"),
      vatStatus: "plus_vat",
      minimumTermMonths: parseTermMonths(answerValue(answers, "term")),
      startDate: parseDateOnly(answerValue(answers, "proposedStart")),
      notes: cleanString(session.freeNotes),
      sectionContent,
    };
    const proposal = session.proposalId
      ? await proposalsService.updateProposal(clinicId, userId, session.proposalId, payload, access)
      : await proposalsService.createProposal(clinicId, userId, payload, access);

    await pool.execute(
      `UPDATE proposal_discovery_session
       SET proposal_id = ?,
           status = 'draft_created',
           completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
           last_autosaved_at = CURRENT_TIMESTAMP,
           updated_by = ?
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL`,
      [proposal.id, userId, sessionId, clinicId],
    );

    await this.logSessionTimeline(clinicId, userId, { ...session, proposalId: proposal.id }, proposal.id);
    await logAuditEvent({
      clinicId,
      userId,
      action: "PROPOSAL_DISCOVERY_DRAFT_CREATED",
      entityType: "proposal_discovery_session",
      entityId: sessionId,
      changes: {
        proposalId: proposal.id,
        recommendedPackageId,
        missingFields: session.missingFields.length,
        conflicts: session.conflicts.length,
      },
    });

    return {
      session: await this.getSession(clinicId, sessionId),
      proposal,
    };
  }

  private buildProposalSectionContent(
    session: ProposalDiscoverySessionResponse,
    selectedPackage: { id: string; name: string; priceCents: number | null; setupFeeCents: number | null; catalogueVersion?: string | null },
  ): ProposalSectionContent {
    const answers = session.answers;
    const clinicType = session.clinicType || answerValue(answers, "clinicType") || "general";
    const commercialObjective = answerValue(answers, "commercialObjective");
    const selectedMedia = answerValue(answers, "selectedMedia");
    const fieldMetadata = buildSectionFieldMetadata(answers, {
      clinicTypeVariant: "clinicType",
      discoverySource: "trustedData",
      customerWording: "whyNowOwnerWording",
      evidenceConfidenceState: "trustedData",
      activeConstraintId: "workingConstraint",
      activeConstraintConfidenceState: "workingConstraint",
      economicUnit: "economicUnit",
      clinicConfirmedContribution: "confirmedContribution",
      contributionEvidenceSourceDate: "confirmationSourceDate",
      contributionConfirmationState: "confirmedContribution",
      selectedMediaSpend: "selectedMedia",
      paybackState: "paybackExpectation",
      knownDataLimitations: "dataLimitations",
      executiveSummary: "commercialObjective",
      personalIntroduction: "whyNowOwnerWording",
      diagnosis: "workingConstraint",
      primaryGoal: "commercialObjective",
      clinicTypeAndLocations: "locations",
      currentPosition: "currentDemand",
      currentMarketingSpend: "currentMediaSpend",
      currentWebsiteCrmBookingSetup: "crmPmsDiary",
      problemsDiscussed: "enquiryHandling",
      whyActNow: "urgency",
      currentlyUnmeasured: "dataLimitations",
      availableCapacity: "capacity",
      priorityTreatments: "priorityServices",
      targetArea: "targetLocations",
      desiredOutcome: "commercialObjective",
      biggestRisk: "workingConstraint",
      biggestOpportunity: "recordedValue",
      firstRecommendedFix: "firstJourney",
      currentMonthlyEnquiries: "approximateVolumes",
      currentMonthlyBookedPatients: "booking",
      attendanceRate: "attendance",
      consultationToTreatmentConversionRate: "acceptanceEnrolment",
      averageTreatmentValue: "price",
      availableCommercialCapacity: "monthlyCapacity",
      currentAcquisitionCost: "knownCplCpa",
      commercialDataSource: "trustedData",
      recommendedPlan: "recommendedPackageId",
      termsSummary: "term",
      clientResponsibilities: "permissions",
      nextSteps: "nextAction",
    });
    return {
      proposalDate: new Date().toISOString().slice(0, 10),
      clinicTypeVariant: clinicType,
      discoverySource: "Live proposal discovery call",
      customerWording: answerValue(answers, "whyNowOwnerWording"),
      evidenceConfidenceState: answerState(answers, "trustedData"),
      activeConstraintId: session.activeConstraintId || answerValue(answers, "workingConstraint"),
      activeConstraintConfidenceState: answerState(answers, "workingConstraint"),
      economicUnit: answerValue(answers, "economicUnit"),
      clinicConfirmedContribution: answerValue(answers, "confirmedContribution"),
      contributionEvidenceSourceDate: answerValue(answers, "confirmationSourceDate"),
      contributionConfirmationState: answerState(answers, "confirmedContribution"),
      selectedMediaSpend: selectedMedia,
      paybackState: answerState(answers, "paybackExpectation"),
      liveDataStatus: "not_connected",
      knownDataLimitations: answerValue(answers, "dataLimitations"),
      executiveSummary: commercialObjective
        ? `The recommendation is based on the discovery call objective: ${commercialObjective}.`
        : null,
      personalIntroduction: answerValue(answers, "whyNowOwnerWording"),
      diagnosis: answerValue(answers, "workingConstraint"),
      primaryGoal: commercialObjective,
      clinicTypeAndLocations: [answerValue(answers, "clinicType"), answerValue(answers, "locations")].filter(Boolean).join(" - ") || null,
      currentPosition: answerValue(answers, "currentDemand"),
      currentMarketingSpend: answerValue(answers, "currentMediaSpend"),
      currentWebsiteCrmBookingSetup: [
        answerValue(answers, "website"),
        answerValue(answers, "crmPmsDiary"),
        answerValue(answers, "analytics"),
        answerValue(answers, "callTracking"),
      ].filter(Boolean).join("\n") || null,
      problemsDiscussed: [
        answerValue(answers, "enquiryHandling"),
        answerValue(answers, "responseTime"),
        answerValue(answers, "booking"),
        answerValue(answers, "recordedValue"),
      ].filter(Boolean).join("\n") || null,
      whyActNow: answerValue(answers, "urgency"),
      currentlyUnmeasured: answerValue(answers, "dataLimitations"),
      availableCapacity: answerValue(answers, "capacity"),
      priorityTreatments: answerValue(answers, "priorityServices"),
      targetArea: answerValue(answers, "targetLocations") || answerValue(answers, "locations"),
      desiredOutcome: commercialObjective,
      biggestRisk: answerValue(answers, "workingConstraint"),
      biggestOpportunity: answerValue(answers, "recordedValue"),
      firstRecommendedFix: answerValue(answers, "firstJourney"),
      currentMonthlyEnquiries: answerValue(answers, "approximateVolumes") || "not currently measured",
      currentMonthlyBookedPatients: answerValue(answers, "booking") || "not currently measured",
      currentBookingRate: "not currently measured",
      attendanceRate: answerValue(answers, "attendance") || "not currently measured",
      consultationToTreatmentConversionRate: answerValue(answers, "acceptanceEnrolment") || "not currently measured",
      averageTreatmentValue: answerValue(answers, "price") || "not currently measured",
      availableCommercialCapacity: answerValue(answers, "monthlyCapacity") || answerValue(answers, "capacity"),
      currentAcquisitionCost: answerValue(answers, "knownCplCpa") || "not currently measured",
      commercialDataSource: answerValue(answers, "trustedData") || answerValue(answers, "confirmationSourceDate"),
      commercialChangeReason: null,
      commercialApprovalStatus: "not_required",
      recommendedPlan: `Recommended programme: ${selectedPackage.name} powered by ClinicGrower OS. Scope remains controlled by the approved catalogue version ${selectedPackage.catalogueVersion || "not recorded"}.`,
      termsSummary: [
        answerValue(answers, "term") ? `Selected term: ${answerValue(answers, "term")}.` : null,
        answerValue(answers, "setup") ? `Setup: ${answerValue(answers, "setup")}.` : null,
        selectedMedia ? `Selected media: ${selectedMedia}. Paid directly to the selected platform with no ClinicGrower markup.` : null,
      ].filter(Boolean).join(" "),
      clinicGrowerResponsibilities: [
        "Operate the ClinicGrower OS commercial accountability layer where sources are connected.",
        "Keep the first journey, evidence gaps and next actions visible.",
        "Human review remains required for claims, AI output and commercial decisions.",
      ],
      clientResponsibilities: [
        answerValue(answers, "permissions") || "Provide required account permissions and source access.",
        answerValue(answers, "clinicalBoundary") || "Clinical judgement, suitability and care decisions remain with the clinic.",
      ],
      successMetrics: [
        "Enquiry response ownership | baseline to confirm | call/form/WhatsApp sources where connected",
        "Booked consultation progression | baseline to confirm | CRM/PMS/diary where connected",
        "Recorded value visibility | baseline to confirm | opportunity/plan/deposit/service value source where connected",
      ],
      nextSteps: [
        answerValue(answers, "nextAction") || "Review the draft proposal before issue.",
        "Complete any required pricing, scope, term, proof and acceptance fields before issue.",
      ].join("\n"),
      fieldEvidenceReferences: fieldMetadata.fieldEvidenceReferences,
      fieldApprovals: fieldMetadata.fieldApprovals,
    };
  }

  private buildStarterAnswers(prefillSnapshot: Record<string, unknown>) {
    const contact = prefillSnapshot.contact as Record<string, unknown> | undefined;
    const account = prefillSnapshot.account as Record<string, unknown> | undefined;
    const now = new Date().toISOString();
    const answers: ProposalDiscoveryAnswers = {};
    const add = (key: string, value: unknown, state: ProposalDataState = "known") => {
      const cleaned = cleanString(value);
      if (!cleaned) return;
      answers[key] = {
        value: cleaned,
        state,
        sourceLabel: "CRM prefill",
        sourceAt: now,
        customerWording: null,
      };
    };
    add("peopleDecisionMaker", contact?.name);
    add("contactDetails", [contact?.email, contact?.phone].filter(Boolean).join(" / "));
    add("clinicType", account?.clinicType || contact?.clinicType, "provisional");
    add("locations", account?.location || contact?.location, "provisional");
    add("website", account?.website || contact?.website);
    add("crmPmsDiary", account?.currentWebsiteCrmBookingSetup || null, "provisional");
    return answers;
  }

  private async findResumableSession(clinicId: string, data: ProposalDiscoveryStartDTO) {
    const clauses: string[] = [];
    const values: any[] = [];
    const add = (column: string, value: unknown) => {
      const cleaned = cleanString(value);
      if (!cleaned) return;
      clauses.push(`${column} = ?`);
      values.push(cleaned);
    };
    add("contact_id", data.contactId);
    add("deal_id", data.dealId);
    add("client_account_profile_id", data.clientAccountProfileId);
    add("proposal_id", data.proposalId);
    if (!clauses.length) return null;

    const [rows]: any = await pool.execute(
      `${this.sessionSelectSql()}
       WHERE pds.clinic_id = ?
         AND pds.deleted_at IS NULL
         AND pds.status IN (${activeDiscoveryStatuses.map(() => "?").join(", ")})
         AND (${clauses.join(" OR ")})
       ORDER BY pds.updated_at DESC
       LIMIT 1`,
      [clinicId, ...activeDiscoveryStatuses, ...values],
    );
    return rows[0] ? mapSession(rows[0]) : null;
  }

  private async buildPrefillSnapshot(clinicId: string, links: ProposalDiscoveryStartDTO) {
    const [contactRows]: any = links.contactId
      ? await pool.execute(
        `SELECT id,
                CONCAT_WS(' ', first_name, last_name) as name,
                email,
                phone,
                account_name as accountName,
                website,
                CONCAT_WS(', ', city, state, country) as location,
                package_interest as packageInterest,
                treatment_interests as treatmentInterests
         FROM contact
         WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [clinicId, links.contactId],
      )
      : [[]];
    const [accountRows]: any = links.clientAccountProfileId
      ? await pool.execute(
        `SELECT cap.id,
                c.name,
                c.website,
                CONCAT_WS(', ', c.city, c.state, c.country) as location,
                cap.current_package as currentPackage,
                cap.recommended_next_package as recommendedNextPackage,
                cap.growth_score_gap_summary as growthScoreGapSummary
         FROM client_account_profile cap
         JOIN clinic c ON c.id = cap.clinic_id
         WHERE cap.id = ?
           AND cap.deleted_at IS NULL
         LIMIT 1`,
        [links.clientAccountProfileId],
      )
      : [[]];
    return {
      contact: contactRows[0] || null,
      account: accountRows[0] || null,
      generatedAt: new Date().toISOString(),
    };
  }

  private async assertLinksBelongToWorkspace(clinicId: string, data: ProposalDiscoveryStartDTO) {
    const contactId = cleanString(data.contactId);
    const dealId = cleanString(data.dealId);
    const clientAccountProfileId = cleanString(data.clientAccountProfileId);
    const proposalId = cleanString(data.proposalId);
    if (!contactId && !dealId && !clientAccountProfileId && !proposalId) {
      throw ApiError.badRequest("Start call mode from a lead, contact, account or proposal draft.");
    }
    if (contactId) {
      const [rows]: any = await pool.execute(
        `SELECT id FROM contact WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL LIMIT 1`,
        [contactId, clinicId],
      );
      if (!rows.length) throw ApiError.notFound("Contact not found for this workspace");
    }
    if (dealId) {
      const [rows]: any = await pool.execute(
        `SELECT id FROM deal WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL LIMIT 1`,
        [dealId, clinicId],
      );
      if (!rows.length) throw ApiError.notFound("Deal not found for this workspace");
    }
    if (proposalId) {
      await proposalsService.getProposal(clinicId, proposalId);
    }
    if (clientAccountProfileId) {
      const [rows]: any = await pool.execute(
        `SELECT id
         FROM client_account_profile
         WHERE id = ?
           AND deleted_at IS NULL
         LIMIT 1`,
        [clientAccountProfileId],
      );
      if (!rows.length) throw ApiError.notFound("Client account not found");
    }
    return { contactId, dealId, clientAccountProfileId, proposalId };
  }

  private async assertPackageBelongsToWorkspace(clinicId: string, packageId: string) {
    await this.getPackage(clinicId, packageId);
  }

  private async getPackage(clinicId: string, packageId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              name,
              price_cents as priceCents,
              setup_fee_cents as setupFeeCents,
              currency,
              billing_frequency as billingFrequency,
              catalogue_version as catalogueVersion
       FROM growth_package
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
         AND status = 'active'
       LIMIT 1`,
      [packageId, clinicId],
    );
    if (!rows.length) throw ApiError.badRequest("Recommended package must be an active approved catalogue record");
    return {
      id: rows[0].id as string,
      name: rows[0].name as string,
      priceCents: rows[0].priceCents === null || rows[0].priceCents === undefined ? null : Number(rows[0].priceCents),
      setupFeeCents: rows[0].setupFeeCents === null || rows[0].setupFeeCents === undefined ? null : Number(rows[0].setupFeeCents),
      currency: rows[0].currency || "GBP",
      billingFrequency: rows[0].billingFrequency || "monthly",
      catalogueVersion: rows[0].catalogueVersion || null,
    };
  }

  private async upsertAnswerSources(
    clinicId: string,
    sessionId: string,
    answers: ProposalDiscoveryAnswers,
    userId: string,
  ) {
    for (const [fieldKey, answer] of Object.entries(answers)) {
      if (!answer) continue;
      await pool.execute(
        `INSERT INTO proposal_discovery_answer_source
          (id, clinic_id, session_id, field_key, state, source_label, source_at, customer_wording, value_snapshot, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           state = VALUES(state),
           source_label = VALUES(source_label),
           source_at = VALUES(source_at),
           customer_wording = VALUES(customer_wording),
           value_snapshot = VALUES(value_snapshot),
           updated_by = VALUES(updated_by),
           updated_at = CURRENT_TIMESTAMP`,
        [
          uuidv4(),
          clinicId,
          sessionId,
          fieldKey,
          answer.state,
          answer.sourceLabel,
          toMysqlDateTime(answer.sourceAt) || new Date().toISOString().slice(0, 19).replace("T", " "),
          answer.customerWording,
          JSON.stringify(answer),
          userId,
        ],
      );
    }
  }

  private async logSessionTimeline(
    clinicId: string,
    userId: string,
    session: ProposalDiscoverySessionResponse,
    proposalId: string,
  ) {
    if (!session.contactId) return;
    await logTimelineActivity({
      clinicId,
      contactId: session.contactId,
      userId,
      type: "Call",
      metadata: buildTimelineMetadata({
        action: "proposal_discovery_call_completed",
        source: "proposal",
        recordId: proposalId,
        title: "Live proposal discovery call",
        status: session.status,
        changes: {
          sessionId: session.id,
          proposalId,
          callOutcome: session.callOutcome,
          nextAction: session.nextAction,
          nextActionDueAt: session.nextActionDueAt,
          missingFields: session.missingFields.length,
          conflicts: session.conflicts.length,
        },
      }),
    });
  }

  private sessionSelectSql() {
    return `SELECT pds.id,
                   pds.contact_id as contactId,
                   pds.deal_id as dealId,
                   pds.client_account_profile_id as clientAccountProfileId,
                   pds.proposal_id as proposalId,
                   pds.status,
                   pds.clinic_type as clinicType,
                   pds.recommended_package_id as recommendedPackageId,
                   pds.active_constraint_id as activeConstraintId,
                   pds.selected_media_spend_cents as selectedMediaSpendCents,
                   pds.prefill_snapshot as prefillSnapshot,
                   pds.answers,
                   pds.free_notes as freeNotes,
                   pds.missing_fields as missingFields,
                   pds.conflicts,
                   pds.call_outcome as callOutcome,
                   pds.next_action as nextAction,
                   pds.next_action_owner_id as nextActionOwnerId,
                   pds.next_action_due_at as nextActionDueAt,
                   pds.started_at as startedAt,
                   pds.last_autosaved_at as lastAutosavedAt,
                   pds.completed_at as completedAt,
                   pds.created_by as createdBy,
                   pds.updated_by as updatedBy,
                   pds.created_at as createdAt,
                   pds.updated_at as updatedAt
            FROM proposal_discovery_session pds`;
  }
}

export const proposalDiscoveryService = new ProposalDiscoveryService();
