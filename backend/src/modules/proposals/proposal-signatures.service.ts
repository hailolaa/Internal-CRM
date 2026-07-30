import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import type { PoolConnection } from "mysql2/promise";
import pool from "../../config/database.js";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { buildTimelineMetadata, insertTimelineActivity, logTimelineActivity } from "../../utils/activity.js";
import { insertAuditEvent, logAuditEvent } from "../../utils/audit.js";
import { proposalsService } from "./proposals.service.js";
import type {
  ProposalSignatureCreateDTO,
  ProposalSignatureEvidenceRecord,
  ProposalSignatureRequestRecord,
  ProposalSignatureStatus,
  ProposalSignatureWebhookDTO,
} from "./proposal-signatures.types.js";

type QueryExecutor = Pick<PoolConnection, "execute">;

function cleanString(value: unknown) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function toIso(value: unknown) {
  if (!value) return null;
  return new Date(value as string).toISOString();
}

function toMysqlDateTime(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace("T", " ");
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 19).replace("T", " ");
  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

function sha256(value: string | Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableJson(value: Record<string, unknown>) {
  return JSON.stringify(value);
}

function parseJson(value: unknown) {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function mapSignatureStatus(value: unknown): ProposalSignatureStatus {
  const normalized = String(value || "").trim().toLowerCase().replace(/[-\s]+/g, "_");
  if (["completed", "complete", "signed", "accepted"].includes(normalized)) return "signed";
  if (["sent", "delivered"].includes(normalized)) return "sent";
  if (["viewed", "opened"].includes(normalized)) return "viewed";
  if (["declined", "rejected"].includes(normalized)) return "declined";
  if (["expired"].includes(normalized)) return "expired";
  if (["cancelled", "canceled", "voided"].includes(normalized)) return "cancelled";
  if (["failed", "error"].includes(normalized)) return "failed";
  return "requested";
}

function mapEvidence(row: any): ProposalSignatureEvidenceRecord | null {
  if (!row.evidenceId) return null;
  return {
    id: row.evidenceId,
    proposalId: row.evidenceProposalId,
    signatureRequestId: row.evidenceSignatureRequestId,
    provider: row.evidenceProvider,
    providerRequestId: row.evidenceProviderRequestId || null,
    signerName: row.evidenceSignerName,
    signerEmail: row.evidenceSignerEmail,
    signedAt: new Date(row.evidenceSignedAt).toISOString(),
    signedPdfUrl: row.evidenceSignedPdfUrl || null,
    auditCertificateUrl: row.evidenceAuditCertificateUrl || null,
    evidenceSha256: row.evidenceSha256,
    evidenceJson: parseJson(row.evidenceJson),
    createdAt: new Date(row.evidenceCreatedAt).toISOString(),
  };
}

function mapSignatureRequest(row: any): ProposalSignatureRequestRecord {
  return {
    id: row.id,
    proposalId: row.proposalId,
    provider: row.provider,
    providerRequestId: row.providerRequestId || null,
    status: row.status,
    signerName: row.signerName || null,
    signerEmail: row.signerEmail || null,
    signatureUrl: row.signatureUrl || null,
    idempotencyKey: row.idempotencyKey,
    requestedAt: new Date(row.requestedAt).toISOString(),
    sentAt: toIso(row.sentAt),
    viewedAt: toIso(row.viewedAt),
    signedAt: toIso(row.signedAt),
    declinedAt: toIso(row.declinedAt),
    expiredAt: toIso(row.expiredAt),
    failureReason: row.failureReason || null,
    createdBy: row.createdBy || null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    evidence: mapEvidence(row),
  };
}

function signatureSelectSql() {
  return `SELECT sr.id,
                 sr.proposal_id as proposalId,
                 sr.provider,
                 sr.provider_request_id as providerRequestId,
                 sr.status,
                 sr.signer_name as signerName,
                 sr.signer_email as signerEmail,
                 sr.signature_url as signatureUrl,
                 sr.idempotency_key as idempotencyKey,
                 sr.requested_at as requestedAt,
                 sr.sent_at as sentAt,
                 sr.viewed_at as viewedAt,
                 sr.signed_at as signedAt,
                 sr.declined_at as declinedAt,
                 sr.expired_at as expiredAt,
                 sr.failure_reason as failureReason,
                 sr.created_by as createdBy,
                 sr.created_at as createdAt,
                 sr.updated_at as updatedAt,
                 se.id as evidenceId,
                 se.proposal_id as evidenceProposalId,
                 se.signature_request_id as evidenceSignatureRequestId,
                 se.provider as evidenceProvider,
                 se.provider_request_id as evidenceProviderRequestId,
                 se.signer_name as evidenceSignerName,
                 se.signer_email as evidenceSignerEmail,
                 se.signed_at as evidenceSignedAt,
                 se.signed_pdf_url as evidenceSignedPdfUrl,
                 se.audit_certificate_url as evidenceAuditCertificateUrl,
                 se.evidence_sha256 as evidenceSha256,
                 se.evidence_json as evidenceJson,
                 se.created_at as evidenceCreatedAt
          FROM proposal_signature_request sr
          LEFT JOIN proposal_signature_evidence se
            ON se.signature_request_id = sr.id`;
}

export class ProposalSignaturesService {
  verifyWebhookSignature(rawBody: Buffer | undefined, signatureHeader: string | undefined) {
    if (!rawBody) throw ApiError.badRequest("Raw e-sign webhook body is required for signature validation");
    if (!config.esign.webhookSecret) throw ApiError.serviceUnavailable("E-sign webhook secret is not configured");
    const provided = cleanString(signatureHeader);
    if (!provided) throw ApiError.unauthorized("Missing e-sign webhook signature");

    const expectedDigest = crypto
      .createHmac("sha256", config.esign.webhookSecret)
      .update(rawBody)
      .digest("hex");
    const expected = `sha256=${expectedDigest}`;
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw ApiError.unauthorized("Invalid e-sign webhook signature");
    }
  }

  async listSignatureRequests(clinicId: string, proposalId: string) {
    await proposalsService.getProposal(clinicId, proposalId);
    return this.listSignatureRequestsForProposal(clinicId, proposalId);
  }

  async createSignatureRequest(
    clinicId: string,
    userId: string,
    proposalId: string,
    data: ProposalSignatureCreateDTO,
  ) {
    const proposal = await proposalsService.getProposal(clinicId, proposalId);
    if (proposal.status === "archived") throw ApiError.notFound("Proposal not found");
    if (!proposal.proposalUrl) {
      await proposalsService.createProposalShare(clinicId, userId, proposalId);
    }
    const refreshed = await proposalsService.getProposal(clinicId, proposalId);
    const signerName =
      cleanString(data.signerName) ||
      refreshed.sentToName ||
      refreshed.contactName ||
      refreshed.accountName ||
      refreshed.clientAccountName;
    const signerEmail =
      cleanString(data.signerEmail) ||
      refreshed.sentToEmail ||
      refreshed.contactEmail;
    if (!signerName || !signerEmail) {
      throw ApiError.badRequest("Signer name and email are required before creating a signature request");
    }

    const idempotencyKey =
      cleanString(data.idempotencyKey) ||
      `proposal:${proposalId}:signer:${signerEmail.toLowerCase()}`;
    const provider = config.esign.provider;
    const signatureRequestId = uuidv4();
    const providerRequestId = `${provider}_${signatureRequestId}`;
    const signatureUrl = provider === "log"
      ? refreshed.proposalUrl
      : null;

    await pool.execute(
      `INSERT INTO proposal_signature_request
        (id, clinic_id, proposal_id, provider, provider_request_id, status,
         signer_name, signer_email, signature_url, idempotency_key, sent_at, created_by)
       VALUES (?, ?, ?, ?, ?, 'sent', ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
       ON DUPLICATE KEY UPDATE
         updated_at = CURRENT_TIMESTAMP`,
      [
        signatureRequestId,
        clinicId,
        proposalId,
        provider,
        providerRequestId,
        signerName,
        signerEmail,
        signatureUrl,
        idempotencyKey,
        userId,
      ],
    );

    const request = await this.getByIdempotencyKey(clinicId, idempotencyKey);
    await this.logSignatureActivity({
      clinicId,
      userId,
      proposalId,
      action: "proposal_signature_request_created",
      changes: {
        signatureRequestId: request.id,
        provider: request.provider,
        providerRequestId: request.providerRequestId,
        signerName: request.signerName,
        signerEmail: request.signerEmail,
        status: request.status,
      },
    });
    await logAuditEvent({
      clinicId,
      userId,
      action: "PROPOSAL_SIGNATURE_REQUEST_CREATED",
      entityType: "proposal_signature_request",
      entityId: request.id,
      changes: {
        proposalId,
        provider: request.provider,
        providerRequestId: request.providerRequestId,
        signerEmail: request.signerEmail,
        status: request.status,
      },
    });

    return request;
  }

  async handleProviderWebhook(provider: string, payload: ProposalSignatureWebhookDTO, rawBody: Buffer) {
    const normalizedProvider = cleanString(provider) || config.esign.provider;
    const providerRequestId = cleanString(payload.providerRequestId);
    const providerEventId = cleanString(payload.providerEventId) || sha256(rawBody);
    if (!providerRequestId) throw ApiError.badRequest("providerRequestId is required");
    if (!providerEventId) throw ApiError.badRequest("providerEventId is required");

    const status = mapSignatureStatus(payload.status || payload.eventType);
    const rawPayloadJson = JSON.stringify(payload || {});
    const rawPayloadSha256 = sha256(rawBody);
    const eventId = uuidv4();

    return this.withTransaction(async (connection) => {
      const [requestRows]: any = await connection.execute(
        `SELECT sr.id,
                sr.clinic_id as clinicId,
                sr.proposal_id as proposalId,
                sr.status,
                sr.signer_name as signerName,
                sr.signer_email as signerEmail,
                sr.provider,
                sr.provider_request_id as providerRequestId
         FROM proposal_signature_request sr
         WHERE sr.provider = ?
           AND sr.provider_request_id = ?
           AND sr.deleted_at IS NULL
         LIMIT 1
         FOR UPDATE`,
        [normalizedProvider, providerRequestId],
      );
      if (requestRows.length === 0) throw ApiError.notFound("Signature request not found");
      const request = requestRows[0];

      const [eventInsertResult]: any = await connection.execute(
        `INSERT IGNORE INTO proposal_signature_event
          (id, clinic_id, proposal_id, signature_request_id, provider, provider_event_id,
           event_type, status, signer_name, signer_email, signed_pdf_url, audit_certificate_url,
           raw_payload_sha256, raw_payload_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          request.clinicId,
          request.proposalId,
          request.id,
          normalizedProvider,
          providerEventId,
          cleanString(payload.eventType) || status,
          status,
          cleanString(payload.signerName) || request.signerName,
          cleanString(payload.signerEmail) || request.signerEmail,
          cleanString(payload.signedPdfUrl),
          cleanString(payload.auditCertificateUrl),
          rawPayloadSha256,
          rawPayloadJson,
        ],
      );

      if (Number(eventInsertResult.affectedRows || 0) === 0) {
        const signatureRequest = await this.getSignatureRequestById(
          request.clinicId,
          request.id,
          connection,
        );
        return { duplicate: true, signatureRequest };
      }

      await this.applySignatureStatus(connection, request, status, payload, rawPayloadSha256);
      const signatureRequest = await this.getSignatureRequestById(
        request.clinicId,
        request.id,
        connection,
      );

      await this.logSignatureActivity({
        clinicId: request.clinicId,
        userId: null,
        proposalId: request.proposalId,
        action: "proposal_signature_event_received",
        changes: {
          signatureRequestId: request.id,
          provider: normalizedProvider,
          providerRequestId,
          providerEventId,
          status,
          duplicate: false,
        },
      }, connection);
      await insertAuditEvent(connection, {
        clinicId: request.clinicId,
        userId: null,
        action: "PROPOSAL_SIGNATURE_EVENT_RECEIVED",
        entityType: "proposal_signature_request",
        entityId: request.id,
        changes: {
          proposalId: request.proposalId,
          provider: normalizedProvider,
          providerRequestId,
          providerEventId,
          status,
        },
      });

      return { duplicate: false, signatureRequest };
    });
  }

  private async applySignatureStatus(
    executor: QueryExecutor,
    request: any,
    status: ProposalSignatureStatus,
    payload: ProposalSignatureWebhookDTO,
    rawPayloadSha256: string,
  ) {
    const timestampColumn: Partial<Record<ProposalSignatureStatus, string>> = {
      sent: "sent_at",
      viewed: "viewed_at",
      signed: "signed_at",
      declined: "declined_at",
      expired: "expired_at",
    };
    const statusTime = toMysqlDateTime(payload.signedAt) || new Date().toISOString().slice(0, 19).replace("T", " ");
    const statusColumn = timestampColumn[status];
    const timestampSql = statusColumn ? `, ${statusColumn} = COALESCE(${statusColumn}, ?)` : "";
    const values: any[] = [
      status,
      cleanString(payload.signerName) || request.signerName,
      cleanString(payload.signerEmail) || request.signerEmail,
    ];
    if (statusColumn) values.push(statusTime);
    values.push(request.id, request.clinicId);
    await executor.execute(
      `UPDATE proposal_signature_request
       SET status = ?,
           signer_name = COALESCE(?, signer_name),
           signer_email = COALESCE(?, signer_email)
           ${timestampSql},
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL`,
      values,
    );

    if (status !== "signed") return;

    const signerName = cleanString(payload.signerName) || request.signerName;
    const signerEmail = cleanString(payload.signerEmail) || request.signerEmail;
    if (!signerName || !signerEmail) {
      throw ApiError.badRequest("Signed e-sign callbacks require signer name and email");
    }
    const signedAt = toMysqlDateTime(payload.signedAt) || statusTime;
    const evidence = {
      provider: request.provider,
      providerRequestId: request.providerRequestId,
      signerName,
      signerEmail,
      signedAt,
      signedPdfUrl: cleanString(payload.signedPdfUrl),
      auditCertificateUrl: cleanString(payload.auditCertificateUrl),
      providerEvidence: payload.evidence || {},
      rawPayloadSha256,
    };
    const evidenceJson = stableJson(evidence);
    const evidenceSha256 = cleanString(payload.evidenceSha256) || sha256(evidenceJson);
    const evidenceId = uuidv4();
    await executor.execute(
      `INSERT IGNORE INTO proposal_signature_evidence
        (id, clinic_id, proposal_id, signature_request_id, provider, provider_request_id,
         signer_name, signer_email, signed_at, signed_pdf_url, audit_certificate_url,
         evidence_sha256, evidence_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evidenceId,
        request.clinicId,
        request.proposalId,
        request.id,
        request.provider,
        request.providerRequestId,
        signerName,
        signerEmail,
        signedAt,
        evidence.signedPdfUrl,
        evidence.auditCertificateUrl,
        evidenceSha256,
        evidenceJson,
      ],
    );

  }

  private async listSignatureRequestsForProposal(clinicId: string, proposalId: string) {
    const [rows]: any = await pool.execute(
      `${signatureSelectSql()}
       WHERE sr.clinic_id = ?
         AND sr.proposal_id = ?
         AND sr.deleted_at IS NULL
       ORDER BY sr.created_at DESC`,
      [clinicId, proposalId],
    );
    return rows.map(mapSignatureRequest);
  }

  private async getByIdempotencyKey(clinicId: string, idempotencyKey: string) {
    const [rows]: any = await pool.execute(
      `${signatureSelectSql()}
       WHERE sr.clinic_id = ?
         AND sr.idempotency_key = ?
         AND sr.deleted_at IS NULL
       LIMIT 1`,
      [clinicId, idempotencyKey],
    );
    if (rows.length === 0) throw ApiError.internal("Signature request was not saved");
    return mapSignatureRequest(rows[0]);
  }

  private async getSignatureRequestById(
    clinicId: string,
    signatureRequestId: string,
    executor: QueryExecutor = pool,
  ) {
    const [rows]: any = await executor.execute(
      `${signatureSelectSql()}
       WHERE sr.clinic_id = ?
         AND sr.id = ?
         AND sr.deleted_at IS NULL
       LIMIT 1`,
      [clinicId, signatureRequestId],
    );
    if (rows.length === 0) throw ApiError.notFound("Signature request not found");
    return mapSignatureRequest(rows[0]);
  }

  private async withTransaction<T>(work: (connection: PoolConnection) => Promise<T>) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async logSignatureActivity(input: {
    clinicId: string;
    userId: string | null;
    proposalId: string;
    action: string;
    changes: Record<string, unknown>;
  }, executor?: QueryExecutor) {
    const proposal = await proposalsService.getProposal(input.clinicId, input.proposalId, executor || pool);
    const contactId = proposal.contactId;
    if (!contactId) return;
    const payload = {
      clinicId: input.clinicId,
      contactId,
      type: "StatusChange",
      userId: input.userId,
      metadata: buildTimelineMetadata({
        action: input.action,
        source: "proposal",
        recordId: input.proposalId,
        title: proposal.proposalName,
        status: proposal.status,
        changes: input.changes,
      }),
    } as const;
    if (executor) {
      await insertTimelineActivity(executor, payload);
    } else {
      await logTimelineActivity(payload);
    }
  }
}

export const proposalSignaturesService = new ProposalSignaturesService();
