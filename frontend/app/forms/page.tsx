"use client";

import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle, Loader2, Send } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AlertBanner, Card, SkeletonLine } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { FormDefinitionRecord } from "@/lib/api-types";

type PublicFieldType =
  | "text"
  | "email"
  | "phone"
  | "date"
  | "checkbox"
  | "select"
  | "textarea";

type PublicField = {
  id: string;
  label: string;
  options?: string[];
  position?: number;
  required: boolean;
  settings?: {
    redirectUrl?: string | null;
    submitText?: string;
    successMessage?: string;
  };
  type: PublicFieldType;
};

const FIELD_TYPES: PublicFieldType[] = [
  "text",
  "email",
  "phone",
  "date",
  "checkbox",
  "select",
  "textarea",
];

function isPublicFieldType(value: unknown): value is PublicFieldType {
  return FIELD_TYPES.includes(value as PublicFieldType);
}

function toPublicFields(fields: unknown[]) {
  return fields
    .map((item, index) => {
      const value = item as Partial<PublicField>;
      return {
        id: String(value.id || `field-${index + 1}`),
        label: String(value.label || `Field ${index + 1}`),
        options: Array.isArray(value.options)
          ? value.options.map((option) => String(option))
          : undefined,
        position:
          typeof value.position === "number" ? value.position : index + 1,
        required: Boolean(value.required),
        settings: value.settings,
        type: isPublicFieldType(value.type) ? value.type : "text",
      };
    })
    .sort((left, right) => (left.position || 0) - (right.position || 0));
}

function payloadKey(field: PublicField) {
  const label = field.label.toLowerCase();
  if (field.type === "email" || label.includes("email")) return "email";
  if (field.type === "phone" || label.includes("phone")) return "phone";
  if (label.includes("full name")) return "fullName";
  if (label === "name" || label.includes("your name")) return "name";
  if (label.includes("first name")) return "firstName";
  if (label.includes("last name")) return "lastName";
  if (label.includes("treatment")) return "treatmentInterest";
  if (label.includes("message")) return "message";
  return (
    field.label
      .trim()
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, char: string) => char.toUpperCase())
      .replace(/^[A-Z]/, (char) => char.toLowerCase()) || field.id
  );
}

function fieldControlId(field: PublicField) {
  return `public-form-field-${field.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function fieldAutocomplete(field: PublicField) {
  const key = payloadKey(field);
  if (key === "email") return "email";
  if (key === "phone") return "tel";
  if (key === "firstName") return "given-name";
  if (key === "lastName") return "family-name";
  if (key === "name" || key === "fullName") return "name";
  return undefined;
}

function PublicFormContent() {
  const searchParams = useSearchParams();
  const formId = searchParams.get("id") || "";
  const [form, setForm] = useState<FormDefinitionRecord | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [isLoading, setIsLoading] = useState(Boolean(formId));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!formId) {
      return;
    }

    let isMounted = true;
    api.forms
      .getPublic(formId)
      .then((record) => {
        if (!isMounted) return;
        setForm(record);
        setLoadError("");
      })
      .catch((error) => {
        if (!isMounted) return;
        setLoadError(
          error instanceof Error ? error.message : "Could not load this form.",
        );
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [formId]);

  const fields = useMemo(() => toPublicFields(form?.fields || []), [form]);
  const settings = fields[0]?.settings || {};
  const submitText = settings.submitText || "Submit";
  const successMessage = settings.successMessage || "Form submitted.";
  const isDisabled = form?.status !== "active";

  const updateValue = (fieldId: string, value: string | boolean) => {
    setValues((current) => ({ ...current, [fieldId]: value }));
  };

  const handleSubmit = async () => {
    if (!form || isDisabled) return;

    const missingField = fields.find(
      (field) => field.required && !values[field.id],
    );
    if (missingField) {
      setSubmitMessage("");
      setSubmitError(`${missingField.label} is required.`);
      return;
    }

    const payload = fields.reduce<Record<string, unknown>>((acc, field) => {
      acc[payloadKey(field)] = values[field.id] ?? "";
      return acc;
    }, {});

    setIsSubmitting(true);
    setSubmitMessage("");
    setSubmitError("");

    try {
      await api.forms.submitPublic(form.id, payload);
      setSubmitMessage(successMessage);
      setValues({});
      if (settings.redirectUrl) {
        window.setTimeout(() => {
          window.location.assign(String(settings.redirectUrl));
        }, 900);
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not submit this form.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#FAF8F5] px-4 py-10">
        <div className="mx-auto max-w-2xl space-y-5">
          <SkeletonLine className="h-8 w-56" />
          <Card padding="p-6">
            <SkeletonLine className="mb-4 h-7 w-64" />
            <SkeletonLine className="mb-3 h-10 w-full" />
            <SkeletonLine className="h-10 w-full" />
          </Card>
        </div>
      </main>
    );
  }

  if (loadError || !form) {
    return (
      <main className="min-h-screen bg-[#FAF8F5] px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <AlertBanner
            icon={AlertTriangle}
            title="This form could not be loaded"
            description={loadError || "The form link is invalid or unavailable."}
            variant="warning"
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF8F5] px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-5">
        {isDisabled && (
          <AlertBanner
            icon={AlertTriangle}
            title="This form is not accepting submissions"
            description={
              form.status === "archived"
                ? "This form has been archived by the clinic."
                : "This form is currently disabled or still in draft."
            }
            variant="warning"
          />
        )}

        {submitMessage && (
          <AlertBanner
            icon={CheckCircle}
            title={submitMessage}
            variant="success"
          />
        )}

        {submitError && (
          <AlertBanner
            icon={AlertTriangle}
            title="Form submission failed"
            description={submitError}
            variant="warning"
          />
        )}

        <Card padding="p-5 sm:p-7">
          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase text-[#5e8a8d]">
              {form.type}
            </p>
            <h1 className="text-2xl font-bold text-[#111111]">{form.name}</h1>
          </div>

          <div className="space-y-4">
            {fields.length === 0 && (
              <p className="rounded-xl border border-[#d8ddda] bg-[#eaedeb] px-4 py-3 text-sm text-[#5e8a8d]">
                This form does not have any fields configured yet.
              </p>
            )}

            {fields.map((field) => (
              <label key={field.id} className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#111111]">
                  {field.label}
                  {field.required && <span className="text-red-500"> *</span>}
                </span>
                {field.type === "textarea" ? (
                  <textarea
                    id={fieldControlId(field)}
                    name={payloadKey(field)}
                    rows={4}
                    value={String(values[field.id] || "")}
                    disabled={isDisabled || isSubmitting}
                    onChange={(event) => updateValue(field.id, event.target.value)}
                    className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] px-4 py-3 text-sm text-[#111111] outline-none transition-colors focus:border-[#6E6AE8] disabled:opacity-60"
                  />
                ) : field.type === "select" ? (
                  <select
                    id={fieldControlId(field)}
                    name={payloadKey(field)}
                    value={String(values[field.id] || "")}
                    disabled={isDisabled || isSubmitting}
                    onChange={(event) => updateValue(field.id, event.target.value)}
                    className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] px-4 py-2.5 text-sm text-[#111111] outline-none transition-colors focus:border-[#6E6AE8] disabled:opacity-60"
                  >
                    <option value="">Select</option>
                    {(field.options || []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : field.type === "checkbox" ? (
                  <input
                    id={fieldControlId(field)}
                    name={payloadKey(field)}
                    type="checkbox"
                    checked={Boolean(values[field.id])}
                    disabled={isDisabled || isSubmitting}
                    onChange={(event) =>
                      updateValue(field.id, event.target.checked)
                    }
                    className="h-4 w-4 rounded accent-[#6E6AE8] disabled:opacity-60"
                  />
                ) : (
                  <input
                    id={fieldControlId(field)}
                    name={payloadKey(field)}
                    autoComplete={fieldAutocomplete(field)}
                    type={field.type === "phone" ? "tel" : field.type}
                    value={String(values[field.id] || "")}
                    disabled={isDisabled || isSubmitting}
                    onChange={(event) => updateValue(field.id, event.target.value)}
                    className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] px-4 py-2.5 text-sm text-[#111111] outline-none transition-colors focus:border-[#6E6AE8] disabled:opacity-60"
                  />
                )}
              </label>
            ))}

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isDisabled || isSubmitting || fields.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-[#6E6AE8] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#5A56D4] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isSubmitting ? "Submitting..." : submitText}
            </button>
          </div>
        </Card>
      </div>
    </main>
  );
}

function PublicFormFallback() {
  return (
    <main className="min-h-screen bg-[#FAF8F5] px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-5">
        <SkeletonLine className="h-8 w-56" />
        <Card padding="p-6">
          <SkeletonLine className="mb-4 h-7 w-64" />
          <SkeletonLine className="mb-3 h-10 w-full" />
          <SkeletonLine className="h-10 w-full" />
        </Card>
      </div>
    </main>
  );
}

export default function PublicFormPage() {
  return (
    <Suspense fallback={<PublicFormFallback />}>
      <PublicFormContent />
    </Suspense>
  );
}
