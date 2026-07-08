import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { v4 as uuidv4 } from "uuid";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";
import { tasksService } from "../modules/tasks/tasks.service.js";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
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

async function fetchJson(baseUrl: string, path: string, token: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const body: any = await response.json();
  assert.equal(response.ok, true, `Expected ${path} to return success, got ${response.status}`);
  assert.equal(body.status, "success");
  return body.data;
}

async function sendJson(baseUrl: string, path: string, token: string, method: "POST" | "PATCH", body?: unknown) {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  const response = await fetch(`${baseUrl}${path}`, init);
  const payload: any = await response.json();
  assert.equal(response.ok, true, `Expected ${method} ${path} to return success, got ${response.status}`);
  assert.equal(payload.status, "success");
  return payload.data;
}

test("monthly action plans generate from active insights and tasks without cross-tenant leakage", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("MonthlyPlanPrimary");
  const secondary = await createClinicAndAdmin("MonthlyPlanSecondary");
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start monthly action plan test server");
  }

  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
  const month = currentMonth();
  const insightId = uuidv4();
  const actionTaskId = await tasksService.createTask(primary.clinicId, primary.userId, {
    title: "Revenue insight follow-up",
    description: "Call the missed consult leads and recover bookings.",
    priority: "high",
    category: "Revenue insight",
    dueDate: `${month}-20`,
  });
  const standaloneTaskId = await tasksService.createTask(primary.clinicId, primary.userId, {
    title: "Consult conversion action review",
    description: "Review open consult follow-up before month end.",
    priority: "medium",
    category: "Revenue action",
    dueDate: `${month}-21`,
  });

  try {
    await pool.execute(
      `INSERT INTO insight
        (id, clinic_id, type, severity, title, summary, recommended_action,
         source_type, source_id, action_task_id, status, generated_from, dedupe_key, created_by)
       VALUES (?, ?, 'missed_call_recovery', 'high', ?, ?, ?, 'call', ?, ?, 'open', 'test', ?, ?)`,
      [
        insightId,
        primary.clinicId,
        "Recover missed high-value calls",
        "Missed calls are still open and need owner follow-up.",
        "Call missed leads and confirm whether a consult should be booked.",
        actionTaskId,
        actionTaskId,
        `monthly-plan-test:${insightId}`,
        primary.userId,
      ],
    );

    const emptyBeforeGenerate = await fetchJson(
      baseUrl,
      `/api/monthly-action-plans?month=${month}`,
      primary.token,
    );
    assert.equal(emptyBeforeGenerate, null);

    const generated = await sendJson(
      baseUrl,
      "/api/monthly-action-plans/generate",
      primary.token,
      "POST",
      { month },
    );
    assert.equal(generated.generatedCount, 2);
    assert.equal(generated.existingCount, 0);
    assert.equal(generated.plan.planMonth, month);
    assert.equal(generated.plan.status, "active");
    assert.equal(generated.plan.stats.totalItems, 2);
    assert.equal(generated.plan.stats.highPriorityItems, 1);
    assert.equal(generated.plan.items.some((item: any) => item.insightId === insightId), true);
    assert.equal(generated.plan.items.some((item: any) => item.taskId === standaloneTaskId), true);

    const regenerated = await sendJson(
      baseUrl,
      "/api/monthly-action-plans/generate",
      primary.token,
      "POST",
      { month },
    );
    assert.equal(regenerated.generatedCount, 0);
    assert.equal(regenerated.existingCount, 2);
    assert.equal(regenerated.plan.stats.totalItems, 2);

    const linkedItem = regenerated.plan.items.find((item: any) => item.taskId === actionTaskId);
    assert.ok(linkedItem);
    await sendJson(
      baseUrl,
      `/api/monthly-action-plans/${regenerated.plan.id}/items/${linkedItem.id}/status`,
      primary.token,
      "PATCH",
      { status: "completed" },
    );

    const [tasks]: any = await pool.execute(
      "SELECT status FROM task WHERE id = ? AND clinic_id = ?",
      [actionTaskId, primary.clinicId],
    );
    assert.equal(tasks[0].status, "completed");

    await sendJson(
      baseUrl,
      `/api/monthly-action-plans/${regenerated.plan.id}/status`,
      primary.token,
      "PATCH",
      { status: "completed" },
    );
    const completedPlan = await fetchJson(
      baseUrl,
      `/api/monthly-action-plans?month=${month}`,
      primary.token,
    );
    assert.equal(completedPlan.status, "completed");

    const secondaryPlan = await fetchJson(
      baseUrl,
      `/api/monthly-action-plans?month=${month}`,
      secondary.token,
    );
    assert.equal(secondaryPlan, null);
  } finally {
    await pool.execute("DELETE FROM monthly_action_plan_item WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM monthly_action_plan WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM insight WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("DELETE FROM task WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await pool.end();
  }
});
