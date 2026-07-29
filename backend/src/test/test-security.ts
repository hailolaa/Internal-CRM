import assert from "node:assert/strict";
import test from "node:test";
import { generateSync } from "otplib";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";
import { securityService } from "../modules/security/security.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

test("security module supports 2FA setup, backup-code use, disable and password change", async () => {
  await testConnection();

  const testPassword = "password123";
  const admin = await createTestClinicAndAdmin("SecurityModule");

  try {
    const setupResult = await securityService.setup2FA(admin.userId, "Mission Control Test Workspace");
    assert.ok(setupResult.secret);
    assert.ok(setupResult.qrCode.startsWith("data:image/png;base64,"));

    await assert.rejects(
      () => securityService.enable2FA(admin.userId, "000000"),
      (error: any) => error?.statusCode === 401,
    );

    const validToken = generateSync({ secret: setupResult.secret });
    const enableResult = await securityService.enable2FA(admin.userId, validToken);
    assert.equal(enableResult.backupCodes.length, 8);

    await assert.rejects(
      () => securityService.setup2FA(admin.userId, "Mission Control Test Workspace"),
      (error: any) => error?.statusCode === 400,
    );

    assert.equal(await securityService.validate2FA(admin.userId, generateSync({ secret: setupResult.secret })), true);
    assert.equal(await securityService.validate2FA(admin.userId, "999999"), false);

    const backupCode = enableResult.backupCodes[0]!;
    assert.equal(await securityService.validate2FA(admin.userId, backupCode), true);
    assert.equal(await securityService.validate2FA(admin.userId, backupCode), false);

    await assert.rejects(
      () => securityService.disable2FA(admin.userId, "wrongpassword"),
      (error: any) => error?.statusCode === 401,
    );

    await securityService.disable2FA(admin.userId, testPassword);
    assert.equal(await securityService.validate2FA(admin.userId, validToken), false);

    const newPassword = "newSecurePass456";
    await securityService.changePassword(admin.userId, testPassword, newPassword);

    const [userRows]: any = await pool.execute(
      "SELECT email FROM user WHERE id = ? AND clinic_id = ? LIMIT 1",
      [admin.userId, admin.clinicId],
    );
    assert.equal(userRows.length, 1);

    const loginResult = await authService.login({
      email: userRows[0].email,
      password: newPassword,
      rememberMe: false,
    });
    assert.ok(loginResult.tokens.token);

    await assert.rejects(
      () => authService.login({
        email: userRows[0].email,
        password: testPassword,
        rememberMe: false,
      }),
      (error: any) => error?.statusCode === 401,
    );
  } finally {
    await pool.execute("DELETE FROM audit_log WHERE clinic_id = ?", [admin.clinicId]);
    await pool.execute("DELETE FROM clinic_membership WHERE clinic_id = ?", [admin.clinicId]);
    await pool.execute("DELETE FROM user WHERE clinic_id = ?", [admin.clinicId]);
    await pool.execute("DELETE FROM clinic WHERE id = ?", [admin.clinicId]);
    await pool.end();
  }
});
