import { body, param, query } from "express-validator";

const mappingStatuses = ["active", "needs_review", "archived"];
const mappingSources = ["manual", "quickbooks_lookup"];

export const quickBooksOAuthCallbackValidator = [
  query("code").isString().trim().notEmpty().withMessage("QuickBooks OAuth code is required"),
  query("state").isString().trim().notEmpty().withMessage("QuickBooks OAuth state is required"),
  query("realmId").isString().trim().notEmpty().isLength({ max: 64 }).withMessage("QuickBooks realm ID is required"),
];

export const clientAccountProfileIdParamValidator = [
  param("clientAccountProfileId").isUUID().withMessage("Client account profile ID must be a valid UUID"),
];

export const quickBooksCommercialDraftIdParamValidator = [
  param("draftId").isUUID().withMessage("QuickBooks commercial draft ID must be a valid UUID"),
];

export const listQuickBooksCustomersValidator = [
  query("search").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 120 }),
];

export const saveQuickBooksClientCustomerMappingValidator = [
  ...clientAccountProfileIdParamValidator,
  body("quickbooksCustomerId").isString().trim().notEmpty().isLength({ max: 64 }),
  body("quickbooksCustomerName").isString().trim().notEmpty().isLength({ max: 255 }),
  body("quickbooksCompanyName").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 255 }),
  body("quickbooksEmail").optional({ nullable: true, checkFalsy: true }).trim().isEmail().isLength({ max: 255 }),
  body("mappingStatus").optional().isIn(mappingStatuses),
  body("mappingSource").optional().isIn(mappingSources),
];
