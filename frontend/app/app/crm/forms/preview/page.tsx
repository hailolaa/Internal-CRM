"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Loader2, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AlertBanner, Card, SkeletonLine } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { FormDefinitionRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

type PreviewFieldType =
  | "text"
  | "email"
  | "phone"
  | "date"
  | "checkbox"
  | "select"
  | "textarea";

type PreviewField = {
  id: string;
  label: string;
  options?: string[];
  position?: number;
  required: boolean;
  settings?: {
    submitText?: string;
    successMessage?: string;
  };
  type: PreviewFieldType;
};

const FIELD_TYPES: PreviewFieldType[] = [
  "text",
  "email",
  "phone",
  "date",
  "checkbox",
  "select",
  "textarea",
];

function isPreviewFieldType(value: unknown): value is PreviewFieldType {
  return FIELD_TYPES.includes(value as PreviewFieldType);
}

function toPreviewFields(fields: unknown[]) {
  return fields
    .map((item, index) => {
      const value = item as Partial<PreviewField>;
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
        type: isPreviewFieldType(value.type) ? value.type : "text",
      };
    })
    .sort((left, right) => (left.position || 0) - (right.position || 0));
}

function payloadKey(field: PreviewField) {
  const label = field.label.toLowerCase();
  if (field.type === "email" || label.includes("email")) return "email";
  if (field.type === "phone" || label.includes("phone")) return "phone";
  if (label.includes("full name")) return "fullName";
  if (label === "name" || label.includes("your name")) return "name";
  if (label.includes("first name")) return "firstName";
  if (label.includes("last name")) return "lastName";
  if (label.includes("treatment")) return "treatmentInterest";
  if (label.includes("message")) return "message";
  return field.label
    .trim()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/^[A-Z]/, (char) => char.toLowerCase()) || field.id;
}

function fieldControlId(field: PreviewField) {
  return `form-preview-field-${field.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function fieldAutocomplete(field: PreviewField) {
  const key = payloadKey(field);
  if (key === "email") return "email";
  if (key === "phone") return "tel";
  if (key === "firstName") return "given-name";
  if (key === "lastName") return "family-name";
  if (key === "name" || key === "fullName") return "name";
  return undefined;
}

export default function FormPreviewPage() {
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.token;
  const [formId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("id") || "",
  );
  const [form, setForm] = useState<FormDefinitionRecord | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!token || !formId) return;

    let isMounted = true;
    api.forms
      .list(token)
      .then((records) => {
        if (!isMounted) return;
        const record = records.find((item) => item.id === formId);
        if (!record) {
          setLoadError("Form could not be found.");
          return;
        }
        setForm(record);
        setLoadError("");
      })
      .catch((error) => {
        if (!isMounted) return;
        setLoadError(
          error instanceof Error ? error.message : "Could not load form.",
        );
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [formId, token]);

  const fields = useMemo(() => toPreviewFields(form?.fields || []), [form]);
  const settings = fields[0]?.settings || {};
  const submitText = settings.submitText || "Submit";
  const successMessage = settings.successMessage || "Form submitted.";

  const updateValue = (fieldId: string, value: string | boolean) => {
    setValues((current) => ({ ...current, [fieldId]: value }));
  };

  const handleSubmit = async () => {
    if (!form) return;

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
      await api.forms.submitPublic(form.id, payload, apiKey.trim() || undefined);
      setSubmitMessage(successMessage);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not submit form.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLine className="h-10 w-56" />
        <Card padding="p-6">
          <SkeletonLine className="h-8 w-64 mb-4" />
          <SkeletonLine className="h-10 w-full mb-3" />
          <SkeletonLine className="h-10 w-full" />
        </Card>
      </div>
    );
  }

  if (loadError || !form) {
    return (
      <div className="space-y-6">
        <Link href="/app/crm/forms" className="btn-secondary inline-flex text-sm">
          <ArrowLeft className="h-4 w-4" />
          Back to forms
        </Link>
        <AlertBanner
          title="Form preview could not be loaded"
          description={loadError || "The backend did not return this form."}
          variant="warning"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/app/crm/forms" className="btn-secondary text-sm">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <button
          type="button"
          onClick={() => router.push(`/app/crm/forms/builder?id=${form.id}`)}
          className="btn-secondary text-sm"
        >
          Edit
        </button>
      </div>

      {submitMessage && (
        <AlertBanner icon={CheckCircle} title={submitMessage} variant="success" />
      )}
      {submitError && (
        <AlertBanner
          title="Form submission failed"
          description={submitError}
          variant="warning"
        />
      )}

      <Card padding="p-5 sm:p-7">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#111111]">{form.name}</h1>
          <p className="mt-1 text-sm text-[#6B7280]">{form.type}</p>
        </div>

        <div className="space-y-4">
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
                  onChange={(event) => updateValue(field.id, event.target.value)}
                  className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-4 py-3 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]"
                />
              ) : field.type === "select" ? (
                <select
                  id={fieldControlId(field)}
                  name={payloadKey(field)}
                  value={String(values[field.id] || "")}
                  onChange={(event) => updateValue(field.id, event.target.value)}
                  className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-4 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]"
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
                  onChange={(event) => updateValue(field.id, event.target.checked)}
                  className="h-4 w-4 rounded accent-[#6E6AE8]"
                />
              ) : (
                <input
                  id={fieldControlId(field)}
                  name={payloadKey(field)}
                  autoComplete={fieldAutocomplete(field)}
                  type={field.type === "phone" ? "tel" : field.type}
                  value={String(values[field.id] || "")}
                  onChange={(event) => updateValue(field.id, event.target.value)}
                  className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-4 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]"
                />
              )}
            </label>
          ))}

          <div>
            <label
              htmlFor="form-preview-public-api-key"
              className="mb-1.5 block text-sm font-medium text-[#111111]"
            >
              Public API key
            </label>
            <input
              id="form-preview-public-api-key"
              name="publicApiKey"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-4 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-[#6E6AE8] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#5A56D4] disabled:opacity-60"
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
  );
}
