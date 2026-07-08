import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import type {
  AttributionChainResponse,
  PerformanceAlertResponse,
  PerformanceOsListQuery,
} from "./performance-os.types.js";

const CALL_TABLE = "`\u00A0call\u00A0`";

function parseJson(value: unknown, fallback: any = null) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function toIso(value: unknown) {
  return value ? new Date(value as string | number | Date).toISOString() : null;
}

function toDate(value: unknown) {
  return value ? String(value).slice(0, 10) : null;
}

function label(value: unknown, fallback: string) {
  return value === null || value === undefined || String(value).trim() === "" ? fallback : String(value);
}

function mapAlert(row: any): PerformanceAlertResponse {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    summary: row.summary || null,
    sourceType: row.sourceType || "unknown",
    sourceId: row.sourceId || null,
    sourceContactId: row.sourceContactId || null,
    insightId: row.insightId || null,
    status: row.status,
    metadata: parseJson(row.metadata, null),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export class PerformanceOsService {
  async getAttributionChain(clinicId: string, contactId: string): Promise<AttributionChainResponse> {
    const [contactRows]: any = await pool.execute(
      `SELECT id, external_id as externalId, first_name as firstName, last_name as lastName,
              email, phone, status, source, value, treatment_interests as treatmentInterests,
              created_at as createdAt, updated_at as updatedAt
       FROM contact
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [contactId, clinicId],
    );

    const contact = contactRows[0];
    if (!contact) throw ApiError.notFound("Contact not found");

    const [campaignRows]: any = await pool.execute(
      `SELECT a.id as attributionId, a.campaign_id as campaignId, a.channel,
              a.touchpoint_date as touchpointDate, a.conversion_date as conversionDate,
              a.value, c.name as campaignName, c.type as campaignType, c.status as campaignStatus,
              c.channel as campaignChannel
       FROM attribution a
       LEFT JOIN campaign c
         ON c.id = a.campaign_id
        AND c.clinic_id = a.clinic_id
        AND c.deleted_at IS NULL
       WHERE a.clinic_id = ?
         AND a.contact_id = ?
         AND a.deleted_at IS NULL
       ORDER BY COALESCE(a.touchpoint_date, a.created_at) ASC`,
      [clinicId, contactId],
    );

    const [callRows]: any = await pool.execute(
      `SELECT id, direction, duration, call_status as callStatus, outcome,
              disposition, source, missed_call as missedCall, tracking_number as trackingNumber,
              created_at as createdAt
       FROM ${CALL_TABLE}
       WHERE clinic_id = ?
         AND contact_id = ?
         AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [clinicId, contactId],
    );

    const [messageRows]: any = await pool.execute(
      `SELECT *
       FROM (
         SELECT id, 'email' as channel, direction, status, subject, body, created_at as createdAt
         FROM email
         WHERE clinic_id = ? AND contact_id = ? AND deleted_at IS NULL
         UNION ALL
         SELECT id, 'sms' as channel, direction, status, NULL as subject, message as body, created_at as createdAt
         FROM sms
         WHERE clinic_id = ? AND contact_id = ? AND deleted_at IS NULL
       ) messages
       ORDER BY createdAt ASC`,
      [clinicId, contactId, clinicId, contactId],
    );

    const [formRows]: any = await pool.execute(
      `SELECT fs.id, fs.form_id as formId, fd.name as formName, fd.type as formType,
              fs.submitted_data as submittedData, fs.submitted_at as submittedAt
       FROM form_submission fs
       JOIN form_definition fd
         ON fd.id = fs.form_id
        AND fd.clinic_id = fs.clinic_id
        AND fd.deleted_at IS NULL
       WHERE fs.clinic_id = ?
         AND fs.deleted_at IS NULL
         AND (
           fs.id = ?
           OR JSON_UNQUOTE(JSON_EXTRACT(fs.submitted_data, '$.email')) = ?
           OR JSON_UNQUOTE(JSON_EXTRACT(fs.submitted_data, '$.phone')) = ?
         )
       ORDER BY fs.submitted_at ASC`,
      [clinicId, contact.externalId || "", contact.email || "", contact.phone || ""],
    );

    const [bookingRows]: any = await pool.execute(
      `SELECT id, clinician_id as clinicianId, date_time as dateTime, status,
              treatment, value, duration_minutes as durationMinutes,
              no_show_reason as noShowReason, consult_notes as consultNotes,
              created_at as createdAt
       FROM appointment
       WHERE clinic_id = ?
         AND contact_id = ?
         AND deleted_at IS NULL
       ORDER BY date_time ASC`,
      [clinicId, contactId],
    );

    const appointmentIds = bookingRows.map((row: any) => row.id);
    const consultParams = [clinicId, contactId, ...appointmentIds];
    const appointmentClause = appointmentIds.length > 0
      ? ` OR appointment_id IN (${appointmentIds.map(() => "?").join(", ")})`
      : "";
    const [consultRows]: any = await pool.execute(
      `SELECT id, contact_id as contactId, appointment_id as appointmentId, patient_name as patientName,
              treatment, practitioner, practitioner_id as practitionerId, outcome,
              revenue, consult_date as consultDate, deposit_status as depositStatus,
              lost_reason as lostReason, created_at as createdAt
       FROM manual_consult_entry
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         AND (contact_id = ?${appointmentClause})
       ORDER BY consult_date ASC, created_at ASC`,
      consultParams,
    );

    const sourceRefs = [
      { type: "contact", id: contactId },
      ...callRows.map((row: any) => ({ type: "call", id: row.id })),
      ...bookingRows.map((row: any) => ({ type: "appointment", id: row.id })),
      ...consultRows.map((row: any) => ({ type: "consult", id: row.id })),
    ];

    const sourceRefClause = sourceRefs.map(() => "(source_type = ? AND source_id = ?)").join(" OR ");
    const insightValues = [clinicId, contactId, ...sourceRefs.flatMap((ref) => [ref.type, ref.id])];
    const [insightRows]: any = await pool.execute(
      `SELECT id, type, severity, title, summary, recommended_action as recommendedAction,
              source_type as sourceType, source_id as sourceId, source_contact_id as sourceContactId,
              action_task_id as actionTaskId, status, generated_from as generatedFrom,
              created_at as createdAt
       FROM insight
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         AND (source_contact_id = ?${sourceRefClause ? ` OR ${sourceRefClause}` : ""})
       ORDER BY created_at DESC`,
      insightValues,
    );

    const alerts = await this.listAlertsForChain(clinicId, contactId, sourceRefs);
    const revenueRecords = consultRows
      .filter((row: any) => Number(row.revenue || 0) > 0)
      .map((row: any) => ({
        id: row.id,
        sourceType: "consultation",
        sourceId: row.id,
        treatment: label(row.treatment, "Unknown treatment"),
        outcome: label(row.outcome, "Unknown outcome"),
        amount: Number(row.revenue || 0),
        occurredAt: toDate(row.consultDate) || toIso(row.createdAt),
      }));

    const unknowns: string[] = [];
    if (!contact.source) unknowns.push("source");
    if (campaignRows.length === 0) unknowns.push("campaign");
    if (formRows.length === 0 && callRows.length === 0 && messageRows.length === 0) unknowns.push("lead_touchpoint");
    if (bookingRows.length === 0) unknowns.push("booking");
    if (consultRows.length === 0) unknowns.push("consultation");
    if (revenueRecords.length === 0) unknowns.push("revenue");

    return {
      contact: {
        id: contact.id,
        name: label([contact.firstName, contact.lastName].filter(Boolean).join(" "), "Unknown lead"),
        email: contact.email || null,
        phone: contact.phone || null,
        status: label(contact.status, "Unknown status"),
        value: Number(contact.value || 0),
        treatmentInterests: parseJson(contact.treatmentInterests, []),
        createdAt: toIso(contact.createdAt),
        updatedAt: toIso(contact.updatedAt),
      },
      source: {
        label: label(contact.source, "Unknown source"),
        raw: contact.source || null,
        primaryCampaign: campaignRows[0]?.campaignName || "Unknown campaign",
      },
      campaigns: campaignRows.map((row: any) => ({
        attributionId: row.attributionId,
        id: row.campaignId || null,
        name: row.campaignName || "Unknown campaign",
        channel: row.campaignChannel || row.channel || "Unknown channel",
        type: row.campaignType || null,
        status: row.campaignStatus || null,
        touchpointDate: toIso(row.touchpointDate),
        conversionDate: toIso(row.conversionDate),
        value: Number(row.value || 0),
      })),
      touchpoints: {
        calls: callRows.map((row: any) => ({
          id: row.id,
          direction: label(row.direction, "unknown"),
          status: label(row.callStatus, "Unknown call status"),
          outcome: label(row.outcome, "Unknown outcome"),
          disposition: label(row.disposition, "Unknown disposition"),
          source: label(row.source, "Unknown call source"),
          missedCall: Boolean(row.missedCall),
          trackingNumber: row.trackingNumber || null,
          durationSeconds: Number(row.duration || 0),
          occurredAt: toIso(row.createdAt),
        })),
        messages: messageRows.map((row: any) => ({
          id: row.id,
          channel: label(row.channel, "unknown"),
          direction: label(row.direction, "unknown"),
          status: label(row.status, "Unknown message status"),
          subject: row.subject || null,
          preview: String(row.body || "").slice(0, 160),
          occurredAt: toIso(row.createdAt),
        })),
        forms: formRows.map((row: any) => ({
          id: row.id,
          formId: row.formId,
          formName: row.formName || "Unknown form",
          formType: row.formType || "Unknown form type",
          submittedData: parseJson(row.submittedData, {}),
          submittedAt: toIso(row.submittedAt),
        })),
      },
      bookings: bookingRows.map((row: any) => ({
        id: row.id,
        status: label(row.status, "Unknown booking status"),
        treatment: label(row.treatment, "Unknown treatment"),
        value: Number(row.value || 0),
        clinicianId: row.clinicianId || null,
        dateTime: toIso(row.dateTime),
        durationMinutes: Number(row.durationMinutes || 0),
        noShowReason: row.noShowReason || null,
        consultNotes: row.consultNotes || null,
      })),
      consultations: consultRows.map((row: any) => ({
        id: row.id,
        appointmentId: row.appointmentId || null,
        patientName: label(row.patientName, "Unknown patient"),
        treatment: label(row.treatment, "Unknown treatment"),
        practitioner: label(row.practitioner, "Unknown practitioner"),
        outcome: label(row.outcome, "Unknown outcome"),
        revenue: Number(row.revenue || 0),
        consultDate: toDate(row.consultDate),
        depositStatus: label(row.depositStatus, "Unknown deposit status"),
        lostReason: row.lostReason || null,
      })),
      treatments: consultRows.map((row: any) => ({
        sourceType: "consultation",
        sourceId: row.id,
        name: label(row.treatment, "Unknown treatment"),
        outcome: label(row.outcome, "Unknown outcome"),
        sold: row.outcome === "Treatment Booked",
        revenue: Number(row.revenue || 0),
      })),
      revenue: {
        total: revenueRecords.reduce((sum: number, row: any) => sum + row.amount, 0),
        currency: "USD",
        records: revenueRecords,
      },
      insights: insightRows.map((row: any) => ({
        id: row.id,
        type: row.type,
        severity: row.severity,
        title: row.title,
        summary: row.summary || null,
        recommendedAction: row.recommendedAction || null,
        sourceType: row.sourceType || "unknown",
        sourceId: row.sourceId || null,
        sourceContactId: row.sourceContactId || null,
        actionTaskId: row.actionTaskId || null,
        status: row.status,
        generatedFrom: row.generatedFrom || null,
        createdAt: toIso(row.createdAt),
      })),
      alerts,
      unknowns,
    };
  }

  async listAlerts(clinicId: string, query: PerformanceOsListQuery = {}): Promise<PerformanceAlertResponse[]> {
    const conditions = ["clinic_id = ?", "deleted_at IS NULL"];
    const values: any[] = [clinicId];

    if (query.contactId) {
      conditions.push("source_contact_id = ?");
      values.push(query.contactId);
    }
    if (query.status && query.status !== "all") {
      conditions.push("status = ?");
      values.push(query.status);
    } else if (!query.status) {
      conditions.push("status IN ('open', 'acknowledged')");
    }
    if (query.severity && query.severity !== "all") {
      conditions.push("severity = ?");
      values.push(query.severity);
    }
    if (query.type) {
      conditions.push("type = ?");
      values.push(query.type);
    }

    const [rows]: any = await pool.execute(
      `SELECT id, type, severity, title, summary, source_type as sourceType,
              source_id as sourceId, source_contact_id as sourceContactId,
              insight_id as insightId, status, metadata,
              created_at as createdAt, updated_at as updatedAt
       FROM performance_alert
       WHERE ${conditions.join(" AND ")}
       ORDER BY FIELD(severity, 'critical', 'high', 'medium', 'low'), created_at DESC
       LIMIT 100`,
      values,
    );

    return rows.map(mapAlert);
  }

  private async listAlertsForChain(clinicId: string, contactId: string, sourceRefs: Array<{ type: string; id: string }>) {
    const sourceRefClause = sourceRefs.map(() => "(source_type = ? AND source_id = ?)").join(" OR ");
    const values = [clinicId, contactId, ...sourceRefs.flatMap((ref) => [ref.type, ref.id])];
    const [rows]: any = await pool.execute(
      `SELECT id, type, severity, title, summary, source_type as sourceType,
              source_id as sourceId, source_contact_id as sourceContactId,
              insight_id as insightId, status, metadata,
              created_at as createdAt, updated_at as updatedAt
       FROM performance_alert
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         AND (source_contact_id = ?${sourceRefClause ? ` OR ${sourceRefClause}` : ""})
       ORDER BY FIELD(severity, 'critical', 'high', 'medium', 'low'), created_at DESC`,
      values,
    );

    return rows.map(mapAlert);
  }
}

export const performanceOsService = new PerformanceOsService();
