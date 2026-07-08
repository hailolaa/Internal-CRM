import { authService } from "../modules/auth/auth.service.js";
import { securityService } from "../modules/security/security.service.js";
import { testConnection } from "../config/database.js";
import { generateSync } from "otplib";
import logger from "../utils/logger.js";

async function runTest() {
  try {
    logger.info("========================================");
    logger.info("  SECURITY MODULE TESTS");
    logger.info("========================================");
    await testConnection();

    // ─── Setup: Create a fresh clinic + admin ───
    const testEmail = `sec_admin_${Date.now()}@test.com`;
    const testPassword = "password123";
    const regResult = await authService.registerClinic({
      clinicName: "Security Test Clinic",
      adminEmail: testEmail,
      adminPassword: testPassword,
      firstName: "Security",
      lastName: "Admin",
      phone: "555-0300",
    });
    const userId = regResult.user.id;
    logger.info(`✅ Setup: User created (${userId})`);

    // ═══════════════════════════════════════════
    //  2FA TESTS
    // ═══════════════════════════════════════════

    // ─── Test 1: Setup 2FA — should return secret + QR code ───
    logger.info("\n--- Test 1: Setup 2FA ---");
    const setupResult = await securityService.setup2FA(userId, "Test Clinic");
    console.log(`  Secret length: ${setupResult.secret.length}`);
    console.log(`  QR code starts with: ${setupResult.qrCode.substring(0, 30)}...`);
    if (setupResult.secret && setupResult.qrCode.startsWith("data:image/png;base64,")) {
      logger.info("✅ 2FA setup returned secret and QR code");
    } else {
      logger.error("❌ Missing secret or QR code");
    }

    // ─── Test 2: Enable 2FA with WRONG code — should fail ───
    logger.info("\n--- Test 2: Enable 2FA with Wrong Code ---");
    try {
      await securityService.enable2FA(userId, "000000");
      logger.error("❌ Should have thrown an error");
    } catch (err: any) {
      if (err.statusCode === 401) {
        logger.info("✅ Correctly rejected invalid 2FA code");
      } else {
        logger.error(`❌ Wrong error: ${err.message}`);
      }
    }

    // ─── Test 3: Enable 2FA with CORRECT code ───
    logger.info("\n--- Test 3: Enable 2FA with Correct Code ---");
    const validToken = generateSync({ secret: setupResult.secret });
    console.log(`  Generated TOTP: ${validToken}`);
    const enableResult = await securityService.enable2FA(userId, validToken);
    console.log(`  Backup codes count: ${enableResult.backupCodes.length}`);
    if (enableResult.backupCodes.length === 8) {
      logger.info("✅ 2FA enabled — 8 backup codes generated");
    } else {
      logger.error(`❌ Expected 8 backup codes, got ${enableResult.backupCodes.length}`);
    }

    // ─── Test 4: Setup 2FA again should fail (already enabled) ───
    logger.info("\n--- Test 4: Setup 2FA Again (already enabled) ---");
    try {
      await securityService.setup2FA(userId, "Test Clinic");
      logger.error("❌ Should have thrown an error");
    } catch (err: any) {
      if (err.statusCode === 400) {
        logger.info("✅ Correctly blocked — 2FA already enabled");
      } else {
        logger.error(`❌ Wrong error: ${err.message}`);
      }
    }

    // ─── Test 5: Validate 2FA with correct TOTP ───
    logger.info("\n--- Test 5: Validate 2FA (correct TOTP) ---");
    const loginToken = generateSync({ secret: setupResult.secret });
    const isValid = await securityService.validate2FA(userId, loginToken);
    if (isValid) {
      logger.info("✅ TOTP validation passed");
    } else {
      logger.error("❌ TOTP validation failed for valid token");
    }

    // ─── Test 6: Validate 2FA with wrong code ───
    logger.info("\n--- Test 6: Validate 2FA (wrong code) ---");
    const isInvalid = await securityService.validate2FA(userId, "999999");
    if (!isInvalid) {
      logger.info("✅ Correctly rejected wrong code");
    } else {
      logger.error("❌ Should have rejected wrong code");
    }

    // ─── Test 7: Validate 2FA with backup code ───
    logger.info("\n--- Test 7: Validate with Backup Code ---");
    const backupCode = enableResult.backupCodes[0]!;
    console.log(`  Using backup code: ${backupCode}`);
    const backupValid = await securityService.validate2FA(userId, backupCode);
    if (backupValid) {
      logger.info("✅ Backup code accepted");
    } else {
      logger.error("❌ Backup code was rejected");
    }

    // ─── Test 8: Same backup code should NOT work again ───
    logger.info("\n--- Test 8: Re-use Backup Code (should fail) ---");
    const backupReuse = await securityService.validate2FA(userId, backupCode);
    if (!backupReuse) {
      logger.info("✅ Used backup code correctly rejected on re-use");
    } else {
      logger.error("❌ Used backup code was accepted again!");
    }

    // ─── Test 9: Disable 2FA with wrong password ───
    logger.info("\n--- Test 9: Disable 2FA (wrong password) ---");
    try {
      await securityService.disable2FA(userId, "wrongpassword");
      logger.error("❌ Should have thrown an error");
    } catch (err: any) {
      if (err.statusCode === 401) {
        logger.info("✅ Correctly rejected wrong password");
      } else {
        logger.error(`❌ Wrong error: ${err.message}`);
      }
    }

    // ─── Test 10: Disable 2FA with correct password ───
    logger.info("\n--- Test 10: Disable 2FA (correct password) ---");
    await securityService.disable2FA(userId, testPassword);
    // Verify it's actually disabled by trying to validate
    const afterDisable = await securityService.validate2FA(userId, loginToken);
    if (!afterDisable) {
      logger.info("✅ 2FA disabled — validation correctly fails now");
    } else {
      logger.error("❌ 2FA still validates after disabling");
    }

    // ═══════════════════════════════════════════
    //  PASSWORD CHANGE TESTS
    // ═══════════════════════════════════════════

    // ─── Test 11: Change password with wrong current password ───
    logger.info("\n--- Test 11: Change Password (wrong current) ---");
    try {
      await securityService.changePassword(userId, "wrongpassword", "newpassword123");
      logger.error("❌ Should have thrown an error");
    } catch (err: any) {
      if (err.statusCode === 401) {
        logger.info("✅ Correctly rejected wrong current password");
      } else {
        logger.error(`❌ Wrong error: ${err.message}`);
      }
    }

    // ─── Test 12: Change password with correct current password ───
    logger.info("\n--- Test 12: Change Password (correct current) ---");
    const newPassword = "newSecurePass456";
    await securityService.changePassword(userId, testPassword, newPassword);
    logger.info("✅ Password changed successfully");

    // ─── Test 13: Verify new password works for login ───
    logger.info("\n--- Test 13: Login with New Password ---");
    const loginResult = await authService.login({
      email: testEmail,
      password: newPassword,
      rememberMe: false,
    });
    if (loginResult.tokens.token) {
      logger.info("✅ Login with new password succeeded");
    } else {
      logger.error("❌ Login with new password failed");
    }

    // ─── Test 14: Old password should no longer work ───
    logger.info("\n--- Test 14: Login with Old Password (should fail) ---");
    try {
      await authService.login({
        email: testEmail,
        password: testPassword,
        rememberMe: false,
      });
      logger.error("❌ Old password should have been rejected");
    } catch (err: any) {
      if (err.statusCode === 401) {
        logger.info("✅ Old password correctly rejected");
      } else {
        logger.error(`❌ Wrong error: ${err.message}`);
      }
    }

    logger.info("\n========================================");
    logger.info("  SECURITY TESTS COMPLETE");
    logger.info("========================================");
  } catch (error: any) {
    logger.error("❌ Test Failed!");
    logger.error(`Error: ${error.message}`);
    console.error(error);
  } finally {
    process.exit();
  }
}

runTest();
