import assert from "node:assert/strict";
import test from "node:test";
import { v4 as uuidv4 } from "uuid";
import pool, { testConnection } from "../config/database.js";
import { contactsService } from "../modules/contacts/contacts.service.js";
import { pipelineDealsService } from "../modules/pipeline/pipeline.deals.service.js";
import { pipelineService } from "../modules/pipeline/pipeline.service.js";
import { hashPassword } from "../utils/helpers.js";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
}

async function createClinicAndAdmin(prefix: string) {
  const clinicId = uuidv4();
  const userId = uuidv4();
  const email = uniqueEmail(`${prefix}_admin`);

  await pool.execute(
    `INSERT INTO clinic
      (id, name, email, phone, timezone, subscription_plan, subscription_status, max_users)
     VALUES (?, ?, ?, '555-0100', 'Europe/London', 'professional', 'active', 20)`,
    [clinicId, `${prefix} Workspace`, email],
  );

  await pool.execute(
    `INSERT INTO user
      (id, clinic_id, email, password_hash, first_name, last_name, phone, role,
       email_verified_at, status, is_active)
     VALUES (?, ?, ?, ?, ?, 'Admin', '555-0100', 'SUPER_ADMIN',
       CURRENT_TIMESTAMP, 'active', 1)`,
    [userId, clinicId, email, await hashPassword("password123"), prefix],
  );

  await pool.execute(
    `INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
     VALUES (?, ?, 'SUPER_ADMIN', 'active', 1)`,
    [userId, clinicId],
  );

  return {
    clinicId,
    userId,
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

test("pipeline stage customisations survive subsequent pipeline reads", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("PipelineCustomStages");
  const initialStages = await pipelineService.listStages(primary.clinicId, primary.userId);
  const firstStage = initialStages.find((stage) => stage.name === "New Lead");
  const removableStage = initialStages.find((stage) => stage.name === "Future Opportunity");
  assert.ok(firstStage && removableStage, "Expected configurable default stages");

  await pipelineService.updateStage(primary.clinicId, primary.userId, firstStage.id, {
    name: "Inbox",
    color: "bg-violet-500",
    position: 1,
  });
  await pipelineService.deleteStage(primary.clinicId, primary.userId, removableStage.id);
  const customStage = await pipelineService.createStage(primary.clinicId, primary.userId, {
    name: "Re-engagement",
    color: "bg-teal-500",
    kind: "open",
  });

  const reloadedStages = await pipelineService.listStages(primary.clinicId, primary.userId);
  const reloadedFirstStage = reloadedStages.find((stage) => stage.id === firstStage.id);
  assert.equal(reloadedFirstStage?.name, "Inbox");
  assert.equal(reloadedFirstStage?.color, "bg-violet-500");
  assert.equal(
    reloadedStages.some((stage) => stage.id === removableStage.id),
    false,
    "Deleted stages must not be recreated by a later read",
  );
  assert.equal(
    reloadedStages.some((stage) => stage.id === customStage.id && stage.name === "Re-engagement"),
    true,
    "Added stages must remain visible after a later read",
  );
});

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

test("marking a lead lost requires reasons and syncs linked sales records", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("LeadLostSync");
  const contact = await createContact(primary.clinicId, primary.userId, "LeadLostSync");
  const stages = await pipelineService.listStages(primary.clinicId, primary.userId);
  const openStage = stages.find((stage) => stage.kind === "open") || stages[0];
  const lostStage = stages.find((stage) => stage.kind === "lost");
  assert.ok(openStage, "Expected an open stage");
  assert.ok(lostStage, "Expected a lost stage");

  const deal = await pipelineDealsService.createDeal(primary.clinicId, primary.userId, {
    contactId: contact.id,
    stageId: openStage.id,
    valueCents: 199500,
    source: "website",
    treatment: "Growth Engine",
    probability: 40,
  });
  const proposalId = uuidv4();
  await pool.execute(
    `INSERT INTO proposal
      (id, clinic_id, contact_id, deal_id, proposal_name, package_name, status, value, created_by, updated_by)
     VALUES (?, ?, ?, ?, 'Lost sync proposal', 'Growth Engine', 'sent', 1995.00, ?, ?)`,
    [proposalId, primary.clinicId, contact.id, deal.id, primary.userId, primary.userId],
  );

  try {
    await assert.rejects(
      () => contactsService.updateContactProfile(primary.clinicId, primary.userId, contact.id, {
        status: "lost",
      }),
      (error: any) =>
        error?.statusCode === 400
        && typeof error?.message === "string"
        && error.message.includes("Lost reason"),
      "A lead cannot be marked lost without a reason",
    );

    const updated = await contactsService.updateContactProfile(primary.clinicId, primary.userId, contact.id, {
      status: "lost",
      lostReason: "budget",
      objectionType: "timing",
    });
    assert.equal(updated.status, "lost");
    assert.equal(updated.leadStatus, "lost");
    assert.equal(updated.lostReason, "budget");
    assert.equal(updated.objectionType, "timing");

    const [dealRows]: any = await pool.execute(
      `SELECT status,
              pipeline_stage_id as stageId,
              lost_reason as lostReason,
              objection_type as objectionType
       FROM deal
       WHERE id = ? AND clinic_id = ?`,
      [deal.id, primary.clinicId],
    );
    assert.equal(dealRows[0].status, "lost");
    assert.equal(dealRows[0].stageId, lostStage.id);
    assert.equal(dealRows[0].lostReason, "budget");
    assert.equal(dealRows[0].objectionType, "timing");

    const [proposalRows]: any = await pool.execute(
      `SELECT status, lost_reason as lostReason, objection_type as objectionType
       FROM proposal
       WHERE id = ? AND clinic_id = ?`,
      [proposalId, primary.clinicId],
    );
    assert.equal(proposalRows[0].status, "lost");
    assert.equal(proposalRows[0].lostReason, "budget");
    assert.equal(proposalRows[0].objectionType, "timing");

    const [timelineRows]: any = await pool.execute(
      `SELECT COUNT(*) as total
       FROM activity
       WHERE clinic_id = ?
         AND contact_id = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.changes.lostReason')) = 'budget'
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.changes.objectionType')) = 'timing'`,
      [primary.clinicId, contact.id],
    );
    assert.ok(Number(timelineRows[0].total) >= 1, "Timeline should include the lost reason and objection");

    const [auditRows]: any = await pool.execute(
      `SELECT COUNT(*) as total
       FROM audit_log
       WHERE clinic_id = ?
         AND action IN ('CONTACT_UPDATED', 'PIPELINE_DEAL_MOVED', 'PROPOSAL_STATUS_CHANGED')
         AND JSON_UNQUOTE(JSON_EXTRACT(changes, '$.lostReason')) = 'budget'`,
      [primary.clinicId],
    );
    assert.ok(Number(auditRows[0].total) >= 3, "Audit records should expose lost reason for reporting");
  } finally {
    await pool.execute("DELETE FROM proposal WHERE id = ?", [proposalId]);
    await pool.execute("DELETE FROM deal WHERE id = ? AND clinic_id = ?", [deal.id, primary.clinicId]);
    await pool.execute("UPDATE contact SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ?", [contact.id, primary.clinicId]);
  }
});
