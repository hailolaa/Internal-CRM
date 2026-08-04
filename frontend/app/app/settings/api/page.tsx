"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { ApiKeyRecord } from "@/lib/api-types";

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ApiKeysSettingsPage() {
  const { session } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [name, setName] = useState("ClinicGrower website lead capture");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadApiKeys() {
      setLoading(true);
      setError(null);
      try {
        const rows = await api.apiKeys.list(session!.token);
        if (!cancelled) setApiKeys(rows);
      } catch (err) {
        console.error("Failed to load API keys", err);
        if (!cancelled) {
          setError("API keys could not be loaded. Check your permission level.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadApiKeys();

    return () => {
      cancelled = true;
    };
  }, [session]);

  async function handleCreate() {
    if (!session?.token || saving) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Give the API key a clear name before creating it.");
      return;
    }

    setSaving(true);
    setError(null);
    setCreatedKey(null);
    setCopied(false);

    try {
      const key = await api.apiKeys.create(session.token, trimmedName);
      setApiKeys((current) => [key, ...current]);
      setCreatedKey(key.key || null);
      setName("ClinicGrower website lead capture");
    } catch (err) {
      console.error("Failed to create API key", err);
      setError("API key could not be created. Check your permission level.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function handleRevoke(apiKeyId: string) {
    if (!session?.token) return;
    const confirmed = window.confirm("Revoke this API key? Connected forms using it will stop working.");
    if (!confirmed) return;

    setError(null);
    try {
      await api.apiKeys.revoke(session.token, apiKeyId);
      setApiKeys((current) =>
        current.map((key) =>
          key.id === apiKeyId
            ? { ...key, status: "revoked", revokedAt: new Date().toISOString() }
            : key,
        ),
      );
    } catch (err) {
      console.error("Failed to revoke API key", err);
      setError("API key could not be revoked.");
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7A746A]">
          Settings
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[#252421]">API Keys</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B625A]">
          Create controlled keys for website forms, Calendly middleware, chatbot capture
          and other approved inbound integrations.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-[#E5DED6] bg-[#FFFCF9] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <label className="flex-1">
            <span className="text-sm font-medium text-[#252421]">Key name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-lg border border-[#D8D0C7] bg-white px-3 py-2 text-sm text-[#252421] outline-none focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/15"
              placeholder="Website lead capture"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={saving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#252421] px-4 text-sm font-semibold text-white transition hover:bg-[#3A3833] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Key
          </button>
        </div>

        {createdKey && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Copy this key now. It will not be shown again.
                </p>
                <code className="mt-2 block break-all rounded-md bg-white px-3 py-2 text-xs text-[#252421]">
                  {createdKey}
                </code>
              </div>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-[#E5DED6] bg-white">
        <div className="border-b border-[#E5DED6] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#252421]">Existing keys</h2>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-[#6B625A]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading API keys
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="px-5 py-8 text-sm text-[#6B625A]">
            No API keys have been created yet.
          </div>
        ) : (
          <div className="divide-y divide-[#EEE8E1]">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#EFEAE4] text-[#6B625A]">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[#252421]">{key.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          key.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {key.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#7A746A]">
                      Prefix {key.keyPrefix} · Created {formatDate(key.createdAt)} · Last used{" "}
                      {formatDate(key.lastUsedAt)}
                    </p>
                  </div>
                </div>
                {key.status === "active" && (
                  <button
                    type="button"
                    onClick={() => void handleRevoke(key.id)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
