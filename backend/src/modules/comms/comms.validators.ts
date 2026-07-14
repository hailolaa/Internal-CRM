import { body, query } from "express-validator";

export const listInboxValidator = [
  query("archived").optional({ checkFalsy: true }).isIn(["false", "true", "only", "with"]),
];

export const sendMessageValidator = [
  body("channel").optional().isIn(["email", "sms"]),
  body("body").trim().notEmpty().withMessage("Message body is required").isLength({ max: 5000 }),
  body("subject").optional({ nullable: true }).trim().isLength({ max: 500 }),
];

export const updateReadStateValidator = [
  body("unread").isBoolean().toBoolean(),
];

export const updateStarStateValidator = [
  body("starred").isBoolean().toBoolean(),
];

export const updateArchiveStateValidator = [
  body("archived").isBoolean().toBoolean(),
];

export const updateWhatsAppAiSettingsValidator = [
  body("autoSendEnabled").optional().isBoolean().toBoolean(),
  body("businessHoursEnabled").optional().isBoolean().toBoolean(),
  body("businessHoursStart").optional().isString().trim().matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
  body("businessHoursEnd").optional().isString().trim().matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
  body("timezone").optional().isString().trim().isLength({ min: 1, max: 80 }),
  body("approvedTone").optional().isString().trim().isLength({ min: 1, max: 500 }),
  body("guardrails").optional().isArray({ max: 20 }),
  body("guardrails.*").optional().isString().trim().isLength({ min: 1, max: 300 }),
  body("confidenceThreshold").optional().isFloat({ min: 0.1, max: 0.99 }).toFloat(),
  body("humanHandoffUserId").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("maxAutoSendRetries").optional().isInt({ min: 0, max: 5 }).toInt(),
];

export const whatsAppInboundValidator = [
  body("providerMessageId").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("from").trim().notEmpty().withMessage("WhatsApp sender is required").isLength({ max: 40 }),
  body("body").trim().notEmpty().withMessage("WhatsApp message body is required").isLength({ max: 5000 }),
  body("receivedAt").optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body("contactId").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("firstName").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("lastName").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("accountName").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("createLeadIfMissing").optional().isBoolean().toBoolean(),
];

export const whatsAppDraftValidator = [
  body("inboundMessageId").trim().notEmpty().isLength({ max: 100 }),
];

export const whatsAppApproveValidator = [
  body("body").optional({ nullable: true }).isString().trim().isLength({ max: 5000 }),
  body("sendNow").optional().isBoolean().toBoolean(),
];

export const whatsAppRetryValidator = [
  body("body").optional({ nullable: true }).isString().trim().isLength({ max: 5000 }),
];
