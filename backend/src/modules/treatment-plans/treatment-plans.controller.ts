import { Request, Response, NextFunction } from "express";
import { treatmentPlansService } from "./treatment-plans.service.js";

export class TreatmentPlansController {
  // GET /api/treatment-plans
  listTreatmentPlans = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const plans = await treatmentPlansService.listTreatmentPlans(clinicId);
      res.status(200).json({ status: "success", data: plans });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/treatment-plans
  createTreatmentPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await treatmentPlansService.createTreatmentPlan(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/treatment-plans/:id
  updateTreatmentPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await treatmentPlansService.updateTreatmentPlan(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", message: "Treatment plan updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/treatment-plans/:id
  deleteTreatmentPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await treatmentPlansService.deleteTreatmentPlan(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Treatment plan deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const treatmentPlansController = new TreatmentPlansController();

