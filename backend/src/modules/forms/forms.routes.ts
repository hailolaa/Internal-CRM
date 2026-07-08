import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { formsController } from "./forms.controller.js";
import {
  createFormValidator,
  formIdParamValidator,
  formSubmissionIdParamValidator,
  linkSubmissionToPipelineValidator,
  updateFormValidator,
} from "./forms.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/forms
// @desc    List clinic form definitions
// @access  Private
router.get("/", authorizePermission("settings:read"), formsController.listForms);

// @route   GET /api/forms/submissions
// @desc    List clinic form submissions
// @access  Private
router.get("/submissions", authorizePermission("settings:read"), formsController.listSubmissions);

// @route   POST /api/forms/submissions/:id/pipeline
// @desc    Link a form submission to a contact and pipeline deal
// @access  Private
router.post(
  "/submissions/:id/pipeline",
  authorizePermission("settings:write"),
  linkSubmissionToPipelineValidator,
  validate,
  formsController.linkSubmissionToPipeline,
);

// @route   DELETE /api/forms/submissions/:id
// @desc    Archive a form submission with audit trail
// @access  Private
router.delete(
  "/submissions/:id",
  authorizePermission("settings:write"),
  formSubmissionIdParamValidator,
  validate,
  formsController.archiveSubmission,
);

// @route   POST /api/forms
// @desc    Create clinic form definition
// @access  Private
router.post("/", authorizePermission("settings:write"), createFormValidator, validate, formsController.createForm);

// @route   PATCH /api/forms/:id
// @desc    Update clinic form definition
// @access  Private
router.patch("/:id", authorizePermission("settings:write"), updateFormValidator, validate, formsController.updateForm);

// @route   DELETE /api/forms/:id
// @desc    Soft delete clinic form definition
// @access  Private
router.delete("/:id", authorizePermission("settings:write"), formIdParamValidator, validate, formsController.deleteForm);

export default router;
