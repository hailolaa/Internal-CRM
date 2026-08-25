import pool, { getDatabaseHealth } from "../../config/database.js";
import { config } from "../../config/index.js";
import { userCanManageAllClientAccounts } from "../../middleware/authorize.js";
import { getReleaseInfo } from "../../utils/releaseInfo.js";
import { ApiError } from "../../utils/ApiError.js";
import type {
  MissionControlProvenance,
  MissionControlRecordType,
  MissionControlSearchQuery,
  MissionControlSearchResponse,
  MissionControlSearchResult,
  MissionControlUserContext,
} from "./mission-control-api.types.js";

const supportedTypes: MissionControlRecordType[] = [
  "contact",
  "client_account",
  "proposal",
  "task",
  "opportunity",
];

const tools = [
  {
    name: "search",
    title: "Search Mission Control",
    description: "Search tenant-scoped Mission Control contacts, client accounts, proposals, tasks and opportunities.",
    readOnlyHint: true,
    destructiveHint: false,
  },
  {
    name: "fetch",
    title: "Fetch Mission Control record",
    description: "Fetch one tenant-scoped Mission Control record by type and stable ID.",
    readOnlyHint: true,
    destructiveHint: false,
  },
];

function iso(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function cleanQuery(value?: string) {
  return String(value || "").trim().slice(0, 120);
}

function cleanLimit(value?: number) {
  const parsed = Number(value || 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(Math.max(Math.floor(parsed), 1), 25);
}

function cleanOffset(cursor?: string | null) {
  if (!cursor) return 0;
  const parsed = Number.parseInt(cursor, 10);
  if (!Number.isFinite(parsed) || parsed < 0) throw ApiError.badRequest("Invalid cursor");
  return parsed;
}

function cleanTypes(types?: MissionControlRecordType[]) {
  if (!types || types.length === 0) return supportedTypes;
  const unknown = types.filter((type) => !supportedTypes.includes(type));
  if (unknown.length > 0) throw ApiError.badRequest(`Unsupported search type: ${unknown.join(", ")}`);
  return Array.from(new Set(types));
}

function like(query: string) {
  return `%${query.replace(/[%_]/g, "\\$&")}%`;
}

function provenance(input: {
  id?: string;
  url?: string;
  updatedAt?: unknown;
  dataState?: MissionControlProvenance["dataState"];
  source?: MissionControlProvenance["source"];
} = {}): MissionControlProvenance {
  const output: MissionControlProvenance = {
    source: input.source || "mission_control_database",
    lastSourceUpdate: iso(input.updatedAt),
    lastSyncAt: null,
    dataState: input.dataState || "live",
  };
  if (input.id) output.recordId = input.id;
  if (input.url) output.recordUrl = input.url;
  return output;
}

function result(row: {
  id: string;
  type: MissionControlRecordType;
  title: string;
  summary?: string | null;
  url: string;
  updatedAt?: unknown;
  dataState?: MissionControlProvenance["dataState"];
  metadata?: Record<string, unknown>;
}): MissionControlSearchResult {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    summary: row.summary || "",
    url: row.url,
    sourceId: row.id,
    provenance: provenance({
      id: row.id,
      url: row.url,
      updatedAt: row.updatedAt,
      ...(row.dataState ? { dataState: row.dataState } : {}),
    }),
    metadata: row.metadata || {},
  };
}

export class MissionControlApiService {
  async getHealth() {
    const database = await getDatabaseHealth();
    return {
      ok: database.ok,
      service: "mission-control-api",
      apiVersion: "v1",
      environment: config.nodeEnv,
      database,
      capabilities: ["health", "version", "capabilities", "search", "mcp_search", "mcp_fetch"],
      provenance: provenance({ source: "runtime_config", dataState: "not_applicable" }),
    };
  }

  getVersion() {
    return {
      service: "mission-control-api",
      apiVersion: "v1",
      release: getReleaseInfo(),
      provenance: provenance({ source: "runtime_config", dataState: "not_applicable" }),
    };
  }

  getCapabilities() {
    return {
      apiVersion: "v1",
      endpoints: [
        { method: "GET", path: "/api/v1/health", scope: "mission_control_api:read" },
        { method: "GET", path: "/api/v1/version", scope: "mission_control_api:read" },
        { method: "GET", path: "/api/v1/capabilities", scope: "mission_control_api:read" },
        { method: "GET", path: "/api/v1/search", scope: "mission_control_api:read" },
        { method: "GET", path: "/api/v1/records/:type/:id", scope: "mission_control_api:read" },
        { method: "POST", path: "/mcp", scope: "mission_control_mcp:read" },
      ],
      recordTypes: supportedTypes,
      tools,
      writePolicy: {
        currentPhase: "read_only",
        externalActionsEnabled: false,
        controlledWritesEnabled: false,
      },
      provenance: provenance({ source: "runtime_config", dataState: "not_applicable" }),
    };
  }

  async search(user: MissionControlUserContext, query: MissionControlSearchQuery): Promise<MissionControlSearchResponse> {
    const q = cleanQuery(query.query);
    const limit = cleanLimit(query.limit);
    const offset = cleanOffset(query.cursor);
    const types = cleanTypes(query.types);
    const perTypeLimit = Math.min(limit + offset, 50);
    const results: MissionControlSearchResult[] = [];

    if (types.includes("contact")) {
      const params = q ? [user.clinicId, like(q), like(q), like(q), like(q)] : [user.clinicId];
      const [rows]: any = await pool.execute(
        `SELECT id, first_name as firstName, last_name as lastName, account_name as accountName,
                email, phone, status, lead_status as leadStatus, source, updated_at as updatedAt
         FROM contact
         WHERE clinic_id = ?
           AND deleted_at IS NULL
           ${q ? "AND (first_name LIKE ? OR last_name LIKE ? OR account_name LIKE ? OR email LIKE ?)" : ""}
         ORDER BY updated_at DESC, created_at DESC
         LIMIT ${perTypeLimit}`,
        params,
      );
      results.push(...rows.map((row: any) => result({
        id: row.id,
        type: "contact",
        title: [row.firstName, row.lastName].filter(Boolean).join(" ") || row.accountName || row.email || "Contact",
        summary: [row.accountName, row.leadStatus, row.source].filter(Boolean).join(" | "),
        url: `/app/crm/contacts/detail?id=${row.id}`,
        updatedAt: row.updatedAt,
        metadata: { status: row.status, leadStatus: row.leadStatus, source: row.source },
      })));
    }

    if (types.includes("client_account")) {
      const canManageAllClientAccounts = await userCanManageAllClientAccounts(user.userId, user.clinicId);
      const scopeFilter = canManageAllClientAccounts ? "" : "AND cap.clinic_id = ?";
      const params = q
        ? [like(q), ...(canManageAllClientAccounts ? [] : [user.clinicId])]
        : [...(canManageAllClientAccounts ? [] : [user.clinicId])];
      const [rows]: any = await pool.execute(
        `SELECT cap.id, cap.clinic_id as clientClinicId, c.name, cap.client_status as clientStatus,
                cap.health_status as healthStatus, cap.current_package as currentPackage,
                c.data_state as dataState, cap.updated_at as updatedAt
         FROM client_account_profile cap
         INNER JOIN clinic c ON c.id = cap.clinic_id AND c.deleted_at IS NULL
         WHERE ${q ? "c.name LIKE ? " : "1 = 1 "}
           ${scopeFilter}
         ORDER BY cap.updated_at DESC
         LIMIT ${perTypeLimit}`,
        params,
      );
      results.push(...rows.map((row: any) => result({
        id: row.id,
        type: "client_account",
        title: row.name || "Client account",
        summary: [row.clientStatus, row.healthStatus, row.currentPackage].filter(Boolean).join(" | "),
        url: `/app/ops/client-accounts/detail?id=${row.id}`,
        updatedAt: row.updatedAt,
        dataState: row.dataState || "live",
        metadata: { clientClinicId: row.clientClinicId, clientStatus: row.clientStatus, healthStatus: row.healthStatus },
      })));
    }

    if (types.includes("proposal")) {
      const params = q ? [user.clinicId, like(q), like(q)] : [user.clinicId];
      const [rows]: any = await pool.execute(
        `SELECT id, proposal_name as proposalName, package_name as packageName, status, value, currency, updated_at as updatedAt
         FROM proposal
         WHERE clinic_id = ?
           AND deleted_at IS NULL
           ${q ? "AND (proposal_name LIKE ? OR package_name LIKE ?)" : ""}
         ORDER BY updated_at DESC
         LIMIT ${perTypeLimit}`,
        params,
      );
      results.push(...rows.map((row: any) => result({
        id: row.id,
        type: "proposal",
        title: row.proposalName,
        summary: [row.status, row.packageName, row.currency && row.value ? `${row.currency} ${row.value}` : null].filter(Boolean).join(" | "),
        url: `/app/crm/proposals/edit?id=${row.id}`,
        updatedAt: row.updatedAt,
        metadata: { status: row.status, packageName: row.packageName, value: row.value, currency: row.currency },
      })));
    }

    if (types.includes("task")) {
      const params = q ? [user.clinicId, like(q), like(q)] : [user.clinicId];
      const [rows]: any = await pool.execute(
        `SELECT id, title, status, priority, due_date as dueDate, board_key as boardKey, updated_at as updatedAt
         FROM task
         WHERE clinic_id = ?
           AND is_internal = 1
           AND deleted_at IS NULL
           AND archived_at IS NULL
           ${q ? "AND (title LIKE ? OR description LIKE ?)" : ""}
         ORDER BY updated_at DESC
         LIMIT ${perTypeLimit}`,
        params,
      );
      results.push(...rows.map((row: any) => result({
        id: row.id,
        type: "task",
        title: row.title,
        summary: [row.status, row.priority, row.boardKey].filter(Boolean).join(" | "),
        url: `/app/crm/tasks?id=${row.id}`,
        updatedAt: row.updatedAt,
        metadata: { status: row.status, priority: row.priority, dueDate: iso(row.dueDate), boardKey: row.boardKey },
      })));
    }

    if (types.includes("opportunity")) {
      const params = q ? [user.clinicId, like(q), like(q)] : [user.clinicId];
      const [rows]: any = await pool.execute(
        `SELECT id, title, stage, status, value, source, updated_at as updatedAt
         FROM deal
         WHERE clinic_id = ?
           AND deleted_at IS NULL
           ${q ? "AND (title LIKE ? OR stage LIKE ?)" : ""}
         ORDER BY updated_at DESC
         LIMIT ${perTypeLimit}`,
        params,
      );
      results.push(...rows.map((row: any) => result({
        id: row.id,
        type: "opportunity",
        title: row.title,
        summary: [row.stage, row.status, row.source].filter(Boolean).join(" | "),
        url: `/app/crm/pipeline?dealId=${row.id}`,
        updatedAt: row.updatedAt,
        metadata: { stage: row.stage, status: row.status, value: row.value, source: row.source },
      })));
    }

    const page = results
      .sort((a, b) => String(b.provenance.lastSourceUpdate || "").localeCompare(String(a.provenance.lastSourceUpdate || "")))
      .slice(offset, offset + limit);

    return {
      results: page,
      page: {
        limit,
        cursor: offset > 0 ? String(offset) : null,
        nextCursor: results.length > offset + limit ? String(offset + limit) : null,
        returned: page.length,
      },
      provenance: provenance(),
    };
  }

  async fetchRecord(user: MissionControlUserContext, type: MissionControlRecordType, id: string) {
    const response = await this.search(user, { query: "", types: [type], limit: 25 });
    const record = response.results.find((item) => item.id === id);
    if (!record) throw ApiError.notFound("Record not found");
    return record;
  }
}

export const missionControlApiService = new MissionControlApiService();
