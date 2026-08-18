import assert from "node:assert/strict";
import { after, test } from "node:test";
import { v4 as uuidv4 } from "uuid";
import pool, { testConnection } from "../config/database.js";
import { getDemoSeedProductionIssues } from "../config/index.js";
import { authService } from "../modules/auth/auth.service.js";
import { hashPassword } from "../utils/helpers.js";

after(async () => {
  await pool.end();
});

test("production config blocks demo seed variables", () => {
  const issues = getDemoSeedProductionIssues({
    DEMO_SEED_SQL: "backend/seeds/legacy.sql",
    DEMO_SEED_PASSWORD: "not-for-production",
    DEMO_SEED_REMOVE_CONFIRM: "REMOVE_MISSION_CONTROL_DEMO",
  } as NodeJS.ProcessEnv);

  assert.equal(issues.length, 1);
  assert.match(issues[0] || "", /Demo seed variables must not be configured in production/);
  assert.match(issues[0] || "", /DEMO_SEED_SQL/);
  assert.match(issues[0] || "", /DEMO_SEED_PASSWORD/);
});

test("auth serializes demo data state and preserves tenant separation", async () => {
  await testConnection();

  const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const demoClinicId = uuidv4();
  const liveClinicId = uuidv4();
  const userId = uuidv4();
  const email = `cg015_demo_${suffix}@test.com`;
  const password = "password123";
  const passwordHash = await hashPassword(password);

  try {
    await pool.execute(
      `INSERT INTO clinic
        (id, name, email, phone, timezone, subscription_plan, subscription_status,
         data_state, data_state_label, is_demo, demo_seed_key, max_users)
       VALUES
        (?, 'Mission Control Fictional Demo', ?, '555-0199', 'Europe/London',
         'professional', 'active', 'demo', 'FICTIONAL DEMO - not production client data', 1,
         'cg015-test-demo', 20),
        (?, 'Mission Control Live Workspace', ?, '555-0200', 'Europe/London',
         'professional', 'active', 'live', 'Live workspace data', 0, NULL, 20)`,
      [demoClinicId, email, liveClinicId, `live_${email}`],
    );

    await pool.execute(
      `INSERT INTO user
        (id, clinic_id, email, password_hash, first_name, last_name, role,
         email_verified_at, status, is_active)
       VALUES (?, ?, ?, ?, 'CG015', 'Demo', 'SUPER_ADMIN', CURRENT_TIMESTAMP, 'active', 1)`,
      [userId, demoClinicId, email, passwordHash],
    );

    await pool.execute(
      `INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
       VALUES (?, ?, 'SUPER_ADMIN', 'active', 1)`,
      [userId, demoClinicId],
    );

    const login = await authService.login({ email, password, rememberMe: false });
    assert.equal(login.user.clinicDataState, "demo");
    assert.equal(login.user.clinicDataStateLabel, "FICTIONAL DEMO - not production client data");
    assert.equal(login.user.clinicIsDemo, true);

    const session = await authService.getCurrentSession(userId, demoClinicId);
    assert.equal(session.user.clinicDataState, "demo");
    assert.equal(session.clinics?.[0]?.dataState, "demo");
    assert.equal(session.clinics?.[0]?.isDemo, true);

    await assert.rejects(
      () => authService.switchClinic(userId, { clinicId: liveClinicId }),
      (error: any) => error?.statusCode === 403,
    );
  } finally {
    await pool.execute("DELETE FROM audit_log WHERE user_id = ? OR clinic_id IN (?, ?)", [
      userId,
      demoClinicId,
      liveClinicId,
    ]);
    await pool.execute("DELETE FROM tokens WHERE user_id = ?", [userId]);
    await pool.execute("DELETE FROM clinic_membership WHERE user_id = ? OR clinic_id IN (?, ?)", [
      userId,
      demoClinicId,
      liveClinicId,
    ]);
    await pool.execute("DELETE FROM user WHERE id = ? OR clinic_id IN (?, ?)", [
      userId,
      demoClinicId,
      liveClinicId,
    ]);
    await pool.execute("DELETE FROM clinic WHERE id IN (?, ?)", [demoClinicId, liveClinicId]);
  }
});
