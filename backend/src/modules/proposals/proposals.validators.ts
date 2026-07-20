import { body, param, query } from "express-validator";
import { proposalStatuses } from "./proposals.types.js";

const idValidator = (field: string) =>
  body(field)
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 1, max: 36 })
    .withMessage(`${field} must be a valid record identifier`);

const optionalDate = (field: string) =>
  body(field)
    .optional({ nullable: true })
    .isISO8601()
    .withMessage(`${field} must be a valid date/time`);

function hasTimelineRecord(value: Record<string, unknown>) {
  return Boolean(value.contactId || value.dealId);
}

export const proposalIdParamValidator = [
  param("id").trim().isLength({ min: 1, max: 36 }).withMessage("Proposal ID is required"),
];

export const listProposalsValidator = [
  query("contactId").optional().trim().isLength({ min: 1, max: 36 }),
  query("dealId").optional().trim().isLength({ min: 1, max: 36 }),
  query("clientAccountProfileId").optional().trim().isLength({ min: 1, max: 36 }),
  query("ownerId").optional().trim().isLength({ min: 1, max: 36 }),
  query("status").optional().isIn(["all", ...proposalStatuses]),
  query("followUpDue").optional().isBoolean(),
  query("includeArchived").optional().isBoolean(),
  query("search").optional().trim().isLength({ max: 255 }),
  query("limit").optional().isInt({ min: 1, max: 250 }),
];

export const createProposalValidator = [
  body().custom(hasTimelineRecord).withMessage("Proposal must link to a lead/contact or deal so activity can appear on the record timeline"),
  idValidator("contactId"),
  idValidator("dealId"),
  idValidator("clientAccountProfileId"),
  body("proposalName").trim().notEmpty().withMessage("Proposal name is required").isLength({ max: 255 }),
  body("packageName").optional({ nullable: true }).trim().isLength({ max: 150 }),
  idValidator("ownerId"),
  body("status").optional().isIn(proposalStatuses),
  body("valueCents").optional({ nullable: true }).isInt({ min: 0 }),
  body("currency").optional({ nullable: true }).trim().isLength({ min: 3, max: 3 }),
  optionalDate("followUpAt"),
  optionalDate("readyAt"),
  optionalDate("sentAt"),
  optionalDate("viewedAt"),
  optionalDate("acceptedAt"),
  optionalDate("wonAt"),
  optionalDate("lostAt"),
  optionalDate("expiresAt"),
  body("proposalUrl").optional({ nullable: true }).trim().isLength({ max: 500 }),
  body("notes").optional({ nullable: true }).trim().isLength({ max: 10000 }),
];

export const updateProposalValidator = [
  ...proposalIdParamValidator,
  idValidator("contactId"),
  idValidator("dealId"),
  idValidator("clientAccountProfileId"),
  body("proposalName").optional().trim().notEmpty().isLength({ max: 255 }),
  body("packageName").optional({ nullable: true }).trim().isLength({ max: 150 }),
  idValidator("ownerId"),
  body("status").optional().isIn(proposalStatuses),
  body("valueCents").optional({ nullable: true }).isInt({ min: 0 }),
  body("currency").optional({ nullable: true }).trim().isLength({ min: 3, max: 3 }),
  optionalDate("followUpAt"),
  optionalDate("readyAt"),
  optionalDate("sentAt"),
  optionalDate("viewedAt"),
  optionalDate("acceptedAt"),
  optionalDate("wonAt"),
  optionalDate("lostAt"),
  optionalDate("expiresAt"),
  body("proposalUrl").optional({ nullable: true }).trim().isLength({ max: 500 }),
  body("notes").optional({ nullable: true }).trim().isLength({ max: 10000 }),
];
