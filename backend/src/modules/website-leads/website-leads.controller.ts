import { Request, Response, NextFunction } from "express";
import { websiteLeadsService } from "./website-leads.service.js";

export class WebsiteLeadsController {
  capture = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = (req as any).apiKey;
      const result = await websiteLeadsService.captureWebsiteLead(
        apiKey.clinicId,
        apiKey.id,
        req.body,
        {
          ipAddress: req.ip || null,
          userAgent: req.get("user-agent") || null,
        },
      );

      res.status(result.duplicateEvent ? 200 : 201).json({
        status: "success",
        data: result,
        requestId: (req as any).requestId,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const websiteLeadsController = new WebsiteLeadsController();
