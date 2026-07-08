import { body, param } from "express-validator";

const permissionKeysValidator = body("permissions")
  .isArray({ min: 1 })
  .withMessage("At least one permission is required");

const permissionItemsValidator = body("permissions.*")
  .isString()
  .trim()
  .notEmpty()
  .withMessage("Permission keys must be non-empty strings");

export const createRoleValidator = [
  body("name").optional({ nullable: true }).trim().isLength({ max: 100 }),
  body("displayName").trim().notEmpty().withMessage("Role name is required").isLength({ max: 100 }),
  body("description").optional({ nullable: true }).trim(),
  permissionKeysValidator,
  permissionItemsValidator,
];

export const updateRoleValidator = [
  param("id").trim().notEmpty().withMessage("Role ID is required").isLength({ max: 100 }),
  body("displayName").optional().trim().notEmpty().withMessage("Role name cannot be empty").isLength({ max: 100 }),
  body("description").optional({ nullable: true }).trim(),
  body("permissions").optional().isArray({ min: 1 }).withMessage("At least one permission is required"),
  body("permissions.*").optional().isString().trim().notEmpty().withMessage("Permission keys must be non-empty strings"),
];

export const roleIdValidator = [
  param("id").trim().notEmpty().withMessage("Role ID is required").isLength({ max: 100 }),
];
