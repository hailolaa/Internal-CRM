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
  clickupListId: string | null;
  updatedAt: string;
}

export interface CreateClickUpTaskResult {
  mapping: ClickUpTaskMappingRecord;
  attachmentErrors: Array<{ filename: string; error: string }>;
}
