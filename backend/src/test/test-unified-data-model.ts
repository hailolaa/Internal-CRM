import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCommercialRevenueLeakage,
  calculateCostPer,
  calculateMarketingRoi,
  calculateRatio,
  calculateRoas,
  getUnifiedMetricDefinition,
  UNIFIED_DIMENSIONS,
  UNIFIED_METRICS,
} from "../modules/analytics-store/unified-data-model.js";

test("unified data model covers required metrics and drill-down dimensions", () => {
  const requiredMetrics = [
    "impressions",
    "clicks",
    "spend",
    "leads",
    "qualified_leads",
    "calls_answered",
    "calls_missed",
    "calls_returned",
    "bookings",
    "consultations_attended",
    "treatment_sales_count",
    "treatment_sales_value",
    "revenue",
    "cancellation_rate",
    "no_show_rate",
    "lead_response_speed_minutes",
    "reception_follow_up_performance",
    "conversion_lead_to_qualified",
    "conversion_qualified_to_booking",
    "conversion_booking_to_consultation",
    "conversion_consultation_to_treatment",
    "cost_per_lead",
    "cost_per_qualified_lead",
    "cost_per_booking",
    "cost_per_acquired_patient",
    "roas",
    "marketing_roi",
    "commercial_revenue_leakage",
  ];
  const requiredDimensions = ["client", "location", "treatment", "campaign", "source_channel", "time_period", "workstream_owner"];

  assert.deepEqual(
    requiredMetrics.filter((key) => !getUnifiedMetricDefinition(key)),
    [],
  );
  assert.deepEqual(
    requiredDimensions.filter((key) => !UNIFIED_DIMENSIONS.some((dimension) => dimension.key === key)),
    [],
  );
  assert.ok(UNIFIED_METRICS.every((metric) => metric.nullableWhenMissing));
});

test("unified data model calculations return null instead of zero for missing denominators", () => {
  assert.equal(calculateRatio({ numerator: 4, denominator: 10 }), 40);
  assert.equal(calculateRatio({ numerator: 4, denominator: 0 }), null);
  assert.equal(calculateCostPer(1000, 10), 100);
  assert.equal(calculateCostPer(1000, null), null);
  assert.equal(calculateRoas(5000, 1000), 5);
  assert.equal(calculateMarketingRoi(5000, 1000), 400);
});

test("commercial revenue leakage is testable and preserves missing input state", () => {
  const complete = calculateCommercialRevenueLeakage({
    missedCalls: 3,
    slowResponseLeads: 5,
    noShows: 2,
    averageTreatmentValue: 1200,
    slowResponseDropoutRate: 0.25,
  });
  assert.equal(complete.components.missedCalls, 3600);
  assert.equal(complete.components.slowResponse, 1500);
  assert.equal(complete.components.noShows, 2400);
  assert.equal(complete.total, 7500);
  assert.deepEqual(complete.missingInputs, []);

  const partial = calculateCommercialRevenueLeakage({
    missedCalls: 3,
    averageTreatmentValue: 1200,
  });
  assert.equal(partial.components.missedCalls, 3600);
  assert.equal(partial.total, 3600);
  assert.deepEqual(partial.missingInputs.sort(), ["noShows", "slowResponseDropoutRate", "slowResponseLeads"].sort());
});
