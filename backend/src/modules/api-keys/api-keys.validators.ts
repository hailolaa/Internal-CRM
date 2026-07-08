import { body, param } from "express-validator";

export const createApiKeyValidator = [
  body("name").trim().notEmpty().withMessage("API key name is required").isLength({ max: 100 }),
];

export const updateApiKeyValidator = [
  param("id").isUUID().withMessage("Invalid API key ID format"),
  body("name").optional().trim().notEmpty().isLength({ max: 100 }),
];

export const apiKeyIdParamValidator = [
  param("id").isUUID().withMessage("Invalid API key ID format"),
];
