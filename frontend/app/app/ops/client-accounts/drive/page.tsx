"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Loader2,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AlertBanner, Badge, Card, SkeletonLine } from "@/components/ui";
import { api } from "@/lib/api-client";
import type {
  ClientAccountSummaryRecord,
  GoogleDriveConnectionRecord,
  GoogleDriveFolderBrowserRecord,
  GoogleDriveFolderRecord,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

type FolderPathItem = Pick<GoogleDriveFolderRecord, "id" | "name">;

function formatModified(value: string | null) {
  if (!value) return "Modified date unavailable";
  return `Modified ${new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))}`;
}

function formatFileSize(value: number | null) {
  if (value === null) return null;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, value / 1024).toFixed(1)} KB`;
}

export default function ClientDriveWorkspacePage() {
  const searchParams = useSearchParams();
  const clinicId = searchParams.get("id") || "";
  const missingAccountId = !clinicId;
  const { session, user, hasPermission } = useAuth();
  const token = session?.token;
  const canManageFiles = hasPermission("client_accounts:write");
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const [account, setAccount] = useState<ClientAccountSummaryRecord | null>(null);
  const [connection, setConnection] = useState<GoogleDriveConnectionRecord | null>(null);
  const [browser, setBrowser] = useState<GoogleDriveFolderBrowserRecord | null>(null);
  const [folderPath, setFolderPath] = useState<FolderPathItem[]>([
    { id: "root", name: "My Drive" },
  ]);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedUpload, setSelectedUpload] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(!missingAccountId);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [busyFolderId, setBusyFolderId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(missingAccountId ? "No client account was selected." : "");
  const [folderError, setFolderError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const loadFolder = useCallback(
    async (folderId: string, nextPath: FolderPathItem[]) => {
      if (!token || !clinicId) return;
      setIsLoadingFolders(true);
      setFolderError("");
      try {
        const result = await api.clientAccounts.listDriveFolders(token, clinicId, folderId);
        setBrowser(result);
        setFolderPath(nextPath);
      } catch (error) {
        setFolderError(error instanceof Error ? error.message : "Google Drive folders could not be loaded.");
      } finally {
        setIsLoadingFolders(false);
      }
    },
    [clinicId, token],
  );

  useEffect(() => {
    if (!token || !clinicId) return;

    let cancelled = false;
    Promise.all([
      api.clientAccounts.list(token),
      api.clientAccounts.getDriveOAuthStatus(token),
    ])
      .then(async ([accounts, driveConnection]) => {
        if (cancelled) return;
        const selected = accounts.find((item) => item.clinicId === clinicId) || null;
        if (!selected) throw new Error("Client account not found or unavailable to this user.");
        setAccount(selected);
        setConnection(driveConnection);
        const initialFolderId = isAdmin ? "root" : selected.googleDriveFolderId;
        if (driveConnection.connected && initialFolderId) {
          const folders = await api.clientAccounts.listDriveFolders(token, clinicId, initialFolderId);
          if (!cancelled) {
            setBrowser(folders);
            setFolderPath([{
              id: initialFolderId,
              name: isAdmin ? "My Drive" : selected.googleDriveFolderName || "Client Drive",
            }]);
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "The Drive workspace could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clinicId, isAdmin, token]);

  const selectFolder = async (folder: GoogleDriveFolderRecord) => {
    if (!token || !account || busyFolderId) return;
    setBusyFolderId(folder.id);
    setStatusMessage("");
    try {
      const updated = await api.clientAccounts.updateDriveFolder(token, account.clinicId, {
        folderId: folder.id,
        displayName: folder.name,
      });
      setAccount((current) => (current ? { ...current, ...updated } : current));
      setStatusMessage(`${folder.name} is now the client delivery folder.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "This folder could not be selected.");
    } finally {
      setBusyFolderId(null);
    }
  };

  const createAndSelectFolder = async () => {
    const name = newFolderName.trim();
    if (!token || !account || !browser || !name || busyFolderId) return;
    setBusyFolderId("new");
    setStatusMessage("");
    try {
      const folder = await api.clientAccounts.createDriveFolder(token, account.clinicId, {
        name,
        parentId: browser.currentFolder.id,
      });
      const updated = await api.clientAccounts.updateDriveFolder(token, account.clinicId, {
        folderId: folder.id,
        displayName: folder.name,
      });
      setAccount((current) => (current ? { ...current, ...updated } : current));
      setNewFolderName("");
      await loadFolder(browser.currentFolder.id, folderPath);
      setStatusMessage(`${folder.name} was created and selected for this client.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "The folder could not be created.");
    } finally {
      setBusyFolderId(null);
    }
  };

  const clearSelection = async () => {
    if (!token || !account || busyFolderId) return;
    setBusyFolderId("clear");
    setStatusMessage("");
    try {
      const updated = await api.clientAccounts.updateDriveFolder(token, account.clinicId, {
        folderId: null,
        folderUrl: null,
      });
      setAccount((current) => (current ? { ...current, ...updated } : current));
      setStatusMessage("The client Drive folder selection was cleared.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "The folder selection could not be cleared.");
    } finally {
      setBusyFolderId(null);
    }
  };

  const uploadFile = async () => {
    if (!token || !account || !browser || !selectedUpload || busyFolderId) return;
    setBusyFolderId("upload");
    setStatusMessage("");
    try {
      await api.clientAccounts.uploadDriveFile(
        token,
        account.clinicId,
        browser.currentFolder.id,
        selectedUpload,
      );
      setSelectedUpload(null);
      await loadFolder(browser.currentFolder.id, folderPath);
      setStatusMessage(`${selectedUpload.name} was uploaded.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "The file could not be uploaded.");
    } finally {
      setBusyFolderId(null);
    }
  };

  const renameFile = async (fileId: string, currentName: string) => {
    if (!token || !account || !browser || busyFolderId) return;
    const name = window.prompt("Rename file", currentName)?.trim();
    if (!name || name === currentName) return;
    setBusyFolderId(fileId);
    try {
      await api.clientAccounts.renameDriveFile(token, account.clinicId, fileId, name);
      await loadFolder(browser.currentFolder.id, folderPath);
      setStatusMessage(`${currentName} was renamed to ${name}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "The file could not be renamed.");
    } finally {
      setBusyFolderId(null);
    }
  };

  const deleteFile = async (fileId: string, name: string) => {
    if (!token || !account || !browser || busyFolderId) return;
    if (!window.confirm(`Move ${name} to Google Drive trash?`)) return;
    setBusyFolderId(fileId);
    try {
      await api.clientAccounts.deleteDriveFile(token, account.clinicId, fileId);
      await loadFolder(browser.currentFolder.id, folderPath);
      setStatusMessage(`${name} was moved to Google Drive trash.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "The file could not be deleted.");
    } finally {
      setBusyFolderId(null);
    }
  };

  const downloadFile = async (fileId: string) => {
    if (!token || !account || busyFolderId) return;
    setBusyFolderId(fileId);
    try {
      const download = await api.clientAccounts.downloadDriveFile(token, account.clinicId, fileId);
      const url = URL.createObjectURL(download.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = download.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "The file could not be downloaded.");
    } finally {
      setBusyFolderId(null);
    }
  };

  if (isLoading) {
    return <div className="space-y-6"><SkeletonLine className="h-10 w-72" /><SkeletonLine className="h-72 w-full" /></div>;
  }

  if (loadError || !account) {
    return (
      <div className="space-y-6">
        <Link href="/app/ops/client-accounts" className="btn-secondary inline-flex text-sm"><ArrowLeft className="h-4 w-4" />Client accounts</Link>
        <AlertBanner title="Drive workspace could not be loaded" description={loadError || "The account is unavailable."} variant="warning" />
      </div>
    );
  }

  const detailHref = `/app/ops/client-accounts/detail?id=${encodeURIComponent(account.clinicId)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Link href={detailHref} aria-label="Back to client details" className="btn-secondary p-2"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e4efed] text-[#315f62]"><HardDrive className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5e8a8d]">Client Drive workspace</p>
            <h1 className="mt-1 text-2xl font-bold text-[#151f21]">{account.clinicName}</h1>
            <p className="mt-1 text-sm text-[#7A746A]">{canManageFiles ? "Browse and manage the client’s delivery files in the connected Workspace Drive." : "Browse, view, and download the client’s delivery files."}</p>
          </div>
        </div>
        <Link href={detailHref} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d8ddda] bg-white px-4 py-2 text-sm font-semibold text-[#315f62] hover:bg-[#edf5f3]">Back to client</Link>
      </div>

      {!connection?.connected ? (
        <AlertBanner
          title="Google Drive is not connected"
          description="Connect the master Workspace Drive before browsing or creating client folders."
          variant="warning"
          action={isAdmin ? <Link href="/app/integrations" className="inline-flex min-h-10 items-center rounded-lg bg-[#315f62] px-4 py-2 text-sm font-semibold text-white">Open integrations</Link> : undefined}
        />
      ) : null}

      {statusMessage ? (
        <div aria-live="polite" className="flex items-start gap-3 rounded-2xl border border-[#cfe0dc] bg-[#edf5f3] px-4 py-3 text-sm text-[#315f62]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{statusMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card padding="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-[#151f21]"><FolderOpen className="h-5 w-5 text-[#315f62]" />Browse Drive folders</h2>
              <p className="mt-1 text-sm text-[#7A746A]">Open folders to move through Drive, then select the right client workspace.</p>
            </div>
            {browser?.currentFolder.webViewLink ? (
              <a href={browser.currentFolder.webViewLink} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm font-semibold text-[#315f62] hover:bg-[#edf5f3]">View in Drive<ExternalLink className="h-4 w-4" /></a>
            ) : null}
          </div>

          {connection?.connected ? (
            <>
              <nav aria-label="Drive folder path" className="mt-5 flex flex-wrap items-center gap-1 rounded-xl bg-[#FAF8F5] px-3 py-2">
                {folderPath.map((item, index) => (
                  <span key={`${item.id}-${index}`} className="flex items-center gap-1">
                    {index > 0 ? <ChevronRight className="h-4 w-4 text-[#a0a7a5]" /> : null}
                    <button
                      type="button"
                      onClick={() => void loadFolder(item.id, folderPath.slice(0, index + 1))}
                      disabled={isLoadingFolders || index === folderPath.length - 1}
                      className="rounded-lg px-2 py-1 text-sm font-semibold text-[#315f62] hover:bg-white disabled:text-[#151f21]"
                    >
                      {item.name}
                    </button>
                  </span>
                ))}
              </nav>

              {isAdmin ? <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <label htmlFor="new-drive-folder" className="mb-1.5 block text-sm font-medium text-[#151f21]">New folder in {browser?.currentFolder.name || "this location"}</label>
                  <input
                    id="new-drive-folder"
                    name="newDriveFolder"
                    value={newFolderName}
                    onChange={(event) => setNewFolderName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void createAndSelectFolder();
                      }
                    }}
                    placeholder={`${account.clinicName} - Delivery`}
                    maxLength={150}
                    className="w-full rounded-xl border border-[#d8ddda] bg-white px-3.5 py-2.5 text-sm text-[#151f21] outline-none transition focus:border-[#75aaa7] focus:ring-4 focus:ring-[rgba(96,180,175,0.1)]"
                  />
                </div>
                <button type="button" onClick={() => void createAndSelectFolder()} disabled={!newFolderName.trim() || Boolean(busyFolderId) || !browser} className="inline-flex min-h-11 self-end items-center justify-center gap-2 rounded-xl bg-[#315f62] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#264f51] disabled:opacity-60">
                  {busyFolderId === "new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}Create &amp; select
                </button>
              </div> : null}

              {folderError ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{folderError}</p> : null}

              <div className="mt-5 space-y-2">
                {isLoadingFolders ? (
                  <div className="flex min-h-32 items-center justify-center text-[#5e8a8d]"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : (
                  browser?.folders.map((folder) => (
                    <article key={folder.id} className={`flex flex-col gap-3 rounded-2xl border p-4 transition sm:flex-row sm:items-center sm:justify-between ${account.googleDriveFolderId === folder.id ? "border-[#75aaa7] bg-[#edf5f3]" : "border-[#E7E1DA] bg-[#FAF8F5] hover:border-[#b9cfcb]"}`}>
                      <button type="button" onClick={() => void loadFolder(folder.id, [...folderPath, { id: folder.id, name: folder.name }])} disabled={isLoadingFolders} className="flex min-w-0 items-center gap-3 text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(49,95,98,0.15)]">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#5e8a8d]"><Folder className="h-5 w-5" /></span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-[#151f21]">{folder.name}</span>
                          <span className="mt-0.5 block text-xs text-[#7A746A]">{formatModified(folder.modifiedTime)} · Open folder</span>
                        </span>
                      </button>
                      {isAdmin ? <button type="button" onClick={() => void selectFolder(folder)} disabled={Boolean(busyFolderId) || account.googleDriveFolderId === folder.id} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#cbded9] bg-white px-3 py-2 text-sm font-semibold text-[#315f62] hover:bg-[#edf5f3] disabled:opacity-60">
                        {busyFolderId === folder.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        {account.googleDriveFolderId === folder.id ? "Selected" : "Select"}
                      </button> : null}
                    </article>
                  ))
                )}
                {!isLoadingFolders && browser?.folders.length === 0 && (browser?.files?.length || 0) === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#cbded9] bg-[#FAF8F5] p-8 text-center">
                    <FolderOpen className="mx-auto h-7 w-7 text-[#75aaa7]" />
                    <p className="mt-3 font-semibold text-[#151f21]">This folder is empty</p>
                    <p className="mt-1 text-sm text-[#7A746A]">{isAdmin ? "Create a folder or upload a file to start the workspace." : "There are no files available here yet."}</p>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 border-t border-[#E7E1DA] pt-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-[#151f21]">Files</h3>
                    <p className="mt-1 text-xs text-[#7A746A]">All permitted roles can view and download. Write access also allows upload, rename, and delete.</p>
                  </div>
                  {canManageFiles ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="file"
                        aria-label="Choose a file to upload"
                        onChange={(event) => setSelectedUpload(event.target.files?.[0] || null)}
                        className="max-w-60 text-xs text-[#5e8a8d] file:mr-2 file:rounded-lg file:border-0 file:bg-[#edf5f3] file:px-3 file:py-2 file:font-semibold file:text-[#315f62]"
                      />
                      <button type="button" onClick={() => void uploadFile()} disabled={!selectedUpload || Boolean(busyFolderId)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#315f62] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                        {busyFolderId === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Upload
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 space-y-2">
                  {(browser?.files || []).map((file) => (
                    <article key={file.id} className="flex flex-col gap-3 rounded-2xl border border-[#E7E1DA] bg-[#FAF8F5] p-4 sm:flex-row sm:items-center sm:justify-between">
                      <a href={file.webViewLink} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#5e8a8d]"><FileText className="h-5 w-5" /></span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-[#151f21]">{file.name}</span>
                          <span className="mt-0.5 block text-xs text-[#7A746A]">{formatModified(file.modifiedTime)}{formatFileSize(file.size) ? ` · ${formatFileSize(file.size)}` : ""}</span>
                        </span>
                      </a>
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => void downloadFile(file.id)} disabled={Boolean(busyFolderId)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#cbded9] bg-white px-3 py-2 text-sm font-semibold text-[#315f62] disabled:opacity-50"><Download className="h-4 w-4" />Download</button>
                        {canManageFiles ? <>
                          <button type="button" onClick={() => void renameFile(file.id, file.name)} disabled={Boolean(busyFolderId)} aria-label={`Rename ${file.name}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#d8ddda] bg-white px-3 py-2 text-sm font-semibold text-[#5e8a8d] disabled:opacity-50"><Pencil className="h-4 w-4" />Rename</button>
                          <button type="button" onClick={() => void deleteFile(file.id, file.name)} disabled={Boolean(busyFolderId)} aria-label={`Delete ${file.name}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#e4d5ce] bg-white px-3 py-2 text-sm font-semibold text-[#9a5524] disabled:opacity-50"><Trash2 className="h-4 w-4" />Delete</button>
                        </> : null}
                      </div>
                    </article>
                  ))}
                  {!isLoadingFolders && (browser?.files?.length || 0) === 0 ? <p className="rounded-xl bg-[#FAF8F5] px-4 py-3 text-sm text-[#7A746A]">No files in this folder.</p> : null}
                </div>
              </div>
            </>
          ) : null}
        </Card>

        <aside className="space-y-6 xl:sticky xl:top-20 xl:self-start">
          <Card padding="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5e8a8d]">Selected folder</p>
                <h2 className="mt-2 break-words font-semibold text-[#151f21]">{account.googleDriveFolderName || "No folder selected"}</h2>
              </div>
              <Badge variant={account.googleDriveFolderAccessStatus === "accessible" ? "success" : "warning"}>
                {account.googleDriveFolderAccessStatus === "accessible" ? "Verified" : "Not set"}
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#7A746A]">This is the folder surfaced to the delivery team from the client record.</p>
            <div className="mt-4 flex flex-col gap-2">
              {account.googleDriveFolderUrl ? (
                <a href={account.googleDriveFolderUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#315f62] px-4 py-2 text-sm font-semibold text-white hover:bg-[#264f51]">Open selected folder<ExternalLink className="h-4 w-4" /></a>
              ) : null}
              {isAdmin ? <button type="button" onClick={() => void clearSelection()} disabled={!account.googleDriveFolderId || Boolean(busyFolderId)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#e4d5ce] bg-white px-4 py-2 text-sm font-semibold text-[#9a5524] hover:bg-[#fff4f0] disabled:opacity-50">
                {busyFolderId === "clear" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Clear selection
              </button> : null}
            </div>
          </Card>

          <Card padding="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf5f3] text-[#315f62]"><HardDrive className="h-5 w-5" /></span>
              <div>
                <h2 className="font-semibold text-[#151f21]">Drive connection</h2>
                <p className="text-sm text-[#7A746A]">{connection?.connectedEmail || "Not connected"}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-[#FAF8F5] px-3 py-2 text-sm">
              <span className="text-[#7A746A]">Access level</span>
              <span className="font-semibold text-[#315f62]">{connection?.connected ? (connection.accessLevel === "full" ? "Full access" : "Limited") : "Disconnected"}</span>
            </div>
            {isAdmin ? <Link href="/app/integrations" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#315f62] hover:text-[#264f51]">Manage integration<ExternalLink className="h-4 w-4" /></Link> : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}
