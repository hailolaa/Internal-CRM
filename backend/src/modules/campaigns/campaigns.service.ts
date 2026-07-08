import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";

export interface CreateCampaignDTO {
  name: string;
  description?: string | null;
  type?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number | null;
  channel?: string | null;
}

export interface CampaignMediaUploadDTO {
  fileName: string;
  mimeType: string;
  sizeBytes?: number | null;
  dataUrl: string;
}

const MAX_CAMPAIGN_MEDIA_BYTES = 5 * 1024 * 1024;
const MAX_CAMPAIGN_MEDIA_ITEMS = 6;
const SUPPORTED_CAMPAIGN_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
]);

export class CampaignsService {
  // List clinic marketing campaigns without touching contact attribution work
  async listCampaigns(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id, name, description, type, status, start_date as startDate,
              end_date as endDate, budget, channel, created_at as createdAt
       FROM campaign
       WHERE clinic_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [clinicId],
    );
    const campaigns = rows.map((row: any) => ({
      ...row,
      budget: row.budget === null ? null : Number(row.budget),
      startDate: row.startDate ? new Date(row.startDate).toISOString().slice(0, 10) : null,
      endDate: row.endDate ? new Date(row.endDate).toISOString().slice(0, 10) : null,
      createdAt: new Date(row.createdAt).toISOString(),
    }));

    if (campaigns.length === 0) return campaigns;

    const placeholders = campaigns.map(() => "?").join(", ");
    const [mediaRows]: any = await pool.execute(
      `SELECT id, campaign_id as campaignId, file_name as fileName, mime_type as mimeType,
              size_bytes as sizeBytes, asset_data as assetData, created_at as createdAt
       FROM campaign_media
       WHERE clinic_id = ?
         AND campaign_id IN (${placeholders})
         AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [clinicId, ...campaigns.map((campaign: any) => campaign.id)],
    );

    const mediaByCampaign = new Map<string, any[]>();
    for (const media of mediaRows) {
      const current = mediaByCampaign.get(media.campaignId) || [];
      current.push(this.mapMedia(media));
      mediaByCampaign.set(media.campaignId, current);
    }

    return campaigns.map((campaign: any) => ({
      ...campaign,
      media: mediaByCampaign.get(campaign.id) || [],
    }));
  }

  // Create a clinic campaign for marketing planning and attribution reporting
  async createCampaign(clinicId: string, userId: string, data: CreateCampaignDTO): Promise<string> {
    const id = uuidv4();

    try {
      await pool.execute(
        `INSERT INTO campaign
          (id, clinic_id, name, description, type, status, start_date, end_date, budget, channel)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          clinicId,
          data.name,
          data.description || null,
          data.type || null,
          data.status || "draft",
          data.startDate || null,
          data.endDate || null,
          data.budget ?? null,
          data.channel || null,
        ],
      );
    } catch (error: any) {
      if (error?.code === "ER_DUP_ENTRY") {
        throw ApiError.conflict("A campaign with this name already exists");
      }
      throw error;
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "CAMPAIGN_CREATED",
      entityType: "campaign",
      entityId: id,
      changes: { ...data },
    });

    return id;
  }

  // Update campaign status for simple lifecycle changes
  async updateCampaignStatus(clinicId: string, userId: string, campaignId: string, status: string): Promise<void> {
    const [result]: any = await pool.execute(
      "UPDATE campaign SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL",
      [status, campaignId, clinicId],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Campaign not found");
    await logAuditEvent({ clinicId, userId, action: "CAMPAIGN_UPDATED", entityType: "campaign", entityId: campaignId, changes: { status } });
  }

  async listCampaignMedia(clinicId: string, campaignId: string) {
    await this.ensureCampaignExists(clinicId, campaignId);

    const [rows]: any = await pool.execute(
      `SELECT id, campaign_id as campaignId, file_name as fileName, mime_type as mimeType,
              size_bytes as sizeBytes, asset_data as assetData, created_at as createdAt
       FROM campaign_media
       WHERE clinic_id = ? AND campaign_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [clinicId, campaignId],
    );

    return rows.map((row: any) => this.mapMedia(row));
  }

  async uploadCampaignMedia(clinicId: string, userId: string, campaignId: string, data: CampaignMediaUploadDTO) {
    await this.ensureCampaignExists(clinicId, campaignId);
    await this.ensureMediaLimit(clinicId, campaignId);

    const asset = this.parseMediaUpload(data);
    const id = uuidv4();

    await pool.execute(
      `INSERT INTO campaign_media
        (id, clinic_id, campaign_id, file_name, mime_type, size_bytes, asset_data, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, clinicId, campaignId, asset.fileName, asset.mimeType, asset.sizeBytes, asset.buffer, userId],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "CAMPAIGN_MEDIA_UPLOADED",
      entityType: "campaign",
      entityId: campaignId,
      changes: { mediaId: id, fileName: asset.fileName, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes },
    });

    return {
      id,
      campaignId,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      dataUrl: `data:${asset.mimeType};base64,${asset.buffer.toString("base64")}`,
      createdAt: new Date().toISOString(),
    };
  }

  async replaceCampaignMedia(clinicId: string, userId: string, campaignId: string, mediaId: string, data: CampaignMediaUploadDTO) {
    await this.ensureCampaignExists(clinicId, campaignId);
    await this.ensureMediaExists(clinicId, campaignId, mediaId);

    const asset = this.parseMediaUpload(data);
    await pool.execute(
      `UPDATE campaign_media
       SET file_name = ?, mime_type = ?, size_bytes = ?, asset_data = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND campaign_id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [asset.fileName, asset.mimeType, asset.sizeBytes, asset.buffer, mediaId, campaignId, clinicId],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "CAMPAIGN_MEDIA_REPLACED",
      entityType: "campaign",
      entityId: campaignId,
      changes: { mediaId, fileName: asset.fileName, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes },
    });

    return {
      id: mediaId,
      campaignId,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      dataUrl: `data:${asset.mimeType};base64,${asset.buffer.toString("base64")}`,
      createdAt: new Date().toISOString(),
    };
  }

  async deleteCampaignMedia(clinicId: string, userId: string, campaignId: string, mediaId: string): Promise<void> {
    await this.ensureCampaignExists(clinicId, campaignId);

    const [result]: any = await pool.execute(
      `UPDATE campaign_media
       SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND campaign_id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [mediaId, campaignId, clinicId],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Campaign media not found");

    await logAuditEvent({
      clinicId,
      userId,
      action: "CAMPAIGN_MEDIA_DELETED",
      entityType: "campaign",
      entityId: campaignId,
      changes: { mediaId },
    });
  }

  private async ensureCampaignExists(clinicId: string, campaignId: string): Promise<void> {
    const [rows]: any = await pool.execute(
      "SELECT id FROM campaign WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL LIMIT 1",
      [campaignId, clinicId],
    );
    if (rows.length === 0) throw ApiError.notFound("Campaign not found");
  }

  private async ensureMediaExists(clinicId: string, campaignId: string, mediaId: string): Promise<void> {
    const [rows]: any = await pool.execute(
      `SELECT id FROM campaign_media
       WHERE id = ? AND campaign_id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [mediaId, campaignId, clinicId],
    );
    if (rows.length === 0) throw ApiError.notFound("Campaign media not found");
  }

  private async ensureMediaLimit(clinicId: string, campaignId: string): Promise<void> {
    const [rows]: any = await pool.execute(
      `SELECT COUNT(*) as count
       FROM campaign_media
       WHERE clinic_id = ? AND campaign_id = ? AND deleted_at IS NULL`,
      [clinicId, campaignId],
    );
    if (Number(rows[0]?.count || 0) >= MAX_CAMPAIGN_MEDIA_ITEMS) {
      throw ApiError.badRequest(`Campaigns can have up to ${MAX_CAMPAIGN_MEDIA_ITEMS} media assets`);
    }
  }

  private parseMediaUpload(data: CampaignMediaUploadDTO) {
    const fileName = (data.fileName || "campaign-media").trim().slice(0, 255);
    const mimeType = (data.mimeType || "").trim().toLowerCase();
    const match = /^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(data.dataUrl || "");

    if (!fileName) throw ApiError.badRequest("File name is required");
    if (!SUPPORTED_CAMPAIGN_MEDIA_TYPES.has(mimeType)) {
      throw ApiError.badRequest("Campaign media must be a JPG, PNG, WebP, GIF, or MP4 file");
    }
    if (!match) throw ApiError.badRequest("Campaign media must be uploaded as a base64 data URL");
    const dataUrlMimeType = match[1] || "";
    const dataUrlPayload = match[2] || "";
    if (dataUrlMimeType.toLowerCase() !== mimeType) {
      throw ApiError.badRequest("Campaign media MIME type does not match the uploaded file");
    }

    const base64 = dataUrlPayload.replace(/\s/g, "");
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0) throw ApiError.badRequest("Campaign media file is empty");
    if (buffer.length > MAX_CAMPAIGN_MEDIA_BYTES) {
      throw ApiError.badRequest("Campaign media files must be 5MB or smaller");
    }
    if (data.sizeBytes && Math.abs(Number(data.sizeBytes) - buffer.length) > 2) {
      throw ApiError.badRequest("Campaign media size does not match the uploaded file");
    }

    return { fileName, mimeType, sizeBytes: buffer.length, buffer };
  }

  private mapMedia(row: any) {
    const buffer = Buffer.isBuffer(row.assetData) ? row.assetData : Buffer.from(row.assetData || "");
    return {
      id: row.id,
      campaignId: row.campaignId,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: Number(row.sizeBytes || buffer.length || 0),
      dataUrl: `data:${row.mimeType};base64,${buffer.toString("base64")}`,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }
}

export const campaignsService = new CampaignsService();
