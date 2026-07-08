import pool from "../../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { ManualConsultDTO, ManualSpendDTO, UpdateManualSpendDTO } from "./ops-logs.types.js";

export class OpsLogsService {
  // List manually entered ad spend for clinic reporting gaps
  async listSpend(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT mse.id, mse.source, mse.channel, mse.campaign, mse.amount, mse.period,
              mse.start_date as startDate, mse.end_date as endDate,
              mse.attribution_label as attributionLabel, mse.notes,
              CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as enteredBy,
              mse.created_at as enteredAt, mse.clinic_id as clinicId
       FROM manual_spend_entry mse
       LEFT JOIN user u ON u.id = mse.created_by
       WHERE mse.clinic_id = ? AND mse.deleted_at IS NULL
       ORDER BY mse.created_at DESC`,
      [clinicId],
    );

    return rows.map((row: any) => ({
      ...row,
      amount: Number(row.amount),
      startDate: row.startDate ? new Date(row.startDate).toISOString().slice(0, 10) : null,
      endDate: row.endDate ? new Date(row.endDate).toISOString().slice(0, 10) : null,
      dataSource: getSpendDataSource(row.attributionLabel),
      enteredBy: row.enteredBy.trim() || "Clinic user",
      enteredAt: new Date(row.enteredAt).toISOString(),
    }));
  }

  // Store manual spend without requiring a live ad platform integration
  async createSpend(clinicId: string, userId: string, data: ManualSpendDTO) {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO manual_spend_entry
        (id, clinic_id, source, channel, campaign, amount, period, start_date, end_date,
         attribution_label, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        data.source,
        data.channel || data.source,
        data.campaign,
        data.amount,
        data.period,
        data.startDate || null,
        data.endDate || null,
        data.attributionLabel || null,
        data.notes || null,
        userId,
      ],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "MANUAL_SPEND_CREATED",
      entityType: "manual_spend_entry",
      entityId: id,
      changes: { source: data.source, campaign: data.campaign, amount: data.amount },
    });

    return id;
  }

  async updateSpend(clinicId: string, userId: string, id: string, data: UpdateManualSpendDTO) {
    const fields: string[] = [];
    const values: any[] = [];

    addField(fields, values, data, "source", "source");
    addField(fields, values, data, "channel", "channel");
    addField(fields, values, data, "campaign", "campaign");
    addField(fields, values, data, "amount", "amount");
    addField(fields, values, data, "period", "period");
    addField(fields, values, data, "startDate", "start_date");
    addField(fields, values, data, "endDate", "end_date");
    addField(fields, values, data, "attributionLabel", "attribution_label");
    addField(fields, values, data, "notes", "notes");

    if (fields.length === 0) return this.listSpend(clinicId);

    values.push(id, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE manual_spend_entry
       SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Spend entry not found");

    await logAuditEvent({
      clinicId,
      userId,
      action: "MANUAL_SPEND_UPDATED",
      entityType: "manual_spend_entry",
      entityId: id,
      changes: { ...data },
    });

    return this.listSpend(clinicId);
  }

  // Soft delete spend entries so reports can preserve audit history
  async deleteSpend(clinicId: string, userId: string, id: string) {
    const [result]: any = await pool.execute(
      "UPDATE manual_spend_entry SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL",
      [id, clinicId],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Spend entry not found");

    await logAuditEvent({ clinicId, userId, action: "MANUAL_SPEND_DELETED", entityType: "manual_spend_entry", entityId: id });
  }

  // List standalone consult outcomes entered outside the future appointment flow
  async listConsults(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT mce.id, mce.patient_name as patientName, mce.treatment, mce.practitioner,
              mce.outcome, mce.revenue, mce.consult_date as date, mce.notes,
              CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as enteredBy,
              mce.clinic_id as clinicId
       FROM manual_consult_entry mce
       LEFT JOIN user u ON u.id = mce.created_by
       WHERE mce.clinic_id = ? AND mce.deleted_at IS NULL
       ORDER BY mce.created_at DESC`,
      [clinicId],
    );

    return rows.map((row: any) => ({
      ...row,
      revenue: Number(row.revenue),
      enteredBy: row.enteredBy.trim() || "Clinic user",
      date: row.date ? new Date(row.date).toISOString() : null,
    }));
  }

  // Store consult outcome snapshots without touching contacts or appointments
  async createConsult(clinicId: string, userId: string, data: ManualConsultDTO) {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO manual_consult_entry
        (id, clinic_id, patient_name, treatment, practitioner, outcome, revenue, consult_date, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clinicId,
        data.patientName,
        data.treatment,
        data.practitioner,
        data.outcome,
        data.revenue || 0,
        data.date || null,
        data.notes || null,
        userId,
      ],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "MANUAL_CONSULT_CREATED",
      entityType: "manual_consult_entry",
      entityId: id,
      changes: { patientName: data.patientName, treatment: data.treatment, outcome: data.outcome },
    });

    return id;
  }

  // Soft delete consult entries without removing audit context
  async deleteConsult(clinicId: string, userId: string, id: string) {
    const [result]: any = await pool.execute(
      "UPDATE manual_consult_entry SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL",
      [id, clinicId],
    );
    if (result.affectedRows === 0) throw ApiError.notFound("Consult entry not found");

    await logAuditEvent({ clinicId, userId, action: "MANUAL_CONSULT_DELETED", entityType: "manual_consult_entry", entityId: id });
  }

  async getRoasMetrics(clinicId: string) {
    const rows = await this.getCampaignMetricRows(clinicId);
    const totalSpend = rows.reduce((sum, row) => sum + row.spend, 0);
    const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
    const totalLeads = rows.reduce((sum, row) => sum + row.leads, 0);
    const totalBookedConsults = rows.reduce((sum, row) => sum + row.bookedConsults, 0);
    const totalAttendedConsults = rows.reduce((sum, row) => sum + row.attendedConsults, 0);
    const totalSoldTreatments = rows.reduce((sum, row) => sum + row.soldTreatments, 0);

    return {
      spend: totalSpend,
      revenue: totalRevenue,
      roas: totalSpend > 0 ? Number((totalRevenue / totalSpend).toFixed(2)) : 0,
      costPerLead: divideMetric(totalSpend, totalLeads),
      costPerBookedConsult: divideMetric(totalSpend, totalBookedConsults),
      costPerAttendedConsult: divideMetric(totalSpend, totalAttendedConsults),
      costPerSoldTreatment: divideMetric(totalSpend, totalSoldTreatments),
      attribution: "manual_or_estimated",
      byCampaign: rows,
    };
  }

  async getCampaignMetrics(clinicId: string) {
    return this.getCampaignMetricRows(clinicId);
  }

  private async getCampaignMetricRows(clinicId: string) {
    const spendEntries = await this.listSpend(clinicId);

    return Promise.all(spendEntries.map(async (entry: any) => {
      const dateFilter = getDateFilter(entry.startDate, entry.endDate);
      const source = entry.source;
      const [leadRows]: any = await pool.execute(
        `SELECT COUNT(*) as leads
         FROM contact c
         WHERE c.clinic_id = ?
           AND c.deleted_at IS NULL
           AND (source = ? OR ? IS NULL)
           ${dateFilter.contactSql}`,
        [clinicId, source, source, ...dateFilter.values],
      );
      const [appointmentRows]: any = await pool.execute(
        `SELECT
            SUM(CASE WHEN a.status IN ('Scheduled', 'Completed', 'NoShow') THEN 1 ELSE 0 END) as bookedConsults,
            SUM(CASE WHEN a.status = 'Completed' THEN 1 ELSE 0 END) as attendedConsults
         FROM appointment a
         JOIN contact c ON c.id = a.contact_id
         WHERE a.clinic_id = ?
           AND a.deleted_at IS NULL
           AND (c.source = ? OR ? IS NULL)
           ${dateFilter.appointmentSql}`,
        [clinicId, source, source, ...dateFilter.values],
      );
      const [consultRows]: any = await pool.execute(
        `SELECT COUNT(*) as soldTreatments,
                COALESCE(SUM(revenue), 0) as revenue
         FROM manual_consult_entry mce
         LEFT JOIN contact c ON c.id = mce.contact_id
         WHERE mce.clinic_id = ?
           AND mce.deleted_at IS NULL
           AND mce.outcome IN ('sold', 'treatment_booked', 'Treatment Booked')
           AND (c.source = ? OR ? IS NULL OR mce.contact_id IS NULL)
           ${dateFilter.consultSql}`,
        [clinicId, source, source, ...dateFilter.values],
      );

      const spend = Number(entry.amount || 0);
      const leads = Number(leadRows[0]?.leads || 0);
      const bookedConsults = Number(appointmentRows[0]?.bookedConsults || 0);
      const attendedConsults = Number(appointmentRows[0]?.attendedConsults || 0);
      const soldTreatments = Number(consultRows[0]?.soldTreatments || 0);
      const revenue = Number(consultRows[0]?.revenue || 0);

      return {
        source: entry.source,
        channel: entry.channel || entry.source,
        campaign: entry.campaign,
        period: entry.period,
        spend,
        leads,
        bookedConsults,
        attendedConsults,
        soldTreatments,
        revenue,
        roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : 0,
        costPerLead: divideMetric(spend, leads),
        costPerBookedConsult: divideMetric(spend, bookedConsults),
        costPerAttendedConsult: divideMetric(spend, attendedConsults),
        costPerSoldTreatment: divideMetric(spend, soldTreatments),
        attribution: entry.attributionLabel || "manual_or_estimated",
        dataSource: entry.dataSource || getSpendDataSource(entry.attributionLabel),
      };
    }));
  }
}

export const opsLogsService = new OpsLogsService();

function addField(
  fields: string[],
  values: any[],
  data: UpdateManualSpendDTO,
  key: keyof UpdateManualSpendDTO,
  column: string,
) {
  if (!Object.prototype.hasOwnProperty.call(data, key)) return;
  fields.push(`${column} = ?`);
  values.push(data[key] || null);
}

function divideMetric(numerator: number, denominator: number) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(2)) : 0;
}

function getSpendDataSource(attributionLabel: unknown) {
  const label = String(attributionLabel || "");
  if (label.startsWith("connector:")) return label;
  if (label) return "manual";
  return "manual_or_estimated";
}

function getDateFilter(startDate: string | null, endDate: string | null) {
  const values: string[] = [];
  const contactParts: string[] = [];
  const appointmentParts: string[] = [];
  const consultParts: string[] = [];

  if (startDate) {
    contactParts.push("AND c.created_at >= ?");
    appointmentParts.push("AND a.date_time >= ?");
    consultParts.push("AND mce.consult_date >= ?");
    values.push(startDate);
  }

  if (endDate) {
    contactParts.push("AND c.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    appointmentParts.push("AND a.date_time < DATE_ADD(?, INTERVAL 1 DAY)");
    consultParts.push("AND mce.consult_date < DATE_ADD(?, INTERVAL 1 DAY)");
    values.push(endDate);
  }

  return {
    values,
    contactSql: contactParts.join(" "),
    appointmentSql: appointmentParts.join(" "),
    consultSql: consultParts.join(" "),
  };
}
