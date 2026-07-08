import { body, param, query } from "express-validator";
import { MESSAGE_TEMPLATE_CHANNELS, MESSAGE_TEMPLATE_STATUSES } from "./message-templates.types.js";

const channels = [...MESSAGE_TEMPLATE_CHANNELS];
const statuses = [...MESSAGE_TEMPLATE_STATUSES];

export const createMessageTemplateValidator = [
  body("name").trim().notEmpty().withMessage("Template name is required").isLength({ max: 255 }),
  body("channel").optional().isIn(channels),
  body("subject").optional({ nullable: true }).trim().isLength({ max: 500 }),
  body("body").trim().notEmpty().withMessage("Template body is required"),
  body("status").optional().isIn(statuses),
];

export const updateMessageTemplateValidator = [
  param("id").isUUID().withMessage("Invalid template ID format"),
  body("name").optional().trim().notEmpty().isLength({ max: 255 }),
  body("channel").optional().isIn(channels),
  body("subject").optional({ nullable: true }).trim().isLength({ max: 500 }),
  body("body").optional().trim().notEmpty(),
  body("status").optional().isIn(statuses),
];

export const messageTemplateIdParamValidator = [
  param("id").isUUID().withMessage("Invalid template ID format"),
];

export const listMessageTemplatesValidator = [
  query("channel").optional().isIn(channels),
  query("status").optional().isIn(statuses),
];

export const testSendMessageTemplateValidator = [
  param("id").isUUID().withMessage("Invalid template ID format"),
  body("recipient").trim().notEmpty().withMessage("Recipient is required").isLength({ max: 255 }),
  body("channel").optional().isIn(channels),
  body("variables").optional().isObject().withMessage("Template variables must be an object"),
  body("variables.*").optional({ nullable: true }).isString().isLength({ max: 500 }),
];
