import { body, param, query } from "express-validator";

const contractStatuses = ["draft", "sent", "active", "notice_given", "renewal_pending", "renewed", "ended", "cancelled"];
const alertStatuses = ["open", "resolved"];

export const commercialContractIdParamValidator = [
  param("id").isUUID().withMessage("Invalid commercial contract ID format"),
];

export const listCommercialContractsValidator = [
  query("status").optional().isIn(contractStatuses).withMessage("Unsupported contract status"),
  query("clientAccountProfileId").optional().isUUID().withMessage("Invalid clientAccountProfileId"),
];

export const listCommercialContractAlertsValidator = [
  query("status").optional().isIn(alertStatuses).withMessage("Unsupported alert status"),
  query("contractId").optional().isUUID().withMessage("Invalid contractId"),
];

export const createCommercialContractValidator = [
  body("contractKey").isString().trim().notEmpty().withMessage("contractKey is required"),
  body("clientAccountProfileId").optional({ nullable: true }).isUUID().withMessage("Invalid clientAccountProfileId"),
  body("startDate").optional({ nullable: true }).isISO8601().withMessage("startDate must be a valid date"),
  body("endDate").optional({ nullable: true }).isISO8601().withMessage("endDate must be a valid date"),
  body("renewalDate").optional({ nullable: true }).isISO8601().withMessage("renewalDate must be a valid date"),
  body("noticePeriodDays").optional({ nullable: true }).isInt({ min: 0 }).withMessage("noticePeriodDays must be a non-negative integer"),
  body("terms").isObject().withMessage("terms must be an object"),
];

export const transitionCommercialContractValidator = [
  ...commercialContractIdParamValidator,
  body("status").isIn(contractStatuses).withMessage("Unsupported contract status"),
];

export const createCommercialContractChangeOrderValidator = [
  ...commercialContractIdParamValidator,
  body("summary").isString().trim().notEmpty().withMessage("summary is required"),
  body("effectiveDate").optional({ nullable: true }).isISO8601().withMessage("effectiveDate must be a valid date"),
  body("terms").isObject().withMessage("terms must be an object"),
];

export const createCommercialContractNoticeAlertsValidator = [
  body("untilDate").isISO8601().withMessage("untilDate must be a valid date"),
];

export const generateCommercialContractRenewalsValidator = [
  body("untilDate").isISO8601().withMessage("untilDate must be a valid date"),
];
