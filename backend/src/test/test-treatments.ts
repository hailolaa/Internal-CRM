import assert from "node:assert/strict";
import test from "node:test";
import pool, { testConnection } from "../config/database.js";
import { treatmentsService } from "../modules/treatments/treatments.service.js";

const primaryClinicId = process.env.TEST_CLINIC_ID || "clinic-001";
const primaryUserId = process.env.TEST_USER_ID || "user-001";
const secondaryClinicId = process.env.TEST_OTHER_CLINIC_ID || "clinic-002";

test("treatment catalog supports category and commercial fields", async () => {
  await testConnection();
  console.log("[treatments] database connection OK");

  const treatmentName = `Integration Test Treatment ${Date.now()}`;
  const createdId = await treatmentsService.createTreatment(primaryClinicId, primaryUserId, {
    name: treatmentName,
    description: "Created by integration test",
    durationMinutes: 45,
    priceCents: 150000,
    averageValueCents: 120000,
    marginPercent: 30.5,
    priority: 5,
    isHighTicket: false,
    status: "active",
  });

  try {
    const list = await treatmentsService.listTreatments(primaryClinicId);
    const created = list.find((item) => item.id === createdId);

    assert.ok(created, "Created treatment should be returned by list");
    assert.equal(created?.name, treatmentName);
    assert.equal(created?.category, "Other", "Default category should be Other");
    assert.equal(created?.averageValueCents, 120000);
    assert.equal(created?.marginPercent, 30.5);
    assert.equal(created?.priority, 5);
    assert.equal(created?.isHighTicket, false);
    console.log("[treatments] create + default category check passed");

    await treatmentsService.updateTreatment(primaryClinicId, primaryUserId, createdId, {
      category: "Injectables",
      averageValueCents: 180000,
      marginPercent: 40,
      priority: 8,
      isHighTicket: true,
      priceCents: 210000,
    });

    const updatedList = await treatmentsService.listTreatments(primaryClinicId);
    const updated = updatedList.find((item) => item.id === createdId);

    assert.ok(updated, "Updated treatment should still be returned by list");
    assert.equal(updated?.category, "Injectables");
    assert.equal(updated?.averageValueCents, 180000);
    assert.equal(updated?.marginPercent, 40);
    assert.equal(updated?.priority, 8);
    assert.equal(updated?.isHighTicket, true);
    assert.equal(updated?.priceCents, 210000);
    console.log("[treatments] update + commercial fields check passed");

    const otherClinicList = await treatmentsService.listTreatments(secondaryClinicId);
    assert.ok(
      !otherClinicList.some((item) => item.id === createdId),
      "Another clinic should not be able to read this treatment",
    );
    console.log("[treatments] tenant read isolation check passed");

    await assert.rejects(
      () =>
        treatmentsService.updateTreatment(secondaryClinicId, primaryUserId, createdId, {
          name: "Cross clinic update should fail",
        }),
      (error: any) => error?.statusCode === 404,
      "Another clinic should not be able to update this treatment",
    );
    console.log("[treatments] tenant update isolation check passed");
  } finally {
    await treatmentsService.deleteTreatment(primaryClinicId, primaryUserId, createdId);
    await pool.end();
  }

  console.log("[treatments] integration test completed successfully");
});
