import pool from "../../config/database.js";
import type { PipelineDealStatus, PipelineStageKind } from "./pipeline.types.js";

export interface PipelineDealContactRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  value: number | string | null;
  treatmentInterests: unknown;
}

export interface PipelineDealStageRow {
  id: string;
  name: string;
  kind: PipelineStageKind;
}

export interface PipelineDealInsertValues {
  id: string;
  clinicId: string;
  contactId: string;
  pipelineId: string;
  stageId: string;
  title: string;
  value: number | null;
  stage: string;
  probability: number;
  expectedCloseDate: string | null;
  ownerId: string | null;
  source: string | null;
  treatment: string | null;
  status: PipelineDealStatus;
  userId: string;
}

export interface PipelineDealUpdateValues {
  title?: string;
  value?: number | null;
  probability?: number;
  expectedCloseDate?: string | null;
  ownerId?: string | null;
  source?: string | null;
  treatment?: string | null;
  status?: PipelineDealStatus;
}

export interface PipelineDealMoveValues {
  stageId: string;
  stageName: string;
  status: PipelineDealStatus;
  value?: number | null;
  bookedAt?: string | null;
  soldAt?: string | null;
  lostAt?: string | null;
  lostReason?: string | null;
}

export interface PipelineDealMovementValues {
  id: string;
  clinicId: string;
  dealId: string;
  pipelineId: string;
  fromStageId: string | null;
  toStageId: string;
  fromStage: string | null;
  toStage: string;
  movedBy: string;
  metadata: Record<string, unknown> | null;
}

const dealSelect = `
  SELECT d.id,
         d.pipeline_id as pipelineId,
         d.pipeline_stage_id as stageId,
         COALESCE(ps.name, d.stage) as stageName,
         COALESCE(ps.kind, 'open') as stageKind,
         d.title,
         d.value,
         d.probability,
         d.expected_close_date as expectedCloseDate,
         d.owner_id as ownerId,
         NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') as ownerName,
         (SELECT DATE_FORMAT(t.due_date, '%Y-%m-%d')
          FROM task t
          WHERE t.clinic_id = d.clinic_id
            AND t.contact_id = d.contact_id
            AND t.is_internal = 0
            AND t.status = 'pending'
            AND t.archived_at IS NULL
            AND t.deleted_at IS NULL
          ORDER BY t.due_date IS NULL ASC, t.due_date ASC, t.priority DESC, t.created_at ASC
          LIMIT 1) as nextFollowUpDate,
         (SELECT t.priority
          FROM task t
          WHERE t.clinic_id = d.clinic_id
            AND t.contact_id = d.contact_id
            AND t.is_internal = 0
            AND t.status = 'pending'
            AND t.archived_at IS NULL
            AND t.deleted_at IS NULL
          ORDER BY t.due_date IS NULL ASC, t.due_date ASC, t.priority DESC, t.created_at ASC
          LIMIT 1) as priority,
         d.contact_id as contactId,
         c.first_name as contactFirstName,
         c.last_name as contactLastName,
         c.email as contactEmail,
         c.phone as contactPhone,
         c.source as contactSource,
         d.source,
         d.treatment,
         d.status,
         GREATEST(DATEDIFF(CURRENT_DATE(), DATE(COALESCE(d.stage_changed_at, d.updated_at, d.created_at))), 0) as daysInStage,
         d.stage_changed_at as stageChangedAt,
         d.booked_at as bookedAt,
         d.sold_at as soldAt,
         d.lost_at as lostAt,
         d.lost_reason as lostReason,
         d.created_at as createdAt,
         d.updated_at as updatedAt
  FROM deal d
  JOIN contact c
    ON c.id = d.contact_id
   AND c.clinic_id = d.clinic_id
   AND c.deleted_at IS NULL
  LEFT JOIN pipeline_stage ps
    ON ps.id = d.pipeline_stage_id
   AND ps.clinic_id = d.clinic_id
   AND ps.deleted_at IS NULL
  LEFT JOIN user u
    ON u.id = d.owner_id
   AND u.clinic_id = d.clinic_id
   AND u.deleted_at IS NULL
`;

export async function listPipelineDealRows(clinicId: string, pipelineId: string) {
  const [rows]: any = await pool.execute(
    `${dealSelect}
     WHERE d.clinic_id = ?
       AND d.pipeline_id = ?
       AND d.deleted_at IS NULL
     ORDER BY COALESCE(ps.position, 999), d.stage_changed_at DESC, d.updated_at DESC`,
    [clinicId, pipelineId],
  );

  return rows;
}

export async function getPipelineDealRow(clinicId: string, dealId: string) {
  const [rows]: any = await pool.execute(
    `${dealSelect}
     WHERE d.id = ?
       AND d.clinic_id = ?
       AND d.deleted_at IS NULL
     LIMIT 1`,
    [dealId, clinicId],
  );

  return rows[0] || null;
}

export async function getPipelineDealContact(
  clinicId: string,
  contactId: string,
): Promise<PipelineDealContactRow | null> {
  const [rows]: any = await pool.execute(
    `SELECT id,
            first_name as firstName,
            last_name as lastName,
            email,
            phone,
            source,
            value,
            treatment_interests as treatmentInterests
     FROM contact
     WHERE id = ?
       AND clinic_id = ?
       AND deleted_at IS NULL
     LIMIT 1`,
    [contactId, clinicId],
  );

  return rows[0] || null;
}

export async function getFirstPipelineStage(
  clinicId: string,
  pipelineId: string,
): Promise<PipelineDealStageRow | null> {
  const [rows]: any = await pool.execute(
    `SELECT id, name, kind
     FROM pipeline_stage
     WHERE clinic_id = ?
       AND pipeline_id = ?
       AND deleted_at IS NULL
     ORDER BY position ASC, created_at ASC
     LIMIT 1`,
    [clinicId, pipelineId],
  );

  return rows[0] || null;
}

export async function getPipelineStageForDeal(
  clinicId: string,
  pipelineId: string,
  stageId: string,
): Promise<PipelineDealStageRow | null> {
  const [rows]: any = await pool.execute(
    `SELECT id, name, kind
     FROM pipeline_stage
     WHERE id = ?
       AND clinic_id = ?
       AND pipeline_id = ?
       AND deleted_at IS NULL
     LIMIT 1`,
    [stageId, clinicId, pipelineId],
  );

  return rows[0] || null;
}

export async function insertPipelineDeal(values: PipelineDealInsertValues) {
  await pool.execute(
    `INSERT INTO deal
      (id, clinic_id, contact_id, pipeline_id, pipeline_stage_id, title, value,
       stage, probability, expected_close_date, owner_id, source, treatment,
       status, stage_changed_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
    [
      values.id,
      values.clinicId,
      values.contactId,
      values.pipelineId,
      values.stageId,
      values.title,
      values.value,
      values.stage,
      values.probability,
      values.expectedCloseDate,
      values.ownerId,
      values.source,
      values.treatment,
      values.status,
      values.userId,
    ],
  );
}

export async function updatePipelineDealFields(
  clinicId: string,
  dealId: string,
  values: PipelineDealUpdateValues,
) {
  const fields: string[] = [];
  const params: any[] = [];
  const mapping: Record<keyof PipelineDealUpdateValues, string> = {
    expectedCloseDate: "expected_close_date",
    ownerId: "owner_id",
    probability: "probability",
    source: "source",
    status: "status",
    title: "title",
    treatment: "treatment",
    value: "value",
  };

  Object.entries(values).forEach(([key, value]) => {
    const column = mapping[key as keyof PipelineDealUpdateValues];
    if (!column) return;

    fields.push(`${column} = ?`);
    params.push(value);
  });

  if (fields.length === 0) return;

  await pool.execute(
    `UPDATE deal
     SET ${fields.join(", ")},
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND clinic_id = ?
       AND deleted_at IS NULL`,
    [...params, dealId, clinicId],
  );
}

export async function movePipelineDealStage(
  clinicId: string,
  dealId: string,
  values: PipelineDealMoveValues,
) {
  const fields = [
    "pipeline_stage_id = ?",
    "stage = ?",
    "status = ?",
    "stage_changed_at = CURRENT_TIMESTAMP",
    "updated_at = CURRENT_TIMESTAMP",
  ];
  const params: any[] = [values.stageId, values.stageName, values.status];

  if (values.value !== undefined) {
    fields.push("value = ?");
    params.push(values.value);
  }

  if (values.bookedAt !== undefined) {
    fields.push("booked_at = ?");
    params.push(values.bookedAt);
  }

  if (values.soldAt !== undefined) {
    fields.push("sold_at = ?");
    params.push(values.soldAt);
  }

  if (values.lostAt !== undefined) {
    fields.push("lost_at = ?");
    params.push(values.lostAt);
  }

  if (values.lostReason !== undefined) {
    fields.push("lost_reason = ?");
    params.push(values.lostReason);
  }

  await pool.execute(
    `UPDATE deal
     SET ${fields.join(", ")}
     WHERE id = ?
       AND clinic_id = ?
       AND deleted_at IS NULL`,
    [...params, dealId, clinicId],
  );
}

export async function insertPipelineDealMovement(values: PipelineDealMovementValues) {
  await pool.execute(
    `INSERT INTO pipeline_deal_movement
      (id, clinic_id, deal_id, pipeline_id, from_stage_id, to_stage_id,
       from_stage, to_stage, moved_by, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      values.id,
      values.clinicId,
      values.dealId,
      values.pipelineId,
      values.fromStageId,
      values.toStageId,
      values.fromStage,
      values.toStage,
      values.movedBy,
      values.metadata ? JSON.stringify(values.metadata) : null,
    ],
  );
}
