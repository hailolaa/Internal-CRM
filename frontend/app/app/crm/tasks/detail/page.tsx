"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CalendarDays, CheckCircle2, Circle, Download, File, MessageSquare,
  Paperclip, Send, Tag, Trash2, Upload, UserRound, Activity as ActivityIcon,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type { InternalTaskRecord, TaskActivityRecord, TaskAttachmentRecord, TaskCommentRecord, TeamMember } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { AlertBanner, SkeletonLine } from "@/components/ui";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function label(value?: string | null) {
  return value ? value.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ") : "General";
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function fileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, bytes / 1024).toFixed(1)} KB`;
}

function activityLabel(action: string) {
  const labels: Record<string, string> = {
    INTERNAL_TASK_CREATED: "created this task",
    INTERNAL_TASK_UPDATED: "updated the task",
    INTERNAL_TASK_QA_UPDATED: "updated QA details",
    INTERNAL_TASK_ARCHIVED: "archived the task",
    TASK_COMMENT_CREATED: "added a comment",
    TASK_COMMENT_DELETED: "removed a comment",
    TASK_ATTACHMENT_UPLOADED: "uploaded a file",
    TASK_ATTACHMENT_DELETED: "removed a file",
  };
  return labels[action] || action.toLowerCase().replaceAll("_", " ");
}

export default function TaskDetailPage() {
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const taskId = searchParams.get("id") || "";
  const token = session?.token;
  const fileInput = useRef<HTMLInputElement>(null);
  const [task, setTask] = useState<InternalTaskRecord | null>(null);
  const [comments, setComments] = useState<TaskCommentRecord[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachmentRecord[]>([]);
  const [activity, setActivity] = useState<TaskActivityRecord[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [comment, setComment] = useState("");
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token || !taskId) return;
    setLoading(true);
    setError("");
    try {
      const [taskRecord, commentRecords, attachmentRecords, activityRecords, teamRecords] = await Promise.all([
        api.internalTasks.get(token, taskId), api.internalTasks.listComments(token, taskId),
        api.internalTasks.listAttachments(token, taskId), api.internalTasks.listActivity(token, taskId), api.team.getMembers(token),
      ]);
      setTask(taskRecord); setComments(commentRecords); setAttachments(attachmentRecords); setActivity(activityRecords);
      setMembers(teamRecords.filter((member) => !member.isInvitation && member.status === "active"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The task could not be loaded."); }
    finally { setLoading(false); }
  }, [taskId, token]);

  useEffect(() => { void load(); }, [load]);

  const selectedMembers = useMemo(() => members.filter((member) => mentionedIds.includes(member.id)), [members, mentionedIds]);
  const isDeliveryTask = searchParams.get("from") === "delivery" || Boolean(task?.clientAccountProfileId || task?.clientAccountServiceId);
  const backHref = isDeliveryTask ? "/app/ops/delivery" : "/app/crm/tasks";
  const backLabel = isDeliveryTask ? "Back to delivery work" : "Back to internal tasks";

  async function toggleStatus() {
    if (!token || !task) return;
    setBusy(true);
    try {
      const status = task.status === "completed" ? "pending" : "completed";
      await api.internalTasks.update(token, task.id, { status });
      setTask({ ...task, status });
      setActivity(await api.internalTasks.listActivity(token, task.id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The task could not be updated."); }
    finally { setBusy(false); }
  }

  async function submitComment() {
    if (!token || !task || !comment.trim()) return;
    setBusy(true);
    try {
      await api.internalTasks.addComment(token, task.id, comment, mentionedIds);
      setComment(""); setMentionedIds([]);
      const [nextComments, nextActivity] = await Promise.all([api.internalTasks.listComments(token, task.id), api.internalTasks.listActivity(token, task.id)]);
      setComments(nextComments); setActivity(nextActivity);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The comment could not be added."); }
    finally { setBusy(false); }
  }

  async function uploadFile(file?: File) {
    if (!token || !task || !file) return;
    setBusy(true);
    try {
      await api.internalTasks.uploadAttachment(token, task.id, file);
      const [nextFiles, nextActivity] = await Promise.all([api.internalTasks.listAttachments(token, task.id), api.internalTasks.listActivity(token, task.id)]);
      setAttachments(nextFiles); setActivity(nextActivity);
      if (fileInput.current) fileInput.current.value = "";
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The file could not be uploaded."); }
    finally { setBusy(false); }
  }

  async function downloadFile(attachment: TaskAttachmentRecord) {
    if (!token || !task) return;
    try {
      const result = await api.internalTasks.downloadAttachment(token, task.id, attachment.id);
      const url = URL.createObjectURL(result.blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = result.fileName || attachment.fileName; anchor.click(); URL.revokeObjectURL(url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The file could not be downloaded."); }
  }

  async function removeFile(attachment: TaskAttachmentRecord) {
    if (!token || !task || !window.confirm(`Remove ${attachment.fileName}?`)) return;
    setBusy(true);
    try { await api.internalTasks.deleteAttachment(token, task.id, attachment.id); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The file could not be removed."); }
    finally { setBusy(false); }
  }

  if (!taskId) return <AlertBanner variant="error" title="No task selected" description="Return to Internal Tasks and choose a task." />;

  return (
    <main className="mx-auto max-w-[1380px] space-y-5 pb-12">
      <Link href={backHref} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#625FC7] hover:bg-[#EDEBFF] focus:outline-none focus:ring-2 focus:ring-[#6E6AE8]">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>
      {error && <AlertBanner variant="error" title="Task workspace issue" description={error} />}
      {loading ? <div className="rounded-[28px] border border-black/[0.06] bg-[#FFFCF9] p-7"><SkeletonLine className="mb-4 h-8 w-1/2" /><SkeletonLine className="h-5 w-4/5" /></div> : task && <>
        <header className="relative overflow-hidden rounded-[30px] border border-black/[0.06] bg-[#FFFCF9] p-6 shadow-[0_14px_50px_rgba(49,45,90,0.08)] sm:p-8">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-[#6E6AE8]" />
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
            <div className="max-w-4xl">
              <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.12em]">
                <span className="rounded-full bg-[#EDEBFF] px-3 py-1.5 text-[#5A56D4]">{label(task.boardKey)}</span>
                <span className="rounded-full bg-[#F3F0EB] px-3 py-1.5 text-[#716B64]">{task.priority} priority</span>
                {task.serviceType && <span className="rounded-full bg-[#E7F5F0] px-3 py-1.5 text-[#31735F]">{label(task.serviceType)}</span>}
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[#171615] sm:text-4xl">{task.title}</h1>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#6C6761]">
                <span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-[#6E6AE8]" />{task.assignedTo || "Unassigned"}</span>
                <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#6E6AE8]" />{task.dueDate ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(task.dueDate)) : "No due date"}</span>
                {task.contact && <span>{task.contact}</span>}
              </div>
            </div>
            <button onClick={() => void toggleStatus()} disabled={busy} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${task.status === "completed" ? "bg-[#E7F5F0] text-[#31735F] focus:ring-[#31735F]" : "bg-[#171615] text-white hover:bg-[#302E2B] focus:ring-[#6E6AE8]"}`}>
              {task.status === "completed" ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}{task.status === "completed" ? "Completed" : "Mark complete"}
            </button>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
          <div className="space-y-5">
            <section className="rounded-[26px] border border-black/[0.06] bg-[#FFFCF9] p-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#8A837C]">Task brief</p>
              <div className="whitespace-pre-wrap text-[15px] leading-7 text-[#393633]">{task.description || "No brief has been added yet."}</div>
            </section>
            <section className="rounded-[26px] border border-black/[0.06] bg-[#FFFCF9] p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-semibold text-[#1E1C1A]"><MessageSquare className="h-5 w-5 text-[#6E6AE8]" /> Discussion</h2><span className="text-xs text-[#8A837C]">{comments.length} comments</span></div>
              <div className="space-y-5">
                {comments.length === 0 && <div className="rounded-2xl border border-dashed border-[#CFC9C1] px-5 py-8 text-center text-sm text-[#77716B]">No comments yet. Add the first update or question below.</div>}
                {comments.map((item) => <article key={item.id} className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EDEBFF] text-xs font-bold text-[#5A56D4]">{initials(item.authorName)}</div>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-[#F7F4F0] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-[#24211F]">{item.authorName}</p><time className="text-[11px] text-[#8A837C]">{formatDate(item.createdAt)}</time></div>
                    {item.deletedAt ? <p className="mt-2 text-sm italic text-[#8A837C]">Comment removed</p> : <><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4B4743]">{item.body}</p>{item.mentions.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{item.mentions.map((mention) => <span key={mention.userId} className="rounded-full bg-[#E7E5FF] px-2 py-1 text-[11px] font-semibold text-[#5A56D4]">@{mention.name}</span>)}</div>}</>}
                  </div>
                </article>)}
              </div>
              <div className="mt-6 border-t border-black/[0.06] pt-5">
                {selectedMembers.length > 0 && <div className="mb-3 flex flex-wrap gap-2">{selectedMembers.map((member) => <button key={member.id} onClick={() => setMentionedIds((ids) => ids.filter((id) => id !== member.id))} className="rounded-full bg-[#EDEBFF] px-3 py-1.5 text-xs font-semibold text-[#5A56D4]">@{[member.firstName, member.lastName].filter(Boolean).join(" ") || member.email} ×</button>)}</div>}
                <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} maxLength={10000} placeholder="Add an update, question, decision, or handoff…" className="w-full resize-y rounded-2xl border border-black/[0.1] bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#6E6AE8] focus:ring-4 focus:ring-[#6E6AE8]/10" />
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-[#625FC7]"><Tag className="h-4 w-4" /><span className="sr-only">Mention a team member</span><select value="" onChange={(event) => event.target.value && setMentionedIds((ids) => [...new Set([...ids, event.target.value])])} className="max-w-[230px] bg-transparent outline-none"><option value="">Tag a team member…</option>{members.filter((member) => !mentionedIds.includes(member.id)).map((member) => <option key={member.id} value={member.id}>{[member.firstName, member.lastName].filter(Boolean).join(" ") || member.email}</option>)}</select></label>
                  <button onClick={() => void submitComment()} disabled={busy || !comment.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#6E6AE8] px-5 text-sm font-semibold text-white hover:bg-[#5A56D4] focus:outline-none focus:ring-2 focus:ring-[#6E6AE8] focus:ring-offset-2 disabled:opacity-50"><Send className="h-4 w-4" /> Add comment</button>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-[26px] border border-black/[0.06] bg-[#FFFCF9] p-5">
              <div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold text-[#1E1C1A]"><Paperclip className="h-5 w-5 text-[#6E6AE8]" /> Files</h2><span className="text-xs text-[#8A837C]">{attachments.length}</span></div>
              <input ref={fileInput} type="file" className="hidden" onChange={(event) => void uploadFile(event.target.files?.[0])} />
              <button onClick={() => fileInput.current?.click()} disabled={busy} className="mb-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#A9A4E9] bg-[#F5F4FF] text-sm font-semibold text-[#5A56D4] hover:bg-[#EDEBFF] disabled:opacity-50"><Upload className="h-4 w-4" /> Upload a file <span className="font-normal text-[#817DCB]">(max 20 MB)</span></button>
              <div className="space-y-2">{attachments.map((item) => <div key={item.id} className="group flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white p-3"><div className="rounded-xl bg-[#F3F0EB] p-2"><File className="h-4 w-4 text-[#706A63]" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[#302D2A]">{item.fileName}</p><p className="text-[11px] text-[#8A837C]">{item.uploadedByName} · {fileSize(item.sizeBytes)}</p></div><button onClick={() => void downloadFile(item)} aria-label={`Download ${item.fileName}`} className="rounded-lg p-2 text-[#6E6AE8] hover:bg-[#EDEBFF]"><Download className="h-4 w-4" /></button><button onClick={() => void removeFile(item)} aria-label={`Remove ${item.fileName}`} className="rounded-lg p-2 text-[#A45A54] hover:bg-[#FDECEA]"><Trash2 className="h-4 w-4" /></button></div>)}</div>
            </section>
            <section className="rounded-[26px] border border-black/[0.06] bg-[#FFFCF9] p-5">
              <h2 className="mb-5 flex items-center gap-2 font-semibold text-[#1E1C1A]"><ActivityIcon className="h-5 w-5 text-[#6E6AE8]" /> Activity</h2>
              <ol className="relative ml-2 space-y-5 border-l border-[#DCD7D0] pl-5">{activity.map((item) => <li key={item.id} className="relative"><span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-[#6E6AE8] ring-4 ring-[#F1EFFF]" /><p className="text-sm leading-5 text-[#4B4743]"><strong className="font-semibold text-[#282522]">{item.actorName}</strong> {activityLabel(item.action)}</p><time className="mt-1 block text-[11px] text-[#8A837C]">{formatDate(item.createdAt)}</time></li>)}</ol>
            </section>
          </aside>
        </div>
      </>}
    </main>
  );
}
