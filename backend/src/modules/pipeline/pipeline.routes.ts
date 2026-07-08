import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { pipelineController } from "./pipeline.controller.js";
import {
  createPipelineDealValidator,
  createPipelineStageValidator,
  movePipelineDealValidator,
  pipelineStageIdParamValidator,
  updatePipelineDealValidator,
  updatePipelineStageValidator,
} from "./pipeline.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/pipeline/stages
// @desc    List ordered clinic pipeline stages
// @access  Private
router.get(
  "/stages",
  authorizePermission("contacts:read"),
  pipelineController.listStages,
);

// @route   GET /api/pipeline/deals
// @desc    List clinic pipeline opportunities
// @access  Private
router.get(
  "/deals",
  authorizePermission("contacts:read"),
  pipelineController.listDeals,
);

// @route   POST /api/pipeline/stages
// @desc    Create a clinic pipeline stage
// @access  Private
router.post(
  "/stages",
  authorizePermission("contacts:write"),
  createPipelineStageValidator,
  validate,
  pipelineController.createStage,
);

// @route   POST /api/pipeline/deals
// @desc    Create a clinic pipeline opportunity
// @access  Private
router.post(
  "/deals",
  authorizePermission("contacts:write"),
  createPipelineDealValidator,
  validate,
  pipelineController.createDeal,
);

// @route   PATCH /api/pipeline/stages/:id
// @desc    Update a clinic pipeline stage
// @access  Private
router.patch(
  "/stages/:id",
  authorizePermission("contacts:write"),
  updatePipelineStageValidator,
  validate,
  pipelineController.updateStage,
);

// @route   PATCH /api/pipeline/deals/:id
// @desc    Update a clinic pipeline opportunity
// @access  Private
router.patch(
  "/deals/:id",
  authorizePermission("contacts:write"),
  updatePipelineDealValidator,
  validate,
  pipelineController.updateDeal,
);

// @route   PATCH /api/pipeline/deals/:id/move
// @desc    Move a clinic pipeline opportunity between stages
// @access  Private
router.patch(
  "/deals/:id/move",
  authorizePermission("contacts:write"),
  movePipelineDealValidator,
  validate,
  pipelineController.moveDeal,
);

// @route   DELETE /api/pipeline/stages/:id
// @desc    Soft-delete a clinic pipeline stage
// @access  Private
router.delete(
  "/stages/:id",
  authorizePermission("contacts:write"),
  pipelineStageIdParamValidator,
  validate,
  pipelineController.deleteStage,
);

export default router;
