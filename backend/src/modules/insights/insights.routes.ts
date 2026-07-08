import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { insightsController } from "./insights.controller.js";
import {
  assignInsightValidator,
  createInsightTaskValidator,
  listInsightsValidator,
  updateInsightStatusValidator,
} from "./insights.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/insights
// @desc    List clinic insights
// @access  Private
router.get("/", authorizePermission("reports:read"), listInsightsValidator, validate, insightsController.listInsights);

// @route   POST /api/insights/generate
// @desc    Generate insight records from current revenue leakage
// @access  Private
router.post("/generate", authorizePermission("reports:write"), insightsController.generateInsights);

// @route   POST /api/insights/:id/task
// @desc    Create an action task from an insight
// @access  Private
router.post("/:id/task", authorizePermission("reports:write"), createInsightTaskValidator, validate, insightsController.createActionTask);

// @route   PATCH /api/insights/:id/status
// @desc    Update insight lifecycle status
// @access  Private
router.patch("/:id/status", authorizePermission("reports:write"), updateInsightStatusValidator, validate, insightsController.updateInsightStatus);

// @route   PATCH /api/insights/:id/assign
// @desc    Assign insight owner or due date
// @access  Private
router.patch("/:id/assign", authorizePermission("reports:write"), assignInsightValidator, validate, insightsController.assignInsight);

export default router;
