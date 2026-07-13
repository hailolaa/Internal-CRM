"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Loader2, Save } from "lucide-react";
import { useCallback, useState } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

type FieldKey =
  | "clinicName"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "website"
  | "street"
  | "city"
  | "county"
  | "postcode"
  | "status"
  | "source"
  | "packageInterest"
  | "value"
  | "notes";

const TAG_OPTIONS = [
  "Website",
  "SEO",
  "Google Ads",
  "Landing Page",
  "VIP",
  "High Intent",
];

const PACKAGE_OPTIONS = [
  "Website build",
  "SEO campaign",
  "Google Ads management",
  "Landing page build",
  "CRM onboarding",
  "Monthly reporting",
];

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isValidWebsite(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^https?:\/\/[^\s]+\.[^\s]+$/i.test(trimmed) || /^[^\s]+\.[^\s]{2,}$/i.test(trimmed);
}

function validateLeadFields(fields: Record<FieldKey, string>) {
  const hasIdentity =
    fields.clinicName.trim() ||
    fields.firstName.trim() ||
    fields.lastName.trim();
  const hasContactMethod =
    fields.email.trim() || fields.phone.trim();

  if (!hasIdentity) {
    return "Add a clinic/account name or a contact name.";
  }

  if (!hasContactMethod) {
    return "Add at least one contact method: email or phone.";
  }

  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    return "Enter a valid email address.";
  }

  if (fields.phone && !/^[\d\s+()-]{7,30}$/.test(fields.phone)) {
    return "Enter a valid phone number.";
  }

  if (!isValidWebsite(fields.website)) {
    return "Enter a valid website domain or URL.";
  }

  return "";
}

export default function NewContactPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [tags, setTags] = useState<string[]>([]);
  const [packageInterests, setPackageInterests] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );

  const [fields, setFields] = useState<Record<FieldKey, string>>({
    clinicName: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    website: "",
    street: "",
    city: "",
    county: "",
    postcode: "",
    status: "lead",
    source: "",
    packageInterest: "",
    value: "",
    notes: "",
  });

  const updateField = useCallback((name: FieldKey, value: string) => {
    setFields((prev) => ({ ...prev, [name]: value }));
  }, []);

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

    const validationMessage = validateLeadFields(fields);
    if (validationMessage) {
      setStatusMessage(validationMessage);
      return;
    }

    const value = Number(fields.value.replace(/[^\d.]/g, ""));
    const primaryPackage = fields.packageInterest.trim();
    const treatmentInterests = Array.from(
      new Set([primaryPackage, ...packageInterests].filter(Boolean)),
    );
    try {
      setSaveStatus("saving");
      setStatusMessage(null);
      const result = await api.contacts.create(session.token, {
        accountName: emptyToNull(fields.clinicName),
        firstName: emptyToNull(fields.firstName),
        lastName: emptyToNull(fields.lastName),
        email: emptyToNull(fields.email),
        phone: emptyToNull(fields.phone),
        website: emptyToNull(fields.website),
        address: emptyToNull(fields.street),
        city: emptyToNull(fields.city),
        state: emptyToNull(fields.county),
        postalCode: emptyToNull(fields.postcode),
        status: emptyToNull(fields.status),
        source: emptyToNull(fields.source),
        value: Number.isFinite(value) ? value : 0,
        packageInterest: emptyToNull(fields.packageInterest),
        recommendedPackage: emptyToNull(fields.packageInterest),
        notes: emptyToNull(fields.notes),
        tags,
        treatmentInterests,
      });
      setSaveStatus("saved");
      router.push(`/app/crm/contacts/detail?id=${result.contact.id}`);
    } catch (error) {
      console.error("Failed to create lead", error);
      setStatusMessage(error instanceof Error ? error.message : "Could not save lead.");
      setSaveStatus("idle");
    }
  };

  const inputBase =
    "w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[rgba(110,106,232,0.35)] focus:ring-2 focus:ring-[rgba(110,106,232,0.10)] transition-all";

  const selectBase =
    "w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.35)] focus:ring-2 focus:ring-[rgba(110,106,232,0.10)] transition-all";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/app/leads"
          className="p-2 rounded-[14px] transition-colors hover:bg-[rgba(110,106,232,0.08)]"
          style={{
            backgroundColor: "#FFFCF9",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#111111]">Add Lead</h1>
          <p className="text-[#6B7280] text-sm">
            Create a manual lead from phone, WhatsApp, email, referral, or direct conversation.
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
        >
          {saveStatus === "saving" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Saving...
            </>
          ) : saveStatus === "saved" ? (
            <>
              <CheckCircle className="w-4 h-4" /> Saved
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> Save Lead
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
        <div className="lg:col-span-2 space-y-5">
          <div
            className="rounded-[24px] p-6"
            style={{
              backgroundColor: "#FFFCF9",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
            }}
          >
            <h2 className="font-semibold text-[#111111] mb-5">Lead Identity</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Clinic / Account Name
                </label>
                <input
                  type="text"
                  value={fields.clinicName}
                  onChange={handleInputChange("clinicName")}
                  placeholder="Bright Smile Dental"
                  className={inputBase}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Contact First Name
                </label>
                <input
                  type="text"
                  value={fields.firstName}
                  onChange={handleInputChange("firstName")}
                  placeholder="Sarah"
                  className={inputBase}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Contact Last Name
                </label>
                <input
                  type="text"
                  value={fields.lastName}
                  onChange={handleInputChange("lastName")}
                  placeholder="Johnson"
                  className={inputBase}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={fields.email}
                  onChange={handleInputChange("email")}
                  placeholder="sarah@example.com"
                  className={inputBase}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Phone / WhatsApp
                </label>
                <input
                  type="tel"
                  value={fields.phone}
                  onChange={handleInputChange("phone")}
                  placeholder="07700 900123"
                  className={inputBase}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Website
                </label>
                <input
                  type="text"
                  value={fields.website}
                  onChange={handleInputChange("website")}
                  placeholder="exampleclinic.com"
                  className={inputBase}
                />
              </div>
            </div>
          </div>

          <div
            className="rounded-[24px] p-6"
            style={{
              backgroundColor: "#FFFCF9",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
            }}
          >
            <h2 className="font-semibold text-[#111111] mb-5">Location</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Street / Location
                </label>
                <input
                  type="text"
                  value={fields.street}
                  onChange={handleInputChange("street")}
                  placeholder="London"
                  className={inputBase}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    County / Region
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

          <div
            className="rounded-[24px] p-6"
            style={{
              backgroundColor: "#FFFCF9",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
            }}
          >
            <h2 className="font-semibold text-[#111111] mb-5">Lead Notes</h2>
            <textarea
              rows={4}
              value={fields.notes}
              onChange={handleInputChange("notes")}
              placeholder="Add context from the call, WhatsApp message, email, or referral..."
              className={`${inputBase} resize-none`}
            />
          </div>
        </div>

        <div className="lg:col-span-1 space-y-5">
          <div
            className="rounded-[24px] p-6"
            style={{
              backgroundColor: "#FFFCF9",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
            }}
          >
            <h2 className="font-semibold text-[#111111] mb-5">Status & Source</h2>
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
                  <option value="lead">Lead</option>
                  <option value="prospect">Prospect</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
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
                  <option value="phone">Phone</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="referral">Referral</option>
                  <option value="direct">Direct conversation</option>
                  <option value="website">Website</option>
                  <option value="google">Google Ads</option>
                  <option value="meta">Meta Ads</option>
                  <option value="instagram">Instagram</option>
                  <option value="outbound">Outbound</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Package Interest
                </label>
                <select
                  value={fields.packageInterest}
                  onChange={handleSelectChange("packageInterest")}
                  className={selectBase}
                >
                  <option value="">Select package</option>
                  {PACKAGE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value="Other">Other</option>
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
              {TAG_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setTags(
                      tags.includes(tag)
                        ? tags.filter((item) => item !== tag)
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
                  const tag = customTag.trim();
                  setTags((items) => (items.includes(tag) ? items : [...items, tag]));
                  setCustomTag("");
                }
              }}
              className={inputBase}
            />
          </div>

          <div
            className="rounded-[24px] p-6"
            style={{
              backgroundColor: "#FFFCF9",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
            }}
          >
            <h2 className="font-semibold text-[#111111] mb-5">
              Additional Interests
            </h2>
            <div className="space-y-1">
              {PACKAGE_OPTIONS.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-3 p-2.5 rounded-[12px] cursor-pointer transition-colors hover:bg-[rgba(110,106,232,0.04)]"
                >
                  <input
                    type="checkbox"
                    checked={packageInterests.includes(option)}
                    onChange={() =>
                      setPackageInterests((items) =>
                        items.includes(option)
                          ? items.filter((item) => item !== option)
                          : [...items, option],
                      )
                    }
                    className="w-4 h-4 rounded"
                    style={{ accentColor: "#6E6AE8" }}
                  />
                  <span className="text-sm text-[#111111]">{option}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
