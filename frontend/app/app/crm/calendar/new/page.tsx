"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Search, Check, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { StepProgress, InfoRow, DashedAddButton } from "@/components/ui/shared";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  AppointmentAvailabilitySlot,
  AppointmentClinicianRecord,
  ContactRecord,
  TreatmentCatalogItem,
} from "@/lib/api-types";

function formatTreatmentValue(treatment: TreatmentCatalogItem) {
  const cents = treatment.priceCents ?? treatment.averageValueCents;
  if (cents === null) return "Price not set";
  if (cents === 0) return "Free";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function getTreatmentValueCents(treatment: TreatmentCatalogItem) {
  return treatment.priceCents ?? treatment.averageValueCents ?? null;
}

function getTreatmentDurationMinutes(treatment: TreatmentCatalogItem) {
  return treatment.durationMinutes ?? 30;
}

function normalisePrefillValue(value: string) {
  return value.trim().toLowerCase();
}

export default function NewBookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const prefillContactId = searchParams.get("contactId") || "";
  const prefillPatient = searchParams.get("patient") || "";
  const prefillTreatment = searchParams.get("treatment") || "";
  const prefillTreatmentId = searchParams.get("treatmentId") || "";
  const [step, setStep] = useState(1);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [clinicians, setClinicians] = useState<AppointmentClinicianRecord[]>([]);
  const [treatments, setTreatments] = useState<TreatmentCatalogItem[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<
    AppointmentAvailabilitySlot[]
  >([]);
  const [selectedTreatment, setSelectedTreatment] = useState<string | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    null,
  );
  const [contactSearch, setContactSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<
    "single" | "weekly" | "monthly"
  >("single");
  const [recurrenceCount, setRecurrenceCount] = useState("4");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [treatmentLoadError, setTreatmentLoadError] = useState<string | null>(
    null,
  );
  const [isLoadingTreatments, setIsLoadingTreatments] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const selectedTimeRef = useRef<string | null>(null);
  const stepRef = useRef(step);

  const treatment = treatments.find((t) => t.id === selectedTreatment);
  const displayTimeSlots = availabilitySlots
    .filter((slot) => slot.available)
    .map((slot) => slot.time);
  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) =>
      [contact.name, contact.email, contact.phone]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [contactSearch, contacts]);
  const selectedContact = contacts.find(
    (contact) => contact.id === selectedContactId,
  );

  useEffect(() => {
    selectedTimeRef.current = selectedTime;
  }, [selectedTime]);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadBookingData() {
      setIsLoadingTreatments(true);
      setTreatmentLoadError(null);
      try {
        const [contactsResult, clinicianRows, treatmentRows] = await Promise.all([
          api.contacts.list(session!.token, { pageSize: 25 }),
          api.appointments.listClinicians(session!.token),
          api.treatments.list(session!.token),
        ]);

        if (!cancelled) {
          const activeTreatments = treatmentRows.filter(
            (catalogTreatment) => catalogTreatment.status === "active",
          );
          let contactRows = contactsResult.contacts;
          if (
            prefillContactId &&
            !contactRows.some((contact) => contact.id === prefillContactId)
          ) {
            try {
              const prefilledContact = await api.contacts.get(
                session!.token,
                prefillContactId,
              );
              contactRows = [prefilledContact, ...contactRows];
            } catch (error) {
              console.warn("Could not load prefilled booking contact", error);
            }
          }

          const matchedContact =
            (prefillContactId
              ? contactRows.find((contact) => contact.id === prefillContactId)
              : null) ||
            (prefillPatient
              ? contactRows.find(
                  (contact) =>
                    normalisePrefillValue(contact.name) ===
                    normalisePrefillValue(prefillPatient),
                )
              : null);
          const matchedTreatment =
            (prefillTreatmentId
              ? activeTreatments.find((row) => row.id === prefillTreatmentId)
              : null) ||
            (prefillTreatment
              ? activeTreatments.find(
                  (row) =>
                    normalisePrefillValue(row.name) ===
                    normalisePrefillValue(prefillTreatment),
                ) ||
                activeTreatments.find((row) =>
                  normalisePrefillValue(row.name).includes(
                    normalisePrefillValue(prefillTreatment),
                  ),
                )
              : null);

          setContacts(contactRows);
          setClinicians(clinicianRows);
          setTreatments(activeTreatments);
          setSelectedTreatment((current) =>
            matchedTreatment?.id ||
            (current && activeTreatments.some((row) => row.id === current)
              ? current
              : null),
          );
          if (matchedContact) {
            setSelectedContactId(matchedContact.id);
            setContactSearch(matchedContact.name);
          } else if (prefillPatient) {
            setContactSearch(prefillPatient);
          }
          setSelectedProvider((current) =>
            current ?? clinicianRows[0]?.id ?? null,
          );
          if (matchedTreatment) {
            setStep(2);
          }
          setStatusMessage(null);
          setTreatmentLoadError(null);
        }
      } catch (error) {
        console.error("Failed to load booking data", error);
        if (!cancelled) {
          setContacts([]);
          setClinicians([]);
          setTreatments([]);
          setSelectedProvider(null);
          setTreatmentLoadError("Treatment catalogue could not be loaded.");
          setStatusMessage("Booking data could not be loaded.");
        }
      } finally {
        if (!cancelled) setIsLoadingTreatments(false);
      }
    }

    loadBookingData();

    return () => {
      cancelled = true;
    };
  }, [prefillContactId, prefillPatient, prefillTreatment, prefillTreatmentId, session]);

  useEffect(() => {
    if (!session?.token || !selectedProvider || !selectedDate || !treatment) {
      return;
    }

    let cancelled = false;

    api.appointments
      .availability(session.token, {
        clinicianId: selectedProvider,
        date: selectedDate,
        durationMinutes: getTreatmentDurationMinutes(treatment),
      })
      .then((availability) => {
        if (!cancelled) {
          const currentTime = selectedTimeRef.current;
          const isCurrentTimeAvailable = availability.slots.some(
            (slot) => slot.available && slot.time === currentTime,
          );
          setAvailabilitySlots(availability.slots);
          setSelectedTime((current) => {
            if (!current) return null;
            return isCurrentTimeAvailable ? current : null;
          });
          if (currentTime && !isCurrentTimeAvailable && stepRef.current > 2) {
            setStep(2);
            setStatusMessage(
              "That time is not available for the selected provider. Choose another available time.",
            );
          } else {
            setStatusMessage(null);
          }
        }
      })
      .catch((error) => {
        console.error("Failed to load appointment availability", error);
        if (!cancelled) {
          setAvailabilitySlots([]);
          setStatusMessage("Availability could not be loaded for that provider and date.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session, selectedDate, selectedProvider, treatment]);

  const handleConfirm = async () => {
    if (
      !session?.token ||
      !selectedContactId ||
      !selectedDate ||
      !selectedTime ||
      !selectedProvider ||
      !treatment
    ) {
      setStatusMessage(
        "Choose a treatment, provider, time, and client before booking.",
      );
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const parsedRecurrenceCount = Number(recurrenceCount.replace(/[^\d]/g, ""));
      await api.appointments.create(session.token, {
        contactId: selectedContactId,
        clinicianId: selectedProvider,
        dateTime: new Date(`${selectedDate}T${selectedTime}`).toISOString(),
        treatment: treatment.name,
        valueCents: getTreatmentValueCents(treatment),
        durationMinutes: getTreatmentDurationMinutes(treatment),
        consultNotes: notes.trim() || null,
        recurrenceRule:
          recurrenceFrequency === "single"
            ? null
            : {
                frequency: recurrenceFrequency,
                interval: 1,
                count: Number.isFinite(parsedRecurrenceCount)
                  ? Math.min(Math.max(parsedRecurrenceCount, 2), 52)
                  : 4,
              },
      });
      router.push("/app/crm/calendar");
    } catch (error) {
      console.error("Failed to create appointment", error);
      setStatusMessage("Could not confirm booking.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back + title */}
      <div className="flex items-center gap-4">
        <Link
          href="/app/crm/calendar"
          className="p-2 rounded-xl bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] hover:bg-[rgba(110,106,232,0.08)] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">New Booking</h1>
          <p className="text-[#6B7280] text-sm">Schedule a new appointment</p>
        </div>
      </div>

      <StepProgress current={step} total={4} />

      {statusMessage && (
        <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main step panel */}
        <div className="lg:col-span-2">
          {/* Step 1 — Select Treatment */}
          {step === 1 && (
            <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6 shadow-sm">
              <h2 className="font-semibold text-[#111111] mb-4">
                Select Treatment
              </h2>
              <div className="space-y-2">
                {isLoadingTreatments && (
                  <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] p-4 text-sm text-[#6B7280]">
                    Loading live treatment catalogue...
                  </div>
                )}
                {!isLoadingTreatments && treatmentLoadError && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                    <div className="flex items-start gap-3">
                      <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-medium">{treatmentLoadError}</p>
                        <p className="mt-1">
                          Refresh the page or check the clinic treatment catalogue
                          before creating live bookings.
                        </p>
                        <Link
                          href="/app/settings/treatments"
                          className="mt-2 inline-flex text-sm font-semibold text-[#6E6AE8] hover:text-[#5A56D4]"
                        >
                          Open treatment settings
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
                {!isLoadingTreatments && !treatmentLoadError && treatments.length === 0 && (
                  <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] p-4 text-sm text-[#6B7280]">
                    <p>
                      No active services are configured for this clinic yet. Add
                      treatments to the clinic catalogue before creating live bookings.
                    </p>
                    <Link
                      href="/app/settings/treatments"
                      className="mt-2 inline-flex font-semibold text-[#6E6AE8] hover:text-[#5A56D4]"
                    >
                      Open treatment settings
                    </Link>
                  </div>
                )}
                {treatments.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTreatment(t.id);
                      setSelectedTime(null);
                      setAvailabilitySlots([]);
                      setStep(2);
                    }}
                    className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${
                      selectedTreatment === t.id
                        ? "bg-[rgba(110,106,232,0.08)] border-[#6E6AE8]/40"
                        : "bg-[#FAF8F5] border-[rgba(0,0,0,0.06)] hover:border-[#6E6AE8]/30 hover:bg-[rgba(110,106,232,0.04)]"
                    }`}
                  >
                    <div>
                      <p className="font-medium text-[#111111]">{t.name}</p>
                      <p className="text-sm text-[#6B7280]">
                        {getTreatmentDurationMinutes(t)} mins
                      </p>
                    </div>
                    <span className="font-semibold text-[#6E6AE8]">
                      {formatTreatmentValue(t)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Select Date & Time */}
          {step === 2 && (
            <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6 shadow-sm">
              <h2 className="font-semibold text-[#111111] mb-4">
                Select Date &amp; Time
              </h2>
              <div className="grid grid-cols-7 gap-2 mb-6">
                {Array.from({ length: 14 }, (_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() + i);
                  const day = date.toLocaleDateString("en-GB", {
                    weekday: "short",
                  });
                  const num = date.getDate();
                  const dateStr = date.toISOString().split("T")[0];
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedDate(dateStr);
                        setSelectedTime(null);
                        setAvailabilitySlots([]);
                      }}
                      className={`p-3 rounded-xl text-center transition-all ${
                        selectedDate === dateStr
                          ? "bg-[#6E6AE8] text-white shadow-sm"
                          : "bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] text-[#111111] hover:bg-[rgba(110,106,232,0.08)]"
                      }`}
                    >
                      <p className="text-xs opacity-70">{day}</p>
                      <p className="font-bold">{num}</p>
                    </button>
                  );
                })}
              </div>
              <h3 className="text-sm text-[#6B7280] mb-3">Available Times</h3>
              <div className="grid grid-cols-4 gap-2">
                {displayTimeSlots.length === 0 && (
                  <div className="col-span-4 rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] p-4 text-sm text-[#6B7280]">
                    Select a provider and date to load live availability.
                  </div>
                )}
                {displayTimeSlots.map((time) => (
                  <button
                    key={time}
                    onClick={() => {
                      setSelectedTime(time);
                      setStep(selectedContactId ? 4 : 3);
                    }}
                    className={`p-3 rounded-xl text-sm transition-all ${
                      selectedTime === time
                        ? "bg-[#6E6AE8] text-white font-medium shadow-sm"
                        : "bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] text-[#111111] hover:bg-[rgba(110,106,232,0.08)]"
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Select Client */}
          {step === 3 && (
            <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6 shadow-sm">
              <h2 className="font-semibold text-[#111111] mb-4">
                Select Client
              </h2>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(event) => setContactSearch(event.target.value)}
                  placeholder="Search contacts..."
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl pl-10 pr-4 py-3 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[#6E6AE8]/50"
                />
              </div>
              <div className="space-y-2">
                {filteredContacts.length === 0 && (
                  <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] p-4 text-sm text-[#6B7280]">
                    No live contacts match this search.
                  </div>
                )}
                {filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => {
                      setSelectedContactId(contact.id);
                      setStep(4);
                    }}
                    className="w-full p-4 bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-2xl flex items-center gap-3 hover:border-[#6E6AE8]/30 hover:bg-[rgba(110,106,232,0.04)] transition-all"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6E6AE8] to-[#9B8FEF] flex items-center justify-center font-medium text-white text-sm">
                      {contact.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <span className="font-medium text-[#111111]">
                      {contact.name}
                    </span>
                  </button>
                ))}
              </div>
              <Link href="/app/crm/contacts/new">
                <DashedAddButton label="Add New Client" className="mt-4" />
              </Link>
            </div>
          )}

          {/* Step 4 — Confirm Booking */}
          {step === 4 && (
            <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6 shadow-sm">
              <h2 className="font-semibold text-[#111111] mb-4">
                Confirm Booking
              </h2>
              <div className="space-y-4">
                <div className="p-4 bg-[rgba(110,106,232,0.08)] border border-[#6E6AE8]/25 rounded-2xl">
                  <p className="text-sm text-[#6B7280]">Treatment</p>
                  <p className="font-semibold text-[#111111]">
                    {treatment?.name}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-2xl">
                    <p className="text-sm text-[#6B7280]">Date</p>
                    <p className="font-semibold text-[#111111]">
                      {selectedDate}
                    </p>
                  </div>
                  <div className="p-4 bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-2xl">
                    <p className="text-sm text-[#6B7280]">Time</p>
                    <p className="font-semibold text-[#111111]">
                      {selectedTime}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[#6B7280] mb-2 block">
                    Recurrence
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
                    <select
                      value={recurrenceFrequency}
                      onChange={(event) =>
                        setRecurrenceFrequency(
                          event.target.value as typeof recurrenceFrequency,
                        )
                      }
                      className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-2xl px-4 py-3 text-sm text-[#111111] focus:outline-none focus:border-[#6E6AE8]/50"
                    >
                      <option value="single">Single appointment</option>
                      <option value="weekly">Weekly series</option>
                      <option value="monthly">Monthly series</option>
                    </select>
                    <input
                      value={recurrenceCount}
                      onChange={(event) => setRecurrenceCount(event.target.value)}
                      disabled={recurrenceFrequency === "single"}
                      inputMode="numeric"
                      aria-label="Number of appointments in series"
                      className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-2xl px-4 py-3 text-sm text-[#111111] disabled:text-[#9CA3AF] focus:outline-none focus:border-[#6E6AE8]/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[#6B7280] mb-2 block">
                    Notes (optional)
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Any special requirements..."
                    className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-2xl px-4 py-3 text-sm text-[#111111] placeholder:text-[#6B7280] resize-none focus:outline-none focus:border-[#6E6AE8]/50"
                  />
                </div>
                <button
                  onClick={handleConfirm}
                  disabled={isSaving}
                  className="w-full bg-[#6E6AE8] hover:bg-[#5A56D4] text-white font-semibold py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {isSaving ? "Confirming..." : "Confirm Booking"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Booking summary sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-5 sticky top-6 shadow-sm">
            <h3 className="font-semibold text-[#111111] mb-4">
              Booking Summary
            </h3>
            <div className="space-y-3 text-sm">
              <InfoRow label="Treatment" value={treatment?.name || "-"} />
              <InfoRow label="Date" value={selectedDate || "-"} />
              <InfoRow label="Time" value={selectedTime || "-"} />
              <InfoRow label="Client" value={selectedContact?.name || "-"} />
              <InfoRow
                label="Recurrence"
                value={
                  recurrenceFrequency === "single"
                    ? "Single"
                    : `${recurrenceFrequency === "weekly" ? "Weekly" : "Monthly"} x ${recurrenceCount || "4"}`
                }
              />
              <InfoRow
                label="Duration"
                value={treatment ? `${getTreatmentDurationMinutes(treatment)} mins` : "-"}
              />
              <div className="pt-3 border-t border-[rgba(0,0,0,0.06)]">
                <InfoRow
                  label="Total"
                  value={treatment ? formatTreatmentValue(treatment) : "-"}
                  valueColor="text-[#6E6AE8] font-semibold"
                />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-[rgba(0,0,0,0.06)]">
              <p className="text-xs text-[#6B7280] mb-2">Provider</p>
              <div className="flex gap-2">
                {clinicians.length === 0 && (
                  <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] p-3 text-sm text-[#6B7280]">
                    No clinicians are available.
                  </div>
                )}
                {clinicians.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProvider(p.id);
                      setAvailabilitySlots([]);
                      if (selectedTime) {
                        setStatusMessage("Checking that time for the selected provider...");
                      }
                    }}
                    className={`flex-1 p-2 rounded-xl flex items-center justify-center gap-2 text-sm transition-all border ${
                      selectedProvider === p.id
                        ? "bg-[rgba(110,106,232,0.08)] border-[#6E6AE8]/40 text-[#6E6AE8]"
                        : "bg-[#FAF8F5] border-[rgba(0,0,0,0.06)] text-[#6B7280] hover:border-[#6E6AE8]/25 hover:bg-[rgba(110,106,232,0.04)]"
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-xs text-white">
                      {p.name.charAt(0)}
                    </div>
                    <span className="hidden sm:inline">
                      {p.name.split(" ")[1] || p.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
