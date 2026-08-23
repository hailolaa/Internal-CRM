import assert from "node:assert/strict";
import test from "node:test";
import { v4 as uuidv4 } from "uuid";
import pool, { testConnection } from "../config/database.js";
import { financeAnalyticsService } from "../modules/finance-analytics/finance-analytics.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

async function createClientAccount(
  clinicId: string,
  overrides: { healthStatus?: string; churnRisk?: string; contractStatus?: string } = {},
) {
  const id = uuidv4();
  await pool.execute(
    `INSERT INTO client_account_profile
      (id, clinic_id, client_status, contract_status, onboarding_status, health_status)
     VALUES (?, ?, 'active', ?, 'completed', ?)`,
    [id, clinicId, overrides.contractStatus || "active", overrides.healthStatus || "healthy"],
  );
  if (overrides.churnRisk) {
    await pool.execute(`UPDATE client_account_profile SET churn_risk = ? WHERE id = ?`, [overrides.churnRisk, id]);
  }
  return id;
}

async function createService(input: {
  clinicId: string;
  clientAccountProfileId: string;
  name: string;
  recurringValue: number;
  startDate: string;
  endDate?: string | null;
}) {
  await pool.execute(
    `INSERT INTO client_account_service
      (id, clinic_id, client_account_profile_id, service_type, name, status, start_date, end_date,
       recurring_value, currency, contract_status)
     VALUES (?, ?, ?, 'strategy', ?, 'active', ?, ?, ?, 'GBP', 'active')`,
    [
      uuidv4(),
      input.clinicId,
      input.clientAccountProfileId,
      input.name,
      input.startDate,
      input.endDate || null,
      input.recurringValue,
    ],
  );
}

test("finance analytics categorizes MRR movement and margin trends", async () => {
  await testConnection();
  const clinic = await createTestClinicAndAdmin("finance-mrr");
  const clientA = await createClientAccount(clinic.clinicId);

  await createService({
    clinicId: clinic.clinicId,
    clientAccountProfileId: clientA,
    name: "Growth Engine",
    recurringValue: 1000,
    startDate: "2026-08-01",
    endDate: "2026-09-30",
  });
  await createService({
    clinicId: clinic.clinicId,
    clientAccountProfileId: clientA,
    name: "Expansion",
    recurringValue: 500,
    startDate: "2026-09-01",
    endDate: "2026-09-30",
  });

  await financeAnalyticsService.upsertClientMonthlyCost({
    clinicId: clinic.clinicId,
    clientAccountProfileId: clientA,
    periodMonth: "2026-09-01",
    costCents: 55000,
    currency: "GBP",
    source: "delivery-cost",
  });

  const view = await financeAnalyticsService.getRevenueView({
    clinicId: clinic.clinicId,
    fromMonth: "2026-08-01",
    toMonth: "2026-10-01",
  });

  const clientASeptember = view.periods.find((period) => period.clientAccountProfileId === clientA && period.periodMonth === "2026-09-01");
  const clientAOctober = view.movements.find((movement) => movement.clientAccountProfileId === clientA && movement.periodMonth === "2026-10-01");
  const movementCategories = view.movements.map((movement) => movement.category);

  assert.equal(clientASeptember?.mrrCents, 150000);
  assert.equal(clientASeptember?.recognizedRevenueCents, 150000);
  assert.equal(clientASeptember?.costCents, 55000);
  assert.equal(clientASeptember?.marginCents, 95000);
  assert.equal(clientASeptember?.marginPercent, 63.33);
  assert.equal(clientAOctober?.category, "churn");
  assert.ok(movementCategories.includes("new"));
  assert.ok(movementCategories.includes("expansion"));
  assert.ok(movementCategories.includes("churn"));
  assert.equal(view.totals.mrrCents, 0);
  assert.equal(view.totals.costCents, 55000);
});

test("finance analytics prorates recognized revenue for partial months", async () => {
  const clinic = await createTestClinicAndAdmin("finance-prorate");
  const client = await createClientAccount(clinic.clinicId);
  await createService({
    clinicId: clinic.clinicId,
    clientAccountProfileId: client,
    name: "Mid-month start",
    recurringValue: 3100,
    startDate: "2026-08-16",
  });

  const view = await financeAnalyticsService.getRevenueView({
    clinicId: clinic.clinicId,
    fromMonth: "2026-08-01",
    toMonth: "2026-08-01",
  });

  const period = view.periods.find((item) => item.clientAccountProfileId === client);
  assert.equal(period?.mrrCents, 310000);
  assert.equal(period?.recognizedRevenueCents, 160000);
});

test("finance analytics predicts revenue risk with explanations and validates against historical churn", async () => {
  const clinic = await createTestClinicAndAdmin("finance-risk");
  const riskyClient = await createClientAccount(clinic.clinicId, { healthStatus: "critical", churnRisk: "high" });

  await createService({
    clinicId: clinic.clinicId,
    clientAccountProfileId: riskyClient,
    name: "Risky client",
    recurringValue: 1000,
    startDate: "2026-08-01",
    endDate: "2026-08-31",
  });

  const report = await financeAnalyticsService.getRevenueRiskModel({
    clinicId: clinic.clinicId,
    fromMonth: "2026-08-01",
    toMonth: "2026-09-01",
  });

  assert.equal(report.model.name, "revenue_risk_v1");
  assert.equal(report.model.explainability, "per_prediction_weighted_reasons");
  assert.equal(report.backtest.status, "validated");
  assert.equal(report.backtest.validationRows, 1);
  assert.equal(report.backtest.accuracy, 1);
  assert.equal(report.backtest.meetsThreshold, true);

  const riskyPrediction = report.predictions.find((prediction) => prediction.clientAccountProfileId === riskyClient);
  assert.equal(riskyPrediction?.riskLevel, "high");
  assert.ok((riskyPrediction?.explanations.length || 0) >= 2);
});
