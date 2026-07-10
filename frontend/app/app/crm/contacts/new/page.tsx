"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, CheckCircle } from "lucide-react";
import { useState, useCallback } from "react";
import { ValidatedInput } from "@/components/ui/table-controls";
import { useFormValidation, contactFormSchema } from "@/hooks/use-validation";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

type FieldKey =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "street"
  | "city"
  | "county"
  | "postcode"
  | "status"
  | "source"
  | "value"
  | "notes";

export default function NewContactPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [tags, setTags] = useState<string[]>([]);
  const [treatmentInterests, setTreatmentInterests] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );

  const [fields, setFields] = useState<Record<FieldKey, string>>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    street: "",
    city: "",
    county: "",
    postcode: "",
    status: "prospect",
    source: "",
    value: "",
    notes: "",
  });

  const {
    getFieldError,
    validateFieldOnBlur,
    validateFieldOnChange,
    validateAll,
  } = useFormValidation(contactFormSchema);

  const updateField = useCallback((name: FieldKey, value: string) => {
    setFields((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleFieldChange = (name: FieldKey) => (value: string) => {
    updateField(name, value);
    validateFieldOnChange(name, value, fields);
  };

  const handleBlur = (name: FieldKey) => () => {
    validateFieldOnBlur(name, fields[name], fields);
  };

  const handleSelectChange =
    (name: FieldKey) => (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateField(name, e.target.value);
    };

  const handleInputChange =
    (name: FieldKey) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      updateField(name, e.target.value);
    };

  const handleSave = async () => {
    if (!session?.token) return;
    const isValid = validateAll(fields);
    if (!isValid) return;

    const value = Number(fields.value.replace(/[^\d.]/g, ""));

    try {
      setSaveStatus("saving");
      await api.contacts.create(session.token, {
        firstName: fields.firstName,
        lastName: fields.lastName,
        email: fields.email || null,
        phone: fields.phone || null,
        address: fields.street || null,
        city: fields.city || null,
        state: fields.county || null,
        postalCode: fields.postcode || null,
        status: fields.status,
        source: fields.source || null,
        value: Number.isFinite(value) ? value : 0,
        notes: fields.notes || null,
        tags,
        treatmentInterests,
      });
      setSaveStatus("saved");
      router.push("/app/crm/contacts");
    } catch (error) {
      console.error("Failed to create contact", error);
      setStatusMessage("Could not save contact.");
      setSaveStatus("idle");
    }
  };

  const inputBase =
    "w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[rgba(110,106,232,0.35)] focus:ring-2 focus:ring-[rgba(110,106,232,0.10)] transition-all";

  const selectBase =
    "w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.35)] focus:ring-2 focus:ring-[rgba(110,106,232,0.10)] transition-all";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/app/crm/contacts"
          className="p-2 rounded-[14px] transition-colors hover:bg-[rgba(110,106,232,0.08)]"
          style={{
            backgroundColor: "#FFFCF9",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#111111]">Add New Contact</h1>
          <p className="text-[#6B7280] text-sm">
            Create a new prospect, client contact, or account stakeholder
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saveStatus !== "idle"}
          className="font-semibold px-4 py-2.5 rounded-[14px] flex items-center gap-2 disabled:opacity-50 transition-all text-white text-sm"
          style={{
            backgroundColor: "#6E6AE8",
            boxShadow: "0 2px 8px rgba(110,106,232,0.25)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "#5A56D4";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "#6E6AE8";
          }}
        >
          {saveStatus === "saving" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Saving...
            </>
          ) : saveStatus === "saved" ? (
            <>
              <CheckCircle className="w-4 h-4" /> Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> Save Contact
            </>
          )}
        </button>
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Basic Information */}
          <div
            className="rounded-[24px] p-6"
            style={{
              backgroundColor: "#FFFCF9",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
            }}
          >
            <h2 className="font-semibold text-[#111111] mb-5">
              Basic Information
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <ValidatedInput
                label="First Name"
                value={fields.firstName}
                onChange={handleFieldChange("firstName")}
                onBlur={handleBlur("firstName")}
                error={getFieldError("firstName")}
                placeholder="Sarah"
                required
              />
              <ValidatedInput
                label="Last Name"
                value={fields.lastName}
                onChange={handleFieldChange("lastName")}
                onBlur={handleBlur("lastName")}
                error={getFieldError("lastName")}
                placeholder="Johnson"
                required
              />
              <ValidatedInput
                label="Email"
                value={fields.email}
                onChange={handleFieldChange("email")}
                onBlur={handleBlur("email")}
                error={getFieldError("email")}
                placeholder="sarah@email.com"
                type="email"
                required
              />
              <ValidatedInput
                label="Phone"
                value={fields.phone}
                onChange={handleFieldChange("phone")}
                onBlur={handleBlur("phone")}
                error={getFieldError("phone")}
                placeholder="07700 900123"
                type="tel"
              />
            </div>
          </div>

          {/* Address */}
          <div
            className="rounded-[24px] p-6"
            style={{
              backgroundColor: "#FFFCF9",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
            }}
          >
            <h2 className="font-semibold text-[#111111] mb-5">Address</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Street Address
                </label>
                <input
                  type="text"
                  value={fields.street}
                  onChange={handleInputChange("street")}
                  placeholder="123 High Street"
                  className={inputBase}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#111111] mb-1.5">
                    City
                  </label>
                  <input
                    type="text"
                    value={fields.city}
                    onChange={handleInputChange("city")}
                    placeholder="London"
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#111111] mb-1.5">
                    County
                  </label>
                  <input
                    type="text"
                    value={fields.county}
                    onChange={handleInputChange("county")}
                    placeholder="Greater London"
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#111111] mb-1.5">
                    Postcode
                  </label>
                  <input
                    type="text"
                    value={fields.postcode}
                    onChange={handleInputChange("postcode")}
                    placeholder="W1 2AB"
                    className={inputBase}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div
            className="rounded-[24px] p-6"
            style={{
              backgroundColor: "#FFFCF9",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
            }}
          >
            <h2 className="font-semibold text-[#111111] mb-5">Notes</h2>
            <textarea
              rows={4}
              value={fields.notes}
              onChange={handleInputChange("notes")}
              placeholder="Add any notes about this contact..."
              className={`${inputBase} resize-none`}
            />
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-1 space-y-5">
          {/* Status & Source */}
          <div
            className="rounded-[24px] p-6"
            style={{
              backgroundColor: "#FFFCF9",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
            }}
          >
            <h2 className="font-semibold text-[#111111] mb-5">
              Status & Source
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Status
                </label>
                <select
                  value={fields.status}
                  onChange={handleSelectChange("status")}
                  className={selectBase}
                >
                  <option value="prospect">Prospect</option>
                  <option value="discovery_call_booked">Discovery Call Booked</option>
                  <option value="proposal_sent">Proposal Sent</option>
                  <option value="client">Client</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Source
                </label>
                <select
                  value={fields.source}
                  onChange={handleSelectChange("source")}
                  className={selectBase}
                >
                  <option value="">Select source</option>
                  <option value="google">Google Ads</option>
                  <option value="meta">Meta Ads</option>
                  <option value="instagram">Instagram</option>
                  <option value="referral">Referral</option>
                  <option value="website">Website</option>
                  <option value="outbound">Outbound</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Estimated Value
                </label>
                <input
                  type="text"
                  value={fields.value}
                  onChange={handleInputChange("value")}
                  placeholder="GBP 350"
                  className={inputBase}
                />
              </div>
            </div>
          </div>

          {/* Tags */}
          <div
            className="rounded-[24px] p-6"
            style={{
              backgroundColor: "#FFFCF9",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
            }}
          >
            <h2 className="font-semibold text-[#111111] mb-5">Tags</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                "Website",
                "SEO",
                "Google Ads",
                "Landing Page",
                "VIP",
                "High Intent",
              ].map((tag) => (
                <button
                  key={tag}
                  onClick={() =>
                    setTags(
                      tags.includes(tag)
                        ? tags.filter((t) => t !== tag)
                        : [...tags, tag],
                    )
                  }
                  className="text-xs px-3 py-1.5 rounded-full transition-all font-medium"
                  style={
                    tags.includes(tag)
                      ? {
                          backgroundColor: "rgba(110,106,232,0.10)",
                          color: "#6E6AE8",
                          border: "1px solid rgba(110,106,232,0.30)",
                        }
                      : {
                          backgroundColor: "#FAF8F5",
                          color: "#6B7280",
                          border: "1px solid rgba(0,0,0,0.06)",
                        }
                  }
                >
                  {tag}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Add custom tag..."
              value={customTag}
              onChange={(event) => setCustomTag(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && customTag.trim()) {
                  event.preventDefault();
                  setTags((items) =>
                    items.includes(customTag.trim())
                      ? items
                      : [...items, customTag.trim()],
                  );
                  setCustomTag("");
                }
              }}
              className={inputBase}
            />
          </div>

          {/* Service / Package Interest */}
          <div
            className="rounded-[24px] p-6"
            style={{
              backgroundColor: "#FFFCF9",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
            }}
          >
            <h2 className="font-semibold text-[#111111] mb-5">
              Service / Package Interest
            </h2>
            <div className="space-y-1">
              {[
                "Website build",
                "SEO campaign",
                "Google Ads management",
                "Landing page build",
                "CRM onboarding",
                "Monthly reporting",
              ].map((treatment) => (
                <label
                  key={treatment}
                  className="flex items-center gap-3 p-2.5 rounded-[12px] cursor-pointer transition-colors hover:bg-[rgba(110,106,232,0.04)]"
                >
                  <input
                    type="checkbox"
                    checked={treatmentInterests.includes(treatment)}
                    onChange={() =>
                      setTreatmentInterests((items) =>
                        items.includes(treatment)
                          ? items.filter((item) => item !== treatment)
                          : [...items, treatment],
                      )
                    }
                    className="w-4 h-4 rounded"
                    style={{ accentColor: "#6E6AE8" }}
                  />
                  <span className="text-sm text-[#111111]">{treatment}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
