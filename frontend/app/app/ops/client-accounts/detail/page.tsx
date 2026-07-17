"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckSquare2,
  ExternalLink,
  FileCheck2,
  FolderOpen,
  Gauge,
  Link2,
  Loader2,
  Mail,
  MapPin,
  NotebookText,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldCheck,
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
  GrowthScoreSnapshotList,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import {
  getClientNextBestAction,
  nextBestActionBadgeClass,
} from "@/lib/next-best-action";

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

const growthScoreCategoryLabels = [
  ["websiteVisibility", "Website visibility"],
  ["seo", "SEO"],
  ["gbp", "GBP"],
  ["tracking", "Tracking"],
  ["conversion", "Conversion"],
  ["leadHandling", "Lead handling"],
  ["responseSpeed", "Response speed"],
  ["enquiryVisibility", "Enquiry visibility"],
  ["treatmentPerformance", "Treatment performance"],
  ["revenueLeakage", "Revenue leakage"],
  ["growthOpportunity", "Growth opportunity"],
] as const;

function formatScore(value: number | null | undefined) {
  return value === null || value === undefined ? "Not scored" : `${Math.round(value)} / 100`;
}

export default function ClientAccountDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clinicId = searchParams.get("id") || "";
  const { session } = useAuth();
  const token = session?.token;
  const missingAccountId = !clinicId;
  const [account, setAccount] = useState<ClientAccountSummaryRecord | null>(null);
  const [services, setServices] = useState<ClientAccountServiceRecord[]>([]);
  const [linkedRecords, setLinkedRecords] = useState<ClientAccountLinkedRecords | null>(null);
  const [growthScoreHistory, setGrowthScoreHistory] = useState<GrowthScoreSnapshotList | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [contactSearchTerm, setContactSearchTerm] = useState("");
  const [contactSearchResults, setContactSearchResults] = useState<ContactRecord[]>([]);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);
  const [linkActionContactId, setLinkActionContactId] = useState<string | null>(null);
  const [linkStatusMessage, setLinkStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(!missingAccountId);
  const [loadError, setLoadError] = useState(missingAccountId ? "No client account id was provided." : "");

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
        if (selected.id) {
          void api.growthScores
            .listSnapshots(token, { clientAccountProfileId: selected.id, limit: 5 })
            .then(setGrowthScoreHistory)
            .catch(() => setGrowthScoreHistory(null));
        } else {
          setGrowthScoreHistory(null);
        }
        setLoadError("");
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Unable to load this client account."))
      .finally(() => setIsLoading(false));
  }, [clinicId, token]);

  const activeServices = useMemo(() => services.filter((service) => service.status === "active"), [services]);
  const linkedContacts = useMemo(() => linkedRecords?.contacts || [], [linkedRecords?.contacts]);
  const linkedEmailContacts = useMemo(
    () => linkedContacts.filter((contact) => contact.email),
    [linkedContacts],
  );
  const openTasks = useMemo(() => linkedRecords?.openTasks || [], [linkedRecords?.openTasks]);
  const completedTasks = useMemo(() => linkedRecords?.completedTasks || [], [linkedRecords?.completedTasks]);
  const availableContactSearchResults = useMemo(
    () => contactSearchResults.filter((contact) => !linkedContacts.some((linked) => linked.id === contact.id)),
    [contactSearchResults, linkedContacts],
  );

  const handleSearchContacts = async () => {
    const search = contactSearch.trim();
    if (!token || !search) return;
    setIsSearchingContacts(true);
    setContactSearchTerm(search);
    setLinkStatusMessage("");
    try {
      const result = await api.contacts.list(token, { search, pageSize: 10 });
      setContactSearchResults(result.contacts);
      setContactSearch("");
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
      setContactSearchTerm("");
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
        <button type="button" onClick={() => router.back()} className="btn-secondary inline-flex text-sm"><ArrowLeft className="h-4 w-4" />Back</button>
        <AlertBanner title="Client account could not be loaded" description={loadError || "The account is unavailable."} variant="warning" />
      </div>
    );
  }

  const canEditProfile = session?.clinicId === account.clinicId;
  const nextBestAction = getClientNextBestAction({
    churnRisk: account.churnRisk,
    contractStatus: account.contractStatus,
    currentPackage: account.currentPackage,
    googleDriveFolderAccessStatus: account.googleDriveFolderAccessStatus,
    googleDriveFolderId: account.googleDriveFolderId,
    healthStatus: account.healthStatus,
    href: `/app/ops/client-accounts/detail?id=${encodeURIComponent(account.clinicId)}`,
    nextTaskTitle: openTasks.find((task) => task.isOverdue)?.title || openTasks[0]?.title,
    onboardingStatus: account.onboardingStatus,
    overdueTaskCount: openTasks.filter((task) => task.isOverdue).length || account.overdueTaskCount,
    recommendedNextPackage: account.recommendedNextPackage,
    renewalDate: account.renewalDate,
    upsellOpportunity: account.upsellOpportunity,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <button type="button" onClick={() => router.back()} aria-label="Back" className="btn-secondary p-2"><ArrowLeft className="h-5 w-5" /></button>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e4efed] text-[#315f62]"><BriefcaseBusiness className="h-6 w-6" /></div>
          <div>
            <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold text-[#151f21]">{account.clinicName}</h1><StatusBadge status={formatLabel(account.clientStatus)} /></div>
            <p className="mt-1 text-sm text-[#7A746A]">Master client record - {formatLabel(account.healthStatus)} - {formatLabel(account.churnRisk)} risk</p>
          </div>
        </div>
        {canEditProfile ? (
          <Link href="/app/ops/client-accounts/package" className="inline-flex items-center gap-2 rounded-full bg-[#5e8a8d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#507b7e]"><Pencil className="h-4 w-4" />Edit account</Link>
        ) : (
          <span className="rounded-full border border-[#d8ddda] px-4 py-2 text-sm font-medium text-[#7A746A]">Switch to this workspace to edit</span>
        )}
      </div>

      <Card padding="p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5e8a8d]">
              Next Best Action
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#151f21]">
              {nextBestAction.label}
            </h2>
            <p className="mt-1 text-sm text-[#7A746A]">
              {nextBestAction.detail}
            </p>
          </div>
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${nextBestActionBadgeClass(nextBestAction.urgency)}`}>
            {formatLabel(nextBestAction.urgency)} priority
          </span>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card padding="p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[#151f21]">Account profile</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                [ExternalLink, "Website", account.website || "Not provided"],
                [MapPin, "Location", location(account)],
                [BriefcaseBusiness, "Account type", formatLabel(account.clientStatus)],
                [ShieldCheck, "Current package", account.currentPackage || "Not set"],
                [ShieldCheck, "Recommended next", account.recommendedNextPackage || "Not set"],
                [BriefcaseBusiness, "Upsell opportunity", account.upsellOpportunity || "Not set"],
                [Users, "Owner", personName(account)],
                [Phone, "Phone", account.phone || "Not provided"],
              ].map(([Icon, label, value]) => {
                const DetailIcon = Icon as typeof BriefcaseBusiness;
                return <div key={String(label)} className="min-w-0 rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4"><p className="flex items-center gap-2 text-xs font-medium text-[#6F6A66]"><DetailIcon className="h-4 w-4" />{String(label)}</p><p className="mt-2 break-words text-sm font-semibold text-[#151f21]">{String(value)}</p></div>;
              })}
              <div className="min-w-0 rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4">
                <p className="flex items-center gap-2 text-xs font-medium text-[#6F6A66]"><Mail className="h-4 w-4" />Email</p>
                {linkedEmailContacts.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {linkedEmailContacts.map((contact) => (
                      <li key={contact.id} className="min-w-0">
                        <Link
                          href={`/app/crm/contacts/detail?id=${contact.id}`}
                          className="block min-w-0 rounded-lg py-1 transition hover:bg-white hover:text-[#315f62] focus:outline-none focus:ring-2 focus:ring-[#75aaa7]"
                          aria-label={`Open ${contact.name || contact.email}`}
                        >
                          <span className="block break-all text-sm font-semibold text-[#151f21]">{contact.email}</span>
                          <span className="block truncate text-xs text-[#7A746A]">{contact.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 break-all text-sm font-semibold text-[#151f21]">{account.email || "Not provided"}</p>
                )}
              </div>
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-[#151f21]">
                  <Gauge className="h-5 w-5 text-[#315f62]" />
                  Clinic Growth Score
                </h2>
                <p className="mt-1 text-sm text-[#7A746A]">
                  Latest structured score, gaps, and recommended next package.
                </p>
              </div>
              <span className="inline-flex rounded-full bg-[#edf5f3] px-4 py-2 text-sm font-bold text-[#315f62]">
                {formatScore(account.growthScoreOverall)}
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4">
                <p className="text-xs font-medium text-[#6F6A66]">Recommended package</p>
                <p className="mt-2 text-sm font-semibold text-[#151f21]">
                  {account.growthScoreRecommendedPackage || account.recommendedNextPackage || "Not set"}
                </p>
              </div>
              <div className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4">
                <p className="text-xs font-medium text-[#6F6A66]">Last scored</p>
                <p className="mt-2 text-sm font-semibold text-[#151f21]">
                  {account.growthScoreUpdatedAt ? new Date(account.growthScoreUpdatedAt).toLocaleString() : "Not set"}
                </p>
              </div>
              <div className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4">
                <p className="text-xs font-medium text-[#6F6A66]">Package link</p>
                <p className="mt-2 text-sm font-semibold text-[#151f21]">
                  {account.growthScoreRecommendedPackage ? "Linked to score gaps" : "No score recommendation"}
                </p>
              </div>
            </div>
            {account.growthScoreGapSummary ? (
              <p className="mt-4 rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4 text-sm leading-relaxed text-[#7A746A]">
                {account.growthScoreGapSummary}
              </p>
            ) : null}
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {growthScoreCategoryLabels.map(([key, label]) => (
                <div key={key} className="flex items-center justify-between rounded-xl bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#6F6A66]">
                  <span>{label}</span>
                  <span className="font-semibold text-[#151f21]">{formatScore(account.growthScoreCategories[key])}</span>
                </div>
              ))}
            </div>
            {growthScoreHistory?.previous.length ? (
              <div className="mt-5 border-t border-[#E7E1DA] pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6F6A66]">
                  Previous scores
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {growthScoreHistory.previous.slice(0, 4).map((snapshot) => (
                    <div key={snapshot.id} className="flex items-center justify-between rounded-xl bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#6F6A66]">
                      <span>{new Date(snapshot.scoredAt).toLocaleDateString()}</span>
                      <span className="font-semibold text-[#151f21]">{formatScore(snapshot.overallScore)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          <Card padding="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#151f21]">Relevant contacts</h2>
                <p className="mt-1 text-sm text-[#7A746A]">People from the internal workspace linked to this client account.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="info">{linkedContacts.length}</Badge>
                <Link
                  href={`/app/crm/contacts/new?clientId=${encodeURIComponent(account.clinicId)}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#315f62] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#264f51]"
                >
                  <Plus className="h-4 w-4" />
                  Add contact
                </Link>
              </div>
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
            {contactSearchTerm ? (
              <p className="mt-3 text-xs font-medium text-[#6F6A66]">
                Results for &quot;{contactSearchTerm}&quot;
              </p>
            ) : null}
            {availableContactSearchResults.length > 0 && (
              <div className="mt-3 space-y-2 rounded-xl border border-[#E7E1DA] bg-white p-3">
                {availableContactSearchResults.map((contact) => (
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
            {contactSearchTerm && !isSearchingContacts && availableContactSearchResults.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-[#E7E1DA] bg-white p-4 text-sm text-[#7A746A]">
                No unlinked contacts found for &quot;{contactSearchTerm}&quot;. The matching contacts may already be linked, or no contact matched that search.
              </p>
            ) : null}
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

          <div id="account-tasks" className="scroll-mt-24">
          <Card padding="p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#151f21]">Client tasks</h2>
                <p className="mt-1 text-sm text-[#7A746A]">Open and completed internal delivery work linked to this account.</p>
              </div>
              {account.id ? (
                <Link href={`/app/crm/tasks/new?mode=delivery&clientAccountProfileId=${account.id}`} className="inline-flex items-center gap-2 rounded-xl bg-[#315f62] px-4 py-2 text-sm font-semibold text-white hover:bg-[#264f51]">
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
                    <Link key={task.id} href={`/app/crm/tasks/detail?id=${task.id}&from=delivery`} className="block rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4 transition hover:border-[#a9c7c4]">
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
                    <Link key={task.id} href={`/app/crm/tasks/detail?id=${task.id}&from=delivery`} className="block rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4 opacity-80 transition hover:border-[#a9c7c4]">
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
        </div>

        <aside className="space-y-6 xl:sticky xl:top-20 xl:self-start">
          <Card padding="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-[#151f21]"><FolderOpen className="h-4 w-4 text-[#315f62]" />Google Drive</h2>
                <p className="mt-1 text-sm text-[#7A746A]">Browse, create, and select this client&apos;s delivery folder.</p>
              </div>
              {account.googleDriveFolderUrl ? (
                <a href={account.googleDriveFolderUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#315f62] px-3 py-2 text-sm font-semibold text-white hover:bg-[#264f51]">
                  Open<ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
            <div className="mt-4 rounded-2xl border border-[#cfe0dc] bg-[linear-gradient(145deg,#f3f8f6_0%,#fffaf6_100%)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8b9694]">Current Drive item</p>
              <p className="mt-1 break-all text-sm font-semibold text-[#151f21]">
                {driveItemLabel(account)}
              </p>
              <p className="mt-2 text-xs text-[#7A746A]">
                {driveStatusLabel(account)}
                {account.googleDriveFolderCheckedAt ? ` - checked ${new Date(account.googleDriveFolderCheckedAt).toLocaleString()}` : ""}
              </p>
              {account.googleDriveFolderError ? (
                <p className="mt-2 text-xs font-medium text-[#B42318]">{account.googleDriveFolderError}</p>
              ) : null}
            </div>
            <Link
              href={`/app/ops/client-accounts/drive?id=${encodeURIComponent(account.clinicId)}`}
              className="mt-4 flex min-h-11 items-center justify-between rounded-xl bg-[#315f62] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#264f51] focus:outline-none focus:ring-4 focus:ring-[rgba(49,95,98,0.18)]"
            >
              Manage Drive workspace
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Card>
          <Card padding="p-5">
            <h2 className="font-semibold text-[#151f21]">Record links</h2>
            <div className="mt-4 space-y-2">
              {[
                [Users, "Contacts and leads", `/app/leads?account=${encodeURIComponent(account.clinicName)}`],
                [BriefcaseBusiness, "Deals", `/app/crm/pipeline?account=${encodeURIComponent(account.clinicName)}`],
                [NotebookText, "Notes", "#account-notes"],
                [CheckSquare2, "Tasks", "#account-tasks"],
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
