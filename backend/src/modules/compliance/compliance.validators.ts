import { body, param } from "express-validator";

const statuses = ["complete", "action_required", "expiring_soon"];
const categories = ["gdpr", "clinical", "training", "insurance", "regulatory"];
const dataAccessRequestTypes = ["access", "erasure", "rectification", "portability", "restriction"];
const dataAccessRequestStatuses = ["received", "verifying_identity", "in_progress", "completed", "rejected", "cancelled"];

export const createComplianceDocumentValidator = [
  body("title").trim().notEmpty().withMessage("Document title is required").isLength({ max: 255 }),
  body("status").optional().isIn(statuses),
  body("category").optional().isIn(categories),
  body("dueDate").optional({ nullable: true }).isISO8601().toDate(),
];

export const updateComplianceDocumentValidator = [
  param("id").isUUID().withMessage("Invalid document ID format"),
  body("title").optional().trim().notEmpty().isLength({ max: 255 }),
  body("status").optional().isIn(statuses),
  body("category").optional().isIn(categories),
  body("dueDate").optional({ nullable: true }).isISO8601().toDate(),
];

export const complianceDocumentIdParamValidator = [
  param("id").isUUID().withMessage("Invalid document ID format"),
];

export const updateComplianceSettingsValidator = [
  body("retentionPeriod").optional().trim().isLength({ max: 100 }),
  body("toggles").optional().isObject(),
];

export const complianceDocumentFileValidator = [
  param("id").isUUID().withMessage("Invalid document ID format"),
  body("fileName").trim().notEmpty().withMessage("File name is required").isLength({ max: 255 }),
  body("mimeType").trim().notEmpty().withMessage("MIME type is required").isLength({ max: 100 }),
  body("sizeBytes").optional({ nullable: true }).isInt({ min: 1, max: 8 * 1024 * 1024 }),
  body("dataUrl").isString().notEmpty().withMessage("Document file data is required"),
];

export const createDataAccessRequestValidator = [
  body("requesterName").trim().notEmpty().withMessage("Requester name is required").isLength({ max: 255 }),
  body("requesterEmail").optional({ nullable: true }).trim().isEmail().isLength({ max: 255 }),
  body("requesterPhone").optional({ nullable: true }).trim().isLength({ max: 50 }),
  body("requestType").isIn(dataAccessRequestTypes).withMessage("Invalid request type"),
  body("dueDate").optional({ nullable: true }).isISO8601().withMessage("Due date must be a valid date"),
  body("notes").optional({ nullable: true }).trim(),
];

export const updateDataAccessRequestValidator = [
  param("id").isUUID().withMessage("Invalid data access request ID format"),
  body("status").optional().isIn(dataAccessRequestStatuses).withMessage("Invalid request status"),
  body("dueDate").optional({ nullable: true }).isISO8601().withMessage("Due date must be a valid date"),
  body("notes").optional({ nullable: true }).trim(),
];

export const dataAccessRequestIdParamValidator = [
  param("id").isUUID().withMessage("Invalid data access request ID format"),
];
