import type { consultDepositStatuses, consultOutcomes } from "./consults.constants.js";

export type ConsultOutcome = typeof consultOutcomes[number];
export type ConsultDepositStatus = typeof consultDepositStatuses[number];

export interface ConsultResponse {
  id: string;
  contactId: string | null;
  appointmentId: string | null;
  patientName: string;
  treatment: string;
  practitioner: string;
  practitionerId: string | null;
  outcome: ConsultOutcome;
  revenue: number;
  date: string | null;
  notes: string | null;
  depositStatus: ConsultDepositStatus;
  lostReason: string | null;
  enteredBy: string;
  clinicId: string;
}

export interface ConsultDTO {
  contactId?: string | null;
  appointmentId?: string | null;
  patientName?: string | null;
  treatment: string;
  practitioner?: string | null;
  practitionerId?: string | null;
  outcome: ConsultOutcome;
  revenue?: number | null;
  date?: string | null;
  notes?: string | null;
  depositStatus?: ConsultDepositStatus | null;
  lostReason?: string | null;
}

export interface ConsultSummaryResponse {
  bookedCount: number;
  conversionRate: number;
  noShowCount: number;
  totalConsults: number;
  totalRevenue: number;
}

export interface PractitionerConversionResponse {
  practitioner: string;
  totalConsults: number;
  bookedCount: number;
  conversionRate: number;
  revenue: number;
}
