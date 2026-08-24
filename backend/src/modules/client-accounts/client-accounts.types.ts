export type OnboardingStatus = "not_started" | "in_progress" | "completed" | "paused";
export type HealthStatus = "healthy" | "attention_needed" | "at_risk" | "critical";
export type ChurnRisk = "low" | "medium" | "high" | "critical";
export type ContractStatus = "active" | "trial" | "pending" | "paused" | "cancelled" | "expired";
export type PaymentStatus = "not_started" | "pending" | "paid" | "overdue" | "failed" | "cancelled";
export type InvoiceStatus = "not_required" | "not_sent" | "sent" | "paid" | "overdue" | "disputed" | "void";
export type ClientStatus = "prospect" | "onboarding" | "active" | "paused" | "at_risk" | "churned" | "inactive";
export type ClientServiceType = "ppc" | "seo" | "gbp" | "website" | "landing_pages" | "cro" | "strategy" | "other";
export type ClientServiceStatus = "onboarding" | "active" | "paused" | "ended" | "archived";
export type MonthlyActionPlanStatus = "draft" | "active" | "completed" | "archived";
export type ClientUpsellPromptSeverity = "medium" | "high";
export type ClientIssuePriority = "low" | "medium" | "high" | "critical";
export type ClientIssueStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";
export type ClientIssueSourceChannel = "manual" | "email" | "phone" | "whatsapp" | "meeting" | "client_portal" | "other";
export type ClientDocumentType =
  | "main_client_folder"
  | "audit"
  | "proposal"
  | "contract_admin"
  | "onboarding"
  | "website_assets"
  | "reports"
  | "strategy_looms"
  | "ads"
  | "seo_content"
  | "landing_pages";
export type ClientDocumentLinkStatus = "missing" | "linked" | "not_checked" | "access_problem";
export type ClientAccessItemType =
  | "website"
  | "ga4"
  | "gsc"
  | "gtm"
  | "google_ads"
  | "gbp"
  | "meta"
  | "brand_assets"
  | "treatment_pricing_info"
  | "reporting_access";
export type ClientAccessItemStatus = "requested" | "received" | "not_needed";

export interface GrowthScoreCategories {
  websiteVisibility: number | null;
  seo: number | null;
  gbp: number | null;
  tracking: number | null;
  conversion: number | null;
  leadHandling: number | null;
  responseSpeed: number | null;
  enquiryVisibility: number | null;
  treatmentPerformance: number | null;
  revenueLeakage: number | null;
  growthOpportunity: number | null;
}

export interface GrowthScoreSnapshot {
  overall: number | null;
  categories: GrowthScoreCategories;
  recommendedPackage: string | null;
  gapSummary: string | null;
  updatedAt: string | null;
}

export interface ClientAccountUpsellPrompt {
  ruleKey: string;
  fromPackage: string;
  toPackage: string;
  reason: string;
  severity: ClientUpsellPromptSeverity;
}

export interface CreateClientIssueDTO {
  title: string;
  priority?: ClientIssuePriority;
  status?: ClientIssueStatus;
  sourceChannel?: ClientIssueSourceChannel;
  ownerUserId?: string | null;
  dueDate?: string | null;
  slaDueAt?: string | null;
  escalatedAt?: string | null;
  notes?: string | null;
  taskId?: string | null;
}

export type UpdateClientIssueDTO = Partial<CreateClientIssueDTO>;

export interface ClientIssueResponse {
  id: string;
  clientAccountProfileId: string;
  taskId: string | null;
  title: string;
  priority: ClientIssuePriority;
  status: ClientIssueStatus;
  sourceChannel: ClientIssueSourceChannel;
  owner: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  dueDate: string | null;
  slaDueAt: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  notes: string | null;
  isOverdue: boolean;
  slaStatus: "on_track" | "due_today" | "overdue" | "resolved";
  isEscalated: boolean;
  task: {
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateClientAccountProfileDTO {
  accountManagerId?: string | null;
  activeServices?: string[];
  onboardingStatus?: OnboardingStatus;
  healthStatus?: HealthStatus;
  clientStatus?: ClientStatus;
  currentPackage?: string | null;
  monthlyPrice?: number | string | null;
  setupFee?: number | string | null;
  currency?: string | null;
  recommendedNextPackage?: string | null;
  upsellOpportunity?: string | null;
  growthScore?: Partial<GrowthScoreSnapshot> | null;
  growthScoreOverall?: number | string | null;
  growthScoreCategories?: Partial<GrowthScoreCategories> | null;
  growthScoreRecommendedPackage?: string | null;
  growthScoreGapSummary?: string | null;
  growthScoreUpdatedAt?: string | null;
  churnRisk?: ChurnRisk;
  lastContactAt?: string | null;
  lastReportAt?: string | null;
  lastLoomAt?: string | null;
  renewalDate?: string | null;
  contractStatus?: ContractStatus;
  contractStartDate?: string | null;
  noticeDate?: string | null;
  paymentStatus?: PaymentStatus;
  invoiceStatus?: InvoiceStatus;
  paymentNotes?: string | null;
  keyNotes?: string | null;
}

export interface UpdateClientAccountDriveFolderDTO {
  folderUrl?: string | null;
  folderId?: string | null;
  displayName?: string | null;
}

export interface UpdateClientAccountDocumentLinkDTO {
  driveUrl?: string | null;
  driveItemId?: string | null;
  displayName?: string | null;
  notes?: string | null;
}

export interface UpdateClientAccountAccessItemDTO {
  status: ClientAccessItemStatus;
  notes?: string | null;
}

export interface CreateClientAccountDriveFolderDTO {
  name: string;
  parentId?: string;
}

export interface RenameClientAccountDriveFileDTO {
  name: string;
}

export interface CreateClientAccountDTO extends UpdateClientAccountProfileDTO {
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

export interface CreateClientAccountFromContactDTO
  extends Omit<CreateClientAccountDTO, "name" | "email" | "phone" | "address" | "city" | "state" | "postalCode" | "country"> {
  contactId: string;
  accountName?: string | null;
}

export interface ConvertWonDealToClientDTO
  extends Omit<CreateClientAccountFromContactDTO, "contactId"> {
  dealId: string;
  createOnboardingTasks?: true;
}

export interface ClientAccountProfileResponse {
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
  accountManager: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  activeServices: string[];
  onboardingStatus: OnboardingStatus;
  healthStatus: HealthStatus;
  clientStatus: ClientStatus;
  currentPackage: string | null;
  monthlyPrice: number | null;
  setupFee: number | null;
  currency: string;
  recommendedNextPackage: string | null;
  upsellOpportunity: string | null;
  growthScore: GrowthScoreSnapshot;
  growthScoreOverall: number | null;
  growthScoreCategories: GrowthScoreCategories;
  growthScoreRecommendedPackage: string | null;
  growthScoreGapSummary: string | null;
  growthScoreUpdatedAt: string | null;
  churnRisk: ChurnRisk;
  lastContactAt: string | null;
  lastReportAt: string | null;
  lastLoomAt: string | null;
  renewalDate: string | null;
  contractStatus: ContractStatus;
  contractStartDate: string | null;
  noticeDate: string | null;
  paymentStatus: PaymentStatus;
  invoiceStatus: InvoiceStatus;
  paymentNotes: string | null;
  keyNotes: string | null;
  googleDriveFolderId: string | null;
  googleDriveFolderUrl: string | null;
  googleDriveFolderName: string | null;
  googleDriveFolderAccessStatus: "not_checked" | "accessible" | "inaccessible";
  googleDriveFolderError: string | null;
  googleDriveFolderCheckedAt: string | null;
  upsellPrompts: ClientAccountUpsellPrompt[];
  openIssueCount: number;
  overdueIssueCount: number;
  missingDocumentCount: number;
  missingAccessCount: number;
  updatedAt: string | null;
}

export interface ClientAccountSummaryResponse extends ClientAccountProfileResponse {
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
  actionPlanStatus: MonthlyActionPlanStatus | null;
  actionPlanTotalItems: number;
  actionPlanCompletedItems: number;
  actionPlanOpenItems: number;
  actionPlanHighPriorityOpenItems: number;
  actionPlanProgressPercent: number;
  actionPlanLastUpdatedAt: string | null;
}

export interface ClientAccountLinkedContactResponse {
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

export interface ClientAccountContactAccountLinkResponse {
  relationId: string;
  clientAccountProfileId: string;
  clientClinicId: string;
  clientName: string;
  linkedAt: string;
}

export interface ClientAccountLinkedTaskResponse {
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
  templateKey: string | null;
  updatedAt: string;
}

export interface ClientAccountAcceptedProposalResponse {
  acceptanceId: string;
  proposalId: string;
  proposalName: string;
  proposalStatus: string;
  acceptanceStatus: string;
  acceptedAt: string;
  acceptedByName: string | null;
  acceptedByEmail: string | null;
  legalCompanyName: string | null;
  billingEmail: string | null;
  preferredStartDate: string | null;
  packageName: string | null;
  monthlyFeeCents: number | null;
  setupFeeCents: number | null;
  currency: string;
  paymentTerms: string | null;
  evidenceSha256: string | null;
  lockedAt: string | null;
}

export interface ClientAccountLinkedRecordsResponse {
  account: ClientAccountProfileResponse;
  contacts: ClientAccountLinkedContactResponse[];
  openTasks: ClientAccountLinkedTaskResponse[];
  completedTasks: ClientAccountLinkedTaskResponse[];
  acceptedProposals: ClientAccountAcceptedProposalResponse[];
  counts: {
    contacts: number;
    openTasks: number;
    completedTasks: number;
    acceptedProposals: number;
  };
}

export type ClientAccountCommunicationChannel = "email" | "sms" | "whatsapp" | "call";

export interface ClientAccountCommunicationItemResponse {
  id: string;
  channel: ClientAccountCommunicationChannel;
  kind: "message" | "call";
  contactId: string;
  contactName: string;
  direction: string | null;
  status: string | null;
  subject: string | null;
  preview: string;
  body: string | null;
  transcript: string | null;
  aiSummary: string | null;
  recordingUrl: string | null;
  recordingStatus: string | null;
  hasRecording: boolean;
  hasTranscript: boolean;
  occurredAt: string;
}

export interface ClientAccountCommunicationHistoryResponse {
  account: ClientAccountProfileResponse;
  contacts: ClientAccountLinkedContactResponse[];
  items: ClientAccountCommunicationItemResponse[];
  counts: {
    email: number;
    sms: number;
    whatsapp: number;
    calls: number;
    recordings: number;
    transcripts: number;
    total: number;
  };
  aiContext: {
    summary: string;
    searchableText: string;
    transcriptCount: number;
    outstandingSignals: number;
    commitmentSignals: number;
    complaintSignals: number;
    decisionSignals: number;
  };
}

export interface ClientAccountDocumentLinkResponse {
  documentType: ClientDocumentType;
  label: string;
  driveItemId: string | null;
  driveUrl: string | null;
  displayName: string | null;
  status: ClientDocumentLinkStatus;
  accessStatus: "not_checked" | "accessible" | "inaccessible";
  accessError: string | null;
  checkedAt: string | null;
  notes: string | null;
  updatedAt: string | null;
}

export interface ClientAccountAccessItemResponse {
  itemType: ClientAccessItemType;
  label: string;
  status: ClientAccessItemStatus;
  isMissing: boolean;
  notes: string | null;
  requestedAt: string | null;
  receivedAt: string | null;
  updatedAt: string | null;
}

export interface ClientAccountAuditContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface CreateClientAccountServiceDTO {
  serviceType: ClientServiceType;
  name: string;
  status?: ClientServiceStatus;
  startDate?: string | null;
  renewalDate?: string | null;
  endDate?: string | null;
  ownerId?: string | null;
  recurringValue?: number | string | null;
  currency?: string;
  contractStatus?: ContractStatus;
  notes?: string | null;
}

export interface UpdateClientAccountServiceDTO {
  serviceType?: ClientServiceType;
  name?: string;
  status?: Exclude<ClientServiceStatus, "archived">;
  startDate?: string | null;
  renewalDate?: string | null;
  endDate?: string | null;
  ownerId?: string | null;
  recurringValue?: number | string | null;
  currency?: string;
  contractStatus?: ContractStatus;
  notes?: string | null;
}

export interface ClientAccountServiceResponse {
  id: string;
  clinicId: string;
  clientAccountProfileId: string;
  serviceType: ClientServiceType;
  name: string;
  status: ClientServiceStatus;
  startDate: string | null;
  renewalDate: string | null;
  endDate: string | null;
  owner: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  recurringValue: number | null;
  currency: string;
  contractStatus: ContractStatus;
  notes: string | null;
  archivedAt: string | null;
  updatedAt: string | null;
}

export interface ClientAccountServiceListQuery {
  includeArchived?: string | boolean;
  includeAllClinics?: string | boolean;
  status?: ClientServiceStatus;
  contractStatus?: ContractStatus;
  renewalFrom?: string;
  renewalTo?: string;
}

export interface ClientAccountListQuery {
  search?: string;
  healthStatus?: HealthStatus | "all";
  clientStatus?: ClientStatus | "all";
  churnRisk?: ChurnRisk | "all";
  contractStatus?: ContractStatus | "all";
}
