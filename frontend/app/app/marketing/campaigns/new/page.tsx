"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Megaphone,
  PoundSterling,
  Save,
  Target,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  ActionButton,
  AlertBanner,
  Card,
  FormField,
  PageHeader,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

const channelOptions = [
  { value: "Google Ads", label: "Google Ads" },
  { value: "Meta Ads", label: "Meta Ads" },
  { value: "Email", label: "Email" },
  { value: "SMS", label: "SMS" },
  { value: "Website", label: "Website" },
  { value: "Referral", label: "Referral" },
  { value: "Multi-channel", label: "Multi-channel" },
];

const objectiveOptions = [
  { value: "Lead generation", label: "Lead generation" },
  { value: "Book calls", label: "Book calls" },
  { value: "Free audit requests", label: "Free audit requests" },
  { value: "Guide downloads", label: "Guide downloads" },
  { value: "Proposal follow-up", label: "Proposal follow-up" },
  { value: "Client upsell", label: "Client upsell" },
];

const packageOptions = [
  { value: "Clinic Growth Score", label: "Clinic Growth Score" },
  { value: "Growth Diagnostic", label: "Growth Diagnostic" },
  { value: "Lead Concierge", label: "Lead Concierge" },
  { value: "Performance OS", label: "Performance OS" },
  { value: "Growth Engine", label: "Growth Engine" },
  { value: "Market Leader", label: "Market Leader" },
  { value: "Bespoke", label: "Bespoke" },
];

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

function parseMoney(value: string) {
  const parsed = Number(value.replace(/[GBP,\s]/gi, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBudget(value: string) {
  const parsed = parseMoney(value);
  return parsed > 0 ? `GBP ${parsed.toLocaleString("en-GB")}` : "Not set";
}

export default function NewCampaignPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("Google Ads");
  const [objective, setObjective] = useState("Lead generation");
  const [packageFocus, setPackageFocus] = useState("Growth Engine");
  const [status, setStatus] = useState("draft");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [primaryCta, setPrimaryCta] = useState("");
  const [landingPage, setLandingPage] = useState("");
  const [notes, setNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const completion = useMemo(() => {
    const checks = [
      name.trim(),
      channel,
      objective,
      packageFocus,
      startDate,
      budget.trim(),
      primaryCta.trim(),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [budget, channel, name, objective, packageFocus, primaryCta, startDate]);

  const handleSave = async () => {
    if (!session?.token) return;

    if (!name.trim()) {
      setStatusMessage("Campaign name is required.");
      return;
    }

    try {
      setIsSaving(true);
      setStatusMessage(null);
      const description = [
        `Package focus: ${packageFocus}`,
        `Target audience: ${targetAudience || "Not set"}`,
        `Primary CTA: ${primaryCta || "Not set"}`,
        `Landing page: ${landingPage || "Not set"}`,
        notes ? `Internal notes: ${notes}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      await api.campaigns.create(session.token, {
        name: name.trim(),
        description,
        type: objective,
        status,
        startDate: startDate || null,
        endDate: endDate || null,
        budget: budget.trim() ? parseMoney(budget) : null,
        channel,
      });

      router.push("/app/marketing/campaigns");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not save campaign.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Campaign"
        subtitle="Plan an internal ClinicGrower campaign without leaving the marketing workspace."
        icon={Megaphone}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/marketing/campaigns"
              className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(21,31,33,0.08)] bg-[#FFFFFF] px-4 py-2.5 text-sm font-medium text-[#5E6E70] transition-colors hover:bg-[#eaedeb]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <ActionButton onClick={handleSave} disabled={isSaving} icon={Save}>
              {isSaving ? "Saving..." : "Save Campaign"}
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
                Campaign Basics
              </h2>
              <p className="text-sm text-[#5E6E70]">
                Set the commercial purpose, channel and package focus.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Campaign name"
                value={name}
                onChange={setName}
                placeholder="August Growth Engine audit push"
                required
              />
              <FormField
                label="Channel"
                value={channel}
                onChange={setChannel}
                type="select"
                options={channelOptions}
              />
              <FormField
                label="Objective"
                value={objective}
                onChange={setObjective}
                type="select"
                options={objectiveOptions}
              />
              <FormField
                label="Package focus"
                value={packageFocus}
                onChange={setPackageFocus}
                type="select"
                options={packageOptions}
              />
              <FormField
                label="Status"
                value={status}
                onChange={setStatus}
                type="select"
                options={statusOptions}
              />
              <FormField
                label="Budget"
                value={budget}
                onChange={setBudget}
                placeholder="2500"
                icon={PoundSterling}
              />
            </div>
          </Card>

          <Card>
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-[#151f21]">
                Timing And Targeting
              </h2>
              <p className="text-sm text-[#5E6E70]">
                Capture what the campaign is targeting and where the traffic should go.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Start date"
                value={startDate}
                onChange={setStartDate}
                type="date"
                icon={Calendar}
              />
              <FormField
                label="End date"
                value={endDate}
                onChange={setEndDate}
                type="date"
                icon={Calendar}
              />
              <FormField
                className="md:col-span-2"
                label="Target audience"
                value={targetAudience}
                onChange={setTargetAudience}
                placeholder="UK dental clinics with weak lead tracking and paid ads interest"
              />
              <FormField
                label="Primary CTA"
                value={primaryCta}
                onChange={setPrimaryCta}
                placeholder="Book a Growth Diagnostic call"
              />
              <FormField
                label="Landing page"
                value={landingPage}
                onChange={setLandingPage}
                type="url"
                placeholder="https://clinicgrower.co.uk/..."
              />
              <FormField
                className="md:col-span-2"
                label="Internal notes"
                value={notes}
                onChange={setNotes}
                type="textarea"
                rows={5}
                placeholder="Angle, creative notes, exclusions, follow-up plan or reporting notes."
              />
            </div>
          </Card>
        </div>

        <Card className="h-fit">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(96,180,175,0.08)] text-[#60b4af]">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-[#151f21]">Campaign Summary</h2>
              <p className="text-xs text-[#5E6E70]">{completion}% complete</p>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm">
            {[
              ["Channel", channel],
              ["Objective", objective],
              ["Package", packageFocus],
              ["Budget", formatBudget(budget)],
              ["Status", status],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 border-b border-[rgba(21,31,33,0.06)] pb-3 last:border-0 last:pb-0"
              >
                <span className="text-[#5E6E70]">{label}</span>
                <span className="text-right font-medium text-[#151f21]">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
