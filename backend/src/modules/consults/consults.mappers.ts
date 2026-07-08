import type {
  ConsultDepositStatus,
  ConsultOutcome,
  ConsultResponse,
  ConsultSummaryResponse,
  PractitionerConversionResponse,
} from "./consults.types.js";

function dateToIso(value: unknown) {
  return value ? new Date(value as string | number | Date).toISOString() : null;
}

function getName(firstName: string | null, lastName: string | null, fallback: string) {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || fallback;
}

export function mapConsult(row: any): ConsultResponse {
  return {
    id: row.id,
    contactId: row.contactId || null,
    appointmentId: row.appointmentId || null,
    patientName: row.patientName || getName(row.contactFirstName, row.contactLastName, "Unknown contact"),
    treatment: row.treatment,
    practitioner: row.practitioner || getName(row.practitionerFirstName, row.practitionerLastName, "Clinic user"),
    practitionerId: row.practitionerId || null,
    outcome: row.outcome as ConsultOutcome,
    revenue: Number(row.revenue || 0),
    date: dateToIso(row.date),
    notes: row.notes || null,
    depositStatus: (row.depositStatus || "not_required") as ConsultDepositStatus,
    lostReason: row.lostReason || null,
    enteredBy: row.enteredBy?.trim() || "Clinic user",
    clinicId: row.clinicId,
  };
}

export function mapConsultSummary(row: any): ConsultSummaryResponse {
  const totalConsults = Number(row.totalConsults || 0);
  const bookedCount = Number(row.bookedCount || 0);

  return {
    bookedCount,
    conversionRate: totalConsults > 0 ? Math.round((bookedCount / totalConsults) * 100) : 0,
    noShowCount: Number(row.noShowCount || 0),
    totalConsults,
    totalRevenue: Number(row.totalRevenue || 0),
  };
}

export function mapPractitionerConversion(row: any): PractitionerConversionResponse {
  const totalConsults = Number(row.totalConsults || 0);
  const bookedCount = Number(row.bookedCount || 0);

  return {
    practitioner: row.practitioner || "Unassigned",
    totalConsults,
    bookedCount,
    conversionRate: totalConsults > 0 ? Math.round((bookedCount / totalConsults) * 100) : 0,
    revenue: Number(row.revenue || 0),
  };
}
