import assert from "node:assert/strict";
import test from "node:test";
import { analyticsStoreService } from "../modules/analytics-store/analytics-store.service.js";
import { benchmarksService } from "../modules/benchmarks/benchmarks.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

test("advanced benchmarks suppress small cohorts and anonymize eligible peer comparisons", async () => {
  const target = await createTestClinicAndAdmin("benchmark-target");
  const peers = await Promise.all(
    Array.from({ length: 5 }, (_, index) => createTestClinicAndAdmin(`benchmark-peer-${index}`)),
  );

  await Promise.all(
    peers.map((peer, index) =>
      analyticsStoreService.recordFact({
        clinicId: peer.clinicId,
        metricKey: "booking_rate",
        grain: "monthly",
        grainDate: "2026-08-01",
        metricValue: 35 + index,
        unit: "percent",
        dimensions: { sector: "clinic" },
        provenance: "connector",
      }),
    ),
  );

  const report = await benchmarksService.getAdvancedReport(target.clinicId);
  assert.equal(report.governance.accessControl, "reports:read");
  assert.equal(report.governance.clinicIdentitiesExposed, false);

  const bookingRate = report.metrics.find((metric) => metric.key === "booking_rate");
  assert.ok(bookingRate);
  assert.equal(bookingRate.benchmarkSource, "anonymized_cohort");
  assert.equal(bookingRate.cohort.available, true);
  assert.ok(bookingRate.cohort.clinicCount >= 5);
  assert.equal(bookingRate.cohort.anonymizationThreshold, 5);
  assert.equal(typeof bookingRate.insight, "string");

  const responseTime = report.metrics.find((metric) => metric.key === "response_time");
  assert.ok(responseTime);
  assert.equal(responseTime.benchmarkSource, "estimated");
  assert.equal(responseTime.cohort.available, false);
  assert.equal(responseTime.cohort.suppressedReason, "Not enough anonymized peer clinics for a governed cohort comparison.");

  const serialized = JSON.stringify(report);
  for (const peer of peers) {
    assert.equal(serialized.includes(peer.clinicId), false);
  }
});
