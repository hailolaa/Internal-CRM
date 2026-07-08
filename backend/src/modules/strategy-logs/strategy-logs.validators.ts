import { body, param, query } from "express-validator";

const logTypes = ["strategy", "meeting"];

export const createStrategyLogValidator = [
  body("clientAccountProfileId").isUUID().withMessage("Invalid clientAccountProfileId"),
  body("logMonth").matches(/^\d{4}-\d{2}(-\d{2})?$/).withMessage("logMonth must be in YYYY-MM or YYYY-MM-DD format"),
  body("logType").optional().isIn(logTypes).withMessage("Invalid logType"),
  body("meetingNotes").optional({ nullable: true }).isString(),
  body("seoPlan").optional({ nullable: true }).isString(),
  body("ppcPlan").optional({ nullable: true }).isString(),
  body("landingPagePlan").optional({ nullable: true }).isString(),
  body("kpiNotes").optional({ nullable: true }).isString(),
  body("decisions").optional({ nullable: true }).isString(),
  body("nextActions").optional({ nullable: true }).isString(),
  body("ownerId").optional({ nullable: true }).isUUID().withMessage("Invalid ownerId"),
];

export const updateStrategyLogValidator = [
  param("id").isUUID().withMessage("Invalid log ID format"),
  body("logMonth").optional().matches(/^\d{4}-\d{2}(-\d{2})?$/).withMessage("logMonth must be in YYYY-MM or YYYY-MM-DD format"),
  body("logType").optional().isIn(logTypes).withMessage("Invalid logType"),
  body("meetingNotes").optional({ nullable: true }).isString(),
  body("seoPlan").optional({ nullable: true }).isString(),
  body("ppcPlan").optional({ nullable: true }).isString(),
  body("landingPagePlan").optional({ nullable: true }).isString(),
  body("kpiNotes").optional({ nullable: true }).isString(),
  body("decisions").optional({ nullable: true }).isString(),
  body("nextActions").optional({ nullable: true }).isString(),
  body("ownerId").optional({ nullable: true }).isUUID().withMessage("Invalid ownerId"),
];

export const listStrategyLogsValidator = [
  query("clientAccountProfileId").optional().isUUID(),
  query("logMonth").optional().matches(/^\d{4}-\d{2}$/),
  query("ownerId").optional().isUUID(),
  query("logType").optional().isIn(logTypes),
  query("includeArchived").optional().isBoolean(),
];

export const logIdParamValidator = [
  param("id").isUUID().withMessage("Invalid log ID format"),
];
