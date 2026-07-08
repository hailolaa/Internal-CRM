import { Request, Response, NextFunction } from "express";
import { sopsService } from "./sops.service.js";
import { userHasPermission } from "../../middleware/authorize.js";

export class SopsController {
  // GET /api/sops
  // List clinic SOPs
  listSops = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const canManageAll = await userHasPermission(userId, clinicId, "sops:write");
      const sops = await sopsService.listSops(clinicId, req.query as any, canManageAll);
      res.status(200).json({ status: "success", data: sops });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/sops
  // Create a clinic SOP
  createSop = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await sopsService.createSop(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/sops/:id
  // Update a clinic SOP
  updateSop = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await sopsService.updateSop(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", message: "SOP updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/sops/:id
  // Soft delete a clinic SOP
  deleteSop = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await sopsService.deleteSop(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "SOP deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const sopsController = new SopsController();
