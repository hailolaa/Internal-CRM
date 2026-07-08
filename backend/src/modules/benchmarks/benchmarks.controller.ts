import { Request, Response, NextFunction } from "express";
import { benchmarksService } from "./benchmarks.service.js";

export class BenchmarksController {
  getSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const data = await benchmarksService.getSummary(clinicId);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };
}

export const benchmarksController = new BenchmarksController();
