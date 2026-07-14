"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  Save,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertBanner, Card, SkeletonLine } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { ContactRecord, ContactUpdatePayload } from "@/lib/api-types";

type FieldKey =
  | "clinicName"
  | "role"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "roleTitle"
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
  "Website build",
  "SEO",
  "Ads",
  "Tracking",
  "Client",
  "High Intent",
];

const TREATMENT_OPTIONS = [
  "Website build",
  "SEO campaign",
  "Google Ads management",
  "Landing page build",
  "CRM onboarding",
  "Monthly reporting",
];

function isValidWebsite(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^https?:\/\/[^\s]+\.[^\s]+$/i.test(trimmed) || /^[^\s]+\.[^\s]{2,}$/i.test(trimmed);
}

function toFields(contact: ContactRecord): Record<FieldKey, string> {
  return {
    clinicName: contact.accountName || "",
    role: contact.role || "",
    firstName: contact.firstName || "",
    lastName: contact.lastName || "",
    email: contact.email || "",
    phone: contact.phone || "",
    roleTitle: contact.roleTitle || "",
    website: contact.website || "",
    street: contact.address || "",
    city: contact.city || "",
    county: contact.state || "",
    postcode: contact.postalCode || "",
    status: contact.status || "lead",
    source: contact.source || "",
    packageInterest:
      contact.packageInterest ||
      contact.recommendedPackage ||
      contact.treatmentInterests?.[0] ||
      "",
    value: contact.value ? String(contact.value) : "",
    notes: contact.notes || "",
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function validateFields(fields: Record<FieldKey, string>) {
  const hasIdentity =
    fields.clinicName.trim() ||
    fields.firstName.trim() ||
    fields.lastName.trim();
  const hasContactMethod =
    fields.email.trim() || fields.phone.trim();

  if (!hasIdentity) {
    return "Add an account name or a contact name.";
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

export default function EditContactPage() {
  const router = useRouter();
  const [contactId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("id") || "",
  );
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const canWriteContacts = hasPermission("contacts:write");
  const [contact, setContact] = useState<ContactRecord | null>(null);
  const [fields, setFields] = useState<Record<FieldKey, string>>({
    clinicName: "",
    role: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    roleTitle: "",
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
  const [tags, setTags] = useState<string[]>([]);
  const [treatmentInterests, setTreatmentInterests] = useState<string[]>([]);
  const [communicationPermissions, setCommunicationPermissions] = useState({
    email: false,
    sms: false,
    whatsapp: false,
    phone: false,
  });
  const [customTag, setCustomTag] = useState("");
  const [loadError, setLoadError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );

  useEffect(() => {
    if (!token || !contactId) return;

    let mounted = true;
    api.contacts
      .get(token, contactId)
      .then((record) => {
        if (!mounted) return;
        setContact(record);
        setFields(toFields(record));
        setTags(record.tags || []);
        setTreatmentInterests(record.treatmentInterests || []);
        setCommunicationPermissions(record.communicationPermissions);
        setLoadError("");
      })
      .catch((error) => {
        if (!mounted) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load this contact from the backend.",
        );
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [contactId, token]);

  const allTagOptions = useMemo(
    () => Array.from(new Set([...TAG_OPTIONS, ...tags])).filter(Boolean),
    [tags],
  );

  const allTreatmentOptions = useMemo(
    () =>
      Array.from(new Set([...TREATMENT_OPTIONS, ...treatmentInterests])).filter(
        Boolean,
      ),
    [treatmentInterests],
  );

  const updateField = useCallback((name: FieldKey, value: string) => {
    setFields((current) => ({ ...current, [name]: value }));
  }, []);

  const handleInputChange =
    (name: FieldKey) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      updateField(name, event.target.value);
    };

  const handleSelectChange =
    (name: FieldKey) => (event: React.ChangeEvent<HTMLSelectElement>) => {
      updateField(name, event.target.value);
    };

  const toggleTag = useCallback((tag: string) => {
    setTags((items) =>
      items.includes(tag) ? items.filter((item) => item !== tag) : [...items, tag],
    );
  }, []);

  const toggleTreatment = useCallback((treatment: string) => {
    setTreatmentInterests((items) =>
      items.includes(treatment)
        ? items.filter((item) => item !== treatment)
        : [...items, treatment],
    );
  }, []);

  const handleSave = async () => {
    if (!token || !contactId || !canWriteContacts) return;

    const validationMessage = validateFields(fields);
    if (validationMessage) {
      setStatusMessage(validationMessage);
      return;
    }

    const value = Number(fields.value.replace(/[^\d.]/g, ""));
    const primaryPackage = fields.packageInterest.trim();
    const combinedPackageInterests = Array.from(
      new Set([primaryPackage, ...treatmentInterests].filter(Boolean)),
    );
    const payload: ContactUpdatePayload = {
      accountName: emptyToNull(fields.clinicName),
      role: emptyToNull(fields.role),
      communicationPermissions,
      firstName: emptyToNull(fields.firstName),
      lastName: emptyToNull(fields.lastName),
      email: emptyToNull(fields.email),
      phone: emptyToNull(fields.phone),
      roleTitle: emptyToNull(fields.roleTitle),
      emailPermission: communicationPermissions.email,
      phonePermission: communicationPermissions.phone,
      smsPermission: communicationPermissions.sms,
      whatsappPermission: communicationPermissions.whatsapp,
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
      treatmentInterests: combinedPackageInterests,
    };

    try {
      setSaveStatus("saving");
      setStatusMessage("");
      await api.contacts.update(token, contactId, payload);
      setSaveStatus("saved");
      router.push(`/app/crm/contacts/detail?id=${contactId}`);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not update contact.",
      );
      setSaveStatus("idle");
    }
  };

  const inputBase =
    "w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[rgba(110,106,232,0.35)] focus:ring-2 focus:ring-[rgba(110,106,232,0.10)] transition-all";

  const selectBase =
    "w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.35)] focus:ring-2 focus:ring-[rgba(110,106,232,0.10)] transition-all";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLine className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2" padding="p-6">
            <SkeletonLine className="h-8 w-48 mb-4" />
            <SkeletonLine className="h-4 w-full mb-2" />
            <SkeletonLine className="h-4 w-2/3" />
          </Card>
          <Card padding="p-6">
            <SkeletonLine className="h-8 w-32 mb-4" />
            <SkeletonLine className="h-4 w-full mb-2" />
            <SkeletonLine className="h-4 w-3/4" />
          </Card>
        </div>
      </div>
    );
  }

  if (loadError || !contact) {
    return (
      <div className="space-y-6">
        <Link href="/app/crm/contacts" className="btn-secondary inline-flex text-sm">
          <ArrowLeft className="h-4 w-4" />
          Back to contacts
        </Link>
        <AlertBanner
          title="Lead could not be loaded"
          description={loadError || "The backend did not return this lead."}
          variant="warning"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/app/crm/contacts/detail?id=${contactId}`}
            className="p-2 rounded-[14px] transition-colors hover:bg-[rgba(110,106,232,0.08)]"
            style={{
              backgroundColor: "#FFFCF9",
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#111111]">Edit Lead</h1>
            <p className="text-[#6B7280] text-sm">{contact.name}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/app/crm/contacts/detail?id=${contactId}`}
            className="btn-secondary text-sm"
          >
            <X className="w-4 h-4" />
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={!canWriteContacts || saveStatus !== "idle"}
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
      </div>

      {!canWriteContacts && (
        <AlertBanner
          title="Lead editing is unavailable"
          description="Your current role does not include contacts:write."
          variant="warning"
        />
      )}

      {statusMessage && (
        <AlertBanner
          title="Lead could not be saved"
          description={statusMessage}
          variant="warning"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <Card padding="p-6">
            <h2 className="font-semibold text-[#111111] mb-5">
              Lead Identity
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Account Name
                </label>
                <input
                  value={fields.clinicName}
                  onChange={handleInputChange("clinicName")}
                  placeholder="Growth-focused account"
                  className={inputBase}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Contact Role
                </label>
                <input
                  value={fields.roleTitle}
                  onChange={handleInputChange("roleTitle")}
                  placeholder="Owner, manager, marketing lead..."
                  className={inputBase}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Contact Role
                </label>
                <input
                  value={fields.role}
                  onChange={handleInputChange("role")}
                  placeholder="Practice owner, marketing manager, finance contact..."
                  className={inputBase}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Contact First Name
                </label>
                <input
                  value={fields.firstName}
                  onChange={handleInputChange("firstName")}
                  className={inputBase}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Contact Last Name
                </label>
                <input
                  value={fields.lastName}
                  onChange={handleInputChange("lastName")}
                  className={inputBase}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Email
                </label>
                <input
                  value={fields.email}
                  onChange={handleInputChange("email")}
                  type="email"
                  className={inputBase}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Phone / WhatsApp
                </label>
                <input
                  value={fields.phone}
                  onChange={handleInputChange("phone")}
                  type="tel"
                  className={inputBase}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Website
                </label>
                <input
                  value={fields.website}
                  onChange={handleInputChange("website")}
                  placeholder="exampleclinic.com"
                  className={inputBase}
                />
              </div>
            </div>
          </Card>

          <Card padding="p-6">
            <h2 className="font-semibold text-[#111111] mb-5">
              Communication Permissions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ["email", "Email allowed"],
                ["phone", "Phone allowed"],
                ["sms", "SMS allowed"],
                ["whatsapp", "WhatsApp allowed"],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-3 rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-4 py-3 text-sm font-medium text-[#151f21]"
                >
                  <input
                    type="checkbox"
                    checked={communicationPermissions[key as keyof typeof communicationPermissions]}
                    onChange={(event) =>
                      setCommunicationPermissions((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-[#D8D1C8] text-[#6E6AE8]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </Card>

          <Card padding="p-6">
            <h2 className="font-semibold text-[#111111] mb-5">Location</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Street / Location
                </label>
                <input
                  value={fields.street}
                  onChange={handleInputChange("street")}
                  className={inputBase}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#111111] mb-1.5">
                    City
                  </label>
                  <input
                    value={fields.city}
                    onChange={handleInputChange("city")}
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#111111] mb-1.5">
                    County / Region
                  </label>
                  <input
                    value={fields.county}
                    onChange={handleInputChange("county")}
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#111111] mb-1.5">
                    Postcode
                  </label>
                  <input
                    value={fields.postcode}
                    onChange={handleInputChange("postcode")}
                    className={inputBase}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card padding="p-6">
            <h2 className="font-semibold text-[#111111] mb-5">Lead Notes</h2>
            <textarea
              rows={5}
              value={fields.notes}
              onChange={handleInputChange("notes")}
              className={`${inputBase} resize-none`}
            />
          </Card>
        </div>

        <div className="space-y-5">
          <Card padding="p-6">
            <h2 className="font-semibold text-[#111111] mb-2">Communication Permissions</h2>
            <p className="mb-4 text-sm text-[#6B7280]">Only enable channels this contact has agreed to use.</p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(communicationPermissions).map(([channel, enabled]) => (
                <label key={channel} className="flex items-center gap-3 rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-3 text-sm font-medium capitalize text-[#111111]">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => setCommunicationPermissions((current) => ({ ...current, [channel]: event.target.checked }))}
                    className="h-4 w-4 accent-[#6E6AE8]"
                  />
                  {channel}
                </label>
              ))}
            </div>
          </Card>

          <Card padding="p-6">
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
                  <option value="lead">Lead</option>
                  <option value="prospect">Prospect</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="discovery_call_booked">Discovery Call Booked</option>
                  <option value="proposal_sent">Proposal Sent</option>
                  <option value="client">Client</option>
                  <option value="lost">Lost</option>
                  {fields.status &&
                    ![
                      "lead",
                      "prospect",
                      "contacted",
                      "qualified",
                      "discovery_call_booked",
                      "proposal_sent",
                      "client",
                      "lost",
                    ].includes(
                      fields.status,
                    ) && <option value={fields.status}>{fields.status}</option>}
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
                  {fields.source &&
                    ![
                      "phone",
                      "whatsapp",
                      "email",
                      "referral",
                      "direct",
                      "website",
                      "google",
                      "meta",
                      "instagram",
                      "outbound",
                    ].includes(fields.source) && (
                      <option value={fields.source}>{fields.source}</option>
                    )}
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
                  {allTreatmentOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  {fields.packageInterest &&
                    fields.packageInterest !== "Other" &&
                    !allTreatmentOptions.includes(fields.packageInterest) && (
                      <option value={fields.packageInterest}>
                        {fields.packageInterest}
                      </option>
                    )}
                  {!allTreatmentOptions.includes("Other") && (
                    <option value="Other">Other</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Estimated Value
                </label>
                <input
                  value={fields.value}
                  onChange={handleInputChange("value")}
                  className={inputBase}
                />
              </div>
            </div>
          </Card>

          <Card padding="p-6">
            <h2 className="font-semibold text-[#111111] mb-5">Tags</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {allTagOptions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
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
              placeholder="Add custom tag..."
              className={inputBase}
            />
          </Card>

          <Card padding="p-6">
            <h2 className="font-semibold text-[#111111] mb-5">
              Additional Interests
            </h2>
            <div className="space-y-1">
              {allTreatmentOptions.map((treatment) => (
                <label
                  key={treatment}
                  className="flex items-center gap-3 p-2.5 rounded-[12px] cursor-pointer transition-colors hover:bg-[rgba(110,106,232,0.04)]"
                >
                  <input
                    type="checkbox"
                    checked={treatmentInterests.includes(treatment)}
                    onChange={() => toggleTreatment(treatment)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: "#6E6AE8" }}
                  />
                  <span className="text-sm text-[#111111]">{treatment}</span>
                </label>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
