import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { aiWorkspaceController } from "./ai-workspace.controller.js";
import {
  aiProjectIdParamValidator,
  aiActionApprovalIdParamValidator,
  aiRunIdParamValidator,
  approveAiActionApprovalValidator,
  createAiActionApprovalValidator,
  createAiProjectValidator,
  createAiRunValidator,
  generateCampaignAnalystValidator,
  generateCompetitorInsightsValidator,
  generateDateRangeValidator,
  generateGrowthBriefValidator,
  generateSalesAssistantValidator,
  addAiChatMessageValidator,
  aiChatSessionIdParamValidator,
  createAiChatSessionValidator,
  rejectAiActionApprovalValidator,
  updateAiActionApprovalValidator,
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

// @route   GET /api/ai/chat/sessions
// @desc    List controlled assistant conversations
// @access  Private
router.get("/chat/sessions", authorizePermission("ai_assistant:use"), aiWorkspaceController.listChatSessions);

// @route   POST /api/ai/chat/sessions
// @desc    Start a controlled assistant conversation
// @access  Private
router.post(
  "/chat/sessions",
  authorizePermission("ai_assistant:use"),
  createAiChatSessionValidator,
  validate,
  aiWorkspaceController.createChatSession,
);

// @route   GET /api/ai/chat/sessions/:sessionId
// @desc    Read one controlled assistant conversation
// @access  Private
router.get(
  "/chat/sessions/:sessionId",
  authorizePermission("ai_assistant:use"),
  aiChatSessionIdParamValidator,
  validate,
  aiWorkspaceController.getChatSession,
);

// @route   POST /api/ai/chat/sessions/:sessionId/messages
// @desc    Add a message to a controlled assistant conversation
// @access  Private
router.post(
  "/chat/sessions/:sessionId/messages",
  authorizePermission("ai_assistant:use"),
  addAiChatMessageValidator,
  validate,
  aiWorkspaceController.addChatMessage,
);

// @route   GET /api/ai/action-approvals
// @desc    List post-call AI action approvals
// @access  Private
router.get("/action-approvals", authorizePermission("ai_actions:review"), aiWorkspaceController.listActionApprovals);

// @route   POST /api/ai/action-approvals
// @desc    Queue an AI-proposed action for human review
// @access  Private
router.post(
  "/action-approvals",
  authorizePermission("settings:write"),
  createAiActionApprovalValidator,
  validate,
  aiWorkspaceController.queueActionApproval,
);

// @route   GET /api/ai/action-approvals/:id
// @desc    Get an AI action approval with audit events
// @access  Private
router.get(
  "/action-approvals/:id",
  authorizePermission("ai_actions:review"),
  aiActionApprovalIdParamValidator,
  validate,
  aiWorkspaceController.getActionApproval,
);

// @route   PATCH /api/ai/action-approvals/:id
// @desc    Edit a pending AI-proposed action before approval
// @access  Private
router.patch(
  "/action-approvals/:id",
  authorizePermission("ai_actions:review"),
  updateAiActionApprovalValidator,
  validate,
  aiWorkspaceController.updateActionApproval,
);

// @route   POST /api/ai/action-approvals/:id/approve
// @desc    Approve an AI-proposed action
// @access  Private
router.post(
  "/action-approvals/:id/approve",
  authorizePermission("ai_actions:review"),
  approveAiActionApprovalValidator,
  validate,
  aiWorkspaceController.approveActionApproval,
);

// @route   POST /api/ai/action-approvals/:id/reject
// @desc    Reject an AI-proposed action
// @access  Private
router.post(
  "/action-approvals/:id/reject",
  authorizePermission("ai_actions:review"),
  rejectAiActionApprovalValidator,
  validate,
  aiWorkspaceController.rejectActionApproval,
);

// @route   POST /api/ai/action-approvals/:id/commit
// @desc    Commit an approved AI action as immutable
// @access  Private
router.post(
  "/action-approvals/:id/commit",
  authorizePermission("ai_actions:review"),
  aiActionApprovalIdParamValidator,
  validate,
  aiWorkspaceController.commitActionApproval,
);

// @route   POST /api/ai/evaluations/run
// @desc    Run deterministic AI hallucination, privacy, cost and action-safety evaluations
// @access  Private
router.post("/evaluations/run", authorizePermission("ai_actions:review"), aiWorkspaceController.runEvaluations);

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

// @route   DELETE /api/ai/runs/:id
// @desc    Soft-delete one AI run history entry
// @access  Private
router.delete("/runs/:id", authorizePermission("settings:write"), aiRunIdParamValidator, validate, aiWorkspaceController.deleteRun);

// Keep this validator imported so project IDs share one route-level contract.
void aiProjectIdParamValidator;

export default router;
