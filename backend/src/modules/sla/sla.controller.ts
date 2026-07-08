import { Request, Response, NextFunction } from "express";
import { slaService } from "./sla.service.js";

function getRequestMeta(req: Request) {
  return {
    ipAddress: req.ip || null,
    userAgent: req.get("user-agent") || null,
  };
}

export class SlaController {
  // GET /api/sla/summary
  getSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clinicId = (req as any).user.clinicId;
      const data = await slaService.getSummary(clinicId);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/sla/leads
  listLeadQueue = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clinicId = (req as any).user.clinicId;
      const data = await slaService.listLeadQueue(clinicId);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/sla/breaches
  listBreaches = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clinicId = (req as any).user.clinicId;
      const data = await slaService.listBreaches(clinicId);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/sla/check-breaches
  checkBreaches = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clinicId = (req as any).user.clinicId;
      const data = await slaService.detectSlaBreaches(clinicId);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/contacts/:id/mark-contacted
  markContacted = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const data = await slaService.markContacted(
        user.clinicId,
        user.userId,
        String(req.params.id || ""),
        getRequestMeta(req),
      );
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/metrics/response-time
  getResponseTimeMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clinicId = (req as any).user.clinicId;
      const data = await slaService.getResponseTimeMetrics(clinicId);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/metrics/staff-response
  getStaffResponseMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clinicId = (req as any).user.clinicId;
      const data = await slaService.getStaffResponseMetrics(clinicId);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };
}

export const slaController = new SlaController();
