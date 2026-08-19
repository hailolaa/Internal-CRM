import { Request, Response, NextFunction } from "express";
import { missedCallRecoveryService } from "./missed-call-recovery.service.js";
import type { MissedCallRecoveryState } from "./missed-call-recovery.types.js";

export class MissedCallRecoveryController {
  handleClinicGrowerEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      missedCallRecoveryService.verifyClinicGrowerSignature({
        rawBody: (req as any).rawBody,
        signature: req.get("x-clinicgrower-signature") || undefined,
        timestamp: req.get("x-clinicgrower-timestamp") || undefined,
      });

      const payload = missedCallRecoveryService.normalizePayload(req.body || {});
      const data = await missedCallRecoveryService.ingestClinicGrowerEvent(payload);
      res.status(data.status === "duplicate" ? 200 : 202).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  listRecoveries = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const data = await missedCallRecoveryService.listRecoveries(clinicId);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  updateState = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const data = await missedCallRecoveryService.updateRecoveryState(
        clinicId,
        userId,
        String(req.params.id || ""),
        req.body.state as MissedCallRecoveryState,
      );
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  listMappings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const data = await missedCallRecoveryService.listMappings(clinicId);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  createMapping = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const data = await missedCallRecoveryService.createMapping(clinicId, userId, req.body || {});
      res.status(201).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  updateMapping = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const data = await missedCallRecoveryService.updateMapping(
        clinicId,
        userId,
        String(req.params.id || ""),
        req.body || {},
      );
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };
}

export const missedCallRecoveryController = new MissedCallRecoveryController();
