export type ClickUpConnectionStatus = "pending" | "connected" | "revoked" | "error";
export type ClickUpMappingStatus = "active" | "needs_review" | "archived";
export type ClickUpMappingSource = "manual" | "oauth_lookup" | "api_lookup";
export type ClickUpTaskSyncDirection = "mission_control_to_clickup" | "clickup_to_mission_control" | "manual";
export type ClickUpCategoryKey =
  | "development"
  | "seo"
  | "gmb_local_seo"
  | "ppc"
  | "managerial"
  | "reporting"
  | "account_control";

export interface ClickUpAuditContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ClickUpAccessContext {
  canManageAllClientAccounts: boolean;
}

export interface ClickUpConnectionResponse {
  id: string;
  workspaceId: string | null;
  workspaceName: string | null;
  status: ClickUpConnectionStatus;
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

export interface StartClickUpOAuthResponse {
  authorizeUrl: string;
  stateExpiresAt: string;
}

export interface CompleteClickUpOAuthDTO {
  code: string;
  state: string;
  workspaceId?: string | null;
}

export interface SaveClickUpClientMappingDTO {
  workspaceId: string;
  workspaceName?: string | null;
  connectionId?: string | null;
  spaceId?: string | null;
  folderId?: string | null;
  listId?: string | null;
  deliveryRootTaskId?: string | null;
  deliveryUrl?: string | null;
  mappingStatus?: ClickUpMappingStatus;
  mappingSource?: ClickUpMappingSource;
}

export interface ClickUpClientMappingResponse {
  id: string;
  clientAccountProfileId: string;
  clientClinicId: string;
  clientName: string;
  connectionId: string | null;
  workspaceId: string;
  workspaceName: string | null;
  spaceId: string | null;
  folderId: string | null;
  listId: string | null;
  deliveryRootTaskId: string | null;
  deliveryUrl: string | null;
  mappingStatus: ClickUpMappingStatus;
  mappingSource: ClickUpMappingSource;
  deterministic: boolean;
  updatedAt: string;
}

export interface SaveClickUpTaskMappingDTO {
  clientAccountProfileId: string;
  workspaceId: string;
  clickupTaskId: string;
  internalTaskId?: string | null;
  connectionId?: string | null;
  clickupListId?: string | null;
  clickupUrl?: string | null;
  syncDirection?: ClickUpTaskSyncDirection;
  mappingStatus?: ClickUpMappingStatus;
}

export interface ClickUpTaskMappingResponse {
  id: string;
  clientAccountProfileId: string;
  internalTaskId: string | null;
  connectionId: string | null;
  workspaceId: string;
  clickupTaskId: string;
  clickupListId: string | null;
  clickupUrl: string | null;
  syncDirection: ClickUpTaskSyncDirection;
  mappingStatus: ClickUpMappingStatus;
  updatedAt: string;
}

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

export interface SaveClickUpCategoryMappingDTO {
  workspaceId: string;
  spaceId: string;
  categoryKey: ClickUpCategoryKey;
  connectionId?: string | null;
  folderId?: string | null;
  listId: string;
  defaultAssigneeIds?: string[];
  mappingStatus?: ClickUpMappingStatus;
  mappingSource?: ClickUpMappingSource;
}

export interface ClickUpCategoryMappingResponse {
  id: string;
  clientAccountProfileId: string;
  connectionId: string | null;
  workspaceId: string;
  spaceId: string;
  categoryKey: ClickUpCategoryKey;
  folderId: string | null;
  listId: string;
  defaultAssigneeIds: string[];
  mappingStatus: ClickUpMappingStatus;
  mappingSource: ClickUpMappingSource;
  updatedAt: string;
}

export interface SaveClickUpPriorityMappingDTO {
  missionControlPriority: "low" | "medium" | "high" | "urgent";
  clickupPriority: 1 | 2 | 3 | 4;
}

export interface ClickUpPriorityMappingResponse {
  id: string;
  missionControlPriority: "low" | "medium" | "high" | "urgent";
  clickupPriority: 1 | 2 | 3 | 4;
  updatedAt: string;
}

export interface CreateClickUpTaskDTO {
  internalTaskId: string;
  categoryKey: ClickUpCategoryKey;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  assigneeIds?: string[];
  links?: Array<{ label?: string | null; url: string }>;
}
