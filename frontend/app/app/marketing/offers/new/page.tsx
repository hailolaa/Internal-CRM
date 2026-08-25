"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Gift,
  Loader2,
  Percent,
  Save,
  Tag,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ActionButton,
  AlertBanner,
  Card,
  FormField,
  PageHeader,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import type { OfferRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

const packageOptions = [
  { value: "Free Clinic Growth Audit", label: "Free Clinic Growth Audit" },
  { value: "Clinic Growth Diagnostic", label: "Clinic Growth Diagnostic" },
  { value: "Treatment Growth", label: "Treatment Growth" },
  { value: "Clinic Growth", label: "Clinic Growth" },
  { value: "Market Leader", label: "Market Leader" },
  { value: "Bespoke", label: "Bespoke" },
];

const statusOptions: { value: OfferRecord["status"]; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
];

function parseDiscount(discount: string) {
  const type = discount.includes("%") ? "percentage" : "fixed";
  const value = discount.replace(/[^\d.]/g, "");
  return { type, value };
}

function getDaysUntilExpiry(validUntil: string, noExpiry: boolean) {
  if (noExpiry || !validUntil) return null;
  const expiry = new Date(`${validUntil}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
}

export default function NewOfferPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [editingOfferId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("id") || "",
  );
  const isEditMode = Boolean(editingOfferId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [packageFocus, setPackageFocus] = useState("Clinic Growth");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [noExpiry, setNoExpiry] = useState(false);
  const [status, setStatus] = useState<OfferRecord["status"]>("scheduled");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoadingOffer, setIsLoadingOffer] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!session?.token || !editingOfferId) return;

    let isMounted = true;
    api.offers
      .list(session.token)
      .then((offers) => {
        if (!isMounted) return;
        const offer = offers.find((item) => item.id === editingOfferId);
        if (!offer) {
          setStatusMessage("Offer could not be found.");
          return;
        }

        const parsedDiscount = parseDiscount(offer.discount);
        setName(offer.name);
        setDescription(offer.description || "");
        setPackageFocus(offer.treatment);
        setDiscountType(parsedDiscount.type);
        setDiscountValue(parsedDiscount.value);
        setValidUntil(offer.validUntil === "No expiry" ? "" : offer.validUntil);
        setNoExpiry(offer.validUntil === "No expiry");
        setStatus(offer.status);
        setStatusMessage(null);
      })
      .catch((error) => {
        if (!isMounted) return;
        setStatusMessage(
          error instanceof Error
            ? error.message
            : "Could not load offer for editing.",
        );
      })
      .finally(() => {
        if (isMounted) setIsLoadingOffer(false);
      });

    return () => {
      isMounted = false;
    };
  }, [editingOfferId, session?.token]);

  const discountLabel =
    discountType === "percentage"
      ? `${discountValue || 0}% off`
      : `GBP ${discountValue || 0} off`;

  const daysUntilExpiry = getDaysUntilExpiry(validUntil, noExpiry);
  const expiryText = noExpiry
    ? "No expiry"
    : validUntil
      ? `Valid until ${validUntil}`
      : "Set an end date";
  const expiryHealth =
    daysUntilExpiry === null
      ? "Offer runs until manually disabled or needs an end date."
      : daysUntilExpiry < 0
        ? `${Math.abs(daysUntilExpiry)} days past valid date.`
        : daysUntilExpiry === 0
          ? "Expires today."
          : `${daysUntilExpiry} days left.`;

  const completion = useMemo(() => {
    const checks = [
      name.trim(),
      discountValue.trim(),
      packageFocus,
      status,
      noExpiry || validUntil,
      description.trim(),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [description, discountValue, name, noExpiry, packageFocus, status, validUntil]);

  const handleSave = async () => {
    if (!session?.token) return;

    if (!name.trim() || !discountValue.trim()) {
      setStatusMessage("Offer name and value are required.");
      return;
    }

    try {
      setIsSaving(true);
      setStatusMessage(null);
      const payload = {
        name: name.trim(),
        description: description || undefined,
        treatment: packageFocus,
        discount: discountLabel,
        validUntil: noExpiry
          ? "No expiry"
          : validUntil || new Date().toISOString().slice(0, 10),
        status,
      };

      if (isEditMode) {
        await api.offers.update(session.token, editingOfferId, payload);
      } else {
        await api.offers.create(session.token, payload);
      }

      router.push("/app/marketing/offers");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not save offer.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditMode ? "Edit Offer" : "Create Offer"}
        subtitle="Create internal offer records for campaigns, landing pages and follow-up activity."
        icon={Gift}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/marketing/offers"
              className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(21,31,33,0.08)] bg-[#FFFFFF] px-4 py-2.5 text-sm font-medium text-[#5E6E70] transition-colors hover:bg-[#eaedeb]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <ActionButton
              onClick={handleSave}
              disabled={isSaving || isLoadingOffer}
              icon={isSaving ? Loader2 : Save}
              className={isSaving ? "[&>svg]:animate-spin" : ""}
            >
              {isSaving ? "Saving..." : isEditMode ? "Save Changes" : "Save Offer"}
            </ActionButton>
          </div>
        }
      />

      {statusMessage && (
        <AlertBanner
          icon={CheckCircle2}
          title={statusMessage}
          variant={statusMessage.includes("required") ? "error" : "info"}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card>
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-[#151f21]">
                Offer Details
              </h2>
              <p className="text-sm text-[#5E6E70]">
                Define the offer, package focus and how it should be positioned.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Offer name"
                value={name}
                onChange={setName}
                placeholder="Clinic Growth Diagnostic launch incentive"
                required
              />
              <FormField
                label="Package focus"
                value={packageFocus}
                onChange={setPackageFocus}
                type="select"
                options={packageOptions}
              />
              <FormField
                label="Discount type"
                value={discountType}
                onChange={setDiscountType}
                type="select"
                options={[
                  { value: "percentage", label: "Percentage" },
                  { value: "fixed", label: "Fixed value" },
                ]}
              />
              <FormField
                label="Offer value"
                value={discountValue}
                onChange={setDiscountValue}
                placeholder={discountType === "percentage" ? "10" : "395"}
                icon={discountType === "percentage" ? Percent : Tag}
                required
              />
              <FormField
                label="Status"
                value={status}
                onChange={(value) => setStatus(value as OfferRecord["status"])}
                type="select"
                options={statusOptions}
              />
              <FormField
                label="Valid until"
                value={validUntil}
                onChange={setValidUntil}
                type="date"
                icon={Calendar}
              />
              <div className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-[rgba(21,31,33,0.08)] bg-[#FFFCF9] p-4">
                <input
                  id="offer-no-expiry"
                  type="checkbox"
                  checked={noExpiry}
                  onChange={(event) => setNoExpiry(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[rgba(21,31,33,0.16)] text-[#60b4af]"
                />
                <label htmlFor="offer-no-expiry" className="text-sm text-[#151f21]">
                  This offer has no fixed expiry yet
                </label>
              </div>
              <FormField
                className="md:col-span-2"
                label="Description"
                value={description}
                onChange={setDescription}
                type="textarea"
                rows={6}
                placeholder="Explain when the team should use this offer, who it is for, and any limits that should be checked before sharing it."
              />
            </div>
          </Card>
        </div>

        <Card className="h-fit">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(96,180,175,0.08)] text-[#60b4af]">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-[#151f21]">Offer Summary</h2>
              <p className="text-xs text-[#5E6E70]">{completion}% complete</p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-[rgba(21,31,33,0.06)] bg-[#FFFFFF] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[#5E6E70]">
              Preview
            </p>
            <h3 className="mt-2 text-lg font-semibold text-[#151f21]">
              {name || "Offer name"}
            </h3>
            <p className="mt-2 text-sm text-[#5E6E70]">
              {discountLabel} for {packageFocus}
            </p>
            <p className="mt-1 text-xs text-[#5E6E70]">{expiryText}</p>
          </div>
          <p className="mt-4 text-sm text-[#5E6E70]">{expiryHealth}</p>
        </Card>
      </div>
    </div>
  );
}
