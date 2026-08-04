import type {
  CalendarConnectionStatus,
  CalendarMeetingLinkPayload,
  CalendarMeetingListParams,
  CalendarMeetingRecord,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

function buildQuery(params: object = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function createCalendarApi(apiRequest: ApiRequest) {
  return {
    calendar: {
      async getStatus(token: string) {
        const response = await apiRequest<CalendarConnectionStatus>("/api/calendar/status", { token });
        return response.data!;
      },
      async startOAuth(token: string) {
        const response = await apiRequest<{ authorizeUrl: string }>("/api/calendar/oauth/start", {
          method: "POST",
          token,
        });
        return response.data!;
      },
      async revoke(token: string) {
        return apiRequest<never>("/api/calendar/oauth/revoke", {
          method: "POST",
          token,
        });
      },
      async sync(token: string) {
        const response = await apiRequest<{ synced: number }>("/api/calendar/sync", {
          method: "POST",
          token,
        });
        return response.data!;
      },
      async listMeetings(token: string, params?: CalendarMeetingListParams) {
        const response = await apiRequest<CalendarMeetingRecord[]>(
          `/api/calendar/meetings${buildQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async updateMeetingLinks(
        token: string,
        meetingId: string,
        payload: CalendarMeetingLinkPayload,
      ) {
        const response = await apiRequest<CalendarMeetingRecord>(
          `/api/calendar/meetings/${encodeURIComponent(meetingId)}/links`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
    },
  };
}
