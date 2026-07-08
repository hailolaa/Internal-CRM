import { body, query } from "express-validator";

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
