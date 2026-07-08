import { body, param, query } from "express-validator";

const statuses = ["active", "paused", "draft", "archived"];
const uuidLikePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createSequenceValidator = [
  body("name").trim().notEmpty().withMessage("Sequence name is required").isLength({ max: 255 }),
  body("triggerLabel").trim().notEmpty().withMessage("Trigger is required").isLength({ max: 255 }),
  body("steps").optional().isArray(),
  body("status").optional().isIn(statuses),
];

export const updateSequenceValidator = [
  param("id").matches(uuidLikePattern).withMessage("Invalid sequence ID format"),
  body("name").optional().trim().notEmpty().isLength({ max: 255 }),
  body("triggerLabel").optional().trim().notEmpty().isLength({ max: 255 }),
  body("steps").optional().isArray(),
  body("status").optional().isIn(statuses),
  body("enrolledCount").optional().isInt({ min: 0 }),
  body("completedCount").optional().isInt({ min: 0 }),
];

export const sequenceIdParamValidator = [
  param("id").matches(uuidLikePattern).withMessage("Invalid sequence ID format"),
];

export const enrollSequenceValidator = [
  ...sequenceIdParamValidator,
  body("contactId").isUUID().withMessage("Invalid contact ID format"),
];

export const unenrollSequenceValidator = [
  ...sequenceIdParamValidator,
  param("enrollmentId").isUUID().withMessage("Invalid enrollment ID format"),
];

export const runDueSequencesValidator = [
  query("limit").optional({ checkFalsy: true }).isInt({ min: 1, max: 200 }).toInt(),
];
