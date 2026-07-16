"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
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
import type { GoogleDriveConnectionRecord } from "@/lib/api-types";
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
    description: "Billing support exists elsewhere in the CRM, but no account connection is exposed here yet.",
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
  const [isLoading, setIsLoading] = useState(true);
  const [isDriveBusy, setIsDriveBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(
    initialOAuthNotice?.message || null,
  );
  const [statusVariant, setStatusVariant] = useState<"info" | "warning">(
    initialOAuthNotice?.variant || "info",
  );

  const loadDriveStatus = useCallback(async () => {
    if (!token || !isAdmin) {
      setDriveConnection(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      setDriveConnection(await api.clientAccounts.getDriveOAuthStatus(token));
    } catch (error) {
      setLoadError(
        error instanceof ApiClientError
          ? error.message
          : "Google Drive status could not load.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDriveStatus(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDriveStatus, clinicId]);

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
            onClick={() => void loadDriveStatus()}
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
                  {driveConnection.connectedAt ? ` · ${formatDateTime(driveConnection.connectedAt)}` : ""}
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
