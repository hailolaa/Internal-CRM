import { body, param } from "express-validator";
import { treatmentCategories } from "./treatments.constants.js";

export const createTreatmentValidator = [
  body("name").trim().notEmpty().withMessage("Treatment name is required").isLength({ max: 255 }),
  body("description").optional().trim().isLength({ max: 2000 }),
  body("category").optional().isIn(treatmentCategories),
  body("durationMinutes").optional().isInt({ min: 0, max: 1440 }),
  body("priceCents").optional().isInt({ min: 0 }),
  body("averageValueCents").optional().isInt({ min: 0 }),
  body("marginPercent").optional().isFloat({ min: 0, max: 100 }),
  body("priority").optional().isInt({ min: 0, max: 10 }),
  body("isHighTicket").optional().isBoolean().toBoolean(),
  body("status").optional().isIn(["active", "inactive"]),
];

export const updateTreatmentValidator = [
  param("id").isUUID().withMessage("Invalid treatment ID format"),
  body("name").optional().trim().notEmpty().isLength({ max: 255 }),
  body("description").optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body("category").optional().isIn(treatmentCategories),
  body("durationMinutes").optional({ nullable: true }).isInt({ min: 0, max: 1440 }),
  body("priceCents").optional({ nullable: true }).isInt({ min: 0 }),
  body("averageValueCents").optional({ nullable: true }).isInt({ min: 0 }),
  body("marginPercent").optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  body("priority").optional().isInt({ min: 0, max: 10 }),
  body("isHighTicket").optional().isBoolean().toBoolean(),
  body("status").optional().isIn(["active", "inactive"]),
];

export const treatmentIdParamValidator = [
  param("id").isUUID().withMessage("Invalid treatment ID format"),
];
