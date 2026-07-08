import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { buildTimelineMetadata, logTimelineActivity } from "../../utils/activity.js";
import { logAuditEvent } from "../../utils/audit.js";
import {
  mapAppointment,
  mapAppointmentClinician,
  toDbAppointmentStatus,
} from "./appointments.mappers.js";
import {
  assertAppointmentSlotAvailable,
  getAppointmentAvailability,
} from "./appointments.scheduling.js";
import {
  centsToValue,
  getActivityAction,
  getDefaultRange,
  toMysqlDateTime,
} from "./appointments.utils.js";
import {
  contactExistsForAppointment,
  clinicianExistsForAppointment,
  getAppointmentClinicTimezone,
  getAppointmentRow,
  insertAppointment,
  listAppointmentClinicianRows,
  listAppointmentRows,
  updateAppointmentFields,
  type AppointmentUpdateValues,
} from "./appointments.persistence.js";
import type {
  AppointmentAvailabilityQuery,
  AppointmentAvailabilityResponse,
  AppointmentResponse,
  AppointmentClinicianResponse,
  AppointmentRecurrenceRule,
  CreateAppointmentDTO,
  ListAppointmentsQuery,
  UpdateAppointmentDTO,
} from "./appointments.types.js";
import { insertClinicianAvailability, deleteClinicianAvailability } from "./appointments.persistence.js";

export class AppointmentsService {
  async listAppointments(
    clinicId: string,
    query: ListAppointmentsQuery,
  ): Promise<AppointmentResponse[]> {
    const range = getDefaultRange(query);
    const status = query.status ? toDbAppointmentStatus(query.status) : undefined;
    const rows = await listAppointmentRows(clinicId, range.start, range.end, status);
    return rows.map(mapAppointment);
  }

  async listClinicians(clinicId: string): Promise<AppointmentClinicianResponse[]> {
    const rows = await listAppointmentClinicianRows(clinicId);
    return rows.map(mapAppointmentClinician);
  }

  async getAvailability(
    clinicId: string,
    query: AppointmentAvailabilityQuery,
  ): Promise<AppointmentAvailabilityResponse> {
    await this.ensureClinician(clinicId, query.clinicianId);
    const timezone = await getAppointmentClinicTimezone(clinicId);

    return getAppointmentAvailability({
      clinicId,
      clinicianId: query.clinicianId,
      date: query.date,
      durationMinutes: query.durationMinutes,
      intervalMinutes: query.intervalMinutes,
      timezone,
    });
  }

  async createAppointment(
    clinicId: string,
    userId: string,
    data: CreateAppointmentDTO,
  ): Promise<AppointmentResponse> {
    await this.ensureContact(clinicId, data.contactId);

    const appointmentId = uuidv4();
    const recurrenceRule = normalizeRecurrenceRule(data.recurrenceRule);
    const recurrenceSeriesId = recurrenceRule ? uuidv4() : null;
    const status = toDbAppointmentStatus(data.status);
    const clinicianId = data.clinicianId || userId;
    const dateTime = toMysqlDateTime(data.dateTime);
    const durationMinutes = data.durationMinutes || 30;
    const occurrences = buildRecurrenceOccurrences(data.dateTime, recurrenceRule);
    const timezone = await getAppointmentClinicTimezone(clinicId);

    await this.ensureClinician(clinicId, clinicianId);
    for (const occurrence of occurrences) {
      await assertAppointmentSlotAvailable({
        clinicId,
        clinicianId,
        dateTime: occurrence.dateTime,
        durationMinutes,
        status,
        timezone,
      });
    }

    await insertAppointment({
      id: appointmentId,
      clinicId,
      contactId: data.contactId,
      clinicianId,
      dateTime,
      status,
      treatment: data.treatment || null,
      value: centsToValue(data.valueCents),
      durationMinutes,
      noShowReason: data.noShowReason || null,
      consultNotes: data.consultNotes || null,
      recurrenceRule: recurrenceRule ? JSON.stringify(recurrenceRule) : null,
      recurrenceSeriesId,
      recurrencePosition: recurrenceRule ? 1 : null,
      userId,
    });

    for (const occurrence of occurrences.slice(1)) {
      await insertAppointment({
        id: uuidv4(),
        clinicId,
        contactId: data.contactId,
        clinicianId,
        dateTime: toMysqlDateTime(occurrence.dateTime),
        status,
        treatment: data.treatment || null,
        value: centsToValue(data.valueCents),
        durationMinutes,
        noShowReason: data.noShowReason || null,
        consultNotes: data.consultNotes || null,
        recurrenceRule: recurrenceRule ? JSON.stringify(recurrenceRule) : null,
        recurrenceSeriesId,
        recurrencePosition: occurrence.position,
        userId,
      });
    }

    await this.logAppointmentActivity({
      clinicId,
      contactId: data.contactId,
      userId,
      appointmentId,
      action: getActivityAction(status),
      changes: { dateTime: data.dateTime, treatment: data.treatment || null, recurrenceRule },
    });
    await logAuditEvent({
      clinicId,
      userId,
      action: "APPOINTMENT_CREATED",
      entityType: "appointment",
      entityId: appointmentId,
      changes: { contactId: data.contactId, status, dateTime: data.dateTime, recurrenceRule },
    });

    return this.getAppointment(clinicId, appointmentId);
  }

  async updateAppointment(
    clinicId: string,
    userId: string,
    appointmentId: string,
    data: UpdateAppointmentDTO,
  ): Promise<AppointmentResponse> {
    const existing = await this.getAppointment(clinicId, appointmentId);
    if (data.contactId) await this.ensureContact(clinicId, data.contactId);

    const values: AppointmentUpdateValues = {};
    if (data.contactId !== undefined) values.contactId = data.contactId || existing.contactId;
    if (data.clinicianId !== undefined) values.clinicianId = data.clinicianId || null;
    if (data.dateTime !== undefined) values.dateTime = toMysqlDateTime(data.dateTime);
    if (data.status !== undefined) values.status = toDbAppointmentStatus(data.status);
    if (data.treatment !== undefined) values.treatment = data.treatment || null;
    if (data.valueCents !== undefined) values.value = centsToValue(data.valueCents);
    if (data.durationMinutes !== undefined && data.durationMinutes !== null) values.durationMinutes = data.durationMinutes;
    if (data.noShowReason !== undefined) values.noShowReason = data.noShowReason || null;
    if (data.consultNotes !== undefined) values.consultNotes = data.consultNotes || null;
    if (data.recurrenceRule !== undefined) {
      const recurrenceRule = normalizeRecurrenceRule(data.recurrenceRule);
      values.recurrenceRule = recurrenceRule ? JSON.stringify(recurrenceRule) : null;
      values.recurrenceSeriesId = recurrenceRule ? existing.recurrenceSeriesId || uuidv4() : null;
      values.recurrencePosition = recurrenceRule ? existing.recurrencePosition || 1 : null;
    }

    const clinicianId = values.clinicianId !== undefined ? values.clinicianId : existing.clinicianId;
    if (clinicianId) await this.ensureClinician(clinicId, clinicianId);
    const timezone = await getAppointmentClinicTimezone(clinicId);

    await assertAppointmentSlotAvailable({
      appointmentId,
      clinicId,
      clinicianId,
      dateTime: data.dateTime || existing.dateTime,
      durationMinutes: values.durationMinutes !== undefined ? values.durationMinutes : existing.durationMinutes,
      status: values.status || toDbAppointmentStatus(existing.status),
      timezone,
    });

    await updateAppointmentFields(clinicId, appointmentId, values);
    const updated = await this.getAppointment(clinicId, appointmentId);

    await this.logAppointmentActivity({
      clinicId,
      contactId: updated.contactId,
      userId,
      appointmentId,
      action: data.dateTime && data.dateTime !== existing.dateTime
        ? "rescheduled"
        : getActivityAction(toDbAppointmentStatus(updated.status)),
      changes: { ...data },
    });
    await logAuditEvent({
      clinicId,
      userId,
      action: "APPOINTMENT_UPDATED",
      entityType: "appointment",
      entityId: appointmentId,
      changes: { ...data },
    });

    return updated;
  }

  private async getAppointment(clinicId: string, appointmentId: string) {
    const row = await getAppointmentRow(clinicId, appointmentId);
    if (!row) throw ApiError.notFound("Appointment not found");
    return mapAppointment(row);
  }

  private async ensureContact(clinicId: string, contactId: string) {
    const exists = await contactExistsForAppointment(clinicId, contactId);
    if (!exists) throw ApiError.notFound("Contact not found");
  }

  private async ensureClinician(clinicId: string, clinicianId: string) {
    const exists = await clinicianExistsForAppointment(clinicId, clinicianId);
    if (!exists) throw ApiError.notFound("Clinician not found");
  }

  private async logAppointmentActivity({
    action,
    appointmentId,
    changes,
    clinicId,
    contactId,
    userId,
  }: {
    action: string;
    appointmentId: string;
    changes: Record<string, unknown>;
    clinicId: string;
    contactId: string | null;
    userId: string;
  }) {
    await logTimelineActivity({
      clinicId,
      contactId: contactId || '',
      type: "Appointment",
      userId,
      metadata: buildTimelineMetadata({
        action,
        source: "appointment",
        recordId: appointmentId,
        changes,
      }),
    });
  }

  // Create a clinician availability window (weekly recurring)
  async createClinicianAvailability(clinicId: string, userId: string, data: any) {
    await this.ensureClinician(clinicId, data.clinicianId);
    const id = uuidv4();
    await insertClinicianAvailability({
      id,
      clinicId,
      clinicianId: data.clinicianId,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      slotIntervalMinutes: data.slotIntervalMinutes || 30,
      isActive: data.isActive === undefined ? true : !!data.isActive,
      createdBy: userId,
    });

    await this.logAppointmentActivity({
      clinicId,
      contactId: null,
      userId,
      appointmentId: id,
      action: "availability_created",
      changes: { clinicianId: data.clinicianId, dayOfWeek: data.dayOfWeek, startTime: data.startTime, endTime: data.endTime },
    });

    await logAuditEvent({ clinicId, userId, action: "AVAILABILITY_CREATED", entityType: "clinician_availability", entityId: id, changes: { ...data } });
    return id;
  }

  async deleteClinicianAvailability(clinicId: string, userId: string, id: string) {
    await deleteClinicianAvailability(id, clinicId);
    await this.logAppointmentActivity({
      clinicId,
      contactId: null,
      userId,
      appointmentId: id,
      action: "availability_deleted",
      changes: {},
    });
    await logAuditEvent({ clinicId, userId, action: "AVAILABILITY_DELETED", entityType: "clinician_availability", entityId: id, changes: {} });
  }
}

export const appointmentsService = new AppointmentsService();

function normalizeRecurrenceRule(
  rule: AppointmentRecurrenceRule | null | undefined,
): AppointmentRecurrenceRule | null {
  if (!rule) return null;
  if (rule.frequency !== "weekly" && rule.frequency !== "monthly") return null;

  const interval = Number(rule.interval || 1);
  const count = rule.count === null || rule.count === undefined ? null : Number(rule.count);

  return {
    frequency: rule.frequency,
    interval: Number.isFinite(interval) && interval > 0 ? Math.min(interval, 12) : 1,
    count: Number.isFinite(count) && count ? Math.min(Math.max(count, 2), 52) : 4,
    until: rule.until || null,
  };
}

function addRecurrenceInterval(date: Date, rule: AppointmentRecurrenceRule, index: number) {
  const next = new Date(date);
  const amount = rule.interval * index;
  if (rule.frequency === "weekly") next.setDate(next.getDate() + amount * 7);
  if (rule.frequency === "monthly") next.setMonth(next.getMonth() + amount);
  return next;
}

function buildRecurrenceOccurrences(
  dateTime: string,
  rule: AppointmentRecurrenceRule | null,
) {
  if (!rule) return [{ dateTime, position: 1 }];

  const start = new Date(dateTime);
  const count = rule.count || 4;
  const until = rule.until ? new Date(rule.until) : null;
  const occurrences: Array<{ dateTime: string; position: number }> = [];

  for (let index = 0; index < count; index += 1) {
    const occurrence = addRecurrenceInterval(start, rule, index);
    if (until && occurrence > until) break;
    occurrences.push({ dateTime: occurrence.toISOString(), position: index + 1 });
  }

  return occurrences.length > 0 ? occurrences : [{ dateTime, position: 1 }];
}
