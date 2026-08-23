import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import type {
  ClientMonthlyCostInput,
  ClientMrrMovement,
  ClientRevenuePeriod,
  FinancePeriodRange,
  FinanceRevenueView,
  MrrMovementCategory,
} from "./finance-analytics.types.js";

interface ServiceRow {
  clientAccountProfileId: string;
  recurringValue: number | null;
  currency: string;
  startDate: string | null;
  endDate: string | null;
}

interface CostRow {
  clientAccountProfileId: string;
  periodMonth: string;
  costCents: number;
  currency: string;
}

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function moneyToCents(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100);
}

function dateOnly(value: unknown, field: string) {
  const cleaned = value instanceof Date ? value.toISOString().slice(0, 10) : cleanString(value);
  if (!cleaned) throw ApiError.badRequest(`${field} is required.`);
  const parsed = new Date(`${cleaned.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw ApiError.badRequest(`${field} must be a valid date.`);
  return parsed.toISOString().slice(0, 10);
}

function dateFromDb(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function monthStart(value: unknown, field: string) {
  const date = dateOnly(value, field);
  return `${date.slice(0, 7)}-01`;
}

function addMonths(month: string, count: number) {
  const date = new Date(`${month}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + count);
  return date.toISOString().slice(0, 10);
}

function monthEnd(month: string) {
  const date = new Date(`${month}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

function daysInMonth(month: string) {
  return Number(monthEnd(month).slice(8, 10));
}

function dayOfMonth(date: string) {
  return Number(date.slice(8, 10));
}

function monthsBetween(fromMonth: string, toMonth: string) {
  const months: string[] = [];
  let cursor = fromMonth;
  while (cursor <= toMonth) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
}

function overlapsMonth(service: ServiceRow, month: string) {
  const start = service.startDate || month;
  const end = service.endDate || "9999-12-31";
  return start <= monthEnd(month) && end >= month;
}

function activeAtMonthEnd(service: ServiceRow, month: string) {
  const end = monthEnd(month);
  const start = service.startDate || month;
  const serviceEnd = service.endDate || "9999-12-31";
  return start <= end && serviceEnd >= end;
}

function recognizedCents(service: ServiceRow, month: string) {
  if (!overlapsMonth(service, month)) return 0;
  const monthly = moneyToCents(service.recurringValue);
  const monthDays = daysInMonth(month);
  const overlapStart = service.startDate && service.startDate > month ? service.startDate : month;
  const endOfMonth = monthEnd(month);
  const overlapEnd = service.endDate && service.endDate < endOfMonth ? service.endDate : endOfMonth;
  const activeDays = Math.max(0, dayOfMonth(overlapEnd) - dayOfMonth(overlapStart) + 1);
  return Math.round((monthly * activeDays) / monthDays);
}

function movementCategory(previousMrrCents: number, currentMrrCents: number): MrrMovementCategory {
  if (previousMrrCents === 0 && currentMrrCents > 0) return "new";
  if (previousMrrCents > 0 && currentMrrCents === 0) return "churn";
  if (currentMrrCents > previousMrrCents) return "expansion";
  if (currentMrrCents < previousMrrCents) return "contraction";
  return "stable";
}

function marginPercent(revenueCents: number, marginCents: number) {
  if (revenueCents <= 0) return null;
  return Math.round((marginCents / revenueCents) * 10000) / 100;
}

function rowMonth(value: unknown) {
  return dateFromDb(value)?.slice(0, 7).concat("-01") || null;
}

export class FinanceAnalyticsService {
  async upsertClientMonthlyCost(input: ClientMonthlyCostInput): Promise<ClientRevenuePeriod> {
    const clinicId = cleanString(input.clinicId);
    const clientAccountProfileId = cleanString(input.clientAccountProfileId);
    if (!clinicId) throw ApiError.badRequest("clinicId is required.");
    if (!clientAccountProfileId) throw ApiError.badRequest("clientAccountProfileId is required.");
    const periodMonth = monthStart(input.periodMonth, "periodMonth");
    const costCents = Math.max(0, Math.round(Number(input.costCents || 0)));
    const currency = (cleanString(input.currency) || "USD").slice(0, 3).toUpperCase();
    const source = (cleanString(input.source) || "manual").slice(0, 120);

    await pool.execute(
      `INSERT INTO finance_client_monthly_cost
        (id, clinic_id, client_account_profile_id, period_month, cost_cents, currency, source, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         cost_cents = VALUES(cost_cents),
         currency = VALUES(currency),
         notes = VALUES(notes),
         created_by = VALUES(created_by)`,
      [
        uuidv4(),
        clinicId,
        clientAccountProfileId,
        periodMonth,
        costCents,
        currency,
        source,
        cleanString(input.notes),
        cleanString(input.createdBy),
      ],
    );

    const view = await this.getRevenueView({ clinicId, fromMonth: periodMonth, toMonth: periodMonth });
    const period = view.periods.find((item) => item.clientAccountProfileId === clientAccountProfileId);
    if (!period) {
      return {
        clientAccountProfileId,
        periodMonth,
        currency,
        mrrCents: 0,
        recognizedRevenueCents: 0,
        costCents,
        marginCents: -costCents,
        marginPercent: null,
      };
    }
    return period;
  }

  async getRevenueView(input: FinancePeriodRange): Promise<FinanceRevenueView> {
    const clinicId = cleanString(input.clinicId);
    if (!clinicId) throw ApiError.badRequest("clinicId is required.");
    const fromMonth = monthStart(input.fromMonth, "fromMonth");
    const toMonth = monthStart(input.toMonth, "toMonth");
    if (fromMonth > toMonth) throw ApiError.badRequest("fromMonth must be before toMonth.");

    const [serviceRows]: any = await pool.execute(
      `SELECT client_account_profile_id as clientAccountProfileId,
              recurring_value as recurringValue,
              currency,
              start_date as startDate,
              end_date as endDate
       FROM client_account_service
       WHERE clinic_id = ?
         AND archived_at IS NULL
         AND status = 'active'
         AND contract_status = 'active'
         AND recurring_value IS NOT NULL
         AND (start_date IS NULL OR start_date <= ?)
         AND (end_date IS NULL OR end_date >= ?)`,
      [clinicId, monthEnd(toMonth), fromMonth],
    );
    const services: ServiceRow[] = serviceRows.map((row: any) => ({
      clientAccountProfileId: row.clientAccountProfileId,
      recurringValue: row.recurringValue === null ? null : Number(row.recurringValue),
      currency: row.currency || "USD",
      startDate: dateFromDb(row.startDate),
      endDate: dateFromDb(row.endDate),
    }));

    const [costRowsRaw]: any = await pool.execute(
      `SELECT client_account_profile_id as clientAccountProfileId,
              period_month as periodMonth,
              SUM(cost_cents) as costCents,
              MIN(currency) as currency
       FROM finance_client_monthly_cost
       WHERE clinic_id = ?
         AND period_month >= ?
         AND period_month <= ?
       GROUP BY client_account_profile_id, period_month`,
      [clinicId, fromMonth, toMonth],
    );
    const costs: CostRow[] = costRowsRaw.map((row: any) => ({
      clientAccountProfileId: row.clientAccountProfileId,
      periodMonth: rowMonth(row.periodMonth)!,
      costCents: Number(row.costCents || 0),
      currency: row.currency || "USD",
    }));

    const clientIds = Array.from(new Set([
      ...services.map((service) => service.clientAccountProfileId),
      ...costs.map((cost) => cost.clientAccountProfileId),
    ])).sort();
    const months = monthsBetween(fromMonth, toMonth);
    const periods: ClientRevenuePeriod[] = [];
    const movements: ClientMrrMovement[] = [];

    for (const clientAccountProfileId of clientIds) {
      let previousMrrCents = 0;
      for (const periodMonth of months) {
        const clientServices = services.filter((service) => service.clientAccountProfileId === clientAccountProfileId);
        const currency = clientServices[0]?.currency || costs.find((cost) => cost.clientAccountProfileId === clientAccountProfileId)?.currency || "USD";
        const mrrCents = clientServices
          .filter((service) => activeAtMonthEnd(service, periodMonth))
          .reduce((sum, service) => sum + moneyToCents(service.recurringValue), 0);
        const recognizedRevenueCents = clientServices.reduce((sum, service) => sum + recognizedCents(service, periodMonth), 0);
        const costCents = costs
          .filter((cost) => cost.clientAccountProfileId === clientAccountProfileId && cost.periodMonth === periodMonth)
          .reduce((sum, cost) => sum + cost.costCents, 0);
        const marginCents = recognizedRevenueCents - costCents;
        periods.push({
          clientAccountProfileId,
          periodMonth,
          currency,
          mrrCents,
          recognizedRevenueCents,
          costCents,
          marginCents,
          marginPercent: marginPercent(recognizedRevenueCents, marginCents),
        });
        movements.push({
          clientAccountProfileId,
          periodMonth,
          currency,
          previousMrrCents,
          currentMrrCents: mrrCents,
          movementCents: mrrCents - previousMrrCents,
          category: movementCategory(previousMrrCents, mrrCents),
        });
        previousMrrCents = mrrCents;
      }
    }

    const lastMonth = months[months.length - 1]!;
    const finalPeriods = periods.filter((period) => period.periodMonth === lastMonth);
    const recognizedRevenueCents = periods.reduce((sum, period) => sum + period.recognizedRevenueCents, 0);
    const costCents = periods.reduce((sum, period) => sum + period.costCents, 0);
    const mrrCents = finalPeriods.reduce((sum, period) => sum + period.mrrCents, 0);
    const marginCents = recognizedRevenueCents - costCents;

    return {
      periods,
      movements,
      totals: {
        currency: finalPeriods[0]?.currency || "USD",
        mrrCents,
        recognizedRevenueCents,
        costCents,
        marginCents,
        marginPercent: marginPercent(recognizedRevenueCents, marginCents),
      },
    };
  }
}

export const financeAnalyticsService = new FinanceAnalyticsService();
