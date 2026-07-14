"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckSquare2,
  ExternalLink,
  FileCheck2,
  FolderOpen,
  Link2,
  Loader2,
  Mail,
  MapPin,
  NotebookText,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Unlink,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AlertBanner, Badge, Card, SkeletonLine, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api-client";
import type {
  ClientAccountLinkedContactRecord,
  ClientAccountLinkedRecords,
  ClientAccountLinkedTaskRecord,
  ClientAccountServiceRecord,
  ClientAccountSummaryRecord,
  ContactRecord,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

function formatLabel(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function personName(account: ClientAccountSummaryRecord) {
  const manager = account.accountManager;
  if (!manager) return "Unassigned";
  return [manager.firstName, manager.lastName].filter(Boolean).join(" ") || manager.email || "Unassigned";
}

function location(account: ClientAccountSummaryRecord) {
  return [account.address, account.city, account.state, account.postalCode, account.country].filter(Boolean).join(", ") || "No location recorded";
}

function driveItemLabel(account: ClientAccountSummaryRecord) {
  if (account.googleDriveFolderName) return account.googleDriveFolderName;
  if (!account.googleDriveFolderId) return "No Drive item linked";
  return account.googleDriveFolderUrl?.includes("/file/d/")
    ? "Google Drive ZIP archive"
    : "Google Drive folder";
}

function driveStatusLabel(account: ClientAccountSummaryRecord) {
  if (!account.googleDriveFolderId) return "No link saved";
  if (account.googleDriveFolderAccessStatus === "accessible") return "Verified access";
  if (account.googleDriveFolderAccessStatus === "inaccessible") return "Access problem";
  return "Saved, access not verified";
}

function taskDueLabel(task: ClientAccountLinkedTaskRecord) {
  if (task.due) return task.due;
  if (!task.dueDate) return "No due date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(new Date(task.dueDate));
}

function linkedContactSubtitle(contact: ClientAccountLinkedContactRecord) {
  return [
    contact.roleTitle || contact.role || "Role not set",
    contact.email || contact.phone || "No contact method",
  ].filter(Boolean).join(" - ");
}

export default function ClientAccountDetailPage() {
  const searchParams = useSearchParams();
  const clinicId = searchParams.get("id") || "";
  const { session } = useAuth();
  const token = session?.token;
  const missingAccountId = !clinicId;
  const [account, setAccount] = useState<ClientAccountSummaryRecord | null>(null);
  const [services, setServices] = useState<ClientAccountServiceRecord[]>([]);
  const [linkedRecords, setLinkedRecords] = useState<ClientAccountLinkedRecords | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [contactSearchResults, setContactSearchResults] = useState<ContactRecord[]>([]);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);
  const [linkActionContactId, setLinkActionContactId] = useState<string | null>(null);
  const [linkStatusMessage, setLinkStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(!missingAccountId);
  const [loadError, setLoadError] = useState(missingAccountId ? "No client account id was provided." : "");
  const [driveDraft, setDriveDraft] = useState("");
  const [driveTitleDraft, setDriveTitleDraft] = useState("");
  const [driveStatusMessage, setDriveStatusMessage] = useState("");
  const [isSavingDrive, setIsSavingDrive] = useState(false);

  useEffect(() => {
    if (!token || !clinicId) return;

    Promise.all([
      api.clientAccounts.list(token),
      api.clientAccounts.listServices(token, { includeArchived: false, includeAllClinics: true }),
      api.clientAccounts.getLinkedRecords(token, clinicId),
    ])
      .then(([accounts, allServices, records]) => {
        const selected = accounts.find((item) => item.clinicId === clinicId) || null;
        if (!selected) throw new Error("Client account not found or unavailable to this user.");
        setAccount(selected);
        setServices(allServices.filter((service) => service.clinicId === clinicId));
        setLinkedRecords(records);
        setLoadError("");
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Unable to load this client account."))
      .finally(() => setIsLoading(false));
  }, [clinicId, token]);

  const activeServices = useMemo(() => services.filter((service) => service.status === "active"), [services]);
  const linkedContacts = linkedRecords?.contacts || [];
  const openTasks = linkedRecords?.openTasks || [];
  const completedTasks = linkedRecords?.completedTasks || [];

  useEffect(() => {
    if (!account) return;
    setDriveDraft("");
    setDriveTitleDraft("");
  }, [account?.clinicId, account?.googleDriveFolderId, account?.googleDriveFolderUrl]);

  const handleSaveDriveFolder = async () => {
    if (!token || !account || isSavingDrive) return;
    setIsSavingDrive(true);
    setDriveStatusMessage("");
    try {
      const updated = await api.clientAccounts.updateDriveFolder(token, account.clinicId, {
        folderUrl: driveDraft.trim() || null,
        displayName: driveTitleDraft.trim() || null,
      });
      setAccount((current) => current ? { ...current, ...updated } : current);
      setDriveDraft("");
      setDriveTitleDraft("");
      setDriveStatusMessage(updated.googleDriveFolderUrl ? "Google Drive link saved." : "Google Drive link removed.");
    } catch (error) {
      setDriveStatusMessage(error instanceof Error ? error.message : "Could not save Google Drive link.");
    } finally {
      setIsSavingDrive(false);
    }
  };

  const handleRemoveDriveFolder = async () => {
    if (!token || !account || isSavingDrive) return;
    setIsSavingDrive(true);
    setDriveStatusMessage("");
    try {
      const updated = await api.clientAccounts.updateDriveFolder(token, account.clinicId, {
        folderUrl: null,
        folderId: null,
      });
      setAccount((current) => current ? { ...current, ...updated } : current);
      setDriveDraft("");
      setDriveTitleDraft("");
      setDriveStatusMessage("Google Drive link removed.");
    } catch (error) {
      setDriveStatusMessage(error instanceof Error ? error.message : "Could not remove Google Drive link.");
    } finally {
      setIsSavingDrive(false);
    }
  };

  const handleSearchContacts = async () => {
    if (!token || !contactSearch.trim()) return;
    setIsSearchingContacts(true);
    setLinkStatusMessage("");
    try {
      const result = await api.contacts.list(token, { search: contactSearch.trim(), pageSize: 10 });
      setContactSearchResults(result.contacts);
    } catch (error) {
      setLinkStatusMessage(error instanceof Error ? error.message : "Could not search contacts.");
    } finally {
      setIsSearchingContacts(false);
    }
  };

  const handleLinkContact = async (contactId: string) => {
    if (!token || !account || linkActionContactId) return;
    setLinkActionContactId(contactId);
    setLinkStatusMessage("");
    try {
      const records = await api.clientAccounts.linkContact(token, account.clinicId, contactId);
      setLinkedRecords(records);
      setContactSearchResults((current) => current.filter((contact) => contact.id !== contactId));
      setContactSearch("");
      setLinkStatusMessage("Contact linked to this client account.");
    } catch (error) {
      setLinkStatusMessage(error instanceof Error ? error.message : "Could not link this contact.");
    } finally {
      setLinkActionContactId(null);
    }
  };

  const handleUnlinkContact = async (contactId: string) => {
    if (!token || !account || linkActionContactId) return;
    setLinkActionContactId(contactId);
    setLinkStatusMessage("");
    try {
      const records = await api.clientAccounts.unlinkContact(token, account.clinicId, contactId);
      setLinkedRecords(records);
      setLinkStatusMessage("Contact unlinked from this client account.");
    } catch (error) {
      setLinkStatusMessage(error instanceof Error ? error.message : "Could not unlink this contact.");
    } finally {
      setLinkActionContactId(null);
    }
  };

  if (isLoading) {
    return <div className="space-y-6"><SkeletonLine className="h-10 w-72" /><SkeletonLine className="h-56 w-full" /></div>;
  }

  if (loadError || !account) {
    return (
      <div className="space-y-6">
        <Link href="/app/ops/client-accounts" className="btn-secondary inline-flex text-sm"><ArrowLeft className="h-4 w-4" />Back to accounts</Link>
        <AlertBanner title="Client account could not be loaded" description={loadError || "The account is unavailable."} variant="warning" />
      </div>
    );
  }

  const canEditProfile = session?.clinicId === account.clinicId;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/app/ops/client-accounts" className="btn-secondary p-2"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e4efed] text-[#315f62]"><BriefcaseBusiness className="h-6 w-6" /></div>
          <div>
            <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold text-[#151f21]">{account.clinicName}</h1><StatusBadge status={formatLabel(account.clientStatus)} /></div>
            <p className="mt-1 text-sm text-[#7A746A]">Master client record · {formatLabel(account.healthStatus)} · {formatLabel(account.churnRisk)} risk</p>
          </div>
        </div>
        {canEditProfile ? (
          <Link href="/app/ops/client-accounts/package" className="inline-flex items-center gap-2 rounded-full bg-[#5e8a8d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#507b7e]"><Pencil className="h-4 w-4" />Edit account</Link>
        ) : (
          <span className="rounded-full border border-[#d8ddda] px-4 py-2 text-sm font-medium text-[#7A746A]">Switch to this workspace to edit</span>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card padding="p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[#151f21]">Account profile</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                [ExternalLink, "Website", account.website || "Not provided"],
                [MapPin, "Location", location(account)],
                [BriefcaseBusiness, "Account type", formatLabel(account.clientStatus)],
                [ShieldCheck, "Package", account.currentPackage || "Not set"],
                [Users, "Owner", personName(account)],
                [Mail, "Email", account.email || "Not provided"],
                [Phone, "Phone", account.phone || "Not provided"],
              ].map(([Icon, label, value]) => {
                const DetailIcon = Icon as typeof BriefcaseBusiness;
                return <div key={String(label)} className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4"><p className="flex items-center gap-2 text-xs font-medium text-[#6F6A66]"><DetailIcon className="h-4 w-4" />{String(label)}</p><p className="mt-2 text-sm font-semibold text-[#151f21]">{String(value)}</p></div>;
              })}
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#151f21]">Relevant contacts</h2>
                <p className="mt-1 text-sm text-[#7A746A]">People from the internal workspace linked to this client account.</p>
              </div>
              <Badge variant="info">{linkedContacts.length}</Badge>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b9694]" />
                <input
                  value={contactSearch}
                  onChange={(event) => setContactSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSearchContacts();
                    }
                  }}
                  placeholder="Search contacts by name, email, phone, or account"
                  className="w-full rounded-xl border border-[#d8ddda] bg-white py-2.5 pl-10 pr-3.5 text-sm text-[#151f21] outline-none transition focus:border-[#75aaa7] focus:ring-4 focus:ring-[rgba(96,180,175,0.1)]"
                />
              </div>
              <button type="button" onClick={() => void handleSearchContacts()} disabled={isSearchingContacts || !contactSearch.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#315f62] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#264f51] disabled:opacity-60">
                {isSearchingContacts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </button>
            </div>
            {contactSearchResults.length > 0 && (
              <div className="mt-3 space-y-2 rounded-xl border border-[#E7E1DA] bg-white p-3">
                {contactSearchResults
                  .filter((contact) => !linkedContacts.some((linked) => linked.id === contact.id))
                  .map((contact) => (
                    <div key={contact.id} className="flex flex-col gap-3 rounded-lg bg-[#FAF8F5] p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-[#151f21]">{contact.name}</p>
                        <p className="text-sm text-[#7A746A]">{contact.accountName || "No account"} - {contact.email || contact.phone || "No contact method"}</p>
                      </div>
                      <button type="button" onClick={() => void handleLinkContact(contact.id)} disabled={linkActionContactId === contact.id} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#cbded9] bg-white px-3 py-2 text-sm font-semibold text-[#315f62] hover:bg-[#edf5f3] disabled:opacity-60">
                        {linkActionContactId === contact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                        Link
                      </button>
                    </div>
                  ))}
              </div>
            )}
            {linkStatusMessage ? <p className="mt-3 text-sm text-[#315f62]">{linkStatusMessage}</p> : null}
            <div className="mt-5 space-y-3">
              {linkedContacts.map((contact) => (
                <div key={contact.id} className="flex flex-col gap-3 rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <Link href={`/app/crm/contacts/detail?id=${contact.id}`} className="min-w-0 transition hover:text-[#315f62]">
                    <p className="font-semibold text-[#151f21]">{contact.name}</p>
                    <p className="text-sm text-[#7A746A]">{linkedContactSubtitle(contact)}</p>
                  </Link>
                  <div className="flex shrink-0 gap-2">
                    <Link href={`/app/crm/contacts/detail?id=${contact.id}`} className="inline-flex items-center gap-2 rounded-lg border border-[#d8ddda] bg-white px-3 py-2 text-sm font-semibold text-[#315f62] hover:bg-[#edf5f3]">
                      Open<ExternalLink className="h-4 w-4" />
                    </Link>
                    <button type="button" onClick={() => void handleUnlinkContact(contact.id)} disabled={linkActionContactId === contact.id} className="inline-flex items-center gap-2 rounded-lg border border-[#ead4cb] bg-white px-3 py-2 text-sm font-semibold text-[#9a5524] hover:bg-[#fff4f0] disabled:opacity-60">
                      {linkActionContactId === contact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                      Unlink
                    </button>
                  </div>
                </div>
              ))}
              {linkedContacts.length === 0 && <p className="rounded-xl border border-dashed border-[#E7E1DA] p-6 text-center text-sm text-[#7A746A]">No relevant contacts are linked to this client account yet.</p>}
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-[#151f21]">Services</h2><p className="mt-1 text-sm text-[#7A746A]">Current package delivery and ownership.</p></div><Link href="/app/ops/services" className="text-sm font-semibold text-[#315f62]">View services</Link></div>
            <div className="mt-5 flex flex-wrap gap-2">{activeServices.map((service) => <Badge key={service.id} variant="success">{service.name}</Badge>)}{activeServices.length === 0 && <Badge variant="warning">No active services</Badge>}</div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#151f21]">Client tasks</h2>
                <p className="mt-1 text-sm text-[#7A746A]">Open and completed internal delivery work linked to this account.</p>
              </div>
              {account.id ? (
                <Link href={`/app/crm/tasks/new?clientAccountProfileId=${account.id}`} className="inline-flex items-center gap-2 rounded-xl bg-[#315f62] px-4 py-2 text-sm font-semibold text-white hover:bg-[#264f51]">
                  <Plus className="h-4 w-4" />New task
                </Link>
              ) : null}
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#151f21]">Open work</h3>
                  <Badge variant={openTasks.length > 0 ? "warning" : "success"}>{openTasks.length}</Badge>
                </div>
                <div className="space-y-2">
                  {openTasks.slice(0, 8).map((task) => (
                    <Link key={task.id} href={`/app/crm/tasks?taskId=${task.id}`} className="block rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4 transition hover:border-[#a9c7c4]">
                      <p className="font-semibold text-[#151f21]">{task.title}</p>
                      <p className="mt-1 text-sm text-[#7A746A]">{task.category || "Delivery"} - {task.assignedTo || "Unassigned"} - {taskDueLabel(task)}</p>
                    </Link>
                  ))}
                  {openTasks.length === 0 && <p className="rounded-xl border border-dashed border-[#E7E1DA] p-5 text-center text-sm text-[#7A746A]">No open tasks linked to this client.</p>}
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#151f21]">Completed</h3>
                  <Badge variant="success">{completedTasks.length}</Badge>
                </div>
                <div className="space-y-2">
                  {completedTasks.slice(0, 8).map((task) => (
                    <Link key={task.id} href={`/app/crm/tasks?taskId=${task.id}`} className="block rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4 opacity-80 transition hover:border-[#a9c7c4]">
                      <p className="font-semibold text-[#151f21]">{task.title}</p>
                      <p className="mt-1 text-sm text-[#7A746A]">{task.category || "Delivery"} - {task.assignedTo || "Unassigned"}</p>
                    </Link>
                  ))}
                  {completedTasks.length === 0 && <p className="rounded-xl border border-dashed border-[#E7E1DA] p-5 text-center text-sm text-[#7A746A]">No completed tasks linked to this client yet.</p>}
                </div>
              </div>
            </div>
          </Card>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-20 xl:self-start">
          <Card padding="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-[#151f21]"><FolderOpen className="h-4 w-4 text-[#315f62]" />Google Drive link</h2>
                <p className="mt-1 text-sm text-[#7A746A]">Designated account folder or ZIP archive for delivery assets.</p>
              </div>
              {account.googleDriveFolderUrl ? (
                <a href={account.googleDriveFolderUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#315f62] px-3 py-2 text-sm font-semibold text-white hover:bg-[#264f51]">
                  Open<ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
            <div className="mt-4 rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8b9694]">Current Drive item</p>
              <p className="mt-1 break-all text-sm font-semibold text-[#151f21]">
                {driveItemLabel(account)}
              </p>
              <p className="mt-2 text-xs text-[#7A746A]">
                {driveStatusLabel(account)}
                {account.googleDriveFolderCheckedAt ? ` · checked ${new Date(account.googleDriveFolderCheckedAt).toLocaleString()}` : ""}
              </p>
              {account.googleDriveFolderError ? (
                <p className="mt-2 text-xs font-medium text-[#B42318]">{account.googleDriveFolderError}</p>
              ) : null}
            </div>
            <div className="mt-4 space-y-3">
              <input
                value={driveTitleDraft}
                onChange={(event) => setDriveTitleDraft(event.target.value)}
                placeholder="Title shown on profile, e.g. Client launch assets"
                className="w-full rounded-xl border border-[#d8ddda] bg-white px-3.5 py-2.5 text-sm text-[#151f21] outline-none transition focus:border-[#75aaa7] focus:ring-4 focus:ring-[rgba(96,180,175,0.1)]"
              />
              <input
                value={driveDraft}
                onChange={(event) => setDriveDraft(event.target.value)}
                placeholder="Paste Google Drive folder URL, ZIP URL, or item ID"
                className="w-full rounded-xl border border-[#d8ddda] bg-white px-3.5 py-2.5 text-sm text-[#151f21] outline-none transition focus:border-[#75aaa7] focus:ring-4 focus:ring-[rgba(96,180,175,0.1)]"
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleSaveDriveFolder()} disabled={isSavingDrive} className="inline-flex items-center gap-2 rounded-xl bg-[#5e8a8d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#507b7e] disabled:opacity-60">
                  {isSavingDrive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save link
                </button>
                <button type="button" onClick={() => void handleRemoveDriveFolder()} disabled={isSavingDrive || !account.googleDriveFolderId} className="inline-flex items-center gap-2 rounded-xl border border-[#d8ddda] bg-white px-4 py-2 text-sm font-semibold text-[#7A746A] hover:bg-[#f4f7f5] disabled:opacity-60">
                  <Trash2 className="h-4 w-4" />Remove
                </button>
              </div>
              {driveStatusMessage ? <p className="text-sm text-[#315f62]">{driveStatusMessage}</p> : null}
            </div>
          </Card>
          <Card padding="p-5">
            <h2 className="font-semibold text-[#151f21]">Record links</h2>
            <div className="mt-4 space-y-2">
              {[
                [Users, "Contacts and leads", `/app/leads?account=${encodeURIComponent(account.clinicName)}`],
                [BriefcaseBusiness, "Deals", `/app/crm/pipeline?account=${encodeURIComponent(account.clinicName)}`],
                [NotebookText, "Notes", "#account-notes"],
                [CheckSquare2, "Tasks", `/app/crm/tasks?clientAccountProfileId=${account.id || ""}`],
                [ShieldCheck, "Audits", `/app/admin?clinicId=${account.clinicId}`],
                [FileCheck2, "Proposals", `/app/crm/pipeline?account=${encodeURIComponent(account.clinicName)}&view=proposals`],
              ].map(([Icon, label, href]) => {
                const RecordIcon = Icon as typeof Users;
                return <Link key={String(label)} href={String(href)} className="flex items-center justify-between rounded-xl bg-[#FAF8F5] px-4 py-3 text-sm font-semibold text-[#315f62] hover:bg-[#edf5f3]"><span className="flex items-center gap-2"><RecordIcon className="h-4 w-4" />{String(label)}</span><ExternalLink className="h-4 w-4" /></Link>;
              })}
            </div>
          </Card>
          <div id="account-notes"><Card padding="p-5"><h2 className="font-semibold text-[#151f21]">Account notes</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#7A746A]">{account.keyNotes || "No account notes recorded."}</p></Card></div>
        </aside>
      </div>
    </div>
  );
}
