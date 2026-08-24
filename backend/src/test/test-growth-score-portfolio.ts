import assert from "node:assert/strict";
import test from "node:test";
import { v4 as uuidv4 } from "uuid";
import pool from "../config/database.js";
import { growthScoresService } from "../modules/growth-scores/growth-scores.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

async function createClientAccountProfile(clinicId: string, userId: string) {
  const profileId = uuidv4();
  await pool.execute(
    `INSERT INTO client_account_profile
      (id, clinic_id, active_services, current_package, client_status, health_status, created_by, updated_by)
     VALUES (?, ?, JSON_ARRAY(), 'Clinic Growth Engine', 'active', 'healthy', ?, ?)`,
    [profileId, clinicId, userId, userId],
  );
  return profileId;
}

test("growth score portfolio captures outcome feedback, trends and client drill-down", async () => {
  const fixture = await createTestClinicAndAdmin("growth-score-portfolio");
  const clientAccountProfileId = await createClientAccountProfile(fixture.clinicId, fixture.userId);

  await growthScoresService.createSnapshot(fixture.clinicId, fixture.userId, {
    clientAccountProfileId,
    snapshotDate: "2026-07-31",
    scoredAt: "2026-07-31T09:00:00.000Z",
    overallScore: 45,
    categoryScores: {
      websiteVisibility: 40,
      conversion: 45,
      tracking: 50,
    },
    recommendedPackage: "Lead Concierge",
    source: "manual",
  });
  const current = await growthScoresService.createSnapshot(fixture.clinicId, fixture.userId, {
    clientAccountProfileId,
    snapshotDate: "2026-08-31",
    scoredAt: "2026-08-31T09:00:00.000Z",
    overallScore: 62,
    categoryScores: {
      websiteVisibility: 58,
      conversion: 62,
      tracking: 66,
    },
    recommendedPackage: "Clinic Growth Engine",
    source: "manual",
  });

  const feedback = await growthScoresService.createOutcomeFeedback(fixture.clinicId, fixture.userId, {
    clientAccountProfileId,
    growthScoreSnapshotId: current.id,
    feedbackDate: "2026-09-01",
    outcomeType: "improved",
    scoreDelta: 17,
    note: "Booked-consultation visibility improved after tracking cleanup.",
  });
  const portfolio = await growthScoresService.getPortfolio(fixture.clinicId, fixture.userId);
  const row = portfolio.clients.find((client) => client.clientAccountProfileId === clientAccountProfileId);

  assert.equal(feedback.outcomeType, "improved");
  assert.equal(portfolio.scope, "all_clients");
  assert.ok(portfolio.aggregate.clients >= 1);
  assert.ok(portfolio.aggregate.clientsWithScores >= 1);
  assert.ok(portfolio.aggregate.improved >= 1);
  assert.ok(portfolio.aggregate.feedbackItems >= 1);
  assert.ok(portfolio.trends.length > 0);
  assert.equal(row?.currentScore, 62);
  assert.equal(row?.previousScore, 45);
  assert.equal(row?.scoreDelta, 17);
  assert.equal(row?.feedbackCount, 1);
  assert.equal(row?.lastOutcomeType, "improved");
});

test("growth score outcome feedback rejects snapshots outside the client account", async () => {
  const primary = await createTestClinicAndAdmin("growth-score-feedback-primary");
  const secondary = await createTestClinicAndAdmin("growth-score-feedback-secondary");
  const primaryProfileId = await createClientAccountProfile(primary.clinicId, primary.userId);
  const secondaryProfileId = await createClientAccountProfile(secondary.clinicId, secondary.userId);
  const secondarySnapshot = await growthScoresService.createSnapshot(secondary.clinicId, secondary.userId, {
    clientAccountProfileId: secondaryProfileId,
    snapshotDate: "2026-08-31",
    overallScore: 70,
  });

  await assert.rejects(
    () => growthScoresService.createOutcomeFeedback(primary.clinicId, primary.userId, {
      clientAccountProfileId: primaryProfileId,
      growthScoreSnapshotId: secondarySnapshot.id,
      feedbackDate: "2026-09-01",
      outcomeType: "improved",
    }),
    /not linked to this client account/i,
  );
});
