import { body, param } from "express-validator";

export const opsLogIdParamValidator = [
  param("id").isUUID().withMessage("Invalid entry ID format"),
];

export const createSpendValidator = [
  body("source").trim().notEmpty().withMessage("Source is required").isLength({ max: 100 }),
  body("campaign").trim().notEmpty().withMessage("Campaign is required").isLength({ max: 255 }),
  body("amount").isFloat({ gt: 0 }).withMessage("Amount must be greater than 0"),
  body("period").trim().notEmpty().withMessage("Period is required").isLength({ max: 100 }),
  body("channel").optional({ nullable: true }).trim().isLength({ max: 100 }),
  body("startDate").optional({ nullable: true }).isISO8601().withMessage("Start date must be ISO formatted"),
  body("endDate").optional({ nullable: true }).isISO8601().withMessage("End date must be ISO formatted"),
  body("attributionLabel").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("notes").optional({ nullable: true }).trim(),
];

export const updateSpendValidator = [
  ...opsLogIdParamValidator,
  body("source").optional().trim().notEmpty().isLength({ max: 100 }),
  body("campaign").optional().trim().notEmpty().isLength({ max: 255 }),
  body("amount").optional().isFloat({ gt: 0 }).withMessage("Amount must be greater than 0"),
  body("period").optional().trim().notEmpty().isLength({ max: 100 }),
  body("channel").optional({ nullable: true }).trim().isLength({ max: 100 }),
  body("startDate").optional({ nullable: true }).isISO8601().withMessage("Start date must be ISO formatted"),
  body("endDate").optional({ nullable: true }).isISO8601().withMessage("End date must be ISO formatted"),
  body("attributionLabel").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("notes").optional({ nullable: true }).trim(),
];

export const createConsultValidator = [
  body("patientName").trim().notEmpty().withMessage("Patient name is required").isLength({ max: 255 }),
  body("treatment").trim().notEmpty().withMessage("Treatment is required").isLength({ max: 255 }),
  body("practitioner").trim().notEmpty().withMessage("Practitioner is required").isLength({ max: 255 }),
  body("outcome").trim().notEmpty().withMessage("Outcome is required").isLength({ max: 100 }),
  body("revenue").optional().isFloat({ min: 0 }),
  body("date").optional({ nullable: true }).isISO8601().withMessage("Date must be ISO formatted"),
  body("notes").optional({ nullable: true }).trim(),
];
