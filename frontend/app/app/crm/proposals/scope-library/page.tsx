"use client";

import { Archive, Loader2, Plus, RotateCcw, Save, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertBanner, PageHeader } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { ProposalScopeLibraryItemPayload, ProposalScopeLibraryItemRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

const categories = [
  "Strategy",
  "Google Ads",
  "Meta Ads",
  "SEO",
  "Google Business Profile",
  "Website/Landing Pages",
  "Tracking",
  "Lead Handling",
  "Reporting",
  "Content",
  "Conversion",
  "Retention",
  "Support",
];

const inputClassName = "mt-1 min-h-10 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15";
const textareaClassName = "mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15";
const cardClassName = "rounded-[8px] border border-[#d8e4df] bg-white p-4";

const emptyDraft: ProposalScopeLibraryItemPayload = {
  name: "",
  category: "Strategy",
  clientDescription: "",
  deliverables: [],
  frequency: "",
  quantityLimit: "",
  inclusionStatus: "included",
  deliveryType: "recurring",
  isOptionalAddOn: false,
  sortOrder: 0,
};

function draftFromItem(item: ProposalScopeLibraryItemRecord): ProposalScopeLibraryItemPayload {
  return {
    templateKey: item.templateKey,
    name: item.name,
    category: item.category,
    clientDescription: item.clientDescription,
    deliverables: item.deliverables,
    frequency: item.frequency,
    quantityLimit: item.quantityLimit,
    inclusionStatus: item.inclusionStatus,
    deliveryType: item.deliveryType,
    isOptionalAddOn: item.isOptionalAddOn,
    sortOrder: item.sortOrder,
  };
}

function lines(value: string[] | null | undefined) {
  return (value || []).join("\n");
}

function lineList(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export default function ProposalScopeLibraryPage() {
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const canRead = hasPermission("proposals:read");
  const canWrite = hasPermission("proposals:write");
  const [items, setItems] = useState<ProposalScopeLibraryItemRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"active" | "archived" | "all">("active");
  const [draft, setDraft] = useState<ProposalScopeLibraryItemPayload>(emptyDraft);
  const [deliverableText, setDeliverableText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId]);

  const loadItems = useCallback(async () => {
    if (!token || !canRead) {
      if (token) setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const result = await api.proposals.scopeLibrary(token, {
        search: query,
        category,
        status,
        limit: 100,
      });
      setItems(result.items);
      const first = result.items.find((item) => item.id === selectedId) || result.items[0] || null;
      setSelectedId(first?.id || "");
      if (first) {
        setDraft(draftFromItem(first));
        setDeliverableText(lines(first.deliverables));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load scope library.");
    } finally {
      setIsLoading(false);
    }
  }, [canRead, category, query, selectedId, status, token]);

  useEffect(() => {
    void Promise.resolve().then(() => loadItems());
  }, [loadItems]);

  const selectItem = (item: ProposalScopeLibraryItemRecord) => {
    setSelectedId(item.id);
    setDraft(draftFromItem(item));
    setDeliverableText(lines(item.deliverables));
    setMessage("");
    setError("");
  };

  const startNew = () => {
    setSelectedId("");
    setDraft({ ...emptyDraft, sortOrder: items.length ? Math.max(...items.map((item) => item.sortOrder || 0)) + 10 : 10 });
    setDeliverableText("");
    setMessage("");
    setError("");
  };

  const save = async () => {
    if (!token || !canWrite) return;
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = { ...draft, deliverables: lineList(deliverableText) };
      const item = selectedId
        ? await api.proposals.updateScopeLibraryItem(token, selectedId, payload)
        : await api.proposals.createScopeLibraryItem(token, payload);
      setMessage(selectedId ? "Scope library item updated." : "Scope library item created.");
      await loadItems();
      setSelectedId(item.id);
      setDraft(draftFromItem(item));
      setDeliverableText(lines(item.deliverables));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save scope library item.");
    } finally {
      setIsSaving(false);
    }
  };

  const archiveToggle = async () => {
    if (!token || !canWrite || !selectedItem) return;
    setIsSaving(true);
    setError("");
    try {
      const next = selectedItem.status === "archived"
        ? await api.proposals.restoreScopeLibraryItem(token, selectedItem.id)
        : await api.proposals.archiveScopeLibraryItem(token, selectedItem.id);
      setMessage(next.status === "archived" ? "Scope library item archived." : "Scope library item restored.");
      await loadItems();
      setSelectedId(next.id);
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Could not update scope library item status.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scope & Deliverables Library"
        subtitle="Manage reusable proposal scope language without changing package pricing or proposal-specific copies."
        right={<Link href="/app/crm/proposals" className="inline-flex min-h-10 items-center rounded-[8px] border border-[#d8e4df] bg-white px-3 text-sm font-semibold text-[#315f51]">Back to proposals</Link>}
      />

      {error ? <AlertBanner title="Scope library issue" description={error} variant="error" /> : null}
      {message ? <AlertBanner title="Scope library updated" description={message} variant="success" /> : null}

      {!canRead ? (
        <AlertBanner title="Read-only access required" description="You need proposal read permission to view the scope library." variant="error" />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <aside className="space-y-3">
            <div className={cardClassName}>
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#5b7069]">
                  Search
                  <span className="mt-1 flex items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3">
                    <Search className="h-4 w-4 text-[#78918a]" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-10 w-full bg-transparent text-sm outline-none" placeholder="Scope, deliverable or wording" />
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClassName}>
                    <option value="">All categories</option>
                    {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <select value={status} onChange={(event) => setStatus(event.target.value as "active" | "archived" | "all")} className={inputClassName}>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="all">All</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={cardClassName}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-[#14231f]">Library items</h2>
                {canWrite ? (
                  <button type="button" onClick={startNew} className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#315f51] bg-white px-3 text-sm font-semibold text-[#315f51]">
                    <Plus className="h-4 w-4" /> New
                  </button>
                ) : null}
              </div>
              <div className="mt-3 space-y-2">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-[#5b7069]"><Loader2 className="h-4 w-4 animate-spin" /> Loading scope library</div>
                ) : items.length ? items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectItem(item)}
                    className={`w-full rounded-[8px] border p-3 text-left text-sm ${selectedId === item.id ? "border-[#315f51] bg-[#eef7f6]" : "border-[#d8e4df] bg-white"}`}
                  >
                    <span className="font-semibold text-[#14231f]">{item.name}</span>
                    <span className="mt-1 block text-xs text-[#5b7069]">{item.category} · v{item.version} · {item.status}</span>
                    <span className="mt-2 block line-clamp-2 text-xs leading-5 text-[#5b7069]">{item.clientDescription}</span>
                  </button>
                )) : (
                  <p className="text-sm text-[#5b7069]">No scope items match this view.</p>
                )}
              </div>
            </div>
          </aside>

          <section className={cardClassName}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#14231f]">{selectedId ? "Edit library item" : "New library item"}</h2>
                <p className="mt-1 text-sm text-[#5b7069]">Proposal users copy these rows into a proposal and can then customize the proposal-specific wording.</p>
              </div>
              {selectedItem ? (
                <span className="rounded-full bg-[#eef7f6] px-3 py-1 text-xs font-semibold text-[#315f51]">Version {selectedItem.version}</span>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-[#14231f]">
                Name
                <input value={draft.name || ""} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className={inputClassName} />
              </label>
              <label className="text-sm font-semibold text-[#14231f]">
                Category
                <select value={draft.category || "Strategy"} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} className={inputClassName}>
                  {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="md:col-span-2 text-sm font-semibold text-[#14231f]">
                Client-facing description
                <textarea rows={4} value={draft.clientDescription || ""} onChange={(event) => setDraft((current) => ({ ...current, clientDescription: event.target.value }))} className={textareaClassName} />
              </label>
              <label className="md:col-span-2 text-sm font-semibold text-[#14231f]">
                Deliverables, one per line
                <textarea rows={5} value={deliverableText} onChange={(event) => setDeliverableText(event.target.value)} className={textareaClassName} />
              </label>
              <label className="text-sm font-semibold text-[#14231f]">
                Frequency
                <input value={draft.frequency || ""} onChange={(event) => setDraft((current) => ({ ...current, frequency: event.target.value }))} className={inputClassName} />
              </label>
              <label className="text-sm font-semibold text-[#14231f]">
                Quantity or limit
                <input value={draft.quantityLimit || ""} onChange={(event) => setDraft((current) => ({ ...current, quantityLimit: event.target.value }))} className={inputClassName} />
              </label>
              <label className="text-sm font-semibold text-[#14231f]">
                Inclusion
                <select value={draft.inclusionStatus || "included"} onChange={(event) => setDraft((current) => ({ ...current, inclusionStatus: event.target.value as "included" | "excluded" }))} className={inputClassName}>
                  <option value="included">Included</option>
                  <option value="excluded">Excluded</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-[#14231f]">
                Delivery type
                <select value={draft.deliveryType || "recurring"} onChange={(event) => setDraft((current) => ({ ...current, deliveryType: event.target.value as "recurring" | "one_off" }))} className={inputClassName}>
                  <option value="recurring">Recurring</option>
                  <option value="one_off">One-off</option>
                </select>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {canWrite ? (
                <button type="button" disabled={isSaving} onClick={() => void save()} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#315f51] px-4 text-sm font-semibold text-white disabled:opacity-60">
                  <Save className="h-4 w-4" /> Save item
                </button>
              ) : null}
              {selectedItem && canWrite ? (
                <button type="button" disabled={isSaving} onClick={() => void archiveToggle()} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-4 text-sm font-semibold text-[#315f51] disabled:opacity-60">
                  {selectedItem.status === "archived" ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  {selectedItem.status === "archived" ? "Restore" : "Archive"}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
