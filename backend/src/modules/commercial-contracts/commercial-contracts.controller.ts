import { Request, Response, NextFunction } from "express";
import { commercialContractsService } from "./commercial-contracts.service.js";

function actorName(user: any) {
  return user?.name || user?.email || user?.userId || "system";
}

export class CommercialContractsController {
  listContracts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const data = await commercialContractsService.listContracts(clinicId, req.query as any);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  getContract = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const data = await commercialContractsService.getContract(clinicId, req.params.id as string);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  createContract = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const data = await commercialContractsService.createContract({
        clinicId: user.clinicId,
        ...req.body,
        createdBy: actorName(user),
      });
      res.status(201).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  transitionContract = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const data = await commercialContractsService.transitionContract(clinicId, req.params.id as string, req.body.status);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  createChangeOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const data = await commercialContractsService.createChangeOrder({
        clinicId: user.clinicId,
        contractId: req.params.id as string,
        summary: req.body.summary,
        effectiveDate: req.body.effectiveDate || null,
        terms: req.body.terms,
        createdBy: actorName(user),
      });
      res.status(201).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  listAlerts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const data = await commercialContractsService.listAlerts(clinicId, req.query as any);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  createNoticeAlerts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const data = await commercialContractsService.createNoticeAlerts({ clinicId, untilDate: req.body.untilDate });
      res.status(201).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  generateRenewals = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const data = await commercialContractsService.generateRenewals({
        clinicId: user.clinicId,
        untilDate: req.body.untilDate,
        createdBy: actorName(user),
      });
      res.status(201).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };
}

export const commercialContractsController = new CommercialContractsController();
