import { body, param } from "express-validator";

export const updateReviewStatusValidator = [
  param("id").isUUID().withMessage("Invalid review ID format"),
  body("status").trim().notEmpty().withMessage("Status is required").isLength({ max: 50 }),
];

export const reviewIdParamValidator = [
  param("id").isUUID().withMessage("Invalid review ID format"),
];
