import type { appointmentStatuses } from "./appointments.constants.js";

export type AppointmentStatus = typeof appointmentStatuses[number];

export interface AppointmentResponse {
  id: string;
  contactId: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  clinicianId: string | null;
  clinicianName: string | null;
  dateTime: string;
  status: AppointmentStatus;
  treatment: string | null;
  valueCents: number;
  durationMinutes: number;
  noShowReason: string | null;
  consultNotes: string | null;
  recurrenceRule: AppointmentRecurrenceRule | null;
  recurrenceSeriesId: string | null;
  recurrencePosition: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentClinicianResponse {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
}

export interface AppointmentAvailabilityQuery {
  appointmentId?: string;
  clinicianId: string;
  date: string;
  durationMinutes?: number | null;
  intervalMinutes?: number | null;
}

export interface AppointmentAvailabilitySlot {
  time: string;
  available: boolean;
  reason: string | null;
}

export interface AppointmentAvailabilityResponse {
  clinicianId: string;
  date: string;
  durationMinutes: number;
  slots: AppointmentAvailabilitySlot[];
}

export interface ListAppointmentsQuery {
  start?: string;
  end?: string;
  status?: AppointmentStatus;
}

export type AppointmentRecurrenceFrequency = "weekly" | "monthly";

export interface AppointmentRecurrenceRule {
  frequency: AppointmentRecurrenceFrequency;
  interval: number;
  count?: number | null;
  until?: string | null;
}

export interface CreateAppointmentDTO {
  contactId: string;
  dateTime: string;
  clinicianId?: string | null;
  status?: AppointmentStatus;
  treatment?: string | null;
  valueCents?: number | null;
  durationMinutes?: number | null;
  noShowReason?: string | null;
  consultNotes?: string | null;
  recurrenceRule?: AppointmentRecurrenceRule | null;
}

export interface UpdateAppointmentDTO extends Partial<Omit<CreateAppointmentDTO, "contactId">> {
  contactId?: string | null;
}
