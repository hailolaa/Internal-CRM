import pool from "../../config/database.js";
import { userHasPermission } from "../../middleware/authorize.js";
import { authService } from "../auth/auth.service.js";
import type {
  CommandPaletteAction,
  CommandPaletteClinic,
  CommandPaletteQuery,
  CommandPaletteRecord,
  CommandPaletteResponse,
} from "./command-palette.types.js";

const ACTIONS: Array<Omit<CommandPaletteAction, "enabled" | "disabledReason">> = [
  {
    id: "create_lead",
    label: "Create lead",
    description: "Open the lead creation workflow.",
    group: "create",
    keywords: ["lead", "contact", "enquiry", "new"],
    targetType: "route",
    route: "/app/crm/contacts/new",
    api: { method: "POST", path: "/api/contacts" },
    requiredPermission: "contacts:write",
  },
  {
    id: "log_call",
    label: "Log call",
    description: "Open the call logging workflow.",
    group: "create",
    keywords: ["call", "phone", "outcome"],
    targetType: "route",
    route: "/app/comms/calls?log=1",
    requiredPermission: "calls:write",
  },
  {
    id: "create_booking",
    label: "Create booking",
    description: "Open the appointment booking workflow.",
    group: "create",
    keywords: ["booking", "appointment", "consult", "calendar"],
    targetType: "route",
    route: "/app/crm/calendar/new",
    api: { method: "POST", path: "/api/appointments" },
    requiredPermission: "appointments:write",
  },
  {
    id: "create_task",
    label: "Create task",
    description: "Open the task creation workflow.",
    group: "create",
    keywords: ["task", "todo", "follow up"],
    targetType: "route",
    route: "/app/crm/tasks/new",
    api: { method: "POST", path: "/api/tasks" },
    requiredPermission: "events:write",
  },
  {
    id: "search_contacts",
    label: "Search contacts",
    description: "Search the lead and contact inbox.",
    group: "navigate",
    keywords: ["contact", "lead", "search", "inbox"],
    targetType: "route",
    route: "/app/crm/contacts",
    api: { method: "GET", path: "/api/contacts" },
    requiredPermission: "contacts:read",
  },
  {
    id: "open_reports",
    label: "Open reports",
    description: "Open the performance dashboard and saved reports.",
    group: "navigate",
    keywords: ["report", "dashboard", "revenue", "performance"],
    targetType: "route",
    route: "/app/reports/overview",
    api: { method: "GET", path: "/api/reports/dashboard/summary" },
    requiredPermission: "reports:read",
  },
  {
    id: "switch_clinic",
    label: "Switch clinic",
    description: "Choose another clinic available to your user.",
    group: "switch",
    keywords: ["switch", "clinic", "tenant", "account"],
    targetType: "clinic_switch",
    route: "/app",
    api: { method: "POST", path: "/api/auth/switch-clinic" },
    requiredPermission: null,
  },
  {
    id: "open_settings",
    label: "Open settings",
    description: "Open clinic and account settings.",
    group: "settings",
    keywords: ["settings", "account", "clinic", "team"],
    targetType: "route",
    route: "/app/settings",
    requiredPermission: "settings:read",
  },
];

const PERMISSIONS = Array.from(new Set([
  ...ACTIONS.map((action) => action.requiredPermission).filter(Boolean),
  "appointments:read",
  "events:read",
])) as string[];

function getReportRoute(type: unknown) {
  const reportType = String(type || "").toLowerCase();
  if (reportType.includes("lead")) return "/app/reports/leads";
  if (reportType.includes("ad") || reportType.includes("roas")) return "/app/reports/ads";
  if (reportType.includes("no-show") || reportType.includes("noshow")) return "/app/reports/noshows";
  if (reportType.includes("attribution")) return "/app/marketing/attribution";
  return "/app/reports/overview";
}

export class CommandPaletteService {
  async getCommandPalette(
    clinicId: string,
    userId: string,
    query: CommandPaletteQuery = {},
  ): Promise<CommandPaletteResponse> {
    const search = String(query.query || "").trim();
    const limit = Math.min(25, Math.max(1, Number(query.limit) || 8));
    const permissions = await this.getPermissions(userId, clinicId);
    const actions = this.getActions(permissions, search, query.includeDisabled === true);
    const [records, recentRecords, clinics] = await Promise.all([
      this.searchRecords(clinicId, search, limit, permissions),
      this.getRecentRecords(clinicId, limit, permissions),
      this.getClinics(userId, clinicId),
    ]);

    return {
      query: search,
      actions,
      commonActions: actions.filter((action) => ["create_lead", "create_booking", "create_task", "open_reports"].includes(action.id)),
      records,
      recentRecords,
      clinics,
      permissions,
      emptyState: actions.length === 0 && records.length === 0 && recentRecords.length === 0 && clinics.length === 0,
    };
  }

  private async getPermissions(userId: string, clinicId: string) {
    const result: Record<string, boolean> = {};
    await Promise.all(PERMISSIONS.map(async (permission) => {
      result[permission] = await userHasPermission(userId, clinicId, permission);
    }));
    return result;
  }

  private getActions(permissions: Record<string, boolean>, search: string, includeDisabled: boolean) {
    const lowerSearch = search.toLowerCase();
    return ACTIONS.map((action) => {
      const enabled = !action.requiredPermission || permissions[action.requiredPermission] === true;
      return {
        ...action,
        enabled,
        disabledReason: enabled ? null : `Missing ${action.requiredPermission}`,
      };
    }).filter((action) => {
      if (!includeDisabled && !action.enabled) return false;
      if (!lowerSearch) return true;
      const haystack = [
        action.label,
        action.description,
        action.group,
        ...action.keywords,
      ].join(" ").toLowerCase();
      return haystack.includes(lowerSearch);
    });
  }

  private async searchRecords(
    clinicId: string,
    search: string,
    limit: number,
    permissions: Record<string, boolean>,
  ) {
    if (!search) return [];

    const records: CommandPaletteRecord[] = [];
    const perTypeLimit = Math.max(3, Math.ceil(limit / 2));
    const like = `%${search}%`;

    if (permissions["contacts:read"]) {
      records.push(...await this.searchContacts(clinicId, like, perTypeLimit));
    }

    if (permissions["reports:read"]) {
      records.push(...await this.searchReports(clinicId, like, perTypeLimit));
    }

    if (permissions["appointments:read"]) {
      records.push(...await this.searchAppointments(clinicId, like, perTypeLimit));
    }

    if (permissions["events:read"]) {
      records.push(...await this.searchTasks(clinicId, like, perTypeLimit));
    }

    return records
      .sort((a, b) => Date.parse(b.updatedAt || "1970-01-01") - Date.parse(a.updatedAt || "1970-01-01"))
      .slice(0, limit);
  }

  private async getRecentRecords(
    clinicId: string,
    limit: number,
    permissions: Record<string, boolean>,
  ) {
    const records: CommandPaletteRecord[] = [];
    const perTypeLimit = Math.max(2, Math.ceil(limit / 3));

    if (permissions["contacts:read"]) {
      records.push(...await this.searchContacts(clinicId, "%", perTypeLimit));
    }
    if (permissions["reports:read"]) {
      records.push(...await this.searchReports(clinicId, "%", perTypeLimit));
    }
    if (permissions["events:read"]) {
      records.push(...await this.searchTasks(clinicId, "%", perTypeLimit));
    }

    return records
      .sort((a, b) => Date.parse(b.updatedAt || "1970-01-01") - Date.parse(a.updatedAt || "1970-01-01"))
      .slice(0, limit);
  }

  private async searchContacts(clinicId: string, like: string, limit: number): Promise<CommandPaletteRecord[]> {
    const [rows]: any = await pool.execute(
      `SELECT id,
              TRIM(CONCAT_WS(' ', first_name, last_name)) as name,
              email,
              phone,
              source,
              status,
              updated_at as updatedAt
       FROM contact
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         AND (
           ? = '%'
           OR first_name LIKE ?
           OR last_name LIKE ?
           OR email LIKE ?
           OR phone LIKE ?
           OR source LIKE ?
           OR status LIKE ?
         )
       ORDER BY updated_at DESC
       LIMIT ${limit}`,
      [clinicId, like, like, like, like, like, like, like],
    );

    return rows.map((row: any) => ({
      id: row.id,
      type: "contact",
      label: row.name || row.email || row.phone || "Unnamed contact",
      description: [row.status, row.source, row.email].filter(Boolean).join(" · ") || null,
      route: `/app/crm/contacts/detail?id=${encodeURIComponent(row.id)}`,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      metadata: {
        email: row.email || null,
        phone: row.phone || null,
        source: row.source || null,
        status: row.status || null,
      },
    }));
  }

  private async searchReports(clinicId: string, like: string, limit: number): Promise<CommandPaletteRecord[]> {
    const [rows]: any = await pool.execute(
      `SELECT id,
              name,
              type,
              description,
              updated_at as updatedAt
       FROM report
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         AND (
           ? = '%'
           OR name LIKE ?
           OR type LIKE ?
           OR description LIKE ?
         )
       ORDER BY updated_at DESC
       LIMIT ${limit}`,
      [clinicId, like, like, like, like],
    );

    return rows.map((row: any) => ({
      id: row.id,
      type: "report",
      label: row.name,
      description: [row.type, row.description].filter(Boolean).join(" · ") || null,
      route: getReportRoute(row.type),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      metadata: {
        reportType: row.type || null,
      },
    }));
  }

  private async searchAppointments(clinicId: string, like: string, limit: number): Promise<CommandPaletteRecord[]> {
    const [rows]: any = await pool.execute(
      `SELECT a.id,
              a.status,
              a.treatment,
              a.date_time as dateTime,
              a.updated_at as updatedAt,
              TRIM(CONCAT_WS(' ', c.first_name, c.last_name)) as contactName
       FROM appointment a
       JOIN contact c
         ON c.id = a.contact_id
        AND c.clinic_id = a.clinic_id
        AND c.deleted_at IS NULL
       WHERE a.clinic_id = ?
         AND a.deleted_at IS NULL
         AND (
           ? = '%'
           OR a.treatment LIKE ?
           OR a.status LIKE ?
           OR c.first_name LIKE ?
           OR c.last_name LIKE ?
           OR c.email LIKE ?
         )
       ORDER BY a.updated_at DESC
       LIMIT ${limit}`,
      [clinicId, like, like, like, like, like, like],
    );

    return rows.map((row: any) => ({
      id: row.id,
      type: "appointment",
      label: `${row.treatment || "Consult"} booking`,
      description: [row.contactName, row.status, row.dateTime ? new Date(row.dateTime).toISOString() : null].filter(Boolean).join(" · ") || null,
      route: `/app/crm/calendar?appointmentId=${encodeURIComponent(row.id)}`,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      metadata: {
        status: row.status || null,
        treatment: row.treatment || null,
      },
    }));
  }

  private async searchTasks(clinicId: string, like: string, limit: number): Promise<CommandPaletteRecord[]> {
    const [rows]: any = await pool.execute(
      `SELECT id,
              title,
              status,
              priority,
              contact_name as contactName,
              updated_at as updatedAt
       FROM task
       WHERE clinic_id = ?
         AND is_internal = 0
         AND deleted_at IS NULL
         AND (
           ? = '%'
           OR title LIKE ?
           OR contact_name LIKE ?
           OR status LIKE ?
           OR priority LIKE ?
         )
       ORDER BY updated_at DESC
       LIMIT ${limit}`,
      [clinicId, like, like, like, like, like],
    );

    return rows.map((row: any) => ({
      id: row.id,
      type: "task",
      label: row.title,
      description: [row.status, row.priority, row.contactName].filter(Boolean).join(" · ") || null,
      route: `/app/crm/tasks?taskId=${encodeURIComponent(row.id)}`,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      metadata: {
        status: row.status || null,
        priority: row.priority || null,
      },
    }));
  }

  private async getClinics(userId: string, currentClinicId: string): Promise<CommandPaletteClinic[]> {
    const clinics = await authService.listClinics(userId);
    return clinics.map((clinic) => ({
      id: clinic.id,
      name: clinic.name,
      role: clinic.role,
      status: clinic.status,
      isCurrent: clinic.id === currentClinicId,
      targetType: "clinic_switch",
      api: {
        method: "POST",
        path: "/api/auth/switch-clinic",
        body: {
          clinicId: clinic.id,
        },
      },
    }));
  }
}

export const commandPaletteService = new CommandPaletteService();
