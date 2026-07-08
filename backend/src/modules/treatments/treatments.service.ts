import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { defaultTreatmentCategory } from "./treatments.constants.js";
import { mapTreatmentCatalog } from "./treatments.mappers.js";
import { CreateTreatmentDTO, TreatmentCatalogResponse, UpdateTreatmentDTO } from "./treatments.types.js";

export class TreatmentsService {
  // List active catalogue items for the current clinic
  async listTreatments(clinicId: string): Promise<TreatmentCatalogResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT
          id,
          name,
          description,
          category,
          duration_minutes as durationMinutes,
          price_cents as priceCents,
          average_value_cents as averageValueCents,
          margin_percent as marginPercent,
          priority,
          is_high_ticket as isHighTicket,
          status,
          created_at as createdAt,
          updated_at as updatedAt
       FROM treatment_catalog
       WHERE clinic_id = ? AND deleted_at IS NULL
       ORDER BY status ASC, name ASC`,
      [clinicId],
    );

    return rows.map(mapTreatmentCatalog);
  }

  // Create a clinic-scoped catalogue item
  async createTreatment(
    clinicId: string,
    userId: string,
    data: CreateTreatmentDTO,
  ): Promise<string> {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO treatment_catalog
        (id, clinic_id, name, description, category, duration_minutes, price_cents,
         average_value_cents, margin_percent, priority, is_high_ticket, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        data.name,
        data.description || null,
        data.category || defaultTreatmentCategory,
        data.durationMinutes ?? null,
        data.priceCents ?? null,
        data.averageValueCents ?? null,
        data.marginPercent ?? null,
        data.priority ?? 0,
        data.isHighTicket ? 1 : 0,
        data.status || "active",
        userId,
      ],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "TREATMENT_CREATED",
      entityType: "treatment_catalog",
      entityId: id,
      changes: { ...data },
    });

    return id;
  }

  // Update supported catalogue fields without touching patient treatment history
  async updateTreatment(
    clinicId: string,
    userId: string,
    treatmentId: string,
    data: UpdateTreatmentDTO,
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    const mapping: Record<string, string> = {
      name: "name",
      description: "description",
      category: "category",
      durationMinutes: "duration_minutes",
      priceCents: "price_cents",
      averageValueCents: "average_value_cents",
      marginPercent: "margin_percent",
      priority: "priority",
      isHighTicket: "is_high_ticket",
      status: "status",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (mapping[key]) {
        fields.push(`${mapping[key]} = ?`);
        values.push(key === "isHighTicket" ? (value ? 1 : 0) : value ?? null);
      }
    });

    if (fields.length === 0) return;
    values.push(treatmentId, clinicId);

    const [result]: any = await pool.execute(
      `UPDATE treatment_catalog
       SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );

    if (result.affectedRows === 0) {
      throw ApiError.notFound("Treatment not found");
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "TREATMENT_UPDATED",
      entityType: "treatment_catalog",
      entityId: treatmentId,
      changes: { ...data },
    });
  }

  // Soft delete catalogue items so historical references remain intact
  async deleteTreatment(
    clinicId: string,
    userId: string,
    treatmentId: string,
  ): Promise<void> {
    const [result]: any = await pool.execute(
      `UPDATE treatment_catalog
       SET status = 'inactive', deleted_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [treatmentId, clinicId],
    );

    if (result.affectedRows === 0) {
      throw ApiError.notFound("Treatment not found");
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "TREATMENT_DELETED",
      entityType: "treatment_catalog",
      entityId: treatmentId,
    });
  }
}

export const treatmentsService = new TreatmentsService();
