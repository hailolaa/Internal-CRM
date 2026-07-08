import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { CreateTreatmentPlanDTO, UpdateTreatmentPlanDTO } from "./treatment-plans.types.js";

export class TreatmentPlansService {
  // List treatment plans and their line items for the clinic
  async listTreatmentPlans(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT tp.id, MIN(matched_contact.id) as contactId,
              tp.contact_name as contact, tp.avatar, tp.treatment,
              tp.total_value as totalValue, tp.paid, tp.outstanding, tp.status,
              tp.sessions, tp.sessions_completed as sessionsCompleted,
              tp.created_at as createdAt, tp.next_session as nextSession, tp.practitioner,
              GROUP_CONCAT(tpi.name ORDER BY tpi.sort_order SEPARATOR '||') as items
       FROM treatment_plan tp
       LEFT JOIN contact matched_contact
         ON matched_contact.clinic_id = tp.clinic_id
        AND matched_contact.deleted_at IS NULL
        AND LOWER(TRIM(CONCAT_WS(' ', matched_contact.first_name, matched_contact.last_name))) = LOWER(TRIM(tp.contact_name))
       LEFT JOIN treatment_plan_item tpi ON tpi.treatment_plan_id = tp.id
       WHERE tp.clinic_id = ? AND tp.deleted_at IS NULL
       GROUP BY tp.id
       ORDER BY tp.created_at DESC`,
      [clinicId],
    );

    return rows.map((row: any) => ({
      ...row,
      items: row.items ? String(row.items).split("||") : [],
      totalValue: Number(row.totalValue),
      paid: Number(row.paid),
      outstanding: Number(row.outstanding),
      sessions: Number(row.sessions),
      sessionsCompleted: Number(row.sessionsCompleted),
      createdAt: new Date(row.createdAt).toISOString(),
      nextSession: row.nextSession ? new Date(row.nextSession).toISOString() : null,
    }));
  }

  // Create a treatment plan independently from appointment scheduling
  async createTreatmentPlan(clinicId: string, userId: string, data: CreateTreatmentPlanDTO) {
    const id = uuidv4();
    const totalValue = data.totalValue || 0;
    const paid = data.paid || 0;
    const outstanding = data.outstanding ?? Math.max(totalValue - paid, 0);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await connection.execute(
        `INSERT INTO treatment_plan
          (id, clinic_id, contact_name, avatar, treatment, total_value, paid, outstanding, status, sessions, sessions_completed, next_session, practitioner, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          clinicId,
          data.contact,
          data.avatar || null,
          data.treatment,
          totalValue,
          paid,
          outstanding,
          data.status || "draft",
          data.sessions || 1,
          data.sessionsCompleted || 0,
          data.nextSession || null,
          data.practitioner || null,
          userId,
        ],
      );

      await this.replaceItems(connection, id, data.items || [data.treatment]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await logAuditEvent({ clinicId, userId, action: "TREATMENT_PLAN_CREATED", entityType: "treatment_plan", entityId: id, changes: { contact: data.contact, treatment: data.treatment } });
    return id;
  }

  // Update plan progress, payments, status, and line items
  async updateTreatmentPlan(clinicId: string, userId: string, planId: string, data: UpdateTreatmentPlanDTO) {
    const fields: string[] = [];
    const values: any[] = [];
    const mapping: Record<string, string> = {
      contact: "contact_name",
      avatar: "avatar",
      treatment: "treatment",
      totalValue: "total_value",
      paid: "paid",
      outstanding: "outstanding",
      status: "status",
      sessions: "sessions",
      sessionsCompleted: "sessions_completed",
      nextSession: "next_session",
      practitioner: "practitioner",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (!mapping[key]) return;
      fields.push(`${mapping[key]} = ?`);
      values.push(value ?? null);
    });

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      if (fields.length > 0) {
        values.push(planId, clinicId);
        const [result]: any = await connection.execute(
          `UPDATE treatment_plan SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
          values,
        );
        if (result.affectedRows === 0) throw ApiError.notFound("Treatment plan not found");
      }

      if (data.items) {
        await this.replaceItems(connection, planId, data.items);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await logAuditEvent({ clinicId, userId, action: "TREATMENT_PLAN_UPDATED", entityType: "treatment_plan", entityId: planId, changes: { ...data } });
  }

  // Soft delete a treatment plan while keeping its audit trail
  async deleteTreatmentPlan(clinicId: string, userId: string, planId: string) {
    const [result]: any = await pool.execute(
      "UPDATE treatment_plan SET status = 'archived', deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL",
      [planId, clinicId],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Treatment plan not found");
    await logAuditEvent({ clinicId, userId, action: "TREATMENT_PLAN_DELETED", entityType: "treatment_plan", entityId: planId });
  }

  private async replaceItems(connection: any, planId: string, items: string[]) {
    await connection.execute("DELETE FROM treatment_plan_item WHERE treatment_plan_id = ?", [planId]);
    for (const [index, item] of items.entries()) {
      await connection.execute(
        "INSERT INTO treatment_plan_item (id, treatment_plan_id, name, sort_order) VALUES (?, ?, ?, ?)",
        [uuidv4(), planId, item, index],
      );
    }
  }
}

export const treatmentPlansService = new TreatmentPlansService();
