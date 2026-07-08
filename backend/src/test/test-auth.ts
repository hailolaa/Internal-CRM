import { authService } from "../modules/auth/auth.service.js";
import { testConnection } from "../config/database.js";
import logger from "../utils/logger.js";

// direct service test

async function runTest() {
    try {
        logger.info("Starting Database & Auth Logic Test....");
        await testConnection();


        // Test: Clinic + Admin Registration
        const testEmail = `admin_${Date.now()}@test.com`;
        logger.info(`Registering a new clinic with email: ${testEmail}...`);

        const regResult = await authService.registerClinic({
            clinicName: `Health Test Center`,
            adminEmail: testEmail,
            adminPassword: 'password123',
            firstName: 'Jhon',
            lastName: 'Doe',
            phone: '555-0199'
        });
        
        logger.info("Registration Successful");
        console.log("User ID:", regResult.user.id);



        // Test: Login
        logger.info("Testing Login with the new account...");
        const loginResult = await authService.login({
            email: testEmail,
            password: "password123",
            rememberMe: true
        });

        logger.info("Login Successful!");
        console.log("JWT Token Generated: ", loginResult.tokens.requires2FA);
    } catch (error: any) {
        logger.error("Test Failed!");
        logger.error(`Error: ${error.message}`);
    } finally {
        process.exit();
    }
        
}

runTest();
