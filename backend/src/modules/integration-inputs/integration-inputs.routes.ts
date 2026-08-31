import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authenticateApiKey } from "../../middleware/apiKeyAuthenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { integrationInputsController } from "./integration-inputs.controller.js";
import {
  createFreelancerReportValidator,
  createManualPlatformMetricValidator,
  ingestLeadValidator,
  listFreelancerReportsValidator,
  listManualPlatformMetricsValidator,
  summaryPreviewValidator,
} from "./integration-inputs.validators.js";

const router = Router();

router.post(
  "/public/meta-leads",
  authenticateApiKey,
  ingestLeadValidator,
  validate,
  integrationInputsController.ingestPublicMetaLead,
);

router.use(authenticate);

router.get(
  "/setup-audit",
  authorizePermission("webhooks:read"),
  integrationInputsController.getSetupAudit,
);

router.post(
  "/manual-leads",
  authorizePermission("contacts:write"),
  ingestLeadValidator,
  validate,
  integrationInputsController.ingestManualLead,
);

router.get(
  "/manual-metrics",
  authorizePermission("reports:read"),
  listManualPlatformMetricsValidator,
  validate,
  integrationInputsController.listManualPlatformMetrics,
);

router.post(
  "/manual-metrics",
  authorizePermission("reports:write"),
  createManualPlatformMetricValidator,
  validate,
  integrationInputsController.createManualPlatformMetric,
);

router.get(
  "/freelancer-report-templates",
  authorizePermission("reports:read"),
  integrationInputsController.listFreelancerReportTemplates,
);

router.get(
  "/freelancer-reports",
  authorizePermission("reports:read"),
  listFreelancerReportsValidator,
  validate,
  integrationInputsController.listFreelancerReports,
);

router.post(
  "/freelancer-reports",
  authorizePermission("reports:write"),
  createFreelancerReportValidator,
  validate,
  integrationInputsController.createFreelancerReport,
);

router.get(
  "/stripe/package-summary",
  authorizePermission("billing:read"),
  integrationInputsController.getStripePackageSummary,
);

router.post(
  "/openai/summary-preview",
  authorizePermission("reports:read"),
  summaryPreviewValidator,
  validate,
  integrationInputsController.previewOpenAISummary,
);

export default router;
