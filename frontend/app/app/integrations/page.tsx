"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  CircleSlash,
  Clock,
  Crosshair,
  CreditCard,
  Building2,
  Loader2,
  Mail,
  Megaphone,
  MessageCircle,
  Plug,
  RefreshCw,
  Search,
  Smartphone,
  Syringe,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { PageHeader, Card, AlertBanner, FilterTabs } from "@/components/ui";
import { api, ApiClientError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  ConnectorAccountChoiceRecord,
  ConnectorDefinitionRecord,
  ConnectorStatusRecord,
  MarketingConnectorType,
} from "@/lib/api-types";

type ConnectorViewState =
  | "connected"
  | "disconnected"
  | "syncing"
  | "failed"
  | "not_integrated";

type UnsupportedConnector = {
  name: string;
  description: string;
  category: string;
  icon: LucideIcon;
};

const CONNECTOR_ICONS: Record<MarketingConnectorType, LucideIcon> = {
  google_ads: Crosshair,
  meta: Smartphone,
  google_business_profile: Building2,
  ga4: BarChart3,
  seo: Search,
};

const CONNECTOR_LABELS: Record<MarketingConnectorType, string> = {
  google_ads: "Google Ads",
  meta: "Meta Ads",
  google_business_profile: "Google Business Profile",
  ga4: "Google Analytics 4",
  seo: "SEO",
};

function getInitialOAuthNotice() {
  if (typeof window === "undefined") return null;
  const searchParams = new URLSearchParams(window.location.search);
  const oauth = searchParams.get("oauth");
  const connector = searchParams.get("connector");
  if (!oauth || !connector) return null;

  const label = CONNECTOR_LABELS[connector as MarketingConnectorType] || "Connector";
  if (oauth === "connected") {
    return {
      message: `${label} OAuth connected. Sync the connector to import the latest data.`,
      variant: "info" as const,
    };
  }
  if (oauth === "error") {
    return {
      message: searchParams.get("message") || `${label} OAuth could not be completed.`,
      variant: "warning" as const,
    };
  }
  return null;
}

const UNSUPPORTED_CONNECTORS: UnsupportedConnector[] = [
  {
    name: "Twilio SMS",
    description:
      "Call and SMS webhooks exist elsewhere, but production connector setup is not exposed on this page yet.",
    category: "Comms",
    icon: MessageCircle,
  },
  {
    name: "WhatsApp Business",
    description:
      "Vendor OAuth and message sync are not implemented for the production frontend connector flow.",
    category: "Comms",
    icon: MessageCircle,
  },
  {
    name: "Gmail / Outlook",
    description:
      "Email inbox OAuth is not implemented in the backend connector workflow yet.",
    category: "Comms",
    icon: Mail,
  },
  {
    name: "Stripe",
    description:
      "Billing and deposit checkout use Stripe, but a marketing connector sync is not available here.",
    category: "Payments",
    icon: CreditCard,
  },
  {
    name: "Mailchimp",
    description:
      "Audience sync is not implemented in the production connector workflow yet.",
    category: "Marketing",
    icon: Megaphone,
  },
  {
    name: "Cliniko",
    description:
      "Practice management sync is a future connector and is not live in this frontend flow.",
    category: "Practice Management",
    icon: Building2,
  },
  {
    name: "Pabau",
    description:
      "Clinic software sync is a future connector and is not live in this frontend flow.",
    category: "Practice Management",
    icon: Syringe,
  },
  {
    name: "Zapier",
    description:
      "Zapier-style automation setup is not connected to a production backend connector yet.",
    category: "Automation",
    icon: Zap,
  },
];

const statusConfig: Record<
  ConnectorViewState,
  { color: string; text: string; icon: LucideIcon }
> = {
  connected: {
    color: "border-[#60b4af]/30 bg-[#60b4af]/10 text-[#346866]",
    text: "Connected",
    icon: CheckCircle,
  },
  disconnected: {
    color: "border-[#d8ddda] bg-[#eaedeb] text-[#5e8a8d]",
    text: "Disconnected",
    icon: CircleSlash,
  },
  syncing: {
    color: "border-[#6E6AE8]/25 bg-[#6E6AE8]/10 text-[#4845a8]",
    text: "Syncing",
    icon: Loader2,
  },
  failed: {
    color: "border-[#b7672e]/30 bg-[#b7672e]/10 text-[#7a3f16]",
    text: "Failed",
    icon: AlertCircle,
  },
  not_integrated: {
    color: "border-[#A8A39B]/30 bg-[#A8A39B]/10 text-[#5e8a8d]",
    text: "Not integrated",
    icon: AlertTriangle,
  },
};

function getConnectorState(connector: ConnectorStatusRecord): ConnectorViewState {
  if (connector.lastSyncStatus === "running") return "syncing";
  if (
    connector.lastSyncStatus === "failed" ||
    connector.healthStatus === "error"
  ) {
    return "failed";
  }
  if (!connector.configured || connector.setupStatus !== "ready") {
    return "disconnected";
  }
  return "connected";
}

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatFreshness(connector: ConnectorStatusRecord) {
  if (connector.dataFreshness.status === "never_synced") return "Never synced";
  if (connector.dataFreshness.ageHours === null) {
    return connector.dataFreshness.status;
  }
  return `${connector.dataFreshness.status} - ${connector.dataFreshness.ageHours}h old`;
}

function getSetupMessage(connector: ConnectorStatusRecord) {
  if (connector.selectionRequired) {
    return "OAuth is connected. Choose the account, property, or location this clinic should use.";
  }
  if (connector.selectedAccountLabel) {
    return `Connected to ${connector.selectedAccountLabel}.`;
  }
  if (connector.setupStatus === "missing_permissions") {
    return `Missing permissions: ${connector.missingPermissions.join(", ")}`;
  }
  if (connector.setupStatus === "needs_oauth") {
    return "OAuth is required before this connector can be considered connected.";
  }
  if (connector.setupStatus === "not_configured") {
    return "No connector setup has been saved for this clinic.";
  }
  return "Backend connector setup is ready for this clinic.";
}

function getConnectorConfigValues(
  definition: ConnectorDefinitionRecord | undefined,
  values: Partial<Record<MarketingConnectorType, Record<string, string>>>,
) {
  if (!definition) return {};

  const config: Record<string, string> = {};
  const connectorValues = values[definition.type] || {};
  for (const field of definition.configFields) {
    const trimmed = (connectorValues[field.key] || "").trim();
    if (field.required && !trimmed) {
      return {
        config: null,
        error: `${field.label} is required before connecting ${definition.name}.`,
      };
    }
    if (trimmed) config[field.key] = trimmed;
  }
  return { config, error: null };
}

export default function IntegrationsPage() {
  const { session } = useAuth();
  const [initialOAuthNotice] = useState(getInitialOAuthNotice);
  const token = session?.token;
  const clinicId = session?.clinicId;
  const [activeTab, setActiveTab] = useState("all");
  const [connectors, setConnectors] = useState<ConnectorStatusRecord[]>([]);
  const [definitions, setDefinitions] = useState<ConnectorDefinitionRecord[]>([]);
  const [connectorConfigValues, setConnectorConfigValues] = useState<
    Partial<Record<MarketingConnectorType, Record<string, string>>>
  >({});
  const [connectorChoices, setConnectorChoices] = useState<
    Partial<Record<MarketingConnectorType, ConnectorAccountChoiceRecord[]>>
  >({});
  const [selectedChoices, setSelectedChoices] = useState<
    Partial<Record<MarketingConnectorType, string>>
  >({});
  const [choiceErrors, setChoiceErrors] = useState<
    Partial<Record<MarketingConnectorType, string>>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(
    initialOAuthNotice?.message || null,
  );
  const [statusVariant, setStatusVariant] = useState<"info" | "warning">(
    initialOAuthNotice?.variant || "info",
  );
  const [busyConnector, setBusyConnector] =
    useState<MarketingConnectorType | null>(null);

  const showNotice = useCallback(
    (message: string, variant: "info" | "warning" = "info") => {
      setStatusMessage(message);
      setStatusVariant(variant);
    },
    [],
  );

  const loadConnectors = useCallback(async () => {
    if (!token) {
      setConnectors([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const [definitionRows, rows] = await Promise.all([
        api.integrations.listConnectorDefinitions(token),
        api.integrations.listConnectorStatuses(token),
      ]);
      setDefinitions(definitionRows);
      setConnectors(rows);
    } catch (error) {
      setConnectors([]);
      setLoadError(
        error instanceof ApiClientError
          ? error.message
          : "Connector status could not load.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadConnectors();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadConnectors, clinicId]);

  useEffect(() => {
    if (!initialOAuthNotice) return;
    window.history.replaceState(null, "", "/app/integrations");
  }, [initialOAuthNotice]);

  const filteredConnectors = useMemo(() => {
    if (activeTab === "all") return connectors;
    return connectors.filter(
      (connector) => getConnectorState(connector) === activeTab,
    );
  }, [activeTab, connectors]);

  const showUnsupported =
    activeTab === "all" || activeTab === "not_integrated";

  const connectedCount = connectors.filter(
    (connector) => getConnectorState(connector) === "connected",
  ).length;
  const syncingCount = connectors.filter(
    (connector) => getConnectorState(connector) === "syncing",
  ).length;
  const failedCount = connectors.filter(
    (connector) => getConnectorState(connector) === "failed",
  ).length;

  const setupManualConnector = async (connector: ConnectorStatusRecord) => {
    if (!token || busyConnector) return;
    const definition = definitions.find((item) => item.type === connector.type);
    const { config, error } = getConnectorConfigValues(
      definition,
      connectorConfigValues,
    );
    if (error || config === null) {
      showNotice(error || `Could not read ${connector.name} setup fields.`, "warning");
      return;
    }

    setBusyConnector(connector.type);
    showNotice(`Saving ${connector.name} connector setup...`);

    try {
      const updated = await api.integrations.setupConnector(token, connector.type, {
        isActive: true,
        missingPermissions: [],
        oauthAuthorizeUrl: null,
        config: {
          ...config,
          setupMode: definition?.oauthSupported ? "oauth_config_pending" : "manual_fallback",
          oauthConnected: false,
          productionFrontendConfirmed: true,
        },
      });
      setConnectors((items) =>
        items.map((item) => (item.type === updated.type ? updated : item)),
      );
      showNotice(
        `${connector.name} setup saved for this clinic. Vendor OAuth is not implied; manual fallback data remains explicit.`,
      );
    } catch (error) {
      showNotice(
        error instanceof ApiClientError
          ? error.message
          : `Could not save ${connector.name} setup.`,
        "warning",
      );
    } finally {
      setBusyConnector(null);
    }
  };

  const startOAuth = async (connector: ConnectorStatusRecord) => {
    if (!token || busyConnector) return;
    const definition = definitions.find((item) => item.type === connector.type);
    if (!definition?.oauthSupported) {
      showNotice(`${connector.name} uses manual configuration in Phase 1.`, "warning");
      return;
    }
    const setupPayload: { config?: Record<string, unknown> } = {};
    if (connector.type === "seo") {
      const { config, error } = getConnectorConfigValues(
        definition,
        connectorConfigValues,
      );
      if (error || config === null) {
        showNotice(error || `Could not read ${connector.name} setup fields.`, "warning");
        return;
      }
      setupPayload.config = config;
    }

    setBusyConnector(connector.type);
    showNotice(`Starting ${connector.name} OAuth...`);
    try {
      const flow = await api.integrations.startConnectorOAuth(token, connector.type, setupPayload);
      window.location.assign(flow.authorizeUrl);
    } catch (error) {
      showNotice(
        error instanceof ApiClientError
          ? error.message
          : `Could not start ${connector.name} OAuth.`,
        "warning",
      );
    } finally {
      setBusyConnector(null);
    }
  };

  const loadAccountChoices = async (connector: ConnectorStatusRecord) => {
    if (!token || busyConnector) return;
    setBusyConnector(connector.type);
    setChoiceErrors((current) => ({ ...current, [connector.type]: undefined }));
    showNotice(`Loading ${connector.name} account choices...`);

    try {
      const choices = await api.integrations.listConnectorAccounts(token, connector.type);
      setConnectorChoices((current) => ({ ...current, [connector.type]: choices }));
      if (choices.length === 0) {
        const message = `No accessible ${connector.name} accounts were found for the connected login.`;
        setChoiceErrors((current) => ({ ...current, [connector.type]: message }));
        showNotice(message, "warning");
      } else if (choices.length === 1) {
        const updated = await api.integrations.selectConnectorAccount(
          token,
          connector.type,
          { selectionId: choices[0].id },
        );
        setConnectors((items) =>
          items.map((item) => (item.type === updated.type ? updated : item)),
        );
        showNotice(`${connector.name} connected to ${choices[0].label}.`);
      } else {
        setSelectedChoices((current) => ({
          ...current,
          [connector.type]: current[connector.type] || choices[0].id,
        }));
        showNotice(`Choose the ${connector.name} account for this clinic.`);
      }
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : `Could not load ${connector.name} account choices.`;
      setChoiceErrors((current) => ({ ...current, [connector.type]: message }));
      showNotice(message, "warning");
    } finally {
      setBusyConnector(null);
    }
  };

  const selectAccountChoice = async (connector: ConnectorStatusRecord) => {
    if (!token || busyConnector) return;
    const selectionId = selectedChoices[connector.type];
    if (!selectionId) {
      showNotice(`Choose a ${connector.name} account first.`, "warning");
      return;
    }

    setBusyConnector(connector.type);
    showNotice(`Saving ${connector.name} account selection...`);
    try {
      const updated = await api.integrations.selectConnectorAccount(
        token,
        connector.type,
        { selectionId },
      );
      setConnectors((items) =>
        items.map((item) => (item.type === updated.type ? updated : item)),
      );
      showNotice(`${connector.name} account selection saved.`);
    } catch (error) {
      showNotice(
        error instanceof ApiClientError
          ? error.message
          : `Could not save ${connector.name} account selection.`,
        "warning",
      );
    } finally {
      setBusyConnector(null);
    }
  };

  const markConnectorDisconnected = async (connector: ConnectorStatusRecord) => {
    if (!token || busyConnector) return;

    setBusyConnector(connector.type);
    showNotice(`Disconnecting ${connector.name}...`);

    try {
      const updated = await api.integrations.setupConnector(token, connector.type, {
        isActive: false,
        missingPermissions: [],
        oauthAuthorizeUrl: null,
        config: {
          setupMode: "manual_fallback",
          productionFrontendConfirmed: true,
        },
      });
      setConnectors((items) =>
        items.map((item) => (item.type === updated.type ? updated : item)),
      );
      showNotice(`${connector.name} is disconnected for the active clinic.`);
    } catch (error) {
      showNotice(
        error instanceof ApiClientError
          ? error.message
          : `Could not disconnect ${connector.name}.`,
        "warning",
      );
    } finally {
      setBusyConnector(null);
    }
  };

  const syncConnector = async (connector: ConnectorStatusRecord) => {
    if (!token || busyConnector) return;

    setBusyConnector(connector.type);
    setConnectors((items) =>
      items.map((item) =>
        item.type === connector.type
          ? { ...item, lastSyncStatus: "running" }
          : item,
      ),
    );

    try {
      const result = await api.integrations.syncConnector(
        token,
        connector.type,
        {},
      );
      await loadConnectors();
      showNotice(
        `${connector.name} sync completed with ${result.importedRows} imported metric rows.`,
        result.status.lastSyncStatus === "failed" ? "warning" : "info",
      );
    } catch (error) {
      await loadConnectors();
      showNotice(
        error instanceof ApiClientError
          ? error.message
          : `Could not sync ${connector.name}.`,
        "warning",
      );
    } finally {
      setBusyConnector(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        subtitle="Production connector setup, status, and sync health for the active clinic."
        right={
          <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
            <button
              type="button"
              onClick={() => void loadConnectors()}
              disabled={isLoading || !token}
              className="inline-flex items-center gap-2 rounded-xl border border-[#d8ddda] bg-[#FFFCF9] px-3 py-2 font-semibold text-[#5e8a8d] transition-colors hover:bg-[#eaedeb] disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <span className="rounded-full border border-[#60b4af]/25 bg-[#60b4af]/10 px-3 py-1.5 text-xs font-semibold text-[#346866]">
              {isLoading ? "Loading" : `${connectedCount} connected`}
            </span>
            {syncingCount > 0 && (
              <span className="rounded-full border border-[#6E6AE8]/25 bg-[#6E6AE8]/10 px-3 py-1.5 text-xs font-semibold text-[#4845a8]">
                {syncingCount} syncing
              </span>
            )}
            {failedCount > 0 && (
              <span className="rounded-full border border-[#b7672e]/25 bg-[#b7672e]/10 px-3 py-1.5 text-xs font-semibold text-[#7a3f16]">
                {failedCount} failed
              </span>
            )}
          </div>
        }
      />

      <AlertBanner
        icon={Plug}
        title="Production connector state"
        description={`Backend connector status is loaded per active clinic${
          clinicId ? ` (${clinicId})` : ""
        }. Supported marketing connectors can save setup state and record backend sync attempts; unsupported vendors are shown as not integrated and cannot be activated here.`}
        variant="info"
      />

      <FilterTabs
        tabs={[
          "All",
          "Connected",
          "Disconnected",
          "Syncing",
          "Failed",
          "Not integrated",
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {loadError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Connector status could not load"
          description={loadError}
          variant="warning"
        />
      )}

      {statusMessage && (
        <AlertBanner
          icon={statusVariant === "warning" ? AlertTriangle : CheckCircle}
          title={
            statusVariant === "warning"
              ? "Connector action needs attention"
              : "Connector action complete"
          }
          description={statusMessage}
          variant={statusVariant}
        />
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#151f21]">
            Supported marketing connectors
          </h2>
          <span className="text-xs text-[#5e8a8d]">
            Status refreshes after clinic switch
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading &&
            Array.from({ length: 5 }, (_, index) => (
              <Card key={`connector-loading-${index}`}>
                <div className="animate-pulse space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="h-12 w-12 rounded-xl bg-[#eaedeb]" />
                    <div className="h-6 w-28 rounded-full bg-[#eaedeb]" />
                  </div>
                  <div className="h-5 w-40 rounded bg-[#eaedeb]" />
                  <div className="h-4 w-full rounded bg-[#eaedeb]" />
                  <div className="h-4 w-2/3 rounded bg-[#eaedeb]" />
                </div>
              </Card>
            ))}

          {!isLoading && filteredConnectors.length === 0 && (
            <Card>
              <div className="py-8 text-center">
                <Plug className="mx-auto mb-3 h-8 w-8 text-[#5e8a8d]" />
                <h3 className="font-semibold text-[#151f21]">
                  No supported connectors in this view
                </h3>
                <p className="mt-2 text-sm text-[#5e8a8d]">
                  Change the filter or refresh after switching clinics.
                </p>
              </div>
            </Card>
          )}

          {!isLoading &&
            filteredConnectors.map((connector) => {
              const viewState = getConnectorState(connector);
              const config = statusConfig[viewState];
              const StatusIcon = config.icon;
              const ConnectorIcon = CONNECTOR_ICONS[connector.type] || Plug;
              const definition = definitions.find(
                (item) => item.type === connector.type,
              );
              const isBusy = busyConnector === connector.type;
              const isConnected = viewState === "connected";
              const canStartOAuth = Boolean(definition?.oauthSupported);
              const canSync =
                connector.integrationId !== null &&
                connector.setupStatus === "ready" &&
                viewState !== "syncing";

              return (
                <Card key={connector.type} hover>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#d8ddda] bg-[#FFFCF9]">
                      <ConnectorIcon className="h-6 w-6 text-[#5e8a8d]" />
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${config.color}`}
                    >
                      <StatusIcon
                        className={`h-3.5 w-3.5 ${
                          viewState === "syncing" ? "animate-spin" : ""
                        }`}
                      />
                      {config.text}
                    </span>
                  </div>

                  <h3 className="font-semibold text-[#151f21]">
                    {connector.name}
                  </h3>
                  <p className="mt-1 text-sm text-[#5e8a8d]">
                    {getSetupMessage(connector)}
                  </p>

                  <div className="mt-4 space-y-2 rounded-xl border border-[#d8ddda] bg-[#eaedeb]/50 p-3 text-xs text-[#5e8a8d]">
                    <div className="flex items-center justify-between gap-3">
                      <span>Last sync</span>
                      <span className="font-semibold text-[#151f21]">
                        {formatDateTime(connector.lastSync)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Freshness</span>
                      <span className="font-semibold text-[#151f21]">
                        {formatFreshness(connector)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Health</span>
                      <span className="font-semibold text-[#151f21]">
                        {connector.healthStatus}
                      </span>
                    </div>
                  </div>

                  {connector.lastSyncError && (
                    <div className="mt-3 rounded-xl border border-[#b7672e]/20 bg-[#b7672e]/10 px-3 py-2 text-xs text-[#7a3f16]">
                      {connector.lastSyncError}
                    </div>
                  )}

                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase text-[#5e8a8d]">
                      Supported metrics
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {connector.supportedMetrics.slice(0, 5).map((metric) => (
                        <span
                          key={metric}
                          className="rounded-full border border-[#d8ddda] px-2 py-1 text-[11px] text-[#5e8a8d]"
                        >
                          {metric}
                        </span>
                      ))}
                    </div>
                  </div>

                  {definition && (
                    <div className="mt-3 rounded-xl border border-[#d8ddda] bg-[#FFFCF9] px-3 py-2 text-xs text-[#5e8a8d]">
                      <span className="font-semibold text-[#151f21]">
                        Setup:
                      </span>{" "}
                      {definition.oauthSupported
                        ? `${definition.oauthProvider} OAuth`
                        : "Manual configuration"}
                      {!definition.oauthSupported &&
                        definition.configFields.length > 0 &&
                        ` · ${definition.configFields
                          .map((field) => field.label)
                          .join(", ")}`}
                    </div>
                  )}

                  {!isConnected &&
                    definition &&
                    (!definition.oauthSupported || connector.type === "seo") &&
                    definition.configFields.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {definition.configFields.map((field) => (
                        <label
                          key={`${connector.type}-${field.key}`}
                          className="block text-xs font-semibold text-[#5e8a8d]"
                        >
                          {field.label}
                          {field.required && (
                            <span className="ml-1 text-[#b7672e]">*</span>
                          )}
                          <input
                            type="text"
                            value={
                              connectorConfigValues[connector.type]?.[field.key] || ""
                            }
                            onChange={(event) => {
                              const value = event.target.value;
                              setConnectorConfigValues((current) => ({
                                ...current,
                                [connector.type]: {
                                  ...(current[connector.type] || {}),
                                  [field.key]: value,
                                },
                              }));
                            }}
                            placeholder={field.placeholder || field.label}
                            className="mt-1 w-full rounded-xl border border-[#d8ddda] bg-[#FFFCF9] px-3 py-2 text-sm font-medium text-[#151f21] outline-none transition-colors placeholder:text-[#8ba1a3] focus:border-[#5e8a8d]"
                          />
                        </label>
                      ))}
                    </div>
                  )}

                  {!isConnected && connector.selectionRequired && (
                    <div className="mt-4 rounded-xl border border-[#d8ddda] bg-[#FFFCF9] p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase text-[#5e8a8d]">
                          Account selection
                        </p>
                        <button
                          type="button"
                          onClick={() => void loadAccountChoices(connector)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8ddda] px-2.5 py-1.5 text-xs font-semibold text-[#5e8a8d] transition-colors hover:bg-[#eaedeb] disabled:opacity-60"
                        >
                          {isBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          Load accounts
                        </button>
                      </div>

                      {choiceErrors[connector.type] && (
                        <p className="mb-3 rounded-lg border border-[#b7672e]/20 bg-[#b7672e]/10 px-2.5 py-2 text-xs text-[#7a3f16]">
                          {choiceErrors[connector.type]}
                        </p>
                      )}

                      {(connectorChoices[connector.type] || []).length > 1 && (
                        <div className="space-y-3">
                          <select
                            value={selectedChoices[connector.type] || ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              setSelectedChoices((current) => ({
                                ...current,
                                [connector.type]: value,
                              }));
                            }}
                            className="w-full rounded-xl border border-[#d8ddda] bg-[#FFFCF9] px-3 py-2 text-sm font-medium text-[#151f21] outline-none transition-colors focus:border-[#5e8a8d]"
                          >
                            {(connectorChoices[connector.type] || []).map((choice) => (
                              <option key={choice.id} value={choice.id}>
                                {choice.label}
                                {choice.description ? ` - ${choice.description}` : ""}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => void selectAccountChoice(connector)}
                            disabled={isBusy || !selectedChoices[connector.type]}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#5e8a8d] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#507b7e] disabled:opacity-60"
                          >
                            {isBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            Save selection
                          </button>
                        </div>
                      )}

                      {(connectorChoices[connector.type] || []).length === 1 && (
                        <p className="text-xs text-[#5e8a8d]">
                          One account was found and will be selected automatically.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {isConnected ? (
                      <button
                        type="button"
                        onClick={() => void markConnectorDisconnected(connector)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#d8ddda] px-3 py-2 text-sm font-semibold text-[#5e8a8d] transition-colors hover:bg-[#eaedeb] disabled:opacity-60"
                      >
                        {isBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CircleSlash className="h-4 w-4" />
                        )}
                        Disconnect
                      </button>
                    ) : (
                      <>
                        {canStartOAuth && !connector.oauthConnected ? (
                          <button
                            type="button"
                            onClick={() => void startOAuth(connector)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#5e8a8d] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#507b7e] disabled:opacity-60"
                          >
                            {isBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plug className="h-4 w-4" />
                            )}
                            Connect OAuth
                          </button>
                        ) : canStartOAuth && connector.selectionRequired ? (
                          <button
                            type="button"
                            onClick={() => void loadAccountChoices(connector)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#5e8a8d] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#507b7e] disabled:opacity-60"
                          >
                            {isBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            Choose Account
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void setupManualConnector(connector)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#5e8a8d] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#507b7e] disabled:opacity-60"
                          >
                            {isBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            Configure
                          </button>
                        )}
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => void syncConnector(connector)}
                      disabled={!canSync || isBusy}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#d8ddda] px-3 py-2 text-sm font-semibold text-[#5e8a8d] transition-colors hover:bg-[#eaedeb] disabled:opacity-50"
                      title={
                        canSync
                          ? "Record a backend sync attempt"
                          : "Save connector setup before syncing"
                      }
                    >
                      {isBusy && canSync ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Sync check
                    </button>

                    {connector.oauthAuthorizeUrl && (
                      <a
                        href={connector.oauthAuthorizeUrl}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#d8ddda] px-3 py-2 text-sm font-semibold text-[#5e8a8d] transition-colors hover:bg-[#eaedeb]"
                      >
                        <Clock className="h-4 w-4" />
                        Open OAuth
                      </a>
                    )}
                  </div>
                </Card>
              );
            })}
        </div>
      </section>

      {showUnsupported && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[#151f21]">
              Vendor integrations not live in this flow
            </h2>
            <span className="text-xs text-[#5e8a8d]">
              Not connectable from frontend
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {UNSUPPORTED_CONNECTORS.map((connector) => {
              const UnsupportedIcon = connector.icon;
              const config = statusConfig.not_integrated;
              const StatusIcon = config.icon;

              return (
                <Card key={connector.name}>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#d8ddda] bg-[#FFFCF9]">
                      <UnsupportedIcon className="h-6 w-6 text-[#5e8a8d]" />
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${config.color}`}
                    >
                      <StatusIcon className="h-3.5 w-3.5" />
                      {config.text}
                    </span>
                  </div>
                  <h3 className="font-semibold text-[#151f21]">
                    {connector.name}
                  </h3>
                  <p className="mt-1 text-sm text-[#5e8a8d]">
                    {connector.description}
                  </p>
                  <div className="mt-4 inline-flex rounded-full border border-[#d8ddda] px-2.5 py-1 text-xs font-semibold text-[#5e8a8d]">
                    {connector.category}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
