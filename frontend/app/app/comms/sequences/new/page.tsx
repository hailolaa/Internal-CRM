"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Save,
  Clock,
  Zap,
  Mail,
  MessageSquare,
  Bell,
  CheckCircle,
} from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

const triggerTypes = [
  { id: "new_lead", name: "New lead created", icon: Zap },
  { id: "booking", name: "Booking confirmed", icon: CheckCircle },
  { id: "no_show", name: "No-show detected", icon: Bell },
  { id: "time_delay", name: "Time delay", icon: Clock },
];

const actionTypes = [
  { id: "email", name: "Send email", icon: Mail },
  { id: "sms", name: "Send SMS", icon: MessageSquare },
  { id: "task", name: "Create task", icon: CheckCircle },
  { id: "notify", name: "Send notification", icon: Bell },
];

type SequenceStep = {
  id: number;
  type: string;
  delay: number;
  subject: string;
};

export default function NewSequencePage() {
  const router = useRouter();
  const { session } = useAuth();
  const [name, setName] = useState("New Lead Nurture Sequence");
  const [triggerLabel, setTriggerLabel] = useState("New lead created");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [exitOnGoal, setExitOnGoal] = useState(true);
  const [sendOnWeekends, setSendOnWeekends] = useState(false);
  const [goal, setGoal] = useState("Book consultation");
  const [steps, setSteps] = useState<SequenceStep[]>([
    { id: 1, type: "email", delay: 0, subject: "Welcome to our clinic!" },
    { id: 2, type: "email", delay: 2, subject: "Your consultation guide" },
    { id: 3, type: "sms", delay: 5, subject: "Quick reminder about booking" },
  ]);

  const handleSave = async () => {
    if (!session?.token) return;

    try {
      setIsSaving(true);
      await api.sequences.create(session.token, {
        name,
        triggerLabel,
        steps: [
          ...steps,
          {
            id: "settings",
            type: "settings",
            goal,
            exitOnGoal,
            sendOnWeekends,
          },
        ],
        status: "draft",
      });
      router.push("/app/comms/sequences");
    } catch (error) {
      console.error("Failed to create sequence", error);
      setStatusMessage("Could not save sequence.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStep = (type = "email") => {
    const action = actionTypes.find((item) => item.id === type);
    setSteps((items) => [
      ...items,
      {
        id: Date.now(),
        type,
        delay: 1,
        subject: action ? action.name : "New follow-up step",
      },
    ]);
  };

  const handleEditStep = (step: SequenceStep) => {
    const subject = window.prompt("Step subject", step.subject);
    if (subject === null) return;

    const delayValue = window.prompt("Delay in days", String(step.delay));
    if (delayValue === null) return;

    const delay = Number.parseInt(delayValue, 10);
    setSteps((items) =>
      items.map((item) =>
        item.id === step.id
          ? {
              ...item,
              subject: subject.trim() || item.subject,
              delay: Number.isFinite(delay) && delay >= 0 ? delay : item.delay,
            }
          : item,
      ),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/app/comms/sequences"
          className="p-2 rounded-[10px] hover:bg-[rgba(110,106,232,0.06)] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
        </Link>
        <div className="flex-1">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="text-2xl font-bold bg-transparent border-none focus:outline-none w-full text-[#111111] placeholder:text-[#6B7280]"
          />
          <p className="text-[#6B7280] text-sm">
            Build your automated sequence
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#6E6AE8] hover:bg-[#5A56D4] text-white font-medium px-4 py-2.5 rounded-[14px] flex items-center gap-2 transition-colors shadow-sm disabled:opacity-60"
        >
          <Save className="w-4 h-4" />{" "}
          {isSaving ? "Saving..." : "Save Sequence"}
        </button>
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Trigger card */}
          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6 shadow-sm">
            <h2 className="font-semibold text-[#111111] mb-4">Trigger</h2>
            <div className="grid grid-cols-2 gap-3">
              {triggerTypes.map((trigger) => (
                <button
                  key={trigger.id}
                  onClick={() => setTriggerLabel(trigger.name)}
                  className={`p-4 bg-[#FAF8F5] border rounded-[14px] flex items-center gap-3 hover:border-[rgba(110,106,232,0.3)] hover:bg-[rgba(110,106,232,0.04)] transition-all text-left ${
                    triggerLabel === trigger.name
                      ? "border-[rgba(110,106,232,0.35)]"
                      : "border-[rgba(0,0,0,0.06)]"
                  }`}
                >
                  <div className="w-10 h-10 rounded-[10px] bg-[rgba(110,106,232,0.08)] flex items-center justify-center">
                    <trigger.icon className="w-5 h-5 text-[#6E6AE8]" />
                  </div>
                  <span className="text-sm font-medium text-[#111111]">
                    {trigger.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Sequence steps card */}
          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[#111111]">Sequence Steps</h2>
              <span className="text-sm text-[#6B7280]">
                {steps.length} steps
              </span>
            </div>
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={step.id} className="relative">
                  {index > 0 && (
                    <div className="absolute left-5 -top-4 h-4 w-0.5 bg-[rgba(0,0,0,0.08)]" />
                  )}
                  <div className="p-4 bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] hover:border-[rgba(110,106,232,0.3)] transition-all">
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-10 h-10 rounded-[10px] flex items-center justify-center ${step.type === "email" ? "bg-blue-50" : "bg-green-50"}`}
                      >
                        {step.type === "email" ? (
                          <Mail className="w-5 h-5 text-blue-500" />
                        ) : (
                          <MessageSquare className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-[#6B7280]">
                            Step {index + 1}
                          </span>
                          {step.delay > 0 && (
                            <span className="text-xs bg-[rgba(110,106,232,0.08)] text-[#6E6AE8] px-2 py-0.5 rounded-[6px] flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {step.delay} days
                              delay
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-sm text-[#111111]">
                          {step.subject}
                        </p>
                        <p className="text-xs text-[#6B7280] capitalize">
                          {step.type}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleEditStep(step)}
                        className="text-sm text-[#6E6AE8] hover:text-[#5A56D4] transition-colors font-medium"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => handleAddStep()}
                className="w-full p-4 border-2 border-dashed border-[rgba(0,0,0,0.1)] rounded-[14px] text-[#6B7280] hover:border-[rgba(110,106,232,0.3)] hover:text-[#6E6AE8] transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Step
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          {/* Add Action card */}
          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6 shadow-sm">
            <h2 className="font-semibold text-[#111111] mb-4">Add Action</h2>
            <div className="space-y-2">
              {actionTypes.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleAddStep(action.id)}
                  className="w-full p-3 bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[12px] flex items-center gap-3 hover:border-[rgba(110,106,232,0.3)] hover:bg-[rgba(110,106,232,0.04)] transition-all text-left text-sm"
                >
                  <action.icon className="w-4 h-4 text-[#6B7280]" />
                  <span className="text-[#111111]">{action.name}</span>
                  <Plus className="w-4 h-4 text-[#6B7280] ml-auto" />
                </button>
              ))}
            </div>
          </div>

          {/* Settings card */}
          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6 shadow-sm">
            <h2 className="font-semibold text-[#111111] mb-4">Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#6B7280] mb-1.5">
                  Goal
                </label>
                <select
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.08)] rounded-[12px] px-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.4)] transition-colors"
                >
                  <option>Book consultation</option>
                  <option>Complete purchase</option>
                  <option>Reply to message</option>
                </select>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-[#111111]">
                  Exit on goal completion
                </span>
                <button
                  type="button"
                  onClick={() => setExitOnGoal((current) => !current)}
                  aria-pressed={exitOnGoal}
                  className={`w-10 h-5 rounded-full relative ${exitOnGoal ? "bg-[#6E6AE8]" : "bg-[rgba(0,0,0,0.1)]"}`}
                >
                  <div
                    className={`w-4 h-4 rounded-full absolute top-0.5 ${exitOnGoal ? "right-0.5 bg-white" : "left-0.5 bg-[#6B7280]"}`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-[#111111]">Send on weekends</span>
                <button
                  type="button"
                  onClick={() => setSendOnWeekends((current) => !current)}
                  aria-pressed={sendOnWeekends}
                  className={`w-10 h-5 rounded-full relative ${sendOnWeekends ? "bg-[#6E6AE8]" : "bg-[rgba(0,0,0,0.1)]"}`}
                >
                  <div
                    className={`w-4 h-4 rounded-full absolute top-0.5 ${sendOnWeekends ? "right-0.5 bg-white" : "left-0.5 bg-[#6B7280]"}`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
