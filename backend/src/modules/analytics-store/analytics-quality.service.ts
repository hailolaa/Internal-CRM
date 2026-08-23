import { createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import type {
  AnalyticsBackfillRun,
  AnalyticsBackfillStatus,
  AnalyticsExpectedFact,
  AnalyticsFreshnessResult,
  AnalyticsIssueSeverity,
  AnalyticsIssueType,
  AnalyticsReconciliationIssue,
} from "./analytics-quality.types.js";

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeKey(value: unknown, field: string) {
  const cleaned = cleanString(value);
  if (!cleaned) throw ApiError.badRequest(`${field} is required.`);
  const key = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!key) throw ApiError.badRequest(`${field} is invalid.`);
  return key.slice(0, 160);
}

function dateOnly(value: unknown, field: string) {
  const cleaned = cleanString(value);
  if (!cleaned) throw ApiError.badRequest(`${field} is required.`);
  const parsed = new Date(`${cleaned.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw ApiError.badRequest(`${field} must be a valid date.`);
  return parsed.toISOString().slice(0, 10);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toBackfill(row: any): AnalyticsBackfillRun {
  return {
    id: row.id,
    clinicId: row.clinicId,
    sourceId: row.sourceId || null,
    backfillKey: row.backfillKey,
    status: row.status,
    cursor: row.cursor || null,
    recordsSeen: Number(row.recordsSeen || 0),
    recordsWritten: Number(row.recordsWritten || 0),
    recordsQuarantined: Number(row.recordsQuarantined || 0),
    lastError: row.lastError || null,
  };
}

function toIssue(row: any): AnalyticsReconciliationIssue {
  return {
    id: row.id,
    clinicId: row.clinicId,
    sourceId: row.sourceId || null,
    issueType: row.issueType,
    severity: row.severity,
    status: row.status,
    entityKey: row.entityKey,
    details: parseJsonObject(row.details),
  };
}

export class AnalyticsQualityService {
  async startBackfill(input: { clinicId: string; backfillKey: string; sourceId?: string | null; cursor?: string | null }): Promise<AnalyticsBackfillRun> {
    const backfillKey = normalizeKey(input.backfillKey, "backfillKey");
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO analytics_backfill_run
        (id, clinic_id, source_id, backfill_key, status, \`cursor\`, started_at)
       VALUES (?, ?, ?, ?, 'running', ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         source_id = VALUES(source_id),
         status = 'running',
         \`cursor\` = COALESCE(VALUES(\`cursor\`), \`cursor\`),
         started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
         completed_at = NULL,
         last_error = NULL`,
      [id, input.clinicId, input.sourceId || null, backfillKey, cleanString(input.cursor)],
    );
    return this.getBackfill(input.clinicId, backfillKey);
  }

  async updateBackfillCheckpoint(
    clinicId: string,
    backfillKey: string,
    update: {
      cursor?: string | null;
      recordsSeen?: number;
      recordsWritten?: number;
      recordsQuarantined?: number;
      status?: AnalyticsBackfillStatus;
      lastError?: string | null;
    },
  ): Promise<AnalyticsBackfillRun> {
    const key = normalizeKey(backfillKey, "backfillKey");
    const status = update.status || "running";
    await pool.execute(
      `UPDATE analytics_backfill_run
       SET \`cursor\` = COALESCE(?, \`cursor\`),
           records_seen = records_seen + ?,
           records_written = records_written + ?,
           records_quarantined = records_quarantined + ?,
           status = ?,
           last_error = ?,
           completed_at = IF(? IN ('completed','failed'), CURRENT_TIMESTAMP, completed_at)
       WHERE clinic_id = ? AND backfill_key = ?`,
      [
        update.cursor === undefined ? null : cleanString(update.cursor),
        Number(update.recordsSeen || 0),
        Number(update.recordsWritten || 0),
        Number(update.recordsQuarantined || 0),
        status,
        cleanString(update.lastError),
        status,
        clinicId,
        key,
      ],
    );
    return this.getBackfill(clinicId, key);
  }

  async reconcileExpectedFacts(input: { clinicId: string; sourceId?: string | null; expectedFacts: AnalyticsExpectedFact[] }): Promise<AnalyticsReconciliationIssue[]> {
    const issues: AnalyticsReconciliationIssue[] = [];
    for (const fact of input.expectedFacts) {
      const metricKey = normalizeKey(fact.metricKey, "metricKey");
      const grainDate = dateOnly(fact.grainDate, "grainDate");
      const dimensions = this.normalizeDimensions(fact.dimensions);
      const dimensionHash = sha256(stableStringify(dimensions));
      const entityKey = `${metricKey}:${fact.grain}:${grainDate}:${dimensionHash}`;
      const [rows]: any = await pool.execute(
        `SELECT COUNT(*) as count
         FROM analytics_metric_fact
         WHERE clinic_id = ? AND metric_key = ? AND grain = ? AND grain_date = ? AND dimension_hash = ?`,
        [input.clinicId, metricKey, fact.grain, grainDate, dimensionHash],
      );
      if (Number(rows[0]?.count || 0) === 0) {
        issues.push(await this.recordIssue({
          clinicId: input.clinicId,
          sourceId: input.sourceId || null,
          issueType: "missing_fact",
          severity: "critical",
          entityKey,
          details: { metricKey, grain: fact.grain, grainDate, dimensions },
        }));
      }
    }
    return issues;
  }

  async getFactLineage(clinicId: string, factId: string) {
    const [rows]: any = await pool.execute(
      `SELECT f.id, f.metric_key as metricKey, f.grain, f.grain_date as grainDate,
              f.lineage_hash as lineageHash, f.source_id as sourceId, f.source_event_id as sourceEventId,
              s.source_system as sourceSystem, s.source_key as sourceKey,
              e.provider_event_id as providerEventId, e.idempotency_key as idempotencyKey
       FROM analytics_metric_fact f
       LEFT JOIN fleet_ingestion_source s ON s.id = f.source_id AND s.clinic_id = f.clinic_id
       LEFT JOIN fleet_ingestion_event e ON e.id = f.source_event_id AND e.clinic_id = f.clinic_id
       WHERE f.id = ? AND f.clinic_id = ?
       LIMIT 1`,
      [factId, clinicId],
    );
    if (!rows[0]) throw ApiError.notFound("Analytics fact lineage was not found.");
    return rows[0];
  }

  async assessFreshness(input: { clinicId: string; sourceId: string; thresholdMinutes: number; now?: Date }): Promise<AnalyticsFreshnessResult> {
    const thresholdMinutes = Math.max(1, Math.floor(Number(input.thresholdMinutes || 0)));
    const [rows]: any = await pool.execute(
      `SELECT source_system as sourceSystem, source_key as sourceKey, last_processed_event_at as lastProcessedEventAt
       FROM fleet_ingestion_checkpoint
       WHERE clinic_id = ? AND source_id = ?
       LIMIT 1`,
      [input.clinicId, input.sourceId],
    );
    if (!rows[0]) throw ApiError.notFound("Fleet ingestion checkpoint was not found.");
    const lastProcessed = rows[0].lastProcessedEventAt ? new Date(rows[0].lastProcessedEventAt) : null;
    const now = input.now || new Date();
    const observedLagMinutes = lastProcessed ? Math.max(0, Math.floor((now.getTime() - lastProcessed.getTime()) / 60_000)) : null;
    const alertKey = `freshness:${input.sourceId}`;

    if (observedLagMinutes === null || observedLagMinutes > thresholdMinutes) {
      const message = `${rows[0].sourceSystem}/${rows[0].sourceKey} freshness breached ${thresholdMinutes} minute threshold.`;
      const id = uuidv4();
      await pool.execute(
        `INSERT INTO analytics_freshness_alert
          (id, clinic_id, source_id, alert_key, status, threshold_minutes, observed_lag_minutes, message)
         VALUES (?, ?, ?, ?, 'open', ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           status = 'open',
           threshold_minutes = VALUES(threshold_minutes),
           observed_lag_minutes = VALUES(observed_lag_minutes),
           message = VALUES(message),
           resolved_at = NULL`,
        [id, input.clinicId, input.sourceId, alertKey, thresholdMinutes, observedLagMinutes, message],
      );
      const [alertRows]: any = await pool.execute(
        `SELECT id FROM analytics_freshness_alert WHERE clinic_id = ? AND alert_key = ? LIMIT 1`,
        [input.clinicId, alertKey],
      );
      return { status: "stale", sourceId: input.sourceId, thresholdMinutes, observedLagMinutes, alertId: alertRows[0]?.id || null };
    }

    await pool.execute(
      `UPDATE analytics_freshness_alert
       SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, observed_lag_minutes = ?
       WHERE clinic_id = ? AND alert_key = ?`,
      [observedLagMinutes, input.clinicId, alertKey],
    );
    return { status: "healthy", sourceId: input.sourceId, thresholdMinutes, observedLagMinutes, alertId: null };
  }

  private async recordIssue(input: {
    clinicId: string;
    sourceId: string | null;
    issueType: AnalyticsIssueType;
    severity: AnalyticsIssueSeverity;
    entityKey: string;
    details: Record<string, unknown>;
  }) {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO analytics_reconciliation_issue
        (id, clinic_id, source_id, issue_type, severity, status, entity_key, details)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`,
      [id, input.clinicId, input.sourceId, input.issueType, input.severity, input.entityKey.slice(0, 500), JSON.stringify(input.details)],
    );
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, source_id as sourceId, issue_type as issueType,
              severity, status, entity_key as entityKey, details
       FROM analytics_reconciliation_issue
       WHERE id = ? AND clinic_id = ?
       LIMIT 1`,
      [id, input.clinicId],
    );
    return toIssue(rows[0]);
  }

  private async getBackfill(clinicId: string, backfillKey: string): Promise<AnalyticsBackfillRun> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, source_id as sourceId, backfill_key as backfillKey,
              status, \`cursor\`, records_seen as recordsSeen, records_written as recordsWritten,
              records_quarantined as recordsQuarantined, last_error as lastError
       FROM analytics_backfill_run
       WHERE clinic_id = ? AND backfill_key = ?
       LIMIT 1`,
      [clinicId, backfillKey],
    );
    if (!rows[0]) throw ApiError.notFound("Analytics backfill run was not found.");
    return toBackfill(rows[0]);
  }

  private normalizeDimensions(value: Record<string, string | number | boolean | null>) {
    const normalized: Record<string, string | number | boolean | null> = {};
    for (const key of Object.keys(value || {}).sort()) {
      const normalizedKey = normalizeKey(key, "dimension key");
      const item = value[key];
      normalized[normalizedKey] = typeof item === "string" ? item.trim() : item ?? null;
    }
    return normalized;
  }
}

export const analyticsQualityService = new AnalyticsQualityService();
