"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import type { ClientAccountSummaryRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

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
  | "firstSource"
  | "latestSource"
  | "convertingSource"
  | "utmSource"
  | "utmMedium"
  | "utmCampaign"
  | "utmContent"
  | "utmTerm"
  | "landingPage"
  | "referrer"
  | "formSubmitted"
  | "pageSubmitted"
  | "ctaClicked"
  | "gclid"
  | "fbclid"
  | "msclkid"
  | "packageInterest"
  | "recommendedPackage"
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

const FALLBACK_PACKAGE_OPTIONS = [
  "Clinic Growth Score",
  "Growth Diagnostic",
  "Lead Concierge",
  "Performance OS",
  "Growth Engine",
  "Market Leader",
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

function validateContactFields(fields: Record<FieldKey, string>) {
  const hasContactName = fields.firstName.trim() || fields.lastName.trim();
  const hasContactMethod = fields.email.trim() || fields.phone.trim();

  if (!hasContactName) {
    return "Add the contact's first or last name.";
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
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const isContactMode = searchParams.get("mode") !== "lead";
  const requestedClientClinicId = isContactMode ? searchParams.get("clientId") || "" : "";
  const pageCopy = isContactMode
    ? {
        title: "Add Contact",
        subtitle: "Create a person record for a prospect, client account, partner, or internal stakeholder.",
        saveLabel: "Save Contact",
        identityTitle: "Contact Details",
        notesTitle: "Contact Notes",
        notesPlaceholder: "Add role context, relationship notes, preferences, or communication history...",
        backHref: "/app/crm/contacts",
      }
    : {
        title: "Add Lead",
        subtitle: "Create a manual lead from phone, WhatsApp, email, referral, or direct conversation.",
        saveLabel: "Save Lead",
        identityTitle: "Lead Identity",
        notesTitle: "Lead Notes",
        notesPlaceholder: "Add context from the call, WhatsApp message, email, or referral...",
        backHref: "/app/leads",
      };
  const [tags, setTags] = useState<string[]>([]);
  const [packageInterests, setPackageInterests] = useState<string[]>([]);
  const [catalogPackageOptions, setCatalogPackageOptions] = useState<string[]>([]);
  const [isBespokePackage, setIsBespokePackage] = useState(false);
  const [communicationPermissions, setCommunicationPermissions] = useState({
    email: false,
    sms: false,
    whatsapp: false,
    phone: false,
  });
  const [customTag, setCustomTag] = useState("");
  const [clientAccounts, setClientAccounts] = useState<ClientAccountSummaryRecord[]>([]);
  const [selectedClientClinicId, setSelectedClientClinicId] = useState(requestedClientClinicId);
  const [isLoadingClientAccounts, setIsLoadingClientAccounts] = useState(isContactMode);
  const [clientAccountLoadError, setClientAccountLoadError] = useState<string | null>(null);
  const [pendingCreatedContactId, setPendingCreatedContactId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );

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
    status: isContactMode ? "active" : "lead",
    source: "",
    firstSource: "",
    latestSource: "",
    convertingSource: "",
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    utmContent: "",
    utmTerm: "",
    landingPage: "",
    referrer: "",
    formSubmitted: "",
    pageSubmitted: "",
    ctaClicked: "",
    gclid: "",
    fbclid: "",
    msclkid: "",
    packageInterest: "",
    recommendedPackage: "",
    value: "",
    notes: "",
  });

  const packageOptions = useMemo(
    () => catalogPackageOptions.length > 0 ? catalogPackageOptions : FALLBACK_PACKAGE_OPTIONS,
    [catalogPackageOptions],
  );

  useEffect(() => {
    if (!session?.token || isContactMode) return;
    const timer = window.setTimeout(() => {
      void api.packages
        .list(session.token)
        .then((records) => {
          setCatalogPackageOptions(records.map((record) => record.name));
        })
        .catch((error) => {
          console.warn("Package catalog unavailable, using fallback options", error);
        });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isContactMode, session?.token]);

  useEffect(() => {
    if (!isContactMode || !session?.token) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setIsLoadingClientAccounts(true);
      setClientAccountLoadError(null);
      api.clientAccounts
        .list(session.token)
        .then((accounts) => {
          if (!cancelled) {
            setClientAccounts(accounts);
            if (
              requestedClientClinicId
              && !accounts.some((account) => account.clinicId === requestedClientClinicId)
            ) {
              setSelectedClientClinicId("");
            }
          }
        })
        .catch(() => {
          if (!cancelled) {
            setClientAccountLoadError(
              "Client accounts could not be loaded. You can still save an unlinked contact.",
            );
          }
        })
        .finally(() => {
          if (!cancelled) setIsLoadingClientAccounts(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isContactMode, requestedClientClinicId, session?.token]);

  const updateField = useCallback((name: FieldKey, value: string) => {
    setFields((prev) => ({ ...prev, [name]: value }));
    setStatusMessage(null);
  }, []);

  const handleSelectChange =
    (name: FieldKey) => (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (name === "packageInterest" && e.target.value === "__bespoke__") {
        setIsBespokePackage(true);
        updateField(name, "");
        return;
      }
      if (name === "packageInterest") setIsBespokePackage(false);
      updateField(name, e.target.value);
    };

  const handleInputChange =
    (name: FieldKey) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      updateField(name, e.target.value);
    };

  const handleSave = async () => {
    if (!session?.token || saveStatus !== "idle") return;

    if (pendingCreatedContactId && selectedClientClinicId) {
      try {
        setSaveStatus("saving");
        setStatusMessage(null);
        await api.clientAccounts.linkContact(
          session.token,
          selectedClientClinicId,
          pendingCreatedContactId,
        );
        setSaveStatus("saved");
        router.push(`/app/crm/contacts/detail?id=${pendingCreatedContactId}`);
      } catch (error) {
        setStatusMessage(
          error instanceof Error
            ? `Contact saved, but the client link still failed: ${error.message}`
            : "Contact saved, but the client link still failed. Please try again.",
        );
        setSaveStatus("idle");
      }
      return;
    }

    const validationMessage = isContactMode
      ? validateContactFields(fields)
      : validateLeadFields(fields);
    if (validationMessage) {
      setStatusMessage(validationMessage);
      return;
    }

    const value = Number(fields.value.replace(/[^\d.]/g, ""));
    const primaryPackage = isContactMode ? "" : fields.packageInterest.trim();
    const treatmentInterests = Array.from(
      new Set([primaryPackage, ...(isContactMode ? [] : packageInterests)].filter(Boolean)),
    );
    const selectedClientAccount = clientAccounts.find(
      (account) => account.clinicId === selectedClientClinicId,
    );
    try {
      setSaveStatus("saving");
      setStatusMessage(null);
      const result = await api.contacts.create(session.token, {
        accountName: selectedClientAccount?.clinicName || emptyToNull(fields.clinicName),
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
        source: isContactMode ? null : emptyToNull(fields.source),
        firstSource: isContactMode ? null : emptyToNull(fields.firstSource || fields.source),
        latestSource: isContactMode ? null : emptyToNull(fields.latestSource || fields.source),
        convertingSource: isContactMode ? null : emptyToNull(fields.convertingSource || fields.source),
        utmSource: isContactMode ? null : emptyToNull(fields.utmSource),
        utmMedium: isContactMode ? null : emptyToNull(fields.utmMedium),
        utmCampaign: isContactMode ? null : emptyToNull(fields.utmCampaign),
        utmContent: isContactMode ? null : emptyToNull(fields.utmContent),
        utmTerm: isContactMode ? null : emptyToNull(fields.utmTerm),
        landingPage: isContactMode ? null : emptyToNull(fields.landingPage),
        referrer: isContactMode ? null : emptyToNull(fields.referrer),
        formSubmitted: isContactMode ? null : emptyToNull(fields.formSubmitted),
        pageSubmitted: isContactMode ? null : emptyToNull(fields.pageSubmitted),
        ctaClicked: isContactMode ? null : emptyToNull(fields.ctaClicked),
        gclid: isContactMode ? null : emptyToNull(fields.gclid),
        fbclid: isContactMode ? null : emptyToNull(fields.fbclid),
        msclkid: isContactMode ? null : emptyToNull(fields.msclkid),
        value: !isContactMode && Number.isFinite(value) ? value : 0,
        packageInterest: isContactMode ? null : emptyToNull(fields.packageInterest),
        recommendedPackage: isContactMode ? null : emptyToNull(fields.recommendedPackage),
        notes: emptyToNull(fields.notes),
        tags,
        treatmentInterests,
      });

      if (isContactMode && selectedClientClinicId) {
        try {
          await api.clientAccounts.linkContact(
            session.token,
            selectedClientClinicId,
            result.contact.id,
          );
        } catch (error) {
          setPendingCreatedContactId(result.contact.id);
          setStatusMessage(
            error instanceof Error
              ? `Contact saved, but it could not be linked to the client: ${error.message}`
              : "Contact saved, but it could not be linked to the client. Please try again.",
          );
          setSaveStatus("idle");
          return;
        }
      }

      setSaveStatus("saved");
      router.push(`/app/crm/contacts/detail?id=${result.contact.id}`);
    } catch (error) {
      console.error(`Failed to create ${isContactMode ? "contact" : "lead"}`, error);
      setStatusMessage(error instanceof Error ? error.message : `Could not save ${isContactMode ? "contact" : "lead"}.`);
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
          href={pageCopy.backHref}
          className="p-2 rounded-[14px] transition-colors hover:bg-[rgba(110,106,232,0.08)]"
          style={{
            backgroundColor: "#FFFCF9",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#111111]">{pageCopy.title}</h1>
          <p className="text-[#6B7280] text-sm">
            {pageCopy.subtitle}
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
              <Save className="w-4 h-4" />
              {pendingCreatedContactId ? "Retry Client Link" : pageCopy.saveLabel}
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
            <h2 className="font-semibold text-[#111111] mb-5">{pageCopy.identityTitle}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isContactMode && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-[#111111] mb-1.5">
                    Link to Client <span className="font-normal text-[#6B7280]">(optional)</span>
                  </label>
                  <select
                    value={selectedClientClinicId}
                    onChange={(event) => setSelectedClientClinicId(event.target.value)}
                    disabled={isLoadingClientAccounts || Boolean(pendingCreatedContactId)}
                    className={selectBase}
                  >
                    <option value="">
                      {isLoadingClientAccounts ? "Loading clients..." : "No linked client"}
                    </option>
                    {clientAccounts.map((account) => (
                      <option key={account.clinicId} value={account.clinicId}>
                        {account.clinicName}
                      </option>
                    ))}
                  </select>
                  {clientAccountLoadError && (
                    <p className="mt-1.5 text-xs text-amber-700">{clientAccountLoadError}</p>
                  )}
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Account Name
                </label>
                <input
                  type="text"
                  value={fields.clinicName}
                  onChange={handleInputChange("clinicName")}
                  placeholder={isContactMode ? "Account this person belongs to" : "Growth-focused account"}
                  className={inputBase}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Contact Role
                </label>
                <input
                  type="text"
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
                  type="text"
                  value={fields.role}
                  onChange={handleInputChange("role")}
                  placeholder="Account owner, marketing manager, finance contact..."
                  className={inputBase}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Contact First Name <span className="font-normal text-[#6B7280]">(first or last name required)</span>
                </label>
                <input
                  type="text"
                  aria-required="true"
                  maxLength={100}
                  value={fields.firstName}
                  onChange={handleInputChange("firstName")}
                  placeholder="Sarah"
                  className={inputBase}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Contact Last Name <span className="font-normal text-[#6B7280]">(first or last name required)</span>
                </label>
                <input
                  type="text"
                  aria-required="true"
                  maxLength={100}
                  value={fields.lastName}
                  onChange={handleInputChange("lastName")}
                  placeholder="Johnson"
                  className={inputBase}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Email <span className="font-normal text-[#6B7280]">(email or phone required)</span>
                </label>
                <input
                  type="email"
                  aria-required="true"
                  maxLength={255}
                  value={fields.email}
                  onChange={handleInputChange("email")}
                  placeholder="sarah@example.com"
                  className={inputBase}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-1.5">
                  Phone / WhatsApp <span className="font-normal text-[#6B7280]">(email or phone required)</span>
                </label>
                <input
                  type="tel"
                  aria-required="true"
                  maxLength={30}
                  pattern="[0-9 +()\-]{7,30}"
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

          {!isContactMode && (
            <div
              className="rounded-[24px] p-6"
              style={{
                backgroundColor: "#FFFCF9",
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
              }}
            >
              <h2 className="font-semibold text-[#111111] mb-2">Attribution</h2>
              <p className="mb-5 text-sm text-[#6B7280]">
                Track where this lead first came from and which page, campaign, or CTA converted it.
              </p>
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-1.5">First Source</label>
                    <input value={fields.firstSource} onChange={handleInputChange("firstSource")} placeholder="Website, Meta, referral..." className={inputBase} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-1.5">Latest Source</label>
                    <input value={fields.latestSource} onChange={handleInputChange("latestSource")} placeholder="Latest touchpoint" className={inputBase} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-1.5">Converting Source</label>
                    <input value={fields.convertingSource} onChange={handleInputChange("convertingSource")} placeholder="Source that converted" className={inputBase} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-1.5">UTM Source</label>
                    <input value={fields.utmSource} onChange={handleInputChange("utmSource")} placeholder="google, meta, email" className={inputBase} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-1.5">UTM Medium</label>
                    <input value={fields.utmMedium} onChange={handleInputChange("utmMedium")} placeholder="cpc, organic, referral" className={inputBase} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-1.5">UTM Campaign</label>
                    <input value={fields.utmCampaign} onChange={handleInputChange("utmCampaign")} placeholder="summer-growth-audit" className={inputBase} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-1.5">Landing Page</label>
                    <input value={fields.landingPage} onChange={handleInputChange("landingPage")} placeholder="https://..." className={inputBase} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-1.5">Referrer</label>
                    <input value={fields.referrer} onChange={handleInputChange("referrer")} placeholder="https://..." className={inputBase} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-1.5">Form Submitted</label>
                    <input value={fields.formSubmitted} onChange={handleInputChange("formSubmitted")} placeholder="Growth score form" className={inputBase} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-1.5">Page Submitted</label>
                    <input value={fields.pageSubmitted} onChange={handleInputChange("pageSubmitted")} placeholder="/growth-score" className={inputBase} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-1.5">CTA Clicked</label>
                    <input value={fields.ctaClicked} onChange={handleInputChange("ctaClicked")} placeholder="Book growth audit" className={inputBase} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-1.5">Google Click ID</label>
                    <input value={fields.gclid} onChange={handleInputChange("gclid")} placeholder="gclid" className={inputBase} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-1.5">Meta Click ID</label>
                    <input value={fields.fbclid} onChange={handleInputChange("fbclid")} placeholder="fbclid" className={inputBase} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-1.5">Microsoft Click ID</label>
                    <input value={fields.msclkid} onChange={handleInputChange("msclkid")} placeholder="msclkid" className={inputBase} />
                  </div>
                </div>
              </div>
            </div>
          )}

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
            <h2 className="font-semibold text-[#111111] mb-5">{pageCopy.notesTitle}</h2>
            <textarea
              rows={4}
              value={fields.notes}
              onChange={handleInputChange("notes")}
              placeholder={pageCopy.notesPlaceholder}
              className={`${inputBase} resize-none`}
            />
          </div>
        </div>

        <div className="lg:col-span-1 space-y-5">
          <div
            className="rounded-[24px] p-6"
            style={{ backgroundColor: "#FFFCF9", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
          >
            <h2 className="font-semibold text-[#111111] mb-2">Communication Permissions</h2>
            <p className="mb-4 text-sm text-[#6B7280]">Only enable agreed contact channels.</p>
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
              {isContactMode ? "Contact Classification" : "Status & Source"}
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
                  {isContactMode ? (
                    <>
                      <option value="active">Active</option>
                      <option value="client">Client contact</option>
                      <option value="partner">Partner</option>
                      <option value="vendor">Vendor</option>
                      <option value="internal">Internal</option>
                      <option value="inactive">Inactive</option>
                    </>
                  ) : (
                    <>
                      <option value="lead">Lead</option>
                      <option value="prospect">Prospect</option>
                      <option value="contacted">Contacted</option>
                      <option value="qualified">Qualified</option>
                      <option value="discovery_call_booked">Discovery Call Booked</option>
                      <option value="proposal_sent">Proposal Sent</option>
                      <option value="client">Client</option>
                      <option value="lost">Lost</option>
                    </>
                  )}
                </select>
              </div>
              {!isContactMode && (
                <>
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
                      value={isBespokePackage ? "__bespoke__" : fields.packageInterest}
                      onChange={handleSelectChange("packageInterest")}
                      className={selectBase}
                    >
                      <option value="">Select package</option>
                      {packageOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                      <option value="__bespoke__">Bespoke / custom</option>
                    </select>
                    {isBespokePackage && (
                      <input
                        type="text"
                        value={fields.packageInterest}
                        onChange={handleInputChange("packageInterest")}
                        placeholder="Enter bespoke package name"
                        className={`${inputBase} mt-2`}
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-1.5">
                      Recommended Next Package
                    </label>
                    <select
                      value={fields.recommendedPackage}
                      onChange={handleSelectChange("recommendedPackage")}
                      className={selectBase}
                    >
                      <option value="">No recommendation yet</option>
                      {packageOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
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
                </>
              )}
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

          {!isContactMode && (
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
                {packageOptions.map((option) => (
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
          )}
        </div>
      </div>
    </div>
  );
}
