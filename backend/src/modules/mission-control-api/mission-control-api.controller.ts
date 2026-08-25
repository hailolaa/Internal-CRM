import { Request, Response, NextFunction } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { missionControlApiService } from "./mission-control-api.service.js";
import type { MissionControlRecordType, MissionControlSearchQuery, MissionControlUserContext } from "./mission-control-api.types.js";

function user(req: Request): MissionControlUserContext {
  const currentUser = (req as any).user;
  return {
    clinicId: currentUser.clinicId,
    userId: currentUser.userId,
    email: currentUser.email,
    role: currentUser.role,
  };
}

function envelope(req: Request, data: unknown) {
  return {
    success: true,
    data,
    error: null,
    request_id: (req as any).requestId,
    generated_at: new Date().toISOString(),
  };
}

function parseTypes(value: unknown): MissionControlRecordType[] | undefined {
  if (!value) return undefined;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean) as MissionControlRecordType[];
}

export class MissionControlApiController {
  health = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(envelope(req, await missionControlApiService.getHealth()));
    } catch (error) {
      next(error);
    }
  };

  version = (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(envelope(req, missionControlApiService.getVersion()));
    } catch (error) {
      next(error);
    }
  };

  capabilities = (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(envelope(req, missionControlApiService.getCapabilities()));
    } catch (error) {
      next(error);
    }
  };

  search = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query: MissionControlSearchQuery = {
        query: typeof req.query.query === "string" ? req.query.query : "",
        cursor: typeof req.query.cursor === "string" ? req.query.cursor : null,
      };
      const types = parseTypes(req.query.types);
      if (types) query.types = types;
      if (req.query.limit) query.limit = Number(req.query.limit);

      const data = await missionControlApiService.search(user(req), query);
      await logAuditEvent({
        clinicId: user(req).clinicId,
        userId: user(req).userId,
        action: "MISSION_CONTROL_API_SEARCH",
        entityType: "mission_control_api",
        changes: { query: req.query.query || "", types: req.query.types || null, resultCount: data.results.length },
      });
      res.json(envelope(req, data));
    } catch (error) {
      next(error);
    }
  };

  fetchRecord = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const type = req.params.type as MissionControlRecordType;
      const id = req.params.id;
      if (typeof id !== "string" || !id) throw ApiError.badRequest("Record ID is required");
      res.json(envelope(req, await missionControlApiService.fetchRecord(user(req), type, id)));
    } catch (error) {
      next(error);
    }
  };
}

export const missionControlApiController = new MissionControlApiController();
