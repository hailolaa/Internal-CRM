import { Request, Response, NextFunction } from "express";
import { monthlyActionPlansService } from "./monthly-action-plans.service.js";

export class MonthlyActionPlansController {
  // GET /api/monthly-action-plans
  // Return a clinic monthly action plan for the selected month
  getPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const plan = await monthlyActionPlansService.getPlan(clinicId, req.query as any);
      res.status(200).json({ status: "success", data: plan });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/monthly-action-plans/generate
  // Generate or refresh a clinic monthly action plan from active signals
  generatePlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const result = await monthlyActionPlansService.generatePlan(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/monthly-action-plans/:id/status
  // Update monthly action plan lifecycle status
  updatePlanStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await monthlyActionPlansService.updatePlanStatus(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", message: "Monthly action plan status updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/monthly-action-plans/:planId/items/:itemId/status
  // Update a monthly action plan item status
  updateItemStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await monthlyActionPlansService.updateItemStatus(clinicId, userId, req.params.planId as string, req.params.itemId as string, req.body);
      res.status(200).json({ status: "success", message: "Monthly action plan item status updated successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const monthlyActionPlansController = new MonthlyActionPlansController();
