import type { Request, Response, NextFunction } from "express";
import { clientOperatingRegisterService } from "./client-operating-register.service.js";

export class ClientOperatingRegisterController {
  listRecords = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const data = await clientOperatingRegisterService.listRecords(user.clinicId);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };

  importRecords = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const data = await clientOperatingRegisterService.importRecords(user.clinicId, user.userId, req.body);
      res.status(req.body?.dryRun === false ? 201 : 200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  };
}

export const clientOperatingRegisterController = new ClientOperatingRegisterController();
