import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { CreateOfferDTO, OfferResponse, UpdateOfferDTO } from "./offers.types.js";

export class OffersService {
  // List marketing offers used by the promotions screen
  async listOffers(clinicId: string): Promise<OfferResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT id, name, discount, treatment, valid_until as validUntil,
              redemptions, status, description
       FROM marketing_offer
       WHERE clinic_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [clinicId],
    );

    return rows.map((row: any) => ({
      ...row,
      redemptions: Number(row.redemptions),
    }));
  }

  // Create a reusable clinic offer without touching campaign attribution
  async createOffer(clinicId: string, userId: string, data: CreateOfferDTO): Promise<string> {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO marketing_offer
        (id, clinic_id, name, discount, treatment, valid_until, redemptions, status, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        data.name,
        data.discount,
        data.treatment,
        data.validUntil,
        data.redemptions || 0,
        data.status || "active",
        data.description || null,
        userId,
      ],
    );

    await logAuditEvent({ clinicId, userId, action: "OFFER_CREATED", entityType: "marketing_offer", entityId: id, changes: { ...data } });
    return id;
  }

  // Update offer copy, dates, or lifecycle status
  async updateOffer(clinicId: string, userId: string, offerId: string, data: UpdateOfferDTO): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    const mapping: Record<string, string> = {
      name: "name",
      discount: "discount",
      treatment: "treatment",
      validUntil: "valid_until",
      redemptions: "redemptions",
      status: "status",
      description: "description",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (mapping[key]) {
        fields.push(`${mapping[key]} = ?`);
        values.push(value ?? null);
      }
    });

    if (fields.length === 0) return;
    values.push(offerId, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE marketing_offer SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );

    if (result.affectedRows === 0) throw ApiError.notFound("Offer not found");
    await logAuditEvent({ clinicId, userId, action: "OFFER_UPDATED", entityType: "marketing_offer", entityId: offerId, changes: { ...data } });
  }

  // Soft delete offers while preserving redemptions/audit context
  async deleteOffer(clinicId: string, userId: string, offerId: string): Promise<void> {
    const [result]: any = await pool.execute(
      "UPDATE marketing_offer SET status = 'expired', deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL",
      [offerId, clinicId],
    );

    if (result.affectedRows === 0) throw ApiError.notFound("Offer not found");
    await logAuditEvent({ clinicId, userId, action: "OFFER_DELETED", entityType: "marketing_offer", entityId: offerId });
  }
}

export const offersService = new OffersService();
