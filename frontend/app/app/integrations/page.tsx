"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle,
  CreditCard,
  HardDrive,
  Loader2,
  Megaphone,
  MessageCircle,
  RefreshCw,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { AlertBanner, Card, PageHeader } from "@/components/ui";
import { api, ApiClientError } from "@/lib/api-client";
import type { CalendarConnectionStatus, GoogleDriveConnectionRecord, QuickBooksConnectionStatus } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

type SecondaryIntegration = {
  name: string;
  description: string;
  category: string;
  icon: LucideIcon;
};

const SECONDARY_INTEGRATIONS: SecondaryIntegration[] = [
  {
    name: "Twilio SMS",
    description: "SMS delivery can use the existing Twilio account once messaging credentials are configured.",
    category: "Communications",
    icon: MessageCircle,
  },
  {
    name: "Stripe",
    description: "Legacy Stripe billing support exists elsewhere in the CRM. QuickBooks is the active finance integration path for Mission Control.",
    category: "Payments",
    icon: CreditCard,
  },
  {
    name: "Mailchimp",
    description: "Audience synchronisation is not currently enabled for this internal workspace.",
    category: "Marketing",
    icon: Megaphone,
  },
];

function getInitialOAuthNotice() {
  if (typeof window === "undefined") return null;
  const searchParams = new URLSearchParams(window.location.search);
  const drive = searchParams.get("drive");
  const calendar = searchParams.get("calendar");
  const quickbooks = searchParams.get("quickbooks");
  if (drive === "connected") {
    return {
      message: "Google Drive is connected for the selected Workspace account.",
      variant: "info" as const,
    };
  }
  if (drive === "error") {
    return {
      message: searchParams.get("message") || "Google Drive could not be connected.",
      variant: "warning" as const,
    };
  }
  if (calendar === "connected") {
    return {
      message: "Google Calendar is connected for agreed calls and meetings.",
      variant: "info" as const,
    };
  }
  if (calendar === "error") {
    return {
      message: searchParams.get("message") || "Google Calendar could not be connected.",
      variant: "warning" as const,
    };
  }
  if (quickbooks === "connected") {
    return {
      message: "QuickBooks is connected for finance visibility and client customer mapping.",
      variant: "info" as const,
    };
  }
  if (quickbooks === "error") {
    return {
      message: searchParams.get("message") || "QuickBooks could not be connected.",
      variant: "warning" as const,
    };
  }
  return null;
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function IntegrationsPage() {
  const { session, user } = useAuth();
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const token = session?.token;
  const clinicId = session?.clinicId;
  const [initialOAuthNotice] = useState(getInitialOAuthNotice);
  const [driveConnection, setDriveConnection] =
    useState<GoogleDriveConnectionRecord | null>(null);
  const [calendarConnection, setCalendarConnection] =
    useState<CalendarConnectionStatus | null>(null);
  const [quickBooksConnection, setQuickBooksConnection] =
    useState<QuickBooksConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDriveBusy, setIsDriveBusy] = useState(false);
  const [isCalendarBusy, setIsCalendarBusy] = useState(false);
  const [isQuickBooksBusy, setIsQuickBooksBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(
    initialOAuthNotice?.message || null,
  );
  const [statusVariant, setStatusVariant] = useState<"info" | "warning">(
    initialOAuthNotice?.variant || "info",
  );

  const loadIntegrationStatus = useCallback(async () => {
    if (!token || !isAdmin) {
      setDriveConnection(null);
      setCalendarConnection(null);
      setQuickBooksConnection(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const [driveStatus, calendarStatus, quickBooksStatus] = await Promise.all([
        api.clientAccounts.getDriveOAuthStatus(token),
        api.calendar.getStatus(token),
        api.quickbooks.getStatus(token),
      ]);
      setDriveConnection(driveStatus);
      setCalendarConnection(calendarStatus);
      setQuickBooksConnection(quickBooksStatus);
    } catch (error) {
      setLoadError(
        error instanceof ApiClientError
          ? error.message
          : "Integration status could not load.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadIntegrationStatus(), 0);
    return () => window.clearTimeout(timer);
  }, [loadIntegrationStatus, clinicId]);

  useEffect(() => {
    if (!initialOAuthNotice) return;
    window.history.replaceState(null, "", "/app/integrations");
  }, [initialOAuthNotice]);

  const connectGoogleDrive = async () => {
    if (!token || isDriveBusy) return;
    setIsDriveBusy(true);
    setStatusMessage("Starting secure Google Drive connection...");
    setStatusVariant("info");
    try {
      const flow = await api.clientAccounts.startDriveOAuth(token);
      window.location.assign(flow.authorizeUrl);
    } catch (error) {
      setStatusMessage(
        error instanceof ApiClientError
          ? error.message
          : "Could not start Google Drive authorization.",
      );
      setStatusVariant("warning");
      setIsDriveBusy(false);
    }
  };

  const connectGoogleCalendar = async () => {
    if (!token || isCalendarBusy) return;
    setIsCalendarBusy(true);
    setStatusMessage("Starting secure Google Calendar connection...");
    setStatusVariant("info");
    try {
      const flow = await api.calendar.startOAuth(token);
      window.location.assign(flow.authorizeUrl);
    } catch (error) {
      setStatusMessage(
        error instanceof ApiClientError
          ? error.message
          : "Could not start Google Calendar authorization.",
      );
      setStatusVariant("warning");
      setIsCalendarBusy(false);
    }
  };

  const syncGoogleCalendar = async () => {
    if (!token || isCalendarBusy) return;
    setIsCalendarBusy(true);
    setStatusMessage("Syncing upcoming Google Calendar meetings...");
    setStatusVariant("info");
    try {
      const result = await api.calendar.sync(token);
      setStatusMessage(`Google Calendar synced ${result.synced} upcoming meetings.`);
      await loadIntegrationStatus();
    } catch (error) {
      setStatusMessage(
        error instanceof ApiClientError
          ? error.message
          : "Google Calendar meetings could not be synced.",
      );
      setStatusVariant("warning");
    } finally {
      setIsCalendarBusy(false);
    }
  };

  const revokeGoogleCalendar = async () => {
    if (!token || isCalendarBusy) return;
    const confirmed = window.confirm("Disconnect Google Calendar from Mission Control?");
    if (!confirmed) return;
    setIsCalendarBusy(true);
    try {
      await api.calendar.revoke(token);
      setStatusMessage("Google Calendar has been disconnected.");
      setStatusVariant("info");
      await loadIntegrationStatus();
    } catch (error) {
      setStatusMessage(
        error instanceof ApiClientError
          ? error.message
          : "Google Calendar could not be disconnected.",
      );
      setStatusVariant("warning");
    } finally {
      setIsCalendarBusy(false);
    }
  };

  const connectQuickBooks = async () => {
    if (!token || isQuickBooksBusy) return;
    setIsQuickBooksBusy(true);
    setStatusMessage("Starting secure QuickBooks connection...");
    setStatusVariant("info");
    try {
      const flow = await api.quickbooks.startOAuth(token);
      window.location.assign(flow.authorizeUrl);
    } catch (error) {
      setStatusMessage(
        error instanceof ApiClientError
          ? error.message
          : "Could not start QuickBooks authorization.",
      );
      setStatusVariant("warning");
      setIsQuickBooksBusy(false);
    }
  };

  const revokeQuickBooks = async () => {
    if (!token || isQuickBooksBusy) return;
    const confirmed = window.confirm("Disconnect QuickBooks from Mission Control?");
    if (!confirmed) return;
    setIsQuickBooksBusy(true);
    try {
      await api.quickbooks.revoke(token);
      setStatusMessage("QuickBooks has been disconnected. Manual invoice and payment fields are unchanged.");
      setStatusVariant("info");
      await loadIntegrationStatus();
    } catch (error) {
      setStatusMessage(
        error instanceof ApiClientError
          ? error.message
          : "QuickBooks could not be disconnected.",
      );
      setStatusVariant("warning");
    } finally {
      setIsQuickBooksBusy(false);
    }
  };

  const driveStatus = driveConnection?.connected
    ? driveConnection.accessLevel === "full"
      ? "Full access"
      : "Limited access"
    : "Not connected";

  if (!isAdmin) {
    return (
      <AlertBanner
        icon={AlertTriangle}
        title="Admin access required"
        description="Only Admin and Super Admin users can view or configure workspace integrations. Your role can still use connected services from the relevant client and workflow pages."
        variant="warning"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        subtitle="Manage the small set of services used by this internal workspace."
        right={
          <button
            type="button"
            onClick={() => void loadIntegrationStatus()}
            disabled={isLoading || !token}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d8ddda] bg-[#FFFCF9] px-4 py-2.5 text-sm font-semibold text-[#5e8a8d] transition-colors hover:bg-[#eaedeb] disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh status
          </button>
        }
      />

      {loadError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Integration status could not load"
          description={loadError}
          variant="warning"
        />
      )}

      {statusMessage && (
        <AlertBanner
          icon={statusVariant === "warning" ? AlertTriangle : CheckCircle}
          title={statusVariant === "warning" ? "Integration needs attention" : "Integration updated"}
          description={statusMessage}
          variant={statusVariant}
        />
      )}

      <section className="space-y-3" aria-labelledby="core-integrations-heading">
        <div>
          <h2 id="core-integrations-heading" className="text-sm font-semibold text-[#151f21]">
            Workspace integrations
          </h2>
          <p className="mt-1 text-xs text-[#5e8a8d]">
            The connections used by Mission Control today.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#60b4af]/12 text-[#346866]">
                  <HardDrive className="h-6 w-6" aria-hidden="true" />
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    driveConnection?.connected
                      ? "border-[#60b4af]/30 bg-[#60b4af]/10 text-[#346866]"
                      : "border-[#d8ddda] bg-[#eaedeb] text-[#5e8a8d]"
                  }`}
                >
                  {isLoading ? "Checking" : driveStatus}
                </span>
              </div>
              <h3 className="mt-5 font-semibold text-[#151f21]">Google Drive</h3>
              <p className="mt-1 text-sm leading-6 text-[#5e8a8d]">
                Connect the master Workspace Drive to validate client folders and support managed file workflows.
              </p>
              {driveConnection?.connectedEmail && (
                <p className="mt-3 text-xs text-[#5e8a8d]">
                  Connected as <span className="font-semibold text-[#151f21]">{driveConnection.connectedEmail}</span>
                  {driveConnection.connectedAt ? ` - ${formatDateTime(driveConnection.connectedAt)}` : ""}
                </p>
              )}
              <button
                type="button"
                onClick={() => void connectGoogleDrive()}
                disabled={!token || isLoading || isDriveBusy}
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#102427] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1d393c] disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
              >
                {isDriveBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <HardDrive className="h-4 w-4" aria-hidden="true" />
                )}
                {driveConnection?.connected ? "Reconnect Drive" : "Connect Google Drive"}
              </button>
            </div>
          </Card>

          <Card>
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#6E6AE8]/10 text-[#4845a8]">
                  <CalendarClock className="h-6 w-6" aria-hidden="true" />
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    calendarConnection?.connected
                      ? "border-[#60b4af]/30 bg-[#60b4af]/10 text-[#346866]"
                      : "border-[#d8ddda] bg-[#eaedeb] text-[#5e8a8d]"
                  }`}
                >
                  {isLoading ? "Checking" : calendarConnection?.connected ? "Connected" : "Not connected"}
                </span>
              </div>
              <h3 className="mt-5 font-semibold text-[#151f21]">Google Calendar</h3>
              <p className="mt-1 text-sm leading-6 text-[#5e8a8d]">
                Pull agreed calls and meetings into Mission Control so dashboards and records show what is coming next.
              </p>
              {calendarConnection?.connectedEmail && (
                <p className="mt-3 text-xs text-[#5e8a8d]">
                  Connected as <span className="font-semibold text-[#151f21]">{calendarConnection.connectedEmail}</span>
                  {calendarConnection.lastSync ? ` - Last sync ${formatDateTime(calendarConnection.lastSync)}` : ""}
                </p>
              )}
              {calendarConnection?.lastSyncError && (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  {calendarConnection.lastSyncError}
                </p>
              )}
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => void connectGoogleCalendar()}
                  disabled={!token || isLoading || isCalendarBusy}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#102427] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1d393c] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCalendarBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                  )}
                  {calendarConnection?.connected ? "Reconnect Calendar" : "Connect Calendar"}
                </button>
                {calendarConnection?.connected && (
                  <>
                    <button
                      type="button"
                      onClick={() => void syncGoogleCalendar()}
                      disabled={!token || isCalendarBusy}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d8ddda] bg-[#FFFCF9] px-4 py-2.5 text-sm font-semibold text-[#5e8a8d] transition-colors hover:bg-[#eaedeb] disabled:opacity-60"
                    >
                      <RefreshCw className={`h-4 w-4 ${isCalendarBusy ? "animate-spin" : ""}`} aria-hidden="true" />
                      Sync meetings
                    </button>
                    <button
                      type="button"
                      onClick={() => void revokeGoogleCalendar()}
                      disabled={!token || isCalendarBusy}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
                    >
                      Disconnect
                    </button>
                  </>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <CreditCard className="h-6 w-6" aria-hidden="true" />
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    quickBooksConnection?.connected
                      ? "border-[#60b4af]/30 bg-[#60b4af]/10 text-[#346866]"
                      : quickBooksConnection?.enabled
                        ? "border-[#b7672e]/25 bg-[#b7672e]/10 text-[#7a3f16]"
                        : "border-[#d8ddda] bg-[#eaedeb] text-[#5e8a8d]"
                  }`}
                >
                  {isLoading ? "Checking" : quickBooksConnection?.connected ? "Connected" : quickBooksConnection?.enabled ? "Ready to connect" : "Env disabled"}
                </span>
              </div>
              <h3 className="mt-5 font-semibold text-[#151f21]">QuickBooks</h3>
              <p className="mt-1 text-sm leading-6 text-[#5e8a8d]">
                Connect QuickBooks so client accounts can be mapped to the right customer while manual invoice and payment fields remain available.
              </p>
              {quickBooksConnection?.connected && (
                <div className="mt-3 rounded-xl border border-[#d8ddda] bg-[#FFFCF9] p-3 text-xs leading-5 text-[#5e8a8d]">
                  <p>
                    Company: <span className="font-semibold text-[#151f21]">{quickBooksConnection.companyName || quickBooksConnection.realmId}</span>
                  </p>
                  <p>
                    Environment: <span className="font-semibold text-[#151f21]">{quickBooksConnection.environment}</span>
                    {quickBooksConnection.connectedAt ? ` - ${formatDateTime(quickBooksConnection.connectedAt)}` : ""}
                  </p>
                </div>
              )}
              {quickBooksConnection?.lastError && (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  {quickBooksConnection.lastError}
                </p>
              )}
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => void connectQuickBooks()}
                  disabled={!token || isLoading || isQuickBooksBusy}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#102427] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1d393c] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isQuickBooksBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                  )}
                  {quickBooksConnection?.connected ? "Reconnect QuickBooks" : "Connect QuickBooks"}
                </button>
                {quickBooksConnection?.connected && (
                  <button
                    type="button"
                    onClick={() => void revokeQuickBooks()}
                    disabled={!token || isQuickBooksBusy}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#6E6AE8]/10 text-[#4845a8]">
                  <Smartphone className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="rounded-full border border-[#b7672e]/25 bg-[#b7672e]/10 px-2.5 py-1 text-xs font-semibold text-[#7a3f16]">
                  Awaiting credentials
                </span>
              </div>
              <h3 className="mt-5 font-semibold text-[#151f21]">Twilio WhatsApp</h3>
              <p className="mt-1 text-sm leading-6 text-[#5e8a8d]">
                The signed inbound webhook and outbound WhatsApp adapter are deployed. Add the Twilio account credentials and approved sender to activate messaging.
              </p>
              <div className="mt-5 rounded-xl border border-[#d8ddda] bg-[#eaedeb]/55 p-3 text-xs leading-5 text-[#5e8a8d]">
                Messages will appear in the existing CRM inbox and retain the current approval, audit, and retry safeguards.
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="later-integrations-heading">
        <div>
          <h2 id="later-integrations-heading" className="text-sm font-semibold text-[#151f21]">
            Available later
          </h2>
          <p className="mt-1 text-xs text-[#5e8a8d]">Not active in the current internal workflow.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {SECONDARY_INTEGRATIONS.map((integration) => {
            const Icon = integration.icon;
            return (
              <Card key={integration.name}>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#d8ddda] bg-[#FFFCF9] text-[#5e8a8d]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="rounded-full border border-[#d8ddda] bg-[#eaedeb] px-2.5 py-1 text-xs font-semibold text-[#5e8a8d]">
                    Not active
                  </span>
                </div>
                <h3 className="mt-4 font-semibold text-[#151f21]">{integration.name}</h3>
                <p className="mt-1 text-sm leading-6 text-[#5e8a8d]">{integration.description}</p>
                <span className="mt-4 inline-flex rounded-full border border-[#d8ddda] px-2.5 py-1 text-xs font-semibold text-[#5e8a8d]">
                  {integration.category}
                </span>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
