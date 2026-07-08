import { body, param } from "express-validator";

const statuses = ["active", "scheduled", "expired"];

export const createOfferValidator = [
  body("name").trim().notEmpty().withMessage("Offer name is required").isLength({ max: 255 }),
  body("discount").trim().notEmpty().withMessage("Discount is required").isLength({ max: 100 }),
  body("treatment").trim().notEmpty().withMessage("Treatment is required").isLength({ max: 255 }),
  body("validUntil").trim().notEmpty().withMessage("Valid until is required").isLength({ max: 100 }),
  body("redemptions").optional().isInt({ min: 0 }),
  body("status").optional().isIn(statuses),
  body("description").optional({ nullable: true }).trim(),
];

export const updateOfferValidator = [
  param("id").isUUID().withMessage("Invalid offer ID format"),
  body("name").optional().trim().notEmpty().isLength({ max: 255 }),
  body("discount").optional().trim().notEmpty().isLength({ max: 100 }),
  body("treatment").optional().trim().notEmpty().isLength({ max: 255 }),
  body("validUntil").optional().trim().notEmpty().isLength({ max: 100 }),
  body("redemptions").optional().isInt({ min: 0 }),
  body("status").optional().isIn(statuses),
  body("description").optional({ nullable: true }).trim(),
];

export const offerIdParamValidator = [
  param("id").isUUID().withMessage("Invalid offer ID format"),
];
