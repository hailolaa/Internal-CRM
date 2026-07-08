import { Request, Response, NextFunction } from "express";
import { automationsService } from "./automations.service.js";

export class AutomationsController {
  // GET /api/automations
  // List clinic automations
  listAutomations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const automations = await automationsService.listAutomations(clinicId);
      res.status(200).json({ status: "success", data: automations });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/automations
  // Create a basic automation
  createAutomation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await automationsService.createAutomation(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/automations/:id
  // Update automation metadata or enabled state
  updateAutomation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await automationsService.updateAutomation(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", message: "Automation updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/automations/:id
  // Soft delete an automation
  deleteAutomation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await automationsService.deleteAutomation(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Automation deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const automationsController = new AutomationsController();
