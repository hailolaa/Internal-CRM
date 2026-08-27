import assert from "node:assert/strict";
import test from "node:test";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

test("Mission Control login requires an active internal user and active clinic membership", async () => {
  await testConnection();
  const active = await createTestClinicAndAdmin("AuthAccessActive");
  const inactiveUser = await createTestClinicAndAdmin("AuthAccessInactiveUser");
  const inactiveMembership = await createTestClinicAndAdmin("AuthAccessInactiveMembership");
  const missingMembership = await createTestClinicAndAdmin("AuthAccessMissingMembership");
  const clinics = [active, inactiveUser, inactiveMembership, missingMembership];

  try {
    const [activeRows]: any = await pool.execute("SELECT email FROM user WHERE id = ?", [active.userId]);
    const allowed = await authService.login({
      email: activeRows[0].email,
      password: "password123",
      rememberMe: false,
    });
    assert.ok(allowed.tokens.token);

    await pool.execute("UPDATE user SET status = 'inactive', is_active = 0 WHERE id = ?", [inactiveUser.userId]);
    await pool.execute(
      "UPDATE clinic_membership SET status = 'inactive' WHERE user_id = ? AND clinic_id = ?",
      [inactiveMembership.userId, inactiveMembership.clinicId],
    );
    await pool.execute(
      "DELETE FROM clinic_membership WHERE user_id = ? AND clinic_id = ?",
      [missingMembership.userId, missingMembership.clinicId],
    );

    for (const account of [inactiveUser, inactiveMembership, missingMembership]) {
      const [rows]: any = await pool.execute("SELECT email FROM user WHERE id = ?", [account.userId]);
      await assert.rejects(
        () => authService.login({
          email: rows[0].email,
          password: "password123",
          rememberMe: false,
        }),
        (error: any) => error?.statusCode === 401,
      );
      const [tokenRows]: any = await pool.execute(
        "SELECT COUNT(*) as total FROM tokens WHERE user_id = ? AND token_type = 'refresh'",
        [account.userId],
      );
      assert.equal(Number(tokenRows[0].total), 0, "denied users must not receive refresh sessions");
    }

    await assert.rejects(
      () => authService.registerPatient({} as any),
      (error: any) => error?.statusCode === 403 && /self-registration is disabled/i.test(error.message),
    );
  } finally {
    const clinicIds = clinics.map((entry) => entry.clinicId);
    const userIds = clinics.map((entry) => entry.userId);
    await pool.query("DELETE FROM tokens WHERE user_id IN (?)", [userIds]);
    await pool.query("DELETE FROM audit_log WHERE clinic_id IN (?)", [clinicIds]);
    await pool.query("DELETE FROM clinic_membership WHERE clinic_id IN (?)", [clinicIds]);
    await pool.query("DELETE FROM user WHERE clinic_id IN (?)", [clinicIds]);
    await pool.query("DELETE FROM clinic WHERE id IN (?)", [clinicIds]);
  }
});
