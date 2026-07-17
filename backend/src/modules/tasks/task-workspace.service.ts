import { createHash } from "crypto";
import { createReadStream } from "fs";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { v4 as uuidv4 } from "uuid";

const blockedExtensions = new Set([".exe", ".dll", ".bat", ".cmd", ".com", ".msi", ".ps1", ".sh", ".js", ".html", ".htm", ".php"]);
const blockedMimeTypes = new Set(["application/x-msdownload", "application/x-sh", "application/javascript", "text/javascript", "text/html"]);

function userName(row: any) {
  return [row.firstName, row.lastName].filter(Boolean).join(" ") || row.email || "Former team member";
}

export class TaskWorkspaceService {
  private async ensureTask(clinicId: string, taskId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id FROM task WHERE id = ? AND clinic_id = ? AND is_internal = 1 AND deleted_at IS NULL LIMIT 1`,
      [taskId, clinicId],
    );
    if (!rows.length) throw ApiError.notFound("Task not found");
  }

  async getTask(clinicId: string, taskId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id, title, description, priority, status, category, contact_id as contactId,
              contact_name as contact, due_label as due, DATE_FORMAT(due_date, '%Y-%m-%d') as dueDate,
              assigned_to as assignedTo, assigned_user_id as assignedUserId, board_key as boardKey,
              service_type as serviceType, client_account_profile_id as clientAccountProfileId,
              client_account_service_id as clientAccountServiceId, needs_qa as needsQa,
              approval_status as approvalStatus, created_at as createdAt, updated_at as updatedAt
       FROM task WHERE id = ? AND clinic_id = ? AND is_internal = 1 AND deleted_at IS NULL LIMIT 1`,
      [taskId, clinicId],
    );
    if (!rows.length) throw ApiError.notFound("Task not found");
    return { ...rows[0], needsQa: Boolean(rows[0].needsQa) };
  }

  async listComments(clinicId: string, taskId: string) {
    await this.ensureTask(clinicId, taskId);
    const [rows]: any = await pool.execute(
      `SELECT c.id, c.body, c.author_user_id as authorUserId, c.created_at as createdAt,
              c.updated_at as updatedAt, c.deleted_at as deletedAt,
              u.first_name as firstName, u.last_name as lastName, u.email
       FROM task_comment c LEFT JOIN user u ON u.id = c.author_user_id
       WHERE c.clinic_id = ? AND c.task_id = ? ORDER BY c.created_at ASC`,
      [clinicId, taskId],
    );
    const ids = rows.map((row: any) => row.id);
    let mentions: any[] = [];
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      const [mentionRows]: any = await pool.execute(
        `SELECT m.comment_id as commentId, u.id as userId, u.first_name as firstName,
                u.last_name as lastName, u.email
         FROM task_comment_mention m JOIN user u ON u.id = m.mentioned_user_id
         WHERE m.comment_id IN (${placeholders})`, ids,
      );
      mentions = mentionRows;
    }
    return rows.map((row: any) => ({
      id: row.id,
      body: row.deletedAt ? null : row.body,
      authorUserId: row.authorUserId,
      authorName: userName(row),
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      deletedAt: row.deletedAt ? new Date(row.deletedAt).toISOString() : null,
      mentions: mentions.filter((item) => item.commentId === row.id).map((item) => ({ userId: item.userId, name: userName(item) })),
    }));
  }

  async createComment(clinicId: string, userId: string, taskId: string, body: string, mentionedUserIds: string[] = []) {
    await this.ensureTask(clinicId, taskId);
    const cleanBody = body.trim();
    if (!cleanBody) throw ApiError.badRequest("Comment cannot be empty");
    const uniqueMentions = [...new Set(mentionedUserIds)].slice(0, 20);
    if (uniqueMentions.length) {
      const placeholders = uniqueMentions.map(() => "?").join(",");
      const [users]: any = await pool.execute(
        `SELECT id FROM user WHERE clinic_id = ? AND deleted_at IS NULL AND id IN (${placeholders})`,
        [clinicId, ...uniqueMentions],
      );
      if (users.length !== uniqueMentions.length) throw ApiError.badRequest("One or more mentioned users are unavailable");
    }
    const id = uuidv4();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `INSERT INTO task_comment (id, clinic_id, task_id, author_user_id, body) VALUES (?, ?, ?, ?, ?)`,
        [id, clinicId, taskId, userId, cleanBody],
      );
      for (const mentionedUserId of uniqueMentions) {
        await connection.execute(`INSERT INTO task_comment_mention (comment_id, mentioned_user_id) VALUES (?, ?)`, [id, mentionedUserId]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    await logAuditEvent({ clinicId, userId, action: "TASK_COMMENT_CREATED", entityType: "task", entityId: taskId, changes: { commentId: id, mentionedUserIds: uniqueMentions } });
    return id;
  }

  async deleteComment(clinicId: string, userId: string, taskId: string, commentId: string) {
    await this.ensureTask(clinicId, taskId);
    const [result]: any = await pool.execute(
      `UPDATE task_comment SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND task_id = ? AND deleted_at IS NULL`,
      [commentId, clinicId, taskId],
    );
    if (!result.affectedRows) throw ApiError.notFound("Comment not found");
    await logAuditEvent({ clinicId, userId, action: "TASK_COMMENT_DELETED", entityType: "task", entityId: taskId, changes: { commentId } });
  }

  async listAttachments(clinicId: string, taskId: string) {
    await this.ensureTask(clinicId, taskId);
    const [rows]: any = await pool.execute(
      `SELECT a.id, a.original_name as fileName, a.mime_type as mimeType, a.size_bytes as sizeBytes,
              a.uploaded_by_user_id as uploadedByUserId, a.created_at as createdAt,
              u.first_name as firstName, u.last_name as lastName, u.email
       FROM task_attachment a LEFT JOIN user u ON u.id = a.uploaded_by_user_id
       WHERE a.clinic_id = ? AND a.task_id = ? AND a.deleted_at IS NULL ORDER BY a.created_at DESC`,
      [clinicId, taskId],
    );
    return rows.map((row: any) => ({ ...row, sizeBytes: Number(row.sizeBytes), uploadedByName: userName(row), createdAt: new Date(row.createdAt).toISOString() }));
  }

  async uploadAttachment(clinicId: string, userId: string, taskId: string, file?: Express.Multer.File) {
    await this.ensureTask(clinicId, taskId);
    if (!file) throw ApiError.badRequest("Choose a file to upload");
    const extension = path.extname(file.originalname).toLowerCase();
    if (blockedExtensions.has(extension) || blockedMimeTypes.has(file.mimetype.toLowerCase())) throw ApiError.badRequest("This file type is not allowed");
    const id = uuidv4();
    const storageKey = `${clinicId}/${taskId}/${id}`;
    const absolutePath = path.join(config.taskUploads.directory, storageKey);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer, { flag: "wx", mode: 0o600 });
    try {
      await pool.execute(
        `INSERT INTO task_attachment
          (id, clinic_id, task_id, uploaded_by_user_id, storage_key, original_name, mime_type, size_bytes, sha256)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, clinicId, taskId, userId, storageKey, file.originalname.slice(0, 255), file.mimetype || "application/octet-stream", file.size, createHash("sha256").update(file.buffer).digest("hex")],
      );
    } catch (error) {
      await unlink(absolutePath).catch(() => undefined);
      throw error;
    }
    await logAuditEvent({ clinicId, userId, action: "TASK_ATTACHMENT_UPLOADED", entityType: "task", entityId: taskId, changes: { attachmentId: id, fileName: file.originalname, sizeBytes: file.size } });
    return id;
  }

  async getAttachment(clinicId: string, taskId: string, attachmentId: string) {
    await this.ensureTask(clinicId, taskId);
    const [rows]: any = await pool.execute(
      `SELECT storage_key as storageKey, original_name as fileName, mime_type as mimeType
       FROM task_attachment WHERE id = ? AND clinic_id = ? AND task_id = ? AND deleted_at IS NULL LIMIT 1`,
      [attachmentId, clinicId, taskId],
    );
    if (!rows.length) throw ApiError.notFound("Attachment not found");
    return { ...rows[0], stream: createReadStream(path.join(config.taskUploads.directory, rows[0].storageKey)) };
  }

  async deleteAttachment(clinicId: string, userId: string, taskId: string, attachmentId: string) {
    const attachment = await this.getAttachment(clinicId, taskId, attachmentId);
    const [result]: any = await pool.execute(
      `UPDATE task_attachment SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ? AND task_id = ? AND deleted_at IS NULL`,
      [attachmentId, clinicId, taskId],
    );
    if (!result.affectedRows) throw ApiError.notFound("Attachment not found");
    attachment.stream.destroy();
    const [rows]: any = await pool.execute(`SELECT storage_key as storageKey FROM task_attachment WHERE id = ?`, [attachmentId]);
    await unlink(path.join(config.taskUploads.directory, rows[0].storageKey)).catch(() => undefined);
    await logAuditEvent({ clinicId, userId, action: "TASK_ATTACHMENT_DELETED", entityType: "task", entityId: taskId, changes: { attachmentId, fileName: attachment.fileName } });
  }

  async listActivity(clinicId: string, taskId: string) {
    await this.ensureTask(clinicId, taskId);
    const [rows]: any = await pool.execute(
      `SELECT a.id, a.action, a.changes, a.created_at as createdAt,
              u.first_name as firstName, u.last_name as lastName, u.email
       FROM audit_log a LEFT JOIN user u ON u.id = a.user_id
       WHERE a.clinic_id = ? AND a.entity_type = 'task' AND a.entity_id = ?
       ORDER BY a.created_at DESC LIMIT 100`,
      [clinicId, taskId],
    );
    return rows.map((row: any) => ({ id: row.id, action: row.action, actorName: userName(row), changes: typeof row.changes === "string" ? JSON.parse(row.changes || "{}") : row.changes || {}, createdAt: new Date(row.createdAt).toISOString() }));
  }
}

export const taskWorkspaceService = new TaskWorkspaceService();
