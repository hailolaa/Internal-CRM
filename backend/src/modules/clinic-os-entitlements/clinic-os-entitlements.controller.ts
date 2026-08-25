import { Request, Response, NextFunction } from "express";
import { clinicOsEntitlementsService } from "./clinic-os-entitlements.service.js";

export class ClinicOsEntitlementsController {
  publishSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const data = await clinicOsEntitlementsService.publishSettings({
        clinicId: String(req.body.clinicId || user.clinicId),
        tenantKey: req.body.tenantKey,
        accessTier: req.body.accessTier,
        growthScoreRequested: req.body.growthScoreRequested,
        paidDiagnosticConfirmed: req.body.paidDiagnosticConfirmed,
        sufficientDataConfirmed: req.body.sufficientDataConfirmed,
        settings: req.body.settings,
        changedBy: user.userId,
      });
      res.status(201).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  rollback = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const data = await clinicOsEntitlementsService.rollbackToVersion({
        clinicId: String(req.body.clinicId || user.clinicId),
        tenantKey: req.body.tenantKey,
        version: Number(req.body.version),
        changedBy: user.userId,
      });
      res.status(201).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  listPendingPushes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await clinicOsEntitlementsService.listPendingPushes(Number(req.query.limit || 50));
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  markPushSent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await clinicOsEntitlementsService.markPushSent(String(req.body.clinicId), String(req.params.pushId));
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  markPushFailed = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await clinicOsEntitlementsService.markPushFailed(
        String(req.body.clinicId),
        String(req.params.pushId),
        String(req.body.errorMessage || "Clinic OS settings push failed."),
      );
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  acknowledgePush = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await clinicOsEntitlementsService.acknowledgePush(
        String(req.body.clinicId),
        String(req.params.pushId),
        String(req.body.payloadHash || ""),
      );
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };
}

export const clinicOsEntitlementsController = new ClinicOsEntitlementsController();
