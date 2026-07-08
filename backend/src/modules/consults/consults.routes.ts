import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { consultsController } from "./consults.controller.js";
import { createConsultValidator, updateConsultValidator } from "./consults.validators.js";

const router = Router();

router.use(authenticate);

// @route   GET /api/consults
// @desc    List consult outcomes
// @access  Private
router.get(
  "/",
  authorizePermission("appointments:read"),
  consultsController.listConsults,
);

// @route   GET /api/consults/outcomes
// @desc    Read Phase 1 default consult outcome options
// @access  Private
router.get(
  "/outcomes",
  authorizePermission("appointments:read"),
  consultsController.getOutcomeOptions,
);

// @route   GET /api/consults/export/csv
// @desc    Export clinic-scoped consult outcomes as CSV
// @access  Private
router.get(
  "/export/csv",
  authorizePermission("appointments:read"),
  consultsController.exportCsv,
);

// @route   POST /api/consults
// @desc    Create consult outcome
// @access  Private
router.post(
  "/",
  authorizePermission("appointments:write"),
  createConsultValidator,
  validate,
  consultsController.createConsult,
);

// @route   PATCH /api/consults/:id/outcome
// @desc    Update consult outcome transition
// @access  Private
router.patch(
  "/:id/outcome",
  authorizePermission("appointments:write"),
  updateConsultValidator,
  validate,
  consultsController.updateOutcome,
);

// @route   PATCH /api/consults/:id
// @desc    Update consult outcome
// @access  Private
router.patch(
  "/:id",
  authorizePermission("appointments:write"),
  updateConsultValidator,
  validate,
  consultsController.updateConsult,
);

export default router;
