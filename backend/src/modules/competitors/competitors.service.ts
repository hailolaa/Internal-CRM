import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { CreateCompetitorDTO, UpdateCompetitorDTO } from "./competitors.types.js";

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

export class CompetitorsService {
  // List competitor tracking records for the clinic
  async listCompetitors(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id, name, url, key_treatments as keyTreatments,
              price_position as pricePosition, offer, messaging_angle as messagingAngle,
              ad_presence as adPresence, seo_strength as seoStrength, rating, reviews
       FROM competitor
       WHERE clinic_id = ? AND deleted_at IS NULL
       ORDER BY updated_at DESC`,
      [clinicId],
    );

    return rows.map((row: any) => ({
      ...row,
      keyTreatments: parseJson<string[]>(row.keyTreatments, []),
      adPresence: parseJson(row.adPresence, { google: false, meta: false }),
      rating: Number(row.rating),
      reviews: Number(row.reviews),
    }));
  }

  // Create a competitor snapshot for manual market tracking
  async createCompetitor(clinicId: string, userId: string, data: CreateCompetitorDTO) {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO competitor
        (id, clinic_id, name, url, key_treatments, price_position, offer, messaging_angle, ad_presence, seo_strength, rating, reviews, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        data.name,
        data.url,
        JSON.stringify(data.keyTreatments || []),
        data.pricePosition || "Mid-range",
        data.offer || null,
        data.messagingAngle || null,
        JSON.stringify(data.adPresence || { google: false, meta: false }),
        data.seoStrength || "Weak",
        data.rating || 0,
        data.reviews || 0,
        userId,
      ],
    );
    await logAuditEvent({ clinicId, userId, action: "COMPETITOR_CREATED", entityType: "competitor", entityId: id, changes: { name: data.name, url: data.url } });
    return id;
  }

  // Update competitor research fields
  async updateCompetitor(clinicId: string, userId: string, competitorId: string, data: UpdateCompetitorDTO) {
    const fields: string[] = [];
    const values: any[] = [];
    const mapping: Record<string, string> = {
      name: "name",
      url: "url",
      keyTreatments: "key_treatments",
      pricePosition: "price_position",
      offer: "offer",
      messagingAngle: "messaging_angle",
      adPresence: "ad_presence",
      seoStrength: "seo_strength",
      rating: "rating",
      reviews: "reviews",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (!mapping[key]) return;
      fields.push(`${mapping[key]} = ?`);
      values.push(["keyTreatments", "adPresence"].includes(key) ? JSON.stringify(value) : value ?? null);
    });

    if (fields.length === 0) return;
    values.push(competitorId, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE competitor SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Competitor not found");
    await logAuditEvent({ clinicId, userId, action: "COMPETITOR_UPDATED", entityType: "competitor", entityId: competitorId, changes: { ...data } });
  }

  // Soft delete a competitor record
  async deleteCompetitor(clinicId: string, userId: string, competitorId: string) {
    const [result]: any = await pool.execute(
      "UPDATE competitor SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL",
      [competitorId, clinicId],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Competitor not found");
    await logAuditEvent({ clinicId, userId, action: "COMPETITOR_DELETED", entityType: "competitor", entityId: competitorId });
  }
}

export const competitorsService = new CompetitorsService();

