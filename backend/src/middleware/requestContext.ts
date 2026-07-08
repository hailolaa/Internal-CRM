import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";

export const requestContext = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const incomingRequestId = req.get("x-request-id");
  const requestId = incomingRequestId?.trim() || randomUUID();

  (req as any).requestId = requestId;
  res.setHeader("x-request-id", requestId);

  next();
};
