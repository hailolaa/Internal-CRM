"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Mail,
  MessageSquare,
  Bold,
  Italic,
  Link as LinkIcon,
  Image as ImageIcon,
  Variable,
} from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

const variables = [
  { name: "first_name", label: "First Name" },
  { name: "workspace_name", label: "Workspace Name" },
  { name: "service_package", label: "Service / Package" },
  { name: "meeting_date", label: "Meeting Date" },
  { name: "meeting_time", label: "Meeting Time" },
];

export default function NewTemplatePage() {
  const router = useRouter();
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("Sales Follow-up");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const insertVariable = (variableName: string) => {
    setBody((value) => `${value}${value ? " " : ""}{{${variableName}}}`);
  };

  const wrapSelection = (before: string, after = before) => {
    const selection =
      typeof window !== "undefined" ? window.getSelection()?.toString() || "" : "";
    setBody((value) => `${value}${value ? " " : ""}${before}${selection || "text"}${after}`);
  };

  const insertLink = () => {
    const url = window.prompt("Link URL", "https://");
    if (!url) return;
    setBody((value) => `${value}${value ? " " : ""}${url}`);
  };

  const handleSave = async () => {
    if (!session?.token) return;

    if (!name.trim() || !body.trim()) {
      setStatusMessage("Template name and message are required.");
      return;
    }

    try {
      setIsSaving(true);
      await api.messageTemplates.create(session.token, {
        name,
        channel,
        subject: channel === "email" ? subject || category : category,
        body,
        status: "draft",
      });
      router.push("/app/comms/templates");
    } catch (error) {
      console.error("Failed to create template", error);
      setStatusMessage("Could not save template.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/app/comms/templates"
          className="p-2 rounded-[10px] hover:bg-[rgba(110,106,232,0.06)] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#111111]">Create Template</h1>
          <p className="text-[#6B7280] text-sm">
            Build a reusable message template
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#6E6AE8] hover:bg-[#5A56D4] text-white font-medium px-4 py-2.5 rounded-[14px] flex items-center gap-2 transition-colors shadow-sm disabled:opacity-60"
        >
          <Save className="w-4 h-4" />{" "}
          {isSaving ? "Saving..." : "Save Template"}
        </button>
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6 shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#6B7280] mb-1.5">
                  Template Name
                </label>
                <input
                  type="text"
                    placeholder="e.g. Discovery Call Follow-up"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.08)] rounded-[12px] px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[rgba(110,106,232,0.4)] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-[#6B7280] mb-1.5">
                  Channel
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setChannel("email")}
                    className={`flex-1 p-3 rounded-[12px] flex items-center justify-center gap-2 transition-all text-sm font-medium ${
                      channel === "email"
                        ? "bg-blue-50 border border-blue-200 text-blue-600"
                        : "bg-[#FAF8F5] border border-[rgba(0,0,0,0.08)] text-[#6B7280] hover:border-[rgba(0,0,0,0.14)]"
                    }`}
                  >
                    <Mail className="w-4 h-4" /> Email
                  </button>
                  <button
                    onClick={() => setChannel("sms")}
                    className={`flex-1 p-3 rounded-[12px] flex items-center justify-center gap-2 transition-all text-sm font-medium ${
                      channel === "sms"
                        ? "bg-green-50 border border-green-200 text-green-600"
                        : "bg-[#FAF8F5] border border-[rgba(0,0,0,0.08)] text-[#6B7280] hover:border-[rgba(0,0,0,0.14)]"
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" /> SMS
                  </button>
                </div>
              </div>
              {channel === "email" && (
                <div>
                  <label className="block text-sm text-[#6B7280] mb-1.5">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Your discovery call is confirmed"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.08)] rounded-[12px] px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[rgba(110,106,232,0.4)] transition-colors"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-[#6B7280] mb-1.5">
                  Message
                </label>
                <div className="bg-[#FAF8F5] border border-[rgba(0,0,0,0.08)] rounded-[12px] overflow-hidden focus-within:border-[rgba(110,106,232,0.4)] transition-colors">
                  <div className="flex items-center gap-1 p-2 border-b border-[rgba(0,0,0,0.06)]">
                    <button
                      type="button"
                      onClick={() => wrapSelection("**")}
                      aria-label="Bold text"
                      className="p-1.5 rounded-[8px] hover:bg-[rgba(110,106,232,0.06)] transition-colors"
                    >
                      <Bold className="w-4 h-4 text-[#6B7280]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => wrapSelection("_")}
                      aria-label="Italic text"
                      className="p-1.5 rounded-[8px] hover:bg-[rgba(110,106,232,0.06)] transition-colors"
                    >
                      <Italic className="w-4 h-4 text-[#6B7280]" />
                    </button>
                    <button
                      type="button"
                      onClick={insertLink}
                      aria-label="Insert link"
                      className="p-1.5 rounded-[8px] hover:bg-[rgba(110,106,232,0.06)] transition-colors"
                    >
                      <LinkIcon className="w-4 h-4 text-[#6B7280]" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setStatusMessage(
                          "Image attachments are not integrated because the backend template API stores text content only.",
                        )
                      }
                      aria-label="Insert image"
                      className="p-1.5 rounded-[8px] hover:bg-[rgba(110,106,232,0.06)] transition-colors"
                    >
                      <ImageIcon className="w-4 h-4 text-[#6B7280]" />
                    </button>
                    <div className="w-px h-4 bg-[rgba(0,0,0,0.08)] mx-1" />
                    <button
                      type="button"
                      onClick={() => insertVariable("first_name")}
                      aria-label="Insert variable"
                      className="p-1.5 rounded-[8px] hover:bg-[rgba(110,106,232,0.06)] transition-colors flex items-center gap-1 text-xs text-[#6B7280]"
                    >
                      <Variable className="w-4 h-4" /> Insert Variable
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    placeholder={`Hi {{first_name}},\n\nThanks for speaking with The Growth Group.\n\nNext step:\n- Service: {{service_package}}\n- Date: {{meeting_date}}\n- Time: {{meeting_time}}\n\nBest regards,\nThe {{workspace_name}} Team`}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    className="w-full bg-transparent px-4 py-3 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none resize-none"
                  />
                </div>
                {channel === "sms" && (
                  <p className="text-xs text-[#6B7280] mt-1">
                    160 characters remaining
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6 shadow-sm">
            <h2 className="font-semibold text-[#111111] mb-4">Variables</h2>
            <p className="text-xs text-[#6B7280] mb-3">
              Click to insert into message
            </p>
            <div className="space-y-2">
              {variables.map((v) => (
                <button
                  key={v.name}
                  onClick={() => insertVariable(v.name)}
                  className="w-full p-2 bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[10px] flex items-center justify-between hover:border-[rgba(110,106,232,0.3)] hover:bg-[rgba(110,106,232,0.04)] transition-all text-sm"
                >
                  <span className="text-[#6B7280]">{v.label}</span>
                  <code className="text-xs text-[#6E6AE8]">{`{{${v.name}}}`}</code>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6 shadow-sm">
            <h2 className="font-semibold text-[#111111] mb-4">Category</h2>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.08)] rounded-[12px] px-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.4)] transition-colors"
            >
              <option>Sales Follow-up</option>
              <option>Discovery Call</option>
              <option>Proposal</option>
              <option>Reminder</option>
              <option>Follow-up</option>
              <option>Client Delivery</option>
            </select>
          </div>

          <div className="bg-[rgba(110,106,232,0.05)] border border-[rgba(110,106,232,0.14)] rounded-[24px] p-6">
            <h2 className="font-semibold text-[#111111] mb-2">Preview</h2>
            <p className="text-xs text-[#6B7280] mb-4">
              See how your message will look
            </p>
            <button
              onClick={() =>
                setStatusMessage(
                  body || "Add message copy to preview this template.",
                )
              }
              className="w-full bg-[rgba(110,106,232,0.08)] text-[#6E6AE8] border border-[rgba(110,106,232,0.2)] py-2 rounded-[12px] text-sm font-medium hover:bg-[rgba(110,106,232,0.14)] transition-colors"
            >
              Send Test Message
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
