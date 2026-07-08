import { Request, Response, NextFunction } from "express";
import { insightsService } from "./insights.service.js";

export class InsightsController {
  // GET /api/insights
  // List active clinic insights by default
  listInsights = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const insights = await insightsService.listInsights(clinicId, req.query as any);
      res.status(200).json({ status: "success", data: insights });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/insights/generate
  // Generate insight records from current revenue leakage source records
  generateInsights = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const result = await insightsService.generateFromRevenueLeaks(clinicId, userId);
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/insights/:id/status
  // Update insight lifecycle status
  updateInsightStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await insightsService.updateInsightStatus(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", message: "Insight status updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/insights/:id/assign
  // Assign owner or due date to an insight
  assignInsight = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await insightsService.assignInsight(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", message: "Insight assignment updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/insights/:id/task
  // Create or return the linked action task for an insight
  createActionTask = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const result = await insightsService.createActionTask(clinicId, userId, req.params.id as string, req.body);
      res.status(result.existing ? 200 : 201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };
}

export const insightsController = new InsightsController();
