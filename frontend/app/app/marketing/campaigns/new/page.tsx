"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Calendar,
  PoundSterling,
  Image as ImageIcon,
  FileText,
  Sparkles,
  Trash2,
} from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  CAMPAIGN_MEDIA_ACCEPT,
  CAMPAIGN_MEDIA_MAX_ITEMS,
  readCampaignMediaDataUrl,
  validateCampaignMediaFile,
} from "@/lib/campaign-media";

const channels = [
  { id: "google", name: "Google Ads", icon: "🎯" },
  { id: "meta", name: "Meta Ads", icon: "📱" },
  { id: "email", name: "Email", icon: "📧" },
  { id: "sms", name: "SMS", icon: "💬" },
];

type SelectedCampaignMedia = {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
};

export default function NewCampaignPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [selectedChannel, setSelectedChannel] = useState("google");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalBudget, setTotalBudget] = useState("");
  const [dailyBudget, setDailyBudget] = useState("");
  const [goal, setGoal] = useState("Generate leads");
  const [targetCpl, setTargetCpl] = useState("");
  const [targetLeads, setTargetLeads] = useState("");
  const [treatmentFocus, setTreatmentFocus] = useState("All treatments");
  const [locationRadius, setLocationRadius] = useState("5 miles");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [notes, setNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<SelectedCampaignMedia[]>([]);

  const parseMoney = (value: string) => {
    const parsed = Number(value.replace(/[£,\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const handleSave = async () => {
    if (!session?.token) {
      setStatusMessage("Please sign in again before creating a campaign.");
      return;
    }

    if (!name.trim()) {
      setStatusMessage("Campaign name is required.");
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const createdCampaign = await api.campaigns.create(session.token, {
        name: name.trim(),
        description:
          notes.trim() ||
          [
            `Goal: ${goal}`,
            `Treatment focus: ${treatmentFocus}`,
            `Location radius: ${locationRadius}`,
            ageMin || ageMax ? `Age range: ${ageMin || "Any"}-${ageMax || "Any"}` : "",
            targetCpl ? `Target CPL: ${targetCpl}` : "",
            targetLeads ? `Target leads: ${targetLeads}` : "",
            dailyBudget ? `Daily budget: ${dailyBudget}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        type: goal.toLowerCase().replace(/\s+/g, "_"),
        status: "draft",
        startDate: startDate || null,
        endDate: endDate || null,
        budget: totalBudget ? parseMoney(totalBudget) : null,
        channel: selectedChannel,
      });
      for (const [index, media] of selectedMedia.entries()) {
        setStatusMessage(
          `Campaign created. Uploading media ${index + 1} of ${selectedMedia.length}...`,
        );
        const dataUrl = await readCampaignMediaDataUrl(media.file, (progress) => {
          setSelectedMedia((current) =>
            current.map((item) =>
              item.id === media.id ? { ...item, progress } : item,
            ),
          );
        });

        await api.campaigns.uploadMedia(session.token, createdCampaign.id, {
          fileName: media.file.name,
          mimeType: media.file.type,
          sizeBytes: media.file.size,
          dataUrl,
        });
      }

      setStatusMessage("Campaign created. Returning to campaigns...");
      router.push("/app/marketing/campaigns");
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Unable to create campaign.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleMediaSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    const availableSlots = CAMPAIGN_MEDIA_MAX_ITEMS - selectedMedia.length;
    if (availableSlots <= 0) {
      setStatusMessage(`Campaigns can have up to ${CAMPAIGN_MEDIA_MAX_ITEMS} media assets.`);
      return;
    }

    const accepted: SelectedCampaignMedia[] = [];
    const errors: string[] = [];

    files.slice(0, availableSlots).forEach((file) => {
      const validationError = validateCampaignMediaFile(file);
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`);
        return;
      }

      accepted.push({
        id: `${file.name}-${file.lastModified}-${file.size}`,
        file,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
      });
    });

    if (files.length > availableSlots) {
      errors.push(`Only ${availableSlots} more media asset${availableSlots === 1 ? "" : "s"} can be added.`);
    }

    setSelectedMedia((current) => [...current, ...accepted]);
    setStatusMessage(
      errors.length
        ? errors.join(" ")
        : `${accepted.length} media asset${accepted.length === 1 ? "" : "s"} ready to upload.`,
    );
  };

  const removeSelectedMedia = (mediaId: string) => {
    setSelectedMedia((current) => {
      const media = current.find((item) => item.id === mediaId);
      if (media) URL.revokeObjectURL(media.previewUrl);
      return current.filter((item) => item.id !== mediaId);
    });
  };

  const buildCampaignContext = () =>
    [
      `Campaign: ${name || "Untitled campaign"}`,
      `Channel: ${channels.find((channel) => channel.id === selectedChannel)?.name || selectedChannel}`,
      `Goal: ${goal}`,
      `Treatment focus: ${treatmentFocus}`,
      `Budget: ${totalBudget || "Not set"}`,
      `Daily budget: ${dailyBudget || "Not set"}`,
      `Target CPL: ${targetCpl || "Not set"}`,
      `Target leads: ${targetLeads || "Not set"}`,
      `Radius: ${locationRadius}`,
      ageMin || ageMax ? `Age range: ${ageMin || "Any"}-${ageMax || "Any"}` : "",
      startDate || endDate ? `Dates: ${startDate || "TBC"} to ${endDate || "TBC"}` : "",
    ]
      .filter(Boolean)
      .join("\n");

  const buildRecommendedCopy = () => {
    const treatment =
      treatmentFocus === "All treatments"
        ? "your most popular treatments"
        : treatmentFocus;
    const audience =
      ageMin || ageMax
        ? `patients aged ${ageMin || "any"}-${ageMax || "any"} within ${locationRadius}`
        : `patients within ${locationRadius}`;
    const channelName =
      channels.find((channel) => channel.id === selectedChannel)?.name ||
      selectedChannel;

    return [
      `AI campaign recommendation`,
      ``,
      `Positioning: Lead with the outcome patients want from ${treatment}, then remove friction with a direct consultation CTA.`,
      `Audience: Focus on ${audience}.`,
      `Channel plan: Use ${channelName} for a clear offer, local proof, and fast booking path.`,
      `Primary copy: Ready to feel more confident in your skin? Book a personalised consultation and get a treatment plan tailored to you.`,
      `CTA: Book your consultation`,
      `Budget note: ${totalBudget ? `Keep total spend around £${parseMoney(totalBudget).toLocaleString("en-GB")}` : "Set a total budget before launch"}${dailyBudget ? `, with £${parseMoney(dailyBudget).toLocaleString("en-GB")} per day as the pacing guardrail` : ""}.`,
      targetCpl || targetLeads
        ? `Success target: ${targetLeads || "Tracked"} leads${targetCpl ? ` at ${targetCpl} CPL` : ""}.`
        : `Success target: Track booked consults and cost per booked consult from day one.`,
    ].join("\n");
  };

  const handleGenerateRecommendations = async () => {
    if (!session?.token) {
      setStatusMessage("Please sign in again before generating recommendations.");
      return;
    }

    setIsGenerating(true);
    setStatusMessage(null);

    const recommendation = buildRecommendedCopy();

    try {
      await api.ai.createRun(session.token, {
        agentName: "Campaign Builder",
        agentKey: "campaign-builder",
        task: "Generate campaign launch recommendations",
        input: buildCampaignContext(),
        output: {
          recommendation,
          channel: selectedChannel,
          goal,
          treatmentFocus,
        },
        status: "success",
      });
      setNotes((current) =>
        current.trim() ? `${current.trim()}\n\n${recommendation}` : recommendation,
      );
      setStatusMessage("AI recommendations saved and added to campaign notes.");
    } catch (err) {
      setStatusMessage(
        err instanceof Error
          ? err.message
          : "Could not save AI recommendations.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/app/marketing/campaigns"
          className="p-2 rounded-lg hover:bg-[rgba(0,0,0,0.04)]"
        >
          <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#111111]">Create Campaign</h1>
          <p className="text-[#6B7280] text-sm">
            Set up a new marketing campaign
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#6E6AE8] hover:bg-[#5A56D4] text-white font-medium px-4 py-2.5 rounded-[24px] flex items-center gap-2 transition-colors"
        >
          <Save className="w-4 h-4" /> {isSaving ? "Saving..." : "Save Campaign"}
        </button>
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6">
            <h2 className="font-semibold mb-4 text-[#111111]">
              Campaign Details
            </h2>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="campaign-name"
                  className="block text-sm text-[#6B7280] mb-1.5"
                >
                  Campaign Name
                </label>
                <input
                  id="campaign-name"
                  name="campaignName"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. January Botox Promo"
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[#6E6AE8]"
                />
              </div>
              <div>
                <p className="block text-sm text-[#6B7280] mb-1.5">
                  Channel
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => setSelectedChannel(channel.id)}
                      className="p-3 rounded-xl text-center transition-all"
                      style={{
                        backgroundColor:
                          selectedChannel === channel.id
                            ? "rgba(110, 106, 232, 0.08)"
                            : "#FAF8F5",
                        border:
                          selectedChannel === channel.id
                            ? "1px solid rgba(110, 106, 232, 0.3)"
                            : "1px solid rgba(0,0,0,0.06)",
                        color:
                          selectedChannel === channel.id
                            ? "#6E6AE8"
                            : "#6B7280",
                      }}
                    >
                      <span className="text-2xl block mb-1">
                        {channel.icon}
                      </span>
                      <span className="text-xs">{channel.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="campaign-start-date"
                    className="block text-sm text-[#6B7280] mb-1.5"
                  >
                    Start Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                    <input
                      id="campaign-start-date"
                      name="campaignStartDate"
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#6E6AE8]"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="campaign-end-date"
                    className="block text-sm text-[#6B7280] mb-1.5"
                  >
                    End Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                    <input
                      id="campaign-end-date"
                      name="campaignEndDate"
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#6E6AE8]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6">
            <h2 className="font-semibold mb-4 text-[#111111]">
              Budget & Goals
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="campaign-total-budget"
                    className="block text-sm text-[#6B7280] mb-1.5"
                  >
                    Total Budget
                  </label>
                  <div className="relative">
                    <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                    <input
                      id="campaign-total-budget"
                      name="campaignTotalBudget"
                      type="text"
                      value={totalBudget}
                      onChange={(event) => setTotalBudget(event.target.value)}
                      placeholder="1,500"
                      className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[#6E6AE8]"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="campaign-daily-budget"
                    className="block text-sm text-[#6B7280] mb-1.5"
                  >
                    Daily Budget
                  </label>
                  <div className="relative">
                    <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                    <input
                      id="campaign-daily-budget"
                      name="campaignDailyBudget"
                      type="text"
                      value={dailyBudget}
                      onChange={(event) => setDailyBudget(event.target.value)}
                      placeholder="50"
                      className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[#6E6AE8]"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label
                  htmlFor="campaign-goal"
                  className="block text-sm text-[#6B7280] mb-1.5"
                >
                  Campaign Goal
                </label>
                <select
                  id="campaign-goal"
                  name="campaignGoal"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#6E6AE8]"
                >
                  <option>Generate leads</option>
                  <option>Drive bookings</option>
                  <option>Brand awareness</option>
                  <option>Website traffic</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="campaign-target-cpl"
                    className="block text-sm text-[#6B7280] mb-1.5"
                  >
                    Target CPL
                  </label>
                  <input
                    id="campaign-target-cpl"
                    name="campaignTargetCpl"
                    type="text"
                    value={targetCpl}
                    onChange={(event) => setTargetCpl(event.target.value)}
                    placeholder="£25"
                    className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[#6E6AE8]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="campaign-target-leads"
                    className="block text-sm text-[#6B7280] mb-1.5"
                  >
                    Target Leads
                  </label>
                  <input
                    id="campaign-target-leads"
                    name="campaignTargetLeads"
                    type="text"
                    value={targetLeads}
                    onChange={(event) => setTargetLeads(event.target.value)}
                    placeholder="60"
                    className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[#6E6AE8]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6">
            <h2 className="font-semibold mb-4 text-[#111111]">
              Campaign Notes
            </h2>
            <textarea
              id="campaign-notes"
              name="campaignNotes"
              aria-label="Campaign notes"
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add any notes about this campaign..."
              className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-3 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[#6E6AE8] resize-none"
            />
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6">
            <h2 className="font-semibold mb-4 text-[#111111]">Targeting</h2>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="campaign-treatment-focus"
                  className="block text-sm text-[#6B7280] mb-1.5"
                >
                  Treatment Focus
                </label>
                <select
                  id="campaign-treatment-focus"
                  name="campaignTreatmentFocus"
                  value={treatmentFocus}
                  onChange={(event) => setTreatmentFocus(event.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-2.5 text-sm text-[#111111]"
                >
                  <option>All treatments</option>
                  <option>Botox</option>
                  <option>Lip Filler</option>
                  <option>Dermal Filler</option>
                  <option>Skin Treatments</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="campaign-location-radius"
                  className="block text-sm text-[#6B7280] mb-1.5"
                >
                  Location Radius
                </label>
                <select
                  id="campaign-location-radius"
                  name="campaignLocationRadius"
                  value={locationRadius}
                  onChange={(event) => setLocationRadius(event.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-2.5 text-sm text-[#111111]"
                >
                  <option>5 miles</option>
                  <option>10 miles</option>
                  <option>25 miles</option>
                  <option>50 miles</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="campaign-age-min"
                  className="block text-sm text-[#6B7280] mb-1.5"
                >
                  Age Range
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="campaign-age-min"
                    name="campaignAgeMin"
                    type="text"
                    value={ageMin}
                    onChange={(event) => setAgeMin(event.target.value)}
                    placeholder="25"
                    aria-label="Minimum age"
                    className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-2 text-sm text-[#111111] placeholder:text-[#6B7280]"
                  />
                  <span className="text-[#6B7280]">to</span>
                  <input
                    id="campaign-age-max"
                    name="campaignAgeMax"
                    type="text"
                    value={ageMax}
                    onChange={(event) => setAgeMax(event.target.value)}
                    placeholder="55"
                    aria-label="Maximum age"
                    className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-2 text-sm text-[#111111] placeholder:text-[#6B7280]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6">
            <h2 className="font-semibold mb-4 text-[#111111]">Assets</h2>
            <div className="space-y-3">
              <input
                id="campaign-media-upload"
                name="campaignMedia"
                type="file"
                accept={CAMPAIGN_MEDIA_ACCEPT}
                multiple
                className="hidden"
                onChange={handleMediaSelect}
              />
              <label
                htmlFor="campaign-media-upload"
                className="w-full cursor-pointer p-4 border-2 border-dashed border-[rgba(0,0,0,0.08)] rounded-xl text-[#6B7280] hover:border-[rgba(110,106,232,0.3)] hover:text-[#6E6AE8] transition-all flex items-center justify-center gap-2"
              >
                <ImageIcon className="w-4 h-4" /> Upload Media
              </label>
              {selectedMedia.length > 0 && (
                <div className="space-y-2">
                  {selectedMedia.map((media) => (
                    <div
                      key={media.id}
                      className="flex items-center gap-3 rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] p-2"
                    >
                      {media.file.type.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={media.previewUrl}
                          alt=""
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white">
                          <FileText className="h-5 w-5 text-[#6B7280]" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#111111]">
                          {media.file.name}
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          {media.progress > 0 && isSaving
                            ? `${media.progress}% uploaded`
                            : `${Math.round(media.file.size / 1024).toLocaleString()} KB`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSelectedMedia(media.id)}
                        disabled={isSaving}
                        className="rounded-lg p-2 text-[#6B7280] hover:bg-white disabled:opacity-50"
                        aria-label={`Remove ${media.file.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  const copy = buildRecommendedCopy();
                  setNotes((current) =>
                    current.trim() ? `${current.trim()}\n\n${copy}` : copy,
                  );
                  setStatusMessage("Campaign copy added to notes.");
                }}
                className="w-full p-4 border-2 border-dashed border-[rgba(0,0,0,0.08)] rounded-xl text-[#6B7280] hover:border-[rgba(110,106,232,0.3)] hover:text-[#6E6AE8] transition-all flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" /> Add Copy
              </button>
            </div>
          </div>

          <div
            className="border border-[rgba(110,106,232,0.2)] rounded-[24px] p-6"
            style={{ backgroundColor: "rgba(110, 106, 232, 0.06)" }}
          >
            <h2 className="font-semibold mb-2 text-[#111111]">
              AI Suggestions
            </h2>
            <p className="text-xs text-[#6B7280] mb-4">
              Let Sophia optimise your campaign
            </p>
            <button
              type="button"
              onClick={handleGenerateRecommendations}
              disabled={isGenerating}
              className="w-full border border-[rgba(110,106,232,0.25)] py-2 rounded-xl text-sm font-medium transition-colors text-[#6E6AE8] hover:bg-[rgba(110,106,232,0.08)]"
              style={{ backgroundColor: "rgba(110, 106, 232, 0.06)" }}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />
                {isGenerating ? "Generating..." : "Get AI Recommendations"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
