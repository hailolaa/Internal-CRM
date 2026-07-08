import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import { buildTimelineMetadata, logTimelineActivity } from "../../utils/activity.js";
import { logAuditEvent } from "../../utils/audit.js";
import { phase1TimelineActions } from "../events/phase1-events.js";
import { mapSlaBreach, mapSlaLead } from "./sla.mappers.js";
import type {
  ResponseTimeMetric,
  SlaBreachResponse,
  SlaLeadQueueItem,
  SlaSummary,
  StaffResponseMetric,
} from "./sla.types.js";

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface SlaDetectionResult {
  clinicsChecked: number;
  contactsChecked: number;
  breachesCreated: number;
}

export class SlaService {
  // Ensure every clinic has the Phase 1 default before SLA queries run
  async getClinicTargetMinutes(clinicId: string) {
    await pool.execute(
      `INSERT IGNORE INTO clinic_sla_setting (clinic_id, target_minutes)
       VALUES (?, 5)`,
      [clinicId],
    );

    const [rows]: any = await pool.execute(
      "SELECT target_minutes as targetMinutes FROM clinic_sla_setting WHERE clinic_id = ?",
      [clinicId],
    );

    return Number(rows[0]?.targetMinutes || 5);
  }

  async initialiseContactSla(clinicId: string, contactId: string) {
    const targetMinutes = await this.getClinicTargetMinutes(clinicId);

    await pool.execute(
      `UPDATE contact
       SET sla_target_minutes = COALESCE(sla_target_minutes, ?),
           sla_deadline_at = COALESCE(sla_deadline_at, DATE_ADD(created_at, INTERVAL ? MINUTE))
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [targetMinutes, targetMinutes, contactId, clinicId],
    );
  }

  async initialiseClinicContacts(clinicId: string) {
    const targetMinutes = await this.getClinicTargetMinutes(clinicId);

    await pool.execute(
      `UPDATE contact
       SET sla_target_minutes = COALESCE(sla_target_minutes, ?),
           sla_deadline_at = COALESCE(sla_deadline_at, DATE_ADD(created_at, INTERVAL ? MINUTE))
       WHERE clinic_id = ? AND deleted_at IS NULL`,
      [targetMinutes, targetMinutes, clinicId],
    );
  }

  async detectSlaBreaches(clinicId?: string): Promise<SlaDetectionResult> {
    const clinicIds = clinicId ? [clinicId] : await this.listActiveClinicIds();
    let contactsChecked = 0;
    let breachesCreated = 0;

    for (const currentClinicId of clinicIds) {
      await this.initialiseClinicContacts(currentClinicId);

      const [rows]: any = await pool.execute(
        `SELECT id, sla_target_minutes as slaTargetMinutes, sla_deadline_at as slaDeadlineAt
         FROM contact
         WHERE clinic_id = ?
           AND deleted_at IS NULL
           AND first_response_at IS NULL
           AND sla_deadline_at IS NOT NULL
           AND sla_deadline_at <= NOW()
           AND sla_breached_at IS NULL`,
        [currentClinicId],
      );

      contactsChecked += rows.length;

      for (const row of rows) {
        await pool.execute(
          `INSERT IGNORE INTO sla_breach
            (id, clinic_id, contact_id, target_minutes, deadline_at, breached_at, status)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'open')`,
          [
            uuidv4(),
            currentClinicId,
            row.id,
            Number(row.slaTargetMinutes || 5),
            row.slaDeadlineAt,
          ],
        );

        const [result]: any = await pool.execute(
          `UPDATE contact
           SET sla_breached_at = CURRENT_TIMESTAMP
           WHERE id = ? AND clinic_id = ? AND sla_breached_at IS NULL`,
          [row.id, currentClinicId],
        );
        breachesCreated += Number(result.affectedRows || 0);
      }
    }

    return {
      clinicsChecked: clinicIds.length,
      contactsChecked,
      breachesCreated,
    };
  }

  async getSummary(clinicId: string): Promise<SlaSummary> {
    await this.detectSlaBreaches(clinicId);
    const targetMinutes = await this.getClinicTargetMinutes(clinicId);
    const [leadRows]: any = await pool.execute(
      `SELECT
          SUM(CASE WHEN first_response_at IS NULL THEN 1 ELSE 0 END) as activeLeadCount,
          SUM(CASE WHEN first_response_at IS NULL AND sla_breached_at IS NOT NULL THEN 1 ELSE 0 END) as breachedLeadCount,
          SUM(CASE
            WHEN first_response_at IS NULL
             AND sla_breached_at IS NULL
             AND TIMESTAMPDIFF(MINUTE, created_at, NOW()) >= COALESCE(sla_target_minutes, ?) * 0.8
            THEN 1 ELSE 0 END) as atRiskLeadCount,
          COALESCE(SUM(CASE WHEN first_response_at IS NULL AND sla_breached_at IS NOT NULL THEN value ELSE 0 END), 0) as estimatedRevenueRisk
       FROM contact
       WHERE clinic_id = ? AND deleted_at IS NULL`,
      [targetMinutes, clinicId],
    );
    const [responseRows]: any = await pool.execute(
      `SELECT COUNT(*) as respondedLeads,
              COALESCE(AVG(TIMESTAMPDIFF(MINUTE, created_at, first_response_at)), 0) as averageResponseMinutes,
              SUM(CASE WHEN first_response_at <= sla_deadline_at THEN 1 ELSE 0 END) as compliantResponses
       FROM contact
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         AND first_response_at IS NOT NULL
         AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [clinicId],
    );
    const [breachRows]: any = await pool.execute(
      `SELECT COUNT(*) as activeBreachCount,
              COALESCE(AVG(TIMESTAMPDIFF(MINUTE, sla_deadline_at, NOW())), 0) as averageBreachMinutes
       FROM contact
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         AND first_response_at IS NULL
         AND sla_breached_at IS NOT NULL
         AND sla_deadline_at IS NOT NULL`,
      [clinicId],
    );

    const respondedLeads = Number(responseRows[0]?.respondedLeads || 0);
    const compliantResponses = Number(responseRows[0]?.compliantResponses || 0);

    return {
      targetMinutes,
      activeLeadCount: Number(leadRows[0]?.activeLeadCount || 0),
      atRiskLeadCount: Number(leadRows[0]?.atRiskLeadCount || 0),
      breachedLeadCount: Number(leadRows[0]?.breachedLeadCount || 0),
      averageResponseMinutes: Number(responseRows[0]?.averageResponseMinutes || 0),
      complianceRate: respondedLeads > 0 ? Math.round((compliantResponses / respondedLeads) * 100) : 100,
      breachCount7d: Number(breachRows[0]?.activeBreachCount || 0),
      averageBreachMinutes: Number(breachRows[0]?.averageBreachMinutes || 0),
      estimatedRevenueRisk: Number(leadRows[0]?.estimatedRevenueRisk || 0),
      riskLabel: "estimated",
    };
  }

  async listLeadQueue(clinicId: string): Promise<SlaLeadQueueItem[]> {
    await this.detectSlaBreaches(clinicId);

    const [rows]: any = await pool.execute(
      `SELECT c.id as contactId, c.first_name as firstName, c.last_name as lastName,
              c.email, c.phone, c.source, c.treatment_interests as treatmentInterests,
              c.created_at as arrivedAt, c.sla_target_minutes as slaTargetMinutes,
              c.sla_breached_at as slaBreachedAt, c.value as estimatedValue,
              TIMESTAMPDIFF(MINUTE, c.created_at, NOW()) as elapsedMinutes,
              CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as assignedTo
       FROM contact c
       LEFT JOIN user u ON u.id = c.first_response_by
       WHERE c.clinic_id = ?
         AND c.deleted_at IS NULL
         AND c.first_response_at IS NULL
       ORDER BY c.sla_deadline_at ASC, c.created_at ASC
       LIMIT 100`,
      [clinicId],
    );

    return rows.map(mapSlaLead);
  }

  async listBreaches(clinicId: string): Promise<SlaBreachResponse[]> {
    await this.detectSlaBreaches(clinicId);

    const [rows]: any = await pool.execute(
      `SELECT b.id, b.contact_id as contactId, b.target_minutes as slaTargetMinutes,
              b.breached_at as breachedAt, c.first_name as firstName, c.last_name as lastName,
              c.email, c.phone, c.source, c.treatment_interests as treatmentInterests,
              c.first_response_at as firstResponseAt, c.value as estimatedRevenueRisk,
              TIMESTAMPDIFF(MINUTE, c.created_at, COALESCE(c.first_response_at, NOW())) as actualMinutes,
              CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as assignedTo
       FROM sla_breach b
       JOIN contact c ON c.id = b.contact_id AND c.clinic_id = b.clinic_id
       LEFT JOIN user u ON u.id = c.first_response_by
       WHERE b.clinic_id = ?
       ORDER BY b.breached_at DESC
       LIMIT 100`,
      [clinicId],
    );

    return rows.map(mapSlaBreach);
  }

  async markContacted(
    clinicId: string,
    userId: string,
    contactId: string,
    meta: RequestMeta = {},
  ) {
    await this.initialiseContactSla(clinicId, contactId);

    const [contactRows]: any = await pool.execute(
      `SELECT id, created_at as createdAt, first_response_at as firstResponseAt
       FROM contact
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [contactId, clinicId],
    );

    if (contactRows.length === 0) {
      throw ApiError.notFound("Contact not found");
    }

    await pool.execute(
      `UPDATE contact
       SET first_response_at = COALESCE(first_response_at, CURRENT_TIMESTAMP),
           first_response_by = COALESCE(first_response_by, ?),
           last_contact_at = CURRENT_TIMESTAMP,
           status = CASE WHEN status IN ('lead', 'new') THEN 'contacted' ELSE status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [userId, contactId, clinicId],
    );

    await pool.execute(
      `UPDATE sla_breach
       SET status = 'resolved',
           resolved_at = CURRENT_TIMESTAMP,
           first_response_at = COALESCE(first_response_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE contact_id = ? AND clinic_id = ?`,
      [contactId, clinicId],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "CONTACT_MARKED_CONTACTED",
      entityType: "contact",
      entityId: contactId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await logTimelineActivity({
      clinicId,
      contactId,
      userId,
      type: "StatusChange",
      metadata: buildTimelineMetadata({
        action: phase1TimelineActions.leadContacted,
        source: "sla",
        recordId: contactId,
      }),
    });

    const [rows]: any = await pool.execute(
      `SELECT TIMESTAMPDIFF(MINUTE, created_at, first_response_at) as responseMinutes,
              first_response_at as firstResponseAt
       FROM contact
       WHERE id = ? AND clinic_id = ?
       LIMIT 1`,
      [contactId, clinicId],
    );

    return {
      contactId,
      firstResponseAt: rows[0]?.firstResponseAt ? new Date(rows[0].firstResponseAt).toISOString() : null,
      responseMinutes: Number(rows[0]?.responseMinutes || 0),
    };
  }

  async getResponseTimeMetrics(clinicId: string): Promise<{
    averageResponseMinutes: number;
    respondedLeads: number;
    complianceRate: number;
    bySource: ResponseTimeMetric[];
  }> {
    const [rows]: any = await pool.execute(
      `SELECT COALESCE(source, 'Unknown') as source,
              COUNT(*) as respondedLeads,
              COALESCE(AVG(TIMESTAMPDIFF(MINUTE, created_at, first_response_at)), 0) as averageResponseMinutes,
              SUM(CASE WHEN first_response_at <= sla_deadline_at THEN 1 ELSE 0 END) as compliantResponses
       FROM contact
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         AND first_response_at IS NOT NULL
       GROUP BY COALESCE(source, 'Unknown')
       ORDER BY respondedLeads DESC`,
      [clinicId],
    );

    const bySource: ResponseTimeMetric[] = rows.map((row: any) => this.toResponseTimeMetric(row));
    const respondedLeads = bySource.reduce((sum: number, item: ResponseTimeMetric) => sum + item.respondedLeads, 0);
    const weightedTotal = bySource.reduce(
      (sum: number, item: ResponseTimeMetric) => sum + item.averageResponseMinutes * item.respondedLeads,
      0,
    );
    const compliantTotal = rows.reduce((sum: number, row: any) => sum + Number(row.compliantResponses || 0), 0);

    return {
      averageResponseMinutes: respondedLeads > 0 ? Math.round(weightedTotal / respondedLeads) : 0,
      respondedLeads,
      complianceRate: respondedLeads > 0 ? Math.round((compliantTotal / respondedLeads) * 100) : 100,
      bySource,
    };
  }

  async getStaffResponseMetrics(clinicId: string): Promise<StaffResponseMetric[]> {
    const [rows]: any = await pool.execute(
      `SELECT c.first_response_by as userId,
              CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as userName,
              COUNT(*) as respondedLeads,
              COALESCE(AVG(TIMESTAMPDIFF(MINUTE, c.created_at, c.first_response_at)), 0) as averageResponseMinutes,
              SUM(CASE WHEN c.first_response_at <= c.sla_deadline_at THEN 1 ELSE 0 END) as compliantResponses
       FROM contact c
       LEFT JOIN user u ON u.id = c.first_response_by
       WHERE c.clinic_id = ?
         AND c.deleted_at IS NULL
         AND c.first_response_at IS NOT NULL
       GROUP BY c.first_response_by, u.first_name, u.last_name
       ORDER BY respondedLeads DESC`,
      [clinicId],
    );

    return rows.map((row: any) => ({
      userId: row.userId,
      userName: row.userName?.trim() || "Unknown user",
      respondedLeads: Number(row.respondedLeads || 0),
      averageResponseMinutes: Math.round(Number(row.averageResponseMinutes || 0)),
      complianceRate: Number(row.respondedLeads || 0) > 0
        ? Math.round((Number(row.compliantResponses || 0) / Number(row.respondedLeads || 0)) * 100)
        : 100,
    }));
  }

  private async listActiveClinicIds() {
    const [rows]: any = await pool.execute(
      "SELECT id FROM clinic WHERE deleted_at IS NULL ORDER BY id",
    );

    return rows.map((row: any) => row.id as string);
  }

  private toResponseTimeMetric(row: any): ResponseTimeMetric {
    const respondedLeads = Number(row.respondedLeads || 0);

    return {
      source: row.source || "Unknown",
      respondedLeads,
      averageResponseMinutes: Math.round(Number(row.averageResponseMinutes || 0)),
      complianceRate: respondedLeads > 0
        ? Math.round((Number(row.compliantResponses || 0) / respondedLeads) * 100)
        : 100,
    };
  }
}

export const slaService = new SlaService();
