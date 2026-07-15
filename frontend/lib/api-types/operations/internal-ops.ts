export type ClientAccountOnboardingStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "paused";

export type ClientAccountHealthStatus =
  | "healthy"
  | "attention_needed"
  | "at_risk"
  | "critical";

export type ClientAccountChurnRisk = "low" | "medium" | "high" | "critical";

export type ClientAccountClientStatus =
  | "prospect"
  | "onboarding"
  | "active"
  | "paused"
  | "at_risk"
  | "churned"
  | "inactive";

export type ClientAccountContractStatus =
  | "active"
  | "trial"
  | "pending"
  | "paused"
  | "cancelled"
  | "expired";

export type ClientAccountServiceType =
  | "ppc"
  | "seo"
  | "gbp"
  | "website"
  | "landing_pages"
  | "cro"
  | "strategy"
  | "other";

export type ClientAccountServiceStatus =
  | "onboarding"
  | "active"
  | "paused"
  | "ended"
  | "archived";

export type ClientAccountActionPlanStatus =
  | "draft"
  | "active"
  | "completed"
  | "archived";

export interface ClientAccountPerson {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

export interface ClientAccountProfileRecord {
  id: string | null;
  clinicId: string;
  clinicName: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  accountManager: ClientAccountPerson | null;
  activeServices: string[];
  onboardingStatus: ClientAccountOnboardingStatus;
  healthStatus: ClientAccountHealthStatus;
  clientStatus: ClientAccountClientStatus;
  currentPackage: string | null;
  churnRisk: ClientAccountChurnRisk;
  renewalDate: string | null;
  contractStatus: ClientAccountContractStatus;
  keyNotes: string | null;
  googleDriveFolderId: string | null;
  googleDriveFolderUrl: string | null;
  googleDriveFolderName: string | null;
  googleDriveFolderAccessStatus: "not_checked" | "accessible" | "inaccessible";
  googleDriveFolderError: string | null;
  googleDriveFolderCheckedAt: string | null;
  updatedAt: string | null;
}

export interface ClientAccountSummaryRecord
  extends ClientAccountProfileRecord {
  activeServiceCount: number;
  renewalRiskCount: number;
  pendingTaskCount: number;
  overdueTaskCount: number;
  qaTaskCount: number;
  missedTaskCount: number;
  escalatedTaskCount: number;
  lastStrategyLogAt: string | null;
  actionPlanId: string | null;
  actionPlanMonth: string | null;
  actionPlanStatus: ClientAccountActionPlanStatus | null;
  actionPlanTotalItems: number;
  actionPlanCompletedItems: number;
  actionPlanOpenItems: number;
  actionPlanHighPriorityOpenItems: number;
  actionPlanProgressPercent: number;
  actionPlanLastUpdatedAt: string | null;
}

export interface ClientAccountLinkedContactRecord {
  relationId: string;
  id: string;
  name: string;
  accountName: string | null;
  role: string | null;
  roleTitle: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  source: string | null;
  status: string;
  leadStatus: string;
  updatedAt: string;
}

export interface ClientAccountContactAccountLinkRecord {
  relationId: string;
  clientAccountProfileId: string;
  clientClinicId: string;
  clientName: string;
  linkedAt: string;
}

export interface ClientAccountLinkedTaskRecord {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string | null;
  contactId: string | null;
  contact: string | null;
  due: string | null;
  dueDate: string | null;
  assignedTo: string | null;
  isOverdue: boolean;
  clientAccountProfileId: string | null;
  clientAccountServiceId: string | null;
  updatedAt: string;
}

export interface ClientAccountLinkedRecords {
  account: ClientAccountProfileRecord;
  contacts: ClientAccountLinkedContactRecord[];
  openTasks: ClientAccountLinkedTaskRecord[];
  completedTasks: ClientAccountLinkedTaskRecord[];
  counts: {
    contacts: number;
    openTasks: number;
    completedTasks: number;
  };
}

export interface ClientAccountListParams {
  search?: string;
  healthStatus?: ClientAccountHealthStatus | "all";
  clientStatus?: ClientAccountClientStatus | "all";
  churnRisk?: ClientAccountChurnRisk | "all";
  contractStatus?: ClientAccountContractStatus | "all";
}

export interface ClientAccountProfilePayload {
  accountManagerId?: string | null;
  activeServices?: string[];
  onboardingStatus?: ClientAccountOnboardingStatus;
  healthStatus?: ClientAccountHealthStatus;
  clientStatus?: ClientAccountClientStatus;
  currentPackage?: string | null;
  churnRisk?: ClientAccountChurnRisk;
  renewalDate?: string | null;
  contractStatus?: ClientAccountContractStatus;
  keyNotes?: string | null;
}

export interface ClientAccountDriveFolderPayload {
  folderUrl?: string | null;
  folderId?: string | null;
  displayName?: string | null;
}

export interface ClientAccountCreatePayload extends ClientAccountProfilePayload {
  name: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface ClientAccountFromContactPayload
  extends Omit<
    ClientAccountCreatePayload,
    "name" | "email" | "phone" | "address" | "city" | "state" | "postalCode" | "country"
  > {
  contactId: string;
  accountName?: string | null;
}

export interface ClientAccountServiceRecord {
  id: string;
  clinicId: string;
  clientAccountProfileId: string;
  serviceType: ClientAccountServiceType;
  name: string;
  status: ClientAccountServiceStatus;
  startDate: string | null;
  renewalDate: string | null;
  endDate: string | null;
  owner: ClientAccountPerson | null;
  recurringValue: number | null;
  currency: string;
  contractStatus: ClientAccountContractStatus;
  notes: string | null;
  archivedAt: string | null;
  updatedAt: string | null;
}

export interface ClientAccountServiceListParams {
  includeArchived?: boolean | string;
  includeAllClinics?: boolean | string;
  status?: ClientAccountServiceStatus | "all";
  contractStatus?: ClientAccountContractStatus | "all";
}

export interface ClientAccountServicePayload {
  serviceType: ClientAccountServiceType;
  name: string;
  status?: ClientAccountServiceStatus;
  startDate?: string | null;
  renewalDate?: string | null;
  endDate?: string | null;
  ownerId?: string | null;
  recurringValue?: number | string | null;
  currency?: string;
  contractStatus?: ClientAccountContractStatus;
  notes?: string | null;
}

export type ClientAccountServiceUpdatePayload = Partial<
  Omit<ClientAccountServicePayload, "status">
> & {
  status?: Exclude<ClientAccountServiceStatus, "archived">;
};

export type InternalTaskApprovalStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected"
  | "needs_changes";

export type InternalTaskPriority = "low" | "medium" | "high";
export type InternalTaskStatus = "pending" | "completed";

export interface InternalTaskRecord {
  id: string;
  title: string;
  description: string | null;
  priority: InternalTaskPriority;
  status: InternalTaskStatus;
  category: string | null;
  contactId?: string | null;
  contact: string | null;
  due: string | null;
  dueDate: string | null;
  assignedTo: string | null;
  isInternal?: boolean;
  boardKey?: string | null;
  serviceType?: ClientAccountServiceType | null;
  clientAccountProfileId?: string | null;
  clientAccountServiceId?: string | null;
  assignedUserId?: string | null;
  proofReference?: string | null;
  workflowMonth?: string | null;
  templateKey?: string | null;
  recurrenceRule?: Record<string, unknown> | null;
  completedAt?: string | null;
  archivedAt?: string | null;
  isOverdue?: boolean;
  needsQa?: boolean;
  qaChecklist?: Record<string, unknown> | null;
  approvalStatus?: InternalTaskApprovalStatus;
  reviewerUserId?: string | null;
  completionProofReference?: string | null;
  missedTask?: boolean;
  escalationFlag?: boolean;
  freelancerTeamScore?: number | null;
  qaUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InternalTaskListParams {
  boardKey?: string;
  serviceType?: ClientAccountServiceType | "all";
  clientAccountProfileId?: string;
  clientAccountServiceId?: string;
  assignedUserId?: string;
  status?: InternalTaskStatus | "all";
  overdue?: boolean | string;
  completed?: boolean | string;
  needsQa?: boolean | string;
  approvalStatus?: InternalTaskApprovalStatus | "all";
  missedTask?: boolean | string;
  escalationFlag?: boolean | string;
  includeArchived?: boolean | string;
  workflowMonth?: string;
}

export interface InternalTaskPayload {
  title: string;
  description?: string | null;
  priority?: InternalTaskPriority;
  status?: InternalTaskStatus;
  category?: string | null;
  contactId?: string | null;
  contact?: string | null;
  due?: string | null;
  dueDate?: string | null;
  assignedTo?: string | null;
  boardKey: string;
  serviceType?: ClientAccountServiceType | null;
  clientAccountProfileId?: string | null;
  clientAccountServiceId?: string | null;
  assignedUserId?: string | null;
  proofReference?: string | null;
  workflowMonth?: string | null;
  templateKey?: string | null;
  recurrenceRule?: Record<string, unknown> | null;
}

export type InternalTaskUpdatePayload = Partial<InternalTaskPayload>;

export interface InternalTaskQaPayload {
  needsQa?: boolean;
  qaChecklist?: Record<string, unknown> | null;
  approvalStatus?: InternalTaskApprovalStatus;
  reviewerUserId?: string | null;
  completionProofReference?: string | null;
  missedTask?: boolean;
  escalationFlag?: boolean;
  freelancerTeamScore?: number | string | null;
}

export interface StrategyLogRecord {
  id: string;
  clinicId: string;
  clientAccountProfileId: string;
  logMonth: string;
  logType: "strategy" | "meeting";
  meetingNotes: string | null;
  seoPlan: string | null;
  ppcPlan: string | null;
  landingPagePlan: string | null;
  kpiNotes: string | null;
  decisions: string | null;
  nextActions: string | null;
  ownerId: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyLogListParams {
  clientAccountProfileId?: string;
  logMonth?: string;
  ownerId?: string;
  logType?: "strategy" | "meeting" | "all";
  includeArchived?: boolean | string;
}

export interface StrategyLogPayload {
  clientAccountProfileId: string;
  logMonth: string;
  logType?: "strategy" | "meeting";
  meetingNotes?: string | null;
  seoPlan?: string | null;
  ppcPlan?: string | null;
  landingPagePlan?: string | null;
  kpiNotes?: string | null;
  decisions?: string | null;
  nextActions?: string | null;
  ownerId?: string | null;
}

export type StrategyLogUpdatePayload = Partial<
  Omit<StrategyLogPayload, "clientAccountProfileId">
>;

export interface SopListParams {
  category?: string;
  status?: "draft" | "published" | "archived" | "all";
  search?: string;
}
