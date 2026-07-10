import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";

export interface UpsertRoleDTO {
  name?: string | null;
  displayName?: string | null;
  description?: string | null;
  permissions?: string[];
}

type RoleRow = {
  id: string;
  clinicId: string | null;
  name: string;
  displayName: string | null;
  description: string | null;
  isSystem: number;
};

export class RolesService {
  // List roles available to the workspace with resolved permission keys
  async listRoles(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT r.id, r.name, r.display_name as displayName, r.description, r.is_system as isSystem,
              COALESCE(JSON_ARRAYAGG(p.key_name), JSON_ARRAY()) as permissions
       FROM role r
       LEFT JOIN role_permission rp ON rp.role_id = r.id
       LEFT JOIN permission p ON p.id = rp.permission_id AND p.deleted_at IS NULL
       WHERE (r.clinic_id = ? OR r.clinic_id IS NULL) AND r.deleted_at IS NULL
         AND r.name NOT IN ('CLINIC_ADMIN', 'CLINICIAN', 'RECEPTIONIST', 'READ_ONLY')
       GROUP BY r.id
       ORDER BY r.is_system DESC, r.name ASC`,
      [clinicId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      displayName: row.displayName || row.name,
      description: row.description,
      isSystem: !!row.isSystem,
      permissions: typeof row.permissions === "string" ? JSON.parse(row.permissions).filter(Boolean) : row.permissions,
    }));
  }

  // List all permission keys that can be assigned to roles
  async listPermissions() {
    const [rows]: any = await pool.execute(
      `SELECT id, key_name as keyName, description
       FROM permission
       WHERE deleted_at IS NULL
       ORDER BY key_name ASC`,
    );
    return rows;
  }

  async createRole(clinicId: string, userId: string, data: UpsertRoleDTO) {
    const displayName = this.cleanDisplayName(data.displayName);
    const name = this.cleanRoleName(data.name || displayName);
    const description = data.description?.trim() || null;
    const permissionKeys = this.cleanPermissionKeys(data.permissions);
    const permissionIds = await this.resolvePermissionIds(permissionKeys);
    const id = uuidv4();

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      await connection.execute(
        `INSERT INTO role (id, clinic_id, name, display_name, description, is_system)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [id, clinicId, name, displayName, description],
      );

      for (const permissionId of permissionIds) {
        await connection.execute(
          "INSERT INTO role_permission (role_id, permission_id) VALUES (?, ?)",
          [id, permissionId],
        );
      }

      await connection.commit();
    } catch (error: any) {
      await connection.rollback();
      if (error?.code === "ER_DUP_ENTRY") {
        throw ApiError.conflict("A role with this name already exists");
      }
      throw error;
    } finally {
      connection.release();
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "ROLE_CREATED",
      entityType: "role",
      entityId: id,
      changes: { name, displayName, description, permissions: permissionKeys },
    });

    return this.getRole(clinicId, id);
  }

  async updateRole(clinicId: string, userId: string, roleId: string, data: UpsertRoleDTO) {
    const role = await this.getEditableRole(clinicId, roleId);
    const displayName = data.displayName === undefined ? role.displayName || role.name : this.cleanDisplayName(data.displayName);
    const description = data.description === undefined ? role.description : data.description?.trim() || null;
    const permissionKeys = data.permissions ? this.cleanPermissionKeys(data.permissions) : undefined;
    const permissionIds = permissionKeys ? await this.resolvePermissionIds(permissionKeys) : undefined;

    if (permissionKeys) {
      await this.preventSelfPermissionLockout(clinicId, userId, role.name, permissionKeys);
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      await connection.execute(
        `UPDATE role
         SET display_name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL AND is_system = 0`,
        [displayName, description, roleId, clinicId],
      );

      if (permissionIds) {
        await connection.execute("DELETE FROM role_permission WHERE role_id = ?", [roleId]);
        for (const permissionId of permissionIds) {
          await connection.execute(
            "INSERT INTO role_permission (role_id, permission_id) VALUES (?, ?)",
            [roleId, permissionId],
          );
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "ROLE_UPDATED",
      entityType: "role",
      entityId: roleId,
      changes: { displayName, description, ...(permissionKeys ? { permissions: permissionKeys } : {}) },
    });

    return this.getRole(clinicId, roleId);
  }

  async archiveRole(clinicId: string, userId: string, roleId: string): Promise<void> {
    const role = await this.getEditableRole(clinicId, roleId);
    await this.ensureRoleNotAssigned(clinicId, role.name);

    const [result]: any = await pool.execute(
      `UPDATE role
       SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL AND is_system = 0`,
      [roleId, clinicId],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Role not found");

    await logAuditEvent({
      clinicId,
      userId,
      action: "ROLE_ARCHIVED",
      entityType: "role",
      entityId: roleId,
      changes: { name: role.name, displayName: role.displayName },
    });
  }

  private async getRole(clinicId: string, roleId: string) {
    const roles = await this.listRoles(clinicId);
    const role = roles.find((item: any) => item.id === roleId);
    if (!role) throw ApiError.notFound("Role not found");
    return role;
  }

  private async getEditableRole(clinicId: string, roleId: string): Promise<RoleRow> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, name, display_name as displayName, description, is_system as isSystem
       FROM role
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [roleId],
    );
    const role = rows[0] as RoleRow | undefined;
    if (!role) throw ApiError.notFound("Role not found");
    if (role.isSystem || !role.clinicId || role.clinicId !== clinicId) {
      throw ApiError.forbidden("System roles cannot be edited");
    }
    return role;
  }

  private cleanDisplayName(value: string | null | undefined) {
    const displayName = (value || "").trim();
    if (!displayName) throw ApiError.badRequest("Role name is required");
    return displayName.slice(0, 100);
  }

  private cleanRoleName(value: string | null | undefined) {
    const name = (value || "")
      .trim()
      .replace(/[^a-zA-Z0-9_ -]/g, "")
      .replace(/[\s-]+/g, "_")
      .toUpperCase()
      .slice(0, 100);
    if (!name) throw ApiError.badRequest("Role key is required");
    return name;
  }

  private cleanPermissionKeys(values: string[] | undefined) {
    const permissions = [...new Set((values || []).map((item) => item.trim()).filter(Boolean))];
    if (permissions.length === 0) throw ApiError.badRequest("At least one permission is required");
    return permissions;
  }

  private async resolvePermissionIds(permissionKeys: string[]) {
    const placeholders = permissionKeys.map(() => "?").join(", ");
    const [rows]: any = await pool.execute(
      `SELECT id, key_name as keyName
       FROM permission
       WHERE key_name IN (${placeholders}) AND deleted_at IS NULL`,
      permissionKeys,
    );
    const missing = permissionKeys.filter(
      (key) => !rows.some((row: any) => row.keyName === key),
    );
    if (missing.length > 0) {
      throw ApiError.badRequest(`Unknown permission key: ${missing.join(", ")}`);
    }
    return rows.map((row: any) => row.id as string);
  }

  private async preventSelfPermissionLockout(
    clinicId: string,
    userId: string,
    roleName: string,
    permissionKeys: string[],
  ) {
    if (permissionKeys.includes("settings:write")) return;

    const [rows]: any = await pool.execute(
      `SELECT 1
       FROM user u
       LEFT JOIN clinic_membership cm
         ON cm.user_id = u.id
        AND cm.clinic_id = ?
        AND cm.status = 'active'
       WHERE u.id = ?
         AND u.deleted_at IS NULL
         AND COALESCE(cm.role, u.role) = ?
       LIMIT 1`,
      [clinicId, userId, roleName],
    );
    if (rows.length > 0) {
      throw ApiError.badRequest("You cannot remove settings:write from your own active role");
    }
  }

  private async ensureRoleNotAssigned(clinicId: string, roleName: string) {
    const [users]: any = await pool.execute(
      `SELECT COUNT(*) as count
       FROM user u
       LEFT JOIN clinic_membership cm
         ON cm.user_id = u.id
        AND cm.clinic_id = ?
        AND cm.status = 'active'
       WHERE u.clinic_id = ?
         AND u.deleted_at IS NULL
         AND COALESCE(cm.role, u.role) = ?`,
      [clinicId, clinicId, roleName],
    );
    if (Number(users[0]?.count || 0) > 0) {
      throw ApiError.badRequest("This role is assigned to active team members and cannot be archived");
    }

    const [invites]: any = await pool.execute(
      `SELECT COUNT(*) as count
       FROM invitation
       WHERE clinic_id = ?
         AND role = ?
         AND status = 'pending'
         AND expires_at > CURRENT_TIMESTAMP`,
      [clinicId, roleName],
    );
    if (Number(invites[0]?.count || 0) > 0) {
      throw ApiError.badRequest("This role is used by pending invitations and cannot be archived");
    }
  }
}

export const rolesService = new RolesService();
