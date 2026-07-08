import { authService } from "../modules/auth/auth.service.js";
import { locationsService } from "../modules/locations/locations.service.js";
import { testConnection } from "../config/database.js";
import pool from "../config/database.js";
import logger from "../utils/logger.js";

async function runTest() {
  try {
    logger.info("========================================");
    logger.info("  LOCATIONS MODULE TESTS");
    logger.info("========================================");
    await testConnection();

    // ─── Setup: Create a fresh clinic + admin ───
    const testEmail = `loc_admin_${Date.now()}@test.com`;
    const regResult = await authService.registerClinic({
      clinicName: "Locations Test Clinic",
      adminEmail: testEmail,
      adminPassword: "password123",
      firstName: "Location",
      lastName: "Admin",
      phone: "555-0200",
    });
    const clinicId = regResult.user.clinicId;
    const userId = regResult.user.id;
    logger.info(`✅ Setup: Clinic created (${clinicId})`);

    // ─── Test 1: Create a primary location ───
    logger.info("\n--- Test 1: Create Primary Location ---");
    const primaryId = await locationsService.createLocation(clinicId, {
      name: "Main Branch",
      address: "123 High Street, London",
      city: "London",
      state: "England",
      postalCode: "SW1A 1AA",
      country: "UK",
      phone: "020-7946-0958",
      email: "main@testclinic.com",
      roomCount: 5,
      isPrimary: true,
      status: "active",
    });
    console.log(`  Location ID: ${primaryId}`);
    logger.info("✅ Primary location created");

    // ─── Test 2: Create a secondary location ───
    logger.info("\n--- Test 2: Create Secondary Location ---");
    const secondaryId = await locationsService.createLocation(clinicId, {
      name: "Chelsea Branch",
      address: "456 Kings Road, Chelsea",
      city: "London",
      postalCode: "SW3 5UZ",
      country: "UK",
      roomCount: 3,
      isPrimary: false,
      status: "active",
    });
    logger.info("✅ Secondary location created");

    // ─── Test 3: List locations (should return 2, primary first) ───
    logger.info("\n--- Test 3: List Locations ---");
    const locations = await locationsService.getLocations(clinicId);
    console.log(`  Total locations: ${locations.length}`);
    console.log(`  First location: ${locations[0]?.name} (isPrimary: ${locations[0]?.isPrimary})`);

    if (locations.length === 2 && locations[0]!.isPrimary === true) {
      logger.info("✅ Listing correct — primary sorts first");
    } else {
      logger.error(`❌ Expected 2 locations with primary first, got ${locations.length}`);
    }

    // ─── Test 4: Staff count should be 0 initially ───
    logger.info("\n--- Test 4: Staff Count ---");
    if (locations[0]!.staffCount === 0) {
      logger.info("✅ Staff count is 0 (no assignments yet)");
    } else {
      logger.error(`❌ Expected staffCount 0, got ${locations[0]!.staffCount}`);
    }

    // ─── Test 5: Assign staff to a location ───
    logger.info("\n--- Test 5: Assign Staff to Location ---");
    await pool.execute(
      "INSERT INTO user_location (user_id, location_id) VALUES (?, ?)",
      [userId, primaryId]
    );
    const locationsAfterAssign = await locationsService.getLocations(clinicId);
    const primaryLoc = locationsAfterAssign.find((l) => l.id === primaryId);
    console.log(`  Primary staff count: ${primaryLoc?.staffCount}`);
    if (primaryLoc && Number(primaryLoc.staffCount) === 1) {
      logger.info("✅ Staff count updated to 1");
    } else {
      logger.error(`❌ Expected staffCount 1, got ${primaryLoc?.staffCount}`);
    }

    // ─── Test 6: Update location ───
    logger.info("\n--- Test 6: Update Location ---");
    await locationsService.updateLocation(clinicId, secondaryId, {
      name: "Chelsea Premium Branch",
      roomCount: 8,
      status: "active",
    });
    const locationsAfterUpdate = await locationsService.getLocations(clinicId);
    const updatedLoc = locationsAfterUpdate.find((l) => l.id === secondaryId);
    if (updatedLoc?.name === "Chelsea Premium Branch" && Number(updatedLoc?.roomCount) === 8) {
      logger.info("✅ Location updated successfully");
    } else {
      logger.error(`❌ Update failed. Name: ${updatedLoc?.name}, Rooms: ${updatedLoc?.roomCount}`);
    }

    // ─── Test 7: Update non-existent location should fail ───
    logger.info("\n--- Test 7: Update Non-Existent Location ---");
    try {
      await locationsService.updateLocation(clinicId, "fake-uuid-12345", { name: "Ghost" });
      logger.error("❌ Should have thrown an error");
    } catch (err: any) {
      if (err.statusCode === 404) {
        logger.info("✅ Correctly threw 404");
      } else {
        logger.error(`❌ Wrong error: ${err.message}`);
      }
    }

    // ─── Test 8: Delete location (soft delete) ───
    logger.info("\n--- Test 8: Delete Location ---");
    await locationsService.deleteLocation(clinicId, secondaryId);
    const locationsAfterDelete = await locationsService.getLocations(clinicId);
    if (locationsAfterDelete.length === 1) {
      logger.info("✅ Location soft-deleted (only 1 remaining)");
    } else {
      logger.error(`❌ Expected 1 location after delete, got ${locationsAfterDelete.length}`);
    }

    // ─── Test 9: Multi-tenant isolation ───
    logger.info("\n--- Test 9: Multi-Tenant Isolation ---");
    const otherEmail = `other_clinic_${Date.now()}@test.com`;
    const otherReg = await authService.registerClinic({
      clinicName: "Other Clinic",
      adminEmail: otherEmail,
      adminPassword: "password123",
      firstName: "Other",
      lastName: "Admin",
    });
    const otherClinicId = otherReg.user.clinicId;
    const otherLocations = await locationsService.getLocations(otherClinicId);
    if (otherLocations.length === 0) {
      logger.info("✅ Other clinic sees 0 locations (isolation works)");
    } else {
      logger.error(`❌ Other clinic sees ${otherLocations.length} locations — DATA LEAK!`);
    }

    logger.info("\n========================================");
    logger.info("  LOCATIONS TESTS COMPLETE");
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
