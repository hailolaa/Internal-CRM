import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { AutomationResponse, CreateAutomationDTO, UpdateAutomationDTO } from "./automations.types.js";

function parseActions(value: unknown) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return [];
  }
}

export class AutomationsService {
  // List clinic automations for the automation engine screen
  async listAutomations(clinicId: string): Promise<AutomationResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT id, name, description, trigger_type as triggerType, actions,
              is_enabled as isEnabled, created_at as createdAt, updated_at as updatedAt
       FROM automation
       WHERE clinic_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [clinicId],
    );

    return rows.map((row: any) => ({
      ...row,
      actions: parseActions(row.actions),
      isEnabled: !!row.isEnabled,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));
  }

  // Create a basic automation shell with JSON actions
  async createAutomation(clinicId: string, userId: string, data: CreateAutomationDTO): Promise<string> {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO automation (id, clinic_id, name, description, trigger_type, actions, is_enabled, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        data.name,
        data.description || null,
        data.triggerType || null,
        JSON.stringify(data.actions || []),
        data.isEnabled === false ? 0 : 1,
        userId,
      ],
    );

    await logAuditEvent({ clinicId, userId, action: "AUTOMATION_CREATED", entityType: "automation", entityId: id, changes: { ...data } });
    return id;
  }

  // Update automation metadata and enabled state
  async updateAutomation(clinicId: string, userId: string, automationId: string, data: UpdateAutomationDTO): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    const mapping: Record<string, string> = {
      name: "name",
      description: "description",
      triggerType: "trigger_type",
      isEnabled: "is_enabled",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (key === "actions") {
        fields.push("actions = ?");
        values.push(JSON.stringify(value || []));
      } else if (mapping[key]) {
        fields.push(`${mapping[key]} = ?`);
        values.push(key === "isEnabled" ? (value ? 1 : 0) : value ?? null);
      }
    });

    if (fields.length === 0) return;
    values.push(automationId, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE automation SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Automation not found");

    await logAuditEvent({ clinicId, userId, action: "AUTOMATION_UPDATED", entityType: "automation", entityId: automationId, changes: { ...data } });
  }

  // Soft delete an automation
  async deleteAutomation(clinicId: string, userId: string, automationId: string): Promise<void> {
    const [result]: any = await pool.execute(
      "UPDATE automation SET deleted_at = CURRENT_TIMESTAMP, is_enabled = 0 WHERE id = ? AND clinic_id = ?",
      [automationId, clinicId],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Automation not found");
    await logAuditEvent({ clinicId, userId, action: "AUTOMATION_DELETED", entityType: "automation", entityId: automationId });
  }
}

export const automationsService = new AutomationsService();
