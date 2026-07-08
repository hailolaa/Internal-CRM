import { Request, Response, NextFunction } from "express";
import { performanceOsService } from "./performance-os.service.js";

export class PerformanceOsController {
  getAttributionChain = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const chain = await performanceOsService.getAttributionChain(clinicId, req.query.contactId as string);
      res.status(200).json({ status: "success", data: chain });
    } catch (error) {
      next(error);
    }
  };

  listAlerts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const alerts = await performanceOsService.listAlerts(clinicId, req.query as any);
      res.status(200).json({ status: "success", data: alerts });
    } catch (error) {
      next(error);
    }
  };
}

export const performanceOsController = new PerformanceOsController();
