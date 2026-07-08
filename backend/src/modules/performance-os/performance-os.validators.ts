import { query } from "express-validator";

const alertStatuses = ["open", "acknowledged", "resolved", "archived", "all"];
const severities = ["low", "medium", "high", "critical", "all"];

export const attributionChainValidator = [
  query("contactId").isUUID().withMessage("contactId is required"),
];

export const listPerformanceAlertsValidator = [
  query("contactId").optional().isUUID().withMessage("Invalid contactId"),
  query("status").optional().isIn(alertStatuses).withMessage("Invalid alert status"),
  query("severity").optional().isIn(severities).withMessage("Invalid alert severity"),
  query("type").optional().trim().isLength({ max: 80 }),
];
