import { Request, Response, NextFunction } from "express";
import { userCanManageAllClientAccounts } from "../../middleware/authorize.js";
import { fleetIngestionService } from "./fleet-ingestion.service.js";

export class FleetIngestionController {
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
