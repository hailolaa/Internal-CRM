"use client";

import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  MoreHorizontal,
  CheckCircle,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertBanner, StatCard, StatCardSkeleton } from "@/components/ui";
import { getInitials } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useToast } from "@/lib/toast-context";
import type {
  AppointmentClinicianRecord,
  AppointmentRecord,
  AppointmentRecurrenceRule,
  AppointmentStatus,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

const CALENDAR_HOURS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

const MONTH_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CALENDAR_PROVIDER_FILTER_STORAGE_KEY =
  "clinicgrower.calendar.providerFilter";

type CalendarAppointment = {
  id: string;
  dateTime: string;
  time: string;
  duration: number;
  client: string;
  treatment: string;
  provider: string;
  status: AppointmentStatus;
  statusLabel: string;
  value: string;
  valueCents: number;
  clinicianId: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  consultNotes: string | null;
  noShowReason: string | null;
  recurrenceRule: AppointmentRecurrenceRule | null;
  recurrenceSeriesId: string | null;
  recurrencePosition: number | null;
};

type AppointmentEditForm = {
  clinicianId: string;
  consultNotes: string;
  date: string;
  durationMinutes: string;
  noShowReason: string;
  recurrenceCount: string;
  recurrenceFrequency: "single" | AppointmentRecurrenceRule["frequency"];
  status: AppointmentStatus;
  time: string;
  treatment: string;
  value: string;
};

type ProviderColour = {
  accent: string;
  bg: string;
  border: string;
  hover: string;
  ring: string;
  text: string;
};

type ProviderOption = {
  id: string;
  name: string;
  colour: ProviderColour;
};

type PositionedAppointment = CalendarAppointment & {
  columnCount: number;
  columnIndex: number;
};

const PROVIDER_COLOURS: ProviderColour[] = [
  {
    accent: "bg-[#2D9CDB]",
    bg: "bg-[#EAF6FD]",
    border: "border-[#B9E2F7]",
    hover: "hover:bg-[#DDF0FA]",
    ring: "ring-[#9BD4F2]",
    text: "text-[#126391]",
  },
  {
    accent: "bg-[#16A085]",
    bg: "bg-[#E8F7F3]",
    border: "border-[#B7E5D9]",
    hover: "hover:bg-[#D9F1EA]",
    ring: "ring-[#8DD7C5]",
    text: "text-[#0D6E5F]",
  },
  {
    accent: "bg-[#D97706]",
    bg: "bg-[#FFF3DE]",
    border: "border-[#F8D39B]",
    hover: "hover:bg-[#FFE9C2]",
    ring: "ring-[#F3C178]",
    text: "text-[#8A4B08]",
  },
  {
    accent: "bg-[#DB2777]",
    bg: "bg-[#FDECF4]",
    border: "border-[#F7BCD8]",
    hover: "hover:bg-[#FBDDEB]",
    ring: "ring-[#F39BC5]",
    text: "text-[#9D174D]",
  },
  {
    accent: "bg-[#7C3AED]",
    bg: "bg-[#F2ECFF]",
    border: "border-[#D7C4FE]",
    hover: "hover:bg-[#E9DDFE]",
    ring: "ring-[#C4B5FD]",
    text: "text-[#5B21B6]",
  },
  {
    accent: "bg-[#475569]",
    bg: "bg-[#F1F5F9]",
    border: "border-[#CBD5E1]",
    hover: "hover:bg-[#E2E8F0]",
    ring: "ring-[#CBD5E1]",
    text: "text-[#334155]",
  },
];

function formatMoneyFromCents(valueCents: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",  
    maximumFractionDigits: 0,
  }).format(valueCents / 100);
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function isSameDay(left: Date, right: Date) {
  return formatDateKey(left) === formatDateKey(right);
}

function getWeekStart(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(startOfDay(date), diff);
}

function getDateRange(date: Date, view: CalendarView) {
  if (view === "week") {
    const start = getWeekStart(date);
    return { start, end: addDays(start, 7) };
  }

  if (view === "month") {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const start = getWeekStart(monthStart);
    const end = addDays(getWeekStart(monthEnd), 7);
    return { start, end };
  }

  const start = startOfDay(date);
  return { start, end: addDays(start, 1) };
}

function formatDateHeading(date: Date, view: CalendarView) {
  if (view === "week") {
    return `Week of ${new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(getWeekStart(date))}`;
  }

  if (view === "month") {
    return new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatAppointmentDate(dateTime: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(dateTime));
}

function getStatusLabel(status: AppointmentStatus) {
  const labels: Record<AppointmentStatus, string> = {
    scheduled: "Scheduled",
    completed: "Completed",
    no_show: "No-show",
    cancelled: "Cancelled",
  };
  return labels[status];
}

function getStatusClasses(status: AppointmentStatus) {
  const classes: Record<AppointmentStatus, string> = {
    scheduled: "bg-[rgba(110,106,232,0.10)] text-[#6E6AE8]",
    completed: "bg-emerald-50 text-emerald-600",
    no_show: "bg-amber-50 text-amber-700",
    cancelled: "bg-stone-100 text-stone-600",
  };
  return classes[status];
}

function hashString(value: string) {
  return value.split("").reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) >>> 0;
  }, 0);
}

function getProviderColourByKey(value: string | null | undefined) {
  const key = value || "unassigned";
  return PROVIDER_COLOURS[hashString(key) % PROVIDER_COLOURS.length];
}

function getAppointmentProviderColour(appointment: CalendarAppointment) {
  return getProviderColourByKey(appointment.clinicianId || appointment.provider);
}

function getAppointmentRangeMinutes(appointment: CalendarAppointment) {
  const date = new Date(appointment.dateTime);
  const start = date.getHours() * 60 + date.getMinutes();
  return {
    end: start + appointment.duration,
    start,
  };
}

function layoutOverlappingAppointments(
  appointments: CalendarAppointment[],
): PositionedAppointment[] {
  const sorted = [...appointments].sort((left, right) => {
    const leftStart = getAppointmentRangeMinutes(left).start;
    const rightStart = getAppointmentRangeMinutes(right).start;
    return leftStart - rightStart || left.duration - right.duration;
  });
  const positioned: PositionedAppointment[] = [];
  let group: CalendarAppointment[] = [];
  let groupEnd = -1;

  function flushGroup() {
    if (group.length === 0) return;

    const columnEnds: number[] = [];
    const assigned = group.map((appointment) => {
      const { start, end } = getAppointmentRangeMinutes(appointment);
      const openColumn = columnEnds.findIndex((columnEnd) => columnEnd <= start);
      const columnIndex = openColumn === -1 ? columnEnds.length : openColumn;
      columnEnds[columnIndex] = end;
      return { appointment, columnIndex };
    });
    const columnCount = Math.max(1, columnEnds.length);

    positioned.push(
      ...assigned.map(({ appointment, columnIndex }) => ({
        ...appointment,
        columnCount,
        columnIndex,
      })),
    );
    group = [];
    groupEnd = -1;
  }

  sorted.forEach((appointment) => {
    const { start, end } = getAppointmentRangeMinutes(appointment);
    if (group.length > 0 && start >= groupEnd) flushGroup();
    group.push(appointment);
    groupEnd = Math.max(groupEnd, end);
  });
  flushGroup();

  return positioned;
}

function getMonthGridDays(date: Date) {
  const { start, end } = getDateRange(date, "month");
  const days: Date[] = [];
  let cursor = start;

  while (cursor < end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return days;
}

function formatDropDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function toCalendarAppointment(record: AppointmentRecord): CalendarAppointment {
  const date = new Date(record.dateTime);
  return {
    id: record.id,
    dateTime: record.dateTime,
    time: new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date),
    duration: record.durationMinutes,
    client: record.contactName,
    treatment: record.treatment || "Appointment",
    provider: record.clinicianName || "Unassigned",
    status: record.status,
    statusLabel: getStatusLabel(record.status),
    value: formatMoneyFromCents(record.valueCents || 0),
    valueCents: record.valueCents || 0,
    clinicianId: record.clinicianId,
    contactEmail: record.contactEmail,
    contactPhone: record.contactPhone,
    consultNotes: record.consultNotes,
    noShowReason: record.noShowReason,
    recurrenceRule: record.recurrenceRule,
    recurrenceSeriesId: record.recurrenceSeriesId,
    recurrencePosition: record.recurrencePosition,
  };
}

function appointmentToEditForm(appointment: CalendarAppointment): AppointmentEditForm {
  return {
    clinicianId: appointment.clinicianId || "",
    consultNotes: appointment.consultNotes || "",
    date: formatDateKey(new Date(appointment.dateTime)),
    durationMinutes: String(appointment.duration),
    noShowReason: appointment.noShowReason || "",
    recurrenceCount: appointment.recurrenceRule?.count
      ? String(appointment.recurrenceRule.count)
      : "4",
    recurrenceFrequency: appointment.recurrenceRule?.frequency || "single",
    status: appointment.status,
    time: appointment.time,
    treatment: appointment.treatment === "Appointment" ? "" : appointment.treatment,
    value: formatAppointmentValueInput(appointment.valueCents),
  };
}

function formatAppointmentValueInput(valueCents: number) {
  if (!valueCents) return "";
  const pounds = (valueCents / 100).toFixed(2);
  return pounds.endsWith(".00") ? pounds.slice(0, -3) : pounds;
}

function toAppointmentIso(date: string, time: string) {
  return new Date(`${date}T${time || "09:00"}:00`).toISOString();
}

function getRecurrenceLabel(rule: AppointmentRecurrenceRule | null) {
  if (!rule) return "Single appointment";
  const cadence = rule.frequency === "weekly" ? "Weekly" : "Monthly";
  return `${cadence} series - ${rule.count || 4} appointments`;
}

type CalendarView = "day" | "week" | "month";

function AppointmentEditDrawer({
  appointment,
  clinicians,
  cliniciansError,
  cliniciansLoading,
  form,
  isSaving,
  onClose,
  onSave,
  onUpdateForm,
}: {
  appointment: CalendarAppointment;
  clinicians: AppointmentClinicianRecord[];
  cliniciansError: string;
  cliniciansLoading: boolean;
  form: AppointmentEditForm;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  onUpdateForm: (patch: Partial<AppointmentEditForm>) => void;
}) {
  return (
    <div
      data-gsap-overlay
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/30"
      role="dialog"
      aria-modal="true"
      aria-labelledby="appointment-edit-title"
    >
      <div
        data-gsap-popover
        className="flex h-full w-full max-w-xl flex-col bg-[#FFFCF9] shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-[rgba(0,0,0,0.06)] px-5 py-4">
          <div>
            <h2
              id="appointment-edit-title"
              className="text-lg font-semibold text-[#111111]"
            >
              Edit Appointment
            </h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              {appointment.client} - {appointment.treatment}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[#6B7280] transition-colors hover:bg-[#F0EEF8] hover:text-[#6E6AE8]"
            aria-label="Close appointment edit"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {cliniciansError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {cliniciansError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#111111]">
                Date
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(event) => onUpdateForm({ date: event.target.value })}
                className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#111111]">
                Time
              </label>
              <input
                type="time"
                value={form.time}
                onChange={(event) => onUpdateForm({ time: event.target.value })}
                className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#111111]">
                Status
              </label>
              <select
                value={form.status}
                onChange={(event) =>
                  onUpdateForm({ status: event.target.value as AppointmentStatus })
                }
                className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]/50"
              >
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="no_show">No-show</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#111111]">
                Provider
              </label>
              <select
                value={form.clinicianId}
                onChange={(event) =>
                  onUpdateForm({ clinicianId: event.target.value })
                }
                disabled={cliniciansLoading}
                className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]/50 disabled:opacity-60"
              >
                <option value="">
                  {cliniciansLoading ? "Loading providers..." : "Unassigned"}
                </option>
                {clinicians.map((clinician) => (
                  <option key={clinician.id} value={clinician.id}>
                    {clinician.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#111111]">
              Treatment
            </label>
            <input
              value={form.treatment}
              onChange={(event) =>
                onUpdateForm({ treatment: event.target.value })
              }
              className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]/50"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#111111]">
                Value
              </label>
              <input
                value={form.value}
                onChange={(event) => onUpdateForm({ value: event.target.value })}
                inputMode="decimal"
                className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#111111]">
                Duration
              </label>
              <input
                value={form.durationMinutes}
                onChange={(event) =>
                  onUpdateForm({ durationMinutes: event.target.value })
                }
                inputMode="numeric"
                className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]/50"
              />
            </div>
          </div>

          {form.status === "no_show" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#111111]">
                No-show reason
              </label>
              <input
                value={form.noShowReason}
                onChange={(event) =>
                  onUpdateForm({ noShowReason: event.target.value })
                }
                className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]/50"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#111111]">
              Consult notes
            </label>
            <textarea
              rows={4}
              value={form.consultNotes}
              onChange={(event) =>
                onUpdateForm({ consultNotes: event.target.value })
              }
              className="w-full resize-none rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]/50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#111111]">
              Recurrence
            </label>
            <select
              value={form.recurrenceFrequency}
              onChange={(event) =>
                onUpdateForm({
                  recurrenceFrequency: event.target.value as AppointmentEditForm["recurrenceFrequency"],
                })
              }
              className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#6B7280] outline-none disabled:opacity-70"
            >
              <option value="single">Single appointment</option>
              <option value="weekly">Weekly series</option>
              <option value="monthly">Monthly series</option>
            </select>
            {form.recurrenceFrequency !== "single" && (
              <div className="mt-3">
                <label className="mb-1.5 block text-sm font-medium text-[#111111]">
                  Series count
                </label>
                <input
                  value={form.recurrenceCount}
                  onChange={(event) =>
                    onUpdateForm({ recurrenceCount: event.target.value })
                  }
                  inputMode="numeric"
                  className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]/50"
                />
              </div>
            )}
            {appointment.recurrenceSeriesId && (
              <p className="mt-1.5 text-xs text-[#6B7280]">
                Occurrence {appointment.recurrencePosition || 1} in this series.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[rgba(0,0,0,0.06)] px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-4 py-2.5 text-sm font-medium text-[#6B7280] transition-colors hover:bg-[#F0EEF8]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="rounded-xl bg-[#6E6AE8] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#5A56D4] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSaving ? "Saving..." : "Save Changes"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { hasPermission, session } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const token = session?.token;
  const canWriteAppointments = hasPermission("appointments:write");
  const [view, setView] = useState<CalendarView>("day");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(
    null,
  );
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [loadedRangeKey, setLoadedRangeKey] = useState("");
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState<
    string | null
  >(null);
  const [editingAppointment, setEditingAppointment] =
    useState<CalendarAppointment | null>(null);
  const [editForm, setEditForm] = useState<AppointmentEditForm | null>(null);
  const [clinicians, setClinicians] = useState<AppointmentClinicianRecord[]>([]);
  const [cliniciansError, setCliniciansError] = useState("");
  const [cliniciansLoading, setCliniciansLoading] = useState(false);
  const [providerFilter, setProviderFilter] = useState(() => {
    if (typeof window === "undefined") return "all";
    return (
      window.localStorage.getItem(CALENDAR_PROVIDER_FILTER_STORAGE_KEY) || "all"
    );
  });
  const [isSavingAppointment, setIsSavingAppointment] = useState(false);
  const [draggingAppointmentId, setDraggingAppointmentId] = useState<
    string | null
  >(null);
  const [dropTargetDateKey, setDropTargetDateKey] = useState("");

  const range = useMemo(() => getDateRange(selectedDate, view), [
    selectedDate,
    view,
  ]);
  const rangeStartIso = range.start.toISOString();
  const rangeEndIso = range.end.toISOString();
  const rangeKey = `${view}:${rangeStartIso}:${rangeEndIso}`;
  const isLoading = Boolean(token && loadedRangeKey !== rangeKey);

  const weekDays = useMemo(() => {
    const weekStart = getWeekStart(selectedDate);
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      return {
        key: formatDateKey(date),
        day: new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(date),
        date: String(date.getDate()),
        value: date,
        isSelected: isSameDay(date, selectedDate),
        isToday: isSameDay(date, new Date()),
      };
    });
  }, [selectedDate]);

  const monthDays = useMemo(() => getMonthGridDays(selectedDate), [
    selectedDate,
  ]);

  const providerOptions = useMemo<ProviderOption[]>(() => {
    const providers = new Map<string, string>();

    clinicians.forEach((clinician) => {
      providers.set(clinician.id, clinician.name);
    });
    appointments.forEach((appointment) => {
      if (appointment.clinicianId) {
        providers.set(appointment.clinicianId, appointment.provider);
      } else if (appointment.provider) {
        providers.set(`unassigned:${appointment.provider}`, appointment.provider);
      }
    });

    return [...providers.entries()]
      .map(([id, name]) => ({
        colour: getProviderColourByKey(id),
        id,
        name,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [appointments, clinicians]);

  const activeProviderFilter =
    providerFilter === "all" ||
    providerOptions.some((provider) => provider.id === providerFilter)
      ? providerFilter
      : "all";

  useEffect(() => {
    window.localStorage.setItem(
      CALENDAR_PROVIDER_FILTER_STORAGE_KEY,
      activeProviderFilter,
    );
  }, [activeProviderFilter]);

  const filteredAppointments = useMemo(() => {
    if (activeProviderFilter === "all") return appointments;
    return appointments.filter((appointment) => {
      const key = appointment.clinicianId || `unassigned:${appointment.provider}`;
      return key === activeProviderFilter;
    });
  }, [activeProviderFilter, appointments]);

  const appointmentsByDate = useMemo(() => {
    return filteredAppointments.reduce<Record<string, CalendarAppointment[]>>(
      (groups, appointment) => {
        const key = formatDateKey(new Date(appointment.dateTime));
        groups[key] = [...(groups[key] || []), appointment];
        return groups;
      },
      {},
    );
  }, [filteredAppointments]);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    api.appointments
      .list(token, { start: rangeStartIso, end: rangeEndIso })
      .then((records) => {
        if (!isMounted) return;
        const rows = records.map(toCalendarAppointment);
        setLoadError("");
        setAppointments(rows);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Unable to load appointments from the backend.",
        );
        setAppointments([]);
      })
      .finally(() => {
        if (isMounted) setLoadedRangeKey(rangeKey);
      });

    return () => {
      isMounted = false;
    };
  }, [token, rangeStartIso, rangeEndIso, rangeKey]);

  const refreshAppointments = useCallback(async () => {
    if (!token) return;
    const records = await api.appointments.list(token, {
      start: rangeStartIso,
      end: rangeEndIso,
    });
    setAppointments(records.map(toCalendarAppointment));
    setLoadedRangeKey(rangeKey);
    setLoadError("");
  }, [rangeEndIso, rangeKey, rangeStartIso, token]);

  const loadClinicians = useCallback(async () => {
    if (!token) return;
    setCliniciansLoading(true);
    setCliniciansError("");
    try {
      const records = await api.appointments.listClinicians(token);
      setClinicians(records);
    } catch (error) {
      setCliniciansError(
        error instanceof Error ? error.message : "Unable to load providers.",
      );
      setClinicians([]);
    } finally {
      setCliniciansLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    api.appointments
      .listClinicians(token)
      .then((records) => {
        if (!isMounted) return;
        setClinicians(records);
        setCliniciansError("");
      })
      .catch((error) => {
        if (!isMounted) return;
        setCliniciansError(
          error instanceof Error ? error.message : "Unable to load providers.",
        );
        setClinicians([]);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const openEditAppointment = useCallback(
    (appointment: CalendarAppointment) => {
      if (!canWriteAppointments) {
        setActionMessage("");
        setActionError("You do not have permission to edit appointments.");
        return;
      }

      setEditingAppointment(appointment);
      setEditForm(appointmentToEditForm(appointment));
      setActionMessage("");
      setActionError("");
      if (clinicians.length === 0) void loadClinicians();
    },
    [canWriteAppointments, clinicians.length, loadClinicians],
  );

  const updateEditForm = useCallback((patch: Partial<AppointmentEditForm>) => {
    setEditForm((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const saveEditedAppointment = useCallback(async () => {
    if (!token || !editingAppointment || !editForm) return;

    if (!editForm.date || !editForm.time) {
      setActionMessage("");
      setActionError("Choose a date and time before saving.");
      return;
    }

    const value = Number(editForm.value.replace(/[^\d.]/g, ""));
    const durationMinutes = Number(
      editForm.durationMinutes.replace(/[^\d]/g, ""),
    );
    const recurrenceCount = Number(editForm.recurrenceCount.replace(/[^\d]/g, ""));
    const recurrenceRule =
      editForm.recurrenceFrequency === "single"
        ? null
        : {
            frequency: editForm.recurrenceFrequency,
            interval: 1,
            count: Number.isFinite(recurrenceCount)
              ? Math.min(Math.max(recurrenceCount, 2), 52)
              : 4,
          };
    const nextDurationMinutes = Number.isFinite(durationMinutes) && durationMinutes >= 5
      ? durationMinutes
      : editingAppointment.duration;

    setIsSavingAppointment(true);
    setActionMessage("");
    setActionError("");
    try {
      await api.appointments.update(token, editingAppointment.id, {
        clinicianId: editForm.clinicianId || null,
        consultNotes: editForm.consultNotes.trim() || null,
        dateTime: toAppointmentIso(editForm.date, editForm.time),
        durationMinutes: nextDurationMinutes,
        noShowReason:
          editForm.status === "no_show"
            ? editForm.noShowReason.trim() || null
            : null,
        status: editForm.status,
        treatment: editForm.treatment.trim() || null,
        recurrenceRule,
        valueCents: Number.isFinite(value)
          ? Math.round(value * 100)
          : editingAppointment.valueCents,
      });
      await refreshAppointments();
      setEditingAppointment(null);
      setEditForm(null);
      setSelectedAppointment(null);
      setActionMessage("Appointment updated.");
      addToast("Appointment saved.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update appointment.";
      setActionError(message);
      addToast(`Appointment save failed: ${message}`, "error", 5000);
    } finally {
      setIsSavingAppointment(false);
    }
  }, [addToast, editForm, editingAppointment, refreshAppointments, token]);

  const timelineAppointments = useMemo(
    () =>
      layoutOverlappingAppointments(filteredAppointments.filter((appointment) =>
        isSameDay(new Date(appointment.dateTime), selectedDate),
      )),
    [filteredAppointments, selectedDate],
  );

  const upcomingAppointments = useMemo(
    () =>
      [...filteredAppointments].sort(
        (left, right) =>
          new Date(left.dateTime).getTime() - new Date(right.dateTime).getTime(),
      ),
    [filteredAppointments],
  );

  const rangeRevenue = filteredAppointments.reduce(
    (acc, apt) => acc + apt.valueCents / 100,
    0,
  );
  const scheduledCount = filteredAppointments.filter(
    (appointment) => appointment.status === "scheduled",
  ).length;
  const completedCount = filteredAppointments.filter(
    (appointment) => appointment.status === "completed",
  ).length;
  const selectedAppointmentDetails = filteredAppointments.find(
    (appointment) => appointment.id === selectedAppointment,
  );
  const dateHeading = formatDateHeading(selectedDate, view);

  function shiftDate(direction: -1 | 1) {
    setSelectedAppointment(null);
    if (view === "month") {
      setSelectedDate((current) => addMonths(current, direction));
      return;
    }
    setSelectedDate((current) => addDays(current, view === "week" ? 7 * direction : direction));
  }

  async function updateAppointmentStatus(
    appointment: CalendarAppointment,
    status: AppointmentStatus,
  ) {
    if (!token) return;
    if (!canWriteAppointments) {
      setActionMessage("");
      setActionError("You do not have permission to update appointments.");
      return;
    }

    setUpdatingAppointmentId(appointment.id);
    setActionMessage("");
    setActionError("");

    try {
      const updated = await api.appointments.update(token, appointment.id, {
        status,
      });
      const mapped = toCalendarAppointment(updated);
      setAppointments((current) =>
        current.map((row) => (row.id === mapped.id ? mapped : row)),
      );
      setActionMessage(
        `${appointment.client} marked as ${getStatusLabel(status).toLowerCase()}.`,
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to update appointment status.",
      );
    } finally {
      setUpdatingAppointmentId(null);
    }
  }

  async function rescheduleAppointmentToDate(
    appointment: CalendarAppointment,
    nextDate: Date,
  ) {
    if (!token) return;
    if (!canWriteAppointments) {
      setActionMessage("");
      setActionError("You do not have permission to reschedule appointments.");
      return;
    }

    if (isSameDay(new Date(appointment.dateTime), nextDate)) {
      setSelectedDate(nextDate);
      setSelectedAppointment(appointment.id);
      return;
    }

    setUpdatingAppointmentId(appointment.id);
    setActionMessage("");
    setActionError("");

    try {
      await api.appointments.update(token, appointment.id, {
        dateTime: toAppointmentIso(formatDateKey(nextDate), appointment.time),
      });
      await refreshAppointments();
      setSelectedDate(nextDate);
      setSelectedAppointment(appointment.id);
      setActionMessage(
        `${appointment.client} rescheduled to ${formatDropDate(nextDate)}.`,
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to reschedule appointment.",
      );
    } finally {
      setUpdatingAppointmentId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Calendar</h1>
          <p className="text-[#6B7280] mt-1">
            Manage appointments and scheduling.
          </p>
        </div>
        <button
          onClick={() => router.push("/app/crm/calendar/new")}
          className="bg-[#6E6AE8] hover:bg-[#5A56D4] text-white font-medium px-4 py-2.5 rounded-xl flex items-center gap-2 w-fit transition-colors"
        >
          <Plus className="w-4 h-4" /> New Appointment
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }, (_, index) => <StatCardSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              label={`${view[0].toUpperCase()}${view.slice(1)} Appointments`}
              value={String(filteredAppointments.length)}
            />
            <StatCard
              label="Scheduled"
              value={String(scheduledCount)}
              color="green"
            />
            <StatCard
              label="Completed"
              value={String(completedCount)}
              color="amber"
            />
            <StatCard
              label={`${view[0].toUpperCase()}${view.slice(1)} Revenue`}
              value={`£${rangeRevenue.toLocaleString()}`}
              color="teal"
            />
          </>
        )}
      </div>

      {loadError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Backend appointments could not be loaded"
          description={loadError}
          variant="warning"
        />
      )}

      {actionMessage && (
        <AlertBanner icon={CheckCircle} title={actionMessage} variant="success" />
      )}

      {actionError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Appointment update failed"
          description={actionError}
          variant="error"
        />
      )}

      {/* Date nav + view switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDate(-1)}
            aria-label={`Previous ${view}`}
            className="p-2 rounded-xl bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] hover:bg-[rgba(110,106,232,0.08)] transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-[#6B7280]" />
          </button>
          <h2 className="text-lg font-semibold text-[#111111] px-2">
            {dateHeading}
          </h2>
          <button
            onClick={() => shiftDate(1)}
            aria-label={`Next ${view}`}
            className="p-2 rounded-xl bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] hover:bg-[rgba(110,106,232,0.08)] transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-[#6B7280]" />
          </button>
          <button
            onClick={() => {
              setSelectedAppointment(null);
              setSelectedDate(new Date());
            }}
            className="ml-2 px-3 py-1.5 text-sm bg-[rgba(110,106,232,0.08)] text-[#6E6AE8] rounded-xl hover:bg-[rgba(110,106,232,0.15)] transition-colors font-medium"
          >
            Today
          </button>
        </div>
        <div className="flex gap-1 bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] p-1 rounded-xl">
          {["Day", "Week", "Month"].map((v) => (
            <button
              key={v}
              onClick={() => {
                setSelectedAppointment(null);
                setView(v.toLowerCase() as CalendarView);
              }}
              className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
                view === v.toLowerCase()
                  ? "bg-[#6E6AE8] text-white font-medium shadow-sm"
                  : "text-[#6B7280] hover:text-[#111111]"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setProviderFilter("all");
              setSelectedAppointment(null);
            }}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              activeProviderFilter === "all"
                ? "bg-[#111111] text-white"
                : "bg-[#FAF8F5] text-[#6B7280] hover:bg-[rgba(0,0,0,0.06)]"
            }`}
          >
            All providers
          </button>
          {providerOptions.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => {
                setProviderFilter(provider.id);
                setSelectedAppointment(null);
              }}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                activeProviderFilter === provider.id
                  ? `${provider.colour.bg} ${provider.colour.border} ${provider.colour.text} ring-2 ${provider.colour.ring}`
                  : "border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] text-[#6B7280] hover:bg-[rgba(0,0,0,0.06)]"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-full ${provider.colour.accent}`}
              />
              {provider.name}
            </button>
          ))}
        </div>
        {cliniciansLoading && (
          <span className="inline-flex items-center gap-2 text-xs font-medium text-[#6B7280]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading providers
          </span>
        )}
      </div>

      {/* Week strip (week view only) */}
      {view === "week" && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {weekDays.map((d) => (
            <button
              key={d.key}
              onClick={() => {
                setSelectedAppointment(null);
                setSelectedDate(d.value);
              }}
              className={`flex-shrink-0 w-16 py-3 rounded-xl text-center transition-colors ${
                d.isSelected
                  ? "bg-[#6E6AE8] text-white shadow-sm"
                  : "bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] text-[#111111] hover:bg-[rgba(110,106,232,0.08)]"
              }`}
            >
              <p className="text-xs opacity-70">{d.day}</p>
              <p className="text-lg font-bold">{d.date}</p>
            </button>
          ))}
        </div>
      )}

      {view === "month" && (
        <div className="overflow-hidden rounded-[24px] border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] shadow-sm">
          <div className="grid grid-cols-7 border-b border-[rgba(0,0,0,0.06)] bg-[#FAF8F5]">
            {MONTH_WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                className="px-2 py-3 text-center text-xs font-semibold uppercase text-[#6B7280]"
              >
                {weekday}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const dayKey = formatDateKey(day);
              const dayAppointments = appointmentsByDate[dayKey] || [];
              const isCurrentMonth =
                day.getMonth() === selectedDate.getMonth() &&
                day.getFullYear() === selectedDate.getFullYear();
              const isSelected = isSameDay(day, selectedDate);
              const isDropTarget = dropTargetDateKey === dayKey;

              return (
                <button
                  key={dayKey}
                  type="button"
                  onClick={() => {
                    setSelectedAppointment(null);
                    setSelectedDate(day);
                  }}
                  onDragOver={(event) => {
                    if (!canWriteAppointments || !draggingAppointmentId) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDropTargetDateKey(dayKey);
                  }}
                  onDragLeave={() => {
                    setDropTargetDateKey((current) =>
                      current === dayKey ? "" : current,
                    );
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const appointmentId =
                      event.dataTransfer.getData("text/plain") ||
                      draggingAppointmentId;
                    const appointment = appointments.find(
                      (row) => row.id === appointmentId,
                    );
                    setDraggingAppointmentId(null);
                    setDropTargetDateKey("");
                    if (appointment) {
                      void rescheduleAppointmentToDate(appointment, day);
                    }
                  }}
                  className={`min-h-[132px] border-b border-r border-[rgba(0,0,0,0.05)] p-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#6E6AE8] ${
                    isSelected
                      ? "bg-[rgba(110,106,232,0.08)]"
                      : isDropTarget
                        ? "bg-[#F0EEF8]"
                        : "bg-[#FFFCF9] hover:bg-[#FAF8F5]"
                  } ${isCurrentMonth ? "text-[#111111]" : "text-[#9CA3AF]"}`}
                  aria-label={`${formatDropDate(day)}, ${dayAppointments.length} appointments`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                        isSameDay(day, new Date())
                          ? "bg-[#6E6AE8] text-white"
                          : ""
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {dayAppointments.length > 0 && (
                      <span className="text-xs font-medium text-[#6B7280]">
                        {dayAppointments.length}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 space-y-1">
                    {isLoading &&
                      Array.from({ length: 2 }, (_, index) => (
                        <span
                          key={index}
                          className="block h-7 animate-pulse rounded-lg bg-[rgba(110,106,232,0.08)]"
                        />
                      ))}
                    {!isLoading &&
                      dayAppointments.slice(0, 3).map((appointment) => {
                        const isUpdating =
                          updatingAppointmentId === appointment.id;
                        const providerColour =
                          getAppointmentProviderColour(appointment);
                        return (
                          <span
                            key={appointment.id}
                            draggable={canWriteAppointments && !isUpdating}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedDate(day);
                              setSelectedAppointment((current) =>
                                current === appointment.id
                                  ? null
                                  : appointment.id,
                              );
                            }}
                            onDragStart={(event) => {
                              if (!canWriteAppointments || isUpdating) {
                                event.preventDefault();
                                return;
                              }
                              event.dataTransfer.setData(
                                "text/plain",
                                appointment.id,
                              );
                              event.dataTransfer.effectAllowed = "move";
                              setDraggingAppointmentId(appointment.id);
                            }}
                            onDragEnd={() => {
                              setDraggingAppointmentId(null);
                              setDropTargetDateKey("");
                            }}
                            className={`block min-h-7 cursor-pointer rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${providerColour.bg} ${providerColour.border} ${providerColour.text} ${providerColour.hover} ${canWriteAppointments ? "cursor-grab active:cursor-grabbing" : ""} ${
                              isUpdating ? "opacity-60" : ""
                            }`}
                          >
                            <span className="block truncate">
                              {appointment.time} {appointment.client}
                            </span>
                            <span className="block truncate font-normal opacity-80">
                              {appointment.recurrenceRule ? `${appointment.treatment} - recurring` : appointment.treatment}
                            </span>
                          </span>
                        );
                      })}
                    {!isLoading && dayAppointments.length > 3 && (
                      <span className="block px-2 text-xs font-medium text-[#6B7280]">
                        +{dayAppointments.length - 3} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] overflow-hidden shadow-sm">
        <div className="border-b border-[rgba(0,0,0,0.05)] px-5 py-4">
          <p className="text-sm font-semibold text-[#111111]">
            Selected day timeline
          </p>
          <p className="text-xs text-[#6B7280] mt-1">
            {new Intl.DateTimeFormat("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(selectedDate)}
          </p>
        </div>
        <div className="grid grid-cols-[60px_1fr] md:grid-cols-[80px_1fr]">
          {/* Hour labels */}
          <div className="border-r border-[rgba(0,0,0,0.05)]">
            {CALENDAR_HOURS.map((hour) => (
              <div
                key={hour}
                className="h-20 px-2 md:px-3 py-2 text-xs text-[#6B7280] border-b border-[rgba(0,0,0,0.04)]"
              >
                {hour}
              </div>
            ))}
          </div>
          {/* Appointment slots */}
          <div className="relative">
            {CALENDAR_HOURS.map((hour) => (
              <div
                key={hour}
                className="h-20 border-b border-[rgba(0,0,0,0.04)] hover:bg-[rgba(110,106,232,0.02)] transition-colors"
              />
            ))}
            {isLoading && (
              <div className="absolute inset-x-4 top-6 space-y-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <div
                    key={index}
                    className="h-16 animate-pulse rounded-xl bg-[rgba(110,106,232,0.08)]"
                  />
                ))}
              </div>
            )}
            {!isLoading && timelineAppointments.length === 0 && (
              <div className="absolute inset-x-4 top-6 rounded-xl border border-dashed border-[rgba(0,0,0,0.12)] bg-[#FAF8F5] px-4 py-5 text-sm text-[#6B7280]">
                No appointments found for this selected day.
              </div>
            )}
            {!isLoading && timelineAppointments.map((apt) => {
              const providerColour = getAppointmentProviderColour(apt);
              const appointmentDate = new Date(apt.dateTime);
              const startHour = appointmentDate.getHours();
              const startMin = appointmentDate.getMinutes();
              const firstHour = parseInt(CALENDAR_HOURS[0].split(":")[0]);
              const top = Math.max(
                0,
                (startHour - firstHour) * 80 + (startMin / 60) * 80,
              );
              const height = (apt.duration / 60) * 80;
              const isSelected = selectedAppointment === apt.id;
              const laneWidth = 100 / apt.columnCount;
              const laneLeft = apt.columnIndex * laneWidth;
              return (
                <div
                  key={apt.id}
                  data-gsap-list-item
                  role="button"
                  tabIndex={0}
                  aria-expanded={isSelected}
                  aria-label={`${apt.client} — ${apt.treatment} at ${apt.time}, ${apt.status}`}
                  onClick={() =>
                    setSelectedAppointment(isSelected ? null : apt.id)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedAppointment(isSelected ? null : apt.id);
                    }
                  }}
                  className={`absolute rounded-xl border p-2 md:p-3 cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6E6AE8] ${providerColour.bg} ${providerColour.border} ${providerColour.hover} ${
                    isSelected ? `ring-2 ${providerColour.ring} scale-[1.02]` : "hover:scale-[1.01]"
                  }`}
                  style={{
                    top: `${top}px`,
                    height: `${Math.max(height, 60)}px`,
                    left: `calc(${laneLeft}% + 0.25rem)`,
                    width: `calc(${laneWidth}% - 0.5rem)`,
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-[#111111] truncate">
                        {apt.client}
                      </p>
                      <p className="text-xs text-[#6B7280] truncate">
                        {apt.treatment}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold ${providerColour.text} hidden md:block`}>
                      {apt.value}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6B7280]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {apt.time}
                    </span>
                    <span className="hidden md:flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {apt.provider}
                    </span>
                    <span
                      className={`hidden rounded-lg px-1.5 py-0.5 font-medium sm:block ${getStatusClasses(apt.status)}`}
                    >
                      {apt.statusLabel}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="mt-2 pt-2 border-t border-[rgba(0,0,0,0.06)] flex flex-wrap gap-2">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditAppointment(apt);
                        }}
                        disabled={!canWriteAppointments}
                        className="flex-1 min-w-[72px] py-1 text-xs bg-[rgba(110,106,232,0.08)] text-[#6E6AE8] rounded-lg hover:bg-[rgba(110,106,232,0.15)] transition-colors disabled:opacity-60"
                        aria-label={`Edit appointment for ${apt.client}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          void updateAppointmentStatus(apt, "completed");
                        }}
                        disabled={
                          !canWriteAppointments || updatingAppointmentId === apt.id
                        }
                        className="flex-1 min-w-[72px] py-1 text-xs bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-60"
                        aria-label={`Mark appointment for ${apt.client} complete`}
                      >
                        Complete
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          void updateAppointmentStatus(apt, "no_show");
                        }}
                        disabled={
                          !canWriteAppointments || updatingAppointmentId === apt.id
                        }
                        className="flex-1 min-w-[72px] py-1 text-xs bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-60"
                        aria-label={`Mark appointment for ${apt.client} as no-show`}
                      >
                        No-show
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          void updateAppointmentStatus(apt, "cancelled");
                        }}
                        disabled={
                          !canWriteAppointments || updatingAppointmentId === apt.id
                        }
                        className="flex-1 min-w-[72px] py-1 text-xs bg-[rgba(0,0,0,0.04)] text-[#6B7280] rounded-lg hover:bg-[rgba(0,0,0,0.08)] transition-colors disabled:opacity-60"
                        aria-label={`Cancel appointment for ${apt.client}`}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Upcoming appointments list */}
      <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-5 shadow-sm">
        <h3 className="font-semibold text-[#111111] mb-4">
          Appointments in Loaded Range
        </h3>
        <div className="space-y-3">
          {isLoading &&
            Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="h-[66px] animate-pulse rounded-2xl bg-[#FAF8F5]"
              />
            ))}
          {!isLoading && upcomingAppointments.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[rgba(0,0,0,0.12)] bg-[#FAF8F5] px-4 py-5 text-sm text-[#6B7280]">
              No appointments found for this range.
            </div>
          )}
          {!isLoading && upcomingAppointments.slice(0, 6).map((apt) => (
            <div
              key={apt.id}
              data-gsap-list-item
              className="flex items-center justify-between p-3 bg-[#FAF8F5] border border-[rgba(0,0,0,0.04)] rounded-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6E6AE8] to-[#9B8FEF] flex items-center justify-center text-sm font-medium text-white">
                  {getInitials(apt.client)}
                </div>
                <div>
                  <p className="font-medium text-sm text-[#111111]">
                    {apt.client}
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    {formatAppointmentDate(apt.dateTime)} • {apt.treatment} •{" "}
                    {apt.time} • {getRecurrenceLabel(apt.recurrenceRule)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-1 rounded-lg font-medium ${getStatusClasses(apt.status)}`}
                >
                  {apt.statusLabel}
                </span>
                <button
                  onClick={() =>
                    setSelectedAppointment((current) =>
                      current === apt.id ? null : apt.id,
                    )
                  }
                  aria-label={`More options for ${apt.client} appointment`}
                  className="p-1.5 rounded-lg hover:bg-[rgba(110,106,232,0.08)] transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4 text-[#6B7280]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedAppointmentDetails && (
        <div
          data-gsap-popover
          className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-5 shadow-sm"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#5e8a8d]">
                Selected Appointment
              </p>
              <h3 className="mt-1 text-lg font-semibold text-[#111111]">
                {selectedAppointmentDetails.client}
              </h3>
              <p className="text-sm text-[#6B7280]">
                {formatAppointmentDate(selectedAppointmentDetails.dateTime)} at{" "}
                {selectedAppointmentDetails.time} with{" "}
                {selectedAppointmentDetails.provider}
              </p>
              <p className="mt-1 text-sm text-[#6B7280]">
                {getRecurrenceLabel(selectedAppointmentDetails.recurrenceRule)}
              </p>
              {selectedAppointmentDetails.consultNotes && (
                <p className="mt-3 text-sm text-[#6B7280]">
                  {selectedAppointmentDetails.consultNotes}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedAppointmentDetails.contactPhone && (
                <a
                  href={`tel:${selectedAppointmentDetails.contactPhone}`}
                  className="rounded-lg bg-[rgba(110,106,232,0.08)] px-3 py-2 text-sm font-medium text-[#6E6AE8] hover:bg-[rgba(110,106,232,0.15)]"
                >
                  Call
                </a>
              )}
              {selectedAppointmentDetails.contactEmail && (
                <a
                  href={`mailto:${selectedAppointmentDetails.contactEmail}`}
                  className="rounded-lg bg-[rgba(110,106,232,0.08)] px-3 py-2 text-sm font-medium text-[#6E6AE8] hover:bg-[rgba(110,106,232,0.15)]"
                >
                  Email
                </a>
              )}
              <button
                onClick={() => openEditAppointment(selectedAppointmentDetails)}
                disabled={!canWriteAppointments}
                className="rounded-lg bg-[rgba(110,106,232,0.08)] px-3 py-2 text-sm font-medium text-[#6E6AE8] hover:bg-[rgba(110,106,232,0.15)] disabled:opacity-60"
              >
                Edit
              </button>
              <button
                onClick={() =>
                  void updateAppointmentStatus(
                    selectedAppointmentDetails,
                    "scheduled",
                  )
                }
                disabled={
                  !canWriteAppointments ||
                  updatingAppointmentId === selectedAppointmentDetails.id
                }
                className="rounded-lg bg-[rgba(110,106,232,0.08)] px-3 py-2 text-sm font-medium text-[#6E6AE8] hover:bg-[rgba(110,106,232,0.15)] disabled:opacity-60"
              >
                Mark Scheduled
              </button>
            </div>
          </div>
        </div>
      )}

      {editingAppointment && editForm && (
        <AppointmentEditDrawer
          appointment={editingAppointment}
          clinicians={clinicians}
          cliniciansError={cliniciansError}
          cliniciansLoading={cliniciansLoading}
          form={editForm}
          isSaving={isSavingAppointment}
          onClose={() => {
            setEditingAppointment(null);
            setEditForm(null);
          }}
          onSave={() => void saveEditedAppointment()}
          onUpdateForm={updateEditForm}
        />
      )}
    </div>
  );
}
