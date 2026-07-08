import { body, param } from "express-validator";

const statuses = ["active", "draft", "archived"];

export const createFormValidator = [
  body("name").trim().notEmpty().withMessage("Form name is required").isLength({ max: 255 }),
  body("type").optional().trim().isLength({ max: 50 }),
  body("status").optional().isIn(statuses),
  body("fields").optional().isArray(),
];

export const updateFormValidator = [
  param("id").isUUID().withMessage("Invalid form ID format"),
  body("name").optional().trim().notEmpty().isLength({ max: 255 }),
  body("type").optional().trim().isLength({ max: 50 }),
  body("status").optional().isIn(statuses),
  body("fields").optional().isArray(),
];

export const formIdParamValidator = [
  param("id").isUUID().withMessage("Invalid form ID format"),
];

export const formSubmissionIdParamValidator = [
  param("id").isUUID().withMessage("Invalid form submission ID format"),
];

export const linkSubmissionToPipelineValidator = [
  param("id").isUUID().withMessage("Invalid form submission ID format"),
  body("stageId").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("title").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("valueCents").optional({ nullable: true }).isInt({ min: 0, max: 1000000000 }).toInt(),
  body("source").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("treatment").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("probability").optional({ nullable: true }).isInt({ min: 0, max: 100 }).toInt(),
  body("expectedCloseDate").optional({ nullable: true, checkFalsy: true }).isISO8601(),
];

