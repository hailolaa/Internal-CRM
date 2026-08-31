import { Request, Response, NextFunction } from "express";
import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { hashToken } from "../../utils/helpers.js";

const INTEGRATION_BEARER_KIND = "mission_control_integration";

function arrayClaim(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function audienceMatches(value: unknown, expected: string) {
  return typeof value === "string"
    ? value === expected
    : Array.isArray(value) && value.includes(expected);
}

export function requireMissionControlIntegrationScope(requiredScope: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentUser = (req as any).user || {};
      if (currentUser.token_use !== INTEGRATION_BEARER_KIND) {
        next();
        return;
      }

      const issuer = String(currentUser.iss || "");
      const audience = currentUser.aud;
      const jti = String(currentUser.jti || "");
      const scopes = arrayClaim(currentUser.scopes);
      const issuedAtSeconds = Number(currentUser.iat || 0);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const maxTokenAgeSeconds = Math.max(config.missionControlIntegration.maxTokenAgeMinutes, 1) * 60;

      if (issuer !== config.missionControlIntegration.issuer) {
        throw ApiError.unauthorized("Invalid Mission Control integration issuer");
      }
      if (!audienceMatches(audience, config.missionControlIntegration.audience)) {
        throw ApiError.unauthorized("Invalid Mission Control integration audience");
      }
      if (!jti) {
        throw ApiError.unauthorized("Mission Control integration token ID is required");
      }
      if (!issuedAtSeconds || nowSeconds - issuedAtSeconds > maxTokenAgeSeconds) {
        throw ApiError.unauthorized("Mission Control integration token is too old");
      }
      if (!scopes.includes(requiredScope)) {
        throw ApiError.forbidden("Mission Control integration scope is not permitted");
      }

      const [rows]: any = await pool.execute(
        `SELECT id
         FROM mission_control_integration_token
         WHERE token_id_hash = ?
           AND clinic_id = ?
           AND user_id = ?
           AND issuer = ?
           AND audience = ?
           AND revoked_at IS NULL
           AND expires_at > CURRENT_TIMESTAMP
           AND JSON_CONTAINS(scopes, JSON_QUOTE(?))
         LIMIT 1`,
        [
          hashToken(jti),
          currentUser.clinicId,
          currentUser.userId,
          issuer,
          config.missionControlIntegration.audience,
          requiredScope,
        ],
      );

      const tokenRow = rows[0];
      if (!tokenRow) {
        throw ApiError.unauthorized("Mission Control integration token is not active");
      }

      await pool.execute(
        "UPDATE mission_control_integration_token SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?",
        [tokenRow.id],
      );

      (req as any).missionControlIntegration = {
        tokenId: tokenRow.id,
        subject: currentUser.sub || null,
        scopes,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}
