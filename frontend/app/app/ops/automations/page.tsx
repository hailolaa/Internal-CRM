"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Zap,
  Clock,
  Play,
  Pause,
  ArrowRight,
  Users,
  Calendar,
  Bell,
  CheckCircle,
  AlertCircle,
  Edit2,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  Card,
  StatusBadge,
  StatCardSkeleton,
  CardSkeleton,
} from "@/components/ui";
import { SearchInput, FilterTabs } from "@/components/ui/forms";
import { DashedAddCard } from "@/components/ui/shared";
import { api } from "@/lib/api-client";
import type { AutomationRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

type AutomationCard = AutomationRecord & {
  lastRun: string;
};

type AutomationDraft = {
  name: string;
  description: string;
  triggerType: string;
  actions: string[];
  isEnabled: boolean;
};

const triggerOptions = [
  {
    value: "contact_created",
    label: "New contact created",
    hint: "Runs when a new contact enters the CRM.",
  },
  {
    value: "appointment_booked",
    label: "Appointment booked",
    hint: "Runs after a scheduled sales or delivery event is created.",
  },
  {
    value: "appointment_scheduled",
    label: "Appointment scheduled",
    hint: "Runs after an appointment is scheduled.",
  },
  {
    value: "appointment_created",
    label: "Appointment created",
    hint: "Runs after an appointment record is created.",
  },
  {
    value: "appointment_no_show",
    label: "Appointment marked no-show",
    hint: "Runs when a scheduled prospect or client event is missed.",
  },
  {
    value: "appointment_completed",
    label: "Appointment completed",
    hint: "Runs when a discovery call or delivery milestone is completed.",
  },
  {
    value: "treatment_completed",
    label: "Delivery milestone completed",
    hint: "Runs when a delivery milestone is completed.",
  },
  {
    value: "payment_completed",
    label: "Payment completed",
    hint: "Runs after a successful payment is recorded.",
  },
  {
    value: "manual",
    label: "Manual",
    hint: "Saved as a manual workflow shell.",
  },
];

const actionOptions = [
  {
    value: "send_email",
    label: "Send email",
    hint: "Queues an email action for the workflow.",
  },
  {
    value: "send_sms",
    label: "Send SMS",
    hint: "Queues an SMS action for the workflow.",
  },
  {
    value: "create_task",
    label: "Create task",
    hint: "Creates a follow-up task for the team.",
  },
  {
    value: "send_notification",
    label: "Notify team",
    hint: "Creates an internal notification action.",
  },
  {
    value: "sync_calendar",
    label: "Sync calendar",
    hint: "Adds a calendar-sync action.",
  },
  {
    value: "send_survey",
    label: "Send survey",
    hint: "Queues a client feedback survey action.",
  },
  {
    value: "post_slack",
    label: "Post Slack alert",
    hint: "Adds a team alert action for connected Slack workflows.",
  },
];

const emptyDraft: AutomationDraft = {
  name: "",
  description: "",
  triggerType: "contact_created",
  actions: ["create_task"],
  isEnabled: false,
};

function formatAction(action: unknown) {
  if (typeof action === "string") return action;
  if (action && typeof action === "object" && "label" in action) {
    return String((action as { label?: unknown }).label ?? "Action");
  }
  if (action && typeof action === "object" && "type" in action) {
    return String((action as { type?: unknown }).type ?? "Action");
  }
  return "Action";
}

function triggerIconFor(triggerType: string | null) {
  const value = triggerType?.toLowerCase() ?? "";
  if (value.includes("appointment")) return Calendar;
  if (value.includes("show")) return AlertCircle;
  if (value.includes("birthday")) return Bell;
  if (value.includes("inactive") || value.includes("delay")) return Clock;
  if (value.includes("completed")) return CheckCircle;
  return Users;
}

function labelForValue(
  options: { value: string; label: string }[],
  value: string | null,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function draftFromAutomation(automation: AutomationCard): AutomationDraft {
  return {
    name: automation.name,
    description: automation.description ?? "",
    triggerType: automation.triggerType ?? "manual",
    actions: automation.actions
      .map((action) => (typeof action === "string" ? action : null))
      .filter((action): action is string => Boolean(action)),
    isEnabled: automation.isEnabled,
  };
}

function mapAutomation(record: AutomationRecord): AutomationCard {
  return {
    ...record,
    lastRun: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(record.updatedAt)),
  };
}

export default function AutomationsPage() {
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [automations, setAutomations] = useState<AutomationCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<AutomationDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;
    const token = session.token;

    async function loadAutomations() {
      try {
        const rows = await api.automations.list(token);
        if (!cancelled) {
          setAutomations(rows.map(mapAutomation));
          setLoadError("");
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load automations from the backend.",
          );
          setAutomations([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadAutomations();

    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  const filteredAutomations = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return automations.filter((automation) => {
      const statusMatches =
        activeTab === "all" ||
        (activeTab === "active" && automation.isEnabled) ||
        (activeTab === "paused" && !automation.isEnabled);
      const searchMatches =
        !search ||
        [automation.name, automation.description, automation.triggerType]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(search));
      return statusMatches && searchMatches;
    });
  }, [activeTab, automations, searchQuery]);

  const activeCount = automations.filter((a) => a.isEnabled).length;
  const pausedCount = automations.length - activeCount;
  const actionCount = automations.reduce(
    (acc, automation) => acc + automation.actions.length,
    0,
  );

  const resetEditor = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setIsEditorOpen(false);
  };

  const openCreateEditor = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setStatusMessage(null);
    setIsEditorOpen(true);
  };

  const openEditEditor = (automation: AutomationCard) => {
    setDraft(draftFromAutomation(automation));
    setEditingId(automation.id);
    setStatusMessage(null);
    setIsEditorOpen(true);
  };

  const toggleDraftAction = (action: string) => {
    setDraft((current) => ({
      ...current,
      actions: current.actions.includes(action)
        ? current.actions.filter((item) => item !== action)
        : [...current.actions, action],
    }));
  };

  const handleSaveAutomation = async () => {
    if (!session?.token) return;
    const name = draft.name.trim();
    if (!name) {
      setStatusMessage("Add an automation name before saving.");
      return;
    }
    if (draft.actions.length === 0) {
      setStatusMessage("Choose at least one action before saving.");
      return;
    }

    const payload = {
      name,
      description: draft.description.trim(),
      triggerType: draft.triggerType,
      actions: draft.actions,
      isEnabled: draft.isEnabled,
    };

    setIsSaving(true);
    setStatusMessage(null);
    try {
      if (editingId) {
        await api.automations.update(session.token, editingId, payload);
        setAutomations((items) =>
          items.map((item) =>
            item.id === editingId
              ? mapAutomation({
                  ...item,
                  ...payload,
                  updatedAt: new Date().toISOString(),
                })
              : item,
          ),
        );
        setStatusMessage("Automation updated.");
      } else {
        const created = await api.automations.create(session.token, payload);
        setAutomations((items) => [
          mapAutomation({
            id: created.id,
            ...payload,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
          ...items,
        ]);
        setStatusMessage("Automation created.");
      }
      resetEditor();
    } catch (error) {
      console.error("Failed to save automation", error);
      setStatusMessage("Could not save automation.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAutomation = async (automation: AutomationCard) => {
    if (!session?.token) return;
    const isEnabled = !automation.isEnabled;

    try {
      await api.automations.update(session.token, automation.id, { isEnabled });
      setAutomations((items) =>
        items.map((item) =>
          item.id === automation.id ? { ...item, isEnabled } : item,
        ),
      );
    } catch (error) {
      console.error("Failed to update automation", error);
      setStatusMessage("Could not update automation.");
    }
  };

  const handleRemoveAutomation = async (automation: AutomationCard) => {
    if (!session?.token) return;
    if (!window.confirm(`Delete ${automation.name}?`)) return;

    setDeletingId(automation.id);
    try {
      await api.automations.remove(session.token, automation.id);
      setAutomations((items) =>
        items.filter((item) => item.id !== automation.id),
      );
      if (editingId === automation.id) resetEditor();
      setStatusMessage("Automation deleted.");
    } catch (error) {
      console.error("Failed to delete automation", error);
      setStatusMessage("Could not delete automation.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automation Engine"
        subtitle="Build automated workflows that run 24/7."
        right={
          <button onClick={openCreateEditor} className="btn-primary w-fit">
            <Plus className="w-4 h-4" /> Create Automation
          </button>
        }
      />

      {statusMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      {loadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Backend automations could not be loaded. {loadError}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }, (_, index) => <StatCardSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              label="Total Automations"
              value={String(automations.length)}
            />
            <StatCard label="Active" value={String(activeCount)} color="green" />
            <StatCard label="Paused" value={String(pausedCount)} color="amber" />
            <StatCard
              label="Workflow Actions"
              value={String(actionCount)}
              color="teal"
            />
          </>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search automations..."
          className="flex-1 max-w-md"
        />
        <FilterTabs
          tabs={["All", "Active", "Paused"]}
          active={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {isEditorOpen && (
        <Card padding="p-5 md:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#252421]">
                  {editingId ? "Edit automation" : "Create automation"}
                </h2>
                <p className="mt-1 text-sm text-[#7A746A]">
                  The backend currently stores an automation name, trigger, enabled
                  state, and an ordered list of action keys. Pick from the supported
                  values below so the saved workflow is clear.
                </p>
              </div>
              <button
                type="button"
                onClick={resetEditor}
                aria-label="Close automation editor"
                className="rounded-lg p-2 text-[#7A746A] hover:bg-[#F7F5F2]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#252421]">
                  Automation name
                </span>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. No-show recovery follow-up"
                  className="w-full rounded-xl border border-[#E5DED6] bg-[#FFFCF9] px-4 py-3 text-sm text-[#252421] outline-none focus:border-[#60b4af] focus:ring-2 focus:ring-[#60b4af]/10"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#252421]">
                  Trigger
                </span>
                <select
                  value={draft.triggerType}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      triggerType: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-[#E5DED6] bg-[#FFFCF9] px-4 py-3 text-sm text-[#252421] outline-none focus:border-[#60b4af] focus:ring-2 focus:ring-[#60b4af]/10"
                >
                  {triggerOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[#7A746A]">
                  {
                    triggerOptions.find(
                      (option) => option.value === draft.triggerType,
                    )?.hint
                  }
                </p>
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[#252421]">
                Description
              </span>
              <textarea
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={3}
                placeholder="What this workflow is meant to do, when it should be reviewed, and who owns it."
                className="w-full resize-none rounded-xl border border-[#E5DED6] bg-[#FFFCF9] px-4 py-3 text-sm text-[#252421] outline-none focus:border-[#60b4af] focus:ring-2 focus:ring-[#60b4af]/10"
              />
            </label>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-[#252421]">Actions</p>
                <p className="text-xs text-[#7A746A]">
                  Select the actions this workflow should contain. They are saved
                  to the backend in the order selected here.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {actionOptions.map((option) => {
                  const checked = draft.actions.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleDraftAction(option.value)}
                      aria-pressed={checked}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        checked
                          ? "border-[#60b4af] bg-[#60b4af]/10"
                          : "border-[#E5DED6] bg-[#FFFCF9] hover:bg-[#F7F5F2]"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-[#252421]">
                        <CheckCircle
                          className={`h-4 w-4 ${checked ? "text-[#60b4af]" : "text-[#DAD2C8]"}`}
                        />
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs text-[#7A746A]">
                        {option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#EDE8E2] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    isEnabled: !current.isEnabled,
                  }))
                }
                aria-pressed={draft.isEnabled}
                className="flex items-center gap-3 text-left"
              >
                <span
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    draft.isEnabled ? "bg-[#60b4af]" : "bg-[#DAD2C8]"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                      draft.isEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </span>
                <span>
                  <span className="block text-sm font-medium text-[#252421]">
                    {draft.isEnabled ? "Enabled" : "Paused"}
                  </span>
                  <span className="block text-xs text-[#7A746A]">
                    Keep new workflows paused until the trigger and actions are reviewed.
                  </span>
                </span>
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetEditor}
                  className="rounded-xl border border-[#E5DED6] px-4 py-2.5 text-sm font-medium text-[#7A746A] hover:bg-[#F7F5F2]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAutomation}
                  disabled={isSaving}
                  className="btn-primary w-fit disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving..." : "Save automation"}
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading &&
          Array.from({ length: 4 }, (_, index) => (
            <CardSkeleton key={index} lines={5} />
          ))}

        {!isLoading && filteredAutomations.length === 0 && (
          <Card padding="p-6" className="lg:col-span-2">
            <div className="text-center text-sm text-[#7A746A]">
              {searchQuery || activeTab !== "all"
                ? "No live automations match the current filters."
                : "No live automations have been created for this workspace yet."}
            </div>
          </Card>
        )}

        {!isLoading && filteredAutomations.map((automation) => {
          const TriggerIcon = triggerIconFor(automation.triggerType);
          const status = automation.isEnabled ? "active" : "paused";
          return (
            <Card key={automation.id} hover>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      backgroundColor:
                        automation.isEnabled
                          ? "rgba(90, 138, 106, 0.1)"
                          : "#F7F5F2",
                      border:
                        automation.isEnabled
                          ? "1px solid rgba(90, 138, 106, 0.2)"
                          : "1px solid #E5DED6",
                    }}
                  >
                    <Zap
                      className={`w-5 h-5 ${automation.isEnabled ? "text-[#5A8A6A]" : "text-[#A8A39B]"}`}
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold" style={{ color: "#252421" }}>
                      {automation.name}
                    </h3>
                    <p className="text-xs" style={{ color: "#7A746A" }}>
                      {automation.description || "No description provided"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleAutomation(automation)}
                    aria-label={
                      automation.isEnabled
                        ? `Pause ${automation.name}`
                        : `Resume ${automation.name}`
                    }
                    className="p-1.5 rounded-lg hover:bg-[#F7F5F2]"
                  >
                    {automation.isEnabled ? (
                      <Pause className="w-4 h-4 text-[#A8A39B]" />
                    ) : (
                      <Play className="w-4 h-4 text-[#A8A39B]" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditEditor(automation)}
                    aria-label={`Edit ${automation.name}`}
                    className="p-1.5 rounded-lg hover:bg-[#F7F5F2]"
                  >
                    <Edit2 className="w-4 h-4 text-[#A8A39B]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveAutomation(automation)}
                    disabled={deletingId === automation.id}
                    aria-label={`Delete ${automation.name}`}
                    className="p-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    title={`Delete ${automation.name}`}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>

              <div
                className="flex items-center gap-2 mb-4 p-3 rounded-xl"
                style={{
                  backgroundColor: "#F7F5F2",
                  border: "1px solid #E5DED6",
                }}
              >
                <TriggerIcon className="w-4 h-4 text-[#7D8F7A]" />
                <span className="text-sm" style={{ color: "#7A746A" }}>
                  When:
                </span>
                <span
                  className="font-medium text-sm"
                  style={{ color: "#252421" }}
                >
                  {labelForValue(triggerOptions, automation.triggerType)}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                {automation.actions.map((action, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 flex-shrink-0"
                  >
                    <span
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        backgroundColor: "#F7F5F2",
                        border: "1px solid #E5DED6",
                        color: "#7A746A",
                      }}
                    >
                      {labelForValue(actionOptions, formatAction(action))}
                    </span>
                    {index < automation.actions.length - 1 && (
                      <ArrowRight className="w-3 h-3 text-[#DAD2C8]" />
                    )}
                  </div>
                ))}
                {automation.actions.length === 0 && (
                  <span className="text-xs text-[#A8A39B]">
                    No actions configured
                  </span>
                )}
              </div>

              <div
                className="flex items-center justify-between pt-3"
                style={{ borderTop: "1px solid #EDE8E2" }}
              >
                <div
                  className="flex items-center gap-4 text-xs"
                  style={{ color: "#A8A39B" }}
                >
                  <span>{automation.actions.length} actions</span>
                  <span>Updated: {automation.lastRun}</span>
                </div>
                <StatusBadge status={status} />
              </div>
            </Card>
          );
        })}

        {!isLoading && (
          <button type="button" onClick={openCreateEditor} className="text-left">
            <DashedAddCard
              label="Create New Automation"
              sublabel="Build custom workflows for internal operations"
            />
          </button>
        )}
      </div>
    </div>
  );
}
