import assert from "node:assert/strict";
import test from "node:test";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";
import { contactsService } from "../modules/contacts/contacts.service.js";
import { pipelineDealsService } from "../modules/pipeline/pipeline.deals.service.js";
import { pipelineService } from "../modules/pipeline/pipeline.service.js";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
}

async function createClinicAndAdmin(prefix: string) {
  const email = uniqueEmail(`${prefix}_admin`);
  const result = await authService.registerClinic({
    clinicName: `${prefix} Clinic`,
    adminEmail: email,
    adminPassword: "password123",
    firstName: prefix,
    lastName: "Admin",
    phone: "555-0100",
  });

  return {
    clinicId: result.user.clinicId,
    userId: result.user.id,
  };
}

async function createContact(clinicId: string, userId: string, prefix: string) {
  const created = await contactsService.createContact(clinicId, userId, {
    firstName: prefix,
    lastName: "Contact",
    email: uniqueEmail(`${prefix}_contact`),
    source: "integration-test",
    value: 2500,
    treatmentInterests: ["Injectables"],
  });

  return created.contact;
}

test("pipeline stage delete is blocked when active opportunities exist", async () => {
  await testConnection();
  console.log("[pipeline] database connection OK");

  const primary = await createClinicAndAdmin("PipelineGuardA");
  const contact = await createContact(primary.clinicId, primary.userId, "PipelineGuardA");
  const stages = await pipelineService.listStages(primary.clinicId, primary.userId);

  assert.ok(stages.length >= 2, "Expected default pipeline stages");
  const fromStage = stages[0];
  assert.ok(fromStage, "Expected first stage");

  const deal = await pipelineDealsService.createDeal(primary.clinicId, primary.userId, {
    contactId: contact.id,
    stageId: fromStage.id,
    valueCents: 175000,
    source: "integration-test",
    treatment: "Injectables",
    probability: 20,
  });

  assert.ok(deal.id, "Expected deal to be created");

  await assert.rejects(
    () => pipelineService.deleteStage(primary.clinicId, primary.userId, fromStage.id),
    (error: any) =>
      error?.statusCode === 409
      && typeof error?.message === "string"
      && error.message.includes("active opportunities"),
    "Deleting a stage with active opportunities should be blocked",
  );

  console.log("[pipeline] stage deletion guard check passed");

  await pool.execute(
    `UPDATE deal
     SET deleted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND clinic_id = ?
       AND deleted_at IS NULL`,
    [deal.id, primary.clinicId],
  );
});

test("pipeline deal move is denied across clinics", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("PipelineGuardPrimary");
  const secondary = await createClinicAndAdmin("PipelineGuardSecondary");
  const contact = await createContact(primary.clinicId, primary.userId, "PipelineGuardPrimary");

  const primaryStages = await pipelineService.listStages(primary.clinicId, primary.userId);
  const secondaryStages = await pipelineService.listStages(secondary.clinicId, secondary.userId);

  assert.ok(primaryStages.length >= 2, "Expected primary clinic default stages");
  assert.ok(secondaryStages.length >= 2, "Expected secondary clinic default stages");

  const fromStage = primaryStages[0];
  const toStage = primaryStages[1];
  const foreignStage = secondaryStages[1];
  assert.ok(fromStage && toStage && foreignStage, "Expected stages for test flow");

  const deal = await pipelineDealsService.createDeal(primary.clinicId, primary.userId, {
    contactId: contact.id,
    stageId: fromStage.id,
    valueCents: 220000,
    source: "integration-test",
    treatment: "Skin",
    probability: 30,
  });

  const moved = await pipelineDealsService.moveDeal(primary.clinicId, primary.userId, deal.id, {
    stageId: toStage.id,
    valueCents: 240000,
    notes: "valid in-clinic move",
  });
  assert.equal(moved.stageId, toStage.id, "Expected move in same clinic to succeed");

  await assert.rejects(
    () =>
      pipelineDealsService.moveDeal(secondary.clinicId, secondary.userId, deal.id, {
        stageId: foreignStage.id,
        notes: "cross clinic move should fail",
      }),
    (error: any) =>
      error?.statusCode === 404
      && typeof error?.message === "string"
      && error.message.includes("Pipeline opportunity not found"),
    "Another clinic should not be able to move this opportunity",
  );

  const afterDenied = await pipelineDealsService.listDeals(primary.clinicId, primary.userId);
  const unchanged = afterDenied.deals.find((item) => item.id === deal.id);
  assert.ok(unchanged, "Deal should still exist in primary clinic");
  assert.equal(
    unchanged?.stageId,
    toStage.id,
    "Cross-clinic move attempt must not change the deal stage",
  );

  console.log("[pipeline] cross-clinic move denial check passed");

  await pool.execute(
    `UPDATE deal
     SET deleted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND clinic_id = ?
       AND deleted_at IS NULL`,
    [deal.id, primary.clinicId],
  );
});
