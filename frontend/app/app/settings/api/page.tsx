"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Check, Copy, KeyRound, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { ApiKeyRecord, CreateApiKeyPayload, TeamMember } from "@/lib/api-types";

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function sourceKeyFromName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function CodeBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#E5DED6] bg-white">
      <div className="flex items-center justify-between border-b border-[#EEE8E1] px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7A746A]">{label}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex h-8 items-center gap-2 rounded-md border border-[#D8D0C7] px-2 text-xs font-semibold text-[#252421] hover:bg-[#F7F2EC]"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-80 overflow-auto p-3 text-xs leading-5 text-[#252421]">
        <code>{value}</code>
      </pre>
    </div>
  );
}

export default function ApiKeysSettingsPage() {
  const { session } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [form, setForm] = useState<CreateApiKeyPayload>({
    name: "ClinicGrower website lead capture",
    purpose: "landing_page_lead_capture",
    sourceKey: "clinicgrower_website",
    sourceLabel: "ClinicGrower website",
    defaultSource: "clinicgrower_website",
    initialStageName: "New Lead",
    ownerUserId: "",
    followUpEnabled: true,
  });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const endpoint = "/api/public/landing-page-leads";
  const examplePayload = useMemo(() => JSON.stringify({
    idempotencyKey: "lp_2026_08_04_0001",
    accountName: "BristolDent Harbourside",
    fullName: "Sarah Thompson",
    email: "sarah@example.com",
    phone: "+447700900123",
    website: "https://exampleclinic.co.uk",
    message: "I want help with SEO and paid ads.",
    packageInterest: "Clinic Growth",
    landingPage: "https://clinicgrower.co.uk/clinic-growth",
    referrer: "https://google.com",
    utmSource: "google",
    utmMedium: "cpc",
    utmCampaign: "clinic_growth_august",
    gclid: "test-click-id",
    consent: {
      email: true,
      phone: true,
      whatsapp: true,
      permissionSource: "Landing page form checkbox",
    },
  }, null, 2), []);
  const nodeExample = useMemo(() => `const response = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + process.env.MISSION_CONTROL_LEAD_API_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(${examplePayload})
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message || "Mission Control lead capture failed");
}

const result = await response.json();`, [examplePayload]);

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadApiKeys() {
      setLoading(true);
      setError(null);
      try {
        const [rows, members] = await Promise.all([
          api.apiKeys.list(session!.token),
          api.team.getMembers(session!.token),
        ]);
        if (!cancelled) {
          setApiKeys(rows);
          setTeamMembers(members.filter((member) => !member.isInvitation && member.status === "active"));
        }
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

  function updateForm<K extends keyof CreateApiKeyPayload>(key: K, value: CreateApiKeyPayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleCreate() {
    if (!session?.token || saving) return;

    const name = form.name.trim();
    const sourceKey = sourceKeyFromName(form.sourceKey || form.name);
    if (!name) {
      setError("Give the API key a clear name before creating it.");
      return;
    }

    setSaving(true);
    setError(null);
    setCreatedKey(null);
    setCopied(false);

    try {
      const key = await api.apiKeys.create(session.token, {
        ...form,
        name,
        sourceKey,
        defaultSource: form.defaultSource?.trim() || sourceKey,
        ownerUserId: form.ownerUserId?.trim() || null,
      });
      setApiKeys((current) => [key, ...current]);
      setCreatedKey(key.key || null);
      setForm((current) => ({
        ...current,
        name: "ClinicGrower website lead capture",
        sourceKey: "clinicgrower_website",
        sourceLabel: "ClinicGrower website",
        defaultSource: "clinicgrower_website",
      }));
    } catch (err) {
      console.error("Failed to create API key", err);
      setError("API key could not be created. Check the source config and permission level.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyCreatedKey() {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function handleRotate(apiKeyId: string) {
    if (!session?.token || rotatingId) return;
    const confirmed = window.confirm("Rotate this API key? The old secret will stop working immediately.");
    if (!confirmed) return;

    setRotatingId(apiKeyId);
    setError(null);
    setCreatedKey(null);
    setCopied(false);
    try {
      const key = await api.apiKeys.rotate(session.token, apiKeyId);
      setApiKeys((current) => current.map((item) => (item.id === apiKeyId ? key : item)));
      setCreatedKey(key.key || null);
    } catch (err) {
      console.error("Failed to rotate API key", err);
      setError("API key could not be rotated.");
    } finally {
      setRotatingId(null);
    }
  }

  async function handleRevoke(apiKeyId: string) {
    if (!session?.token) return;
    const confirmed = window.confirm("Revoke this API key? Connected landing pages using it will stop working.");
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
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7A746A]">
            Settings
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#252421]">API Keys</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6B625A]">
            Create source-specific keys for server-side landing-page lead capture, Calendly middleware,
            chatbot capture and other approved inbound integrations. Private keys should stay on the
            sending server and must not be used in browser JavaScript.
          </p>
        </div>
        <Link
          href="/app/settings/api/docs"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#D8D0C7] bg-white px-3 text-sm font-semibold text-[#252421] hover:bg-[#F7F2EC]"
        >
          <BookOpen className="h-4 w-4" />
          Integration Docs
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-[#E5DED6] bg-[#FFFCF9] p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <label>
            <span className="text-sm font-medium text-[#252421]">Key name</span>
            <input
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              className="mt-2 w-full rounded-lg border border-[#D8D0C7] bg-white px-3 py-2 text-sm text-[#252421] outline-none focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/15"
              placeholder="ClinicGrower website lead capture"
            />
          </label>
          <label>
            <span className="text-sm font-medium text-[#252421]">Purpose</span>
            <select
              value={form.purpose}
              onChange={(event) => updateForm("purpose", event.target.value as CreateApiKeyPayload["purpose"])}
              className="mt-2 w-full rounded-lg border border-[#D8D0C7] bg-white px-3 py-2 text-sm text-[#252421] outline-none focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/15"
            >
              <option value="landing_page_lead_capture">Landing-page lead capture</option>
              <option value="general">General API key</option>
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-[#252421]">Source key</span>
            <input
              value={form.sourceKey || ""}
              onChange={(event) => updateForm("sourceKey", event.target.value)}
              className="mt-2 w-full rounded-lg border border-[#D8D0C7] bg-white px-3 py-2 text-sm text-[#252421] outline-none focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/15"
              placeholder="clinicgrower_website"
            />
          </label>
          <label>
            <span className="text-sm font-medium text-[#252421]">Source label</span>
            <input
              value={form.sourceLabel || ""}
              onChange={(event) => updateForm("sourceLabel", event.target.value)}
              className="mt-2 w-full rounded-lg border border-[#D8D0C7] bg-white px-3 py-2 text-sm text-[#252421] outline-none focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/15"
              placeholder="ClinicGrower website"
            />
          </label>
          <label>
            <span className="text-sm font-medium text-[#252421]">Default source</span>
            <input
              value={form.defaultSource || ""}
              onChange={(event) => updateForm("defaultSource", event.target.value)}
              className="mt-2 w-full rounded-lg border border-[#D8D0C7] bg-white px-3 py-2 text-sm text-[#252421] outline-none focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/15"
              placeholder="clinicgrower_website"
            />
          </label>
          <label>
            <span className="text-sm font-medium text-[#252421]">Initial pipeline stage</span>
            <input
              value={form.initialStageName || ""}
              onChange={(event) => updateForm("initialStageName", event.target.value)}
              className="mt-2 w-full rounded-lg border border-[#D8D0C7] bg-white px-3 py-2 text-sm text-[#252421] outline-none focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/15"
              placeholder="New Lead"
            />
          </label>
          <label>
            <span className="text-sm font-medium text-[#252421]">Default owner</span>
            <select
              value={form.ownerUserId || ""}
              onChange={(event) => updateForm("ownerUserId", event.target.value)}
              className="mt-2 w-full rounded-lg border border-[#D8D0C7] bg-white px-3 py-2 text-sm text-[#252421] outline-none focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/15"
            >
              <option value="">Unassigned</option>
              {teamMembers.map((member) => {
                const label = [member.firstName, member.lastName].filter(Boolean).join(" ").trim() || member.email;
                return (
                  <option key={member.id} value={member.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-[#E5DED6] bg-white px-3 py-2">
            <input
              type="checkbox"
              checked={form.followUpEnabled !== false}
              onChange={(event) => updateForm("followUpEnabled", event.target.checked)}
              className="h-4 w-4 rounded border-[#D8D0C7]"
            />
            <span className="text-sm font-medium text-[#252421]">Create follow-up task for new inbound leads</span>
          </label>
        </div>
        <div className="mt-4 flex justify-end">
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
                onClick={() => void handleCopyCreatedKey()}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <CodeBlock
          label="Endpoint"
          value={`POST ${endpoint}
Authorization: Bearer <landing-page-api-key>
Content-Type: application/json`}
        />
        <CodeBlock label="Example payload" value={examplePayload} />
        <div className="lg:col-span-2">
          <CodeBlock label="Server-side example" value={nodeExample} />
        </div>
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
                className="flex flex-col gap-3 px-5 py-4 xl:flex-row xl:items-center xl:justify-between"
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
                      <span className="rounded-full bg-[#F7F2EC] px-2 py-0.5 text-xs font-semibold text-[#6B625A]">
                        {key.purpose === "landing_page_lead_capture" ? "Landing lead capture" : "General"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#7A746A]">
                      Prefix {key.keyPrefix} | Created {formatDate(key.createdAt)} | Last used {formatDate(key.lastUsedAt)}
                    </p>
                    <p className="mt-1 text-xs text-[#7A746A]">
                      Source {key.defaultSource || key.sourceKey || "Not set"} | Stage {key.initialStageName || "Default"} | Owner {key.ownerName || key.ownerUserId || "Unassigned"}
                    </p>
                  </div>
                </div>
                {key.status === "active" && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRotate(key.id)}
                      disabled={rotatingId === key.id}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#D8D0C7] px-3 text-sm font-semibold text-[#252421] hover:bg-[#F7F2EC] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {rotatingId === key.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      Rotate
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRevoke(key.id)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Revoke
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
