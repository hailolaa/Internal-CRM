import { Request, Response, NextFunction } from "express";
import { auditLogService } from "./audit-log.service.js";

export class AuditLogController {
  listAuditLog = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const result = await auditLogService.listAuditLog(clinicId, req.query as any);
      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const auditLogController = new AuditLogController();
