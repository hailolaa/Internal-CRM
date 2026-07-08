import { body, param } from "express-validator";
import { callCommercialOutcomes } from "./calls.constants.js";

export const callIdParamValidator = [
  param("id").isUUID().withMessage("Invalid call ID format"),
];

export const updateCallValidator = [
  ...callIdParamValidator,
  body("aiSummary").optional({ nullable: true }).isString().trim().isLength({ max: 10000 }),
  body("bookingIntent").optional({ nullable: true }).isIn(["none", "low", "medium", "high", "booked"]),
  body("commercialOutcome").optional({ nullable: true }).isIn(callCommercialOutcomes),
  body("consentCaptured").optional({ nullable: true }).isBoolean().toBoolean(),
  body("consentMethod").optional({ nullable: true }).isIn(["verbal", "recorded_prompt", "written", "implied", "unknown"]),
  body("consentTimestamp").optional({ nullable: true }).isISO8601().toDate(),
  body("notes").optional({ nullable: true }).isString().trim().isLength({ max: 5000 }),
  body("qualityScore").optional({ nullable: true }).isInt({ min: 0, max: 100 }).toInt(),
  body("retentionDeadline").optional({ nullable: true }).isISO8601().toDate(),
  body("sentiment").optional({ nullable: true }).isIn(["positive", "neutral", "negative", "unknown"]),
  body("transcript").optional({ nullable: true }).isString().trim().isLength({ max: 50000 }),
  body("treatmentMentioned").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("assignedUserId").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("contactId").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("source").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("missedRecoveryStatus").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
];

export const createCallValidator = [
  body("contactId").isUUID().withMessage("Contact is required"),
  body("direction").optional().isIn(["inbound", "outbound"]),
  body("duration").optional({ nullable: true }).isInt({ min: 0, max: 86400 }).toInt(),
  body("commercialOutcome").optional({ nullable: true }).isIn(callCommercialOutcomes),
  body("notes").optional({ nullable: true }).isString().trim().isLength({ max: 5000 }),
  body("source").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("treatmentMentioned").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("createdAt").optional({ nullable: true }).isISO8601(),
];

export const createMissedCallFollowUpValidator = [
  param("id").isUUID().withMessage("Invalid call ID format"),
  body("templateId").optional().isUUID().withMessage("Invalid template ID format"),
  body("sendNow").optional().isBoolean(),
];

export const createRecordingDeletionRequestValidator = [
  param("id").isUUID().withMessage("Invalid call ID format"),
  body("reason").optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
];

export const updateRecordingDeletionRequestValidator = [
  param("requestId").isUUID().withMessage("Invalid recording deletion request ID format"),
  body("status").isIn(["requested", "approved", "completed", "rejected", "cancelled"]),
  body("reason").optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
];

export const transcribeCallValidator = [
  param("id").isUUID().withMessage("Invalid call ID format"),
  body("generateIntelligence").optional().isBoolean(),
];
