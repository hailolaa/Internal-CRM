import { body, param, query } from "express-validator";

const billingFrequencies = ["one_off", "monthly", "quarterly", "annual", "bespoke"];
const statuses = ["active", "inactive", "archived"];

export const listPackagesValidator = [
  query("includeInactive").optional().isBoolean().toBoolean(),
];

export const packageIdParamValidator = [
  param("id").isUUID().withMessage("Invalid package ID format"),
];

const packageBodyValidator = [
  body("name").optional().isString().trim().isLength({ min: 1, max: 150 }),
  body("priceCents").optional({ nullable: true }).isInt({ min: 0 }),
  body("currency").optional({ nullable: true }).isString().trim().isLength({ min: 3, max: 3 }),
  body("billingFrequency").optional({ nullable: true }).isIn(billingFrequencies),
  body("setupFeeCents").optional({ nullable: true }).isInt({ min: 0 }),
  body("includedFeatures").optional().isArray({ max: 40 }),
  body("includedFeatures.*").optional().isString().trim().isLength({ max: 255 }),
  body("internalNotes").optional({ nullable: true }).isString().trim().isLength({ max: 5000 }),
  body("proposalWording").optional({ nullable: true }).isString().trim().isLength({ max: 5000 }),
  body("sortOrder").optional({ nullable: true }).isInt({ min: 0, max: 10000 }),
  body("status").optional({ nullable: true }).isIn(statuses),
];

export const createPackageValidator = [
  body("name").isString().trim().isLength({ min: 1, max: 150 }).withMessage("Package name is required"),
  ...packageBodyValidator,
];

export const updatePackageValidator = [
  ...packageIdParamValidator,
  ...packageBodyValidator,
];
