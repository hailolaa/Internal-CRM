import { body, param } from "express-validator";

export const createWebhookEndpointValidator = [
  body("url").isURL({ require_protocol: true }).withMessage("Webhook URL must be valid"),
  body("description").optional().trim().isLength({ max: 255 }),
  body("events").isArray({ min: 1 }).withMessage("At least one event is required"),
  body("events.*").trim().notEmpty(),
  body("secret").optional().isLength({ min: 12, max: 255 }),
  body("isActive").optional().isBoolean(),
];

export const updateWebhookEndpointValidator = [
  param("id").isUUID().withMessage("Invalid webhook endpoint ID format"),
  body("url").optional().isURL({ require_protocol: true }).withMessage("Webhook URL must be valid"),
  body("description").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("events").optional().isArray({ min: 1 }),
  body("events.*").optional().trim().notEmpty(),
  body("secret").optional().isLength({ min: 12, max: 255 }),
  body("isActive").optional().isBoolean(),
];

export const webhookEndpointIdParamValidator = [
  param("id").isUUID().withMessage("Invalid webhook endpoint ID format"),
];
