import { Request, Response, NextFunction } from "express";
import { depositsService } from "./deposits.service.js";
import { validate } from "../../middleware/validate.js";

export class DepositsController {
  // GET /api/deposits
  listDeposits = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const deposits = await depositsService.listDeposits(clinicId);
      res.status(200).json({ status: "success", data: deposits });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/deposits
  createDeposit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await depositsService.createDeposit(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/deposits/:id
  updateDeposit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await depositsService.updateDeposit(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", message: "Deposit updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/deposits/session
  // Create a Stripe payment session for a deposit
  createPaymentSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const result = await depositsService.createDepositPaymentSession(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  };
}

export const depositsController = new DepositsController();

