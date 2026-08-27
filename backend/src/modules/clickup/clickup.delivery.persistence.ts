import { v4 as uuidv4 } from "uuid";
import type { PoolConnection } from "mysql2/promise";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";

export interface StageClickUpDeliveryProvisionInput {
  clinicId: string;
  clientAccountProfileId: string;
  proposalId: string;
  eventId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
}

export async function stageClickUpDeliveryProvision(
  input: StageClickUpDeliveryProvisionInput,
  executor: Pick<PoolConnection, "execute"> = pool,
) {
  const id = uuidv4();
  await executor.execute(
    `INSERT INTO clickup_delivery_provision
      (id, clinic_id, client_account_profile_id, proposal_id, event_id, idempotency_key, status, payload)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
     ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      input.clinicId,
      input.clientAccountProfileId,
      input.proposalId,
      input.eventId,
      input.idempotencyKey,
      JSON.stringify(input.payload),
    ],
  );
  const [rows]: any = await executor.execute(
    `SELECT id, clinic_id as clinicId, client_account_profile_id as clientAccountProfileId,
            proposal_id as proposalId, event_id as eventId, idempotency_key as idempotencyKey,
            status, attempt_count as attemptCount, max_attempts as maxAttempts,
            next_attempt_at as nextAttemptAt, last_attempt_at as lastAttemptAt,
            payload, clickup_folder_id as clickUpFolderId, clickup_list_id as clickUpListId,
            delivery_url as deliveryUrl, failure_reason as failureReason
     FROM clickup_delivery_provision
     WHERE clinic_id = ? AND idempotency_key = ?
     LIMIT 1`,
    [input.clinicId, input.idempotencyKey],
  );
  if (!rows[0]) throw ApiError.internal("ClickUp delivery provision could not be staged.");
  return {
    ...rows[0],
    payload: typeof rows[0].payload === "string" ? JSON.parse(rows[0].payload) : rows[0].payload,
  };
}
