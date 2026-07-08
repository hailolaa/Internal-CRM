import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { callsController } from "./calls.controller.js";
import {
  callIdParamValidator,
  createCallValidator,
  createRecordingDeletionRequestValidator,
  transcribeCallValidator,
  updateCallValidator,
  updateRecordingDeletionRequestValidator,
} from "./calls.validators.js";
import { createMissedCallFollowUpValidator } from "./calls.validators.js";

const router = Router();

router.use(authenticate);

// @route   POST /api/calls
// @desc    Create a manual clinic call record
// @access  Private
router.post(
  "/",
  authorizePermission("calls:write"),
  createCallValidator,
  validate,
  callsController.createCall,
);

// @route   GET /api/calls
// @desc    List clinic call records
// @access  Private
router.get("/", authorizePermission("calls:read"), callsController.listCalls);

// @route   GET /api/calls/summary
// @desc    Read clinic call conversion summary
// @access  Private
router.get("/summary", authorizePermission("calls:read"), callsController.getSummary);

// @route   GET /api/calls/outcomes
// @desc    Read Phase 1 default call outcome options
// @access  Private
router.get("/outcomes", authorizePermission("calls:read"), callsController.getOutcomeOptions);

// @route   GET /api/calls/export/csv
// @desc    Export clinic-scoped calls as CSV
// @access  Private
router.get("/export/csv", authorizePermission("calls:read"), callsController.exportCsv);

// @route   GET /api/calls/analytics/breakdowns
// @desc    Read category-level AI call score breakdowns
// @access  Private
router.get("/analytics/breakdowns", authorizePermission("calls:read"), callsController.getAnalyticsBreakdowns);

// @route   GET /api/calls/:id
// @desc    Read one clinic call record
// @access  Private
router.get(
  "/:id",
  authorizePermission("calls:read"),
  callIdParamValidator,
  validate,
  callsController.getCall,
);

// @route   PATCH /api/calls/:id
// @desc    Update call outcome, notes, assignment, or contact link
// @access  Private
router.patch(
  "/:id",
  authorizePermission("calls:write"),
  updateCallValidator,
  validate,
  callsController.updateCall,
);

// @route   POST /api/calls/:id/recording-deletion-requests
// @desc    Create a recording deletion workflow request for a call
// @access  Private
router.post(
  "/:id/recording-deletion-requests",
  authorizePermission("calls:write"),
  createRecordingDeletionRequestValidator,
  validate,
  callsController.createRecordingDeletionRequest,
);

// @route   PATCH /api/calls/recording-deletion-requests/:requestId
// @desc    Update a recording deletion workflow request
// @access  Private
router.patch(
  "/recording-deletion-requests/:requestId",
  authorizePermission("calls:write"),
  updateRecordingDeletionRequestValidator,
  validate,
  callsController.updateRecordingDeletionRequest,
);

// @route   POST /api/calls/:id/generate-intelligence
// @desc    Generate and persist call intelligence fields
// @access  Private
router.post(
  "/:id/generate-intelligence",
  authorizePermission("calls:write"),
  callIdParamValidator,
  validate,
  callsController.generateIntelligence,
);

// @route   POST /api/calls/:id/transcribe
// @desc    Transcribe call recording and refresh intelligence
// @access  Private
router.post(
  "/:id/transcribe",
  authorizePermission("calls:write"),
  transcribeCallValidator,
  validate,
  callsController.transcribeRecording,
);

// Trigger missed-call follow-up
router.post(
  "/:id/follow-up",
  authorizePermission("calls:write"),
  createMissedCallFollowUpValidator,
  validate,
  callsController.followUp,
);

export default router;
