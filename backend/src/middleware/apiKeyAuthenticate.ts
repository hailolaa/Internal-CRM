import { Request, Response, NextFunction } from "express";
import pool from "../config/database.js";
import { ApiError } from "../utils/ApiError.js";
import { hashToken } from "../utils/helpers.js";

// Authenticate public API requests using a clinic API key.
export const authenticateApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const header = req.headers.authorization;
    const apiKey =
      header?.startsWith("Bearer ") ? header.split(" ")[1] : req.get("x-api-key");

    if (!apiKey) {
      throw ApiError.unauthorized("API key is required");
    }

    const [rows]: any = await pool.execute(
      `SELECT id,
              clinic_id as clinicId,
              purpose,
              source_key as sourceKey,
              source_label as sourceLabel,
              default_source as defaultSource,
              initial_stage_name as initialStageName,
              owner_user_id as ownerUserId,
              follow_up_enabled as followUpEnabled
       FROM api_key
       WHERE key_hash = ? AND revoked_at IS NULL
       LIMIT 1`,
      [hashToken(apiKey)],
    );

    const key = rows[0];
    if (!key) {
      throw ApiError.unauthorized("Invalid API key");
    }

    await pool.execute(
      "UPDATE api_key SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?",
      [key.id],
    );

    (req as any).apiKey = {
      id: key.id,
      clinicId: key.clinicId,
      purpose: key.purpose || "general",
      sourceKey: key.sourceKey || null,
      sourceLabel: key.sourceLabel || null,
      defaultSource: key.defaultSource || null,
      initialStageName: key.initialStageName || null,
      ownerUserId: key.ownerUserId || null,
      followUpEnabled: key.followUpEnabled === undefined ? true : Boolean(key.followUpEnabled),
    };

    next();
  } catch (error) {
    next(error);
  }
};
