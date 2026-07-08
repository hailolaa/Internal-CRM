import { body, param } from "express-validator";

export const createAutomationValidator = [
  body("name").trim().notEmpty().withMessage("Automation name is required").isLength({ max: 255 }),
  body("description").optional().trim().isLength({ max: 2000 }),
  body("triggerType").optional().trim().isLength({ max: 100 }),
  body("actions").optional().isArray().withMessage("Actions must be an array"),
  body("isEnabled").optional().isBoolean(),
];

export const updateAutomationValidator = [
  param("id").isUUID().withMessage("Invalid automation ID format"),
  body("name").optional().trim().notEmpty().isLength({ max: 255 }),
  body("description").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body("triggerType").optional({ nullable: true }).trim().isLength({ max: 100 }),
  body("actions").optional().isArray().withMessage("Actions must be an array"),
  body("isEnabled").optional().isBoolean(),
];

export const automationIdParamValidator = [
  param("id").isUUID().withMessage("Invalid automation ID format"),
];
