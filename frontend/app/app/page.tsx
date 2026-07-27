"use client";

import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarClock,
  CheckSquare,
  CircleCheckBig,
  CircleX,
  ClipboardList,
  Plus,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertBanner,
  PageHeader,
  SkeletonLine,
  StatCard,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  getDashboardTaskDetailHref,
  getDashboardKpiCards,
  hasActionableSyncedProposalFollowUpTask,
  isDashboardActiveProjectStatus,
  isDashboardNewProspect,
  isDashboardUpcomingTask,
} from "@/lib/dashboard-cards";
import {
  getClientNextBestAction,
  getLeadNextBestAction,
  nextBestActionBadgeClass,
  type NextBestActionResult,
} from "@/lib/next-best-action";
import {
  calculateLeadPriority,
  leadPriorityBadgeClass,
} from "@/lib/lead-priority";
import {
  DASHBOARD_DUE_TASKS_HREF,
  getClientAccountDrilldownHref,
  isOpenClientAccount,
  isTaskDueByToday,
} from "@/lib/operations-drilldowns";
import { DashboardKpiCardLink } from "@/components/dashboard-kpi-card-link";
import type {
  ClientAccountServiceRecord,
  ClientAccountSummaryRecord,
  ContactRecord,
  InternalTaskRecord,
  PipelineDealRecord,
  PipelineStageRecord,
  ProposalRecord,
} from "@/lib/api-types";

type DeadlineRow = {
  id: string;
  title: string;
  owner: string;
  date: string | null;
  href: string;
  type: "Task" | "Service" | "Proposal";
};

type DashboardActionRow = {
  id: string;
  title: string;
  owner: string;
  action: NextBestActionResult;
  href: string;
  sort: number;
};

type LeadAttentionRow = {
  id: string;
  title: string;
  meta: string;
  detail: string;
  href: string;
  badge: string;
  badgeClass: string;
  sort: number;
};

type ClientBlockerRow = {
  id: string;
  title: string;
  owner: string;
  detail: string;
  href: string;
  severity: "high" | "medium";
  sort: number;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysFromToday(value?: string | null) {
  const date = parseDate(value);
  if (!date) return null;
  return Math.ceil(
    (startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86400000,
  );
}

function formatDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return "No date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isNewLead(deal: PipelineDealRecord) {
  return isDashboardNewProspect({
    status: deal.status,
    stageKind: deal.stageKind,
    stageName: deal.stageName,
    createdAt: deal.createdAt,
  });
}

function isActiveProject(service: ClientAccountServiceRecord) {
  return isDashboardActiveProjectStatus(service.status);
}

function isTaskOverdue(task: InternalTaskRecord) {
  if (task.status === "completed") return false;
  if (task.isOverdue) return true;
  const days = daysFromToday(task.dueDate);
  return days !== null && days < 0;
}

function isUpcomingService(service: ClientAccountServiceRecord) {
  if (!isActiveProject(service)) return false;
  const days = daysFromToday(service.renewalDate);
  return days !== null && days >= 0 && days <= 30;
}

function isActionableProposalFollowUp(proposal: ProposalRecord) {
  if (!proposal.followUpAt) return false;
  if (["accepted", "won", "lost", "expired", "archived"].includes(proposal.status)) return false;
  const days = daysFromToday(proposal.followUpAt);
  return days !== null && days <= 14;
}

function isAuditInProgress(status?: string | null) {
  return Boolean(status) && !["audit_completed", "audit_sent"].includes(status || "");
}

function isAuditCompleted(status?: string | null) {
  return status === "audit_completed" || status === "audit_sent";
}

function isAuditDue(status?: string | null, dueAt?: string | null) {
  const days = daysFromToday(dueAt);
  return status === "follow_up_due" || (days !== null && days <= 0 && !isAuditCompleted(status));
}

function isLeadContact(contact: ContactRecord) {
  const status = `${contact.status || ""} ${contact.leadStatus || ""}`.toLowerCase();
  return ["lead", "prospect", "new", "contacted", "proposal", "audit", "discovery"].some((term) => status.includes(term));
}

function isLeadNotContacted(contact: ContactRecord) {
  return isLeadContact(contact) && !contact.lastContactAt && contact.contactAttemptCount === 0;
}

function isLeadFollowUpDue(contact: ContactRecord) {
  if (!isLeadContact(contact)) return false;
  const days = daysFromToday(contact.nextFollowUpAt);
  return days !== null && days <= 0;
}

function contactTitle(contact: ContactRecord) {
  return contact.accountName || contact.name || contact.email || contact.phone || "Untitled lead";
}

function actionUrgencySort(action: NextBestActionResult) {
  if (action.urgency === "high") return 0;
  if (action.urgency === "medium") return 1;
  return 2;
}

export default function AppPage() {
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const dashboardCardRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [activeDashboardCardIndex, setActiveDashboardCardIndex] = useState(0);
  const [deals, setDeals] = useState<PipelineDealRecord[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [stages, setStages] = useState<PipelineStageRecord[]>([]);
  const [clientAccounts, setClientAccounts] = useState<ClientAccountSummaryRecord[]>([]);
  const [services, setServices] = useState<ClientAccountServiceRecord[]>([]);
  const [tasks, setTasks] = useState<InternalTaskRecord[]>([]);
  const [proposals, setProposals] = useState<ProposalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!token) return;

    let isMounted = true;

    Promise.allSettled([
      api.pipelineDeals.list(token),
      api.contacts.list(token, { page: 1, pageSize: 250 }),
      api.pipelineStages.list(token),
      api.clientAccounts.list(token),
      api.clientAccounts.listServices(token, { includeArchived: false }),
      api.internalTasks.list(token, { includeArchived: false }),
      api.proposals.list(token, { includeArchived: false, limit: 250 }),
    ])
      .then(([dealResult, contactResult, stageResult, accountResult, serviceResult, taskResult, proposalResult]) => {
        if (!isMounted) return;

        setDeals(dealResult.status === "fulfilled" ? dealResult.value.deals : []);
        setContacts(contactResult.status === "fulfilled" ? contactResult.value.contacts : []);
        setStages(stageResult.status === "fulfilled" ? stageResult.value : []);
        setClientAccounts(
          accountResult.status === "fulfilled" ? accountResult.value : [],
        );
        setServices(serviceResult.status === "fulfilled" ? serviceResult.value : []);
        setTasks(taskResult.status === "fulfilled" ? taskResult.value : []);
        setProposals(proposalResult.status === "fulfilled" ? proposalResult.value : []);

        const failedSources = [
          dealResult.status === "rejected" ? "sales pipeline" : "",
          contactResult.status === "rejected" ? "prospects" : "",
          stageResult.status === "rejected" ? "pipeline stages" : "",
          accountResult.status === "rejected" ? "client accounts" : "",
          serviceResult.status === "rejected" ? "active projects" : "",
          taskResult.status === "rejected" ? "internal tasks" : "",
          proposalResult.status === "rejected" ? "proposal follow-ups" : "",
        ].filter(Boolean);

        setLoadError(
          failedSources.length
            ? `Some operations data could not be loaded: ${failedSources.join(", ")}.`
            : "",
        );
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const clientNameByProfileId = useMemo(() => {
    return new Map(
      clientAccounts
        .filter((account) => account.id)
        .map((account) => [account.id as string, account.clinicName]),
    );
  }, [clientAccounts]);

  const clientAccountByProfileId = useMemo(() => {
    return new Map(
      clientAccounts
        .filter((account) => account.id)
        .map((account) => [account.id as string, account]),
    );
  }, [clientAccounts]);

  const openClientAccounts = useMemo(
    () => clientAccounts.filter(isOpenClientAccount),
    [clientAccounts],
  );

  const metrics = useMemo(() => {
    const wonDeals = deals.filter(
      (deal) => deal.status === "won" || deal.stageKind === "won",
    );
    const lostDeals = deals.filter(
      (deal) => deal.status === "lost" || deal.stageKind === "lost",
    );

    const auditItemsByContact = new Map<string, { status: string | null; dueAt: string | null }>();
    contacts.forEach((contact) => {
      auditItemsByContact.set(contact.id, {
        status: contact.auditStatus,
        dueAt: contact.auditFollowUpDueAt,
      });
    });
    deals.forEach((deal) => {
      if (!deal.contactId || auditItemsByContact.has(deal.contactId)) return;
      auditItemsByContact.set(deal.contactId, {
        status: deal.auditStatus,
        dueAt: deal.auditFollowUpDueAt,
      });
    });
    const auditItems = [...auditItemsByContact.values()].filter((item) => item.status || item.dueAt);

    return {
      newLeads: deals.filter(isNewLead),
      wonDeals,
      lostDeals,
      openClients: openClientAccounts,
      activeProjects: services.filter(isActiveProject),
      overdueTasks: tasks.filter(isTaskOverdue),
      tasksDue: tasks.filter((task) => isTaskDueByToday(task)),
      auditsDue: auditItems.filter((item) => isAuditDue(item.status, item.dueAt)),
      auditsInProgress: auditItems.filter((item) => isAuditInProgress(item.status)),
      auditsCompleted: auditItems.filter((item) => isAuditCompleted(item.status)),
    };
  }, [contacts, deals, openClientAccounts, services, tasks]);

  const leadAttentionRows = useMemo(() => {
    const contactRows = contacts
      .filter(isLeadContact)
      .map<LeadAttentionRow>((contact) => {
        const followUpDays = daysFromToday(contact.nextFollowUpAt);
        const priority = calculateLeadPriority({
          accountName: contact.accountName || contact.name,
          auditOverdue: isAuditDue(contact.auditStatus, contact.auditFollowUpDueAt),
          auditStatus: contact.auditStatus,
          attemptCount: contact.contactAttemptCount,
          ctaClicked: contact.ctaClicked,
          followUpOverdue: followUpDays !== null && followUpDays < 0,
          formSubmitted: contact.formSubmitted,
          landingPage: contact.landingPage,
          lastContactAt: contact.lastContactAt,
          packageInterest: contact.packageInterest,
          recommendedPackage: contact.recommendedPackage,
          source: contact.source,
          stage: contact.leadStatus || contact.status,
          status: isLeadNotContacted(contact)
            ? "uncontacted"
            : followUpDays !== null && followUpDays < 0
              ? "overdue"
              : "ok",
          tags: contact.tags,
        });
        const signals = [
          isLeadNotContacted(contact) ? "Not contacted" : null,
          followUpDays !== null && followUpDays <= 0 ? "Follow-up due" : null,
          contact.auditStatus ? formatLabel(contact.auditStatus) : null,
        ].filter(Boolean);
        return {
          id: `contact-${contact.id}`,
          title: contactTitle(contact),
          meta: [contact.source || "Lead", contact.packageInterest || contact.recommendedPackage].filter(Boolean).join(" - "),
          detail: signals.length ? signals.join(" - ") : priority.reasons.slice(0, 2).join(" - "),
          href: `/app/crm/contacts/detail?id=${encodeURIComponent(contact.id)}&from=dashboard`,
          badge: `${priority.label} ${priority.score}`,
          badgeClass: leadPriorityBadgeClass(priority.tier),
          sort: priority.tier === "hot" ? 0 : priority.tier === "warm" ? 1 : 2,
        };
      });

    const dealRows = deals
      .filter((deal) => deal.status === "open" && !contacts.some((contact) => contact.id === deal.contactId))
      .map<LeadAttentionRow>((deal) => {
        const followUpDays = daysFromToday(deal.nextFollowUpDate || deal.expectedCloseDate);
        const priority = calculateLeadPriority({
          accountName: deal.contactName || deal.title,
          auditOverdue: isAuditDue(deal.auditStatus, deal.auditFollowUpDueAt),
          auditStatus: deal.auditStatus,
          followUpOverdue: followUpDays !== null && followUpDays < 0,
          packageInterest: deal.treatment,
          source: deal.source,
          stage: deal.stageName,
          status: followUpDays !== null && followUpDays < 0 ? "overdue" : "uncontacted",
        });
        return {
          id: `deal-${deal.id}`,
          title: deal.contactName || deal.title,
          meta: [deal.ownerName || "Unassigned", deal.treatment].filter(Boolean).join(" - "),
          detail: followUpDays !== null && followUpDays <= 0
            ? `Follow-up due ${formatDate(deal.nextFollowUpDate || deal.expectedCloseDate)}`
            : priority.reasons.slice(0, 2).join(" - "),
          href: deal.contactId
            ? `/app/crm/contacts/detail?id=${encodeURIComponent(deal.contactId)}&from=dashboard`
            : `/app/crm/pipeline?deal=${encodeURIComponent(deal.id)}&from=dashboard`,
          badge: `${priority.label} ${priority.score}`,
          badgeClass: leadPriorityBadgeClass(priority.tier),
          sort: priority.tier === "hot" ? 0 : priority.tier === "warm" ? 1 : 2,
        };
      });

    return [...contactRows, ...dealRows]
      .filter((row) => row.sort < 2 || row.detail.includes("Not contacted") || row.detail.includes("Follow-up due"))
      .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title));
  }, [contacts, deals]);

  const leadAttentionCounts = useMemo(() => {
    const leadContacts = contacts.filter(isLeadContact);
    const notContacted = leadContacts.filter(isLeadNotContacted);
    const followUpsDue = leadContacts.filter(isLeadFollowUpDue);
    const hotLeads = leadAttentionRows.filter((row) => row.badge.startsWith("Hot"));
    return {
      newLeads: metrics.newLeads.length,
      notContacted: notContacted.length,
      hotLeads: hotLeads.length,
      followUpsDue: followUpsDue.length,
    };
  }, [contacts, leadAttentionRows, metrics.newLeads.length]);

  const clientBlockerRows = useMemo<ClientBlockerRow[]>(() => {
    return openClientAccounts
      .map((account) => {
        const missingAccess = account.missingAccessCount || 0;
        const missingDocuments = account.missingDocumentCount || 0;
        const openIssues = account.openIssueCount || 0;
        const onboardingOpen = account.onboardingStatus !== "completed";
        const hasBlocker = onboardingOpen || missingAccess > 0 || missingDocuments > 0 || openIssues > 0;
        if (!hasBlocker) return null;
      const detail = [
          onboardingOpen ? `Onboarding ${formatLabel(account.onboardingStatus)}` : null,
          missingAccess > 0 ? `${missingAccess} missing access` : null,
          missingDocuments > 0 ? `${missingDocuments} missing file link${missingDocuments === 1 ? "" : "s"}` : null,
          openIssues > 0 ? `${openIssues} open issue${openIssues === 1 ? "" : "s"}` : null,
        ].filter(Boolean).join(" - ");

        return {
          id: account.clinicId,
          title: account.clinicName,
          owner: account.accountManager
            ? [account.accountManager.firstName, account.accountManager.lastName].filter(Boolean).join(" ") || account.accountManager.email || "Unassigned"
            : "Unassigned",
          detail,
          href: `/app/ops/client-accounts/detail?id=${encodeURIComponent(account.clinicId)}#account-access-assets`,
          severity: account.overdueIssueCount > 0 || missingAccess > 0 || missingDocuments > 0 ? "high" : "medium",
          sort: (account.overdueIssueCount || 0) > 0 ? 0 : missingAccess + missingDocuments > 0 ? 1 : 2,
        };
      })
      .filter((row): row is ClientBlockerRow => Boolean(row))
      .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title))
      .slice(0, 8);
  }, [openClientAccounts]);

  const stageRows = useMemo(() => {
    const rows = stages
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((stage) => {
        const stageDeals = deals.filter(
          (deal) =>
            deal.stageId === stage.id ||
            (deal.stageName || "").toLowerCase() === stage.name.toLowerCase(),
        );

        return {
          id: stage.id,
          name: stage.name,
          count: stageDeals.length,
          valueCents: stageDeals.reduce(
            (total, deal) => total + Number(deal.valueCents || 0),
            0,
          ),
        };
      });

    const knownNames = new Set(rows.map((row) => row.name.toLowerCase()));
    const missingRows = deals
      .filter((deal) => deal.stageName && !knownNames.has(deal.stageName.toLowerCase()))
      .reduce<Array<{ id: string; name: string; count: number; valueCents: number }>>(
        (acc, deal) => {
          const name = deal.stageName || "Unassigned";
          const existing = acc.find((row) => row.name === name);
          if (existing) {
            existing.count += 1;
            existing.valueCents += Number(deal.valueCents || 0);
          } else {
            acc.push({
              id: name,
              name,
              count: 1,
              valueCents: Number(deal.valueCents || 0),
            });
          }
          return acc;
        },
        [],
      );

    return [...rows, ...missingRows];
  }, [deals, stages]);

  const upcomingDeadlines = useMemo<DeadlineRow[]>(() => {
    const deadlineNow = new Date();
    const taskRows = tasks
      .filter((task) => isDashboardUpcomingTask(task, deadlineNow))
      .map((task) => ({
        id: task.id,
        title: task.title,
        owner: task.assignedTo || "Unassigned",
        date: task.dueDate,
        href: getDashboardTaskDetailHref(task.id),
        type: "Task" as const,
      }));

    const serviceRows = services.filter(isUpcomingService).map((service) => ({
      id: service.id,
      title: service.name,
      owner:
        clientNameByProfileId.get(service.clientAccountProfileId) ||
        "Linked client",
      date: service.renewalDate,
      href: clientAccountByProfileId.get(service.clientAccountProfileId)
        ? `/app/ops/client-accounts/detail?id=${encodeURIComponent(clientAccountByProfileId.get(service.clientAccountProfileId)!.clinicId)}`
        : `/app/ops/delivery?status=active&from=dashboard`,
      type: "Service" as const,
    }));

    const proposalRows = proposals
      .filter(isActionableProposalFollowUp)
      .filter(
        (proposal) =>
          !hasActionableSyncedProposalFollowUpTask(
            proposal.id,
            tasks,
            deadlineNow,
          ),
      )
      .map((proposal) => ({
        id: proposal.id,
        title: proposal.proposalName,
        owner: proposal.ownerName || proposal.contactName || proposal.accountName || "Unassigned",
        date: proposal.followUpAt,
        href: `/app/crm/proposals/preview?id=${encodeURIComponent(proposal.id)}`,
        type: "Proposal" as const,
      }));

    return [...taskRows, ...serviceRows, ...proposalRows]
      .sort((a, b) => {
        const aTime = parseDate(a.date)?.getTime() || 0;
        const bTime = parseDate(b.date)?.getTime() || 0;
        return aTime - bTime;
      })
      .slice(0, 8);
  }, [clientAccountByProfileId, clientNameByProfileId, proposals, services, tasks]);

  const nextBestActions = useMemo<DashboardActionRow[]>(() => {
    const contactRows = contacts
      .filter(isLeadContact)
      .map((contact) => {
        const href = `/app/crm/contacts/detail?id=${encodeURIComponent(contact.id)}`;
        const action = getLeadNextBestAction({
          auditStatus: contact.auditStatus,
          attemptCount: contact.contactAttemptCount,
          contactId: contact.id,
          followUpOverdue: daysFromToday(contact.nextFollowUpAt) !== null && daysFromToday(contact.nextFollowUpAt)! < 0,
          guideSignal: `${contact.ctaClicked || ""} ${contact.formSubmitted || ""} ${contact.landingPage || ""}`,
          packageInterest: contact.packageInterest || contact.recommendedPackage,
          source: contact.source,
          stage: contact.leadStatus || contact.status,
          status: contact.lastContactAt || contact.contactAttemptCount > 0
            ? "ok"
            : daysFromToday(contact.createdAt) !== null && daysFromToday(contact.createdAt)! < 0
              ? "overdue"
              : "uncontacted",
        });
        return {
          id: `lead-${contact.id}`,
          title: contact.accountName || contact.name,
          owner: contact.source || "Lead",
          action,
          href,
          sort: actionUrgencySort(action),
        };
      });

    const dealRows = deals
      .filter((deal) => !contacts.some((contact) => contact.id === deal.contactId))
      .map((deal) => {
        const href = deal.contactId
          ? `/app/crm/contacts/detail?id=${encodeURIComponent(deal.contactId)}`
          : `/app/crm/pipeline?deal=${encodeURIComponent(deal.id)}`;
        const action = getLeadNextBestAction({
          auditStatus: deal.auditStatus,
          contactId: deal.contactId,
          followUpOverdue: daysFromToday(deal.expectedCloseDate) !== null && daysFromToday(deal.expectedCloseDate)! < 0,
          packageInterest: deal.treatment,
          source: deal.source,
          stage: deal.stageName,
          status: "uncontacted",
        });
        return {
          id: `deal-${deal.id}`,
          title: deal.contactName || deal.title,
          owner: deal.ownerName || "Unassigned",
          action,
          href,
          sort: actionUrgencySort(action),
        };
      });

    const clientIssueRows = openClientAccounts
      .filter((account) => account.openIssueCount > 0)
      .map((account) => {
        const href = `/app/ops/client-accounts/detail?id=${encodeURIComponent(account.clinicId)}#account-issues`;
        const isOverdue = account.overdueIssueCount > 0;
        return {
          id: `client-issue-${account.clinicId}`,
          title: account.clinicName,
          owner: account.accountManager
            ? [account.accountManager.firstName, account.accountManager.lastName].filter(Boolean).join(" ") || account.accountManager.email || "Unassigned"
            : "Unassigned",
          action: {
            kind: "client_review" as const,
            label: isOverdue ? "Resolve overdue issue" : "Review client issue",
            detail: `${account.openIssueCount} open issue${account.openIssueCount === 1 ? "" : "s"}${isOverdue ? `, ${account.overdueIssueCount} overdue` : ""}.`,
            urgency: isOverdue ? "high" as const : "medium" as const,
            href,
          },
          href,
          sort: isOverdue ? 0 : 1,
        };
      });

    const clientRows = openClientAccounts.map((account) => {
      const href = `/app/ops/client-accounts/detail?id=${encodeURIComponent(account.clinicId)}`;
      const action = getClientNextBestAction({
        churnRisk: account.churnRisk,
        contractStatus: account.contractStatus,
        currentPackage: account.currentPackage,
        googleDriveFolderAccessStatus: account.googleDriveFolderAccessStatus,
        googleDriveFolderId: account.googleDriveFolderId,
        healthStatus: account.healthStatus,
        href,
        onboardingStatus: account.onboardingStatus,
        overdueTaskCount: account.overdueTaskCount,
        recommendedNextPackage: account.recommendedNextPackage,
        renewalDate: account.renewalDate,
        upsellOpportunity:
          account.upsellOpportunity || account.upsellPrompts[0]?.reason,
      });
      return {
        id: `client-${account.clinicId}`,
        title: account.clinicName,
        owner: account.accountManager
          ? [account.accountManager.firstName, account.accountManager.lastName]
              .filter(Boolean)
              .join(" ") ||
            account.accountManager.email ||
            "Unassigned"
          : "Unassigned",
        action,
        href,
        sort: actionUrgencySort(action),
      };
    });

    return [...clientIssueRows, ...contactRows, ...dealRows, ...clientRows]
      .filter((row) => row.action.urgency !== "low")
      .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title))
      .slice(0, 8);
  }, [contacts, deals, openClientAccounts]);

  const maxStageCount = Math.max(1, ...stageRows.map((row) => row.count));
  const topActiveProjects = metrics.activeProjects.slice(0, 6);
  const overdueTasks = metrics.overdueTasks.slice(0, 6);
  const dashboardKpiCards = useMemo(
    () =>
      getDashboardKpiCards({
        newProspects: metrics.newLeads.length,
        won: metrics.wonDeals.length,
        lost: metrics.lostDeals.length,
        openClients: metrics.openClients.length,
        activeProjects: metrics.activeProjects.length,
        overdueTasks: metrics.overdueTasks.length,
      }),
    [metrics],
  );
  const registerDashboardCardRef = useCallback(
    (index: number, node: HTMLAnchorElement | null) => {
      dashboardCardRefs.current[index] = node;
    },
    [],
  );
  const dashboardCardKeyboardProps = {
    activeIndex: activeDashboardCardIndex,
    setActiveIndex: setActiveDashboardCardIndex,
    registerItemRef: registerDashboardCardRef,
    totalItems: 6,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mission Control"
        subtitle="Internal sales pipeline, client accounts, delivery work, and task health at a glance."
        icon={ClipboardList}
      />

      <div className="flex flex-wrap gap-2">
        {[
          { label: "Add Lead", href: "/app/crm/contacts/new?mode=lead", icon: Users, permission: "contacts:write" },
          { label: "Add Client", href: "/app/ops/client-accounts/new", icon: BriefcaseBusiness, permission: "client_accounts:write" },
          { label: "Add Contact", href: "/app/crm/contacts/new?mode=contact", icon: Plus, permission: "contacts:write" },
          { label: "Add Task", href: "/app/crm/tasks/new", icon: CheckSquare, permission: "internal_tasks:write" },
        ].filter((action) => hasPermission(action.permission)).map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex items-center gap-2 rounded-[14px] border border-[rgba(21,31,33,0.08)] bg-[#FFFCF9] px-3 py-2 text-sm font-semibold text-[#151f21] transition-colors hover:border-[rgba(96,180,175,0.28)] hover:bg-[rgba(96,180,175,0.06)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315f62] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F5]"
            >
              <Icon className="h-4 w-4 text-[#5e8a8d]" />
              {action.label}
            </Link>
          );
        })}
      </div>

      {loadError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Operations dashboard loaded with gaps"
          description={loadError}
          variant="warning"
        />
      )}

      <div
        data-dashboard-kpi-grid
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6"
      >
        {isLoading ? (
          Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="rounded-[24px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9] p-6"
            >
              <SkeletonLine className="mb-3 h-4 w-24" />
              <SkeletonLine className="h-8 w-16" />
            </div>
          ))
        ) : (
          <>
            <DashboardKpiCardLink index={0} href={dashboardKpiCards[0].href} ariaLabel={dashboardKpiCards[0].ariaLabel} {...dashboardCardKeyboardProps}>
              <StatCard
                label="New Prospects"
                value={String(metrics.newLeads.length)}
                sub="new enquiries and recent opportunities"
                icon={Users}
                color="cyan"
              />
            </DashboardKpiCardLink>
            <DashboardKpiCardLink index={1} href={dashboardKpiCards[1].href} ariaLabel={dashboardKpiCards[1].ariaLabel} {...dashboardCardKeyboardProps}>
              <StatCard
                label="Won"
                value={String(metrics.wonDeals.length)}
                sub={formatMoney(
                  metrics.wonDeals.reduce(
                    (total, deal) => total + Number(deal.valueCents || 0),
                    0,
                  ),
                )}
                icon={CircleCheckBig}
                color="green"
              />
            </DashboardKpiCardLink>
            <DashboardKpiCardLink index={2} href={dashboardKpiCards[2].href} ariaLabel={dashboardKpiCards[2].ariaLabel} {...dashboardCardKeyboardProps}>
              <StatCard
                label="Lost"
                value={String(metrics.lostDeals.length)}
                sub="closed lost opportunities"
                icon={CircleX}
                color="rose"
              />
            </DashboardKpiCardLink>
            <DashboardKpiCardLink index={3} href={dashboardKpiCards[3].href} ariaLabel={dashboardKpiCards[3].ariaLabel} {...dashboardCardKeyboardProps}>
              <StatCard
                label="Open Clients"
                value={String(metrics.openClients.length)}
                sub="active, trial, and pending accounts"
                icon={BriefcaseBusiness}
                color="blue"
              />
            </DashboardKpiCardLink>
            <DashboardKpiCardLink index={4} href={dashboardKpiCards[4].href} ariaLabel={dashboardKpiCards[4].ariaLabel} {...dashboardCardKeyboardProps}>
              <StatCard
                label="Active Projects"
                value={String(metrics.activeProjects.length)}
                sub="services currently in delivery"
                icon={Target}
                color="purple"
              />
            </DashboardKpiCardLink>
            <DashboardKpiCardLink index={5} href={dashboardKpiCards[5].href} ariaLabel={dashboardKpiCards[5].ariaLabel} {...dashboardCardKeyboardProps}>
              <StatCard
                label="Overdue Tasks"
                value={String(metrics.overdueTasks.length)}
                sub="open internal tasks past due"
                icon={CheckSquare}
                color="amber"
              />
            </DashboardKpiCardLink>
          </>
        )}
      </div>

      <section className="rounded-[24px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[#151f21]">Sales Attention</h2>
            <p className="text-sm text-[#5e8a8d]">
              New, uncontacted, hot and due follow-up leads for today
            </p>
          </div>
          <Link
            href="/app/leads?from=dashboard"
            className="rounded-[14px] border border-[rgba(21,31,33,0.08)] px-3 py-2 text-sm font-medium text-[#151f21] hover:bg-[#eaedeb] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315f62] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFCF9]"
          >
            Prospect List
          </Link>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            { label: "New leads", value: leadAttentionCounts.newLeads, href: "/app/leads?view=new&from=dashboard" },
            { label: "Not contacted", value: leadAttentionCounts.notContacted, href: "/app/leads?view=not_contacted&from=dashboard" },
            { label: "Hot leads", value: leadAttentionCounts.hotLeads, href: "/app/leads?priority=hot&from=dashboard" },
            { label: "Follow-ups due", value: leadAttentionCounts.followUpsDue, href: "/app/leads?followUp=due&from=dashboard" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-2xl border border-[#E7E1DA] bg-[#FAF8F5] p-4 transition-colors hover:border-[#b9cfcb] hover:bg-[#edf5f3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315f62] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFCF9]"
              aria-label={`Open ${item.value} ${item.label.toLowerCase()} from Mission Control`}
            >
              <p className="text-sm font-medium text-[#5e8a8d]">{item.label}</p>
              <p className="mt-2 text-3xl font-bold text-[#151f21]">{item.value}</p>
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {isLoading &&
            Array.from({ length: 4 }, (_, index) => (
              <SkeletonLine key={index} className="h-16 w-full" />
            ))}
          {!isLoading && leadAttentionRows.slice(0, 6).map((row) => (
            <Link
              key={row.id}
              href={row.href}
              className="rounded-2xl border border-[#E7E1DA] bg-white p-4 transition-colors hover:border-[#b9cfcb] hover:bg-[#edf5f3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315f62] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFCF9]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#151f21]">{row.title}</p>
                  <p className="mt-1 truncate text-xs text-[#7A746A]">{row.meta || "Lead"}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${row.badgeClass}`}>
                  {row.badge}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-[#5e8a8d]">{row.detail}</p>
            </Link>
          ))}
          {!isLoading && leadAttentionRows.length === 0 && (
            <p className="text-sm text-[#5e8a8d]">No lead attention items found.</p>
          )}
        </div>
      </section>

      <section className="rounded-[24px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[#151f21]">Today&apos;s Next Best Actions</h2>
            <p className="text-sm text-[#5e8a8d]">
              Highest-priority sales and client actions based on current CRM signals
            </p>
          </div>
          <Link
            href="/app/leads?from=dashboard"
            className="rounded-[14px] border border-[rgba(21,31,33,0.08)] px-3 py-2 text-sm font-medium text-[#151f21] hover:bg-[#eaedeb] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315f62] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFCF9]"
          >
            Open Leads
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {isLoading &&
            Array.from({ length: 4 }, (_, index) => (
              <SkeletonLine key={index} className="h-16 w-full" />
            ))}
          {!isLoading && nextBestActions.map((row) => (
            <Link
              key={row.id}
              href={row.action.href || row.href}
              className="rounded-2xl border border-[#E7E1DA] bg-[#FAF8F5] p-4 transition-colors hover:border-[#b9cfcb] hover:bg-[#edf5f3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315f62] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFCF9]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#151f21]">{row.title}</p>
                  <p className="mt-1 truncate text-xs text-[#7A746A]">{row.owner}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${nextBestActionBadgeClass(row.action.urgency)}`}>
                  {row.action.label}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-[#5e8a8d]">{row.action.detail}</p>
            </Link>
          ))}
          {!isLoading && nextBestActions.length === 0 && (
            <p className="text-sm text-[#5e8a8d]">No urgent next best actions found.</p>
          )}
        </div>
      </section>

      <section className="rounded-[24px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[#151f21]">Free Audit Workflow</h2>
            <p className="text-sm text-[#5e8a8d]">
              Clinic Growth Score audit status across active leads and opportunities
            </p>
          </div>
          <Link
            href="/app/leads?from=dashboard"
            className="rounded-[14px] border border-[rgba(21,31,33,0.08)] px-3 py-2 text-sm font-medium text-[#151f21] hover:bg-[#eaedeb] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315f62] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFCF9]"
          >
            Lead Filters
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            {
              label: "Due / follow-up",
              value: metrics.auditsDue.length,
              href: "/app/leads?audit=due&from=dashboard",
              tone: metrics.auditsDue.length ? "text-amber-700 bg-amber-50 border-amber-200" : "text-[#5e8a8d] bg-[#FAF8F5] border-[#E7E1DA]",
            },
            {
              label: "In progress",
              value: metrics.auditsInProgress.length,
              href: "/app/leads?audit=in_progress&from=dashboard",
              tone: "text-violet-700 bg-violet-50 border-violet-200",
            },
            {
              label: "Completed / sent",
              value: metrics.auditsCompleted.length,
              href: "/app/leads?audit=completed&from=dashboard",
              tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
            },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`rounded-2xl border p-4 transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315f62] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFCF9] ${item.tone}`}
            >
              <p className="text-sm font-medium">{item.label}</p>
              <p className="mt-2 text-3xl font-bold">{item.value}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[#151f21]">Onboarding & Access Blockers</h2>
            <p className="text-sm text-[#5e8a8d]">
              Open client setup issues, missing access, missing folders and onboarding status
            </p>
          </div>
          <Link
            href={getClientAccountDrilldownHref("onboarding")}
            className="rounded-[14px] border border-[rgba(21,31,33,0.08)] px-3 py-2 text-sm font-medium text-[#151f21] hover:bg-[#eaedeb] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315f62] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFCF9]"
          >
            Onboarding Clients
          </Link>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            {
              label: "Onboarding clients",
              value: openClientAccounts.filter(
                (account) => account.onboardingStatus !== "completed",
              ).length,
              href: getClientAccountDrilldownHref("onboarding"),
            },
            {
              label: "Missing access",
              value: openClientAccounts.reduce(
                (total, account) => total + (account.missingAccessCount || 0),
                0,
              ),
              href: getClientAccountDrilldownHref("missing-access"),
            },
            {
              label: "Missing file links",
              value: openClientAccounts.reduce(
                (total, account) =>
                  total + (account.missingDocumentCount || 0),
                0,
              ),
              href: getClientAccountDrilldownHref("missing-files"),
            },
            {
              label: "Tasks due",
              value: metrics.tasksDue.length,
              href: DASHBOARD_DUE_TASKS_HREF,
            },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-2xl border border-[#E7E1DA] bg-[#FAF8F5] p-4 transition-colors hover:border-[#b9cfcb] hover:bg-[#edf5f3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315f62] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFCF9]"
              aria-label={`Open ${item.value} ${item.label.toLowerCase()} from Mission Control`}
            >
              <p className="text-sm font-medium text-[#5e8a8d]">{item.label}</p>
              <p className="mt-2 text-3xl font-bold text-[#151f21]">{item.value}</p>
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {isLoading &&
            Array.from({ length: 4 }, (_, index) => (
              <SkeletonLine key={index} className="h-16 w-full" />
            ))}
          {!isLoading && clientBlockerRows.map((row) => (
            <Link
              key={row.id}
              href={row.href}
              className="rounded-2xl border border-[#E7E1DA] bg-white p-4 transition-colors hover:border-[#b9cfcb] hover:bg-[#edf5f3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315f62] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFCF9]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#151f21]">{row.title}</p>
                  <p className="mt-1 truncate text-xs text-[#7A746A]">{row.owner}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${row.severity === "high" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-cyan-200 bg-cyan-50 text-cyan-700"}`}>
                  {row.severity === "high" ? "Blocker" : "Setup"}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-[#5e8a8d]">{row.detail}</p>
            </Link>
          ))}
          {!isLoading && clientBlockerRows.length === 0 && (
            <p className="text-sm text-[#5e8a8d]">No onboarding or access blockers found.</p>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section
          className="rounded-[24px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9] p-5 xl:col-span-2"
          style={{ boxShadow: "0 1px 6px rgba(21,31,33,0.03)" }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[#151f21]">Prospects by Stage</h2>
              <p className="text-sm text-[#5e8a8d]">
                {deals.length} total sales opportunities
              </p>
            </div>
            <Link
              href="/app/crm/pipeline"
              className="rounded-[14px] border border-[rgba(21,31,33,0.08)] px-3 py-2 text-sm font-medium text-[#151f21] hover:bg-[#eaedeb] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315f62] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFCF9]"
            >
              Sales Pipeline
            </Link>
          </div>
          <div className="space-y-3">
            {isLoading &&
              Array.from({ length: 6 }, (_, index) => (
                <SkeletonLine key={index} className="h-8 w-full" />
              ))}
            {!isLoading &&
              stageRows.map((stage) => (
                <Link
                  key={stage.id}
                  href={`/app/crm/pipeline?stage=${encodeURIComponent(stage.id)}&from=dashboard`}
                  aria-label={`Open ${stage.count} opportunities in ${stage.name}`}
                  className="block space-y-1 rounded-[14px] p-2 transition-colors hover:bg-[rgba(96,180,175,0.06)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315f62] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFCF9]"
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-[#151f21]">
                      {stage.name}
                    </span>
                    <span className="text-[#5e8a8d]">
                      {stage.count} - {formatMoney(stage.valueCents)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#eaedeb]">
                    <div
                      className="h-2 rounded-full bg-[#60b4af]"
                      style={{
                        width: `${Math.max(4, (stage.count / maxStageCount) * 100)}%`,
                      }}
                    />
                  </div>
                </Link>
              ))}
            {!isLoading && stageRows.length === 0 && (
              <p className="text-sm text-[#5e8a8d]">No pipeline stages loaded.</p>
            )}
          </div>
        </section>

        <section
          className="rounded-[24px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9] p-5"
          style={{ boxShadow: "0 1px 6px rgba(21,31,33,0.03)" }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[#151f21]">Upcoming Deadlines</h2>
              <p className="text-sm text-[#5e8a8d]">Tasks, proposals, and service renewals</p>
            </div>
            <CalendarClock className="h-5 w-5 text-[#60b4af]" />
          </div>
          <div className="space-y-3">
            {isLoading &&
              Array.from({ length: 5 }, (_, index) => (
                <SkeletonLine key={index} className="h-12 w-full" />
              ))}
            {!isLoading &&
              upcomingDeadlines.map((deadline) => (
                <Link
                  key={`${deadline.type}-${deadline.id}`}
                  href={deadline.href}
                  className="block rounded-[16px] border border-[rgba(21,31,33,0.06)] bg-[#FAF8F5] p-3 transition-colors hover:border-[rgba(96,180,175,0.25)] hover:bg-[rgba(96,180,175,0.04)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315f62] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFCF9]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-[#151f21]">
                      {deadline.title}
                    </span>
                    <span className="rounded-full bg-[rgba(96,180,175,0.08)] px-2 py-0.5 text-xs text-[#5e8a8d]">
                      {deadline.type}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-[#5e8a8d]">
                    <span>{deadline.owner}</span>
                    <span>{formatDate(deadline.date)}</span>
                  </div>
                </Link>
              ))}
            {!isLoading && upcomingDeadlines.length === 0 && (
              <p className="text-sm text-[#5e8a8d]">No upcoming deadlines found.</p>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section
          className="rounded-[24px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9]"
          style={{ boxShadow: "0 1px 6px rgba(21,31,33,0.03)" }}
        >
          <div className="flex items-center justify-between border-b border-[rgba(21,31,33,0.05)] px-5 py-4">
            <div>
              <h2 className="font-semibold text-[#151f21]">Active Projects</h2>
              <p className="text-sm text-[#5e8a8d]">Open delivery services</p>
            </div>
            <Link
              href="/app/ops/client-accounts"
              className="rounded-lg text-sm font-medium text-[#5e8a8d] hover:text-[#151f21] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315f62] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFCF9]"
            >
              Client Accounts
            </Link>
          </div>
          <div className="divide-y divide-[rgba(21,31,33,0.05)]">
            {isLoading &&
              Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="p-5">
                  <SkeletonLine className="mb-2 h-5 w-2/3" />
                  <SkeletonLine className="h-4 w-1/2" />
                </div>
              ))}
            {!isLoading &&
              topActiveProjects.map((service) => {
                const linkedAccount = clientAccountByProfileId.get(service.clientAccountProfileId);
                return (
                  <Link
                    key={service.id}
                    href={linkedAccount ? `/app/ops/client-accounts/detail?id=${encodeURIComponent(linkedAccount.clinicId)}` : "/app/ops/delivery?status=active&from=dashboard"}
                    aria-label={`Open project ${service.name}${linkedAccount ? ` for ${linkedAccount.clinicName}` : ""}`}
                    className="block p-5 transition-colors hover:bg-[rgba(96,180,175,0.03)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#315f62]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-[#151f21]">
                        {service.name}
                      </span>
                      <span className="rounded-full bg-[rgba(96,180,175,0.08)] px-2 py-1 text-xs font-medium text-[#5e8a8d]">
                        {formatLabel(service.status)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[#5e8a8d]">
                      <span>
                        {linkedAccount?.clinicName ||
                          clientNameByProfileId.get(service.clientAccountProfileId) ||
                          "Linked client"}
                      </span>
                      <span>{formatLabel(service.serviceType)}</span>
                      <span>Renewal {formatDate(service.renewalDate)}</span>
                    </div>
                  </Link>
                );
              })}
            {!isLoading && topActiveProjects.length === 0 && (
              <p className="p-5 text-sm text-[#5e8a8d]">No active projects found.</p>
            )}
          </div>
        </section>

        <section
          className="rounded-[24px] border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9]"
          style={{ boxShadow: "0 1px 6px rgba(21,31,33,0.03)" }}
        >
          <div className="flex items-center justify-between border-b border-[rgba(21,31,33,0.05)] px-5 py-4">
            <div>
              <h2 className="font-semibold text-[#151f21]">Overdue Tasks</h2>
              <p className="text-sm text-[#5e8a8d]">Open internal work past due</p>
            </div>
            <Link
              href="/app/crm/tasks?due=overdue&from=dashboard"
              className="rounded-lg text-sm font-medium text-[#5e8a8d] hover:text-[#151f21] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315f62] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFCF9]"
            >
              Tasks
            </Link>
          </div>
          <div className="divide-y divide-[rgba(21,31,33,0.05)]">
            {isLoading &&
              Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="p-5">
                  <SkeletonLine className="mb-2 h-5 w-2/3" />
                  <SkeletonLine className="h-4 w-1/2" />
                </div>
              ))}
            {!isLoading &&
              overdueTasks.map((task) => (
                <Link
                  key={task.id}
                  href={getDashboardTaskDetailHref(task.id)}
                  className="block p-5 transition-colors hover:bg-[rgba(96,180,175,0.03)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#315f62]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-[#151f21]">
                      {task.title}
                    </span>
                    <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700">
                      {task.priority}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[#5e8a8d]">
                    <span>{task.assignedTo || "Unassigned"}</span>
                    <span>{task.boardKey ? formatLabel(task.boardKey) : "Delivery"}</span>
                    <span>Due {formatDate(task.dueDate)}</span>
                  </div>
                </Link>
              ))}
            {!isLoading && overdueTasks.length === 0 && (
              <p className="p-5 text-sm text-[#5e8a8d]">No overdue internal tasks.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
