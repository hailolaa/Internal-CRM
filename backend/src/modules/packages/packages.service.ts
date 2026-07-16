import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import type { PackagePayload, PackageRecord } from "./packages.types.js";

function parseFeatures(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function normalizeMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function mapPackage(row: any): PackageRecord {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.priceCents === null || row.priceCents === undefined ? null : Number(row.priceCents),
    currency: row.currency || "GBP",
    billingFrequency: row.billingFrequency,
    setupFeeCents: row.setupFeeCents === null || row.setupFeeCents === undefined ? null : Number(row.setupFeeCents),
    includedFeatures: parseFeatures(row.includedFeatures),
    internalNotes: row.internalNotes || null,
    proposalWording: row.proposalWording || null,
    sortOrder: Number(row.sortOrder || 0),
    status: row.status || "active",
    isDefault: row.isDefault === true || row.isDefault === 1,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export class PackagesService {
  async listPackages(clinicId: string, includeInactive = false): Promise<PackageRecord[]> {
    const [rows]: any = await pool.execute(
      `SELECT id,
              name,
              price_cents as priceCents,
              currency,
              billing_frequency as billingFrequency,
              setup_fee_cents as setupFeeCents,
              included_features as includedFeatures,
              internal_notes as internalNotes,
              proposal_wording as proposalWording,
              sort_order as sortOrder,
              status,
              is_default as isDefault,
              created_at as createdAt,
              updated_at as updatedAt
       FROM growth_package
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         AND (? = 1 OR status = 'active')
       ORDER BY sort_order ASC, name ASC`,
      [clinicId, includeInactive ? 1 : 0],
    );

    return rows.map(mapPackage);
  }

  async createPackage(clinicId: string, userId: string, data: PackagePayload): Promise<PackageRecord> {
    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (!name) throw ApiError.badRequest("Package name is required");

    const id = uuidv4();
    await pool.execute(
      `INSERT INTO growth_package
        (id, clinic_id, name, price_cents, currency, billing_frequency, setup_fee_cents,
         included_features, internal_notes, proposal_wording, sort_order, status, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        id,
        clinicId,
        name,
        normalizeMoney(data.priceCents),
        data.currency || "GBP",
        data.billingFrequency || "monthly",
        normalizeMoney(data.setupFeeCents),
        JSON.stringify(data.includedFeatures || []),
        data.internalNotes || null,
        data.proposalWording || null,
        Number(data.sortOrder || 100),
        data.status || "active",
      ],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "PACKAGE_CREATED",
      entityType: "growth_package",
      entityId: id,
      changes: { ...data, name },
    });

    return this.getPackage(clinicId, id);
  }

  async updatePackage(clinicId: string, userId: string, packageId: string, data: PackagePayload): Promise<PackageRecord> {
    const fields: string[] = [];
    const values: any[] = [];
    const addField = (key: keyof PackagePayload, column: string, value: unknown) => {
      if (!Object.prototype.hasOwnProperty.call(data, key)) return;
      fields.push(`${column} = ?`);
      values.push(value);
    };

    addField("name", "name", typeof data.name === "string" ? data.name.trim() : data.name);
    addField("priceCents", "price_cents", normalizeMoney(data.priceCents));
    addField("currency", "currency", data.currency || "GBP");
    addField("billingFrequency", "billing_frequency", data.billingFrequency);
    addField("setupFeeCents", "setup_fee_cents", normalizeMoney(data.setupFeeCents));
    addField("includedFeatures", "included_features", JSON.stringify(data.includedFeatures || []));
    addField("internalNotes", "internal_notes", data.internalNotes || null);
    addField("proposalWording", "proposal_wording", data.proposalWording || null);
    addField("sortOrder", "sort_order", data.sortOrder === null || data.sortOrder === undefined ? null : Number(data.sortOrder));
    addField("status", "status", data.status);

    if (fields.length === 0) return this.getPackage(clinicId, packageId);

    values.push(packageId, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE growth_package
       SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );

    if (result.affectedRows === 0) throw ApiError.notFound("Package not found");

    await logAuditEvent({
      clinicId,
      userId,
      action: "PACKAGE_UPDATED",
      entityType: "growth_package",
      entityId: packageId,
      changes: { ...data },
    });

    return this.getPackage(clinicId, packageId);
  }

  async deletePackage(clinicId: string, userId: string, packageId: string): Promise<void> {
    const [result]: any = await pool.execute(
      `UPDATE growth_package
       SET status = 'archived', deleted_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [packageId, clinicId],
    );

    if (result.affectedRows === 0) throw ApiError.notFound("Package not found");

    await logAuditEvent({
      clinicId,
      userId,
      action: "PACKAGE_ARCHIVED",
      entityType: "growth_package",
      entityId: packageId,
    });
  }

  private async getPackage(clinicId: string, packageId: string): Promise<PackageRecord> {
    const [rows]: any = await pool.execute(
      `SELECT id,
              name,
              price_cents as priceCents,
              currency,
              billing_frequency as billingFrequency,
              setup_fee_cents as setupFeeCents,
              included_features as includedFeatures,
              internal_notes as internalNotes,
              proposal_wording as proposalWording,
              sort_order as sortOrder,
              status,
              is_default as isDefault,
              created_at as createdAt,
              updated_at as updatedAt
       FROM growth_package
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [packageId, clinicId],
    );

    if (rows.length === 0) throw ApiError.notFound("Package not found");
    return mapPackage(rows[0]);
  }
}

export const packagesService = new PackagesService();
