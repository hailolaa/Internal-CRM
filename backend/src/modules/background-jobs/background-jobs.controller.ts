import { Request, Response, NextFunction } from "express";
import { backgroundJobsService } from "./background-jobs.service.js";

export class BackgroundJobsController {
  // GET /api/background-jobs
  listJobs = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await backgroundJobsService.listJobs();
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/background-jobs/:id/status
  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await backgroundJobsService.updateStatus(
        String(req.params.id || ""),
        req.body.status,
      );
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };
}

export const backgroundJobsController = new BackgroundJobsController();
