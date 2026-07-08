import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { CreateSopDTO, SopListQuery, SopResponse, UpdateSopDTO } from "./sops.types.js";

export class SopsService {
  // List SOP documents for the clinic knowledge base with search, filters, and visibility checks
  async listSops(clinicId: string, query: SopListQuery, canManageAll: boolean): Promise<SopResponse[]> {
    const conditions = ["clinic_id = ?", "deleted_at IS NULL"];
    const values: any[] = [clinicId];

    if (!canManageAll) {
      // Non-internal users can only see published SOPs
      conditions.push("status = 'published'");
    } else if (query.status) {
      // Internal users can optionally filter by status
      conditions.push("status = ?");
      values.push(query.status);
    }

    if (query.category) {
      conditions.push("category = ?");
      values.push(query.category);
    }

    if (query.search) {
      conditions.push("(title LIKE ? OR content LIKE ?)");
      const term = `%${query.search}%`;
      values.push(term, term);
    }

    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, title, category, content, owner, status, created_at as createdAt, updated_at as updatedAt
       FROM sop
       WHERE ${conditions.join(" AND ")}
       ORDER BY updated_at DESC`,
      values,
    );

    return rows.map((row: any) => ({
      ...row,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));
  }

  // Create a SOP record for operations documentation
  async createSop(clinicId: string, userId: string, data: CreateSopDTO): Promise<string> {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO sop (id, clinic_id, title, category, content, owner, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, clinicId, data.title, data.category || "General", data.content || null, data.owner || null, data.status || "draft", userId],
    );

    await logAuditEvent({ clinicId, userId, action: "SOP_CREATED", entityType: "sop", entityId: id, changes: { ...data } });
    return id;
  }

  // Update SOP content, ownership, or lifecycle status (publish/archive)
  async updateSop(clinicId: string, userId: string, sopId: string, data: UpdateSopDTO): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) { fields.push("title = ?"); values.push(data.title); }
    if (data.category !== undefined) { fields.push("category = ?"); values.push(data.category); }
    if (data.content !== undefined) { fields.push("content = ?"); values.push(data.content || null); }
    if (data.owner !== undefined) { fields.push("owner = ?"); values.push(data.owner || null); }
    if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }

    if (fields.length === 0) return;
    values.push(sopId, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE sop SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );

    if (result.affectedRows === 0) throw ApiError.notFound("SOP not found");
    await logAuditEvent({ clinicId, userId, action: "SOP_UPDATED", entityType: "sop", entityId: sopId, changes: { ...data } });
  }

  // Soft delete SOPs so historical audit records remain usable
  async deleteSop(clinicId: string, userId: string, sopId: string): Promise<void> {
    const [result]: any = await pool.execute(
      "UPDATE sop SET status = 'archived', deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL",
      [sopId, clinicId],
    );

    if (result.affectedRows === 0) throw ApiError.notFound("SOP not found");
    await logAuditEvent({ clinicId, userId, action: "SOP_DELETED", entityType: "sop", entityId: sopId });
  }
}

export const sopsService = new SopsService();
