import { body, query } from "express-validator";

const freelancerReportWorkTypes = ["ppc", "seo", "gbp", "wordpress_development", "design_video", "reporting"];
const freelancerReportQaStatuses = ["awaiting_evidence", "awaiting_qa", "accepted", "failed_qa", "rejected"];

export const ingestLeadValidator = [
  body("eventId").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("firstName").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("lastName").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("fullName").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("email").optional({ nullable: true }).isEmail().normalizeEmail(),
  body("phone").optional({ nullable: true }).isString().trim().isLength({ max: 50 }),
  body("source").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("status").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("treatmentInterest").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("treatmentInterests").optional().isArray({ max: 20 }),
  body("treatmentInterests.*").optional().isString().trim().isLength({ max: 100 }),
  body("value").optional({ nullable: true }).isFloat({ min: 0 }),
  body("notes").optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
  body("rawPayload").optional({ nullable: true }).isObject(),
];

export const createManualPlatformMetricValidator = [
  body("platform").isIn(["google_ads", "ga4", "google_business_profile", "meta", "seo", "other"]),
  body("metricDate").isISO8601().withMessage("metricDate must be ISO formatted"),
  body("campaign").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("locationLabel").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("metricName").isString().trim().notEmpty().isLength({ max: 150 }),
  body("metricValue").isFloat({ min: 0 }),
  body("unit").optional({ nullable: true }).isString().trim().isLength({ max: 50 }),
  body("attributionLabel").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("rawPayload").optional({ nullable: true }).isObject(),
  body("notes").optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
];

export const listManualPlatformMetricsValidator = [
  query("platform").optional().isIn(["google_ads", "ga4", "google_business_profile", "meta", "seo", "other"]),
  query("metricName").optional().isString().trim().isLength({ max: 150 }),
  query("campaign").optional().isString().trim().isLength({ max: 255 }),
  query("from").optional().isISO8601(),
  query("to").optional().isISO8601(),
];

export const summaryPreviewValidator = [
  body("promptType").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("context").isObject().withMessage("context is required"),
];

export const listFreelancerReportsValidator = [
  query("workType").optional().isIn(freelancerReportWorkTypes),
  query("qaStatus").optional().isIn(freelancerReportQaStatuses),
];

export const createFreelancerReportValidator = [
  body("workType").isIn(freelancerReportWorkTypes),
  body("sourceEventId").optional({ nullable: true }).isString().trim().isLength({ max: 191 }),
  body("reportTitle").isString().trim().notEmpty().isLength({ max: 255 }),
  body("accountLabel").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("reportingPeriodStart").isISO8601().withMessage("reportingPeriodStart must be ISO formatted"),
  body("reportingPeriodEnd").isISO8601().withMessage("reportingPeriodEnd must be ISO formatted"),
  body("metrics").isArray({ min: 1, max: 30 }),
  body("metrics.*.name").isString().trim().notEmpty().isLength({ max: 150 }),
  body("metrics.*.value").notEmpty(),
  body("metrics.*.unit").optional({ nullable: true }).isString().trim().isLength({ max: 50 }),
  body("metrics.*.baseline").optional({ nullable: true }),
  body("metrics.*.target").optional({ nullable: true }),
  body("evidence").isArray({ min: 1, max: 40 }),
  body("evidence.*.label").isString().trim().notEmpty().isLength({ max: 150 }),
  body("evidence.*.url").optional({ nullable: true }).isURL({ require_protocol: true }),
  body("evidence.*.screenshotUrl").optional({ nullable: true }).isURL({ require_protocol: true }),
  body("evidence.*.beforeValue").optional({ nullable: true }),
  body("evidence.*.afterValue").optional({ nullable: true }),
  body("evidence.*.workPerformed").optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
  body("evidence.*.rationale").optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
  body("evidence.*.expectedResult").optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
  body("evidence.*.accountOrPage").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("risks").optional().isArray({ max: 20 }),
  body("risks.*").optional().isString().trim().isLength({ max: 500 }),
  body("recommendedActions").optional().isArray({ max: 20 }),
  body("recommendedActions.*").optional().isString().trim().isLength({ max: 500 }),
  body("sourceLinks").optional().isArray({ max: 20 }),
  body("sourceLinks.*").optional().isURL({ require_protocol: true }),
  body("qaStatus").optional().isIn(freelancerReportQaStatuses),
  body("qaNotes").optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
  body("highRiskChange").optional().isBoolean().toBoolean(),
  body("reviewerId").optional({ nullable: true }).isString().trim().isLength({ max: 36 }),
  body("verificationDate").optional({ nullable: true }).isISO8601(),
];
