"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, Send, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import type { AiChatMessageRecord, AiChatSessionDetail, AiChatSessionRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

function guardrailLabel(message: AiChatMessageRecord) {
  if (message.role !== "assistant" || !message.guardrailStatus) return null;
  if (message.guardrailStatus === "answered") return { text: "Answered from Mission Control", tone: "success" as const };
  if (message.guardrailStatus === "refused") return { text: "Refused by guardrail", tone: "danger" as const };
  return { text: "Escalation recommended", tone: "warning" as const };
}

export default function ControlledAssistantPage() {
  const { session, hasPermission } = useAuth();
  const token = session?.token;
  const canUseAssistant = hasPermission("ai_assistant:use");
  const [sessions, setSessions] = useState<AiChatSessionRecord[]>([]);
  const [activeSession, setActiveSession] = useState<AiChatSessionDetail | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !canUseAssistant) return;
    let cancelled = false;
    api.ai
      .listChatSessions(token)
      .then((rows) => {
        if (!cancelled) setSessions(rows);
      })
      .catch(() => {
        if (!cancelled) setError("Assistant history could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [canUseAssistant, token]);

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !message.trim() || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const next = activeSession
        ? await api.ai.addChatMessage(token, activeSession.id, { message: message.trim() })
        : await api.ai.createChatSession(token, { message: message.trim() });
      setActiveSession(next);
      setMessage("");
      setSessions((current) => {
        const withoutCurrent = current.filter((item) => item.id !== next.id);
        const sessionSummary: AiChatSessionRecord = {
          id: next.id,
          title: next.title,
          status: next.status,
          createdBy: next.createdBy,
          createdAt: next.createdAt,
          updatedAt: next.updatedAt,
          messageCount: next.messages.length,
        };
        return [{ ...sessionSummary, messageCount: next.messages.length }, ...withoutCurrent];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The assistant could not respond.");
    } finally {
      setIsLoading(false);
    }
  };

  const openSession = async (sessionId: string) => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      setActiveSession(await api.ai.getChatSession(token, sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversation could not be opened.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!canUseAssistant) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        You do not have access to the controlled Mission Control assistant.
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#151F21] md:text-3xl">Controlled Assistant</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5E6E70]">
          Ask for read-only Mission Control summaries. The assistant refuses secrets and routes write actions to human approval.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#151F21]">
            <Bot className="h-4 w-4 text-[#4A9A95]" />
            Conversations
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setActiveSession(null)}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-left text-sm font-semibold text-[#315F5C] hover:bg-[#FAF9F7]"
            >
              New conversation
            </button>
            {sessions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openSession(item.id)}
                className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-[#FAF9F7]"
              >
                <span className="block truncate font-medium text-[#151F21]">{item.title}</span>
                <span className="text-xs text-[#5E6E70]">{item.messageCount} messages</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-2xl border border-[#E5E7EB] bg-white">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
            <div>
              <h2 className="font-semibold text-[#151F21]">{activeSession?.title || "New Mission Control question"}</h2>
              <p className="text-xs text-[#5E6E70]">Read-only answers with visible guardrails and citations.</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-[#4A9A95]" />
          </div>

          {error && (
            <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="min-h-[420px] space-y-4 p-5">
            {activeSession?.messages.length ? (
              activeSession.messages.map((item) => {
                const label = guardrailLabel(item);
                return (
                  <div key={item.id} className={item.role === "user" ? "ml-auto max-w-2xl" : "mr-auto max-w-3xl"}>
                    <div
                      className={[
                        "rounded-2xl px-4 py-3 text-sm leading-6",
                        item.role === "user" ? "bg-[#151F21] text-white" : "border border-[#E5E7EB] bg-[#FAF9F7] text-[#151F21]",
                      ].join(" ")}
                    >
                      {item.body}
                    </div>
                    {label && (
                      <div
                        className={[
                          "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
                          label.tone === "success"
                            ? "bg-emerald-50 text-emerald-700"
                            : label.tone === "danger"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700",
                        ].join(" ")}
                      >
                        {label.tone === "success" ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        {label.text}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-[#D8DEDF] p-6 text-sm leading-6 text-[#5E6E70]">
                Try asking: &quot;What needs attention across clients, proposals and overdue tasks?&quot;
              </div>
            )}
          </div>

          <form onSubmit={submitMessage} className="border-t border-[#E5E7EB] p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={2}
                maxLength={2000}
                className="min-h-[52px] flex-1 rounded-xl border border-[#D8DEDF] px-3 py-2 text-sm text-[#151F21] outline-none focus:border-[#4A9A95] focus:ring-2 focus:ring-[#60B4AF]/20"
                placeholder="Ask a read-only Mission Control question"
              />
              <button
                type="submit"
                disabled={!message.trim() || isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#151F21] px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {isLoading ? "Checking" : "Ask"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
