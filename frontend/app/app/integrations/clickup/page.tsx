"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ClipboardList,
  FolderTree,
  Loader2,
  RefreshCw,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type {
  ClickUpCategoryKey,
  ClickUpCategoryMappingRecord,
  ClickUpFolderRecord,
  ClickUpListRecord,
  ClickUpMemberRecord,
  ClickUpPriorityMappingRecord,
  ClickUpSpaceRecord,
  ClientAccountSummaryRecord,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { AlertBanner, SkeletonLine } from "@/components/ui";

const categories: Array<{ key: ClickUpCategoryKey; label: string; expectedList: string }> = [
  { key: "development", label: "Development", expectedList: "Development Tasks" },
  { key: "seo", label: "SEO", expectedList: "SEO Tasks" },
  { key: "gmb_local_seo", label: "GMB / Local SEO", expectedList: "GMB / Local SEO" },
  { key: "ppc", label: "PPC", expectedList: "PPC Tasks" },
  { key: "managerial", label: "Managerial", expectedList: "Managerial Tasks" },
  { key: "reporting", label: "Reporting", expectedList: "Reporting" },
  { key: "account_control", label: "Account Control", expectedList: "00 - Account Control & Client Management" },
];

const priorityLabels: Array<{ key: "low" | "medium" | "high" | "urgent"; label: string }> = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
  { key: "urgent", label: "Urgent" },
];

type DraftMapping = Record<ClickUpCategoryKey, {
  folderId: string;
  listId: string;
  assigneeIds: string[];
}>;

const categoryDefaultAssigneeHandles: Record<ClickUpCategoryKey, string[]> = {
  development: ["wordpresshealth"],
  seo: ["apps"],
  gmb_local_seo: ["apps"],
  ppc: ["ppc"],
  managerial: ["max", "michael"],
  reporting: [],
  account_control: [],
};

function normalizeHandle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isDefaultHandleMatch(candidate: string, expected: string) {
  const left = normalizeHandle(candidate);
  const right = normalizeHandle(expected);
  if (!left || !right) return false;
  return left === right || left.startsWith(right);
}

function findCategoryDefaultAssigneeIds(
  categoryKey: ClickUpCategoryKey,
  members: ClickUpMemberRecord[],
) {
  const handles = categoryDefaultAssigneeHandles[categoryKey] || [];
  return members
    .filter((member) => {
      const username = member.username || "";
      const emailLocal = String(member.email || "").split("@")[0] || "";
      return handles.some((handle) =>
        isDefaultHandleMatch(username, handle) || isDefaultHandleMatch(emailLocal, handle),
      );
    })
    .map((member) => member.id);
}

function emptyDraft(): DraftMapping {
  return categories.reduce((acc, category) => {
    acc[category.key] = { folderId: "", listId: "", assigneeIds: [] };
    return acc;
  }, {} as DraftMapping);
}

function clickUpMemberLabel(member: ClickUpMemberRecord) {
  return member.email ? `${member.username} (${member.email})` : member.username;
}

export default function ClickUpSettingsPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [clients, setClients] = useState<ClientAccountSummaryRecord[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [spaces, setSpaces] = useState<ClickUpSpaceRecord[]>([]);
  const [spaceId, setSpaceId] = useState("");
  const [folders, setFolders] = useState<ClickUpFolderRecord[]>([]);
  const [listsByFolder, setListsByFolder] = useState<Record<string, ClickUpListRecord[]>>({});
  const [members, setMembers] = useState<ClickUpMemberRecord[]>([]);
  const [mappings, setMappings] = useState<ClickUpCategoryMappingRecord[]>([]);
  const [priorityMappings, setPriorityMappings] = useState<ClickUpPriorityMappingRecord[]>([]);
  const [draft, setDraft] = useState<DraftMapping>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [folderLoadMessage, setFolderLoadMessage] = useState("");

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) || null,
    [clients, selectedClientId],
  );
  const selectedSpace = useMemo(
    () => spaces.find((space) => space.id === spaceId) || null,
    [spaceId, spaces],
  );
  const savedCategoryCount = useMemo(
    () => categories.filter((category) => mappings.some((item) => item.categoryKey === category.key && item.mappingStatus === "active")).length,
    [mappings],
  );
  const loadedListCount = useMemo(
    () => Object.values(listsByFolder).reduce((total, lists) => total + lists.length, 0),
    [listsByFolder],
  );
  const priorityMapByKey = useMemo(
    () => new Map(priorityMappings.map((item) => [item.missionControlPriority, item.clickupPriority] as const)),
    [priorityMappings],
  );

  const defaultMemberIdsByCategory = useMemo(() => {
    const map = new Map<ClickUpCategoryKey, string[]>();
    categories.forEach((category) => {
      const matched = findCategoryDefaultAssigneeIds(category.key, members);
      map.set(category.key, Array.from(new Set(matched)));
    });
    return map;
  }, [members]);

  const clearLoadedStructure = useCallback((messageText = "") => {
    setFolders([]);
    setListsByFolder({});
    setFolderLoadMessage(messageText);
  }, []);

  const handleSpaceSelection = useCallback((nextSpaceId: string) => {
    setSpaceId(nextSpaceId);
    clearLoadedStructure(
      nextSpaceId
        ? "Click Load folders and lists to pull the selected ClickUp Space structure."
        : "Choose a ClickUp Space before loading folders and lists.",
    );
    setDraft((current) => {
      const next = { ...current };
      categories.forEach((category) => {
        next[category.key] = {
          ...next[category.key],
          folderId: "",
          listId: "",
        };
      });
      return next;
    });
  }, [clearLoadedStructure]);

  const loadBase = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [status, clientRows, priorityRows] = await Promise.all([
        api.clickup.getStatus(token),
        api.clientAccounts.list(token),
        api.clickup.listPriorityMappings(token),
      ]);
      const connection = status.connections.find((item) => item.status === "connected");
      if (!connection?.workspaceId) {
        setError("ClickUp is not connected yet. Connect the approved workspace from Integrations first.");
      } else {
        setWorkspaceId(connection.workspaceId);
        setWorkspaceName(connection.workspaceName || "Connected workspace");
        const [spaceRows, memberRows] = await Promise.all([
          api.clickup.listSpaces(token, connection.workspaceId),
          api.clickup.listMembers(token, connection.workspaceId),
        ]);
        setSpaces(spaceRows);
        setMembers(memberRows);
      }
      // Keep selector clean by collapsing repeated account rows.
      const byClinicId = Array.from(
        new Map(clientRows.map((client: ClientAccountSummaryRecord) => [client.clinicId, client])).values(),
      );
      const seenNames = new Set<string>();
      const uniqueClients = byClinicId.filter((client) => {
        const key = String(client.clinicName || "").trim().toLowerCase();
        if (!key) return true;
        if (seenNames.has(key)) return false;
        seenNames.add(key);
        return true;
      });
      setClients(uniqueClients);
      setPriorityMappings(priorityRows);
      setSelectedClientId((current) => current || uniqueClients[0]?.id || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ClickUp settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadBase(), 0);
    return () => window.clearTimeout(id);
  }, [loadBase]);

  useEffect(() => {
    if (!token || !selectedClientId) return;
    const id = window.setTimeout(async () => {
      try {
        const rows = await api.clickup.listCategoryMappings(token, selectedClientId);
        setMappings(rows);
        const next = emptyDraft();
        rows.forEach((row) => {
          next[row.categoryKey] = {
            folderId: row.folderId || "",
            listId: row.listId,
            assigneeIds: row.defaultAssigneeIds,
          };
        });

        categories.forEach((category) => {
          if (next[category.key].assigneeIds.length === 0) {
            next[category.key].assigneeIds = defaultMemberIdsByCategory.get(category.key) || [];
          }
        });

        setDraft(next);
        const firstSpace = rows.find((row) => row.spaceId)?.spaceId;
        if (firstSpace) {
          setSpaceId(firstSpace);
          clearLoadedStructure("Click Load folders and lists to refresh the saved ClickUp Space structure.");
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Saved ClickUp mappings could not be loaded.");
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [clearLoadedStructure, defaultMemberIdsByCategory, selectedClientId, token]);

  async function loadFoldersForSpace(nextSpaceId = spaceId) {
    if (!token || !workspaceId || !nextSpaceId) {
      setFolderLoadMessage("Choose a ClickUp Space before loading folders and lists.");
      return;
    }
    setBusy(true);
    setError("");
    setFolderLoadMessage("Loading ClickUp folders and lists...");
    try {
      const folderRows = await api.clickup.listFolders(token, { workspaceId, spaceId: nextSpaceId });
      setFolders(folderRows);
      const listEntries = await Promise.all(
        folderRows.map(async (folder) => [folder.id, await api.clickup.listLists(token, { workspaceId, spaceId: nextSpaceId, folderId: folder.id })] as const),
      );
      const folderLists = Object.fromEntries(listEntries);
      const spaceLists = await api.clickup.listLists(token, { workspaceId, spaceId: nextSpaceId });
      setListsByFolder({ ...folderLists, "": spaceLists });
      const folderListCount = listEntries.reduce((total, [, lists]) => total + lists.length, 0);
      const totalListCount = folderListCount + spaceLists.length;
      setFolderLoadMessage(
        totalListCount > 0
          ? `Loaded ${folderRows.length} folder(s) and ${totalListCount} list(s) from ClickUp.`
          : `Loaded ${folderRows.length} folder(s), but no lists were found for this space.`,
      );
    } catch (reason) {
      setFolderLoadMessage("");
      setError(reason instanceof Error ? reason.message : "ClickUp folders and lists could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCategory(categoryKey: ClickUpCategoryKey) {
    if (!token || !selectedClient || !workspaceId || !spaceId) return;
    const row = draft[categoryKey];
    if (!row.listId) {
      setError("Choose a ClickUp list before saving this category.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await api.clickup.saveCategoryMapping(token, selectedClientId, {
        workspaceId,
        spaceId,
        categoryKey,
        folderId: row.folderId || null,
        listId: row.listId,
        defaultAssigneeIds: row.assigneeIds,
        mappingStatus: "active",
        mappingSource: "api_lookup",
      });
      setMappings((current) => [...current.filter((item) => item.categoryKey !== categoryKey), saved]);
      setMessage(`${categories.find((item) => item.key === categoryKey)?.label || "Category"} mapping saved.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ClickUp category mapping could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function savePriority(missionControlPriority: "low" | "medium" | "high" | "urgent", clickupPriority: 1 | 2 | 3 | 4) {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const saved = await api.clickup.savePriorityMapping(token, { missionControlPriority, clickupPriority });
      setPriorityMappings((current) => [...current.filter((item) => item.missionControlPriority !== missionControlPriority), saved]);
      setMessage("Priority mapping saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ClickUp priority mapping could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  function updateDraft(categoryKey: ClickUpCategoryKey, updates: Partial<DraftMapping[ClickUpCategoryKey]>) {
    setDraft((current) => ({
      ...current,
      [categoryKey]: { ...current[categoryKey], ...updates },
    }));
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-[1440px] space-y-4 pb-12">
        <SkeletonLine className="h-10 w-1/3" />
        <SkeletonLine className="h-48 w-full" />
        <SkeletonLine className="h-72 w-full" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1320px] space-y-4 pb-12">
      <div className="flex items-center justify-between">
        <Link href="/app/integrations" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-[#625FC7] hover:bg-[#EDEBFF]">
          <ArrowLeft className="h-4 w-4" /> Back to integrations
        </Link>
        <Link href="/app/integrations/clickup/reconciliation" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#FFF8EC] px-3.5 text-sm font-semibold text-[#8A6428] hover:bg-[#FCECD4]">
          View sync errors
        </Link>
      </div>

      <header className="overflow-hidden rounded-3xl border border-black/[0.06] bg-[#FFFCF9] shadow-[0_14px_44px_rgba(49,45,90,0.07)]">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-center">
          <div className="flex min-w-0 gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EDEBFF] text-[#5A56D4]">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#625FC7]">ClickUp delivery mapping</p>
              <h1 className="mt-1.5 text-2xl font-semibold text-[#171615] sm:text-3xl">Map Mission Control work to ClickUp</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6C6761]">
                Configure the exact client space, delivery lists, assignees and priority translation used when a Mission Control task is created in ClickUp.
              </p>
            </div>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-black/[0.06] bg-white px-3.5 py-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-[#625FC7]"><Building2 className="h-4 w-4" /> Client</p>
              <p className="mt-1.5 truncate text-sm font-semibold text-[#302D2A]">{selectedClient?.clinicName || "Not selected"}</p>
            </div>
            <div className="rounded-2xl border border-black/[0.06] bg-white px-3.5 py-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-[#4F8B78]"><FolderTree className="h-4 w-4" /> Structure</p>
              <p className="mt-1.5 text-sm font-semibold text-[#302D2A]">{folders.length} folders / {loadedListCount} lists</p>
            </div>
            <div className="rounded-2xl border border-black/[0.06] bg-white px-3.5 py-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-[#31735F]"><CheckCircle2 className="h-4 w-4" /> Saved</p>
              <p className="mt-1.5 text-sm font-semibold text-[#302D2A]">{savedCategoryCount}/{categories.length} categories</p>
            </div>
          </div>
        </div>
      </header>

      {error && <AlertBanner variant="error" title="ClickUp settings issue" description={error} />}
      {message && <AlertBanner variant="success" title={message} />}

      <section className="rounded-3xl border border-black/[0.06] bg-[#FFFCF9] p-4 shadow-[0_10px_34px_rgba(49,45,90,0.05)] sm:p-5">
        <div className="grid gap-3.5 xl:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto] xl:items-end">
          <label className="space-y-2 text-sm font-semibold text-[#302D2A]">
            Client account
            <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} className="min-h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3 outline-none focus:border-[#6E6AE8] focus:ring-4 focus:ring-[#6E6AE8]/10">
              {clients.map((client) => <option key={client.id} value={client.id || ""}>{client.clinicName}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold text-[#302D2A]">
            ClickUp Space
            <select value={spaceId} onChange={(event) => handleSpaceSelection(event.target.value)} className="min-h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3 outline-none focus:border-[#6E6AE8] focus:ring-4 focus:ring-[#6E6AE8]/10">
              <option value="">Choose the client space</option>
              {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void loadFoldersForSpace()} disabled={busy || !spaceId} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#171615] px-5 text-sm font-semibold text-white hover:bg-[#302E2B] disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Load folders and lists
          </button>
        </div>
        <div className="mt-3.5 grid gap-2.5 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#F7F4F0] px-3.5 py-2.5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#817B75]">Workspace</p>
            <p className="mt-1 truncate font-semibold text-[#302D2A]">{workspaceName || "Not connected"}</p>
          </div>
          <div className="rounded-2xl bg-[#E7F5F0] px-3.5 py-2.5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4F8B78]">Selected Space</p>
            <p className="mt-1 truncate font-semibold text-[#302D2A]">{selectedSpace?.name || "Choose a space"}</p>
          </div>
          <div className="rounded-2xl bg-[#F5F4FF] px-3.5 py-2.5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#625FC7]">Members</p>
            <p className="mt-1 font-semibold text-[#302D2A]">{members.length} loaded</p>
          </div>
        </div>
      </section>
      {folderLoadMessage && (
        <p className="rounded-2xl border border-[#d8ddda] bg-[#FFFCF9] px-4 py-3 text-sm font-medium text-[#5e8a8d] shadow-[0_8px_24px_rgba(49,45,90,0.04)]">
          {folderLoadMessage}
        </p>
      )}

      <section className="rounded-3xl border border-black/[0.06] bg-[#FFFCF9] p-4 shadow-[0_10px_34px_rgba(49,45,90,0.05)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#1E1C1A]">Delivery category mappings</h2>
            <p className="mt-2 text-sm leading-6 text-[#817B75]">
              Assignees prefill by category: Development to wordpresshealth, SEO/GMB to apps, PPC to ppc, Managerial to Max + Michael.
            </p>
          </div>
          <div className="rounded-2xl border border-[#D8D4F4] bg-[#F5F4FF] px-4 py-3 text-sm font-semibold text-[#5A56D4]">
            {savedCategoryCount} of {categories.length} saved
          </div>
        </div>
        <div className="mt-4 space-y-2.5">
          {categories.map((category) => {
            const row = draft[category.key];
            const lists = listsByFolder[row.folderId] || [];
            const saved = mappings.some((item) => item.categoryKey === category.key && item.mappingStatus === "active");
            const selectedAssignees = members.filter((member) => row.assigneeIds.includes(member.id));
            const isReady = Boolean(row.listId && row.assigneeIds.length > 0);
            return (
              <div key={category.key} className={`rounded-2xl border bg-white p-3.5 transition sm:p-4 ${saved ? "border-[#B9E2D6]" : isReady ? "border-[#D8D4F4]" : "border-black/[0.06]"}`}>
                <div className="mb-3.5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${saved ? "bg-[#E7F5F0] text-[#31735F]" : "bg-[#F3F0EB] text-[#706A63]"}`}>
                      {saved ? <CheckCircle2 className="h-5 w-5" /> : <FolderTree className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#24211F]">{category.label}</p>
                      <p className="mt-1 text-xs text-[#817B75]">Expected list: {category.expectedList}</p>
                    </div>
                  </div>
                  <span className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${saved ? "bg-[#E7F5F0] text-[#31735F]" : isReady ? "bg-[#F5F4FF] text-[#5A56D4]" : "bg-[#FFF8EC] text-[#8A6428]"}`}>
                    {saved ? "Saved" : isReady ? "Ready to save" : "Needs mapping"}
                  </span>
                </div>

                <div className="grid gap-3.5 xl:grid-cols-[minmax(170px,0.9fr)_minmax(190px,1fr)_minmax(280px,1.35fr)_96px] xl:items-start">
                  <label className="space-y-1.5 text-xs font-semibold text-[#625F5A]">
                    Folder
                    <select value={row.folderId} onChange={(event) => updateDraft(category.key, { folderId: event.target.value, listId: "" })} className="min-h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3 text-sm outline-none focus:border-[#6E6AE8] focus:ring-4 focus:ring-[#6E6AE8]/10">
                      <option value="">No folder / space list</option>
                      {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1.5 text-xs font-semibold text-[#625F5A]">
                    List
                    <select value={row.listId} onChange={(event) => updateDraft(category.key, { listId: event.target.value })} className="min-h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3 text-sm outline-none focus:border-[#6E6AE8] focus:ring-4 focus:ring-[#6E6AE8]/10">
                      <option value="">Choose list</option>
                      {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
                    </select>
                    {row.folderId && lists.length === 0 && <span className="block text-[11px] font-normal text-[#8A6428]">No lists found in this folder.</span>}
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[#625F5A]">Default assignees</p>
                      <span className="text-[11px] text-[#817B75]">{row.assigneeIds.length} selected</span>
                    </div>
                    {selectedAssignees.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedAssignees.slice(0, 4).map((member) => (
                          <span key={member.id} className="rounded-full bg-[#E7F5F0] px-2.5 py-1 text-[11px] font-semibold text-[#31735F]">
                            {member.username}
                          </span>
                        ))}
                        {selectedAssignees.length > 4 && <span className="rounded-full bg-[#F3F0EB] px-2.5 py-1 text-[11px] font-semibold text-[#706A63]">+{selectedAssignees.length - 4}</span>}
                      </div>
                    )}
                    <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-xl border border-black/[0.1] bg-[#FFFCF9] p-2">
                      {members.length === 0 && <p className="px-2 py-1 text-xs text-[#8A6428]">No ClickUp members loaded.</p>}
                      {members.map((member) => {
                        const checked = row.assigneeIds.includes(member.id);
                        return (
                          <label key={member.id} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition ${checked ? "bg-[#F5F4FF] text-[#302D2A]" : "text-[#625F5A] hover:bg-[#F7F4F0]"}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                const nextIds = event.target.checked
                                  ? [...new Set([...row.assigneeIds, member.id])]
                                  : row.assigneeIds.filter((id) => id !== member.id);
                                updateDraft(category.key, { assigneeIds: nextIds });
                              }}
                              className="h-4 w-4 rounded border-[#AAA5D8] text-[#6E6AE8]"
                            />
                            <span className="min-w-0 flex-1 truncate">{clickUpMemberLabel(member)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <button type="button" onClick={() => void saveCategory(category.key)} disabled={busy || !spaceId || !row.listId} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#6E6AE8] px-4 text-sm font-semibold text-white hover:bg-[#5A56D4] disabled:opacity-50">
                    <Save className="h-4 w-4" /> Save
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-black/[0.06] bg-[#FFFCF9] p-4 shadow-[0_10px_34px_rgba(49,45,90,0.05)] sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F5F4FF] text-[#625FC7]">
            <SlidersHorizontal className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-[#1E1C1A]">Priority translation</h2>
            <p className="mt-2 text-sm leading-6 text-[#817B75]">
              This converts Mission Control priorities into ClickUp priorities, so urgency stays consistent when a task is created.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {priorityLabels.map((priority) => {
            const current = priorityMapByKey.get(priority.key) || 3;
            return (
              <label key={priority.key} className="space-y-2 rounded-2xl border border-black/[0.06] bg-white p-4 text-sm font-semibold text-[#302D2A]">
                <span>Mission Control {priority.label}</span>
                <span className="block text-[11px] font-medium text-[#817B75]">ClickUp priority</span>
                <select value={current} onChange={(event) => void savePriority(priority.key, Number(event.target.value) as 1 | 2 | 3 | 4)} className="min-h-10 w-full rounded-xl border border-black/[0.1] bg-white px-3 outline-none focus:border-[#6E6AE8] focus:ring-4 focus:ring-[#6E6AE8]/10">
                  <option value={1}>Urgent</option>
                  <option value={2}>High</option>
                  <option value={3}>Normal</option>
                  <option value={4}>Low</option>
                </select>
              </label>
            );
          })}
        </div>
      </section>
    </main>
  );
}
