import { ApiError } from "../../utils/ApiError.js";
import { appointmentSlotBlockingDbStatuses } from "./appointments.constants.js";
import {
  getAppointmentConflictRow,
  listAppointmentBlockerRows,
  listClinicianAvailabilityRows,
} from "./appointments.persistence.js";
import { toMysqlDateTime } from "./appointments.utils.js";
import type {
  AppointmentAvailabilityResponse,
  AppointmentAvailabilitySlot,
} from "./appointments.types.js";

const defaultDurationMinutes = 30;
const defaultIntervalMinutes = 30;
const minuteInMs = 60 * 1000;

interface AvailabilityWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotIntervalMinutes?: number | null;
}

interface AppointmentSlotCheck {
  clinicId: string;
  clinicianId: string | null | undefined;
  dateTime: string;
  durationMinutes: number | string | null | undefined;
  status: string;
  appointmentId?: string;
  timezone?: string;
}

interface AppointmentAvailabilityCheck {
  appointmentId?: string | undefined;
  clinicId: string;
  clinicianId: string;
  date: string;
  durationMinutes?: number | string | null | undefined;
  intervalMinutes?: number | string | null | undefined;
  timezone?: string;
}

function isSlotBlockingStatus(status: string) {
  // Cancelled appointments release the slot; all other outcomes still occupy clinical time.
  return (appointmentSlotBlockingDbStatuses as readonly string[]).includes(status);
}

function toPositiveMinutes(value: number | string | null | undefined, fallback: number) {
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : fallback;
}

function getAppointmentWindow(dateTime: string, durationMinutes: number | string | null | undefined) {
  const start = new Date(dateTime);
  const duration = toPositiveMinutes(durationMinutes, defaultDurationMinutes);
  const end = new Date(start.getTime() + duration * minuteInMs);

  return {
    start: toMysqlDateTime(start.toISOString()),
    end: toMysqlDateTime(end.toISOString()),
  };
}

function getDateOnly(value: string) {
  return value.split("T")[0] || value;
}

function getTimeZoneParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    dayOfWeek: weekdays[value("weekday")] ?? date.getUTCDay(),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
  };
}

function getTimeZoneOffsetMs(date: Date, timezone: string) {
  const parts = getTimeZoneParts(date, timezone);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );

  return localAsUtc - date.getTime();
}

function zonedTimeToUtc(date: string, time: string, timezone: string) {
  const [rawYear, rawMonth, rawDay] = date.split("-").map(Number);
  const [rawHour = 0, rawMinute = 0] = time.split(":").map(Number);
  const year = rawYear || 1970;
  const month = rawMonth || 1;
  const day = rawDay || 1;
  const hour = rawHour || 0;
  const minute = rawMinute || 0;
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess), timezone);
  const secondGuess = utcGuess - firstOffset;
  const secondOffset = getTimeZoneOffsetMs(new Date(secondGuess), timezone);

  return new Date(utcGuess - secondOffset);
}

function toMinutes(time: string) {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function formatTime(minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function getDefaultAvailabilityRows(dayOfWeek: number): AvailabilityWindow[] {
  if (dayOfWeek === 0) return [];

  return [
    { dayOfWeek, startTime: "09:00", endTime: "12:00", slotIntervalMinutes: 30 },
    { dayOfWeek, startTime: "14:00", endTime: "17:00", slotIntervalMinutes: 30 },
  ];
}

function getSlotWindow(date: string, time: string, durationMinutes: number, timezone: string) {
  const start = zonedTimeToUtc(date, time, timezone);
  const end = new Date(start.getTime() + durationMinutes * minuteInMs);

  return {
    start: toMysqlDateTime(start.toISOString()),
    end: toMysqlDateTime(end.toISOString()),
  };
}

function slotOverlapsBooking(slot: { start: string; end: string }, booking: any) {
  return booking.start < slot.end && booking.end > slot.start;
}

function buildAvailabilitySlots({
  bookings,
  date,
  durationMinutes,
  intervalMinutes,
  timezone,
  windows,
}: {
  bookings: any[];
  date: string;
  durationMinutes: number;
  intervalMinutes: number;
  timezone: string;
  windows: AvailabilityWindow[];
}): AppointmentAvailabilitySlot[] {
  const duration = toPositiveMinutes(durationMinutes, defaultDurationMinutes);
  const interval = toPositiveMinutes(intervalMinutes, defaultIntervalMinutes);

  return windows.flatMap((window) => {
    const start = toMinutes(window.startTime);
    const end = toMinutes(window.endTime);
    const step = toPositiveMinutes(window.slotIntervalMinutes, interval);
    const slots: AppointmentAvailabilitySlot[] = [];

    for (let time = start; time + duration <= end; time += step) {
      const slotWindow = getSlotWindow(date, formatTime(time), duration, timezone);
      const booked = bookings.some((booking) => slotOverlapsBooking(slotWindow, booking));

      slots.push({
        time: formatTime(time),
        available: !booked,
        reason: booked ? "booked" : null,
      });
    }

    return slots;
  });
}

async function getAvailabilityWindows(
  clinicId: string,
  clinicianId: string,
  dayOfWeek: number,
) {
  const rows = await listClinicianAvailabilityRows(clinicId, clinicianId, dayOfWeek);
  return rows.length > 0 ? rows : getDefaultAvailabilityRows(dayOfWeek);
}

function assertSlotInsideAvailability(
  dateTime: string,
  durationMinutes: number,
  timezone: string,
  windows: AvailabilityWindow[],
) {
  const localDate = getTimeZoneParts(new Date(dateTime), timezone);
  const slotStart = localDate.hour * 60 + localDate.minute;
  const slotEnd = slotStart + durationMinutes;

  const available = windows.some((window) => (
    slotStart >= toMinutes(window.startTime) &&
    slotEnd <= toMinutes(window.endTime)
  ));

  if (!available) throw ApiError.conflict("Clinician is not available during this time.");
}

export async function assertAppointmentSlotAvailable({
  appointmentId,
  clinicId,
  clinicianId,
  dateTime,
  durationMinutes,
  status,
  timezone = "Europe/London",
}: AppointmentSlotCheck) {
  if (!clinicianId || !isSlotBlockingStatus(status)) return;

  const duration = toPositiveMinutes(durationMinutes, defaultDurationMinutes);
  const window = getAppointmentWindow(dateTime, duration);
  const conflict = await getAppointmentConflictRow({
    clinicId,
    clinicianId,
    start: window.start,
    end: window.end,
    ...(appointmentId ? { excludedAppointmentId: appointmentId } : {}),
  });

  if (conflict) throw ApiError.conflict("Clinician is already booked during this time.");
}

export async function getAppointmentAvailability({
  appointmentId,
  clinicId,
  clinicianId,
  date,
  durationMinutes,
  intervalMinutes,
  timezone = "Europe/London",
}: AppointmentAvailabilityCheck): Promise<AppointmentAvailabilityResponse> {
  const selectedDate = getDateOnly(date);
  const duration = toPositiveMinutes(durationMinutes, defaultDurationMinutes);
  const interval = toPositiveMinutes(intervalMinutes, defaultIntervalMinutes);
  const dayOfWeek = new Date(`${selectedDate}T00:00:00`).getDay();
  const windows = await getAvailabilityWindows(clinicId, clinicianId, dayOfWeek);
  const dayStart = getSlotWindow(selectedDate, "00:00", 1, timezone).start;
  const dayEnd = getSlotWindow(selectedDate, "23:59", 1, timezone).end;
  const bookings = await listAppointmentBlockerRows({
    clinicId,
    clinicianId,
    start: dayStart,
    end: dayEnd,
    ...(appointmentId ? { excludedAppointmentId: appointmentId } : {}),
  });

  return {
    clinicianId,
    date: selectedDate,
    durationMinutes: duration,
    slots: buildAvailabilitySlots({
      bookings,
      date: selectedDate,
      durationMinutes: duration,
      intervalMinutes: interval,
      timezone,
      windows,
    }),
  };
}
