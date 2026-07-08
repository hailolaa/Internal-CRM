import { body, param } from "express-validator";

const statuses = ["active", "completed", "draft", "archived"];

export const createTreatmentPlanValidator = [
  body("contact").trim().notEmpty().withMessage("Contact is required").isLength({ max: 255 }),
  body("avatar").optional({ nullable: true }).trim().isLength({ max: 10 }),
  body("treatment").trim().notEmpty().withMessage("Treatment plan name is required").isLength({ max: 255 }),
  body("items").optional().isArray(),
  body("totalValue").optional().isFloat({ min: 0 }),
  body("paid").optional().isFloat({ min: 0 }),
  body("outstanding").optional().isFloat({ min: 0 }),
  body("status").optional().isIn(statuses),
  body("sessions").optional().isInt({ min: 1 }),
  body("sessionsCompleted").optional().isInt({ min: 0 }),
  body("nextSession").optional({ nullable: true }).isISO8601(),
  body("practitioner").optional({ nullable: true }).trim().isLength({ max: 255 }),
];

export const updateTreatmentPlanValidator = [
  param("id").isUUID().withMessage("Invalid treatment plan ID format"),
  ...createTreatmentPlanValidator.map((validator) => validator.optional()),
];

export const treatmentPlanIdParamValidator = [
  param("id").isUUID().withMessage("Invalid treatment plan ID format"),
];

