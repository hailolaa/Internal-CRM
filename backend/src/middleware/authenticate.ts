import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import pool from "../config/database.js";
import { ApiError } from "../utils/ApiError.js";
import { verifyToken } from "../utils/helpers.js";


export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw ApiError.unauthorized("Authentication required");
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw ApiError.unauthorized("Invalid token format");
    }

    const decoded = verifyToken(token);
    const [users]: any = await pool.execute(
      `SELECT u.id,
              cm.clinic_id as clinicId,
              u.email,
              u.first_name as firstName,
              u.last_name as lastName,
              COALESCE(cm.role, u.role) as role
       FROM user u
       INNER JOIN clinic_membership cm
         ON cm.user_id = u.id
        AND cm.clinic_id = ?
        AND cm.status = 'active'
       INNER JOIN clinic c
         ON c.id = cm.clinic_id
        AND c.deleted_at IS NULL
       WHERE u.id = ?
         AND u.deleted_at IS NULL
         AND u.status = 'active'
         AND u.is_active = 1
       LIMIT 1`,
      [decoded.clinicId, decoded.userId],
    );

    const activeUser = users[0];
    if (!activeUser) {
      throw ApiError.unauthorized("Authentication required");
    }

    // Attach the current active user context, not just the JWT claims.
    (req as any).user = {
      ...decoded,
      ...activeUser,
      userId: activeUser.id,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(ApiError.unauthorized("Session expired"));
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      next(ApiError.unauthorized("Invalid authentication token"));
      return;
    }

    next(error);
  }
};
