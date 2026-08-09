"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  CheckSquare2,
  CreditCard,
  ExternalLink,
  FileCheck2,
  FolderOpen,
  Gauge,
  LifeBuoy,
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
import { AlertBanner, Badge, Card, ProgressBar, SkeletonLine, StatusBadge } from "@/components/ui";
import { RecordMeetingsPanel } from "@/components/calendar/record-meetings-panel";
import { api } from "@/lib/api-client";
import type {
  ClientAccountLinkedRecords,
  ClientAccountLinkedTaskRecord,
  ClientAccountAccessItemRecord,
  ClientAccountDocumentLinkRecord,
  ClientAccountServiceRecord,
  ClientAccountSummaryRecord,
  ClientIssuePriority,
  ClientIssueRecord,
  ClientIssueStatus,
  ContactRecord,
  GrowthScoreSnapshotList,
  QuickBooksClientCustomerMappingRecord,
  QuickBooksConnectionStatus,
  QuickBooksCustomerRecord,
  TeamMember,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import {
  getClientNextBestAction,
  nextBestActionBadgeClass,
} from "@/lib/next-best-action";
import { isCanonicalWonClientOnboardingTask } from "@/lib/won-client-onboarding";

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
  if (task.dueDate) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
    }).format(new Date(task.dueDate));
  }
  return task.due || "No due date";
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatMoney(value: number | null | undefined, currency = "GBP") {
  if (value === null || value === undefined) return "Not set";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatMoneyFromCents(value: number | null | undefined, currency = "GBP") {
  if (value === null || value === undefined) return "Not set";
  return formatMoney(Number(value) / 100, currency);
}

function paymentBadge(status: string) {
  if (status === "paid") return <Badge variant="success">Paid</Badge>;
  if (status === "overdue" || status === "failed") return <Badge variant="error">{formatLabel(status)}</Badge>;
  if (status === "pending" || status === "not_started") return <Badge variant="info">{formatLabel(status)}</Badge>;
  return <Badge variant="neutral">{formatLabel(status)}</Badge>;
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

const ISSUE_PRIORITIES: ClientIssuePriority[] = ["low", "medium", "high", "critical"];
const ISSUE_STATUSES: ClientIssueStatus[] = ["open", "in_progress", "waiting", "resolved", "closed"];

const emptyIssueForm = {
  title: "",
  priority: "medium" as ClientIssuePriority,
  status: "open" as ClientIssueStatus,
  ownerUserId: "",
  dueDate: "",
  notes: "",
  taskId: "",
};

const clientAccountRecordTabs = [
  { id: "files", label: "Files/Documents", panelId: "account-files" },
  { id: "access", label: "Access/assets", panelId: "account-access-assets" },
  { id: "onboarding", label: "Onboarding", panelId: "account-onboarding" },
  { id: "tasks", label: "Tasks", panelId: "account-tasks" },
  { id: "meetings", label: "Meetings", panelId: "account-meetings" },
  { id: "issues", label: "Issues/Support", panelId: "account-issues" },
] as const;

type ClientAccountRecordTab = (typeof clientAccountRecordTabs)[number]["id"];

function formatScore(value: number | null | undefined) {
  return value === null || value === undefined ? "Not scored" : `${Math.round(value)} / 100`;
}

export default function ClientAccountDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clinicId = searchParams.get("id") || "";
  const { hasPermission, session, user } = useAuth();
  const token = session?.token;
  const canWriteClientAccounts = hasPermission("client_accounts:write");
  const canWriteInternalTasks = hasPermission("internal_tasks:write");
  const isInternalAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const canConfigureDrive = isInternalAdmin;
  const canAssignIssueOwners = canWriteClientAccounts && isInternalAdmin;
  const missingAccountId = !clinicId;
  const [account, setAccount] = useState<ClientAccountSummaryRecord | null>(null);
  const [services, setServices] = useState<ClientAccountServiceRecord[]>([]);
  const [linkedRecords, setLinkedRecords] = useState<ClientAccountLinkedRecords | null>(null);
  const [documents, setDocuments] = useState<ClientAccountDocumentLinkRecord[]>([]);
  const [accessItems, setAccessItems] = useState<ClientAccountAccessItemRecord[]>([]);
  const [issues, setIssues] = useState<ClientIssueRecord[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [issueForm, setIssueForm] = useState(emptyIssueForm);
  const [issueActionId, setIssueActionId] = useState<string | null>(null);
  const [issueStatusMessage, setIssueStatusMessage] = useState("");
  const [growthScoreHistory, setGrowthScoreHistory] = useState<GrowthScoreSnapshotList | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [contactSearchTerm, setContactSearchTerm] = useState("");
  const [contactSearchResults, setContactSearchResults] = useState<ContactRecord[]>([]);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);
  const [linkActionContactId, setLinkActionContactId] = useState<string | null>(null);
  const [linkStatusMessage, setLinkStatusMessage] = useState("");
  const [documentDrafts, setDocumentDrafts] = useState<Record<string, { driveUrl: string; displayName: string; notes: string }>>({});
  const [accessDrafts, setAccessDrafts] = useState<Record<string, string>>({});
  const [documentActionType, setDocumentActionType] = useState<string | null>(null);
  const [accessActionType, setAccessActionType] = useState<string | null>(null);
  const [filesStatusMessage, setFilesStatusMessage] = useState("");
  const [accessStatusMessage, setAccessStatusMessage] = useState("");
  const [quickBooksStatus, setQuickBooksStatus] = useState<QuickBooksConnectionStatus | null>(null);
  const [quickBooksMapping, setQuickBooksMapping] = useState<QuickBooksClientCustomerMappingRecord | null>(null);
  const [quickBooksCustomers, setQuickBooksCustomers] = useState<QuickBooksCustomerRecord[]>([]);
  const [quickBooksSearch, setQuickBooksSearch] = useState("");
  const [quickBooksForm, setQuickBooksForm] = useState({
    customerId: "",
    customerName: "",
    companyName: "",
    email: "",
  });
  const [isQuickBooksBusy, setIsQuickBooksBusy] = useState(false);
  const [quickBooksMessage, setQuickBooksMessage] = useState("");
  const [activeRecordTab, setActiveRecordTab] = useState<ClientAccountRecordTab>("files");
  const [isLoading, setIsLoading] = useState(!missingAccountId);
  const [loadError, setLoadError] = useState(missingAccountId ? "No client account id was provided." : "");

  useEffect(() => {
    const selectTabFromHash = () => {
      const selectedTab = clientAccountRecordTabs.find(
        (tab) => `#${tab.panelId}` === window.location.hash,
      );
      if (selectedTab) setActiveRecordTab(selectedTab.id);
    };

    selectTabFromHash();
    window.addEventListener("hashchange", selectTabFromHash);
    return () => window.removeEventListener("hashchange", selectTabFromHash);
  }, []);

  useEffect(() => {
    if (!token || !clinicId) return;

    const teamMembersRequest = canAssignIssueOwners
      ? api.team.getMembers(token).catch((): TeamMember[] => [])
      : Promise.resolve<TeamMember[]>([]);

    Promise.all([
      api.clientAccounts.list(token),
      api.clientAccounts.listServices(token, { includeArchived: false, includeAllClinics: true }),
      api.clientAccounts.getLinkedRecords(token, clinicId),
      api.clientAccounts.listDocuments(token, clinicId),
      api.clientAccounts.listAccessItems(token, clinicId),
      api.clientAccounts.listIssues(token, clinicId),
      teamMembersRequest,
    ])
      .then(([accounts, allServices, records, documentLinks, accessList, issueRows, members]) => {
        const selected = accounts.find((item) => item.clinicId === clinicId) || null;
        if (!selected) throw new Error("Client account not found or unavailable to this user.");
        setAccount(selected);
        setServices(allServices.filter((service) => service.clinicId === clinicId));
        setLinkedRecords(records);
        setDocuments(documentLinks);
        setAccessItems(accessList);
        setIssues(issueRows);
        setTeamMembers(members.filter((member) => !member.isInvitation));
        setDocumentDrafts(Object.fromEntries(documentLinks.map((document) => [
          document.documentType,
          {
            driveUrl: document.driveUrl || "",
            displayName: document.displayName || "",
            notes: document.notes || "",
          },
        ])));
        setAccessDrafts(Object.fromEntries(accessList.map((item) => [item.itemType, item.notes || ""])));
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
  }, [canAssignIssueOwners, clinicId, token]);

  useEffect(() => {
    if (!token || !account?.id) return;
    let isMounted = true;
    Promise.allSettled([
      api.quickbooks.getStatus(token),
      api.quickbooks.getClientMapping(token, account.id),
    ]).then(([statusResult, mappingResult]) => {
      if (!isMounted) return;
      const status = statusResult.status === "fulfilled" ? statusResult.value : null;
      const mapping = mappingResult.status === "fulfilled" ? mappingResult.value : null;
      setQuickBooksStatus(status);
      setQuickBooksMapping(mapping);
      if (mapping) {
        setQuickBooksForm({
          customerId: mapping.quickbooksCustomerId,
          customerName: mapping.quickbooksCustomerName,
          companyName: mapping.quickbooksCompanyName || "",
          email: mapping.quickbooksEmail || "",
        });
      }
      if (statusResult.status === "rejected" || mappingResult.status === "rejected") {
        setQuickBooksMessage("QuickBooks mapping status could not be loaded. Manual finance fields are still available.");
      }
    });
    return () => {
      isMounted = false;
    };
  }, [account?.id, token]);

  const activeServices = useMemo(() => services.filter((service) => service.status === "active"), [services]);
  const linkedContacts = useMemo(() => linkedRecords?.contacts || [], [linkedRecords?.contacts]);
  const linkedEmailContacts = useMemo(
    () => linkedContacts.filter((contact) => contact.email),
    [linkedContacts],
  );
  const openTasks = useMemo(() => linkedRecords?.openTasks || [], [linkedRecords?.openTasks]);
  const completedTasks = useMemo(() => linkedRecords?.completedTasks || [], [linkedRecords?.completedTasks]);
  const acceptedProposals = useMemo(
    () => linkedRecords?.acceptedProposals || [],
    [linkedRecords?.acceptedProposals],
  );
  const onboardingOpenTasks = useMemo(
    () => openTasks.filter(isCanonicalWonClientOnboardingTask),
    [openTasks],
  );
  const onboardingCompletedTasks = useMemo(
    () => completedTasks.filter(isCanonicalWonClientOnboardingTask),
    [completedTasks],
  );

  const searchQuickBooksCustomers = async () => {
    if (!token || isQuickBooksBusy) return;
    setIsQuickBooksBusy(true);
    setQuickBooksMessage("");
    try {
      const customers = await api.quickbooks.listCustomers(token, quickBooksSearch);
      setQuickBooksCustomers(customers);
      if (customers.length === 0) {
        setQuickBooksMessage("No QuickBooks customers matched that search.");
      }
    } catch (error) {
      setQuickBooksMessage(error instanceof Error ? error.message : "QuickBooks customer search failed.");
    } finally {
      setIsQuickBooksBusy(false);
    }
  };

  const selectQuickBooksCustomer = (customer: QuickBooksCustomerRecord) => {
    setQuickBooksForm({
      customerId: customer.id,
      customerName: customer.displayName,
      companyName: customer.companyName || "",
      email: customer.email || "",
    });
    setQuickBooksCustomers([]);
    setQuickBooksSearch("");
  };

  const saveQuickBooksMapping = async () => {
    if (!token || !account?.id || isQuickBooksBusy || !canWriteClientAccounts) return;
    setIsQuickBooksBusy(true);
    setQuickBooksMessage("");
    try {
      const mapping = await api.quickbooks.saveClientMapping(token, account.id, {
        quickbooksCustomerId: quickBooksForm.customerId,
        quickbooksCustomerName: quickBooksForm.customerName,
        quickbooksCompanyName: quickBooksForm.companyName || null,
        quickbooksEmail: quickBooksForm.email || null,
        mappingStatus: "active",
        mappingSource: "quickbooks_lookup",
      });
      setQuickBooksMapping(mapping);
      setQuickBooksMessage("QuickBooks customer mapping saved. Manual invoice and payment fields were not changed.");
    } catch (error) {
      setQuickBooksMessage(error instanceof Error ? error.message : "QuickBooks customer mapping could not be saved.");
    } finally {
      setIsQuickBooksBusy(false);
    }
  };

  const removeQuickBooksMapping = async () => {
    if (!token || !account?.id || isQuickBooksBusy || !canWriteClientAccounts) return;
    const confirmed = window.confirm("Remove the QuickBooks customer mapping for this client?");
    if (!confirmed) return;
    setIsQuickBooksBusy(true);
    try {
      await api.quickbooks.deleteClientMapping(token, account.id);
      setQuickBooksMapping(null);
      setQuickBooksForm({ customerId: "", customerName: "", companyName: "", email: "" });
      setQuickBooksMessage("QuickBooks customer mapping removed. Manual invoice and payment fields were not changed.");
    } catch (error) {
      setQuickBooksMessage(error instanceof Error ? error.message : "QuickBooks customer mapping could not be removed.");
    } finally {
      setIsQuickBooksBusy(false);
    }
  };
  const onboardingChecklistTasks = useMemo(
    () => [...onboardingOpenTasks, ...onboardingCompletedTasks],
    [onboardingOpenTasks, onboardingCompletedTasks],
  );
  const onboardingChecklistTotal = onboardingChecklistTasks.length;
  const onboardingChecklistComplete = onboardingCompletedTasks.length;
  const onboardingChecklistProgress = onboardingChecklistTotal
    ? Math.round((onboardingChecklistComplete / onboardingChecklistTotal) * 100)
    : 0;
  const missingDocumentCount = useMemo(
    () => documents.filter((document) => document.status === "missing" || document.status === "access_problem").length,
    [documents],
  );
  const missingAccessCount = useMemo(
    () => accessItems.filter((item) => item.isMissing).length,
    [accessItems],
  );
  const openIssues = useMemo(
    () => issues.filter((issue) => !["resolved", "closed"].includes(issue.status)),
    [issues],
  );
  const overdueIssues = useMemo(
    () => openIssues.filter((issue) => issue.isOverdue),
    [openIssues],
  );
  const availableContactSearchResults = useMemo(
    () => contactSearchResults.filter((contact) => !linkedContacts.some((linked) => linked.id === contact.id)),
    [contactSearchResults, linkedContacts],
  );

  const handleSearchContacts = async () => {
    const search = contactSearch.trim();
    if (!token || !search || !canWriteClientAccounts) return;
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
    if (!token || !account || linkActionContactId || !canWriteClientAccounts) return;
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

  const handleSaveDocument = async (document: ClientAccountDocumentLinkRecord) => {
    if (!token || !account || documentActionType) return;
    const draft = documentDrafts[document.documentType] || { driveUrl: "", displayName: "", notes: "" };
    setDocumentActionType(document.documentType);
    setFilesStatusMessage("");
    try {
      const nextDocuments = await api.clientAccounts.updateDocument(token, account.clinicId, document.documentType, {
        driveUrl: draft.driveUrl,
        displayName: draft.displayName,
        notes: document.documentType === "main_client_folder" ? null : draft.notes,
      });
      setDocuments(nextDocuments);
      setDocumentDrafts(Object.fromEntries(nextDocuments.map((item) => [
        item.documentType,
        { driveUrl: item.driveUrl || "", displayName: item.displayName || "", notes: item.notes || "" },
      ])));
      setFilesStatusMessage(`${document.label} link saved.`);
    } catch (error) {
      setFilesStatusMessage(error instanceof Error ? error.message : "Could not save this document link.");
    } finally {
      setDocumentActionType(null);
    }
  };

  const handleRemoveDocument = async (document: ClientAccountDocumentLinkRecord) => {
    if (!token || !account || documentActionType) return;
    setDocumentActionType(document.documentType);
    setFilesStatusMessage("");
    try {
      const nextDocuments = await api.clientAccounts.updateDocument(token, account.clinicId, document.documentType, {
        driveUrl: null,
        driveItemId: null,
        displayName: null,
        notes: null,
      });
      setDocuments(nextDocuments);
      setDocumentDrafts((current) => ({
        ...current,
        [document.documentType]: { driveUrl: "", displayName: "", notes: "" },
      }));
      setFilesStatusMessage(`${document.label} link removed.`);
    } catch (error) {
      setFilesStatusMessage(error instanceof Error ? error.message : "Could not remove this document link.");
    } finally {
      setDocumentActionType(null);
    }
  };

  const handleUpdateAccessItem = async (
    item: ClientAccountAccessItemRecord,
    status: ClientAccountAccessItemRecord["status"],
    successMessage = `${item.label} status updated.`,
  ) => {
    if (!token || !account || accessActionType) return;
    setAccessActionType(item.itemType);
    setAccessStatusMessage("");
    try {
      const nextAccessItems = await api.clientAccounts.updateAccessItem(token, account.clinicId, item.itemType, {
        status,
        notes: accessDrafts[item.itemType] || "",
      });
      setAccessItems(nextAccessItems);
      setAccessDrafts(Object.fromEntries(nextAccessItems.map((nextItem) => [nextItem.itemType, nextItem.notes || ""])));
      setAccessStatusMessage(successMessage);
    } catch (error) {
      setAccessStatusMessage(error instanceof Error ? error.message : "Could not update this access item.");
    } finally {
      setAccessActionType(null);
    }
  };

  const handleCreateIssue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !account || issueActionId || !canWriteClientAccounts) return;
    if (!issueForm.title.trim()) {
      setIssueStatusMessage("Issue title is required.");
      return;
    }
    setIssueActionId("new");
    setIssueStatusMessage("");
    try {
      const nextIssues = await api.clientAccounts.createIssue(token, account.clinicId, {
        title: issueForm.title.trim(),
        priority: issueForm.priority,
        status: issueForm.status,
        ownerUserId: issueForm.ownerUserId || null,
        dueDate: issueForm.dueDate || null,
        notes: issueForm.notes || null,
        taskId: issueForm.taskId || null,
      });
      setIssues(nextIssues);
      setIssueForm(emptyIssueForm);
      setIssueStatusMessage("Client issue created.");
    } catch (error) {
      setIssueStatusMessage(error instanceof Error ? error.message : "Could not create this issue.");
    } finally {
      setIssueActionId(null);
    }
  };

  const handleUpdateIssueStatus = async (issue: ClientIssueRecord, status: ClientIssueStatus) => {
    if (!token || !account || issueActionId || !canWriteClientAccounts) return;
    setIssueActionId(issue.id);
    setIssueStatusMessage("");
    try {
      const nextIssues = await api.clientAccounts.updateIssue(token, account.clinicId, issue.id, { status });
      setIssues(nextIssues);
      setIssueStatusMessage("Client issue updated.");
    } catch (error) {
      setIssueStatusMessage(error instanceof Error ? error.message : "Could not update this issue.");
    } finally {
      setIssueActionId(null);
    }
  };

  const handleUnlinkContact = async (contactId: string) => {
    if (!token || !account || linkActionContactId || !canWriteClientAccounts) return;
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
    upsellOpportunity: account.upsellOpportunity || account.upsellPrompts[0]?.reason,
  });
  const canEditProfile =
    hasPermission("client_accounts:write") &&
    (session?.clinicId === account.clinicId || hasPermission("sensitive:read"));
  const editProfileHref =
    session?.clinicId === account.clinicId
      ? "/app/ops/client-accounts/package"
      : `/app/ops/client-accounts/package?id=${encodeURIComponent(account.clinicId)}`;
  const selectRecordTab = (tab: ClientAccountRecordTab) => {
    const selectedTab = clientAccountRecordTabs.find((item) => item.id === tab);
    setActiveRecordTab(tab);
    if (selectedTab) {
      window.history.replaceState(null, "", `#${selectedTab.panelId}`);
    }
  };

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
          <Link href={editProfileHref} className="inline-flex items-center gap-2 rounded-full bg-[#5e8a8d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#507b7e]"><Pencil className="h-4 w-4" />Edit account</Link>
        ) : (
          <span className="rounded-full border border-[#d8ddda] px-4 py-2 text-sm font-medium text-[#7A746A]">Read-only account</span>
        )}
      </div>

      <div
        role="tablist"
        aria-label="Client account sections"
        className="flex flex-wrap gap-2 rounded-2xl border border-[#E7E1DA] bg-white p-2"
      >
        {clientAccountRecordTabs.map((tab, index) => {
          const isActive = activeRecordTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`${tab.panelId}-tab`}
              type="button"
              role="tab"
              aria-controls={tab.panelId}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => selectRecordTab(tab.id)}
              onKeyDown={(event) => {
                let nextIndex: number | null = null;
                if (event.key === "ArrowRight") nextIndex = (index + 1) % clientAccountRecordTabs.length;
                if (event.key === "ArrowLeft") nextIndex = (index - 1 + clientAccountRecordTabs.length) % clientAccountRecordTabs.length;
                if (event.key === "Home") nextIndex = 0;
                if (event.key === "End") nextIndex = clientAccountRecordTabs.length - 1;
                if (nextIndex === null) return;

                event.preventDefault();
                const nextTab = clientAccountRecordTabs[nextIndex];
                selectRecordTab(nextTab.id);
                document.getElementById(`${nextTab.panelId}-tab`)?.focus();
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#75aaa7] ${
                isActive
                  ? "bg-[#edf5f3] text-[#315f62]"
                  : "text-[#6F6A66] hover:bg-[#FAF8F5] hover:text-[#315f62]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
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

      {account.upsellPrompts.length > 0 ? (
        <Card padding="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5e8a8d]">
                Internal Upsell Prompt
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[#151f21]">
                {account.upsellPrompts[0].fromPackage} to {account.upsellPrompts[0].toPackage}
              </h2>
              <p className="mt-1 text-sm text-[#7A746A]">
                {account.upsellPrompts[0].reason}
              </p>
            </div>
            <Badge variant={account.upsellPrompts[0].severity === "high" ? "warning" : "info"}>
              Internal only
            </Badge>
          </div>
        </Card>
      ) : null}

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
                [FileCheck2, "Monthly price / MRR", formatMoney(account.monthlyPrice, account.currency)],
                [FileCheck2, "Setup fee", formatMoney(account.setupFee, account.currency)],
                [ShieldCheck, "Recommended next", account.recommendedNextPackage || "Not set"],
                [BriefcaseBusiness, "Upsell opportunity", account.upsellOpportunity || "Not set"],
                [Phone, "Last contact", formatDate(account.lastContactAt)],
                [FileCheck2, "Last report", formatDate(account.lastReportAt)],
                [Gauge, "Last Loom / strategy call", formatDate(account.lastLoomAt || account.lastStrategyLogAt)],
                [Users, "Owner", personName(account)],
                [FileCheck2, "Contract start", formatDate(account.contractStartDate)],
                [FileCheck2, "Renewal date", formatDate(account.renewalDate)],
                [FileCheck2, "Notice date", formatDate(account.noticeDate)],
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#151f21]">Commercial and payment status</h2>
                <p className="mt-1 text-sm text-[#7A746A]">Manual MVP fields for finance visibility until billing integrations are added.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {paymentBadge(account.paymentStatus)}
                <Badge variant={account.invoiceStatus === "paid" ? "success" : account.invoiceStatus === "overdue" ? "error" : "info"}>
                  Invoice: {formatLabel(account.invoiceStatus)}
                </Badge>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4">
                <p className="text-xs font-medium text-[#6F6A66]">Current package</p>
                <p className="mt-2 text-sm font-semibold text-[#151f21]">{account.currentPackage || "Not set"}</p>
              </div>
              <div className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4">
                <p className="text-xs font-medium text-[#6F6A66]">MRR</p>
                <p className="mt-2 text-sm font-semibold text-[#151f21]">{formatMoney(account.monthlyPrice, account.currency)}</p>
              </div>
              <div className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4">
                <p className="text-xs font-medium text-[#6F6A66]">Setup fee</p>
                <p className="mt-2 text-sm font-semibold text-[#151f21]">{formatMoney(account.setupFee, account.currency)}</p>
              </div>
              <div className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4">
                <p className="text-xs font-medium text-[#6F6A66]">Contract status</p>
                <p className="mt-2 text-sm font-semibold text-[#151f21]">{formatLabel(account.contractStatus)}</p>
              </div>
            </div>
            {account.paymentNotes ? (
              <p className="mt-4 rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4 text-sm leading-relaxed text-[#7A746A]">
                {account.paymentNotes}
              </p>
            ) : null}

            <div className="mt-5 rounded-2xl border border-[#E7E1DA] bg-[#FFFCF9] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[#151f21]">
                    <CreditCard className="h-4 w-4 text-[#315f62]" />
                    QuickBooks customer mapping
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[#7A746A]">
                    Link this Mission Control client to a verified QuickBooks customer. Manual invoice and payment fields stay unchanged.
                  </p>
                </div>
                <Badge variant={quickBooksMapping ? "success" : "neutral"}>
                  {quickBooksMapping ? "Mapped" : quickBooksStatus?.connected ? "Ready" : "Connect required"}
                </Badge>
              </div>

              {quickBooksMapping ? (
                <div className="mt-4 rounded-xl border border-[#d8ddda] bg-[#FAF8F5] p-3 text-sm text-[#5e8a8d]">
                  <p className="font-semibold text-[#151f21]">{quickBooksMapping.quickbooksCustomerName}</p>
                  <p className="mt-1 break-all text-xs">
                    ID {quickBooksMapping.quickbooksCustomerId}
                    {quickBooksMapping.quickbooksEmail ? ` - ${quickBooksMapping.quickbooksEmail}` : ""}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                <input
                  value={quickBooksSearch}
                  onChange={(event) => setQuickBooksSearch(event.target.value)}
                  placeholder="Search QuickBooks customers"
                  className="min-h-11 rounded-xl border border-[#d8ddda] bg-white px-3 text-sm outline-none focus:border-[#75aaa7] focus:ring-2 focus:ring-[#d5e8e4]"
                  disabled={!quickBooksStatus?.connected || isQuickBooksBusy}
                />
                <button
                  type="button"
                  onClick={() => void searchQuickBooksCustomers()}
                  disabled={!quickBooksStatus?.connected || isQuickBooksBusy}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d8ddda] bg-white px-4 text-sm font-semibold text-[#315f62] hover:bg-[#edf5f3] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isQuickBooksBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </button>
              </div>

              {quickBooksCustomers.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {quickBooksCustomers.slice(0, 5).map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => selectQuickBooksCustomer(customer)}
                      className="block w-full rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-3 text-left text-sm hover:border-[#b9cfcb] hover:bg-[#edf5f3]"
                    >
                      <span className="block font-semibold text-[#151f21]">{customer.displayName}</span>
                      <span className="mt-1 block text-xs text-[#7A746A]">
                        {customer.companyName || "No company name"} {customer.email ? `- ${customer.email}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  value={quickBooksForm.customerId}
                  onChange={(event) => setQuickBooksForm((current) => ({ ...current, customerId: event.target.value }))}
                  placeholder="QuickBooks customer ID"
                  className="min-h-11 rounded-xl border border-[#d8ddda] bg-white px-3 text-sm outline-none focus:border-[#75aaa7] focus:ring-2 focus:ring-[#d5e8e4]"
                  disabled={!quickBooksStatus?.connected || isQuickBooksBusy}
                />
                <input
                  value={quickBooksForm.customerName}
                  onChange={(event) => setQuickBooksForm((current) => ({ ...current, customerName: event.target.value }))}
                  placeholder="QuickBooks customer name"
                  className="min-h-11 rounded-xl border border-[#d8ddda] bg-white px-3 text-sm outline-none focus:border-[#75aaa7] focus:ring-2 focus:ring-[#d5e8e4]"
                  disabled={!quickBooksStatus?.connected || isQuickBooksBusy}
                />
                <input
                  value={quickBooksForm.companyName}
                  onChange={(event) => setQuickBooksForm((current) => ({ ...current, companyName: event.target.value }))}
                  placeholder="Company name"
                  className="min-h-11 rounded-xl border border-[#d8ddda] bg-white px-3 text-sm outline-none focus:border-[#75aaa7] focus:ring-2 focus:ring-[#d5e8e4]"
                  disabled={!quickBooksStatus?.connected || isQuickBooksBusy}
                />
                <input
                  value={quickBooksForm.email}
                  onChange={(event) => setQuickBooksForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="Billing email"
                  className="min-h-11 rounded-xl border border-[#d8ddda] bg-white px-3 text-sm outline-none focus:border-[#75aaa7] focus:ring-2 focus:ring-[#d5e8e4]"
                  disabled={!quickBooksStatus?.connected || isQuickBooksBusy}
                />
              </div>

              {quickBooksMessage ? (
                <p className="mt-3 rounded-xl border border-[#d8ddda] bg-[#FAF8F5] p-3 text-xs leading-5 text-[#5e8a8d]">
                  {quickBooksMessage}
                </p>
              ) : null}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => void saveQuickBooksMapping()}
                  disabled={!canWriteClientAccounts || !quickBooksStatus?.connected || isQuickBooksBusy || !quickBooksForm.customerId.trim() || !quickBooksForm.customerName.trim()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#315f62] px-4 text-sm font-semibold text-white hover:bg-[#264f51] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isQuickBooksBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Save mapping
                </button>
                {quickBooksMapping ? (
                  <button
                    type="button"
                    onClick={() => void removeQuickBooksMapping()}
                    disabled={!canWriteClientAccounts || isQuickBooksBusy}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Unlink className="h-4 w-4" />
                    Remove mapping
                  </button>
                ) : null}
                <Link
                  href="/app/integrations"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d8ddda] bg-white px-4 text-sm font-semibold text-[#315f62] hover:bg-[#edf5f3]"
                >
                  <ExternalLink className="h-4 w-4" />
                  Manage QuickBooks
                </Link>
              </div>
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-[#151f21]">
                  <FileCheck2 className="h-5 w-5 text-[#315f62]" />
                  Accepted proposals
                </h2>
                <p className="mt-1 text-sm text-[#7A746A]">
                  Locked acceptance evidence connected to this client account.
                </p>
              </div>
              <Badge variant={acceptedProposals.length > 0 ? "success" : "neutral"}>
                {acceptedProposals.length}
              </Badge>
            </div>
            {acceptedProposals.length > 0 ? (
              <div className="mt-5 space-y-3">
                {acceptedProposals.map((proposal) => (
                  <div key={proposal.acceptanceId} className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <Link
                          href={`/app/crm/proposals/preview?id=${encodeURIComponent(proposal.proposalId)}`}
                          className="font-semibold text-[#151f21] hover:text-[#315f62] hover:underline"
                        >
                          {proposal.proposalName}
                        </Link>
                        <p className="mt-1 text-sm text-[#7A746A]">
                          Accepted {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(proposal.acceptedAt))}
                          {proposal.acceptedByName ? ` by ${proposal.acceptedByName}` : ""}
                          {proposal.acceptedByEmail ? ` (${proposal.acceptedByEmail})` : ""}.
                        </p>
                      </div>
                      <Badge variant={proposal.acceptanceStatus === "won" ? "success" : "info"}>
                        {formatLabel(proposal.acceptanceStatus)}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-lg bg-white px-3 py-2">
                        <p className="text-xs font-medium text-[#6F6A66]">Legal company</p>
                        <p className="mt-1 break-words text-sm font-semibold text-[#151f21]">{proposal.legalCompanyName || "Not captured"}</p>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-2">
                        <p className="text-xs font-medium text-[#6F6A66]">Billing email</p>
                        <p className="mt-1 break-all text-sm font-semibold text-[#151f21]">{proposal.billingEmail || "Not captured"}</p>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-2">
                        <p className="text-xs font-medium text-[#6F6A66]">Preferred start</p>
                        <p className="mt-1 text-sm font-semibold text-[#151f21]">{formatDate(proposal.preferredStartDate)}</p>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-2">
                        <p className="text-xs font-medium text-[#6F6A66]">Package</p>
                        <p className="mt-1 text-sm font-semibold text-[#151f21]">{proposal.packageName || "Not set"}</p>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-2">
                        <p className="text-xs font-medium text-[#6F6A66]">Monthly / setup</p>
                        <p className="mt-1 text-sm font-semibold text-[#151f21]">
                          {formatMoneyFromCents(proposal.monthlyFeeCents, proposal.currency)} / {formatMoneyFromCents(proposal.setupFeeCents, proposal.currency)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-2">
                        <p className="text-xs font-medium text-[#6F6A66]">Locked evidence</p>
                        <p className="mt-1 text-sm font-semibold text-[#151f21]">
                          {proposal.evidenceSha256 ? `${proposal.evidenceSha256.slice(0, 12)}...` : "Not captured"}
                        </p>
                      </div>
                    </div>
                    {proposal.lockedAt ? (
                      <p className="mt-3 text-xs font-medium text-[#6F6A66]">
                        Locked {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(proposal.lockedAt))}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-xl border border-dashed border-[#E7E1DA] p-5 text-center text-sm text-[#7A746A]">
                No accepted proposal has been linked to this client account yet.
              </p>
            )}
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
                {canWriteClientAccounts ? (
                  <Link
                    href={`/app/crm/contacts/new?clientId=${encodeURIComponent(account.clinicId)}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#315f62] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#264f51]"
                  >
                    <Plus className="h-4 w-4" />
                    Add contact
                  </Link>
                ) : null}
              </div>
            </div>
            {canWriteClientAccounts ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b9694]" />
                    <input
                      name="contactSearch"
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
              </>
            ) : (
              <p className="mt-4 text-sm text-[#7A746A]">You have read-only access to client contacts.</p>
            )}
            {linkStatusMessage ? <p className="mt-3 text-sm text-[#315f62]">{linkStatusMessage}</p> : null}
            <div className="mt-5 space-y-3">
              {linkedContacts.map((contact) => (
                <div key={contact.id} className="group relative rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4 transition hover:border-[#a9c7c4] hover:bg-[#f5f8f6] focus-within:border-[#75aaa7] focus-within:ring-4 focus-within:ring-[rgba(96,180,175,0.1)]">
                  <Link href={`/app/crm/contacts/detail?id=${contact.id}`} aria-label={`Open contact ${contact.name}`} className="absolute inset-0 z-0 rounded-xl focus:outline-none">
                    <span className="sr-only">Open {contact.name}</span>
                  </Link>
                  <div className="pointer-events-none relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#151f21] transition group-hover:text-[#315f62]">{contact.name}</p>
                      <p className="mt-0.5 text-sm text-[#7A746A]">{contact.roleTitle || contact.role || "Role not set"}</p>
                      {(contact.email || contact.phone) && <div className="pointer-events-auto mt-3 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        {contact.email && <a href={`mailto:${contact.email}`} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-[#315f62] shadow-sm ring-1 ring-[#d8ddda] transition hover:bg-[#edf5f3] focus:outline-none focus:ring-2 focus:ring-[#60B4AF]"><Mail className="h-4 w-4 shrink-0" /><span className="break-all text-left">{contact.email}</span></a>}
                        {contact.phone && <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-[#315f62] shadow-sm ring-1 ring-[#d8ddda] transition hover:bg-[#edf5f3] focus:outline-none focus:ring-2 focus:ring-[#60B4AF]"><Phone className="h-4 w-4 shrink-0" />{contact.phone}</a>}
                      </div>}
                    </div>
                  <div className="pointer-events-auto flex shrink-0 gap-2">
                    <Link href={`/app/crm/contacts/detail?id=${contact.id}`} className="inline-flex items-center gap-2 rounded-lg border border-[#d8ddda] bg-white px-3 py-2 text-sm font-semibold text-[#315f62] hover:bg-[#edf5f3]">
                      Open<ExternalLink className="h-4 w-4" />
                    </Link>
                    {canWriteClientAccounts ? (
                      <button type="button" onClick={() => void handleUnlinkContact(contact.id)} disabled={linkActionContactId === contact.id} className="inline-flex items-center gap-2 rounded-lg border border-[#ead4cb] bg-white px-3 py-2 text-sm font-semibold text-[#9a5524] hover:bg-[#fff4f0] disabled:opacity-60">
                        {linkActionContactId === contact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                        Unlink
                      </button>
                    ) : null}
                  </div>
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

          {activeRecordTab === "issues" ? (
          <div
            id="account-issues"
            role="tabpanel"
            aria-labelledby="account-issues-tab"
            tabIndex={0}
            className="scroll-mt-24"
          >
          <Card padding="p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-[#151f21]">
                  <LifeBuoy className="h-5 w-5 text-[#315f62]" />
                  Issues/Support
                </h2>
                <p className="mt-1 text-sm text-[#7A746A]">Track important client problems before they disappear into chat or email.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={overdueIssues.length > 0 ? "error" : "success"}>{overdueIssues.length} overdue</Badge>
                <Badge variant={openIssues.length > 0 ? "warning" : "success"}>{openIssues.length} open</Badge>
              </div>
            </div>

            {issueStatusMessage ? (
              <p
                role="status"
                aria-live="polite"
                className="mt-4 rounded-xl border border-[#d8ddda] bg-[#FAF8F5] px-4 py-3 text-sm font-medium text-[#315f62]"
              >
                {issueStatusMessage}
              </p>
            ) : null}

            {canWriteClientAccounts ? (
            <form onSubmit={handleCreateIssue} className="mt-5 rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-semibold text-[#344446]">Issue title</span>
                  <input
                    name="issueTitle"
                    required
                    value={issueForm.title}
                    onChange={(event) => setIssueForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="e.g. Ads tracking dropped after website update"
                    className="min-h-10 rounded-lg border border-[#d8ddda] bg-white px-3 text-sm outline-none focus:border-[#75aaa7] focus:ring-2 focus:ring-[#d5e8e4] w-full"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-[#344446]">Priority</span>
                  <select name="issuePriority" value={issueForm.priority} onChange={(event) => setIssueForm((current) => ({ ...current, priority: event.target.value as ClientIssuePriority }))} className="min-h-10 rounded-lg border border-[#d8ddda] bg-white px-3 text-sm outline-none focus:border-[#75aaa7] focus:ring-2 focus:ring-[#d5e8e4] w-full">
                    {ISSUE_PRIORITIES.map((priority) => <option key={priority} value={priority}>{formatLabel(priority)}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-[#344446]">Status</span>
                  <select name="issueStatus" value={issueForm.status} onChange={(event) => setIssueForm((current) => ({ ...current, status: event.target.value as ClientIssueStatus }))} className="min-h-10 rounded-lg border border-[#d8ddda] bg-white px-3 text-sm outline-none focus:border-[#75aaa7] focus:ring-2 focus:ring-[#d5e8e4] w-full">
                    {ISSUE_STATUSES.map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-[#344446]">Owner</span>
                  <select
                    name="issueOwnerUserId"
                    value={issueForm.ownerUserId}
                    onChange={(event) => setIssueForm((current) => ({ ...current, ownerUserId: event.target.value }))}
                    disabled={!canAssignIssueOwners}
                    className="min-h-10 w-full rounded-lg border border-[#d8ddda] bg-white px-3 text-sm outline-none focus:border-[#75aaa7] focus:ring-2 focus:ring-[#d5e8e4] disabled:cursor-not-allowed disabled:bg-[#f1efeb] disabled:text-[#7A746A]"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((member) => (
                      <option key={member.id} value={member.id}>{[member.firstName, member.lastName].filter(Boolean).join(" ") || member.email}</option>
                    ))}
                  </select>
                  {!canAssignIssueOwners ? (
                    <span className="block text-xs text-[#7A746A]">Admin access is required to assign an issue owner.</span>
                  ) : null}
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-[#344446]">Due date</span>
                  <input name="issueDueDate" type="date" value={issueForm.dueDate} onChange={(event) => setIssueForm((current) => ({ ...current, dueDate: event.target.value }))} className="min-h-10 rounded-lg border border-[#d8ddda] bg-white px-3 text-sm outline-none focus:border-[#75aaa7] focus:ring-2 focus:ring-[#d5e8e4] w-full" />
                </label>
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-semibold text-[#344446]">Linked task</span>
                  <select name="issueTaskId" value={issueForm.taskId} onChange={(event) => setIssueForm((current) => ({ ...current, taskId: event.target.value }))} className="min-h-10 rounded-lg border border-[#d8ddda] bg-white px-3 text-sm outline-none focus:border-[#75aaa7] focus:ring-2 focus:ring-[#d5e8e4] w-full">
                    <option value="">No linked task</option>
                    {openTasks.map((task) => (
                      <option key={task.id} value={task.id}>{task.title}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-semibold text-[#344446]">Notes</span>
                  <textarea name="issueNotes" value={issueForm.notes} onChange={(event) => setIssueForm((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder="What happened, where it was reported, and what needs to happen next..." className="rounded-lg border border-[#d8ddda] bg-white px-3 py-2 text-sm outline-none focus:border-[#75aaa7] focus:ring-2 focus:ring-[#d5e8e4] w-full" />
                </label>
              </div>
              <button type="submit" disabled={issueActionId === "new"} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#315f62] px-4 text-sm font-semibold text-white hover:bg-[#264f51] disabled:opacity-60">
                {issueActionId === "new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create issue
              </button>
            </form>
            ) : (
              <p className="mt-5 rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4 text-sm text-[#7A746A]">
                You have read-only access to client issues.
              </p>
            )}

            <div className="mt-5 grid gap-3">
              {issues.map((issue) => (
                <div key={issue.id} className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-[#151f21]">{issue.title}</h3>
                      <p className="mt-1 text-sm text-[#7A746A]">{issue.notes || "No notes added."}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#7A746A]">
                        <span>Owner: {issue.owner ? [issue.owner.firstName, issue.owner.lastName].filter(Boolean).join(" ") || issue.owner.email : "Unassigned"}</span>
                        <span>Due: {formatDate(issue.dueDate)}</span>
                        {issue.task ? (
                          <Link href={`/app/crm/tasks/detail?id=${issue.task.id}&from=delivery`} className="font-semibold text-[#315f62] hover:underline">
                            Task: {issue.task.title}
                          </Link>
                        ) : <span>No linked task</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Badge variant={issue.priority === "critical" || issue.priority === "high" ? "error" : issue.priority === "medium" ? "warning" : "neutral"}>{formatLabel(issue.priority)}</Badge>
                      <Badge variant={issue.status === "resolved" || issue.status === "closed" ? "success" : issue.isOverdue ? "error" : "warning"}>{formatLabel(issue.status)}</Badge>
                    </div>
                  </div>
                  {canWriteClientAccounts ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["open", "in_progress", "waiting", "resolved"] as ClientIssueStatus[]).map((status) => (
                      <button key={status} type="button" onClick={() => void handleUpdateIssueStatus(issue, status)} disabled={issueActionId === issue.id || issue.status === status} className="inline-flex min-h-9 items-center rounded-lg border border-[#d8ddda] bg-white px-3 text-xs font-semibold text-[#315f62] hover:bg-[#edf5f3] disabled:opacity-60">
                        {formatLabel(status)}
                      </button>
                    ))}
                  </div>
                  ) : null}
                </div>
              ))}
              {issues.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#E7E1DA] p-5 text-center text-sm text-[#7A746A]">No client issues are currently tracked.</p>
              ) : null}
            </div>
          </Card>
          </div>
          ) : null}

          {activeRecordTab === "files" ? (
          <div
            id="account-files"
            role="tabpanel"
            aria-labelledby="account-files-tab"
            tabIndex={0}
            className="scroll-mt-24"
          >
          <Card padding="p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-[#151f21]">
                  <FolderOpen className="h-5 w-5 text-[#315f62]" />
                  Files/Documents
                </h2>
                <p className="mt-1 text-sm text-[#7A746A]">Google Drive links for the folders and documents this client needs.</p>
              </div>
              <Badge variant={missingDocumentCount > 0 ? "warning" : "success"}>
                {missingDocumentCount} missing
              </Badge>
            </div>
            {filesStatusMessage ? <p className="mt-4 rounded-xl border border-[#d8ddda] bg-[#FAF8F5] px-4 py-3 text-sm font-medium text-[#315f62]">{filesStatusMessage}</p> : null}
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {documents.map((document) => {
                const draft = documentDrafts[document.documentType] || { driveUrl: "", displayName: "", notes: "" };
                const isBusy = documentActionType === document.documentType;
                const canEditDocument =
                  canWriteClientAccounts &&
                  (document.documentType !== "main_client_folder" || canConfigureDrive);
                const badgeVariant = document.status === "linked" ? "success" : document.status === "access_problem" ? "error" : "warning";
                return (
                  <div key={document.documentType} className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-[#151f21]">{document.label}</h3>
                        <p className="mt-1 truncate text-sm text-[#7A746A]">{document.displayName || document.driveUrl || "No link saved"}</p>
                      </div>
                      <Badge variant={badgeVariant}>{formatLabel(document.status)}</Badge>
                    </div>
                    {document.driveUrl ? (
                      <a href={document.driveUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#315f62] hover:underline">
                        Open link<ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                    {document.accessError ? <p className="mt-2 text-xs font-medium text-[#B42318]">{document.accessError}</p> : null}
                    <div className="mt-4 grid gap-2">
                      <input
                        value={draft.driveUrl}
                        onChange={(event) => setDocumentDrafts((current) => ({ ...current, [document.documentType]: { ...draft, driveUrl: event.target.value } }))}
                        disabled={!canEditDocument}
                        placeholder={document.documentType === "main_client_folder"
                          ? "Google Drive folder URL/ID"
                          : "Google Drive folder or file URL/ID"}
                        className="min-h-10 rounded-lg border border-[#d8ddda] bg-white px-3 text-sm outline-none focus:border-[#75aaa7] focus:ring-2 focus:ring-[#d5e8e4] disabled:cursor-not-allowed disabled:bg-[#f1efeb] disabled:text-[#7A746A]"
                      />
                      <input
                        value={draft.displayName}
                        onChange={(event) => setDocumentDrafts((current) => ({ ...current, [document.documentType]: { ...draft, displayName: event.target.value } }))}
                        disabled={!canEditDocument}
                        placeholder="Display title"
                        className="min-h-10 rounded-lg border border-[#d8ddda] bg-white px-3 text-sm outline-none focus:border-[#75aaa7] focus:ring-2 focus:ring-[#d5e8e4] disabled:cursor-not-allowed disabled:bg-[#f1efeb] disabled:text-[#7A746A]"
                      />
                      {document.documentType !== "main_client_folder" ? (
                        <textarea
                          value={draft.notes}
                          onChange={(event) => setDocumentDrafts((current) => ({ ...current, [document.documentType]: { ...draft, notes: event.target.value } }))}
                          disabled={!canEditDocument}
                          placeholder="Notes"
                          rows={2}
                          maxLength={2000}
                          className="rounded-lg border border-[#d8ddda] bg-white px-3 py-2 text-sm outline-none focus:border-[#75aaa7] focus:ring-2 focus:ring-[#d5e8e4] disabled:cursor-not-allowed disabled:bg-[#f1efeb] disabled:text-[#7A746A]"
                        />
                      ) : null}
                    </div>
                    {!canEditDocument ? (
                      <p className="mt-3 text-xs text-[#7A746A]">
                        {document.documentType === "main_client_folder" && canWriteClientAccounts
                          ? "Only an Admin can change the main client folder."
                          : "You have read-only access to client documents."}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => void handleSaveDocument(document)} disabled={!canEditDocument || isBusy || !draft.driveUrl.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#315f62] px-3 text-sm font-semibold text-white hover:bg-[#264f51] disabled:opacity-60">
                        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Save link
                      </button>
                      <button type="button" onClick={() => void handleRemoveDocument(document)} disabled={!canEditDocument || isBusy || !document.driveUrl} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#ead4cb] bg-white px-3 text-sm font-semibold text-[#9a5524] hover:bg-[#fff4f0] disabled:opacity-60">
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          </div>
          ) : null}

          {activeRecordTab === "access" ? (
          <div
            id="account-access-assets"
            role="tabpanel"
            aria-labelledby="account-access-assets-tab"
            tabIndex={0}
            className="scroll-mt-24"
          >
          <Card padding="p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-[#151f21]">
                  <ShieldCheck className="h-5 w-5 text-[#315f62]" />
                  Access/assets
                </h2>
                <p className="mt-1 text-sm text-[#7A746A]">Track what is still requested before onboarding can move cleanly.</p>
              </div>
              <Badge variant={missingAccessCount > 0 ? "warning" : "success"}>{missingAccessCount} requested</Badge>
            </div>
            {accessStatusMessage ? (
              <p className="mt-4 rounded-xl border border-[#d8ddda] bg-[#FAF8F5] px-4 py-3 text-sm font-medium text-[#315f62]">
                {accessStatusMessage}
              </p>
            ) : null}
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {accessItems.map((item) => {
                const isBusy = accessActionType === item.itemType;
                return (
                  <div key={item.itemType} className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-[#151f21]">{item.label}</h3>
                      <Badge variant={item.status === "received" ? "success" : item.status === "not_needed" ? "neutral" : "warning"}>{formatLabel(item.status)}</Badge>
                    </div>
                    <textarea
                      value={accessDrafts[item.itemType] || ""}
                      onChange={(event) => setAccessDrafts((current) => ({ ...current, [item.itemType]: event.target.value }))}
                      disabled={!canWriteClientAccounts}
                      placeholder="Access notes"
                      rows={2}
                      maxLength={2000}
                      className="mt-3 w-full rounded-lg border border-[#d8ddda] bg-white px-3 py-2 text-sm outline-none focus:border-[#75aaa7] focus:ring-2 focus:ring-[#d5e8e4] disabled:cursor-not-allowed disabled:bg-[#f1efeb] disabled:text-[#7A746A]"
                    />
                    <button
                      type="button"
                      onClick={() => void handleUpdateAccessItem(item, item.status, `${item.label} notes saved.`)}
                      disabled={
                        !canWriteClientAccounts ||
                        isBusy ||
                        (accessDrafts[item.itemType] || "").trim() === (item.notes || "").trim()
                      }
                      className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg bg-[#315f62] px-3 text-sm font-semibold text-white hover:bg-[#264f51] disabled:opacity-60"
                    >
                      {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save notes
                    </button>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {(["requested", "received", "not_needed"] as const).map((status) => (
                        <button key={status} type="button" onClick={() => void handleUpdateAccessItem(item, status)} disabled={!canWriteClientAccounts || isBusy || item.status === status} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#d8ddda] bg-white px-3 text-sm font-semibold text-[#315f62] hover:bg-[#edf5f3] disabled:opacity-60">
                          {formatLabel(status)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          </div>
          ) : null}

          {activeRecordTab === "onboarding" ? (
          <div
            id="account-onboarding"
            role="tabpanel"
            aria-labelledby="account-onboarding-tab"
            tabIndex={0}
            className="scroll-mt-24"
          >
          <Card padding="p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-[#151f21]">
                  <CheckSquare2 className="h-5 w-5 text-[#315f62]" />
                  Onboarding checklist
                </h2>
                <p className="mt-1 text-sm text-[#7A746A]">
                  Setup actions created automatically when a won opportunity becomes a client.
                </p>
              </div>
              <Badge variant={onboardingChecklistProgress === 100 ? "success" : "info"}>
                {onboardingChecklistComplete}/{onboardingChecklistTotal} complete
              </Badge>
            </div>
            {onboardingChecklistTotal > 0 ? (
              <>
                <div className="mt-5">
                  <ProgressBar value={onboardingChecklistProgress} max={100} color="sage" height="h-2" />
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {onboardingChecklistTasks.map((task) => (
                    <Link key={task.id} href={`/app/crm/tasks/detail?id=${task.id}&from=delivery`} className="block rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4 transition hover:border-[#a9c7c4] focus:outline-none focus:ring-2 focus:ring-[#75aaa7]">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 font-semibold text-[#151f21]">{task.title}</p>
                        <Badge variant={task.status === "completed" ? "success" : task.isOverdue ? "error" : "warning"}>
                          {formatLabel(task.status)}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-[#7A746A]">
                        {task.assignedTo || "Unassigned"} - {taskDueLabel(task)}
                      </p>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-5 rounded-xl border border-dashed border-[#E7E1DA] p-5 text-center text-sm text-[#7A746A]">
                No onboarding checklist has been created yet. Converting a won opportunity into a client will create it automatically.
              </p>
            )}
          </Card>
          </div>
          ) : null}

          {activeRecordTab === "tasks" ? (
          <div
            id="account-tasks"
            role="tabpanel"
            aria-labelledby="account-tasks-tab"
            tabIndex={0}
            className="scroll-mt-24"
          >
          <Card padding="p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#151f21]">Client tasks</h2>
                <p className="mt-1 text-sm text-[#7A746A]">Open and completed internal delivery work linked to this account.</p>
              </div>
              {account.id && canWriteInternalTasks ? (
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
          ) : null}

          {activeRecordTab === "meetings" ? (
          <div
            id="account-meetings"
            role="tabpanel"
            aria-labelledby="account-meetings-tab"
            tabIndex={0}
            className="scroll-mt-24"
          >
            <RecordMeetingsPanel clientAccountProfileId={account.id} />
          </div>
          ) : null}
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
                [LifeBuoy, "Issues/Support", "#account-issues"],
                [FolderOpen, "Files/Documents", "#account-files"],
                [ShieldCheck, "Access/assets", "#account-access-assets"],
                [NotebookText, "Notes", "#account-notes"],
                [CheckSquare2, "Tasks", "#account-tasks"],
                [CalendarClock, "Meetings", "#account-meetings"],
                [ShieldCheck, "Audits", `/app/admin?clinicId=${account.clinicId}`],
                [FileCheck2, "Proposals", `/app/crm/pipeline?account=${encodeURIComponent(account.clinicName)}&view=proposals`],
              ].map(([Icon, label, href]) => {
                const RecordIcon = Icon as typeof Users;
                const targetTab = clientAccountRecordTabs.find((tab) => `#${tab.panelId}` === href);
                return <Link key={String(label)} href={String(href)} onClick={() => { if (targetTab) setActiveRecordTab(targetTab.id); }} className="flex items-center justify-between rounded-xl bg-[#FAF8F5] px-4 py-3 text-sm font-semibold text-[#315f62] hover:bg-[#edf5f3]"><span className="flex items-center gap-2"><RecordIcon className="h-4 w-4" />{String(label)}</span><ExternalLink className="h-4 w-4" /></Link>;
              })}
            </div>
          </Card>
          <div id="account-notes"><Card padding="p-5"><h2 className="font-semibold text-[#151f21]">Account notes</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#7A746A]">{account.keyNotes || "No account notes recorded."}</p></Card></div>
        </aside>
      </div>
    </div>
  );
}
