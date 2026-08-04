import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { decryptProviderCredential, encryptProviderCredential } from "../../utils/provider-credentials.js";
import { roleMatchesAllowedRoles } from "../../utils/roles.js";
import { decideGoogleOAuthAccess } from "../auth/google-oauth-access.js";
import type {
  CalendarConnectionStatus,
  CalendarMeetingLinkPayload,
  CalendarMeetingListQuery,
  CalendarMeetingRecord,
} from "./calendar.types.js";

type CalendarOAuthState = {
  purpose: "google_calendar";
  provider: "google";
  clinicId: string;
  userId: string;
};

type StoredCalendarConfig = {
  oauthConnected?: boolean;
  connectedEmail?: string;
  connectedAt?: string;
  tokenExpiresAt?: string | null;
  grantedScopes?: string[];
  encryptedAccessToken?: string;
  encryptedRefreshToken?: string;
};

const integrationType = "google_calendar";
const integrationName = "Google Calendar";

function parseStoredConfig(value: unknown): StoredCalendarConfig {
  if (!value) return {};
  if (typeof value === "object") return value as StoredCalendarConfig;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function formatDateTime(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function toIso(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function extractMeetingUrl(event: any) {
  const hangout = typeof event?.hangoutLink === "string" ? event.hangoutLink : "";
  if (hangout) return hangout;
  const entryPoints = Array.isArray(event?.conferenceData?.entryPoints)
    ? event.conferenceData.entryPoints
    : [];
  const video = entryPoints.find((entry: any) => entry?.entryPointType === "video" && entry?.uri);
  return video?.uri ? String(video.uri) : null;
}

function mapMeeting(row: any): CalendarMeetingRecord {
  return {
    id: row.id,
    provider: "google_calendar",
    providerEventId: row.providerEventId,
    calendarId: row.calendarId || null,
    title: row.title,
    description: row.description || null,
    location: row.location || null,
    meetingUrl: row.meetingUrl || null,
    htmlLink: row.htmlLink || null,
    status: row.status,
    startsAt: new Date(row.startsAt).toISOString(),
    endsAt: row.endsAt ? new Date(row.endsAt).toISOString() : null,
    timezone: row.timezone || null,
    organizerEmail: row.organizerEmail || null,
    attendeeEmails: parseJsonArray(row.attendeeEmails),
    contactId: row.contactId || null,
    contactName: row.contactName || null,
    clientAccountProfileId: row.clientAccountProfileId || null,
    clientName: row.clientName || null,
    taskId: row.taskId || null,
    taskTitle: row.taskTitle || null,
    lastSyncedAt: row.lastSyncedAt ? new Date(row.lastSyncedAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export class CalendarService {
  private tokenCache = new Map<string, { token: string; expiresAt: number }>();

  private get redirectUri() {
    return `${config.oauthCallbackBaseUrl.replace(/\/$/, "")}/oauth/google/callback`;
  }

  private assertConfigured() {
    if (!config.googleCalendar.oauthEnabled) {
      throw ApiError.serviceUnavailable("Google Calendar OAuth is not enabled.");
    }
    if (!config.oauth.google.clientId || !config.oauth.google.clientSecret) {
      throw ApiError.serviceUnavailable("Google OAuth credentials are not configured.");
    }
  }

  getAuthorizationUrl(clinicId: string, userId: string) {
    this.assertConfigured();
    const state = jwt.sign(
      { purpose: "google_calendar", provider: "google", clinicId, userId } satisfies CalendarOAuthState,
      config.jwt.secret,
      { expiresIn: "20m" },
    );
    const params = new URLSearchParams({
      client_id: config.oauth.google.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: ["openid", "email", "profile", ...config.googleCalendar.scopes].join(" "),
      state,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    });
    if (config.oauth.google.allowedDomains.length === 1) {
      params.set("hd", config.oauth.google.allowedDomains[0]!);
    }
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  isCalendarOAuthState(state: string) {
    if (!state) return false;
    try {
      const payload = jwt.decode(state) as Partial<CalendarOAuthState> | null;
      return Boolean(payload && payload.purpose === "google_calendar" && payload.provider === "google");
    } catch {
      return false;
    }
  }

  async completeOAuth(code: string, state: string, audit: { ipAddress: string | null; userAgent: string | null }) {
    this.assertConfigured();
    if (!code) throw ApiError.badRequest("Google did not return an authorization code.");

    let statePayload: CalendarOAuthState;
    try {
      statePayload = jwt.verify(state, config.jwt.secret) as CalendarOAuthState;
    } catch {
      throw ApiError.badRequest("Google Calendar connection session expired. Return to Integrations and try again.");
    }

    if (
      statePayload.purpose !== "google_calendar" ||
      statePayload.provider !== "google" ||
      !statePayload.clinicId ||
      !statePayload.userId
    ) {
      throw ApiError.badRequest("Google Calendar OAuth state is invalid.");
    }

    const [userRows]: any = await pool.execute(
      `SELECT u.email, COALESCE(cm.role, u.role) as role
       FROM user u
       INNER JOIN clinic_membership cm ON cm.user_id = u.id
       WHERE u.id = ? AND cm.clinic_id = ? AND cm.status = 'active'
         AND u.deleted_at IS NULL
       LIMIT 1`,
      [statePayload.userId, statePayload.clinicId],
    );
    if (!userRows[0]) throw ApiError.forbidden("The initiating CRM membership is no longer active.");
    if (!roleMatchesAllowedRoles(String(userRows[0].role || ""), ["SUPER_ADMIN", "ADMIN"])) {
      throw ApiError.forbidden("Only an Admin can connect the Google Calendar integration.");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.oauth.google.clientId,
        client_secret: config.oauth.google.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: this.redirectUri,
      }),
    });
    const tokenPayload: any = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      throw ApiError.badRequest(tokenPayload.error_description || tokenPayload.error || "Google Calendar authorization failed.");
    }

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
    });
    const profile: any = await profileResponse.json().catch(() => ({}));
    if (!profileResponse.ok || !profile.email || profile.email_verified !== true) {
      throw ApiError.forbidden("Google did not return a verified Workspace email.");
    }
    const email = String(profile.email).trim().toLowerCase();
    if (decideGoogleOAuthAccess(email, true, config.oauth.google.allowedDomains) === "reject") {
      throw ApiError.forbidden("Use a permitted Google Workspace account.");
    }

    const existing = await this.getIntegration(statePayload.clinicId);
    const existingConfig = parseStoredConfig(existing?.config);
    const refreshToken = tokenPayload.refresh_token || decryptProviderCredential(existingConfig.encryptedRefreshToken);
    if (!refreshToken) {
      throw ApiError.badRequest("Google did not issue offline Calendar access. Reconnect and approve access.");
    }

    const connectedAt = new Date().toISOString();
    const expiresAt = tokenPayload.expires_in
      ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000).toISOString()
      : null;
    const storedConfig: StoredCalendarConfig = {
      oauthConnected: true,
      connectedEmail: email,
      connectedAt,
      tokenExpiresAt: expiresAt,
      grantedScopes: typeof tokenPayload.scope === "string"
        ? tokenPayload.scope.split(/\s+/).filter(Boolean)
        : config.googleCalendar.scopes,
      encryptedAccessToken: encryptProviderCredential(String(tokenPayload.access_token)),
      encryptedRefreshToken: encryptProviderCredential(String(refreshToken)),
    };
    const integrationId = existing?.id || uuidv4();
    await pool.execute(
      `INSERT INTO integration
        (id, clinic_id, name, type, config, is_active, setup_status, health_status,
         missing_permissions, oauth_authorize_url)
       VALUES (?, ?, ?, ?, ?, 1, 'ready', 'healthy', ?, NULL)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name), config = VALUES(config), is_active = 1,
         setup_status = 'ready', health_status = 'healthy',
         missing_permissions = VALUES(missing_permissions), oauth_authorize_url = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [integrationId, statePayload.clinicId, integrationName, integrationType, JSON.stringify(storedConfig), JSON.stringify([])],
    );
    this.tokenCache.set(statePayload.clinicId, {
      token: String(tokenPayload.access_token),
      expiresAt: expiresAt ? new Date(expiresAt).getTime() : Date.now() + 3_600_000,
    });
    await logAuditEvent({
      clinicId: statePayload.clinicId,
      userId: statePayload.userId,
      action: "GOOGLE_CALENDAR_OAUTH_CONNECTED",
      entityType: "integration",
      entityId: integrationId,
      changes: { connectedEmail: email, scopes: storedConfig.grantedScopes },
      ...audit,
    });
  }

  async getStatus(clinicId: string): Promise<CalendarConnectionStatus> {
    const integration = await this.getIntegration(clinicId);
    const stored = parseStoredConfig(integration?.config);
    return {
      connected: Boolean(integration?.isActive && stored.oauthConnected && stored.encryptedRefreshToken),
      connectedEmail: stored.connectedEmail || null,
      connectedAt: stored.connectedAt || null,
      tokenExpiresAt: stored.tokenExpiresAt || null,
      syncWindowDays: config.googleCalendar.syncWindowDays,
      lastSync: integration?.lastSync ? new Date(integration.lastSync).toISOString() : null,
      lastSyncStatus: integration?.lastSyncStatus || null,
      lastSyncError: integration?.lastSyncError || null,
    };
  }

  async revoke(clinicId: string, userId: string) {
    const integration = await this.getIntegration(clinicId);
    if (!integration) return;
    await pool.execute(
      `UPDATE integration
       SET is_active = 0,
           setup_status = 'not_configured',
           health_status = 'unknown',
           config = JSON_OBJECT(),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [integration.id, clinicId],
    );
    this.tokenCache.delete(clinicId);
    await logAuditEvent({
      clinicId,
      userId,
      action: "GOOGLE_CALENDAR_OAUTH_REVOKED",
      entityType: "integration",
      entityId: integration.id,
    });
  }

  async syncUpcoming(clinicId: string, userId: string) {
    const integration = await this.getIntegration(clinicId);
    if (!integration?.id) throw ApiError.serviceUnavailable("Connect Google Calendar before syncing meetings.");
    await this.markSyncStarted(clinicId, integration.id);
    try {
      const token = await this.getAccessToken(clinicId);
      const now = new Date();
      const timeMax = new Date(now.getTime() + Math.max(config.googleCalendar.syncWindowDays, 1) * 86400000);
      const params = new URLSearchParams({
        timeMin: now.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "100",
        conferenceDataVersion: "1",
      });
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const payload: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw ApiError.badRequest(payload.error?.message || "Google Calendar meetings could not be loaded.");
      }
      const events = Array.isArray(payload.items) ? payload.items : [];
      let synced = 0;
      for (const event of events) {
        const saved = await this.upsertEvent(clinicId, userId, event);
        if (saved) synced += 1;
      }
      await pool.execute(
        `UPDATE integration
         SET last_sync = CURRENT_TIMESTAMP,
             last_sync_status = 'success',
             last_sync_error = NULL,
             last_sync_completed_at = CURRENT_TIMESTAMP,
             health_status = 'healthy',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND clinic_id = ?`,
        [integration.id, clinicId],
      );
      await logAuditEvent({
        clinicId,
        userId,
        action: "GOOGLE_CALENDAR_SYNC_COMPLETED",
        entityType: "integration",
        entityId: integration.id,
        changes: { synced },
      });
      return { synced };
    } catch (error) {
      await pool.execute(
        `UPDATE integration
         SET last_sync_status = 'failed',
             last_sync_error = ?,
             last_sync_completed_at = CURRENT_TIMESTAMP,
             health_status = 'error',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND clinic_id = ?`,
        [error instanceof Error ? error.message : String(error), integration.id, clinicId],
      );
      throw error;
    }
  }

  async listMeetings(clinicId: string, query: CalendarMeetingListQuery = {}): Promise<CalendarMeetingRecord[]> {
    const conditions = ["cm.clinic_id = ?", "cm.deleted_at IS NULL"];
    const values: any[] = [clinicId];
    if (String(query.upcoming) === "true") {
      conditions.push("cm.starts_at >= CURRENT_TIMESTAMP");
    }
    if (query.contactId) {
      await this.ensureContact(clinicId, query.contactId);
      conditions.push("cm.contact_id = ?");
      values.push(query.contactId);
    }
    if (query.clientAccountProfileId) {
      await this.ensureClientProfile(clinicId, query.clientAccountProfileId);
      conditions.push("cm.client_account_profile_id = ?");
      values.push(query.clientAccountProfileId);
    }
    if (query.taskId) {
      await this.ensureTask(clinicId, query.taskId);
      conditions.push("cm.task_id = ?");
      values.push(query.taskId);
    }
    const parsedLimit = Number.parseInt(String(query.limit || 20), 10);
    const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 20, 1), 100);
    const [rows]: any = await pool.execute(
      `SELECT ${this.selectColumns()}
       FROM calendar_meeting cm
       LEFT JOIN contact c ON c.id = cm.contact_id AND c.clinic_id = cm.clinic_id AND c.deleted_at IS NULL
       LEFT JOIN client_account_profile cap ON cap.id = cm.client_account_profile_id
       LEFT JOIN clinic client ON client.id = cap.clinic_id
       LEFT JOIN task t ON t.id = cm.task_id AND t.clinic_id = cm.clinic_id AND t.deleted_at IS NULL
       WHERE ${conditions.join(" AND ")}
       ORDER BY cm.starts_at ASC
       LIMIT ${limit}`,
      values,
    );
    return rows.map(mapMeeting);
  }

  async updateMeetingLinks(clinicId: string, userId: string, meetingId: string, data: CalendarMeetingLinkPayload) {
    await this.ensureMeeting(clinicId, meetingId);
    if (data.contactId) await this.ensureContact(clinicId, data.contactId);
    if (data.clientAccountProfileId) await this.ensureClientProfile(clinicId, data.clientAccountProfileId);
    if (data.taskId) await this.ensureTask(clinicId, data.taskId);
    await pool.execute(
      `UPDATE calendar_meeting
       SET contact_id = ?,
           client_account_profile_id = ?,
           task_id = ?,
           updated_by = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [
        data.contactId || null,
        data.clientAccountProfileId || null,
        data.taskId || null,
        userId,
        meetingId,
        clinicId,
      ],
    );
    await logAuditEvent({
      clinicId,
      userId,
      action: "CALENDAR_MEETING_LINKS_UPDATED",
      entityType: "calendar_meeting",
      entityId: meetingId,
      changes: { ...data },
    });
    return this.getMeeting(clinicId, meetingId);
  }

  private async getAccessToken(clinicId: string) {
    this.assertConfigured();
    const cached = this.tokenCache.get(clinicId);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const integration = await this.getIntegration(clinicId);
    const stored = parseStoredConfig(integration?.config);
    if (!integration?.isActive || !stored.oauthConnected) {
      throw ApiError.serviceUnavailable("Connect Google Calendar before syncing meetings.");
    }
    const currentAccessToken = decryptProviderCredential(stored.encryptedAccessToken);
    const currentExpiry = stored.tokenExpiresAt ? new Date(stored.tokenExpiresAt).getTime() : 0;
    if (currentAccessToken && currentExpiry > Date.now() + 60_000) {
      this.tokenCache.set(clinicId, { token: currentAccessToken, expiresAt: currentExpiry });
      return currentAccessToken;
    }
    const refreshToken = decryptProviderCredential(stored.encryptedRefreshToken);
    if (!refreshToken) throw ApiError.serviceUnavailable("Reconnect Google Calendar to restore offline access.");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.oauth.google.clientId,
        client_secret: config.oauth.google.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw ApiError.serviceUnavailable(payload.error_description || payload.error || "Google Calendar access could not be refreshed.");
    }
    const token = String(payload.access_token);
    const expiresAt = new Date(Date.now() + Number(payload.expires_in || 3600) * 1000).toISOString();
    const next = { ...stored, encryptedAccessToken: encryptProviderCredential(token), tokenExpiresAt: expiresAt };
    await pool.execute(
      `UPDATE integration SET config = ?, health_status = 'healthy', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [JSON.stringify(next), integration.id, clinicId],
    );
    this.tokenCache.set(clinicId, { token, expiresAt: new Date(expiresAt).getTime() });
    return token;
  }

  private async upsertEvent(clinicId: string, userId: string, event: any) {
    const providerEventId = String(event?.id || "");
    const startValue = event?.start?.dateTime || event?.start?.date;
    if (!providerEventId || !startValue) return false;
    const startsAt = formatDateTime(startValue);
    if (!startsAt) return false;
    const endsAt = formatDateTime(event?.end?.dateTime || event?.end?.date);
    const attendeeEmails = Array.from(new Set<string>(
      (Array.isArray(event?.attendees) ? event.attendees : [])
        .map((attendee: any) => String(attendee?.email || "").trim().toLowerCase())
        .filter(Boolean),
    ));
    const linkedContact = await this.findContactByEmails(clinicId, attendeeEmails);
    const meetingUrl = extractMeetingUrl(event);
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO calendar_meeting
        (id, clinic_id, provider, provider_event_id, calendar_id, title, description, location,
         meeting_url, html_link, status, starts_at, ends_at, timezone, organizer_email,
         attendee_emails, contact_id, client_account_profile_id, last_synced_at, created_by, updated_by)
       VALUES (?, ?, 'google_calendar', ?, 'primary', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         description = VALUES(description),
         location = VALUES(location),
         meeting_url = VALUES(meeting_url),
         html_link = VALUES(html_link),
         status = VALUES(status),
         starts_at = VALUES(starts_at),
         ends_at = VALUES(ends_at),
         timezone = VALUES(timezone),
         organizer_email = VALUES(organizer_email),
         attendee_emails = VALUES(attendee_emails),
         contact_id = COALESCE(calendar_meeting.contact_id, VALUES(contact_id)),
         client_account_profile_id = COALESCE(calendar_meeting.client_account_profile_id, VALUES(client_account_profile_id)),
         last_synced_at = CURRENT_TIMESTAMP,
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        clinicId,
        providerEventId,
        String(event?.summary || "Untitled meeting"),
        event?.description ? String(event.description) : null,
        event?.location ? String(event.location) : null,
        meetingUrl,
        event?.htmlLink ? String(event.htmlLink) : null,
        String(event?.status || "confirmed"),
        startsAt,
        endsAt,
        event?.start?.timeZone || event?.end?.timeZone || null,
        event?.organizer?.email ? String(event.organizer.email).toLowerCase() : null,
        JSON.stringify(attendeeEmails),
        linkedContact.contactId,
        linkedContact.clientAccountProfileId,
        userId,
        userId,
      ],
    );
    return true;
  }

  private async findContactByEmails(clinicId: string, emails: string[]) {
    if (emails.length === 0) return { contactId: null, clientAccountProfileId: null };
    const placeholders = emails.map(() => "?").join(", ");
    const [rows]: any = await pool.execute(
      `SELECT c.id as contactId,
              cac.client_account_profile_id as clientAccountProfileId
       FROM contact c
       LEFT JOIN client_account_contact cac
         ON cac.contact_id = c.id
        AND cac.clinic_id = c.clinic_id
       WHERE c.clinic_id = ?
         AND LOWER(c.email) IN (${placeholders})
         AND c.deleted_at IS NULL
       ORDER BY c.updated_at DESC
       LIMIT 1`,
      [clinicId, ...emails],
    );
    return {
      contactId: rows[0]?.contactId || null,
      clientAccountProfileId: rows[0]?.clientAccountProfileId || null,
    };
  }

  private selectColumns() {
    return `cm.id,
            cm.provider_event_id as providerEventId,
            cm.calendar_id as calendarId,
            cm.title,
            cm.description,
            cm.location,
            cm.meeting_url as meetingUrl,
            cm.html_link as htmlLink,
            cm.status,
            cm.starts_at as startsAt,
            cm.ends_at as endsAt,
            cm.timezone,
            cm.organizer_email as organizerEmail,
            cm.attendee_emails as attendeeEmails,
            cm.contact_id as contactId,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), c.email, c.phone) as contactName,
            cm.client_account_profile_id as clientAccountProfileId,
            client.name as clientName,
            cm.task_id as taskId,
            t.title as taskTitle,
            cm.last_synced_at as lastSyncedAt,
            cm.created_at as createdAt,
            cm.updated_at as updatedAt`;
  }

  private async markSyncStarted(clinicId: string, integrationId: string) {
    await pool.execute(
      `UPDATE integration
       SET last_sync_started_at = CURRENT_TIMESTAMP,
           last_sync_status = 'running',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ?`,
      [integrationId, clinicId],
    );
  }

  private async ensureMeeting(clinicId: string, meetingId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id FROM calendar_meeting WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL LIMIT 1`,
      [meetingId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Calendar meeting not found.");
  }

  private async getMeeting(clinicId: string, meetingId: string) {
    const [rows]: any = await pool.execute(
      `SELECT ${this.selectColumns()}
       FROM calendar_meeting cm
       LEFT JOIN contact c ON c.id = cm.contact_id AND c.clinic_id = cm.clinic_id AND c.deleted_at IS NULL
       LEFT JOIN client_account_profile cap ON cap.id = cm.client_account_profile_id
       LEFT JOIN clinic client ON client.id = cap.clinic_id
       LEFT JOIN task t ON t.id = cm.task_id AND t.clinic_id = cm.clinic_id AND t.deleted_at IS NULL
       WHERE cm.id = ? AND cm.clinic_id = ? AND cm.deleted_at IS NULL
       LIMIT 1`,
      [meetingId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Calendar meeting not found.");
    return mapMeeting(rows[0]);
  }

  private async ensureContact(clinicId: string, contactId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id FROM contact WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL LIMIT 1`,
      [contactId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Contact not found.");
  }

  private async ensureClientProfile(clinicId: string, profileId: string) {
    const [rows]: any = await pool.execute(
      `SELECT cap.id
       FROM client_account_profile cap
       JOIN clinic client ON client.id = cap.clinic_id AND client.deleted_at IS NULL
       WHERE cap.id = ?
         AND (
           EXISTS (
             SELECT 1
             FROM client_account_contact cac
             WHERE cac.client_account_profile_id = cap.id
               AND cac.clinic_id = ?
           )
           OR EXISTS (
             SELECT 1
             FROM task t
             WHERE t.client_account_profile_id = cap.id
               AND t.clinic_id = ?
               AND t.deleted_at IS NULL
           )
           OR EXISTS (
             SELECT 1
             FROM deal d
             WHERE d.client_account_profile_id = cap.id
               AND d.clinic_id = ?
               AND d.deleted_at IS NULL
           )
         )
       LIMIT 1`,
      [profileId, clinicId, clinicId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Client account not found.");
  }

  private async ensureTask(clinicId: string, taskId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id FROM task WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL LIMIT 1`,
      [taskId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Task not found.");
  }

  private async getIntegration(clinicId: string): Promise<{
    id: string;
    config: unknown;
    isActive: boolean;
    lastSync: Date | null;
    lastSyncStatus: string | null;
    lastSyncError: string | null;
  } | null> {
    const [rows]: any = await pool.execute(
      `SELECT id,
              config,
              is_active as isActive,
              last_sync as lastSync,
              last_sync_status as lastSyncStatus,
              last_sync_error as lastSyncError
       FROM integration
       WHERE clinic_id = ? AND type = ? AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId, integrationType],
    );
    return rows[0] || null;
  }
}

export const calendarService = new CalendarService();
