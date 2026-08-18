import { body, param } from "express-validator";
import { proposalDataStates } from "./proposals.types.js";
import { proposalDiscoveryStatuses } from "./proposal-discovery.types.js";

const stringAnswerFields = [
  "value",
  "sourceLabel",
  "sourceAt",
  "evidenceReference",
  "approvedBy",
  "approvedAt",
  "customerWording",
  "notes",
];

export const proposalDiscoverySessionIdParamValidator = [
  param("sessionId").isUUID().withMessage("Invalid discovery session ID format"),
];

export const startProposalDiscoverySessionValidator = [
  body("contactId").optional({ nullable: true }).isUUID().withMessage("contactId must be a valid UUID"),
  body("dealId").optional({ nullable: true }).isUUID().withMessage("dealId must be a valid UUID"),
  body("clientAccountProfileId").optional({ nullable: true }).isUUID().withMessage("clientAccountProfileId must be a valid UUID"),
  body("proposalId").optional({ nullable: true }).isUUID().withMessage("proposalId must be a valid UUID"),
];

export const updateProposalDiscoverySessionValidator = [
  ...proposalDiscoverySessionIdParamValidator,
  body("status").optional().isIn(proposalDiscoveryStatuses),
  body("clinicType").optional({ nullable: true }).isString().trim().isLength({ max: 80 }),
  body("recommendedPackageId").optional({ nullable: true }).isUUID(),
  body("activeConstraintId").optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body("selectedMediaSpendCents").optional({ nullable: true }).isInt({ min: 0, max: 100000000 }),
  body("answers").optional().isObject(),
  body("answers.*").optional().isObject(),
  body("answers.*.state").optional().isIn(proposalDataStates),
  body("answers.*.approvalStatus").optional({ nullable: true }).isIn(["not_required", "pending", "approved", "rejected"]),
  ...stringAnswerFields.map((field) =>
    body(`answers.*.${field}`).optional({ nullable: true }).isString().trim().isLength({ max: field === "value" ? 2000 : 1000 }),
  ),
  body("freeNotes").optional({ nullable: true }).isString().trim().isLength({ max: 30000 }),
  body("callOutcome").optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body("nextAction").optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body("nextActionOwnerId").optional({ nullable: true }).isUUID(),
  body("nextActionDueAt").optional({ nullable: true }).isISO8601(),
];
