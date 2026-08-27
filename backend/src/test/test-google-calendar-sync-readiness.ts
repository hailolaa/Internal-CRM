import assert from "node:assert/strict";
import test from "node:test";
import { v4 as uuidv4 } from "uuid";
import pool, { testConnection } from "../config/database.js";
import { calendarService } from "../modules/calendar/calendar.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

test("Google Calendar sync retries transient reads and audits exhausted failures", async () => {
  await testConnection();
  const workspace = await createTestClinicAndAdmin("CalendarReadiness");
  const integrationId = uuidv4();
  await pool.execute(
    `INSERT INTO integration
      (id, clinic_id, name, type, config, is_active, setup_status, health_status)
     VALUES (?, ?, 'Google Calendar', 'google_calendar', '{}', 1, 'ready', 'healthy')`,
    [integrationId, workspace.clinicId],
  );

  const service = calendarService as any;
  const originalGetAccessToken = service.getAccessToken;
  const originalFetch = globalThis.fetch;

  try {
    service.getAccessToken = async () => "calendar-test-token";
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts += 1;
      if (attempts === 1) return new Response(JSON.stringify({ error: { message: "temporary" } }), { status: 503 });
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    };

    const success = await calendarService.syncUpcoming(workspace.clinicId, workspace.userId);
    assert.deepEqual(success, { synced: 0 });
    assert.equal(attempts, 2);

    attempts = 0;
    globalThis.fetch = async () => {
      attempts += 1;
      return new Response(JSON.stringify({ error: { message: "provider unavailable" } }), { status: 503 });
    };
    await assert.rejects(
      calendarService.syncUpcoming(workspace.clinicId, workspace.userId),
      /provider unavailable/,
    );
    assert.equal(attempts, 3);

    const [integrationRows]: any = await pool.execute(
      `SELECT last_sync_status as lastSyncStatus, last_sync_error as lastSyncError,
              health_status as healthStatus
       FROM integration WHERE id = ? AND clinic_id = ?`,
      [integrationId, workspace.clinicId],
    );
    assert.equal(integrationRows[0].lastSyncStatus, "failed");
    assert.equal(integrationRows[0].healthStatus, "error");
    assert.match(integrationRows[0].lastSyncError, /provider unavailable/);

    const [auditRows]: any = await pool.execute(
      `SELECT action FROM audit_log
       WHERE clinic_id = ? AND entity_id = ? AND action IN ('GOOGLE_CALENDAR_SYNC_COMPLETED', 'GOOGLE_CALENDAR_SYNC_FAILED')
       ORDER BY created_at ASC`,
      [workspace.clinicId, integrationId],
    );
    assert.deepEqual(auditRows.map((row: any) => row.action), [
      "GOOGLE_CALENDAR_SYNC_COMPLETED",
      "GOOGLE_CALENDAR_SYNC_FAILED",
    ]);
  } finally {
    service.getAccessToken = originalGetAccessToken;
    globalThis.fetch = originalFetch;
    await pool.end();
  }
});
