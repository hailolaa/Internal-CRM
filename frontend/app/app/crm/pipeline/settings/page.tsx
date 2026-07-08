"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  GripVertical,
  Settings,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { PipelineStageKind, PipelineStageRecord } from "@/lib/api-types";

const stageColors = [
  { name: "Blue", value: "bg-blue-500" },
  { name: "Amber", value: "bg-amber-500" },
  { name: "Violet", value: "bg-violet-500" },
  { name: "Teal", value: "bg-teal-500" },
  { name: "Green", value: "bg-green-500" },
  { name: "Rose", value: "bg-rose-500" },
];

type EditableStage = {
  id: string;
  name: string;
  color: string;
  kind: PipelineStageKind;
  isPersisted?: boolean;
  isLocked?: boolean;
};

function toEditableStage(stage: PipelineStageRecord): EditableStage {
  return {
    id: stage.id,
    name: stage.name,
    color: stage.color,
    kind: stage.kind,
    isPersisted: true,
    isLocked: stage.isLocked,
  };
}

export default function PipelineSettingsPage() {
  const { session } = useAuth();
  const [stages, setStages] = useState<EditableStage[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [autoMoveStale, setAutoMoveStale] = useState(false);
  const [requireNotes, setRequireNotes] = useState(true);
  const [showDealValues, setShowDealValues] = useState(true);
  const [winLossReasons, setWinLossReasons] = useState([
    "Budget too low",
    "Chose competitor",
    "Not ready",
    "No response",
    "Other",
  ]);
  const [newReason, setNewReason] = useState("");

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadStages() {
      try {
        const rows = await api.pipelineStages.list(session!.token);
        if (!cancelled) {
          setStages(rows.map(toEditableStage));
          setStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load pipeline stages", error);
        if (!cancelled) {
          setStages([]);
          setStatusMessage("Pipeline stages could not be loaded.");
        }
      }
    }

    loadStages();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const handleAddStage = async () => {
    const newStage = {
      name: "New Stage",
      color: "bg-blue-500",
      kind: "open" as const,
      position: stages.length + 1,
    };

    if (!session?.token) {
      setStages((current) => [
        ...current,
        { id: `local-${Date.now()}`, ...newStage },
      ]);
      return;
    }

    try {
      const created = await api.pipelineStages.create(session.token, newStage);
      setStages((current) => [...current, toEditableStage(created)]);
      setStatusMessage("Stage added.");
    } catch (error) {
      console.error("Failed to add pipeline stage", error);
      setStatusMessage("Could not add stage.");
    }
  };

  const handleSave = async () => {
    if (!session?.token) {
      setStatusMessage("Sign in to save pipeline settings.");
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const saved = await Promise.all(
        stages
          .filter((stage) => stage.isPersisted)
          .map((stage, index) =>
            api.pipelineStages.update(session.token, stage.id, {
              name: stage.name,
              color: stage.color,
              kind: stage.kind,
              position: index + 1,
            }),
          ),
      );
      setStages(saved.map(toEditableStage));
      setStatusMessage("Pipeline stages saved.");
    } catch (error) {
      console.error("Failed to save pipeline stages", error);
      setStatusMessage("Could not save pipeline stages.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStage = async (stage: EditableStage) => {
    if (stage.isLocked) {
      setStatusMessage("Locked stages cannot be deleted.");
      return;
    }

    if (!session?.token || !stage.isPersisted) {
      setStages((current) => current.filter((item) => item.id !== stage.id));
      return;
    }

    try {
      await api.pipelineStages.remove(session.token, stage.id);
      setStages((current) => current.filter((item) => item.id !== stage.id));
      setStatusMessage("Stage deleted.");
    } catch (error) {
      console.error("Failed to delete pipeline stage", error);
      setStatusMessage("Could not delete stage.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/app/crm/pipeline"
          className="p-2 rounded-lg hover:bg-white/10"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Pipeline Settings</h1>
          <p className="text-gray-400 text-sm">
            Configure the internal Clinic Grower sales stages.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-teal-500 hover:bg-teal-600 text-black font-medium px-4 py-2.5 rounded-lg flex items-center gap-2"
        >
          <Save className="w-4 h-4" /> {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold">Pipeline Stages</h2>
              <button
                onClick={handleAddStage}
                className="text-sm text-teal-400 hover:text-teal-300 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add Stage
              </button>
            </div>
            <div className="space-y-3">
              {stages.length === 0 && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-gray-400">
                  No live stages are available yet. Add a stage to create one in
                  the backend.
                </div>
              )}
              {stages.map((stage, index) => (
                <div
                  key={stage.id}
                  className="p-4 bg-white/5 border border-white/10 rounded-lg group hover:border-teal-500/30 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <GripVertical className="w-4 h-4 text-gray-500 cursor-grab" />
                    <div className={`w-4 h-4 rounded-full ${stage.color}`} />
                    <input
                      type="text"
                      value={stage.name}
                      onChange={(e) => {
                        const newStages = [...stages];
                        newStages[index].name = e.target.value;
                        setStages(newStages);
                      }}
                      className="flex-1 bg-transparent border-none text-sm font-medium focus:outline-none"
                    />
                    <select
                      value={stage.color}
                      onChange={(e) => {
                        const newStages = [...stages];
                        newStages[index].color = e.target.value;
                        setStages(newStages);
                      }}
                      className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                    >
                      {stageColors.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setStatusMessage(
                          "Stage colour, name, and order can be edited here. Advanced per-stage automation rules are not exposed by the backend yet.",
                        )
                      }
                      aria-label={`Configure ${stage.name} stage`}
                      className="p-1.5 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100"
                    >
                      <Settings className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      aria-label={`Delete ${stage.name} stage`}
                      onClick={() => handleDeleteStage(stage)}
                      className="p-1.5 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={handleAddStage}
                className="w-full p-4 border-2 border-dashed border-white/10 rounded-lg text-gray-500 hover:border-teal-500/30 hover:text-teal-400 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add New Stage
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="font-semibold mb-4">Pipeline Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Auto-move stale opportunities</p>
                  <p className="text-xs text-gray-500">
                    Move opportunities after 30 days of inactivity
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoMoveStale((current) => !current)}
                  aria-pressed={autoMoveStale}
                  aria-label="Toggle auto-move stale deals"
                  className={`w-10 h-5 rounded-full relative ${autoMoveStale ? "bg-teal-500" : "bg-white/10"}`}
                >
                  <div
                    className={`w-4 h-4 rounded-full absolute top-0.5 ${autoMoveStale ? "right-0.5 bg-white" : "left-0.5 bg-gray-400"}`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Require notes on move</p>
                  <p className="text-xs text-gray-500">
                    Prompt for notes when moving deals
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRequireNotes((current) => !current)}
                  aria-pressed={requireNotes}
                  aria-label="Toggle require notes on move"
                  className={`w-10 h-5 rounded-full relative ${requireNotes ? "bg-teal-500" : "bg-white/10"}`}
                >
                  <div
                    className={`w-4 h-4 rounded-full absolute top-0.5 ${requireNotes ? "right-0.5 bg-white" : "left-0.5 bg-gray-400"}`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Show opportunity values</p>
                  <p className="text-xs text-gray-500">
                    Display estimated values on cards
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDealValues((current) => !current)}
                  aria-pressed={showDealValues}
                  aria-label="Toggle show deal values"
                  className={`w-10 h-5 rounded-full relative ${showDealValues ? "bg-teal-500" : "bg-white/10"}`}
                >
                  <div
                    className={`w-4 h-4 rounded-full absolute top-0.5 ${showDealValues ? "right-0.5 bg-white" : "left-0.5 bg-gray-400"}`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="font-semibold mb-4">Win/Loss Reasons</h2>
            <div className="space-y-2 mb-4">
              {winLossReasons.map((reason) => (
                <div
                  key={reason}
                  className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
                >
                  <span className="text-sm">{reason}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setWinLossReasons((current) =>
                        current.filter((item) => item !== reason),
                      )
                    }
                    aria-label={`Delete reason: ${reason}`}
                    className="text-gray-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <input
              type="text"
              placeholder="Add new reason..."
              value={newReason}
              onChange={(event) => setNewReason(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                const reason = newReason.trim();
                if (!reason) return;
                setWinLossReasons((current) =>
                  current.includes(reason) ? current : [...current, reason],
                );
                setNewReason("");
              }}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-teal-500/50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
