import { Request, Response, NextFunction } from "express";
import { growthScoresService } from "./growth-scores.service.js";

export class GrowthScoresController {
  listSnapshots = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const result = await growthScoresService.listSnapshots(clinicId, userId, req.query as any);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  createSnapshot = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const result = await growthScoresService.createSnapshot(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };
}

export const growthScoresController = new GrowthScoresController();
