import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { sequencesController } from "./sequences.controller.js";
import {
  createSequenceValidator,
  enrollSequenceValidator,
  runDueSequencesValidator,
  sequenceIdParamValidator,
  unenrollSequenceValidator,
  updateSequenceValidator,
} from "./sequences.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/sequences
// @desc    List communication sequences
// @access  Private
router.get("/", authorizePermission("marketing:read"), sequencesController.listSequences);

// @route   POST /api/sequences
// @desc    Create communication sequence
// @access  Private
router.post("/", authorizePermission("marketing:write"), createSequenceValidator, validate, sequencesController.createSequence);

// @route   POST /api/sequences/run-due
// @desc    Run due sequence steps now
// @access  Private
router.post("/run-due", authorizePermission("marketing:write"), runDueSequencesValidator, validate, sequencesController.runDueSequences);

// @route   PATCH /api/sequences/:id
// @desc    Update communication sequence
// @access  Private
router.patch("/:id", authorizePermission("marketing:write"), updateSequenceValidator, validate, sequencesController.updateSequence);

// @route   GET /api/sequences/:id/enrollments
// @desc    List sequence enrollments
// @access  Private
router.get("/:id/enrollments", authorizePermission("marketing:read"), sequenceIdParamValidator, validate, sequencesController.listEnrollments);

// @route   POST /api/sequences/:id/enrollments
// @desc    Enroll a contact in a sequence
// @access  Private
router.post("/:id/enrollments", authorizePermission("marketing:write"), enrollSequenceValidator, validate, sequencesController.enrollContact);

// @route   DELETE /api/sequences/:id/enrollments/:enrollmentId
// @desc    Unenroll a contact from a sequence
// @access  Private
router.delete("/:id/enrollments/:enrollmentId", authorizePermission("marketing:write"), unenrollSequenceValidator, validate, sequencesController.unenrollContact);

// @route   DELETE /api/sequences/:id
// @desc    Soft delete communication sequence
// @access  Private
router.delete("/:id", authorizePermission("marketing:write"), sequenceIdParamValidator, validate, sequencesController.deleteSequence);

export default router;

