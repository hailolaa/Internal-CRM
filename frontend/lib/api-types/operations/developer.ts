export interface RoleRecord {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
}

export interface PermissionRecord {
  id: string;
  keyName: string;
  description: string | null;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
