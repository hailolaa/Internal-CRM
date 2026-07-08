import { Request, Response, NextFunction } from "express";
import { integrationInputsService } from "./integration-inputs.service.js";
import type { ManualPlatformMetricQuery } from "./integration-inputs.types.js";

export class IntegrationInputsController {
  ingestPublicMetaLead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = (req as any).apiKey;
      const result = await integrationInputsService.ingestMetaLead(apiKey.clinicId, req.body, null);
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  ingestManualLead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const result = await integrationInputsService.ingestManualLead(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };

  listManualPlatformMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const query: ManualPlatformMetricQuery = {};
      if (req.query.campaign) query.campaign = String(req.query.campaign);
      if (req.query.from) query.from = String(req.query.from);
      if (req.query.metricName) query.metricName = String(req.query.metricName);
      if (req.query.platform) query.platform = String(req.query.platform) as any;
      if (req.query.to) query.to = String(req.query.to);
      const metrics = await integrationInputsService.listManualPlatformMetrics(clinicId, query);
      res.status(200).json({ status: "success", data: metrics });
    } catch (error) {
      next(error);
    }
  };

  createManualPlatformMetric = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await integrationInputsService.createManualPlatformMetric(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  getStripePackageSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const summary = await integrationInputsService.getStripePackageSummary(clinicId);
      res.status(200).json({ status: "success", data: summary });
    } catch (error) {
      next(error);
    }
  };

  previewOpenAISummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const preview = await integrationInputsService.previewOpenAISummary(clinicId, userId, req.body);
      res.status(200).json({ status: "success", data: preview });
    } catch (error) {
      next(error);
    }
  };

  getSetupAudit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const audit = await integrationInputsService.getSetupAudit(clinicId);
      res.status(200).json({ status: "success", data: audit });
    } catch (error) {
      next(error);
    }
  };
}

export const integrationInputsController = new IntegrationInputsController();
