import { body, param } from "express-validator";

export const createApiKeyValidator = [
  body("name").trim().notEmpty().withMessage("API key name is required").isLength({ max: 100 }),
  body("purpose")
    .optional()
    .isIn(["general", "landing_page_lead_capture"])
    .withMessage("API key purpose is invalid"),
  body("sourceKey").optional({ nullable: true }).trim().isLength({ max: 120 }),
  body("sourceLabel").optional({ nullable: true }).trim().isLength({ max: 180 }),
  body("defaultSource").optional({ nullable: true }).trim().isLength({ max: 120 }),
  body("initialStageName").optional({ nullable: true }).trim().isLength({ max: 120 }),
  body("ownerUserId")
    .optional({ nullable: true, checkFalsy: true })
    .isUUID()
    .withMessage("Owner user ID must be a valid UUID"),
  body("followUpEnabled").optional().isBoolean().withMessage("Follow-up enabled must be true or false"),
];

export const updateApiKeyValidator = [
  param("id").isUUID().withMessage("Invalid API key ID format"),
  body("name").optional().trim().notEmpty().isLength({ max: 100 }),
  body("sourceLabel").optional({ nullable: true }).trim().isLength({ max: 180 }),
  body("defaultSource").optional({ nullable: true }).trim().isLength({ max: 120 }),
  body("initialStageName").optional({ nullable: true }).trim().isLength({ max: 120 }),
  body("ownerUserId")
    .optional({ nullable: true, checkFalsy: true })
    .isUUID()
    .withMessage("Owner user ID must be a valid UUID"),
  body("followUpEnabled").optional().isBoolean().withMessage("Follow-up enabled must be true or false"),
];

export const apiKeyIdParamValidator = [
  param("id").isUUID().withMessage("Invalid API key ID format"),
];
