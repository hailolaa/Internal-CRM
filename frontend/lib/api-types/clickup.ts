export type ClickUpConnectionStatusValue = "pending" | "connected" | "revoked" | "error";

export interface ClickUpConnectionRecord {
  id: string;
  workspaceId: string | null;
  workspaceName: string | null;
  status: ClickUpConnectionStatusValue;
  scopes: string[];
  connectedBy: string | null;
  connectedAt: string | null;
  revokedAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  tokenStored: boolean;
  refreshTokenStored: boolean;
  tokenExpiresAt: string | null;
  updatedAt: string;
}

export interface ClickUpIntegrationStatus {
  oauthConfigured: boolean;
  apiTokenConfigured: boolean;
  webhookConfigured?: boolean;
  connections: ClickUpConnectionRecord[];
  clientMappingCount: number;
  taskMappingCount: number;
}

export interface ClickUpOAuthStartRecord {
  authorizeUrl: string;
  stateExpiresAt: string;
}

export type ClickUpCategoryKey =
  | "development"
  | "seo"
  | "gmb_local_seo"
  | "ppc"
  | "managerial"
  | "reporting"
  | "account_control";

export interface ClickUpWorkspaceRecord {
  id: string;
  name: string;
}

export interface ClickUpSpaceRecord {
  id: string;
  name: string;
}

export interface ClickUpFolderRecord {
  id: string;
  name: string;
  hidden?: boolean;
}

export interface ClickUpListRecord {
  id: string;
  name: string;
  folderId: string | null;
  spaceId: string | null;
}

export interface ClickUpMemberRecord {
  id: string;
  username: string;
  email: string | null;
}

export interface ClickUpOperationsTaskAssignee {
  id: string;
  username: string;
  email: string | null;
}

export interface ClickUpOperationsTaskRecord {
  id: string;
  customId: string | null;
  title: string;
  url: string | null;
  status: string;
  statusType: string | null;
  priority: string | null;
  dueAt: string | null;
  updatedAt: string | null;
  listName: string | null;
  folderName: string | null;
  spaceName: string | null;
  workstream: string;
  assignees: ClickUpOperationsTaskAssignee[];
  tags: string[];
  isOverdue: boolean;
  isDueToday: boolean;
  isDueThisWeek: boolean;
  isHighPriority: boolean;
  isBlocked: boolean;
  isAwaitingMaxDecision: boolean;
  hasNoOwner: boolean;
  hasNoDeadline: boolean;
}

export interface ClickUpOperationsWorkloadRow {
  id: string;
  assignee: string;
  totalOpen: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  highPriority: number;
  blocked: number;
}

export interface ClickUpOperationsWorkstreamRow {
  id: string;
  label: string;
  totalOpen: number;
  overdue: number;
  dueThisWeek: number;
  highPriority: number;
  blocked: number;
}

export interface ClickUpOperationsDashboardRecord {
  generatedAt: string;
  workspaceName: string | null;
  source: {
    provider: "clickup";
    live: boolean;
    includeClosed: boolean;
    taskLimit: number;
    pagesFetched: number;
  };
  counts: {
    totalOpen: number;
    overdue: number;
    dueToday: number;
    dueThisWeek: number;
    highPriority: number;
    blocked: number;
    awaitingMaxDecision: number;
    noOwner: number;
    noDeadline: number;
  };
  queues: {
    overdue: ClickUpOperationsTaskRecord[];
    dueToday: ClickUpOperationsTaskRecord[];
    dueThisWeek: ClickUpOperationsTaskRecord[];
    highPriority: ClickUpOperationsTaskRecord[];
    blocked: ClickUpOperationsTaskRecord[];
    awaitingMaxDecision: ClickUpOperationsTaskRecord[];
    noOwner: ClickUpOperationsTaskRecord[];
    noDeadline: ClickUpOperationsTaskRecord[];
  };
  workloadByAssignee: ClickUpOperationsWorkloadRow[];
  workstreamCounts: ClickUpOperationsWorkstreamRow[];
}

export interface ClickUpCategoryMappingRecord {
  id: string;
  clientAccountProfileId: string;
  connectionId: string | null;
  workspaceId: string;
  spaceId: string;
  categoryKey: ClickUpCategoryKey;
  folderId: string | null;
  listId: string;
  defaultAssigneeIds: string[];
  mappingStatus: "active" | "needs_review" | "archived";
  mappingSource: "manual" | "oauth_lookup" | "api_lookup";
  updatedAt: string;
}

export interface ClickUpPriorityMappingRecord {
  id: string;
  missionControlPriority: "low" | "medium" | "high" | "urgent";
  clickupPriority: 1 | 2 | 3 | 4;
  updatedAt: string;
}

export interface ClickUpTaskCreatePayload {
  internalTaskId: string;
  categoryKey: ClickUpCategoryKey;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  assigneeIds?: string[];
  links?: Array<{ label?: string | null; url: string }>;
}

export interface ClickUpTaskMappingRecord {
  id: string;
  clientAccountProfileId: string;
  internalTaskId: string | null;
  connectionId: string | null;
  workspaceId: string;
  clickupTaskId: string;
  clickupListId: string | null;
  clickupUrl: string | null;
  syncDirection: "mission_control_to_clickup" | "clickup_to_mission_control" | "manual";
  mappingStatus: "active" | "needs_review" | "archived";
  updatedAt: string;
}

export interface FailedTaskMapping {
  id: string;
  internalTaskId: string | null;
  internalTaskTitle: string | null;
  clientAccountProfileId: string;
  clientClinicId: string;
  clientName: string;
  clientDataState: string;
  clientDataStateLabel: string | null;
  clickupListId: string | null;
  updatedAt: string;
}

export type ClickUpWebhookProcessingStatus =
  | "queued"
  | "processing"
  | "processed"
  | "duplicate"
  | "stale"
  | "quarantined"
  | "retrying"
  | "dead_letter"
  | "failed"
  | "ignored";

export type ClickUpSyncHealthStatus =
  | "healthy"
  | "delayed"
  | "retrying"
  | "dead_letter"
  | "disconnected"
  | "reconciliation_needed";

export interface ClickUpSyncHealthRecord {
  id: string;
  clientAccountProfileId: string;
  clientClinicId: string | null;
  clientName: string;
  clientDataState: string;
  clientDataStateLabel: string | null;
  workspaceId: string;
  clickupListId: string | null;
  syncStatus: ClickUpSyncHealthStatus;
  lastEventAt: string | null;
  lastProcessedEventAt: string | null;
  lastReconciledAt: string | null;
  lastError: string | null;
  retryingCount: number;
  deadLetterCount: number;
  updatedAt: string;
}

export interface ClickUpWebhookEventRecord {
  id: string;
  providerEventKey: string;
  providerEventType: string;
  clickupTaskId: string | null;
  clientAccountProfileId: string | null;
  clientName: string | null;
  clientDataState: string | null;
  clientDataStateLabel: string | null;
  processingStatus: ClickUpWebhookProcessingStatus;
  retryCount: number;
  nextRetryAt: string | null;
  errorClass: string | null;
  errorMessage: string | null;
  receivedAt: string;
  processedAt: string | null;
}

export interface ClickUpReconciliationResponse {
  syncHealth: ClickUpSyncHealthRecord[];
  failedTaskMappings: FailedTaskMapping[];
  deadLetterEvents: ClickUpWebhookEventRecord[];
}

export interface ClickUpReconciliationRunResult {
  checked: number;
  updated: number;
  failed: number;
  queuedForReview: number;
}

export interface CreateClickUpTaskResult {
  mapping: ClickUpTaskMappingRecord;
  attachmentErrors: Array<{ filename: string; error: string }>;
}
