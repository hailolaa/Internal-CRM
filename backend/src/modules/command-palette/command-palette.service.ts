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
    label: "Add lead",
    description: "Create a new prospect or internal sales lead.",
    group: "create",
    keywords: ["prospect", "lead", "contact", "enquiry", "new"],
    targetType: "route",
    route: "/app/crm/contacts/new?mode=lead",
    api: { method: "POST", path: "/api/contacts" },
    requiredPermission: "contacts:write",
  },
  {
    id: "create_contact",
    label: "Add contact",
    description: "Create a contact linked to a prospect or client account.",
    group: "create",
    keywords: ["contact", "person", "stakeholder", "new"],
    targetType: "route",
    route: "/app/crm/contacts/new?mode=contact",
    api: { method: "POST", path: "/api/contacts" },
    requiredPermission: "contacts:write",
  },
  {
    id: "create_client_account",
    label: "Add client account",
    description: "Create a new internal client/account record.",
    group: "create",
    keywords: ["client", "account", "customer", "new"],
    targetType: "route",
    route: "/app/ops/client-accounts/new",
    api: { method: "POST", path: "/api/client-accounts" },
    requiredPermission: "client_accounts:write",
  },
  {
    id: "create_task",
    label: "Create task",
    description: "Open the task creation workflow.",
    group: "create",
    keywords: ["task", "todo", "follow up"],
    targetType: "route",
    route: "/app/crm/tasks/new",
    api: { method: "POST", path: "/api/tasks/internal" },
    requiredPermission: "internal_tasks:write",
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
    label: "Open operations dashboard",
    description: "View leads, clients, projects, overdue tasks, and upcoming deadlines.",
    group: "navigate",
    keywords: ["dashboard", "operations", "tasks", "clients", "pipeline"],
    targetType: "route",
    route: "/app",
    requiredPermission: null,
  },
  {
    id: "switch_clinic",
    label: "Switch workspace",
    description: "Choose another internal workspace available to your user.",
    group: "switch",
    keywords: ["switch", "workspace", "tenant", "account"],
    targetType: "clinic_switch",
    route: "/app",
    api: { method: "POST", path: "/api/auth/switch-clinic" },
    requiredPermission: null,
  },
  {
    id: "open_settings",
    label: "Open settings",
    description: "Open internal CRM settings.",
    group: "settings",
    keywords: ["settings", "account", "workspace", "team"],
    targetType: "route",
    route: "/app/settings",
    requiredPermission: "settings:read",
  },
];

const PERMISSIONS = Array.from(new Set([
  ...ACTIONS.map((action) => action.requiredPermission).filter(Boolean),
  "internal_tasks:read",
  "client_accounts:read",
])) as string[];

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
      commonActions: actions.filter((action) => [
        "create_lead",
        "create_client_account",
        "create_contact",
        "create_task",
        "open_reports",
      ].includes(action.id)),
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
    const perTypeLimit = Math.max(3, Math.ceil(limit / 4));
    const like = `%${search}%`;

    if (permissions["contacts:read"]) {
      records.push(...await this.searchContacts(clinicId, like, perTypeLimit));
      records.push(...await this.searchProposals(clinicId, like, perTypeLimit));
    }

    if (permissions["client_accounts:read"]) {
      records.push(...await this.searchClientAccounts(clinicId, like, perTypeLimit));
    }

    if (permissions["internal_tasks:read"]) {
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
    const perTypeLimit = Math.max(2, Math.ceil(limit / 4));

    if (permissions["contacts:read"]) {
      records.push(...await this.searchContacts(clinicId, "%", perTypeLimit));
      records.push(...await this.searchProposals(clinicId, "%", perTypeLimit));
    }
    if (permissions["client_accounts:read"]) {
      records.push(...await this.searchClientAccounts(clinicId, "%", perTypeLimit));
    }
    if (permissions["internal_tasks:read"]) {
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
              account_name as accountName,
              website,
              source,
              status,
              lead_status as leadStatus,
              package_interest as packageInterest,
              recommended_package as recommendedPackage,
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
           OR account_name LIKE ?
           OR website LIKE ?
           OR source LIKE ?
           OR status LIKE ?
           OR lead_status LIKE ?
           OR package_interest LIKE ?
           OR recommended_package LIKE ?
         )
       ORDER BY updated_at DESC
       LIMIT ${limit}`,
      [clinicId, like, like, like, like, like, like, like, like, like, like, like, like],
    );

    return rows.map((row: any) => ({
      id: row.id,
      type: this.isLeadRecord(row) ? "lead" : "contact",
      label: row.name || row.email || row.phone || "Unnamed contact",
      description: [row.accountName, row.leadStatus || row.status, row.packageInterest, row.source, row.email].filter(Boolean).join(" - ") || null,
      route: `/app/crm/contacts/detail?id=${encodeURIComponent(row.id)}`,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      metadata: {
        accountName: row.accountName || null,
        email: row.email || null,
        phone: row.phone || null,
        website: row.website || null,
        source: row.source || null,
        status: row.status || null,
        leadStatus: row.leadStatus || null,
        packageInterest: row.packageInterest || null,
        recommendedPackage: row.recommendedPackage || null,
      },
    }));
  }

  private isLeadRecord(row: any) {
    const status = String(row.status || "").toLowerCase();
    const leadStatus = String(row.leadStatus || "").toLowerCase();
    return status === "lead" || Boolean(leadStatus && leadStatus !== "converted");
  }

  private async searchClientAccounts(clinicId: string, like: string, limit: number): Promise<CommandPaletteRecord[]> {
    const [rows]: any = await pool.execute(
      `SELECT c.id as clinicId,
              c.name as clinicName,
              c.email,
              c.phone,
              c.website,
              c.city,
              c.country,
              COALESCE(cap.id, c.id) as id,
              cap.client_status as clientStatus,
              cap.current_package as currentPackage,
              cap.contract_status as contractStatus,
              cap.updated_at as profileUpdatedAt,
              c.updated_at as clinicUpdatedAt
       FROM clinic c
       LEFT JOIN client_account_profile cap
         ON cap.clinic_id = c.id
       WHERE c.id = ?
         AND c.deleted_at IS NULL
         AND (
           ? = '%'
           OR c.name LIKE ?
           OR c.email LIKE ?
           OR c.phone LIKE ?
           OR c.website LIKE ?
           OR c.city LIKE ?
           OR c.country LIKE ?
           OR cap.current_package LIKE ?
           OR cap.client_status LIKE ?
           OR cap.contract_status LIKE ?
         )
       ORDER BY COALESCE(cap.updated_at, c.updated_at) DESC
       LIMIT ${limit}`,
      [clinicId, like, like, like, like, like, like, like, like, like, like],
    );

    return rows.map((row: any) => ({
      id: row.id,
      type: "client_account",
      label: row.clinicName || "Unnamed client account",
      description: [row.clientStatus, row.currentPackage, row.city || row.country].filter(Boolean).join(" - ") || null,
      route: `/app/ops/client-accounts/detail?id=${encodeURIComponent(row.clinicId)}`,
      updatedAt: row.profileUpdatedAt
        ? new Date(row.profileUpdatedAt).toISOString()
        : row.clinicUpdatedAt
          ? new Date(row.clinicUpdatedAt).toISOString()
          : null,
      metadata: {
        clinicId: row.clinicId,
        email: row.email || null,
        phone: row.phone || null,
        website: row.website || null,
        clientStatus: row.clientStatus || null,
        currentPackage: row.currentPackage || null,
        contractStatus: row.contractStatus || null,
      },
    }));
  }

  private async searchProposals(clinicId: string, like: string, limit: number): Promise<CommandPaletteRecord[]> {
    const [rows]: any = await pool.execute(
      `SELECT p.id,
              p.proposal_name as title,
              p.contact_id as contactId,
              p.deal_id as dealId,
              p.package_name as packageName,
              p.status,
              p.value,
              p.follow_up_at as followUpAt,
              p.updated_at as updatedAt,
              TRIM(CONCAT_WS(' ', c.first_name, c.last_name)) as contactName,
              c.account_name as accountName,
              c.email as contactEmail,
              d.title as dealTitle
       FROM proposal p
       JOIN contact c
         ON c.id = p.contact_id
        AND c.clinic_id = p.clinic_id
        AND c.deleted_at IS NULL
       LEFT JOIN deal d
         ON d.id = p.deal_id
        AND d.clinic_id = p.clinic_id
        AND d.deleted_at IS NULL
       WHERE p.clinic_id = ?
         AND p.deleted_at IS NULL
         AND p.status <> 'archived'
         AND (
           ? = '%'
           OR p.proposal_name LIKE ?
           OR p.package_name LIKE ?
           OR p.status LIKE ?
           OR c.first_name LIKE ?
           OR c.last_name LIKE ?
           OR c.account_name LIKE ?
           OR c.email LIKE ?
           OR d.title LIKE ?
         )
       ORDER BY p.updated_at DESC
       LIMIT ${limit}`,
      [clinicId, like, like, like, like, like, like, like, like, like],
    );

    return rows.map((row: any) => ({
      id: row.id,
      type: "proposal",
      label: row.title || `${row.contactName || "Prospect"} proposal`,
      description: [row.accountName, row.contactName, row.packageName, row.status].filter(Boolean).join(" - ") || null,
      route: row.dealId
        ? `/app/crm/pipeline?deal=${encodeURIComponent(row.dealId)}&contactId=${encodeURIComponent(row.contactId)}&view=proposals&proposal=${encodeURIComponent(row.id)}`
        : `/app/crm/contacts/detail?id=${encodeURIComponent(row.contactId)}&view=proposals&proposal=${encodeURIComponent(row.id)}`,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      metadata: {
        contactId: row.contactId,
        dealId: row.dealId || null,
        contactName: row.contactName || null,
        accountName: row.accountName || null,
        packageName: row.packageName || null,
        status: row.status || null,
        followUpAt: row.followUpAt || null,
        value: row.value || null,
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
      description: [row.type, row.description].filter(Boolean).join(" - ") || null,
      route: "/app",
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
      label: `${row.treatment || "Delivery"} event`,
      description: [row.contactName, row.status, row.dateTime ? new Date(row.dateTime).toISOString() : null].filter(Boolean).join(" - ") || null,
      route: "/app/ops/delivery",
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
         AND is_internal = 1
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
      description: [row.status, row.priority, row.contactName].filter(Boolean).join(" - ") || null,
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
