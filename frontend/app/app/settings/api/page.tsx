"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Key,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Webhook,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type { ApiKeyRecord, WebhookEndpoint } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function APIKeysPage() {
  const { session } = useAuth();
  const [showKey, setShowKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadApiKeys() {
      setIsLoading(true);
      try {
        const [keysResult, endpointsResult] = await Promise.allSettled([
          api.apiKeys.list(session!.token),
          api.webhooks.listEndpoints(session!.token),
        ]);
        if (!cancelled) {
          setApiKeys(keysResult.status === "fulfilled" ? keysResult.value : []);
          setWebhooks(
            endpointsResult.status === "fulfilled" ? endpointsResult.value : [],
          );
          const errors = [keysResult, endpointsResult]
            .filter((result) => result.status === "rejected")
            .map((result) =>
              result.status === "rejected" && result.reason instanceof Error
                ? result.reason.message
                : "Request failed",
            );
          setStatusMessage(errors.length ? errors.join(" ") : null);
        }
      } catch (error) {
        console.error("Failed to load API keys", error);
        if (!cancelled) {
          setApiKeys([]);
          setWebhooks([]);
          setStatusMessage(
            error instanceof Error
              ? `Live API settings could not load: ${error.message}`
              : "Live API settings could not load.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadApiKeys();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const handleCopy = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const maskKey = (key: string) => {
    return key.slice(0, 12) + "••••••••••••" + key.slice(-4);
  };

  const handleCreateKey = async () => {
    if (!session?.token) return;

    const name = window.prompt("API key name", "New integration key");
    if (!name) return;

    try {
      setIsCreating(true);
      const created = await api.apiKeys.create(session.token, name);
      setApiKeys((keys) => [created, ...keys]);
      setShowKey(created.id);
      setStatusMessage("API key created. Copy it now; full keys may only be shown once.");
    } catch (error) {
      console.error("Failed to create API key", error);
      setStatusMessage("Could not create API key.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!session?.token) return;
    const url = window.prompt("Webhook endpoint URL");
    if (!url?.trim()) return;

    try {
      const created = await api.webhooks.createEndpoint(session.token, {
        url: url.trim(),
        description: "Created from settings",
        events: ["contact.created"],
        isActive: true,
      });
      setWebhooks((items) => [
        {
          id: created.id,
          url: url.trim(),
          description: "Created from settings",
          events: ["contact.created"],
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...items,
      ]);
      setStatusMessage("Webhook endpoint created.");
    } catch (error) {
      console.error("Failed to create webhook endpoint", error);
      setStatusMessage(
        error instanceof Error ? error.message : "Could not create webhook endpoint.",
      );
    }
  };

  const handleToggleWebhook = async (webhook: WebhookEndpoint) => {
    if (!session?.token) return;
    const isActive = !webhook.isActive;

    try {
      await api.webhooks.updateEndpoint(session.token, webhook.id, { isActive });
      setWebhooks((items) =>
        items.map((item) =>
          item.id === webhook.id ? { ...item, isActive } : item,
        ),
      );
      setStatusMessage("Webhook endpoint updated.");
    } catch (error) {
      console.error("Failed to update webhook endpoint", error);
      setStatusMessage(
        error instanceof Error ? error.message : "Could not update webhook endpoint.",
      );
    }
  };

  const handleDeleteWebhook = async (webhook: WebhookEndpoint) => {
    if (!session?.token) return;
    if (!window.confirm(`Delete webhook endpoint ${webhook.url}?`)) return;

    try {
      await api.webhooks.removeEndpoint(session.token, webhook.id);
      setWebhooks((items) => items.filter((item) => item.id !== webhook.id));
      setStatusMessage("Webhook endpoint deleted.");
    } catch (error) {
      console.error("Failed to delete webhook endpoint", error);
      setStatusMessage(
        error instanceof Error ? error.message : "Could not delete webhook endpoint.",
      );
    }
  };

  const handleRevokeKey = async (apiKey: ApiKeyRecord) => {
    if (!session?.token || apiKey.status === "revoked") return;
    if (!window.confirm(`Revoke ${apiKey.name}?`)) return;

    try {
      await api.apiKeys.revoke(session.token, apiKey.id);
      setApiKeys((keys) =>
        keys.map((key) =>
          key.id === apiKey.id
            ? { ...key, status: "revoked", revokedAt: new Date().toISOString() }
            : key,
        ),
      );
      setStatusMessage("API key revoked.");
    } catch (error) {
      console.error("Failed to revoke API key", error);
      setStatusMessage("Could not revoke API key.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/app/settings"
          className="p-2 rounded-lg hover:bg-[rgba(0,0,0,0.03)]"
        >
          <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#111111]">API Keys</h1>
          <p className="text-[#6B7280] text-sm">
            Manage API keys for integrations
          </p>
        </div>
        <button
          onClick={handleCreateKey}
          disabled={isCreating || isLoading || !session?.token}
          className="bg-[#6E6AE8] hover:bg-[#5A56D4] text-white font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-60"
        >
          <Plus className="w-4 h-4" />{" "}
          {isCreating ? "Creating..." : "Create API Key"}
        </button>
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200/60 rounded-[24px] p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-700">
            Keep your API keys secure
          </p>
          <p className="text-sm text-[#6B7280]">
            Never share your API keys publicly or commit them to version
            control. Rotate keys regularly for security.
          </p>
        </div>
      </div>

      <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] overflow-hidden">
        <div className="px-6 py-4 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="font-semibold text-[#111111]">Your API Keys</h2>
        </div>
        <div className="divide-y divide-[rgba(0,0,0,0.04)]">
          {isLoading &&
            Array.from({ length: 3 }, (_, index) => (
              <div key={`api-key-loading-${index}`} className="p-6">
                <div className="h-16 rounded-lg bg-[rgba(0,0,0,0.03)] skeleton-shimmer" />
              </div>
            ))}
          {!isLoading && apiKeys.length === 0 && (
            <div className="p-6 text-sm text-[#6B7280]">
              No live API keys have been created yet.
            </div>
          )}
          {!isLoading && apiKeys.map((apiKey) => (
            <div key={apiKey.id} className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${apiKey.status === "active" ? "bg-[rgba(110,106,232,0.08)]" : "bg-[rgba(0,0,0,0.03)]"}`}
                  >
                    <Key
                      className={`w-5 h-5 ${apiKey.status === "active" ? "text-[#6E6AE8]" : "text-[#6B7280]"}`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-[#111111]">
                        {apiKey.name}
                      </h3>
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${apiKey.status === "active" ? "bg-green-50 text-green-600" : "bg-[rgba(0,0,0,0.03)] text-[#6B7280]"}`}
                      >
                        {apiKey.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-sm text-[#6B7280] font-mono bg-[rgba(0,0,0,0.03)] px-2 py-1 rounded">
                        {showKey === apiKey.id
                          ? (apiKey.key ?? apiKey.keyPrefix)
                          : maskKey(apiKey.key ?? apiKey.keyPrefix)}
                      </code>
                      <button
                        onClick={() =>
                          setShowKey(showKey === apiKey.id ? null : apiKey.id)
                        }
                        aria-label={
                          showKey === apiKey.id
                            ? `Hide ${apiKey.name}`
                            : `Show ${apiKey.name}`
                        }
                        className="p-1 hover:bg-[rgba(0,0,0,0.03)] rounded"
                      >
                        {showKey === apiKey.id ? (
                          <EyeOff className="w-4 h-4 text-[#6B7280]" />
                        ) : (
                          <Eye className="w-4 h-4 text-[#6B7280]" />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          handleCopy(apiKey.key ?? apiKey.keyPrefix, apiKey.id)
                        }
                        aria-label={`Copy ${apiKey.name} to clipboard`}
                        className="p-1 hover:bg-[rgba(0,0,0,0.03)] rounded"
                      >
                        {copied === apiKey.id ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-[#6B7280]" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-[#6B7280]">
                      <span>Created: {formatDate(apiKey.createdAt)}</span>
                      <span>Last used: {formatDate(apiKey.lastUsedAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRevokeKey(apiKey)}
                    disabled={apiKey.status === "revoked"}
                    aria-label={`Delete ${apiKey.name}`}
                    className="p-2 hover:bg-[rgba(0,0,0,0.03)] rounded-lg disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6">
          <h2 className="font-semibold text-[#111111] mb-4">Quick Start</h2>
          <p className="text-sm text-[#6B7280] mb-4">
            Use your API key to authenticate requests:
          </p>
          <div className="bg-[#111111] rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <pre className="text-gray-300">
              {`curl -X GET "https://api.clinicgrower.ai/v1/contacts" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}
            </pre>
          </div>
          <Link
            href="/app/settings/api/docs"
            className="inline-flex items-center gap-1 text-sm text-[#6E6AE8] hover:text-[#5A56D4] mt-4"
          >
            View API Documentation →
          </Link>
        </div>

        <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6">
          <h2 className="font-semibold text-[#111111] mb-4">API Usage</h2>
          <div className="space-y-4">
            <p className="text-sm text-[#6B7280]">
              API key usage counts and rate-limit telemetry are not exposed by
              the backend yet. This page shows live key metadata and webhook
              endpoint configuration only.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6">
        <h2 className="font-semibold text-[#111111] mb-4">Webhooks</h2>
        <p className="text-sm text-[#6B7280] mb-4">
          Receive real-time notifications when events happen in your account.
        </p>
        <div className="space-y-3 mb-4">
          {isLoading &&
            Array.from({ length: 2 }, (_, index) => (
              <div
                key={`webhook-loading-${index}`}
                className="h-16 rounded-lg bg-[rgba(0,0,0,0.03)] skeleton-shimmer"
              />
            ))}
          {!isLoading && webhooks.length === 0 && (
            <div className="p-4 bg-[rgba(0,0,0,0.02)] rounded-lg text-sm text-[#6B7280]">
              No live webhook endpoints have been created yet.
            </div>
          )}
          {!isLoading && webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="flex items-center justify-between gap-3 p-4 bg-[rgba(0,0,0,0.02)] rounded-lg"
            >
              <div className="min-w-0">
                <p className="font-medium text-[#111111] break-all">
                  {webhook.url}
                </p>
                <p className="text-xs text-[#6B7280]">
                  Events: {webhook.events.join(", ") || "None"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleWebhook(webhook)}
                  className={`px-2 py-1 text-xs rounded ${
                    webhook.isActive
                      ? "bg-green-50 text-green-600"
                      : "bg-[rgba(0,0,0,0.03)] text-[#6B7280]"
                  }`}
                >
                  {webhook.isActive ? "Active" : "Inactive"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteWebhook(webhook)}
                  className="p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.03)]"
                  aria-label={`Delete webhook ${webhook.url}`}
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleCreateWebhook}
          disabled={isLoading || !session?.token}
          className="w-full py-2.5 border border-dashed border-[rgba(0,0,0,0.12)] rounded-lg text-sm text-[#6B7280] hover:border-[rgba(110,106,232,0.3)] hover:text-[#6E6AE8] transition-colors disabled:opacity-60"
        >
          <Webhook className="inline-block w-4 h-4 mr-1" />
          + Add Webhook Endpoint
        </button>
      </div>
    </div>
  );
}
