import { authService } from "../modules/auth/auth.service.js";
import { teamService } from "../modules/team/team.service.js";
import { testConnection } from "../config/database.js";
import pool from "../config/database.js";
import { hashPassword } from "../utils/helpers.js";
import logger from "../utils/logger.js";
import { v4 as uuidv4 } from "uuid";

async function createInternalTestUser(clinicId: string, email: string, role = "SALES") {
  const userId = uuidv4();
  const passwordHash = await hashPassword("password123");

  await pool.execute(
    "INSERT INTO user (id, clinic_id, email, password_hash, first_name, last_name, role, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
    [userId, clinicId, email, passwordHash, "Internal", "User", role],
  );

  await pool.execute(
    "INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary) VALUES (?, ?, ?, 'active', 1)",
    [userId, clinicId, role],
  );

  return userId;
}

async function runTest() {
  try {
    logger.info("========================================");
    logger.info("  TEAM MODULE TESTS");
    logger.info("========================================");
    await testConnection();

    // ─── Setup: Create a fresh clinic + admin ───
    const testEmail = `team_admin_${Date.now()}@test.com`;
    const regResult = await authService.registerClinic({
      clinicName: "Team Test Workspace",
      adminEmail: testEmail,
      adminPassword: "password123",
      firstName: "Team",
      lastName: "Admin",
      phone: "555-0100",
    });
    const clinicId = regResult.user.clinicId;
    const adminUserId = regResult.user.id;
    logger.info(`✅ Setup: Clinic created (${clinicId})`);

    // ─── Test 1: Invite Members ───
    logger.info("\n--- Test 1: Invite Members ---");
    const inviteEmails = [
      `team1_${Date.now()}@test.com`,
      `team2_${Date.now()}@test.com`,
    ];
    await teamService.inviteMembers(clinicId, adminUserId, {
      emails: inviteEmails,
      role: "SALES",
    });
    logger.info("✅ Invitations sent successfully");

    // ─── Test 2: Get Team Members (should show admin + 2 pending invites) ───
    logger.info("\n--- Test 2: Get Team Members ---");
    const members = await teamService.getTeamMembers(clinicId);
    const activeCount = members.filter((m) => !m.isInvitation).length;
    const pendingCount = members.filter((m) => m.isInvitation).length;
    console.log(`  Active members: ${activeCount}`);
    console.log(`  Pending invites: ${pendingCount}`);

    if (activeCount >= 1 && pendingCount === 2) {
      logger.info("✅ Team listing correct");
    } else {
      logger.error(`❌ Expected 1+ active and 2 pending, got ${activeCount} active and ${pendingCount} pending`);
    }

    // ─── Test 3: Duplicate invitation should be skipped ───
    logger.info("\n--- Test 3: Duplicate Invite (should skip) ---");
    await teamService.inviteMembers(clinicId, adminUserId, {
      emails: [testEmail], // admin email already exists
      role: "SALES",
    });
    const membersAfterDupe = await teamService.getTeamMembers(clinicId);
    const pendingAfterDupe = membersAfterDupe.filter((m) => m.isInvitation).length;
    if (pendingAfterDupe === pendingCount) {
      logger.info("✅ Duplicate invite correctly skipped");
    } else {
      logger.error("❌ Duplicate was not skipped");
    }

    // ─── Test 4: Update Member Role ───
    logger.info("\n--- Test 4: Update Member Role ---");
    const roleTargetEmail = `role_target_${Date.now()}@test.com`;
    const roleTargetUserId = await createInternalTestUser(clinicId, roleTargetEmail);
    await teamService.updateMemberRole(
      clinicId,
      adminUserId,
      roleTargetUserId,
      "ADMIN",
    );
    const membersAfterRole = await teamService.getTeamMembers(clinicId);
    const updatedUser = membersAfterRole.find((m) => m.id === roleTargetUserId);
    if (updatedUser?.role === "ADMIN") {
      logger.info("✅ Role updated to ADMIN");
    } else {
      logger.error(`❌ Expected role ADMIN, got ${updatedUser?.role}`);
    }

    // ─── Test 5: Remove Member (soft delete) ───
    logger.info("\n--- Test 5: Remove Member ---");
    // Create a second user to remove
    const teamMemberEmail = `removable_${Date.now()}@test.com`;
    const teamMemberUserId = await createInternalTestUser(clinicId, teamMemberEmail);
    await teamService.removeMember(clinicId, adminUserId, teamMemberUserId);
    const membersAfterRemove = await teamService.getTeamMembers(clinicId);
    const removedStillExists = membersAfterRemove.find((m) => m.id === teamMemberUserId);
    if (!removedStillExists) {
      logger.info("✅ Member removed (soft deleted) successfully");
    } else {
      logger.error("❌ Member still appears after removal");
    }

    // ─── Test 6: Remove non-existent member should fail ───
    logger.info("\n--- Test 6: Remove Non-Existent Member ---");
    try {
      await teamService.removeMember(clinicId, adminUserId, "non-existent-uuid");
      logger.error("❌ Should have thrown an error");
    } catch (err: any) {
      if (err.statusCode === 404) {
        logger.info("✅ Correctly threw 404 for non-existent member");
      } else {
        logger.error(`❌ Wrong error: ${err.message}`);
      }
    }

    logger.info("\n========================================");
    logger.info("  TEAM TESTS COMPLETE");
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
