"use client";

import { Archive, Image as ImageIcon, Loader2, Plus, RotateCcw, Save, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertBanner, PageHeader } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { ProposalProofAssetPayload, ProposalProofAssetRecord, ProposalProofAssetType } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

const proofTypes: Array<{ value: ProposalProofAssetType; label: string }> = [
  { value: "award", label: "Award" },
  { value: "testimonial", label: "Testimonial" },
  { value: "testimonial_video", label: "Testimonial video" },
  { value: "case_study", label: "Case study" },
  { value: "client_logo", label: "Client logo" },
  { value: "performance_result", label: "Performance result" },
  { value: "product_screenshot", label: "Product screenshot" },
  { value: "team_image", label: "Team image" },
];

const inputClassName = "mt-1 min-h-10 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15";
const textareaClassName = "mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15";

const emptyDraft: ProposalProofAssetPayload = {
  type: "testimonial",
  title: "",
  copy: "",
  mediaUrl: "",
  sectorTags: [],
  sortOrder: 0,
  isActive: true,
};

function tagText(tags: string[] | null | undefined) {
  return (tags || []).join("\n");
}

function parseTags(value: string) {
  return value.split(/\r?\n|,/).map((tag) => tag.trim()).filter(Boolean);
}

function draftFromAsset(asset: ProposalProofAssetRecord): ProposalProofAssetPayload {
  return {
    type: asset.type,
    title: asset.title,
    copy: asset.copy,
    mediaUrl: asset.mediaUrl,
    sectorTags: asset.sectorTags,
    sortOrder: asset.sortOrder,
    isActive: asset.isActive,
  };
}

export default function ProposalProofLibraryPage() {
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const canRead = hasPermission("proposals:read");
  const canWrite = hasPermission("proposals:write");
  const [items, setItems] = useState<ProposalProofAssetRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState<"active" | "archived" | "all">("active");
  const [draft, setDraft] = useState<ProposalProofAssetPayload>(emptyDraft);
  const [tagDraft, setTagDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selected = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId]);

  const loadItems = useCallback(async () => {
    if (!token || !canRead) return;
    setIsLoading(true);
    setError("");
    try {
      const result = await api.proposals.proofAssetLibrary(token, {
        search: query || undefined,
        type: type || undefined,
        tag: tag || undefined,
        status,
        limit: 100,
      });
      setItems(result.items);
      if (selectedId && !result.items.some((item) => item.id === selectedId)) {
        setSelectedId("");
        setDraft(emptyDraft);
        setTagDraft("");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load proof library.");
    } finally {
      setIsLoading(false);
    }
  }, [canRead, query, selectedId, status, tag, token, type]);

  useEffect(() => {
    void Promise.resolve().then(() => loadItems());
  }, [loadItems]);

  const selectItem = (item: ProposalProofAssetRecord) => {
    setSelectedId(item.id);
    setDraft(draftFromAsset(item));
    setTagDraft(tagText(item.sectorTags));
    setMessage("");
    setError("");
  };

  const startNew = () => {
    setSelectedId("");
    setDraft(emptyDraft);
    setTagDraft("");
    setMessage("");
    setError("");
  };

  const save = async () => {
    if (!token || !canWrite || isSaving) return;
    setIsSaving(true);
    setMessage("");
    setError("");
    try {
      const payload = { ...draft, sectorTags: parseTags(tagDraft), title: draft.title.trim(), copy: draft.copy.trim() };
      const saved = selectedId
        ? await api.proposals.updateProofAsset(token, selectedId, payload)
        : await api.proposals.createProofAsset(token, payload);
      setSelectedId(saved.id);
      setDraft(draftFromAsset(saved));
      setTagDraft(tagText(saved.sectorTags));
      setMessage(selectedId ? "Proof asset updated." : "Proof asset created.");
      await loadItems();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save proof asset.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleArchive = async () => {
    if (!token || !canWrite || !selected) return;
    setIsSaving(true);
    setMessage("");
    setError("");
    try {
      const saved = selected.isActive
        ? await api.proposals.archiveProofAsset(token, selected.id)
        : await api.proposals.restoreProofAsset(token, selected.id);
      setSelectedId(saved.id);
      setDraft(draftFromAsset(saved));
      setTagDraft(tagText(saved.sectorTags));
      setMessage(saved.isActive ? "Proof asset restored." : "Proof asset archived.");
      await loadItems();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Could not update proof asset status.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!canRead) {
    return (
      <main className="min-h-screen bg-[#f5f1ea] p-6">
        <div className="mx-auto max-w-4xl">
          <AlertBanner variant="warning" title="Permission required" description="You need proposal read permission to view the proof library." />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f1ea] p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Proof, testimonial and asset library"
          subtitle="Manage searchable proof assets used by the V19 proposal builder without changing frozen proposals."
          right={<Link href="/app/crm/proposals" className="rounded-[8px] border border-[#d8e4df] bg-white px-4 py-2 text-sm font-semibold text-[#315f51]">Back to proposals</Link>}
        />

        {message ? <AlertBanner variant="success" title="Proof library updated" description={message} /> : null}
        {error ? <AlertBanner variant="error" title="Proof library issue" description={error} /> : null}

        <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-[8px] border border-[#d8e4df] bg-white p-4">
            <div className="grid gap-3">
              <label className="flex min-h-10 items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-[#fbfdfc] px-3">
                <Search className="h-4 w-4 text-[#78918a]" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, copy, media or tags" className="w-full bg-transparent text-sm outline-none" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select value={type} onChange={(event) => setType(event.target.value)} className={inputClassName}>
                  <option value="">All proof types</option>
                  {proofTypes.map((proofType) => <option key={proofType.value} value={proofType.value}>{proofType.label}</option>)}
                </select>
                <select value={status} onChange={(event) => setStatus(event.target.value as "active" | "archived" | "all")} className={inputClassName}>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                  <option value="all">All</option>
                </select>
              </div>
              <input value={tag} onChange={(event) => setTag(event.target.value)} placeholder="Filter by tag" className={inputClassName} />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#14231f]">Library items</p>
              <button type="button" onClick={startNew} disabled={!canWrite} className="inline-flex min-h-9 items-center gap-2 rounded-[8px] bg-[#315f51] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                <Plus className="h-4 w-4" />
                New
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {isLoading ? (
                <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#315f51]" /></div>
              ) : items.length ? items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectItem(item)}
                  className={`w-full rounded-[8px] border p-3 text-left text-sm ${selectedId === item.id ? "border-[#315f51] bg-[#edf5f1]" : "border-[#d8e4df] bg-[#fbfdfc] hover:border-[#8cb8a6]"}`}
                >
                  <span className="block font-semibold text-[#14231f]">{item.title}</span>
                  <span className="mt-1 block text-xs capitalize text-[#6b817a]">{item.type.replace(/_/g, " ")} | v{item.version || 1} | {item.isActive ? "active" : "archived"}</span>
                  <span className="mt-2 block line-clamp-2 text-xs leading-5 text-[#5b7069]">{item.copy}</span>
                </button>
              )) : (
                <p className="rounded-[8px] border border-dashed border-[#d8e4df] p-3 text-sm text-[#5b7069]">No proof assets match this view.</p>
              )}
            </div>
          </aside>

          <section className="rounded-[8px] border border-[#d8e4df] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b817a]">{selected ? "Edit proof asset" : "New proof asset"}</p>
                <h2 className="mt-1 text-xl font-semibold text-[#14231f]">{selected?.title || "Create approved proof"}</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b7069]">Proposal users can search, select and insert these assets into proposal proof sections.</p>
              </div>
              {selected ? (
                <button type="button" onClick={toggleArchive} disabled={!canWrite || isSaving} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 text-sm font-semibold text-[#315f51] disabled:cursor-not-allowed disabled:opacity-60">
                  {selected.isActive ? <Archive className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                  {selected.isActive ? "Archive" : "Restore"}
                </button>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <label className="block text-sm font-medium text-[#354943]">
                Type
                <select value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as ProposalProofAssetType }))} className={inputClassName}>
                  {proofTypes.map((proofType) => <option key={proofType.value} value={proofType.value}>{proofType.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-[#354943]">
                Sort order
                <input type="number" min="0" value={draft.sortOrder ?? 0} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value) || 0 }))} className={inputClassName} />
              </label>
              <label className="block text-sm font-medium text-[#354943] lg:col-span-2">
                Title
                <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className={inputClassName} />
              </label>
              <label className="block text-sm font-medium text-[#354943] lg:col-span-2">
                Client-facing proof copy
                <textarea rows={5} value={draft.copy} onChange={(event) => setDraft((current) => ({ ...current, copy: event.target.value }))} className={textareaClassName} />
              </label>
              <label className="block text-sm font-medium text-[#354943] lg:col-span-2">
                Media URL
                <input value={draft.mediaUrl || ""} onChange={(event) => setDraft((current) => ({ ...current, mediaUrl: event.target.value }))} placeholder="/brand/proposal/... or approved URL" className={inputClassName} />
              </label>
              <label className="block text-sm font-medium text-[#354943] lg:col-span-2">
                Search tags
                <textarea rows={4} value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} placeholder="One tag per line, or comma-separated" className={textareaClassName} />
              </label>
            </div>

            {draft.mediaUrl ? (
              <div className="mt-5 rounded-[8px] border border-[#d8e4df] bg-[#fbfdfc] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b817a]">Media preview</p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-16 w-24 items-center justify-center rounded-[8px] border border-[#d8e4df] bg-white bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url("${draft.mediaUrl}")` }}>
                    <ImageIcon className="h-5 w-5 text-[#8da099]" />
                  </span>
                  <p className="min-w-0 break-all text-sm text-[#5b7069]">{draft.mediaUrl}</p>
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={save} disabled={!canWrite || isSaving} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#315f51] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save proof asset
              </button>
              {!canWrite ? <p className="text-sm text-[#6b817a]">Proposal write permission is required to change proof assets.</p> : null}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
