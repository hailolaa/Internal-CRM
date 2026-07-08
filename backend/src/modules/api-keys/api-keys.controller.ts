import { Request, Response, NextFunction } from "express";
import { apiKeysService } from "./api-keys.service.js";

export class ApiKeysController {
  // GET /api/settings/api-keys
  // List API keys without returning stored secrets
  listApiKeys = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const keys = await apiKeysService.listApiKeys(clinicId);
      res.status(200).json({ status: "success", data: keys });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/settings/api-keys
  // Create a new API key and return the raw key once
  createApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const key = await apiKeysService.createApiKey(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: key });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/settings/api-keys/:id
  // Update API key display metadata
  updateApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await apiKeysService.updateApiKey(
        clinicId,
        userId,
        req.params.id as string,
        req.body,
      );
      res.status(200).json({ status: "success", message: "API key updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/settings/api-keys/:id
  // Revoke a key without deleting its audit history
  revokeApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await apiKeysService.revokeApiKey(clinicId, userId, req.params.id as string);
      res.status(200).json({ status: "success", message: "API key revoked successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const apiKeysController = new ApiKeysController();
