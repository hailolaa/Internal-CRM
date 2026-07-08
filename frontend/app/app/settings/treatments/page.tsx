"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Scissors,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  TreatmentCatalogItem,
  TreatmentCatalogPayload,
  TreatmentCategory,
} from "@/lib/api-types";

const TREATMENT_CATEGORIES: TreatmentCategory[] = [
  "Injectables",
  "Skin",
  "Aesthetics",
  "Cosmetic Dentistry",
  "Laser",
  "Body",
  "Surgery",
  "Wellness",
  "Other",
];

type TreatmentFormState = {
  name: string;
  description: string;
  category: TreatmentCategory;
  durationMinutes: string;
  price: string;
  averageValue: string;
  priority: string;
  marginPercent: string;
  isHighTicket: boolean;
  status: "active" | "inactive";
};

const EMPTY_FORM: TreatmentFormState = {
  name: "",
  description: "",
  category: "Other",
  durationMinutes: "30",
  price: "",
  averageValue: "",
  priority: "0",
  marginPercent: "",
  isHighTicket: false,
  status: "active",
};

function formatMoney(cents: number | null) {
  if (cents === null) return "Not set";
  if (cents === 0) return "Free";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function centsToInput(cents: number | null) {
  if (cents === null) return "";
  return (cents / 100).toString();
}

function parseNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCurrencyToCents(value: string) {
  const parsed = parseNumber(value.replace(/[£,]/g, ""));
  return parsed === undefined ? undefined : Math.round(parsed * 100);
}

function toFormState(treatment: TreatmentCatalogItem): TreatmentFormState {
  return {
    name: treatment.name,
    description: treatment.description || "",
    category: treatment.category,
    durationMinutes: String(treatment.durationMinutes ?? 30),
    price: centsToInput(treatment.priceCents),
    averageValue: centsToInput(treatment.averageValueCents),
    priority: String(treatment.priority),
    marginPercent:
      treatment.marginPercent === null ? "" : String(treatment.marginPercent),
    isHighTicket: treatment.isHighTicket,
    status: treatment.status,
  };
}

function toPayload(form: TreatmentFormState): TreatmentCatalogPayload {
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    category: form.category,
    durationMinutes: parseNumber(form.durationMinutes),
    priceCents: parseCurrencyToCents(form.price),
    averageValueCents: parseCurrencyToCents(form.averageValue),
    marginPercent: parseNumber(form.marginPercent),
    priority: parseNumber(form.priority),
    isHighTicket: form.isHighTicket,
    status: form.status,
  };
}

function TreatmentFields({
  form,
  onChange,
  disabled,
}: {
  form: TreatmentFormState;
  onChange: (field: keyof TreatmentFormState, value: string | boolean) => void;
  disabled?: boolean;
}) {
  const inputClass =
    "w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] px-3 py-2 text-sm text-[#111111] focus:border-[rgba(110,106,232,0.4)] focus:outline-none focus:ring-1 focus:ring-[rgba(110,106,232,0.15)] disabled:opacity-60";

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs font-medium text-[#6B7280]">
          Treatment name
        </label>
        <input
          value={form.name}
          disabled={disabled}
          onChange={(event) => onChange("name", event.target.value)}
          className={inputClass}
          placeholder="Composite Bonding"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#6B7280]">
          Category
        </label>
        <select
          value={form.category}
          disabled={disabled}
          onChange={(event) =>
            onChange("category", event.target.value as TreatmentCategory)
          }
          className={inputClass}
        >
          {TREATMENT_CATEGORIES.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#6B7280]">
          Duration
        </label>
        <input
          value={form.durationMinutes}
          disabled={disabled}
          inputMode="numeric"
          onChange={(event) => onChange("durationMinutes", event.target.value)}
          className={inputClass}
          placeholder="30"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#6B7280]">
          Price
        </label>
        <input
          value={form.price}
          disabled={disabled}
          inputMode="decimal"
          onChange={(event) => onChange("price", event.target.value)}
          className={inputClass}
          placeholder="3900"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#6B7280]">
          Status
        </label>
        <select
          value={form.status}
          disabled={disabled}
          onChange={(event) =>
            onChange("status", event.target.value as "active" | "inactive")
          }
          className={inputClass}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs font-medium text-[#6B7280]">
          Average value
        </label>
        <input
          value={form.averageValue}
          disabled={disabled}
          inputMode="decimal"
          onChange={(event) => onChange("averageValue", event.target.value)}
          className={inputClass}
          placeholder="Optional"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#6B7280]">
          Margin %
        </label>
        <input
          value={form.marginPercent}
          disabled={disabled}
          inputMode="decimal"
          onChange={(event) => onChange("marginPercent", event.target.value)}
          className={inputClass}
          placeholder="Optional"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#6B7280]">
          Priority
        </label>
        <input
          value={form.priority}
          disabled={disabled}
          inputMode="numeric"
          onChange={(event) => onChange("priority", event.target.value)}
          className={inputClass}
        />
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2 text-sm text-[#111111] md:col-span-2">
        <input
          type="checkbox"
          checked={form.isHighTicket}
          disabled={disabled}
          onChange={(event) => onChange("isHighTicket", event.target.checked)}
          className="h-4 w-4 rounded border-[#D1D5DB] text-[#6E6AE8]"
        />
        High ticket service
      </label>
      <div className="md:col-span-6">
        <label className="mb-1 block text-xs font-medium text-[#6B7280]">
          Description
        </label>
        <textarea
          value={form.description}
          disabled={disabled}
          onChange={(event) => onChange("description", event.target.value)}
          rows={2}
          className={`${inputClass} resize-none`}
          placeholder="Optional setup notes for this service"
        />
      </div>
    </div>
  );
}

export default function TreatmentSettingsPage() {
  const { session } = useAuth();
  const [treatments, setTreatments] = useState<TreatmentCatalogItem[]>([]);
  const [createForm, setCreateForm] = useState<TreatmentFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TreatmentFormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const activeCount = useMemo(
    () => treatments.filter((treatment) => treatment.status === "active").length,
    [treatments],
  );
  const averageDuration = useMemo(() => {
    const durations = treatments
      .map((treatment) => treatment.durationMinutes)
      .filter((duration): duration is number => typeof duration === "number");
    if (!durations.length) return 0;
    return Math.round(
      durations.reduce((total, duration) => total + duration, 0) /
        durations.length,
    );
  }, [treatments]);

  const loadTreatments = async () => {
    if (!session?.token) return;

    setIsLoading(true);
    try {
      const rows = await api.treatments.list(session.token);
      setTreatments(rows);
      setStatusMessage(null);
    } catch (error) {
      console.error("Failed to load treatment catalogue", error);
      const message =
        error instanceof Error
          ? error.message
          : "Treatment catalogue could not load.";
      setStatusMessage(message);
      toast.error("Treatment catalogue could not load");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTreatments();
    }, 0);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  const updateCreateForm = (
    field: keyof TreatmentFormState,
    value: string | boolean,
  ) => {
    setCreateForm((current) => ({ ...current, [field]: value }));
  };

  const updateEditForm = (
    field: keyof TreatmentFormState,
    value: string | boolean,
  ) => {
    setEditForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session?.token || !createForm.name.trim()) {
      toast.error("Add a treatment name first");
      return;
    }

    setIsSaving(true);
    try {
      const payload = toPayload(createForm);
      await api.treatments.create(session.token, payload);
      toast.success("Treatment added");
      setCreateForm(EMPTY_FORM);
      await loadTreatments();
    } catch (error) {
      console.error("Failed to create treatment", error);
      toast.error(
        error instanceof Error ? error.message : "Treatment could not be added",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (treatment: TreatmentCatalogItem) => {
    setEditingId(treatment.id);
    setEditForm(toFormState(treatment));
  };

  const handleSaveEdit = async (treatmentId: string) => {
    if (!session?.token || !editForm.name.trim()) {
      toast.error("Treatment name is required");
      return;
    }

    setIsSaving(true);
    try {
      const payload = toPayload(editForm);
      await api.treatments.update(session.token, treatmentId, payload);
      toast.success("Treatment updated");
      setEditingId(null);
      await loadTreatments();
    } catch (error) {
      console.error("Failed to update treatment", error);
      toast.error(
        error instanceof Error ? error.message : "Treatment could not be saved",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (treatment: TreatmentCatalogItem) => {
    if (!session?.token) return;
    if (!window.confirm(`Archive ${treatment.name}?`)) return;

    setIsSaving(true);
    try {
      await api.treatments.remove(session.token, treatment.id);
      toast.success("Treatment archived");
      setTreatments((current) =>
        current.filter((item) => item.id !== treatment.id),
      );
    } catch (error) {
      console.error("Failed to archive treatment", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Treatment could not be archived",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivate = async (treatment: TreatmentCatalogItem) => {
    if (!session?.token) return;

    setIsSaving(true);
    try {
      await api.treatments.update(session.token, treatment.id, {
        ...toPayload(toFormState(treatment)),
        status: "active",
      });
      toast.success("Treatment activated");
      await loadTreatments();
    } catch (error) {
      console.error("Failed to activate treatment", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Treatment could not be activated",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <PageHeader
          title="Treatment Catalogue"
          subtitle="Services used by bookings, reports, and appointment value."
          icon={Scissors}
          iconColor="text-[#6E6AE8]"
          iconBg="bg-[rgba(110,106,232,0.08)]"
        />
        <button
          type="button"
          onClick={loadTreatments}
          disabled={isLoading || !session?.token}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] px-4 py-2.5 text-sm font-medium text-[#111111] transition-colors hover:bg-[rgba(110,106,232,0.05)] disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {statusMessage && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] p-4">
          <p className="text-xs text-[#6B7280]">Active services</p>
          <p className="mt-1 text-xl font-semibold text-[#111111]">
            {activeCount}
          </p>
        </div>
        <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] p-4">
          <p className="text-xs text-[#6B7280]">Total catalogue</p>
          <p className="mt-1 text-xl font-semibold text-[#111111]">
            {treatments.length}
          </p>
        </div>
        <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] p-4">
          <p className="text-xs text-[#6B7280]">Average duration</p>
          <p className="mt-1 text-xl font-semibold text-[#111111]">
            {averageDuration ? `${averageDuration} mins` : "Not set"}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="rounded-[24px] border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] p-5 shadow-sm"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#111111]">
              Add service
            </h2>
            <p className="text-sm text-[#6B7280]">
              Active services appear in the booking flow immediately.
            </p>
          </div>
          <button
            type="submit"
            disabled={isSaving || !session?.token}
            className="inline-flex items-center gap-2 rounded-xl bg-[#6E6AE8] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#5A56D4] disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        <TreatmentFields
          form={createForm}
          onChange={updateCreateForm}
          disabled={isSaving}
        />
      </form>

      <div className="overflow-hidden rounded-[24px] border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] shadow-sm">
        <div className="border-b border-[rgba(0,0,0,0.06)] px-5 py-4">
          <h2 className="text-base font-semibold text-[#111111]">
            Clinic services
          </h2>
        </div>
        {isLoading && treatments.length === 0 && (
          <div className="p-5 text-sm text-[#6B7280]">
            Loading live treatment catalogue...
          </div>
        )}
        {!isLoading && treatments.length === 0 && (
          <div className="p-5 text-sm text-[#6B7280]">
            No services have been added yet. Create the first active service to
            enable live booking choices.
          </div>
        )}
        <div className="divide-y divide-[rgba(0,0,0,0.05)]">
          {treatments.map((treatment) => {
            const isEditing = editingId === treatment.id;
            return (
              <div key={treatment.id} className="p-5">
                {isEditing ? (
                  <div className="space-y-4">
                    <TreatmentFields
                      form={editForm}
                      onChange={updateEditForm}
                      disabled={isSaving}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(treatment.id)}
                        disabled={isSaving}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#6E6AE8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#5A56D4] disabled:opacity-60"
                      >
                        <Save className="h-4 w-4" />
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        disabled={isSaving}
                        className="inline-flex items-center gap-2 rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-4 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-[rgba(0,0,0,0.03)] disabled:opacity-60"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-[#111111]">
                          {treatment.name}
                        </h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            treatment.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-[#EFEAE4] text-[#7A746A]"
                          }`}
                        >
                          {treatment.status}
                        </span>
                        {treatment.isHighTicket && (
                          <span className="rounded-full bg-[rgba(110,106,232,0.08)] px-2 py-0.5 text-xs font-medium text-[#6E6AE8]">
                            High ticket
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-[#6B7280]">
                        {treatment.category} ·{" "}
                        {treatment.durationMinutes ?? 30} mins ·{" "}
                        {formatMoney(
                          treatment.priceCents ?? treatment.averageValueCents,
                        )}
                      </p>
                      {treatment.description && (
                        <p className="mt-2 max-w-3xl text-sm text-[#6B7280]">
                          {treatment.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(treatment)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-[rgba(110,106,232,0.05)]"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      {treatment.status === "inactive" ? (
                        <button
                          type="button"
                          onClick={() => handleActivate(treatment)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Activate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleArchive(treatment)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
