import { body, param } from "express-validator";

const marketingConnectors = ["google_ads", "meta", "google_business_profile", "ga4", "seo"];

export const updateIntegrationValidator = [
  param("id").isUUID().withMessage("Invalid integration ID format"),
  body("name").optional().trim().isLength({ min: 1, max: 100 }),
  body("type").optional().trim().isLength({ min: 1, max: 100 }),
  body("isActive").optional().isBoolean(),
  body("config").optional().isObject().withMessage("Config must be an object"),
];

export const connectIntegrationValidator = [
  body("name").trim().notEmpty().withMessage("Integration name is required").isLength({ max: 100 }),
  body("type").trim().notEmpty().withMessage("Integration type is required").isLength({ max: 100 }),
  body("config").optional().isObject().withMessage("Config must be an object"),
];

export const connectorTypeParamValidator = [
  param("type").isIn(marketingConnectors).withMessage("Unsupported connector type"),
];

export const setupConnectorValidator = [
  ...connectorTypeParamValidator,
  body("config").optional({ nullable: true }).isObject().withMessage("Config must be an object"),
  body("oauthAuthorizeUrl").optional({ nullable: true }).isURL({ require_protocol: true }).isLength({ max: 1000 }),
  body("missingPermissions").optional({ nullable: true }).isArray({ max: 50 }),
  body("missingPermissions.*").optional().isString().trim().isLength({ max: 100 }),
  body("isActive").optional().isBoolean().toBoolean(),
];

export const syncConnectorValidator = [
  ...connectorTypeParamValidator,
  body("rows").optional({ nullable: true }).isArray({ max: 1000 }),
  body("rows.*.metricDate").isISO8601(),
  body("rows.*.metricName").isString().trim().notEmpty().isLength({ max: 150 }),
  body("rows.*.metricValue").isFloat().toFloat(),
  body("rows.*.campaign").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("rows.*.locationLabel").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("rows.*.unit").optional({ nullable: true }).isString().trim().isLength({ max: 50 }),
  body("rows.*.rawPayload").optional({ nullable: true }).isObject(),
  body("errorMessage").optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
];

export const startConnectorOAuthValidator = [
  ...connectorTypeParamValidator,
  body("config").optional({ nullable: true }).isObject().withMessage("Config must be an object"),
];

export const completeConnectorOAuthValidator = [
  ...connectorTypeParamValidator,
  body("code").isString().trim().notEmpty().isLength({ max: 2000 }),
  body("state").isString().trim().notEmpty().isLength({ max: 500 }),
];

export const selectConnectorAccountValidator = [
  ...connectorTypeParamValidator,
  body("selectionId").isString().trim().notEmpty().isLength({ max: 500 }),
];
