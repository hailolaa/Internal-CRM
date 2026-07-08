import { Request, Response, NextFunction } from "express";
import { opsLogsService } from "./ops-logs.service.js";

export class OpsLogsController {
  // GET /api/ops-logs/spend
  listSpend = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const entries = await opsLogsService.listSpend(clinicId);
      res.status(200).json({ status: "success", data: entries });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/ops-logs/spend
  createSpend = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await opsLogsService.createSpend(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/ops-logs/spend/:id
  deleteSpend = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await opsLogsService.deleteSpend(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Spend entry deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/ops-logs/spend/:id
  updateSpend = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const entries = await opsLogsService.updateSpend(
        clinicId,
        userId,
        req.params.id as string,
        req.body,
      );
      res.status(200).json({ status: "success", data: entries });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/metrics/roas
  getRoasMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const metrics = await opsLogsService.getRoasMetrics(clinicId);
      res.status(200).json({ status: "success", data: metrics });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/metrics/campaigns
  getCampaignMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const metrics = await opsLogsService.getCampaignMetrics(clinicId);
      res.status(200).json({ status: "success", data: metrics });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/ops-logs/consults
  listConsults = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const entries = await opsLogsService.listConsults(clinicId);
      res.status(200).json({ status: "success", data: entries });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/ops-logs/consults
  createConsult = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await opsLogsService.createConsult(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/ops-logs/consults/:id
  deleteConsult = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await opsLogsService.deleteConsult(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Consult entry deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const opsLogsController = new OpsLogsController();
