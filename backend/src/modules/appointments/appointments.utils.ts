import type { ListAppointmentsQuery } from "./appointments.types.js";

export function centsToValue(valueCents: number | null | undefined) {
  // The appointment.value column is required, so omitted values become zero.
  return valueCents == null ? 0 : valueCents / 100;
}

export function toMysqlDateTime(value: string) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

export function getDefaultRange(query: ListAppointmentsQuery) {
  const startDate = query.start ? new Date(query.start) : new Date();
  startDate.setHours(0, 0, 0, 0);

  const endDate = query.end ? new Date(query.end) : new Date(startDate);
  if (!query.end) endDate.setDate(endDate.getDate() + 1);

  return {
    start: toMysqlDateTime(startDate.toISOString()),
    end: toMysqlDateTime(endDate.toISOString()),
  };
}

export function getActivityAction(status: string) {
  if (status === "Completed") return "completed";
  if (status === "NoShow") return "no_show";
  if (status === "Cancelled") return "cancelled";
  return "scheduled";
}
