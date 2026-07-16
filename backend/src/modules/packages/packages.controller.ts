import { Request, Response, NextFunction } from "express";
import { packagesService } from "./packages.service.js";

export class PackagesController {
  listPackages = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const includeInactive = String(req.query.includeInactive || "").toLowerCase() === "true";
      const packages = await packagesService.listPackages(
        clinicId,
        includeInactive,
      );
      res.status(200).json({ status: "success", data: packages });
    } catch (error) {
      next(error);
    }
  };

  createPackage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const record = await packagesService.createPackage(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: record });
    } catch (error) {
      next(error);
    }
  };

  updatePackage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const record = await packagesService.updatePackage(clinicId, userId, req.params.id as string, req.body);
      res.status(200).json({ status: "success", data: record });
    } catch (error) {
      next(error);
    }
  };

  deletePackage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await packagesService.deletePackage(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "Package archived successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const packagesController = new PackagesController();
