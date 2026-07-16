import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieparser from "cookie-parser";

import errorHandler from "./middleware/errorHandler.js";
import { requestContext } from "./middleware/requestContext.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { authenticateApiKey } from "./middleware/apiKeyAuthenticate.js";
import { config } from "./config/index.js";

import authRoutes from "./modules/auth/auth.routes.js";
import contactsRoutes from "./modules/contacts/contacts.routes.js";
import profileRoutes from "./modules/profiles/profiles.routes.js";
import settingsRoutes from "./modules/settings/settings.routes.js";
import healthRoutes from "./modules/health/health.routes.js";
import teamRoutes from "./modules/team/team.routes.js";
import locationsRoutes from "./modules/locations/locations.routes.js";
import billingRoutes from "./modules/billing/billing.routes.js";
import securityRoutes from "./modules/security/security.routes.js"
import auditLogRoutes from "./modules/audit-log/audit-log.routes.js";
import integrationsRoutes from "./modules/integrations/integrations.routes.js";
import insightsRoutes from "./modules/insights/insights.routes.js";
import monthlyActionPlansRoutes from "./modules/monthly-action-plans/monthly-action-plans.routes.js";
import apiKeysRoutes from "./modules/api-keys/api-keys.routes.js";
import treatmentsRoutes from "./modules/treatments/treatments.routes.js";
import pipelineRoutes from "./modules/pipeline/pipeline.routes.js";
import appointmentsRoutes from "./modules/appointments/appointments.routes.js";
import consultsRoutes from "./modules/consults/consults.routes.js";
import consultMetricsRoutes from "./modules/consults/consult-metrics.routes.js";
import slaRoutes from "./modules/sla/sla.routes.js";
import slaMetricsRoutes from "./modules/sla/sla-metrics.routes.js";
import webhooksRoutes from "./modules/webhooks/webhooks.routes.js";
import automationsRoutes from "./modules/automations/automations.routes.js";
import rolesRoutes from "./modules/roles/roles.routes.js";
import messageTemplatesRoutes from "./modules/message-templates/message-templates.routes.js";
import reviewsRoutes from "./modules/reviews/reviews.routes.js";
import campaignsRoutes from "./modules/campaigns/campaigns.routes.js";
import opsLogsRoutes from "./modules/ops-logs/ops-logs.routes.js";
import adSpendRoutes from "./modules/ops-logs/ad-spend.routes.js";
import marketingMetricsRoutes from "./modules/ops-logs/marketing-metrics.routes.js";
import formsRoutes from "./modules/forms/forms.routes.js";
import formsPublicRoutes from "./modules/forms/forms.public.routes.js";
import websiteLeadsRoutes from "./modules/website-leads/website-leads.routes.js";
import sequencesRoutes from "./modules/sequences/sequences.routes.js";
import aiWorkspaceRoutes from "./modules/ai-workspace/ai-workspace.routes.js";
import commsRoutes from "./modules/comms/comms.routes.js";
import callsRoutes from "./modules/calls/calls.routes.js";
import callMetricsRoutes from "./modules/calls/call-metrics.routes.js";
import depositsRoutes from "./modules/deposits/deposits.routes.js";
import competitorsRoutes from "./modules/competitors/competitors.routes.js";
import onboardingRoutes from "./modules/onboarding/onboarding.routes.js";
import treatmentPlansRoutes from "./modules/treatment-plans/treatment-plans.routes.js";
import reportsRoutes from "./modules/reports/reports.routes.js";
import benchmarksRoutes from "./modules/benchmarks/benchmarks.routes.js";
import backgroundJobsRoutes from "./modules/background-jobs/background-jobs.routes.js";
import tasksRoutes from "./modules/tasks/tasks.routes.js";
import sopsRoutes from "./modules/sops/sops.routes.js";
import offersRoutes from "./modules/offers/offers.routes.js";
import packagesRoutes from "./modules/packages/packages.routes.js";
import growthScoresRoutes from "./modules/growth-scores/growth-scores.routes.js";
import complianceRoutes from "./modules/compliance/compliance.routes.js";
import clientAccountsRoutes from "./modules/client-accounts/client-accounts.routes.js";
import strategyLogsRoutes from "./modules/strategy-logs/strategy-logs.routes.js";
import performanceOsRoutes from "./modules/performance-os/performance-os.routes.js";
import integrationInputsRoutes from "./modules/integration-inputs/integration-inputs.routes.js";
import commandPaletteRoutes from "./modules/command-palette/command-palette.routes.js";

const app = express();

app.set("trust proxy", 1);

app.use(helmet());

app.use(requestContext);
app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (config.cors.allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({
  limit: "8mb",
  verify: (req: any, res, buf) => {
    if (req.originalUrl && req.originalUrl.includes("/webhook")) {
      (req as any).rawBody = buf;
    }
  }

}));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));
app.use(cookieparser());
app.use(requestLogger);

app.use("/api/auth", authRoutes);
app.use("/api/contacts", contactsRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/locations", locationsRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/security", securityRoutes)
app.use("/api/audit-log", auditLogRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/insights", insightsRoutes);
app.use("/api/monthly-action-plans", monthlyActionPlansRoutes);
app.use("/api/settings/api-keys", apiKeysRoutes);
app.use("/api/treatments", treatmentsRoutes);
app.use("/api/pipeline", pipelineRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/consults", consultsRoutes);
app.use("/api/metrics", consultMetricsRoutes);
app.use("/api/sla", slaRoutes);
app.use("/api/metrics", slaMetricsRoutes);
app.use("/api/webhooks", webhooksRoutes);
app.use("/api/automations", automationsRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/message-templates", messageTemplatesRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/campaigns", campaignsRoutes);
app.use("/api/ops-logs", opsLogsRoutes);
app.use("/api/ad-spend", adSpendRoutes);
app.use("/api/metrics", marketingMetricsRoutes);
app.use("/api/forms", formsRoutes);
app.use("/api/public/forms", formsPublicRoutes);
app.use("/api/public/website-leads", websiteLeadsRoutes);
app.use("/api/sequences", sequencesRoutes);
app.use("/api/ai", aiWorkspaceRoutes);
app.use("/api/comms", commsRoutes);
app.use("/api/calls", callsRoutes);
app.use("/api/metrics", callMetricsRoutes);
app.use("/api/deposits", depositsRoutes);
app.use("/api/competitors", competitorsRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/treatment-plans", treatmentPlansRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/benchmarks", benchmarksRoutes);
app.use("/api/background-jobs", backgroundJobsRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/sops", sopsRoutes);
app.use("/api/offers", offersRoutes);
app.use("/api/packages", packagesRoutes);
app.use("/api/growth-scores", growthScoresRoutes);
app.use("/api/compliance", complianceRoutes);
app.use("/api/client-accounts", clientAccountsRoutes);
app.use("/api/strategy-logs", strategyLogsRoutes);
app.use("/api/performance-os", performanceOsRoutes);
app.use("/api/integration-inputs", integrationInputsRoutes);
app.use("/api/command-palette", commandPaletteRoutes);
app.use("/api/health", healthRoutes);
app.use("/health", healthRoutes);

// @route   GET /api/public/me
// @desc    Validate an API key and return its clinic scope
// @access  Public API key
app.get("/api/public/me", authenticateApiKey, (req, res) => {
  res.json({
    status: "success",
    data: {
      apiKeyId: (req as any).apiKey.id,
      clinicId: (req as any).apiKey.clinicId,
    },
    requestId: (req as any).requestId,
  });
});

app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "Clinic CRM Backend API is live",
    version: "1.0.0",
    requestId: (req as any).requestId,
  });
});

app.use(errorHandler);

export default app;
