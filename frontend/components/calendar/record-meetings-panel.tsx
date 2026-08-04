"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, ExternalLink, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { CalendarMeetingRecord } from "@/lib/api-types";

type Props = {
  contactId?: string | null;
  clientAccountProfileId?: string | null;
  taskId?: string | null;
};

function formatMeetingTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function RecordMeetingsPanel({ contactId, clientAccountProfileId, taskId }: Props) {
  const { session } = useAuth();
  const token = session?.token;
  const [meetings, setMeetings] = useState<CalendarMeetingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || (!contactId && !clientAccountProfileId && !taskId)) return;
    let mounted = true;
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      setError("");
      api.calendar
        .listMeetings(token, {
          contactId: contactId || undefined,
          clientAccountProfileId: clientAccountProfileId || undefined,
          taskId: taskId || undefined,
          limit: 8,
        })
        .then((rows) => {
          if (mounted) setMeetings(rows);
        })
        .catch((err) => {
          if (mounted) setError(err instanceof Error ? err.message : "Related meetings could not be loaded.");
        })
        .finally(() => {
          if (mounted) setIsLoading(false);
        });
    }, 0);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [clientAccountProfileId, contactId, taskId, token]);

  return (
    <section className="rounded-2xl border border-[#E7E1DA] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[#5e8a8d]" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-[#151f21]">Related meetings</h2>
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-[#5e8a8d]" aria-hidden="true" />}
      </div>

      {error && <p className="mt-3 text-sm text-amber-700">{error}</p>}

      <div className="mt-4 space-y-2">
        {!isLoading && meetings.length === 0 && !error && (
          <p className="text-sm text-[#5e8a8d]">No synced Google Calendar meetings linked yet.</p>
        )}
        {meetings.map((meeting) => (
          <div key={meeting.id} className="rounded-xl border border-[#edf2ef] bg-[#FAF8F5] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold text-[#151f21]">{meeting.title}</p>
                <p className="mt-1 text-xs text-[#5e8a8d]">
                  {formatMeetingTime(meeting.startsAt)}
                  {meeting.contactName ? ` - ${meeting.contactName}` : ""}
                  {meeting.clientName ? ` - ${meeting.clientName}` : ""}
                </p>
              </div>
              {(meeting.meetingUrl || meeting.htmlLink) && (
                <Link
                  href={meeting.meetingUrl || meeting.htmlLink || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-[#315f62] hover:bg-[#edf5f3]"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Open
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
