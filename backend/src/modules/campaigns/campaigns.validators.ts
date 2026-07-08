import { body, param } from "express-validator";

const statuses = ["draft", "active", "paused", "completed", "archived"];

export const createCampaignValidator = [
  body("name").trim().notEmpty().withMessage("Campaign name is required").isLength({ max: 255 }),
  body("description").optional({ nullable: true }).trim(),
  body("type").optional({ nullable: true }).trim().isLength({ max: 50 }),
  body("status").optional().isIn(statuses),
  body("startDate").optional({ nullable: true }).isISO8601().withMessage("Start date must be a valid date"),
  body("endDate").optional({ nullable: true }).isISO8601().withMessage("End date must be a valid date"),
  body("budget").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Budget must be a positive number"),
  body("channel").optional({ nullable: true }).trim().isLength({ max: 100 }),
];

export const updateCampaignStatusValidator = [
  param("id").isUUID().withMessage("Invalid campaign ID format"),
  body("status").trim().notEmpty().withMessage("Status is required").isIn(statuses),
];

export const campaignMediaUploadValidator = [
  param("id").isUUID().withMessage("Invalid campaign ID format"),
  body("fileName").trim().notEmpty().withMessage("File name is required").isLength({ max: 255 }),
  body("mimeType").trim().notEmpty().withMessage("MIME type is required").isLength({ max: 100 }),
  body("sizeBytes").optional({ nullable: true }).isInt({ min: 1, max: 5 * 1024 * 1024 }),
  body("dataUrl").isString().notEmpty().withMessage("Media data is required"),
];

export const campaignMediaReplaceValidator = [
  ...campaignMediaUploadValidator,
  param("mediaId").isUUID().withMessage("Invalid campaign media ID format"),
];

export const campaignMediaIdValidator = [
  param("id").isUUID().withMessage("Invalid campaign ID format"),
  param("mediaId").isUUID().withMessage("Invalid campaign media ID format"),
];
