import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { requireMissionControlIntegrationScope } from "./mission-control-integration-auth.js";
import { missionControlApiService } from "./mission-control-api.service.js";
import type { MissionControlRecordType, MissionControlSearchQuery, MissionControlUserContext } from "./mission-control-api.types.js";

const router = Router();

function user(req: Request): MissionControlUserContext {
  const currentUser = (req as any).user;
  return {
    clinicId: currentUser.clinicId,
    userId: currentUser.userId,
    email: currentUser.email,
    role: currentUser.role,
  };
}

function jsonRpc(req: Request, id: unknown, result: Record<string, unknown>) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    result: {
      ...result,
      request_id: (req as any).requestId,
      generated_at: new Date().toISOString(),
    },
  };
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function jsonRpcErrorCode(error: unknown) {
  const statusCode = error instanceof ApiError ? error.statusCode : (error as any)?.statusCode;
  if (statusCode === 404) return -32004;
  if (statusCode && statusCode >= 400 && statusCode < 500) return -32602;
  return -32603;
}

function assertArguments(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw ApiError.badRequest("MCP tool arguments must be an object");
  }
  return value as Record<string, unknown>;
}

function optionalString(value: unknown, field: string) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw ApiError.badRequest(`${field} must be a string`);
  return value;
}

function optionalLimit(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 25) {
    throw ApiError.badRequest("limit must be an integer between 1 and 25");
  }
  return parsed;
}

function optionalTypes(value: unknown) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw ApiError.badRequest("types must be an array of strings");
  }
  return value as MissionControlRecordType[];
}

function requiredRecordId(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw ApiError.badRequest("id is required");
  const id = value.trim();
  if (id.length > 128 || !/^[a-zA-Z0-9:_-]+$/.test(id)) throw ApiError.badRequest("id is invalid");
  return id;
}

function requiredRecordType(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw ApiError.badRequest("type is required");
  return value.trim() as MissionControlRecordType;
}

router.use(authenticate);
router.use(requireMissionControlIntegrationScope("mission_control_mcp:read"));
router.use(authorizePermission("mission_control_mcp:read"));

router.get("/", (req, res) => {
  res.json({
    name: "mission-control-mcp",
    transport: "streamable-http",
    apiVersion: "v1",
    request_id: (req as any).requestId,
    generated_at: new Date().toISOString(),
  });
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body || {};
    const id = body.id ?? null;
    if (body.jsonrpc !== "2.0") {
      res.status(400).json(jsonRpcError(id, -32600, "Invalid JSON-RPC request"));
      return;
    }

    if (body.method === "tools/list") {
      const capabilities = missionControlApiService.getCapabilities();
      res.json(jsonRpc(req, id, { tools: capabilities.tools }));
      return;
    }

    if (body.method === "tools/call") {
      const name = body.params?.name;
      const args = assertArguments(body.params && "arguments" in body.params ? body.params.arguments : {});
      let data: unknown;
      let affectedRecord: { type?: string; id?: string } = {};
      let resultCount: number | null = null;

      if (name === "search") {
        const searchQuery: MissionControlSearchQuery = {};
        const query = optionalString(args.query, "query");
        const types = optionalTypes(args.types);
        const limit = optionalLimit(args.limit);
        const cursor = optionalString(args.cursor, "cursor");
        if (query !== undefined) searchQuery.query = query;
        if (types !== undefined) searchQuery.types = types;
        if (limit !== undefined) searchQuery.limit = limit;
        if (cursor !== undefined) searchQuery.cursor = cursor;
        data = await missionControlApiService.search(user(req), searchQuery);
        resultCount = Array.isArray((data as any)?.results) ? (data as any).results.length : null;
      } else if (name === "fetch") {
        const type = requiredRecordType(args.type);
        const id = requiredRecordId(args.id);
        data = await missionControlApiService.fetchRecord(user(req), type, id);
        affectedRecord = { type, id };
      } else {
        res.status(400).json(jsonRpcError(id, -32601, "Unsupported MCP tool"));
        return;
      }

      await logAuditEvent({
        clinicId: user(req).clinicId,
        userId: user(req).userId,
        action: "MISSION_CONTROL_MCP_TOOL_CALL",
        entityType: "mission_control_mcp",
        entityId: affectedRecord.id,
        changes: { tool: name, result: "success", affectedRecord, resultCount },
      });
      res.json(jsonRpc(req, id, { content: [{ type: "json", json: data }] }));
      return;
    }

    res.status(400).json(jsonRpcError(id, -32601, "Unsupported MCP method"));
  } catch (error) {
    if (req.body?.jsonrpc === "2.0") {
      const statusCode = error instanceof ApiError ? error.statusCode : (error as any)?.statusCode || 500;
      res.status(statusCode).json(jsonRpcError(req.body?.id ?? null, jsonRpcErrorCode(error), (error as Error).message || "MCP request failed"));
      return;
    }
    next(error);
  }
});

export default router;
