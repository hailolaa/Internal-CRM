import pool from "../../config/database.js";
import { appointmentSlotBlockingDbStatuses } from "./appointments.constants.js";

export interface AppointmentInsertValues {
  id: string;
  clinicId: string;
  contactId: string;
  clinicianId: string | null;
  dateTime: string;
  status: string;
  treatment: string | null;
  value: number | null;
  durationMinutes: number;
  noShowReason: string | null;
  consultNotes: string | null;
  recurrenceRule: string | null;
  recurrenceSeriesId: string | null;
  recurrencePosition: number | null;
  userId: string;
}

export interface AppointmentUpdateValues {
  contactId?: string | null;
  clinicianId?: string | null;
  dateTime?: string;
  status?: string;
  treatment?: string | null;
  value?: number | null;
  durationMinutes?: number;
  noShowReason?: string | null;
  consultNotes?: string | null;
  recurrenceRule?: string | null;
  recurrenceSeriesId?: string | null;
  recurrencePosition?: number | null;
}

export interface AppointmentConflictQuery {
  clinicId: string;
  clinicianId: string;
  start: string;
  end: string;
  excludedAppointmentId?: string;
}

export interface AppointmentBlockerQuery {
  clinicId: string;
  clinicianId: string;
  start: string;
  end: string;
  excludedAppointmentId?: string;
}

export async function getAppointmentClinicTimezone(clinicId: string) {
  const [rows]: any = await pool.execute(
    "SELECT timezone FROM clinic WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [clinicId],
  );

  return rows[0]?.timezone || "Europe/London";
}

const appointmentSelect = `
  SELECT a.id,
         a.contact_id as contactId,
         c.first_name as contactFirstName,
         c.last_name as contactLastName,
         c.email as contactEmail,
         c.phone as contactPhone,
         a.clinician_id as clinicianId,
         NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') as clinicianName,
         a.date_time as dateTime,
         a.status,
         a.treatment,
         a.value,
         a.duration_minutes as durationMinutes,
         a.no_show_reason as noShowReason,
         a.consult_notes as consultNotes,
         a.recurrence_rule as recurrenceRule,
         a.recurrence_series_id as recurrenceSeriesId,
         a.recurrence_position as recurrencePosition,
         a.created_at as createdAt,
         a.updated_at as updatedAt
  FROM appointment a
  JOIN contact c
    ON c.id = a.contact_id
   AND c.clinic_id = a.clinic_id
   AND c.deleted_at IS NULL
  LEFT JOIN user u
    ON u.id = a.clinician_id
   AND u.clinic_id = a.clinic_id
   AND u.deleted_at IS NULL
`;

export async function listAppointmentRows(
  clinicId: string,
  start: string,
  end: string,
  status?: string,
) {
  const values: any[] = [clinicId, start, end];
  const statusClause = status ? "AND a.status = ?" : "";
  if (status) values.push(status);

  const [rows]: any = await pool.execute(
    `${appointmentSelect}
     WHERE a.clinic_id = ?
       AND a.date_time >= ?
       AND a.date_time < ?
       AND a.deleted_at IS NULL
       ${statusClause}
     ORDER BY a.date_time ASC`,
    values,
  );

  return rows;
}

export async function getAppointmentRow(clinicId: string, appointmentId: string) {
  const [rows]: any = await pool.execute(
    `${appointmentSelect}
     WHERE a.id = ?
       AND a.clinic_id = ?
       AND a.deleted_at IS NULL
     LIMIT 1`,
    [appointmentId, clinicId],
  );

  return rows[0] || null;
}

export async function contactExistsForAppointment(clinicId: string, contactId: string) {
  const [rows]: any = await pool.execute(
    `SELECT id
     FROM contact
     WHERE id = ?
       AND clinic_id = ?
       AND deleted_at IS NULL
     LIMIT 1`,
    [contactId, clinicId],
  );

  return rows.length > 0;
}

export async function listAppointmentClinicianRows(clinicId: string) {
  const [rows]: any = await pool.execute(
    `SELECT id, first_name as firstName, last_name as lastName, email, role
     FROM user
     WHERE clinic_id = ?
       AND deleted_at IS NULL
       AND status = 'active'
       AND is_active = 1
       AND role IN ('SUPER_ADMIN', 'CLINIC_ADMIN', 'ADMIN', 'CLINICIAN', 'MANAGER')
     ORDER BY FIELD(role, 'CLINICIAN', 'MANAGER', 'CLINIC_ADMIN', 'ADMIN', 'SUPER_ADMIN'),
              first_name ASC,
              last_name ASC,
              email ASC`,
    [clinicId],
  );

  return rows;
}

export async function clinicianExistsForAppointment(clinicId: string, clinicianId: string) {
  const [rows]: any = await pool.execute(
    `SELECT id
     FROM user
     WHERE id = ?
       AND clinic_id = ?
       AND deleted_at IS NULL
       AND status = 'active'
       AND is_active = 1
     LIMIT 1`,
    [clinicianId, clinicId],
  );

  return rows.length > 0;
}

export async function listClinicianAvailabilityRows(
  clinicId: string,
  clinicianId: string,
  dayOfWeek: number,
) {
  const [rows]: any = await pool.execute(
    `SELECT day_of_week as dayOfWeek,
            TIME_FORMAT(start_time, '%H:%i') as startTime,
            TIME_FORMAT(end_time, '%H:%i') as endTime,
            slot_interval_minutes as slotIntervalMinutes
     FROM clinician_availability
     WHERE clinic_id = ?
       AND clinician_id = ?
       AND day_of_week = ?
       AND is_active = 1
       AND deleted_at IS NULL
     ORDER BY start_time ASC`,
    [clinicId, clinicianId, dayOfWeek],
  );

  return rows;
}

export interface ClinicianAvailabilityInsertValues {
  id: string;
  clinicId: string;
  clinicianId: string;
  dayOfWeek: number;
  startTime: string; // 'HH:MM'
  endTime: string; // 'HH:MM'
  slotIntervalMinutes?: number | null;
  isActive?: boolean;
  createdBy?: string | null;
}

export async function insertClinicianAvailability(values: ClinicianAvailabilityInsertValues) {
  await pool.execute(
    `INSERT INTO clinician_availability
      (id, clinic_id, clinician_id, day_of_week, start_time, end_time, slot_interval_minutes, is_active, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      values.id,
      values.clinicId,
      values.clinicianId,
      values.dayOfWeek,
      values.startTime,
      values.endTime,
      values.slotIntervalMinutes || 30,
      values.isActive ? 1 : 0,
      values.createdBy || null,
    ],
  );
}

export async function deleteClinicianAvailability(id: string, clinicId: string) {
  await pool.execute(
    `UPDATE clinician_availability SET deleted_at = CURRENT_TIMESTAMP, is_active = 0 WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
    [id, clinicId],
  );
}

export async function listAppointmentBlockerRows(query: AppointmentBlockerQuery) {
  const excludeClause = query.excludedAppointmentId ? "AND a.id <> ?" : "";
  const values: any[] = [
    query.clinicId,
    query.clinicianId,
    ...appointmentSlotBlockingDbStatuses,
    query.end,
    query.start,
  ];

  if (query.excludedAppointmentId) values.push(query.excludedAppointmentId);

  const [rows]: any = await pool.execute(
    `SELECT a.id,
            DATE_FORMAT(a.date_time, '%Y-%m-%d %H:%i:%s') as start,
            DATE_FORMAT(
              DATE_ADD(a.date_time, INTERVAL COALESCE(a.duration_minutes, 30) MINUTE),
              '%Y-%m-%d %H:%i:%s'
            ) as end
     FROM appointment a
     WHERE a.clinic_id = ?
       AND a.clinician_id = ?
       AND a.deleted_at IS NULL
       AND a.status IN (?, ?, ?)
       AND a.date_time < ?
       AND DATE_ADD(a.date_time, INTERVAL COALESCE(a.duration_minutes, 30) MINUTE) > ?
       ${excludeClause}
     ORDER BY a.date_time ASC`,
    values,
  );

  return rows;
}

export async function getAppointmentConflictRow(query: AppointmentConflictQuery) {
  const excludeClause = query.excludedAppointmentId ? "AND a.id <> ?" : "";
  const values: any[] = [
    query.clinicId,
    query.clinicianId,
    ...appointmentSlotBlockingDbStatuses,
    query.end,
    query.start,
  ];

  if (query.excludedAppointmentId) values.push(query.excludedAppointmentId);

  const [rows]: any = await pool.execute(
    // Slots overlap when each appointment starts before the other one ends.
    `${appointmentSelect}
     WHERE a.clinic_id = ?
       AND a.clinician_id = ?
       AND a.deleted_at IS NULL
       AND a.status IN (?, ?, ?)
       AND a.date_time < ?
       AND DATE_ADD(a.date_time, INTERVAL COALESCE(a.duration_minutes, 30) MINUTE) > ?
       ${excludeClause}
     ORDER BY a.date_time ASC
     LIMIT 1`,
    values,
  );

  return rows[0] || null;
}

export async function insertAppointment(values: AppointmentInsertValues) {
  await pool.execute(
    `INSERT INTO appointment
      (id, clinic_id, contact_id, clinician_id, date_time, status, treatment,
       value, duration_minutes, no_show_reason, consult_notes, recurrence_rule,
       recurrence_series_id, recurrence_position, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      values.id,
      values.clinicId,
      values.contactId,
      values.clinicianId,
      values.dateTime,
      values.status,
      values.treatment,
      values.value,
      values.durationMinutes,
      values.noShowReason,
      values.consultNotes,
      values.recurrenceRule,
      values.recurrenceSeriesId,
      values.recurrencePosition,
      values.userId,
    ],
  );
}

export async function updateAppointmentFields(
  clinicId: string,
  appointmentId: string,
  values: AppointmentUpdateValues,
) {
  const fields: string[] = [];
  const params: any[] = [];
  const mapping: Record<keyof AppointmentUpdateValues, string> = {
    clinicianId: "clinician_id",
    consultNotes: "consult_notes",
    contactId: "contact_id",
    dateTime: "date_time",
    durationMinutes: "duration_minutes",
    noShowReason: "no_show_reason",
    recurrencePosition: "recurrence_position",
    recurrenceRule: "recurrence_rule",
    recurrenceSeriesId: "recurrence_series_id",
    status: "status",
    treatment: "treatment",
    value: "value",
  };

  Object.entries(values).forEach(([key, value]) => {
    const column = mapping[key as keyof AppointmentUpdateValues];
    if (!column) return;

    fields.push(`${column} = ?`);
    params.push(value);
  });

  if (fields.length === 0) return;

  await pool.execute(
    `UPDATE appointment
     SET ${fields.join(", ")},
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND clinic_id = ?
       AND deleted_at IS NULL`,
    [...params, appointmentId, clinicId],
  );
}
