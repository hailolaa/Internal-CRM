"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Save,
  GripVertical,
  Type,
  Mail,
  Phone,
  Calendar,
  CheckSquare,
  List,
  FileText,
  Trash2,
  Eye,
  Loader2,
} from "lucide-react";
import type { ComponentType, CSSProperties } from "react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { FormDefinitionRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

type BuilderFieldType =
  | "text"
  | "email"
  | "phone"
  | "date"
  | "checkbox"
  | "select"
  | "textarea";

type BuilderField = {
  id: string;
  type: BuilderFieldType;
  label: string;
  required: boolean;
  options?: string[];
  position?: number;
  settings?: FormBuilderSettings;
};

type FormBuilderSettings = {
  addToPipeline?: boolean;
  redirectUrl?: string | null;
  sendNotificationEmail?: boolean;
  submitText?: string;
  successMessage?: string;
};

const fieldTypes: Array<{
  type: BuilderFieldType;
  label: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
}> = [
  { type: "text", label: "Text", icon: Type },
  { type: "email", label: "Email", icon: Mail },
  { type: "phone", label: "Phone", icon: Phone },
  { type: "date", label: "Date", icon: Calendar },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "select", label: "Dropdown", icon: List },
  { type: "textarea", label: "Long Text", icon: FileText },
];

const initialFields: BuilderField[] = [
  { id: "1", type: "text", label: "Full Name", required: true },
  { id: "2", type: "email", label: "Email Address", required: true },
  { id: "3", type: "phone", label: "Phone Number", required: false },
  {
    id: "4",
    type: "select",
    label: "Service / Package Interest",
    required: true,
    options: ["Botox", "Dermal filler", "Laser", "Consultation"],
  },
  { id: "5", type: "textarea", label: "Message", required: false },
];

function isBuilderFieldType(value: unknown): value is BuilderFieldType {
  return fieldTypes.some((field) => field.type === value);
}

function toBuilderFields(fields: unknown[]) {
  const parsed = fields
    .map((item, index) => {
      const value = item as Partial<BuilderField>;
      return {
        id: String(value.id || `field-${index + 1}`),
        type: isBuilderFieldType(value.type) ? value.type : "text",
        label: String(value.label || `Field ${index + 1}`),
        required: Boolean(value.required),
        options: Array.isArray(value.options)
          ? value.options.map((option) => String(option))
          : undefined,
        position:
          typeof value.position === "number" ? value.position : index + 1,
        settings: value.settings,
      };
    })
    .sort((left, right) => (left.position || 0) - (right.position || 0));

  return parsed.length ? parsed : initialFields;
}

export default function FormBuilderPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [editingFormId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("id") || "",
  );
  const isEditMode = Boolean(editingFormId);
  const [fields, setFields] = useState(initialFields);
  const [formName, setFormName] = useState("New Prospect Capture Form");
  const [formType, setFormType] = useState("lead_capture");
  const [formStatus, setFormStatus] =
    useState<FormDefinitionRecord["status"]>("draft");
  const [submitText, setSubmitText] = useState("Submit Enquiry");
  const [successMessage, setSuccessMessage] = useState(
    "Thank you! We will be in touch soon.",
  );
  const [redirectUrl, setRedirectUrl] = useState("");
  const [sendNotificationEmail, setSendNotificationEmail] = useState(true);
  const [addToPipeline, setAddToPipeline] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoadingForm, setIsLoadingForm] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!session?.token || !editingFormId) return;

    let isMounted = true;
    api.forms
      .list(session.token)
      .then((records) => {
        if (!isMounted) return;
        const form = records.find((item) => item.id === editingFormId);
        if (!form) {
          setStatusMessage("Form could not be found.");
          return;
        }

        const loadedFields = toBuilderFields(form.fields);
        const settings = loadedFields[0]?.settings || {};
        setFields(loadedFields);
        setFormName(form.name);
        setFormType(form.type);
        setFormStatus(form.status);
        setSubmitText(settings.submitText || "Submit Enquiry");
        setSuccessMessage(
          settings.successMessage || "Thank you! We will be in touch soon.",
        );
        setRedirectUrl(settings.redirectUrl || "");
        setSendNotificationEmail(settings.sendNotificationEmail !== false);
        setAddToPipeline(settings.addToPipeline !== false);
        setStatusMessage(null);
      })
      .catch((error) => {
        if (!isMounted) return;
        setStatusMessage(
          error instanceof Error ? error.message : "Could not load form.",
        );
      })
      .finally(() => {
        if (isMounted) setIsLoadingForm(false);
      });

    return () => {
      isMounted = false;
    };
  }, [editingFormId, session?.token]);

  const addField = (type: BuilderFieldType) => {
    const fieldType = fieldTypes.find((field) => field.type === type);
    setFields((current) => [
      ...current,
      {
        id: `field-${Date.now()}`,
        type,
        label: fieldType?.label || "New Field",
        required: false,
        options:
          type === "select"
            ? ["Option 1", "Option 2", "Option 3"]
            : undefined,
      },
    ]);
  };

  const updateField = (fieldId: string, patch: Partial<BuilderField>) => {
    setFields((current) =>
      current.map((field) =>
        field.id === fieldId ? { ...field, ...patch } : field,
      ),
    );
  };

  const removeField = (fieldId: string) => {
    setFields((current) => current.filter((field) => field.id !== fieldId));
  };

  const moveField = (fieldId: string, direction: -1 | 1) => {
    setFields((current) => {
      const index = current.findIndex((field) => field.id === fieldId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSave = async (
    status: FormDefinitionRecord["status"] = "draft",
  ) => {
    if (!session?.token) {
      setStatusMessage("Sign in to save forms.");
      return;
    }

    if (!formName.trim()) {
      setStatusMessage("Add a form name before saving.");
      return;
    }

    if (!fields.length) {
      setStatusMessage("Add at least one field before saving.");
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const payload = {
        name: formName.trim(),
        type: formType,
        status,
        fields: fields.map((field, index) => ({
          ...field,
          position: index + 1,
          settings: {
            submitText,
            successMessage,
            redirectUrl: redirectUrl.trim() || null,
            sendNotificationEmail,
            addToPipeline,
          },
        })),
      };

      if (isEditMode) {
        await api.forms.update(session.token, editingFormId, payload);
      } else {
        await api.forms.create(session.token, payload);
      }
      router.push("/app/crm/forms");
    } catch (error) {
      console.error("Failed to save form", error);
      setStatusMessage(
        error instanceof Error ? error.message : "Could not save form.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="space-y-6"
      style={{ background: "#FAF8F5", minHeight: "100%" }}
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/app/crm/forms"
          className="p-2 rounded-xl transition-colors"
          style={{ background: "rgba(0,0,0,0.04)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(0,0,0,0.08)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "rgba(0,0,0,0.04)")
          }
        >
          <ArrowLeft className="w-5 h-5" style={{ color: "#6B7280" }} />
        </Link>
        <div className="flex-1">
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="text-2xl font-bold bg-transparent border-none focus:outline-none"
            style={{ color: "#111111" }}
          />
          <p className="text-sm" style={{ color: "#6B7280" }}>
            {isEditMode ? "Edit saved fields and settings" : "Drag fields to reorder"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            aria-label="Preview form"
            onClick={() => {
              if (isEditMode) {
                router.push(`/app/crm/forms/preview?id=${editingFormId}`);
                return;
              }
              setShowPreview((current) => !current);
            }}
            className="px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors"
            style={{
              background: "#FFFCF9",
              border: "1px solid rgba(0,0,0,0.06)",
              color: "#6B7280",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#FAF8F5")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFCF9")}
          >
            <Eye className="w-4 h-4" /> Preview
          </button>
          <button
            onClick={() => handleSave(isEditMode ? formStatus : "draft")}
            disabled={isSaving || isLoadingForm}
            className="px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors"
            style={{
              background: "#6E6AE8",
              color: "#FFFFFF",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#5A56D4")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#6E6AE8")}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? "Saving..." : isEditMode ? "Save Changes" : "Save Form"}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      {isLoadingForm && (
        <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] px-4 py-3 text-sm text-[#6B7280]">
          Loading form details...
        </div>
      )}

      {showPreview && (
        <div
          className="rounded-[24px] p-6"
          style={{
            background: "#FFFCF9",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}
        >
          <h2 className="font-semibold mb-4" style={{ color: "#111111" }}>
            {formName}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((field) => (
              <label
                key={field.id}
                className={field.type === "textarea" ? "md:col-span-2" : ""}
              >
                <span className="text-sm" style={{ color: "#6B7280" }}>
                  {field.label}
                  {field.required && <span className="text-red-400"> *</span>}
                </span>
                {field.type === "textarea" ? (
                  <textarea
                    disabled
                    rows={3}
                    className="mt-1 w-full rounded-xl px-3 py-2 text-sm"
                    style={{
                      background: "#FAF8F5",
                      border: "1px solid rgba(0,0,0,0.06)",
                    }}
                  />
                ) : field.type === "select" ? (
                  <select
                    disabled
                    className="mt-1 w-full rounded-xl px-3 py-2 text-sm"
                    style={{
                      background: "#FAF8F5",
                      border: "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    {(field.options || []).map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    disabled
                    type={field.type === "phone" ? "tel" : field.type}
                    className="mt-1 w-full rounded-xl px-3 py-2 text-sm"
                    style={{
                      background: "#FAF8F5",
                      border: "1px solid rgba(0,0,0,0.06)",
                    }}
                  />
                )}
              </label>
            ))}
          </div>
          <button
            onClick={() => handleSave("active")}
            disabled={isSaving}
            className="mt-4 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "#6E6AE8", color: "#FFFFFF" }}
          >
            {submitText}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Add Fields Panel */}
        <div className="lg:col-span-1">
          <div
            className="rounded-[24px] p-4"
            style={{
              background: "#FFFCF9",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <h3
              className="font-semibold mb-3 text-sm"
              style={{ color: "#111111" }}
            >
              Add Fields
            </h3>
            <div className="space-y-2">
              {fieldTypes.map((field) => (
                <button
                  key={field.type}
                  onClick={() => addField(field.type)}
                  className="w-full p-3 rounded-xl flex items-center gap-3 transition-all text-sm"
                  style={{
                    background: "#FAF8F5",
                    border: "1px solid rgba(0,0,0,0.06)",
                    color: "#111111",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(110,106,232,0.08)";
                    e.currentTarget.style.borderColor = "rgba(110,106,232,0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#FAF8F5";
                    e.currentTarget.style.borderColor = "rgba(0,0,0,0.06)";
                  }}
                >
                  <field.icon
                    className="w-4 h-4"
                    style={{ color: "#6B7280" }}
                  />
                  <span>{field.label}</span>
                  <Plus
                    className="w-4 h-4 ml-auto"
                    style={{ color: "#6B7280" }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Form Fields Canvas */}
        <div className="lg:col-span-2">
          <div
            className="rounded-[24px] p-6"
            style={{
              background: "#FFFCF9",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <h3 className="font-semibold mb-4" style={{ color: "#111111" }}>
              Form Fields
            </h3>
            <div className="space-y-3">
              {fields.map((field) => (
                <div
                  key={field.id}
                  className="p-4 rounded-xl group transition-all"
                  style={{
                    background: "#FAF8F5",
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor =
                      "rgba(110,106,232,0.3)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor =
                      "rgba(0,0,0,0.06)";
                  }}
                >
                  <div className="flex items-center gap-3">
                    <GripVertical
                      className="w-4 h-4 cursor-grab"
                      style={{ color: "#6B7280" }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <input
                          value={field.label}
                          onChange={(event) =>
                            updateField(field.id, {
                              label: event.target.value,
                            })
                          }
                          className="font-medium text-sm bg-transparent border-none focus:outline-none"
                          style={{ color: "#111111" }}
                        />
                        {field.required && (
                          <span className="text-xs text-red-400">*</span>
                        )}
                      </div>
                      <span
                        className="text-xs capitalize"
                        style={{ color: "#6B7280" }}
                      >
                        {field.type} field
                      </span>
                    </div>
                    <button
                      aria-label={`Move ${field.label} field up`}
                      onClick={() => moveField(field.id, -1)}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      style={{ background: "rgba(0,0,0,0.04)" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(110,106,232,0.08)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "rgba(0,0,0,0.04)")
                      }
                    >
                      <GripVertical
                        className="w-4 h-4"
                        style={{ color: "#6B7280" }}
                      />
                    </button>
                    <label className="flex items-center gap-1 text-xs opacity-0 group-hover:opacity-100">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(event) =>
                          updateField(field.id, {
                            required: event.target.checked,
                          })
                        }
                        className="accent-[#6E6AE8]"
                      />
                      Required
                    </label>
                    <button
                      aria-label={`Delete ${field.label} field`}
                      onClick={() => removeField(field.id)}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      style={{ background: "rgba(0,0,0,0.04)" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(239,68,68,0.08)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "rgba(0,0,0,0.04)")
                      }
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => addField("text")}
                className="w-full p-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-sm transition-all"
                style={{
                  borderColor: "rgba(0,0,0,0.10)",
                  color: "#6B7280",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(110,106,232,0.4)";
                  e.currentTarget.style.color = "#6E6AE8";
                  e.currentTarget.style.background = "rgba(110,106,232,0.04)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(0,0,0,0.10)";
                  e.currentTarget.style.color = "#6B7280";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <Plus className="w-4 h-4" /> Add Field
              </button>
            </div>
          </div>
        </div>

        {/* Form Settings Panel */}
        <div className="lg:col-span-1">
          <div
            className="rounded-[24px] p-4"
            style={{
              background: "#FFFCF9",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <h3
              className="font-semibold mb-3 text-sm"
              style={{ color: "#111111" }}
            >
              Form Settings
            </h3>
            <div className="space-y-4">
              <div>
                <label
                  className="text-xs mb-1 block"
                  style={{ color: "#6B7280" }}
                >
                  Form Type
                </label>
                <input
                  type="text"
                  value={formType}
                  onChange={(event) => setFormType(event.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none transition-colors"
                  style={{
                    background: "#FAF8F5",
                    border: "1px solid rgba(0,0,0,0.06)",
                    color: "#111111",
                  }}
                />
              </div>
              <div>
                <label
                  className="text-xs mb-1 block"
                  style={{ color: "#6B7280" }}
                >
                  Status
                </label>
                <select
                  value={formStatus}
                  onChange={(event) =>
                    setFormStatus(
                      event.target.value as FormDefinitionRecord["status"],
                    )
                  }
                  className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none transition-colors"
                  style={{
                    background: "#FAF8F5",
                    border: "1px solid rgba(0,0,0,0.06)",
                    color: "#111111",
                  }}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label
                  className="text-xs mb-1 block"
                  style={{ color: "#6B7280" }}
                >
                  Submit Button Text
                </label>
                <input
                  type="text"
                  value={submitText}
                  onChange={(event) => setSubmitText(event.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none transition-colors"
                  style={{
                    background: "#FAF8F5",
                    border: "1px solid rgba(0,0,0,0.06)",
                    color: "#111111",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor =
                      "rgba(110,106,232,0.4)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(0,0,0,0.06)")
                  }
                />
              </div>
              <div>
                <label
                  className="text-xs mb-1 block"
                  style={{ color: "#6B7280" }}
                >
                  Success Message
                </label>
                <textarea
                  rows={2}
                  value={successMessage}
                  onChange={(event) => setSuccessMessage(event.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm resize-none focus:outline-none transition-colors"
                  style={{
                    background: "#FAF8F5",
                    border: "1px solid rgba(0,0,0,0.06)",
                    color: "#111111",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor =
                      "rgba(110,106,232,0.4)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(0,0,0,0.06)")
                  }
                />
              </div>
              <div>
                <label
                  className="text-xs mb-1 block"
                  style={{ color: "#6B7280" }}
                >
                  Redirect URL (optional)
                </label>
                <input
                  type="url"
                  value={redirectUrl}
                  onChange={(event) => setRedirectUrl(event.target.value)}
                  placeholder="https://"
                  className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none transition-colors"
                  style={{
                    background: "#FAF8F5",
                    border: "1px solid rgba(0,0,0,0.06)",
                    color: "#111111",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor =
                      "rgba(110,106,232,0.4)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(0,0,0,0.06)")
                  }
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm" style={{ color: "#111111" }}>
                  Send notification email
                </span>
                <button
                  aria-label="Toggle send notification email (currently on)"
                  onClick={() =>
                    setSendNotificationEmail((current) => !current)
                  }
                  className="w-10 h-5 rounded-full relative cursor-pointer transition-colors"
                  style={{
                    background: sendNotificationEmail ? "#6E6AE8" : "#D1D5DB",
                  }}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full absolute top-0.5 ${
                      sendNotificationEmail ? "right-0.5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm" style={{ color: "#111111" }}>
                  Add to pipeline
                </span>
                <button
                  aria-label="Toggle add to pipeline (currently on)"
                  onClick={() => setAddToPipeline((current) => !current)}
                  className="w-10 h-5 rounded-full relative cursor-pointer transition-colors"
                  style={{ background: addToPipeline ? "#6E6AE8" : "#D1D5DB" }}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full absolute top-0.5 ${
                      addToPipeline ? "right-0.5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
