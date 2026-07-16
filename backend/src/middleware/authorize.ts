import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError.js";
import pool from "../config/database.js";
import { config } from "../config/index.js";
import { getRoleAliases, roleMatchesAllowedRoles } from "../utils/roles.js";


export const authorize = (...allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user) {
        throw ApiError.unauthorized("Authentication required");
      }

      const currentRole = await getActiveUserRole(user.userId, user.clinicId);
      if (!currentRole) {
        throw ApiError.unauthorized("Authentication required");
      }

      (req as any).user.role = currentRole;

      if (!roleMatchesAllowedRoles(currentRole, allowedRoles)) {
        throw ApiError.forbidden("You do not have permission to perform this action");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

async function getActiveUserRole(userId: string, clinicId: string) {
  const [rows]: any = await pool.execute(
    `SELECT COALESCE(cm.role, u.role) as role
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
    [clinicId, userId],
  );

  return rows[0]?.role || null;
}

export const authorizePermission = (permissionKey: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user) {
        throw ApiError.unauthorized("Authentication required");
      }

      if (await userHasPermission(user.userId, user.clinicId, permissionKey)) {
        next();
        return;
      }

      throw ApiError.forbidden("You do not have permission to perform this action");
    } catch (error) {
      next(error);
    }
  };
};

export const authorizeAnyPermission = (...permissionKeys: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user) {
        throw ApiError.unauthorized("Authentication required");
      }

      for (const permissionKey of permissionKeys) {
        if (await userHasPermission(user.userId, user.clinicId, permissionKey)) {
          next();
          return;
        }
      }

      throw ApiError.forbidden("You do not have permission to perform this action");
    } catch (error) {
      next(error);
    }
  };
};

export async function userHasPermission(
  userId: string,
  clinicId: string,
  permissionKey: string,
) {
  const [users]: any = await pool.execute(
    `SELECT COALESCE(cm.role, u.role) as role
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
    [clinicId, userId],
  );
  const roleNames = getRoleAliases(users[0]?.role || "");
  if (roleNames.length === 0) return false;

  const rolePlaceholders = roleNames.map(() => "?").join(", ");
  const [rows]: any = await pool.execute(
    `SELECT 1
     FROM user u
     JOIN clinic_membership cm
       ON cm.user_id = u.id
      AND cm.clinic_id = ?
      AND cm.status = 'active'
     JOIN role r
       ON r.name IN (${rolePlaceholders})
      AND (r.clinic_id = cm.clinic_id OR r.clinic_id IS NULL)
      AND r.deleted_at IS NULL
     JOIN role_permission rp
       ON rp.role_id = r.id
     JOIN permission p
       ON p.id = rp.permission_id
      AND p.deleted_at IS NULL
     WHERE u.id = ?
       AND u.deleted_at IS NULL
       AND u.status = 'active'
       AND u.is_active = 1
       AND (p.key_name = ? OR p.key_name = '*')
     LIMIT 1`,
    [clinicId, ...roleNames, userId, permissionKey],
  );

  return rows.length > 0;
}

export async function userCanManageAllClientAccounts(userId: string, clinicId: string) {
  if (await userHasPermission(userId, clinicId, "*")) return true;

  const internalWorkspaceId = config.oauth.google.autoProvisionClinicId;
  if (!internalWorkspaceId || clinicId !== internalWorkspaceId) return false;

  return userHasPermission(userId, clinicId, "client_accounts:read");
}
