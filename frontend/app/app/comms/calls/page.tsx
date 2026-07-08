"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Phone, Plus, Filter, Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { PageHeader, StatCardSkeleton, TableRowSkeleton } from "@/components/ui";
import { SearchInput, FilterTabs } from "@/components/ui/forms";
import { PaginationControls } from "@/components/ui/table-controls";
import {
  formatCallDuration,
  type CallDisposition,
  type CallOutcome,
  type CallRecord,
} from "@/lib/call-data";
import { api } from "@/lib/api-client";
import type { CallLogRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import {
  CallStatsGrid,
  CallBreakdownCard,
} from "@/components/calls/call-stats";
import { CallRow } from "@/components/calls/call-row";
import { CallDetailPanel } from "@/components/calls/call-detail-panel";
import { LogCallModal } from "@/components/calls/log-call-modal";
import { exportToCSV } from "@/lib/export-utils";
import { useFilteredSortedPaginated } from "@/hooks/use-table";

const FILTER_TABS = ["All", "Connected", "No Answer", "Voicemail", "Booked"];
const FILTER_PARAM_VALUES = new Map([
  ["all", "all"],
  ["connected", "connected"],
  ["no-answer", "no answer"],
  ["no_answer", "no answer"],
  ["no answer", "no answer"],
  ["voicemail", "voicemail"],
  ["booked", "booked"],
]);

const searchFn = (call: CallRecord, query: string) =>
  call.contactName.toLowerCase().includes(query) ||
  call.phone.includes(query) ||
  call.treatment.toLowerCase().includes(query) ||
  call.assignedTo.toLowerCase().includes(query) ||
  call.source.toLowerCase().includes(query);

function shouldOpenLogCallModal() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("log") === "1";
}

function getFilterFromParams(searchParams: URLSearchParams) {
  return (
    FILTER_PARAM_VALUES.get(
      String(searchParams.get("filter") || "")
        .trim()
        .toLowerCase(),
    ) || "all"
  );
}

function normalizeCallOutcome(call: CallLogRecord): CallOutcome {
  const rawOutcome = String(call.outcome || call.callStatus || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (call.missedCall || rawOutcome.includes("no_answer") || rawOutcome === "missed") {
    return "no_answer";
  }
  if (rawOutcome === "busy") return "busy";
  if (rawOutcome === "cancelled" || rawOutcome === "canceled") return "cancelled";
  if (rawOutcome === "voicemail") return "voicemail";
  if (rawOutcome === "connected" || rawOutcome === "completed" || call.duration > 0) {
    return "connected";
  }

  return "no_answer";
}

function normalizeCallDisposition(disposition: CallLogRecord["disposition"]): CallDisposition {
  const rawDisposition = String(disposition || "none")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  switch (rawDisposition) {
    case "booked":
    case "callback_requested":
    case "not_interested":
    case "wrong_number":
    case "info_given":
    case "follow_up_needed":
      return rawDisposition;
    default:
      return "none";
  }
}

function toCallRecord(call: CallLogRecord): CallRecord {
  return {
    id: call.id,
    contactId: call.contactId,
    contactName: call.contactName,
    contactAvatar: call.contactAvatar,
    phone: call.phone,
    direction: call.direction,
    missedCall: call.missedCall,
    outcome: normalizeCallOutcome(call),
    commercialOutcome: call.commercialOutcome,
    disposition: normalizeCallDisposition(call.disposition),
    duration: call.duration,
    notes: call.notes,
    transcript: call.transcript,
    aiSummary: call.aiSummary,
    sentiment: call.sentiment,
    bookingIntent: call.bookingIntent,
    qualityScore: call.qualityScore,
    summaryGeneratedAt: call.summaryGeneratedAt,
    assignedTo: call.assignedTo,
    recordingUrl: call.recordingUrl,
    treatment: call.treatment || call.treatmentMentioned || "Consultation",
    source: call.source || "Unknown",
    createdAt: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(call.createdAt || call.timestamp)),
    timestamp: call.timestamp || call.createdAt,
  };
}

export default function CallsPage() {
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const shouldOpenLogModal = searchParams.get("log") === "1";
  const requestedFilter = getFilterFromParams(searchParams);
  const [activeFilter, setActiveFilter] = useState(requestedFilter);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [showLogModal, setShowLogModal] = useState(shouldOpenLogCallModal);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionKey, setActionKey] = useState<string | undefined>();
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!shouldOpenLogModal) return;

    const timer = window.setTimeout(() => {
      setShowLogModal(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [shouldOpenLogModal]);

  useEffect(() => {
    if (!session?.token) return;

    let isMounted = true;
    const missedOnly =
      searchParams.get("missed") === "1" ||
      searchParams.get("missed") === "true" ||
      requestedFilter === "no answer";
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    api.calls
      .list(session.token, {
        missedOnly: missedOnly ? true : undefined,
        startDate,
        endDate,
      })
      .then((records) => {
        if (!isMounted) return;
        setLoadError("");
        const rows = records.map(toCallRecord);
        setCalls(rows);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Unable to load calls from the backend.",
        );
        setCalls([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [requestedFilter, searchParams, session?.token]);

  const tabFiltered = useMemo(() => {
    return calls.filter((call) => {
      switch (activeFilter) {
        case "connected":
          return call.outcome === "connected";
        case "no answer":
          return call.outcome === "no_answer";
        case "voicemail":
          return call.outcome === "voicemail";
        case "booked":
          return call.disposition === "booked";
        default:
          return true;
      }
    });
  }, [activeFilter, calls]);

  const {
    searchQuery,
    setSearchQuery,
    paginatedItems,
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    totalItems,
    nextPage,
    prevPage,
    goToPage,
    hasNextPage,
    hasPrevPage,
  } = useFilteredSortedPaginated(tabFiltered, searchFn, 10);

  const selectedCall =
    calls.find((c) => c.id === selectedCallId) || null;

  const replaceCall = useCallback((record: CallLogRecord) => {
    const nextCall = toCallRecord(record);
    setCalls((current) =>
      current.map((call) => (call.id === nextCall.id ? nextCall : call)),
    );
    return nextCall;
  }, []);

  const prependCall = useCallback((record: CallLogRecord) => {
    const nextCall = toCallRecord(record);
    setCalls((current) => [nextCall, ...current.filter((call) => call.id !== nextCall.id)]);
    setActionError("");
    setActionMessage("Call logged to the backend.");
  }, []);

  const runCallAction = useCallback(
    async (
      key: string,
      call: CallRecord,
      action: () => Promise<CallLogRecord | void>,
      successMessage: string,
    ) => {
      if (!session?.token) {
        setActionError("You need an active session before this call can be updated.");
        return;
      }

      setActionKey(key);
      setActionError("");
      setActionMessage("");
      try {
        const updated = await action();
        if (updated) replaceCall(updated);
        setActionMessage(successMessage);
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : `Unable to update ${call.contactName}.`,
        );
      } finally {
        setActionKey(undefined);
      }
    },
    [replaceCall, session?.token],
  );

  const handleSaveNotes = useCallback(
    async (call: CallRecord, notes: string) => {
      await runCallAction(
        "notes",
        call,
        () => api.calls.update(session!.token, call.id, { notes }),
        "Call notes saved to the backend.",
      );
    },
    [runCallAction, session],
  );

  const handleGenerateIntelligence = useCallback(
    async (call: CallRecord) => {
      await runCallAction(
        "generate",
        call,
        () => api.calls.generateIntelligence(session!.token, call.id),
        "AI call intelligence refreshed.",
      );
    },
    [runCallAction, session],
  );

  const handleTranscribe = useCallback(
    async (call: CallRecord) => {
      await runCallAction(
        "transcribe",
        call,
        () => api.calls.transcribe(session!.token, call.id, { generateIntelligence: true }),
        "Recording transcribed and AI intelligence refreshed.",
      );
    },
    [runCallAction, session],
  );

  const handleFollowUp = useCallback(
    async (call: CallRecord) => {
      await runCallAction(
        "follow-up",
        call,
        async () => {
          await api.calls.followUp(session!.token, call.id, { sendNow: false });
        },
        "Missed-call follow-up queued.",
      );
    },
    [runCallAction, session],
  );

  const handlePlayRecording = useCallback((call: CallRecord) => {
    if (!call.recordingUrl) return;
    window.open(call.recordingUrl, "_blank", "noopener,noreferrer");
  }, []);

  const handleExport = useCallback(() => {
    const data = calls.map((call) => ({
      Contact: call.contactName,
      Phone: call.phone,
      Direction: call.direction,
      Outcome: call.outcome,
      Disposition: call.disposition,
      Duration: formatCallDuration(call.duration),
      Treatment: call.treatment,
      "Handled By": call.assignedTo,
      Source: call.source,
      Date: call.createdAt,
      Notes: call.notes,
    }));
    exportToCSV(data, `call-log-${new Date().toISOString().split("T")[0]}`);
  }, [calls]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Call Log"
        subtitle={
          isLoading
            ? "Loading calls from the backend..."
            : "Track, log, and review all call activity."
        }
        icon={Phone}
        iconColor="text-[#4A7A8A]"
        iconBg="bg-[rgba(74,122,138,0.1)]"
        right={
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={isLoading || calls.length === 0}
              className="btn-secondary text-sm"
            >
              <Download className="w-4 h-4" /> Export
            </button>
            <button
              onClick={() => setShowBreakdown(!showBreakdown)}
              className="btn-secondary text-sm"
            >
              <Filter className="w-4 h-4" /> {showBreakdown ? "Hide" : "Show"}{" "}
              Breakdown
            </button>
            <button
              onClick={() => setShowLogModal(true)}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" /> Log Call
            </button>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <CallStatsGrid calls={calls} />
      )}

      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Backend calls could not be loaded. {loadError}
        </div>
      )}

      {showBreakdown && !isLoading && <CallBreakdownCard calls={calls} />}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name, phone, treatment..."
          className="flex-1 max-w-md"
        />
        <FilterTabs
          tabs={FILTER_TABS}
          active={activeFilter}
          onChange={setActiveFilter}
        />
      </div>

      <div
        className={`grid gap-4 ${selectedCall ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"}`}
      >
        <div
          className={`${selectedCall ? "lg:col-span-2" : ""} rounded-2xl overflow-hidden`}
          style={{
            backgroundColor: "#FFFCF9",
            border: "1px solid #E5DED6",
            boxShadow: "0 2px 12px rgba(37, 36, 33, 0.05)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid #E5DED6",
                    backgroundColor: "#F7F5F2",
                  }}
                >
                  <th className="text-left text-[11px] uppercase tracking-wider font-bold px-5 py-3.5 text-[#7A746A]">
                    Contact
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider font-bold px-5 py-3.5 text-[#7A746A] hidden md:table-cell">
                    Direction
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider font-bold px-5 py-3.5 text-[#7A746A]">
                    Outcome
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider font-bold px-5 py-3.5 text-[#7A746A] hidden lg:table-cell">
                    Disposition
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider font-bold px-5 py-3.5 text-[#7A746A] hidden md:table-cell">
                    Duration
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider font-bold px-5 py-3.5 text-[#7A746A] hidden lg:table-cell">
                    Treatment
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider font-bold px-5 py-3.5 text-[#7A746A] hidden xl:table-cell">
                    Handled By
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider font-bold px-5 py-3.5 text-[#7A746A] hidden md:table-cell">
                    Rec.
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider font-bold px-5 py-3.5 text-[#7A746A]">
                    When
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 6 }, (_, index) => (
                    <TableRowSkeleton key={index} columns={9} />
                  ))}
                {!isLoading && paginatedItems.map((call) => (
                  <CallRow
                    key={call.id}
                    call={call}
                    isSelected={selectedCallId === call.id}
                    onPlayRecording={handlePlayRecording}
                    onClick={() =>
                      setSelectedCallId(
                        selectedCallId === call.id ? null : call.id,
                      )
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>

          {!isLoading && paginatedItems.length === 0 && (
            <div className="p-12 text-center" style={{ color: "#A8A39B" }}>
              <Phone className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No calls match your filters.</p>
            </div>
          )}

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            startIndex={startIndex}
            endIndex={endIndex}
            totalItems={totalItems}
            onPrevious={prevPage}
            onNext={nextPage}
            onGoToPage={goToPage}
            hasPrevPage={hasPrevPage}
            hasNextPage={hasNextPage}
          />
        </div>

        {selectedCall && (
          <div className="lg:col-span-1">
            <CallDetailPanel
              key={selectedCall.id}
              call={selectedCall}
              onClose={() => setSelectedCallId(null)}
              onSaveNotes={handleSaveNotes}
              onGenerateIntelligence={handleGenerateIntelligence}
              onTranscribe={handleTranscribe}
              onFollowUp={handleFollowUp}
              actionKey={actionKey}
              actionError={actionError}
              actionMessage={actionMessage}
            />
          </div>
        )}
      </div>

      {showLogModal && session?.token && (
        <LogCallModal
          token={session.token}
          onClose={() => setShowLogModal(false)}
          onCreated={prependCall}
        />
      )}
    </div>
  );
}
