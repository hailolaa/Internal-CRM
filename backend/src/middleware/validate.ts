import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { ApiError, type ApiErrorDetail } from "../utils/ApiError.js";


export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationErrors: ApiErrorDetail[] = errors.array().map((err: any) => ({
      field: String(err.path || err.param || "unknown"),
      message: String(err.msg || "Invalid value"),
      location: err.location,
      value: err.value,
    }));

    return next(ApiError.badRequest("Validation failed", validationErrors));
  }
  
  next();
};
