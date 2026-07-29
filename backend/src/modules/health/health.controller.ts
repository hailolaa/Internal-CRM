import { Request, Response, NextFunction } from "express";
import { getDatabaseHealth } from "../../config/database.js";
import { config, getProductionConfigIssues } from "../../config/index.js";
import { getReleaseInfo } from "../../utils/releaseInfo.js";
import { ApiError } from "../../utils/ApiError.js";

const startedAt = new Date();

export class HealthController {
  live = (req: Request, res: Response) => {
    res.status(200).json({
      status: "success",
      data: {
        ok: true,
        service: "clinicgrower-crm-backend",
        environment: config.nodeEnv,
        uptimeSeconds: Math.round(process.uptime()),
        startedAt: startedAt.toISOString(),
        requestId: (req as any).requestId,
      },
    });
  };

  ready = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const database = await getDatabaseHealth();
      const configIssues = getProductionConfigIssues();
      const hasBlockingConfigIssues =
        config.nodeEnv === "production" && configIssues.issues.length > 0;

      res.status(hasBlockingConfigIssues ? 503 : 200).json({
        status: hasBlockingConfigIssues ? "error" : "success",
        data: {
          ok: !hasBlockingConfigIssues,
          service: "clinicgrower-crm-backend",
          environment: config.nodeEnv,
          uptimeSeconds: Math.round(process.uptime()),
          database,
          config: {
            frontendUrl: config.frontendUrl,
            apiPublicUrl: config.apiPublicUrl,
            oauthCallbackBaseUrl: config.oauthCallbackBaseUrl,
            corsOrigins: config.cors.allowedOrigins,
            emailProvider: config.email.provider,
            issues: configIssues.issues,
            warnings: configIssues.warnings,
          },
          requestId: (req as any).requestId,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  version = (req: Request, res: Response) => {
    res.status(200).json({
      status: "success",
      data: {
        service: "clinicgrower-crm-backend",
        environment: config.nodeEnv,
        release: getReleaseInfo(),
        requestId: (req as any).requestId,
      },
    });
  };

  forceObservabilityError = (req: Request, res: Response, next: NextFunction) => {
    if (!config.observability.testEnabled) {
      next(ApiError.notFound("Observability test endpoint is disabled"));
      return;
    }

    const suppliedToken = req.get("x-observability-test-token") || "";
    if (!config.observability.testToken || suppliedToken !== config.observability.testToken) {
      next(ApiError.forbidden("Observability test token is invalid"));
      return;
    }

    next(new Error("Forced observability API error"));
  };
}

export const healthController = new HealthController();
