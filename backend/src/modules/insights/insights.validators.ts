import { body, param, query } from "express-validator";

const statuses = ["open", "in_progress", "resolved", "archived"];
const severities = ["low", "medium", "high", "critical"];

export const listInsightsValidator = [
  query("status").optional().isIn([...statuses, "all"]),
  query("severity").optional().isIn([...severities, "all"]),
  query("type").optional().trim().isLength({ max: 80 }),
];

export const insightIdParamValidator = [
  param("id").isUUID().withMessage("Invalid insight ID format"),
];

export const updateInsightStatusValidator = [
  ...insightIdParamValidator,
  body("status").isIn(statuses).withMessage("Invalid insight status"),
];

export const assignInsightValidator = [
  ...insightIdParamValidator,
  body("assignedTo").optional({ nullable: true }).isUUID().withMessage("Invalid assigned user ID"),
  body("dueDate").optional({ nullable: true }).isISO8601().toDate(),
];

export const createInsightTaskValidator = [
  ...insightIdParamValidator,
  body("assignedTo").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("dueDate").optional({ nullable: true }).isISO8601().toDate(),
];
