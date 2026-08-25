import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { missionControlApiService } from "./mission-control-api.service.js";
import type { MissionControlRecordType, MissionControlUserContext } from "./mission-control-api.types.js";

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

function jsonRpc(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
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

router.use(authenticate);
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
      res.json(jsonRpc(id, { tools: capabilities.tools }));
      return;
    }

    if (body.method === "tools/call") {
      const name = body.params?.name;
      const args = body.params?.arguments || {};
      let data: unknown;

      if (name === "search") {
        data = await missionControlApiService.search(user(req), {
          query: args.query,
          types: args.types,
          limit: args.limit,
          cursor: args.cursor,
        });
      } else if (name === "fetch") {
        data = await missionControlApiService.fetchRecord(user(req), args.type as MissionControlRecordType, String(args.id || ""));
      } else {
        res.status(400).json(jsonRpcError(id, -32601, "Unsupported MCP tool"));
        return;
      }

      await logAuditEvent({
        clinicId: user(req).clinicId,
        userId: user(req).userId,
        action: "MISSION_CONTROL_MCP_TOOL_CALL",
        entityType: "mission_control_mcp",
        changes: { tool: name },
      });
      res.json(jsonRpc(id, { content: [{ type: "json", json: data }] }));
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
