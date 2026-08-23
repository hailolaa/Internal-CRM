import pool from "../../config/database.js";

type BenchmarkKey =
  | "response_time"
  | "booking_rate"
  | "call_to_booking"
  | "consult_conversion"
  | "revenue_per_consult"
  | "deposit_enforcement";

const definitions: Record<BenchmarkKey, { label: string; average: number; topQuartile: number; thresholdKey?: "leads" | "calls" | "consults"; higherIsBetter: boolean; unit: "percent" | "minutes" | "currency" }> = {
  response_time: { label: "Response time benchmark", average: 8, topQuartile: 5, higherIsBetter: false, unit: "minutes" },
  booking_rate: { label: "Booking rate benchmark", average: 32, topQuartile: 45, thresholdKey: "leads", higherIsBetter: true, unit: "percent" },
  call_to_booking: { label: "Call-to-booking benchmark", average: 24, topQuartile: 36, thresholdKey: "calls", higherIsBetter: true, unit: "percent" },
  consult_conversion: { label: "Consult conversion benchmark", average: 62, topQuartile: 75, thresholdKey: "consults", higherIsBetter: true, unit: "percent" },
  revenue_per_consult: { label: "Revenue per consult benchmark", average: 520, topQuartile: 850, thresholdKey: "consults", higherIsBetter: true, unit: "currency" },
  deposit_enforcement: { label: "Deposit enforcement benchmark", average: 55, topQuartile: 75, thresholdKey: "consults", higherIsBetter: true, unit: "percent" },
};

const minimumThresholds = {
  leads: 30,
  calls: 20,
  consults: 10,
};

const anonymizationThreshold = 5;
const cohortLookbackDays = 180;

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function gap(value: number, target: number, higherIsBetter: boolean) {
  return higherIsBetter ? Math.round(value - target) : Math.round(target - value);
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * percentileValue)));
  return Math.round(sorted[index] ?? 0);
}

function insightForMetric(label: string, value: number, target: number, higherIsBetter: boolean) {
  const delta = gap(value, target, higherIsBetter);
  if (higherIsBetter) {
    if (delta >= 0) return `${label} is ahead of the governed benchmark; protect the operating rhythm that is creating the lift.`;
    return `${label} is behind the governed benchmark; review ownership, follow-up and source quality before adding more demand.`;
  }
  if (delta >= 0) return `${label} is ahead of the governed benchmark; keep response ownership tight as volume grows.`;
  return `${label} is slower than the governed benchmark; tighten first-response routing and escalation.`;
}

export class BenchmarksService {
  async getSummary(clinicId: string) {
    const [[leadRow], [callRow], [consultRow], [slaRow]]: any = await Promise.all([
      pool.execute(
        `SELECT COUNT(*) as leads,
                SUM(CASE WHEN status IN ('Booked', 'Consult Booked', 'Qualified') THEN 1 ELSE 0 END) as booked
         FROM contact
         WHERE clinic_id = ? AND deleted_at IS NULL`,
        [clinicId],
      ).then(([rows]: any) => rows),
      pool.execute(
        `SELECT COUNT(*) as calls,
                SUM(CASE WHEN outcome = 'booked_consult' THEN 1 ELSE 0 END) as bookedCalls
         FROM \` call \`
         WHERE clinic_id = ? AND deleted_at IS NULL`,
        [clinicId],
      ).then(([rows]: any) => rows),
      pool.execute(
        `SELECT COUNT(*) as consults,
                SUM(CASE WHEN outcome IN ('Sold', 'Treatment Booked') THEN 1 ELSE 0 END) as sold,
                SUM(CASE WHEN outcome IN ('Sold', 'Treatment Booked') THEN revenue ELSE 0 END) as revenue,
                SUM(CASE WHEN deposit_status IN ('paid', 'requested') THEN 1 ELSE 0 END) as deposits
         FROM manual_consult_entry
         WHERE clinic_id = ? AND deleted_at IS NULL`,
        [clinicId],
      ).then(([rows]: any) => rows),
      pool.execute(
        `SELECT AVG(TIMESTAMPDIFF(MINUTE, created_at, first_response_at)) as averageResponseMinutes
         FROM contact
         WHERE clinic_id = ? AND deleted_at IS NULL AND first_response_at IS NOT NULL`,
        [clinicId],
      ).then(([rows]: any) => rows),
    ]);

    const counts = {
      leads: Number(leadRow?.leads || 0),
      calls: Number(callRow?.calls || 0),
      consults: Number(consultRow?.consults || 0),
    };

    const values: Record<BenchmarkKey, number> = {
      response_time: Math.round(Number(slaRow?.averageResponseMinutes || 0)),
      booking_rate: percent(Number(leadRow?.booked || 0), counts.leads),
      call_to_booking: percent(Number(callRow?.bookedCalls || 0), counts.calls),
      consult_conversion: percent(Number(consultRow?.sold || 0), counts.consults),
      revenue_per_consult: counts.consults > 0 ? Math.round(Number(consultRow?.revenue || 0) / counts.consults) : 0,
      deposit_enforcement: percent(Number(consultRow?.deposits || 0), counts.consults),
    };

    const metrics = Object.entries(definitions).map(([key, definition]) => {
      const thresholdKey = definition.thresholdKey;
      const threshold = thresholdKey ? minimumThresholds[thresholdKey] : 1;
      const count = thresholdKey ? counts[thresholdKey] : 1;
      const enoughData = count >= threshold;
      const value = values[key as BenchmarkKey];
      return {
        key,
        label: definition.label,
        value,
        unit: definition.unit,
        benchmarkAverage: definition.average,
        topQuartile: definition.topQuartile,
        gapToAverage: gap(value, definition.average, definition.higherIsBetter),
        enoughData,
        minimumThreshold: threshold,
        currentCount: count,
        wording: enoughData
          ? "Based on available clinic data and estimated benchmark values."
          : "Not enough data yet. Internal comparison until wider cohort data is available.",
        benchmarkSource: "estimated",
      };
    });

    return {
      clinicId,
      counts,
      minimumThresholds,
      cohortStatus: "internal_comparison_until_wider_cohort_data_is_available",
      safeWording: "Estimated benchmark. Based on available data.",
      metrics,
    };
  }

  async getAdvancedReport(clinicId: string) {
    const summary = await this.getSummary(clinicId);
    const metricKeys = Object.keys(definitions);
    const [rows]: any = await pool.execute(
      `SELECT metric_key as metricKey,
              clinic_id as clinicId,
              AVG(metric_value) as value
       FROM analytics_metric_fact
       WHERE metric_key IN (${metricKeys.map(() => "?").join(", ")})
         AND grain_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY metric_key, clinic_id`,
      [...metricKeys, cohortLookbackDays],
    );

    const cohortValues = new Map<string, number[]>();
    for (const row of rows as Array<{ metricKey: string; clinicId: string; value: unknown }>) {
      if (row.clinicId === clinicId) continue;
      const value = Number(row.value);
      if (!Number.isFinite(value)) continue;
      const values = cohortValues.get(row.metricKey) || [];
      values.push(value);
      cohortValues.set(row.metricKey, values);
    }

    return {
      ...summary,
      governance: {
        accessControl: "reports:read",
        anonymizationThreshold,
        cohortLookbackDays,
        clinicIdentitiesExposed: false,
        notes: "Cohort values are shown only when enough peer clinics are available. Clinic identities and raw peer rows are never returned.",
      },
      metrics: summary.metrics.map((metric) => {
        const definition = definitions[metric.key as BenchmarkKey];
        const values = cohortValues.get(metric.key) || [];
        const cohortClinicCount = values.length;
        const cohortAvailable = cohortClinicCount >= anonymizationThreshold;
        const cohortAverage = cohortAvailable ? average(values) : null;
        const cohortTopQuartile = cohortAvailable
          ? percentile(values, definition.higherIsBetter ? 0.75 : 0.25)
          : null;
        const comparisonTarget = cohortAverage ?? metric.benchmarkAverage;
        return {
          ...metric,
          benchmarkAverage: comparisonTarget,
          topQuartile: cohortTopQuartile ?? metric.topQuartile,
          gapToAverage: gap(metric.value, comparisonTarget, definition.higherIsBetter),
          benchmarkSource: cohortAvailable ? "anonymized_cohort" : "estimated",
          cohort: {
            available: cohortAvailable,
            clinicCount: cohortClinicCount,
            anonymizationThreshold,
            average: cohortAverage,
            topQuartile: cohortTopQuartile,
            suppressedReason: cohortAvailable ? null : "Not enough anonymized peer clinics for a governed cohort comparison.",
          },
          insight: insightForMetric(metric.label, metric.value, comparisonTarget, definition.higherIsBetter),
        };
      }),
    };
  }
}

export const benchmarksService = new BenchmarksService();
