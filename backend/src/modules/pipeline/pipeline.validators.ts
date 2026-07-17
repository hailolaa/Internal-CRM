import { body, param } from "express-validator";
import { pipelineDealStatuses, pipelineStageKinds } from "./pipeline.constants.js";
import { auditWorkflowStatuses } from "../audit-workflow/audit-workflow.constants.js";

const colorPattern = /^bg-[a-z]+-\d{3}$/;
const idValidator = param("id").isString().trim().isLength({ min: 1, max: 100 });

const dealMutationValidator = [
  body("title").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("valueCents").optional({ nullable: true }).isInt({ min: 0, max: 1000000000 }).toInt(),
  body("source").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("treatment").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("probability").optional({ nullable: true }).isInt({ min: 0, max: 100 }).toInt(),
  body("expectedCloseDate").optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body("ownerId").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("auditStatus").optional({ nullable: true, checkFalsy: true }).isIn(auditWorkflowStatuses),
  body("auditAssignedTo").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("auditFollowUpDueAt").optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body("auditStatusUpdatedAt").optional({ nullable: true, checkFalsy: true }).isISO8601(),
];

export const createPipelineStageValidator = [
  body("name").trim().notEmpty().withMessage("Stage name is required").isLength({ max: 100 }),
  body("color").optional().matches(colorPattern).withMessage("Stage colour must be a Tailwind background class"),
  body("position").optional().isInt({ min: 1, max: 100 }),
  body("kind").optional().isIn(pipelineStageKinds),
];

export const updatePipelineStageValidator = [
  param("id").isUUID().withMessage("Invalid pipeline stage ID format"),
  body("name").optional().trim().notEmpty().isLength({ max: 100 }),
  body("color").optional().matches(colorPattern).withMessage("Stage colour must be a Tailwind background class"),
  body("position").optional().isInt({ min: 1, max: 100 }),
  body("kind").optional().isIn(pipelineStageKinds),
  body("isLocked").optional().isBoolean().toBoolean(),
];

export const pipelineStageIdParamValidator = [
  param("id").isUUID().withMessage("Invalid pipeline stage ID format"),
];

export const pipelineDealIdParamValidator = [idValidator];

export const createPipelineDealValidator = [
  body("contactId").isString().trim().notEmpty().isLength({ max: 100 }),
  body("stageId").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  ...dealMutationValidator,
];

export const updatePipelineDealValidator = [
  idValidator,
  ...dealMutationValidator,
  body("status").optional().isIn(pipelineDealStatuses),
];

export const movePipelineDealValidator = [
  idValidator,
  body("stageId").isString().trim().notEmpty().isLength({ max: 100 }),
  body("valueCents").optional({ nullable: true }).isInt({ min: 0, max: 1000000000 }).toInt(),
  body("bookedAt").optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body("soldAt").optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body("lostAt").optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body("lostReason").optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body("notes").optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
];
