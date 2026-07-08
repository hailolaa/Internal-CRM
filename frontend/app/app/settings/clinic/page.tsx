"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Building2, Save } from "lucide-react";
import { AlertBanner, PageHeader, Card } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { UpdateClinicProfilePayload } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

export default function ClinicSettingsPage() {
  const { session } = useAuth();
  const [profile, setProfile] =
    useState<UpdateClinicProfilePayload>({});
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!session?.token) return;

    let isMounted = true;
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      api.profiles
        .getClinic(session.token)
        .then((clinic) => {
          if (!isMounted) return;
          setStatus("");
          setProfile({
            name: clinic.name,
            email: clinic.email,
            website: clinic.website || "",
            phone: clinic.phone,
            address: clinic.address,
            city: clinic.city,
            state: clinic.state,
            postalCode: clinic.postalCode,
            country: clinic.country,
            timezone: clinic.timezone,
          });
        })
        .catch((err) => {
          if (!isMounted) return;
          setStatus(
            err instanceof Error
              ? `Live account profile could not load: ${err.message}`
              : "Live account profile could not load.",
          );
          setProfile({});
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    }, 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, [session?.token]);

  const updateField = (field: keyof UpdateClinicProfilePayload, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    if (!session?.token) return;
    try {
      setIsSaving(true);
      await api.profiles.updateClinic(session.token, profile);
      setStatus("Account profile saved.");
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : "Unable to save account profile.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account Settings"
        subtitle="Core account profile details for internal operations."
        icon={Building2}
        iconColor="text-[#6E6AE8]"
        iconBg="bg-[rgba(110,106,232,0.08)]"
      />

      {status && status !== "Account profile saved." && (
        <AlertBanner
          icon={AlertTriangle}
          title="Account profile notice"
          description={status}
          variant="warning"
        />
      )}

      <Card>
        <h2 className="font-semibold flex items-center gap-2 mb-5">
          <Building2 className="w-5 h-5 text-[#6E6AE8]" /> Account profile
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[#6B7280] mb-1.5">
              Account name
            </label>
            <input
              value={profile.name || ""}
              disabled={isLoading}
              onChange={(e) => updateField("name", e.target.value)}
              className="w-full bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-3 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.3)] focus:ring-1 focus:ring-[rgba(110,106,232,0.15)]"
            />
          </div>
          <div>
            <label className="block text-sm text-[#6B7280] mb-1.5">Phone</label>
            <input
              value={profile.phone || ""}
              disabled={isLoading}
              onChange={(e) => updateField("phone", e.target.value)}
              className="w-full bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-3 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.3)] focus:ring-1 focus:ring-[rgba(110,106,232,0.15)]"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-[#6B7280] mb-1.5">
              Address
            </label>
            <textarea
              rows={2}
              value={profile.address || ""}
              disabled={isLoading}
              onChange={(e) => updateField("address", e.target.value)}
              className="w-full bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-3 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.3)] focus:ring-1 focus:ring-[rgba(110,106,232,0.15)] resize-none"
            />
          </div>
        </div>

        {isLoading && (
          <p className="mt-4 text-sm text-[#6B7280]">Loading live account profile...</p>
        )}
        {status === "Account profile saved." && (
          <p className="mt-4 text-sm text-[#6B7280]">{status}</p>
        )}

        <button
          onClick={handleSave}
          disabled={isLoading || isSaving || !session?.token}
          className="mt-6 bg-[#6E6AE8] hover:bg-[#5A56D4] text-white font-medium px-5 py-2.5 rounded-xl inline-flex items-center gap-2 transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4" /> {isSaving ? "Saving..." : "Save"}
        </button>
      </Card>

      <div className="text-xs text-[#6B7280]">
        Account settings currently expose core profile fields only.
      </div>
    </div>
  );
}
