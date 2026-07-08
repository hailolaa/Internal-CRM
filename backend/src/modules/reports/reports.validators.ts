import { body, param, query } from "express-validator";

const workflowStatuses = ["draft", "in_review", "approved", "published"];
const exportTypes = ["revenue", "attribution", "pipeline", "operational", "no-shows"];
const exportFormats = ["csv"];

export const reportIdParamValidator = [
  param("id").trim().notEmpty().isLength({ max: 64 }).withMessage("Invalid report ID format"),
];

export const updateReportWorkflowValidator = [
  ...reportIdParamValidator,
  body("workflowStatus").optional().isIn(workflowStatuses).withMessage("Invalid report workflow status"),
  body("internalNotes").optional({ nullable: true }).isString().isLength({ max: 10000 }),
  body("clientCommentary").optional({ nullable: true }).isString().isLength({ max: 10000 }),
  body("aiDraftSummary").optional({ nullable: true }).isString().isLength({ max: 10000 }),
];

export const exportReportValidator = [
  param("type").isIn(exportTypes).withMessage("Unsupported report export type"),
  query("format").optional().isIn(exportFormats).withMessage("Only CSV report exports are supported by the backend"),
  query("startDate").optional().isISO8601().withMessage("startDate must be a valid date"),
  query("endDate").optional().isISO8601().withMessage("endDate must be a valid date"),
];
