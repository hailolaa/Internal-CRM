import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { config } from "../config/index.js";

const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {

    let statusCode = (err as any).statusCode || 500;
    let message = err.message;
    const details = err instanceof ApiError ? err.details : undefined;
 
    if (!(err instanceof ApiError)) {
        statusCode = 500;
        message = config.nodeEnv === "production" ? "Internal Server Error" : err.message;
    }

    if (statusCode >= 500 || !(err as any).isOperational) {
        logger.error(`${req.method} ${req.path} - ${err.message}`, {
            requestId: (req as any).requestId,
            stack: err.stack,
            body: req.body,
            user: (req as any).user,
        });
    } else {
        logger.warn(`${req.method} ${req.path} - ${statusCode} - ${message}`, {
            requestId: (req as any).requestId,
        });
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
