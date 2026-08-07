"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api-client";
import type { FailedTaskMapping } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { AlertBanner, SkeletonLine } from "@/components/ui";

export default function ReconciliationPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [tasks, setTasks] = useState<FailedTaskMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    loadTasks();
  }, [token]);

  async function loadTasks() {
    if (!token) return;
    try {
      setLoading(true);
      setError("");
      const data = await api.clickup.listFailedTaskMappings(token);
      setTasks(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed tasks could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReplay(taskId: string) {
    if (!token) return;
    setReplayingId(taskId);
    setMessage(null);
    try {
      const response = await api.clickup.replayFailedTaskMapping(token, taskId);
      setMessage({ type: "success", text: response.message });
      setTasks((current) => current.filter((t) => t.id !== taskId));
    } catch (reason) {
      setMessage({ type: "error", text: reason instanceof Error ? reason.message : "Replay failed." });
    } finally {
      setReplayingId(null);
    }
  }

  async function handleDismiss(taskId: string) {
    if (!token) return;
    setDismissingId(taskId);
    setMessage(null);
    try {
      await api.clickup.dismissFailedTaskMapping(token, taskId);
      setMessage({ type: "success", text: "Task mapping dismissed." });
      setTasks((current) => current.filter((t) => t.id !== taskId));
    } catch (reason) {
      setMessage({ type: "error", text: reason instanceof Error ? reason.message : "Dismiss failed." });
    } finally {
      setDismissingId(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-[1320px] space-y-4 pb-12">
        <SkeletonLine className="h-10 w-1/3" />
        <SkeletonLine className="h-48 w-full" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1320px] space-y-4 pb-12">
      <Link href="/app/integrations/clickup" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-[#625FC7] hover:bg-[#EDEBFF]">
        <ArrowLeft className="h-4 w-4" /> Back to ClickUp mappings
      </Link>

      <header className="overflow-hidden rounded-3xl border border-black/[0.06] bg-[#FFFCF9] shadow-[0_14px_44px_rgba(49,45,90,0.07)]">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-center">
          <div className="flex min-w-0 gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF8EC] text-[#8A6428]">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A6428]">Reconciliation</p>
              <h1 className="mt-1.5 text-2xl font-semibold text-[#171615] sm:text-3xl">Failed ClickUp Tasks</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6C6761]">
                Review and replay task creation attempts that failed or were interrupted during the sync process.
              </p>
            </div>
          </div>
        </div>
      </header>

      {error && <AlertBanner variant="error" title="Could not load tasks" description={error} />}
      {message && (
        <AlertBanner 
          variant={message.type === "success" ? "success" : "error"} 
          title={message.type === "success" ? "Success" : "Action failed"} 
          description={message.text} 
        />
      )}

      <section className="rounded-3xl border border-black/[0.06] bg-[#FFFCF9] p-4 shadow-[0_10px_34px_rgba(49,45,90,0.05)] sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[#1E1C1A]">Needs Review ({tasks.length})</h2>
          <button onClick={loadTasks} className="inline-flex items-center gap-2 text-sm font-medium text-[#625FC7] hover:text-[#5A56D4]">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/[0.1] bg-[#F7F4F0] p-12 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-[#31735F]" />
            <h3 className="mt-4 text-sm font-semibold text-[#302D2A]">No failed tasks found</h3>
            <p className="mt-1 text-sm text-[#817B75]">All ClickUp mappings are up to date and active.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-black/[0.06] bg-white">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-black/[0.06] bg-[#F7F4F0] text-xs font-semibold uppercase tracking-[0.08em] text-[#625F5A]">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Task Title</th>
                  <th className="px-4 py-3">Attempted At</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {tasks.map((task) => {
                  const isReplaying = replayingId === task.id;
                  const isDismissing = dismissingId === task.id;
                  const isBusy = isReplaying || isDismissing;

                  return (
                    <tr key={task.id} className="transition hover:bg-[#FFFCF9]">
                      <td className="px-4 py-3 font-medium text-[#302D2A]">{task.clientName}</td>
                      <td className="px-4 py-3 text-[#302D2A]">
                        {task.internalTaskTitle}
                        <div className="text-[11px] text-[#817B75] mt-0.5">ID: {task.internalTaskId || 'Unknown'}</div>
                      </td>
                      <td className="px-4 py-3 text-[#817B75]">
                        {new Date(task.updatedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleDismiss(task.id)}
                            disabled={isBusy}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/[0.1] bg-white px-3 text-[11px] font-semibold text-[#8A6428] hover:bg-[#FFF8EC] disabled:opacity-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            {isDismissing ? "Dismissing..." : "Dismiss"}
                          </button>
                          <button
                            onClick={() => handleReplay(task.id)}
                            disabled={isBusy}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#171615] px-3 text-[11px] font-semibold text-white hover:bg-[#302E2B] disabled:opacity-50"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${isReplaying ? "animate-spin" : ""}`} />
                            {isReplaying ? "Replaying..." : "Replay"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
