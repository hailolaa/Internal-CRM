import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { aiWorkspaceController } from "./ai-workspace.controller.js";
import {
  aiProjectIdParamValidator,
  createAiProjectValidator,
  createAiRunValidator,
  generateCampaignAnalystValidator,
  generateCompetitorInsightsValidator,
  generateDateRangeValidator,
  generateGrowthBriefValidator,
  generateSalesAssistantValidator,
  updateAiProjectValidator,
} from "./ai-workspace.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/ai/projects
// @desc    List AI workspace projects
// @access  Private
router.get("/projects", authorizePermission("settings:read"), aiWorkspaceController.listProjects);

// @route   POST /api/ai/projects
// @desc    Create AI workspace project
// @access  Private
router.post("/projects", authorizePermission("settings:write"), createAiProjectValidator, validate, aiWorkspaceController.createProject);

// @route   PATCH /api/ai/projects/:id
// @desc    Update AI workspace project
// @access  Private
router.patch("/projects/:id", authorizePermission("settings:write"), updateAiProjectValidator, validate, aiWorkspaceController.updateProject);

// @route   GET /api/ai/runs
// @desc    List AI run history
// @access  Private
router.get("/runs", authorizePermission("settings:read"), aiWorkspaceController.listRuns);

// @route   POST /api/ai/growth-brief/generate
// @desc    Generate a clinic-scoped Phase 1 Growth Brief from live backend metrics
// @access  Private
router.post(
  "/growth-brief/generate",
  authorizePermission("settings:write"),
  generateGrowthBriefValidator,
  validate,
  aiWorkspaceController.generateGrowthBrief,
);

// @route   POST /api/ai/show-rate/generate
// @desc    Generate clinic-scoped no-show risk predictions from appointments and deposits
// @access  Private
router.post(
  "/show-rate/generate",
  authorizePermission("settings:write"),
  generateDateRangeValidator,
  validate,
  aiWorkspaceController.generateShowRate,
);

// @route   POST /api/ai/sales-assistant/generate
// @desc    Generate conversion follow-up recommendations from lead context
// @access  Private
router.post(
  "/sales-assistant/generate",
  authorizePermission("settings:write"),
  generateSalesAssistantValidator,
  validate,
  aiWorkspaceController.generateSalesAssistant,
);

// @route   POST /api/ai/campaign-analyst/generate
// @desc    Generate campaign performance recommendations from spend and conversion inputs
// @access  Private
router.post(
  "/campaign-analyst/generate",
  authorizePermission("settings:write"),
  generateCampaignAnalystValidator,
  validate,
  aiWorkspaceController.generateCampaignAnalyst,
);

// @route   POST /api/ai/ltv-optimiser/generate
// @desc    Generate LTV and rebooking recommendations from treatment and contact data
// @access  Private
router.post(
  "/ltv-optimiser/generate",
  authorizePermission("settings:write"),
  generateDateRangeValidator,
  validate,
  aiWorkspaceController.generateLtvOptimiser,
);

// @route   POST /api/ai/competitor-insights/generate
// @desc    Generate competitor positioning insights from stored competitor records
// @access  Private
router.post(
  "/competitor-insights/generate",
  authorizePermission("settings:write"),
  generateCompetitorInsightsValidator,
  validate,
  aiWorkspaceController.generateCompetitorInsights,
);

// @route   POST /api/ai/runs
// @desc    Create AI run history entry
// @access  Private
router.post("/runs", authorizePermission("settings:write"), createAiRunValidator, validate, aiWorkspaceController.createRun);

// Keep this validator imported so project IDs share one route-level contract.
void aiProjectIdParamValidator;

export default router;
