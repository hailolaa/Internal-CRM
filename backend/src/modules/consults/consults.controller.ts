import { Request, Response, NextFunction } from "express";
import { consultsService } from "./consults.service.js";

export class ConsultsController {
  // GET /api/consults
  // List commercial consult outcomes for the current clinic
  listConsults = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const consults = await consultsService.listConsults(clinicId);
      res.status(200).json({ status: "success", data: consults });
    } catch (error) {
      next(error);
    }
  };

  getOutcomeOptions = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json({ status: "success", data: consultsService.getOutcomeOptions() });
    } catch (error) {
      next(error);
    }
  };

  exportCsv = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const csv = await consultsService.exportConsultsCsv(clinicId);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="consults-export.csv"');
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  };

  // POST /api/consults
  // Log a consult outcome snapshot
  createConsult = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const result = await consultsService.createConsult(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/consults/:id
  // Update commercial consult fields
  updateConsult = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const result = await consultsService.updateConsult(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/consults/:id/outcome
  // Update just the outcome/revenue transition for dashboards
  updateOutcome = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const result = await consultsService.updateOutcome(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/metrics/consults/summary
  // Summarise consult conversion and revenue leakage
  getSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const result = await consultsService.getSummary(clinicId);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/metrics/practitioners/conversion
  // Summarise consult conversion by practitioner label
  getPractitionerConversion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const result = await consultsService.getPractitionerConversion(clinicId);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };
}

export const consultsController = new ConsultsController();
