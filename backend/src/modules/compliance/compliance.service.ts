import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import {
  ComplianceDocumentFileDTO,
  ComplianceSettingsResponse,
  CreateComplianceDocumentDTO,
  CreateDataAccessRequestDTO,
  UpdateComplianceDocumentDTO,
  UpdateComplianceSettingsDTO,
  UpdateDataAccessRequestDTO,
} from "./compliance.types.js";

const defaultSettings: ComplianceSettingsResponse = {
  retentionPeriod: "7 years",
  toggles: {
    autoDeleteInactiveLeads: true,
    consentTracking: true,
  },
};

function parseJson(value: unknown) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

const MAX_COMPLIANCE_FILE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_COMPLIANCE_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export class ComplianceService {
  // List compliance documents used by the settings checklist
  async listDocuments(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id, title, status, category, due_date as dueDate, updated_at as lastUpdated,
              file_name as fileName, mime_type as mimeType, size_bytes as sizeBytes
       FROM compliance_document
       WHERE clinic_id = ? AND deleted_at IS NULL
       ORDER BY updated_at DESC`,
      [clinicId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      category: row.category,
      dueDate: row.dueDate ? new Date(row.dueDate).toISOString().slice(0, 10) : null,
      lastUpdated: new Date(row.lastUpdated).toISOString(),
      fileName: row.fileName || null,
      mimeType: row.mimeType || null,
      sizeBytes: row.sizeBytes === null || row.sizeBytes === undefined ? null : Number(row.sizeBytes),
      hasFile: !!row.fileName,
    }));
  }

  // Create a document checklist item, usually from an upload action
  async createDocument(clinicId: string, userId: string, data: CreateComplianceDocumentDTO) {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO compliance_document (id, clinic_id, title, status, category, due_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, clinicId, data.title, data.status || "action_required", data.category || "regulatory", data.dueDate || null, userId],
    );

    await logAuditEvent({ clinicId, userId, action: "COMPLIANCE_DOCUMENT_CREATED", entityType: "compliance_document", entityId: id, changes: { ...data } });
    return id;
  }

  // Update document status, category, or due date
  async updateDocument(clinicId: string, userId: string, documentId: string, data: UpdateComplianceDocumentDTO) {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) { fields.push("title = ?"); values.push(data.title); }
    if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
    if (data.category !== undefined) { fields.push("category = ?"); values.push(data.category); }
    if (data.dueDate !== undefined) { fields.push("due_date = ?"); values.push(data.dueDate || null); }

    if (fields.length === 0) return;
    values.push(documentId, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE compliance_document SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );

    if (result.affectedRows === 0) throw ApiError.notFound("Compliance document not found");
    await logAuditEvent({ clinicId, userId, action: "COMPLIANCE_DOCUMENT_UPDATED", entityType: "compliance_document", entityId: documentId, changes: { ...data } });
  }

  // Soft delete compliance checklist entries
  async deleteDocument(clinicId: string, userId: string, documentId: string) {
    const [result]: any = await pool.execute(
      "UPDATE compliance_document SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL",
      [documentId, clinicId],
    );

    if (result.affectedRows === 0) throw ApiError.notFound("Compliance document not found");
    await logAuditEvent({ clinicId, userId, action: "COMPLIANCE_DOCUMENT_DELETED", entityType: "compliance_document", entityId: documentId });
  }

  // Read persisted data protection settings with sensible defaults
  async getSettings(clinicId: string): Promise<ComplianceSettingsResponse> {
    const [rows]: any = await pool.execute(
      "SELECT key_name as keyName, value_json as valueJson FROM compliance_setting WHERE clinic_id = ?",
      [clinicId],
    );

    const settings = { ...defaultSettings, toggles: { ...defaultSettings.toggles } };
    rows.forEach((row: any) => {
      const value = parseJson(row.valueJson);
      if (row.keyName === "retentionPeriod" && typeof value === "string") {
        settings.retentionPeriod = value;
      }
      if (row.keyName === "toggles" && value && typeof value === "object") {
        settings.toggles = { ...settings.toggles, ...(value as Record<string, boolean>) };
      }
    });

    return settings;
  }

  // Upsert data protection settings in compact key/value rows
  async updateSettings(clinicId: string, userId: string, data: UpdateComplianceSettingsDTO): Promise<ComplianceSettingsResponse> {
    const current = await this.getSettings(clinicId);
    const next: ComplianceSettingsResponse = {
      retentionPeriod: data.retentionPeriod || current.retentionPeriod,
      toggles: { ...current.toggles, ...(data.toggles || {}) },
    };

    await pool.execute(
      `INSERT INTO compliance_setting (id, clinic_id, key_name, value_json, updated_by)
       VALUES (?, ?, 'retentionPeriod', ?, ?)
       ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP`,
      [uuidv4(), clinicId, JSON.stringify(next.retentionPeriod), userId],
    );
    await pool.execute(
      `INSERT INTO compliance_setting (id, clinic_id, key_name, value_json, updated_by)
       VALUES (?, ?, 'toggles', ?, ?)
       ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP`,
      [uuidv4(), clinicId, JSON.stringify(next.toggles), userId],
    );

    await logAuditEvent({ clinicId, userId, action: "COMPLIANCE_SETTINGS_UPDATED", entityType: "compliance_setting", entityId: clinicId, changes: { ...data } });
    return next;
  }

  async uploadDocumentFile(clinicId: string, userId: string, documentId: string, data: ComplianceDocumentFileDTO) {
    await this.ensureDocumentExists(clinicId, documentId);
    const file = this.parseDocumentFile(data);

    const [result]: any = await pool.execute(
      `UPDATE compliance_document
       SET file_name = ?, mime_type = ?, size_bytes = ?, asset_data = ?,
           status = 'complete', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [file.fileName, file.mimeType, file.sizeBytes, file.buffer, documentId, clinicId],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Compliance document not found");

    await logAuditEvent({
      clinicId,
      userId,
      action: "COMPLIANCE_DOCUMENT_FILE_UPLOADED",
      entityType: "compliance_document",
      entityId: documentId,
      changes: { fileName: file.fileName, mimeType: file.mimeType, sizeBytes: file.sizeBytes },
    });

    return this.getDocumentFile(clinicId, userId, documentId, "COMPLIANCE_DOCUMENT_FILE_PREVIEWED");
  }

  async getDocumentFile(clinicId: string, userId: string, documentId: string, action = "COMPLIANCE_DOCUMENT_FILE_DOWNLOADED") {
    const [rows]: any = await pool.execute(
      `SELECT id, file_name as fileName, mime_type as mimeType, size_bytes as sizeBytes,
              asset_data as assetData, updated_at as updatedAt
       FROM compliance_document
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [documentId, clinicId],
    );
    const row = rows[0];
    if (!row) throw ApiError.notFound("Compliance document not found");
    if (!row.fileName || !row.assetData) throw ApiError.notFound("Compliance document file not found");

    await logAuditEvent({
      clinicId,
      userId,
      action,
      entityType: "compliance_document",
      entityId: documentId,
      changes: { fileName: row.fileName, mimeType: row.mimeType },
    });

    const buffer = Buffer.isBuffer(row.assetData) ? row.assetData : Buffer.from(row.assetData || "");
    return {
      documentId,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: Number(row.sizeBytes || buffer.length || 0),
      dataUrl: `data:${row.mimeType};base64,${buffer.toString("base64")}`,
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  async deleteDocumentFile(clinicId: string, userId: string, documentId: string): Promise<void> {
    const [result]: any = await pool.execute(
      `UPDATE compliance_document
       SET file_name = NULL, mime_type = NULL, size_bytes = NULL, asset_data = NULL,
           status = 'action_required', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL AND file_name IS NOT NULL`,
      [documentId, clinicId],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Compliance document file not found");

    await logAuditEvent({
      clinicId,
      userId,
      action: "COMPLIANCE_DOCUMENT_FILE_DELETED",
      entityType: "compliance_document",
      entityId: documentId,
    });
  }

  async listDataAccessRequests(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id, requester_name as requesterName, requester_email as requesterEmail,
              requester_phone as requesterPhone, request_type as requestType, status,
              due_date as dueDate, completed_at as completedAt, notes,
              created_at as createdAt, updated_at as updatedAt
       FROM compliance_data_access_request
       WHERE clinic_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [clinicId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      requesterName: row.requesterName,
      requesterEmail: row.requesterEmail || null,
      requesterPhone: row.requesterPhone || null,
      requestType: row.requestType,
      status: row.status,
      dueDate: row.dueDate ? new Date(row.dueDate).toISOString().slice(0, 10) : null,
      completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
      notes: row.notes || null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));
  }

  async createDataAccessRequest(clinicId: string, userId: string, data: CreateDataAccessRequestDTO) {
    const id = uuidv4();
    const dueDate = data.dueDate || this.defaultDataAccessDueDate();

    await pool.execute(
      `INSERT INTO compliance_data_access_request
        (id, clinic_id, requester_name, requester_email, requester_phone,
         request_type, status, due_date, notes, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, 'received', ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        data.requesterName.trim(),
        data.requesterEmail?.trim() || null,
        data.requesterPhone?.trim() || null,
        data.requestType,
        dueDate,
        data.notes?.trim() || null,
        userId,
        userId,
      ],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "DATA_ACCESS_REQUEST_CREATED",
      entityType: "compliance_data_access_request",
      entityId: id,
      changes: { requesterName: data.requesterName, requestType: data.requestType, dueDate },
    });

    const requests = await this.listDataAccessRequests(clinicId);
    return requests.find((request: any) => request.id === id);
  }

  async updateDataAccessRequest(clinicId: string, userId: string, requestId: string, data: UpdateDataAccessRequestDTO) {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.status !== undefined) {
      fields.push("status = ?");
      values.push(data.status);
      fields.push("completed_at = ?");
      values.push(data.status === "completed" ? new Date() : null);
    }
    if (data.dueDate !== undefined) {
      fields.push("due_date = ?");
      values.push(data.dueDate || null);
    }
    if (data.notes !== undefined) {
      fields.push("notes = ?");
      values.push(data.notes?.trim() || null);
    }

    if (fields.length === 0) {
      const requests = await this.listDataAccessRequests(clinicId);
      const request = requests.find((item: any) => item.id === requestId);
      if (!request) throw ApiError.notFound("Data access request not found");
      return request;
    }

    values.push(userId, requestId, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE compliance_data_access_request
       SET ${fields.join(", ")}, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Data access request not found");

    await logAuditEvent({
      clinicId,
      userId,
      action: "DATA_ACCESS_REQUEST_UPDATED",
      entityType: "compliance_data_access_request",
      entityId: requestId,
      changes: { ...data },
    });

    const requests = await this.listDataAccessRequests(clinicId);
    return requests.find((request: any) => request.id === requestId);
  }

  async archiveDataAccessRequest(clinicId: string, userId: string, requestId: string): Promise<void> {
    const [result]: any = await pool.execute(
      `UPDATE compliance_data_access_request
       SET deleted_at = CURRENT_TIMESTAMP, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [userId, requestId, clinicId],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Data access request not found");

    await logAuditEvent({
      clinicId,
      userId,
      action: "DATA_ACCESS_REQUEST_ARCHIVED",
      entityType: "compliance_data_access_request",
      entityId: requestId,
    });
  }

  private async ensureDocumentExists(clinicId: string, documentId: string) {
    const [rows]: any = await pool.execute(
      "SELECT id FROM compliance_document WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL LIMIT 1",
      [documentId, clinicId],
    );
    if (rows.length === 0) throw ApiError.notFound("Compliance document not found");
  }

  private parseDocumentFile(data: ComplianceDocumentFileDTO) {
    const fileName = (data.fileName || "compliance-document").trim().slice(0, 255);
    const mimeType = (data.mimeType || "").trim().toLowerCase();
    const match = /^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(data.dataUrl || "");

    if (!fileName) throw ApiError.badRequest("File name is required");
    if (!SUPPORTED_COMPLIANCE_FILE_TYPES.has(mimeType)) {
      throw ApiError.badRequest("Compliance files must be PDF, Word, text, JPG, PNG, or WebP files");
    }
    if (!match) throw ApiError.badRequest("Compliance file must be uploaded as a base64 data URL");
    const dataUrlMimeType = match[1] || "";
    const dataUrlPayload = match[2] || "";
    if (dataUrlMimeType.toLowerCase() !== mimeType) {
      throw ApiError.badRequest("Compliance file MIME type does not match the uploaded file");
    }

    const buffer = Buffer.from(dataUrlPayload.replace(/\s/g, ""), "base64");
    if (buffer.length === 0) throw ApiError.badRequest("Compliance file is empty");
    if (buffer.length > MAX_COMPLIANCE_FILE_BYTES) {
      throw ApiError.badRequest("Compliance files must be 8MB or smaller");
    }
    if (data.sizeBytes && Math.abs(Number(data.sizeBytes) - buffer.length) > 2) {
      throw ApiError.badRequest("Compliance file size does not match the uploaded file");
    }

    return { fileName, mimeType, sizeBytes: buffer.length, buffer };
  }

  private defaultDataAccessDueDate() {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    return dueDate.toISOString().slice(0, 10);
  }
}

export const complianceService = new ComplianceService();
