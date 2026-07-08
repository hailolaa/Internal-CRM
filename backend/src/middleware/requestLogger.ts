import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger.js";

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

    logger.log(level, "http_request", {
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode,
      durationMs,
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || null,
      userId: (req as any).user?.userId || null,
      clinicId: (req as any).user?.clinicId || null,
    });
  });

  next();
};
