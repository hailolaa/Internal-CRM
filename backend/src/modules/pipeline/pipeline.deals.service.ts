import { v4 as uuidv4 } from "uuid";
import type { PoolConnection } from "mysql2/promise";
import pool from "../../config/database.js";
import { userHasPermission } from "../../middleware/authorize.js";
import { ApiError } from "../../utils/ApiError.js";
import { buildTimelineMetadata, insertTimelineActivity, logTimelineActivity } from "../../utils/activity.js";
import { insertAuditEvent, logAuditEvent } from "../../utils/audit.js";
import { phase1TimelineActions } from "../events/phase1-events.js";
import { isAuditWorkflowStatus } from "../audit-workflow/audit-workflow.constants.js";
import { clientAccountsService } from "../client-accounts/client-accounts.service.js";
import {
  buildPipelineDealList,
  mapPipelineDeal,
} from "./pipeline.mappers.js";
import {
  getFirstPipelineStage,
  getPipelineDealContact,
  getPipelineDealRow,
  getPipelineStageForDeal,
  insertPipelineDeal,
  insertPipelineDealMovement,
  listPipelineDealRows,
  movePipelineDealStage,
  softDeletePipelineDeal,
  updatePipelineDealFields,
  type PipelineDealContactRow,
  type PipelineDealMoveValues,
  type PipelineDealStageRow,
  type PipelineDealUpdateValues,
} from "./pipeline.deals.persistence.js";
import { pipelineService } from "./pipeline.service.js";
import type {
  CreatePipelineDealDTO,
  MovePipelineDealDTO,
  PipelineDealListResponse,
  PipelineDealResponse,
  PipelineDealStatus,
  UpdatePipelineDealDTO,
} from "./pipeline.types.js";

function centsToValue(valueCents: number | null | undefined) {
  return valueCents == null ? null : valueCents / 100;
}

function toMysqlDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : null;
}

function toMysqlDateTime(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function optionalMysqlDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 19).replace("T", " ");
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function normalizeAuditStatus(value: unknown) {
  return isAuditWorkflowStatus(value) ? value : null;
}

function getContactName(contact: PipelineDealContactRow) {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  return name || contact.email || "Unknown contact";
}

function getPrimaryTreatment(treatmentInterests: unknown) {
  if (Array.isArray(treatmentInterests)) return String(treatmentInterests[0] || "") || null;
  if (typeof treatmentInterests !== "string") return null;

  try {
    const parsed = JSON.parse(treatmentInterests);
    return Array.isArray(parsed) ? String(parsed[0] || "") || null : null;
  } catch {
    return null;
  }
}

function getDefaultDealTitle(contact: PipelineDealContactRow, treatment: string | null, stage: string) {
  const contactName = getContactName(contact);
  return treatment ? `${contactName} - ${treatment}` : `${contactName} - ${stage}`;
}

function getStatusForStage(stage: PipelineDealStageRow): PipelineDealStatus {
  if (stage.kind === "won" || stage.kind === "lost") return stage.kind;
  return "open";
}

function getEffectiveLostOutcome(data: MovePipelineDealDTO, existing: PipelineDealResponse) {
  return {
    lostReason: data.lostReason?.trim() || existing.lostReason || null,
    objectionType: data.objectionType?.trim() || existing.objectionType || null,
  };
}

type EffectiveLostOutcome = ReturnType<typeof getEffectiveLostOutcome>;

function getMoveValues(
  stage: PipelineDealStageRow,
  data: MovePipelineDealDTO,
  existing: PipelineDealResponse,
): PipelineDealMoveValues {
  const stageName = stage.name.toLowerCase();
  const values: PipelineDealMoveValues = {
    stageId: stage.id,
    stageName: stage.name,
    status: getStatusForStage(stage),
  };

  if (data.valueCents !== undefined) values.value = centsToValue(data.valueCents);
  if (stageName.includes("booked")) values.bookedAt = toMysqlDateTime(data.bookedAt);
  if (stage.kind === "won") values.soldAt = toMysqlDateTime(data.soldAt);
  if (stage.kind === "lost") {
    const outcome = getEffectiveLostOutcome(data, existing);
    values.lostAt = toMysqlDateTime(data.lostAt);
    values.lostReason = outcome.lostReason;
    values.objectionType = outcome.objectionType;
  }

  return values;
}

function isBookedStage(stage: PipelineDealStageRow) {
  const name = stage.name.toLowerCase();
  return name.includes("booked");
}

function validateMove(stage: PipelineDealStageRow, data: MovePipelineDealDTO, existing: PipelineDealResponse) {
  if (isBookedStage(stage) && !data.bookedAt && !existing.bookedAt) {
    throw ApiError.badRequest("bookedAt is required when moving an opportunity to Discovery Call Booked");
  }

  if (stage.kind === "won") {
    const valueCents = data.valueCents ?? existing.valueCents;
    if (!valueCents || valueCents <= 0) {
      throw ApiError.badRequest("valueCents is required when moving an opportunity to Won");
    }
    if (!existing.treatment) {
      throw ApiError.badRequest("Service / Package is required before moving an opportunity to Won");
    }
  }

  if (stage.kind === "lost") {
    const outcome = getEffectiveLostOutcome(data, existing);
    if (!outcome.lostReason) {
      throw ApiError.badRequest("lostReason is required when moving an opportunity to Lost");
    }
    if (!outcome.objectionType) {
      throw ApiError.badRequest("objectionType is required when moving an opportunity to Lost");
    }
  }
}

export class PipelineDealsService {
  private async insertLostMoveEvents(
    connection: Pick<PoolConnection, "execute">,
    context: {
      clinicId: string;
      userId: string;
      dealId: string;
      movementId: string;
      existing: PipelineDealResponse;
      stage: PipelineDealStageRow;
      data: MovePipelineDealDTO;
      outcome: EffectiveLostOutcome;
    },
  ) {
    const {
      clinicId,
      userId,
      dealId,
      movementId,
      existing,
      stage,
      data,
      outcome,
    } = context;
    await insertPipelineDealMovement({
      id: movementId,
      clinicId,
      dealId,
      pipelineId: existing.pipelineId,
      fromStageId: existing.stageId,
      toStageId: stage.id,
      fromStage: existing.stageName,
      toStage: stage.name,
      movedBy: userId,
      metadata: {
        notes: data.notes || null,
        valueCents: data.valueCents ?? existing.valueCents,
        lostReason: outcome.lostReason,
        objectionType: outcome.objectionType,
      },
    }, connection);
    await insertTimelineActivity(connection, {
      clinicId,
      contactId: existing.contactId,
      type: "StatusChange",
      userId,
      metadata: buildTimelineMetadata({
        action: phase1TimelineActions.leadStageChanged,
        source: "pipeline",
        recordId: dealId,
        changes: {
          fromStage: existing.stageName,
          toStage: stage.name,
          lostReason: outcome.lostReason,
          objectionType: outcome.objectionType,
        },
      }),
    });
    await insertAuditEvent(connection, {
      clinicId,
      userId,
      action: "PIPELINE_DEAL_MOVED",
      entityType: "deal",
      entityId: dealId,
      changes: {
        fromStage: existing.stageName,
        toStage: stage.name,
        movementId,
        lostReason: outcome.lostReason,
        objectionType: outcome.objectionType,
      },
    });
  }

  private async persistLostMove(context: {
    clinicId: string;
    userId: string;
    dealId: string;
    movementId: string;
    existing: PipelineDealResponse;
    stage: PipelineDealStageRow;
    data: MovePipelineDealDTO;
    moveValues: PipelineDealMoveValues;
    outcome: EffectiveLostOutcome;
  }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const moved = await movePipelineDealStage(
        context.clinicId,
        context.dealId,
        context.moveValues,
        context.existing.stageId,
        connection,
      );
      if (moved !== 1) {
        throw ApiError.conflict("Opportunity moved while this update was in progress.");
      }

      const [relationRows]: any = await connection.execute(
        `SELECT d.client_account_profile_id as clientAccountProfileId
         FROM deal d
         JOIN contact c
           ON c.id = d.contact_id
          AND c.clinic_id = d.clinic_id
          AND c.deleted_at IS NULL
         WHERE d.id = ?
           AND d.clinic_id = ?
           AND d.deleted_at IS NULL
         LIMIT 1
         FOR UPDATE`,
        [context.dealId, context.clinicId],
      );
      if (!relationRows[0]) {
        throw ApiError.conflict("Linked contact changed while this opportunity was being marked lost.");
      }

      await connection.execute(
        `UPDATE contact
         SET lost_reason = ?,
             objection_type = ?,
             lead_status = CASE
               WHEN lead_status = 'converted'
                 OR ? IS NOT NULL
                 OR LOWER(COALESCE(status, '')) = 'client'
               THEN 'converted'
               ELSE 'lost'
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND clinic_id = ?
           AND deleted_at IS NULL`,
        [
          context.outcome.lostReason,
          context.outcome.objectionType,
          relationRows[0].clientAccountProfileId,
          context.existing.contactId,
          context.clinicId,
        ],
      );

      await this.insertLostMoveEvents(connection, context);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async insertWonMoveEvents(
    connection: Pick<PoolConnection, "execute">,
    context: {
      clinicId: string;
      userId: string;
      dealId: string;
      movementId: string;
      existing: PipelineDealResponse;
      stage: PipelineDealStageRow;
      data: MovePipelineDealDTO;
    },
  ) {
    const { clinicId, userId, dealId, movementId, existing, stage, data } = context;
    await insertPipelineDealMovement({
      id: movementId,
      clinicId,
      dealId,
      pipelineId: existing.pipelineId,
      fromStageId: existing.stageId,
      toStageId: stage.id,
      fromStage: existing.stageName,
      toStage: stage.name,
      movedBy: userId,
      metadata: {
        notes: data.notes || null,
        valueCents: data.valueCents ?? existing.valueCents,
        lostReason: data.lostReason || null,
        objectionType: data.objectionType || null,
      },
    }, connection);
    await insertTimelineActivity(connection, {
      clinicId,
      contactId: existing.contactId,
      type: "StatusChange",
      userId,
      metadata: buildTimelineMetadata({
        action: phase1TimelineActions.leadStageChanged,
        source: "pipeline",
        recordId: dealId,
        changes: {
          fromStage: existing.stageName,
          toStage: stage.name,
          lostReason: data.lostReason || existing.lostReason || null,
          objectionType: data.objectionType || existing.objectionType || null,
        },
      }),
    });
    await insertAuditEvent(connection, {
      clinicId,
      userId,
      action: "PIPELINE_DEAL_MOVED",
      entityType: "deal",
      entityId: dealId,
      changes: {
        fromStage: existing.stageName,
        toStage: stage.name,
        movementId,
        lostReason: data.lostReason || existing.lostReason || null,
        objectionType: data.objectionType || existing.objectionType || null,
      },
    });
  }

  async listDeals(clinicId: string, userId?: string | null): Promise<PipelineDealListResponse> {
    const pipelineId = await pipelineService.ensureDefaultPipeline(clinicId, userId);
    const rows = await listPipelineDealRows(clinicId, pipelineId);
    return buildPipelineDealList(rows.map(mapPipelineDeal));
  }

  async createDeal(
    clinicId: string,
    userId: string,
    data: CreatePipelineDealDTO,
  ): Promise<PipelineDealResponse> {
    const pipelineId = await pipelineService.ensureDefaultPipeline(clinicId, userId);
    const contact = await getPipelineDealContact(clinicId, data.contactId);
    if (!contact) throw ApiError.notFound("Contact not found");

    const stage = data.stageId
      ? await getPipelineStageForDeal(clinicId, pipelineId, data.stageId)
      : await getFirstPipelineStage(clinicId, pipelineId);
    if (!stage) throw ApiError.notFound("Pipeline stage not found");
    if (stage.kind === "won" || stage.kind === "lost") {
      throw ApiError.badRequest(
        `Create the opportunity in an open stage, then move it to ${stage.kind === "won" ? "Won" : "Lost"}.`,
      );
    }

    const treatment = data.treatment || getPrimaryTreatment(contact.treatmentInterests);
    const value = data.valueCents !== undefined
      ? centsToValue(data.valueCents)
      : centsToValue(Math.round(Number(contact.value || 0) * 100));
    const dealId = uuidv4();

    await insertPipelineDeal({
      id: dealId,
      clinicId,
      contactId: contact.id,
      pipelineId,
      stageId: stage.id,
      title: data.title || getDefaultDealTitle(contact, treatment, stage.name),
      value,
      stage: stage.name,
      probability: data.probability ?? 0,
      expectedCloseDate: toMysqlDate(data.expectedCloseDate),
      ownerId: data.ownerId || userId,
      source: data.source || contact.source || null,
      treatment,
      status: getStatusForStage(stage),
      auditStatus: normalizeAuditStatus(data.auditStatus),
      auditAssignedTo: data.auditAssignedTo || null,
      auditFollowUpDueAt: optionalMysqlDateTime(data.auditFollowUpDueAt),
      auditStatusUpdatedAt: optionalMysqlDateTime(data.auditStatusUpdatedAt),
      userId,
    });

    await logTimelineActivity({
      clinicId,
      contactId: contact.id,
      type: "StatusChange",
      userId,
      metadata: buildTimelineMetadata({
        action: "pipeline_deal_created",
        source: "pipeline",
        recordId: dealId,
        changes: {
          stage: stage.name,
          value,
        },
      }),
    });
    await logAuditEvent({
      clinicId,
      userId,
      action: "PIPELINE_DEAL_CREATED",
      entityType: "deal",
      entityId: dealId,
      changes: { contactId: contact.id, stage: stage.name, value },
    });

    return this.getDeal(clinicId, dealId);
  }

  async updateDeal(
    clinicId: string,
    userId: string,
    dealId: string,
    data: UpdatePipelineDealDTO,
  ): Promise<PipelineDealResponse> {
    const existing = await this.getDeal(clinicId, dealId);
    const values: PipelineDealUpdateValues = {};
    if (data.status !== undefined && data.status !== existing.status) {
      throw ApiError.badRequest("Opportunity status is controlled by its pipeline stage. Use the move action instead.");
    }

    if (data.title !== undefined && data.title !== null) values.title = data.title;
    if (data.valueCents !== undefined) values.value = centsToValue(data.valueCents);
    if (data.probability !== undefined && data.probability !== null) values.probability = data.probability;
    if (data.expectedCloseDate !== undefined) values.expectedCloseDate = toMysqlDate(data.expectedCloseDate);
    if (data.ownerId !== undefined) values.ownerId = data.ownerId || null;
    if (data.source !== undefined) values.source = data.source || null;
    if (data.treatment !== undefined) values.treatment = data.treatment || null;
    const auditStatusChanged = data.auditStatus !== undefined && normalizeAuditStatus(data.auditStatus) !== existing.auditStatus;
    if (data.auditStatus !== undefined) values.auditStatus = normalizeAuditStatus(data.auditStatus);
    if (data.auditAssignedTo !== undefined) values.auditAssignedTo = data.auditAssignedTo || null;
    if (data.auditFollowUpDueAt !== undefined) values.auditFollowUpDueAt = optionalMysqlDateTime(data.auditFollowUpDueAt);
    if (data.auditStatusUpdatedAt !== undefined) {
      values.auditStatusUpdatedAt = optionalMysqlDateTime(data.auditStatusUpdatedAt);
    } else if (
      data.auditStatus !== undefined
      || data.auditAssignedTo !== undefined
      || data.auditFollowUpDueAt !== undefined
    ) {
      values.auditStatusUpdatedAt = toMysqlDateTime();
    }

    await updatePipelineDealFields(clinicId, dealId, values);
    if (auditStatusChanged) {
      await logTimelineActivity({
        clinicId,
        contactId: existing.contactId,
        type: "StatusChange",
        userId,
        metadata: buildTimelineMetadata({
          action: "audit_status_changed",
          source: "pipeline",
          recordId: dealId,
          changes: {
            previousAuditStatus: existing.auditStatus,
            auditStatus: values.auditStatus,
            auditAssignedTo: values.auditAssignedTo ?? existing.auditAssignedTo,
            auditFollowUpDueAt: values.auditFollowUpDueAt ?? existing.auditFollowUpDueAt,
          },
        }),
      });
    }
    await logAuditEvent({
      clinicId,
      userId,
      action: "PIPELINE_DEAL_UPDATED",
      entityType: "deal",
      entityId: dealId,
      changes: { ...data },
    });

    return this.getDeal(clinicId, existing.id);
  }

  async moveDeal(
    clinicId: string,
    userId: string,
    dealId: string,
    data: MovePipelineDealDTO,
  ): Promise<PipelineDealResponse> {
    return this.moveDealInternal(clinicId, userId, dealId, data, true);
  }

  async moveDealFromProposal(
    clinicId: string,
    userId: string,
    dealId: string,
    data: MovePipelineDealDTO,
  ): Promise<PipelineDealResponse> {
    if (!await userHasPermission(userId, clinicId, "proposals:write")) {
      throw ApiError.forbidden("Proposal write permission is required to sync an opportunity from a proposal.");
    }
    return this.moveDealInternal(clinicId, userId, dealId, data, false);
  }

  private async moveDealInternal(
    clinicId: string,
    userId: string,
    dealId: string,
    data: MovePipelineDealDTO,
    requireClientAccountWrite: boolean,
  ): Promise<PipelineDealResponse> {
    const existing = await this.getDeal(clinicId, dealId);
    const stage = await getPipelineStageForDeal(clinicId, existing.pipelineId, data.stageId);
    if (!stage) throw ApiError.notFound("Pipeline stage not found");
    if (
      stage.kind === "won" &&
      requireClientAccountWrite &&
      !await userHasPermission(userId, clinicId, "client_accounts:write")
    ) {
      throw ApiError.forbidden("Client account write permission is required to mark an opportunity as won.");
    }
    if (stage.id === existing.stageId) {
      if (stage.kind === "won") {
        await clientAccountsService.convertWonDealToClient(
          clinicId,
          userId,
          { dealId },
          { role: null },
          {},
        );
        return this.getDeal(clinicId, dealId);
      }
      return existing;
    }
    validateMove(stage, data, existing);

    const movementId = uuidv4();
    const moveValues = getMoveValues(stage, data, existing);
    if (stage.kind === "won") {
      try {
        await clientAccountsService.convertWonDealToClient(
          clinicId,
          userId,
          { dealId },
          { role: null },
          {},
          {
            beforeConversion: async (connection) => {
              const moved = await movePipelineDealStage(
                clinicId,
                dealId,
                moveValues,
                existing.stageId,
                connection,
              );
              if (moved !== 1) {
                throw ApiError.conflict("Opportunity moved while this update was in progress.");
              }
            },
            afterConversion: (connection) => this.insertWonMoveEvents(connection, {
              clinicId,
              userId,
              dealId,
              movementId,
              existing,
              stage,
              data,
            }),
          },
        );
      } catch (error) {
        const committedDeal = await this.getDeal(clinicId, dealId);
        if (committedDeal.stageId === stage.id && committedDeal.clientAccountProfileId) {
          return committedDeal;
        }
        throw error;
      }
      return this.getDeal(clinicId, dealId);
    }

    if (stage.kind === "lost") {
      const outcome = getEffectiveLostOutcome(data, existing);
      await this.persistLostMove({
        clinicId,
        userId,
        dealId,
        movementId,
        existing,
        stage,
        data,
        moveValues,
        outcome,
      });
      return this.getDeal(clinicId, dealId);
    }

    const moved = await movePipelineDealStage(clinicId, dealId, moveValues, existing.stageId);
    if (moved !== 1) {
      throw ApiError.conflict("Opportunity moved while this update was in progress.");
    }

    // Reopening an opportunity changes only its active pipeline position. The
    // deal's historical loss fields and the contact's Lost classification are
    // intentionally retained until a separate lead update records a new state.
    await insertPipelineDealMovement({
      id: movementId,
      clinicId,
      dealId,
      pipelineId: existing.pipelineId,
      fromStageId: existing.stageId,
      toStageId: stage.id,
      fromStage: existing.stageName,
      toStage: stage.name,
      movedBy: userId,
      metadata: {
        notes: data.notes || null,
        valueCents: data.valueCents ?? existing.valueCents,
        lostReason: data.lostReason || null,
        objectionType: data.objectionType || null,
      },
    });

    await logTimelineActivity({
      clinicId,
      contactId: existing.contactId,
      type: "StatusChange",
      userId,
      metadata: buildTimelineMetadata({
        action: phase1TimelineActions.leadStageChanged,
        source: "pipeline",
        recordId: dealId,
        changes: {
          fromStage: existing.stageName,
          toStage: stage.name,
          lostReason: data.lostReason || existing.lostReason || null,
          objectionType: data.objectionType || existing.objectionType || null,
        },
      }),
    });
    await logAuditEvent({
      clinicId,
      userId,
      action: "PIPELINE_DEAL_MOVED",
      entityType: "deal",
      entityId: dealId,
      changes: {
        fromStage: existing.stageName,
        toStage: stage.name,
        movementId,
        lostReason: data.lostReason || existing.lostReason || null,
        objectionType: data.objectionType || existing.objectionType || null,
      },
    });

    return this.getDeal(clinicId, dealId);
  }

  async deleteDeal(clinicId: string, userId: string, dealId: string): Promise<void> {
    const existing = await this.getDeal(clinicId, dealId);

    await softDeletePipelineDeal(clinicId, dealId);
    await logTimelineActivity({
      clinicId,
      contactId: existing.contactId,
      type: "StatusChange",
      userId,
      metadata: buildTimelineMetadata({
        action: "pipeline_deal_removed",
        source: "pipeline",
        recordId: dealId,
        changes: { stage: existing.stageName },
      }),
    });
    await logAuditEvent({
      clinicId,
      userId,
      action: "PIPELINE_DEAL_REMOVED",
      entityType: "deal",
      entityId: dealId,
      changes: { contactId: existing.contactId, stage: existing.stageName },
    });
  }

  private async getDeal(clinicId: string, dealId: string): Promise<PipelineDealResponse> {
    const row = await getPipelineDealRow(clinicId, dealId);
    if (!row) throw ApiError.notFound("Pipeline opportunity not found");
    return mapPipelineDeal(row);
  }
}

export const pipelineDealsService = new PipelineDealsService();
