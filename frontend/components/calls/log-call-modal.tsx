"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Phone, Search } from "lucide-react";
import { api } from "@/lib/api-client";
import type {
  CallCommercialOutcome,
  CallLogRecord,
  ContactRecord,
} from "@/lib/api-types";

const outcomeOptions: Array<{ value: CallCommercialOutcome; label: string }> = [
  { value: "booked_consult", label: "Discovery call booked" },
  { value: "asked_for_prices", label: "Asked for prices" },
  { value: "follow_up_required", label: "Follow-up required" },
  { value: "existing_patient", label: "Existing client/contact" },
  { value: "not_suitable", label: "Not suitable" },
  { value: "missed_no_answer", label: "No answer / missed" },
  { value: "lost", label: "Lost" },
  { value: "spam", label: "Spam" },
];

function contactLabel(contact: ContactRecord) {
  return [contact.name, contact.phone, contact.email].filter(Boolean).join(" · ");
}

function toIsoDateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export function LogCallModal({
  onClose,
  onCreated,
  token,
}: {
  onClose: () => void;
  onCreated: (call: CallLogRecord) => void;
  token: string;
}) {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [contactQuery, setContactQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [direction, setDirection] = useState<"inbound" | "outbound">("inbound");
  const [durationMinutes, setDurationMinutes] = useState("5");
  const [outcome, setOutcome] = useState<CallCommercialOutcome>("follow_up_required");
  const [treatment, setTreatment] = useState("");
  const [source, setSource] = useState("manual_call");
  const [createdAt, setCreatedAt] = useState(() =>
    new Date().toISOString().slice(0, 16),
  );
  const [notes, setNotes] = useState("");
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    api.contacts
      .list(token, { pageSize: 50 })
      .then((result) => {
        if (!mounted) return;
        setContacts(result.contacts);
        setSelectedContactId((current) => current || result.contacts[0]?.id || "");
      })
      .catch((loadError) => {
        if (!mounted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load contacts.",
        );
      })
      .finally(() => {
        if (mounted) setIsLoadingContacts(false);
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  const filteredContacts = useMemo(() => {
    const query = contactQuery.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) =>
      [contact.name, contact.phone, contact.email]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [contactQuery, contacts]);

  const handleSubmit = async () => {
    if (!selectedContactId) {
      setError("Choose a contact before saving the call.");
      return;
    }

    const duration = Math.max(0, Math.round(Number(durationMinutes || "0") * 60));
    setIsSaving(true);
    setError("");

    try {
      const call = await api.calls.create(token, {
        contactId: selectedContactId,
        direction,
        duration,
        commercialOutcome: outcome,
        notes: notes.trim() || null,
        source: source.trim() || "manual_call",
        treatmentMentioned: treatment.trim() || null,
        createdAt: toIsoDateTime(createdAt),
      });
      onCreated(call);
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save call.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      data-gsap-overlay
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(37, 36, 33, 0.5)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        data-gsap-popover
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl animate-scale-in"
        style={{
          backgroundColor: "#FFFCF9",
          border: "1px solid #E5DED6",
          boxShadow: "0 24px 64px rgba(37, 36, 33, 0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid #E5DED6" }}
        >
          <h2
            className="font-semibold flex items-center gap-2"
            style={{ color: "#252421" }}
          >
            <Phone className="w-5 h-5 text-[#7D8F7A]" /> Log Call
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#F7F5F2] transition-colors"
          >
            <X className="w-4 h-4 text-[#A8A39B]" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-[#252421]">
              Contact
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8A39B]" />
              <input
                value={contactQuery}
                onChange={(event) => setContactQuery(event.target.value)}
                placeholder="Search contacts"
                className="w-full rounded-xl border border-[#E5DED6] bg-[#F7F5F2] py-2.5 pl-10 pr-3 text-sm text-[#252421] outline-none focus:border-[#7D8F7A]"
              />
            </div>
            <select
              value={selectedContactId}
              onChange={(event) => setSelectedContactId(event.target.value)}
              disabled={isLoadingContacts || contacts.length === 0}
              className="w-full rounded-xl border border-[#E5DED6] bg-[#F7F5F2] px-3 py-2.5 text-sm text-[#252421] outline-none focus:border-[#7D8F7A] disabled:text-[#A8A39B]"
            >
              {isLoadingContacts && <option>Loading contacts...</option>}
              {!isLoadingContacts && filteredContacts.length === 0 && (
                <option value="">No contacts found</option>
              )}
              {filteredContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contactLabel(contact)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#252421]">
                Direction
              </label>
              <select
                value={direction}
                onChange={(event) =>
                  setDirection(event.target.value as "inbound" | "outbound")
                }
                className="w-full rounded-xl border border-[#E5DED6] bg-[#F7F5F2] px-3 py-2.5 text-sm text-[#252421] outline-none focus:border-[#7D8F7A]"
              >
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#252421]">
                Duration (mins)
              </label>
              <input
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
                inputMode="numeric"
                min="0"
                type="number"
                className="w-full rounded-xl border border-[#E5DED6] bg-[#F7F5F2] px-3 py-2.5 text-sm text-[#252421] outline-none focus:border-[#7D8F7A]"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#252421]">
              Outcome
            </label>
            <select
              value={outcome}
              onChange={(event) =>
                setOutcome(event.target.value as CallCommercialOutcome)
              }
              className="w-full rounded-xl border border-[#E5DED6] bg-[#F7F5F2] px-3 py-2.5 text-sm text-[#252421] outline-none focus:border-[#7D8F7A]"
            >
              {outcomeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#252421]">
                Service / package
              </label>
              <input
                value={treatment}
                onChange={(event) => setTreatment(event.target.value)}
                placeholder="Website build"
                className="w-full rounded-xl border border-[#E5DED6] bg-[#F7F5F2] px-3 py-2.5 text-sm text-[#252421] outline-none focus:border-[#7D8F7A]"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#252421]">
                Source
              </label>
              <input
                value={source}
                onChange={(event) => setSource(event.target.value)}
                className="w-full rounded-xl border border-[#E5DED6] bg-[#F7F5F2] px-3 py-2.5 text-sm text-[#252421] outline-none focus:border-[#7D8F7A]"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#252421]">
              Date and time
            </label>
            <input
              value={createdAt}
              onChange={(event) => setCreatedAt(event.target.value)}
              type="datetime-local"
              className="w-full rounded-xl border border-[#E5DED6] bg-[#F7F5F2] px-3 py-2.5 text-sm text-[#252421] outline-none focus:border-[#7D8F7A]"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#252421]">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              className="w-full resize-none rounded-xl border border-[#E5DED6] bg-[#F7F5F2] px-3 py-2.5 text-sm text-[#252421] outline-none focus:border-[#7D8F7A]"
            />
          </div>

        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex justify-end gap-2"
          style={{ borderTop: "1px solid #E5DED6" }}
        >
          <button onClick={onClose} className="btn-secondary text-sm" disabled={isSaving}>
            Close
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || isLoadingContacts || !selectedContactId}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Call"}
          </button>
        </div>
      </div>
    </div>
  );
}
