"use client";

import { useState } from "react";
import { Calendar, ClipboardList, PoundSterling, X } from "lucide-react";

type TreatmentPlan = {
  id: string;
  contact: string;
  avatar: string;
  treatment: string;
  items: string[];
  totalValue: number;
  paid: number;
  outstanding: number;
  status: string;
  sessions: number;
  sessionsCompleted: number;
  createdAt: string;
  nextSession: string | null;
  practitioner: string;
};

type TreatmentPlanModalProps = {
  plan: TreatmentPlan | null;
  onClose: () => void;
  onCreate: (payload: {
    contact: string;
    treatment: string;
    items: string[];
    totalValue: number;
    paid: number;
    status: string;
    sessions: number;
    sessionsCompleted: number;
    nextSession: string | null;
    practitioner: string;
  }) => Promise<void>;
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/10";

export function TreatmentPlanModal({
  plan,
  onClose,
  onCreate,
}: TreatmentPlanModalProps) {
  const isNew = !plan;
  const progress = plan
    ? Math.round((plan.sessionsCompleted / plan.sessions) * 100)
    : 0;
  const [form, setForm] = useState({
    contact: "",
    treatment: "",
    items: "",
    totalValue: "",
    paid: "",
    status: "draft",
    sessions: "1",
    sessionsCompleted: "0",
    nextSession: "",
    practitioner: "",
  });
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.contact.trim() || !form.treatment.trim()) {
      setStatusMessage("Add a patient and treatment plan name before saving.");
      return;
    }

    const sessions = Math.max(Number.parseInt(form.sessions, 10) || 1, 1);
    const sessionsCompleted = Math.min(
      Math.max(Number.parseInt(form.sessionsCompleted, 10) || 0, 0),
      sessions,
    );
    const totalValue = Math.max(Number.parseFloat(form.totalValue) || 0, 0);
    const paid = Math.min(Math.max(Number.parseFloat(form.paid) || 0, 0), totalValue);
    const items = form.items
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    setIsSaving(true);
    setStatusMessage("");

    try {
      await onCreate({
        contact: form.contact.trim(),
        treatment: form.treatment.trim(),
        items: items.length ? items : [form.treatment.trim()],
        totalValue,
        paid,
        status: form.status,
        sessions,
        sessionsCompleted,
        nextSession: form.nextSession
          ? new Date(`${form.nextSession}T09:00:00`).toISOString()
          : null,
        practitioner: form.practitioner.trim(),
      });
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not save treatment plan.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      data-gsap-overlay
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
    >
      <div
        data-gsap-popover
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#111827] shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-white/10 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">
              Treatment plan
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              {isNew ? "New plan draft" : plan.treatment}
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              {isNew
                ? "Create a structured plan for a patient."
                : `${plan.contact} · ${plan.practitioner}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close treatment plan"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {plan ? (
          <div className="space-y-5 p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryTile
                icon={PoundSterling}
                label="Plan value"
                value={`£${plan.totalValue.toLocaleString()}`}
              />
              <SummaryTile
                icon={ClipboardList}
                label="Sessions"
                value={`${plan.sessionsCompleted}/${plan.sessions}`}
              />
              <SummaryTile
                icon={Calendar}
                label="Next session"
                value={plan.nextSession || "Not booked"}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-gray-400">Completion</span>
                <span className="font-medium text-emerald-300">
                  {progress}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <ClipboardList className="h-4 w-4 text-emerald-300" />
                Included treatments
              </h3>
              <div className="flex flex-wrap gap-2">
                {plan.items.map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-white/10 px-3 py-1 text-sm text-gray-200"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <Detail label="Created" value={plan.createdAt} />
              <Detail label="Paid" value={`£${plan.paid.toLocaleString()}`} />
              <Detail
                label="Outstanding"
                value={
                  plan.outstanding > 0
                    ? `£${plan.outstanding.toLocaleString()}`
                    : "Settled"
                }
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            {statusMessage && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                {statusMessage}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Patient">
                <input
                  value={form.contact}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      contact: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Patient name"
                />
              </Field>
              <Field label="Practitioner">
                <input
                  value={form.practitioner}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      practitioner: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Practitioner"
                />
              </Field>
              <Field label="Treatment plan">
                <input
                  value={form.treatment}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      treatment: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="e.g. Invisalign package"
                />
              </Field>
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  className={inputClass}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </Field>
              <Field label="Items">
                <input
                  value={form.items}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      items: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Comma-separated treatments"
                />
              </Field>
              <Field label="Next session">
                <input
                  type="date"
                  value={form.nextSession}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      nextSession: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Total value">
                <input
                  type="number"
                  min="0"
                  value={form.totalValue}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      totalValue: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="0"
                />
              </Field>
              <Field label="Paid">
                <input
                  type="number"
                  min="0"
                  value={form.paid}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      paid: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="0"
                />
              </Field>
              <Field label="Sessions">
                <input
                  type="number"
                  min="1"
                  value={form.sessions}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sessions: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Sessions completed">
                <input
                  type="number"
                  min="0"
                  value={form.sessionsCompleted}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sessionsCompleted: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSaving}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save Plan"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5 text-sm text-gray-300">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <Icon className="mb-3 h-5 w-5 text-emerald-300" />
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 font-medium text-gray-100">{value}</p>
    </div>
  );
}
