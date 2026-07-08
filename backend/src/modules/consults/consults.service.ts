import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import { buildTimelineMetadata, logTimelineActivity } from "../../utils/activity.js";
import { logAuditEvent } from "../../utils/audit.js";
import {
  mapConsult,
  mapConsultSummary,
  mapPractitionerConversion,
} from "./consults.mappers.js";
import { defaultConsultOutcomeOptions, normalizeConsultOutcome } from "./consults.constants.js";
import type {
  ConsultDTO,
  ConsultResponse,
  ConsultSummaryResponse,
  PractitionerConversionResponse,
} from "./consults.types.js";

const consultSelect = `
  SELECT mce.id,
         mce.contact_id as contactId,
         mce.appointment_id as appointmentId,
         mce.patient_name as patientName,
         c.first_name as contactFirstName,
         c.last_name as contactLastName,
         mce.treatment,
         mce.practitioner,
         mce.practitioner_id as practitionerId,
         u.first_name as practitionerFirstName,
         u.last_name as practitionerLastName,
         mce.outcome,
         mce.revenue,
         mce.consult_date as date,
         mce.notes,
         mce.deposit_status as depositStatus,
         mce.lost_reason as lostReason,
         CONCAT(COALESCE(created.first_name, ''), ' ', COALESCE(created.last_name, '')) as enteredBy,
         mce.clinic_id as clinicId
  FROM manual_consult_entry mce
  LEFT JOIN contact c
    ON c.id = mce.contact_id
   AND c.clinic_id = mce.clinic_id
   AND c.deleted_at IS NULL
  LEFT JOIN user u
    ON u.id = mce.practitioner_id
   AND u.clinic_id = mce.clinic_id
   AND u.deleted_at IS NULL
  LEFT JOIN user created
    ON created.id = mce.created_by
   AND created.clinic_id = mce.clinic_id
   AND created.deleted_at IS NULL
`;

function dateKey(value?: string | null) {
  return value ? value.slice(0, 10) : null;
}

function shouldLogContactActivity(contactId?: string | null) {
  return Boolean(contactId);
}

export class ConsultsService {
  getOutcomeOptions() {
    return defaultConsultOutcomeOptions;
  }

  async listConsults(clinicId: string): Promise<ConsultResponse[]> {
    const [rows]: any = await pool.execute(
      `${consultSelect}
       WHERE mce.clinic_id = ?
         AND mce.deleted_at IS NULL
       ORDER BY mce.consult_date DESC, mce.created_at DESC`,
      [clinicId],
    );

    return rows.map(mapConsult);
  }

  async createConsult(clinicId: string, userId: string, data: ConsultDTO) {
    if (!data.patientName && !data.contactId) {
      throw ApiError.badRequest("Consult requires a patient name or contact");
    }
    const normalizedData = this.validateCommercialOutcome(data);

    const id = uuidv4();
    const patientName = normalizedData.patientName || await this.getContactName(clinicId, normalizedData.contactId as string);
    await pool.execute(
      `INSERT INTO manual_consult_entry
        (id, clinic_id, contact_id, appointment_id, patient_name, treatment,
         practitioner, practitioner_id, outcome, revenue, consult_date, notes,
         deposit_status, lost_reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        normalizedData.contactId || null,
        normalizedData.appointmentId || null,
        patientName,
        normalizedData.treatment,
        normalizedData.practitioner || "Unassigned",
        normalizedData.practitionerId || null,
        normalizedData.outcome,
        normalizedData.revenue || 0,
        dateKey(normalizedData.date),
        normalizedData.notes || null,
        normalizedData.depositStatus || "not_required",
        normalizedData.lostReason || null,
        userId,
      ],
    );

    await this.logCommercialOutcome(clinicId, userId, id, normalizedData);
    return { id };
  }

  async updateConsult(clinicId: string, userId: string, id: string, data: Partial<ConsultDTO>) {
    const existing = await this.getConsult(clinicId, id);
    const normalizedMerged = this.validateCommercialOutcome({ ...existing, ...data } as ConsultDTO);
    const updateData: Partial<ConsultDTO> = { ...data };
    if (data.outcome !== undefined) updateData.outcome = normalizedMerged.outcome;
    if (data.lostReason === undefined && normalizedMerged.lostReason !== undefined && normalizedMerged.lostReason !== existing.lostReason) {
      updateData.lostReason = normalizedMerged.lostReason;
    }
    const fields: string[] = [];
    const values: any[] = [];
    const mapping: Record<string, string> = {
      appointmentId: "appointment_id",
      contactId: "contact_id",
      date: "consult_date",
      depositStatus: "deposit_status",
      lostReason: "lost_reason",
      notes: "notes",
      outcome: "outcome",
      patientName: "patient_name",
      practitioner: "practitioner",
      practitionerId: "practitioner_id",
      revenue: "revenue",
      treatment: "treatment",
    };

    Object.entries(updateData).forEach(([key, value]) => {
      const column = mapping[key];
      if (!column) return;
      fields.push(`${column} = ?`);
      values.push(key === "date" ? dateKey(value as string | null) : value);
    });

    if (fields.length > 0) {
      await pool.execute(
        `UPDATE manual_consult_entry
         SET ${fields.join(", ")},
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND clinic_id = ?
           AND deleted_at IS NULL`,
        [...values, id, clinicId],
      );
    }

    await this.logCommercialOutcome(clinicId, userId, id, updateData);
    return this.getConsult(clinicId, id);
  }

  async updateOutcome(clinicId: string, userId: string, id: string, data: Partial<ConsultDTO>) {
    return this.updateConsult(clinicId, userId, id, data);
  }

  async getSummary(clinicId: string): Promise<ConsultSummaryResponse> {
    const [rows]: any = await pool.execute(
      `SELECT COUNT(*) as totalConsults,
              SUM(CASE WHEN outcome IN ('Sold', 'Treatment Booked') THEN 1 ELSE 0 END) as bookedCount,
              SUM(CASE WHEN outcome IN ('No-show', 'No Show') THEN 1 ELSE 0 END) as noShowCount,
              SUM(CASE WHEN outcome IN ('Sold', 'Treatment Booked') THEN revenue ELSE 0 END) as totalRevenue
       FROM manual_consult_entry
       WHERE clinic_id = ?
         AND deleted_at IS NULL`,
      [clinicId],
    );

    return mapConsultSummary(rows[0] || {});
  }

  async getPractitionerConversion(clinicId: string): Promise<PractitionerConversionResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT practitioner,
              COUNT(*) as totalConsults,
              SUM(CASE WHEN outcome IN ('Sold', 'Treatment Booked') THEN 1 ELSE 0 END) as bookedCount,
              SUM(CASE WHEN outcome IN ('Sold', 'Treatment Booked') THEN revenue ELSE 0 END) as revenue
       FROM manual_consult_entry
       WHERE clinic_id = ?
         AND deleted_at IS NULL
       GROUP BY practitioner
       ORDER BY revenue DESC, bookedCount DESC`,
      [clinicId],
    );

    return rows.map(mapPractitionerConversion);
  }

  private async getConsult(clinicId: string, id: string) {
    const [rows]: any = await pool.execute(
      `${consultSelect}
       WHERE mce.id = ?
         AND mce.clinic_id = ?
         AND mce.deleted_at IS NULL
       LIMIT 1`,
      [id, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Consult not found");
    return mapConsult(rows[0]);
  }

  private async ensureConsult(clinicId: string, id: string) {
    await this.getConsult(clinicId, id);
  }

  private validateCommercialOutcome<T extends Partial<ConsultDTO>>(data: T): T {
    const outcome = normalizeConsultOutcome(data.outcome) as T["outcome"];
    const next = { ...data, outcome };

    if (outcome === "Sold") {
      if (!Number(next.revenue || 0)) {
        throw ApiError.badRequest("Sold consult requires a revenue value");
      }
      if (!String(next.treatment || "").trim()) {
        throw ApiError.badRequest("Sold consult requires a treatment");
      }
      if (!String(next.practitioner || next.practitionerId || "").trim()) {
        throw ApiError.badRequest("Sold consult requires a practitioner");
      }
    }

    if (["Not Sold", "Not Suitable"].includes(String(outcome)) && !String(next.lostReason || "").trim()) {
      next.lostReason = "Not provided";
    }

    return next;
  }

  async exportConsultsCsv(clinicId: string) {
    const consults = await this.listConsults(clinicId);
    const headers = ["id", "patientName", "treatment", "practitioner", "outcome", "revenue", "depositStatus", "lostReason", "date"];
    const rows = consults.map((consult) => [
      consult.id,
      consult.patientName,
      consult.treatment,
      consult.practitioner,
      consult.outcome,
      consult.revenue,
      consult.depositStatus,
      consult.lostReason,
      consult.date,
    ]);
    return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
  }

  private async getContactName(clinicId: string, contactId: string) {
    const [rows]: any = await pool.execute(
      `SELECT first_name as firstName, last_name as lastName, email
       FROM contact
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [contactId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Contact not found");
    return [rows[0].firstName, rows[0].lastName].filter(Boolean).join(" ").trim() || rows[0].email;
  }

  private async logCommercialOutcome(
    clinicId: string,
    userId: string,
    id: string,
    data: Partial<ConsultDTO>,
  ) {
    if (shouldLogContactActivity(data.contactId)) {
      await logTimelineActivity({
        clinicId,
        contactId: data.contactId as string,
        type: "StatusChange",
        userId,
        metadata: buildTimelineMetadata({
          action: "consult_outcome_logged",
          source: "consult",
          recordId: id,
          changes: {
            outcome: data.outcome,
            revenue: data.revenue || 0,
          },
        }),
      });
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "CONSULT_OUTCOME_UPDATED",
      entityType: "manual_consult_entry",
      entityId: id,
      changes: { ...data },
    });
  }
}

export const consultsService = new ConsultsService();

function csvCell(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
