import { Request, Response, NextFunction } from "express";
import { userCanManageAllClientAccounts } from "../../middleware/authorize.js";
import { fleetIngestionService } from "./fleet-ingestion.service.js";

export class FleetIngestionController {
  handleClinicOsAlphaSync = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(202).json({
        status: "success",
        data: await fleetIngestionService.ingestClinicOsAlphaSync({
          payload: req.body,
          rawBody: (req as any).rawBody,
          signature: req.get("x-clinicgrower-signature"),
          timestamp: req.get("x-clinicgrower-timestamp"),
        }),
      });
    } catch (error) {
      next(error);
    }
  };

  getSyncAdministration = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const includeAllClients = await this.canUseAllClientScope(req);
      res.status(200).json({
        status: "success",
        data: await fleetIngestionService.getSyncAdministration(user.clinicId, includeAllClients),
      });
    } catch (error) {
      next(error);
    }
  };

  replayDeadLetterEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const includeAllClients = await this.canUseAllClientScope(req);
      res.status(200).json({
        status: "success",
        data: await fleetIngestionService.replayDeadLetterEventForScope(
          user.clinicId,
          String(req.params.eventId),
          includeAllClients,
          user.userId,
          req.body?.reason,
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  resolveSyncException = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const includeAllClients = await this.canUseAllClientScope(req);
      res.status(200).json({
        status: "success",
        data: await fleetIngestionService.resolveSyncExceptionForScope(
          user.clinicId,
          String(req.params.type),
          String(req.params.exceptionId),
          includeAllClients,
          user.userId,
          "resolve",
          req.body?.reason,
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  acknowledgeSyncException = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const includeAllClients = await this.canUseAllClientScope(req);
      res.status(200).json({
        status: "success",
        data: await fleetIngestionService.resolveSyncExceptionForScope(
          user.clinicId,
          String(req.params.type),
          String(req.params.exceptionId),
          includeAllClients,
          user.userId,
          "acknowledge",
          req.body?.reason,
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  dismissSyncException = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const includeAllClients = await this.canUseAllClientScope(req);
      res.status(200).json({
        status: "success",
        data: await fleetIngestionService.resolveSyncExceptionForScope(
          user.clinicId,
          String(req.params.type),
          String(req.params.exceptionId),
          includeAllClients,
          user.userId,
          "dismiss",
          req.body?.reason,
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  private async canUseAllClientScope(req: Request) {
    const user = (req as any).user;
    return userCanManageAllClientAccounts(user.userId, user.clinicId);
  }
}

export const fleetIngestionController = new FleetIngestionController();
