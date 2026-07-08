import { body, param } from "express-validator";

const pricePositions = ["Budget", "Mid-range", "Premium"];
const seoStrengths = ["Strong", "Medium", "Weak"];

export const createCompetitorValidator = [
  body("name").trim().notEmpty().withMessage("Competitor name is required").isLength({ max: 255 }),
  body("url").trim().notEmpty().withMessage("Competitor URL is required").isLength({ max: 500 }),
  body("keyTreatments").optional().isArray(),
  body("pricePosition").optional().isIn(pricePositions),
  body("offer").optional({ nullable: true }).trim(),
  body("messagingAngle").optional({ nullable: true }).trim(),
  body("adPresence").optional().isObject(),
  body("seoStrength").optional().isIn(seoStrengths),
  body("rating").optional().isFloat({ min: 0, max: 5 }),
  body("reviews").optional().isInt({ min: 0 }),
];

export const updateCompetitorValidator = [
  param("id").isUUID().withMessage("Invalid competitor ID format"),
  ...createCompetitorValidator.map((validator) => validator.optional()),
];

export const competitorIdParamValidator = [
  param("id").isUUID().withMessage("Invalid competitor ID format"),
];

