export type CommandPaletteTargetType =
  | "route"
  | "api"
  | "clinic_switch";

export type CommandPaletteRecordType =
  | "contact"
  | "appointment"
  | "report"
  | "task"
  | "clinic";

export interface CommandPaletteQuery {
  query?: string;
  limit?: number;
  includeDisabled?: boolean;
}

export interface CommandPaletteAction {
  id: string;
  label: string;
  description: string;
  group: "create" | "navigate" | "switch" | "settings";
  keywords: string[];
  targetType: CommandPaletteTargetType;
  route?: string;
  api?: {
    method: "GET" | "POST" | "PATCH";
    path: string;
  };
  requiredPermission: string | null;
  enabled: boolean;
  disabledReason: string | null;
}

export interface CommandPaletteRecord {
  id: string;
  type: CommandPaletteRecordType;
  label: string;
  description: string | null;
  route: string;
  updatedAt: string | null;
  metadata: Record<string, unknown>;
}

export interface CommandPaletteClinic {
  id: string;
  name: string;
  role: string;
  status: string;
  isCurrent: boolean;
  targetType: "clinic_switch";
  api: {
    method: "POST";
    path: "/api/auth/switch-clinic";
    body: {
      clinicId: string;
    };
  };
}

export interface CommandPaletteResponse {
  query: string;
  actions: CommandPaletteAction[];
  commonActions: CommandPaletteAction[];
  records: CommandPaletteRecord[];
  recentRecords: CommandPaletteRecord[];
  clinics: CommandPaletteClinic[];
  permissions: Record<string, boolean>;
  emptyState: boolean;
}
