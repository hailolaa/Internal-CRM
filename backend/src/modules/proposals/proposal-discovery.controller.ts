import { Request, Response, NextFunction } from "express";
import { userCanManageAllClientAccounts } from "../../middleware/authorize.js";
import { proposalDiscoveryService } from "./proposal-discovery.service.js";

export class ProposalDiscoveryController {
  startOrResumeSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const session = await proposalDiscoveryService.startOrResumeSession(clinicId, userId, req.body);
      res.status(200).json({ status: "success", data: session });
    } catch (error) {
      next(error);
    }
  };

  getSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const session = await proposalDiscoveryService.getSession(clinicId, String(req.params.sessionId));
      res.status(200).json({ status: "success", data: session });
    } catch (error) {
      next(error);
    }
  };

  updateSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const session = await proposalDiscoveryService.updateSession(clinicId, userId, String(req.params.sessionId), req.body);
      res.status(200).json({ status: "success", data: session });
    } catch (error) {
      next(error);
    }
  };

  generateDraftProposal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const access = { canManageAllClientAccounts: await userCanManageAllClientAccounts(userId, clinicId) };
      const result = await proposalDiscoveryService.generateDraftProposal(
        clinicId,
        userId,
        String(req.params.sessionId),
        access,
      );
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };
}

export const proposalDiscoveryController = new ProposalDiscoveryController();
