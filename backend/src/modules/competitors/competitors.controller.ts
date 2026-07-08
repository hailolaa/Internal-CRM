import { Request, Response, NextFunction } from "express";
import { competitorsService } from "./competitors.service.js";

export class CompetitorsController {
  // GET /api/competitors
  listCompetitors = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const competitors = await competitorsService.listCompetitors(clinicId);
      res.status(200).json({ status: "success", data: competitors });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/competitors
  createCompetitor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await competitorsService.createCompetitor(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/competitors/:id
  updateCompetitor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await competitorsService.updateCompetitor(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", message: "Competitor updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/competitors/:id
  deleteCompetitor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await competitorsService.deleteCompetitor(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Competitor deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const competitorsController = new CompetitorsController();

