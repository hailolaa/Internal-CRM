import { Request, Response, NextFunction } from "express";
import { pipelineDealsService } from "./pipeline.deals.service.js";
import { pipelineService } from "./pipeline.service.js";

export class PipelineController {
  // GET /api/pipeline/stages
  // List ordered stages for the current clinic revenue pipeline
  listStages = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const stages = await pipelineService.listStages(clinicId, userId);
      res.status(200).json({ status: "success", data: stages });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/pipeline/stages
  // Create a stage at the end of the current clinic pipeline
  createStage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const stage = await pipelineService.createStage(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: stage });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/pipeline/stages/:id
  // Update stage label, colour, order, or reporting kind
  updateStage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const stage = await pipelineService.updateStage(
        clinicId,
        userId,
        req.params.id as string,
        req.body,
      );
      res.status(200).json({ status: "success", data: stage });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/pipeline/stages/:id
  // Soft-delete a stage if no active opportunities use its name
  deleteStage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await pipelineService.deleteStage(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Pipeline stage deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/pipeline/deals
  // List current clinic opportunities for the revenue pipeline board
  listDeals = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const result = await pipelineDealsService.listDeals(clinicId, userId);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/pipeline/deals
  // Create an opportunity linked to a contact and pipeline stage
  createDeal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const deal = await pipelineDealsService.createDeal(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: deal });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/pipeline/deals/:id
  // Update opportunity commercial fields without moving stage
  updateDeal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const deal = await pipelineDealsService.updateDeal(
        clinicId,
        userId,
        req.params.id as string,
        req.body,
      );
      res.status(200).json({ status: "success", data: deal });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/pipeline/deals/:id/move
  // Persist stage movement and commercial transition metadata
  moveDeal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const deal = await pipelineDealsService.moveDeal(
        clinicId,
        userId,
        req.params.id as string,
        req.body,
      );
      res.status(200).json({ status: "success", data: deal });
    } catch (error) {
      next(error);
    }
  };
}

export const pipelineController = new PipelineController();
