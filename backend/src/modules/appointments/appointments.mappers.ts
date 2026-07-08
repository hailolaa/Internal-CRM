import {
  appointmentStatusToDb,
  dbStatusToAppointmentStatus,
} from "./appointments.constants.js";
import type {
  AppointmentClinicianResponse,
  AppointmentResponse,
  AppointmentStatus,
} from "./appointments.types.js";

export function toDbAppointmentStatus(status: AppointmentStatus | undefined) {
  return status ? appointmentStatusToDb[status] : "Scheduled";
}

export function mapDbAppointmentStatus(status: string): AppointmentStatus {
  return dbStatusToAppointmentStatus[status as keyof typeof dbStatusToAppointmentStatus] || "scheduled";
}

function dateToIso(value: unknown) {
  return new Date(value as string | number | Date).toISOString();
}

function getContactName(row: any) {
  const name = [row.contactFirstName, row.contactLastName].filter(Boolean).join(" ").trim();
  return name || row.contactEmail || "Unknown contact";
}

function getClinicianName(row: any) {
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
  return name || row.email || "Clinic user";
}

function parseJson(value: unknown) {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, unknown>;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

export function mapAppointment(row: any): AppointmentResponse {
  return {
    id: row.id,
    contactId: row.contactId,
    contactName: getContactName(row),
    contactEmail: row.contactEmail || null,
    contactPhone: row.contactPhone || null,
    clinicianId: row.clinicianId || null,
    clinicianName: row.clinicianName || null,
    dateTime: dateToIso(row.dateTime),
    status: mapDbAppointmentStatus(row.status),
    treatment: row.treatment || null,
    valueCents: Math.round(Number(row.value || 0) * 100),
    durationMinutes: Number(row.durationMinutes || 30),
    noShowReason: row.noShowReason || null,
    consultNotes: row.consultNotes || null,
    recurrenceRule: parseJson(row.recurrenceRule) as AppointmentResponse["recurrenceRule"],
    recurrenceSeriesId: row.recurrenceSeriesId || null,
    recurrencePosition: row.recurrencePosition === null || row.recurrencePosition === undefined
      ? null
      : Number(row.recurrencePosition),
    createdAt: dateToIso(row.createdAt),
    updatedAt: dateToIso(row.updatedAt),
  };
}

export function mapAppointmentClinician(row: any): AppointmentClinicianResponse {
  return {
    id: row.id,
    name: getClinicianName(row),
    email: row.email || null,
    role: row.role || null,
  };
}
