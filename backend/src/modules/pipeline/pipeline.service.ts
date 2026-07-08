import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { defaultPipelineName, defaultPipelineStages } from "./pipeline.constants.js";
import { mapPipelineStage } from "./pipeline.mappers.js";
import type {
  CreatePipelineStageDTO,
  PipelineStageResponse,
  UpdatePipelineStageDTO,
} from "./pipeline.types.js";

function getStageKey(stageName: string) {
  return stageName.trim().replace(/\s+/g, " ").toLowerCase();
}

function dedupeStageRows(rows: any[]) {
  const stages = new Map<string, any>();

  for (const row of rows) {
    const key = getStageKey(row.name || "");
    if (!stages.has(key)) stages.set(key, row);
  }

  return Array.from(stages.values());
}

export class PipelineService {
  // Ensure every clinic has the standard revenue pipeline before reads/writes
  async ensureDefaultPipeline(clinicId: string, userId?: string | null): Promise<string> {
    const [pipelines]: any = await pool.execute(
      `SELECT id
       FROM pipeline
       WHERE clinic_id = ?
         AND name = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId, defaultPipelineName],
    );
    let pipelineId = pipelines[0]?.id;

    if (!pipelineId) {
      pipelineId = uuidv4();
      await pool.execute(
        `INSERT INTO pipeline (id, clinic_id, name, description, stages)
         VALUES (?, ?, ?, ?, ?)`,
        [
          pipelineId,
          clinicId,
          defaultPipelineName,
          "Default conversion pipeline for lead and consult revenue tracking",
          JSON.stringify(defaultPipelineStages.map((stage) => stage.name)),
        ],
      );
    }

    const [stageRows]: any = await pool.execute(
      `SELECT COUNT(*) as total
       FROM pipeline_stage
       WHERE clinic_id = ?
         AND pipeline_id = ?
         AND deleted_at IS NULL`,
      [clinicId, pipelineId],
    );

    if (Number(stageRows[0]?.total || 0) === 0) {
      for (const stage of defaultPipelineStages) {
        await pool.execute(
          `INSERT INTO pipeline_stage
            (id, clinic_id, pipeline_id, name, color, position, kind, is_locked, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            clinicId,
            pipelineId,
            stage.name,
            stage.color,
            stage.position,
            stage.kind,
            stage.kind === "won" || stage.kind === "lost" ? 1 : 0,
            userId || null,
          ],
        );
      }
    } else {
      for (const stage of defaultPipelineStages) {
        await pool.execute(
          `INSERT INTO pipeline_stage
            (id, clinic_id, pipeline_id, name, color, position, kind, is_locked, created_by)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
           WHERE NOT EXISTS (
             SELECT 1
             FROM pipeline_stage
             WHERE clinic_id = ?
               AND pipeline_id = ?
               AND name = ?
               AND deleted_at IS NULL
           )`,
          [
            uuidv4(),
            clinicId,
            pipelineId,
            stage.name,
            stage.color,
            stage.position,
            stage.kind,
            stage.kind === "won" || stage.kind === "lost" ? 1 : 0,
            userId || null,
            clinicId,
            pipelineId,
            stage.name,
          ],
        );
      }
    }

    return pipelineId;
  }

  async listStages(clinicId: string, userId?: string | null): Promise<PipelineStageResponse[]> {
    const pipelineId = await this.ensureDefaultPipeline(clinicId, userId);
    const [rows]: any = await pool.execute(
      `SELECT id,
              pipeline_id as pipelineId,
              name,
              color,
              position,
              kind,
              is_locked as isLocked,
              created_at as createdAt,
              updated_at as updatedAt
       FROM pipeline_stage
       WHERE clinic_id = ?
         AND pipeline_id = ?
         AND deleted_at IS NULL
       ORDER BY position ASC, created_at ASC`,
      [clinicId, pipelineId],
    );

    return dedupeStageRows(rows).map(mapPipelineStage);
  }

  async createStage(
    clinicId: string,
    userId: string,
    data: CreatePipelineStageDTO,
  ): Promise<PipelineStageResponse> {
    const pipelineId = await this.ensureDefaultPipeline(clinicId, userId);
    const [positions]: any = await pool.execute(
      `SELECT COALESCE(MAX(position), 0) + 1 as nextPosition
       FROM pipeline_stage
       WHERE clinic_id = ?
         AND pipeline_id = ?
         AND deleted_at IS NULL`,
      [clinicId, pipelineId],
    );
    const stageId = uuidv4();
    const position = data.position || Number(positions[0]?.nextPosition || 1);

    await pool.execute(
      `INSERT INTO pipeline_stage
        (id, clinic_id, pipeline_id, name, color, position, kind, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stageId,
        clinicId,
        pipelineId,
        data.name,
        data.color || "bg-teal-500",
        position,
        data.kind || "open",
        userId,
      ],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "PIPELINE_STAGE_CREATED",
      entityType: "pipeline_stage",
      entityId: stageId,
      changes: { ...data, position },
    });

    return this.getStage(clinicId, stageId);
  }

  async updateStage(
    clinicId: string,
    userId: string,
    stageId: string,
    data: UpdatePipelineStageDTO,
  ): Promise<PipelineStageResponse> {
    const fields: string[] = [];
    const values: any[] = [];
    const mapping: Record<string, string> = {
      color: "color",
      isLocked: "is_locked",
      kind: "kind",
      name: "name",
      position: "position",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (!mapping[key]) return;
      fields.push(`${mapping[key]} = ?`);
      values.push(key === "isLocked" ? (value ? 1 : 0) : value);
    });

    if (fields.length === 0) return this.getStage(clinicId, stageId);
    values.push(stageId, clinicId);

    const [result]: any = await pool.execute(
      `UPDATE pipeline_stage
       SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL`,
      values,
    );

    if (result.affectedRows === 0) {
      throw ApiError.notFound("Pipeline stage not found");
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "PIPELINE_STAGE_UPDATED",
      entityType: "pipeline_stage",
      entityId: stageId,
      changes: { ...data },
    });

    return this.getStage(clinicId, stageId);
  }

  async deleteStage(clinicId: string, userId: string, stageId: string): Promise<void> {
    const stage = await this.getStage(clinicId, stageId);
    const [counts]: any = await pool.execute(
      `SELECT
         (SELECT COUNT(*)
          FROM pipeline_stage
          WHERE clinic_id = ?
            AND pipeline_id = ?
            AND deleted_at IS NULL) as stageCount,
         (SELECT COUNT(*)
          FROM deal
          WHERE clinic_id = ?
            AND pipeline_id = ?
            AND (
              pipeline_stage_id = ?
              OR (pipeline_stage_id IS NULL AND stage = ?)
            )
            AND deleted_at IS NULL) as activeDealCount`,
      [clinicId, stage.pipelineId, clinicId, stage.pipelineId, stageId, stage.name],
    );

    if (Number(counts[0]?.stageCount || 0) <= 1) {
      throw ApiError.badRequest("At least one pipeline stage is required");
    }

    if (stage.isLocked) {
      throw ApiError.badRequest("Locked pipeline stages cannot be deleted");
    }

    if (Number(counts[0]?.activeDealCount || 0) > 0) {
      throw ApiError.conflict("Pipeline stage has active opportunities");
    }

    await pool.execute(
      `UPDATE pipeline_stage
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL`,
      [stageId, clinicId],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "PIPELINE_STAGE_DELETED",
      entityType: "pipeline_stage",
      entityId: stageId,
      changes: { name: stage.name },
    });
  }

  private async getStage(clinicId: string, stageId: string): Promise<PipelineStageResponse> {
    const [rows]: any = await pool.execute(
      `SELECT id,
              pipeline_id as pipelineId,
              name,
              color,
              position,
              kind,
              is_locked as isLocked,
              created_at as createdAt,
              updated_at as updatedAt
       FROM pipeline_stage
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [stageId, clinicId],
    );

    if (rows.length === 0) {
      throw ApiError.notFound("Pipeline stage not found");
    }

    return mapPipelineStage(rows[0]);
  }
}

export const pipelineService = new PipelineService();
