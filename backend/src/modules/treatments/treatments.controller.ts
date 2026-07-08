import { Request, Response, NextFunction } from "express";
import { treatmentsService } from "./treatments.service.js";

export class TreatmentsController {
  // GET /api/treatments
  // List clinic treatment catalogue items
  listTreatments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const treatments = await treatmentsService.listTreatments(clinicId);
      res.status(200).json({ status: "success", data: treatments });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/treatments
  // Create a treatment catalogue item for the current clinic
  createTreatment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await treatmentsService.createTreatment(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/treatments/:id
  // Update a clinic-scoped treatment catalogue item
  updateTreatment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await treatmentsService.updateTreatment(
        clinicId,
        userId,
        req.params.id as string,
        req.body,
      );
      res.status(200).json({ status: "success", message: "Treatment updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/treatments/:id
  // Soft delete a clinic-scoped treatment catalogue item
  deleteTreatment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await treatmentsService.deleteTreatment(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Treatment deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const treatmentsController = new TreatmentsController();
