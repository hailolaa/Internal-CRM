import { query } from "express-validator";

export const listAuditLogValidator = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be 1 or greater"),
  query("pageSize").optional().isInt({ min: 1, max: 100 }).withMessage("Page size must be between 1 and 100"),
  query("search").optional().trim().isLength({ max: 200 }),
  query("action").optional().trim().isLength({ max: 100 }),
  query("entityType").optional().trim().isLength({ max: 100 }),
  query("userId").optional().isUUID().withMessage("Invalid user ID format"),
  query("dateFrom").optional().isISO8601().withMessage("dateFrom must be a valid date"),
  query("dateTo").optional().isISO8601().withMessage("dateTo must be a valid date"),
];
