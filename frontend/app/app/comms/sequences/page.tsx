"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCw,
  UserPlus,
  Zap,
} from "lucide-react";
import {
  PageHeader,
  Card,
  StatusBadge,
  SearchInput,
  ProgressBar,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import type {
  ContactRecord,
  SequenceEnrollmentRecord,
  SequenceRecord,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

export default function SequencesPage() {
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.token;
  const [searchQuery, setSearchQuery] = useState("");
  const [sequences, setSequences] = useState<SequenceRecord[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [enrollmentsBySequence, setEnrollmentsBySequence] = useState<
    Record<string, SequenceEnrollmentRecord[]>
  >({});
  const [selectedContacts, setSelectedContacts] = useState<Record<string, string>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const loadEnrollmentState = async (authToken: string, rows: SequenceRecord[]) => {
    const entries = await Promise.all(
      rows.map(async (sequence) => {
        try {
          const enrollments = await api.sequences.listEnrollments(
            authToken,
            sequence.id,
          );
          return [sequence.id, enrollments] as const;
        } catch {
          return [sequence.id, []] as const;
        }
      }),
    );
    setEnrollmentsBySequence(Object.fromEntries(entries));
  };

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const authToken = token;

    async function loadSequences() {
      try {
        const [rows, contactResult] = await Promise.all([
          api.sequences.list(authToken),
          api.contacts.list(authToken, { pageSize: 50 }),
        ]);
        if (!cancelled) {
          setSequences(rows);
          setContacts(contactResult.contacts);
          await loadEnrollmentState(authToken, rows);
          setStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load sequences", error);
        if (!cancelled) {
          setSequences([]);
          setStatusMessage(
            error instanceof Error
              ? error.message
              : "Unable to load live sequences.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadSequences();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const filteredSequences = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    if (!search) return sequences;
    return sequences.filter((sequence) =>
      [sequence.name, sequence.triggerLabel, sequence.status].some((value) =>
        value.toLowerCase().includes(search),
      ),
    );
  }, [searchQuery, sequences]);

  const handleToggleSequence = async (sequence: SequenceRecord) => {
    if (!token) return;
    const status = sequence.status === "active" ? "paused" : "active";

    try {
      await api.sequences.update(token, sequence.id, { status });
      setSequences((items) =>
        items.map((item) =>
          item.id === sequence.id ? { ...item, status } : item,
        ),
      );
    } catch (error) {
      console.error("Failed to update sequence", error);
      setStatusMessage("Could not update sequence.");
    }
  };

  const handleEnroll = async (sequence: SequenceRecord) => {
    if (!token || pendingAction) return;
    const contactId = selectedContacts[sequence.id];
    if (!contactId) {
      setStatusMessage("Choose a contact before enrolling them.");
      return;
    }

    setPendingAction(`enroll:${sequence.id}`);
    setStatusMessage("Enrolling contact...");
    try {
      const enrollment = await api.sequences.enroll(token, sequence.id, contactId);
      setEnrollmentsBySequence((current) => ({
        ...current,
        [sequence.id]: [
          enrollment,
          ...(current[sequence.id] || []).filter((row) => row.id !== enrollment.id),
        ],
      }));
      setSequences((items) =>
        items.map((item) =>
          item.id === sequence.id
            ? {
                ...item,
                enrolledCount: item.enrolledCount + 1,
                activeEnrollmentCount: (item.activeEnrollmentCount || 0) + 1,
              }
            : item,
        ),
      );
      setStatusMessage(`${enrollment.contactName} enrolled in ${sequence.name}.`);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not enroll contact.",
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleUnenroll = async (
    sequence: SequenceRecord,
    enrollment: SequenceEnrollmentRecord,
  ) => {
    if (!token || pendingAction) return;

    setPendingAction(`unenroll:${enrollment.id}`);
    setStatusMessage("Removing enrollment...");
    try {
      const updated = await api.sequences.unenroll(
        token,
        sequence.id,
        enrollment.id,
      );
      setEnrollmentsBySequence((current) => ({
        ...current,
        [sequence.id]: (current[sequence.id] || []).map((row) =>
          row.id === updated.id ? updated : row,
        ),
      }));
      setSequences((items) =>
        items.map((item) =>
          item.id === sequence.id
            ? {
                ...item,
                activeEnrollmentCount: Math.max(
                  (item.activeEnrollmentCount || 0) - 1,
                  0,
                ),
              }
            : item,
        ),
      );
      setStatusMessage(`${updated.contactName} unenrolled from ${sequence.name}.`);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not unenroll contact.",
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleRunDue = async () => {
    if (!token || pendingAction) return;

    setPendingAction("run-due");
    setStatusMessage("Running due sequence steps...");
    try {
      const result = await api.sequences.runDue(token);
      const rows = await api.sequences.list(token);
      setSequences(rows);
      await loadEnrollmentState(token, rows);
      setStatusMessage(
        `Sequence runner processed ${result.processed}; sent ${result.sent}, skipped ${result.skipped}, failed ${result.failed}.`,
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not run due sequence steps.",
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleMoreSequence = async (sequence: SequenceRecord) => {
    if (!token) return;
    if (!window.confirm(`Archive ${sequence.name}?`)) return;

    try {
      await api.sequences.update(token, sequence.id, {
        status: "archived",
      });
      setSequences((items) =>
        items.map((item) =>
          item.id === sequence.id ? { ...item, status: "archived" } : item,
        ),
      );
    } catch (error) {
      console.error("Failed to archive sequence", error);
      setStatusMessage("Could not archive sequence.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sequences"
        subtitle="Automated drip campaigns and follow-up sequences."
        right={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void handleRunDue()}
              disabled={pendingAction === "run-due"}
              className="btn-secondary"
            >
              {pendingAction === "run-due" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCw className="w-4 h-4" />
              )}
              Run Due Steps
            </button>
            <button
              onClick={() => router.push("/app/comms/sequences/new")}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" /> Create Sequence
            </button>
          </div>
        }
      />

      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search sequences..."
        className="max-w-md"
      />

      {statusMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      <div className="rounded-lg border border-[rgba(110,106,232,0.14)] bg-[rgba(110,106,232,0.06)] px-4 py-3 text-sm text-[#5A56D4]">
        Sequence enrollment and due-step execution are wired to the backend.
        Email/SMS steps run through the communication tables with opt-out,
        timezone, weekend, and duplicate-send safeguards.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <div className="space-y-4">
                <div className="h-12 rounded-[14px] bg-[rgba(110,106,232,0.08)] animate-pulse" />
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-10 rounded-[12px] bg-[rgba(110,106,232,0.08)] animate-pulse" />
                  <div className="h-10 rounded-[12px] bg-[rgba(110,106,232,0.08)] animate-pulse" />
                  <div className="h-10 rounded-[12px] bg-[rgba(110,106,232,0.08)] animate-pulse" />
                </div>
                <div className="h-8 rounded-[12px] bg-[rgba(110,106,232,0.08)] animate-pulse" />
              </div>
            </Card>
          ))
        ) : filteredSequences.length ? (
          filteredSequences.map((seq) => {
          const completionRate = seq.enrolledCount
            ? Math.round((seq.completedCount / seq.enrolledCount) * 100)
            : 0;
          const enrollments = enrollmentsBySequence[seq.id] || [];
          const activeEnrollments = enrollments.filter(
            (enrollment) => enrollment.status === "active",
          );
          const contactSelectId = `sequence-contact-${seq.id}`;

          return (
          <Card key={seq.id} hover>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-[12px] flex items-center justify-center"
                  style={{ backgroundColor: "rgba(110, 106, 232, 0.08)" }}
                >
                  <Zap className="w-5 h-5 text-[#6E6AE8]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#111111]">{seq.name}</h3>
                  <p className="text-xs text-[#6B7280]">{seq.triggerLabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggleSequence(seq)}
                  aria-label={
                    seq.status === "active"
                      ? `Pause ${seq.name}`
                      : `Resume ${seq.name}`
                  }
                  className="p-1.5 rounded-[10px] hover:bg-[rgba(110,106,232,0.06)] transition-colors"
                >
                  {seq.status === "active" ? (
                    <Pause className="w-4 h-4 text-[#6B7280]" />
                  ) : (
                    <Play className="w-4 h-4 text-[#6B7280]" />
                  )}
                </button>
                <button
                  onClick={() => handleMoreSequence(seq)}
                  aria-label={`More options for ${seq.name}`}
                  className="p-1.5 rounded-[10px] hover:bg-[rgba(110,106,232,0.06)] transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4 text-[#6B7280]" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs text-[#6B7280]">Steps</p>
                <p className="font-semibold text-[#111111]">
                  {seq.steps.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">Enrolled</p>
                <p className="font-semibold text-[#111111]">
                  {seq.enrolledCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">Completed</p>
                <p className="font-semibold text-[#111111]">
                  {seq.completedCount}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <StatusBadge status={seq.status} />
              <div className="flex items-center gap-2 flex-1 mx-4">
                <ProgressBar
                  value={seq.completedCount}
                  max={seq.enrolledCount || 1}
                  color="violet"
                />
              </div>
              <span className="text-xs text-[#6B7280]">{completionRate}%</span>
            </div>
            <div className="mt-4 border-t border-[rgba(0,0,0,0.06)] pt-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  id={contactSelectId}
                  name={contactSelectId}
                  aria-label={`Select contact for ${seq.name}`}
                  value={selectedContacts[seq.id] || ""}
                  onChange={(event) =>
                    setSelectedContacts((current) => ({
                      ...current,
                      [seq.id]: event.target.value,
                    }))
                  }
                  className="min-w-0 flex-1 rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-[#FAF8F5] px-3 py-2 text-sm text-[#111111] outline-none focus:border-[rgba(110,106,232,0.4)]"
                  disabled={seq.status !== "active"}
                >
                  <option value="">Select contact</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleEnroll(seq)}
                  disabled={
                    seq.status !== "active" ||
                    pendingAction === `enroll:${seq.id}` ||
                    !selectedContacts[seq.id]
                  }
                  className="rounded-[12px] bg-[rgba(110,106,232,0.08)] px-3 py-2 text-sm font-medium text-[#6E6AE8] transition-colors hover:bg-[rgba(110,106,232,0.15)] disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-2">
                    {pendingAction === `enroll:${seq.id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    Enroll
                  </span>
                </button>
              </div>

              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-[#6B7280]">
                  Active enrollments: {activeEnrollments.length}
                </p>
                {activeEnrollments.slice(0, 3).map((enrollment) => (
                  <div
                    key={enrollment.id}
                    className="flex items-center justify-between gap-3 rounded-[12px] bg-[#FAF8F5] px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#111111]">
                        {enrollment.contactName}
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        Step {enrollment.currentStepIndex + 1}
                        {enrollment.nextStepAt
                          ? ` · due ${new Intl.DateTimeFormat("en-GB", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(enrollment.nextStepAt))}`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleUnenroll(seq, enrollment)}
                      disabled={pendingAction === `unenroll:${enrollment.id}`}
                      className="text-xs font-medium text-[#6E6AE8] disabled:opacity-50"
                    >
                      {pendingAction === `unenroll:${enrollment.id}`
                        ? "Removing..."
                        : "Unenroll"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          );
        })
        ) : (
          <Card className="lg:col-span-2">
            <div className="py-10 text-center text-sm text-[#6B7280]">
              No live sequences found.
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
