export interface CalendarConnectionStatus {
  connected: boolean;
  connectedEmail: string | null;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
  syncWindowDays: number;
  lastSync: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
}

export interface CalendarMeetingRecord {
  id: string;
  provider: "google_calendar";
  providerEventId: string;
  calendarId: string | null;
  title: string;
  description: string | null;
  location: string | null;
  meetingUrl: string | null;
  htmlLink: string | null;
  status: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
  organizerEmail: string | null;
  attendeeEmails: string[];
  contactId: string | null;
  contactName: string | null;
  clientAccountProfileId: string | null;
  clientName: string | null;
  taskId: string | null;
  taskTitle: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarMeetingListQuery {
  contactId?: string;
  clientAccountProfileId?: string;
  taskId?: string;
  upcoming?: string | boolean;
  limit?: string | number;
}

export interface CalendarMeetingLinkPayload {
  contactId?: string | null;
  clientAccountProfileId?: string | null;
  taskId?: string | null;
}
