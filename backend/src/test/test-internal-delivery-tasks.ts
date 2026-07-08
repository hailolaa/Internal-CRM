import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";
import { tasksService } from "../modules/tasks/tasks.service.js";
import { clientAccountsService } from "../modules/client-accounts/client-accounts.service.js";
import pool from "../config/database.js";
import tasksRoutes from "../modules/tasks/tasks.routes.js";
import errorHandler from "../middleware/errorHandler.js";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
}

async function createClinicAndAdmin(prefix: string) {
  const result = await authService.registerClinic({
    clinicName: `${prefix} Clinic`,
    adminEmail: uniqueEmail(`${prefix}_admin`),
    adminPassword: "password123",
    firstName: prefix,
    lastName: "Admin",
    phone: "555-0100",
  });

  return {
    clinicId: result.user.clinicId,
    userId: result.user.id,
    token: result.tokens.token,
  };
}

async function createPatientUser(clinicId: string, prefix: string) {
  const result = await authService.registerPatient({
    clinicId,
    email: uniqueEmail(`${prefix}_patient`),
    password: "password123",
    firstName: prefix,
    lastName: "Patient",
    phone: "555-0199",
  });

  return {
    userId: result.user.id,
    token: result.tokens.token,
  };
}

async function fetchJson(baseUrl: string, path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const body: any = await response.json();
  return { response, body };
}

async function ensureProfileRow(clinicId: string, userId: string): Promise<string> {
  const [existing]: any = await pool.execute(
    `SELECT id FROM client_account_profile WHERE clinic_id = ? LIMIT 1`,
    [clinicId],
  );
  if (existing.length > 0) return existing[0].id;

  const { v4: uuidv4 } = await import("uuid");
  const id = uuidv4();
  await pool.execute(
    `INSERT INTO client_account_profile (id, clinic_id, active_services, created_by, updated_by) VALUES (?, ?, ?, ?, ?)`,
    [id, clinicId, JSON.stringify([]), userId, userId],
  );
  return id;
}

test("internal delivery tasks CRUD, QA, archive, audit, and tenant isolation", async () => {
  await testConnection();
  console.log("[internal-delivery-tasks] database connection OK");

  const admin = await createClinicAndAdmin("InternalTasks");
  const patient = await createPatientUser(admin.clinicId, "InternalTasks");
  const profileId = await ensureProfileRow(admin.clinicId, admin.userId);
  const expressModule = await import("express") as any;
  const express = expressModule.default;
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/tasks", tasksRoutes);
  testApp.use(errorHandler);

  const server = testApp.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start internal tasks test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  // Create a client account service to link tasks to
  const auditCtx = { ipAddress: null, userAgent: null };
  const service = await clientAccountsService.createService(admin.clinicId, admin.userId, {
    serviceType: "seo",
    name: "SEO Campaign",
    status: "active",
    contractStatus: "active",
  }, auditCtx);
  const serviceId = service.id;

  let taskId: string;

  try {
    const forbidden = await fetchJson(baseUrl, "/api/tasks/internal", patient.token);
    assert.equal(forbidden.response.status, 403);
    console.log("[internal-delivery-tasks] patient blocked from internal API passed");

    // ── Create ────────────────────────────────────────────────
    taskId = await tasksService.createInternalTask(admin.clinicId, admin.userId, {
      title: "Build keyword research doc",
      description: "Research top 50 keywords for client SEO campaign",
      priority: "high",
      status: "pending",
      boardKey: "seo",
      serviceType: "seo",
      clientAccountProfileId: profileId,
      clientAccountServiceId: serviceId,
      assignedUserId: admin.userId,
      proofReference: "https://docs.google.com/spreadsheets/d/example",
      workflowMonth: "2026-06-01",
      templateKey: "seo_keyword_research",
      recurrenceRule: { frequency: "monthly", interval: 1 },
      dueDate: "2026-06-30",
    });
    assert.ok(taskId, "createInternalTask should return an id");
    console.log("[internal-delivery-tasks] create passed");

    // ── List internal tasks ───────────────────────────────────
    const apiList = await fetchJson(baseUrl, "/api/tasks/internal?boardKey=seo", admin.token);
    assert.equal(apiList.response.status, 200);
    assert.ok(
      apiList.body.data.some((t: any) => t.id === taskId),
      "Authorized internal API list should include created internal task",
    );
    console.log("[internal-delivery-tasks] authorized internal API list passed");

    const internalTasks = await tasksService.listInternalTasks(admin.clinicId, {});
    const created = internalTasks.find((t) => t.id === taskId);
    assert.ok(created, "Created internal task should appear in internal list");
    assert.equal(created!.title, "Build keyword research doc");
    assert.equal(created!.description, "Research top 50 keywords for client SEO campaign");
    assert.equal(created!.priority, "high");
    assert.equal(created!.status, "pending");
    assert.equal(created!.isInternal, true);
    assert.equal(created!.boardKey, "seo");
    assert.equal(created!.serviceType, "seo");
    assert.equal(created!.clientAccountProfileId, profileId);
    assert.equal(created!.clientAccountServiceId, serviceId);
    assert.equal(created!.assignedUserId, admin.userId);
    assert.equal(created!.proofReference, "https://docs.google.com/spreadsheets/d/example");
    assert.equal(created!.templateKey, "seo_keyword_research");
    assert.ok(created!.recurrenceRule, "recurrenceRule should be set");
    assert.equal((created!.recurrenceRule as any).frequency, "monthly");
    console.log("[internal-delivery-tasks] list + field verification passed");

    // ── Regular listTasks should NOT include internal tasks ───
    const regularTasks = await tasksService.listTasks(admin.clinicId);
    assert.ok(
      !regularTasks.some((t) => t.id === taskId),
      "Internal task should NOT appear in regular task list (is_internal separation)",
    );
    console.log("[internal-delivery-tasks] is_internal separation passed");

    // ── Update ────────────────────────────────────────────────
    await tasksService.updateInternalTask(admin.clinicId, admin.userId, taskId, {
      title: "Updated keyword research doc",
      priority: "medium",
      status: "completed",
      proofReference: "https://docs.google.com/spreadsheets/d/updated",
    });
    const afterUpdate = await tasksService.listInternalTasks(admin.clinicId, {});
    const updated = afterUpdate.find((t) => t.id === taskId);
    assert.ok(updated, "Updated task should still appear");
    assert.equal(updated!.title, "Updated keyword research doc");
    assert.equal(updated!.priority, "medium");
    assert.equal(updated!.status, "completed");
    assert.ok(updated!.completedAt, "completedAt should be set when status is completed");
    assert.equal(updated!.proofReference, "https://docs.google.com/spreadsheets/d/updated");
    assert.equal(updated!.boardKey, "seo", "Unchanged fields should persist");
    console.log("[internal-delivery-tasks] update passed");

    const recurringTasks = await tasksService.listInternalTasks(admin.clinicId, { workflowMonth: "2026-07-01" });
    const nextOccurrence = recurringTasks.find((t) => t.templateKey === "seo_keyword_research");
    assert.ok(nextOccurrence, "Completing a recurring task should generate the next monthly occurrence");
    assert.equal(nextOccurrence!.status, "pending");
    assert.equal(nextOccurrence!.workflowMonth, "2026-07-01");
    assert.equal(nextOccurrence!.dueDate, "2026-07-30");
    assert.equal(nextOccurrence!.clientAccountProfileId, profileId);
    assert.equal(nextOccurrence!.clientAccountServiceId, serviceId);

    const duplicateAttempt = await tasksService.generateNextOccurrence(taskId);
    assert.equal(duplicateAttempt, null, "Generating the same recurrence twice should not create duplicates");
    const recurringTasksAfterDuplicateAttempt = await tasksService.listInternalTasks(admin.clinicId, { workflowMonth: "2026-07-01" });
    assert.equal(
      recurringTasksAfterDuplicateAttempt.filter((t) => t.templateKey === "seo_keyword_research").length,
      1,
      "Only one next monthly occurrence should exist",
    );
    const backgroundGeneratedCount = await tasksService.processAllRecurringTasks();
    assert.equal(backgroundGeneratedCount, 0, "Background recurrence generation should not duplicate existing next occurrences");
    console.log("[internal-delivery-tasks] monthly recurrence generation passed");

    // ── QA Update ─────────────────────────────────────────────
    await tasksService.updateInternalTaskQa(admin.clinicId, admin.userId, taskId, {
      needsQa: true,
      qaChecklist: { items: ["Check keyword volume", "Verify intent"] },
      approvalStatus: "pending",
      reviewerUserId: admin.userId,
      completionProofReference: "https://screenshot.example.com/proof.png",
      missedTask: false,
      escalationFlag: true,
      freelancerTeamScore: 8.5,
    });
    const afterQa = await tasksService.listInternalTasks(admin.clinicId, {});
    const qaTask = afterQa.find((t) => t.id === taskId);
    assert.ok(qaTask, "Task should still appear after QA update");
    assert.equal(qaTask!.needsQa, true);
    assert.ok(qaTask!.qaChecklist, "qaChecklist should be set");
    assert.equal((qaTask!.qaChecklist as any).items.length, 2);
    assert.equal(qaTask!.approvalStatus, "pending");
    assert.equal(qaTask!.reviewerUserId, admin.userId);
    assert.equal(qaTask!.completionProofReference, "https://screenshot.example.com/proof.png");
    assert.equal(qaTask!.missedTask, false);
    assert.equal(qaTask!.escalationFlag, true);
    assert.equal(qaTask!.freelancerTeamScore, 8.5);
    assert.ok(qaTask!.qaUpdatedAt, "qaUpdatedAt should be set");
    console.log("[internal-delivery-tasks] QA update passed");

    const invalidQaResponse = await fetchJson(
      baseUrl,
      `/api/tasks/internal/${taskId}/qa`,
      admin.token,
      {
        method: "PATCH",
        body: JSON.stringify({ qaChecklist: { items: [{ checked: true }] } }),
      },
    );
    assert.equal(invalidQaResponse.response.status, 400);
    console.log("[internal-delivery-tasks] invalid QA checklist rejected passed");

    const needsChangesResponse = await fetchJson(
      baseUrl,
      `/api/tasks/internal/${taskId}/qa`,
      admin.token,
      {
        method: "PATCH",
        body: JSON.stringify({
          qaChecklist: {
            items: [
              { label: "Proof link opens", checked: true, status: "passed" },
              { label: "Keyword intent reviewed", checked: false, status: "needs_changes", notes: "Clarify commercial intent" },
            ],
          },
          approvalStatus: "needs_changes",
          missedTask: true,
          escalationFlag: true,
        }),
      },
    );
    assert.equal(needsChangesResponse.response.status, 200);

    const needsChangesList = await tasksService.listInternalTasks(admin.clinicId, { approvalStatus: "needs_changes" });
    assert.ok(needsChangesList.some((t) => t.id === taskId), "approvalStatus=needs_changes filter should match");
    const missedList = await tasksService.listInternalTasks(admin.clinicId, { missedTask: "true" });
    assert.ok(missedList.some((t) => t.id === taskId), "missedTask filter should match");
    console.log("[internal-delivery-tasks] needs changes + missed task filters passed");

    await tasksService.updateInternalTaskQa(admin.clinicId, admin.userId, taskId, {
      approvalStatus: "rejected",
      missedTask: true,
      escalationFlag: true,
    });
    const rejectedList = await tasksService.listInternalTasks(admin.clinicId, { approvalStatus: "rejected" });
    assert.ok(rejectedList.some((t) => t.id === taskId), "approvalStatus=rejected filter should match");

    await tasksService.updateInternalTaskQa(admin.clinicId, admin.userId, taskId, {
      approvalStatus: "approved",
      missedTask: false,
      escalationFlag: true,
    });
    const approvedList = await tasksService.listInternalTasks(admin.clinicId, { approvalStatus: "approved" });
    assert.ok(approvedList.some((t) => t.id === taskId), "approvalStatus=approved filter should match");
    const missedFalseList = await tasksService.listInternalTasks(admin.clinicId, { missedTask: "false" });
    assert.ok(missedFalseList.some((t) => t.id === taskId), "missedTask=false filter should match after clearing flag");
    console.log("[internal-delivery-tasks] rejected/approved QA filters passed");

    // ── List filters ──────────────────────────────────────────
    const needsQaList = await tasksService.listInternalTasks(admin.clinicId, { needsQa: "true" });
    assert.ok(needsQaList.some((t) => t.id === taskId), "needsQa filter should match");

    const escalatedList = await tasksService.listInternalTasks(admin.clinicId, { escalationFlag: "true" });
    assert.ok(escalatedList.some((t) => t.id === taskId), "escalationFlag filter should match");

    const completedList = await tasksService.listInternalTasks(admin.clinicId, { completed: "true" });
    assert.ok(completedList.some((t) => t.id === taskId), "completed filter should match");

    const pendingList = await tasksService.listInternalTasks(admin.clinicId, { completed: "false" });
    assert.ok(!pendingList.some((t) => t.id === taskId), "pending filter should not match completed task");

    const overdueTaskId = await tasksService.createInternalTask(admin.clinicId, admin.userId, {
      title: "Overdue GBP proof upload",
      priority: "high",
      status: "pending",
      boardKey: "gbp",
      serviceType: "gbp",
      clientAccountProfileId: profileId,
      assignedUserId: admin.userId,
      dueDate: "2020-01-01",
      proofReference: "https://drive.example.com/gbp-proof",
      workflowMonth: "2026-06-01",
      templateKey: "gbp_monthly_proof",
      recurrenceRule: { frequency: "monthly", interval: 1 },
    });
    const overdueList = await tasksService.listInternalTasks(admin.clinicId, { overdue: "true" });
    assert.ok(overdueList.some((t) => t.id === overdueTaskId), "overdue filter should match pending task with past due date");
    const notOverdueList = await tasksService.listInternalTasks(admin.clinicId, { overdue: "false" });
    assert.ok(!notOverdueList.some((t) => t.id === overdueTaskId), "overdue=false should exclude pending past-due task");
    console.log("[internal-delivery-tasks] list filters passed");

    // ── Archive ───────────────────────────────────────────────
    await tasksService.archiveInternalTask(admin.clinicId, admin.userId, taskId);

    const afterArchive = await tasksService.listInternalTasks(admin.clinicId, {});
    assert.ok(
      !afterArchive.some((t) => t.id === taskId),
      "Archived task should not appear in default list",
    );

    const withArchived = await tasksService.listInternalTasks(admin.clinicId, { includeArchived: "true" });
    const archivedTask = withArchived.find((t) => t.id === taskId);
    assert.ok(archivedTask, "Archived task should appear when includeArchived=true");
    assert.ok(archivedTask!.archivedAt, "archivedAt should be set");
    console.log("[internal-delivery-tasks] archive + hidden from active list passed");

    // ── Audit events ──────────────────────────────────────────
    const [auditRows]: any = await pool.execute(
      `SELECT action FROM audit_log
       WHERE clinic_id = ? AND entity_type = 'task' AND entity_id = ?
       ORDER BY created_at ASC`,
      [admin.clinicId, taskId],
    );
    const actions = auditRows.map((r: any) => r.action);
    assert.ok(actions.includes("INTERNAL_TASK_CREATED"), "Audit should include INTERNAL_TASK_CREATED");
    assert.ok(actions.includes("INTERNAL_TASK_UPDATED"), "Audit should include INTERNAL_TASK_UPDATED");
    assert.ok(actions.includes("INTERNAL_TASK_QA_UPDATED"), "Audit should include INTERNAL_TASK_QA_UPDATED");
    assert.ok(actions.includes("INTERNAL_TASK_ARCHIVED"), "Audit should include INTERNAL_TASK_ARCHIVED");
    const [recurrenceAuditRows]: any = await pool.execute(
      `SELECT action FROM audit_log
       WHERE clinic_id = ? AND entity_type = 'task' AND action = 'INTERNAL_TASK_RECURRENCE_GENERATED'
       ORDER BY created_at DESC
       LIMIT 1`,
      [admin.clinicId],
    );
    assert.equal(recurrenceAuditRows.length, 1, "Audit should include INTERNAL_TASK_RECURRENCE_GENERATED");
    console.log("[internal-delivery-tasks] audit logging passed");

    // ── Tenant isolation ──────────────────────────────────────
    const other = await createClinicAndAdmin("InternalTasksOther");
    const otherTasks = await tasksService.listInternalTasks(other.clinicId, { includeArchived: "true" });
    assert.ok(
      !otherTasks.some((t) => t.id === taskId),
      "Other clinic should not see this clinic's internal tasks",
    );
    console.log("[internal-delivery-tasks] tenant isolation passed");
  } finally {
    await pool.execute(`DELETE FROM audit_log WHERE clinic_id = ? AND entity_type = 'task'`, [admin.clinicId]);
    await pool.execute(`DELETE FROM audit_log WHERE clinic_id = ? AND entity_type = 'client_account_service'`, [admin.clinicId]);
    await pool.execute(`DELETE FROM task WHERE clinic_id = ?`, [admin.clinicId]);
    await pool.execute(`DELETE FROM client_account_service WHERE clinic_id = ?`, [admin.clinicId]);
    await pool.execute(
      `UPDATE contact
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND email LIKE ?
         AND deleted_at IS NULL`,
      [admin.clinicId, "InternalTasks_patient_%@test.com"],
    );
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }

  console.log("[internal-delivery-tasks] integration test completed successfully");
});
