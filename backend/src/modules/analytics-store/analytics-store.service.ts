import { createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import type {
  AnalyticsDataState,
  AnalyticsDimensionInput,
  AnalyticsDimensionRecord,
  AnalyticsDimensionStatus,
  AnalyticsFactInput,
  AnalyticsFactRecord,
  AnalyticsMetricGrain,
  AnalyticsMetricProvenance,
  AnalyticsSnapshotInput,
  AnalyticsSnapshotRecord,
} from "./analytics-store.types.js";

const DATA_STATES: AnalyticsDataState[] = ["live", "demo", "preview", "partial", "provider_dependent", "roadmap"];
const DIMENSION_STATUSES: AnalyticsDimensionStatus[] = ["active", "archived"];
const GRAINS: AnalyticsMetricGrain[] = ["event", "daily", "weekly", "monthly", "quarterly", "annual"];
const PROVENANCE: AnalyticsMetricProvenance[] = ["exact", "manual", "connector", "estimated", "unknown"];

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

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const cleaned = cleanString(value);
  if (!cleaned) return fallback;
  if (allowed.includes(cleaned as T)) return cleaned as T;
  throw ApiError.badRequest(`Unsupported value: ${cleaned}.`);
}

function dateOnly(value: unknown, field: string) {
  const cleaned = cleanString(value);
  if (!cleaned) throw ApiError.badRequest(`${field} is required.`);
  const parsed = new Date(`${cleaned.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw ApiError.badRequest(`${field} must be a valid date.`);
  return parsed.toISOString().slice(0, 10);
}

function dateOnlyFromDb(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value || "");
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : parsed.toISOString().slice(0, 10);
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

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toDimension(row: any): AnalyticsDimensionRecord {
  return {
    id: row.id,
    clinicId: row.clinicId,
    dimensionType: row.dimensionType,
    dimensionKey: row.dimensionKey,
    label: row.label,
    dataState: row.dataState,
    status: row.status,
  };
}

function toFact(row: any): AnalyticsFactRecord {
  return {
    id: row.id,
    clinicId: row.clinicId,
    metricKey: row.metricKey,
    grain: row.grain,
    grainDate: dateOnlyFromDb(row.grainDate),
    metricValue: Number(row.metricValue),
    unit: row.unit,
    dimensionHash: row.dimensionHash,
    dimensions: parseJsonObject(row.dimensions),
    provenance: row.provenance,
    sourceId: row.sourceId || null,
    sourceEventId: row.sourceEventId || null,
    lineageHash: row.lineageHash,
  };
}

function toSnapshot(row: any): AnalyticsSnapshotRecord {
  return {
    id: row.id,
    clinicId: row.clinicId,
    snapshotKey: row.snapshotKey,
    asOfDate: dateOnlyFromDb(row.asOfDate),
    metricSet: parseJsonObject(row.metricSet),
    sourceWatermark: row.sourceWatermark ? parseJsonObject(row.sourceWatermark) : null,
    lineageHash: row.lineageHash,
    createdBySourceId: row.createdBySourceId || null,
  };
}

export class AnalyticsStoreService {
  async upsertDimension(input: AnalyticsDimensionInput): Promise<AnalyticsDimensionRecord> {
    const dimensionType = normalizeKey(input.dimensionType, "dimensionType");
    const dimensionKey = normalizeKey(input.dimensionKey, "dimensionKey");
    const label = cleanString(input.label);
    if (!label) throw ApiError.badRequest("label is required.");
    const dataState = pickEnum(input.dataState, DATA_STATES, "provider_dependent");
    const status = pickEnum(input.status, DIMENSION_STATUSES, "active");
    const id = uuidv4();

    await pool.execute(
      `INSERT INTO analytics_dimension
        (id, clinic_id, dimension_type, dimension_key, label, data_state, status, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         label = VALUES(label),
         data_state = VALUES(data_state),
         status = VALUES(status),
         metadata = VALUES(metadata)`,
      [id, input.clinicId, dimensionType, dimensionKey, label, dataState, status, input.metadata ? JSON.stringify(input.metadata) : null],
    );

    return this.getDimension(input.clinicId, dimensionType, dimensionKey);
  }

  async recordFact(input: AnalyticsFactInput): Promise<AnalyticsFactRecord> {
    const metricKey = normalizeKey(input.metricKey, "metricKey");
    const grain = pickEnum(input.grain, GRAINS, "daily");
    const grainDate = dateOnly(input.grainDate, "grainDate");
    const unit = normalizeKey(input.unit || "count", "unit").slice(0, 40);
    const provenance = pickEnum(input.provenance, PROVENANCE, "unknown");
    const metricValue = Number(input.metricValue);
    if (!Number.isFinite(metricValue)) throw ApiError.badRequest("metricValue must be numeric.");
    const dimensions = this.normalizeDimensions(input.dimensions);
    const dimensionHash = sha256(stableStringify(dimensions));
    const lineageHash = sha256(stableStringify({
      metricKey,
      grain,
      grainDate,
      metricValue,
      unit,
      dimensions,
      provenance,
      sourceId: input.sourceId || null,
      sourceEventId: input.sourceEventId || null,
    }));
    const id = uuidv4();

    await pool.execute(
      `INSERT INTO analytics_metric_fact
        (id, clinic_id, metric_key, grain, grain_date, metric_value, unit,
         dimension_hash, dimensions, provenance, source_id, source_event_id, lineage_hash, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         metric_value = VALUES(metric_value),
         unit = VALUES(unit),
         dimensions = VALUES(dimensions),
         provenance = VALUES(provenance),
         source_id = VALUES(source_id),
         source_event_id = VALUES(source_event_id),
         lineage_hash = VALUES(lineage_hash),
         metadata = VALUES(metadata),
         recorded_at = CURRENT_TIMESTAMP`,
      [
        id,
        input.clinicId,
        metricKey,
        grain,
        grainDate,
        metricValue,
        unit,
        dimensionHash,
        JSON.stringify(dimensions),
        provenance,
        input.sourceId || null,
        input.sourceEventId || null,
        lineageHash,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );

    return this.getFact(input.clinicId, metricKey, grain, grainDate, dimensionHash);
  }

  async createSnapshot(input: AnalyticsSnapshotInput): Promise<AnalyticsSnapshotRecord> {
    const snapshotKey = normalizeKey(input.snapshotKey, "snapshotKey").slice(0, 120);
    const asOfDate = dateOnly(input.asOfDate, "asOfDate");
    const metricSet = this.normalizeObject(input.metricSet, "metricSet");
    const sourceWatermark = input.sourceWatermark ? this.normalizeObject(input.sourceWatermark, "sourceWatermark") : null;
    const lineageHash = sha256(stableStringify({ snapshotKey, asOfDate, metricSet, sourceWatermark, createdBySourceId: input.createdBySourceId || null }));
    const id = uuidv4();

    await pool.execute(
      `INSERT INTO analytics_snapshot
        (id, clinic_id, snapshot_key, as_of_date, metric_set, source_watermark, lineage_hash, created_by_source_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         metric_set = VALUES(metric_set),
         source_watermark = VALUES(source_watermark),
         lineage_hash = VALUES(lineage_hash),
         created_by_source_id = VALUES(created_by_source_id)`,
      [
        id,
        input.clinicId,
        snapshotKey,
        asOfDate,
        JSON.stringify(metricSet),
        sourceWatermark ? JSON.stringify(sourceWatermark) : null,
        lineageHash,
        input.createdBySourceId || null,
      ],
    );

    return this.getSnapshot(input.clinicId, snapshotKey, asOfDate);
  }

  async listFacts(clinicId: string, query: { metricKey?: string; startDate?: string; endDate?: string } = {}) {
    const values: any[] = [clinicId];
    let where = "clinic_id = ?";
    if (query.metricKey) {
      where += " AND metric_key = ?";
      values.push(normalizeKey(query.metricKey, "metricKey"));
    }
    if (query.startDate) {
      where += " AND grain_date >= ?";
      values.push(dateOnly(query.startDate, "startDate"));
    }
    if (query.endDate) {
      where += " AND grain_date <= ?";
      values.push(dateOnly(query.endDate, "endDate"));
    }
    const [rows]: any = await pool.execute(
      `SELECT ${this.factSelect()}
       FROM analytics_metric_fact
       WHERE ${where}
       ORDER BY grain_date DESC, metric_key ASC
       LIMIT 500`,
      values,
    );
    return rows.map(toFact);
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

  private normalizeObject(value: Record<string, unknown>, field: string) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw ApiError.badRequest(`${field} must be an object.`);
    }
    return JSON.parse(stableStringify(value));
  }

  private async getDimension(clinicId: string, dimensionType: string, dimensionKey: string): Promise<AnalyticsDimensionRecord> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, dimension_type as dimensionType, dimension_key as dimensionKey,
              label, data_state as dataState, status
       FROM analytics_dimension
       WHERE clinic_id = ? AND dimension_type = ? AND dimension_key = ?
       LIMIT 1`,
      [clinicId, dimensionType, dimensionKey],
    );
    if (!rows[0]) throw ApiError.notFound("Analytics dimension was not found.");
    return toDimension(rows[0]);
  }

  private async getFact(
    clinicId: string,
    metricKey: string,
    grain: AnalyticsMetricGrain,
    grainDate: string,
    dimensionHash: string,
  ): Promise<AnalyticsFactRecord> {
    const [rows]: any = await pool.execute(
      `SELECT ${this.factSelect()}
       FROM analytics_metric_fact
       WHERE clinic_id = ? AND metric_key = ? AND grain = ? AND grain_date = ? AND dimension_hash = ?
       LIMIT 1`,
      [clinicId, metricKey, grain, grainDate, dimensionHash],
    );
    if (!rows[0]) throw ApiError.notFound("Analytics fact was not found.");
    return toFact(rows[0]);
  }

  private async getSnapshot(clinicId: string, snapshotKey: string, asOfDate: string): Promise<AnalyticsSnapshotRecord> {
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, snapshot_key as snapshotKey, as_of_date as asOfDate,
              metric_set as metricSet, source_watermark as sourceWatermark, lineage_hash as lineageHash,
              created_by_source_id as createdBySourceId
       FROM analytics_snapshot
       WHERE clinic_id = ? AND snapshot_key = ? AND as_of_date = ?
       LIMIT 1`,
      [clinicId, snapshotKey, asOfDate],
    );
    if (!rows[0]) throw ApiError.notFound("Analytics snapshot was not found.");
    return toSnapshot(rows[0]);
  }

  private factSelect() {
    return `id, clinic_id as clinicId, metric_key as metricKey, grain, grain_date as grainDate,
            metric_value as metricValue, unit, dimension_hash as dimensionHash, dimensions,
            provenance, source_id as sourceId, source_event_id as sourceEventId, lineage_hash as lineageHash`;
  }
}

export const analyticsStoreService = new AnalyticsStoreService();
