import { Request, Response, NextFunction } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { websiteLeadsService } from "../website-leads/website-leads.service.js";

const MAX_PAYLOAD_BYTES = 128 * 1024;

function requestPayloadSize(req: Request) {
  const declaredSize = Number(req.get("content-length") || 0);
  if (Number.isFinite(declaredSize) && declaredSize > 0) return declaredSize;
  return Buffer.byteLength(JSON.stringify(req.body || {}), "utf8");
}

export class LandingPageLeadsController {
  capture = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = (req as any).apiKey;
      if (!apiKey) throw ApiError.unauthorized("API key is required");
      if (apiKey.purpose !== "landing_page_lead_capture") {
        throw ApiError.forbidden("This API key is not enabled for landing-page lead capture");
      }

      if (requestPayloadSize(req) > MAX_PAYLOAD_BYTES) {
        throw ApiError.badRequest("Landing-page lead payload is too large");
      }

      const result = await websiteLeadsService.captureWebsiteLead(
        apiKey.clinicId,
        apiKey.id,
        req.body,
        {
          ipAddress: req.ip || null,
          userAgent: req.get("user-agent") || null,
        },
        {
          payloadSource: `landing_page_lead_capture:${apiKey.id}`,
          sourceConfig: {
            apiKeyId: apiKey.id,
            sourceKey: apiKey.sourceKey,
            sourceLabel: apiKey.sourceLabel,
            defaultSource: apiKey.defaultSource,
            initialStageName: apiKey.initialStageName,
            ownerUserId: apiKey.ownerUserId,
            followUpEnabled: apiKey.followUpEnabled !== false,
          },
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

export const landingPageLeadsController = new LandingPageLeadsController();
