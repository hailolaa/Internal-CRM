export const appointmentStatuses = ["scheduled", "completed", "no_show", "cancelled"] as const;

export const appointmentSlotBlockingDbStatuses = ["Scheduled", "Completed", "NoShow"] as const;

export const appointmentStatusToDb = {
  scheduled: "Scheduled",
  completed: "Completed",
  no_show: "NoShow",
  cancelled: "Cancelled",
} as const;

export const dbStatusToAppointmentStatus = {
  Scheduled: "scheduled",
  Completed: "completed",
  NoShow: "no_show",
  Cancelled: "cancelled",
} as const;
