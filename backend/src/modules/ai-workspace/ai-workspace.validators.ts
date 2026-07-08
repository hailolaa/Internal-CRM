import { body, param } from "express-validator";

const projectStatuses = ["active", "draft", "completed", "archived"];
const runStatuses = ["success", "error", "running"];

export const createAiProjectValidator = [
  body("title").trim().notEmpty().withMessage("Project title is required").isLength({ max: 255 }),
  body("type").trim().notEmpty().withMessage("Project type is required").isLength({ max: 50 }),
  body("status").optional().isIn(projectStatuses),
];

export const updateAiProjectValidator = [
  param("id").isUUID().withMessage("Invalid project ID format"),
  body("title").optional().trim().notEmpty().isLength({ max: 255 }),
  body("type").optional().trim().notEmpty().isLength({ max: 50 }),
  body("status").optional().isIn(projectStatuses),
];

export const createAiRunValidator = [
  body("projectId").optional({ nullable: true }).isUUID().withMessage("Invalid project ID format"),
  body("agentName").trim().notEmpty().withMessage("Agent name is required").isLength({ max: 100 }),
  body("agentKey").trim().notEmpty().withMessage("Agent key is required").isLength({ max: 100 }),
  body("task").trim().notEmpty().withMessage("Task is required").isLength({ max: 255 }),
  body("input").optional({ nullable: true }).trim(),
  body("output").optional(),
  body("status").optional().isIn(runStatuses),
  body("tokens").optional().isInt({ min: 0 }),
];

export const aiProjectIdParamValidator = [
  param("id").isUUID().withMessage("Invalid project ID format"),
];

export const generateGrowthBriefValidator = [
  body("startDate").optional({ nullable: true }).isISO8601().withMessage("startDate must be a valid date"),
  body("endDate").optional({ nullable: true }).isISO8601().withMessage("endDate must be a valid date"),
];

export const generateDateRangeValidator = generateGrowthBriefValidator;

export const generateSalesAssistantValidator = [
  body("contactId").optional({ nullable: true }).isUUID().withMessage("Invalid contact ID format"),
  body("leadName").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("treatment").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("context").optional({ nullable: true }).trim().isLength({ max: 2000 }),
];

export const generateCampaignAnalystValidator = [
  body("googleSpend").optional({ nullable: true }).isFloat({ min: 0 }),
  body("metaSpend").optional({ nullable: true }).isFloat({ min: 0 }),
  body("leads").optional({ nullable: true }).isInt({ min: 0 }),
  body("bookings").optional({ nullable: true }).isInt({ min: 0 }),
  body("revenue").optional({ nullable: true }).isFloat({ min: 0 }),
];

export const generateCompetitorInsightsValidator = [
  body("competitorIds").optional().isArray({ max: 100 }),
  body("competitorIds.*").optional().isUUID().withMessage("Invalid competitor ID format"),
  body("notes").optional({ nullable: true }).trim().isLength({ max: 2000 }),
];
