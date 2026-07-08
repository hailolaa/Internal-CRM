import { body, param, query } from "express-validator";

const planStatuses = ["draft", "active", "completed", "archived"];
const itemStatuses = ["planned", "in_progress", "completed", "skipped"];
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export const monthlyActionPlanIdParamValidator = [
  param("id").isUUID().withMessage("Invalid monthly action plan ID format"),
];

export const monthlyActionPlanItemIdParamValidator = [
  param("planId").isUUID().withMessage("Invalid monthly action plan ID format"),
  param("itemId").isUUID().withMessage("Invalid monthly action plan item ID format"),
];

export const getMonthlyActionPlanValidator = [
  query("month").optional().matches(monthPattern).withMessage("Month must use YYYY-MM format"),
];

export const generateMonthlyActionPlanValidator = [
  body("month").optional().matches(monthPattern).withMessage("Month must use YYYY-MM format"),
];

export const updateMonthlyActionPlanStatusValidator = [
  ...monthlyActionPlanIdParamValidator,
  body("status").isIn(planStatuses).withMessage("Invalid monthly action plan status"),
];

export const updateMonthlyActionPlanItemStatusValidator = [
  ...monthlyActionPlanItemIdParamValidator,
  body("status").isIn(itemStatuses).withMessage("Invalid monthly action plan item status"),
];
