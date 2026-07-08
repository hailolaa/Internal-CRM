"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Users,
  CreditCard,
  Shield,
  FileText,
  MapPin,
  Scissors,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  BillingStatus,
  ClinicProfile,
  ComplianceDocumentRecord,
  SecuritySettings,
  TeamMember,
} from "@/lib/api-types";

const settingsItems = [
  {
    name: "Clinic Profile",
    desc: "Clinic name, address, branding, and contact details.",
    href: "/app/settings/clinic",
    icon: Building2,
    color:
      "text-[#7D8F7A] bg-[rgba(125,143,122,0.1)] border border-[rgba(125,143,122,0.2)]",
  },
  {
    name: "Team Members",
    desc: "Manage team access, roles, and permissions.",
    href: "/app/settings/team",
    icon: Users,
    color:
      "text-[#4A6A8A] bg-[rgba(74,106,138,0.1)] border border-[rgba(74,106,138,0.2)]",
  },
  {
    name: "Locations",
    desc: "Manage clinic locations and branches.",
    href: "/app/settings/locations",
    icon: MapPin,
    color:
      "text-[#7D8F7A] bg-[rgba(125,143,122,0.08)] border border-[rgba(125,143,122,0.15)]",
  },
  {
    name: "Treatments",
    desc: "Manage services used for booking duration and pricing.",
    href: "/app/settings/treatments",
    icon: Scissors,
    color:
      "text-[#6E6AE8] bg-[rgba(110,106,232,0.08)] border border-[rgba(110,106,232,0.15)]",
  },
  {
    name: "Billing & Plans",
    desc: "Manage subscription, usage, and invoices.",
    href: "/app/settings/billing",
    icon: CreditCard,
    color:
      "text-[#5A8A6A] bg-[rgba(90,138,106,0.1)] border border-[rgba(90,138,106,0.2)]",
  },
  {
    name: "Security",
    desc: "Password, two-factor authentication, and session management.",
    href: "/app/settings/security",
    icon: Shield,
    color: "text-[#7A746A] bg-[#EFEAE4] border border-[#E5DED6]",
  },
  {
    name: "Compliance & Audit",
    desc: "GDPR, data retention, consent management, and audit trail.",
    href: "/app/settings/compliance",
    icon: FileText,
    color:
      "text-[#A07840] bg-[rgba(160,120,64,0.1)] border border-[rgba(160,120,64,0.2)]",
  },
];

export default function SettingsPage() {
  const { session } = useAuth();
  const [clinic, setClinic] = useState<ClinicProfile | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [security, setSecurity] = useState<SecuritySettings | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<
    ComplianceDocumentRecord[]
  >([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadSettingsSummary() {
      try {
        const [clinicRecord, billingRecord, securityRecord, teamRows, docs] =
          await Promise.all([
            api.profiles.getClinic(session!.token),
            api.billing.getStatus(session!.token),
            api.settings.getSecurity(session!.token),
            api.team.getMembers(session!.token),
            api.compliance.listDocuments(session!.token),
          ]);

        if (!cancelled) {
          setClinic(clinicRecord);
          setBilling(billingRecord);
          setSecurity(securityRecord);
          setTeamMembers(teamRows);
          setComplianceDocs(docs);
          setStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load settings overview", error);
        if (!cancelled) {
          setStatusMessage("Some settings summaries could not be loaded.");
        }
      }
    }

    loadSettingsSummary();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const actionRequiredCount = useMemo(
    () =>
      complianceDocs.filter((doc) => doc.status !== "complete").length,
    [complianceDocs],
  );

  const cardMeta: Record<string, string> = {
    "Clinic Profile": clinic
      ? `${clinic.name} · ${clinic.city || clinic.country || "Profile loaded"}`
      : "Not loaded yet",
    "Team Members": teamMembers.length
      ? `${teamMembers.length} members and invitations`
      : "No team summary yet",
    Locations: billing
      ? `${billing.usage.locations} active location${
          billing.usage.locations === 1 ? "" : "s"
        }`
      : "Location summary loading",
    Treatments: "Live service catalogue",
    "Billing & Plans": billing
      ? `${billing.subscriptionPlan} · ${billing.subscriptionStatus}`
      : "Billing status loading",
    Security: security
      ? security.twoFactorEnabled
        ? "2FA enabled"
        : "2FA not enabled"
      : "Security status loading",
    "Compliance & Audit": complianceDocs.length
      ? `${actionRequiredCount} document${
          actionRequiredCount === 1 ? "" : "s"
        } need attention`
      : "No compliance documents loaded",
  };

  return (
    <div className="max-w-4xl space-y-4">
      {statusMessage && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: "#FFFCF9", border: "1px solid #E5DED6" }}
        >
          <p className="text-xs" style={{ color: "#7A746A" }}>
            Plan
          </p>
          <p className="font-semibold" style={{ color: "#252421" }}>
            {billing?.subscriptionPlan || "Loading"}
          </p>
        </div>
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: "#FFFCF9", border: "1px solid #E5DED6" }}
        >
          <p className="text-xs" style={{ color: "#7A746A" }}>
            Team Usage
          </p>
          <p className="font-semibold" style={{ color: "#252421" }}>
            {billing
              ? `${billing.usage.teamMembers} / ${billing.usage.maxUsers}`
              : "Loading"}
          </p>
        </div>
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: "#FFFCF9", border: "1px solid #E5DED6" }}
        >
          <p className="text-xs" style={{ color: "#7A746A" }}>
            Compliance
          </p>
          <p className="font-semibold" style={{ color: "#252421" }}>
            {complianceDocs.length
              ? `${actionRequiredCount} action required`
              : "Loading"}
          </p>
        </div>
      </div>

      {settingsItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.name}
            href={item.href}
            className="flex items-center gap-4 rounded-2xl p-4 hover:border-[#A8B5A2] transition-all"
            style={{
              backgroundColor: "#FFFCF9",
              border: "1px solid #E5DED6",
              boxShadow: "0 2px 8px rgba(37, 36, 33, 0.04)",
            }}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div
                className="text-sm font-semibold"
                style={{ color: "#252421" }}
              >
                {item.name}
              </div>
              <div className="text-xs" style={{ color: "#7A746A" }}>
                {item.desc}
              </div>
              <div className="mt-1 text-xs font-medium text-[#6E6AE8]">
                {cardMeta[item.name]}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
