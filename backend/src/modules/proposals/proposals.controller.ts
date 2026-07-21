import { Request, Response, NextFunction } from "express";
import { userCanManageAllClientAccounts } from "../../middleware/authorize.js";
import { proposalsService } from "./proposals.service.js";

export class ProposalsController {
  listProposals = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const proposals = await proposalsService.listProposals(clinicId, req.query as any);
      res.status(200).json({ status: "success", data: proposals });
    } catch (error) {
      next(error);
    }
  };

  getProposal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const proposal = await proposalsService.getProposal(clinicId, String(req.params.id));
      res.status(200).json({ status: "success", data: proposal });
    } catch (error) {
      next(error);
    }
  };

  getProposalSourceData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const access = { canManageAllClientAccounts: await userCanManageAllClientAccounts(userId, clinicId) };
      const sourceData = await proposalsService.getProposalSourceData(clinicId, req.query as any, access);
      res.status(200).json({ status: "success", data: sourceData });
    } catch (error) {
      next(error);
    }
  };

  createProposal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const access = { canManageAllClientAccounts: await userCanManageAllClientAccounts(userId, clinicId) };
      const proposal = await proposalsService.createProposal(clinicId, userId, req.body, access);
      res.status(201).json({ status: "success", data: proposal });
    } catch (error) {
      next(error);
    }
  };

  updateProposal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const access = { canManageAllClientAccounts: await userCanManageAllClientAccounts(userId, clinicId) };
      const proposal = await proposalsService.updateProposal(clinicId, userId, String(req.params.id), req.body, access);
      res.status(200).json({ status: "success", data: proposal });
    } catch (error) {
      next(error);
    }
  };

  archiveProposal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await proposalsService.archiveProposal(clinicId, userId, String(req.params.id));
      res.status(200).json({ status: "success", message: "Proposal archived successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const proposalsController = new ProposalsController();
