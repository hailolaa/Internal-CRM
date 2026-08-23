import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import type { PilotErasureResult, PilotSecurityReview } from "./pilot-data-feed-security.types.js";

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function iso(value: unknown) {
  return value ? new Date(value as string | number | Date).toISOString() : null;
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

function toReview(row: any): PilotSecurityReview {
  return {
    id: row.id,
    clinicId: row.clinicId,
    sourceId: row.sourceId || null,
    reviewStatus: row.reviewStatus,
    tenantIsolationStatus: row.tenantIsolationStatus,
    erasureStatus: row.erasureStatus,
    reconciliationStatus: row.reconciliationStatus,
    freshnessStatus: row.freshnessStatus,
    reviewedBy: row.reviewedBy,
    evidence: parseJsonObject(row.evidence),
    reviewedAt: iso(row.reviewedAt)!,
  };
}

export class PilotDataFeedSecurityService {
  async runSecurityReview(input: { clinicId: string; sourceId?: string | null; reviewedBy: string; requireErasure?: boolean }): Promise<PilotSecurityReview> {
    const reviewedBy = cleanString(input.reviewedBy);
    if (!reviewedBy) throw ApiError.badRequest("reviewedBy is required.");
    if (input.sourceId) await this.ensureSource(input.clinicId, input.sourceId);

    const tenantIsolation = await this.checkTenantIsolation(input.clinicId, input.sourceId || null);
    const reconciliation = await this.checkReconciliation(input.clinicId, input.sourceId || null);
    const freshness = await this.checkFreshness(input.clinicId, input.sourceId || null);
    const erasure = input.requireErasure ? await this.checkErasure(input.clinicId, input.sourceId || null) : { status: "not_run" as const, remainingTraces: null };

    const reviewStatus = tenantIsolation.status === "passed"
      && reconciliation.status === "passed"
      && freshness.status === "passed"
      && (!input.requireErasure || erasure.status === "passed")
      ? "passed"
      : "failed";

    const evidence = { tenantIsolation, reconciliation, freshness, erasure };
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO pilot_data_feed_security_review
        (id, clinic_id, source_id, review_status, tenant_isolation_status, erasure_status,
         reconciliation_status, freshness_status, reviewed_by, evidence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         review_status = VALUES(review_status),
         tenant_isolation_status = VALUES(tenant_isolation_status),
         erasure_status = VALUES(erasure_status),
         reconciliation_status = VALUES(reconciliation_status),
         freshness_status = VALUES(freshness_status),
         reviewed_by = VALUES(reviewed_by),
         evidence = VALUES(evidence),
         reviewed_at = CURRENT_TIMESTAMP`,
      [
        id,
        input.clinicId,
        input.sourceId || null,
        reviewStatus,
        tenantIsolation.status,
        erasure.status,
        reconciliation.status,
        freshness.status,
        reviewedBy,
        JSON.stringify(evidence),
      ],
    );
    return this.getReview(input.clinicId, input.sourceId || null);
  }

  async eraseSourceData(input: { clinicId: string; sourceId: string; reason: string }): Promise<PilotErasureResult> {
    const reason = cleanString(input.reason);
    if (!reason) throw ApiError.badRequest("reason is required.");
    const source = await this.ensureSource(input.clinicId, input.sourceId);
    const deleted: Record<string, number> = {};

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const sourceEventFilter = `SELECT id FROM fleet_ingestion_event WHERE clinic_id = ? AND source_id = ?`;

      deleted.analyticsReconciliationIssues = await this.deleteWithCount(connection, "analytics_reconciliation_issue", "clinic_id = ? AND source_id = ?", [input.clinicId, input.sourceId]);
      deleted.analyticsFreshnessAlerts = await this.deleteWithCount(connection, "analytics_freshness_alert", "clinic_id = ? AND source_id = ?", [input.clinicId, input.sourceId]);
      deleted.analyticsBackfillRuns = await this.deleteWithCount(connection, "analytics_backfill_run", "clinic_id = ? AND source_id = ?", [input.clinicId, input.sourceId]);
      deleted.analyticsSnapshots = await this.deleteWithCount(connection, "analytics_snapshot", "clinic_id = ? AND created_by_source_id = ?", [input.clinicId, input.sourceId]);
      deleted.analyticsMetricFacts = await this.deleteWithCount(
        connection,
        "analytics_metric_fact",
        `clinic_id = ? AND (source_id = ? OR source_event_id IN (${sourceEventFilter}))`,
        [input.clinicId, input.sourceId, input.clinicId, input.sourceId],
      );
      const [identityResult]: any = await connection.execute(
        `DELETE im FROM fleet_identity_mapping im
         WHERE im.clinic_id = ?
           AND im.source_system = ?
           AND EXISTS (
             SELECT 1 FROM fleet_ingestion_event e
             WHERE e.clinic_id = im.clinic_id
               AND e.source_id = ?
               AND e.source_entity = im.source_entity
               AND e.source_record_id = im.source_record_id
           )`,
        [input.clinicId, source.sourceSystem, input.sourceId],
      );
      deleted.fleetIdentityMappings = Number(identityResult.affectedRows || 0);
      deleted.fleetIngestionCheckpoints = await this.deleteWithCount(connection, "fleet_ingestion_checkpoint", "clinic_id = ? AND source_id = ?", [input.clinicId, input.sourceId]);
      deleted.fleetIngestionEvents = await this.deleteWithCount(connection, "fleet_ingestion_event", "clinic_id = ? AND source_id = ?", [input.clinicId, input.sourceId]);
      deleted.pilotSecurityReviews = await this.deleteWithCount(connection, "pilot_data_feed_security_review", "clinic_id = ? AND source_id = ?", [input.clinicId, input.sourceId]);
      deleted.fleetIngestionSources = await this.deleteWithCount(connection, "fleet_ingestion_source", "clinic_id = ? AND id = ?", [input.clinicId, input.sourceId]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const remainingTraces = await this.countRemainingTraces(input.clinicId, input.sourceId);
    return { clinicId: input.clinicId, sourceId: input.sourceId, deleted, remainingTraces };
  }

  private async checkTenantIsolation(clinicId: string, sourceId: string | null) {
    const sourceRows = sourceId ? [await this.ensureSource(clinicId, sourceId)] : [];
    const crossTenantMatches = sourceId
      ? await this.countRows(
        "fleet_ingestion_event",
        "source_id = ? AND clinic_id <> ?",
        [sourceId, clinicId],
      ) + await this.countRows(
        "fleet_ingestion_checkpoint",
        "source_id = ? AND clinic_id <> ?",
        [sourceId, clinicId],
      ) + await this.countRows(
        "analytics_metric_fact",
        "(source_id = ? OR source_event_id IN (SELECT id FROM fleet_ingestion_event WHERE source_id = ?)) AND clinic_id <> ?",
        [sourceId, sourceId, clinicId],
      )
      : 0;
    return {
      status: crossTenantMatches === 0 ? "passed" as const : "failed" as const,
      checkedSources: sourceId ? sourceRows.length : 0,
      crossTenantMatches,
    };
  }

  private async checkReconciliation(clinicId: string, sourceId: string | null) {
    const values: any[] = [clinicId];
    let sourceClause = "";
    if (sourceId) {
      sourceClause = " AND source_id = ?";
      values.push(sourceId);
    }
    const [rows]: any = await pool.execute(
      `SELECT COUNT(*) as count
       FROM analytics_reconciliation_issue
       WHERE clinic_id = ?${sourceClause} AND status = 'open' AND severity IN ('critical','warning')`,
      values,
    );
    const openIssues = Number(rows[0]?.count || 0);
    return { status: openIssues === 0 ? "passed" as const : "failed" as const, openIssues };
  }

  private async checkFreshness(clinicId: string, sourceId: string | null) {
    const values: any[] = [clinicId];
    let sourceClause = "";
    if (sourceId) {
      sourceClause = " AND source_id = ?";
      values.push(sourceId);
    }
    const [rows]: any = await pool.execute(
      `SELECT COUNT(*) as count
       FROM analytics_freshness_alert
       WHERE clinic_id = ?${sourceClause} AND status = 'open'`,
      values,
    );
    const openAlerts = Number(rows[0]?.count || 0);
    return { status: openAlerts === 0 ? "passed" as const : "failed" as const, openAlerts };
  }

  private async checkErasure(clinicId: string, sourceId: string | null) {
    if (!sourceId) return { status: "failed" as const, remainingTraces: { missingSourceId: 1 } };
    const remainingTraces = await this.countRemainingTraces(clinicId, sourceId);
    const total = Object.values(remainingTraces).reduce((sum, value) => sum + value, 0);
    return { status: total === 0 ? "passed" as const : "failed" as const, remainingTraces };
  }

  private async countRemainingTraces(clinicId: string, sourceId: string): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    counts.analyticsReconciliationIssues = await this.countRows("analytics_reconciliation_issue", "clinic_id = ? AND source_id = ?", [clinicId, sourceId]);
    counts.analyticsFreshnessAlerts = await this.countRows("analytics_freshness_alert", "clinic_id = ? AND source_id = ?", [clinicId, sourceId]);
    counts.analyticsBackfillRuns = await this.countRows("analytics_backfill_run", "clinic_id = ? AND source_id = ?", [clinicId, sourceId]);
    counts.analyticsSnapshots = await this.countRows("analytics_snapshot", "clinic_id = ? AND created_by_source_id = ?", [clinicId, sourceId]);
    counts.analyticsMetricFacts = await this.countRows("analytics_metric_fact", "clinic_id = ? AND (source_id = ? OR source_event_id IN (SELECT id FROM fleet_ingestion_event WHERE clinic_id = ? AND source_id = ?))", [clinicId, sourceId, clinicId, sourceId]);
    counts.fleetIngestionCheckpoints = await this.countRows("fleet_ingestion_checkpoint", "clinic_id = ? AND source_id = ?", [clinicId, sourceId]);
    counts.fleetIngestionEvents = await this.countRows("fleet_ingestion_event", "clinic_id = ? AND source_id = ?", [clinicId, sourceId]);
    counts.pilotSecurityReviews = await this.countRows("pilot_data_feed_security_review", "clinic_id = ? AND source_id = ?", [clinicId, sourceId]);
    counts.fleetIngestionSources = await this.countRows("fleet_ingestion_source", "clinic_id = ? AND id = ?", [clinicId, sourceId]);
    return counts;
  }

  private async getReview(clinicId: string, sourceId: string | null): Promise<PilotSecurityReview> {
    const values: any[] = [clinicId];
    const sourceClause = sourceId ? "source_id = ?" : "source_id IS NULL";
    if (sourceId) values.push(sourceId);
    const [rows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, source_id as sourceId, review_status as reviewStatus,
              tenant_isolation_status as tenantIsolationStatus, erasure_status as erasureStatus,
              reconciliation_status as reconciliationStatus, freshness_status as freshnessStatus,
              reviewed_by as reviewedBy, evidence, reviewed_at as reviewedAt
       FROM pilot_data_feed_security_review
       WHERE clinic_id = ? AND ${sourceClause}
       LIMIT 1`,
      values,
    );
    if (!rows[0]) throw ApiError.notFound("Pilot data-feed security review was not found.");
    return toReview(rows[0]);
  }

  private async ensureSource(clinicId: string, sourceId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id, source_system as sourceSystem, source_key as sourceKey
       FROM fleet_ingestion_source
       WHERE clinic_id = ? AND id = ?
       LIMIT 1`,
      [clinicId, sourceId],
    );
    if (!rows[0]) throw ApiError.notFound("Fleet ingestion source was not found.");
    return rows[0] as { id: string; sourceSystem: string; sourceKey: string };
  }

  private async countRows(tableName: string, where: string, values: any[]) {
    const [rows]: any = await pool.execute(`SELECT COUNT(*) as count FROM ${tableName} WHERE ${where}`, values);
    return Number(rows[0]?.count || 0);
  }

  private async deleteWithCount(connection: any, tableName: string, where: string, values: any[]) {
    const [result]: any = await connection.execute(`DELETE FROM ${tableName} WHERE ${where}`, values);
    return Number(result.affectedRows || 0);
  }
}

export const pilotDataFeedSecurityService = new PilotDataFeedSecurityService();
