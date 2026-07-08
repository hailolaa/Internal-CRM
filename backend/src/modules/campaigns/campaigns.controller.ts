import { Request, Response, NextFunction } from "express";
import { campaignsService } from "./campaigns.service.js";

export class CampaignsController {
  // GET /api/campaigns
  // List clinic campaigns
  listCampaigns = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const campaigns = await campaignsService.listCampaigns(clinicId);
      res.status(200).json({ status: "success", data: campaigns });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/campaigns
  // Create clinic campaign
  createCampaign = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const id = await campaignsService.createCampaign(clinicId, userId, req.body);
      res.status(201).json({ status: "success", data: { id } });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/campaigns/:id/status
  // Update campaign status
  updateCampaignStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await campaignsService.updateCampaignStatus(clinicId, userId, req.params.id as string, req.body.status);
      res.status(200).json({ status: "success", message: "Campaign updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/campaigns/:id/media
  // List uploaded campaign media assets
  listCampaignMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId } = (req as any).user;
      const media = await campaignsService.listCampaignMedia(clinicId, req.params.id as string);
      res.status(200).json({ status: "success", data: media });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/campaigns/:id/media
  // Upload a campaign media asset
  uploadCampaignMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const media = await campaignsService.uploadCampaignMedia(clinicId, userId, req.params.id as string, req.body);
      res.status(201).json({ status: "success", data: media });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/campaigns/:id/media/:mediaId
  // Replace an existing campaign media asset
  replaceCampaignMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      const media = await campaignsService.replaceCampaignMedia(
        clinicId,
        userId,
        req.params.id as string,
        req.params.mediaId as string,
        req.body,
      );
      res.status(200).json({ status: "success", data: media });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/campaigns/:id/media/:mediaId
  // Soft-delete a campaign media asset
  deleteCampaignMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, userId } = (req as any).user;
      await campaignsService.deleteCampaignMedia(clinicId, userId, req.params.id as string, req.params.mediaId as string);
      res.status(200).json({ status: "success", message: "Campaign media deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const campaignsController = new CampaignsController();
