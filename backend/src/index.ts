import app from "./app.js";
import { config, getProductionConfigIssues } from "./config/index.js";
import { testConnection } from "./config/database.js";
import logger from "./utils/logger.js";
import { backgroundJobsScheduler } from "./modules/background-jobs/background-jobs.scheduler.js";


async function startServer() {
    try {
        await testConnection();
        const configIssues = getProductionConfigIssues();
        configIssues.warnings.forEach((warning) => {
            logger.warn("Production configuration warning", { warning });
        });

        if (config.nodeEnv === "production" && configIssues.issues.length > 0) {
            logger.error("Production configuration is not safe to start", {
                issues: configIssues.issues,
            });
            process.exit(1);
        }

        app.listen(config.port, () => {
            logger.info("Server started", {
                environment: config.nodeEnv,
                port: config.port,
                frontendUrl: config.frontendUrl,
                apiPublicUrl: config.apiPublicUrl,
                oauthCallbackBaseUrl: config.oauthCallbackBaseUrl,
                corsOrigins: config.cors.allowedOrigins,
            });
        });

        await backgroundJobsScheduler.start();
    process.on("unhandledRejection", (err: any) => {
        logger.error("unhandled Rejection", { message: err.message, stack: err.stack});
        process.exit(1);
    });

    process.on("uncaughtException", (err: any) => {
        logger.error("uncaught Exception", { message: err.message, stack: err.stack});
        process.exit(1);
    });

    process.on("SIGTERM", () => {
        backgroundJobsScheduler.stop();
        process.exit(0);
    });

    process.on("SIGINT", () => {
        backgroundJobsScheduler.stop();
        process.exit(0);
    });
    } catch (error: any) {
        logger.error("Failed to start server: ", { message: error.message, stack: error.stack});
        process.exit(1);
    }
}    

startServer();
