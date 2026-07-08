"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Gift,
  Calendar,
  Percent,
  Tag,
  Users,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { OfferRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

const treatments = [
  "All Treatments",
  "Botox",
  "Lip Filler",
  "Dermal Filler",
  "Skin Treatments",
  "Consultation",
  "Package Deal",
];

function parseDiscount(discount: string) {
  const type = discount.includes("%") ? "percentage" : "fixed";
  const value = discount.replace(/[^\d.]/g, "");
  return { type, value };
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
  const [treatment, setTreatment] = useState("All Treatments");
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
        setTreatment(offer.treatment);
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
      ? `${discountValue || 0}% OFF`
      : `£${discountValue || 0} OFF`;

  const handleSave = async () => {
    if (!session?.token) return;

    if (!name.trim() || !discountValue.trim()) {
      setStatusMessage("Offer name and discount value are required.");
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        name,
        description: description || undefined,
        treatment,
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
      console.error("Failed to create offer", error);
      setStatusMessage(
        error instanceof Error ? error.message : "Could not save offer.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/app/marketing/offers"
          className="p-2 rounded-lg hover:bg-[rgba(0,0,0,0.04)]"
        >
          <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#111111]">
            {isEditMode ? "Edit Offer" : "Create Offer"}
          </h1>
          <p className="text-[#6B7280] text-sm">
            {isEditMode
              ? "Update the selected promotional offer"
              : "Set up a new promotional offer"}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || isLoadingOffer}
          className="bg-[#6E6AE8] hover:bg-[#5A56D4] text-white font-medium px-4 py-2.5 rounded-[24px] flex items-center gap-2 transition-colors disabled:opacity-60"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isSaving ? "Saving..." : isEditMode ? "Save Changes" : "Save Offer"}
        </button>
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      {isLoadingOffer && (
        <div className="rounded-lg border border-[#E7E1DA] bg-[#FFFCF9] px-4 py-3 text-sm text-[#6B7280]">
          Loading offer details...
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2 text-[#111111]">
              <Gift className="w-5 h-5 text-rose-400" /> Offer Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#6B7280] mb-1.5">
                  Offer Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. New Year Botox Special"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[#6E6AE8]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#6B7280] mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the offer for your clients..."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-3 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[#6E6AE8] resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#6B7280] mb-1.5">
                  Applicable Treatment
                </label>
                <select
                  value={treatment}
                  onChange={(event) => setTreatment(event.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#6E6AE8]"
                >
                  {treatments.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#6B7280] mb-1.5">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as OfferRecord["status"])
                  }
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#6E6AE8]"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2 text-[#111111]">
              <Percent className="w-5 h-5 text-[#6E6AE8]" /> Discount
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#6B7280] mb-1.5">
                  Discount Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDiscountType("percentage")}
                    className="flex-1 p-3 rounded-xl flex items-center justify-center gap-2 transition-all text-sm font-medium"
                    style={{
                      backgroundColor:
                        discountType === "percentage"
                          ? "rgba(110, 106, 232, 0.08)"
                          : "#FAF8F5",
                      border:
                        discountType === "percentage"
                          ? "1px solid rgba(110, 106, 232, 0.3)"
                          : "1px solid rgba(0,0,0,0.06)",
                      color:
                        discountType === "percentage" ? "#6E6AE8" : "#6B7280",
                    }}
                  >
                    <Percent className="w-4 h-4" /> Percentage Off
                  </button>
                  <button
                    onClick={() => setDiscountType("fixed")}
                    className="flex-1 p-3 rounded-xl flex items-center justify-center gap-2 transition-all text-sm font-medium"
                    style={{
                      backgroundColor:
                        discountType === "fixed"
                          ? "rgba(110, 106, 232, 0.08)"
                          : "#FAF8F5",
                      border:
                        discountType === "fixed"
                          ? "1px solid rgba(110, 106, 232, 0.3)"
                          : "1px solid rgba(0,0,0,0.06)",
                      color: discountType === "fixed" ? "#6E6AE8" : "#6B7280",
                    }}
                  >
                    £ Fixed Amount
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#6B7280] mb-1.5">
                    Discount Value *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]">
                      {discountType === "percentage" ? "%" : "£"}
                    </span>
                    <input
                      type="text"
                      placeholder={discountType === "percentage" ? "20" : "50"}
                      value={discountValue}
                      onChange={(event) => setDiscountValue(event.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl pl-8 pr-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[#6E6AE8]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[#6B7280] mb-1.5">
                    Minimum Spend (optional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]">
                      £
                    </span>
                    <input
                      type="text"
                      placeholder="100"
                      className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl pl-8 pr-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[#6E6AE8]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2 text-[#111111]">
              <Calendar className="w-5 h-5 text-blue-500" /> Validity Period
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#6B7280] mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    disabled={noExpiry}
                    className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#6E6AE8]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#6B7280] mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    disabled={noExpiry}
                    onChange={(event) => setValidUntil(event.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#6E6AE8]"
                  />
                </div>
              </div>
              <label className="flex items-center gap-3 p-3 bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl cursor-pointer hover:bg-[#F6F3EF] transition-colors">
                <input
                  type="checkbox"
                  checked={noExpiry}
                  onChange={(event) => setNoExpiry(event.target.checked)}
                  className="w-4 h-4 rounded accent-[#6E6AE8]"
                />
                <div>
                  <p className="text-sm font-medium text-[#111111]">
                    No expiry date
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    Offer runs until manually disabled
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2 text-[#111111]">
              <Users className="w-5 h-5 text-violet-500" /> Eligibility
            </h2>
            <div className="space-y-3">
              {[
                "All clients",
                "New clients only",
                "Existing clients only",
                "VIP clients only",
              ].map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-3 p-3 bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl cursor-pointer hover:bg-[#F6F3EF] transition-colors"
                >
                  <input
                    type="radio"
                    name="eligibility"
                    className="w-4 h-4 accent-[#6E6AE8]"
                    defaultChecked={option === "All clients"}
                  />
                  <span className="text-sm text-[#111111]">{option}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2 text-[#111111]">
              <Tag className="w-5 h-5 text-amber-500" /> Promo Code
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#6B7280] mb-1.5">
                  Code (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. NEWYEAR20"
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[#6E6AE8] uppercase"
                />
                <p className="text-xs text-[#6B7280] mt-1">
                  Leave blank for automatic application
                </p>
              </div>
              <div>
                <label className="block text-sm text-[#6B7280] mb-1.5">
                  Usage Limit
                </label>
                <input
                  type="number"
                  placeholder="Unlimited"
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[#6E6AE8]"
                />
              </div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-[#6E6AE8]"
                />
                <span className="text-sm text-[#6B7280]">
                  One use per client
                </span>
              </label>
            </div>
          </div>

          <div className="bg-[#FFFCF9] border border-rose-200 rounded-[24px] p-6">
            <h2 className="font-semibold mb-2 text-[#111111]">Preview</h2>
            <div className="bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl p-4 mt-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                  <Gift className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <p className="font-medium text-sm text-[#111111]">
                    {name || "New Offer"}
                  </p>
                  <p className="text-xs text-[#6B7280]">{treatment}</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-[#6E6AE8] mb-1">
                {discountLabel}
              </p>
              <p className="text-xs text-[#6B7280]">
                {noExpiry
                  ? "No expiry"
                  : validUntil
                    ? `Valid until ${validUntil}`
                    : "Set an end date"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
