import { body, param, query } from "express-validator";

const statuses = ["draft", "published", "archived"];

export const createSopValidator = [
  body("title").trim().notEmpty().withMessage("SOP title is required").isLength({ max: 255 }),
  body("category").optional().trim().isLength({ max: 100 }),
  body("content").optional({ nullable: true }).trim(),
  body("owner").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("status").optional().isIn(statuses),
];

export const updateSopValidator = [
  param("id").isUUID().withMessage("Invalid SOP ID format"),
  body("title").optional().trim().notEmpty().isLength({ max: 255 }),
  body("category").optional().trim().isLength({ max: 100 }),
  body("content").optional({ nullable: true }).trim(),
  body("owner").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("status").optional().isIn(statuses),
];

export const sopIdParamValidator = [
  param("id").isUUID().withMessage("Invalid SOP ID format"),
];

export const listSopsValidator = [
  query("category").optional().trim().isString(),
  query("status").optional().isIn(statuses),
  query("search").optional().trim().isString(),
];
