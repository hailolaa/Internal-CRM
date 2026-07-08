"use client";

import { useState } from "react";
import { X, Phone, Clock, User, FileText, Headphones, Sparkles, Send, Save, Loader2 } from "lucide-react";
import type { CallRecord } from "@/lib/call-data";
import { formatCallDuration } from "@/lib/call-data";
import {
  CallDirectionBadge,
  CallOutcomeBadge,
  CallDispositionBadge,
  CallDuration,
} from "./call-badges";

export function CallDetailPanel({
  call,
  onClose,
  onSaveNotes,
  onGenerateIntelligence,
  onTranscribe,
  onFollowUp,
  actionKey,
  actionError,
  actionMessage,
}: {
  call: CallRecord;
  onClose: () => void;
  onSaveNotes: (call: CallRecord, notes: string) => Promise<void>;
  onGenerateIntelligence: (call: CallRecord) => Promise<void>;
  onTranscribe: (call: CallRecord) => Promise<void>;
  onFollowUp: (call: CallRecord) => Promise<void>;
  actionKey?: string;
  actionError?: string;
  actionMessage?: string;
}) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(call.notes || "");
  const isSavingNotes = actionKey === "notes";
  const isGenerating = actionKey === "generate";
  const isTranscribing = actionKey === "transcribe";
  const isFollowingUp = actionKey === "follow-up";

  const handleSaveNotes = async () => {
    await onSaveNotes(call, notesDraft);
    setIsEditingNotes(false);
  };

  return (
    <div
      className="rounded-2xl overflow-hidden animate-fade-in"
      style={{
        backgroundColor: "#FFFCF9",
        border: "1px solid #E5DED6",
        boxShadow: "0 2px 12px rgba(37, 36, 33, 0.06)",
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid #E5DED6" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 text-[#FFFCF9]"
            style={{ background: "linear-gradient(135deg, #3A3834, #7D8F7A)" }}
          >
            {call.contactAvatar}
          </div>
          <div>
            <p className="font-semibold" style={{ color: "#252421" }}>
              {call.contactName}
            </p>
            <p className="text-xs" style={{ color: "#A8A39B" }}>
              {call.phone}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg transition-colors hover:bg-[#F7F5F2]"
        >
          <X className="w-4 h-4 text-[#A8A39B]" />
        </button>
      </div>

      {/* Meta grid */}
      <div className="p-5 grid grid-cols-2 gap-4">
        <DetailItem icon={Phone} label="Direction">
          <CallDirectionBadge direction={call.direction} />
        </DetailItem>
        <DetailItem icon={Phone} label="Outcome">
          <CallOutcomeBadge outcome={call.outcome} />
        </DetailItem>
        <DetailItem icon={Clock} label="Duration">
          <CallDuration seconds={call.duration} />
        </DetailItem>
        <DetailItem icon={User} label="Handled by">
          <span className="text-sm" style={{ color: "#252421" }}>
            {call.assignedTo}
          </span>
        </DetailItem>
        <DetailItem icon={FileText} label="Treatment">
          <span className="text-sm" style={{ color: "#252421" }}>
            {call.treatment}
          </span>
        </DetailItem>
        <DetailItem icon={FileText} label="Disposition">
          <CallDispositionBadge disposition={call.disposition} />
        </DetailItem>
      </div>

      {/* Notes */}
      <div className="px-5 pb-4">
        <div className="mb-2 flex items-center justify-between">
          <p
            className="text-xs uppercase tracking-wider"
            style={{ color: "#A8A39B" }}
          >
            Notes
          </p>
          {!isEditingNotes && (
            <button
              onClick={() => setIsEditingNotes(true)}
              className="text-xs font-medium text-[#5A8A6A]"
            >
              Edit
            </button>
          )}
        </div>
        {isEditingNotes ? (
          <div className="space-y-2">
            <textarea
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
              rows={4}
              className="w-full resize-none rounded-xl border border-[#E5DED6] bg-[#FFFCF9] p-3 text-sm text-[#252421] outline-none focus:border-[#7D8F7A]"
              placeholder="Add notes from the live call record..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setNotesDraft(call.notes || "");
                  setIsEditingNotes(false);
                }}
                className="btn-secondary text-xs"
                disabled={isSavingNotes}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                className="btn-primary text-xs"
                disabled={isSavingNotes}
              >
                {isSavingNotes ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" /> Save Note
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div
            className="p-3 rounded-xl text-sm leading-relaxed"
            style={{
              backgroundColor: "#F7F5F2",
              border: "1px solid #E5DED6",
              color: "#5F5A52",
            }}
          >
            {call.notes || "No notes saved for this call yet."}
          </div>
        )}
      </div>

      {(call.aiSummary || call.transcript || call.qualityScore !== undefined) && (
        <div className="px-5 pb-4">
          <p
            className="text-xs uppercase tracking-wider mb-2"
            style={{ color: "#A8A39B" }}
          >
            AI Intelligence
          </p>
          <div
            className="space-y-2 rounded-xl p-3 text-sm leading-relaxed"
            style={{
              backgroundColor: "rgba(90, 138, 106, 0.06)",
              border: "1px solid rgba(90, 138, 106, 0.18)",
              color: "#425246",
            }}
          >
            {call.aiSummary && <p>{call.aiSummary}</p>}
            <div className="flex flex-wrap gap-2 text-xs">
              {call.qualityScore !== null && call.qualityScore !== undefined && (
                <span>Quality: {call.qualityScore}/100</span>
              )}
              {call.bookingIntent && <span>Intent: {call.bookingIntent}</span>}
              {call.sentiment && <span>Sentiment: {call.sentiment}</span>}
            </div>
            {call.transcript && (
              <details>
                <summary className="cursor-pointer font-medium">Transcript</summary>
                <p className="mt-2 whitespace-pre-wrap">{call.transcript}</p>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Recording */}
      {call.recordingUrl && (
        <div className="px-5 pb-5">
          <p
            className="text-xs uppercase tracking-wider mb-2"
            style={{ color: "#A8A39B" }}
          >
            Recording
          </p>
          <div
            className="p-3 rounded-xl flex items-center gap-3"
            style={{ backgroundColor: "#F7F5F2", border: "1px solid #E5DED6" }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: "rgba(90, 138, 106, 0.1)",
                border: "1px solid rgba(90, 138, 106, 0.2)",
              }}
            >
              <Headphones className="w-4 h-4 text-[#5A8A6A]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "#252421" }}>
                Call Recording
              </p>
              <p className="text-xs" style={{ color: "#A8A39B" }}>
                {formatCallDuration(call.duration)}
              </p>
            </div>
            <a
              href={call.recordingUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: "rgba(90, 138, 106, 0.1)",
                color: "#5A8A6A",
                border: "1px solid rgba(90, 138, 106, 0.2)",
              }}
            >
              Play
            </a>
          </div>
        </div>
      )}

      {(actionError || actionMessage) && (
        <div className="px-5 pb-4">
          <div
            className="rounded-xl px-3 py-2 text-sm"
            style={{
              backgroundColor: actionError ? "rgba(154, 85, 36, 0.08)" : "rgba(90, 138, 106, 0.08)",
              border: actionError ? "1px solid rgba(154, 85, 36, 0.18)" : "1px solid rgba(90, 138, 106, 0.18)",
              color: actionError ? "#7A4B24" : "#425246",
            }}
          >
            {actionError || actionMessage}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="px-5 pb-5 grid grid-cols-2 gap-2">
        <a
          href={`tel:${call.phone}`}
          className="flex-1 py-2 text-sm rounded-xl flex items-center justify-center gap-1 transition-colors"
          style={{
            backgroundColor: "#F7F5F2",
            border: "1px solid #E5DED6",
            color: "#7A746A",
          }}
        >
          <Phone className="w-3.5 h-3.5" /> Call Back
        </a>
        <button
          onClick={() => setIsEditingNotes(true)}
          className="flex-1 py-2 text-sm rounded-xl flex items-center justify-center gap-1 transition-colors"
          style={{
            backgroundColor: "rgba(90, 138, 106, 0.08)",
            border: "1px solid rgba(90, 138, 106, 0.2)",
            color: "#5A8A6A",
          }}
        >
          <FileText className="w-3.5 h-3.5" /> Add Note
        </button>
        {call.recordingUrl && (
          <button
            onClick={() => onTranscribe(call)}
            disabled={isTranscribing}
            className="flex-1 py-2 text-sm rounded-xl flex items-center justify-center gap-1 transition-colors disabled:opacity-60"
            style={{
              backgroundColor: "#F7F5F2",
              border: "1px solid #E5DED6",
              color: "#7A746A",
            }}
          >
            {isTranscribing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Headphones className="w-3.5 h-3.5" />
            )}
            Transcribe
          </button>
        )}
        <button
          onClick={() => onGenerateIntelligence(call)}
          disabled={isGenerating}
          className="flex-1 py-2 text-sm rounded-xl flex items-center justify-center gap-1 transition-colors disabled:opacity-60"
          style={{
            backgroundColor: "rgba(90, 138, 106, 0.08)",
            border: "1px solid rgba(90, 138, 106, 0.2)",
            color: "#5A8A6A",
          }}
        >
          {isGenerating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          Generate AI
        </button>
        {call.missedCall && (
          <button
            onClick={() => onFollowUp(call)}
            disabled={isFollowingUp}
            className="col-span-2 py-2 text-sm rounded-xl flex items-center justify-center gap-1 transition-colors disabled:opacity-60"
            style={{
              backgroundColor: "rgba(154, 85, 36, 0.08)",
              border: "1px solid rgba(154, 85, 36, 0.18)",
              color: "#7A4B24",
            }}
          >
            {isFollowingUp ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Queue Missed-Call Follow-up
          </button>
        )}
      </div>
    </div>
  );
}

function DetailItem({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className="text-xs flex items-center gap-1 mb-1"
        style={{ color: "#A8A39B" }}
      >
        <Icon className="w-3 h-3" /> {label}
      </p>
      {children}
    </div>
  );
}
