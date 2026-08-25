import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { config } from "../config/index.js";
import { notifyObservabilityAlert } from "../utils/observability.js";
import { redactSensitiveValue, redactTelemetryPath } from "../utils/redaction.js";

const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {

    let statusCode = (err as any).statusCode || 500;
    let message = err.message;
    const details = err instanceof ApiError ? err.details : undefined;
    const isInvalidJsonBody =
        err instanceof SyntaxError &&
        (err as any).status === 400 &&
        (err as any).type === "entity.parse.failed";
 
    if (isInvalidJsonBody) {
        statusCode = 400;
        message = "Invalid JSON request body";
    } else if (!(err instanceof ApiError)) {
        statusCode = 500;
        message = config.nodeEnv === "production" ? "Internal Server Error" : err.message;
    }

    if (statusCode >= 500 || (!(err as any).isOperational && !isInvalidJsonBody)) {
        logger.error(`${req.method} ${req.path} - ${err.message}`, {
            requestId: (req as any).requestId,
            stack: err.stack,
            requestBody: redactSensitiveValue(req.body),
            user: redactSensitiveValue((req as any).user),
        });
        void notifyObservabilityAlert({
            type: "api_error",
            severity: statusCode >= 500 ? "critical" : "error",
            title: "Mission Control API error",
            message: err.message,
            requestId: (req as any).requestId,
            traceId: (req as any).requestId,
            clinicId: (req as any).user?.clinicId || null,
            userId: (req as any).user?.userId || null,
            statusCode,
            path: redactTelemetryPath(req.originalUrl),
            method: req.method,
            error: err,
        });
    } else {
        logger.warn(`${req.method} ${req.path} - ${statusCode} - ${message}`, {
            requestId: (req as any).requestId,
        });
    }

    if (req.originalUrl.startsWith("/api/v1")) {
        const apiResponse = {
            success: false,
            data: null,
            error: {
                code: statusCode === 401
                    ? "unauthorized"
                    : statusCode === 403
                        ? "forbidden"
                        : statusCode === 404
                            ? "not_found"
                            : statusCode === 429
                                ? "rate_limit_exceeded"
                                : statusCode >= 500
                                    ? "internal_error"
                                    : "bad_request",
                message,
                status: statusCode,
                ...(details !== undefined && { details }),
            },
            request_id: (req as any).requestId,
            generated_at: new Date().toISOString(),
        };

        res.status(statusCode).json(apiResponse);
        return;
    }

    const response = {
        status: "error",
        message,
        requestId: (req as any).requestId,
        ...(details !== undefined && { errors: details }),
        ...(config.nodeEnv === "development" && { stack: err.stack }),
    }

   res.status(statusCode).json(response);
}

export default errorHandler;
